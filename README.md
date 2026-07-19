# 🧪 Testsaz

```
████████ ███████ ███████ ████████ ███████  █████  ███████
   ██    ██      ██         ██    ██      ██   ██     ██
   ██    █████   ███████    ██    ███████ ███████   ██
   ██    ██           ██    ██         ██ ██   ██ ██
   ██    ███████ ███████    ██    ███████ ██   ██ ███████

        AI-Powered Cypress Test Generator v1.0.0
             POM + BDD + Allure + AI
```

AI-Powered Cypress test generator — scaffold projects and generate production-grade tests with Page Object Model, BDD/Cucumber, Allure reporting, and AI assistance.

This monorepo contains two packages:

| Package         | Description                                                                               |
| --------------- | ----------------------------------------------------------------------------------------- |
| `@testsaz/core` | Engine — LLM abstraction, project scaffolding, AI generation, chat, Structure Guide, docs |
| `@testsaz/cli`  | CLI surface — Commander-based interface (`qa new`, `qa generate`, `qa chat`, etc.)        |

## Setup

```bash
git clone <https://github.com/ali1898/Test-Saz.git>
cd QA-test-generator
npm install
npm run build

# Make the CLI available globally (optional)
npm link

# Run the CLI
npm run qa -- --help

# Remove the global link later (when done)
npm run unlink
```

## Quick Start

```bash
# Scaffold a new project
npm run qa -- new -n my-e2e-project -l typescript --bdd --allure --yes

# Scaffold with LLM-Wiki for AI generation that follows reference conventions
npm run qa -- new -n my-e2e-project --llm-wiki

cd my-e2e-project
npm install

# Terminal 1: Start the sample frontend
npm run frontend

# Terminal 2: Run smoke tests
npm run cy:smoke:all
```

> **Note**: On Windows, use `npm run qa` or `node packages/cli/dist/index.js` instead of bare `qa`.

## CLI Commands

### Project Scaffolding

```bash
qa new [options]
```

| Option                     | Description                                               |
| -------------------------- | --------------------------------------------------------- |
| `-n, --name <name>`        | Project name (default: my-cypress-tests)                  |
| `-p, --path <dir>`         | Target directory (default: ./<name>)                      |
| `-l, --language <lang>`    | `typescript` or `javascript` (default: typescript)        |
| `--bdd / --no-bdd`         | Enable Cucumber BDD (default: true)                       |
| `--allure / --no-allure`   | Enable Allure reporter (default: true)                    |
| `--baseUrl <url>`          | Base URL for tests                                        |
| `-d, --description <text>` | Project description                                       |
| `--llm-wiki`               | Include LLM-Wiki (Structure Guide from reference project) |
| `--scenarios`              | Include sample scenario .md files in scenarios/           |
| `--install / --no-install` | Run npm install (default: true)                           |
| `-y, --yes`                | Skip all prompts                                          |

### AI-Assisted Generation

```bash
qa generate <type> [options]

Types: test | page | locators | helper | command | bdd | all
```

| Option                     | Description                                                |
| -------------------------- | ---------------------------------------------------------- |
| `-g, --goal <text>`        | Natural-language description of what to generate           |
| `-u, --url <url>`          | Page URL to analyze (provides AI context)                  |
| `-p, --project-root <dir>` | Project root (default: cwd)                                |
| `--guide <path>`           | Path to a Structure Guide for project conventions          |
| `--tier <tier>`            | Test tier: `smoke` (default) or `regression`               |
| `--scenario <text>`        | Pre-written scenario (skips Phase 0, 'all' type)           |
| `--scenario-file <path>`   | Read scenario from file (skips Phase 0, 'all' type)        |
| `--name <name>`            | Override file/class naming (instead of deriving from goal) |
| `-y, --yes`                | Skip confirmations                                         |

### Scenario Writer

```bash
qa scenario [options]
```

Write and refine AI-generated test scenarios interactively. Saves to `scenarios/*.md` for use with `qa g all --scenario-file`.

| Option                     | Description                                  |
| -------------------------- | -------------------------------------------- |
| `-g, --goal <text>`        | Natural-language description of the scenario |
| `-p, --project-root <dir>` | Project root (default: cwd)                  |
| `--guide <path>`           | Structure Guide for context                  |
| `-y, --yes`                | Skip prompts, use defaults                   |

```bash
# Interactive mode — describe → generate → refine → save
qa scenario

# With flags (non-interactive)
qa scenario -g "checkout with coupon code" -y

# With Structure Guide context
qa scenario --guide ./my-guide.md

# Use with qa generate all
qa g all -g "checkout" --scenario-file scenarios/checkout-with-coupon-code.md -u "http://localhost:3000"
```

### Autonomous Generation

Crawl a website to discover pages for autonomous test generation.

```bash
# Interactive mode
qa autonomous

# With flags
qa autonomous --base-url "http://localhost:3000" --depth 2 -y

# Only pages with forms
qa autonomous --base-url "http://localhost:3000" --forms-only -y

# Regression tier
qa autonomous --base-url "http://localhost:3000" --depth 2 --tier regression -y
```

| Option                     | Description                              |
| -------------------------- | ---------------------------------------- |
| `--base-url <url>`         | Base URL to crawl                        |
| `-d, --depth <number>`     | Crawl depth (1-3, default: 1)            |
| `-p, --project-root <dir>` | Project root (default: cwd)              |
| `--forms-only`             | Only generate tests for pages with forms |
| `-t, --tier <tier>`        | Test tier: smoke (default) or regression |
| `-y, --yes`                | Skip prompts, use defaults               |

The crawler launches headless Chromium via Playwright, follows same-origin links up to the specified depth, and reports discovered pages with their links and forms.

### Hybrid Generation (Best Accuracy)

Combine Playwright DOM analysis with AI generation for the most accurate test artifacts.

```bash
# Basic usage
qa hybrid -u "http://localhost:3000/login" -n "LoginPage" -y

# With authentication
qa hybrid -u "http://localhost:3000/dashboard" -n "Dashboard" \
    --login-url "http://localhost:3000/login" \
    --username admin --password secret -y

# With Structure Guide
qa hybrid -u "http://localhost:3000/checkout" -n "Checkout" \
    --guide ./guides/my-guide.md -y

# Interactive mode — open browser, interact manually, then analyze
qa hybrid -u "http://localhost:3000/login" -n "LoginPage" --interactive

# With pre-defined steps file
qa hybrid -u "http://localhost:3000/dashboard" -n "Dashboard" \
    --steps-file steps/settings.json -y

# With a pre-written scenario (skip Phase 0)
qa hybrid -u "http://localhost:3000/login" -n "LoginPage" \
    --scenario "1. **Visit** /login\n2. **Type** \"admin\" into **username**" -y
```

| Option                               | Description                                                 |
| ------------------------------------ | ----------------------------------------------------------- |
| `-u, --url <url>`                    | Page URL to analyze                                         |
| `-n, --name <name>`                  | Name for page/test (e.g., LoginPage, Dashboard)             |
| `-p, --project-root <dir>`           | Project root (default: cwd)                                 |
| `-t, --tier <tier>`                  | Test tier: smoke (default) or regression                    |
| `--guide <path>`                     | Structure Guide for conventions                             |
| `--login-url <url>`                  | Login page URL (for authenticated pages)                    |
| `--username <text>`                  | Username for login                                          |
| `--password <text>`                  | Password for login                                          |
| `--username-selector <selector>`     | Username field CSS selector                                 |
| `--password-selector <selector>`     | Password field CSS selector                                 |
| `--login-button-selector <selector>` | Login button CSS selector                                   |
| `--wait-for-selector <selector>`     | Selector to wait for after login                            |
| `--interactive`                      | Open browser for manual interaction before analysis         |
| `--steps-file <path>`                | JSON file with pre-defined steps to execute before analysis |
| `--scenario <text>`                  | Pre-written scenario in Markdown (skips Phase 0)            |
| `--scenario-file <path>`             | Read scenario from file (skips Phase 0)                     |
| `-y, --yes`                          | Skip prompts, use defaults                                  |

**How it works:**

1. Playwright extracts real DOM elements with accurate selectors
2. AI generates comprehensive test scenarios
3. Post-generation validation ensures consistency (locator names match, method names match)
4. Abbreviation expansion handles common patterns (Btn→Button, Txt→Text)

### AI Test Fixer

Analyze a failing test and get an AI-suggested fix.

```bash
# Interactive mode (prompts for error + stack trace)
qa fix --test cypress/e2e/test/smoke/login.cy.ts

# With a failure report file
qa fix --test cypress/e2e/test/smoke/login.cy.ts --report ./cypress/results/output.json

# Auto-apply (non-interactive)
qa fix --test cypress/e2e/test/smoke/login.cy.ts -y
```

| Option                     | Description                                               |
| -------------------------- | --------------------------------------------------------- |
| `-t, --test <path>`        | Path to the failing test file                             |
| `-r, --report <path>`      | Path to test report file (JSON/HTML) for error extraction |
| `-p, --project-root <dir>` | Project root (default: cwd)                               |
| `-y, --yes`                | Skip prompts, auto-apply fix                              |

### Page Analyzer (AI-Assisted)

Analyze a live web page and generate test artifacts (locators, page object, test spec). Supports authentication, scenario-based generation, and interactive mode.

```bash
# Interactive mode
qa analyze

# With authentication
qa analyze -u "https://app.example.com/dashboard" \
    --login-url "https://app.example.com/login" \
    --username "admin" --password "secret" \
    --name "Dashboard" -y

# Scenario-based generation (focused artifacts)
qa analyze -u "http://app.example.com/Events/AddMember" \
    --login-url "http://app.example.com/login" \
    --username "user" --password "pass" \
    --scenario-file scenarios/addMember.md \
    --name "AddMember" -y

# Interactive mode — open browser, interact manually, then analyze
qa analyze -u "http://localhost:3000/login" --interactive
```

| Option                               | Description                                                           |
| ------------------------------------ | --------------------------------------------------------------------- |
| `-u, --url <url>`                    | Page URL to analyze                                                   |
| `-p, --project-root <dir>`           | Project root (default: cwd)                                           |
| `-n, --name <name>`                  | Override name for file/class naming                                   |
| `--guide <path>`                     | Structure Guide for conventions                                       |
| `--tier <tier>`                      | Test tier: `smoke` (default) or `regression`                          |
| `--output <type>`                    | What to generate: `all` (default), `locators`, `page`, `test`, `none` |
| `--login-url <url>`                  | Login page URL (for authenticated pages)                              |
| `--username <text>`                  | Username/email for login                                              |
| `--password <text>`                  | Password for login                                                    |
| `--username-selector <selector>`     | Username field CSS selector                                           |
| `--password-selector <selector>`     | Password field CSS selector                                           |
| `--login-button-selector <selector>` | Login button CSS selector                                             |
| `--wait-for-selector <selector>`     | Selector to wait for after login                                      |
| `--scenario <text>`                  | Inline scenario text (generates focused artifacts)                    |
| `--scenario-file <path>`             | Read scenario from file (generates focused artifacts)                 |
| `--scenario-output <path>`           | Save generated scenario to file                                       |
| `--interactive`                      | Open browser for manual interaction before analysis                   |
| `--steps-file <path>`                | JSON file with pre-defined steps to execute before analysis           |
| `--debug`                            | Enable debug output                                                   |
| `-y, --yes`                          | Skip prompts, use defaults                                            |

### Steps File Generator

Generate a JSON steps file for page interactions. Works offline with a local LLM. Use the output with `qa hybrid --steps-file` or `qa analyze --steps-file`.

```bash
# Interactive mode
qa steps

# With flags
qa steps -g "Fill login form and submit" -y

# Custom output path
qa steps -g "Navigate to settings page" -o "steps/settings.json" -y
```

| Option                | Description                                    |
| --------------------- | ---------------------------------------------- |
| `-g, --goal <text>`   | Description of page interactions               |
| `-o, --output <path>` | Output file path (default: `steps/steps.json`) |
| `-y, --yes`           | Skip prompts, use defaults                     |

### Usage Examples

Show detailed usage examples for all commands:

```bash
qa examples
```

### Structure Guide (Learn from Existing Projects)

Analyze an existing Cypress project to extract its conventions, then use the guide to generate code that follows the same patterns.

```bash
# Interactive mode
qa generate-guide

# With flags (non-interactive)
qa generate-guide -p ./my-project -o ./guides/my-guide.md -y

# Generate code using the guide
qa generate test -g "login test" --guide ./guides/my-guide.md
qa generate page -g "profile page" --guide ./guides/my-guide.md
qa generate locators -g "nav bar elements" --guide ./guides/my-guide.md

# Chat with the guide as context
qa chat --guide ./guides/my-guide.md
```

| Option                     | Description                                      |
| -------------------------- | ------------------------------------------------ |
| `-p, --project-root <dir>` | Project root to analyze (default: cwd)           |
| `-o, --output <path>`      | Output file path (default: ./structure-guide.md) |
| `-t, --title <text>`       | Override detected project name                   |
| `-y, --yes`                | Skip all prompts, use defaults                   |

### Interactive QA Chat

```bash
qa chat
qa chat --guide ./guides/my-guide.md   # Include project context
```

### Documentation

```bash
qa docs                                        # Interactive mode
qa docs -y                                     # Use defaults, skip prompts
qa docs --confluence --confluence-config ./confluence.json  # Publish to Confluence
qa docs --no-file                              # Print to stdout only
```

| Option                       | Description                        |
| ---------------------------- | ---------------------------------- |
| `-p, --project-root <dir>`   | Project root (default: cwd)        |
| `-o, --output <dir>`         | Output directory (default: ./docs) |
| `-t, --title <text>`         | Override detected project name     |
| `--confluence`               | Publish to Confluence Cloud        |
| `--confluence-config <path>` | Path to Confluence config JSON     |
| `--no-file`                  | Skip file output (print to stdout) |
| `-y, --yes`                  | Skip all prompts, use defaults     |

### Configuration

```bash
qa config      # Configure LLM providers (local + cloud)
qa models      # List available models from the active provider
```

**Supported providers**: Ollama, LM Studio, llama.cpp, OpenAI Providers, OpenRouter, Gemini, OpenCode Zen.

Config is persisted at `~/.qa-test-gen/config.json`.

### LLM Providers Setup

| Provider         | Type  | Default Port | API Key Required |
| ---------------- | ----- | ------------ | ---------------- |
| Ollama           | Local | 11434        | No               |
| LM Studio        | Local | 1234         | No               |
| llama.cpp        | Local | 8080         | No               |
| OpenAI Providers | Local | 8000         | No               |
| OpenRouter       | Cloud | —            | Yes              |
| Gemini           | Cloud | —            | Yes              |
| OpenCode Zen     | Cloud | —            | Yes              |

## Features

### API Logger

Comprehensive API call logging with beautiful HTML reports. Intercepts all `/api/**` requests and captures full request/response details.

```typescript
// In your test setup (before each test)
cy.setupApiLogging();

// After test — attach logs to Allure on failure
cy.attachApiLogsToAllure();

// Clear logs between tests
cy.clearApiLogs();

// Get logs programmatically
cy.getApiLogs().then((logs) => {
  expect(logs).to.have.length.greaterThan(0);
});

// Watch for API errors
cy.watchApiErrors();
```

Features:

- Intercepts all `/api/**` requests (excludes localhost)
- Captures method, URL, headers (sanitized), request/response bodies, status codes, duration
- Truncates large bodies (max 1000 chars), limits stored calls to 50 (FIFO)
- Generates HTML report with summary cards and collapsible details
- Auto-attaches to Allure on test failure

### Network Stubbing

Stub API responses for deterministic testing without a live backend.

```typescript
// In your test, stub a specific API endpoint
cy.stubApi("POST /api/auth/login", "success"); // Uses fixture data
cy.stubApi("GET /api/users", "failure");

// Cypress intercept with custom response
cy.intercept("POST", "/api/orders", {
  statusCode: 201,
  body: { id: 1, status: "created" },
}).as("createOrder");
```

Stub data is defined in `cypress/fixtures/api-stubs/sample.json`. The `cy.stubApi()` command reads from this fixture and applies `cy.intercept()` automatically.

### Visual Regression Testing

Capture and compare screenshots to detect visual changes.

```typescript
// Capture a full viewport screenshot
cy.matchScreenshot("login-page");

// Compare with a custom threshold
cy.compareScreenshot("dashboard", 0.05);
```

Requires `cypress-image-snapshot`. Commands are defined in `cypress/support/commands/visual-regression.ts`.

### Accessibility Testing

Run axe-core checks against WCAG 2.0 AA standards.

```typescript
// Check entire page for a11y violations
cy.checkA11y();

// Check a specific region
cy.checkA11y(".login-form");

// Check with detailed violation logging
cy.checkA11yForViolations();
```

Requires `cypress-axe` and `axe-core`. Commands are defined in `cypress/support/commands/a11y.ts`.

### Test Isolation

Commands for clean test state between tests.

```typescript
// Reset test database via API
cy.resetDatabase();

// Seed database from a fixture file
cy.seedDatabase("users");

// Clear all browser storage
cy.clearAllStorage();

// Clear individual storage types
cy.clearLocalStorage();
cy.clearSessionStorage();
cy.clearCookies();
```

Commands are defined in `cypress/support/commands/isolation.ts`.

### Self-Healing Tests

Try multiple selectors to find elements, making tests resilient to UI changes.

```typescript
// Try primary selector, fall back to alternatives
cy.getHealed('[data-cy="submit"]', ["#submit-btn", 'button[type="submit"]']);

// Click with self-healing
cy.clickHealed('[data-cy="login-btn"]', ["#login-button"]);

// Type with self-healing
cy.typeHealed('[data-cy="email"]', "user@example.com", ["#email-input"]);
```

The `healSelector()` function from `@testsaz/core` provides the underlying logic. Commands are defined in `cypress/support/commands/healing.ts`.

### Prompt Engineering

The shared prompt system in `prompts.ts` provides:

- **System prompts** — `QA_SYSTEM_PROMPT` for generation, `QA_CHAT_SYSTEM_PROMPT` for chat
- **Chain-of-thought** — `CHAIN_OF_THOUGHT_PREFIX` guides the LLM through step-by-step analysis before code generation
- **Self-critique** — `SELF_CRITIQUE_SUFFIX` makes the LLM review its own output for correctness
- **Edge cases** — `EDGE_CASE_PROMPT` generates additional test cases for boundary conditions, XSS, SQL injection, etc.

### Pipeline Orchestrator

The pipeline in `pipeline.ts` coordinates multi-stage LLM generation:

- **Sequential execution** — `runPipeline()` chains stages where each stage's output feeds the next
- **Parallel execution** — `runParallelStages()` runs independent stages concurrently
- Used by `qa generate all` to chain: scenario → locators → page → test

### Website Crawler

The crawler in `crawler.ts` uses Playwright to:

- Navigate to a base URL and follow same-origin links
- Extract page titles, links, and forms at each depth level
- Report discovered pages for autonomous test generation
- Supports configurable depth (1-3 levels)

### AI Test Fixer

The fixer in `fixer.ts` provides:

- **Failure analysis** — parses error messages and stack traces from test reports
- **Code suggestion** — sends failing test + error context to the LLM for a corrected version
- Used by `qa fix` to interactively analyze and fix failing tests

## Generated Project Structure

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
│   │       ├── smoke/            # Fast sanity checks
│   │       └── regression/       # Full regression suite
│   ├── fixtures/
│   │   └── users.json            # Test user data
│   ├── support/                  # Pages, locators, helpers, commands, types
│   └── utils/
│       └── dataGenerator.ts
├── scripts/                      # Allure, serve, orchestration
├── cypress.config.ts
├── tsconfig.json
├── azure-pipelines.yml
└── package.json
```

POM layers strictly separated: locators → pages → tests.

## Available npm Scripts (in generated project)

| Script                      | Description                               |
| --------------------------- | ----------------------------------------- |
| `npm run frontend`          | Start the sample frontend                 |
| `npm run cy:smoke:all`      | Clean → smoke tests → report → serve      |
| `npm run cy:regression:all` | Clean → regression tests → report → serve |
| `npm run cy:bdd:all`        | Clean → BDD tests → report → serve        |
| `npm run test:all`          | Run all suites sequentially               |
| `npm run serve:smoke`       | View smoke Allure report                  |

## Test Users (in generated project)

| Username   | Password | Role       |
| ---------- | -------- | ---------- |
| `admin`    | `123456` | مدیر سیستم |
| `operator` | `123456` | اپراتور    |
| `manager`  | `123456` | مدیر پروژه |

## CI/CD

The generated project includes `azure-pipelines.yml` with Node.js setup, Cypress binary install, test execution, Allure report generation, and artifact publishing.

## Development

```bash
# Build both packages
npm run build

# Build individually
npm run build:core
npm run build:cli

# Watch mode (CLI only)
npm run dev:cli

# Link the CLI globally (after build)
npm link

# Unlink when done
npm run unlink

qa --help

# Test in a generated project
npm run qa -- new -n my-test-project --yes
cd my-test-project
npm run cy:smoke:all
```

## License

MIT
