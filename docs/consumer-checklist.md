# Consumer checklist (per repo)

Use this when adding `supply-chain-ci` to a repository.

## Install

- [ ] Create `.github/workflows/supply-chain.yml` that calls  
      `dbarrett24/supply-chain-ci/.github/workflows/npm-supply-chain.yml@<COMMIT_SHA>`
- [ ] Pin the **full commit SHA** (not `@main`). Put the release tag in a trailing comment.
- [ ] Set `lockfile-paths` to the lockfiles you actually ship (monorepos: list or glob carefully).
- [ ] Prefer `install: none` or `ci-ignore-scripts` for the security gate.
- [ ] Confirm the workflow file requests only the permissions you need (caller can stay at
      `contents: read` for this reusable workflow).

## Lockfiles & package managers

- [ ] Commit `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock`.
- [ ] CI installs with `ci` / `--frozen-lockfile` — not a floating `install` that rewrites locks.
- [ ] Set `package-manager` to `npm`, `pnpm`, `yarn`, or `auto`.

## Dependabot

- [ ] Add Dependabot for `npm` (or your ecosystem) **and** `github-actions`.
- [ ] Let Dependabot open PRs that bump the pinned SHA of this reusable workflow over time.

## Ordering with SpecTackler

- [ ] If the repo also runs [spectackler-ci](https://github.com/dbarrett24/spectackler-ci) (LLM PR
      review), make that job `needs: supply-chain` (or your job id) so review burns minutes only
      after dependency safety is green.

## After a scare

- [ ] Rotate tokens (see [remediation.md](./remediation.md)).
- [ ] Optionally run only-cliches remediation on the **laptop**.
- [ ] Fix lockfiles; reinstall clean; re-run this gate.

## Ecosystem-specific notes

| Repo | Note |
| --- | --- |
| `personal-dev-configs` | Keep `pnpm security:validate` (Cursor rules check). Keep evolve-ui `ci.yml` for build/test. Replace any one-off Shai-Hulud workflow with a call to this reusable workflow. |
| `stream-deck-plugins` | Simple first npm consumer — `plugins/*/package-lock.json`. |
| `spectackler-ci` | Unrelated product (PR personas). Do not fold supply-chain into it. |
