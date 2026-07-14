/**
 * Shared CLI presentation helpers — colors, spinners, error handling.
 *
 * Using chalk@4 (CommonJS) and ora@7 keeps everything ESM-free so the
 * compiled CLI runs directly with `node` on Windows without loader flags.
 */
import chalk from "chalk";
import ora from "ora";
// ora@5 bundles its own types via the main field; no separate @types needed.
type Ora = ReturnType<typeof ora>;

export const ui = {
  info: (msg: string) => console.log(chalk.hex("#48dbfb")("ℹ"), chalk.dim(msg)),
  success: (msg: string) => console.log(chalk.green("✔"), chalk.dim(msg)),
  warn: (msg: string) => console.log(chalk.hex("#feca57")("⚠"), chalk.dim(msg)),
  error: (msg: string) => console.error(chalk.hex("#ff6b6b")("✖"), chalk.dim(msg)),
  dim: (msg: string) => console.log(chalk.dim(msg)),
  header: (msg: string) => console.log(`\n${chalk.bold.white.bgCyan(` ${msg} `)}\n`),
};

/** Run an async task with a spinner; returns its result or exits on error. */
export async function withSpinner<T>(
  text: string,
  task: (spinner: Ora) => Promise<T>,
): Promise<T> {
  const spinner = ora(text).start();
  try {
    const result = await task(spinner);
    spinner.succeed();
    return result;
  } catch (err) {
    spinner.fail();
    handleError(err);
  }
}

/** Print a user-friendly error and exit with non-zero status. */
export function handleError(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  ui.error(message);
  if (process.env.QA_DEBUG) {
    console.error(err);
  }
  process.exit(1);
}

export { chalk, ora };

/** Simple cross-platform progress indicator that doesn't block stdin. */
export function createProgressIndicator(
  message: string,
  doneMessage?: string,
): { stop: (doneMsg?: string) => void } {
  let dots = 0;
  let cleared = false;
  const fullMsg = `  ⏳ ${message}`;
  const interval = setInterval(() => {
    dots = (dots + 1) % 4;
    const dotsStr = ".".repeat(dots + 1);
    process.stderr.write(`\r${chalk.cyan(fullMsg + dotsStr)}   `);
  }, 400);
  return {
    stop: (doneMsg?: string) => {
      if (cleared) return;
      cleared = true;
      clearInterval(interval);
      const done = doneMsg || doneMessage || message;
      process.stderr.write(`\r${chalk.green("  ✔ " + done + "  ")}\n`);
    },
  };
}
