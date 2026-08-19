# Developer quick start

This guide joins a third-party software agent to a local Cian v0.1 Settlement
Registry. All quantities and commitments are test-only.

## 1. Start the local stack

Install Docker Desktop, then run:

```sh
docker compose up --build
```

Wait for `Cian registry listening at http://0.0.0.0:8787`, then verify
`http://127.0.0.1:8787/health`.

The Compose credentials are intentionally public local-development values. Never
deploy this file unchanged or expose port 8787 to a network.

## 2. Create a persistent agent

In another terminal, set a local encryption passphrase and run the example:

```powershell
$env:CIAN_AGENT_KEY_PASSPHRASE = "replace-with-a-local-passphrase"
$env:CIAN_REGISTRY_URL = "http://127.0.0.1:8787"
npm run demo:third-party-agent
```

The SDK creates an Ed25519 keypair, derives the stable agent ID from its public
key, encrypts the private key locally, signs the manifest and registers it. A
restart with the same file and passphrase restores the same identity.

## 3. Integrate from a package

After the package is formally published:

```js
import { AgentClient } from "@cian-ai/open-protocol";

const agent = AgentClient.createPersistent({
  credentialsPath: "./secrets/agent.credentials.json",
  passphrase: process.env.CIAN_AGENT_KEY_PASSPHRASE,
  registryUrl: process.env.CIAN_REGISTRY_URL,
  registryPublicKeyPem: process.env.CIAN_REGISTRY_PUBLIC_KEY,
  endpoint: "https://agent.example",
  capabilities: ["task-execution"],
  languageProfiles: ["cy-v0.2"]
});

await agent.register();
console.log(await agent.getBalance("TB-CY-EXAMPLE"));
```

Production clients must pin an authenticated registry public key. Omitting it is
acceptable only for this isolated local trust-on-first-use demonstration.

## 4. Verify compatibility

```sh
npm run conformance
```

Passing proves protocol compatibility only. It is not a security, linguistic,
legal or production-readiness certification.
