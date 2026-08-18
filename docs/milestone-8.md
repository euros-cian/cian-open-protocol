# Milestone 8: independent validator service

Milestone 8 removes Welsh validation from the rewarded conversational agent's
process. The reference validator listens separately on localhost and owns a
distinct persistent Ed25519 signing identity.

## Trust sequence

1. A bootstrap step exports only the gateway and validator public keys into the
   other service's trust directory.
2. The gateway signs the origin attestation before calling the model.
3. The pilot sends the interaction and signed origin evidence to the validator
   over an authenticated channel.
4. The validator verifies the gateway key, signature, identifiers and recomputed
   text digest before applying the Welsh profile.
5. It returns a signed validation attestation containing minimal evidence and no
   clear interaction text.
6. The proof controller verifies the pinned validator key before issuing proof.

The validator must see clear text to evaluate language. This reference service
processes it in memory and does not retain it. Any network deployment requires
TLS; the localhost API-token transport is not sufficient for public exposure.

## Operational separation

`secrets/pilot` contains gateway credentials and the validator public key.
`secrets/validator` contains validator credentials and the gateway public key.
They should be placed under different operator accounts or managed key systems in
a production deployment. The bootstrap command is a single-operator convenience
for this technical pilot, not evidence of organisational independence.

## Remaining boundary

The Welsh policy remains an experimental heuristic. Independent operation does
not make its linguistic decisions accurate or fair. Production requires Welsh
expert governance, a versioned labelled evaluation corpus, measured error rates,
appeals, validator accreditation and key-rotation/revocation procedures.
