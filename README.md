# 🧪 QA Test Generator

A scaffold-and-generate CLI tool for production-grade **Cypress test projects** with Page Object Model, BDD/Cucumber, Allure reporting, and AI-assisted test generation.

This monorepo contains two packages:

| Package                   | Description                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `@qa-test-generator/core` | Engine — LLM abstraction, project scaffolding, AI generation, chat, Structure Guide, docs |
| `@qa-test-generator/cli`  | CLI surface — Commander-based interface (`qa new`, `qa generate`, `qa chat`, etc.)        |

## Setup

```bash
git clone <https://github.com/ali1898/QA-test-generator.git>
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

| Option                     | Description                                        |
| -------------------------- | -------------------------------------------------- |
| `-n, --name <name>`        | Project name (default: my-cypress-tests)           |
| `-p, --path <dir>`         | Target directory (default: ./<name>)               |
| `-l, --language <lang>`    | `typescript` or `javascript` (default: typescript) |
| `--bdd / --no-bdd`         | Enable Cucumber BDD (default: true)                |
| `--allure / --no-allure`   | Enable Allure reporter (default: true)             |
| `--baseUrl <url>`          | Base URL for tests                                 |
| `-d, --description <text>` | Project description                                |
| `--llm-wiki` | Include LLM-Wiki (Structure Guide from reference project) |
| `--scenarios` | Include sample scenario .md files in scenarios/ |
| `--install / --no-install` | Run npm install (default: true) |
| `-y, --yes` | Skip all prompts |

### AI-Assisted Generation

```bash
qa generate <type> [options]

Types: test | page | locators | helper | command | bdd | all
```

| Option                     | Description                                       |
| -------------------------- | ------------------------------------------------- |
| `-g, --goal <text>`        | Natural-language description of what to generate  |
| `-u, --url <url>`          | Page URL to analyze (provides AI context)         |
| `-p, --project-root <dir>` | Project root (default: cwd)                       |
| `--guide <path>`           | Path to a Structure Guide for project conventions |
| `--tier <tier>`            | Test tier: `smoke` (default) or `regression`      |
| `--scenario <text>`        | Pre-written scenario (skips Phase 0, 'all' type) |
| `--scenario-file <path>`   | Read scenario from file (skips Phase 0, 'all' type) |
| `--name <name>`            | Override file/class naming (instead of deriving from goal) |
| `-y, --yes`                | Skip confirmations                                |

### Scenario Writer

```bash
qa scenario [options]
```

Write and refine AI-generated test scenarios interactively. Saves to `scenarios/*.md` for use with `qa g all --scenario-file`.

| Option | Description |
|--------|-------------|
| `-g, --goal <text>` | Natural-language description of the scenario |
| `-p, --project-root <dir>` | Project root (default: cwd) |
| `--guide <path>` | Structure Guide for context |
| `-y, --yes` | Skip prompts, use defaults |

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

### Page Analyzer (AI-Assisted)

Analyze a live web page and generate test artifacts (locators, page object, test spec). Supports authentication and scenario-based generation.

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
```

| Option | Description |
|--------|-------------|
| `-u, --url <url>` | Page URL to analyze |
| `-p, --project-root <dir>` | Project root (default: cwd) |
| `-n, --name <name>` | Override name for file/class naming |
| `--guide <path>` | Structure Guide for conventions |
| `--tier <tier>` | Test tier: `smoke` (default) or `regression` |
| `--output <type>` | What to generate: `all` (default), `locators`, `page`, `test`, `none` |
| `--login-url <url>` | Login page URL (for authenticated pages) |
| `--username <text>` | Username/email for login |
| `--password <text>` | Password for login |
| `--username-selector <selector>` | Username field CSS selector |
| `--password-selector <selector>` | Password field CSS selector |
| `--login-button-selector <selector>` | Login button CSS selector |
| `--wait-for-selector <selector>` | Selector to wait for after login |
| `--scenario <text>` | Inline scenario text (generates focused artifacts) |
| `--scenario-file <path>` | Read scenario from file (generates focused artifacts) |
| `--scenario-output <path>` | Save generated scenario to file |
| `--debug` | Enable debug output |
| `-y, --yes` | Skip prompts, use defaults |

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

| Option | Description |
|--------|-------------|
| `-p, --project-root <dir>` | Project root to analyze (default: cwd) |
| `-o, --output <path>` | Output file path (default: ./structure-guide.md) |
| `-t, --title <text>` | Override detected project name |
| `-y, --yes` | Skip all prompts, use defaults |

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

| Option | Description |
|--------|-------------|
| `-p, --project-root <dir>` | Project root (default: cwd) |
| `-o, --output <dir>` | Output directory (default: ./docs) |
| `-t, --title <text>` | Override detected project name |
| `--confluence` | Publish to Confluence Cloud |
| `--confluence-config <path>` | Path to Confluence config JSON |
| `--no-file` | Skip file output (print to stdout) |
| `-y, --yes` | Skip all prompts, use defaults |

### Configuration

```bash
qa config      # Configure LLM providers (local + cloud)
qa models      # List available models from the active provider
```

**Supported providers**: Ollama, LM Studio, llama.cpp, 9Router, OpenRouter, Gemini, OpenCode Zen.

Config is persisted at `~/.qa-test-gen/config.json`.

### LLM Providers Setup

| Provider     | Type  | Default Port | API Key Required |
| ------------ | ----- | ------------ | ---------------- |
| Ollama       | Local | 11434        | No               |
| LM Studio    | Local | 1234         | No               |
| llama.cpp    | Local | 8080         | No               |
| 9Router       | Local | 8000         | No               |
| OpenRouter   | Cloud | —            | Yes              |
| Gemini       | Cloud | —            | Yes              |
| OpenCode Zen | Cloud | —            | Yes              |

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
