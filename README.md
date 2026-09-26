# EMIL Claim Service API tests

Cucumber suite for the pre-release Claim Service. The published rules and ordinary REST behaviour are the oracle. Where the service disagrees, the scenario fails and the defect is written up in [FINDINGS.md](FINDINGS.md).

## Setup

Node.js 22.

```bash
npm ci
cp .env.example .env
```

Put the base URL and Bearer token into `.env`. The names are `CLAIM_SERVICE_API_URL` and `CLAIM_SERVICE_API_TOKEN`. `.env` is not committed.

## Run

```bash
npm test
npm run lint
npm run typecheck
npm run test:dry
```

`npm test` is the live suite. `lint` is ESLint and Prettier. `typecheck` is `tsc --noEmit`. `test:dry` checks that every Gherkin step has a definition and does not call the API.

Profiles: `npm run test:lifecycle`, `npm run test:payouts`, `npm run test:list`, `npm run test:swagger`.

A red live run is expected while the service misses the specification. The glue is what `test:dry` checks.

## Waiting for payouts

Approving a claim returns immediately. The payout is supposed to reach `PAID`, `FAILED`, or `CANCELLED` within 10 seconds. The suite polls `GET /v1/claims/{id}/payouts` at once, then every second, and stops when a terminal payout appears. A scenario that says "within 10 seconds" passes that budget into the poller. The Cucumber step timeout is 20 seconds, so a missed payout fails inside the poller with the claim id and the last status, not as a generic step timeout.

A fixed `sleep(10000)` would wait the full budget even when the payout is already terminal, and it would not say what status was last seen. After the claim is deleted, the list on the parent is the wrong place to look, so the suite stores the payout id first and polls `GET /v1/payouts/{id}`.

The one real sleep is the `updatedAt` scenario: the feature waits two seconds so a later timestamp can move. That wait is the assertion, not a stand-in for payout settlement.

## API, briefly

| Call | Role |
| --- | --- |
| `POST /v1/claims` | Create a claim |
| `GET /v1/claims` | List, with `pageSize`, `pageToken`, and status filter |
| `PATCH /v1/claims/{id}` | Update fields and move status |
| `DELETE /v1/claims/{id}` | Delete |
| `GET /v1/claims/{id}/payouts` | Payouts for a claim |
| `GET /v1/payouts/{id}` | One payout |
| `GET /swagger/spec.json` | Published OpenAPI document |

`amountCents` is an int64 on the wire and a string in JSON. Auth is `Authorization: Bearer`. Swagger does not declare that scheme.

No state machine was published. The suite assumes a forward path: `UNSPECIFIED` → `PENDING` → `UNDER_REVIEW` → `APPROVED` or `REJECTED`. `REJECTED` back to `APPROVED` is treated as illegal, because a rejected claim should not start a payout.

A payout exists only after a transition into `APPROVED`. The amount is `amountCents` minus 50000. At or below 50000 there is no payout. Above 1000000 the payout should end `FAILED` with `manual_review_required`. 1000000 itself is still a normal paid payout. Leaving `APPROVED`, or deleting the claim, cancels a payout that is not terminal yet.

## Decisions and trade-offs

- Tests assert the specification, not today's payload. Known bugs stay failures.
- Claims, payouts, and OpenAPI are separate clients, schemas, features, and steps. One Axios instance is shared.
- Responses are parsed with Zod before an assertion. `amountCents` is not coerced to a number.
- Axios uses `validateStatus: () => true`, so 4xx and 5xx are asserted in steps instead of thrown.
- The poll interval is 1 second. The 10 second figure in a scenario is the specification's budget, not a sleep.
- The Cucumber step timeout is `CUCUMBER_STEP_TIMEOUT_MS` (20 seconds), longer than the longest poll, so the poller's message is the one that surfaces.
- Gherkin stays in business language. HTTP status codes stay in step definitions.
- Coverage is the six payout rules, validation, and list/filter. Breadth outside that was cut on purpose.

## Not tested, and why

- Currencies other than EUR. The deductible rules are in cents and do not depend on the currency code.
- Missing or wrong Bearer token. The suite needs a working token to reach the business rules.
- Concurrent updates and races. The interesting async behaviour is one payout settling, not two writers.
- Fuzzing, injection, and oversized strings. Out of scope for a claims workflow.
- A policy-reference field. The claim contract we validate has no such field, so there was nothing to assert.
- Clicking through Swagger UI. The check is whether the published document declares Bearer auth.

## Time spent

About 9 hours.

## AI assistance

Cursor was used heavily to build the framework, split it by domain, review it against a written style guide, and draft this README. The specification, the inferred state machine, which boundaries to assert, and the choice to fail on the contract rather than on the current API behaviour were reviewed and directed by hand.

## Demo

[demo-report.html](demo-report.html) is the last live run, committed in the repository root so it is easy to find. 
Open it in a browser and use it as the demo instead of screenshots: the report shows the scenarios, the failures, and the assertion text in one place. 
GitHub shows the HTML source, so download the file first. `npm test` writes a fresh copy to `reports/cucumber.html`, which stays local.