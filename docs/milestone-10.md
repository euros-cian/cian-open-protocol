# Milestone 10: signed appeal governance

Milestone 10 separates appeal adjudication from the conversational agent and
validator. A reviewer service owns a distinct persistent Ed25519 identity and
signs every final resolution.

## Resolution controls

- Only an authenticated governance client can resolve an appeal.
- The appeal must still be open or under review.
- Outcomes are limited to `upheld` and `overturned`.
- Rationale codes are structured and contain no conversation text.
- PostgreSQL permits only one immutable resolution per appeal.
- The original client can retrieve the resolution through its appeal endpoint.
- The signed effect is always `prospective_profile_review_only`.

An overturned appeal does not retroactively create or destroy entitlements. Any
future correction or compensating policy would require a separately specified,
auditable governance action and must preserve settlement invariants.

## Remaining boundary

The reference service proves cryptographic and process separation, not reviewer
qualification or institutional independence. Production governance needs reviewer
accreditation, conflict-of-interest rules, dual control for sensitive decisions,
service-level targets, evidence-access policy, transparent aggregate reporting,
key rotation and an escalation route beyond a single reviewer.
