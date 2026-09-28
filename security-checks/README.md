# Public workflow security contract

This package performs offline regression checks over the public GitHub Actions
workflows. It makes no network requests, reads no credentials and executes no
workflow. The npm test command runs both the existing feed tests and these
checks.

The checks enforce the deliberately small contracts needed by SEC-PUBLIC-F0:

- CI and public SEO workflows cannot reference production secrets or the
  private runtime repository.
- write-all is forbidden and contents: write remains limited to the two AESAN
  publishers.
- privileged events require an explicit code change and review; none is
  currently excepted.
- the hardened CI and SEO actions use full commit SHAs.
- all external action references are pinned to reviewed full commit SHAs; no
  floating-action exception remains.
- the extraordinary GH-FIXES closure cannot regain a push/schedule trigger,
  requires an explicit manual confirmation phrase, scopes the production
  synchronization secret to its authenticated step and pins its artifact action.
- the retired GH-FIXES read-only verifier is manual-only, keeps checkout
  credentials non-persistent, scopes its production secret to the audit step
  and pins both external actions.
- both ordinary RASFF lanes pin checkout, disable persisted checkout credentials
  and inject the production synchronization secret only into the authenticated
  lane step; cron, concurrency and controller behavior remain unchanged.
- obvious environment/context dumps and broad or credential-like artifact
  paths fail.

The implementation intentionally uses narrow line- and block-level checks
instead of a general YAML parser because the repository has no runtime
dependencies. This is a regression boundary, not a full semantic Actions
analyzer. It cannot prove that arbitrary shell or JavaScript never leaks data,
that a pinned third-party commit is vulnerability-free, or that repository
administration and server-side authorization are secure.

Historical debt remains explicit in KNOWN_DEBT: job-level production-secret
injection, over-broad operational diagnostics and platform protection. Those items require coordinated operational or owner
decisions and are not silently waived by this test suite.
