# Milestone 9: validator evaluation and appeals

Milestone 9 adds measurable validator evaluation and a minimal appeals channel.
It does not claim that the experimental Welsh heuristic is accurate enough for
production.

## Evaluation governance

The JSON Lines corpus records a stable case ID, text, provisional expected
decision, category and review status. `npm run eval:welsh` calculates a confusion
matrix and per-case outcomes. A production claim is mechanically blocked unless
every included label has `expert_approved` status.

The seed cases are engineering fixtures, not a representative linguistic corpus.
They must not be relabelled as expert-approved without documented review. A real
evaluation needs sufficient examples of regional varieties, informal spelling,
mutations, learner language, code-switching, short valid utterances, named
entities and attempts to game orthographic signals.

## Appeals

An authenticated session may submit an appeal containing an interaction ID,
optional proof ID, profile, disputed decision and structured reason code. Free
text is intentionally excluded to avoid copying conversations into governance
storage. Appeals begin in `open` status and persist in PostgreSQL. Session
retention can remove the session link without deleting the governance record.

This alpha exposes submission and client retrieval only. Reviewer assignment,
evidence access, resolution signatures, correction effects and aggregate public
reporting require a later governance milestone.
