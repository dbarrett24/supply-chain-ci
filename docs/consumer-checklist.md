# Consumer checklist (per repo)

- [ ] Create `.github/workflows/supply-chain.yml` that calls  
      `dbarrett24/supply-chain-ci/.github/workflows/npm-supply-chain.yml@<COMMIT_SHA>`
- [ ] Pin the **full commit SHA** (not `@main`). Put the release tag in a trailing comment.
- [ ] Set `lockfile-paths` to the lockfiles you actually ship.
- [ ] Prefer `install: none` or `ci-ignore-scripts` for the security gate.
- [ ] Commit lockfiles; use `ci` / `--frozen-lockfile` in CI, not a floating `install`.
- [ ] Set `package-manager` to `npm`, `pnpm`, `yarn`, or `auto`.
- [ ] Add Dependabot for `npm` (or your ecosystem) **and** `github-actions`.
- [ ] After a scare: rotate tokens ([remediation.md](./remediation.md)), fix lockfiles, reinstall clean, re-run this gate.
