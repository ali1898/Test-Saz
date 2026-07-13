import type { Browser, Page, ElementHandle } from "playwright";
import { launchBrowser } from "./browser-launcher";

import { resolve } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { getActiveProvider } from "../llm";
import type { LLMProvider } from "../llm/types";
import { loadStructureGuide, resolveArtifactPath, findNearestGuide } from "./structure-guide";
import type { StructureMeta } from "./structure-guide";
import { QA_SYSTEM_PROMPT, buildSystemPrompt } from "./prompts";

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
  /** Enable debug logging */
  debug?: boolean;
}

function loadGuideContext(guidePath?: string, projectRoot?: string): { meta: StructureMeta; markdown: string } | undefined {
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
  // Try to extract content from code fences (handles text before/after fences)
  const match = trimmed.match(/```(?:[a-zA-Z]*)?\n([\s\S]*?)\n```/);
  if (match) return match[1].trim();
  // If no code fences, return as-is
  return trimmed;
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
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "artifact";
}

function toPascalCase(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .split(/[-_\s]+/)
    .filter((s) => s.length > 0)
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
    if (auth.debug) console.log(`[qa] DEBUG: Navigating to login URL: ${auth.loginUrl}`);
    await page.goto(auth.loginUrl, { waitUntil: "networkidle", timeout: 60000 });

    const userSelector = auth.usernameSelector || 'input[type="email"], input[type="text"], input[name*="user" i], input[name*="email" i], input[name*="login" i], input[name*="username" i], input[id*="user" i], input[id*="email" i], #username, #email, #user, #login';
    const passSelector = auth.passwordSelector || 'input[type="password"], input[name*="pass" i], input[id*="pass" i], #password';
    const btnSelector = auth.loginButtonSelector || 'button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Sign in"), button:has-text("ورود"), button:has-text("Login"), button:has-text("Sign In")';

    if (auth.debug) console.log(`[qa] DEBUG: Waiting for username selector: ${userSelector}`);
    await page.waitForSelector(userSelector, { timeout: 30000 });
    if (auth.debug) console.log(`[qa] DEBUG: Filling username`);
    await page.fill(userSelector, auth.username);
    if (auth.debug) console.log(`[qa] DEBUG: Filling password`);
    await page.fill(passSelector, auth.password);
    if (auth.debug) console.log(`[qa] DEBUG: Clicking login button: ${btnSelector}`);
    await page.click(btnSelector);

    // Wait for URL to change from login page (ensures login redirect completed)
    if (auth.debug) console.log(`[qa] DEBUG: Waiting for redirect away from login page...`);
    try {
      await page.waitForFunction(
        `!window.location.href.startsWith("${auth.loginUrl}")`,
        { timeout: 15000 }
      );
      if (auth.debug) console.log(`[qa] DEBUG: Redirected to: ${page.url()}`);
    } catch {
      if (auth.debug) console.log(`[qa] DEBUG: No redirect detected, continuing...`);
    }

    if (auth.waitForSelector) {
      if (auth.debug) console.log(`[qa] DEBUG: Waiting for selector: ${auth.waitForSelector}`);
      await page.waitForSelector(auth.waitForSelector, { timeout: 15000 });
    } else {
      if (auth.debug) console.log(`[qa] DEBUG: Waiting for network idle`);
      await page.waitForLoadState("networkidle");
    }
    if (auth.debug) console.log(`[qa] DEBUG: Login complete (current URL: ${page.url()})`);
  }
}

async function analyzePage(url: string, auth?: AuthOptions): Promise<PageAnalysis> {
  const debug = auth?.debug ?? false;
  if (debug) console.log(`[qa] DEBUG: Analyzing URL: ${url}`);
  let browser: Browser | null = null;
  try {
    browser = await launchBrowser({ headless: true, debug });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    });
    const page = await context.newPage();

    // Handle authentication if provided
    if (auth) {
      if (debug) console.log(`[qa] DEBUG: Performing authentication`);
      await performAuthentication(page, { ...auth, debug });
    }

    if (debug) console.log(`[qa] DEBUG: Navigating to target URL: ${url}`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

    // Verify we're on the target page (not redirected to login)
    const targetPath = new URL(url).pathname;
    const currentUrl = page.url();
    if (auth && !currentUrl.includes(targetPath)) {
      if (debug) console.log(`[qa] DEBUG: Redirected to ${currentUrl} instead of target, re-authenticating...`);

      // Re-authenticate
      await performAuthentication(page, { ...auth, debug });

      // Retry: try SPA-friendly navigation first (avoids full page reload)
      if (debug) console.log(`[qa] DEBUG: Retrying navigation via SPA pushState...`);
      await page.evaluate(
        `(function() {
          var parsed = new URL("${url}", window.location.origin);
          window.history.pushState({}, '', parsed.pathname + parsed.search + parsed.hash);
          window.dispatchEvent(new PopStateEvent('popstate'));
        })()`
      );

      await page.waitForLoadState("networkidle").catch(() => {});

      // If still not on target, fall back to goto
      if (!page.url().includes(targetPath)) {
        if (debug) console.log(`[qa] DEBUG: SPA navigation failed, falling back to page.goto...`);
        await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
      }
    }

    await page.waitForLoadState("domcontentloaded");

    // Final URL verification
    const finalUrl = page.url();
    if (auth && !finalUrl.includes(targetPath)) {
      if (debug) console.log(`[qa] WARNING: Final URL is ${finalUrl}, expected ${url}. Elements may be from wrong page.`);
    }

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
    lines.push(`  ${key}: '${value}',`);
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
      lines.push(`  click${methodName.charAt(0).toUpperCase() + methodName.slice(1)}(): Cypress.Chainable<JQuery<HTMLElement>> {`);
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

interface ScenarioGenContext {
  pageName: string;
  baseName: string;
  locConstName: string;
  pageClassName: string;
  pageSingletonName: string;
  locToPageImport: string;
  url: string;
  tier: string;
  systemPrompt: string;
  debug?: boolean;
}

async function generateFromScenario(
  provider: LLMProvider,
  scenario: string,
  analysis: PageAnalysis,
  ctx: ScenarioGenContext,
): Promise<{ locContent: string; pageContent: string; testContent: string }> {
  // Summarize detected elements for the LLM
  const elementSummary = [
    analysis.buttons.length > 0 ? `Buttons (${analysis.buttons.length}): ${analysis.buttons.map((e) => e.text || e.id || e.selector).slice(0, 10).join(", ")}${analysis.buttons.length > 10 ? "..." : ""}` : null,
    analysis.inputs.length > 0 ? `Inputs (${analysis.inputs.length}): ${analysis.inputs.map((e) => e.placeholder || e.name || e.id || e.selector).slice(0, 10).join(", ")}${analysis.inputs.length > 10 ? "..." : ""}` : null,
    analysis.selects.length > 0 ? `Selects (${analysis.selects.length}): ${analysis.selects.map((e) => e.name || e.id || e.selector).join(", ")}` : null,
    analysis.checkboxes.length > 0 ? `Checkboxes (${analysis.checkboxes.length}): ${analysis.checkboxes.map((e) => e.name || e.id || e.selector).join(", ")}` : null,
    analysis.radios.length > 0 ? `Radios (${analysis.radios.length}): ${analysis.radios.map((e) => e.name || e.id || e.selector).join(", ")}` : null,
    analysis.textareas.length > 0 ? `Textareas (${analysis.textareas.length}): ${analysis.textareas.map((e) => e.name || e.id || e.selector).join(", ")}` : null,
    analysis.forms.length > 0 ? `Forms (${analysis.forms.length}): ${analysis.forms.map((f) => f.selector).join(", ")}` : null,
  ].filter(Boolean).join("\n") || "No elements detected";

  // Phase 1: Generate locators
  if (ctx.debug) console.log(`[qa] DEBUG: [Scenario] Phase 1 — Generating locators...`);
  const locPrompt = `You are generating a Cypress locators file for a page.
Page URL: ${ctx.url}
Page title: ${analysis.title}

## Test Scenario (the locators must support this scenario):
${scenario}

## Detected page elements:
${elementSummary}

## Instructions:
1. Read the scenario carefully and identify which elements are needed for each step
2. Generate ONLY the locators needed for the scenario steps — do NOT add extra locators
3. Use the detected element selectors when they match scenario elements (prefer data-cy > id > name > placeholder > CSS)
4. For elements mentioned in the scenario but not detected, create reasonable selectors based on context
5. IMPORTANT: Locator names must be UPPER_SNAKE_CASE and match exactly what the page object will reference. Use consistent naming (e.g., LOGIN_BUTTON not LOGIN)

## Format:
- Export const: ${ctx.locConstName}
- Flat structure (top-level keys only), each key UPPER_SNAKE_CASE with JSDoc comment
- Field values: single-quoted strings — '[data-cy="..."]' for data-cy, or '[selector]' for CSS
- Suffix with "as const"
- Export type: export type ${ctx.pageName}Locators = typeof ${ctx.locConstName}

Example:
  export const ${ctx.locConstName} = {
    /** description */
    FIELD_NAME: '[data-cy="field-name"]',
  } as const;
  export type ${ctx.pageName}Locators = typeof ${ctx.locConstName};`;

  const locContent = await askLlm(provider, locPrompt, ctx.systemPrompt);
  if (ctx.debug) console.log(`[qa] DEBUG: [Scenario] Locators generated (${locContent.length} chars)`);

  // Phase 2: Generate page object
  if (ctx.debug) console.log(`[qa] DEBUG: [Scenario] Phase 2 — Generating page object...`);
  const pagePrompt = `You are generating a Cypress Page Object class in TypeScript.
Page URL: ${ctx.url}

## Test Scenario (this Page Object must support the scenario steps):
${scenario}

## Import and export names:
- Import locators from: "${ctx.locToPageImport}"
- Locators const: ${ctx.locConstName}
- Class name: ${ctx.pageClassName}
- Singleton: export const ${ctx.pageSingletonName} = new ${ctx.pageClassName}()

## Instructions:
1. Read the scenario and create a method for each step that involves page interaction
2. Methods should match scenario actions (visit, type, click, select, assert, etc.)
3. IMPORTANT: Use cy.get() for ALL selectors EXCEPT data-cy. Only use cy.getByCy() when the selector starts with [data-cy="..."]. For all other selectors like [placeholder="..."], [name="..."], #id, etc., always use cy.get()
4. CRITICAL: When referencing locators, use EXACTLY the same names as defined in the locators file. Do NOT rename or shorten them. If the locators file has DOWNLOAD_CENTER_BUTTON, use DOWNLOAD_CENTER_BUTTON, not DOWNLOAD_CENTER.
5. Each method returns Cypress.Chainable<JQuery<HTMLElement>>
6. Add a visit() method that navigates to ${ctx.url}

## Format:
import { ${ctx.locConstName} } from "${ctx.locToPageImport}";

export class ${ctx.pageClassName} {
  /** Visits the page */
  visit(): Cypress.Chainable<void> {
    return cy.visit("${ctx.url}");
  }

  // Methods for each scenario step...
}

export const ${ctx.pageSingletonName} = new ${ctx.pageClassName}();`;

  const pageContent = await askLlm(provider, pagePrompt, ctx.systemPrompt);
  if (ctx.debug) console.log(`[qa] DEBUG: [Scenario] Page object generated (${pageContent.length} chars)`);

  // Phase 3: Generate test spec
  if (ctx.debug) console.log(`[qa] DEBUG: [Scenario] Phase 3 — Generating test spec...`);
  const testSingletonName = ctx.pageSingletonName;
  const testImportPath = `../../pages/${ctx.baseName}Page`;

  const testPrompt = `You are generating a Cypress test spec file in TypeScript.
Page URL: ${ctx.url}

## Test Scenario to implement:
${scenario}

## Import:
- Import page singleton from: "${testImportPath}"
- Singleton name: ${testSingletonName}

## Instructions:
1. Implement the scenario as a Cypress test
2. Use describe/it blocks (no tags metadata)
3. Add beforeEach with ${testSingletonName}.visit()
4. Each scenario step becomes a line calling the corresponding page method
5. IMPORTANT: Use actual test data values, NOT placeholders like "<value>" or "****". Use realistic values like "testuser", "password123", "test@example.com", etc.
6. Add assertions for verification steps using cy.get/cy.contains
7. Do NOT use cy.getByCy directly — use page methods only
8. IMPORTANT: Method names must match EXACTLY with the page object. If the page object has clickDownloadCenter(), use clickDownloadCenter(), NOT clickDownloadCenterButton()

## Format:
import { ${testSingletonName} } from "${testImportPath}";

describe("${ctx.pageName} page - ${ctx.tier} tests", () => {
  beforeEach(() => {
    ${testSingletonName}.visit();
  });

  it("should complete the scenario", () => {
    // Step 1: ...
    // Step 2: ...
  });
});`;

  const testContent = await askLlm(provider, testPrompt, ctx.systemPrompt);
  if (ctx.debug) console.log(`[qa] DEBUG: [Scenario] Test spec generated (${testContent.length} chars)`);

  // Validate and fix mismatches between locators and page object
  const fixedPage = fixLocatorMismatches(locContent, pageContent, ctx.locConstName, ctx.debug);

  // Validate and fix mismatches between page object and test
  const fixedTest = fixTestMismatches(fixedPage, testContent, ctx.pageSingletonName, ctx.debug);

  return { locContent, pageContent: fixedPage, testContent: fixedTest };
}

/**
 * Validates test spec against page object and fixes method name mismatches.
 * Extracts method names from page object, finds calls in test that don't match,
 * and replaces them with the closest matching method name.
 */
function fixTestMismatches(pageContent: string, testContent: string, singletonName: string, debug?: boolean): string {
  // Extract method names from page object (e.g., "clickLoginButton()" -> "clickLoginButton")
  const methodRegex = /^\s+(?:click|type|select|check|uncheck|assert|visit|submit)\w*\s*\(/gm;
  const pageMethods = new Set<string>();
  let match;
  while ((match = methodRegex.exec(pageContent)) !== null) {
    const methodName = match[0].trim().split("(")[0].trim();
    pageMethods.add(methodName);
  }

  if (pageMethods.size === 0) return testContent;

  // Common abbreviations to expand for matching
  const abbreviations: Record<string, string> = {
    "btn": "button",
    "txt": "text",
    "inp": "input",
    "sel": "select",
    "chk": "check",
    "rm": "remove",
  };

  function expandAbbreviations(str: string): string {
    let result = str.toLowerCase();
    for (const [abbr, full] of Object.entries(abbreviations)) {
      result = result.replace(new RegExp(abbr, "g"), full);
    }
    return result;
  }

  // Find method calls in test (e.g., "siamloginPage.clickLogin()" -> "clickLogin")
  const callRegex = new RegExp(`${singletonName}\\.([a-zA-Z]+)\\(`, "g");
  const fixedTest = testContent.replace(callRegex, (fullMatch, methodName) => {
    // Check if method exists in page object
    if (pageMethods.has(methodName)) {
      return fullMatch;
    }

    // Find closest matching method (with abbreviation expansion)
    const normalizedMethod = expandAbbreviations(methodName);
    let bestMatch = "";
    let bestScore = 0;

    for (const pageMethod of pageMethods) {
      const normalizedPage = expandAbbreviations(pageMethod);
      // Exact match
      if (normalizedMethod === normalizedPage) {
        return `${singletonName}.${pageMethod}(`;
      }
      // Check if one contains the other
      if (normalizedPage.includes(normalizedMethod) || normalizedMethod.includes(normalizedPage)) {
        const score = Math.min(normalizedMethod.length, normalizedPage.length);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = pageMethod;
        }
      }
    }

    if (bestMatch) {
      if (debug) console.log(`[qa] DEBUG: Fixed method mismatch: ${methodName} -> ${bestMatch}`);
      return `${singletonName}.${bestMatch}(`;
    }

    // No match found, keep original
    return fullMatch;
  });

  return fixedTest;
}

/**
 * Validates page object against locators file and fixes locator name mismatches.
 * Extracts locator names from locators file, finds references in page object that don't match,
 * and replaces them with the correct locator name.
 */
function fixLocatorMismatches(locContent: string, pageContent: string, locConstName: string, debug?: boolean): string {
  // Extract locator names from locators file (e.g., "USERNAME_INPUT:" -> "USERNAME_INPUT")
  const locatorRegex = /^\s+([A-Z][A-Z_0-9]+)\s*:/gm;
  const definedLocators = new Set<string>();
  let match;
  while ((match = locatorRegex.exec(locContent)) !== null) {
    definedLocators.add(match[1]);
  }

  if (definedLocators.size === 0) return pageContent;

  // Find locator references in page object (e.g., "SIAMLOGIN_LOCATORS.DOWNLOAD_CENTER" -> "DOWNLOAD_CENTER")
  const refRegex = new RegExp(`${locConstName}\\.([A-Z][A-Z_0-9]+)`, "g");
  const fixedPage = pageContent.replace(refRegex, (fullMatch, locatorName) => {
    // Check if locator exists in locators file
    if (definedLocators.has(locatorName)) {
      return fullMatch;
    }

    // Find closest matching locator
    const normalizedLocator = locatorName.toLowerCase();
    let bestMatch = "";
    let bestScore = 0;

    for (const definedLocator of definedLocators) {
      const normalizedDefined = definedLocator.toLowerCase();
      // Exact match
      if (normalizedLocator === normalizedDefined) {
        return `${locConstName}.${definedLocator}`;
      }
      // Check if one contains the other
      if (normalizedDefined.includes(normalizedLocator) || normalizedLocator.includes(normalizedDefined)) {
        const score = Math.min(normalizedLocator.length, normalizedDefined.length);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = definedLocator;
        }
      }
    }

    if (bestMatch) {
      if (debug) console.log(`[qa] DEBUG: Fixed locator mismatch: ${locatorName} -> ${bestMatch}`);
      return `${locConstName}.${bestMatch}`;
    }

    // No match found, keep original
    return fullMatch;
  });

  return fixedPage;
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
    scenario?: string;
    debug?: boolean;
  }
): Promise<{ paths: string[]; analysis: PageAnalysis }> {
  const provider = options.provider ?? getActiveProvider();
  const guideCtx = loadGuideContext(options.guide, options.projectRoot);
  const systemPrompt = buildSystemPrompt(guideCtx);

  if (options.debug) console.log(`[qa] DEBUG: Analyzing page: ${url}`);
  if (options.debug && options.auth) console.log(`[qa] DEBUG: Auth config:`, JSON.stringify(options.auth, null, 2));
  if (options.debug && options.scenario) console.log(`[qa] DEBUG: Scenario provided (${options.scenario.length} chars)`);

  // Pass debug to auth for detailed logging
  const authWithDebug = options.auth ? { ...options.auth, debug: options.debug } : undefined;
  const analysis = await analyzePage(url, authWithDebug);

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

  let locContent: string;
  let pageContent: string;
  let testContent: string;

  // Auto-generate scenario if not provided (enables real test generation)
  let scenario = options.scenario;
  if (!scenario) {
    if (options.debug) console.log(`[qa] DEBUG: No scenario provided, auto-generating from analysis`);
    scenario = generateScenarioFromAnalysis(analysis, pageName);
    if (options.debug) console.log(`[qa] DEBUG: Generated scenario (${scenario.length} chars)`);
  }

  // Always use scenario-based generation for real tests (not stubs)
  if (options.debug) console.log(`[qa] DEBUG: Using scenario-based LLM generation`);
  const generated = await generateFromScenario(provider, scenario, analysis, {
    pageName,
    baseName,
    locConstName,
    pageClassName,
    pageSingletonName,
    locToPageImport,
    url,
    tier: options.tier ?? "smoke",
    systemPrompt,
    debug: options.debug,
  });
  locContent = generated.locContent;
  pageContent = generated.pageContent;
  testContent = generated.testContent;

  console.log(`[qa] Generating locators...`);
  const absLocPath = writeArtifact(options.projectRoot, locRelPath, locContent);

  console.log(`[qa] Generating page object...`);
  const absPagePath = writeArtifact(options.projectRoot, pageRelPath, pageContent);

  console.log(`[qa] Generating test spec...`);
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