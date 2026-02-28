# LLM Explorer

A client-side web app for comparative analysis of LLM outputs. Upload CSV datasets, define prompt templates with column placeholders, run them against multiple models, and compare results side by side — all from the browser with no backend required.

## Features

### CSV Dataset Management
- Upload CSV files via file picker or drag-and-drop
- Preview uploaded data in paginated tables
- Store datasets locally in a client-side SQLite database (Turso WASM)

### Prompt Templating
- Write system and user prompt templates using `{{column_name}}` placeholders
- Placeholders are auto-populated from your selected dataset's columns
- Clickable column chips for quick insertion into prompts
- Validation warnings for unmatched placeholders

### Multi-Model Execution
- Select multiple LLM models to run the same prompts against
- Batch execution across all CSV rows × selected models
- Real-time progress tracking with per-run status updates
- Cancel in-flight executions at any time

### Comparative Results
- **Table view**: rows = CSV rows, columns = model outputs — for scanning across many rows
- **Side-by-side view**: per-row comparison with model outputs in adjacent panels — for detailed inspection
- Toggle between views freely

### Export
- Export results to CSV or JSON
- Exported CSV pivots results so each model's output is its own column alongside the original data

### Logging
- All execution activity is logged with timestamps and severity levels
- Filter logs by experiment, level (info/warn/error/debug), and limit
- Useful for debugging failed runs or auditing API usage

### Provider Abstraction
- **OpenRouter** (primary) — access hundreds of models through a single API key
- **OpenAI** — direct OpenAI API access
- Pluggable architecture makes it easy to add Anthropic, Azure, or other providers
- API keys stored locally in the browser database

### Persistence
- All configuration, datasets, experiments, results, and logs are stored in a client-side [Turso WASM](https://docs.turso.tech/sdk/ts/reference) SQLite database
- Data persists across page reloads — no server or account needed
- Experiment parameters (temperature, max tokens, model selections) are saved and reloadable

## Getting Started

```bash
npm install
npm run dev
```

Then open the app in your browser. The app requires `SharedArrayBuffer` support (handled automatically by `coi-serviceworker.js`).

### Workflow

1. **Settings tab** — Add your API key for OpenRouter (or another provider)
2. **Datasets tab** — Upload a CSV with text data you want to analyze
3. **Experiments tab** — Create an experiment:
   - Pick a dataset
   - Write prompt templates using `{{column}}` placeholders
   - Select a provider and one or more models
   - Adjust temperature and max tokens
   - Click **Run Experiment**
4. **Results tab** — View and compare outputs across models, export to CSV/JSON
5. **Logs tab** — Review execution logs for debugging

## Tech Stack

- [React 19](https://react.dev/) + [Vite](https://vite.dev/)
- [Primer React](https://primer.style/react/) (GitHub's design system)
- [Turso WASM](https://docs.turso.tech/sdk/ts/reference) (client-side SQLite)
- [XState v5](https://xstate.js.org/) (state machine for experiment execution)
- [PapaParse](https://www.papaparse.com/) (CSV parsing)

## Project Structure

```
src/
  App.jsx                       Main app with tab navigation
  components/
    Layout.jsx                  Tab layout (Settings/Datasets/Experiments/Results/Logs)
    SettingsPanel.jsx           API key management per provider
    DatasetPanel.jsx            CSV upload, preview, and management
    ExperimentBuilder.jsx       Experiment configuration form
    PromptEditor.jsx            Prompt template editor with column chips
    ModelSelector.jsx           Searchable multi-model selection
    ExecutionProgress.jsx       Real-time batch execution progress
    ResultsView.jsx             Results container with view toggle + export
    ResultsTable.jsx            Pivoted table view (rows × models)
    ResultsSideBySide.jsx       Per-row side-by-side model comparison
    LogsPanel.jsx               Filterable execution log viewer
  db/
    connection.js               Turso WASM database singleton
    schema.js                   Table definitions and migrations
    queries.js                  CRUD helpers for all tables
  providers/
    base.js                     Abstract LLM provider interface
    openrouter.js               OpenRouter implementation
    openai.js                   OpenAI-compatible implementation
    index.js                    Provider registry and factory
  machines/
    experimentMachine.js        XState machine for batch execution
  utils/
    csv.js                      CSV parsing and generation
    template.js                 {{placeholder}} interpolation
    export.js                   CSV/JSON export with results pivoting
```
