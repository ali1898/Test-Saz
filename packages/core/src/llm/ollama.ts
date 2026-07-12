/**
 * Ollama provider — talks directly to the local Ollama HTTP API
 * (http://localhost:11434). No API key required.
 *
 * Docs: https://github.com/ollama/ollama/blob/main/docs/api.md
 */
import type {
  ChatMessage,
  ChatOptions,
  ChatResult,
  LLMProvider,
  ModelInfo,
  StreamHandler,
} from "./types";

export interface OllamaConfig {
  model: string;
  /** Ollama host, defaults to http://localhost:11434. */
  host?: string;
}

interface OllamaChatRequest {
  model: string;
  messages: { role: string; content: string }[];
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
  };
}

interface OllamaModelInfo {
  name: string;
  modified_at?: string;
}

export class OllamaProvider implements LLMProvider {
  readonly id = "ollama" as const;
  readonly displayName = "Ollama";
  readonly isLocal = true;

  private readonly model: string;
  private readonly host: string;

  constructor(config: OllamaConfig) {
    this.model = config.model;
    this.host = (config.host || "http://localhost:11434").replace(/\/$/, "");
  }

  async chat(
    messages: ChatMessage[],
    options: ChatOptions = {},
  ): Promise<ChatResult> {
    const body: OllamaChatRequest = {
      model: this.model,
      messages: this.resolveMessages(messages, options),
      stream: false,
      options: {
        temperature: options.temperature,
        num_predict: options.maxTokens,
      },
    };

    const res = await fetch(`${this.host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(
        `Ollama chat failed (${res.status}): ${await res.text()}`,
      );
    }

    const rawData = await res.text();

    const data = JSON.parse(rawData) as {
      message?: { content: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };

    return {
      content: data.message?.content ?? "",
      usage:
        data.prompt_eval_count != null || data.eval_count != null
          ? {
              promptTokens: data.prompt_eval_count,
              completionTokens: data.eval_count,
              totalTokens:
                (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
            }
          : undefined,
    };
  }

  async streamChat(
    messages: ChatMessage[],
    onChunk: StreamHandler,
    options: ChatOptions = {},
  ): Promise<ChatResult> {
    const body: OllamaChatRequest = {
      model: this.model,
      messages: this.resolveMessages(messages, options),
      stream: true,
      options: {
        temperature: options.temperature,
        num_predict: options.maxTokens,
      },
    };

    const res = await fetch(`${this.host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      throw new Error(
        `Ollama stream failed (${res.status}): ${await res.text()}`,
      );
    }

    // Ollama streams newline-delimited JSON objects.
    let content = "";
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const json = JSON.parse(trimmed) as {
            message?: { content: string };
            done?: boolean;
          };
          const delta = json.message?.content ?? "";
          if (delta) {
            content += delta;
            if (onChunk(delta) === false) {
              await reader.cancel();
              return { content };
            }
          }
        } catch {
          // Partial JSON across chunks — ignore, will be completed next read.
        }
      }
    }

    return { content };
  }

  async listModels(): Promise<ModelInfo[]> {
    const res = await fetch(`${this.host}/api/tags`);
    if (!res.ok) {
      throw new Error(`Ollama listModels failed (${res.status})`);
    }
    const data = (await res.json()) as { models?: OllamaModelInfo[] };
    return (data.models ?? []).map((m) => ({ id: m.name, name: m.name }));
  }

  private resolveMessages(
    messages: ChatMessage[],
    options: ChatOptions,
  ): ChatMessage[] {
    const hasSystem = messages.some((m) => m.role === "system");
    if (options.systemPrompt && !hasSystem) {
      return [{ role: "system", content: options.systemPrompt }, ...messages];
    }
    return messages;
  }
}
