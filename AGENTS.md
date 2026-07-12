# QA Test Generator — Agent Instructions

> Agent guide for the [QA-test-generator](https://github.com/anomalyco/QA-test-generator) monorepo.
> Use this file to understand the codebase before making changes.

> **⚠️ IMPORTANT**: Every code change AND every `qa` command modification (new flags, new commands, changed behavior) MUST be accompanied by updates to `AGENTS.md`, `README.md`, `TUTORIAL.md`, and the CLI help text in `packages/cli/src/index.ts` to keep docs in sync.

## Project Overview

**QA Test Generator** (`qa`) is a CLI tool that scaffolds production-grade Cypress test projects and generates test artifacts with AI assistance.

## Repository Structure

```
QA-test-generator/
├── packages/
│   ├── core/                  # @qa-test-generator/core (engine)
│   │   └── src/
│   │       ├── index.ts       # Public API barrel export
│   │       ├── config/        # Zod schemas + JSON persistence
│   │       │   ├── schema.ts  # AppConfig, ProviderConfig
│   │       │   └── store.ts   # loadConfig / saveConfig
│   │       ├── llm/           # LLM provider abstraction
│   │       │   ├── types.ts   # LLMProvider interface + ChatMessage, ChatOptions
│   │       │   ├── provider-factory.ts
│   │       │   ├── ollama.ts
│   │       │   ├── gemini.ts
│   │       │   ├── openai-compatible.ts
│   │       │   └── providers-openai-like.ts  # LMStudio, LlamaCpp, OpenRouter, OpenCode, 9Router
│   │       ├── generator/     # Project scaffolding + AI generation
│   │       │   ├── guides/    # Built-in Structure Guides (LLM-Wiki)
│   │       │   │   └── siam-llm-wiki.ts  # Reference guide from siam-qa-automation
│   │       │   ├── types.ts   # ScaffoldOptions, ProjectLanguage
│   │       │   ├── scaffold.ts# scaffoldProject() + collectFiles()
│   │       │   ├── templates.ts # All generated file templates (~2100 lines)
│   │       │   ├── generate.ts  # AI test/page/locator/helper/command/bdd/all generation
│   │       │   ├── page-analyzer.ts # Web page analysis via Playwright
│   │       │   └── structure-guide.ts # Analyze project → Structure Guide
│   │       ├── chat/
│   │       │   └── chat-session.ts # QA-focused ChatSession (streaming)
│   │       └── docs/
│   │           ├── markdown-generator.ts  # Docs generation (MD + HTML)
│   │           └── confluence-client.ts   # Confluence Cloud publisher
│   └── cli/                   # @qa-test-generator/cli (CLI surface)
│       └── src/
│           ├── index.ts       # Commander entry point + ASCII banner
│           └── commands/
│               ├── new.ts           # qa new — scaffold a project
│               ├── generate.ts      # qa generate test/page/locators/helper/command/bdd/all
│               ├── generate-guide.ts# qa generate-guide — Structure Guide
│               ├── chat.ts          # qa chat — interactive QA session
│               ├── docs.ts          # qa docs — generate docs
│               ├── config.ts        # qa config — manage providers
│               ├── models.ts        # qa models — list models
│               ├── scenario.ts      # qa scenario — write AI scenarios
│               └── analyze.ts       # qa analyze — visit URL & generate artifacts
├── TUTORIAL.md                # ~770-line comprehensive tutorial
├── README.md                  # Project overview
└── package.json               # Root workspace config
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js >=18 |
| Language | TypeScript 5.x (ES2020, Node16 module) |
| Monorepo | npm workspaces |
| CLI | commander, chalk, ora, @inquirer/prompts |
| Config | zod (schema validation + inference) |
| LLM Cloud | @google/generative-ai (Gemini), OpenAI-compatible HTTP |
| LLM Local | Ollama HTTP API, OpenAI-compatible local servers |
| Web Analysis | playwright (headless Chromium) |

## LLM Providers

Seven backends, all implementing the same `LLMProvider` interface (`packages/core/src/llm/types.ts:58`):

| Provider | Type | Default Port | Requires API Key |
|----------|------|-------------|-----------------|
| Ollama | Local | 11434 | No |
| LM Studio | Local | 1234 | No |
| llama.cpp | Local | 8080 | No |
| 9Router | Local | 8000 | No |
| OpenRouter | Cloud | — | Yes |
| Gemini | Cloud | — | Yes |
| OpenCode Zen | Cloud | — | Yes |

Config persisted at `~/.qa-test-gen/config.json`, managed via `qa config`.

## Build & Test

```bash
# Build everything
npm run build:core      # tsc -b in packages/core
npm run build:cli       # tsc -b in packages/cli
npm run build           # both
npm run dev:cli         # watch mode for CLI

# Test (requires a generated project)
cd my-cypress-tests
npm run cy:smoke:all    # clean → smoke → report → serve
npm run cy:bdd:all      # clean → BDD → report → serve
```

## Architecture

### Design Principles

1. **Provider-agnostic engine** — All LLM backends implement the same `LLMProvider` interface. The rest of the app (`generator`, `chat`) never imports a specific backend directly.
2. **Template-driven scaffolding** — Every generated file is a function returning `{path, content}` in `templates.ts`. `scaffold.ts` collects them and writes to disk.
3. **AI generation uses templates too** — `generate.ts` sends the user's goal to the LLM, then wraps the response in the same template functions from `templates.ts`.
4. **Config is user-level** — LLM provider config lives at `~/.qa-test-gen/config.json`, never in the repo.

### Scaffold Flow

```
qa new
  → prompts user (interactive or --yes flags)
  → build ScaffoldOptions
  → scaffoldProject(options)
    → validate with Zod
    → collectFiles(options) — picks templates based on language/bdd/allure
    → write each file to targetDir
    → npm install (optional)
```

### AI Generation Flow

```
qa generate test -g "goal description" -u "http://localhost:3000/login"
  → prompt for goal + URL if not provided and not --yes
  → getActiveProvider() — load LLM from config
  → build system prompt (QA_SYSTEM_PROMPT in generate.ts:8)
  → optionally load Structure Guide for project conventions
  → inject URL into LLM prompt for richer context
  → call provider.chat() or provider.streamChat()
  → write result to appropriate project directory

qa generate all -g "login page" -u "http://localhost:3000/login"
  → Phase 0: LLM generates a step-by-step Markdown scenario (bold actions + elements)
  → Phase 1: LLM generates locators (flat UPPER_SNAKE_CASE) for scenario elements
  → Phase 2: LLM generates page object with methods matching scenario steps
  → Phase 3: LLM generates test spec implementing the scenario
  → Each phase uses exact import paths computed from resolveArtifactPath() or baseName

  # Skip Phase 0 with a pre-written scenario
  qa generate all -g "login" --scenario "1. **Visit** /login\n2. **Type** \"admin\" into **username**"

  # Read scenario from a file (best for long scenarios)
  qa generate all -g "login" --scenario-file ./scenario.md

  # Use --name for clean filenames with non-English goals
  qa generate all -g "ورود به سایت" --name "LoginPage" -u "http://localhost:3000/login"

qa scenario -g "checkout with coupon"
  → LLM generates a Markdown scenario in bold-action/element format
  → Interactive loop: view → Save / Refine / Regenerate / Cancel
  → Saves to scenarios/<name>.md
  → Ready to use with qa g all --scenario-file scenarios/<name>.md
```

### Page Analysis Flow (qa analyze)

```
qa analyze -u "https://example.com/login" -n "LoginPage" --yes
  → Launch headless Chromium via Playwright (uses /usr/bin/chromium-browser)
  → Navigate to URL, wait for network idle
  → Extract all interactive elements: buttons, inputs, links, selects, checkboxes, radios, textareas
  → Extract forms and their fields
  → Generate locators file (flat UPPER_SNAKE_CASE with best selector priority: data-cy > id > name > placeholder > CSS)
  → Generate page object with typed methods for each element (click, type, select, check, etc.)
  → Generate smoke test spec with visit() in beforeEach
  → Write all artifacts to project directories (locators/, pages/, test/smoke/)

qa analyze (interactive)
  → Prompt for URL
  → Prompt for optional name override
  → Prompt for test tier (smoke/regression)
  → Same analysis & generation as above
```

## Code Conventions

- **Exports**: named exports + barrel files. `packages/core/src/index.ts` re-exports everything public.
- **CLI command signature**: `(opts: Options) => Promise<void>`.
- **Core function signature**: always typed with interfaces, validated with Zod at boundaries.
- **Async/await**: top-level entry points are async. Avoid `.then()`.
- **Error handling**: throw descriptive `Error` with actionable messages in the factory; catch and display via `console.error` in CLI commands.
- **Interactive prompts**: Every new CLI command MUST support interactive mode — if called without flags, it should prompt the user for the required parameters using `@inquirer/prompts`. Commands with `--yes` (or equivalent) skip all prompts. See `packages/cli/src/commands/new.ts` or `generate.ts` for the pattern.

## Key Files

| File | Purpose |
|------|---------|
| `packages/core/src/llm/types.ts:58` | `LLMProvider` interface — contract all backends must implement |
| `packages/core/src/llm/provider-factory.ts:20` | `createProvider()` — maps provider ID to implementation |
| `packages/core/src/generator/templates.ts` | All ~30 generated file templates (package.json, pages, tests, CI/CD, etc.) |
| `packages/core/src/generator/scaffold.ts:46` | `collectFiles()` — which templates go into a project |
| `packages/core/src/generator/generate.ts:8` | `QA_SYSTEM_PROMPT` — LLM system prompt for test generation |
| `packages/core/src/generator/page-analyzer.ts` | **Page analysis via Playwright — visits URL, extracts elements, generates locators/pages/tests** |
| `packages/core/src/generator/structure-guide.ts` | Structure Guide engine — analyzes projects, extracts conventions |
| `packages/core/src/generator/guides/siam-llm-wiki.ts` | Built-in LLM-Wiki (Structure Guide) from reference project |
| `packages/core/src/config/schema.ts:8` | `providerConfigSchema` / `appConfigSchema` — Zod schemas |
| `packages/cli/src/index.ts:29` | Commander program definition + all command registrations |

## Key Decisions (ADRs)

### alluriResultsPath in --env
- **Problem**: Allure report was empty because the plugin wrote to `allure-results/` but the report generator read from `allure-results/<suite>/`.
- **Fix**: Added `allureResultsPath=allure-results/<suite>` to `--env` in `cy:smoke`, `cy:regression`, `cy:bdd` scripts in the package.json template. (template lines 47, 52, 66)
- **File**: `packages/core/src/generator/templates.ts`

### BDD Step Import Path
- **Problem**: Generated step-definitions used `../../pages/loginPage` which resolved to the wrong directory.
- **Fix**: Changed to `../pages/loginPage` — step-definitions and pages are siblings under `cypress/e2e/`.
- **File**: `packages/core/src/generator/templates.ts` lines 1394, 1435

### Cucumber Expression Parentheses
- **Problem**: `(بدون نام کاربری)` in a Cucumber expression was treated as an optional group (Cucumber syntax), not literal text.
- **Fix**: Escaped parentheses as `\\(بدون نام کاربری\\)` in step definitions.
- **File**: `packages/core/src/generator/templates.ts` lines 1412, 1453

### serve.sh / serve.cmd Script
- **Problem**: The scripts referenced `node index.js` but `copy.js` renames the JS file to `serve.js` when copying.
- **Fix**: Changed to `node serve.js` in both shell and cmd templates.
- **File**: `packages/core/src/generator/templates.ts` lines 1783, 1791

### BDD Step-Definition Method Names
- **Problem**: Generated step-definitions used incorrect method names from the LoginPage class (e.g., `visit()`, `fillUsername()`, `fillPassword()`, `clickLogin()`, `getErrorMessage()`).
- **Fix**: Updated step-definition templates to use correct LoginPage method names: `openLoginPage()`, `enterUserNameInput()`, `enterPasswordInput()`, `clickLoginButton()`, and direct locator access for error message.
- **File**: `packages/core/src/generator/templates.ts` (sampleStepsTs, sampleStepsJs functions)

### API Call Logging for Allure Reports
- **Problem**: Generated projects only had basic API tracking that attached raw JSON to Allure reports, which was hard to read and didn't capture full request/response details.
- **Fix**: Added comprehensive API logger (`cypress/support/api-logger.ts`) based on SIAM project implementation. Features:
  - Intercepts all `/api/**` requests (excludes localhost)
  - Captures method, URL, headers (sanitized), request/response bodies, status codes, duration
  - Truncates large bodies (max 1000 chars)
  - Limits stored calls to 50 (FIFO)
  - Generates beautiful HTML report with summary cards and collapsible details
  - Auto-attaches to Allure on test failure
  - Provides Cypress commands: `cy.setupApiLogging()`, `cy.attachApiLogsToAllure()`, `cy.clearApiLogs()`, `cy.getApiLogs()`, `cy.watchApiErrors()`
- **Files**: `packages/core/src/generator/templates.ts` (supportApiLogger, supportE2e, supportCommands), `packages/core/src/generator/scaffold.ts`

## Generated Project Structure

The output of `qa new` produces a Cypress project with:

```
my-project/
├── cypress/
│   ├── e2e/
│   │   ├── locators/          # *Locators.ts — UPPER_SNAKE_CASE const objects with as const
│   │   ├── pages/             # *Page.ts — class + singleton export, methods return Cypress.Chainable
│   │   ├── features/          # *.feature — Gherkin scenarios (BDD)
│   │   ├── step-definitions/  # Step implementations (BDD)
│   │   └── test/
│   │       ├── smoke/         # Smoke test specs (.cy.ts)
│   │       └── regression/    # Regression test specs (.cy.ts)
│   ├── support/
│   │   ├── pages/             # (aliased as @pages)
│   │   ├── locators/          # (aliased as @locators)
│   │   ├── helpers/           # *.helper.ts utility modules
│   │   ├── commands.ts        # Custom Cypress commands (getByCy sample + AI-generated)
│   │   ├── commands/          # (reserved for AI-generated commands)
│   │   └── types/             # Shared interfaces
│   └── fixtures/              # Test data (users.json)
├── frontend/                  # Sample app (login + dashboard)
├── scenarios/                  # Sample scenario .md files (when --scenarios)
├── scripts/                   # Allure generate/open, serve, orchestration
├── cypress.config.ts
├── tsconfig.json
└── package.json
```

POM layers strictly separated: locators → pages → tests. Data flow: tests call page methods, pages call locators, locators hold flat string selectors.

### Layer Conventions

| Layer | Export Pattern | Method Pattern | Import Path |
|-------|---------------|----------------|-------------|
| **Locators** | `export const NAME_LOCATORS = { ... } as const` + `export type nameLocators = typeof NAME_LOCATORS` | **Scaffold**: nested groups per section. **AI-generated (flat)**: top-level UPPER_SNAKE_CASE keys | — |
| **Pages** | `export class PageName { ... }` + `export const pageName = new PageName()` | Returns `Cypress.Chainable<JQuery<HTMLElement>>`; uses `cy.get(LOCATORS.Field)` for CSS (flat), `cy.getByCy(LOCATORS.Field)` for data-cy; JSDoc on each method | `import { LOCATORS } from "../locators/nameLocators"` |
| **Tests** | Simple `describe`/`beforeEach`/`it` (no `tags` metadata) | Calls page methods only, no direct `cy.get`/`cy.getByCy` | `import { pageName } from "../../pages/pageName"` |

## CLI Commands

| Command | Description |
|---------|-------------|
| `qa new` | Scaffold a Cypress project (interactive or `--yes`, `--llm-wiki`, `--scenarios`) |
| `qa generate <type>` | Generate with AI: test/page/locators/helper/command/bdd/all (supports `--url`, `--guide`, `--tier`, `--scenario`, `--scenario-file`, `--name`, `--yes`) |
| `qa analyze` | **Analyze a live web page via Playwright and generate locators, page object, and test spec. Supports authentication (`--login-url`, `--username`, `--password`) and scenario-based generation (`--scenario`, `--scenario-file`) for focused artifacts.** |
| `qa generate-guide` / `qa gg` | Create Structure Guide from existing project (interactive or `--yes`) |
| `qa chat` | Interactive QA assistant (supports `--guide` for context) |
| `qa docs` | Generate project docs (Markdown/HTML/Confluence, interactive or `--yes`) |
| `qa config` | Manage LLM providers |
| `qa models` | List models from active provider |
| `qa scenario` | Write AI-generated scenarios (interactive edit loop, saves to `scenarios/*.md`, supports `--guide`, `--goal`, `--yes`) |
