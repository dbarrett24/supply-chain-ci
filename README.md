# supply-chain-ci

Reusable GitHub Actions workflow that fails the build when npm / pnpm / yarn lockfiles look unsafe.

**Not an npm package.** You do not `npm install` this. Consumers call it from a workflow:

```yaml
jobs:
  supply-chain:
    uses: dbarrett24/supply-chain-ci/.github/workflows/npm-supply-chain.yml@<COMMIT_SHA>
```

It is a CI detection gate (scan lockfiles, fail the job). It does not remediate developer machines.

## Why

Lifecycle-script worms (e.g. Shai-Hulud / ChainDrop-class campaigns hitting `keyv` / `cacheable` /
`flat-cache`) can run during `preinstall`. Scanning after a normal install is too late.

This workflow:

1. Scans lockfiles **before** any install that runs lifecycle scripts
2. Fails on curated campaign IOCs, OSV findings, and/or `audit-ci` at a chosen severity
3. Optionally installs afterward with `--ignore-scripts`

## Quick start

### 1. Add a workflow

Create `.github/workflows/supply-chain.yml` (or copy [`examples/consumer-workflow.yml`](./examples/consumer-workflow.yml)):

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

### 2. Pin a commit SHA

Do not use `@main`. Resolve the release tag once and pin the full SHA:

```bash
git ls-remote --tags https://github.com/dbarrett24/supply-chain-ci.git v0.1.0
# or locally: git rev-parse v0.1.0^{commit}
```

**v0.1.3 commit:** `d1760313f8ba2479716d1f0478f79eeb3b4d4096`

**v0.1.0 commit (buggy tooling checkout):** `6de5ab9dfbc962f6db0b7339a57c2a5aa10562fc` — do not use for new consumers

### 3. Commit lockfiles

Ship `package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock`. Do not let CI invent one with a floating
`npm install`.

### 4. Dependabot

Track npm deps and Action pins (including this workflow’s SHA):

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

### 5. After a suspected compromise

Rotate tokens. Optionally run endpoint remediation on the laptop (see
[`docs/remediation.md`](./docs/remediation.md)). Fix lockfiles, reinstall clean, re-run this gate.

## Workflow behavior

1. Checkout consumer repo  
2. Optional Harden-Runner (egress audit)  
3. Setup Node (cache keyed on lockfiles)  
4. Lockfile scans before scripted installs: campaign IOCs → OSV → `audit-ci`  
5. Optional install (`none` / `ci-ignore-scripts` / `ci`)  
6. Job summary with per-lockfile results  

Permissions: `contents: read` only.

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

## Non-goals

- LLM / PR review bots  
- Deleting `node_modules` on developer machines from CI  
- Codacy (or any SaaS) as a hard dependency  
- Replacing a repo’s own test/build workflows  
- `curl | bash` remote remediations  

## Docs

- [Concepts](./docs/concepts.md) — lockfiles, scripts, `fail-on`, permissions  
- [Remediation](./docs/remediation.md) — optional endpoint cleanup + token rotation  
- [Consumer checklist](./docs/consumer-checklist.md)  
- [Example workflow](./examples/consumer-workflow.yml)  

## Local dry-run

```bash
# Should PASS
node scripts/campaign-ioc-scan.mjs --root . --lockfile fixtures/clean/package-lock.json

# Should FAIL (exit 1)
node scripts/campaign-ioc-scan.mjs --root . --lockfile fixtures/known-bad/package-lock.json
```

Optional: `act -W .github/workflows/self-test.yml -j clean-fixture`

## Self-test

`.github/workflows/self-test.yml` scans `fixtures/clean` (expect pass) and `fixtures/known-bad`
(expect IOC fail). Do not `npm install` the known-bad fixture.

## Versioning

| Item | Value |
| --- | --- |
| Tag | `v0.1.3` |
| Pin SHA | `d1760313f8ba2479716d1f0478f79eeb3b4d4096` |

Consumers pin the **commit SHA**. Dependabot on `github-actions` keeps pins fresh.

## License

MIT — see [LICENSE](./LICENSE).
