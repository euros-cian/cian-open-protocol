# Threat model

This model covers the public reference implementation, not infrastructure that
an operator may place around it. The primary protected assets are signing keys,
human-origin attestations, Language Proofs, balances, redemption state, session
tokens, validator integrity and the privacy of interaction text.

## Trust boundaries and principal threats

| Boundary | Threats | Current controls | Required before public service |
| --- | --- | --- | --- |
| Human client → gateway | forged origin, replay, oversized input, token theft | consented expiring sessions, body limits, interaction digest and signed origin | TLS, identity integration, distributed abuse controls |
| Gateway → AI provider | prompt/data disclosure, provider failure | minimal adapter and no clear text in proof records | privacy assessment, retention contract, monitoring and fail-safe policy |
| Gateway → validator | forged validation, tampered interaction | independent service, API token, digest and signature verification | mutually authenticated TLS, rotation and availability controls |
| Agent → registry | key theft, replay, double spend | Ed25519 signatures, sequence numbers, expiry, transactional locking | managed/HSM keys, rate limits, audit monitoring and recovery drills |
| Governance | reviewer compromise, silent history rewrite | separate signed immutable prospective resolutions | multi-party authority, conflict policy and transparency reporting |
| Software supply chain | malicious dependency or release | lockfile, minimal dependencies, CI tests and npm provenance configuration | protected environments, reviewed release approval and external assessment |

## Explicit non-goals

The alpha does not secure an internet-facing deployment, establish legal or
financial classification, guarantee compute-provider solvency, certify Welsh
linguistic quality, or provide production key custody. Local demo credentials
are public and must never be reused.

Security findings must follow `SECURITY.md`. A public alpha package is distinct
from operating a public network service; the latter remains prohibited until all
operational controls in the readiness checklist have evidence.
