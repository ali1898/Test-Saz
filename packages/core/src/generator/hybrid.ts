import { chromium, type Browser, type Page } from "playwright";
import { getActiveProvider } from "../llm";
import type { LLMProvider } from "../llm/types";
import { analyzeAndGenerate, type AuthOptions } from "./page-analyzer";

export interface HybridOptions {
  projectRoot: string;
  provider?: LLMProvider;
  guide?: string;
  tier?: "smoke" | "regression";
  auth?: AuthOptions;
  name?: string;
  debug?: boolean;
}

function sanitizeName(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9\u0600-\u06FF]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

export async function hybridGenerate(
  url: string,
  options: HybridOptions
): Promise<{ paths: string[] }> {
  const provider = options.provider ?? getActiveProvider();

  // Use analyzeAndGenerate which has proper Playwright analysis + LLM generation
  // This handles cy.get() vs cy.getByCy() correctly based on selector type
  const result = await analyzeAndGenerate(url, {
    projectRoot: options.projectRoot,
    provider,
    guide: options.guide,
    tier: options.tier,
    name: options.name,
    auth: options.auth,
    debug: options.debug,
  });

  return { paths: result.paths };
}
