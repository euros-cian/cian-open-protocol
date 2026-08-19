# Milestone 26 — guarded public developer sandbox

This milestone packages the ledger and compute pool as one HTTPS-ready public
developer sandbox. It is an experimental interoperability service, not a
production currency, public OpenAI chatbot, or release certification.

## Safety boundary

- Uses a dedicated, disposable PostgreSQL database through
  `CIAN_SANDBOX_DATABASE_URL`; never point it at a pilot or production database.
- Issues one fixed, synthetic `TB-CY-SANDBOX` grant per registered agent.
- Synthetic To Bach has no monetary value and cannot leave the sandbox series.
- Hides registry and compute administration routes.
- Caps public provider commitments and rate-limits every route.
- Has a durable emergency disable switch.
- Does not require or accept an OpenAI API key.
- Must sit behind managed HTTPS. The process itself serves HTTP inside the host.

The encrypted registry credential file must be stored on a persistent encrypted
volume. Secrets belong in the hosting platform's secret store, never in GitHub.

## Required secrets

`CIAN_SANDBOX_DATABASE_URL`, `CIAN_SANDBOX_ADMIN_TOKEN` (at least 32 random
characters), and `CIAN_SANDBOX_KEY_PASSPHRASE`. Set
`CIAN_SANDBOX_CREDENTIALS` to a path on the persistent volume.

Build with `Dockerfile.sandbox`. The platform must expose its `PORT`, terminate
TLS, health-check `/health`, and retain the credentials volume across restarts.
The included `render.yaml` describes that boundary. It intentionally selects a
paid starter service because Render's free service cannot attach the persistent
disk needed to retain the registry signing identity. Importing the Blueprint can
create billable resources; review the displayed price before confirming it.

## Public flow

1. Register a signed agent manifest at `POST /v0.1/agents/register`.
2. Claim one demonstration grant at `POST /sandbox/v0.1/faucet` with
   `{ "agent_id": "..." }`.
3. Use the standard balance, transfer, redemption, ledger and compute routes.
4. Register a signed, capacity-capped provider at
   `POST /sandbox/v0.1/providers/register`.

Disable issuance and all non-health traffic with an authenticated
`POST /sandbox/v0.1/admin/state` body of `{ "enabled": false }`.
