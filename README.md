# supply-chain-ci

**Reusable GitHub Actions product** that fails your build when npm/pnpm/yarn lockfiles look unsafe.

It is a **CI detection gate**, not a laptop cleanup tool, and not an AI code review bot.

| This repo | Sibling repos (different jobs) |
| --- | --- |
| **supply-chain-ci** — dependency safety in CI | **[spectackler-ci](https://github.com/dbarrett24/spectackler-ci)** — LLM PR review personas |
| | **[personal-dev-configs](https://github.com/dbarrett24/personal-dev-configs)** — evolve-ui monorepo that *calls* this action |
| | **[only-cliches/shai-hulud-remediation](https://github.com/only-cliches/shai-hulud-remediation)** — optional **endpoint** cleanup after an incident |

## Why it exists (plain English)

In August 2026, npm worms in the Shai-Hulud / ChainDrop class abused packages such as
`keyv` / `cacheable` / `flat-cache`. They often run via **`preinstall` scripts**.

`npm audit` alone is slow and incomplete for that threat. You want one installable workflow you
can pin by **commit SHA** and drop into many personal repos:

1. Read the lockfile **before** running install scripts  
2. Fail the job if known-bad versions, malware advisories, or high/critical vulns show up  
3. Optionally install with `--ignore-scripts` only after scans pass  

## Quick start (about 5 minutes)

### 1. Add a tiny workflow to your repo

Create `.github/workflows/supply-chain.yml`:

```yaml
name: supply-chain

on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  supply-chain:
    permissions:
      contents: read
    uses: dbarrett24/supply-chain-ci/.github/workflows/npm-supply-chain.yml@PIN_ME_TO_COMMIT_SHA # v0.1.0
    with:
      package-manager: auto
      lockfile-paths: |
        **/package-lock.json
        **/pnpm-lock.yaml
        **/yarn.lock
      fail-on: high
      install: none
```

Copy the fuller template from [`examples/consumer-workflow.yml`](./examples/consumer-workflow.yml).

### 2. Pin a commit SHA (required)

Do **not** use `@main`.

1. Open the [releases](https://github.com/dbarrett24/supply-chain-ci/releases) page (or tags).  
2. Find **`v0.1.0`**.  
3. Copy that tag’s **full commit SHA**.  
4. Replace `PIN_ME_TO_COMMIT_SHA` with it. Keep `# v0.1.0` as a comment.

```bash
# After this repo is tagged locally/remotely:
git rev-parse v0.1.0
```

### 3. Commit your lockfile

CI must see `package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock`. Do not let CI invent one with
a floating `npm install`.

### 4. Add Dependabot

Track both npm deps and Actions pins (including this workflow’s SHA):

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: "/"
    schedule:
      interval: weekly
  - package-ecosystem: github-actions
    directory: "/"
    schedule:
      interval: weekly
```

### 5. If you also use SpecTackler

Make the review job wait on this gate:

```yaml
spectackler:
  needs: supply-chain
  # ...
```

### 6. After a suspected compromise

Rotate tokens first. Optionally run endpoint remediation on the **laptop**. Fix lockfiles. Reinstall
clean. Details: [`docs/remediation.md`](./docs/remediation.md).

## What the reusable workflow does

Order matters:

1. **Checkout** the consumer repo (SHA-pinned `actions/checkout`)  
2. **Optional Harden-Runner** (egress audit mode)  
3. **Setup Node** with cache keyed on lockfiles  
4. **Lockfile-only scans before scripted installs**
   - Curated **campaign IOC** check (known-bad package versions + filenames such as
     `Math_Symbol.js`, `math_init.js`, `setup.mjs`, `bun-dl-*`)
   - **Google OSV Scanner** on each lockfile  
   - **`audit-ci`** at `high` or `critical` (skipped as a gate when `fail-on: malware`)  
5. **Optional install**: `none` (default for many consumers) or
   `npm ci --ignore-scripts` / `pnpm install --frozen-lockfile --ignore-scripts`  
6. **Job summary** with pass/fail per lockfile  

Permissions: **`contents: read` only**. No Codacy requirement. No SARIF upload by default.

### Inputs

| Input | Default | Notes |
| --- | --- | --- |
| `package-manager` | `auto` | `npm` \| `pnpm` \| `yarn` \| `auto` |
| `lockfile-paths` | common lockfile globs | Multiline globs |
| `node-version` | `22` | Passed to `actions/setup-node` |
| `fail-on` | `high` | `high` \| `critical` \| `malware` — see [concepts](./docs/concepts.md) |
| `install` | `ci-ignore-scripts` | `none` \| `ci-ignore-scripts` \| `ci` |
| `enable-harden-runner` | `true` | step-security Harden-Runner audit mode |
| `enable-campaign-ioc` | `true` | Curated IOC scan |
| `working-directory` | `.` | Monorepo subdirectory |

## Explicit non-goals

- No LLM / SpecTackler review  
- No deleting `node_modules` on developer machines from CI  
- No Codacy requirement  
- No replacing repo-specific CI (tests, build, Storybook) in personal-dev-configs  
- No `curl | bash` remote remediations  

## Ecosystem map

| Repo | Role |
| --- | --- |
| `spectackler-ci` | PR personas / LLM review |
| **`supply-chain-ci` (this)** | Dependency safety gate |
| `personal-dev-configs` | Keep `pnpm security:validate` + evolve-ui `ci.yml`; call this workflow instead of one-off Shai-Hulud YAML |
| `stream-deck-plugins` | Simple first npm consumer (`plugins/*/package-lock.json`) |

## Docs

- [Concepts](./docs/concepts.md) — lockfiles, scripts, `fail-on`, permissions  
- [Remediation](./docs/remediation.md) — when to use only-cliches cleanup + token rotation  
- [Consumer checklist](./docs/consumer-checklist.md) — per-repo steps  
- [Example workflow](./examples/consumer-workflow.yml)  

## Local dry-run

### Campaign IOC script (no Actions required)

```bash
# Should PASS
node scripts/campaign-ioc-scan.mjs \
  --root . \
  --lockfile fixtures/clean/package-lock.json

# Should FAIL (exit 1)
node scripts/campaign-ioc-scan.mjs \
  --root . \
  --lockfile fixtures/known-bad/package-lock.json
```

### Optional: `act`

If you use [nektos/act](https://github.com/nektos/act):

```bash
act -W .github/workflows/self-test.yml -j clean-fixture
```

Reusable `workflow_call` jobs are awkward under `act`; prefer the composite self-test jobs or push
to GitHub and watch **self-test**.

## Development / self-test

This repo’s `.github/workflows/self-test.yml`:

- Scans `fixtures/clean` and expects **pass**  
- Scans `fixtures/known-bad` and expects **IOC fail**  
- Smoke-calls the reusable workflow against the clean fixture  

`fixtures/known-bad` lists `keyv@6.0.0` and IOC filenames **on purpose**. **Do not**
`npm install` that fixture — it exists for lockfile/filename detection only.

## Versioning

- Tag: **`v0.1.0`**  
- Consumers: pin that tag’s **commit SHA**  
- Dependabot on `github-actions` keeps pins fresh  

## License

MIT — see [LICENSE](./LICENSE).
