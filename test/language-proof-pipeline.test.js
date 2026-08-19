import test from "node:test";
import assert from "node:assert/strict";
import {
  EpochController, InMemoryProofStore, InteractionGateway, LanguageProofController,
  SettlementRegistry, WelshValidator, WelshValidatorV2, analyseWelsh, analyseWelshV2, createSigningService,
  evaluateRewardState
} from "../src/index.js";

test("Welsh profile requires substantive lexical and corroborating evidence", () => {
  assert.equal(analyseWelsh("Helo, dw i eisiau gwneud y gwaith hwn yn Gymraeg, diolch.").decision, "QUALIFIES");
  assert.equal(analyseWelsh("The chilly llama watched the show.").decision, "DOES_NOT_QUALIFY");
  assert.equal(analyseWelsh("ŵ ŵ ŵ").decision, "DOES_NOT_QUALIFY");
});

test("cy-v0.2 qualifies contextual greetings and abstains on uncertain mentions", () => {
  assert.equal(analyseWelshV2("so bore da cian").decision, "QUALIFIES");
  assert.equal(analyseWelshV2("Bore da").decision, "QUALIFIES");
  assert.equal(analyseWelshV2("I visited Cymru and bought a map.").decision, "REVIEW_REQUIRED");
  assert.equal(analyseWelshV2("The phrase bore da means good morning.").decision, "REVIEW_REQUIRED");
  assert.equal(analyseWelshV2("Please help me finish this task.").decision, "DOES_NOT_QUALIFY");
});

test("cy-v0.2 validator signs its profile and uncertain cases issue no reward state", () => {
  const signer = createSigningService({ serviceId: "validator:cy-v2-test" });
  const validator = new WelshValidatorV2({ signer });
  const gatewaySigner = createSigningService({ serviceId: "gateway:cy-v2-test" });
  const received = new InteractionGateway({ signer: gatewaySigner }).receive({
    text: "Helo.", recipientAgentId: "agent:test"
  });
  const validation = validator.validate({ interaction: received.interaction, originAttestation: received.attestation });
  assert.equal(validation.language_profile, "cy-v0.2");
  assert.equal(validation.decision, "REVIEW_REQUIRED");
  assert.equal(validation.reward_state, "not_qualified");
});

test("reward evaluation applies only the highest state", () => {
  assert.deepEqual(evaluateRewardState({ qualifies: true, supportedContinuation: true, usefulTaskCompleted: true }), { id: "useful_task_completed", weight: 3 });
  assert.deepEqual(evaluateRewardState({ qualifies: false, languageGain: true }), { id: "not_qualified", weight: 0 });
});

test("signed language proof automatically allocates a bounded epoch once", async () => {
  const gatewaySigner = createSigningService({ serviceId: "gateway:test" });
  const validatorSigner = createSigningService({ serviceId: "validator:cy:test" });
  const proofSigner = createSigningService({ serviceId: "proof-controller:test" });
  const epochSigner = createSigningService({ serviceId: "epoch-controller:test" });
  const gateway = new InteractionGateway({ signer: gatewaySigner });
  const validator = new WelshValidator({ signer: validatorSigner });
  const proofController = new LanguageProofController({
    signer: proofSigner,
    trustedGateways: [[gatewaySigner.keyId, gatewaySigner.publicKeyPem]],
    trustedValidators: [[validatorSigner.keyId, validatorSigner.publicKeyPem]]
  });
  const registry = new SettlementRegistry();
  registry.registerAgent("agent:test:A");
  const proofStore = new InMemoryProofStore();
  const epochController = new EpochController({ proofStore, registry, signer: epochSigner });

  const { interaction, attestation: originAttestation } = gateway.receive({
    text: "Helo, dw i eisiau gwneud y dasg hon yn Gymraeg. Diolch yn fawr.",
    recipientAgentId: "agent:test:A", humanOriginAssurance: "H2"
  });
  const validation = validator.validate({
    interaction, originAttestation,
    rewardEvidence: { supportedContinuation: true, usefulTaskCompleted: true, languageGain: true }
  });
  const proof = proofController.issue({ originAttestation, validationAttestations: [validation] });
  assert.equal(proof.reward_state, "language_gain");
  assert.equal(proof.weight, 4);
  assert.equal(JSON.stringify(proof).includes(interaction.text), false);
  await proofStore.addBundle({ originAttestation, validationAttestations: [validation], proof });

  const report = await epochController.close({
    seriesId: "TB-CY-PIPELINE-DEMO", languageProfile: "cy-v0.1",
    commitments: [{ nominal_capacity: 100, assurance_ppm: 1_000_000, availability_ppm: 1_000_000, reserve_ppm: 1_000_000 }],
    computeUnitsPerEntitlement: 10
  });
  assert.equal(report.budget, 10);
  assert.equal(report.allocated_total, 10);
  assert.equal(registry.balance("agent:test:A", "TB-CY-PIPELINE-DEMO").balance, 10);
  assert.equal((await proofStore.get(proof.proof_id)).status, "consumed");
  await assert.rejects(() => proofStore.addBundle({ originAttestation, validationAttestations: [validation], proof }), /exists|canonical/);
  await assert.rejects(() => epochController.close({ seriesId: "TB-CY-SECOND", languageProfile: "cy-v0.1", commitments: [] }), /no accepted proofs/);
});

test("proof controller rejects tampering and low-assurance origin", () => {
  const gatewaySigner = createSigningService({ serviceId: "gateway:security" });
  const validatorSigner = createSigningService({ serviceId: "validator:security" });
  const controller = new LanguageProofController({
    signer: createSigningService({ serviceId: "proof:security" }),
    trustedGateways: [[gatewaySigner.keyId, gatewaySigner.publicKeyPem]],
    trustedValidators: [[validatorSigner.keyId, validatorSigner.publicKeyPem]]
  });
  const gateway = new InteractionGateway({ signer: gatewaySigner });
  const validator = new WelshValidator({ signer: validatorSigner });
  const received = gateway.receive({ text: "Helo, dw i yn siarad Cymraeg.", recipientAgentId: "agent:test", humanOriginAssurance: "H1" });
  const validation = validator.validate({ interaction: received.interaction, originAttestation: received.attestation });
  assert.throws(() => controller.issue({ originAttestation: { ...received.attestation, recipient_agent_id: "agent:attacker" }, validationAttestations: [validation] }), /invalid origin/);

  const low = gateway.receive({ text: "Helo, dw i yn siarad Cymraeg.", recipientAgentId: "agent:test", humanOriginAssurance: "H0" });
  const lowValidation = validator.validate({ interaction: low.interaction, originAttestation: low.attestation });
  assert.throws(() => controller.issue({ originAttestation: low.attestation, validationAttestations: [lowValidation] }), /below threshold/);
});
