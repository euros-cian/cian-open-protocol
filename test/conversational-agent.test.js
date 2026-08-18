import test from "node:test";
import assert from "node:assert/strict";
import {
  ConversationalProtocolAgent, InMemoryProofStore, InteractionGateway,
  LanguageProofController, OpenAIResponsesProvider, WelshValidator,
  createSigningService
} from "../src/index.js";

function createTestAgent(provider) {
  const gatewaySigner = createSigningService({ serviceId: "gateway:agent-test" });
  const validatorSigner = createSigningService({ serviceId: "validator:agent-test" });
  const proofSigner = createSigningService({ serviceId: "proof:agent-test" });
  return new ConversationalProtocolAgent({
    agentId: "agent:conversation:test", provider,
    gateway: new InteractionGateway({ signer: gatewaySigner }),
    validator: new WelshValidator({ signer: validatorSigner }),
    proofController: new LanguageProofController({
      signer: proofSigner,
      trustedGateways: [[gatewaySigner.keyId, gatewaySigner.publicKeyPem]],
      trustedValidators: [[validatorSigner.keyId, validatorSigner.publicKeyPem]]
    }),
    proofStore: new InMemoryProofStore()
  });
}

test("gateway signs human input before the conversational provider is called", async () => {
  let observed;
  const provider = {
    async respond(request) {
      observed = request.originAttestation;
      assert.equal(observed.signature.algorithm, "Ed25519");
      return { text: "Wrth gwrs. Sut gallaf helpu?", provider: "mock", model: "test" };
    }
  };
  const agent = createTestAgent(provider);
  const result = await agent.handle({
    sessionId: "session:1", text: "Helo, dw i eisiau gwneud y dasg yn Gymraeg."
  });
  assert.ok(observed.interaction_digest.startsWith("sha256:"));
  assert.equal(result.validation.decision, "QUALIFIES");
  assert.equal(result.proof.reward_state, "welsh_use");
  assert.equal(JSON.stringify(result.proof).includes("Helo"), false);
});

test("continued Welsh receives only the highest continuation state", async () => {
  const agent = createTestAgent({
    async respond() { return { text: "Iawn, gad i ni barhau yn Gymraeg.", provider: "mock", model: "test" }; }
  });
  await agent.handle({ sessionId: "session:2", text: "Helo, dw i eisiau siarad Cymraeg." });
  const second = await agent.handle({ sessionId: "session:2", text: "Diolch, gallwn ni wneud y gwaith yn Gymraeg." });
  assert.equal(second.proof.reward_state, "supported_continuation");
  assert.equal(second.proof.weight, 2);
});

test("non-qualifying input still receives an agent response but no proof", async () => {
  const agent = createTestAgent({
    async respond() { return { text: "Hello. How can I help?", provider: "mock", model: "test" }; }
  });
  const result = await agent.handle({ sessionId: "session:3", text: "Please help me with this task." });
  assert.equal(result.response.text, "Hello. How can I help?");
  assert.equal(result.validation.decision, "DOES_NOT_QUALIFY");
  assert.equal(result.proof, null);
});

test("OpenAI adapter sends a Responses API request and extracts output text", async () => {
  let request;
  const provider = new OpenAIResponsesProvider({
    apiKey: "test-key", model: "test-model",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({
        id: "resp_test", model: "test-model",
        output: [{ content: [{ type: "output_text", text: "Shwmae!" }] }]
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
  });
  const result = await provider.respond({ messages: [{ role: "user", content: "Helo" }], instructions: "Use Welsh" });
  assert.equal(request.url, "https://api.openai.com/v1/responses");
  assert.equal(request.options.headers.authorization, "Bearer test-key");
  assert.deepEqual(JSON.parse(request.options.body), {
    model: "test-model", instructions: "Use Welsh", input: [{ role: "user", content: "Helo" }]
  });
  assert.equal(result.text, "Shwmae!");
});
