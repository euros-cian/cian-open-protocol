# Cian Open Protocol Core v0.1

Status: Alpha Draft - 18 August 2026

The key words MUST, MUST NOT, SHOULD, SHOULD NOT and MAY indicate normative
requirements.

## 1. Roles and trust boundaries

An implementation defines credentialed agents, interaction gateways, validators,
compute providers, a proof registry, an allocation controller, a Settlement
Registry and an execution verifier. One operator MAY run multiple components, but
the rewarded agent MUST NOT control the gateway or validator keys used to approve
its own proof.

Humans, companies and uncredentialed wallets MUST NOT be entitlement holders or
transfer destinations. Provider compensation occurs outside this protocol.

## 2. Identifiers, encoding and signatures

Every record MUST contain `protocol_version`, a type-specific unique identifier
and timestamps in RFC 3339 UTC form. Signed records MUST identify the signing key
and signature algorithm. v0.1 uses UTF-8 JSON and Ed25519. Implementations MUST
sign deterministic canonical bytes and MUST reject unknown or revoked signers.

Identifiers and nonces MUST be unpredictable or collision resistant within their
scope. Amounts and sequence numbers MUST be non-negative safe integers; floating
point quantities MUST NOT be used for settlement.

## 3. Agent identity

An Agent Manifest binds a persistent agent identifier to a public key, endpoint,
capabilities, supported profile versions and assurance level. Registration alone
MUST NOT create a proof, entitlement or compute right. A model change MUST NOT
require an identity change.

## 4. Interaction and Language Proof

Before or independently of rewarded-agent processing, a gateway assigns an
`interaction_id` and signs an Origin Attestation containing a content digest,
recipient agent, freshness data and human-origin assurance.

Recognised validators independently attest to human origin, target-language
qualification and reward state. Multiple attestations strengthen one canonical
proof; they MUST NOT create multiple claims from one interaction.

The canonical `proof_id` is derived from the interaction identifier, recipient
agent, profile version and reward state. A Language Proof MUST be:

- non-transferable and bound to its recipient agent;
- accepted only when the pool's validator threshold is satisfied;
- consumed atomically at most once; and
- shareable without clear interaction content.

Within one task or session, only the highest attained reward-state weight MUST be
used. Intermediate states MUST NOT be added together.

## 5. Compute backing

A Compute Commitment identifies its provider, resource class, integer nominal
capacity, availability interval, delivery endpoint and assurance information.
Recognised capacity is the nominal capacity multiplied by published assurance,
availability and reserve factors, using deterministic integer arithmetic.

A capacity interval MUST NOT back incompatible simultaneous obligations. Merely
advertised capacity MUST NOT back spendable issuance.

## 6. Epoch allocation

Each epoch has a finite budget derived from recognised backing and a published
minimum compute right per entitlement unit. Total final allocations MUST NOT
exceed that budget.

Accepted, unconsumed proofs share the budget pro rata by their highest-state
weights, subject to published caps. Deterministic largest-remainder allocation
SHOULD be used so rounding cannot over-issue and identical inputs give identical
outputs. Proof consumption and balance creation MUST commit atomically.

## 7. Settlement

A transfer request contains series, sender, recipient, positive integer amount,
expected sender sequence, unique transfer identifier, nonce, expiry and sender
signature. A signature is authorisation only and MUST NOT itself change balances.

The Settlement Registry MUST verify credentials, signature, series, sequence,
identifier and nonce uniqueness, expiry, policy and sufficient unlocked balance.
It then MUST atomically debit the sender, credit the recipient, increment the
sender sequence and record the transfer, or change no state.

Accepted identifiers and nonces MUST be retained for the replay-protection period.
Conflicting concurrent requests MUST be serialised so at most one can commit.

## 8. Escrow

An escrow lock removes an amount from spendable balance. Release credits the
credentialed service agent; refund restores the client. Each terminal transition
MUST occur once and atomically.

## 9. Compute redemption and retirement

A redemption request specifies holder, series, positive integer amount, workload
digest, compatible resource classes, sequence, nonce and signature. After
verification, the registry locks the amount before routing work.

An execution receipt binds job, request, holder, provider, resource measurement,
result digest and execution time. After independent verification, the registry
MUST permanently retire the locked entitlement. The provider MUST NOT receive the
retired entitlement. Failed execution MAY release the lock under pool policy but
MUST NOT create or duplicate balance.

## 10. Registry integrity and audit

The registry MAY be one authoritative transactional service or federated replicas
applying deterministic transitions with quorum finality. A blockchain is not
required. Optional public checkpoints MAY attest to state history but MUST NOT
authorise transfers or define backing.

Every accepted transition SHOULD return a signed receipt and append an audit event.
Shared records SHOULD contain digests and minimum necessary metadata rather than
clear human content.

## 11. Versioning

The core and language profiles have independent semantic versions. A verifier MUST
evaluate a proof under the exact profile version recorded in it. Unknown major
versions MUST be rejected. Wire-compatible additions require optional fields;
changed meaning requires a new version.

## 12. Deferred decisions

v0.1 does not standardise validator accreditation, profile thresholds, series
fungibility, expiry and rollover, cross-language exchange, provider remedies,
treasury design, federation consensus or legal classification. Implementations
MUST publish any local policy for these matters and MUST NOT describe it as a core
protocol guarantee.

