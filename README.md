# Balik Alindog Tracker

A private, browser-based tracker for daily weight and body-fat progress. It supports up to 10 shared profiles, kilograms and pounds, goals, a shared food library, Gemini-powered health chat, accessible SVG charts, light/dark themes, and CSV/JSON export.

## Features

- Baseline setup with height, birthday-derived age, required Male/Female gender, current weight, and optional body fat
- The baseline automatically becomes the first permanent measurement
- One permanent morning measurement per profile per calendar day
- Weight stored canonically in kilograms and optionally displayed in pounds
- Weight graph with a body-fat toggle and 7/30/90-day or all-time ranges
- Target weight, optional body-fat target, and progress summaries
- Adult daily calorie-target estimate using profile activity and a 0.5-0.9 kg weekly-loss setting
- Adult BMI chart with categories, target BMI, and a height-based general healthy-weight range
- Growth-aware messaging for children and teens instead of applying adult BMI targets
- Up to 10 browser-local profiles without accounts
- Shared household food library with calories, serving weight, category, meal type, and remarks
- Gemini-powered wellness chat that can use the active profile and shared food library as context
- Light, dark, and system themes
- Per-profile CSV export plus complete Backup and Upload restore
- Responsive, keyboard-friendly interface

## Requirements

- Node.js 22 or newer
- npm

No database, cloud account, API key, or separate desktop application is required.

## Local development

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Quality checks

```bash
npm run lint
npm test
npm run build
```

The production files are generated in `dist/`. To inspect them locally, run `npm run preview` after building.

## Data and privacy

All application data is saved under the current site's `localStorage`. It does not leave the browser. Data is therefore specific to the browser, device, and site address used to open the app. Clearing site data can erase it, so users should periodically select **Backup**.

Only today's measurement can be edited, and it can be edited once. Older measurements remain locked. Shared food-library entries can be added, edited, and deleted.

BMI is presented as a general screening guide, not a diagnosis or personalized medical recommendation. Adult categories and the height-based range are shown only for people age 20 or older. Profiles age 2–19 are directed toward age- and sex-specific professional guidance.

The daily calorie target is a static adult estimate based on the Mifflin-St Jeor equation, the latest weight, and a self-selected activity level. It is not medical advice and is not shown for profiles under age 20, below BMI 18.5, at or below goal weight, or when the calculation is not viable. Results below 1,200 calories per day remain visible only with a prominent professional-guidance warning.

Backups include profiles, measurements, settings, TDEE preferences, and the shared food library. They can be uploaded into another browser or workstation; restoring a backup replaces the household data stored in that browser.

## Deployment

The app is a static site and can be hosted on GitHub Pages or any static host. The included Pages workflow can be started manually or runs when changes reach `main`. In repository settings, set **Pages → Source** to **GitHub Actions**.

## Project structure

```text
src/
├── components/       UI components, BMI guide, and native SVG chart
├── lib/              storage, conversion, date, and export logic
├── test/             shared test setup
├── App.tsx            application composition and workflows
├── styles.css         responsive theme system
└── types.ts           versioned domain types
docs/
└── ARCHITECTURE.md    design, persistence, and future AI boundary
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE)
