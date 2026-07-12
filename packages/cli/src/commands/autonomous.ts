import { input, number, confirm } from "@inquirer/prompts";
import { resolve } from "node:path";
import { crawlSite, generateAll, getActiveProvider } from "@qa-test-generator/core";
import { ui, withSpinner, chalk } from "../ui";

export interface AutonomousOptions {
  baseUrl?: string;
  depth?: number;
  projectRoot?: string;
  yes?: boolean;
  /** Generate tests only for pages with forms */
  formsOnly?: boolean;
  /** Test tier */
  tier?: "smoke" | "regression";
}

function sanitizeName(title: string): string {
  return title
    .replace(/[^a-zA-Z0-9\u0600-\u06FF]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

export async function autonomousCommand(opts: AutonomousOptions): Promise<void> {
  let baseUrl = opts.baseUrl;
  let depth = opts.depth ?? 1;
  const projectRoot = resolve(opts.projectRoot ?? process.cwd());
  const tier = opts.tier ?? "smoke";

  if (!baseUrl && !opts.yes) {
    baseUrl = await input({ message: "Base URL to crawl (e.g., http://localhost:3000):" });
  }

  if (!baseUrl) {
    ui.error("Base URL is required. Use --base-url or provide it interactively.");
    process.exit(1);
  }

  if (!opts.yes) {
    const answer = await number({ message: "Crawl depth:", default: 1, min: 1, max: 3 });
    if (answer !== undefined) depth = answer;
  }

  console.log(chalk.bold("\n  Autonomous Generation\n"));
  console.log(chalk.dim("  base URL:") + `  ${baseUrl}`);
  console.log(chalk.dim("  depth:") + `     ${depth}`);
  console.log(chalk.dim("  tier:") + `     ${tier}`);
  console.log();

  // Phase 1: Crawl
  const results = await withSpinner("Crawling site...", async () => {
    return crawlSite(baseUrl!, depth);
  });

  console.log(chalk.green(`  Found ${results.length} pages\n`));

  // Filter pages: only generate tests for pages with forms (more interesting)
  const pagesToTest = opts.formsOnly
    ? results.filter((r) => r.forms.length > 0)
    : results.filter((r) => r.title || r.forms.length > 0);

  if (pagesToTest.length === 0) {
    console.log(chalk.yellow("  No pages with forms found. Nothing to generate.\n"));
    return;
  }

  // Show discovered pages
  for (const result of pagesToTest) {
    console.log(chalk.cyan(`  ${result.title || "Untitled"}`));
    console.log(chalk.dim(`    URL: ${result.url}`));
    console.log(chalk.dim(`    Links: ${result.links.length}, Forms: ${result.forms.length}`));
  }
  console.log();

  // Phase 2: Generate tests for each page
  if (!opts.yes) {
    const generate = await confirm({
      message: `Generate tests for ${pagesToTest.length} page(s)?`,
      default: true,
    });
    if (!generate) {
      console.log(chalk.yellow("  Skipped test generation.\n"));
      return;
    }
  }

  const provider = getActiveProvider();
  const generatedPaths: string[] = [];

  for (let i = 0; i < pagesToTest.length; i++) {
    const page = pagesToTest[i];
    const pageName = sanitizeName(page.title) || `Page${i + 1}`;

    console.log(chalk.dim(`  [${i + 1}/${pagesToTest.length}] Generating tests for ${pageName}...`));

    try {
      const result = await generateAll(page.title || page.url, {
        projectRoot,
        provider,
        url: page.url,
        name: pageName,
        tier,
        detectedElements: page.elements,
      });

      generatedPaths.push(...result.paths);
      console.log(chalk.green(`  ✔ ${pageName}`));
      for (const p of result.paths) {
        console.log(chalk.dim(`    → ${p}`));
      }
    } catch (err) {
      console.log(chalk.red(`  ✘ ${pageName}: ${err instanceof Error ? err.message : String(err)}`));
    }
  }

  // Summary
  console.log(chalk.bold(`\n  Summary\n`));
  console.log(chalk.dim("  pages crawled:") + `  ${results.length}`);
  console.log(chalk.dim("  tests generated:") + ` ${generatedPaths.length}`);
  console.log(chalk.dim("  project root:") + `  ${projectRoot}`);
  console.log();
}
