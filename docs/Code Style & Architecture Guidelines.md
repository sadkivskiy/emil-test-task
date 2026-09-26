# Code Style & Architecture Guidelines

Target standard for this repository. Code is reviewed and refactored against this document. If the tree disagrees with a rule here, the tree changes.

The same rules cover architecture and TypeScript style. A second style guide is not maintained.

## 1. Principles

1. One responsibility per module. HTTP, schema parsing, polling, scenario state, and assertions do not share a file.
2. Dependencies point inward: features depend on steps, steps depend on the client and schemas, the client does not depend on tests.
3. The network boundary is untrusted. TypeScript types are erased at runtime. Every payload that crosses HTTP is parsed by Zod before it is used.
4. Tests assert the documented contract. They do not encode a known defect as the expected result.
5. A scenario is independent. It creates its own data, does not rely on order, and deletes what it created.
6. Fail with context. Errors name the operation, the resource id, the HTTP status, and the last observed state. They never include secrets.

## 2. Layout

```text
src/http/                 Shared Axios factory. One instance per scenario.
src/config/               Env schema. Process exits if required variables are missing.
src/services/<domain>/
  <domain>-client.ts      URLs for that domain. Receives the shared Axios instance.
  <domain>.schema.ts      Zod schemas. Exported types are z.infer only.
  polling.ts              Domain waits, when that domain has them. No assertions.
tests/features/<domain>/  Gherkin grouped by domain (claims/, payouts/). A tag on every feature.
tests/steps/              All step definitions together. No domain folders.
tests/fixtures/           Payloads and world helpers used by steps.
tests/utils/              Shared test helpers (seeds, loggers). Not API clients.
tests/support/            World, hooks, and runner setup.
cucumber.js               Profiles, formats, timeout.
.env.example              Names of required variables. No real tokens.
reports/                  Generated locally. reports/report.html is the committed demo.
```

A new API surface is a new folder under `src/services/` and a matching folder under `tests/features/`. The service folder gets the client and schema. Steps and fixtures stay in the shared `tests/steps` and `tests/fixtures` folders. Axios is constructed only in `src/http/`. It does not grow the claims client.

## 3. Module boundaries

| Module | May | Must not |
| --- | --- | --- |
| Feature | Business language, examples, tags | Paths, JSON, status codes, library names |
| Step | Call the client, parse with Zod, assert | Create axios, read `process.env` ad hoc, `sleep` for domain waits |
| World | Hold scenario state | Perform HTTP |
| Client | URLs, headers, status policy, return `AxiosResponse` | `expect`, retry business failures, log bodies that may contain tokens |
| Schema | Describe the wire format, infer types | Import the client or Cucumber |
| Poller | Loop until a predicate or a deadline | Decide that a product bug is acceptable |
| Hook | Cleanup created ids | Swallow the scenario failure |

## 4. TypeScript contract

`tsconfig.json` is strict and explicit. These flags are required:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "verbatimModuleSyntax": true,
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "ES2022"
  }
}
```

- Package `"type": "module"`. Relative imports of local TS use the `.js` specifier that NodeNext emits (`from "../../src/services/claims/claims-client.js"` from a step).
- `import type` for types. `verbatimModuleSyntax` forbids a value import used only as a type.
- No `any`. No `as any`. No `as unknown as T`. Narrow with Zod or a type guard.
- No non-null assertion (`!`) on scenario state. Use a function that throws if the id is missing.
- Exported functions declare an explicit return type.
- Prefer `readonly` fields and `as const` for fixed status lists.
- Optional properties mean "may be absent". Do not assign `undefined` to them when `exactOptionalPropertyTypes` is on. Use omit instead.
- Index access (`arr[i]`, `record[key]`) is `T | undefined`. Handle the undefined branch.

## 5. Code style

### Naming

| Kind | Form | Example |
| --- | --- | --- |
| Type, class, schema, enum-like const | PascalCase | `ClaimsClient`, `PayoutSchema` |
| Function, method, parameter, variable | camelCase | `createClaim`, `timeoutMs` |
| Module-level constant | UPPER_SNAKE_CASE | `TERMINAL_PAYOUT_STATUSES` |
| File | kebab-case, or PascalCase when it matches one class | `claim-client.ts`, `polling.ts` |
| Step module | `<domain>.steps.ts` | `payouts.steps.ts` |
| Feature | words separated by underscore | `claims_lifecycle.feature` |
| Env | `SCREAMING_SNAKE` with a service prefix | `CLAIM_SERVICE_API_TOKEN` |

Boolean names read as predicates: `isTerminal`, `hasNextPage`. Do not prefix interfaces with `I`.

### Functions

- One purpose. If a function both mutates scenario state and asserts a business rule, split it.
- Parameters are data. Do not pass `this` implicitly except Cucumber callbacks, which must be `function` so World binds.
- Async work is `async`/`await`. Every Promise is awaited or returned. No floating promises. No `.then` chains in steps.
- Default parameter values are the production defaults (`timeoutMs = PAYOUT_POLL_TIMEOUT_MS`, 10 seconds, `intervalMs = 1_000`). Call sites pass a shorter timeout only when the scenario says so.

### Errors

```typescript
throw new Error(
  `Timed out after ${timeoutMs}ms waiting for ${expected} on payout ${payoutId}. Last status: ${lastStatus}`,
);
```

Do not throw bare strings. Do not catch an error only to rethrow it without new information. Cleanup in `After` may catch a delete failure, log the id and status, and must not fail the scenario that already finished.

### Comments

Comment why, not what. Do not restate the function name. Public pollers and the env loader have a short JSDoc: parameters, timeout behavior, and what they throw.

### Imports

1. Node built-ins
2. External packages
3. Internal modules

Blank line between groups. No unused imports. No namespace import (`import * as`) unless the module is a namespace.

### Formatting

Prettier is the formatter. ESLint does not fight it. Two-space indent, semicolons, double quotes, trailing commas where Prettier emits them. Line length 100.

## 6. HTTP client

One shared Axios instance per scenario, created in `src/http` and passed into each domain client.

- `baseURL` comes from validated config, not a raw `process.env` read scattered through steps.
- `validateStatus: () => true`. 4xx and 5xx resolve. The step asserts `response.status`. This arrow is client configuration, not a Cucumber callback.
- Auth header is set in a request interceptor from `CLAIM_SERVICE_API_TOKEN` on every call.
- `Content-Type: application/json` for bodies.
- Each method maps to one operation and returns `Promise<AxiosResponse<unknown>>` until the caller parses. The client does not call Zod and does not assert.
- Paths live in the client. Steps never concatenate URLs.
- No retries inside the client for 4xx or for a wrong business status. A transport retry (network error, 502, 503), if added later, is capped, logged without headers, and is not the default for assertions.

## 7. Schemas and types

Zod is the contract. The TypeScript type is `z.infer<typeof Schema>`.

- Integer-64 fields (`amountCents`) are `z.string()`. Do not coerce them to `number`.
- Status fields are `z.enum([...])` of the full API values.
- Parse at the boundary:

```typescript
const payout = PayoutSchema.parse(response.data);
```

Use `safeParse` only when the caller must keep going and report why parse failed (a poller inspecting a list). A failed `parse` in a step is a contract failure and should fail the step.

Unknown JSON is `unknown`, never `any`.

## 8. Configuration

Required variables are declared once and parsed with Zod at process start:

```typescript
const EnvSchema = z.object({
  CLAIM_SERVICE_API_URL: z.string().url(),
  CLAIM_SERVICE_API_TOKEN: z.string().min(1),
});
```

`.env.example` lists the names with empty values and is committed. `.env` is gitignored. Missing or blank values throw before the first request. Steps do not read `process.env` themselves; they use the client, which already loaded config.

Never print the token, the `Authorization` header, or a full request config in errors, formatters, or HTML reports.

## 9. Asynchronous waits

Domain waits poll. They do not sleep a fixed budget and hope.

```typescript
export async function waitForTerminalPayout(
  claimId: string,
  client: PayoutsClient,
  timeoutMs = PAYOUT_POLL_TIMEOUT_MS,
  intervalMs = 1_000,
): Promise<Payout>
```

- Check immediately, then every `intervalMs`.
- Return as soon as the condition holds.
- Throw `Error` when `Date.now()` passes the deadline. The message includes ids and the last status.
- The poll budget is `PAYOUT_POLL_TIMEOUT_MS` in `src/config/timeouts.ts` (10 seconds). The Cucumber step timeout is `CUCUMBER_STEP_TIMEOUT_MS` in the same file (20 seconds), greater than that poll, so the poller's error is the one that surfaces.
- After a parent resource is deleted, poll the child by the id captured before delete, not the parent's collection.
- A step that waits for wall-clock time (`updatedAt` moved) may sleep. That sleep is the assertion setup, and the feature says so.

## 10. Cucumber

### Gherkin

Gherkin is the specification a reader can follow without knowing HTTP or the step code.

A feature names one capability. The three lines under the name say who cares, what they need, and why. The file name uses underscores (`claims_lifecycle.feature`).

`Given` is context, `When` is the action, `Then` is the outcome. `And` and `But` repeat the keyword directly above them. They are not a new kind of step, and they are not registered separately. A scenario does not start with `And`. Do not use `*`.

Write present tense, third person, as a statement of the rule.

```gherkin
When the claim status is updated to "CLAIM_STATUS_APPROVED"
Then a payout should be generated for this claim
```

Not: `When I call updateClaim` or `Then expect(payout).to.exist`.

Reuse the sentence exactly when the behaviour is the same. A different wording is a different step definition. Values that change are parameters. Use `{string}` for titles, statuses, and amounts that stay strings on the wire (`amountCents`). Use `{int}` for counts and for durations in seconds. Escape literal parentheses in the Cucumber expression.

Published status names belong in the phrase (`CLAIM_STATUS_APPROVED`, `PAYOUT_STATUS_PAID`). Paths, HTTP methods, headers, and status codes do not. Those stay in the step definition.

`Examples` holds the rows of one outline. A step data table is for several fields of a single action. Do not put a JSON body in a docstring.

Leave a blank line between scenarios. The title is not repeated as the first step. A `#` comment does not carry a finding or a ticket. The report lives in `FINDINGS.md`.

### Scenarios

A feature describes one capability. The scenario name is the rule, readable without the steps under it.

One scenario proves one rule. Several `Then` steps are fine when each is a consequence of that rule (status, amount, owner). A second `When` is fine when the rule is a sequence (leave `APPROVED`, then enter it again). A different rule is a different scenario.

`Given` arranges state and does not assert the rule. `When` performs the action. `Then` checks the observable outcome. `Background` holds only what every scenario in the file shares, such as authentication. The action under test stays in the scenario.

Put the specification's time budget in the step text (`within 10 seconds`, `for 10 seconds`). The step passes that number to the poller. A payout is not finished by a fixed wait. Proving that something did not happen uses the same window: the first empty list is not proof, because the payout may appear later inside that budget.

`Scenario Outline` repeats one sentence with different data. Examples are the boundaries of that rule (at the deductible, one cent over, the manual-review threshold, one cent over). A different outcome is another scenario, not another row. Placeholders match the Examples header (`<AmountCents>`).

Each scenario creates the records it needs. Identifiers are unique per create. Order between scenarios does not matter. `After` deletes the ids that scenario created. A list assertion checks for this scenario's id, not for any older row that happens to match the filter.

Assert the published rule. A known defect stays a failing scenario. Do not change the expected value to match today's payload.

Tag the feature (`@lifecycle`, `@payout`, `@list`, `@swagger`). Profiles select tags. `npm test` runs the default profile. Do not commit a tag that runs a single scenario (`@only` is local-only).

### World

`CustomWorld` is a class extending `World`, registered with `setWorldConstructor`.

Scenario fields live on the instance: one shared HTTP client, a client per domain, last response, created ids, current payout. Nothing module-scoped is shared across scenarios.

`Given`, `When`, `Then`, `Before`, and `After` are `async function (this: CustomWorld, ...)`. An arrow function is a defect: it does not receive World.

### Steps

A step file imports Cucumber, Chai, the client types, and schemas. It does not configure Axios.

Helpers next to the domain steps may build a valid payload or track ids. They do not assert the rule the scenario exists to prove.

Assertions use Chai and include the rule in the message:

```typescript
expect(response.status, "create claim returns 200").to.equal(200);
```

## 11. Tooling

- ESLint with `typescript-eslint` type-checked rules: `no-explicit-any`, `no-floating-promises`, `no-unused-vars`, `consistent-type-imports`.
- `eslint-plugin-cucumber` or a review checklist for arrow steps if no plugin is wired. `no-focused-tests` equivalent: no committed tag that runs a single scenario by accident (`@only` is local-only and must not land).
- Prettier on save and in CI.
- Scripts: `test`, `test:<tag>`, `typecheck` (`tsc --noEmit`), `lint`, `test:dry` (`cucumber-js --dry-run`).
- CI order: typecheck, lint, dry-run, then the live suite. Undefined steps fail dry-run. A live failure is a product or environment failure, not a missing glue function.

## 12. Review checklist

Reject a change that:

- adds `any`, a non-null assertion on World state, or a second Axios instance
- uses an arrow function for a Cucumber step or hook
- sleeps to wait for a payout
- sets the runner timeout less than or equal to the poll timeout
- puts an assertion inside the client or a schema
- hardcodes a token or logs `Authorization`
- expects the current buggy payload instead of the contract
- leaves a feature step without a definition (`dry-run` must stay green on glue, red only on product behavior)
