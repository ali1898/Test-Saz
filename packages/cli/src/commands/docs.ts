/**
 * `qa docs` — generate documentation from the current Cypress project.
 *
 * Outputs Markdown and/or HTML to files. With --confluence, also publishes
 * a page to Confluence Cloud (requires a config JSON via --confluence-config).
 */
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { input } from "@inquirer/prompts";
import {
  analyzeProject,
  renderMarkdown,
  renderHtml,
  publishConfluencePage,
  loadConfluenceConfigFromFile,
} from "@qa-test-generator/core";
import { ui, withSpinner, chalk } from "../ui";

export interface DocsOptions {
  /** Project root; defaults to cwd. */
  projectRoot?: string;
  /** Output directory for md/html; defaults to ./docs. */
  output?: string;
  /** Override detected project name for the doc title. */
  title?: string;
  /** Also publish to Confluence. */
  confluence?: boolean;
  /** Path to a ConfluenceConfig JSON file. */
  confluenceConfig?: string;
  /** Skip file output (useful with --confluence). */
  noFile?: boolean;
  /** Skip all prompts (use defaults). */
  yes?: boolean;
}

export async function docsCommand(opts: DocsOptions): Promise<void> {
  const projectRoot = resolve(
    opts.projectRoot
      ?? (opts.yes ? process.cwd() : await input({ message: "Project root:", default: process.cwd() })),
  );

  // Sanity-check we're pointed at a real project.
  if (!existsSync(join(projectRoot, "cypress.config.ts")) && !existsSync(join(projectRoot, "cypress.config.js"))) {
    ui.warn("No cypress.config.* found — is this a Cypress project?");
  }

  console.log(chalk.hex("#00d4ff")("\n╭──────────────────────────────────────────────╮"));
  console.log(chalk.hex("#00d4ff")("│") + chalk.bold.white("           📄 Documentation Generator        ") + chalk.hex("#00d4ff")(" │"));
  console.log(chalk.hex("#00d4ff")("╰──────────────────────────────────────────────╯"));
  console.log(chalk.hex("#48dbfb")("  Analyzing: ") + chalk.dim(projectRoot));
  const analysis = analyzeProject({ projectRoot, projectName: opts.title });

  const markdown = renderMarkdown(analysis);

  // ── File output ──
  if (!opts.noFile) {
    const outDir = resolve(
      opts.output
        ?? (opts.yes ? join(projectRoot, "docs") : await input({ message: "Output directory:", default: join(projectRoot, "docs") })),
    );
    await withSpinner("Writing Markdown + HTML…", () => {
      const out = renderHtml(analysis);
      return import("node:fs/promises").then(async (fs) => {
        await fs.mkdir(outDir, { recursive: true });
        await fs.writeFile(join(outDir, "qa-docs.md"), markdown, "utf-8");
        await fs.writeFile(join(outDir, "qa-docs.html"), out, "utf-8");
      });
    });
    ui.success(`Docs written to ${chalk.underline(outDir)}`);
    console.log(chalk.dim(`   - qa-docs.md`));
    console.log(chalk.dim(`   - qa-docs.html`));
    console.log();
  }

  // ── Confluence publish ──
  if (opts.confluence) {
    const cfgPath = opts.confluenceConfig
      ? resolve(opts.confluenceConfig)
      : join(projectRoot, ".qa-confluence.json");

    if (!existsSync(cfgPath)) {
      ui.error(`Confluence config not found: ${cfgPath}`);
      ui.dim('Create a JSON with { domain, email, apiToken, spaceKey, parentId? }.');
      process.exit(1);
    }

    const cfg = loadConfluenceConfigFromFile(cfgPath);
    const title = `${analysis.projectName} — QA Docs`;
    const result = await withSpinner("Publishing to Confluence…", () =>
      publishConfluencePage(cfg, title, markdown),
    );
    console.log(chalk.green(`  ✔ ${result.updated ? "Updated" : "Created"} Confluence page:`));
    console.log(chalk.underline(`    ${result.url}`));
  }

  // ── Preview to stdout when no other output ──
  if (opts.noFile && !opts.confluence) {
    console.log(markdown);
  }
}
