import { chromium, type Browser, type Page } from "playwright";
import { getActiveProvider } from "../llm";
import type { LLMProvider } from "../llm/types";
import { buildSystemPrompt } from "./prompts";
import { generateAll, type GenerateOptions } from "./generate";
import { loadStructureGuide, findNearestGuide } from "./structure-guide";

const CHROMIUM_PATH = "/usr/bin/chromium-browser";

export interface HybridOptions {
  projectRoot: string;
  provider?: LLMProvider;
  guide?: string;
  tier?: "smoke" | "regression";
  auth?: {
    loginUrl?: string;
    username?: string;
    password?: string;
    usernameSelector?: string;
    passwordSelector?: string;
    loginButtonSelector?: string;
    waitForSelector?: string;
  };
  debug?: boolean;
}

interface PageData {
  url: string;
  title: string;
  elements: {
    buttons: string[];
    inputs: { selector: string; type: string; placeholder: string }[];
    selects: string[];
    checkboxes: string[];
    radios: string[];
    textareas: string[];
  };
}

async function analyzePageForHybrid(page: Page, url: string): Promise<PageData> {
  const title = await page.title();

  const elements = {
    buttons: await page.$$eval("button, [role='button'], input[type='submit'], input[type='button']", (els) =>
      els.map((el: any) => {
        const text = el.textContent?.trim().slice(0, 50) || "";
        const id = el.id ? `#${el.id}` : "";
        const dataCy = el.getAttribute("data-cy") ? `[data-cy="${el.getAttribute("data-cy")}"]` : "";
        return text || id || dataCy || "button";
      })
    ),
    inputs: await page.$$eval("input:not([type='submit']):not([type='button']):not([type='hidden'])", (els) =>
      els.map((el: any) => ({
        selector: el.id ? `#${el.id}` : el.name ? `[name="${el.name}"]` : el.placeholder ? `[placeholder="${el.placeholder}"]` : `input[type="${el.type || 'text'}"]`,
        type: el.type || "text",
        placeholder: el.placeholder || "",
      }))
    ),
    selects: await page.$$eval("select", (els) =>
      els.map((el: any) => el.id ? `#${el.id}` : el.name ? `[name="${el.name}"]` : "select")
    ),
    checkboxes: await page.$$eval("input[type='checkbox']", (els) =>
      els.map((el: any) => el.id ? `#${el.id}` : el.name ? `[name="${el.name}"]` : `checkbox_${el.value || 'unknown'}`)
    ),
    radios: await page.$$eval("input[type='radio']", (els) =>
      els.map((el: any) => el.id ? `#${el.id}` : el.name ? `[name="${el.name}"]` : `radio_${el.value || 'unknown'}`)
    ),
    textareas: await page.$$eval("textarea", (els) =>
      els.map((el: any) => el.id ? `#${el.id}` : el.name ? `[name="${el.name}"]` : el.placeholder ? `[placeholder="${el.placeholder}"]` : "textarea")
    ),
  };

  return { url, title, elements };
}

function sanitizeName(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9\u0600-\u06FF]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

export async function hybridGenerate(
  url: string,
  options: HybridOptions
): Promise<{ paths: string[] }> {
  const provider = options.provider ?? getActiveProvider();
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

    // Handle authentication
    if (options.auth?.loginUrl && options.auth?.username && options.auth?.password) {
      await page.goto(options.auth.loginUrl, { waitUntil: "networkidle", timeout: 60000 });
      const userSel = options.auth.usernameSelector || 'input[type="email"], input[type="text"], input[name*="user" i]';
      const passSel = options.auth.passwordSelector || 'input[type="password"]';
      const btnSel = options.auth.loginButtonSelector || 'button[type="submit"]';
      await page.waitForSelector(userSel, { timeout: 30000 });
      await page.fill(userSel, options.auth.username);
      await page.fill(passSel, options.auth.password);
      await page.click(btnSel);
      await page.waitForLoadState("networkidle");
    }

    // Navigate to target page
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForLoadState("domcontentloaded");

    // Analyze page with Playwright (real DOM data)
    const pageData = await analyzePageForHybrid(page, url);

    // Build element summary for LLM
    const elementParts: string[] = [];
    if (pageData.elements.buttons.length > 0) elementParts.push(`Buttons: ${pageData.elements.buttons.join(", ")}`);
    if (pageData.elements.inputs.length > 0) elementParts.push(`Inputs: ${pageData.elements.inputs.map((i) => `${i.selector} (${i.type})`).join(", ")}`);
    if (pageData.elements.selects.length > 0) elementParts.push(`Selects: ${pageData.elements.selects.join(", ")}`);
    if (pageData.elements.checkboxes.length > 0) elementParts.push(`Checkboxes: ${pageData.elements.checkboxes.join(", ")}`);
    if (pageData.elements.radios.length > 0) elementParts.push(`Radios: ${pageData.elements.radios.join(", ")}`);
    if (pageData.elements.textareas.length > 0) elementParts.push(`Textareas: ${pageData.elements.textareas.join(", ")}`);

    // Convert to CrawlElements format for generateAll
    const detectedElements = {
      buttons: pageData.elements.buttons,
      inputs: pageData.elements.inputs,
      selects: pageData.elements.selects,
      checkboxes: pageData.elements.checkboxes,
      radios: pageData.elements.radios,
      textareas: pageData.elements.textareas,
    };

    const name = options.guide
      ? sanitizeName(pageData.title || "page")
      : sanitizeName(pageData.title || "page");

    // Use generateAll with detected elements
    const result = await generateAll(pageData.title || url, {
      projectRoot: options.projectRoot,
      provider,
      guide: options.guide,
      tier: options.tier,
      url,
      name,
      detectedElements,
    });

    return { paths: result.paths };
  } finally {
    if (browser) await browser.close();
  }
}
