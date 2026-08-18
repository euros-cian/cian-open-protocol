// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { randomBytes, randomUUID } from "node:crypto";
import { digest } from "./crypto.js";

export class InteractionGateway {
  constructor({ signer, now = () => new Date() }) {
    this.signer = signer;
    this.now = now;
  }

  receive({ text, recipientAgentId, humanOriginAssurance = "H1", channelId = "external:test" }) {
    if (typeof text !== "string" || !text.trim()) throw new Error("interaction text is required");
    if (!recipientAgentId) throw new Error("recipient agent is required");
    if (!/^H[0-3]$/.test(humanOriginAssurance)) throw new Error("invalid human-origin assurance");
    const interactionId = `interaction:${randomUUID()}`;
    const interactionDigest = digest(text.normalize("NFC"));
    const attestation = this.signer.sign({
      protocol_version: "0.1",
      attestation_id: `origin:${randomUUID()}`,
      interaction_id: interactionId,
      recipient_agent_id: recipientAgentId,
      interaction_digest: interactionDigest,
      human_origin_assurance: humanOriginAssurance,
      channel_id: channelId,
      nonce: randomBytes(18).toString("base64url"),
      observed_at: this.now().toISOString()
    });
    return { interaction: { interaction_id: interactionId, text, interaction_digest: interactionDigest }, attestation };
  }
}
