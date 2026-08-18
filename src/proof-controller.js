// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { digest, importPublicKey, verifyRecord } from "./crypto.js";

const ASSURANCE = { H0: 0, H1: 1, H2: 2, H3: 3 };
const WEIGHTS = { welsh_use: 1, supported_continuation: 2, useful_task_completed: 3, language_gain: 4 };

export class LanguageProofController {
  constructor({ signer, trustedGateways, trustedValidators, now = () => new Date(), minimumHumanAssurance = "H1" }) {
    this.signer = signer;
    this.trustedGateways = new Map(trustedGateways);
    this.trustedValidators = new Map(trustedValidators);
    this.now = now;
    this.minimumHumanAssurance = minimumHumanAssurance;
    for (const keyId of this.trustedGateways.keys()) {
      if (this.trustedValidators.has(keyId)) throw new Error("gateway and validator trust keys must be distinct");
    }
  }

  issue({ originAttestation, validationAttestations }) {
    if (!Array.isArray(validationAttestations) || validationAttestations.length === 0) throw new Error("at least one validation attestation is required");
    const gatewayKey = this.trustedGateways.get(originAttestation.signature?.key_id);
    if (!gatewayKey || !verifyRecord(originAttestation, importPublicKey(gatewayKey))) throw new Error("untrusted or invalid origin attestation");
    if (ASSURANCE[originAttestation.human_origin_assurance] < ASSURANCE[this.minimumHumanAssurance]) throw new Error("human-origin assurance below threshold");

    for (const validation of validationAttestations) {
      const validatorKey = this.trustedValidators.get(validation.signature?.key_id);
      if (!validatorKey || !verifyRecord(validation, importPublicKey(validatorKey))) throw new Error("untrusted or invalid validation attestation");
      if (validation.interaction_id !== originAttestation.interaction_id ||
          validation.recipient_agent_id !== originAttestation.recipient_agent_id ||
          validation.interaction_digest !== originAttestation.interaction_digest) {
        throw new Error("attestations do not describe the same interaction");
      }
      if (validation.decision !== "QUALIFIES") throw new Error("interaction does not qualify");
      if (new Date(validation.expires_at).getTime() <= this.now().getTime()) throw new Error("validation attestation expired");
    }

    const highest = validationAttestations
      .map(item => ({ id: item.reward_state, weight: WEIGHTS[item.reward_state] ?? 0 }))
      .reduce((best, item) => item.weight > best.weight ? item : best, { id: "not_qualified", weight: 0 });
    if (!highest.weight) throw new Error("unknown reward state");
    const proofId = digest({
      interaction_id: originAttestation.interaction_id,
      recipient_agent_id: originAttestation.recipient_agent_id,
      language_profile: validationAttestations[0].language_profile,
      reward_state: highest.id
    }).replace("sha256:", "proof:");
    return this.signer.sign({
      protocol_version: "0.1", proof_id: proofId,
      interaction_id: originAttestation.interaction_id,
      recipient_agent_id: originAttestation.recipient_agent_id,
      language_profile: validationAttestations[0].language_profile,
      human_origin_assurance: originAttestation.human_origin_assurance,
      decision: "QUALIFIES", reward_state: highest.id, weight: highest.weight,
      interaction_digest: originAttestation.interaction_digest,
      origin_attestation: originAttestation.attestation_id,
      validator_attestations: validationAttestations.map(item => item.attestation_id).sort(),
      proof_controller_id: this.signer.serviceId,
      issued_at: this.now().toISOString(), status: "unconsumed"
    });
  }
}
