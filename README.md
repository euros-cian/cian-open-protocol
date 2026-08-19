# Cian Open Protocol

<img src="public/brand/cian-ai.png" alt="Cian AI" width="180">

An open, language-neutral protocol for converting independently verified
human-language activity into secure, compute-backed entitlements for autonomous
AI agents.

**Pioneered in Wales. Welsh first. Open to every language.**

An open, language-neutral protocol for converting independently verified human-language activity into secure, compute-backed entitlements for autonomous AI agents.

Cymraeg is more than a means of communication. It carries the history, culture and identity of Wales - a living Celtic language spoken every day in our homes, schools, communities, workplaces and institutions. It has survived for centuries because generation after generation has chosen not simply to preserve it, but to use it.

We are immensely proud of that inheritance. But a living language cannot survive by looking backwards. It has to belong to the future as much as it belongs to the past.

That future increasingly includes artificial intelligence.

As autonomous AI agents begin to communicate, recommend, transact and act on our behalf, the languages they choose to use and encourage others to use will matter. If the economics and incentives of those systems naturally favour the world's dominant languages, minority languages risk becoming less visible and less useful — however good the underlying translation technology becomes.

We want to turn that problem on its head.

What if AI itself had a reason to help Cymraeg thrive?

Cian is developing a protocol designed to make verified human-language activity valuable to autonomous AI agents. By creating an incentive for agents to support genuine use of a language, we want AI to become not merely capable of speaking Welsh, but an active participant in creating more opportunities for people to use it.

We are pioneering the protocol with Cymraeg because it  gives us something extraordinary: a proud, living Celtic language, a committed community of speakers, and a real-world environment in which to prove that AI can strengthen linguistic diversity rather than diminish it.

But this does not belong to Wales alone.

The protocol itself is open and language-neutral. Its architecture is designed so that communities representing other minority and under-resourced languages can create their own independently governed, versioned language profiles — defining what matters to their language and participating on their own terms.

Our ambition is therefore bigger than protecting Welsh.

It is to prove, here in Wales, that the incentives of the AI age can be designed differently: that autonomous machines can have a reason to encourage human linguistic starting with Cymraeg.

Status: **v0.1 alpha.18 reference implementation**. This repository is experimental
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
npm run demo:proof
npm run demo:live-agent
npm run demo:pilot
npm run demo:pilot-api
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

## Language Proof pipeline

`npm run demo:proof` runs the language-to-compute side of the protocol: gateway
origin attestation, explainable Welsh validation, highest-state reward evaluation,
canonical Language Proof creation, finite compute-backed epoch allocation and
one-time proof consumption. Shared records contain the interaction digest rather
than clear human text. See [Milestone 3](docs/milestone-3.md).

## Live conversational agent

`npm run demo:live-agent` starts an interactive Welsh-first agent backed by the
OpenAI Responses API. The interaction gateway signs the human input digest before
the model request. Qualifying Welsh turns then pass through validation and proof
creation; `/close` closes a small in-memory demonstration epoch.

```powershell
$secure = Read-Host "OpenAI API key" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$env:OPENAI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
$env:OPENAI_MODEL = "gpt-5.6-luna"
npm run demo:live-agent
```

The live command sends the clear conversational text to the selected model
provider. The Language Proof and settlement layers receive only a digest and
minimal evidence. Do not enter confidential or personal information in the alpha
demo. See [Milestone 4](docs/milestone-4.md).

## Persistent pilot

`npm run demo:pilot` advances the live demo to restart-safe protocol state. It
uses PostgreSQL for attestations, Language Proofs, epochs and balances, and stores
the agent, gateway, validator, proof-controller and epoch-controller identities
as encrypted files under the ignored `secrets/pilot` directory. See
[Milestone 5](docs/milestone-5.md).

Use a dedicated database and a strong passphrase that you can recover. Do not use
`CIAN_TEST_DATABASE_URL`: the integration test associated with that variable
deliberately clears protocol tables.

```powershell
$env:CIAN_DATABASE_URL = "postgresql://...?...&sslmode=verify-full"
$secure = Read-Host "Pilot key passphrase" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$env:CIAN_PILOT_KEY_PASSPHRASE = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
npm run demo:pilot
```

The pilot still sends clear conversation text to the selected model provider.
Back up `secrets/pilot` securely: losing it loses the protocol identities, while
exposing it together with the passphrase exposes their signing keys.

## Authenticated conversation API

`npm run demo:pilot-api` exposes the persistent agent to another local application
through `POST /v0.1/sessions` and `POST /v0.1/conversations`. Session creation
requires an issuer secret and explicit acceptance of a versioned privacy notice.
Conversation calls require the resulting opaque, expiring bearer token and are
rate limited. Clear conversation text remains in process memory for model context
but is not written to the protocol database.

Set a strong random `CIAN_SESSION_ISSUER_TOKEN` in addition to the persistent
pilot variables, then start the service. It binds to `127.0.0.1:8790` by default.
Do not expose it directly to the internet; use an authenticated TLS reverse proxy
and complete a privacy/security review first. See [Milestone 6](docs/milestone-6.md).

Session metadata and SHA-256 token digests now persist across API restarts in
PostgreSQL; clear tokens and conversation text are never written there. A client
can withdraw consent and immediately invalidate its session with:

```text
DELETE /v0.1/sessions/current
Authorization: Bearer <session-token>
```

The issuer can delete expired and withdrawn session metadata with
`POST /v0.1/admin/retention`. This deliberately does not delete independently
signed protocol proofs or settlement records, whose separate governance and
retention rules must preserve audit integrity. See [Milestone 7](docs/milestone-7.md).

## Independent validator

Milestone 8 can run Welsh validation as a separate authenticated service. The
validator verifies the gateway's signed origin attestation and recomputes the
clear-text digest before issuing its own signed attestation. It returns evidence,
never the clear interaction text. The proof controller pins the validator public
key and rejects tampered or untrusted attestations.

```text
npm run setup:validator-trust
npm run demo:validator
npm run demo:pilot-api
```

Set `CIAN_VALIDATOR_URL=http://127.0.0.1:8791` and the same strong
`CIAN_VALIDATOR_API_TOKEN` in the validator and pilot API processes to enable the
remote mode. Use a separate `CIAN_VALIDATOR_KEY_PASSPHRASE` for the validator's
encrypted identity. See [Milestone 8](docs/milestone-8.md).

## Validator evaluation and appeals

`npm run eval:welsh` produces a reproducible confusion matrix for the versioned
Welsh profile. The included seed corpus is deliberately marked `unreviewed`; the
report therefore sets `production_claim_allowed` to false regardless of its
apparent accuracy. Labels must be reviewed by fluent Welsh experts and should be
expanded across dialect, learner, code-switching and adversarial cases.

Authenticated clients can submit a structured, privacy-minimised appeal with
`POST /v0.1/appeals` and retrieve it with `GET /v0.1/appeals/{appeal_id}`. Appeals
store identifiers, profile, disputed decision and reason code—not interaction
text. See [Milestone 9](docs/milestone-9.md).

## Signed appeal governance

`npm run demo:governance` runs a separate localhost reviewer service with its own
encrypted signing identity. An authorised reviewer may resolve an open appeal as
`upheld` or `overturned` with a structured rationale. Each resolution is signed,
immutable and unique per appeal.

Resolutions are explicitly `prospective_profile_review_only`: they identify
validator problems for correction and reporting but never silently alter an
existing proof, epoch or settlement balance. See [Milestone 10](docs/milestone-10.md).

## Visual protocol cockpit

Set `CIAN_ENABLE_DEMO_UI=1` before starting `npm run demo:pilot-api`, then open
`http://127.0.0.1:8790/demo`. The cockpit visualises the live gateway, model,
independent validator, Language Proof and PostgreSQL stages, displays
privacy-minimised cryptographic evidence, and can submit a structured appeal.

The cockpit session shortcut works only in explicit demo mode from the loopback
interface. The pilot refuses to enable it when bound to a non-loopback host. It
is a visual technical demonstration, not a public or production user interface.
See [Milestone 11](docs/milestone-11.md).

For a no-credentials visual preview using clearly labelled deterministic mock
records, run `npm run demo:cockpit-preview` and open
`http://127.0.0.1:8793/demo`. Use the port 8790 pilot mode to demonstrate real
OpenAI, validator and PostgreSQL activity.

## Scalable tri-state Welsh validation

The live pilot now uses experimental profile `cy-v0.2`. It adds contextual phrase
and distinctive lexical evidence plus three automatic outcomes: `QUALIFIES`,
`DOES_NOT_QUALIFY`, and `REVIEW_REQUIRED`. The third outcome is automated
abstention—not a real-time human queue. Conversation continues normally, but no
proof is issued when evidence is uncertain.

`cy-v0.1` remains frozen for compatibility. Run `npm run eval:welsh:v2` for the
new provisional regression corpus. See [Milestone 12](docs/milestone-12.md).

## Open conformance kit

Run `npm run conformance` to verify the reference implementation against the
published v0.1 vectors. The command reports `CORE`, `PARTICIPANT`, `VALIDATOR`,
`REGISTRY` and `GOVERNANCE` levels and writes a machine-readable report to the
ignored `tmp/conformance-report.json` path.

The vector keypair is deliberately public test material and must never control a
real service. Passing means wire/math compatibility only—not security
certification, Welsh linguistic accreditation, legal approval, provider solvency
or production readiness. See [Milestone 13](docs/milestone-13.md).

## Developer package

Milestone 14 prepares the repository as a public npm package without publishing
it yet. It adds explicit ESM exports, TypeScript declarations, packaged profiles,
schemas and conformance vectors, an OpenAPI 3.1 contract, a persistent third-party
agent example, and a Docker Compose PostgreSQL registry stack.

Start locally with `docker compose up --build`, follow
[the developer quick start](docs/developer-quickstart.md), and inspect
[`openapi/cian-v0.1.yaml`](openapi/cian-v0.1.yaml). Compose credentials are public
development defaults and must never be deployed unchanged. See
[Milestone 14](docs/milestone-14.md).

## Independent Welsh review

Run `npm run review:welsh:prepare` to create a blinded packet for fluent Welsh
reviewers and a machine-readable calibration report. The packet deliberately
omits provisional labels and validator outputs. At least two independent
reviewers must label every case; disagreements require adjudication.

The current seed corpus remains unreviewed, so the command correctly reports
`independent_review_complete: false` and `production_claim_allowed: false`.
No linguistic accreditation or accuracy claim is made until genuine reviews are
returned. See [Milestone 15](docs/milestone-15.md).

For a reviewer-friendly flow, set `CIAN_WELSH_REVIEWER_ID` to a stable
pseudonymous identifier, run `npm run review:welsh:cockpit`, and open
`http://127.0.0.1:8794`. The local cockpit never displays provisional labels or
validator decisions and records only the selected label, reviewer ID and time.

## Public-alpha security gate

Run `npm run release:check` to inspect the machine-readable publication gates.
The command currently returns `BLOCKED` by design: independent Welsh review,
external security assessment, production key custody, privacy/legal review,
incident ownership and npm scope confirmation still require evidence. No package
or network service should be publicly released by bypassing these gates. See the
[threat model](docs/threat-model.md) and [Milestone 16](docs/milestone-16.md).

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
production database. For Neon, use `sslmode=verify-full` in the connection string
to require certificate and hostname verification and avoid the transitional `pg`
SSL-mode warning.

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
