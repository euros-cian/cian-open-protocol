# Milestone 3: Language Proof pipeline

Milestone 3 connects independently signed human-language evidence to finite,
compute-backed allocation.

## Delivered

- An interaction gateway assigns a unique interaction ID before agent processing,
  hashes the normalised content and signs origin, freshness and assurance data.
- An experimental, explainable `cy-v0.1` validator combines lexical evidence with
  contextual and orthographic support. A digraph or circumflex never qualifies an
  interaction by itself.
- Reward evaluation applies only the highest observable state in a task: Welsh
  use, continuation, useful completion or Language Gain.
- A proof controller verifies trusted gateway and validator signatures, assurance,
  expiry and record agreement before signing a canonical Language Proof.
- Proof stores enforce one proof per interaction, agent and profile.
- The shared proof contains a digest and evidence references, not clear human text.
- An epoch controller derives a finite budget from risk-adjusted compute,
  allocates it deterministically and consumes each proof once.
- PostgreSQL persists attestations, proofs, consumption state and signed epoch
  reports.

## Demonstration

Run:

```sh
npm run demo:proof
```

The output shows the signed origin attestation, signed Welsh validation, signed
Language Proof, signed epoch allocation and resulting agent balance.

## Important boundary

The Welsh validator is an experimental reference policy, not a production-quality
language classifier and not evidence that Language Gain occurred. Its thresholds,
lexicon, dialect coverage and learner-language behaviour require Welsh-language
expert review and evaluation against a representative labelled dataset before a
real allocation has value.
