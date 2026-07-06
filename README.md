# 🧪 QA Test Generator

A CLI tool for scaffolding production-grade **Cypress test projects** with Page Object Model, BDD/Cucumber, Allure reporting, and CI/CD — in seconds.

## Features

- **Scaffold a complete Cypress project** in one command — locators, pages, tests, scripts, config, CI/CD
- **Page Object Model (POM)** — clean separation of locators, pages, and tests
- **BDD / Cucumber** — optional Gherkin `.feature` files with step definitions
- **Allure Reporting** — optional HTML reports with historical trends
- **Sample frontend app** — a login page + dashboard with an HTTP API (Node.js), ready for your tests
- **CI/CD** — Azure Pipelines YAML included
- **TypeScript first** — full type declarations, path aliases (`@fixtures/`, `@support/`)
- **AI-Powered Generation** — generate tests, pages, locators, and helpers from natural language
- **Structure Guides** — analyze existing projects, generate code that follows their conventions
- **Interactive QA Chat** — conversational AI assistant with project context support
- **Test Tiers** — organize tests into `smoke` and `regression` suites

## Quick Start

```bash
cd my-e2e-project

# Install dependencies
npm install

# Terminal 1: Start the sample frontend
npm run frontend

# Terminal 2: Run smoke tests
npm run cy:smoke:all
```

## Generated Structure

```
my-e2e-project/
├── frontend/                     # Sample app (login + dashboard)
│   ├── server.js                 # HTTP API (port 3000)
│   ├── index.html                # Login page
│   └── dashboard.html            # Post-login dashboard
├── cypress/
│   ├── e2e/
│   │   ├── locators/             # data-cy selectors (PascalLocators.ts)
│   │   ├── pages/                # Page Object classes (PascalPage.ts)
│   │   ├── features/             # .feature files (BDD)
│   │   ├── step-definitions/     # Step implementations
│   │   └── test/
│   │       ├── smoke/            # Fast sanity checks (*.cy.ts)
│   │       └── regression/       # Full regression suite (*.cy.ts)
│   ├── fixtures/
│   │   └── users.json            # Test user data
│   ├── support/
│   │   ├── pages/                # Page Object classes
│   │   ├── locators/             # Selector constants
│   │   ├── helpers/              # Utility helpers (*.helper.ts)
│   │   ├── commands.ts           # Custom Cypress commands
│   │   ├── e2e.ts                # Global test config
│   │   └── types/                # Shared interfaces
│   └── utils/
│       └── dataGenerator.ts      # Test data helpers
├── scripts/                      # Allure, serve, orchestration
│   ├── allure/
│   ├── serve/
│   ├── run-all.js
│   └── start-frontend.js
├── cypress.config.ts
├── tsconfig.json
├── azure-pipelines.yml
└── package.json
```

## CLI Usage

### Project Scaffolding

```bash
qa new [options] [--name <name>]

Options:
  -n, --name <name>               Project name (default: my-cypress-tests)
  -p, --path <dir>                Target directory (default: ./<name>)
  -l, --language <lang>           typescript | javascript (default: typescript)
  --bdd / --no-bdd                Enable Cucumber BDD (default: true)
  --allure / --no-allure          Enable Allure reporter (default: true)
  --baseUrl <url>                 Base URL for tests (default: http://localhost:3000)
  -d, --description <text>        Project description
  --install / --no-install        Run npm install (default: true)
  -y, --yes                       Skip all prompts
```

### AI-Assisted Test Generation

```bash
qa generate <type> [options]

Types:
  test         Generate a Cypress test spec
  page         Generate a Page Object class
  locators     Generate selector constants
  helper       Generate a utility helper module
  bdd          Generate BDD feature + step definitions
  all          Generate locators + page + test in one pass

Options:
  -g, --goal <text>              Natural-language description of what to generate
  -u, --url <url>                Page URL to analyze (provides context for AI generation)
  -p, --project-root <dir>       Project root (default: cwd)
  --guide <path>                 Path to a Structure Guide for project conventions
  --tier <tier>                  Test tier: smoke (default) or regression
  -y, --yes                      Skip confirmations
```

### Structure Guide (Learn from Existing Projects)

```bash
# Create a Structure Guide from an existing Cypress project
qa generate-guide -p ./my-project -o ./guides/my-guide.md

# Use the guide to generate code that follows the same conventions
qa generate test -g "login test" --guide ./guides/my-guide.md
qa generate page -g "profile page" --guide ./guides/my-guide.md
qa generate locators -g "nav bar elements" --guide ./guides/my-guide.md

# Chat with the guide as context
qa chat --guide ./guides/my-guide.md
```

The Structure Guide system analyzes an existing project and extracts:
- **Directory structure** — all folders, files, and their relationships
- **Naming conventions** — file patterns for each layer (locators, pages, tests, etc.)
- **Coding patterns** — class-vs-function style, imports, exports
- **Custom Cypress commands** — registered via `Cypress.Commands.add`
- **Output paths** — where each artifact type belongs

Generated code automatically follows the guide's conventions, making it seamless to add tests to large existing projects.

### Interactive QA Chat

```bash
qa chat
qa chat --guide ./guides/my-guide.md    # Chat with project context
```

### Documentation

```bash
qa docs                                        # Generate Markdown + HTML docs
qa docs --confluence --confluence-config ./confluence.json  # Publish to Confluence
qa docs --no-file                              # Print to stdout
```

### Configuration

```bash
qa config      # Configure LLM providers (local + cloud)
qa models      # List available models from the active provider
```

## Available npm Scripts

| Script | Description |
|--------|-------------|
| `npm run frontend` | Start the sample frontend |
| `npm run cy:smoke:all` | Clean → smoke tests → report → serve |
| `npm run cy:regression:all` | Clean → regression tests → report → serve |
| `npm run cy:bdd:all` | Clean → BDD tests → report → serve |
| `npm run test:all` | Run all suites sequentially |
| `npm run serve:smoke` | View smoke Allure report |

## Test Users

| Username | Password | Role |
|----------|----------|------|
| `admin` | `123456` | مدیر سیستم |
| `operator` | `123456` | اپراتور |
| `manager` | `123456` | مدیر پروژه |

## CI/CD

The generated project includes `azure-pipelines.yml` with:
- Node.js setup
- `npm ci` + Cypress binary install
- Frontend server startup
- Test execution with Chrome
- Allure report generation
- Artifact publishing (report, videos, screenshots)

## License

MIT
