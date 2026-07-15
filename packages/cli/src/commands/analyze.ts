import { input, select, confirm } from "@inquirer/prompts";
import { resolve, dirname } from "node:path";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { analyzePage, analyzeAndGenerate, generateScenarioFromAnalysis, type PageAnalysis, type AuthOptions, type StepsConfig } from "@testsaz/core";
import { ui, withSpinner, chalk, createProgressIndicator } from "../ui";

export interface AnalyzeOptions {
  url?: string;
  projectRoot?: string;
  name?: string;
  guide?: string;
  tier?: "smoke" | "regression";
  yes?: boolean;
  output?: "all" | "locators" | "page" | "test" | "none";
  // Auth options
  loginUrl?: string;
  username?: string;
  password?: string;
  usernameSelector?: string;
  passwordSelector?: string;
  loginButtonSelector?: string;
  waitForSelector?: string;
  // Scenario
  scenario?: string;
  scenarioFile?: string;
  // Scenario output
  scenarioOutput?: string;
  // Debug
  debug?: boolean;
  // Interactive
  interactive?: boolean;
  stepsFile?: string;
}

const SKIP_WORDS = ["optional", "none", "skip", "no", "n/a", "-"];

async function promptOptional(message: string): Promise<string> {
  const value = await input({ message });
  const cleaned = value.trim().replace(/^['"]|['"]$/g, "");
  if (SKIP_WORDS.includes(cleaned.toLowerCase())) return "";
  return cleaned;
}

async function promptPassword(message: string): Promise<string> {
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

  // Authentication options
  let auth: AuthOptions | undefined;
  const hasExplicitAuth = !!(opts.loginUrl || opts.username || opts.password);
  
  if (hasExplicitAuth) {
    // Auth provided via flags - use them directly
    auth = {
      loginUrl: opts.loginUrl,
      username: opts.username,
      password: opts.password,
      usernameSelector: opts.usernameSelector,
      passwordSelector: opts.passwordSelector,
      loginButtonSelector: opts.loginButtonSelector,
      waitForSelector: opts.waitForSelector,
    };
  } else if (!opts.yes) {
    // No explicit auth - ask interactively
    const useAuth = await confirm({ message: "Does this page require authentication?", default: false });
    if (useAuth) {
      auth = {};
      console.log(chalk.hex("#feca57")("  Note: Provide the exact login page URL (e.g., 'http://site.com/login', not the site root)"));
      auth.loginUrl = await promptOptional("Login page URL (where username/password fields are):");
      if (auth.loginUrl) {
        auth.username = await promptOptional("Username/email:");
        if (auth.username) {
          auth.password = await promptPassword("Password:");
        }
        auth.usernameSelector = await promptOptional("Username field selector (optional, press Enter for auto-detect):") || undefined;
        auth.passwordSelector = await promptOptional("Password field selector (optional, press Enter for auto-detect):") || undefined;
        auth.loginButtonSelector = await promptOptional("Login button selector (optional, press Enter for auto-detect):") || undefined;
        auth.waitForSelector = await promptOptional("Selector to wait for after login (e.g., dashboard element, optional):") || undefined;
      }
    }
  }

  let name = opts.name;
  if (!name && !opts.yes) {
    name = await promptOptional("Override name for file/class naming (leave empty to derive from page title):");
  }

  let tier = opts.tier;
  if (!tier && !opts.yes) {
    const tierChoice = await select<"smoke" | "regression">({
      message: "Test tier:",
      choices: [
        { name: "Smoke (default)", value: "smoke" },
        { name: "Regression", value: "regression" },
      ],
      default: "smoke",
    });
    tier = tierChoice;
  }

  const output = opts.output ?? "all";

  // Scenario input: --scenario (inline) or --scenario-file
  let scenario = opts.scenario;
  if (opts.scenarioFile) {
    const filePath = resolve(projectRoot, opts.scenarioFile);
    try {
      scenario = readFileSync(filePath, "utf-8");
      if (opts.debug) console.log(`[qa] DEBUG: Loaded scenario from ${filePath} (${scenario.length} chars)`);
    } catch (err) {
      ui.error(`Scenario file not found: ${filePath}`);
      process.exit(1);
    }
  } else if (!scenario && !opts.yes && output !== "none") {
    const useScenario = await confirm({ message: "Do you have a scenario file? (generates focused artifacts)", default: false });
    if (useScenario) {
      const scenarioPath = await promptOptional("Scenario file path (e.g., 'scenarios/addMember.md'):");
      if (scenarioPath) {
        const filePath = resolve(projectRoot, scenarioPath);
        try {
          scenario = readFileSync(filePath, "utf-8");
          if (opts.debug) console.log(`[qa] DEBUG: Loaded scenario from ${filePath} (${scenario.length} chars)`);
        } catch (err) {
          ui.error(`Scenario file not found: ${filePath}`);
          process.exit(1);
        }
      }
    }
  }

  // Scenario output option
  let scenarioOutput = opts.scenarioOutput;
  if (!scenarioOutput && !opts.yes && output !== "none") {
    const saveScenario = await confirm({ message: "Save generated scenario to file for use with 'qa generate all'?", default: true });
    if (saveScenario) {
      scenarioOutput = await promptOptional("Scenario file path (e.g., 'scenarios/login.md'):") || "scenarios/analyzed-scenario.md";
    }
  }

  // Steps file
  let stepsConfig: StepsConfig | undefined;
  if (opts.stepsFile) {
    const stepsPath = resolve(projectRoot, opts.stepsFile);
    stepsConfig = JSON.parse(readFileSync(stepsPath, "utf-8"));
  }

  console.log();
  console.log(chalk.dim("  project:") + `  ${resolve(projectRoot)}`);
  console.log(chalk.dim("  url:") + `        ${url}`);
  if (auth?.loginUrl) console.log(chalk.dim("  login:") + `       ${auth.loginUrl}`);
  if (name) console.log(chalk.dim("  name:") + `       ${name}`);
  if (tier) console.log(chalk.dim("  tier:") + `       ${tier}`);
  console.log(chalk.dim("  output:") + `     ${output}`);
  if (scenario) console.log(chalk.dim("  mode:") + `       scenario-based (focused artifacts)`);
  if (scenarioOutput) console.log(chalk.dim("  scenario:") + `   ${scenarioOutput}`);
  console.log();

  try {
    // In interactive mode, skip the spinner because ora conflicts with
    // process.stdin reading on Windows (spinner blocks the ENTER key).
    let result;
    if (opts.interactive) {
      const progress = createProgressIndicator(`Analyzing ${url} and generating artifacts`);
      result = await analyzeAndGenerate(url!, {
        projectRoot,
        name,
        guide: opts.guide,
        tier,
        auth,
        scenario,
        debug: opts.debug,
        interactive: opts.interactive,
        steps: stepsConfig,
      });
      progress.stop("Page analyzed & artifacts generated");
    } else {
      result = await withSpinner(`Analyzing ${url} and generating artifacts…`, async () => {
        return analyzeAndGenerate(url!, {
          projectRoot,
          name,
          guide: opts.guide,
          tier,
          auth,
          scenario,
          debug: opts.debug,
          interactive: opts.interactive,
          steps: stepsConfig,
        });
      });
    }

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
      const testPath = result.paths.find((p) => p.includes("/test/") || p.endsWith(".cy.ts"));
      if (testPath) console.log(chalk.green("  ✔ ") + chalk.dim(testPath));
    }

    // Generate and save scenario if requested
    if (scenarioOutput) {
      const pageName = opts.name || result.analysis.title || "AnalyzedPage";
      const scenario = generateScenarioFromAnalysis(result.analysis, pageName);
      const fullPath = resolve(projectRoot, scenarioOutput);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, scenario, "utf-8");
      console.log(chalk.green("  ✔ ") + chalk.dim(fullPath) + chalk.hex("#feca57")(" (scenario)"));
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
    if (scenarioOutput) {
      console.log(chalk.dim(`    3. Edit scenario: ${scenarioOutput}`));
      console.log(chalk.dim(`    4. Run: qa g all --scenario-file ${scenarioOutput} --name "YourPageName"`));
    } else {
      console.log(chalk.dim("    3. Run tests: npm run cy:smoke"));
    }
    console.log();
  } catch (err) {
    ui.error(`Analysis failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}