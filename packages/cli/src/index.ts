#!/usr/bin/env node
import { Command } from "commander";
import type { ProjectLanguage } from "@qa-test-generator/core";
import { CORE_VERSION } from "@qa-test-generator/core";
import { ui, chalk } from "./ui";
import { configCommand } from "./commands/config";
import { newCommand, type NewOptions } from "./commands/new";
import { generateCommand, type GenerateType } from "./commands/generate";
import { chatCommand } from "./commands/chat";
import { docsCommand, type DocsOptions } from "./commands/docs";
import { modelsCommand } from "./commands/models";
import { generateGuideCommand } from "./commands/generate-guide";

const BANNER =
  chalk.hex("#00d4ff")(`
   ██████  ██     ███████     ${chalk.hex("#ff6b6b")("████████")} ${chalk.hex("#feca57")("███████")} ${chalk.hex("#48dbfb")("███████")} ${chalk.hex("#ff9ff3")("████████")}
  ${chalk.hex("#00d4ff")("██")}       ${chalk.hex("#00d4ff")("██")}        ${chalk.hex("#ff6b6b")("███")}        ${chalk.hex("#ff6b6b")("██")}    ${chalk.hex("#feca57")("██")}      ${chalk.hex("#48dbfb")("██")}         ${chalk.hex("#ff9ff3")("██")}
  ${chalk.hex("#00d4ff")("██")}   ${chalk.hex("#00d4ff")("███")} ${chalk.hex("#00d4ff")("██")}       ${chalk.hex("#ff6b6b")("███")}         ${chalk.hex("#ff6b6b")("██")}    ${chalk.hex("#feca57")("█████")}   ${chalk.hex("#48dbfb")("███████")}    ${chalk.hex("#ff9ff3")("██")}
  ${chalk.hex("#00d4ff")("██")}    ${chalk.hex("#00d4ff")("██")} ${chalk.hex("#00d4ff")("██")}      ${chalk.hex("#ff6b6b")("███")}          ${chalk.hex("#ff6b6b")("██")}    ${chalk.hex("#feca57")("██")}           ${chalk.hex("#48dbfb")("██")}    ${chalk.hex("#ff9ff3")("██")}
   ${chalk.hex("#00d4ff")("██████")}  ${chalk.hex("#00d4ff")("██████")} ${chalk.hex("#ff6b6b")("███████")}       ${chalk.hex("#ff6b6b")("██")}    ${chalk.hex("#feca57")("███████")} ${chalk.hex("#48dbfb")("███████")}    ${chalk.hex("#ff9ff3")("██")}
`) +
  chalk.dim(`  ╰─ ${chalk.bold.white("QA Test Generator")} v${CORE_VERSION}  ·  `) +
  chalk.hex("#feca57")("POM") + chalk.dim(" + ") +
  chalk.hex("#48dbfb")("BDD") + chalk.dim(" + ") +
  chalk.hex("#ff9ff3")("Allure") + chalk.dim(" + ") +
  chalk.hex("#00d4ff")("AI") +
  "\n";

const program = new Command();

program
  .name("qa")
  .description("Cypress test project generator with AI assistance")
  .version(CORE_VERSION)
  .addHelpText("before", BANNER)
  .addHelpText(
    "after",
    `
${chalk.bold.hex("#feca57")("⚡ Commands")}

  ${chalk.bold("qa new")}                ${chalk.dim("Scaffold a complete Cypress project (POM + BDD + Allure)")}
  ${chalk.bold("qa generate")} / ${chalk.bold("qa g")}  ${chalk.dim("Generate with AI (test|page|locators|helper|command|bdd|all — supports --url, --guide, --tier, --yes)")}
  ${chalk.bold("qa generate-guide")} / ${chalk.bold("qa gg")}  ${chalk.dim("Create a Structure Guide (interactive or --project-root, --output, --yes)")}
  ${chalk.bold("qa chat")}               ${chalk.dim("Interactive QA assistant (supports --guide for context)")}
  ${chalk.bold("qa docs")}               ${chalk.dim("Generate Markdown/HTML docs (interactive or --project-root, --output, --yes, --confluence)")}
  ${chalk.bold("qa config")}             ${chalk.dim("Manage LLM providers (local + cloud)")}
  ${chalk.bold("qa models")}             ${chalk.dim("List models from the active provider")}

${chalk.bold.hex("#48dbfb")("📦 Examples")}

  ${chalk.dim("# — Scaffold a project —")}
  $ qa new
  $ qa new --name my-app -l typescript --bdd --allure -y
  $ qa new --name my-app --llm-wiki

  ${chalk.dim("# — Generate artifacts with AI —")}
  $ qa g test -g "login with empty fields should show error"
  $ qa g page -g "user profile page"
  $ qa g bdd -g "checkout with valid coupon"
  $ qa g all -g "login page" -u "http://localhost:3000"
  $ qa g locators -g "checkout form elements" --guide ./guides/my-guide.md
  $ qa g command -g "login via API with username/password"

  ${chalk.dim("# — Generate everything at once —")}
  $ qa g all -g "login page with username, password, and remember-me" -u "http://localhost:3000"

  ${chalk.dim("# — Learn from existing projects —")}
  $ qa gg                       ${chalk.dim("(interactive)")}
  $ qa gg -p ./my-project -o ./guides/my-guide.md -y
  $ qa g test -g "login test" --guide ./guides/my-guide.md

  ${chalk.dim("# — Chat with context —")}
  $ qa chat --guide ./guides/my-guide.md

  ${chalk.dim("# — Docs & config —")}
  $ qa docs                     ${chalk.dim("(interactive)")}
  $ qa docs -y                  ${chalk.dim("(use defaults)")}
  $ qa docs --confluence --confluence-config ./confluence.json
  $ qa config
  $ qa models

${chalk.dim("╭─")} ${chalk.hex("#ff6b6b")("💡")} ${chalk.dim("Windows users: use")} ${chalk.bold("npm run qa")} ${chalk.dim("instead of bare")} ${chalk.bold("qa")} ${chalk.dim("─╮")}
${chalk.dim("╰─")} ${chalk.hex("#feca57")("🐞")} ${chalk.dim("Report issues:")} ${chalk.underline("https://github.com/anomalyco/QA-test-generator/issues")} ${chalk.dim("─╯")}
`,
  )
  .hook("preAction", () => {
    // Reserved for future global checks.
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
        yes: opts.yes,
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

// ── Boot ────────────────────────────────────────────────────────────────────
program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.red("Fatal:"), err);
  process.exit(1);
});
