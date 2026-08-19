# Milestone 22 — monitoring and incident controls

Milestone 22 adds operational visibility and reversible provider controls without exposing conversation or workload content.

## Operations snapshot

The admin-only operations endpoint reports:

- active and suspended providers;
- aggregate queued, running, completed and refunded job counts;
- the number of expired running leases;
- queue-backlog, expired-lease and suspended-provider alerts; and
- recent provider suspension/resumption events.

It deliberately omits job workloads, provider API-token digests and private key material.

## Safe suspension

Suspending a provider immediately prevents new claims. A valid job already leased to that provider may still complete with its signed receipt. If it does not complete, the existing lease-timeout, retry and refund rules apply. This avoids both new exposure and abrupt double execution.

Suspension and resumption are admin-authenticated and durably recorded in PostgreSQL migration `008-compute-operations.sql`.

Run the demonstration:

```powershell
npm run demo:compute-operations
```

The external security assessment and production monitoring integration remain required before production operation.
