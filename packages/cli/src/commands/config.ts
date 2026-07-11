/**
 * `qa config` — configure LLM providers interactively.
 *
 * Lets the user add/edit a provider (provider, model, baseURL, apiKey),
 * set the active provider, and persists the result to ~/.qa-test-gen/config.json.
 */
import { select, input, password, confirm } from "@inquirer/prompts";
import {
  loadConfig,
  saveConfig,
  upsertProvider,
  activeProviderConfig,
  type AppConfig,
  type ProviderConfig,
  type ProviderId,
} from "@qa-test-generator/core";
import chalk from "chalk";
import { ui } from "../ui";

const PROVIDER_LABELS: Record<ProviderId, string> = {
  ollama: "Ollama (local)",
  lmstudio: "LM Studio (local)",
  llamacpp: "llama.cpp (local)",
  openrouter: "OpenRouter (cloud)",
  gemini: "Google Gemini (cloud)",
  opencode: "OpenCode Zen (cloud)",
	"9router": "9Router (local)",
};

const DEFAULT_BASE_URLS: Partial<Record<ProviderId, string>> = {
  ollama: "http://localhost:11434",
  lmstudio: "http://localhost:1234/v1",
  llamacpp: "http://localhost:8080/v1",
  opencode: "https://opencode.ai/zen/v1",
	"9router": "http://localhost:8000/v1",
};

const SUGGESTED_MODELS: Partial<Record<ProviderId, string[]>> = {
  ollama: ["llama3.1", "llama3.1:8b", "qwen2.5-coder:7b", "mistral"],
  lmstudio: ["local-model"],
  llamacpp: ["local-model"],
  openrouter: ["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", "google/gemini-flash-1.5"],
  gemini: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-exp"],
  opencode: ["gpt-5.4-nano", "gpt-5.4-mini", "deepseek-v4-flash", "claude-sonnet-4-5"],
	"9router": ["9router-model", "NousResearch/9Router-3", "dolphin-2.9.1-llama-3b"],
};

export async function configCommand(): Promise<void> {
  const config = loadConfig();
  console.log(chalk.hex("#00d4ff")("\n╭──────────────────────────────────────────────╮"));
  console.log(chalk.hex("#00d4ff")("│") + chalk.bold.white("          ⚙️  LLM Configuration             ") + chalk.hex("#00d4ff")(" │"));
  console.log(chalk.hex("#00d4ff")("╰──────────────────────────────────────────────╯"));
  console.log(chalk.dim("  Config file: ~/.qa-test-gen/config.json\n"));

  const action = await select<"add" | "switch" | "show" | "edit" | "reset">({
    message: "What do you want to do?",
    choices: [
      { name: "Add / edit a provider", value: "add" },
      { name: "Switch active provider", value: "switch" },
      { name: "Show current configuration", value: "show" },
      { name: "Edit a provider", value: "edit" },
      { name: "Reset to defaults", value: "reset" },
    ],
  });

  if (action === "show") {
    printConfig(config);
    return;
  }

  if (action === "reset") {
    const ok = await confirm({ message: "Reset all settings to defaults?", default: false });
    if (ok) {
      const { defaultConfig } = await import("@qa-test-generator/core");
      saveConfig(defaultConfig());
      ui.success("Configuration reset.");
    }
    return;
  }

  if (action === "switch") {
    const configured = Object.keys(config.providers) as ProviderId[];
    if (configured.length === 0) {
      ui.warn("No providers configured yet. Add one first.");
      return;
    }
    const next = await select<ProviderId>({
      message: "Active provider:",
      default: config.activeProvider,
      choices: configured.map((p) => ({
        name: `${PROVIDER_LABELS[p]}${p === config.activeProvider ? " (active)" : ""}`,
        value: p,
      })),
    });
    saveConfig({ ...config, activeProvider: next });
    ui.success(`Active provider: ${PROVIDER_LABELS[next]}`);
    return;
  }

  // add | edit — both gather provider details
  const provider = await select<ProviderId>({
    message: "Which provider?",
    choices: (Object.keys(PROVIDER_LABELS) as ProviderId[]).map((p) => ({
      name: PROVIDER_LABELS[p],
      value: p,
    })),
  });

  const existing = config.providers[provider];
  const modelChoices = SUGGESTED_MODELS[provider] ?? [];
  const model = await input({
    message: "Model:",
    default: existing?.model ?? modelChoices[0] ?? "default-model",
  });

  let baseURL: string | undefined = existing?.baseURL;
  if (provider in DEFAULT_BASE_URLS) {
    baseURL = await input({
      message: "Base URL:",
      default: baseURL ?? DEFAULT_BASE_URLS[provider],
    });
  }

  let apiKey: string | undefined = existing?.apiKey;
  if (provider === "openrouter" || provider === "gemini" || provider === "opencode") {
    apiKey = await password({
      message: "API key (input hidden):",
      mask: "*",
    });
    if (!apiKey) {
      ui.warn("No key entered — this provider won't work until you add one.");
    }
  } else if (provider === "9router") {
    const setKey = await confirm({ message: "Set an API key? (optional for local)", default: false });
    if (setKey) {
      apiKey = await password({
        message: "API key (input hidden):",
        mask: "*",
      });
    }
  }

  const entry: ProviderConfig = { provider, model, ...(baseURL ? { baseURL } : {}), ...(apiKey ? { apiKey } : {}) };
  const makeActive = await confirm({ message: "Make this the active provider?", default: true });
  const next = upsertProvider(config, entry, makeActive);
  saveConfig(next);
  ui.success(`Saved ${PROVIDER_LABELS[provider]}${makeActive ? " (active)" : ""}.`);
}

/** Print the current config with secrets masked. */
export function printConfig(config: AppConfig): void {
  console.log(chalk.hex("#00d4ff")("\n╭──────────────────────────────────────────────╮"));
  console.log(chalk.hex("#00d4ff")("│") + chalk.bold.white("          📋 Current Configuration          ") + chalk.hex("#00d4ff")(" │"));
  console.log(chalk.hex("#00d4ff")("╰──────────────────────────────────────────────╯"));
  console.log(chalk.hex("#48dbfb")("  Active provider: ") + chalk.bold(config.activeProvider));
  console.log(chalk.dim(`  Temperature: ${config.temperature}  ·  Max tokens: ${config.maxTokens}\n`));
  for (const [id, entry] of Object.entries(config.providers)) {
    const active = id === config.activeProvider ? chalk.hex("#48dbfb")(" ◆ active") : "";
    console.log(`  ${chalk.hex("#feca57")("●")} ${chalk.bold(PROVIDER_LABELS[id as ProviderId] ?? id)}${active}`);
    console.log(`    ${chalk.dim("model:")}   ${entry.model}`);
    if (entry.baseURL) console.log(`    ${chalk.dim("baseURL:")} ${entry.baseURL}`);
    console.log(`    ${chalk.dim("apiKey:")}  ${entry.apiKey ? chalk.green("✓ set") + chalk.dim(` (${entry.apiKey.slice(0, 4)}…)`) : chalk.dim("not set")}`);
  }
}

/** Expose active provider info for other commands' banners. */
export function activeBanner(): string {
  const config = loadConfig();
  try {
    const entry = activeProviderConfig(config);
    return `${PROVIDER_LABELS[entry.provider] ?? entry.provider} · ${entry.model}`;
  } catch {
    return "no provider configured (run: qa config)";
  }
}
