import { chromium, type Browser, type Page } from "playwright";

export interface CrawlElements {
  buttons: string[];
  inputs: { selector: string; type: string; placeholder: string }[];
  selects: string[];
  checkboxes: string[];
  radios: string[];
  textareas: string[];
}

export interface CrawlResult {
  url: string;
  title: string;
  links: string[];
  forms: string[];
  elements: CrawlElements;
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
      els.map((el: any) => el.href).filter((href: string) => href.startsWith("http"))
    );
    const currentUrl = page.url();
    const forms = await page.$$eval("form", (els, baseUrl: string) =>
      els.map((el: any) => el.action || baseUrl)
    , currentUrl);
    const elements = await extractElementsFromPage(page);
    results.push({ url, title, links: [...new Set(links)], forms: [...new Set(forms)], elements });

    for (const link of links) {
      if (link.startsWith(new URL(url).origin)) {
        await crawlPage(page, link, maxDepth, currentDepth + 1, visited, results);
      }
    }
  } catch (err) {
    console.error(`Failed to crawl ${url}:`, err);
  }
}

async function extractElementsFromPage(page: Page): Promise<CrawlElements> {
  const elements: CrawlElements = {
    buttons: [],
    inputs: [],
    selects: [],
    checkboxes: [],
    radios: [],
    textareas: [],
  };

  try {
    // Buttons
    elements.buttons = await page.$$eval("button, [role='button'], input[type='submit'], input[type='button']", (els) =>
      els.map((el: any) => {
        const text = el.textContent?.trim().slice(0, 50) || "";
        const id = el.id ? `#${el.id}` : "";
        const dataCy = el.getAttribute("data-cy") ? `[data-cy="${el.getAttribute("data-cy")}"]` : "";
        const type = el.getAttribute("type") ? `[type="${el.getAttribute("type")}"]` : "";
        return text || id || dataCy || `button${type}`;
      })
    );

    // Inputs (with type and placeholder)
    elements.inputs = await page.$$eval("input:not([type='submit']):not([type='button']):not([type='hidden'])", (els) =>
      els.map((el: any) => ({
        selector: el.id ? `#${el.id}` : el.name ? `[name="${el.name}"]` : el.placeholder ? `[placeholder="${el.placeholder}"]` : `input[type="${el.type || 'text'}"]`,
        type: el.type || "text",
        placeholder: el.placeholder || "",
      }))
    );

    // Selects
    elements.selects = await page.$$eval("select", (els) =>
      els.map((el: any) => el.id ? `#${el.id}` : el.name ? `[name="${el.name}"]` : "select")
    );

    // Checkboxes
    elements.checkboxes = await page.$$eval("input[type='checkbox']", (els) =>
      els.map((el: any) => el.id ? `#${el.id}` : el.name ? `[name="${el.name}"]` : `checkbox_${el.value || 'unknown'}`)
    );

    // Radios
    elements.radios = await page.$$eval("input[type='radio']", (els) =>
      els.map((el: any) => el.id ? `#${el.id}` : el.name ? `[name="${el.name}"]` : `radio_${el.value || 'unknown'}`)
    );

    // Textareas
    elements.textareas = await page.$$eval("textarea", (els) =>
      els.map((el: any) => el.id ? `#${el.id}` : el.name ? `[name="${el.name}"]` : el.placeholder ? `[placeholder="${el.placeholder}"]` : "textarea")
    );
  } catch {
    // Silently ignore extraction errors
  }

  return elements;
}
