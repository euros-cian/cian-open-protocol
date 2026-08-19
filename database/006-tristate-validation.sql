BEGIN;
ALTER TABLE protocol_validation_appeals
  DROP CONSTRAINT IF EXISTS protocol_validation_appeals_disputed_decision_check;
ALTER TABLE protocol_validation_appeals
  ADD CONSTRAINT protocol_validation_appeals_disputed_decision_check
  CHECK (disputed_decision IN ('QUALIFIES', 'DOES_NOT_QUALIFY', 'REVIEW_REQUIRED'));
COMMIT;
