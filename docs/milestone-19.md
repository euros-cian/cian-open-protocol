# Milestone 19 — Neon restart persistence

This milestone proves that the external compute pool can use the same authoritative PostgreSQL ledger as the rest of Cian and that a queued job survives a complete coordinator/database-client restart.

The demonstration is deliberately non-destructive. Every run creates unique agent, series, proof, redemption, provider, commitment and job identifiers. It does not truncate tables or modify earlier protocol records.

## Run against Neon

Load `CIAN_DATABASE_URL` into the current terminal only, then run:

```powershell
npm run demo:compute-restart
```

The program:

1. applies all idempotent migrations, including `007-compute-pool.sql`;
2. allocates two test To Bach and locks one for a safe workload;
3. registers a signed provider commitment and queues the job;
4. closes the PostgreSQL pool completely;
5. reconnects with a new registry, store and coordinator;
6. proves the queued job is still present;
7. claims and completes it with a signed execution receipt; and
8. verifies the durable ledger conserves issuance and records one permanent retirement.

The connection string is read from the process environment and is never printed or written by the demonstration.
