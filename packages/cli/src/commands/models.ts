/**
 * `qa models` — list models offered by the active provider.
 *
 * Acts as a connectivity check: if this works, chat/generate will too.
 */
import { getActiveProvider } from "@testsaz/core";
import { ui, withSpinner, chalk } from "../ui";
import { activeBanner } from "./config";

export async function modelsCommand(): Promise<void> {
  console.log(chalk.hex("#00d4ff")("\n╭──────────────────────────────────────────────╮"));
  console.log(chalk.hex("#00d4ff")("│") + chalk.bold.white("           📡 Available Models              ") + chalk.hex("#00d4ff")(" │"));
  console.log(chalk.hex("#00d4ff")("╰──────────────────────────────────────────────╯"));
  console.log(chalk.hex("#48dbfb")("  Provider: ") + chalk.bold(activeBanner()) + "\n");

  const provider = getActiveProvider();
  const models = await withSpinner("Fetching models…", () => provider.listModels());

  if (models.length === 0) {
    ui.warn("No models reported. Check that your local server is running.");
    return;
  }

  for (const m of models) {
    const bullet = chalk.hex("#feca57")("✦");
    console.log(`  ${bullet} ${chalk.bold(m.id)}${m.name && m.name !== m.id ? chalk.dim(`  (${m.name})`) : ""}`);
  }
  console.log();
  console.log(chalk.dim(`  ── ${provider.isLocal ? "🖥  Local (offline capable)" : "☁  Cloud (requires internet)"}`));
}
