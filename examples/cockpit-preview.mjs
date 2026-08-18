import { randomUUID } from "node:crypto";
import { createConversationServer, digest } from "../src/index.js";

const service = createConversationServer({
  sessionIssuerToken: "preview-only",
  enableLocalDemo: true,
  serviceInfo: { validator_mode: "independent", persistence: "postgresql-preview", demo_ui: true },
  agent: {
    async handle({ text }) {
      const interactionId = `interaction:${randomUUID()}`;
      const interactionDigest = digest(text);
      const qualifies = /\b(helo|cymraeg|diolch|bore|hoffwn|gymraeg)\b/iu.test(text);
      return {
        response: { text: qualifies ? "Wrth gwrs — gallwn barhau yn Gymraeg." : "Hello — try adding a substantive Welsh phrase.", provider: "offline-preview", model: "deterministic-mock" },
        origin_attestation: { interaction_id: interactionId, attestation_id: `origin:${randomUUID()}`, interaction_digest: interactionDigest },
        validation: { attestation_id: `validation:${randomUUID()}`, validator_id: "validator:cy:preview", decision: qualifies ? "QUALIFIES" : "DOES_NOT_QUALIFY", reward_state: qualifies ? "welsh_use" : "not_qualified" },
        proof: qualifies ? { proof_id: digest({ interaction_id: interactionId }).replace("sha256:", "proof:") } : null
      };
    }
  }
});
const address = await service.listen({ host: "127.0.0.1", port: Number(process.env.CIAN_COCKPIT_PREVIEW_PORT ?? 8793) });
console.log(`Offline cockpit preview at ${address}/demo`);
console.log("This preview uses deterministic mock records, not the live protocol services. Press Ctrl+C to stop.");
const close = async () => { await service.close(); process.exit(0); };
process.once("SIGINT", close); process.once("SIGTERM", close);
