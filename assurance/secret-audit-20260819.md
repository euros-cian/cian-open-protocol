# Repository secret audit — 2026-08-19

Scope: live working tree, tracked filenames, ignored credential locations and all
Git commits reachable from local refs. Secret values were never printed.

## Result

- No OpenAI-style API key found in the working tree or Git history.
- No npm or GitHub access token found in the working tree or Git history.
- No repository `.npmrc` is tracked or present.
- Encrypted demonstration identities exist only beneath ignored `secrets/`.
- Example database URLs use localhost/Docker development values.
- The sole private-key pattern in Git history is the explicitly public
  conformance vector key. It is test material and must never control a service.
- The owner’s Welsh review file is local and untracked.

The `security:scan` command now performs a redacted scan of every tracked file.
CI runs it before tests. It reports only rule and path, never a matching value.
This control supplements, but does not replace, GitHub secret scanning or key
rotation after suspected exposure.

The OpenAI key entered through `Read-Host` existed only in that PowerShell
process environment. It was not written by the protocol repository. Closing the
process removes that process copy. Operator shell history, Windows account
security and provider-side key rotation remain operator responsibilities.
