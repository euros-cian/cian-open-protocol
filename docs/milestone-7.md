# Milestone 7: persistent sessions and privacy controls

Milestone 7 makes pilot authorisation survive a service restart while minimising
the information stored about a human-facing session.

## Persisted session fields

- An opaque session identifier.
- A SHA-256 digest of the bearer token, never the clear token.
- An optional application-supplied client identifier.
- The accepted privacy-notice version.
- Consent status and issuance, expiry and withdrawal timestamps.
- Rolling-window rate-limit counters.

Conversation text and model context are not stored in PostgreSQL. Model context
still exists in process memory while the service is running and is lost on
restart.

## Withdrawal and retention

`DELETE /v0.1/sessions/current` changes persisted consent to `withdrawn` and
immediately prevents further use of that token. `POST /v0.1/admin/retention`,
protected by the session issuer credential, deletes session metadata that expired
or was withdrawn on or before a supplied cutoff. A future cutoff is rejected.

Language Proofs, attestations, epochs and settlement records are separate signed
protocol records. Session withdrawal does not silently rewrite or delete those
audit records. Their lawful retention and erasure treatment requires documented
governance and jurisdiction-specific privacy advice.

## Remaining boundary

This is still a single-operator localhost pilot. Production work includes a
reviewed privacy notice and retention schedule, data-subject request handling,
managed secret custody, identity-provider integration, distributed rate limiting,
security monitoring and external penetration testing.
