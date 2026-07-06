/**
 * `qa new` — scaffold a new Cypress project interactively or via flags.
 *
 * Walks the user through: project name, location, language, BDD, Allure,
 * base URL, and dependency install. Then delegates to core.scaffoldProject.
 */
import { input, select, confirm } from "@inquirer/prompts";
import { scaffoldProject, type ProjectLanguage } from "@qa-test-generator/core";
import { resolve } from "node:path";
import { ui, withSpinner, chalk } from "../ui";

export interface NewOptions {
  name?: string;
  path?: string;
  language?: ProjectLanguage;
  bdd?: boolean;
  allure?: boolean;
  baseUrl?: string;
  description?: string;
  install?: boolean;
  /** Skip all prompts using defaults + flags (for scripting). */
  yes?: boolean;
}

export async function newCommand(opts: NewOptions): Promise<void> {
  console.log(
    chalk.hex("#00d4ff")(`
   ██████  ██     ███████     ${chalk.hex("#ff6b6b")("████████")} ${chalk.hex("#feca57")("███████")} ${chalk.hex("#48dbfb")("███████")} ${chalk.hex("#ff9ff3")("████████")}
  ${chalk.hex("#00d4ff")("██")}       ${chalk.hex("#00d4ff")("██")}        ${chalk.hex("#ff6b6b")("███")}        ${chalk.hex("#ff6b6b")("██")}    ${chalk.hex("#feca57")("██")}      ${chalk.hex("#48dbfb")("██")}         ${chalk.hex("#ff9ff3")("██")}
  ${chalk.hex("#00d4ff")("██")}   ${chalk.hex("#00d4ff")("███")} ${chalk.hex("#00d4ff")("██")}       ${chalk.hex("#ff6b6b")("███")}         ${chalk.hex("#ff6b6b")("██")}    ${chalk.hex("#feca57")("█████")}   ${chalk.hex("#48dbfb")("███████")}    ${chalk.hex("#ff9ff3")("██")}
  ${chalk.hex("#00d4ff")("██")}    ${chalk.hex("#00d4ff")("██")} ${chalk.hex("#00d4ff")("██")}      ${chalk.hex("#ff6b6b")("███")}          ${chalk.hex("#ff6b6b")("██")}    ${chalk.hex("#feca57")("██")}           ${chalk.hex("#48dbfb")("██")}    ${chalk.hex("#ff9ff3")("██")}
   ${chalk.hex("#00d4ff")("██████")}  ${chalk.hex("#00d4ff")("██████")} ${chalk.hex("#ff6b6b")("███████")}       ${chalk.hex("#ff6b6b")("██")}    ${chalk.hex("#feca57")("███████")} ${chalk.hex("#48dbfb")("███████")}    ${chalk.hex("#ff9ff3")("██")}
`));
  ui.header("🚀 Create a Cypress project");

  // ── Gather inputs (skip prompts when --yes and a value is provided) ──
  const projectName =
    opts.name ??
    (opts.yes ? "my-cypress-tests" : await input({ message: "Project name:", default: "my-cypress-tests" }));

  const targetDir =
    opts.path ??
    (opts.yes
      ? resolve(projectName)
      : await input({ message: "Target directory:", default: resolve(projectName) }));

  const language: ProjectLanguage =
    opts.language ??
    (opts.yes
      ? "typescript"
      : await select<ProjectLanguage>({
          message: "Language:",
          choices: [
            { name: "TypeScript (recommended)", value: "typescript" },
            { name: "JavaScript", value: "javascript" },
          ],
        }));

  const bdd =
    opts.bdd ??
    (opts.yes ? true : await confirm({ message: "Enable Cucumber BDD?", default: true }));

  const allure =
    opts.allure ??
    (opts.yes ? true : await confirm({ message: "Enable Allure reporter?", default: true }));

  const baseUrl =
    opts.baseUrl ??
    (opts.yes ? "http://localhost:3000" : await input({
      message: "Base URL for tests:",
      default: "http://localhost:3000",
    }));

  const description = opts.description ?? "";
  const installDeps =
    opts.install ?? (opts.yes ? true : await confirm({ message: "Run npm install now?", default: true }));

  // ── Echo the plan ──
  console.log();
  console.log(chalk.dim("  project:") + `  ${projectName}`);
  console.log(chalk.dim("  location:") + ` ${resolve(targetDir)}`);
  console.log(chalk.dim("  language:") + ` ${language}`);
  console.log(chalk.dim("  bdd:") + `       ${bdd ? "yes" : "no"}`);
  console.log(chalk.dim("  allure:") + `    ${allure ? "yes" : "no"}`);
  console.log(chalk.dim("  baseUrl:") + `   ${baseUrl}`);
  console.log(chalk.dim("  install:") + `   ${installDeps ? "yes" : "no"}`);
  console.log();

  // ── Scaffold ──
  const result = await withSpinner("Scaffolding project…", async (spinner) => {
    return scaffoldProject({
      targetDir: resolve(targetDir),
      projectName,
      description,
      language,
      bdd,
      allure,
      baseUrl,
      installDeps,
    });
  });

  ui.success(`Project created at ${result.projectPath}`);
  console.log();
  ui.dim(`  ${result.files.length} files written.`);
  console.log();
  console.log(chalk.bold.hex("#feca57")("\n🎯 Next steps"));
  console.log(chalk.dim("  ─────────────────────────────────────────────"));
  console.log(chalk.hex("#48dbfb")("  1.") + chalk.dim("  cd ") + chalk.bold(resolve(targetDir)));
  console.log(chalk.hex("#48dbfb")("  2.") + chalk.dim("  npm run setup        ") + chalk.hex("#ff9ff3")("Check & install deps (Node, Java, Cypress)"));
  console.log(chalk.hex("#48dbfb")("  3.") + chalk.dim("  npm run frontend      ") + chalk.hex("#ff9ff3")("Start the sample app on :3000"));
  console.log(chalk.hex("#48dbfb")("  4.") + chalk.dim("  ") + (bdd ? "npx cypress open   " : "npx cypress open    ") + chalk.hex("#ff9ff3")("Run the sample " + (bdd ? "feature" : "test")));
  console.log(chalk.hex("#48dbfb")("  5.") + chalk.dim("  npm test             ") + chalk.hex("#ff9ff3")("Run smoke tests"));
  console.log(chalk.dim("  ─────────────────────────────────────────────"));
  console.log();
  console.log(chalk.hex("#ff6b6b")("  💡") + chalk.dim("  Windows: use ") + chalk.bold("npm run qa"));
  console.log(chalk.hex("#feca57")("  ⚡") + chalk.dim(`  Run `) + chalk.bold("qa generate test") + chalk.dim(" inside the project to add more tests."));
  console.log();
}
