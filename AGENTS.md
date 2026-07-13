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

## Commit and push workflow

- After a small or medium task is completed, commit and push the task changes to GitHub by default.
- Keep commits focused on the completed task. Do not include unrelated, user-owned, or ambiguous working-tree changes unless the user explicitly includes them.
- Use a clear, concise commit message that describes the completed change.
- For large tasks, risky changes, or changes that may require a review before publishing, ask the user before committing and pushing.
- If checks are skipped under the test-running workflow, mention that in the handoff after pushing.
