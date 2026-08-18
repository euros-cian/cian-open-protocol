# Milestone 6: controlled conversation API

Milestone 6 provides the first network interface for a human-facing application
or another authorised agent to converse with the persistent Cian agent.

## Controls

- A separate issuer secret protects session creation.
- Session creation records explicit acceptance of a versioned notice.
- Random bearer tokens are represented in memory only by SHA-256 digests.
- Sessions expire after one hour by default.
- Each session is limited to 20 turns per rolling minute by default.
- Request bodies and conversation text have strict size limits.
- Responses disable caching and MIME sniffing.
- Protocol storage receives signed digests and minimal evidence, not clear text.

## API sequence

1. An authorised application creates a session with `POST /v0.1/sessions`.
2. It presents the returned bearer token to `POST /v0.1/conversations`.
3. The gateway signs origin evidence before the model call.
4. Qualifying activity creates a PostgreSQL-backed Language Proof.

## Remaining boundary

The session registry and model context are in memory and disappear on restart.
This alpha does not identify individual humans, implement account recovery,
provide consent withdrawal, or enforce a full retention/deletion policy. It must
remain on localhost unless deployed behind appropriately reviewed TLS,
authentication, abuse prevention and privacy controls.
