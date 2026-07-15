import { input, select } from "@inquirer/prompts";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { generateScenario } from "@testsaz/core";
import { ui, chalk } from "../ui";

export interface ScenarioOptions {
  description?: string;
  projectRoot?: string;
  guide?: string;
  yes?: boolean;
}

export async function scenarioCommand(opts: ScenarioOptions): Promise<void> {
  const projectRoot = opts.projectRoot ?? process.cwd();

  const raw = opts.description;
  let description = raw ?? "";
  if (!raw && !opts.yes) {
    description = await input({
      message: "Describe the scenario you want to write (e.g. 'user login with valid credentials'):",
    });
    if (!description) {
      ui.error("A description is required.");
      process.exit(1);
    }
  }

  let scenario = "";
  if (!opts.yes) {
    scenario = await withEditLoop(
      description,
      (desc) => generateScenario(desc, { projectRoot, guide: opts.guide }),
      projectRoot,
      opts.guide,
    );
  } else {
    scenario = await generateScenario(description, { projectRoot, guide: opts.guide });
  }

  // ── Determine filename ──
  let fileName = "";
  if (!opts.yes) {
    const suggested = description
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "scenario";
    fileName = await input({
      message: "Enter filename (without .md, leave empty for auto):",
      default: suggested,
    });
    if (!fileName.trim()) fileName = suggested;
  } else {
    fileName = description
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "scenario";
  }

  const relPath = `scenarios/${fileName}.md`;
  const absPath = resolve(projectRoot, relPath);
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, scenario + "\n", "utf-8");

  console.log(chalk.green("\n  ✔ ") + chalk.bold("Scenario saved:") + chalk.dim(` ${relPath}`));
  console.log();
}

async function withEditLoop(
  initialDescription: string,
  generat: (desc: string) => Promise<string>,
  _projectRoot: string,
  _guide?: string,
): Promise<string> {
  let description = initialDescription;
  for (let iteration = 0; iteration < 10; iteration++) {
    const scenario = await generat(description);

    console.log(chalk.hex("#00d4ff")("\n─── Generated Scenario ───"));
    console.log(scenario);
    console.log(chalk.hex("#00d4ff")("──────────────────────────\n"));

    const action = await select<"save" | "refine" | "retry" | "cancel">({
      message: "What would you like to do?",
      choices: [
        { name: "Save it", value: "save" },
        { name: "Refine it — describe what to change", value: "refine" },
        { name: "Regenerate from scratch", value: "retry" },
        { name: "Cancel", value: "cancel" },
      ],
    });

    if (action === "save") return scenario;
    if (action === "cancel") {
      ui.error("Cancelled.");
      process.exit(1);
    }
    if (action === "retry") {
      description = await input({
        message: "Describe the scenario (type a new description):",
        default: initialDescription,
      });
      if (!description.trim()) description = initialDescription;
      continue;
    }
    if (action === "refine") {
      const feedback = await input({
        message: "What should change? Describe the changes:",
      });
      if (feedback.trim()) {
        description = `${description}\n\nChanges requested: ${feedback.trim()}`;
      }
      continue;
    }
  }

  ui.warn("Max iterations reached. Saving as-is.");
  return await generat(description);
}
