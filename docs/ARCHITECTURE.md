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

`AppState.schemaVersion` is the migration boundary. Current data uses schema version six. Older browser data is migrated without discarding profiles or measurements, and versions before six receive an empty shared food library. Future schema changes should follow the same explicit migration approach.

## Data invariants

- A maximum of 10 profiles is allowed.
- Each profile may have at most one measurement per local calendar date.
- New profiles require height, birthday, Male/Female gender, current weight, and a target weight; body fat is optional.
- A new profile's current weight is stored as its immutable baseline measurement.
- Measurement records are append-only in the user interface.
- Weight is stored in kilograms; pounds are a presentation conversion.
- Entries are sorted by their measurement date, not their save timestamp.
- Goals and display preferences are mutable profile settings, not measurements.
- Food-library entries belong to the household, not an individual profile.
- Food duplicates are allowed after a warning and are identified by normalized food name plus weight in grams.
- Stored calories describe the stored serving weight and can be scaled proportionally.

## BMI guidance

BMI is calculated as kilograms divided by height in meters squared. Profiles age 20 and older receive the standard adult category chart and a general weight range corresponding to BMI 18.5–24.9. Profiles age 2–19 do not receive adult target ranges because pediatric interpretation requires age- and sex-specific percentiles. The interface consistently describes BMI as a screening measure rather than a diagnosis.

## Persistence limitations

`localStorage` is appropriate for a zero-service first version, but it is tied to one browser origin and can be cleared by the user or browser. Complete JSON export provides a portable backup. A future mobile or synchronized version should place the same domain model behind a repository interface backed by SQLite or a server database.

## Health chat boundary

AI functionality stays separate from measurement storage and charting:

```text
SuggestionService
├── LocalSuggestionProvider
└── GeminiSuggestionProvider
```

The health chat sends a deliberately limited context object: active-profile details, goals, latest values, that profile's measurement history, and the shared household food library. It does not send other household profiles or raw backup data. Food-library context is labeled as reusable reference data rather than a record of consumption, and each entry includes a calories-per-gram value for proportional serving calculations.

The browser build reads `HEALTH_API` into the `HEALTH_API` constant used by `health_track_api.js`, with `VITE_HEALTH_API` kept as a local-development fallback. Because the value is embedded in the public browser bundle, this is configuration rather than a true secret. Missing configuration disables live chat responses gracefully. A future version that needs a protected shared key should use a server-side proxy with authentication and rate limits.

The assistant is positioned as a wellness coach, not medical advice. Prompt rules tell it not to diagnose, prescribe, recommend medication, or propose unsafe weight-loss behaviors.

## Accessibility

The graph has an accessible image description, and every data point can receive keyboard focus with its date and value announced. Forms use native labels and validation. Themes maintain semantic color tokens, focus indicators are visible, and reduced-motion preferences are respected.
