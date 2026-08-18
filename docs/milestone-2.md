# Milestone 2: durable identity and settlement

Milestone 2 adds the persistence and cryptographic evidence required for an agent
to retain its protocol identity and balance across process restarts.

## Delivered

- PostgreSQL schema for agents, balances, proof consumption, replay state,
  transfers, redemption locks, retirements and audit events.
- Atomic PostgreSQL transfer and redemption transactions using row locks.
- Encrypted agent credential files using scrypt and AES-256-GCM.
- Encrypted persistent registry signing credentials.
- Registry-signed settlement, redemption-lock and retirement records.
- SDK verification of the registry identity and signed receipts.
- Restart recovery and simultaneous conflicting-spend integration test.

## Verification levels

The default test suite verifies encryption, reload, signatures, the in-memory
state machine and the complete two-agent loop. The PostgreSQL integration test is
enabled only when `CIAN_TEST_DATABASE_URL` is supplied because it requires and
clears a disposable PostgreSQL database.

## Remaining production boundaries

- External secret management or hardware-backed keys
- Authentication and authorisation stronger than a demonstration admin token
- Independently signed proof/allocation-controller messages
- Independently verified compute execution receipts
- Database replication, backups and operational recovery exercises
- Federation and quorum finality
- Rate limiting, monitoring and an external security assessment
