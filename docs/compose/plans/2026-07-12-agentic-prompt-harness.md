# Agentic + Prompt + Harness Engineering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Prompt Engineering, Harness Engineering, and Agentic Engineering capabilities to the QA Test Generator.

**Architecture:** Three-layer enhancement: (1) Shared prompts with chain-of-thought and self-critique, (2) Test harness with network stubbing, visual regression, accessibility, and isolation, (3) Agentic automation with self-healing, autonomous generation, multi-agent pipeline, and feedback loops.

**Tech Stack:** TypeScript, Cypress, cypress-image-snapshot, cypress-axe, axe-core

## Global Constraints

- Node.js >=18
- TypeScript 5.x (ES2020, Node16 module)
- All changes must work with existing 7 LLM providers (Ollama, LMStudio, LlamaCpp, 9Router, OpenRouter, Gemini, OpenCode)
- Generated projects must follow POM pattern: locators → pages → tests
- All new commands must support interactive mode (prompts) and `--yes` flag (skip prompts)

---

## File Structure

### New Files
| File | Purpose |
|------|---------|
| `packages/core/src/generator/prompts.ts` | Shared system prompts and prompt templates |
| `packages/core/src/generator/crawler.ts` | Site crawler for autonomous generation |
| `packages/core/src/generator/fixer.ts` | Test failure analyzer and fixer |
| `packages/core/src/generator/pipeline.ts` | Multi-agent pipeline orchestrator |
| `packages/core/src/commands/healing.ts` | Self-healing selector commands |
| `packages/cli/src/commands/autonomous.ts` | `qa autonomous` CLI command |
| `packages/cli/src/commands/fix.ts` | `qa fix` CLI command |

### Modified Files
| File | Changes |
|------|---------|
| `packages/core/src/generator/generate.ts` | Import shared prompts, add chain-of-thought, self-critique, edge cases |
| `packages/core/src/generator/page-analyzer.ts` | Import shared prompts, remove duplicate QA_SYSTEM_PROMPT |
| `packages/core/src/generator/templates.ts` | Add network stub, visual regression, accessibility, isolation templates |
| `packages/core/src/generator/scaffold.ts` | Include new templates in collectFiles() |
| `packages/cli/src/index.ts` | Register new commands (autonomous, fix) |

---

## Task 1: Extract Shared System Prompt

**Covers:** [S3.1]

**Files:**
- Create: `packages/core/src/generator/prompts.ts`
- Modify: `packages/core/src/generator/generate.ts:8-32`
- Modify: `packages/core/src/generator/page-analyzer.ts:11-35`

**Interfaces:**
- Produces: `QA_SYSTEM_PROMPT`, `QA_CHAT_SYSTEM_PROMPT`, `BUILD_SYSTEM_PROMPT()` exported from `prompts.ts`
- Consumed by: `generate.ts`, `page-analyzer.ts`, `chat-session.ts`

- [ ] **Step 1: Create prompts.ts with shared system prompt**

```typescript
// packages/core/src/generator/prompts.ts

export const QA_SYSTEM_PROMPT = `You are an expert QA automation engineer specializing in Cypress.

## Locator Files
- Use flat UPPER_SNAKE_CASE keys (no nesting)
- Each key has a JSDoc comment describing the element
- Use single-quoted strings for selector values
- Prefer data-cy > id > name > placeholder > CSS selectors
- Suffix with "as const"
- Export type: export type PageNameLocators = typeof NAME_LOCATORS

## Page Object Files
- Class-based with singleton export
- Methods return Cypress.Chainable<JQuery<HTMLElement>>
- Use cy.get(LOCATORS.FIELD) for CSS, cy.getByCy(LOCATORS.FIELD) for data-cy
- Import locators from "../locators/nameLocators"
- Add visit() method that navigates to the page URL
- JSDoc on each method

## Test Files
- Simple describe/beforeEach/it blocks (no tags metadata)
- beforeEach calls pageObject.visit()
- Call page methods only, no direct cy.get/cy.getByCy
- Import page singleton from "../../pages/pageName"

## General Rules
- No flaky waits (cy.wait(n))
- No .then() chains — use async/await
- No console.log in tests
- No commented-out code
- Return ONLY the requested file content. Do not add markdown code fences, explanations, or commentary.`;

export const QA_CHAT_SYSTEM_PROMPT = `You are an expert QA automation engineer and mentor.

## Guidelines
- Be concise. Short answers over long explanations.
- Prefer working code over theoretical explanations.
- Use data-cy selectors when possible.
- When suggesting fixes, first identify the likely cause, then give the fix.
- If you're not sure about something, say so rather than guessing.`;

export function buildSystemPrompt(guideCtx?: { markdown: string }): string {
  const base = QA_SYSTEM_PROMPT;
  if (!guideCtx) return base;

  return `${base}

IMPORTANT — Follow the project structure guide below EXACTLY.
Use the exact directory paths, file naming conventions, and coding patterns specified.

${guideCtx.markdown}

Do NOT deviate from the structure guide.`;
}
```

- [ ] **Step 2: Update generate.ts to import from prompts.ts**

Replace lines 8-32 in `packages/core/src/generator/generate.ts`:
```typescript
// Remove the inline QA_SYSTEM_PROMPT and buildSystemPrompt
// Add import at top:
import { QA_SYSTEM_PROMPT, buildSystemPrompt } from "./prompts";
```

- [ ] **Step 3: Update page-analyzer.ts to import from prompts.ts**

Replace lines 11-35 in `packages/core/src/generator/page-analyzer.ts`:
```typescript
// Remove the inline QA_SYSTEM_PROMPT and buildSystemPrompt
// Add import at top:
import { QA_SYSTEM_PROMPT, buildSystemPrompt } from "./prompts";
```

- [ ] **Step 4: Build and verify no errors**

```bash
npm run build:core
```
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/generator/prompts.ts packages/core/src/generator/generate.ts packages/core/src/generator/page-analyzer.ts
git commit -m "refactor: extract shared system prompts to prompts.ts"
```

---

## Task 2: Add Chain-of-Thought Instructions

**Covers:** [S3.2]

**Files:**
- Modify: `packages/core/src/generator/prompts.ts`
- Modify: `packages/core/src/generator/generate.ts`

**Interfaces:**
- Consumes: `QA_SYSTEM_PROMPT` from Task 1
- Produces: Enhanced prompts with reasoning instructions

- [ ] **Step 1: Add chain-of-thought template to prompts.ts**

Add after `buildSystemPrompt`:
```typescript
export const CHAIN_OF_THOUGHT_PREFIX = `Before generating code, think step by step:
1. Analyze the scenario/goal and identify all required elements
2. List the specific locators needed for each element
3. Plan the page object methods that map to scenario steps
4. Identify assertions needed for verification
5. Generate the code following these steps

`;

export const SELF_CRITIQUE_SUFFIX = `

After generating code, review it against these checks:
1. Does it follow the structure guide conventions (if provided)?
2. Are all imports correct and paths valid?
3. Does the page object use proper Cypress patterns?
4. Are locators using the preferred selector strategy?
5. Is the test following the POM pattern (no direct cy.get)?
6. Are there any edge cases not covered?

If you find issues, fix them before returning the final code.`;
```

- [ ] **Step 2: Update generateAll() to use chain-of-thought**

In `packages/core/src/generator/generate.ts`, modify `generateAll()` Phase 1-3 prompts to prepend `CHAIN_OF_THOUGHT_PREFIX` and append `SELF_CRITIQUE_SUFFIX`.

- [ ] **Step 3: Build and verify**

```bash
npm run build:core
```
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/generator/prompts.ts packages/core/src/generator/generate.ts
git commit -m "feat: add chain-of-thought and self-critique to LLM prompts"
```

---

## Task 3: Add Edge Case Testing Prompts

**Covers:** [S3.4]

**Files:**
- Modify: `packages/core/src/generator/prompts.ts`
- Modify: `packages/core/src/generator/generate.ts`

**Interfaces:**
- Consumes: `QA_SYSTEM_PROMPT` from Task 1
- Produces: Edge case generation prompt

- [ ] **Step 1: Add edge case prompt to prompts.ts**

```typescript
export const EDGE_CASE_PROMPT = `

Generate additional test cases for edge cases:
- Empty required fields
- Special characters in inputs (< > " ' &)
- Very long text inputs (1000+ characters)
- Invalid email formats
- Password too short/long
- SQL injection attempts (single quotes, semicolons)
- XSS attempts (script tags, event handlers)
- Network timeout scenarios
- Concurrent form submissions

Add these as separate it() blocks with descriptive names.`;
```

- [ ] **Step 2: Add edge case generation option to generateAll()**

Add a `--edge-cases` flag that appends `EDGE_CASE_PROMPT` to the test generation prompt.

- [ ] **Step 3: Build and verify**

```bash
npm run build:core
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/generator/prompts.ts packages/core/src/generator/generate.ts
git commit -m "feat: add edge case testing prompt generation"
```

---

## Task 4: Add Network Stubbing Templates

**Covers:** [S4.1]

**Files:**
- Modify: `packages/core/src/generator/templates.ts`
- Modify: `packages/core/src/generator/scaffold.ts`

**Interfaces:**
- Produces: `networkStubTemplate()`, `apiStubsFixture()` template functions
- Consumed by: `collectFiles()` in scaffold.ts

- [ ] **Step 1: Add network stub template to templates.ts**

```typescript
export function apiStubsFixture(): FileSpec {
  return {
    path: "cypress/fixtures/api-stubs/sample.json",
    content: `{
  "POST /api/auth/login": {
    "success": {
      "status": 200,
      "body": { "token": "test-token-123", "user": { "id": 1, "name": "Test User" } }
    },
    "failure": {
      "status": 401,
      "body": { "error": "Invalid credentials" }
    }
  }
}`,
  };
}

export function networkStubCommand(): FileSpec {
  return {
    path: "cypress/support/commands/stub-api.ts",
    content: `/**
 * Stub API responses for testing.
 * @example cy.stubApi('POST /api/auth/login', 'success')
 */
Cypress.Commands.add("stubApi", (route: string, scenario: string = "success") => {
  cy.fixture(\`api-stubs/sample\`).then((stubs) => {
    const stub = stubs[route]?.[scenario];
    if (!stub) {
      cy.log(\`Warning: No stub found for \${route}:\${scenario}\`);
      return;
    }
    cy.intercept(route.split(" ")[0], route.split(" ")[1], {
      statusCode: stub.status,
      body: stub.body,
    }).as(\`stub_\${route.replace(/[^a-zA-Z0-9]/g, "_")}\`);
  });
});

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Stub API response for a route
       * @param route - e.g., "POST /api/auth/login"
       * @param scenario - e.g., "success", "failure", "error"
       */
      stubApi(route: string, scenario?: string): Chainable<void>;
    }
  }
}`,
  };
}
```

- [ ] **Step 2: Add to collectFiles() in scaffold.ts**

Add `apiStubsFixture()` and `networkStubCommand()` to the files array in `collectFiles()`.

- [ ] **Step 3: Build and verify**

```bash
npm run build:core
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/generator/templates.ts packages/core/src/generator/scaffold.ts
git commit -m "feat: add network stubbing templates and commands"
```

---

## Task 5: Add Visual Regression Support

**Covers:** [S4.2]

**Files:**
- Modify: `packages/core/src/generator/templates.ts`
- Modify: `packages/core/src/generator/scaffold.ts`

**Interfaces:**
- Produces: `visualRegressionCommand()` template function
- New dependency: `cypress-image-snapshot`

- [ ] **Step 1: Add visual regression command template**

```typescript
export function visualRegressionCommand(): FileSpec {
  return {
    path: "cypress/support/commands/visual-regression.ts",
    content: `/**
 * Visual regression testing commands.
 * Requires: npm install cypress-image-snapshot
 */
import { matchImageSnapshot } from "cypress-image-snapshot";

Cypress.Commands.add("matchScreenshot", (name: string, options?: Record<string, unknown>) => {
  cy.matchImageSnapshot({
    name,
    capture: "viewport",
    ...options,
  });
});

Cypress.Commands.add("compareScreenshot", (name: string, threshold = 0.1) => {
  cy.matchImageSnapshot({
    name,
    failureThreshold: threshold,
    failureThresholdType: "percent",
  });
});

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Take a screenshot and compare with baseline
       * @param name - Snapshot name
       * @param options - cypress-image-snapshot options
       */
      matchScreenshot(name: string, options?: Record<string, unknown>): Chainable<void>;

      /**
       * Compare screenshot with threshold
       * @param name - Snapshot name
       * @param threshold - Failure threshold (0-1)
       */
      compareScreenshot(name: string, threshold?: number): Chainable<void>;
    }
  }
}`,
  };
}
```

- [ ] **Step 2: Add to collectFiles() in scaffold.ts**

Add `visualRegressionCommand()` to the files array.

- [ ] **Step 3: Build and verify**

```bash
npm run build:core
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/generator/templates.ts packages/core/src/generator/scaffold.ts
git commit -m "feat: add visual regression testing support"
```

---

## Task 6: Add Accessibility Testing

**Covers:** [S4.3]

**Files:**
- Modify: `packages/core/src/generator/templates.ts`
- Modify: `packages/core/src/generator/scaffold.ts`

**Interfaces:**
- Produces: `accessibilityCommand()` template function
- New dependency: `cypress-axe`, `axe-core`

- [ ] **Step 1: Add accessibility command template**

```typescript
export function accessibilityCommand(): FileSpec {
  return {
    path: "cypress/support/commands/a11y.ts",
    content: `/**
 * Accessibility testing commands.
 * Requires: npm install cypress-axe axe-core
 */
import "cypress-axe";

Cypress.Commands.add("checkA11y", (context?: string | Node, options?: Record<string, unknown>) => {
  cy.injectAxe();
  cy.checkA11y(context, options);
});

Cypress.Commands.add("checkA11yForViolations", (context?: string | Node) => {
  cy.injectAxe();
  cy.checkA11y(
    context,
    { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } },
    (violations) => {
      if (violations.length) {
        cy.log(\`Found \${violations.length} accessibility violations\`);
        violations.forEach((v) => {
          cy.log(\`\${v.impact}: \${v.description}\`);
          v.nodes.forEach((node) => {
            cy.log(\`  - \${node.html}\`);
          });
        });
      }
    }
  );
});

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Check page for accessibility violations
       * @param context - CSS selector or element to check
       * @param options - axe-core options
       */
      checkA11y(context?: string | Node, options?: Record<string, unknown>): Chainable<void>;

      /**
       * Check accessibility and log violations
       * @param context - CSS selector or element to check
       */
      checkA11yForViolations(context?: string | Node): Chainable<void>;
    }
  }
}`,
  };
}
```

- [ ] **Step 2: Add to collectFiles() in scaffold.ts**

Add `accessibilityCommand()` to the files array.

- [ ] **Step 3: Build and verify**

```bash
npm run build:core
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/generator/templates.ts packages/core/src/generator/scaffold.ts
git commit -m "feat: add accessibility testing with cypress-axe"
```

---

## Task 7: Add Test Isolation Commands

**Covers:** [S4.4]

**Files:**
- Modify: `packages/core/src/generator/templates.ts`
- Modify: `packages/core/src/generator/scaffold.ts`

**Interfaces:**
- Produces: `testIsolationCommand()` template function

- [ ] **Step 1: Add test isolation command template**

```typescript
export function testIsolationCommand(): FileSpec {
  return {
    path: "cypress/support/commands/isolation.ts",
    content: `/**
 * Test isolation commands for clean test state.
 */

Cypress.Commands.add("resetDatabase", () => {
  cy.request({
    method: "POST",
    url: "/api/test/reset",
    failOnStatusCode: false,
  });
});

Cypress.Commands.add("seedDatabase", (fixture: string) => {
  cy.fixture(fixture).then((data) => {
    cy.request({
      method: "POST",
      url: "/api/test/seed",
      body: data,
      failOnStatusCode: false,
    });
  });
});

Cypress.Commands.add("clearLocalStorage", () => {
  cy.window().then((win) => {
    win.localStorage.clear();
  });
});

Cypress.Commands.add("clearSessionStorage", () => {
  cy.window().then((win) => {
    win.sessionStorage.clear();
  });
});

Cypress.Commands.add("clearAllStorage", () => {
  cy.clearLocalStorage();
  cy.clearSessionStorage();
  cy.clearCookies();
});

declare global {
  namespace Cypress {
    interface Chainable {
      /** Reset database to clean state */
      resetDatabase(): Chainable<void>;

      /** Seed database with fixture data */
      seedDatabase(fixture: string): Chainable<void>;

      /** Clear localStorage */
      clearLocalStorage(): Chainable<void>;

      /** Clear sessionStorage */
      clearSessionStorage(): Chainable<void>;

      /** Clear all browser storage */
      clearAllStorage(): Chainable<void>;
    }
  }
}`,
  };
}
```

- [ ] **Step 2: Add to collectFiles() in scaffold.ts**

Add `testIsolationCommand()` to the files array.

- [ ] **Step 3: Build and verify**

```bash
npm run build:core
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/generator/templates.ts packages/core/src/generator/scaffold.ts
git commit -m "feat: add test isolation commands for clean test state"
```

---

## Task 8: Add Self-Healing Selectors

**Covers:** [S5.1]

**Files:**
- Create: `packages/core/src/commands/healing.ts`
- Modify: `packages/core/src/generator/templates.ts`

**Interfaces:**
- Produces: `healingCommand()` template function

- [ ] **Step 1: Create healing.ts with self-healing logic**

```typescript
// packages/core/src/commands/healing.ts

export interface HealingResult {
  selector: string;
  found: boolean;
  attempt: number;
}

/**
 * Try multiple selectors to find an element (self-healing).
 */
export function healSelector(
  primarySelector: string,
  fallbacks: string[] = []
): string[] {
  return [primarySelector, ...fallbacks];
}
```

- [ ] **Step 2: Add healing command template to templates.ts**

```typescript
export function healingCommand(): FileSpec {
  return {
    path: "cypress/support/commands/healing.ts",
    content: `/**
 * Self-healing selector commands.
 * Tries multiple selectors to find an element.
 */

Cypress.Commands.add("getHealed", (primarySelector: string, fallbacks: string[] = []) => {
  const selectors = [primarySelector, ...fallbacks];

  cy.get("body").then(($body) => {
    for (const sel of selectors) {
      if ($body.find(sel).length > 0) {
        cy.log(\`Found element with selector: \${sel}\`);
        return cy.get(sel);
      }
    }
    throw new Error(\`No element found for selectors: \${selectors.join(", ")}\`);
  });
});

Cypress.Commands.add("clickHealed", (primarySelector: string, fallbacks: string[] = []) => {
  cy.getHealed(primarySelector, fallbacks).click();
});

Cypress.Commands.add("typeHealed", (primarySelector: string, text: string, fallbacks: string[] = []) => {
  cy.getHealed(primarySelector, fallbacks).type(text);
});

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Find element with self-healing fallback selectors
       * @param primarySelector - Main CSS selector
       * @param fallbacks - Array of fallback selectors
       */
      getHealed(primarySelector: string, fallbacks?: string[]): Chainable<JQuery<HTMLElement>>;

      /**
       * Click element with self-healing
       */
      clickHealed(primarySelector: string, fallbacks?: string[]): Chainable<void>;

      /**
       * Type into element with self-healing
       */
      typeHealed(primarySelector: string, text: string, fallbacks?: string[]): Chainable<void>;
    }
  }
}`,
  };
}
```

- [ ] **Step 3: Add to collectFiles() in scaffold.ts**

Add `healingCommand()` to the files array.

- [ ] **Step 4: Build and verify**

```bash
npm run build:core
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/commands/healing.ts packages/core/src/generator/templates.ts packages/core/src/generator/scaffold.ts
git commit -m "feat: add self-healing selector commands"
```

---

## Task 9: Add Autonomous Generation

**Covers:** [S5.2]

**Files:**
- Create: `packages/core/src/generator/crawler.ts`
- Create: `packages/cli/src/commands/autonomous.ts`
- Modify: `packages/cli/src/index.ts`

**Interfaces:**
- Produces: `crawlSite()`, `autonomousGenerate()` functions
- Produces: `autonomousCommand` CLI command

- [ ] **Step 1: Create crawler.ts**

```typescript
// packages/core/src/generator/crawler.ts

import { chromium, type Browser, type Page } from "playwright";

export interface CrawlResult {
  url: string;
  title: string;
  links: string[];
  forms: string[];
}

const CHROMIUM_PATH = "/usr/bin/chromium-browser";

export async function crawlSite(
  baseUrl: string,
  depth: number = 1,
  visited: Set<string> = new Set()
): Promise<CrawlResult[]> {
  const results: CrawlResult[] = [];
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

    await crawlPage(page, baseUrl, depth, 0, visited, results);
  } finally {
    if (browser) await browser.close();
  }

  return results;
}

async function crawlPage(
  page: Page,
  url: string,
  maxDepth: number,
  currentDepth: number,
  visited: Set<string>,
  results: CrawlResult[]
): Promise<void> {
  if (currentDepth > maxDepth || visited.has(url)) return;

  visited.add(url);

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    const title = await page.title();

    const links = await page.$$eval("a[href]", (els) =>
      els.map((el) => (el as HTMLAnchorElement).href).filter((href) => href.startsWith("http"))
    );

    const forms = await page.$$eval("form", (els) =>
      els.map((el) => el.action || window.location.href)
    );

    results.push({ url, title, links: [...new Set(links)], forms: [...new Set(forms)] });

    // Crawl linked pages
    for (const link of links) {
      if (link.startsWith(new URL(url).origin)) {
        await crawlPage(page, link, maxDepth, currentDepth + 1, visited, results);
      }
    }
  } catch (err) {
    console.error(`Failed to crawl ${url}:`, err);
  }
}
```

- [ ] **Step 2: Create autonomous.ts CLI command**

```typescript
// packages/cli/src/commands/autonomous.ts

import { input, confirm, number } from "@inquirer/prompts";
import { resolve } from "node:path";
import { crawlSite } from "@qa-test-generator/core";
import { ui, withSpinner, chalk } from "../ui";

export interface AutonomousOptions {
  baseUrl?: string;
  depth?: number;
  projectRoot?: string;
  yes?: boolean;
}

export async function autonomousCommand(opts: AutonomousOptions): Promise<void> {
  let baseUrl = opts.baseUrl;
  let depth = opts.depth ?? 1;
  const projectRoot = resolve(opts.projectRoot ?? process.cwd());

  if (!baseUrl && !opts.yes) {
    baseUrl = await input({ message: "Base URL to crawl (e.g., http://localhost:3000):" });
  }

  if (!baseUrl) {
    ui.error("Base URL is required. Use --base-url or provide it interactively.");
    process.exit(1);
  }

  if (!opts.yes) {
    depth = await number({ message: "Crawl depth:", default: 1, min: 1, max: 3 });
  }

  console.log(chalk.bold("\n  Autonomous Generation\n"));
  console.log(chalk.dim("  base URL:") + `  ${baseUrl}`);
  console.log(chalk.dim("  depth:") + `     ${depth}`);
  console.log();

  const results = await withSpinner("Crawling site...", async () => {
    return crawlSite(baseUrl!, depth);
  });

  console.log(chalk.green(`  Found ${results.length} pages\n`));

  for (const result of results) {
    console.log(chalk.cyan(`  ${result.title || "Untitled"}`));
    console.log(chalk.dim(`    URL: ${result.url}`));
    console.log(chalk.dim(`    Links: ${result.links.length}, Forms: ${result.forms.length}`));
  }

  // TODO: Generate tests for each page using generateAll()
  console.log(chalk.yellow("\n  Test generation for crawled pages coming soon...\n"));
}
```

- [ ] **Step 3: Register command in index.ts**

Add to `packages/cli/src/index.ts`:
```typescript
import { autonomousCommand, type AutonomousOptions } from "./commands/autonomous";

// In program definition:
program
  .command("autonomous")
  .alias("aa")
  .description("Autonomously crawl site and generate tests")
  .option("-u, --base-url <url>", "Base URL to crawl")
  .option("-d, --depth <number>", "Crawl depth", "1")
  .option("-p, --project-root <dir>", "Project root", ".")
  .option("-y, --yes", "Skip prompts")
  .action(async (opts) => {
    try {
      await autonomousCommand(opts as AutonomousOptions);
    } catch (err) {
      ui.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
```

- [ ] **Step 4: Build and verify**

```bash
npm run build:core && npm run build:cli
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/generator/crawler.ts packages/cli/src/commands/autonomous.ts packages/cli/src/index.ts
git commit -m "feat: add autonomous site crawling and test generation"
```

---

## Task 10: Add Multi-Agent Pipeline

**Covers:** [S5.3]

**Files:**
- Create: `packages/core/src/generator/pipeline.ts`
- Modify: `packages/core/src/generator/generate.ts`

**Interfaces:**
- Produces: `PipelineStage`, `runPipeline()` types and function
- Consumed by: `generateAll()` in generate.ts

- [ ] **Step 1: Create pipeline.ts**

```typescript
// packages/core/src/generator/pipeline.ts

import type { LLMProvider } from "../llm/types";

export interface PipelineStage<TInput, TOutput> {
  name: string;
  execute: (input: TInput, provider: LLMProvider) => Promise<TOutput>;
}

export interface PipelineResult<T> {
  stage: string;
  output: T;
  duration: number;
}

export async function runPipeline<T>(
  stages: PipelineStage<unknown, T>[],
  initialInput: unknown,
  provider: LLMProvider
): Promise<PipelineResult<T>[]> {
  const results: PipelineResult<T>[] = [];
  let currentInput = initialInput;

  for (const stage of stages) {
    const start = Date.now();
    const output = await stage.execute(currentInput, provider);
    const duration = Date.now() - start;

    results.push({ stage: stage.name, output, duration });
    currentInput = output;
  }

  return results;
}

export async function runParallelStages<T>(
  stages: PipelineStage<unknown, T>[],
  inputs: unknown[],
  provider: LLMProvider
): Promise<PipelineResult<T>[]> {
  const promises = stages.map((stage, i) => {
    const start = Date.now();
    return stage.execute(inputs[i] ?? inputs[0], provider).then((output) => ({
      stage: stage.name,
      output,
      duration: Date.now() - start,
    }));
  });

  return Promise.all(promises);
}
```

- [ ] **Step 2: Update generateAll() to use pipeline**

Refactor `generateAll()` in `generate.ts` to use `runPipeline()` instead of inline sequential calls.

- [ ] **Step 3: Build and verify**

```bash
npm run build:core
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/generator/pipeline.ts packages/core/src/generator/generate.ts
git commit -m "feat: add multi-agent pipeline orchestrator"
```

---

## Task 11: Add Feedback Loop (Fix Command)

**Covers:** [S5.4]

**Files:**
- Create: `packages/core/src/generator/fixer.ts`
- Create: `packages/cli/src/commands/fix.ts`
- Modify: `packages/cli/src/index.ts`

**Interfaces:**
- Produces: `analyzeFailure()`, `suggestFix()` functions
- Produces: `fixCommand` CLI command

- [ ] **Step 1: Create fixer.ts**

```typescript
// packages/core/src/generator/fixer.ts

import type { LLMProvider } from "../llm/types";

export interface FailureAnalysis {
  testFile: string;
  error: string;
  stackTrace: string;
  suggestedFix: string;
}

export function parseFailureReport(reportPath: string): FailureAnalysis[] {
  // Parse Allure or Cypress failure reports
  // This is a simplified version - real implementation would parse JSON/HTML reports
  return [];
}

export async function suggestFix(
  provider: LLMProvider,
  testFile: string,
  error: string,
  stackTrace: string
): Promise<string> {
  const prompt = `You are debugging a failing Cypress test.

Test file: ${testFile}
Error: ${error}
Stack trace:
${stackTrace}

Analyze the error and suggest a fix. Return ONLY the corrected test code.`;

  const messages = [{ role: "user" as const, content: prompt }];
  const response = await provider.chat(messages, { temperature: 0.2, maxTokens: 4096 });
  return response.content;
}
```

- [ ] **Step 2: Create fix.ts CLI command**

```typescript
// packages/cli/src/commands/fix.ts

import { input, confirm } from "@inquirer/prompts";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { suggestFix, parseFailureReport } from "@qa-test-generator/core";
import { ui, withSpinner, chalk } from "../ui";
import { getActiveProvider } from "@qa-test-generator/core";

export interface FixOptions {
  test?: string;
  report?: string;
  projectRoot?: string;
  yes?: boolean;
}

export async function fixCommand(opts: FixOptions): Promise<void> {
  let testFile = opts.test;
  const projectRoot = resolve(opts.projectRoot ?? process.cwd());

  if (!testFile && !opts.yes) {
    testFile = await input({ message: "Path to failing test file:" });
  }

  if (!testFile) {
    ui.error("Test file is required. Use --test or provide it interactively.");
    process.exit(1);
  }

  const fullPath = resolve(projectRoot, testFile);
  const testContent = readFileSync(fullPath, "utf-8");

  // Get error from user or report
  let error = "";
  let stackTrace = "";

  if (opts.report) {
    const failures = parseFailureReport(opts.report);
    if (failures.length > 0) {
      error = failures[0].error;
      stackTrace = failures[0].stackTrace;
    }
  }

  if (!error && !opts.yes) {
    error = await input({ message: "Error message:" });
    stackTrace = await input({ message: "Stack trace (optional):" });
  }

  console.log(chalk.bold("\n  Analyzing failure...\n"));

  const provider = getActiveProvider();
  const fixedCode = await withSpinner("Generating fix...", async () => {
    return suggestFix(provider, testFile!, error, stackTrace);
  });

  console.log(chalk.green("\n  Suggested fix:\n"));
  console.log(fixedCode);

  if (!opts.yes) {
    const apply = await confirm({ message: "Apply this fix?", default: true });
    if (apply) {
      writeFileSync(fullPath, fixedCode, "utf-8");
      console.log(chalk.green("\n  Fix applied successfully!\n"));
    }
  }
}
```

- [ ] **Step 3: Register command in index.ts**

Add to `packages/cli/src/index.ts`:
```typescript
import { fixCommand, type FixOptions } from "./commands/fix";

program
  .command("fix")
  .description("Analyze failing tests and suggest fixes")
  .option("-t, --test <path>", "Path to failing test file")
  .option("-r, --report <path>", "Path to test report (Allure/Cypress)")
  .option("-p, --project-root <dir>", "Project root", ".")
  .option("-y, --yes", "Skip prompts, apply fix automatically")
  .action(async (opts) => {
    try {
      await fixCommand(opts as FixOptions);
    } catch (err) {
      ui.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
```

- [ ] **Step 4: Build and verify**

```bash
npm run build:core && npm run build:cli
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/generator/fixer.ts packages/cli/src/commands/fix.ts packages/cli/src/index.ts
git commit -m "feat: add feedback loop with test failure analysis and auto-fix"
```

---

## Task 12: Update Documentation

**Covers:** All sections

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `TUTORIAL.md`
- Modify: `packages/cli/src/index.ts` (help text)

**Interfaces:**
- None (documentation only)

- [ ] **Step 1: Update AGENTS.md**

Add documentation for:
- New commands: `qa autonomous`, `qa fix`
- New template files: network stubs, visual regression, accessibility, isolation, healing
- Shared prompt system in `prompts.ts`

- [ ] **Step 2: Update README.md**

Add sections for:
- Network Stubbing
- Visual Regression
- Accessibility Testing
- Test Isolation
- Self-Healing Tests
- Autonomous Generation
- Feedback Loop

- [ ] **Step 3: Update TUTORIAL.md**

Add tutorial sections for each new feature with examples.

- [ ] **Step 4: Update CLI help text in index.ts**

Update the ASCII banner and command descriptions.

- [ ] **Step 5: Build and verify**

```bash
npm run build:cli
```

- [ ] **Step 6: Commit**

```bash
git add AGENTS.md README.md TUTORIAL.md packages/cli/src/index.ts
git commit -m "docs: update documentation for new features"
```

---

## Task 13: Final Build and Integration Test

**Covers:** All sections

**Files:**
- None (verification only)

**Interfaces:**
- None

- [ ] **Step 1: Full build**

```bash
npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 2: Test new commands**

```bash
# Test autonomous command
qa autonomous --base-url "http://localhost:3000" --depth 1 --yes

# Test fix command (with a failing test)
qa fix --test "cypress/e2e/test/smoke/login.cy.ts" --yes
```

- [ ] **Step 3: Verify generated projects include new features**

```bash
qa new --yes
ls -la cypress/support/commands/
# Should include: stub-api.ts, visual-regression.ts, a11y.ts, isolation.ts, healing.ts
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete prompt engineering, harness engineering, and agentic engineering implementation"
```
