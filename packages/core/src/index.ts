/**
 * Public API of @testsaz/core.
 *
 * Sub-modules: llm, config, generator, chat, docs.
 */

// ── LLM ────────────────────────────────────────────────────────────────────
export * from "./llm/types";
export {
  getActiveProvider,
  getProviderForConfig,
  setActiveConfig,
} from "./llm";
export { createProvider } from "./llm/provider-factory";
export { OllamaProvider } from "./llm/ollama";
export { GeminiProvider } from "./llm/gemini";
export {
  LMStudioProvider,
  LlamaCppProvider,
  OpenRouterProvider,
  OpenCodeProvider,
  OpenAIProvidersProvider,
} from "./llm/providers-openai-like";
export { OpenAICompatibleProvider } from "./llm/openai-compatible";

// ── Config ──────────────────────────────────────────────────────────────────
export * from "./config/schema";
export {
  defaultConfig,
  loadConfig,
  saveConfig,
  upsertProvider,
  activeProviderConfig,
  configPaths,
} from "./config/store";

// ── Generator ───────────────────────────────────────────────────────────────
export * from "./generator/types";
export { scaffoldProject, collectFiles } from "./generator/scaffold";
export {
  generateTest,
  generatePage,
  generateLocators,
  generateHelper,
  generateBdd,
  generateAll,
  generateCommand,
  generateScenario,
} from "./generator/generate";
export {
  analyzePage,
  analyzeAndGenerate,
  generateScenarioFromAnalysis,
  type PageAnalysis,
  type PageElement,
  type PageForm,
  type AuthOptions,
  type AnalyzeOptions,
} from "./generator/page-analyzer";
export { crawlSite, type CrawlResult, type CrawlElements } from "./generator/crawler";
export { hybridGenerate, type HybridOptions } from "./generator/hybrid";
export { launchBrowser, detectSystemBrowsers } from "./generator/browser-launcher";
export {
  runPipeline,
  runParallelStages,
  type PipelineStage,
  type PipelineResult,
} from "./generator/pipeline";

// ── Structure Guide ─────────────────────────────────────────────────────────
export {
  analyzeProjectStructure,
  renderStructureGuide,
  loadStructureGuide,
  resolveArtifactPath,
  findNearestGuide,
} from "./generator/structure-guide";
export type {
  StructureGuide,
  StructureMeta,
  LayerInfo,
  NamingConventionEntry,
} from "./generator/structure-guide";

// ── Chat ────────────────────────────────────────────────────────────────────
export {
  ChatSession,
  askQa,
} from "./chat/chat-session";

// ── Prompts ────────────────────────────────────────────────────────────────
export {
  QA_SYSTEM_PROMPT,
  QA_CHAT_SYSTEM_PROMPT,
  buildSystemPrompt,
  EDGE_CASE_PROMPT,
} from "./generator/prompts";

// ── Docs ────────────────────────────────────────────────────────────────────
export {
  analyzeProject,
  renderMarkdown,
  renderHtml,
} from "./docs/markdown-generator";
export type {
  ProjectAnalysis,
  FeatureOutline,
  DocsOptions,
} from "./docs/markdown-generator";
export {
  publishPage as publishConfluencePage,
  loadConfluenceConfigFromFile,
} from "./docs/confluence-client";
export type {
  ConfluenceConfig,
  PublishResult,
} from "./docs/confluence-client";

// ── Commands ────────────────────────────────────────────────────────────────
export { healSelector } from "./commands/healing";
export type { HealingResult } from "./commands/healing";
export { suggestFix, parseFailureReport } from "./generator/fixer";
export type { FailureAnalysis } from "./generator/fixer";

// ── Meta ────────────────────────────────────────────────────────────────────
export const CORE_VERSION = "1.0.0";
