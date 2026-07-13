# Project working preferences

## Test-running workflow

- For small to medium changes, default to edit only and do not run tests automatically.
- Before running checks, ask the user which level they want:
  - Small test: quick lint or a narrow targeted check.
  - Medium test: focused relevant tests for the changed area.
  - Full regression: lint, all tests, and production build.
  - Skip tests: edit only.
- For larger functional changes, pre-commit checks, pushes, or deployments, still ask the user which test level they want before running checks.
- If the user does not choose a test level for a small or medium change, assume skip tests / edit only.
