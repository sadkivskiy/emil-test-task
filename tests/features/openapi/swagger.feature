@swagger
Feature: Swagger documentation security
  As an API consumer
  I want the published OpenAPI document to declare Bearer authentication
  So that I can authorize requests from Swagger UI

  Background:
    Given the API is authenticated

  Scenario: Swagger specification declares Bearer security
    When the OpenAPI specification is requested
    Then the OpenAPI specification should declare Bearer authentication
