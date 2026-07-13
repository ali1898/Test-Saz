/**
 * Builds a concrete `LLMProvider` instance from a `ProviderConfig`.
 *
 * Centralizes provider construction so the rest of the app never imports a
 * specific backend — it just asks the factory for the active provider.
 */
import type { ProviderConfig } from "../config/schema";
import type { LLMProvider } from "./types";
import { OllamaProvider } from "./ollama";
import { GeminiProvider } from "./gemini";
import {
  LMStudioProvider,
  LlamaCppProvider,
  OpenRouterProvider,
  OpenCodeProvider,
  NineRouterProvider,
} from "./providers-openai-like";

/** Create the provider described by `config`. */
export function createProvider(config: ProviderConfig): LLMProvider {
  switch (config.provider) {
    case "ollama":
      return new OllamaProvider({
        model: config.model,
        host: config.baseURL,
      });

    case "lmstudio":
      return new LMStudioProvider({
        model: config.model,
        baseURL: config.baseURL || "http://localhost:1234/v1",
        apiKey: config.apiKey,
      });

    case "llamacpp":
      return new LlamaCppProvider({
        model: config.model,
        baseURL: config.baseURL || "http://localhost:8080/v1",
        apiKey: config.apiKey,
      });

    case "openrouter":
      if (!config.apiKey) {
        throw new Error(
          "OpenRouter requires an API key. Get one at https://openrouter.ai/keys",
        );
      }
      return new OpenRouterProvider({ model: config.model, apiKey: config.apiKey });

    case "gemini":
      if (!config.apiKey) {
        throw new Error(
          "Gemini requires an API key. Get one at https://aistudio.google.com/app/apikey",
        );
      }
      return new GeminiProvider({ model: config.model, apiKey: config.apiKey });

    case "opencode":
      if (!config.apiKey) {
        throw new Error(
          "OpenCode Zen requires an API key. Get one at https://opencode.ai/auth",
        );
      }
      return new OpenCodeProvider({ model: config.model, apiKey: config.apiKey });

    case "9router":
      return new NineRouterProvider({
        model: config.model,
        baseURL: config.baseURL || "http://localhost:8000/v1",
        apiKey: config.apiKey,
      });

    default:
      throw new Error(`Unknown provider: ${config.provider}. Run 'qa config' to set up a valid provider.`);
  }
}
