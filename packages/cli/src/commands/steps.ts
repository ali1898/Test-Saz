import { input } from "@inquirer/prompts";
import { resolve } from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";
import { getActiveProvider } from "@testsaz/core";
import { ui, withSpinner, chalk } from "../ui";

export interface StepsOptions {
  goal?: string;
  output?: string;
  yes?: boolean;
}

const STEPS_SYSTEM_PROMPT = `You are a test automation assistant. Generate a JSON steps file for Playwright page interactions.

Output ONLY valid JSON (no markdown, no explanation). Format:
{
  "steps": [
    {"action": "click", "selector": "#element-id"},
    {"action": "select", "selector": "#dropdown", "value": "Option A"},
    {"action": "type", "selector": "#input", "value": "text"},
    {"action": "wait", "selector": ".element", "timeout": 5000},
    {"action": "hover", "selector": ".menu-item"},
    {"action": "scroll", "selector": ".section"},
    {"action": "press", "value": "Enter"}
  ],
  "waitAfterMs": 1000
}

Available actions:
- click: Click an element
- select: Select option from dropdown (requires value)
- type: Type text into input (requires value)
- wait: Wait for element to appear (optional timeout, default 5000)
- check/uncheck: Toggle checkbox
- hover: Hover over element
- scroll: Scroll element into view
- press: Press keyboard key (optional value, default "Enter")

Use CSS selectors (id, class, attribute, tag). Be specific and realistic.`;

export async function stepsCommand(opts: StepsOptions): Promise<void> {
  console.log(chalk.bold("\n  Steps File Generator\n"));

  let goal = opts.goal;
  if (!goal && !opts.yes) {
    goal = await input({ message: "Describe the page interactions:" });
  }
  if (!goal) {
    ui.error("Description is required. Use --goal or provide it interactively.");
    process.exit(1);
  }

  let output = opts.output;
  if (!output && !opts.yes) {
    output = await input({ message: "Output file path:", default: "steps/steps.json" });
  }
  if (!output) output = "steps/steps.json";

  console.log(chalk.dim("  goal:") + `    ${goal}`);
  console.log(chalk.dim("  output:") + `   ${output}`);
  console.log();

  const provider = getActiveProvider();

  const result = await withSpinner("Generating steps file...", async () => {
    const response = await provider.chat([
      { role: "system", content: STEPS_SYSTEM_PROMPT },
      { role: "user", content: `Generate a steps JSON file for: ${goal}` },
    ]);
    return response.content;
  });

  // Parse and validate JSON
  let stepsJson: string;
  try {
    const parsed = JSON.parse(result);
    stepsJson = JSON.stringify(parsed, null, 2);
  } catch {
    // Try to extract JSON from response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      stepsJson = JSON.stringify(JSON.parse(jsonMatch[0]), null, 2);
    } else {
      ui.error("Failed to parse LLM response as JSON. Raw output:");
      console.log(result);
      process.exit(1);
    }
  }

  // Write file
  const fullPath = resolve(process.cwd(), output);
  mkdirSync(resolve(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, stepsJson, "utf-8");

  console.log(chalk.green("  ✔ ") + chalk.dim(fullPath));
  console.log();
  console.log(chalk.dim("  Usage:"));
  console.log(chalk.dim(`    qa hybrid --url <URL> --steps-file ${output}`));
  console.log(chalk.dim(`    qa analyze --url <URL> --steps-file ${output}`));
  console.log();
}
