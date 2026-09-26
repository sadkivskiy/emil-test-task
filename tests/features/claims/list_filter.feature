@list
Feature: List and Filter Claims
  As an API consumer
  I want to list claims with pagination and filter them by status
  So that I can build scalable user interfaces

  Background:
    Given the API is authenticated
    And a claim exists in status "CLAIM_STATUS_PENDING"
    And a claim exists in status "CLAIM_STATUS_UNDER_REVIEW"
    And a claim exists in status "CLAIM_STATUS_APPROVED"
    And a claim exists in status "CLAIM_STATUS_REJECTED"
    And there are at least 5 claims in the system

  Scenario Outline: Filter claims by specific status
    When a request is made to list claims filtered by "<Status>"
    Then all returned claims should have the status "<Status>"

    Examples:
      | Status                     |
      | CLAIM_STATUS_PENDING       |
      | CLAIM_STATUS_UNDER_REVIEW  |
      | CLAIM_STATUS_APPROVED      |
      | CLAIM_STATUS_REJECTED      |

  Scenario: Filtering by unspecified returns claims of every status
    When a request is made to list claims filtered by "CLAIM_STATUS_UNSPECIFIED" with pageSize 100
    Then the returned claims should include status "CLAIM_STATUS_PENDING"
    And the returned claims should include status "CLAIM_STATUS_UNDER_REVIEW"
    And the returned claims should include status "CLAIM_STATUS_APPROVED"
    And the returned claims should include status "CLAIM_STATUS_REJECTED"

  Scenario Outline: pageSize outside the allowed range is rejected
    When a request is made to list claims with pageSize <PageSize>
    Then the system should reject the request with a validation error

    Examples:
      | PageSize |
      | 1000000  |
      | -10      |

  Scenario Outline: Pagination returns exactly the requested page size
    When a request is made to list claims with pageSize <PageSize>
    Then exactly <PageSize> claims should be returned in the response array

    Examples:
      | PageSize |
      | 1        |
      | 2        |
      | 3        |

  Scenario: Token-based pagination provides a next page token
    When a request is made to list claims with pageSize 3
    Then a nextPageToken should be provided for the next page
    When the next page is requested with pageSize 3
    Then the next page should return claims that were not on the previous page

  Scenario: List response totalCount matches available claims
    When a request is made to list claims with pageSize 3
    Then the claims array should not be empty
    And the totalCount should be at least the number of returned claims
    And the totalCount should be greater than 4