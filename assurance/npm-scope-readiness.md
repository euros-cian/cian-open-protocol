# npm scope readiness

Registry check date: 2026-08-19.

`npm view @cian-ai/open-protocol` returned `E404`, so the package is not publicly
retrievable. Authenticated checks on 2026-08-19 then confirmed npm user
`eurosevans` is an `owner` of the `cian-ai` organisation. Organisation control is
therefore verified; the package remains unpublished.

## Required owner actions

1. Maintain mandatory 2FA on the owner account.
2. Add a second trusted organisation owner where practicable to reduce account
   recovery and continuity risk.
3. Confirm the package name and public access during the authorised release.
4. After an initial authorised package exists, configure npm trusted publishing
   for the protected GitHub release workflow using OIDC and provenance.
5. Use a protected GitHub environment with human approval. Do not store a
   long-lived npm publish token in the repository.

Trusted publishing currently requires supported npm/Node versions and a
cloud-hosted CI runner. Follow the current npm documentation at release time:
https://docs.npmjs.com/trusted-publishers/

No npm publish was performed as part of this verification.
