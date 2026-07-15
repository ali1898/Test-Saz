#!/usr/bin/env node
import { Command } from "commander";
import type { ProjectLanguage } from "@testsaz/core";
import { CORE_VERSION } from "@testsaz/core";
import { ui, chalk } from "./ui";
import { configCommand } from "./commands/config";
import { newCommand, type NewOptions } from "./commands/new";
import { generateCommand, type GenerateType } from "./commands/generate";
import { analyzeCommand, type AnalyzeOptions } from "./commands/analyze";
import { chatCommand } from "./commands/chat";
import { docsCommand, type DocsOptions } from "./commands/docs";
import { modelsCommand } from "./commands/models";
import { generateGuideCommand } from "./commands/generate-guide";
import { scenarioCommand, type ScenarioOptions } from "./commands/scenario";
import { autonomousCommand, type AutonomousOptions } from "./commands/autonomous";
import { fixCommand, type FixOptions } from "./commands/fix";
import { hybridCommand, type HybridOptions } from "./commands/hybrid";
import { stepsCommand, type StepsOptions } from "./commands/steps";

const BANNER =
    chalk.hex("#ffffff")("\n████████ ") +
      chalk.hex("#ffffff")("███████ ") +
      chalk.hex("#ffffff")("███████ ") +
      chalk.hex("#ffffff")("████████ ") +
      chalk.hex("#ffffff")("███████ ") +
      chalk.hex("#ffffff")(" █████  ") +
      chalk.hex("#ffffff")("███████") + "\n" +

      chalk.hex("#ffffff")("   ██    ") +
      chalk.hex("#ffffff")("██      ") +
      chalk.hex("#ffffff")("██      ") +
      chalk.hex("#ffffff")("   ██    ") +
      chalk.hex("#ffffff")("██      ") +
      chalk.hex("#ffffff")("██   ██ ") +
      chalk.hex("#ffffff")("    ██") + "\n" +

      chalk.hex("#ffffff")("   ██    ") +
      chalk.hex("#ffffff")("█████   ") +
      chalk.hex("#ffffff")("███████ ") +
      chalk.hex("#ffffff")("   ██    ") +
      chalk.hex("#ffffff")("███████ ") +
      chalk.hex("#ffffff")("███████ ") +
      chalk.hex("#ffffff")("  ██") + "\n" +

      chalk.hex("#ffffff")("   ██    ") +
      chalk.hex("#ffffff")("██      ") +
      chalk.hex("#ffffff")("     ██ ") +
      chalk.hex("#ffffff")("   ██    ") +
      chalk.hex("#ffffff")("     ██ ") +
      chalk.hex("#ffffff")("██   ██ ") +
      chalk.hex("#ffffff")("██") + "\n" +

      chalk.hex("#ffffff")("   ██    ") +
      chalk.hex("#ffffff")("███████ ") +
      chalk.hex("#ffffff")("███████ ") +
      chalk.hex("#ffffff")("   ██    ") +
      chalk.hex("#ffffff")("███████ ") +
      chalk.hex("#ffffff")("██   ██ ") +
      chalk.hex("#ffffff")("███████\n") +

  chalk.dim(`  \n\t${chalk.bold.white("AI-Powered Cypress Test Generator")} v${CORE_VERSION}\n`) +
  chalk.hex("#ffffff")(" \t\tPOM") + chalk.dim(" + ") +
  chalk.hex("#ffffff")("BDD") + chalk.dim(" + ") +
  chalk.hex("#ffffff")("Allure") + chalk.dim(" + ") +
  chalk.hex("#ffffff")("AI") +
  "\n";

const program = new Command();

program
  .name("qa")
  .description("AI-Powered Cypress Test Generator")
  .version(CORE_VERSION)
  .addHelpText("before", BANNER)
  .addHelpText(
    "after",
    `\n${chalk.dim("Run 'qa examples' for detailed usage examples with all flags.")}\n`,
  )
  .hook("preAction", () => {
    // Reserved for future global checks.
  });

// ── qa examples ──────────────────────────────────────────────────────────
program
  .command("examples")
  .description("Show detailed usage examples for all commands")
  .action(() => {
    console.log(`
${chalk.bold.white("Usage:")} qa <command> [options]

${chalk.bold.hex("#48dbfb")("Commands:")}
  ${chalk.bold("new")}              Scaffold a Cypress project
  ${chalk.bold("generate")} / ${chalk.bold("g")}     Generate tests with AI ${chalk.dim("(test|page|locators|helper|command|bdd|all)")}
  ${chalk.bold("analyze")}          Analyze a web page & generate artifacts
  ${chalk.bold("hybrid")}           Playwright + AI generation ${chalk.dim("(best accuracy)")}
  ${chalk.bold("autonomous")}       Crawl site & discover pages
  ${chalk.bold("scenario")}         Write AI-generated scenarios
  ${chalk.bold("fix")}              Fix failing tests with AI
  ${chalk.bold("chat")}             Interactive QA assistant
  ${chalk.bold("docs")}             Generate documentation
  ${chalk.bold("config")}           Manage LLM providers
  ${chalk.bold("models")}           List available models
  ${chalk.bold("steps")}            Generate interaction steps JSON

${chalk.bold.hex("#48dbfb")("Examples:")}
  ${chalk.dim("# \u2014 Scaffold a project \u2014")}
  $ qa new
  $ qa new --name my-app -l typescript --bdd --allure -y
  $ qa new --name my-app --llm-wiki
  $ qa new --name my-app --scenarios -y

  ${chalk.dim("# \u2014 Generate artifacts with AI \u2014")}
  $ qa g test -g "login with empty fields should show error"
  $ qa g page -g "user profile page"
  $ qa g bdd -g "checkout with valid coupon"
  $ qa g all -g "login page" -u "http://localhost:3000"
  $ qa g locators -g "checkout form elements" --guide ./guides/my-guide.md
  $ qa g command -g "login via API with username/password"

  ${chalk.dim("# \u2014 Use a pre-written scenario (skip Phase 0) \u2014")}
  $ qa g all -g "login" --scenario "1. **Visit** /login\\n2. **Type** \\"admin\\" into **username input**\\n3. **Click** **login button**"
  $ qa g all -g "login" --scenario-file ./scenario.md --name "LoginPage"

  ${chalk.dim("# \u2014 Use --name for clean file/class naming with non-English goals \u2014")}
  $ qa g all -g "\u0648\u0631\u0648\u062F \u0628\u0627 \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0648 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631" --name "LoginPage" -u "http://localhost:3000/login"

  ${chalk.dim("# \u2014 Generate everything at once \u2014")}
  $ qa g all -g "login page with username, password, and remember-me" -u "http://localhost:3000"

  ${chalk.dim("# \u2014 Analyze a live page & generate artifacts \u2014")}
  $ qa analyze -u "https://example.com/login" -n "LoginPage"
  $ qa analyze --url "http://localhost:3000/checkout" --tier regression
  $ qa analyze                           ${chalk.dim("(interactive)")}

  ${chalk.dim("# \u2014 Analyze pages requiring authentication \u2014")}
  $ qa analyze -u "https://app.example.com/dashboard" \\
      --login-url "https://app.example.com/login" \\
      --username "admin" --password "secret" \\
      --wait-for-selector ".dashboard-header" \\
      --scenario-output "scenarios/dashboard.md" -y

  ${chalk.dim("# \u2014 Full workflow: analyze \u2192 scenario \u2192 generate \u2014")}
  $ qa analyze -u "https://app.example.com/checkout" \\
      --login-url "https://app.example.com/login" \\
      --username "user" --password "pass" \\
      --scenario-output "scenarios/checkout.md" -y
  ${chalk.dim("#   (edit scenarios/checkout.md if needed)")}
  $ qa g all --scenario-file scenarios/checkout.md --name "CheckoutPage" -y

  ${chalk.dim("# \u2014 Scenario-based analyze \u2014")}
  $ qa analyze -u "http://app.example.com/Events/AddMember" \\
      --login-url "http://app.example.com/login" \\
      --username "user" --password "pass" \\
      --scenario-file scenarios/addMember.md \\
      --name "AddMember" -y

  ${chalk.dim("# \u2014 Learn from existing projects \u2014")}
  $ qa gg                       ${chalk.dim("(interactive)")}
  $ qa gg -p ./my-project -o ./guides/my-guide.md -y
  $ qa g test -g "login test" --guide ./guides/my-guide.md

  ${chalk.dim("# \u2014 Chat with context \u2014")}
  $ qa chat --guide ./guides/my-guide.md

  ${chalk.dim("# \u2014 Docs & config \u2014")}
  $ qa docs                     ${chalk.dim("(interactive)")}
  $ qa docs -y                  ${chalk.dim("(use defaults)")}
  $ qa docs --confluence --confluence-config ./confluence.json
  $ qa config
  $ qa models

  ${chalk.dim("# \u2014 Write scenarios \u2014")}
  $ qa scenario                 ${chalk.dim("(interactive \u2014 describe \u2192 generate \u2192 refine \u2192 save)")}
  $ qa scenario -g "checkout with coupon code" -y
  $ qa scenario --guide ./my-guide.md

  ${chalk.dim("# \u2014 Autonomous generation \u2014")}
  $ qa auto -u "http://localhost:3000" --depth 2 -y
  $ qa auto -u "http://localhost:3000" --forms-only --tier regression -y

  ${chalk.dim("# \u2014 Hybrid generation (Playwright + AI) \u2014")}
  $ qa hybrid -u "http://localhost:3000/login" -n "LoginPage" -y
  $ qa hybrid -u "http://localhost:3000/dashboard" -n "Dashboard" \\
      --login-url "http://localhost:3000/login" --username admin --password secret -y

  ${chalk.dim("# \u2014 Fix failing tests \u2014")}
  $ qa fix --test cypress/e2e/test/smoke/login.cy.ts
  $ qa fix --test cypress/e2e/test/smoke/login.cy.ts \\
      --report ./cypress/results/output.json -y

  ${chalk.dim("# \u2014 Generate steps file \u2014")}
  $ qa steps -g "Fill login form and submit"
  $ qa steps -g "Navigate to settings page" -o "steps/settings.json" -y
`);
  });

// ── qa autonomous ──────────────────────────────────────────────────────────
program
  .command("autonomous")
  .alias("auto")
  .description("Crawl a website, discover pages, and generate tests autonomously")
  .option("--base-url <url>", "base URL to crawl")
  .option("-d, --depth <number>", "crawl depth (1-3)", parseInt)
  .option("-p, --project-root <dir>", "project root (default: cwd)")
  .option("--forms-only", "only generate tests for pages with forms")
  .option("-t, --tier <tier>", "test tier: smoke (default) or regression")
  .option("-y, --yes", "skip prompts, use defaults + provided flags")
  .action(async (opts) => {
    try {
      await autonomousCommand({
        baseUrl: opts.baseUrl,
        depth: opts.depth,
        projectRoot: opts.projectRoot,
        yes: opts.yes,
        formsOnly: opts.formsOnly,
        tier: opts.tier,
      });
    } catch (err) {
      ui.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ── qa hybrid ─────────────────────────────────────────────────────────────
program
  .command("hybrid")
  .description("Analyze page with Playwright + generate tests with AI (best accuracy)")
  .option("-u, --url <url>", "Page URL to analyze")
  .option("-n, --name <name>", "Name for page/test (e.g., LoginPage, Dashboard)")
  .option("-p, --project-root <dir>", "project root (default: cwd)")
  .option("-t, --tier <tier>", "test tier: smoke (default) or regression")
  .option("--guide <path>", "Structure Guide for conventions")
  .option("--login-url <url>", "Login page URL (for authenticated pages)")
  .option("--username <text>", "Username for login")
  .option("--password <text>", "Password for login")
  .option("--username-selector <selector>", "Username field CSS selector")
  .option("--password-selector <selector>", "Password field CSS selector")
  .option("--login-button-selector <selector>", "Login button CSS selector")
  .option("--wait-for-selector <selector>", "Selector to wait for after login")
  .option("-y, --yes", "skip prompts, use defaults + provided flags")
  .option("--interactive", "Open browser for manual interaction before analysis")
  .option("--steps-file <path>", "JSON file with pre-defined steps to execute before analysis")
  .option("--scenario <text>", "pre-written scenario in Markdown (skips Phase 0)")
  .option("--scenario-file <path>", "read scenario from file (skips Phase 0)")
  .action(async (opts) => {
    try {
      await hybridCommand({
        url: opts.url,
        name: opts.name,
        projectRoot: opts.projectRoot,
        tier: opts.tier,
        guide: opts.guide,
        loginUrl: opts.loginUrl,
        username: opts.username,
        password: opts.password,
        usernameSelector: opts.usernameSelector,
        passwordSelector: opts.passwordSelector,
        loginButtonSelector: opts.loginButtonSelector,
        waitForSelector: opts.waitForSelector,
        yes: opts.yes,
        interactive: opts.interactive,
        stepsFile: opts.stepsFile,
        scenario: opts.scenario,
        scenarioFile: opts.scenarioFile,
      });
    } catch (err) {
      ui.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ── qa new ──────────────────────────────────────────────────────────────────
program
  .command("new")
  .description("Scaffold a new Cypress project (POM, BDD, Allure)")
  .option("-n, --name <name>", "project name")
  .option("-p, --path <dir>", "target directory")
  .option("-l, --language <lang>", "typescript | javascript")
  .option("--bdd <bool>", "enable Cucumber BDD", (v) => v !== "false")
  .option("--no-bdd", "disable Cucumber BDD")
  .option("--allure <bool>", "enable Allure reporter", (v) => v !== "false")
  .option("--no-allure", "disable Allure reporter")
  .option("--baseUrl <url>", "base URL for tests")
  .option("-d, --description <text>", "project description")
  .option("--no-install", "skip running npm install")
  .option("--llm-wiki", "include LLM-Wiki (Structure Guide) from reference project")
  .option("--scenarios", "include sample scenario .md files in scenarios/")
  .option("-y, --yes", "skip prompts, use defaults + provided flags")
  .action(async (opts) => {
    try {
      const lang = opts.language as ProjectLanguage | undefined;
      await newCommand({
        name: opts.name,
        path: opts.path,
        language: lang,
        bdd: opts.bdd,
        allure: opts.allure,
        baseUrl: opts.baseUrl,
        description: opts.description,
        install: opts.install,
        llmWiki: opts.llmWiki,
        scenarios: opts.scenarios,
        yes: opts.yes,
      });
    } catch (err) {
      ui.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ── qa generate / qa g ──────────────────────────────────────────────────────
program
  .command("generate")
  .alias("g")
  .description("Generate a test artifact with AI (test|page|locators|helper|command|bdd|all)")
  .argument(
    "<type>",
    "artifact type",
    (v): GenerateType => {
      const allowed = ["test", "page", "locators", "helper", "command", "bdd", "all"];
      if (!allowed.includes(v)) {
        throw new Error(`Invalid type "${v}". Choose: ${allowed.join(", ")}`);
      }
      return v as GenerateType;
    },
  )
  .option("-g, --goal <text>", "natural-language description of what to generate")
  .option("-p, --project-root <dir>", "project root (default: cwd)")
  .option("--guide <path>", "path to a Structure Guide markdown file for conventions")
  .option("--tier <tier>", "test tier: smoke (default) or regression", /^(smoke|regression)$/i)
  .option("-u, --url <url>", "page URL to analyze (provides context for AI generation)")
  .option("--scenario <text>", "pre-written scenario in Markdown (skips Phase 0, 'all' type only)")
  .option("--scenario-file <path>", "read scenario from file (skips Phase 0, 'all' type only)")
  .option("--name <name>", "override name for file/class naming (instead of deriving from goal)")
  .option("-y, --yes", "skip confirmations")
  .action(async (type: GenerateType, opts) => {
    try {
      await generateCommand({
        type,
        goal: opts.goal,
        projectRoot: opts.projectRoot,
        guide: opts.guide,
        tier: opts.tier?.toLowerCase() as "smoke" | "regression" | undefined,
        url: opts.url,
        scenario: opts.scenario,
        scenarioFile: opts.scenarioFile,
        name: opts.name,
        yes: opts.yes,
      });
    } catch (err) {
      ui.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ── qa analyze ────────────────────────────────────────────────────────────────
program
  .command("analyze")
  .alias("a")
  .description("Analyze a web page and generate test artifacts (locators, page object, test)")
  .option("-u, --url <url>", "page URL to analyze")
  .option("-p, --project-root <dir>", "project root (default: cwd)")
  .option("-n, --name <name>", "override name for file/class naming")
  .option("--guide <path>", "path to a Structure Guide markdown file for conventions")
  .option("--tier <tier>", "test tier: smoke (default) or regression")
  .option("--output <type>", "what to generate: all (default), locators, page, test, none")
  .option("--login-url <url>", "login page URL (for pages requiring authentication)")
  .option("--username <text>", "username/email for login")
  .option("--password <text>", "password for login")
  .option("--username-selector <selector>", "username field CSS selector")
  .option("--password-selector <selector>", "password field CSS selector")
  .option("--login-button-selector <selector>", "login button CSS selector")
  .option("--wait-for-selector <selector>", "selector to wait for after login")
  .option("--scenario-output <path>", "save generated scenario to file (e.g., 'scenarios/login.md')")
  .option("--scenario <text>", "inline scenario text (generates focused artifacts)")
  .option("--scenario-file <path>", "read scenario from file (e.g., 'scenarios/addMember.md')")
  .option("--debug", "enable debug output for troubleshooting")
  .option("-y, --yes", "skip prompts, use defaults + provided flags")
  .option("--interactive", "Open browser for manual interaction before analysis")
  .option("--steps-file <path>", "JSON file with pre-defined steps to execute before analysis")
  .action(async (opts) => {
    try {
      await analyzeCommand({
        url: opts.url,
        projectRoot: opts.projectRoot,
        name: opts.name,
        guide: opts.guide,
        tier: opts.tier as "smoke" | "regression",
        output: opts.output as AnalyzeOptions["output"],
        yes: opts.yes,
        loginUrl: opts.loginUrl,
        username: opts.username,
        password: opts.password,
        usernameSelector: opts.usernameSelector,
        passwordSelector: opts.passwordSelector,
        loginButtonSelector: opts.loginButtonSelector,
        waitForSelector: opts.waitForSelector,
        scenarioOutput: opts.scenarioOutput,
        scenario: opts.scenario,
        scenarioFile: opts.scenarioFile,
        debug: opts.debug,
        interactive: opts.interactive,
        stepsFile: opts.stepsFile,
      });
    } catch (err) {
      ui.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ── qa chat ─────────────────────────────────────────────────────────────────
program
  .command("chat")
  .description("Chat with an AI QA assistant")
  .option("--guide <path>", "path to a Structure Guide markdown file to use as context")
  .action(async (opts) => {
    try {
      await chatCommand({ guide: opts.guide });
    } catch (err) {
      ui.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ── qa docs ─────────────────────────────────────────────────────────────────
program
  .command("docs")
  .description("Generate documentation from the current Cypress project")
  .option("-p, --project-root <dir>", "project root (default: cwd)")
  .option("-o, --output <dir>", "output directory for md/html (default: ./docs)")
  .option("-t, --title <title>", "document title")
  .option("--confluence", "publish to Confluence Cloud")
  .option("--confluence-config <path>", "path to Confluence config JSON")
  .option("--no-file", "skip file output (print to stdout instead)")
  .option("-y, --yes", "skip prompts, use defaults")
  .action(async (opts) => {
    try {
      const docOpts: DocsOptions = {
        projectRoot: opts.projectRoot,
        output: opts.output,
        title: opts.title,
        confluence: opts.confluence,
        confluenceConfig: opts.confluenceConfig,
        noFile: opts.file === false,
        yes: opts.yes,
      };
      await docsCommand(docOpts);
    } catch (err) {
      ui.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ── qa generate-guide / qa gg ──────────────────────────────────────────────
program
  .command("generate-guide")
  .alias("gg")
  .description("Generate a Structure Guide markdown file from an existing Cypress project")
  .option("-p, --project-root <dir>", "project root to analyze (default: cwd)")
  .option("-o, --output <path>", "output file path (default: ./structure-guide.md)")
  .option("-t, --title <title>", "override project name")
  .option("-y, --yes", "skip prompts, use defaults")
  .action(async (opts) => {
    try {
      await generateGuideCommand({
        projectRoot: opts.projectRoot,
        output: opts.output,
        title: opts.title,
        yes: opts.yes,
      });
    } catch (err) {
      ui.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ── qa config ───────────────────────────────────────────────────────────────
program
  .command("config")
  .description("Configure LLM providers (local + cloud)")
  .action(async () => {
    try {
      await configCommand();
    } catch (err) {
      ui.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ── qa models ───────────────────────────────────────────────────────────────
program
  .command("models")
  .description("List models available to the active provider")
  .action(async () => {
    try {
      await modelsCommand();
    } catch (err) {
      ui.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ── qa scenario ─────────────────────────────────────────────────────────────
program
  .command("scenario")
  .description("Write a test scenario with AI (interactive loop + save to scenarios/*.md)")
  .option("-g, --goal <text>", "natural-language description of the scenario")
  .option("-p, --project-root <dir>", "project root (default: cwd)")
  .option("--guide <path>", "path to a Structure Guide markdown file for conventions")
  .option("-y, --yes", "skip prompts, use defaults")
  .action(async (opts) => {
    try {
      const scOpts: ScenarioOptions = {
        description: opts.goal,
        projectRoot: opts.projectRoot,
        guide: opts.guide,
        yes: opts.yes,
      };
      await scenarioCommand(scOpts);
    } catch (err) {
      ui.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ── qa fix ──────────────────────────────────────────────────────────────────
program
  .command("fix")
  .description("Analyze a failing test and suggest a fix with AI")
  .option("-t, --test <path>", "path to the failing test file")
  .option("-r, --report <path>", "path to test report file (JSON/HTML) for error extraction")
  .option("-p, --project-root <dir>", "project root (default: cwd)")
  .option("-y, --yes", "skip prompts, auto-apply fix")
  .action(async (opts) => {
    try {
      await fixCommand({
        test: opts.test,
        report: opts.report,
        projectRoot: opts.projectRoot,
        yes: opts.yes,
      });
    } catch (err) {
      ui.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ── qa steps ────────────────────────────────────────────────────────────────
program
  .command("steps")
  .description("Generate a steps JSON file for page interactions (works offline with local LLM)")
  .option("-g, --goal <text>", "Description of page interactions")
  .option("-o, --output <path>", "Output file path", "steps/steps.json")
  .option("-y, --yes", "Skip prompts, use defaults")
  .action(async (opts: StepsOptions) => {
    try {
      await stepsCommand(opts);
    } catch (err) {
      ui.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// ── Boot ────────────────────────────────────────────────────────────────────
program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.red("Fatal:"), err);
  process.exit(1);
});
