# Milestone 21 — outside-provider onboarding

Milestone 21 makes provider participation reproducible without putting operational secrets into an onboarding document or Git repository.

An outside organisation now creates:

- a validated non-secret provider profile;
- a persistent Ed25519 identity stored in an AES-256-GCM encrypted credential file;
- a public onboarding bundle containing its public key and signed capacity commitment; and
- an operator process limited to the protocol's bounded, allowlisted demonstration workloads.

The Cian coordinator administrator reviews the public bundle and provisions the provider API token separately. The token, signing passphrase and private key must never be added to the bundle or source control.

Run the safe end-to-end demonstration:

```powershell
npm run demo:provider-onboarding
```

See `docs/provider-operator-guide.md` for the role-separated onboarding and operating procedure.
