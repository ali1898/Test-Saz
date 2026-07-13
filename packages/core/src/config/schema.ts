/**
 * User configuration persisted to ~/.qa-test-gen/config.json.
 *
 * A user configures one or more providers but only one is "active" at a time.
 */
import { z } from "zod";

export const KNOWN_PROVIDERS = ["ollama", "lmstudio", "llamacpp", "openrouter", "gemini", "opencode", "9router"] as const;

export const providerConfigSchema = z.object({
  /** Which backend this config block targets. */
  provider: z.string(),
  /** Default model id for this provider, e.g. "llama3.1" or "gpt-4o-mini". */
  model: z.string(),
  /** Base URL for OpenAI-compatible servers (ignored for ollama/gemini). */
  baseURL: z.string().optional(),
  /** API key (required for openrouter/gemini, optional for local servers). */
  apiKey: z.string().optional(),
});

export type ProviderConfig = z.infer<typeof providerConfigSchema>;

export const appConfigSchema = z.object({
  /** Currently selected provider — must match one entry in `providers`. */
  activeProvider: z.string(),
  /** Registered provider configs, keyed by provider id. */
  providers: z.record(providerConfigSchema),
  /** Default chat temperature. */
  temperature: z.number().min(0).max(2).default(0.3),
  /** Default max tokens for completions. */
  maxTokens: z.number().int().positive().default(2048),
});

export type AppConfig = z.infer<typeof appConfigSchema>;
