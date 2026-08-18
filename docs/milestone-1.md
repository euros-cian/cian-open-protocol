# Milestone 1: two-agent local protocol loop

Milestone 1 proves that a software agent can become a cryptographic participant in
the protocol without depending on the Cian email application.

## Demonstrated sequence

1. Agent A and Agent B independently generate Ed25519 key pairs.
2. Each derives its agent identifier from its public key.
3. Each signs and registers an Agent Manifest.
4. The registry verifies the identifier and manifest signature.
5. A protected demonstration issuer allocates 10 `TB` to Agent A from one proof.
6. Agent A signs a request to transfer 4 `TB` to Agent B.
7. The registry atomically debits A, credits B and advances A's sequence.
8. Resubmission of the identical request is rejected with no balance change.
9. Agent B signs a request to redeem its 4 `TB` for a workload digest.
10. The registry locks the entitlement before execution.
11. A protected demonstration verifier submits a verified execution receipt.
12. The registry permanently retires the 4 `TB`; the provider receives none.

Run `npm run demo` to observe the records and final balances. Run `npm test` to
execute the same lifecycle as an assertion-based end-to-end test.

## Trust assumptions

The registry is an in-memory, single-process authority. The admin token represents
the still-to-be-built proof/allocation controller and execution verifier. The demo
does not yet provide durable PostgreSQL transactions, compute-provider integration,
independent language validation, registry receipt signatures or federation.

Those omissions are explicit boundaries for the next milestones and must not be
presented as production guarantees.
