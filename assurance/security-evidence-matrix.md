# Security evidence matrix

Status: implementation-team evidence for independent verification; not a security certification.

| Control area | Implemented evidence | Independent work still required |
| --- | --- | --- |
| Record integrity | Canonical Ed25519 signing and tamper tests in `src/crypto.js` and `test/security.test.js` | Cryptographic design and trust-root review |
| Replay/double spend | Nonces, sequences, consumed-request records, PostgreSQL row locks and concurrent-spend test | Adversarial and isolation-level testing against assessed deployment |
| Proof reuse | Consumed-proof table and allocation tests | Cross-service and recovery-path abuse tests |
| Compute claims | Capacity reservation, leases, `SKIP LOCKED`, signed receipts and multi-provider tests | Load/concurrency testing on assessed PostgreSQL topology |
| Compute failure | Bounded retries, lease reaping and atomic refund/retirement | Crash/fault injection across transaction boundaries |
| Provider access | Token digests, rotation, suspension and authenticated provider routes | Credential theft, privilege escalation and rotation-race testing |
| HTTP boundary | Body limits, JSON enforcement, rate limiting, security headers and loopback-only plain HTTP | TLS/proxy configuration, distributed rate limiting and denial-of-service assessment |
| Session privacy | Opaque token digest, consent withdrawal, expiry and turn limit | Deletion verification, browser threats and deployment logging review |
| Validator separation | Independent authenticated service and signed attestations | Compromised-validator, collusion and trust-key rotation scenarios |
| Governance | Signed prospective-only appeal resolution | Reviewer authorisation and insider-threat assessment |
| Secret handling | `.gitignore`, encrypted demonstration credentials and tracked-file scanner | Repository-history review and production secret-manager configuration |
| Supply chain | Locked dependencies, package dry-run and explicit release gate | Dependency provenance, CI permissions and publishing-account assessment |

Known boundary: the reference fixed-window limiter is process-local. A horizontally scaled deployment requires a reviewed shared edge or distributed limiter.
