#!/usr/bin/env node
/**
 * Lockfile + filename campaign IOC scanner for CI.
 * Detection only — never deletes node_modules or mutates developer machines.
 */
import { readFileSync, readdirSync, statSync, existsSync, appendFileSync } from "node:fs";
import { join, basename, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));
const root = args.root || process.cwd();
const iocPath = args.ioc || join(__dirname, "..", "config", "campaign-iocs.json");
const lockfiles = (args.lockfile || [])
  .flatMap((v) =>
    String(v)
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  );

const ioc = JSON.parse(readFileSync(iocPath, "utf8"));
const packageHits = [];
const fileHits = [];

for (const lockfile of lockfiles) {
  const abs = lockfile.startsWith("/") ? lockfile : join(root, lockfile);
  if (!existsSync(abs)) {
    console.warn(`::warning::Lockfile not found: ${lockfile}`);
    continue;
  }
  const text = readFileSync(abs, "utf8");
  for (const { name, version } of extractPackages(abs, text)) {
    const badVersions = ioc.packages[name];
    if (badVersions?.includes(version)) {
      packageHits.push({
        lockfile: relative(root, abs) || abs,
        name,
        version,
      });
    }
  }
}

const scanRoots = lockfiles.length
  ? [...new Set(lockfiles.map((lf) => dirname(join(root, lf))))]
  : [root];

for (const scanRoot of scanRoots) {
  if (!existsSync(scanRoot)) continue;
  walkFiles(scanRoot, (filePath) => {
    const name = basename(filePath);
    for (const pattern of ioc.filename_patterns || []) {
      if (matchGlob(name, pattern)) {
        fileHits.push({
          path: relative(root, filePath) || filePath,
          pattern,
        });
        break;
      }
    }
  });
}

const failed = packageHits.length > 0 || fileHits.length > 0;

writeSummary(failed, packageHits, fileHits);

if (failed) {
  console.error("Campaign IOC findings:");
  for (const hit of packageHits) {
    console.error(`  package ${hit.name}@${hit.version} in ${hit.lockfile}`);
  }
  for (const hit of fileHits) {
    console.error(`  file ${hit.path} (pattern ${hit.pattern})`);
  }
  process.exit(1);
}

console.log("Campaign IOC scan: no curated indicators found.");
process.exit(0);

function writeSummary(failed, packageHits, fileHits) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const lines = [
    "## Campaign IOC scan",
    "",
    failed ? "**Result:** FAIL" : "**Result:** PASS",
    "",
  ];
  if (packageHits.length) {
    lines.push("### Known-bad package versions in lockfiles", "");
    for (const hit of packageHits) {
      lines.push(`- \`${hit.name}@${hit.version}\` in \`${hit.lockfile}\``);
    }
    lines.push("");
  }
  if (fileHits.length) {
    lines.push("### Suspicious campaign filenames", "");
    for (const hit of fileHits) {
      lines.push(`- \`${hit.path}\` (matched \`${hit.pattern}\`)`);
    }
    lines.push("");
  }
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
}

function extractPackages(path, text) {
  const base = basename(path);
  if (base === "pnpm-lock.yaml") return extractPnpmLock(text);
  if (base === "yarn.lock") return extractYarnLock(text);
  return extractNpmLock(text);
}

function extractNpmLock(text) {
  const out = [];
  try {
    const json = JSON.parse(text);
    if (json.packages && typeof json.packages === "object") {
      for (const [key, meta] of Object.entries(json.packages)) {
        if (!key) continue;
        const name = npmNameFromKey(key);
        const version = meta?.version;
        if (name && version) out.push({ name, version });
      }
    }
    if (json.dependencies && typeof json.dependencies === "object") {
      walkNpmDeps(json.dependencies, out);
    }
  } catch (err) {
    console.warn(`::warning::Failed to parse npm lockfile: ${err.message}`);
  }
  return out;
}

function walkNpmDeps(deps, out) {
  for (const [name, meta] of Object.entries(deps)) {
    if (meta?.version) out.push({ name, version: meta.version });
    if (meta?.dependencies) walkNpmDeps(meta.dependencies, out);
  }
}

function npmNameFromKey(key) {
  const idx = key.lastIndexOf("node_modules/");
  if (idx === -1) return null;
  return key.slice(idx + "node_modules/".length);
}

function extractPnpmLock(text) {
  const out = [];
  const re =
    /^\s{2}(?:'([^']+)@([^']+)'|"([^"]+)@([^"]+)"|((?:@[^/\s]+\/)?[^@\s]+)@([^:\s]+)):/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1] || m[3] || m[5];
    const version = m[2] || m[4] || m[6];
    if (name && version) out.push({ name, version });
  }
  return out;
}

function extractYarnLock(text) {
  const out = [];
  const re =
    /^(?:'([^']+)@([^']+)'|"([^"]+)@([^"]+)"|((?:@[^/\s]+\/)?[^@\s]+)@([^:\s]+))\s*:/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1] || m[3] || m[5];
    let version = m[2] || m[4] || m[6];
    if (!name || !version) continue;
    version = version.replace(/^npm:/, "");
    out.push({ name, version });
  }
  return out;
}

function walkFiles(dir, onFile, depth = 0) {
  if (depth > 12) return;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (
      entry === "node_modules" ||
      entry === ".git" ||
      entry === ".pnpm-store" ||
      entry === "dist" ||
      entry === "coverage"
    ) {
      continue;
    }
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkFiles(full, onFile, depth + 1);
    else if (st.isFile()) onFile(full);
  }
}

function matchGlob(name, pattern) {
  if (!pattern.includes("*")) return name === pattern;
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(name);
}

function parseArgs(argv) {
  const out = { lockfile: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") out.root = argv[++i];
    else if (a === "--ioc") out.ioc = argv[++i];
    else if (a === "--lockfile") out.lockfile.push(argv[++i]);
    else if (a.startsWith("--lockfile=")) {
      out.lockfile.push(a.slice("--lockfile=".length));
    }
  }
  return out;
}
