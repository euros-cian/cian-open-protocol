import {
  EpochController, InMemoryProofStore, InteractionGateway, LanguageProofController,
  SettlementRegistry, WelshValidator, createSigningService
} from "../src/index.js";

const agentId = "agent:demo:welsh-service";
const gatewaySigner = createSigningService({ serviceId: "gateway:demo" });
const validatorSigner = createSigningService({ serviceId: "validator:cy:demo" });
const proofSigner = createSigningService({ serviceId: "proof-controller:demo" });
const epochSigner = createSigningService({ serviceId: "epoch-controller:demo" });

const gateway = new InteractionGateway({ signer: gatewaySigner });
const validator = new WelshValidator({ signer: validatorSigner });
const proofController = new LanguageProofController({
  signer: proofSigner,
  trustedGateways: [[gatewaySigner.keyId, gatewaySigner.publicKeyPem]],
  trustedValidators: [[validatorSigner.keyId, validatorSigner.publicKeyPem]]
});
const registry = new SettlementRegistry();
registry.registerAgent(agentId);
const proofStore = new InMemoryProofStore();

const received = gateway.receive({
  text: "Helo, dw i eisiau gwneud y dasg hon yn Gymraeg. Diolch yn fawr.",
  recipientAgentId: agentId,
  humanOriginAssurance: "H2"
});
console.log("Origin attestation", received.attestation);

const validation = validator.validate({
  interaction: received.interaction,
  originAttestation: received.attestation,
  rewardEvidence: { supportedContinuation: true, usefulTaskCompleted: true }
});
console.log("Welsh validation", validation);

const proof = proofController.issue({
  originAttestation: received.attestation,
  validationAttestations: [validation]
});
await proofStore.addBundle({
  originAttestation: received.attestation,
  validationAttestations: [validation],
  proof
});
console.log("Language Proof (no clear interaction text)", proof);

const epoch = new EpochController({ proofStore, registry, signer: epochSigner });
const report = await epoch.close({
  seriesId: "TB-CY-PROOF-DEMO",
  languageProfile: "cy-v0.1",
  commitments: [{
    nominal_capacity: 100,
    assurance_ppm: 1_000_000,
    availability_ppm: 1_000_000,
    reserve_ppm: 800_000
  }],
  computeUnitsPerEntitlement: 10
});
console.log("Epoch allocation", report);
console.log("Agent balance", registry.balance(agentId, "TB-CY-PROOF-DEMO"));
