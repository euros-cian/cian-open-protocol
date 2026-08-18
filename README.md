# Cian Open Protocol

An open, language-neutral protocol for converting independently verified
human-language activity into secure, compute-backed entitlements for autonomous
AI agents. Welsh first.

Status: **v0.1 alpha.3 reference implementation**. This repository is experimental
software and a research protocol. It is not legal tender, a cryptoasset, a human
investment product, or a promise of cash redemption.

## Core invariants

1. Human-language activity creates eligibility; it does not create compute.
2. A rewarded agent cannot attest to or validate its own qualifying event.
3. A Language Proof is unique, non-transferable, bound to one agent, and consumed once.
4. Spendable issuance never exceeds recognised, risk-adjusted compute backing.
5. A signature authorises a request; only an atomic Settlement Registry commit moves value.
6. Transfers are only between credentialed agents.
7. Verified compute redemption permanently retires the redeemed entitlement.
8. A public blockchain is neither required nor used as the settlement rail.

## Repository map

- [`spec/core-v0.1.md`](spec/core-v0.1.md) - normative core specification
- [`profiles/cy-v0.1.json`](profiles/cy-v0.1.json) - first Welsh profile
- [`schemas/`](schemas/) - protocol record schemas
- [`src/`](src/) - dependency-free JavaScript reference implementation
- [`test/`](test/) - conformance tests for allocation, replay, transfer and redemption
- [`examples/two-agent-demo.mjs`](examples/two-agent-demo.mjs) - complete local agent loop

## Quick start

Requires Node.js 20 or newer.

```sh
npm test
npm run demo
```

The implementation uses integer quantities, Ed25519 signatures, deterministic
JSON canonicalisation, an in-memory demonstration registry or durable PostgreSQL
state, and injectable clocks. It is for interoperability and demonstration, not
production custody. `npm run demo`
starts an ephemeral local registry, registers two cryptographic agent identities,
allocates test `TB`, transfers it, redeems it and permanently retires it.

## Agent SDK

```js
import { AgentClient, digest } from "./src/index.js";

const agent = AgentClient.create({
  registryUrl: "http://127.0.0.1:8787",
  registryPublicKeyPem: process.env.CIAN_REGISTRY_PUBLIC_KEY,
  endpoint: "https://agent.example",
  capabilities: ["research"],
  languageProfiles: ["cy-v0.1"]
});

await agent.register();
const balance = await agent.getBalance("TB-CY-DEMO");
const transfer = await agent.transfer({
  recipient: "agent:cian:...",
  seriesId: "TB-CY-DEMO",
  amount: 4,
  taskId: "research-123"
});
const redemption = await agent.redeem({
  seriesId: "TB-CY-DEMO",
  amount: 2,
  workload: digest({ task: "inference", input: "..." })
});
```

The SDK creates a persistent identifier from an Ed25519 public key, signs its
manifest and signs every state-changing agent request. Applications are
responsible for storing the private key securely. `AgentClient.createPersistent`
stores credentials using scrypt and AES-256-GCM; the demo keeps keys in memory only.
Production clients must pin the registry public key. Omitting it accepts the key
advertised by the registry and is suitable only for local demonstration or a
separately authenticated trust-on-first-use bootstrap.

## Local registry API

The dependency-free HTTP service exposes:

```text
POST /v0.1/agents/register
GET  /v0.1/agents/{agent_id}
GET  /v0.1/balances/{agent_id}?series_id=...
POST /v0.1/transfers
GET  /v0.1/transfers/{transfer_id}
POST /v0.1/redemptions
GET  /v0.1/redemptions/{redemption_id}
GET  /v0.1/audit
```

Test allocation and execution verification use admin-token-protected local routes.
They are demonstration controls, not a production issuer or compute-provider API.

## Durable PostgreSQL registry

`PostgresSettlementRegistry` stores agents, balances, sequences, consumed proofs,
request IDs, nonces, transfers, redemption locks, retirements and audit events in
PostgreSQL. Transfer and redemption paths use database transactions and row locks.

```js
import { PostgresSettlementRegistry, createRegistryServer } from "./src/index.js";

const registry = await PostgresSettlementRegistry.connect({
  connectionString: process.env.DATABASE_URL,
  registryId: "registry:cy:01"
});

const service = createRegistryServer({
  registry,
  registryId: "registry:cy:01",
  adminToken: process.env.CIAN_ADMIN_TOKEN,
  registryCredentialsPath: "./secrets/registry.credentials.json",
  registryPassphrase: process.env.CIAN_REGISTRY_KEY_PASSPHRASE
});

console.log(await service.listen({ port: 8787 }));
```

The schema migration is applied automatically from
[`database/001-durable-registry.sql`](database/001-durable-registry.sql). Registry
credentials must be stored outside source control and backed up securely.

To run the restart and concurrent-spend integration test against a disposable
PostgreSQL database:

```sh
CIAN_TEST_DATABASE_URL=postgres://... npm run test:postgres
```

The test truncates protocol tables in the supplied database. Never point it at a
production database.

## Scope boundaries

The universal core is language-neutral. Language detection, threshold selection,
validator accreditation, compute-provider contracting, legal classification and
production federation are intentionally outside this alpha implementation. The
Welsh profile provides versioned evidence and weighting rules without making any
single orthographic feature decisive.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md), [GOVERNANCE.md](GOVERNANCE.md) and
[SECURITY.md](SECURITY.md). Protocol changes use proposals under `proposals/` and
must preserve or explicitly version every core invariant.

## Licence and patent notice

Licensed under Apache License 2.0. That licence includes copyright and patent
terms; it does not grant rights to Cian names or marks. This repository is not
legal advice. Contributors and deployers should obtain advice appropriate to
their implementation and jurisdiction.
