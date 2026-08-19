# Milestone 23 — compute API security hardening

Milestone 23 adds defensive controls at the compute coordinator's HTTP boundary. These controls reduce exposure; they do not replace the pending independent security assessment.

## Implemented controls

- Fixed-window request limiting with HTTP `429` and `Retry-After` responses.
- Constant-time comparison for the coordinator admin token and in-memory provider-token digests.
- Provider API-token rotation with immediate invalidation of the old token and a durable operational event.
- Strict `application/json` enforcement for JSON request bodies.
- A 131,072-byte HTTP body limit in addition to the safe executor's smaller workload limit.
- Plain HTTP binds to loopback only by default. Network exposure requires deliberate configuration and TLS termination.
- `no-store`, MIME-sniffing, frame and referrer security headers.
- Abuse tests for token rotation, repeated requests, unsupported media, invalid JSON, oversized bodies and unsafe binding.

Provider signing keys remain separate from transport tokens. Execution receipts must still carry a valid Ed25519 signature even after successful bearer authentication.

Run the demonstration:

```powershell
npm run demo:compute-security
```

Production deployment remains blocked pending external assessment, managed signing-key custody and privacy/legal review.
