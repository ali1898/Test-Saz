import { input, confirm } from "@inquirer/prompts";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { suggestFix, parseFailureReport, getActiveProvider } from "@qa-test-generator/core";
import { ui, withSpinner, chalk } from "../ui";

export interface FixOptions {
  test?: string;
  report?: string;
  projectRoot?: string;
  yes?: boolean;
}

export async function fixCommand(opts: FixOptions): Promise<void> {
  let testFile = opts.test;
  const projectRoot = resolve(opts.projectRoot ?? process.cwd());

  if (!testFile && !opts.yes) {
    testFile = await input({ message: "Path to failing test file:" });
  }

  if (!testFile) {
    ui.error("Test file is required. Use --test or provide it interactively.");
    process.exit(1);
  }

  const fullPath = resolve(projectRoot, testFile);
  const testContent = readFileSync(fullPath, "utf-8");

  let error = "";
  let stackTrace = "";

  if (opts.report) {
    const failures = parseFailureReport(opts.report);
    if (failures.length > 0) {
      error = failures[0].error;
      stackTrace = failures[0].stackTrace;
    }
  }

  if (!error && !opts.yes) {
    error = await input({ message: "Error message:" });
    stackTrace = await input({ message: "Stack trace (optional):" });
  }

  console.log(chalk.bold("\n  Analyzing failure...\n"));

  const provider = getActiveProvider();
  const fixedCode = await withSpinner("Generating fix...", async () => {
    return suggestFix(provider, testFile!, error, stackTrace);
  });

  console.log(chalk.green("\n  Suggested fix:\n"));
  console.log(fixedCode);

  if (!opts.yes) {
    const apply = await confirm({ message: "Apply this fix?", default: true });
    if (apply) {
      writeFileSync(fullPath, fixedCode, "utf-8");
      console.log(chalk.green("\n  Fix applied successfully!\n"));
    }
  }
}
