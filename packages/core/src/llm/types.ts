/**
 * Common types and interfaces for LLM providers.
 *
 * All providers (Ollama, LM Studio, llama.cpp, OpenRouter, Gemini) implement
 * the same `LLMProvider` interface so the rest of the app is provider-agnostic.
 */

export type ProviderId = string;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  /** Sampling temperature (0 = deterministic, 1 = creative). */
  temperature?: number;
  /** Max tokens to generate. */
  maxTokens?: number;
  /** Optional system prompt prepended to the conversation. */
  systemPrompt?: string;
}

export interface ChatResult {
  /** Full assistant response text. */
  content: string;
  /** Token usage if reported by the provider. */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/** A model listed by a provider (local or remote). */
export interface ModelInfo {
  id: string;
  /** Human-readable name, falls back to id. */
  name?: string;
}

/**
 * Streaming callback — receives incremental text chunks as they arrive.
 * Return false to abort the stream early.
 */
export type StreamHandler = (chunk: string) => boolean | void;

/**
 * The contract every LLM backend must satisfy.
 */
export interface LLMProvider {
  /** Stable provider identifier. */
  readonly id: ProviderId;

  /** Human-readable provider name. */
  readonly displayName: string;

  /** Whether this provider can run fully offline (no API key required). */
  readonly isLocal: boolean;

  /** Send a complete (non-streaming) chat request. */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult>;

  /** Send a streaming chat request, invoking `onChunk` for each delta. */
  streamChat(
    messages: ChatMessage[],
    onChunk: StreamHandler,
    options?: ChatOptions,
  ): Promise<ChatResult>;

  /** List models available to this provider. */
  listModels(): Promise<ModelInfo[]>;
}
