# Concepts: lockfiles, installs, and why this gate exists

## What problem this solves

Some npm supply-chain worms (including the August 2026 Shai-Hulud / ChainDrop-class
campaigns that hit packages in the `keyv` / `cacheable` / `flat-cache` family) run
malicious code through **lifecycle scripts** such as `preinstall`.

If CI does a normal `npm install` / `pnpm install` **before** scanning, the runner may
already have executed attacker code. This product is designed to **fail the build from
lockfile evidence first**, and only optionally install afterward with scripts disabled.

## Lockfiles are the contract

| Idea | Meaning |
| --- | --- |
| Lockfile | Exact package + version map (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`). |
| Commit the lockfile | CI and other machines install the **same** tree. |
| `npm ci` / frozen install | Install **exactly** what the lockfile says. Prefer this in CI over `npm install`, which can rewrite the lockfile. |

Never rely on CI inventing a lockfile with `npm install`. Commit lockfiles; scan them; then install from them.

## `npm ci` vs `npm install` (and friends)

| Command | Typical CI use | Risk note |
| --- | --- | --- |
| `npm ci` | Yes — deterministic from `package-lock.json` | Still runs lifecycle scripts unless `--ignore-scripts`. |
| `npm install` | Avoid in CI for apps you ship | May mutate lockfiles; runs scripts by default. |
| `pnpm install --frozen-lockfile` | Yes | Same script caveat — add `--ignore-scripts` when scanning first. |
| `yarn install --frozen-lockfile` | Yes | Same script caveat. |

## Install input modes (`install`)

| Value | Behavior | When to use |
| --- | --- | --- |
| `none` | Scan only; do not install | Pure gate jobs; fastest; no `node_modules`. |
| `ci-ignore-scripts` (**default**) | After scans, install frozen **without** lifecycle scripts | You want a tree for later jobs *without* running `preinstall`. |
| `ci` | After scans, install frozen **with** scripts | Only when you accept lifecycle scripts after a clean scan. |

**Tradeoff:** `--ignore-scripts` can break packages that *legitimately* need compile steps (`node-gyp`, etc.). Prefer `none` for the security gate, and let your build job install separately once this gate is green.

## `fail-on` mapping

| Value | Campaign IOC check | OSV Scanner | `audit-ci` |
| --- | --- | --- | --- |
| `malware` | **Fail** on curated package versions + IOC filenames | Fail only on advisories with IDs starting with `MAL` (other vulns warn) | Skipped as a gate |
| `critical` | Fail | Fail on any OSV finding for scanned lockfiles | Fail at severity `critical` |
| `high` (**default**) | Fail | Fail on any OSV finding for scanned lockfiles | Fail at severity `high` |

OSV coverage depends on what is published to [OSV.dev](https://osv.dev/). Campaign IOC checks catch known-bad versions/filenames even when an advisory is still catching up.

## Why pin workflow SHAs

Git tags like `@v0.1.0` or `@main` can move. A **commit SHA** is immutable: what you reviewed is what runs.

```yaml
uses: dbarrett24/supply-chain-ci/.github/workflows/npm-supply-chain.yml@0123456789abcdef0123456789abcdef01234567
```

After tagging `v0.1.0`, resolve that tag’s SHA once and pin the SHA (keep the tag in a comment).

## Permissions

The reusable workflow requests only:

```yaml
permissions:
  contents: read
```

That is enough to check out the consumer repository and read lockfiles. We do **not** upload SARIF by default (which would need `security-events: write`). Harden-Runner runs in **audit** mode for egress visibility without blocking builds by default.

## What this is not

- Not endpoint remediation ([only-cliches/shai-hulud-remediation](https://github.com/only-cliches/shai-hulud-remediation)) — see [remediation.md](./remediation.md).
- Not a replacement for your repo’s test/build workflows.
