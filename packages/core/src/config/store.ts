/**
 * Persists and loads the user configuration from ~/.qa-test-gen/config.json.
 *
 * Handles missing/corrupt files gracefully and merges with defaults so a
 * partial config from an older version still loads.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { appConfigSchema, type AppConfig, type ProviderConfig } from "./schema";
export type { AppConfig, ProviderConfig };

const CONFIG_DIR = join(homedir(), ".qa-test-gen");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export function defaultConfig(): AppConfig {
  return {
    activeProvider: "ollama",
    providers: {
      ollama: { provider: "ollama", model: "llama3.1" },
      lmstudio: { provider: "lmstudio", model: "local-model", baseURL: "http://localhost:1234/v1" },
      llamacpp: { provider: "llamacpp", model: "local-model", baseURL: "http://localhost:8080/v1" },
      opencode: { provider: "opencode", model: "gpt-5.4-nano", baseURL: "https://opencode.ai/zen/v1" },
	"9router": { provider: "9router", model: "9router-model", baseURL: "http://localhost:8000/v1" },
    },
    temperature: 0.3,
    maxTokens: 2048,
  };
}

/** Load config from disk, falling back to defaults on any error. */
export function loadConfig(): AppConfig {
  try {
    if (!existsSync(CONFIG_FILE)) {
      return defaultConfig();
    }
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    // Merge with defaults to tolerate partial/older configs.
    return appConfigSchema.parse({ ...defaultConfig(), ...parsed });
  } catch (err) {
    // Don't crash the app on a corrupt config — surface a warning instead.
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[qa-test-gen] Config load failed, using defaults: ${message}`);
    return defaultConfig();
  }
}

/** Persist config to disk, creating the directory if needed. */
export function saveConfig(config: AppConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

/** Set or replace a single provider config and optionally activate it. */
export function upsertProvider(
  config: AppConfig,
  entry: ProviderConfig,
  makeActive = false,
): AppConfig {
  const next: AppConfig = {
    ...config,
    providers: { ...config.providers, [entry.provider]: entry },
  };
  if (makeActive) {
    next.activeProvider = entry.provider;
  }
  return next;
}

/** Get the config block for the currently active provider. */
export function activeProviderConfig(config: AppConfig): ProviderConfig {
  const entry = config.providers[config.activeProvider];
  if (!entry) {
    throw new Error(
      `No configuration for active provider "${config.activeProvider}". ` +
        `Run "qa config" to set it up.`,
    );
  }
  return entry;
}

export const configPaths = { CONFIG_DIR, CONFIG_FILE };
