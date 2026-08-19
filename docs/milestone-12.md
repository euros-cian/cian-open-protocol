# Milestone 12: scalable tri-state validation

Milestone 12 responds to a cockpit false negative for `so bore da cian` without
silently rewriting the historical `cy-v0.1` policy.

## Automated outcomes

- `QUALIFIES`: high-confidence contextual Welsh; proof may be issued.
- `DOES_NOT_QUALIFY`: no meaningful Welsh evidence; no proof.
- `REVIEW_REQUIRED`: uncertain evidence; service continues, no automatic proof.

`REVIEW_REQUIRED` does not send every interaction to a person. At scale it is an
automated refusal to issue value. Human Welsh specialists review only voluntary
appeals, privacy-reviewed audit samples and candidate profile changes.

## v0.2 evidence

The profile recognises a small, published set of common contextual phrases and
separately counts distinctive Welsh lexical evidence. Common English/Welsh token
collisions do not contribute distinctive evidence. Meta-language such as “the
phrase … means” prevents automatic qualification and routes to uncertainty.

The new seed corpus includes short greetings, learner code-switching, named
entities, quoted Welsh, English controls and the reported cockpit regression.
Every label remains unreviewed, so the profile is still experimental and cannot
support a production accuracy claim.
