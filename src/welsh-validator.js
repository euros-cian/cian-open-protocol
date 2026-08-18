// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { randomUUID } from "node:crypto";
import { evaluateRewardState } from "./reward-evaluator.js";

const WELSH_WORDS = new Set([
  "a", "ac", "achos", "am", "ar", "awn", "bod", "bore", "cael", "chi", "croeso",
  "cymru", "cymraeg", "da", "ddim", "diolch", "dw", "dwi", "dy", "eich", "ein", "fydd",
  "fy", "gafael", "gall", "gan", "gyda", "gwneud", "hefyd", "helo", "hoffwn", "iaith", "i",
  "mae", "mewn", "mi", "mwy", "na", "neu", "ni", "nos", "oedd", "os", "pobl", "rhaid",
  "rydw", "sut", "sydd", "wedi", "wrth", "y", "yn", "yw"
]);
const DIGRAPHS = ["ch", "dd", "ff", "ng", "ll", "ph", "rh", "th"];
const MUTATIONS = ["ngh", "mh", "nh"];
const CIRCUMFLEX = /[âêîôûŵŷ]/giu;

function tokens(text) {
  return text.toLocaleLowerCase("cy").match(/[\p{L}\p{M}]+/gu) ?? [];
}

export function analyseWelsh(text) {
  const words = tokens(text.normalize("NFC"));
  const lexicalMatches = words.filter(word => WELSH_WORDS.has(word));
  const uniqueLexicalMatches = [...new Set(lexicalMatches)];
  const lower = text.toLocaleLowerCase("cy");
  const digraphMatches = DIGRAPHS.filter(item => lower.includes(item));
  const mutationMatches = MUTATIONS.filter(item => lower.includes(item));
  const circumflexMatches = [...lower.matchAll(CIRCUMFLEX)].map(match => match[0]);
  const lexicalRatioPpm = words.length ? Math.floor((lexicalMatches.length * 1_000_000) / words.length) : 0;
  const substantive = words.length >= 3;
  const lexicalEvidence = uniqueLexicalMatches.length >= 2 && lexicalRatioPpm >= 250_000;
  const supportingOrthography = digraphMatches.length + mutationMatches.length + circumflexMatches.length > 0;
  const qualifies = substantive && lexicalEvidence && (uniqueLexicalMatches.length >= 3 || supportingOrthography);
  return {
    decision: qualifies ? "QUALIFIES" : "DOES_NOT_QUALIFY",
    evidence: {
      token_count: words.length,
      lexical_match_count: uniqueLexicalMatches.length,
      lexical_ratio_ppm: lexicalRatioPpm,
      digraph_matches: digraphMatches,
      mutation_matches: mutationMatches,
      circumflex_matches: [...new Set(circumflexMatches)],
      substantive,
      rule: "lexical and contextual threshold plus corroborating evidence; no orthographic signal is decisive alone"
    }
  };
}

export class WelshValidator {
  constructor({ signer, now = () => new Date(), validityMs = 300_000 }) {
    this.signer = signer;
    this.now = now;
    this.validityMs = validityMs;
  }

  validate({ interaction, originAttestation, rewardEvidence = {} }) {
    const result = analyseWelsh(interaction.text);
    const rewardState = evaluateRewardState({ qualifies: result.decision === "QUALIFIES", ...rewardEvidence });
    const issued = this.now();
    return this.signer.sign({
      protocol_version: "0.1",
      attestation_id: `validation:${randomUUID()}`,
      interaction_id: interaction.interaction_id,
      recipient_agent_id: originAttestation.recipient_agent_id,
      interaction_digest: interaction.interaction_digest,
      language_profile: "cy-v0.1",
      decision: result.decision,
      reward_state: rewardState.id,
      evidence: result.evidence,
      validator_id: this.signer.serviceId,
      issued_at: issued.toISOString(),
      expires_at: new Date(issued.getTime() + this.validityMs).toISOString()
    });
  }
}
