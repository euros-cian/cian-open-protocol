# Five-minute developer preview

This preview uses synthetic local records and does not require OpenAI, Neon or a
production credential.

## Install and verify

```powershell
git clone https://github.com/euros-cian/cian-open-protocol.git
cd cian-open-protocol
corepack enable
pnpm install --frozen-lockfile
pnpm test
pnpm conformance
```

## See two protocol agents settle

```powershell
pnpm demo
```

## See language proof become bounded To Bach

```powershell
pnpm demo:proof
```

## See independent compute providers

```powershell
pnpm demo:multi-provider
pnpm demo:provider-onboarding
```

## Import locally

Until an authorised npm publication exists, clone this repository and import
from `./src/index.js`, or use the inspected output of `pnpm pack:check` in an
isolated development environment. Do not install an unofficial package claiming
the `@cian-ai/open-protocol` name.

Start with `AgentClient`, `RemoteComputeProviderClient`, the JSON schemas under
`schemas/`, and `openapi/cian-v0.1.yaml`. See `developer-quickstart.md` for the
Docker/PostgreSQL registry path and `provider-operator-guide.md` for provider
roles and secret boundaries.

Everything remains experimental. Never use valuable compute commitments or real
personal data in this preview.
