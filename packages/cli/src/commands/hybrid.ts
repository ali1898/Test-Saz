import { input, confirm } from "@inquirer/prompts";
import { resolve } from "node:path";
import { hybridGenerate } from "@qa-test-generator/core";
import { ui, withSpinner, chalk } from "../ui";

export interface HybridOptions {
  url?: string;
  name?: string;
  projectRoot?: string;
  tier?: string;
  guide?: string;
  loginUrl?: string;
  username?: string;
  password?: string;
  usernameSelector?: string;
  passwordSelector?: string;
  loginButtonSelector?: string;
  waitForSelector?: string;
  yes?: boolean;
}

export async function hybridCommand(opts: HybridOptions): Promise<void> {
  let url = opts.url;
  let name = opts.name;
  const projectRoot = resolve(opts.projectRoot ?? process.cwd());

  if (!url && !opts.yes) {
    url = await input({ message: "Page URL to analyze and generate tests for:" });
  }

  if (!url) {
    ui.error("URL is required. Use --url or provide it interactively.");
    process.exit(1);
  }

  // Name prompt
  if (!name && !opts.yes) {
    name = await input({ message: "Name for page/test (e.g., LoginPage, Dashboard):", default: "Page" });
  }
  if (!name) name = "Page";

  // Authentication prompts
  let loginUrl = opts.loginUrl;
  let username = opts.username;
  let password = opts.password;
  let usernameSelector = opts.usernameSelector;
  let passwordSelector = opts.passwordSelector;
  let loginButtonSelector = opts.loginButtonSelector;
  let waitForSelector = opts.waitForSelector;

  if (!opts.yes && !opts.loginUrl) {
    const needsAuth = await confirm({ message: "Does this page require authentication?", default: false });
    if (needsAuth) {
      loginUrl = await input({ message: "Login page URL:" });
      username = await input({ message: "Username:" });
      password = await input({ message: "Password:" });
      usernameSelector = await input({ message: "Username field selector (optional, press Enter to skip):" });
      passwordSelector = await input({ message: "Password field selector (optional, press Enter to skip):" });
      loginButtonSelector = await input({ message: "Login button selector (optional, press Enter to skip):" });
      waitForSelector = await input({ message: "Wait for selector after login (optional, press Enter to skip):" });
    }
  }

  // Tier
  let tier = opts.tier ?? "smoke";
  if (!opts.yes && !opts.tier) {
    tier = await input({ message: "Test tier (smoke/regression):", default: "smoke" });
  }

  console.log(chalk.bold("\n  Hybrid Generation\n"));
  console.log(chalk.dim("  URL:") + `      ${url}`);
  console.log(chalk.dim("  name:") + `     ${name}`);
  console.log(chalk.dim("  tier:") + `     ${tier}`);
  if (loginUrl) console.log(chalk.dim("  auth:") + `     ${loginUrl}`);
  console.log(chalk.dim("  mode:") + `     Playwright + AI (best accuracy)`);
  console.log();

  const result = await withSpinner("Analyzing page & generating tests...", async () => {
    return hybridGenerate(url!, {
      projectRoot,
      name,
      tier: tier as "smoke" | "regression",
      guide: opts.guide,
      auth: loginUrl ? {
        loginUrl,
        username,
        password,
        usernameSelector,
        passwordSelector,
        loginButtonSelector,
        waitForSelector,
      } : undefined,
    });
  });

  console.log(chalk.bold("\n  Generated Files\n"));
  for (const p of result.paths) {
    console.log(chalk.green("  ✔ ") + chalk.dim(p));
  }
  console.log();
}
