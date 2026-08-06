# Remediation (optional, post-incident)

This repository is **CI detection / fail-the-build**. It does **not** delete `node_modules`
on developer laptops, rewrite IDE hooks, or `curl | bash` remote cleanup scripts.

## When you need endpoint remediation

Use remediation tools **on the machine you believe was compromised** (laptop, build agent
image), **after** you have preserved evidence and **while** you rotate credentials.

Recommended companion (separate product, different job):

- **[only-cliches/shai-hulud-remediation](https://github.com/only-cliches/shai-hulud-remediation)**  
  Endpoint remediation inspired by Wiz / Aikido reporting for the Shai-Hulud npm campaign.  
  It can remove infected `node_modules` trees and clean specific Claude / VS Code persistence
  hooks. It is **destructive** by design — read its README before running.

**Do not** wire that remediation into this CI workflow. CI should detect and fail; humans
(or RMM) remediate endpoints.

## After a suspected compromise (order matters)

1. **Treat tokens as burned** — rotate npm tokens, GitHub PATs/fine-grained tokens, cloud keys,
   SSH keys, and CI secrets that the machine could access.
2. **Optional:** run [shai-hulud-remediation](https://github.com/only-cliches/shai-hulud-remediation)
   in audit mode first, then remediation, on the **laptop / agent** — not from this Action.
3. **Fix lockfiles** on a trusted machine — remove/replace compromised package versions; commit.
4. **Reinstall clean** — delete local `node_modules`, then `npm ci --ignore-scripts` /
   `pnpm install --frozen-lockfile --ignore-scripts` until you trust lifecycle scripts again.
5. **Re-run this supply-chain gate** and your normal test suite.

## IOC overlap (detection only)

Our curated list in `config/campaign-iocs.json` overlaps indicators discussed in Wiz research and
the remediation project (package versions + filenames like `Math_Symbol.js`, `math_init.js`,
`setup.mjs`, `bun-dl-*`). We intentionally **do not vendor** their destructive scripts.

Refresh the curated list deliberately when a new campaign wave lands — prefer committed JSON over
blindly trusting a remote CSV at runtime.
