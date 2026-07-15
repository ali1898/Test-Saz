import { input, select } from "@inquirer/prompts";
import { readFileSync } from "node:fs";
import {
  generateTest,
  generatePage,
  generateLocators,
  generateHelper,
  generateBdd,
  generateAll,
  generateCommand as coreGenerateCommand,
} from "@testsaz/core";
import { ui, withSpinner, chalk } from "../ui";

export type GenerateType = "test" | "page" | "locators" | "helper" | "bdd" | "all" | "command";

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
  /** Pre-written scenario (skips Phase 0). */
  scenario?: string;
  /** Read scenario from this file instead of Phase 0. */
  scenarioFile?: string;
  /** Override name for file/class naming (instead of deriving from goal). */
  name?: string;
}

const PROMPTS: Record<GenerateType, string> = {
  test: "Describe the test scenario (e.g. 'verify user can log out from the dashboard'):",
  page: "Describe the page to model (e.g. 'checkout page with cart summary and payment form'):",
  locators: "Describe the elements to capture (e.g. 'header nav bar links and search box'):",
  helper: "Describe the helper purpose (e.g. 'generate random credit card numbers for tests'):",
  command: "Describe the custom command (e.g. 'login via API with username/password'):",
  bdd: "Describe the feature (e.g. 'user search with filters and sorting'):",
  all: "Describe the page/feature (e.g. 'login page with username/password fields'):",
};

const SUCCESS_LABEL: Record<string, string> = {
  test: "Test spec",
  page: "Page Object",
  locators: "Locators file",
  helper: "Helper module",
  command: "Custom command",
  bdd: "BDD feature + steps",
  all: "All artifacts",
};

async function promptOptional(message: string): Promise<string> {
  const value = await input({ message });
  return value.trim();
}

export async function generateCommand(opts: GenerateOptions): Promise<void> {
  const projectRoot = opts.projectRoot ?? process.cwd();

  let goal = opts.goal;
  if (goal === undefined && !opts.yes) {
    goal = await promptOptional(PROMPTS[opts.type]);
    if (!goal) {
      ui.error("A description is required.");
      process.exit(1);
    }
  } else if (goal === undefined) {
    goal = "";
  }

  let url = opts.url;
  if (!url && !opts.yes) {
    url = await promptOptional("Enter the page URL to analyze (e.g. 'http://localhost:3000/login'):");
  }

  // ── Interactive prompts specific to "all" type ──
  let scenario = opts.scenario;
  let name = opts.name;
  let tier = opts.tier;

  if (opts.type === "all" && !opts.yes) {
    if (!opts.name) {
      name = await promptOptional("Override name for file/class naming (leave empty to derive from goal):");
    }

    if (!opts.scenario && !opts.scenarioFile) {
      const scenarioSrc = await select({
        message: "How to provide the scenario?",
        choices: [
          { name: "Let AI generate it (Phase 0)", value: "auto" },
          { name: "Type it in now", value: "inline" },
          { name: "Read from a file", value: "file" },
        ],
      });
      if (scenarioSrc === "inline") {
        scenario = await promptOptional("Paste the scenario (Markdown with **bold** actions/elements):");
      } else if (scenarioSrc === "file") {
        const filePath = await promptOptional("Path to scenario file:");
        if (filePath) {
          try {
            scenario = readFileSync(filePath, "utf-8");
          } catch (err) {
            ui.error(`Failed to read scenario file: ${err}`);
            process.exit(1);
          }
        }
      }
    }

    if (!opts.tier) {
      tier = await select<"smoke" | "regression">({
        message: "Test tier:",
        choices: [
          { name: "Smoke (default)", value: "smoke" },
          { name: "Regression", value: "regression" },
        ],
      });
    }
  }

  console.log(chalk.hex("#00d4ff")("\n╭──────────────────────────────────────────────╮"));
  console.log(chalk.hex("#00d4ff")("│") + chalk.bold.white("           🎯 AI Test Generator             ") + chalk.hex("#00d4ff")(" │"));
  console.log(chalk.hex("#00d4ff")("╰──────────────────────────────────────────────╯"));
  console.log(chalk.hex("#48dbfb")("  Project: ") + chalk.dim(projectRoot));
  if (opts.guide) {
    console.log(chalk.hex("#feca57")("  Guide: ") + chalk.dim(opts.guide));
  }
  if (tier) {
    console.log(chalk.hex("#ff9ff3")("  Tier: ") + chalk.dim(tier));
  }
  if (name) {
    console.log(chalk.hex("#feca57")("  Name: ") + chalk.dim(name));
  }
  if (scenario) {
    console.log(chalk.hex("#48dbfb")("  Scenario: ") + chalk.dim("provided"));
  }
  console.log();

  // ── Handle --scenario-file for non-interactive mode ──
  if (!scenario && opts.scenarioFile) {
    try {
      scenario = readFileSync(opts.scenarioFile, "utf-8");
    } catch (err) {
      ui.error(`Failed to read scenario file: ${err}`);
      process.exit(1);
    }
  }

  const baseOptions = { projectRoot, guide: opts.guide, tier, url, scenario, name };

  if (opts.type === "all") {
    const res = await withSpinner("Generating all artifacts (locators + page + test)…", () =>
      generateAll(goal, { ...baseOptions, url, scenario, name } as Parameters<typeof generateAll>[1]),
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
  } else if (opts.type === "command") {
    const res = await withSpinner("Generating custom command…", () =>
      coreGenerateCommand(goal, baseOptions),
    );
    console.log(chalk.green("  ✔ ") + chalk.bold(`${SUCCESS_LABEL.command} created:`));
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
