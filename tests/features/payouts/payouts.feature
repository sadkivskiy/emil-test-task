@payout
Feature: Claim Payouts Asynchronous Processing
  As a claims processor
  I want payouts to be generated automatically based on strict business rules
  So that claimants receive accurate amounts safely

  Background:
    Given the API is authenticated

  Scenario: Review and rejection do not create a payout
    Given a claim exists in status "CLAIM_STATUS_PENDING" with amount "60000" cents
    When the claim status is updated to "CLAIM_STATUS_UNDER_REVIEW"
    When the claim status is updated to "CLAIM_STATUS_REJECTED"
    Then no payout should be created for this claim within 10 seconds

  Scenario: A rejected claim cannot be approved and does not create a payout
    Given a claim exists in status "CLAIM_STATUS_REJECTED" with amount "60000" cents
    When an attempt is made to update the status to "CLAIM_STATUS_APPROVED"
    Then the system should reject the transition request
    And no payout should be created for this claim within 10 seconds

  Scenario Outline: No payout when the amount is at or below the deductible
    Given a claim exists in status "CLAIM_STATUS_UNDER_REVIEW" with amount "<AmountCents>" cents
    When the claim status is updated to "CLAIM_STATUS_APPROVED"
    Then the status update is accepted immediately
    And the approval response does not contain the payout
    And no payout should be created for this claim within 10 seconds

    Examples:
      | AmountCents |
      | 0           |
      | 49999       |
      | 50000       |

  Scenario Outline: Deductible is subtracted from <AmountCents> cents
    Given a claim exists in status "CLAIM_STATUS_UNDER_REVIEW" with amount "<AmountCents>" cents
    When the claim status is updated to "CLAIM_STATUS_APPROVED"
    Then the status update is accepted immediately
    And the approval response does not contain the payout
    And a payout should be generated for this claim
    And the payout should reach a terminal state within 10 seconds
    And the payout status should be "PAYOUT_STATUS_PAID"
    And the payout has no failure reason
    And the payout amount should be exactly "<PayoutCents>" cents (amount minus 50000 deductible)
    And the payout belongs to this claim
    And the payout can be fetched on its own

    Examples:
      | AmountCents | PayoutCents |
      | 50001       | 1           |
      | 60000       | 10000       |
      | 999999      | 949999      |
      | 1000000     | 950000      |

  Scenario Outline: Amounts above 1000000 cents require manual review after the deductible
    Given a claim exists in status "CLAIM_STATUS_UNDER_REVIEW" with amount "<AmountCents>" cents
    When the claim status is updated to "CLAIM_STATUS_APPROVED"
    Then the status update is accepted immediately
    And the approval response does not contain the payout
    And a payout should be generated for this claim
    And the payout should reach a terminal state within 10 seconds
    And the payout status should be "PAYOUT_STATUS_FAILED"
    And the payout failureReason should be "manual_review_required"
    And the payout amount should be exactly "<PayoutCents>" cents (amount minus 50000 deductible)
    And the payout belongs to this claim
    And the payout can be fetched on its own

    Examples:
      | AmountCents | PayoutCents |
      | 1000001     | 950001      |

  Scenario: One payout per approval even after duplicate title updates
    Given a claim exists in status "CLAIM_STATUS_APPROVED" with a settled payout
    When the claim title is updated without changing the status
    Then no additional payout should be created for this claim within 10 seconds
    When the claim title is updated without changing the status
    Then no additional payout should be created for this claim within 10 seconds

  Scenario: Sending APPROVED again does not create another payout
    Given a claim exists in status "CLAIM_STATUS_APPROVED" with a settled payout
    When the claim status is updated to "CLAIM_STATUS_APPROVED"
    Then no additional payout should be created for this claim within 10 seconds

  Scenario: Updating the description does not create another payout
    Given a claim exists in status "CLAIM_STATUS_APPROVED" with a settled payout
    When the claim description is updated without changing the status
    Then no additional payout should be created for this claim within 10 seconds

  Scenario: A later transition into APPROVED creates one new payout
    Given a claim exists in status "CLAIM_STATUS_APPROVED" with a pending payout
    When the claim status is immediately updated to "CLAIM_STATUS_UNDER_REVIEW"
    Then the payout status should transition to "PAYOUT_STATUS_CANCELLED"
    When the claim status is updated to "CLAIM_STATUS_APPROVED"
    Then the status update is accepted immediately
    And the approval response does not contain the payout
    And one new payout should be generated for this claim
    And the new payout should reach a terminal state within 10 seconds
    And the payout status should be "PAYOUT_STATUS_PAID"
    And the payout amount should be exactly "10000" cents (amount minus 50000 deductible)

  Scenario Outline: Leaving APPROVED before the payout is terminal cancels it
    Given a claim exists in status "CLAIM_STATUS_APPROVED" with a pending payout
    When the claim status is immediately updated to "<NextStatus>"
    Then the payout status should transition to "PAYOUT_STATUS_CANCELLED"

    Examples:
      | NextStatus                 |
      | CLAIM_STATUS_REJECTED      |
      | CLAIM_STATUS_UNDER_REVIEW  |
      | CLAIM_STATUS_PENDING       |

  Scenario: Payout cancelled if claim is deleted
    Given a claim exists in status "CLAIM_STATUS_APPROVED" with a pending payout
    When the claim is deleted
    Then deleting the claim should succeed
    And the claim should no longer exist
    And the payout status should transition to "PAYOUT_STATUS_CANCELLED"

  Scenario: Deleting a high-value claim cancels its in-flight payout
    Given a claim exists in status "CLAIM_STATUS_APPROVED" with amount "1000001" cents with a pending payout
    When the claim is deleted
    Then deleting the claim should succeed
    And the claim should no longer exist
    And the payout status should transition to "PAYOUT_STATUS_CANCELLED"

  Scenario: A failed manual-review payout stays failed when the claim leaves APPROVED and is deleted
    Given a claim exists in status "CLAIM_STATUS_APPROVED" with amount "1000001" cents with a settled payout
    Then the payout status should be "PAYOUT_STATUS_FAILED"
    And the payout failureReason should be "manual_review_required"
    When the claim status is updated to "CLAIM_STATUS_REJECTED"
    And the claim is deleted
    And the payout status should transition to "PAYOUT_STATUS_CANCELLED"

  Scenario: An unknown payout cannot be fetched
    When a payout is requested with an unknown id
    Then the payout request should be rejected as not found

  Scenario: Payouts for an unknown claim cannot be listed
    When payouts are requested for an unknown claim
    Then the payout request should be rejected as not found
