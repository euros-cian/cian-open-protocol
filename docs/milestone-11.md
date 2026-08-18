# Milestone 11: visual protocol cockpit

Milestone 11 makes the protocol's trust sequence visible in a local browser.

## Visible sequence

1. The visitor explicitly consents to the local technical demonstration.
2. A Welsh or mixed-language message enters the gateway.
3. The cockpit shows the signed origin digest and attestation identifier.
4. The configured AI provider returns the conversational response.
5. The independently keyed validator returns its signed decision.
6. A qualifying interaction displays its Language Proof and reward state.
7. PostgreSQL persistence is shown separately from future epoch allocation.
8. The visitor may submit a structured appeal without copying conversation text.

The proof counter represents accepted proofs ready for a finite compute-backed
epoch. It does not represent money, cash value, available compute or a settled
balance.

## Safety boundary

The UI is disabled by default. Enabling it requires `CIAN_ENABLE_DEMO_UI=1`; the
pilot refuses a non-loopback bind in that mode, and demo-session issuance also
checks that the request originates on loopback. Browser assets use a restrictive
Content Security Policy and no third-party scripts, fonts or analytics.

This is still not safe for public exposure. A real product interface requires
account authentication, reviewed consent text, accessibility testing, privacy
review, abuse controls, TLS, monitoring and external security assessment.

`npm run demo:cockpit-preview` provides an offline visual walkthrough on port
8793. It is prominently identified in the terminal as deterministic mock data and
must not be used as evidence that live services are operating.
