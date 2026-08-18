// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.

const DEFAULT_INSTRUCTIONS = `You are a supportive Welsh-first AI agent.
Respond in Welsh when the user uses Welsh. Accept natural code-switching and learner
Welsh. Explain unfamiliar Welsh gently and never shame or pressure the user. Focus
on completing the user's useful task, not maximising Welsh word count. Do not claim
that a protocol reward, Language Gain or task completion occurred.`;

export class ConversationalProtocolAgent {
  constructor({ agentId, provider, gateway, validator, proofController, proofStore, instructions = DEFAULT_INSTRUCTIONS }) {
    this.agentId = agentId;
    this.provider = provider;
    this.gateway = gateway;
    this.validator = validator;
    this.proofController = proofController;
    this.proofStore = proofStore;
    this.instructions = instructions;
    this.sessions = new Map();
  }

  async handle({ sessionId, text, humanOriginAssurance = "H1", outcomeEvidence = {} }) {
    if (!sessionId) throw new Error("sessionId is required");
    // The gateway must create signed origin evidence before any model call.
    const received = this.gateway.receive({
      text, recipientAgentId: this.agentId, humanOriginAssurance,
      channelId: `conversation:${sessionId}`
    });
    const history = this.sessions.get(sessionId) ?? [];
    const messages = [...history, { role: "user", content: text }];
    const modelResult = await this.provider.respond({
      messages, instructions: this.instructions,
      originAttestation: received.attestation
    });
    history.push({ role: "user", content: text }, { role: "assistant", content: modelResult.text });
    this.sessions.set(sessionId, history);

    const validation = await this.validator.validate({
      interaction: received.interaction,
      originAttestation: received.attestation,
      rewardEvidence: {
        supportedContinuation: history.length > 2,
        usefulTaskCompleted: outcomeEvidence.usefulTaskCompleted === true,
        languageGain: outcomeEvidence.languageGain === true
      }
    });
    if (validation.decision !== "QUALIFIES") {
      return { response: modelResult, origin_attestation: received.attestation, validation, proof: null };
    }
    const proof = this.proofController.issue({
      originAttestation: received.attestation,
      validationAttestations: [validation]
    });
    await this.proofStore.addBundle({
      originAttestation: received.attestation,
      validationAttestations: [validation], proof
    });
    return { response: modelResult, origin_attestation: received.attestation, validation, proof };
  }
}

export { DEFAULT_INSTRUCTIONS };
