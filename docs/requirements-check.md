# Requirement Check

This file checks the current `livepoll-mini-dapp` repo against the requested submission requirements.

## Status summary

| Requirement | Status | Evidence |
| --- | --- | --- |
| Mini-dApp fully functional | Pass | Contract tests pass, frontend tests pass, frontend production build succeeds |
| Minimum 3 tests passing | Pass | 6 frontend tests and 5 contract tests pass locally |
| README complete | Pass | Root [README.md](/f:/Steller/livepoll-mini-dapp/README.md:1) covers setup, features, tests, deploy context, and assets |
| Demo video recorded | Not yet verified | Demo script exists, but no recorded video file or published link is present in the repo |
| Minimum 3+ meaningful commits | Pass after repo initialization | New standalone repo is being created with 3+ logical commits |
| Deliverable: complete mini-dApp with documentation and tests | Mostly pass | Only missing artifact is the actual demo recording or shareable video link |

## Local verification performed

### Frontend tests

`npm test` passed with 6/6 tests:

- cache round-trips values in memory when localStorage is unavailable
- cache expires entries after the ttl
- humanizeWalletError maps wallet rejection errors
- humanizeWalletError maps contract initialization errors
- normalizePoll supports Soroban snake_case payloads
- calculateVotePercents avoids negative or NaN percentages

### Contract tests

`cargo test` passed with 5/5 tests:

- initializes_and_votes
- rejects_double_vote
- error_codes_stay_stable
- rejects_reads_before_initialization
- rejects_invalid_vote_choice

### Frontend build

`npm run build` completed successfully. Vite reported a large chunk-size warning, but it did not block the build.

## What still needs to be added

- Record the demo video and either:
- commit the video file if that is acceptable for submission size, or
- add a shareable video URL to the README and this checklist
