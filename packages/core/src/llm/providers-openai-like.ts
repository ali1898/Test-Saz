/**
 * Concrete OpenAI-compatible providers.
 *
 * Each just pins the `id`, `displayName`, `isLocal` flag and (for OpenRouter,
 * OpenCode, etc.) some default headers. All real logic lives in
 * `OpenAICompatibleProvider`.
 */
import { OpenAICompatibleProvider } from "./openai-compatible";
import type { ProviderId } from "./types";

/** LM Studio — desktop GUI server, default port 1234. */
export class LMStudioProvider extends OpenAICompatibleProvider {
  readonly id: ProviderId = "lmstudio";
  readonly displayName = "LM Studio";
  readonly isLocal = true;
}

/** llama.cpp server (`llama-server`), default port 8080. */
export class LlamaCppProvider extends OpenAICompatibleProvider {
  readonly id: ProviderId = "llamacpp";
  readonly displayName = "llama.cpp";
  readonly isLocal = true;
}

/**
 * OpenRouter — one API for dozens of remote models (GPT, Claude, Gemini, Llama).
 * Requires an API key from https://openrouter.ai/keys.
 */
export class OpenRouterProvider extends OpenAICompatibleProvider {
  readonly id: ProviderId = "openrouter";
  readonly displayName = "OpenRouter";
  readonly isLocal = false;

  constructor(config: { model: string; apiKey: string }) {
    super({
      model: config.model,
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: config.apiKey,
      defaultHeaders: {
        "HTTP-Referer": "https://github.com/qa-test-generator",
        "X-Title": "QA Test Generator",
      },
    });
  }
}

/**
 * OpenCode Zen — curated, tested models provided by the OpenCode team.
 * Requires an API key from https://opencode.ai/auth.
 * Uses the OpenAI-compatible /v1/chat/completions endpoint.
 */
export class OpenCodeProvider extends OpenAICompatibleProvider {
  readonly id: ProviderId = "opencode";
  readonly displayName = "OpenCode Zen";
  readonly isLocal = false;

  constructor(config: { model: string; apiKey: string }) {
    super({
      model: config.model,
      baseURL: "https://opencode.ai/zen/v1",
      apiKey: config.apiKey,
      defaultHeaders: {
        "HTTP-Referer": "https://github.com/qa-test-generator",
        "X-Title": "QA Test Generator",
      },
    });
  }
}

/**
 * 9Router — runs 9Router models (Nous Research) through any OpenAI-compatible
 * server. By default points to a local endpoint; configure baseURL to use a
 * remote or custom server.
 */
export class NineRouterProvider extends OpenAICompatibleProvider {
  readonly id: ProviderId = "9router";
  readonly displayName = "9Router (local)";
  readonly isLocal = true;
}
