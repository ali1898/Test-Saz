# QA Test Generator — Complete Tutorial

An AI-powered CLI tool that scaffolds Cypress projects and generates test artifacts
using LLM providers (local + cloud).

```
  __        __   _        _    ____
  \ \      / /__| |_ __ _| |_ / ___| ___ _ __
   \ \ /\ / / _ \ __/ _` | __| |  _ / _ \ '_ \
    \ V  V /  __/ || (_| | |_| |_| |  __/ | | |
     \_/\_/ \___|\__\__,_|\__|\____|\___|_| |_|
```

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
  - [Provider Setup](#provider-setup)
  - [Provider Comparison](#provider-comparison)
- [Commands](#commands)
  - [`qa new` — Scaffold a Project](#qa-new--scaffold-a-project)
  - [`qa generate` — Generate Tests with AI](#qa-generate--generate-tests-with-ai)
  - [`qa generate-guide` — Create Structure Guides](#qa-generate-guide--create-structure-guides)
  - [`qa chat` — Interactive QA Assistant](#qa-chat--interactive-qa-assistant)
  - [`qa docs` — Generate Documentation](#qa-docs--generate-documentation)
  - [`qa scenario` — Write AI Scenarios](#qa-scenario--write-ai-scenarios)
  - [`qa analyze` — Analyze Live Pages with AI](#qa-analyze--analyze-live-pages-with-ai)
  - [`qa autonomous` — Crawl & Discover Pages](#qa-autonomous--crawl--discover-pages)
  - [`qa hybrid` — Playwright + AI (Best Accuracy)](#qa-hybrid--playwright--ai-best-accuracy)
  - [`qa fix` — Fix Failing Tests with AI](#qa-fix--fix-failing-tests-with-ai)
  - [`qa config` — Manage Providers](#qa-config--manage-providers)
  - [`qa models` — List Available Models](#qa-models--list-available-models)
- [Working with Providers](#working-with-providers)
- [Features](#features)
  - [Network Stubbing](#network-stubbing)
  - [Visual Regression Testing](#visual-regression-testing)
  - [Accessibility Testing](#accessibility-testing)
  - [Test Isolation](#test-isolation)
  - [Self-Healing Tests](#self-healing-tests)
  - [Prompt Engineering](#prompt-engineering)
  - [Pipeline Orchestrator](#pipeline-orchestrator)
- [FAQ & Troubleshooting](#faq--troubleshooting)

---

## Installation

```bash
# Clone or navigate to the project
cd QA-test-generator

# Install dependencies
npm install

# Build the project
npm run build

# Make the CLI available globally (optional)
npm link
```

Now the `qa` command is available:

```bash
qa --version
qa --help
```

To remove the global link later:

```bash
npm run unlink
```

---

## Quick Start

```bash
# 1. Configure an LLM provider
qa config

# 2. Verify connectivity
qa models

# 3. Scaffold a Cypress project
qa new -n my-ecommerce-tests

# 4. Generate tests with AI
cd my-ecommerce-tests
qa generate test -g "verify user can add items to cart and checkout"
qa generate test -g "search with filters" --tier regression

# 5. Learn from existing projects
qa generate-guide -p ./my-ecommerce-tests -o ./guides/my-guide.md
qa generate test --goal "search products" --guide ./guides/my-guide.md

# 6. Chat with the QA assistant
qa chat
qa chat --guide ./guides/my-guide.md
```

---

## Configuration

### Provider Setup

Run `qa config` to enter the interactive configuration menu. You can:

- **Add/edit a provider** — choose the backend LLM service
- **Switch active provider** — change which provider is used for generation
- **Show current configuration** — view saved settings
- **Edit a provider** — modify an existing provider's settings
- **Reset to defaults** — clear all settings

Each provider requires:
- **Model** — the model ID (e.g., `llama3.1`, `gpt-5.4-nano`)
- **Base URL** — API endpoint (for local/OpenAI-compatible servers)
- **API key** — required for cloud providers, optional for local

Configuration is saved to `~/.qa-test-gen/config.json`.

### Provider Comparison

| Provider | ID | Type | API Key | Default Endpoint | Best For |
|---|---|---|---|---|---|
| **Ollama** | `ollama` | Local | No | `http://localhost:11434` | Free local models |
| **LM Studio** | `lmstudio` | Local | Optional | `http://localhost:1234/v1` | Local GUI model server |
| **llama.cpp** | `llamacpp` | Local | Optional | `http://localhost:8080/v1` | Lightweight local inference |
| **OpenRouter** | `openrouter` | Cloud | Yes | `https://openrouter.ai/api/v1` | 200+ models, one API |
| **Google Gemini** | `gemini` | Cloud | Yes | *(Google SDK)* | Gemini models |
| **OpenCode Zen** | `opencode` | Cloud | Yes | `https://opencode.ai/zen/v1` | Curated, tested coding models |
| **OpenAI Providers** | `9router` | Local | Optional | `http://localhost:8000/v1` | OpenAI-compatible local models |

#### Cloud Providers (require API key)

| Provider | Get API Key | Notes |
|---|---|---|
| **OpenRouter** | https://openrouter.ai/keys | Access GPT, Claude, Gemini, Llama, etc. |
| **Google Gemini** | https://aistudio.google.com/app/apikey | Free tier available |
| **OpenCode Zen** | https://opencode.ai/auth | Curated coding models, pay-as-you-go, free models available |

#### Local Providers (no API key needed)

| Provider | Setup |
|---|---|
| **Ollama** | Install from https://ollama.com, run `ollama pull llama3.1`, then `ollama serve` |
| **LM Studio** | Download from https://lmstudio.ai, load a model, enable server on port 1234 |
| **llama.cpp** | Build from https://github.com/ggml-org/llama.cpp, run `llama-server -m model.gguf` |
| **OpenAI Providers** | Run any OpenAI-compatible model via Ollama or llama.cpp server |

---

## Commands

### `qa new` — Scaffold a Project

Creates a complete Cypress project with Page Object Model, BDD support, and
Allure reporting.

```bash
# Interactive mode
qa new

# Non-interactive with flags
qa new --name my-app \
  --path ./projects/my-app \
  --language typescript \
  --bdd \
  --allure \
  --baseUrl https://example.com \
  --install \
  --yes
```

**Options:**

| Flag | Default | Description |
|---|---|---|
| `-n, --name` | `my-cypress-tests` | Project name |
| `-p, --path` | `./<name>` | Target directory |
| `-l, --language` | `typescript` | `typescript` or `javascript` |
| `--bdd / --no-bdd` | `true` | Enable Cucumber BDD |
| `--allure / --no-allure` | `true` | Enable Allure reporter |
| `--baseUrl` | `http://localhost:3000` | Base URL for tests |
| `-d, --description` | `""` | Project description |
| `--install / --no-install` | `true` | Run `npm install` |
| `--llm-wiki` | `false` | Include LLM-Wiki (Structure Guide from reference project for AI generation context) |
| `--scenarios` | `false` | Include sample scenario .md files in scenarios/ |
| `-y, --yes` | — | Skip all prompts |

**Scaffolded structure:**

```
my-app/
├── cypress/
│   ├── e2e/            # Test specs
│   ├── fixtures/       # Test data
│   ├── support/
│   │   ├── pages/      # Page Object classes
│   │   ├── locators/   # Selector constants
│   │   ├── helpers/    # Utility functions
│   │   ├── commands.ts # Custom Cypress commands
│   │   └── e2e.ts      # Global config
│   └── ...             # BDD step defs (if enabled)
├── cypress.config.ts   # Cypress configuration
├── package.json
├── tsconfig.json
└── README.md
```

---

### `qa generate` — Generate Tests with AI

Uses the active LLM provider to generate Cypress artifacts from natural-language
descriptions.

```bash
# Generate a test spec
qa generate test -g "verify user can log out from the dashboard"

# Generate a Page Object
qa generate page -g "checkout page with cart summary and payment form"

# Generate locators
qa generate locators -g "header nav bar links and search box"

# Generate a helper module
qa generate helper -g "generate random credit card numbers for tests"

# Generate BDD feature + step definitions
qa generate bdd -g "user search with filters and sorting"

# Generate locators + page + test in one pass (all artifacts)
qa generate all -g "login page" -u "http://localhost:3000/login"
```

**Artifact types:**

| Type | Description | Output Path |
|---|---|---|---|
| `test` | Cypress spec file | `cypress/e2e/test/smoke/<name>.cy.ts` |
| `page` | Page Object class | `cypress/e2e/pages/<name>Page.ts` |
| `locators` | Selector constants | `cypress/e2e/locators/<name>.ts` |
| `helper` | Utility functions | `cypress/support/helpers/<name>.helper.ts` |
| `command` | Custom Cypress command | `cypress/support/commands.ts` (appended) |
| `bdd` | Feature + Steps | `cypress/e2e/features/<name>.feature` + `cypress/e2e/step-definitions/<name>.steps.ts` |
| `all` | Locators + Page + Test | All three paths above |

**Options:**

| Flag | Description |
|---|---|
| `-g, --goal` | Natural-language description (can also be prompted) |
| `-u, --url` | Page URL to analyze (provides AI context) |
| `-p, --project-root` | Project root (default: current directory) |
| `--guide` | Path to a Structure Guide markdown file for project conventions |
| `--tier` | Test tier: `smoke` (default) or `regression` |
| `--scenario` | Pre-written scenario in Markdown (skips Phase 0, 'all' type only) |
| `--scenario-file` | Read scenario from file (skips Phase 0, 'all' type only) |
| `--name` | Override name for file/class naming (instead of deriving from goal) |
| `-y, --yes` | Skip confirmations |

**Using Structure Guides:**

```bash
# 1. Create a guide from an existing project
qa generate-guide -p ./my-big-project -o ./guides/project-guide.md

# 2. Generate code that follows that project's conventions
qa generate test --goal "user login" --guide ./guides/project-guide.md
qa generate page --goal "dashboard" --guide ./guides/project-guide.md
qa generate locators --goal "header and sidebar" --guide ./guides/project-guide.md
```

The guide captures naming conventions (e.g. `{Pascal}Locators.ts`, `{camel}Helper.helper.ts`),
directory layout, custom Cypress commands, and coding patterns — so generated code
blends right in.

**Test Tiers:**

Use `--tier` to place generated tests in the right suite:

```bash
qa generate test -g "quick health check" --tier smoke
qa generate test -g "full user registration flow" --tier regression
```

**Tips:**
- Be specific in your goals: "verify user can reset password with email validation"
  produces better results than "test login"
- The generator knows POM (Page Object Model), BDD, and Cypress best practices
- Output is written directly into your project — review and adjust as needed

---

### `qa generate-guide` — Create Structure Guides

Analyzes an existing Cypress project and generates a **Structure Guide** markdown
file that captures the project's conventions — directory layout, naming patterns,
custom commands, and coding style. Use it to make AI-generated code match your
existing project.

```bash
# Basic: analyze the current directory
qa generate-guide

# Specify project root and output path
qa generate-guide -p ./my-project -o ./guides/my-guide.md

# Override the detected project name
qa generate-guide -p ./my-project -o ./guides/my-guide.md -t "My Custom Project"
```

**Options:**

| Flag | Description |
|---|---|
| `-p, --project-root` | Project root to analyze (default: current directory) |
| `-o, --output` | Output file path (default: `./structure-guide.md`) |
| `-t, --title` | Override detected project name |
| `-y, --yes` | Skip all prompts (use defaults) |

**What the guide captures:**

| Aspect | Example |
|---|---|
| **Directory tree** | Full file listing with folder hierarchy |
| **Naming conventions** | `{Pascal}Locators.ts`, `{camel}Helper.helper.ts`, etc. |
| **Custom Cypress commands** | All `Cypress.Commands.add(...)` calls |
| **Coding patterns** | class-based vs functional style, imports/exports |
| **Output paths** | Where each artifact type belongs |

**Using the guide with other commands:**

```bash
# Generate code that follows the guide's conventions
qa generate test -g "login test" --guide ./guides/my-guide.md
qa generate page -g "profile page" --guide ./guides/my-guide.md

# Chat with project context
qa chat --guide ./guides/my-guide.md
```

---

### `qa chat` — Interactive QA Assistant

Start a conversational session with the QA AI assistant. Supports streaming
responses (tokens appear as they're generated).

```bash
qa chat
```

**Options:**

| Flag | Description |
|---|---|
| `--guide` | Path to a Structure Guide markdown file to use as context |

When a `--guide` is provided, the assistant understands your project's conventions
and can give more contextually accurate advice.

**Slash commands:**

| Command | Description |
|---|---|
| `/help` | Show available commands |
| `/reset` | Clear conversation history |
| `/exit` or `/quit` | Exit the chat |

**Example interaction:**

```
 QA Chat
Provider: OpenCode Zen · gpt-5.4-nano
  Type your question. "/help" for commands, "/exit" to quit.

> What's the best way to test file uploads in Cypress?
< The best approach for file upload testing in Cypress:
  1. Use cy.fixture() to load a test file
  2. Use cy.get('input[type=file]').selectFile() or attachFile()
  3. Assert the upload preview or success message
  ...
```

The chat is QA-focused and understands:
- Cypress testing strategies
- Page Object Model patterns
- BDD/Cucumber best practices
- Test data management
- CI/CD integration for tests

---

### `qa docs` — Generate Documentation

Analyzes an existing Cypress project and generates Markdown + HTML documentation.
Can also publish to Confluence Cloud.

```bash
# Generate docs for current project
qa docs

# Specify project root and output directory
qa docs --project-root ./my-app --output ./docs

# Publish to Confluence (requires config file)
qa docs --confluence --confluence-config .qa-confluence.json
```

**Options:**

| Flag | Description |
|---|---|
| `-p, --project-root` | Project root (default: current directory) |
| `-o, --output` | Output directory (default: `./docs`) |
| `-t, --title` | Custom document title |
| `--confluence` | Publish to Confluence Cloud |
| `--confluence-config` | Path to Confluence config JSON |
| `--no-file` | Skip file output, print to stdout |
| `-y, --yes` | Skip all prompts (use defaults) |

**Confluence config format** (`.qa-confluence.json`):

```json
{
  "domain": "your-domain.atlassian.net",
  "email": "your-email@example.com",
  "apiToken": "your-api-token",
  "spaceKey": "QA",
  "parentId": "123456"
}
```

---

### `qa config` — Manage Providers

Configure, switch, and manage LLM provider settings.

```bash
qa config
```

Interactive menu options:
1. **Add / edit a provider** — set up a new or modify an existing provider
2. **Switch active provider** — change which provider is active
3. **Show current configuration** — display saved config (keys masked)
4. **Edit a provider** — modify an existing provider
5. **Reset to defaults** — clear all settings

**Config file location:** `~/.qa-test-gen/config.json`

**Example config:**

```json
{
  "activeProvider": "opencode",
  "providers": {
    "ollama": {
      "provider": "ollama",
      "model": "llama3.1"
    },
    "opencode": {
      "provider": "opencode",
      "model": "gpt-5.4-nano",
      "apiKey": "oc-..."
    }
  },
  "temperature": 0.3,
  "maxTokens": 2048
}
```

---

### `qa models` — List Available Models

Queries the active provider for available models and displays them. This is also
a useful connectivity check.

```bash
qa models
```

**Example output:**

```
 Available models
Provider: OpenCode Zen · gpt-5.4-nano

  • gpt-5.4-nano
  • gpt-5.4-mini
  • deepseek-v4-flash
  • claude-sonnet-4-5
  • gemini-3-flash

Local: no (cloud)
```

If no models are returned:
- For local providers: ensure your server is running (`ollama serve`, LM Studio, etc.)
- For cloud providers: verify your API key and network connection

---

### `qa scenario` — Write AI Scenarios

Writes test scenarios in the bold-action/element Markdown format and saves them
to `scenarios/*.md`. The interactive loop lets you generate, refine, and save.

```bash
# Interactive — describe → generate → edit loop
qa scenario
```

```
? Describe the scenario you want to write: checkout with coupon
─── Generated Scenario ───
## Scenario: Checkout with Coupon

1. **Visit** /cart
2. **Click** **checkout button**
3. **Type** "SAVE20" into **coupon input**
4. **Click** **apply coupon button**
5. **Assert** **discount message** is visible
6. **Click** **place order button**
──────────────────────────

? What would you like to do?
  Save it
  Refine it — describe what to change
  Regenerate from scratch
  Cancel

? Enter filename (without .md, leave empty for auto): checkout-with-coupon

  ✔ Scenario saved: scenarios/checkout-with-coupon.md
```

**Non-interactive mode:**

```bash
qa scenario -g "user login with remember me" -y
# → scenarios/user-login-with-remember-me.md

qa scenario -g "search" --guide ./guides/my-guide.md -y
```

**Use with `qa generate all`:**

```bash
qa g all -g "checkout" \
  --scenario-file scenarios/checkout-with-coupon.md \
  -u "http://localhost:3000" \
  --name "Checkout"
```

This skips Phase 0 and uses your approved scenario directly.

---

### `qa analyze` — Analyze Live Pages with AI

Analyzes a live web page via Playwright and generates test artifacts (locators, page object, test spec). Supports authentication and scenario-based generation for focused artifacts.

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

**Interactive flow:**

```
? Enter the page URL to analyze: http://app.example.com/dashboard
? Does this page require authentication? yes
? Login page URL: http://app.example.com/login
? Username: admin
? Password: ****
? Username field selector (optional): [formcontrolname="username"]
? Password field selector (optional): [formcontrolname="password"]
? Login button selector (optional): [data-cy="login"]
? Wait for selector after login (optional):
? Do you have a scenario file? (y/n): y
? Scenario file path: scenarios/dashboard.md
? Override name: Dashboard
? Test tier: Smoke
```

**Key options:**

| Option | Description |
|--------|-------------|
| `-u, --url <url>` | Page URL to analyze |
| `--login-url <url>` | Login page URL (for authenticated pages) |
| `--username <text>` | Username/email for login |
| `--password <text>` | Password for login |
| `--scenario-file <path>` | Scenario file for focused generation |
| `--scenario <text>` | Inline scenario text |
| `--name <name>` | Override file/class naming |
| `--debug` | Enable debug output |

**Scenario-based vs. full analysis:**

- Without scenario: Generates artifacts for ALL detected elements (can be bloated)
- With scenario: Generates ONLY the locators, page methods, and test steps needed for the scenario (focused and clean)

---

### `qa autonomous` — Crawl & Discover Pages

Crawl a website to discover pages for autonomous test generation. Uses Playwright
to navigate, follow links, and extract page metadata.

```bash
# Interactive mode — prompts for base URL and depth
qa autonomous

# Non-interactive with flags
qa autonomous --base-url "http://localhost:3000" --depth 2 -y
```

**Options:**

| Flag | Default | Description |
|---|---|---|
| `--base-url` | *(required)* | Base URL to start crawling from |
| `-d, --depth` | `1` | Crawl depth (1-3 levels) |
| `-p, --project-root` | current dir | Project root directory |
| `-y, --yes` | — | Skip prompts, use defaults |

**Example output:**

```
  Autonomous Generation

  base URL:  http://localhost:3000
  depth:     2

  Found 5 pages

  Login
    URL: http://localhost:3000/
    Links: 3, Forms: 1
  Dashboard
    URL: http://localhost:3000/dashboard
    Links: 5, Forms: 0
  Settings
    URL: http://localhost:3000/settings
    Links: 2, Forms: 1
  ...
```

The crawler follows same-origin links only and respects the depth limit. Use this
to discover all pages in your application before generating tests for each one.

---

### `qa hybrid` — Playwright + AI (Best Accuracy)

Combine Playwright DOM analysis with AI generation for the most accurate test artifacts.
This is the recommended approach for generating tests from live pages.

```bash
# Basic usage — analyze page and generate tests
qa hybrid -u "http://localhost:3000/login" -n "LoginPage" -y

# With authentication
qa hybrid -u "http://localhost:3000/dashboard" -n "Dashboard" \
    --login-url "http://localhost:3000/login" \
    --username admin --password secret -y

# With Structure Guide for consistent conventions
qa hybrid -u "http://localhost:3000/checkout" -n "Checkout" \
    --guide ./guides/my-guide.md -y
```

**Options:**

| Flag | Default | Description |
|---|---|---|
| `-u, --url` | *(required)* | Page URL to analyze |
| `-n, --name` | `Page` | Name for page/test (e.g., LoginPage, Dashboard) |
| `-p, --project-root` | current dir | Project root directory |
| `-t, --tier` | `smoke` | Test tier: smoke or regression |
| `--guide` | — | Structure Guide for conventions |
| `--login-url` | — | Login page URL (for authenticated pages) |
| `--username` | — | Username for login |
| `--password` | — | Password for login |
| `-y, --yes` | — | Skip prompts, use defaults |

**How it works:**

1. **Playwright Analysis** — Launches headless Chromium, navigates to the URL, extracts all interactive elements with real DOM selectors (id, name, placeholder, data-cy, CSS)
2. **AI Generation** — Uses LLM to generate:
   - Locators file with accurate selectors from Playwright
   - Page object with typed methods for each element
   - Test spec implementing a comprehensive scenario
3. **Post-Generation Validation** — Automatically fixes mismatches:
   - Locator names match between locators file and page object
   - Method names match between page object and test
   - Abbreviation expansion (Btn→Button, Txt→Text, etc.)

**Example output:**

```
  Hybrid Generation

  URL:      http://localhost:3000/login
  name:     LoginPage
  tier:     smoke
  mode:     Playwright + AI (best accuracy)

  Generated Files

  ✔ cypress/e2e/locators/loginPageLocators.ts
  ✔ cypress/e2e/pages/loginPagePage.ts
  ✔ cypress/e2e/test/smoke/loginPage.cy.ts
```

**vs. other commands:**

| Command | Selector Source | Test Quality | Best For |
|---------|----------------|--------------|----------|
| `qa auto` | LLM guessed | LLM full test | Quick exploration |
| `qa analyze` | Playwright real | Stub only | Element discovery |
| `qa hybrid` | Playwright real | LLM full test | **Production tests** |

---

### `qa fix` — Fix Failing Tests with AI

Analyze a failing Cypress test and get an AI-suggested fix. Reads the test code
and error context, then uses the LLM to suggest corrected code.

```bash
# Interactive mode — prompts for error message and stack trace
qa fix --test cypress/e2e/test/smoke/login.cy.ts

# With a failure report file (extracts error automatically)
qa fix --test cypress/e2e/test/smoke/login.cy.ts \
    --report ./cypress/results/output.json

# Auto-apply the fix (non-interactive)
qa fix --test cypress/e2e/test/smoke/login.cy.ts -y
```

**Options:**

| Flag | Description |
|---|---|
| `-t, --test` | Path to the failing test file |
| `-r, --report` | Path to test report file (JSON/HTML) for error extraction |
| `-p, --project-root` | Project root (default: current directory) |
| `-y, --yes` | Skip prompts, auto-apply the suggested fix |

**Interactive flow:**

```
? Path to failing test file: cypress/e2e/test/smoke/login.cy.ts
? Error message: AssertionError: Timed out retrying after 5000ms:
  Expected to find element '[data-cy="submit"]', but never did.
? Stack trace (optional): at Context.eval (login.cy.ts:12:5)

  Analyzing failure...

  Suggested fix:

  describe('Login', () => {
    beforeEach(() => {
      cy.visit('/login');
    });

    it('should login with valid credentials', () => {
      cy.get('[data-cy="username"]').type('admin');
      cy.get('[data-cy="password"]').type('123456');
      cy.get('[data-cy="submit-button"]').click();  // Fixed selector
      cy.url().should('include', '/dashboard');
    });
  });

? Apply this fix? Yes
  Fix applied successfully!
```

**Tips:**
- Provide a failure report (`--report`) for automatic error extraction
- Without a report, you'll be prompted for the error message and stack trace
- Review the suggested fix before applying — the AI may suggest different approaches
- Works best with clear, descriptive error messages

---

## Working with Providers

### Switching Between Providers

You can have multiple providers configured and switch between them:

```bash
qa config
# → Select "Switch active provider"
# → Choose from your configured providers
```

This is useful when:
- Testing a new model before committing to it
- Switching between local (free) and cloud (more capable) models
- Comparing output quality between providers

### Running Local Models (No Cost)

The most cost-effective setup:

```bash
# 1. Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull a model
ollama pull llama3.1

# 3. Configure QA Test Generator
qa config
# → Add provider: Ollama, model: llama3.1

# 4. Verify
qa models
```

### Using OpenCode Zen (Curated Coding Models)

```bash
# 1. Get an API key
#    Go to https://opencode.ai/auth, sign in, create API key

# 2. Configure
qa config
# → Add provider: OpenCode Zen
# → Model: gpt-5.4-nano (free tier)
# → Paste your API key

# 3. Verify
qa models
```

OpenCode Zen offers free models (Big Pickle, DeepSeek V4 Flash Free, etc.)
plus pay-as-you-go access to GPT, Claude, Gemini, and more.

### Using OpenAI Providers Locally

```bash
# Via Ollama
ollama pull llama3.1
# Then configure OpenAI Providers in qa config,
# set baseURL to http://localhost:11434/v1

# Via llama.cpp
llama-server -m model.gguf --port 8000
# Then configure OpenAI Providers in qa config,
# keep default baseURL http://localhost:8000/v1
```

### Using OpenRouter

```bash
# 1. Get API key from https://openrouter.ai/keys
# 2. Configure:
qa config
# → Add provider: OpenRouter
# → Model: openai/gpt-4o-mini
# → Paste your API key
```

---

## LLM-Wiki (Built-in Structure Guide)

The **LLM-Wiki** is a pre-built Structure Guide generated from the `siam-qa-automation` reference project. It teaches the AI the exact conventions, naming patterns, directory structure, and coding style of a production Cypress project.

### How it works

When scaffolding a new project with `--llm-wiki`:

```bash
qa new --name my-project --llm-wiki
```

The guide is written as `.qa-guide.md` in the project root. Whenever you run `qa generate` inside that project, the tool **automatically discovers** `.qa-guide.md` (via `findNearestGuide()`) and injects its contents into the LLM system prompt. The generated tests, pages, locators, and helpers will follow the same conventions as the reference project.

### What the LLM-Wiki contains

| Section | Description |
|---------|-------------|
| **Directory Tree** | Complete folder structure of the reference project |
| **Layer Structure** | All layers (locators, pages, tests, helpers, etc.) with file counts |
| **Naming Conventions** | Patterns like `{Pascal}Page.ts`, `{camel}Helper.helper.ts`, `{Pascal}Test.cy.ts` |
| **Coding Patterns** | Class-based POs, singleton export, `getByCy` custom commands, options-based helpers |
| **Custom Commands** | Full list of `Cypress.Commands.add(...)` definitions |
| **Meta (JSON)** | Machine-readable `outputPaths` and `namingPatterns` for automatic path resolution |

### Using in existing projects

You can also add the LLM-Wiki to an existing project by copying the `.qa-guide.md` file into its root, or by running `qa generate-guide -p ./my-project` to create a custom guide from your own project.

---

## Features

### Network Stubbing

Stub API responses for deterministic testing without a live backend.

```typescript
// Stub using fixture data
cy.stubApi('POST /api/auth/login', 'success');
cy.stubApi('GET /api/users', 'failure');

// Manual intercept with custom response
cy.intercept('POST', '/api/orders', {
  statusCode: 201,
  body: { id: 1, status: 'created' }
}).as('createOrder');
```

Stub data is defined in `cypress/fixtures/api-stubs/sample.json`. Edit this file
to add your own API stubs with different scenarios (success, failure, error, etc.).

### Visual Regression Testing

Capture and compare screenshots to detect visual regressions.

```typescript
// Capture a screenshot (creates baseline on first run)
cy.matchScreenshot('login-page');

// Compare with a custom failure threshold
cy.compareScreenshot('dashboard', 0.05);  // 5% tolerance
```

Requires `cypress-image-snapshot`. Install it in your project:

```bash
npm install -D cypress-image-snapshot
```

### Accessibility Testing

Run axe-core checks against WCAG 2.0 AA standards.

```typescript
// Check entire page
cy.checkA11y();

// Check a specific region
cy.checkA11y('.login-form');

// Log detailed violation info
cy.checkA11yForViolations();
```

Requires `cypress-axe` and `axe-core`. Install them:

```bash
npm install -D cypress-axe axe-core
```

### Test Isolation

Commands for clean test state between tests.

```typescript
beforeEach(() => {
  cy.resetDatabase();       // POST /api/test/reset
  cy.clearAllStorage();     // localStorage + sessionStorage + cookies
});

// Seed specific test data
cy.seedDatabase('users');   // Reads from cypress/fixtures/users.json
```

### Self-Healing Tests

Try multiple selectors to find elements, making tests resilient to UI changes.

```typescript
// Try primary selector, fall back to alternatives
cy.getHealed('[data-cy="submit"]', ['#submit-btn', 'button[type="submit"]']);

// Click with self-healing
cy.clickHealed('[data-cy="login-btn"]', ['#login-button']);

// Type with self-healing
cy.typeHealed('[data-cy="email"]', 'user@example.com', ['#email-input']);
```

### Prompt Engineering

The shared prompt system improves generation quality through:

- **Chain-of-thought** — guides the LLM to analyze the scenario step-by-step before generating code
- **Self-critique** — makes the LLM review its output against quality checks
- **Edge cases** — generates additional test cases for boundary conditions, XSS, SQL injection, etc.

These are applied automatically during `qa generate all` and can be used programmatically:

```typescript
import { CHAIN_OF_THOUGHT_PREFIX, SELF_CRITIQUE_SUFFIX, EDGE_CASE_PROMPT } from "@qa-test-generator/core";
```

### Pipeline Orchestrator

The pipeline coordinates multi-stage LLM generation:

```typescript
import { runPipeline, runParallelStages } from "@qa-test-generator/core";

// Sequential: each stage feeds into the next
const results = await runPipeline(stages, initialInput, provider);

// Parallel: run independent stages concurrently
const results = await runParallelStages(stages, inputs, provider);
```

Used by `qa generate all` to chain: scenario → locators → page → test.

---

## FAQ & Troubleshooting

### "Unknown provider" error

You may have an older config file. Reset it:

```bash
qa config
# → Reset to defaults
```

### Connection refused / fetch failed

For local providers, ensure the server is running:

```bash
# Ollama
ollama serve

# LM Studio
# Open LM Studio → enable local server on port 1234

# llama.cpp
llama-server -m your-model.gguf
```

### "API key required" error

Cloud providers require an API key. Run `qa config` and add the key, or set it
when prompted during configuration.

### Which provider should I use?

| Your Situation | Recommended Provider |
|---|---|
| Free, offline, privacy-focused | Ollama with llama3.1 or mistral |
| Best quality, pay-as-you-go | OpenCode Zen (curated models) |
| Access GPT / Claude / all models | OpenRouter |
| Google ecosystem | Gemini (free tier available) |
| Running OpenAI-compatible local models | OpenAI Providers (local) |
| Desktop GUI + local models | LM Studio |
| Lightweight CLI server | llama.cpp |

### Temperature and Max Tokens

These settings affect generation quality:
- **Temperature** (0.0–2.0, default 0.3): Lower = more deterministic, higher = more
  creative. For test generation, 0.2–0.3 is recommended.
- **Max Tokens** (default 2048): Maximum response length. Increase for complex
  test files, decrease for simple helpers.

Edit these directly in `~/.qa-test-gen/config.json`.

### "How do I use an existing project's conventions?"

Create a Structure Guide from your project, then use `--guide` when generating:

```bash
qa generate-guide -p ./my-project -o ./guides/my-guide.md
qa generate test -g "new feature test" --guide ./guides/my-guide.md
qa chat --guide ./guides/my-guide.md
```

The guide tells the AI about your naming conventions, folder structure, custom
commands, and coding patterns — so generated code blends right in.

### "What's the difference between smoke and regression tests?"

- **Smoke tests** (`--tier smoke`, default): quick sanity checks that verify
  critical paths work. Fast to run, covering happy paths only.
- **Regression tests** (`--tier regression`): comprehensive tests covering edge
  cases, error states, and detailed scenarios.

Use `--tier` when generating to place tests in the right folder:

```bash
qa generate test -g "quick login check" --tier smoke
qa generate test -g "login with invalid credentials" --tier regression
```

### Output seems wrong or low quality

1. Try a different model (larger models generally produce better code)
2. Be more specific in your goal description
3. Lower the temperature for more deterministic results
4. Review and manually edit the generated output — it's a starting point

### How do I contribute a new provider?

See `packages/core/src/llm/`:
1. Create your provider class in a new file or add to `providers-openai-like.ts`
2. Add the `ProviderId` to the union in `types.ts`
3. Add a case in `provider-factory.ts`
4. Add to the Zod enum in `config/schema.ts`
5. Add defaults in `config/store.ts`
6. Export from `index.ts`
7. Add CLI labels/defaults in `packages/cli/src/commands/config.ts`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    @qa-test-generator/cli               │
│  ┌──────┐ ┌──────────┐ ┌──────┐ ┌──────┐ ┌─────────┐  │
│  │ new  │ │ generate │ │ chat │ │ docs │ │ config  │  │
│  └──┬───┘ └────┬─────┘ └──┬───┘ └──┬───┘ └────┬────┘  │
│     │          │          │        │          │        │
└─────┼──────────┼──────────┼────────┼──────────┼────────┘
      │          │          │        │          │
┌─────┼──────────┼──────────┼────────┼──────────┼────────┐
│     ▼          ▼          ▼        ▼          ▼        │
│                  @qa-test-generator/core               │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │  Config  │  │  LLM     │  │  Generator + Chat +  │  │
│  │  (Zod)   │──▶ Factory  │──▶ Docs Engines         │  │
│  └──────────┘  └────┬─────┘  └──────────────────────┘  │
│                     │                                   │
│          ┌──────────┼──────────┐                        │
│          ▼          ▼          ▼                        │
│  ┌───────────┐ ┌─────────┐ ┌───────────┐               │
│  │ Ollama    │ │ Gemini  │ │ OpenAI-   │               │
│  │ Provider  │ │Provider │ │ Compatible│               │
│  └───────────┘ └─────────┘ │ (Base)    │               │
│                            └─────┬─────┘               │
│              ┌───────────────────┼─────────────────┐   │
│              ▼                   ▼                  ▼   │
│  ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌───────────┐  │
│  │ LMStudio │ │llama.cpp│ │OpenRouter│ │OpenCode   │  │
│  └──────────┘ └─────────┘ └──────────┘ │Zen        │  │
│                                        └───────────┘  │
│                              ┌───────────────────┐     │
│                              │OpenAI Providers(local)    │     │
│                              └───────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

---

## Advanced: Using the Core Library Programmatically

You can use `@qa-test-generator/core` directly in your Node.js scripts:

```typescript
import { createProvider, loadConfig, generateTest } from "@qa-test-generator/core";

// Load config and get active provider
const config = loadConfig();
const provider = createProvider(config.providers[config.activeProvider]);

// List models
const models = await provider.listModels();
console.log(models);

// Chat with the provider
const result = await provider.chat([
  { role: "user", content: "What's the best Cypress pattern?" }
], { systemPrompt: "You are a QA expert.", temperature: 0.3 });
console.log(result.content);
```

---

## License

MIT
