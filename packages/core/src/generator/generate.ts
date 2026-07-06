import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getActiveProvider } from "../llm";
import type { ChatMessage, LLMProvider } from "../llm/types";
import { loadStructureGuide, resolveArtifactPath, findNearestGuide } from "./structure-guide";
import type { StructureMeta } from "./structure-guide";

const QA_SYSTEM_PROMPT = `You are an expert QA automation engineer specializing in Cypress.
You write clean, maintainable test code following these principles:
- Page Object Model for reusing UI interactions
- Robust selectors (prefer data-cy attributes, avoid brittle CSS/XPath)
- BDD-style Cucumber features using Given/When/Then in plain English
- Custom Cypress commands for repeated actions
- Clear assertions with meaningful failure messages
- No flaky waits (no cy.wait with arbitrary timeouts)

Return ONLY the requested file content. Do not add markdown code fences
unless the file format is markdown. Do not add commentary.`;

export interface GenerateOptions {
  projectRoot: string;
  provider?: LLMProvider;
  /** Path to a Structure Guide markdown file. */
  guide?: string;
  /** Test tier: "smoke" or "regression" */
  tier?: "smoke" | "regression";
  /** URL of the page/feature being tested, for AI context. */
  url?: string;
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

function buildSystemPrompt(guideCtx?: GuideContext): string {
  if (!guideCtx) return QA_SYSTEM_PROMPT;
  return `${QA_SYSTEM_PROMPT}

IMPORTANT — Follow the project structure guide below EXACTLY.
Use the exact directory paths, file naming conventions, and coding patterns specified.

${guideCtx.markdown}

Generate the file using the correct naming convention and output path for this artifact type.
Do NOT deviate from the structure guide.`;
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

Use the Page Object Model pattern. Import page objects from "../../pages".
Use describe/it blocks. Include a beforeEach if appropriate.`;

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

Export a class with methods for each element and action. Use data-cy selectors.
Import locator constants from "../locators/{PascalCase}Locators" and use them in the class.
Use TypeScript. Also export a singleton instance of the class.`;

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

Export a const object mapping semantic names to Cypress selectors
(prefer [data-cy="..."] format). Use TypeScript with "as const".`;

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

export async function generateAll(
  description: string,
  options: GenerateOptions,
): Promise<{ paths: string[]; content: string }> {
  const provider = options.provider ?? getActiveProvider();
  const guideCtx = loadGuideContext(options.guide, options.projectRoot);
  const systemPrompt = buildSystemPrompt(guideCtx);

  const baseName = sanitizeName(description);
  const pageName = toPascalCase(description);

  // Phase 1: generate locators with context about the page/URL
  const locPrompt = `You are generating a Cypress locators file for a page described below.
Page description: ${description}${options.url ? `\nURL: ${options.url}` : ""}

Write a TypeScript constants file exporting a const object mapping semantic names to
Cypress selectors using [data-cy="..."] format. Use "as const".
The object will be named "${pageName}Locators".
Each value must be a function returning Cypress.Chainable<JQuery<HTMLElement>>, e.g.:
  export const ${pageName}Locators = {
    someElement: (): Cypress.Chainable<JQuery<HTMLElement>> => cy.getByCy("some-element"),
  } as const;

Include locators for: form fields, buttons, error messages, navigation elements, and any
other interactive elements the page would likely have based on the description.`;

  const locContent = await askLlm(provider, locPrompt, systemPrompt);

  const locFileName = pageName || baseName;
  const locPath = guideCtx
    ? resolveArtifactPath(guideCtx.meta, "locators", locFileName)
    : `cypress/e2e/locators/${baseName}Locators.ts`;

  const absLocPath = writeArtifact(options.projectRoot, locPath, locContent);

  // Phase 2: generate page object that imports locators
  const pagePrompt = `You are generating a Cypress Page Object class in TypeScript.
Page description: ${description}${options.url ? `\nURL: ${options.url}` : ""}

The locators file has already been created at "../locators/${baseName}Locators" with
a const object named "${pageName}Locators". Import it and use its selectors in every method.

Export a class named "${pageName}Page" with methods that chain (return "this").
Each method should call the corresponding locator and perform actions (click, type, etc.).
Also export a singleton instance: export const ${baseName}Page = new ${pageName}Page();

Include methods for: visit(), all form interactions, submit/click, getting error messages,
and any page-specific actions based on the description.`;

  const pageContent = await askLlm(provider, pagePrompt, systemPrompt);

  const pageFileName = pageName || baseName;
  const pagePath = guideCtx
    ? resolveArtifactPath(guideCtx.meta, "page", pageFileName)
    : `cypress/e2e/pages/${baseName}Page.ts`;

  const absPagePath = writeArtifact(options.projectRoot, pagePath, pageContent);

  // Phase 3: generate a test spec that imports the page object
  const testPrompt = `You are generating a Cypress test spec file in TypeScript.
Test scenario: ${description}${options.url ? `\nURL: ${options.url}` : ""}

The Page Object has been created at "../../pages/${baseName}Page" exporting "${baseName}Page".
Import it with: import { ${baseName}Page } from "../../pages/${baseName}Page";

Write describe/it blocks with ${options.tier === "regression" ? "regression" : "smoke"} tests.
Include a beforeEach that calls ${baseName}Page.visit().
Test happy path, validation errors, and edge cases. Use cy.getByCy for any direct selectors.`;

  const testContent = await askLlm(provider, testPrompt, systemPrompt);

  const testPath = guideCtx
    ? resolveArtifactPath(guideCtx.meta, "test", baseName, options.tier)
    : `cypress/e2e/test/${options.tier ?? "smoke"}/${baseName}.cy.ts`;

  const absTestPath = writeArtifact(options.projectRoot, testPath, testContent);

  const summary = `# Generated artifacts for: ${description}

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

function insertBeforeLastLine(projectRoot: string, relativePath: string, markerLine: string, newContent: string): string {
  const absPath = resolve(projectRoot, relativePath);
  mkdirSync(dirname(absPath), { recursive: true });
  const existing = existsSync(absPath) ? readFileSync(absPath, "utf-8") : "";
  const idx = existing.lastIndexOf(markerLine);
  if (idx === -1) {
    // File doesn't exist or marker not found — create fresh
    writeFileSync(absPath, newContent + "\n", "utf-8");
  } else {
    writeFileSync(absPath, existing.slice(0, idx) + newContent + "\n" + existing.slice(idx), "utf-8");
  }
  return absPath;
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

Section 2 — The TypeScript type declaration block to add to Cypress.Chainable:
declare global {
  namespace Cypress {
    interface Chainable {
      <commandName>(<params with types>): Chainable<void>;
    }
  }
}

Generate ONE Cypress.Commands.add() call only. Do NOT wrap Section 1 in code fences.`;

  const llmOutput = await askLlm(provider, prompt, systemPrompt);

  const [cmdPart, typePart] = llmOutput.split("\n===TYPE===\n");
  const commandCode = (cmdPart ?? llmOutput).trim();
  const typeBlock = (typePart ?? "").trim();

  // Append command to commands.ts
  const commandsPath = appendArtifact(options.projectRoot, "cypress/support/commands.ts", commandCode);

  // Insert type declaration into index.d.ts before "export {};"
  const dtsPath = insertBeforeLastLine(options.projectRoot, "cypress/support/index.d.ts", "\nexport {};\n", typeBlock);

  return {
    paths: [commandsPath, dtsPath],
    content: `${commandCode}\n\n${typeBlock}`,
  };
}

export const _internal = { stripCodeFences, writeArtifact, QA_SYSTEM_PROMPT };
