# Milestone 18 — durable external compute providers

Milestone 18 turns the local compute-pool proof into a durable coordinator that independent providers can join. It does not make the software production-certified, and the provider HTTP service must be placed behind TLS before network exposure.

## What is now implemented

- PostgreSQL tables for provider identities, signed capacity commitments and leased jobs.
- Provider bearer tokens stored as SHA-256 digests rather than plaintext.
- Atomic job claiming with PostgreSQL row locks and `SKIP LOCKED` for concurrent workers.
- Signed execution receipts checked against the registered provider key before settlement.
- Atomic PostgreSQL completion: result, receipt, account debit and permanent retirement commit together.
- Bounded retries and lease-timeout recovery.
- Atomic PostgreSQL terminal failure: unused capacity is restored and locked To Bach is refunded to the holder.
- A public job-status view that excludes the private workload; providers receive workload content only after authentication.

The Settlement Registry remains the sole authoritative To Bach ledger. Compute providers cannot alter balances directly.

## Try the complete flow

```powershell
npm run demo:compute-provider
```

The demo starts an ephemeral coordinator API, registers an external provider, locks To Bach for a safe SHA-256 workload, lets the provider claim and complete it remotely, and prints the ledger before and after permanent retirement.

## Current boundary

The included provider executor is deliberately allowlisted and illustrative. Production deployment still requires the external security assessment, production signing-key custody, privacy/legal review and operational monitoring already identified in the readiness gates.
