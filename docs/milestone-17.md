# Milestone 17: safe Compute Pool and visible To Bach ledger

Milestone 17 connects compute redemption to actual bounded work. The reference
provider accepts only two allowlisted operations: SHA-256 and UTF-8 byte count.
It never evaluates submitted code, invokes a shell or permits network access.

## End-to-end transition

1. A provider signs a time-bounded Compute Commitment.
2. The pool verifies the provider signature and calculates risk-adjusted
   recognised capacity using the published integer factors.
3. An agent locks To Bach in the authoritative Settlement Registry against the
   digest of an allowlisted workload.
4. The pool reserves recognised capacity and runs that exact workload.
5. The provider signs an Execution Receipt binding the redemption, holder,
   resource class, metered quantity, result digest and timestamps.
6. The pool verifies the receipt and result before the registry permanently
   retires the locked To Bach.

Failed or non-allowlisted work does not retire value and restores the pool's
reserved capacity. The redemption remains locked pending an explicit future
refund/failure policy; it is never silently returned or destroyed.

## Where the To Bach ledger is

The Settlement Registry is the ledger. With PostgreSQL, its state is held in:

- `protocol_accounts`: each agent's balance, locked amount and sequence;
- `protocol_consumed_proofs`: the allocation/issuance source;
- `protocol_transfers`: final agent-to-agent movements;
- `protocol_redemptions`: compute locks and their state;
- `protocol_retirements`: permanent consumption after verified execution; and
- `protocol_audit_events`: ordered transition journal.

`GET /v0.1/ledger?series_id=...` returns a registry-signed series view with total
issued, circulating, spendable, locked and retired quantities plus accounts. Its
`conservation_valid` field checks `issued_total = circulating_total +
retired_total`. PostgreSQL is authoritative in the durable deployment; the
simple demo uses the same transitions in memory.

Run `npm run demo:compute-pool` to watch a commitment, lock, safe compute job,
signed receipt, retirement and the ledger before/after.

This is a safe reference pool, not a production scheduler or a claim of cloud
capacity. Durable job queues, provider accreditation, failure refunds, workload
privacy, pricing and real infrastructure adapters remain future work.
