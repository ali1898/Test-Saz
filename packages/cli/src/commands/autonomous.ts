import { input, number } from "@inquirer/prompts";
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
    const answer = await number({ message: "Crawl depth:", default: 1, min: 1, max: 3 });
    if (answer !== undefined) depth = answer;
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

  console.log(chalk.yellow("\n  Test generation for crawled pages coming soon...\n"));
}
