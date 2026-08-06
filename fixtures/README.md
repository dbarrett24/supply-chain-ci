# Fixtures

Tiny lockfiles for this product’s **self-test** workflow.

| Directory | Purpose |
| --- | --- |
| `clean/` | Harmless `ms@2.1.3` lockfile — scans should pass |
| `known-bad/` | Declares campaign-IOC `keyv@6.0.0` + IOC filenames — detection should **fail** |

**Never install `known-bad/`.** It is for lockfile/filename scanners only. The integrity hash is a
placeholder so nothing accidental looks like a verified download.
