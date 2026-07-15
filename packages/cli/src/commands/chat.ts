import { input } from "@inquirer/prompts";
import { ChatSession, loadStructureGuide } from "@testsaz/core";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ui, chalk } from "../ui";
import { activeBanner } from "./config";

export interface ChatOptions {
  /** Path to a Structure Guide markdown file to use as context. */
  guide?: string;
}

export async function chatCommand(opts: ChatOptions = {}): Promise<void> {
  console.log(chalk.hex("#00d4ff")("\n╭──────────────────────────────────────────────╮"));
  console.log(chalk.hex("#00d4ff")("│") + chalk.bold.white("          🤖 QA Chat Assistant            ") + chalk.hex("#00d4ff")(" │"));
  console.log(chalk.hex("#00d4ff")("╰──────────────────────────────────────────────╯"));
  console.log(chalk.hex("#48dbfb")("  Provider: ") + chalk.bold(activeBanner()));
  if (opts.guide) {
    console.log(chalk.hex("#feca57")("  Guide: ") + chalk.dim(opts.guide));
  }
  console.log(chalk.dim('\n  Type your question. "/help" for commands, "/exit" to quit.\n'));

  // Load guide context if provided
  let guideContext: string | undefined;
  if (opts.guide) {
    const guidePath = resolve(opts.guide);
    if (existsSync(guidePath)) {
      try {
        const { markdown } = loadStructureGuide(guidePath);
        guideContext = markdown;
        ui.success(`Loaded structure guide (${markdown.length} chars)`);
        console.log();
      } catch (err) {
        ui.warn(`Could not load guide: ${err}`);
      }
    } else {
      ui.warn(`Guide not found: ${guidePath}`);
    }
  }

  const session = new ChatSession({
    context: guideContext,
  });

  while (true) {
    let question: string;
    try {
      question = await input({ message: chalk.cyan(">") });
    } catch {
      console.log();
      break;
    }

    const trimmed = question.trim();
    if (!trimmed) continue;

    if (trimmed === "/exit" || trimmed === "/quit") {
      ui.dim("Bye!");
      break;
    }
    if (trimmed === "/help") {
      printHelp();
      continue;
    }
    if (trimmed === "/reset") {
      session.reset();
      ui.success("Conversation cleared.");
      continue;
    }

    process.stdout.write(chalk.green("<") + " ");
    try {
      await session.sendStream(trimmed, (chunk) => {
        process.stdout.write(chunk);
      });
      process.stdout.write("\n\n");
    } catch (err) {
      process.stdout.write("\n");
      const message = err instanceof Error ? err.message : String(err);
      ui.error(`LLM error: ${message}`);
      ui.dim('Run "qa config" to check your provider settings, or "qa models" to verify connectivity.');
      console.log();
    }
  }
}

function printHelp(): void {
  console.log();
  console.log(chalk.bold("Commands:"));
  console.log(chalk.dim("  /reset   ") + "clear conversation history");
  console.log(chalk.dim("  /help    ") + "show this help");
  console.log(chalk.dim("  /exit    ") + "quit the chat");
  console.log();
}
