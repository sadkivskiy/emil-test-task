# Findings in ClaimService

## General:
### 1: Missing Security Definitions in Swagger Documentation
    Severity: Low / DX (Developer Experience)
    Steps to reproduce: Open the provided Swagger UI URL (/swagger/index.html). Look for the "Authorize" button.
    Expected result: As a reasonable client, I expect the Swagger specification to include securityDefinitions (or securitySchemes) for Bearer Authentication, allowing me to authenticate and test endpoints directly via the Swagger UI.
    Actual result: The published document is `GET /swagger/spec.json`. It returns HTTP 200 and a Swagger 2.0 document with no `securityDefinitions` and no `securitySchemes`. The Swagger UI has no "Authorize" button. `GET /swagger/doc.json` returns 500, but that path is not the document.
    Rule/Convention broken: OpenAPI/Swagger specification standard for secured APIs.


## Endpoint: GET /v1/claims:
### 1: Inconsistent totalCount in List Claims Response
    Severity: Medium (breaks pagination logic for client UI)
    Steps to reproduce:
        Send a GET /v1/claims request. Observe the response JSON payload.
    Expected result: As a reasonable REST API client, I expect the totalCount field to accurately reflect the total number of claims available in the system (or matching the applied filters), which should be > 0 if items are returned in the claims array.
    Actual result: The totalCount is strictly returning 0, even when the claims array contains items.
    Rule/Convention broken: Reasonable client expectation for pagination metadata correctness.

### 2: Off-by-one Error in pageSize Pagination Logic
    Severity: High (Breaks pagination completely for specific page sizes)
    Steps to reproduce:
        Ensure there are at least 3 claims created in the system.
        Send a GET /v1/claims?pageSize=1. Observe that 0 items are returned.
        Send a GET /v1/claims?pageSize=2. Observe that 1 item is returned.
        Send a GET /v1/claims?pageSize=3. Observe that 2 items are returned.
    Expected result: As a reasonable API client, if I request a pageSize of X (where X is <= the total number of available records), the API should return exactly X items in the response array.
    Actual result: The API consistently returns pageSize - 1 items. Requesting a pageSize of 1 returns an empty list, which would cause infinite loops or blank screens on frontend applications.
    Rule/Convention broken: Reasonable client expectation for standard REST API pagination behavior.

### 3: Token-based Pagination is Broken (nextPageToken is always empty)
    Severity: High (Completely blocks fetching subsequent pages)
    Steps to reproduce:
        Ensure there are multiple claims in the system (e.g., 5).
        Send a GET /v1/claims?pageSize=3. (Note: due to the pageSize finding above, this returns 2 items).
        Check the nextPageToken field in the response.
    Expected result: Since there are more records in the database that haven't been returned yet, nextPageToken should contain a valid string token to be used in the subsequent request to fetch the next page.
    Actual result: The nextPageToken is always returned as an empty string "". The scenario now requests the next page with that token and expects claims that were not on the first page. That request does not run while the token is empty.
    Rule/Convention broken: Reasonable client expectation for token-based pagination functionality.

### 4: pageSize accepts a huge value and a negative value
    Severity: Medium (Missing input validation)
    Steps to reproduce:
        Send GET /v1/claims?pageSize=1000000.
        Send GET /v1/claims?pageSize=-10.
    Expected result: pageSize=1000000 is above any reasonable page maximum and is rejected with a validation error (400 or 422). pageSize=-10 is negative and is rejected the same way. A list page size is a positive integer up to a documented maximum.
    Actual result: Both requests returned HTTP 200 and a claims list, not a validation error. pageSize=1000000 returned 64 claims. pageSize=-10 also returned 64 claims. totalCount was 0 in both bodies. A small pageSize still changes the page (pageSize=3 returns 2), so the parameter is read, but these two values are not rejected.
    Rule/Convention broken: A reasonable client expects invalid pagination input to fail with a validation error instead of a successful page.
    Uncertainty: The run does not show the server's maximum. 64 items may be every claim currently stored, or an undocumented cap. It does show that neither value produced a validation error.

## Endpoint: POST /v1/claims:
### 1: Internal Server Details Leaked in Validation Errors
    Severity: Low (Information Disclosure / Bad DX)
    Steps to reproduce:
        Send a POST /v1/claims request with "amountCents": "not_a_number".
    Expected result: The API should return a standardized REST API validation error message (e.g., "amountCents must be a valid numeric string") hiding internal implementation details.
    Actual result: The last run rejected the value, then failed the leak check. The displayed body starts with `proto: (line 1:1`. The assertion stops on the first match (`proto:`), so this run does not show the rest of the sentence. An older note quoted `(line 5:18)` and `invalid value for int64 type`; that full sentence was not visible in the last report.
    Rule/Convention broken: Information Hiding / Clean API design (never expose internal framework errors to the end-user).

### 2: New Claims are Auto-Approved by Default
    Severity: Critical (Business Logic / Financial Risk)
    Steps to reproduce:
        Send a valid POST /v1/claims request to create a new claim.
    Check the status field in the response.
    Expected result: A newly submitted claim should start in an initial state such as CLAIM_STATUS_PENDING or CLAIM_STATUS_UNDER_REVIEW, requiring explicit authorization to become approved.
    Actual result: The claim is created with CLAIM_STATUS_APPROVED immediately.
    Rule/Convention broken: Core insurance business logic and the API convention implied by the rule "A payout is created when a claim moves into APPROVED".
    Uncertainty: In the same run, "Review and rejection do not create a payout" kept the claim out of a fresh APPROVED transition. The first 10 second window stayed empty. A payout appeared in the second window (count became 1). That may be the payout from this create-time approval arriving late. The run does not show which status change created it.

### 3: A claim amount of 0 cents does not return an id
    Severity: Medium (Create contract)
    Steps to reproduce:
        Create a claim with amountCents "0".
        Read the id from the response, then move the claim to CLAIM_STATUS_UNDER_REVIEW.
    Expected result: The create response contains an id. Amount 0 is a valid boundary for the deductible rule: approving it later creates no payout.
    Actual result: On the last run setup threw "No claimId in world" before any payout check. The create response had no id the suite could read. The HTTP status of that create was not asserted.
    Rule/Convention broken: A created claim returns its id. Zero cents is the bottom of the deductible rule, not a missing field.
    Uncertainty: The run does not show whether the API rejected 0 or returned a body without an id.

## Endpoint: PATCH /v1/claims/{id}:
### 1: PATCH /v1/claims/{id} ignores update payload for title and description
    Severity: Medium (Core CRUD functionality broken) 
    Steps to reproduce:
        Create a claim with a specific title and description.
        Send a PATCH /v1/claims/{id} request with a new title and description.
        Check the response body (and subsequent GET requests).
    Expected result: The claim's title and description should be updated to the new values provided in the payload.
    Actual result: On the last run the PATCH response still had the title "Original title". The description check did not run. The following GET did not run either, because the scenario stopped on the response. Whether the stored claim already has the new title and description is not shown by that run. The scenario now fetches the claim before it asserts the PATCH body.

### 2: Payouts are triggered on redundant updates (Rule Violation)
    Severity: High (Financial Risk / Specification Violation)
    Steps to reproduce:
        Observe a claim that is already in CLAIM_STATUS_APPROVED state.
        Send a PATCH /v1/claims/{id} request without changing the status (e.g., updating only text fields).
        Send a GET /v1/claims/{id}/payouts request.
        Send the same PATCH /v1/claims/{id} request again, still without a status change.
        Send a GET /v1/claims/{id}/payouts request.
    Expected result: According to the specification, "An update that does not change the status creates no payout." No new payout should be generated.
    Actual result: An earlier run created another payout when the status stayed APPROVED, including on the second identical update. The last run did not repeat that observation. Those scenarios failed in setup: no payout appeared within 10 seconds, so the title update, the description update, and the repeated APPROVED never ran.
    Uncertainty: The last run does not confirm or clear this defect. Setup for an already-APPROVED claim does not send a new transition into APPROVED when create already returned that status, so no payout is produced to update.

### 3: The updatedAt timestamp is not refreshed on claim update
    Severity: Low / Medium (Breaks audit trails and client-side caching)
    Steps to reproduce:
        Create a new claim and note the updatedAt timestamp.
        Wait 2 seconds. The scenario waits 2 seconds, not 10.
        Send a PATCH /v1/claims/{id} request to update the claim (e.g., change the status).
        Fetch the claim via GET /v1/claims/{id} and observe the updatedAt field.
    Expected result: As a standard REST API convention, the updatedAt timestamp should reflect the exact server time when the PATCH request was successfully processed.
    Actual result: The updatedAt field remains identical to the createdAt timestamp (or its previous value) and does not update.
    Rule/Convention broken: Standard REST API behavior and database audit conventions for temporal fields.

### 4: Silent failure on invalid status payload (No validation)
    Severity: Medium (Silent data failure / Bad DX)
    Steps to reproduce:
        Send a PATCH /v1/claims/{id} request with an invalid enum value (e.g., "status": "NON_EXISTENT_STATUS").
        Observe the HTTP response code and body.
    Expected result: The API should return a 400 Bad Request with a clear validation error specifying that the provided status is invalid and listing the accepted enum values.
    Actual result: The API silently ignores the invalid field, returns a successful HTTP response (e.g., 200 OK), and returns the claim with its old status untouched.
    Rule/Convention broken: REST API input validation and strict error reporting conventions.

### 5: Deductible is subtracted for an ordinary amount
    Severity: Not a confirmed defect. An earlier note that the deductible is never subtracted does not match the last run.
    Steps to reproduce:
        Create a claim with amountCents "60000".
        Update the claim status to CLAIM_STATUS_APPROVED.
        Poll GET /v1/claims/{id}/payouts until the payout is terminal.
        Repeat with amountCents "50000".
    Expected result: The 60000 claim pays exactly "10000" (amount minus the 50000 deductible) and ends PAYOUT_STATUS_PAID. The 50000 claim creates no payout.
    Actual result: Both matched the specification on the last full `npm test`. The 60000 payout was PAYOUT_STATUS_PAID with amountCents "10000". The 50000 claim created no payout. The same run also paid "1" for amountCents "50001".
    Rule/Convention broken: None for these amounts. The rule "amountCents minus a deductible of 50000" held for 60000 and for the no-payout boundary at 50000.
    Uncertainty: The same run did not subtract the deductible at 999999 and 1000000. See the next finding. The payout amount above 1000000 was still not read. See finding 7.

### 6: Deductible is not subtracted at 999999 and 1000000 cents
    Severity: High (Financial / Specification Violation)
    Steps to reproduce:
        Create a claim with amountCents "999999".
        Update the claim status to CLAIM_STATUS_APPROVED.
        Poll GET /v1/claims/{id}/payouts until the payout is terminal.
        Read amountCents.
        Repeat with amountCents "1000000".
    Expected result: 999999 pays exactly "949999". 1000000 is still at the manual-review threshold, not above it, so it pays exactly "950000" and ends PAYOUT_STATUS_PAID with no failure reason. Both amounts are the claim amount minus the 50000 deductible.
    Actual result: On the last full `npm test` both payouts reached PAYOUT_STATUS_PAID with no failure reason, then the amount check failed. The 999999 claim returned amountCents "999999". The 1000000 claim returned amountCents "1000000". The deductible was not subtracted. Smaller amounts in the same run did subtract it (60000 paid "10000").
    Rule/Convention broken: "The payout amount is the claim's amountCents minus a deductible of 50000." 1000000 itself is not "above 1000000", so the manual-review rule does not apply to either amount.
    Uncertainty: This run does not show whether every amount above 60000 keeps the full value, or only amounts near 1000000. 1000001 never became terminal inside 10 seconds, so its amount was not read. See the next finding.

### 7: High-value payout did not reach a terminal state within 10 seconds
    Severity: High for the missed deadline. Whether manual review is bypassed is not confirmed.
    Steps to reproduce:
        Create a claim with amountCents "1000001".
        Update the claim status to CLAIM_STATUS_APPROVED.
        Poll GET /v1/claims/{id}/payouts for the 10 second settlement window.
    Expected result: The payout ends PAYOUT_STATUS_FAILED with failureReason "manual_review_required" within 10 seconds. The amount, if a payout exists, is "950001".
    Actual result: On the last full `npm test` the payout was still PAYOUT_STATUS_PROCESSING when the poll timed out. It was not observed as PAYOUT_STATUS_PAID. failureReason and amountCents were not read, because the payout never became terminal inside the window.
    Rule/Convention broken: "A payout reaches a terminal state (PAID, FAILED or CANCELLED) within 10 seconds." The manual-review rule is the expected end state. This run did not show that end state.
    Uncertainty: I do not know whether the payout would later become FAILED with manual_review_required, become PAID, or stay PROCESSING. The confirmed observation is only the timeout in PROCESSING.

### 8: Payout is not cancelled when parent claim is deleted
    Severity: High (Orphaned financial transactions / Money leak)
    Steps to reproduce:
        Create a claim with an amount triggering a payout 1000001.
        Ensure the payout is in a non-terminal state (e.g., PAYOUT_STATUS_PROCESSING).
        Send a DELETE /v1/claims/{id} request and verify it returns 200 OK (and subsequent GET returns 404).
        Send a GET /v1/claims/{id}/payouts request to check the payout status.
    Expected result: According to the rules, "If a claim is deleted before its payout reached a terminal state, that payout ends CANCELLED."
    Actual result: An earlier run left the payout in PAYOUT_STATUS_PROCESSING when the poll for PAYOUT_STATUS_CANCELLED timed out. It was not observed as CANCELLED. The last run did not repeat that observation. The delete and leave-APPROVED scenarios failed in setup with "no payout" before the delete, so they never polled for CANCELLED.
    Rule/Convention broken: Explicit specification: "If a claim is deleted... that payout ends CANCELLED."
    Uncertainty: The earlier run shows it had not become CANCELLED inside the poll window. It does not show the status after that window. The last run does not add a new observation.

### 9: PATCH status response returns the previous status
    Severity: Medium (Same class as the stale title response)
    Steps to reproduce:
        Create a claim. The create response is already CLAIM_STATUS_APPROVED.
        PATCH the status to CLAIM_STATUS_PENDING, then to CLAIM_STATUS_UNDER_REVIEW, then from UNDER_REVIEW to CLAIM_STATUS_APPROVED, and from UNDER_REVIEW to CLAIM_STATUS_REJECTED.
        Read the status on the PATCH response.
        GET /v1/claims/{id} was not part of the last run. The scenario now fetches the claim after the PATCH and checks that GET before the response body.
    Expected result: Both the PATCH response and the following GET show the status that was just sent.
    Actual result: On the last run the PATCH body kept the previous status. APPROVED was still APPROVED when PENDING was sent. PENDING was still PENDING when UNDER_REVIEW was sent. UNDER_REVIEW was still UNDER_REVIEW when APPROVED was sent, and again when REJECTED was sent. HTTP status was 200. The GET after those updates did not run.
    Rule/Convention broken: A successful PATCH returns the updated resource. This is the same shape as the stale title on the PATCH response. It does not by itself prove the stored status is unchanged.
    Uncertainty: The stored status after GET is not known from the last run.

## Endpoint: GET /v1/claims/{id}/payouts:
### 1: Payouts for an unknown claim return 200
    Severity: Medium (Wrong status for a missing resource)
    Steps to reproduce:
        Send GET /v1/claims/claim-does-not-exist/payouts.
    Expected result: 404, the same as GET /v1/payouts/{unknown id}, which returned 404 on this run.
    Actual result: On the last run the unknown claim payout list returned 200.
    Rule/Convention broken: A reasonable client treats an unknown parent resource as not found.