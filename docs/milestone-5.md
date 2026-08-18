# Milestone 5: persistent single-node pilot

Milestone 5 makes the interactive agent restart-safe without changing the Cian
email application.

## What persists

- One stable cryptographic agent identity.
- Separate gateway, validator, proof-controller and epoch-controller keys.
- Signed origin and validation attestations.
- Canonical Language Proofs and their consumed state.
- Signed epoch reports and agent balances.

Keys are encrypted locally with scrypt and AES-256-GCM. Protocol records and
settlement state use PostgreSQL. Re-running the command with the same database,
credentials directory and passphrase restores the same identities and state.

## Run

Set `OPENAI_API_KEY`, `CIAN_DATABASE_URL` and a passphrase of at least 12
characters in `CIAN_PILOT_KEY_PASSPHRASE`, then run `npm run demo:pilot`. Enter
`/close` to consume all currently unconsumed Welsh proofs in a finite test epoch.

## Remaining production boundary

This is a single-operator technical pilot, not a public service. It does not yet
provide authenticated human sessions, consent and privacy notices, rate limits,
retention controls, managed key custody, independent validator operation or a
reviewed Welsh validation dataset. Test compute commitments are illustrative and
must not be represented as independently verified production capacity.
