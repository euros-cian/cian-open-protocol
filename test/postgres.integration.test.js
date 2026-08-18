import test from "node:test";
import assert from "node:assert/strict";
import { createPrivateKey } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AgentClient, AppealReviewer, EpochController, InteractionGateway, LanguageProofController,
  PostgresAppealStore, PostgresPilotSessionStore, PostgresProofStore, PostgresSettlementRegistry, WelshValidator,
  createRegistryServer, createSigningService, signRecord
} from "../src/index.js";

const connectionString = process.env.CIAN_TEST_DATABASE_URL;

test("PostgreSQL survives restart and serialises conflicting spends", { skip: !connectionString }, async t => {
  const directory = mkdtempSync(join(tmpdir(), "cian-postgres-"));
  const adminToken = "postgres-test-admin";
  const registryCredentialsPath = join(directory, "registry.credentials.json");
  const registryPassphrase = "postgres registry test passphrase";
  let state = await PostgresSettlementRegistry.connect({ connectionString, registryId: "registry:postgres-test" });
  await state.pool.query("TRUNCATE protocol_pilot_sessions, protocol_epochs, protocol_language_proofs, protocol_attestations, protocol_audit_events, protocol_retirements, protocol_redemptions, protocol_transfers, protocol_consumed_requests, protocol_consumed_proofs, protocol_accounts, protocol_agents RESTART IDENTITY CASCADE");
  let service = createRegistryServer({
    registry: state, registryId: "registry:postgres-test", adminToken,
    registryCredentialsPath, registryPassphrase
  });
  let registryUrl = await service.listen();
  t.after(async () => {
    await service.close().catch(() => {});
    await state.close().catch(() => {});
    rmSync(directory, { recursive: true, force: true });
  });

  const agentA = AgentClient.createPersistent({
    credentialsPath: join(directory, "agent-a.json"), passphrase: "agent A persistent passphrase",
    registryUrl, endpoint: "https://agent-a.example"
  });
  const agentB = AgentClient.createPersistent({
    credentialsPath: join(directory, "agent-b.json"), passphrase: "agent B persistent passphrase",
    registryUrl, endpoint: "https://agent-b.example"
  });
  await agentA.register();
  await agentB.register();
  const seriesId = "TB-CY-POSTGRES-TEST";
  await fetch(`${registryUrl}/v0.1/admin/allocations`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ seriesId, allocations: [{ proof_id: "proof:postgres:1", recipient_agent_id: agentA.agentId, amount: 10 }] })
  });

  const privateKey = createPrivateKey(agentA.exportCredentials().private_key);
  const base = {
    protocol_version: "0.1", series_id: seriesId, from_agent: agentA.agentId, to_agent: agentB.agentId,
    amount: 8, sender_sequence: 0, expires_at: new Date(Date.now() + 60_000).toISOString()
  };
  const requests = [
    signRecord({ ...base, transfer_id: "tx:concurrent:1", nonce: "concurrent-nonce-000001" }, privateKey, `${agentA.agentId}#key-1`),
    signRecord({ ...base, transfer_id: "tx:concurrent:2", nonce: "concurrent-nonce-000002" }, privateKey, `${agentA.agentId}#key-1`)
  ];
  const responses = await Promise.all(requests.map(body => fetch(`${registryUrl}/v0.1/transfers`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
  })));
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
  assert.equal((await agentA.getBalance(seriesId)).balance, 2);
  assert.equal((await agentB.getBalance(seriesId)).balance, 8);

  await service.close();
  await state.close();
  state = await PostgresSettlementRegistry.connect({ connectionString, registryId: "registry:postgres-test" });
  service = createRegistryServer({
    registry: state, registryId: "registry:postgres-test", adminToken,
    registryCredentialsPath, registryPassphrase
  });
  registryUrl = await service.listen();
  const restartedA = AgentClient.createPersistent({
    credentialsPath: join(directory, "agent-a.json"), passphrase: "agent A persistent passphrase",
    registryUrl, endpoint: "https://agent-a.example"
  });
  assert.equal(restartedA.agentId, agentA.agentId);
  assert.equal((await restartedA.getBalance(seriesId)).balance, 2);

  const gatewaySigner = createSigningService({ serviceId: "gateway:postgres-test" });
  const validatorSigner = createSigningService({ serviceId: "validator:postgres-test" });
  const proofSigner = createSigningService({ serviceId: "proof:postgres-test" });
  const gateway = new InteractionGateway({ signer: gatewaySigner });
  const validator = new WelshValidator({ signer: validatorSigner });
  const proofController = new LanguageProofController({
    signer: proofSigner,
    trustedGateways: [[gatewaySigner.keyId, gatewaySigner.publicKeyPem]],
    trustedValidators: [[validatorSigner.keyId, validatorSigner.publicKeyPem]]
  });
  const proofStore = new PostgresProofStore({ pool: state.pool });
  const epoch = new EpochController({ proofStore, registry: state, signer: createSigningService({ serviceId: "epoch:postgres-test" }) });
  const received = gateway.receive({
    text: "Helo, dw i eisiau gwneud y dasg yn Gymraeg. Diolch.",
    recipientAgentId: agentA.agentId, humanOriginAssurance: "H2"
  });
  const validation = validator.validate({ interaction: received.interaction, originAttestation: received.attestation, rewardEvidence: { usefulTaskCompleted: true } });
  const proof = proofController.issue({ originAttestation: received.attestation, validationAttestations: [validation] });
  await proofStore.addBundle({ originAttestation: received.attestation, validationAttestations: [validation], proof });
  const epochReport = await epoch.close({
    seriesId: "TB-CY-POSTGRES-PIPELINE", languageProfile: "cy-v0.1",
    commitments: [{ nominal_capacity: 40, assurance_ppm: 1_000_000, availability_ppm: 1_000_000, reserve_ppm: 1_000_000 }],
    computeUnitsPerEntitlement: 10
  });
  assert.equal(epochReport.allocated_total, 4);
  assert.equal((await restartedA.getBalance("TB-CY-POSTGRES-PIPELINE")).balance, 4);
  assert.equal((await proofStore.get(proof.proof_id)).status, "consumed");

  const sessions = new PostgresPilotSessionStore({ pool: state.pool });
  const pilotSession = await sessions.issue({ consent: true, noticeVersion: "pilot-1", clientId: "integration-test" });
  assert.equal((await sessions.authorise(pilotSession.token)).sessionId, pilotSession.session_id);
  const appeals = new PostgresAppealStore({ pool: state.pool });
  const appeal = await appeals.create({
    sessionId: pilotSession.session_id,
    input: { interaction_id: received.interaction.interaction_id, proof_id: proof.proof_id, disputed_decision: "QUALIFIES", reason_code: "false_positive" }
  });
  assert.equal((await appeals.get({ appealId: appeal.appeal_id, sessionId: pilotSession.session_id })).status, "open");
  const reviewer = new AppealReviewer({ store: appeals, signer: createSigningService({ serviceId: "reviewer:postgres-test" }) });
  const resolution = await reviewer.resolve({ appealId: appeal.appeal_id, outcome: "upheld", rationaleCode: "validator_correct" });
  assert.equal(resolution.effect, "prospective_profile_review_only");
  assert.equal((await appeals.get({ appealId: appeal.appeal_id, sessionId: pilotSession.session_id })).resolution.resolution_id, resolution.resolution_id);
  assert.equal((await sessions.withdraw(pilotSession.token)).status, "consent_withdrawn");
  await assert.rejects(() => sessions.authorise(pilotSession.token), /authorisation/);
});
