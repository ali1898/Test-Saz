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
      els.map((el: any) => el.href).filter((href: string) => href.startsWith("http"))
    );
    const currentUrl = page.url();
    const forms = await page.$$eval("form", (els, baseUrl: string) =>
      els.map((el: any) => el.action || baseUrl)
    , currentUrl);
    results.push({ url, title, links: [...new Set(links)], forms: [...new Set(forms)] });

    for (const link of links) {
      if (link.startsWith(new URL(url).origin)) {
        await crawlPage(page, link, maxDepth, currentDepth + 1, visited, results);
      }
    }
  } catch (err) {
    console.error(`Failed to crawl ${url}:`, err);
  }
}
