import test from "node:test";
import assert from "node:assert/strict";
import {
  InteractionGateway, RemoteWelshValidator, WelshValidator,
  createSigningService, createValidatorServer
} from "../src/index.js";

test("independent validator authenticates transport and verifies gateway evidence", async t => {
  const gatewaySigner = createSigningService({ serviceId: "gateway:validator-test" });
  const validatorSigner = createSigningService({ serviceId: "validator:independent-test" });
  const service = createValidatorServer({
    validator: new WelshValidator({ signer: validatorSigner }), apiToken: "validator-secret",
    trustedGateways: [[gatewaySigner.keyId, gatewaySigner.publicKeyPem]]
  });
  t.after(() => service.close());
  const url = await service.listen();
  const received = new InteractionGateway({ signer: gatewaySigner }).receive({
    text: "Helo, dw i eisiau gwneud y dasg yn Gymraeg.", recipientAgentId: "agent:test"
  });
  const remote = new RemoteWelshValidator({ url, apiToken: "validator-secret" });
  const result = await remote.validate({ interaction: received.interaction, originAttestation: received.attestation });
  assert.equal(result.decision, "QUALIFIES");
  assert.equal(result.validator_id, "validator:independent-test");
  assert.equal(JSON.stringify(result).includes("Helo"), false);

  const badAuth = new RemoteWelshValidator({ url, apiToken: "wrong" });
  await assert.rejects(() => badAuth.validate({ interaction: received.interaction, originAttestation: received.attestation }), /authorisation/);
  await assert.rejects(() => remote.validate({
    interaction: { ...received.interaction, text: "tampered text" }, originAttestation: received.attestation
  }), /does not match/);
});
