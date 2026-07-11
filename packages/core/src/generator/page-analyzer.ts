import { chromium, type Browser, type Page, type ElementHandle } from "playwright";

const CHROMIUM_PATH = "/usr/bin/chromium-browser";
import { resolve } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { getActiveProvider } from "../llm";
import type { LLMProvider } from "../llm/types";
import { loadStructureGuide, resolveArtifactPath, findNearestGuide } from "./structure-guide";
import type { StructureMeta } from "./structure-guide";

const QA_SYSTEM_PROMPT = `You are an expert QA automation engineer specializing in Cypress.
You write clean, maintainable test code following these conventions:

### Locator Files
- Export a const object in UPPER_SNAKE_CASE with "_LOCATORS" suffix
- Flat structure (top-level keys only, no nesting), each key is UPPER_SNAKE_CASE with JSDoc
- Field values: plain string (data-cy value), or CSS selector in brackets
- Suffix with "as const", export type: "export type nameLocators = typeof NAME_LOCATORS"

### Page Object Files
- Import locator constants from "../locators/{name}Locators"
- Export class + singleton: "export const pageName = new PageName()"
- Each method returns Cypress.Chainable<JQuery<HTMLElement>> or <JQuery<void>>
- Use cy.get(LOCATORS.FIELD_NAME) for CSS selectors, cy.getByCy(LOCATORS.FIELD_NAME) for data-cy
- Methods have JSDoc comments, combined methods return "this"

### Test Files
- Import page singletons from "../../pages/pageName"
- Simple describe/beforeEach/it blocks (no tags metadata)
- Use page methods for all interactions

- No flaky waits (no cy.wait with arbitrary timeouts)

Return ONLY the requested file content. Do not add markdown code fences
unless the file format is markdown. Do not add commentary.`;

export interface PageElement {
  tag: string;
  type?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  "data-cy"?: string;
  "data-testid"?: string;
  "data-test"?: string;
  className?: string;
  text?: string;
  href?: string;
  value?: string;
  selector: string;
  selectorType: "id" | "data-cy" | "data-testid" | "data-test" | "name" | "placeholder" | "css" | "text";
  isInteractive: boolean;
  isFormElement: boolean;
  section?: string;
}

export interface PageForm {
  selector: string;
  action?: string;
  method?: string;
  elements: PageElement[];
}

export interface PageAnalysis {
  url: string;
  title: string;
  elements: PageElement[];
  forms: PageForm[];
  buttons: PageElement[];
  inputs: PageElement[];
  links: PageElement[];
  selects: PageElement[];
  checkboxes: PageElement[];
  radios: PageElement[];
  textareas: PageElement[];
}

export interface AuthOptions {
  /** URL to navigate to first for login */
  loginUrl?: string;
  /** Username/email for login */
  username?: string;
  /** Password for login */
  password?: string;
  /** Username/email field selector */
  usernameSelector?: string;
  /** Password field selector */
  passwordSelector?: string;
  /** Login button selector */
  loginButtonSelector?: string;
  /** Wait for this selector after login (e.g., dashboard element) */
  waitForSelector?: string;
  /** Additional cookies to set before navigation */
  cookies?: Array<{ name: string; value: string; domain?: string; path?: string }>;
  /** LocalStorage items to set */
  localStorage?: Record<string, string>;
  /** SessionStorage items to set */
  sessionStorage?: Record<string, string>;
  /** Custom authentication function */
  customAuth?: (page: Page) => Promise<void>;
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

async function askLlm(
  provider: LLMProvider,
  prompt: string,
  systemPrompt = QA_SYSTEM_PROMPT,
): Promise<string> {
  const result = await provider.chat(
    [{ role: "user", content: prompt }],
    { systemPrompt, temperature: 0.2, maxTokens: 4096 }
  );
  return stripCodeFences(result.content);
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  return match ? match[1] : trimmed;
}

function writeArtifact(projectRoot: string, relativePath: string, content: string): string {
  const absPath = resolve(projectRoot, relativePath);
  mkdirSync(resolve(absPath, ".."), { recursive: true });
  writeFileSync(absPath, content + "\n", "utf-8");
  return absPath;
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

function camelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

async function extractElements(page: Page): Promise<PageElement[]> {
  const elements: PageElement[] = [];

  const handles = await page.$$(
    'a, button, input, select, textarea, [role="button"], [role="link"], [onclick], [href]'
  );

  for (const handle of handles) {
    const element = await analyzeElement(handle);
    if (element) elements.push(element);
  }

  return elements;
}

async function analyzeElement(handle: ElementHandle): Promise<PageElement | null> {
  const tagName = await handle.evaluate((e) => e.tagName.toLowerCase());
  const isInteractive = ["a", "button", "input", "select", "textarea"].includes(tagName);

  const type = await handle.getAttribute("type");
  const isFormElement =
    (tagName === "input" && type && ["text", "email", "password", "number", "search", "tel", "url", "date", "checkbox", "radio", "submit", "button", "file"].includes(type)) ||
    tagName === "select" ||
    tagName === "textarea";

  if (!isInteractive && !isFormElement) return null;

  const id = await handle.getAttribute("id");
  const name = await handle.getAttribute("name");
  const placeholder = await handle.getAttribute("placeholder");
  const dataCy = await handle.getAttribute("data-cy");
  const dataTestId = await handle.getAttribute("data-testid");
  const dataTest = await handle.getAttribute("data-test");
  const className = await handle.getAttribute("class");
  const href = await handle.getAttribute("href");
  const value = await handle.getAttribute("value");
  const text = await handle.evaluate((e) => e.textContent?.trim().slice(0, 100) || "");

  let selector: string;
  let selectorType: PageElement["selectorType"];

  if (id) {
    selector = `#${id}`;
    selectorType = "id";
  } else if (dataCy) {
    selector = `[data-cy="${dataCy}"]`;
    selectorType = "data-cy";
  } else if (dataTestId) {
    selector = `[data-testid="${dataTestId}"]`;
    selectorType = "data-testid";
  } else if (dataTest) {
    selector = `[data-test="${dataTest}"]`;
    selectorType = "data-test";
  } else if (name) {
    selector = `[name="${name}"]`;
    selectorType = "name";
  } else if (placeholder) {
    selector = `[placeholder="${placeholder}"]`;
    selectorType = "placeholder";
  } else if (className) {
    const classes = className.split(/\s+/).filter((c) => c.length > 0);
    selector = `${tagName}.${classes[0]}`;
    selectorType = "css";
  } else {
    selector = tagName;
    selectorType = "css";
  }

  return {
    tag: tagName,
    type: type || undefined,
    id: id || undefined,
    name: name || undefined,
    placeholder: placeholder || undefined,
    "data-cy": dataCy || undefined,
    "data-testid": dataTestId || undefined,
    "data-test": dataTest || undefined,
    className: className || undefined,
    text: text || undefined,
    href: href || undefined,
    value: value || undefined,
    selector,
    selectorType,
    isInteractive,
    isFormElement,
  };
}

async function extractForms(page: Page): Promise<PageForm[]> {
  const forms: PageForm[] = [];
  const formHandles = await page.$$("form");

  for (const form of formHandles) {
    const selector = await getFormSelector(form);
    const action = await form.getAttribute("action");
    const method = await form.getAttribute("method");
    const elementHandles = await form.$$("input, select, textarea, button");
    const elements: PageElement[] = [];

    for (const el of elementHandles) {
      const element = await analyzeElement(el);
      if (element) elements.push(element);
    }

    forms.push({ selector, action: action || undefined, method: method || undefined, elements });
  }

  return forms;
}

async function getFormSelector(form: ElementHandle): Promise<string> {
  const id = await form.getAttribute("id");
  if (id) return `#${id}`;

  const dataCy = await form.getAttribute("data-cy");
  if (dataCy) return `[data-cy="${dataCy}"]`;

  const className = await form.getAttribute("class");
  if (className) {
    const classes = className.split(/\s+/).filter((c) => c.length > 0);
    if (classes.length > 0) return `form.${classes[0]}`;
  }

  return "form";
}

async function performAuthentication(page: Page, auth: AuthOptions): Promise<void> {
  // Set cookies if provided
  if (auth.cookies && auth.cookies.length > 0) {
    await page.context().addCookies(auth.cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || "/",
    })));
  }

  // Set localStorage if provided
  if (auth.localStorage) {
    await page.evaluate((storage) => {
      Object.entries(storage).forEach(([key, value]) => {
        (globalThis as any).localStorage.setItem(key, value);
      });
    }, auth.localStorage);
  }

  // Set sessionStorage if provided
  if (auth.sessionStorage) {
    await page.evaluate((storage) => {
      Object.entries(storage).forEach(([key, value]) => {
        (globalThis as any).sessionStorage.setItem(key, value);
      });
    }, auth.sessionStorage);
  }

  // Custom auth function
  if (auth.customAuth) {
    await auth.customAuth(page);
    return;
  }

  // Form-based login
  if (auth.loginUrl && auth.username && auth.password) {
    await page.goto(auth.loginUrl, { waitUntil: "networkidle", timeout: 60000 });

    const userSelector = auth.usernameSelector || 'input[type="email"], input[type="text"], input[name*="user" i], input[name*="email" i], input[name*="login" i], input[name*="username" i], input[id*="user" i], input[id*="email" i], #username, #email, #user, #login';
    const passSelector = auth.passwordSelector || 'input[type="password"], input[name*="pass" i], input[id*="pass" i], #password';
    const btnSelector = auth.loginButtonSelector || 'button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Sign in"), button:has-text("ورود"), button:has-text("Login"), button:has-text("Sign In")';

    await page.waitForSelector(userSelector, { timeout: 30000 });
    await page.fill(userSelector, auth.username);
    await page.fill(passSelector, auth.password);
    await page.click(btnSelector);

    if (auth.waitForSelector) {
      await page.waitForSelector(auth.waitForSelector, { timeout: 15000 });
    } else {
      await page.waitForLoadState("networkidle");
    }
  }
}

async function analyzePage(url: string, auth?: AuthOptions): Promise<PageAnalysis> {
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    });
    const page = await context.newPage();

    // Handle authentication if provided
    if (auth) {
      await performAuthentication(page, auth);
    }

    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForLoadState("domcontentloaded");

    const title = await page.title();
    const elements = await extractElements(page);
    const forms = await extractForms(page);

    const buttons = elements.filter((e) => e.tag === "button" || (e.tag === "input" && e.type === "button") || (e.tag === "input" && e.type === "submit"));
    const inputs = elements.filter((e) => e.tag === "input" && e.type && !["button", "submit", "reset", "checkbox", "radio"].includes(e.type));
    const links = elements.filter((e) => e.tag === "a" && e.href);
    const selects = elements.filter((e) => e.tag === "select");
    const checkboxes = elements.filter((e) => e.tag === "input" && e.type === "checkbox");
    const radios = elements.filter((e) => e.tag === "input" && e.type === "radio");
    const textareas = elements.filter((e) => e.tag === "textarea");

    return { url, title, elements, forms, buttons, inputs, links, selects, checkboxes, radios, textareas };
  } finally {
    if (browser) await browser.close();
  }
}

function generateLocatorsContent(analysis: PageAnalysis, pageName: string): string {
  const locConstName = `${pageName.toUpperCase()}_LOCATORS`;
  const typeName = `${pageName}Locators`;

  const lines: string[] = [];
  lines.push(`export const ${locConstName} = {`);

  const allElements = [...analysis.buttons, ...analysis.inputs, ...analysis.links, ...analysis.selects, ...analysis.checkboxes, ...analysis.radios, ...analysis.textareas];
  const seen = new Set<string>();

  for (const el of allElements) {
    let key = "";
    if (el["data-cy"]) key = el["data-cy"].toUpperCase().replace(/[^A-Z0-9]/g, "_");
    else if (el.id) key = el.id.toUpperCase().replace(/-/g, "_");
    else if (el.name) key = el.name.toUpperCase().replace(/-/g, "_");
    else if (el.placeholder) key = el.placeholder.toUpperCase().replace(/[^A-Z0-9]/g, "_");
    else if (el.text) key = el.text.toUpperCase().replace(/[^A-Z0-9]/g, "_").slice(0, 40);
    else key = `ELEMENT_${seen.size + 1}`;

    if (seen.has(key)) {
      key = `${key}_${seen.size + 1}`;
    }
    seen.add(key);

    let value = el.selector;
    if (el.selectorType === "data-cy" || el.selectorType === "data-testid" || el.selectorType === "data-test") {
      value = el.selector;
    }

    const comment = el.text ? ` ${el.text.slice(0, 50)}` : el.placeholder ? ` placeholder: ${el.placeholder}` : el.id ? ` id: ${el.id}` : "";
    lines.push(`  /** ${key.toLowerCase().replace(/_/g, " ")}${comment} */`);
    lines.push(`  ${key}: "${value}",`);
  }

  lines.push(`} as const;`);
  lines.push(``);
  lines.push(`export type ${typeName} = typeof ${locConstName};`);

  return lines.join("\n");
}

function generatePageContent(analysis: PageAnalysis, pageName: string, locConstName: string, locImportPath: string): string {
  const className = `${pageName}Page`;
  const singletonName = camelCase(className);

  const lines: string[] = [];
  lines.push(`import { ${locConstName} } from "${locImportPath}";`);
  lines.push(``);
  lines.push(`export class ${className} {`);

  // Visit method
  lines.push(`  /** Visits the ${pageName} page */`);
  lines.push(`  visit(): Cypress.Chainable<void> {`);
  lines.push(`    return cy.visit("${analysis.url}");`);
  lines.push(`  }`);
  lines.push(``);

  const allElements = [...analysis.buttons, ...analysis.inputs, ...analysis.links, ...analysis.selects, ...analysis.checkboxes, ...analysis.radios, ...analysis.textareas];
  const seen = new Set<string>();

  for (const el of allElements) {
    let key = "";
    if (el["data-cy"]) key = el["data-cy"].toUpperCase().replace(/[^A-Z0-9]/g, "_");
    else if (el.id) key = el.id.toUpperCase().replace(/-/g, "_");
    else if (el.name) key = el.name.toUpperCase().replace(/-/g, "_");
    else if (el.placeholder) key = el.placeholder.toUpperCase().replace(/[^A-Z0-9]/g, "_");
    else if (el.text) key = el.text.toUpperCase().replace(/[^A-Z0-9]/g, "_").slice(0, 40);
    else key = `ELEMENT_${seen.size + 1}`;

    if (seen.has(key)) continue;
    seen.add(key);

    // Normalize key for method names: replace non-alphanumeric with underscore, then camelCase
    const normalizedKey = key.replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
    const methodName = normalizedKey
      .toLowerCase()
      .replace(/[-_]([a-z0-9])/g, (_, c) => c.toUpperCase())
      .replace(/^[0-9]/, "_$&"); // Ensure doesn't start with number
    const isClick = el.tag === "button" || (el.tag === "input" && ["button", "submit"].includes(el.type || ""));
    const isLink = el.tag === "a";
    const isInput = el.tag === "input" && el.type && !["button", "submit", "reset", "checkbox", "radio"].includes(el.type);
    const isCheckbox = el.tag === "input" && el.type === "checkbox";
    const isRadio = el.tag === "input" && el.type === "radio";
    const isSelect = el.tag === "select";
    const isTextarea = el.tag === "textarea";

    if (isClick) {
      lines.push(`  /** Clicks the ${key.toLowerCase().replace(/_/g, " ")} */`);
      lines.push(`  click${methodName.charAt(0).toUpperCase() + methodName.slice(1)}(): Cypress.Chainable<JQuery<void>> {`);
      const useGetByCy = el.selectorType === "data-cy" || el.selectorType === "data-testid" || el.selectorType === "data-test";
      lines.push(`    return ${useGetByCy ? "cy.getByCy" : "cy.get"}(${locConstName}.${key}).click();`);
      lines.push(`  }`);
      lines.push(``);
    } else if (isLink) {
      lines.push(`  /** Clicks the ${key.toLowerCase().replace(/_/g, " ")} link */`);
      lines.push(`  click${methodName.charAt(0).toUpperCase() + methodName.slice(1)}(): Cypress.Chainable<JQuery<HTMLElement>> {`);
      lines.push(`    return cy.get(${locConstName}.${key}).click();`);
      lines.push(`  }`);
      lines.push(``);
    } else if (isInput) {
      lines.push(`  /** Types into the ${key.toLowerCase().replace(/_/g, " ")} input */`);
      lines.push(`  type${methodName.charAt(0).toUpperCase() + methodName.slice(1)}(value: string): Cypress.Chainable<JQuery<HTMLElement>> {`);
      lines.push(`    return cy.get(${locConstName}.${key}).clear().type(value);`);
      lines.push(`  }`);
      lines.push(``);
    } else if (isCheckbox) {
      lines.push(`  /** Checks the ${key.toLowerCase().replace(/_/g, " ")} checkbox */`);
      lines.push(`  check${methodName.charAt(0).toUpperCase() + methodName.slice(1)}(): Cypress.Chainable<JQuery<HTMLElement>> {`);
      lines.push(`    return cy.get(${locConstName}.${key}).check();`);
      lines.push(`  }`);
      lines.push(``);
      lines.push(`  /** Unchecks the ${key.toLowerCase().replace(/_/g, " ")} checkbox */`);
      lines.push(`  uncheck${methodName.charAt(0).toUpperCase() + methodName.slice(1)}(): Cypress.Chainable<JQuery<HTMLElement>> {`);
      lines.push(`    return cy.get(${locConstName}.${key}).uncheck();`);
      lines.push(`  }`);
      lines.push(``);
    } else if (isRadio) {
      lines.push(`  /** Selects the ${key.toLowerCase().replace(/_/g, " ")} radio button */`);
      lines.push(`  select${methodName.charAt(0).toUpperCase() + methodName.slice(1)}(): Cypress.Chainable<JQuery<HTMLElement>> {`);
      lines.push(`    return cy.get(${locConstName}.${key}).check();`);
      lines.push(`  }`);
      lines.push(``);
    } else if (isSelect) {
      lines.push(`  /** Selects an option in the ${key.toLowerCase().replace(/_/g, " ")} dropdown */`);
      lines.push(`  select${methodName.charAt(0).toUpperCase() + methodName.slice(1)}(value: string): Cypress.Chainable<JQuery<HTMLElement>> {`);
      lines.push(`    return cy.get(${locConstName}.${key}).select(value);`);
      lines.push(`  }`);
      lines.push(``);
    } else if (isTextarea) {
      lines.push(`  /** Types into the ${key.toLowerCase().replace(/_/g, " ")} textarea */`);
      lines.push(`  type${methodName.charAt(0).toUpperCase() + methodName.slice(1)}(value: string): Cypress.Chainable<JQuery<HTMLElement>> {`);
      lines.push(`    return cy.get(${locConstName}.${key}).clear().type(value);`);
      lines.push(`  }`);
      lines.push(``);
    }
  }

  if (analysis.forms.length > 0) {
    for (let i = 0; i < analysis.forms.length; i++) {
      const form = analysis.forms[i];
      const firstEl = form.elements[0];
      const baseName = firstEl ? (firstEl.name || firstEl.id || `form${i + 1}`) : `form${i + 1}`;
      const normalizedBaseName = baseName.replace(/[^a-zA-Z0-9]+/g, " ").trim();
      const formName = normalizedBaseName
        .split(/\s+/)
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join("");
      const safeFormName = formName || `Form${i + 1}`;
      lines.push(`  /** Submits the ${safeFormName.toLowerCase()} */`);
      lines.push(`  submit${safeFormName}(): Cypress.Chainable<JQuery<HTMLElement>> {`);
      lines.push(`    return cy.get("${form.selector}").submit();`);
      lines.push(`  }`);
      lines.push(``);
    }
  }

  lines.push(`}`);
  lines.push(``);
  lines.push(`export const ${singletonName} = new ${className}();`);

  return lines.join("\n");
}

function generateTestContent(pageName: string, pageSingletonName: string, tier: "smoke" | "regression"): string {
  const className = `${pageName}Page`;
  const singletonName = camelCase(className);

  return `import { ${singletonName} } from "../../pages/${pageName}Page";

describe("${pageName} page - ${tier} tests", () => {
  beforeEach(() => {
    ${singletonName}.visit();
  });

  it("should load the page successfully", () => {
    cy.url().should("include", "${pageName.toLowerCase()}");
  });

  it("should have all interactive elements visible", () => {
    // Add assertions for key elements based on page analysis
  });
});
`;
}


export async function analyzeAndGenerate(
  url: string,
  options: {
    projectRoot: string;
    provider?: LLMProvider;
    guide?: string;
    name?: string;
    tier?: "smoke" | "regression";
    auth?: AuthOptions;
  }
): Promise<{ paths: string[]; analysis: PageAnalysis }> {
  const provider = options.provider ?? getActiveProvider();
  const guideCtx = loadGuideContext(options.guide, options.projectRoot);
  const systemPrompt = buildSystemPrompt(guideCtx);

  console.log(`[qa] Analyzing page: ${url}`);
  const analysis = await analyzePage(url, options.auth);

  const namingSource = options.name || analysis.title || "page";
  const baseName = sanitizeName(namingSource);
  const pageName = toPascalCase(namingSource);

  const locConstName = `${pageName.toUpperCase()}_LOCATORS`;
  const pageClassName = `${pageName}Page`;
  const pageSingletonName = camelCase(pageClassName);

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
  const locToPageImport = `../locators/${locFileName}`;

  console.log(`[qa] Generating locators...`);
  const locContent = generateLocatorsContent(analysis, pageName);
  const absLocPath = writeArtifact(options.projectRoot, locRelPath, locContent);

  console.log(`[qa] Generating page object...`);
  const pageContent = generatePageContent(analysis, pageName, locConstName, locToPageImport);
  const absPagePath = writeArtifact(options.projectRoot, pageRelPath, pageContent);

  console.log(`[qa] Generating test spec...`);
  const testContent = generateTestContent(pageName, pageSingletonName, options.tier ?? "smoke");
  const absTestPath = writeArtifact(options.projectRoot, testRelPath, testContent);

  return { paths: [absLocPath, absPagePath, absTestPath], analysis };
}

function generateScenarioFromAnalysis(analysis: PageAnalysis, pageName: string): string {
  const lines: string[] = [];
  lines.push(`# Scenario: ${pageName}`);
  lines.push(``);

  let stepNum = 1;

  lines.push(`${stepNum++}. **Visit** ${analysis.url}`);
  lines.push(``);

  if (analysis.forms.length > 0) {
    for (const form of analysis.forms) {
      for (const el of form.elements) {
        if (el.tag === "input" && el.type === "password") {
          lines.push(`${stepNum++}. **Type** "****" into **${el.name || el.id || el.placeholder || "password field"}**`);
        } else if (el.tag === "input" && el.type && !["button", "submit", "checkbox", "radio"].includes(el.type)) {
          lines.push(`${stepNum++}. **Type** "<value>" into **${el.name || el.id || el.placeholder || "input field"}**`);
        } else if (el.tag === "select") {
          lines.push(`${stepNum++}. **Select** "<option>" from **${el.name || el.id || "dropdown"}**`);
        } else if (el.tag === "input" && el.type === "checkbox") {
          lines.push(`${stepNum++}. **Check** **${el.name || el.id || "checkbox"}**`);
        } else if (el.tag === "input" && el.type === "radio") {
          lines.push(`${stepNum++}. **Select** **${el.value || el.name || el.id || "radio option"}**`);
        } else if (el.tag === "textarea") {
          lines.push(`${stepNum++}. **Type** "<text>" into **${el.name || el.id || el.placeholder || "textarea"}**`);
        } else if (el.tag === "button" || (el.tag === "input" && ["button", "submit"].includes(el.type || ""))) {
          lines.push(`${stepNum++}. **Click** **${el.text || el.value || el.id || "button"}**`);
        }
      }
    }
  }

  for (const el of analysis.buttons) {
    if (!analysis.forms.some(f => f.elements.some(fe => fe.selector === el.selector))) {
      lines.push(`${stepNum++}. **Click** **${el.text || el.value || el.id || "button"}**`);
    }
  }
  for (const el of analysis.links) {
    lines.push(`${stepNum++}. **Click** **${el.text || "link"}**`);
  }

  lines.push(``);
  lines.push(`## Expected Results`);
  lines.push(`- Page loads successfully`);
  if (analysis.forms.length > 0) {
    lines.push(`- Form submission works correctly`);
  }
  lines.push(`- All interactive elements are visible and functional`);

  return lines.join("\n");
}

export { analyzePage, generateLocatorsContent, generatePageContent, generateTestContent, generateScenarioFromAnalysis };
export type { GuideContext };