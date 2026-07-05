import { input } from "@inquirer/prompts";
import {
  generateTest,
  generatePage,
  generateLocators,
  generateHelper,
  generateBdd,
  generateAll,
} from "@qa-test-generator/core";
import { ui, withSpinner, chalk } from "../ui";

export type GenerateType = "test" | "page" | "locators" | "helper" | "bdd" | "all";

export interface GenerateOptions {
  type: GenerateType;
  goal?: string;
  /** Project root; defaults to cwd. */
  projectRoot?: string;
  /** Skip the goal prompt (used with --goal). */
  yes?: boolean;
  /** Path to a Structure Guide markdown file. */
  guide?: string;
  /** Test tier for test generation: smoke (default) or regression. */
  tier?: "smoke" | "regression";
  /** URL for the page/feature to analyze (used with "all" type). */
  url?: string;
}

const PROMPTS: Record<GenerateType, string> = {
  test: "Describe the test scenario (e.g. 'verify user can log out from the dashboard'):",
  page: "Describe the page to model (e.g. 'checkout page with cart summary and payment form'):",
  locators: "Describe the elements to capture (e.g. 'header nav bar links and search box'):",
  helper: "Describe the helper purpose (e.g. 'generate random credit card numbers for tests'):",
  bdd: "Describe the feature (e.g. 'user search with filters and sorting'):",
  all: "Describe the page/feature (e.g. 'login page with username/password fields'):",
};

const SUCCESS_LABEL: Record<string, string> = {
  test: "Test spec",
  page: "Page Object",
  locators: "Locators file",
  helper: "Helper module",
  bdd: "BDD feature + steps",
  all: "All artifacts",
};

export async function generateCommand(opts: GenerateOptions): Promise<void> {
  const projectRoot = opts.projectRoot ?? process.cwd();

  const goal =
    opts.goal ?? (opts.yes ? "" : await input({ message: PROMPTS[opts.type] }));
  if (!goal.trim()) {
    ui.error("A description is required. Pass it with --goal or answer the prompt.");
    process.exit(1);
  }

  console.log(chalk.hex("#00d4ff")("\n╭──────────────────────────────────────────────╮"));
  console.log(chalk.hex("#00d4ff")("│") + chalk.bold.white("           🎯 AI Test Generator             ") + chalk.hex("#00d4ff")(" │"));
  console.log(chalk.hex("#00d4ff")("╰──────────────────────────────────────────────╯"));
  console.log(chalk.hex("#48dbfb")("  Project: ") + chalk.dim(projectRoot));
  if (opts.guide) {
    console.log(chalk.hex("#feca57")("  Guide: ") + chalk.dim(opts.guide));
  }
  if (opts.tier) {
    console.log(chalk.hex("#ff9ff3")("  Tier: ") + chalk.dim(opts.tier));
  }
  console.log();

  const baseOptions = { projectRoot, guide: opts.guide, tier: opts.tier };

  if (opts.type === "all") {
    const res = await withSpinner("Generating all artifacts (locators + page + test)…", () =>
      generateAll(goal, { ...baseOptions, url: opts.url }),
    );
    console.log(chalk.green("  ✔ ") + chalk.bold(`${SUCCESS_LABEL.all} created:`));
    for (const p of res.paths) console.log(chalk.green("    ✔ ") + chalk.dim(p));
    console.log();
  } else if (opts.type === "test") {
    const res = await withSpinner("Generating test…", () =>
      generateTest(goal, baseOptions),
    );
    printSingle(res.path, res.content, SUCCESS_LABEL.test);
  } else if (opts.type === "page") {
    const res = await withSpinner("Generating page object…", () =>
      generatePage(goal, baseOptions),
    );
    printSingle(res.path, res.content, SUCCESS_LABEL.page);
  } else if (opts.type === "locators") {
    const res = await withSpinner("Generating locators…", () =>
      generateLocators(goal, baseOptions),
    );
    printSingle(res.path, res.content, SUCCESS_LABEL.locators);
  } else if (opts.type === "helper") {
    const res = await withSpinner("Generating helper…", () =>
      generateHelper(goal, baseOptions),
    );
    printSingle(res.path, res.content, SUCCESS_LABEL.helper);
  } else if (opts.type === "bdd") {
    const res = await withSpinner("Generating BDD feature + steps…", () =>
      generateBdd(goal, baseOptions),
    );
    console.log(chalk.green("  ✔ ") + chalk.bold(`${SUCCESS_LABEL.bdd} created:`));
    for (const p of res.paths) console.log(chalk.green("    ✔ ") + chalk.dim(p));
    console.log();
    if (process.stdout.isTTY) {
      console.log(chalk.hex("#48dbfb")("  ── preview ──"));
      console.log(res.content.split("\n").slice(0, 40).join("\n"));
      console.log(chalk.hex("#48dbfb")("  ── /preview ──\n"));
    }
  }
}

function printSingle(path: string, content: string, label: string): void {
  console.log(chalk.green("  ✔ ") + chalk.bold(label) + chalk.dim(" created"));
  console.log(chalk.underline(`    ${path}`));
  console.log();
  if (process.stdout.isTTY) {
    console.log(chalk.hex("#48dbfb")("  ── preview ──"));
    console.log(content.split("\n").slice(0, 40).join("\n"));
    console.log(chalk.hex("#48dbfb")("  ── /preview ──\n"));
  }
}
