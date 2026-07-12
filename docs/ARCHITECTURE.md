# Architecture

## Current design

Balik Alindog Tracker is a client-only React application. TypeScript domain objects flow through pure storage functions before the complete state is persisted to browser `localStorage`.

```text
React interface
    ↓
Domain operations and validation
    ↓
Versioned AppState
    ↓
Browser localStorage
```

`AppState.schemaVersion` is the migration boundary. Future schema changes should load old data through explicit migrations rather than silently discarding or rewriting records.

## Data invariants

- A maximum of 10 profiles is allowed.
- Each profile may have at most one measurement per local calendar date.
- Measurement records are append-only in the user interface.
- Weight is stored in kilograms; pounds are a presentation conversion.
- Entries are sorted by their measurement date, not their save timestamp.
- Goals and display preferences are mutable profile settings, not measurements.

## Persistence limitations

`localStorage` is appropriate for a zero-service first version, but it is tied to one browser origin and can be cleared by the user or browser. Complete JSON export provides a portable backup. A future mobile or synchronized version should place the same domain model behind a repository interface backed by SQLite or a server database.

## Future AI boundary

AI functionality must stay separate from measurement storage and charting:

```text
SuggestionService
├── LocalSuggestionProvider
└── GeminiSuggestionProvider
```

Providers should accept a deliberately limited, user-approved context object rather than direct access to all application state. A public web build must not contain a shared Gemini secret. A later design can use either a user-provided key stored locally or a server-side proxy with authentication and rate limits.

No AI provider, API key handling, meal plan, or activity suggestion is included in the current release.

## Accessibility

The graph has an accessible image description, and every data point can receive keyboard focus with its date and value announced. Forms use native labels and validation. Themes maintain semantic color tokens, focus indicators are visible, and reduced-motion preferences are respected.
