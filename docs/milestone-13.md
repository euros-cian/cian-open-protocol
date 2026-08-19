# Milestone 13: open conformance kit

Milestone 13 lets another implementation reproduce protocol v0.1 behavior from
fixed public inputs rather than trusting the Cian JavaScript code.

## Fixed vectors

The versioned vector set covers canonical JSON, Unicode text digesting, Ed25519
signing and verification, public-key agent identifiers, risk-adjusted capacity,
epoch budgets, largest-remainder allocation, `cy-v0.2` tri-state decisions and a
signed prospective-only appeal resolution.

The included private key is intentionally public and exists only to reproduce a
deterministic signature. It must never be used for a real participant.

## Levels

- `CORE`: canonical records and digests.
- `PARTICIPANT`: agent identifiers, signing, verification and tamper rejection.
- `VALIDATOR`: profile decision vectors.
- `REGISTRY`: capacity and deterministic allocation math.
- `GOVERNANCE`: signed appeal resolution semantics.

All levels passing produces `FULL_CONFORMANT`. Implementations may publish only
the applicable role levels from their own implementation manifest.

## Automation and limits

The runner writes a JSON report containing vector version, implementation,
runtime, timestamp and every actual/expected result. GitHub Actions runs both the
test suite and conformance command for every push and pull request.

Conformance is compatibility evidence only. It does not assess operational
security, key custody, linguistic quality, legal classification, compute backing,
privacy compliance, availability or fitness for production.
