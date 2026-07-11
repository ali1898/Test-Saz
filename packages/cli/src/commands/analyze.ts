import { input } from "@inquirer/prompts";
import { resolve } from "node:path";
import { analyzePage, analyzeAndGenerate, type PageAnalysis } from "@qa-test-generator/core";
import { ui, withSpinner, chalk } from "../ui";

export interface AnalyzeOptions {
  url?: string;
  projectRoot?: string;
  name?: string;
  guide?: string;
  tier?: "smoke" | "regression";
  yes?: boolean;
  output?: "all" | "locators" | "page" | "test" | "none";
}

async function promptOptional(message: string): Promise<string> {
  const value = await input({ message });
  return value.trim();
}

export async function analyzeCommand(opts: AnalyzeOptions): Promise<void> {
  console.log(
    chalk.hex("#00d4ff")(`
╭──────────────────────────────────────────────╮
│                                              │
│   🔍  QA Page Analyzer                       │
│                                              │
╰──────────────────────────────────────────────╯
`)
  );
  ui.header("Analyze a web page and generate test artifacts");

  const projectRoot = opts.projectRoot ?? process.cwd();

  let url = opts.url;
  if (!url && !opts.yes) {
    url = await promptOptional("Enter the page URL to analyze (e.g. 'http://localhost:3000/login'):");
    if (!url) {
      ui.error("A URL is required.");
      process.exit(1);
    }
  } else if (!url) {
    ui.error("URL is required. Use --url or run interactively.");
    process.exit(1);
  }

  let name = opts.name;
  if (!name && !opts.yes) {
    name = await promptOptional("Override name for file/class naming (leave empty to derive from page title):");
  }

  let tier = opts.tier;
  if (!tier && !opts.yes) {
    const tierChoice = await input({
      message: "Test tier:",
      default: "smoke",
    });
    tier = tierChoice.toLowerCase() as "smoke" | "regression";
    if (!["smoke", "regression"].includes(tier)) tier = "smoke";
  }

  const output = opts.output ?? "all";

  console.log();
  console.log(chalk.dim("  project:") + `  ${resolve(projectRoot)}`);
  console.log(chalk.dim("  url:") + `        ${url}`);
  if (name) console.log(chalk.dim("  name:") + `       ${name}`);
  if (tier) console.log(chalk.dim("  tier:") + `       ${tier}`);
  console.log(chalk.dim("  output:") + `     ${output}`);
  console.log();

  try {
    const result = await withSpinner(`Analyzing ${url} and generating artifacts…`, async () => {
      return analyzeAndGenerate(url!, {
        projectRoot,
        name,
        guide: opts.guide,
        tier,
      });
    });

    console.log();
    ui.success("Analysis complete! Generated artifacts:");

    if (output === "all" || output === "locators") {
      const locPath = result.paths.find((p) => p.includes("locators"));
      if (locPath) console.log(chalk.green("  ✔ ") + chalk.dim(locPath));
    }
    if (output === "all" || output === "page") {
      const pagePath = result.paths.find((p) => p.includes("pages"));
      if (pagePath) console.log(chalk.green("  ✔ ") + chalk.dim(pagePath));
    }
    if (output === "all" || output === "test") {
      const testPath = result.paths.find((p) => p.includes("test"));
      if (testPath) console.log(chalk.green("  ✔ ") + chalk.dim(testPath));
    }

    console.log();
    console.log(chalk.hex("#48dbfb")("  📊 Page Analysis Summary"));
    console.log(chalk.dim("  ─────────────────────────────────────────────"));
    console.log(chalk.dim(`  Title: ${result.analysis.title}`));
    console.log(chalk.dim(`  Forms: ${result.analysis.forms.length}`));
    console.log(chalk.dim(`  Buttons: ${result.analysis.buttons.length}`));
    console.log(chalk.dim(`  Inputs: ${result.analysis.inputs.length}`));
    console.log(chalk.dim(`  Links: ${result.analysis.links.length}`));
    console.log(chalk.dim(`  Selects: ${result.analysis.selects.length}`));
    console.log(chalk.dim(`  Checkboxes: ${result.analysis.checkboxes.length}`));
    console.log(chalk.dim(`  Radios: ${result.analysis.radios.length}`));
    console.log(chalk.dim(`  Textareas: ${result.analysis.textareas.length}`));
    console.log(chalk.dim("  ─────────────────────────────────────────────"));

    console.log();
    console.log(chalk.hex("#feca57")("  💡 Next steps:"));
    console.log(chalk.dim("    1. Review generated locators in cypress/e2e/locators/"));
    console.log(chalk.dim("    2. Adjust selectors if needed (prefer data-cy attributes)"));
    console.log(chalk.dim("    3. Run tests: npm run cy:smoke"));
    console.log();
  } catch (err) {
    ui.error(`Analysis failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}