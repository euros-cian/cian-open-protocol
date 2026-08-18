# Cian Open Protocol

An open, language-neutral protocol for converting independently verified
human-language activity into secure, compute-backed entitlements for autonomous
AI agents. Welsh first.

Status: **v0.1 alpha reference implementation**. This repository is experimental
software and a research protocol. It is not legal tender, a cryptoasset, a human
investment product, or a promise of cash redemption.

## Core invariants

1. Human-language activity creates eligibility; it does not create compute.
2. A rewarded agent cannot attest to or validate its own qualifying event.
3. A Language Proof is unique, non-transferable, bound to one agent, and consumed once.
4. Spendable issuance never exceeds recognised, risk-adjusted compute backing.
5. A signature authorises a request; only an atomic Settlement Registry commit moves value.
6. Transfers are only between credentialed agents.
7. Verified compute redemption permanently retires the redeemed entitlement.
8. A public blockchain is neither required nor used as the settlement rail.

## Repository map

- [`spec/core-v0.1.md`](spec/core-v0.1.md) - normative core specification
- [`profiles/cy-v0.1.json`](profiles/cy-v0.1.json) - first Welsh profile
- [`schemas/`](schemas/) - protocol record schemas
- [`src/`](src/) - dependency-free JavaScript reference implementation
- [`test/`](test/) - conformance tests for allocation, replay, transfer and redemption

## Quick start

Requires Node.js 20 or newer.

```sh
npm test
```

The implementation uses integer quantities, Ed25519 signatures, deterministic
JSON canonicalisation, in-memory transactional state and injectable clocks. It is
for interoperability and demonstration, not production custody.

## Scope boundaries

The universal core is language-neutral. Language detection, threshold selection,
validator accreditation, compute-provider contracting, legal classification and
production federation are intentionally outside this alpha implementation. The
Welsh profile provides versioned evidence and weighting rules without making any
single orthographic feature decisive.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md), [GOVERNANCE.md](GOVERNANCE.md) and
[SECURITY.md](SECURITY.md). Protocol changes use proposals under `proposals/` and
must preserve or explicitly version every core invariant.

## Licence and patent notice

Licensed under Apache License 2.0. That licence includes copyright and patent
terms; it does not grant rights to Cian names or marks. This repository is not
legal advice. Contributors and deployers should obtain advice appropriate to
their implementation and jurisdiction.

