# Milestone 15: independent Welsh review and calibration

Milestone 15 establishes the review boundary between protocol engineers and
Welsh-language experts. It does not treat software-generated labels as
independent linguistic evidence.

## Workflow

1. Run `npm run review:welsh:prepare`.
   A reviewer can instead set a stable pseudonymous `CIAN_WELSH_REVIEWER_ID` and
   run `npm run review:welsh:cockpit`, then use the loopback-only browser UI on
   port 8794.
2. Send `tmp/cy-v0.2-blind-review.json` independently to at least two fluent
   Welsh reviewers. Do not send provisional labels or validator output.
3. Store returned decisions in `evaluation/cy-v0.2.reviews.jsonl`, following
   `evaluation/cy-v0.2.reviews.example.jsonl`.
4. Re-run the command. Reviewer disagreements are reported as
   `needs_adjudication` and require a third record with role `adjudicator`.
5. Inspect overall and per-category agreement before proposing a new profile.

The real review file is intentionally absent because no expert decisions have
yet been supplied. Review should cover North and South Welsh, formal and
colloquial forms, learners, code-switching, named entities, quoted language and
adversarial orthographic matches. Reviewer consent, compensation, declared
competence and conflicts must be recorded outside the public text-minimised
dataset.

## Hard release gate

`independent_review_complete` requires at least two distinct reviewers and a
consensus or adjudicated decision for every case. `production_claim_allowed`
also requires the validator to agree with every reviewed decision. These strict
reference gates do not imply that a small seed corpus is sufficient for
deployment.

Changes learned from review belong in a new immutable language-profile version.
Existing proofs and settlements are never rewritten.
