import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getActiveProvider } from "../llm";
import type { ChatMessage, LLMProvider } from "../llm/types";
import { loadStructureGuide, resolveArtifactPath, findNearestGuide } from "./structure-guide";
import type { StructureMeta } from "./structure-guide";
import { QA_SYSTEM_PROMPT, buildSystemPrompt, CHAIN_OF_THOUGHT_PREFIX, SELF_CRITIQUE_SUFFIX, EDGE_CASE_PROMPT } from "./prompts";
import type { CrawlElements } from "./crawler";

export interface GenerateOptions {
  projectRoot: string;
  provider?: LLMProvider;
  /** Path to a Structure Guide markdown file. */
  guide?: string;
  /** Test tier: "smoke" or "regression" */
  tier?: "smoke" | "regression";
  /** URL of the page/feature being tested, for AI context. */
  url?: string;
  /** Pre-written scenario in Markdown (skips Phase 0 LLM generation). */
  scenario?: string;
  /** Override name used for file/class naming (instead of deriving from description). */
  name?: string;
  /** Generate additional edge case tests (empty fields, special chars, injection, etc.). */
  edgeCases?: boolean;
  /** Real DOM elements detected by Playwright (for accurate selectors). */
  detectedElements?: CrawlElements;
}

interface GuideContext {
  meta: StructureMeta;
  markdown: string;
}

function loadGuideContext(guidePath?: string, projectRoot?: string): GuideContext | undefined {
  const path = guidePath ?? (projectRoot ? findNearestGuide(projectRoot) : undefined);
  if (!path) return undefined;
  if (!existsSync(resolve(path))) {
    console.warn(`[qa] Structure guide not found at "${path}", continuing without guide.`);
    return undefined;
  }
  try {
    return loadStructureGuide(path);
  } catch (err) {
    console.warn(`[qa] Failed to load structure guide: ${err}`);
    return undefined;
  }
}

function sanitizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "artifact";
}

function toPascalCase(raw: string): string {
  return raw
    .split(/[-_\s]+/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join("");
}

async function askLlm(
  provider: LLMProvider,
  prompt: string,
  systemPrompt = QA_SYSTEM_PROMPT,
): Promise<string> {
  const messages: ChatMessage[] = [{ role: "user", content: prompt }];
  const result = await provider.chat(messages, {
    systemPrompt,
    temperature: 0.2,
    maxTokens: 4096,
  });
  return stripCodeFences(result.content);
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  return match ? match[1] : trimmed;
}

function writeArtifact(projectRoot: string, relativePath: string, content: string): string {
  const absPath = resolve(projectRoot, relativePath);
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, content + "\n", "utf-8");
  return absPath;
}

export async function generateTest(
  goal: string,
  options: GenerateOptions,
): Promise<{ path: string; content: string }> {
  const provider = options.provider ?? getActiveProvider();
  const guideCtx = loadGuideContext(options.guide, options.projectRoot);
  const systemPrompt = buildSystemPrompt(guideCtx);

  const prompt = `Write a Cypress spec file for the following test goal:
${goal}${options.url ? `\nURL: ${options.url}` : ""}

Use the Page Object Model pattern. Import page singletons from "../../pages/pageName".
Use describe/it blocks (no tags metadata). Include a beforeEach if appropriate.
Use page methods for all interactions. Do NOT use cy.getByCy directly — use page methods only.`;

  const content = await askLlm(provider, prompt, systemPrompt);

  const baseName = sanitizeName(goal);
  const relativePath = guideCtx
    ? resolveArtifactPath(guideCtx.meta, "test", baseName, options.tier)
    : `cypress/e2e/test/${options.tier ?? "smoke"}/${baseName}.cy.ts`;

  const path = writeArtifact(options.projectRoot, relativePath, content);
  return { path, content };
}

export async function generatePage(
  description: string,
  options: GenerateOptions,
): Promise<{ path: string; content: string }> {
  const provider = options.provider ?? getActiveProvider();
  const guideCtx = loadGuideContext(options.guide, options.projectRoot);
  const systemPrompt = buildSystemPrompt(guideCtx);

  const pageName = toPascalCase(description.split(/[-_\s]+/).slice(0, 2).join(" "));

  const prompt = `Write a Cypress Page Object class for the following page:
${description}${options.url ? `\nURL: ${options.url}` : ""}

Import locator constants from "../locators/{PascalCase}Locators".
Export a class with methods for each element/action.
Each method returns Cypress.Chainable<JQuery<HTMLElement>> (or <JQuery<void>> for .click()).
Use cy.get(LOCATORS.Group.Field) for CSS selectors, cy.getByCy(LOCATORS.Group.Field) for data-cy.
Add JSDoc comments on each method.
Also export a singleton: export const camelName = new ClassName();
Do NOT use chaining (return this) for individual actions — return the Cypress chain instead.
Only chain (return this) in combined action methods like login().`;

  const content = await askLlm(provider, prompt, systemPrompt);

  const baseName = sanitizeName(description);
  const relativePath = guideCtx
    ? resolveArtifactPath(guideCtx.meta, "page", pageName || baseName)
    : `cypress/e2e/pages/${baseName}Page.ts`;

  const path = writeArtifact(options.projectRoot, relativePath, content);
  return { path, content };
}

export async function generateLocators(
  description: string,
  options: GenerateOptions,
): Promise<{ path: string; content: string }> {
  const provider = options.provider ?? getActiveProvider();
  const guideCtx = loadGuideContext(options.guide, options.projectRoot);
  const systemPrompt = buildSystemPrompt(guideCtx);

  const prompt = `Write a Cypress locators constants file for the following:
${description}${options.url ? `\nURL: ${options.url}` : ""}

Export a const object in UPPER_SNAKE_CASE with "_LOCATORS" suffix.
Group fields by page section (PascalCase keys), each with a JSDoc comment.
Field values are plain strings: CSS selector (e.g. "[formcontrolname='kind']") or data-cy value (e.g. "login").
Suffix with "as const" and export a type: export type nameLocators = typeof NAME_LOCATORS;
Do NOT use function-style locators. Use flat string values only.`;

  const content = await askLlm(provider, prompt, systemPrompt);

  const baseName = sanitizeName(description);
  const pageName = toPascalCase(description);

  const relativePath = guideCtx
    ? resolveArtifactPath(guideCtx.meta, "locators", pageName || baseName)
    : `cypress/e2e/locators/${baseName}.ts`;

  const path = writeArtifact(options.projectRoot, relativePath, content);
  return { path, content };
}

export async function generateHelper(
  description: string,
  options: GenerateOptions,
): Promise<{ path: string; content: string }> {
  const provider = options.provider ?? getActiveProvider();
  const guideCtx = loadGuideContext(options.guide, options.projectRoot);
  const systemPrompt = buildSystemPrompt(guideCtx);

  const prompt = `Write a Cypress helper/utility module for the following purpose:
${description}${options.url ? `\nURL: ${options.url}` : ""}

Export pure functions only (no side effects, no DOM access unless asked).
Use TypeScript with explicit return types.`;

  const content = await askLlm(provider, prompt, systemPrompt);

  const baseName = sanitizeName(description);
  const relativePath = guideCtx
    ? resolveArtifactPath(guideCtx.meta, "helper", baseName)
    : `cypress/support/helpers/${baseName}.ts`;

  const path = writeArtifact(options.projectRoot, relativePath, content);
  return { path, content };
}

export async function generateBdd(
  description: string,
  options: GenerateOptions,
): Promise<{ paths: string[]; content: string }> {
  const provider = options.provider ?? getActiveProvider();
  const guideCtx = loadGuideContext(options.guide, options.projectRoot);
  const systemPrompt = buildSystemPrompt(guideCtx);

  const featurePrompt = `Write a Cucumber .feature file for the following functionality:
${description}${options.url ? `\nURL: ${options.url}` : ""}

Use Feature/Scenario with Given/When/Then steps in plain English.
Keep scenarios independent and concrete.`;

  const stepsPrompt = `Write Cypress step definitions (TypeScript) using
@badeball/cypress-cucumber-preprocessor Given/When/Then decorators
for these scenarios:
${description}${options.url ? `\nURL: ${options.url}` : ""}

Import page objects from "../pages". Implement each step.`;

  const [featureContent, stepsContent] = await Promise.all([
    askLlm(provider, featurePrompt, systemPrompt),
    askLlm(provider, stepsPrompt, systemPrompt),
  ]);

  const baseName = sanitizeName(description);

  const featurePath = guideCtx
    ? resolveArtifactPath(guideCtx.meta, "bdd", baseName)
    : `cypress/e2e/features/${baseName}.feature`;

  const stepsPath = guideCtx
    ? resolveArtifactPath(guideCtx.meta, "bddSteps", toPascalCase(description) || baseName)
    : `cypress/e2e/step-definitions/${baseName}Steps.ts`;

  const absFeaturePath = writeArtifact(options.projectRoot, featurePath, featureContent);
  const absStepsPath = writeArtifact(options.projectRoot, stepsPath, stepsContent);

  return {
    paths: [absFeaturePath, absStepsPath],
    content: `# Feature\n${featureContent}\n\n# Steps\n${stepsContent}`,
  };
}

function camelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function extractElementsFromScenario(scenario: string): string[] {
  const elements: string[] = [];
  const boldRegex = /\*\*([^*]+)\*\*/g;
  let match;
  const actions = new Set(["visit", "type", "click", "assert", "select", "check", "uncheck", "hover", "scroll", "wait"]);
  while ((match = boldRegex.exec(scenario)) !== null) {
    const word = match[1].trim().toLowerCase();
    if (!actions.has(word) && !elements.includes(match[1].trim())) {
      elements.push(match[1].trim());
    }
  }
  return elements;
}

export async function generateAll(
  description: string,
  options: GenerateOptions,
): Promise<{ paths: string[]; content: string }> {
  const provider = options.provider ?? getActiveProvider();
  const guideCtx = loadGuideContext(options.guide, options.projectRoot);
  const systemPrompt = buildSystemPrompt(guideCtx);

  const namingSrc = options.name || description;
  const baseName = sanitizeName(namingSrc);
  const pageName = toPascalCase(namingSrc);

  // ── Phase 0: Generate a structured step-by-step scenario in Markdown ──────
  let scenario: string;
  if (options.scenario) {
    scenario = options.scenario;
  } else {
    const scenarioPrompt = `You are planning a Cypress test step by step.

Goal: ${description}${options.url ? `\nURL: ${options.url}` : ""}

Output a test scenario in Markdown format. Each step uses **Action** and **Element** in bold.
Follow this format exactly:

## Scenario
1. **Visit** <page>
2. **Type** "<value>" into **<element>**
3. **Click** **<element>**
4. **Assert** **<element>** are visible

Rules:
- Actions: Visit, Type, Click, Assert, Select, Check, Uncheck, Hover, Scroll, Wait
- Put action and element in **bold**
- Put typed values in "double quotes"
- Keep steps concise and focused on test flow
- Do NOT include code fences or extra commentary`;

    scenario = await askLlm(provider, scenarioPrompt, systemPrompt);
  }
  const elements = extractElementsFromScenario(scenario);

  // ── Compute actual file paths ──────────────────────────────────────────────
  const locConstName = `${pageName.toUpperCase()}_LOCATORS`;
  const locRelPath = guideCtx
    ? resolveArtifactPath(guideCtx.meta, "locators", pageName)
    : `cypress/e2e/locators/${baseName}Locators.ts`;
  const pageRelPath = guideCtx
    ? resolveArtifactPath(guideCtx.meta, "page", pageName)
    : `cypress/e2e/pages/${baseName}Page.ts`;
  const testRelPath = guideCtx
    ? resolveArtifactPath(guideCtx.meta, "test", baseName, options.tier)
    : `cypress/e2e/test/${options.tier ?? "smoke"}/${baseName}.cy.ts`;

  const locFileName = locRelPath.split("/").pop()!.replace(/\.ts$/, "");
  const pageFileName = pageRelPath.split("/").pop()!.replace(/\.ts$/, "");
  const testFileNamePrfx = testRelPath.split("/").pop()!.replace(/\.cy\.ts$/, "");

  // Relative import paths between artifact directories:
  // locators/ → pages/ = ../pages/X  (siblings under cypress/e2e/)
  // pages/   → locators/ = ../locators/X
  // test/*/  → pages/ = ../../pages/X
  const locRelImport = `../pages/${pageFileName}`;
  const pageRelImport = `../../pages/${pageFileName}`;

  // ── Phase 1: Generate locators for elements mentioned in the scenario ────
  const elementList = elements.length > 0
    ? `The test scenario needs these elements: ${elements.join(", ")}.
Only generate locators for these specific elements. Do NOT add extra locators.`
    : "Include locators for all interactive elements the page likely has.";

  // Build detected elements context for accurate selectors
  let detectedElementsHint = "";
  if (options.detectedElements) {
    const el = options.detectedElements;
    const parts: string[] = [];
    if (el.buttons.length > 0) parts.push(`Buttons: ${el.buttons.join(", ")}`);
    if (el.inputs.length > 0) parts.push(`Inputs: ${el.inputs.map((i) => `${i.selector} (${i.type}${i.placeholder ? `, placeholder: ${i.placeholder}` : ""})`).join(", ")}`);
    if (el.selects.length > 0) parts.push(`Selects: ${el.selects.join(", ")}`);
    if (el.checkboxes.length > 0) parts.push(`Checkboxes: ${el.checkboxes.join(", ")}`);
    if (el.radios.length > 0) parts.push(`Radios: ${el.radios.join(", ")}`);
    if (el.textareas.length > 0) parts.push(`Textareas: ${el.textareas.join(", ")}`);
    if (parts.length > 0) {
      detectedElementsHint = `
## Detected page elements (use these EXACT selectors):
${parts.join("\n")}

IMPORTANT: Use the selectors listed above exactly as provided. Do NOT invent new selectors.`;
    }
  }

  const locPrompt = `${CHAIN_OF_THOUGHT_PREFIX}You are generating a Cypress locators file for a page.
Page description: ${description}${options.url ? `\nURL: ${options.url}` : ""}

Here is the test scenario that the locators must support:
${scenario}
${detectedElementsHint}

${elementList}

Write a TypeScript constants file. Use these exact export names:
- Export const name: ${locConstName}
- File path: ${locRelPath}

The constant MUST be flat (no nesting). Each field is a top-level key in UPPER_SNAKE_CASE (e.g. SEARCH_INPUT, not SearchInput).
Each field has a JSDoc comment. Field values are plain strings: CSS selector (e.g. "[formcontrolname='kind']") or data-cy value (e.g. "login").
Suffix with "as const" and export a type: export type ${pageName}Locators = typeof ${locConstName};

Example structure (flat, no nesting):
  export const ${locConstName} = {
    /** description */
    SEARCH_INPUT: "selector",
    /** description */
    SEARCH_BUTTON: "selector",
  } as const;

  export type ${pageName}Locators = typeof ${locConstName};
${SELF_CRITIQUE_SUFFIX}`;

  const locContent = await askLlm(provider, locPrompt, systemPrompt);

  const absLocPath = writeArtifact(options.projectRoot, locRelPath, locContent);

  // ── Phase 2: Generate page object with methods that match the scenario ───
  const pageClassName = `${pageName}Page`.replace(/PagePage$/, "Page");
  const pageSingletonName = camelCase(pageClassName);
  const locToPageImport = `../locators/${locFileName}`;

  const pagePrompt = `${CHAIN_OF_THOUGHT_PREFIX}You are generating a Cypress Page Object class in TypeScript.
Page description: ${description}${options.url ? `\nURL: ${options.url}` : ""}

Here is the test scenario this Page Object must support:
${scenario}

Use these exact import and export names:
- Import locators from: "${locToPageImport}"
- The locators export const is: ${locConstName}
- Class name: ${pageClassName}
- Singleton export: export const ${pageSingletonName} = new ${pageClassName}()
- File path: ${pageRelPath}

Each method returns Cypress.Chainable<JQuery<HTMLElement>> (or <JQuery<void>> for .click()).
Use cy.get(LOCATORS.FIELD_NAME) for CSS selectors, cy.getByCy(LOCATORS.FIELD_NAME) for data-cy.
The LOCATORS object is flat (top-level keys only) — do NOT use nested access like LOCATORS.Section.Field.
Add JSDoc comments on each method.
Do NOT chain methods (return this) for individual actions — return the Cypress chain instead.
Only use chaining in combined action methods.

IMPORTANT: Create methods that exactly match the steps in the scenario above.
For example, if the scenario says:
  1. **Type** "car" into **search input**
  2. **Click** **search button**
Then the page MUST have methods: typeInSearchInput(value), clickSearchButton().
${SELF_CRITIQUE_SUFFIX}`;

  const pageContent = await askLlm(provider, pagePrompt, systemPrompt);

  const absPagePath = writeArtifact(options.projectRoot, pageRelPath, pageContent);

  // ── Phase 3: Generate test spec that implements the scenario ──────────────
  const testPrompt = `${CHAIN_OF_THOUGHT_PREFIX}You are generating a Cypress test spec file in TypeScript.

Use these exact import names:
- Import the page singleton from: "${pageRelImport}"
- Import name: import { ${pageSingletonName} } from "${pageRelImport}";

Here is the exact scenario to implement:
${scenario}

Write describe/it blocks (no tags metadata) with ${options.tier === "regression" ? "regression" : "smoke"} tests.
Call page methods in the same order as the scenario steps.
Use page methods for all interactions. Do NOT use cy.getByCy or cy.get directly.${options.edgeCases ? EDGE_CASE_PROMPT : ""}
${SELF_CRITIQUE_SUFFIX}`;

  const testContent = await askLlm(provider, testPrompt, systemPrompt);

  const absTestPath = writeArtifact(options.projectRoot, testRelPath, testContent);

  const summary = `# Generated artifacts for: ${description}

## Scenario
${scenario}

## Locators
${absLocPath}

## Page Object
${absPagePath}

## Test
${absTestPath}
`;

  return {
    paths: [absLocPath, absPagePath, absTestPath],
    content: summary,
  };
}

function appendArtifact(projectRoot: string, relativePath: string, newContent: string): string {
  const absPath = resolve(projectRoot, relativePath);
  mkdirSync(dirname(absPath), { recursive: true });
  const existing = existsSync(absPath) ? readFileSync(absPath, "utf-8") : "";
  const separator = existing.endsWith("\n") ? "" : "\n";
  writeFileSync(absPath, existing + separator + newContent + "\n", "utf-8");
  return absPath;
}

function insertIntoChainable(fileContent: string, entryBlock: string): string {
  const marker = "interface Chainable {";
  const start = fileContent.indexOf(marker);
  if (start === -1) return fileContent + "\n" + entryBlock;

  const blockStart = start + marker.length;
  let depth = 1;
  let pos = blockStart;
  while (depth > 0 && pos < fileContent.length) {
    if (fileContent[pos] === "{") depth++;
    else if (fileContent[pos] === "}") depth--;
    pos++;
  }
  // pos is after the closing }, insert before it
  const insertPos = pos - 1;
  const indented = entryBlock
    .split("\n")
    .map((l) => (l.trim() ? `      ${l}` : l))
    .join("\n");
  return fileContent.slice(0, insertPos) + "\n" + indented + "\n" + fileContent.slice(insertPos);
}

export async function generateCommand(
  description: string,
  options: GenerateOptions,
): Promise<{ paths: string[]; content: string }> {
  const provider = options.provider ?? getActiveProvider();
  const guideCtx = loadGuideContext(options.guide, options.projectRoot);
  const systemPrompt = buildSystemPrompt(guideCtx);

  const prompt = `You are generating a custom Cypress command.

Description: ${description}${options.url ? `\nURL: ${options.url}` : ""}

Output TWO sections separated by the exact line:
===TYPE===

Section 1 — The command implementation with JSDoc comment:
/**
 * <description of the command>
 * @param <name> - <description>
 */
Cypress.Commands.add("<commandName>", (<params>) => {
  // implementation using cy.get(), cy.request(), etc.
});

Section 2 — The type declaration entry to add inside Cypress.Chainable.
Include a JSDoc comment above the entry.
Do NOT include "declare global" or "interface Chainable" — just the JSDoc + entry line.
Example:
/**
 * Logs in via API and stores the token cookie.
 * @param username - the user's login name
 * @param password - the user's password
 */
loginByApi(username: string, password: string): Chainable<void>;

Generate ONE Cypress.Commands.add() call only. Do NOT wrap Section 1 in code fences.`;

  const llmOutput = await askLlm(provider, prompt, systemPrompt);

  const [cmdPart, typePart] = llmOutput.split("\n===TYPE===\n");
  const commandCode = (cmdPart ?? llmOutput).trim();
  const typeEntry = (typePart ?? "").trim();

  // Append command to commands.ts
  const commandsPath = appendArtifact(options.projectRoot, "cypress/support/commands.ts", commandCode);

  // Insert type entry into Chainable interface in index.d.ts
  const dtsRelPath = "cypress/support/index.d.ts";
  const dtsPath = resolve(options.projectRoot, dtsRelPath);
  if (!existsSync(dtsPath)) {
    const escapedEntry = typeEntry
      .split("\n")
      .map((l) => (l.trim() ? `      ${l}` : l))
      .join("\n");
    const dtsContent = `/// <reference types="cypress" />\n\ndeclare global {\n  namespace Cypress {\n    interface Chainable {${escapedEntry ? `\n${escapedEntry}\n` : ""}    }\n  }\n}\n\nexport {};\n`;
    writeFileSync(dtsPath, dtsContent, "utf-8");
  } else {
    const existing = readFileSync(dtsPath, "utf-8");
    const updated = insertIntoChainable(existing, typeEntry);
    writeFileSync(dtsPath, updated, "utf-8");
  }

  return {
    paths: [commandsPath, dtsPath],
    content: `${commandCode}\n\n${typeEntry}`,
  };
}

export async function generateScenario(
  description: string,
  options: { projectRoot: string; provider?: LLMProvider; guide?: string },
): Promise<string> {
  const provider = options.provider ?? getActiveProvider();
  const guideCtx = loadGuideContext(options.guide, options.projectRoot);
  const systemPrompt = buildSystemPrompt(guideCtx);

  const prompt = `You are planning a Cypress test scenario step by step.

Goal: ${description}

Output a test scenario in Markdown format. Each step uses **Action** and **Element** in bold.
Follow this format exactly:

## Scenario: <title>

1. **Visit** <page>
2. **Type** "<value>" into **<element>**
3. **Click** **<element>**
4. **Assert** **<element>** are visible

Rules:
- Actions: Visit, Type, Click, Assert, Select, Check, Uncheck, Hover, Scroll, Wait
- Put action and element in **bold**
- Put typed values in "double quotes"
- Keep steps concise and focused on test flow
- Do NOT include code fences or extra commentary`;

  return await askLlm(provider, prompt, systemPrompt);
}

export const _internal = { stripCodeFences, writeArtifact, QA_SYSTEM_PROMPT };
