# npm scope readiness

Registry check date: 2026-08-19.

`npm view @cian-ai/open-protocol` returned `E404`. This shows that the package is
not publicly retrievable; it does **not** prove ownership or availability of the
`@cian-ai` organisation scope.

## Required owner actions

1. Sign in to npm with the intended organisational account and mandatory 2FA.
2. Confirm or create the `cian-ai` organisation and record at least two trusted
   owners where practicable.
3. Confirm the package name and public access without publishing this build.
4. After an initial authorised package exists, configure npm trusted publishing
   for the protected GitHub release workflow using OIDC and provenance.
5. Use a protected GitHub environment with human approval. Do not store a
   long-lived npm publish token in the repository.

Trusted publishing currently requires supported npm/Node versions and a
cloud-hosted CI runner. Follow the current npm documentation at release time:
https://docs.npmjs.com/trusted-publishers/
