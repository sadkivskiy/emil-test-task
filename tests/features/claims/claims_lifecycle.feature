@lifecycle
Feature: Claims Lifecycle and Validations
  As an API consumer
  I want to validate, and transition claims through a strict state machine
  So that I can build scalable user interfaces

  Background:
    Given the API is authenticated

  Scenario: Successfully create a new claim with default status
    When a new claim is submitted with title "Car damage", description "Rear bumper", amount "100000" cents, and currency "EUR"
    Then the claim should be created successfully
    And the claim status should be "CLAIM_STATUS_PENDING"
    And the claim status should not be "CLAIM_STATUS_APPROVED"
    And the claim title should be "Car damage"
    And the claim description should be "Rear bumper"

  Scenario: Prevent claim creation with missing required fields
    When a new claim is submitted missing the "amountCents" field
    Then the system should reject the request with a validation error

  Scenario: Invalid amountCents does not leak internal protobuf errors
    When a new claim is submitted with an invalid amountCents value "not_a_number"
    Then the system should reject the request with a validation error
    And the error message should not leak internal protobuf details

  Scenario Outline: Valid status transitions moving forward
    Given a claim exists in status "<CurrentStatus>"
    When the claim status is updated to "<NextStatus>"
    And the claim is fetched
    Then the claim status should be "<NextStatus>"
    And the claim status should be updated successfully to "<NextStatus>"

    Examples:
      | CurrentStatus              | NextStatus                  |
      | CLAIM_STATUS_PENDING       | CLAIM_STATUS_UNDER_REVIEW   |
      | CLAIM_STATUS_UNDER_REVIEW  | CLAIM_STATUS_APPROVED       |
      | CLAIM_STATUS_UNDER_REVIEW  | CLAIM_STATUS_REJECTED       |

  Scenario: Prevent transitioning from a terminal rejected state back to approved
    Given a claim exists in status "CLAIM_STATUS_REJECTED"
    When an attempt is made to update the status to "CLAIM_STATUS_APPROVED"
    Then the system should reject the transition request

  Scenario: Invalid status payload is rejected
    Given a claim exists in status "CLAIM_STATUS_PENDING"
    When an attempt is made to update the status to "NON_EXISTENT_STATUS"
    Then the system should reject the request with a validation error

  Scenario: Updating title and description is persisted
    When a new claim is submitted with title "Original title" and description "Original description"
    And the claim title is updated to "Patched title" and description to "Patched description"
    And the claim is fetched
    Then the fetched claim should have title "Patched title" and description "Patched description"
    And the update response should include title "Patched title" and description "Patched description"

  Scenario: updatedAt is refreshed when a claim is patched
    When a new claim is submitted with title "Timestamp claim", description "Timestamp description", amount "100000" cents, and currency "EUR"
    And the claim timestamps are recorded
    And 2 seconds pass
    And the claim title is updated without changing the status
    And the claim is fetched
    Then the claim updatedAt should be later than createdAt
