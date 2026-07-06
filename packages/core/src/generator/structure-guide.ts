import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, relative, resolve, sep } from "node:path";

// ── Types ───────────────────────────────────────────────────────────────────

export interface StructureMeta {
  outputPaths: Record<string, string>;
  namingPatterns: Record<string, string>;
}

export interface StructureGuide {
  projectName: string;
  projectRoot: string;
  language: "typescript" | "javascript" | "mixed";
  architecture: string;
  directoryTree: string;
  layers: LayerInfo[];
  namingConventions: NamingConventionEntry[];
  codePatterns: string;
  importAliases: Record<string, string>;
  customCommands: string[];
  meta: StructureMeta;
  rawMarkdown: string;
}

export interface LayerInfo {
  name: string;
  path: string;
  fileCount: number;
  sampleFiles: string[];
  description: string;
}

export interface NamingConventionEntry {
  layer: string;
  pattern: string;
  example: string;
}

export interface AnalyzeOptions {
  projectRoot?: string;
  projectName?: string;
}

// ── Default values for a standard Cypress + POM project ────────────────────

const DEFAULT_META: StructureMeta = {
  outputPaths: {
    test: "cypress/e2e/test/smoke",
    testRegression: "cypress/e2e/test/regression",
    page: "cypress/e2e/pages",
    locators: "cypress/e2e/locators",
    helper: "cypress/support/helpers",
    bdd: "cypress/e2e/features",
    bddSteps: "cypress/e2e/step-definitions",
    flow: "cypress/support/flows",
    utils: "cypress/utils",
    fixture: "cypress/fixtures",
    type: "cypress/support/types",
  },
  namingPatterns: {
    test: "{name}.cy.ts",
    page: "{Pascal}Page.ts",
    locators: "{Pascal}Locators.ts",
    helper: "{camel}Helper.helper.ts",
    bdd: "{name}.feature",
    bddSteps: "{Pascal}Steps.ts",
    flow: "{camel}Flow.ts",
    utils: "{camel}.ts",
    fixture: "{Pascal}.json",
    type: "{Pascal}.types.ts",
  },
};

// ── Filesystem helpers ──────────────────────────────────────────────────────

const IGNORED_DIRS = new Set([
  "node_modules", "dist", "build", ".git",
  "videos", "screenshots", "reports",
  "allure-report", "allure-results", ".tmp",
]);

function walkdir(dir: string, prefix = ""): string[] {
  const result: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return result;
  }
  for (const entry of entries.sort()) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    let stats: ReturnType<typeof statSync>;
    try {
      stats = statSync(full);
    } catch { continue; }
    if (stats.isDirectory()) {
      if (!IGNORED_DIRS.has(entry)) {
        result.push(`${prefix}${entry}/`);
        result.push(...walkdir(full, `${prefix}  `));
      }
    } else {
      result.push(`${prefix}${entry}`);
    }
  }
  return result;
}

function listFiles(dir: string, acc: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch { return acc; }
  for (const entry of entries) {
    const full = join(dir, entry);
    let stats: ReturnType<typeof statSync>;
    try { stats = statSync(full); } catch { continue; }
    if (stats.isDirectory()) {
      if (!IGNORED_DIRS.has(entry)) listFiles(full, acc);
    } else if (stats.isFile()) {
      acc.push(full);
    }
  }
  return acc;
}

function readPackageName(root: string): string | undefined {
  const p = join(root, "package.json");
  if (!existsSync(p)) return;
  try { return JSON.parse(readFileSync(p, "utf-8")).name; } catch { return; }
}

function detectLanguage(files: string[]): "typescript" | "javascript" | "mixed" {
  const hasTs = files.some((f) => extname(f) === ".ts");
  const hasJs = files.some((f) => extname(f) === ".js");
  if (hasTs && hasJs) return "mixed";
  if (hasTs) return "typescript";
  return "javascript";
}

function readImportAliases(root: string): Record<string, string> {
  const tsconfigPath = join(root, "tsconfig.json");
  if (!existsSync(tsconfigPath)) return {};
  try {
    const raw = readFileSync(tsconfigPath, "utf-8");
    const cfg = JSON.parse(raw);
    return cfg.compilerOptions?.paths ?? {};
  } catch { return {}; }
}

function countDirFiles(dir: string): number {
  try {
    const all = listFiles(dir);
    return all.filter((f) => {
      try { return statSync(f).isFile(); } catch { return false; }
    }).length;
  } catch { return 0; }
}

// ── Pattern detection ───────────────────────────────────────────────────────

function detectNamingConvention(files: string[], layerPath: string, projectRoot: string): string {
  const absLayerPath = resolve(projectRoot, layerPath);
  const dirFiles = files.filter((f) => f.startsWith(absLayerPath));
  if (dirFiles.length === 0) return "—";
  const names = dirFiles.map((f) => basename(f));
  if (names.length === 0) return "—";

  // Try to detect common patterns
  const extCounts: Record<string, number> = {};
  for (const n of names) {
    const e = extname(n);
    extCounts[e] = (extCounts[e] ?? 0) + 1;
  }
  const dominantExt = Object.entries(extCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ".ts";

  // Check for suffix patterns
  const sample = names[0];
  const hasPageSuffix = /Page\.[a-z]+$/i.test(sample);
  const hasLocatorSuffix = /Locators?\.[a-z]+$/i.test(sample);
  const hasHelperSuffix = /Helper\.helper\.[a-z]+$/i.test(sample);
  const hasTestSuffix = /Test\.cy\.[a-z]+$/i.test(sample);
  const hasSpecSuffix = /\.cy\.[a-z]+$/i.test(sample);
  const hasTypesSuffix = /\.types?\.[a-z]+$/i.test(sample);
  const hasEnumSuffix = /Enum\.enum\.[a-z]+$/i.test(sample);
  const hasHandlerSuffix = /Handler\.handler\.[a-z]+$/i.test(sample);
  const hasMapperSuffix = /Mapper\.mapper\.[a-z]+$/i.test(sample);
  const hasJsonDataSuffix = /Json\.json$/i.test(sample);
  const hasUtilSuffix = /\.util\.[a-z]+$/i.test(sample);
  const hasFlowSuffix = /Flow\.[a-z]+$/i.test(sample);
  const hasFeatureSuffix = /\.feature$/i.test(sample);
  const hasQuerySuffix = /\.queries\.[a-z]+$/i.test(sample);

  if (hasPageSuffix) return `{Pascal}Page${dominantExt}`;
  if (hasLocatorSuffix) return `{Pascal}Locators${dominantExt}`;
  if (hasHelperSuffix) return `{camel}Helper.helper${dominantExt}`;
  if (hasTestSuffix) return `{Pascal}Test.cy${dominantExt}`;
  if (hasSpecSuffix) return `{name}.cy${dominantExt}`;
  if (hasTypesSuffix) return `{Pascal}.types${dominantExt}`;
  if (hasEnumSuffix) return `{Pascal}Enum.enum${dominantExt}`;
  if (hasHandlerSuffix) return `{Pascal}Handler.handler${dominantExt}`;
  if (hasMapperSuffix) return `{camel}Mapper.mapper${dominantExt}`;
  if (hasJsonDataSuffix) return `{Pascal}Json.json`;
  if (hasUtilSuffix) return `{camel}.util${dominantExt}`;
  if (hasFlowSuffix) return `{camel}Flow${dominantExt}`;
  if (hasFeatureSuffix) return `{name}.feature`;
  if (hasQuerySuffix) return `{camel}.queries${dominantExt}`;

  // Fallback: use the most common pattern from the first few files
  const first = names[0];
  const nameWithoutExt = first.replace(/\.[^/.]+$/, "");
  if (/^[A-Z]/.test(nameWithoutExt)) return `{Pascal}${dominantExt}`;
  return `{camel}${dominantExt}`;
}

function detectCodePatterns(root: string, layerDirs: Record<string, string>): string {
  const patterns: string[] = [];

  // Check pages for class-based POM
  const pageDir = layerDirs["Page Objects"];
  if (pageDir && existsSync(pageDir)) {
    const files = readdirSync(pageDir).filter((f) => /\.(ts|js)$/.test(f));
    if (files.length > 0) {
      const sample = readFileSync(join(pageDir, files[0]), "utf-8");
      if (/class\s+\w+/.test(sample)) patterns.push("class-based Page Objects");
      if (/export\s+(const|let|var)\s+\w+\s*=\s*new\s+/.test(sample)) patterns.push("singleton instance export");
      if (/Cypress\.Chainable/.test(sample)) patterns.push("typed Cypress.Chainable return values");
      if (/cy\.get\(/.test(sample) || /cy\.getByCy\(/.test(sample)) patterns.push("custom commands (getByCy)");
      if (/import\s+\{.*LOCATORS/i.test(sample)) patterns.push("separate locator imports");
    }
  }

  // Check helpers for function patterns
  const helperDir = layerDirs["Helpers"];
  if (helperDir && existsSync(helperDir)) {
    const files = readdirSync(helperDir).filter((f) => /\.(ts|js)$/.test(f));
    if (files.length > 0) {
      const sample = readFileSync(join(helperDir, files[0]), "utf-8");
      if (/cy\.wrap\(null\)\.then\(/.test(sample)) patterns.push("cy.wrap(null).then(...) sequencing");
      if (/=\s*\{[^}]*=\s*true[^}]*\}/s.test(sample)) patterns.push("options object with defaults");
      if (/export\s+(const|function)\s+\w+/.test(sample)) patterns.push("exported helper functions");
    }
  }

  // Check locators for const pattern
  const locDir = layerDirs["Locators"];
  if (locDir && existsSync(locDir)) {
    const files = readdirSync(locDir).filter((f) => /\.(ts|js)$/.test(f));
    if (files.length > 0) {
      const sample = readFileSync(join(locDir, files[0]), "utf-8");
      if (/as\s+const/.test(sample)) patterns.push("as const for literal types");
      if (/UPPER_SNAKE_CASE/.test(sample) || /[A-Z]+_[A-Z]+/.test(sample)) patterns.push("UPPER_SNAKE_CASE constants");
      if (/\w+:\s*\{[^}]*\w+:\s*"[^"]*"/.test(sample)) patterns.push("nested group objects");
    }
  }

  return patterns.length > 0 ? patterns.join(", ") : "standard Cypress patterns";
}

function detectCustomCommands(root: string): string[] {
  const commandsPath = join(root, "cypress", "support", "commands.ts");
  const commandsJsPath = join(root, "cypress", "support", "commands.js");
  const path = existsSync(commandsPath) ? commandsPath : existsSync(commandsJsPath) ? commandsJsPath : "";
  if (!path) return [];
  try {
    const content = readFileSync(path, "utf-8");
    const cmds: string[] = [];
    const regex = /Cypress\.Commands\.add\(["'](\w+)["']/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      cmds.push(match[1]);
    }
    return cmds;
  } catch { return []; }
}

function readConfigValue(root: string, key: string): string | undefined {
  for (const c of ["cypress.config.ts", "cypress.config.js", "cypress.config.mjs"]) {
    const p = join(root, c);
    if (!existsSync(p)) continue;
    try {
      const content = readFileSync(p, "utf-8");
      const m = content.match(new RegExp(`${key}:\\s*["']([^"']+)["']`));
      if (m) return m[1];
    } catch { continue; }
  }
  return;
}

function readFeatureOutlines(root: string): string[] {
  const featuresDir = join(root, "cypress", "e2e", "features");
  if (!existsSync(featuresDir)) return [];
  const scenarios: string[] = [];
  try {
    for (const f of readdirSync(featuresDir).filter((f) => f.endsWith(".feature"))) {
      const content = readFileSync(join(featuresDir, f), "utf-8");
      for (const line of content.split("\n")) {
        const m = line.match(/^\s*(?:Scenario|Scenario Outline):\s*(.+)$/);
        if (m) scenarios.push(m[1].trim());
      }
    }
  } catch { /* ignore */ }
  return scenarios;
}

// ── Main analysis ───────────────────────────────────────────────────────────

export function analyzeProjectStructure(options: AnalyzeOptions = {}): StructureGuide {
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  const projectName = options.projectName ?? readPackageName(projectRoot) ?? basename(projectRoot);

  const allFiles = listFiles(projectRoot);
  const rel = (f: string) => relative(projectRoot, f).replace(/\\/g, "/");
  const language = detectLanguage(allFiles);

  const cypressDir = join(projectRoot, "cypress");

  // Detect layer directories
  const layerDirs: Record<string, string> = {};
  const layers: LayerInfo[] = [];

  const layerDefs: { name: string; path: string; desc: string }[] = [
    { name: "Locators", path: "cypress/e2e/locators", desc: "Selector constants for UI elements" },
    { name: "Page Objects", path: "cypress/e2e/pages", desc: "Page Object Model classes" },
    { name: "Tests (Smoke)", path: "cypress/e2e/test/smoke", desc: "Smoke test specs" },
    { name: "Tests (Regression)", path: "cypress/e2e/test/regression", desc: "Regression test specs" },
    { name: "Helpers", path: "cypress/support/heplers", desc: "Helper/orchestration functions" },
    { name: "Flows", path: "cypress/support/flows", desc: "Business flow orchestrations" },
    { name: "BDD Features", path: "cypress/e2e/features", desc: "Gherkin .feature files" },
    { name: "Step Definitions", path: "cypress/e2e/step-definitions", desc: "Cucumber step definitions" },
    { name: "Support", path: "cypress/support", desc: "Custom commands, types, enums, handlers" },
    { name: "Fixtures", path: "cypress/fixtures", desc: "Test data JSON files" },
    { name: "Utils", path: "cypress/utils", desc: "Pure utility functions (no Cypress deps)" },
    { name: "Types", path: "cypress/support/types", desc: "TypeScript type declarations" },
  ];

  for (const def of layerDefs) {
    const absPath = join(projectRoot, def.path);
    if (existsSync(absPath)) {
      layerDirs[def.name] = absPath;
      const dirFiles = allFiles.filter((f) => f.startsWith(absPath));
      const sorted = dirFiles.sort().slice(0, 5).map(rel);
      layers.push({
        name: def.name,
        path: def.path,
        fileCount: countDirFiles(absPath),
        sampleFiles: sorted.length > 0 ? sorted : dirFiles.slice(0, 5).map(rel),
        description: def.desc,
      });
    }
  }

  // Detect naming conventions per layer
  const namingConventions: NamingConventionEntry[] = [];
  for (const layer of layers) {
    if (layer.fileCount > 0) {
      namingConventions.push({
        layer: layer.name,
        pattern: detectNamingConvention(allFiles, layer.path, projectRoot),
        example: layer.sampleFiles[0] ?? "—",
      });
    }
  }

  // Detect code patterns
  const codePatternsStr = detectCodePatterns(projectRoot, layerDirs);

  // Read import aliases
  const importAliases = readImportAliases(projectRoot);

  // Custom commands
  const customCommands = detectCustomCommands(projectRoot);

  // BDD scenarios
  const bddScenarios = readFeatureOutlines(projectRoot);

  // Detect BDD
  const isBdd = layers.some((l) => l.name === "BDD Features" && l.fileCount > 0);

  // Detect Allure
  const isAllure = readConfigValue(projectRoot, "allure") === "true"
    || allFiles.some((f) => f.includes("allure"));

  // Base URL
  const baseUrl = readConfigValue(projectRoot, "baseUrl");

  // Directory tree
  const dirTree = walkdir(projectRoot).join("\n");

  // Build meta
  const meta: StructureMeta = buildMeta(layers, namingConventions);

  // Architecture description
  const architecture = buildArchitectureDescription(layers);

  const rawMarkdown = renderStructureGuideMarkdown({
    projectName,
    projectRoot,
    language,
    architecture,
    directoryTree: dirTree,
    layers,
    namingConventions,
    codePatterns: codePatternsStr,
    importAliases,
    customCommands,
    meta,
    rawMarkdown: "",
  });

  return {
    projectName,
    projectRoot,
    language,
    architecture,
    directoryTree: dirTree,
    layers,
    namingConventions,
    codePatterns: codePatternsStr,
    importAliases,
    customCommands,
    meta,
    rawMarkdown,
  };
}

function buildMeta(
  layers: LayerInfo[],
  namingConventions: NamingConventionEntry[],
): StructureMeta {
  const outputPaths: Record<string, string> = { ...DEFAULT_META.outputPaths };
  const namingPatterns: Record<string, string> = { ...DEFAULT_META.namingPatterns };

  // Override with detected values
  for (const nc of namingConventions) {
    const key = mapLayerToKey(nc.layer);
    if (key) namingPatterns[key] = nc.pattern;
  }

  for (const layer of layers) {
    const key = mapLayerToKey(layer.name);
    if (key) outputPaths[key] = layer.path;
  }

  return { outputPaths, namingPatterns };
}

function mapLayerToKey(layerName: string): string | undefined {
  const map: Record<string, string> = {
    "Locators": "locators",
    "Page Objects": "page",
    "Tests (Smoke)": "test",
    "Tests (Regression)": "testRegression",
    "Helpers": "helper",
    "Flows": "flow",
    "BDD Features": "bdd",
    "Step Definitions": "bddSteps",
    "Fixtures": "fixture",
    "Types": "type",
    "Utils": "utils",
  };
  return map[layerName];
}

function buildArchitectureDescription(layers: LayerInfo[]): string {
  if (layers.length === 0) return "Standard Cypress project";
  const names = layers.map((l) => l.name);
  return `${names.join(" → ")}`;
}

// ── Render to Markdown ──────────────────────────────────────────────────────

function renderStructureGuideMarkdown(guide: StructureGuide): string {
  const lines: string[] = [];

  lines.push(`# Structure Guide: ${guide.projectName}`, "");
  lines.push("> Auto-generated by QA Test Generator", "");

  // Overview
  lines.push("## Overview", "");
  lines.push("| Property | Value |");
  lines.push("|---|---|");
  lines.push(`| Language | ${guide.language} |`);
  lines.push(`| Architecture | ${guide.architecture} |`);
  lines.push(`| Code Patterns | ${guide.codePatterns} |`);
  if (guide.customCommands.length > 0) {
    lines.push(`| Custom Commands | ${guide.customCommands.length} |`);
  }
  lines.push("");

  // Directory tree
  lines.push("## Directory Tree", "");
  lines.push("```");
  lines.push(guide.directoryTree);
  lines.push("```", "");

  // Layers
  lines.push("## Layer Structure", "");
  lines.push("| Layer | Path | Files | Sample Files |");
  lines.push("|---|---|---|---|");
  for (const l of guide.layers) {
    const samples = l.sampleFiles.slice(0, 3).map((s) => `\`${s}\``).join("<br>");
    lines.push(`| ${l.name} | \`${l.path}/\` | ${l.fileCount} | ${samples} |`);
  }
  lines.push("");

  // Naming Conventions
  lines.push("## Naming Conventions", "");
  lines.push("| Layer | Pattern | Example |");
  lines.push("|---|---|---|");
  for (const nc of guide.namingConventions) {
    lines.push(`| ${nc.layer} | \`${nc.pattern}\` | \`${nc.example}\` |`);
  }
  lines.push("");

  // Coding patterns
  lines.push("## Coding Patterns", "");
  lines.push(guide.codePatterns);
  lines.push("");

  // Import aliases
  if (Object.keys(guide.importAliases).length > 0) {
    lines.push("## Import Aliases (from tsconfig.json)", "");
    lines.push("| Alias | Path |");
    lines.push("|---|---|");
    for (const [alias, path] of Object.entries(guide.importAliases)) {
      lines.push(`| \`${alias}\` | \`${Array.isArray(path) ? path[0] : path}\` |`);
    }
    lines.push("");
  }

  // Custom commands
  if (guide.customCommands.length > 0) {
    lines.push("## Custom Cypress Commands", "");
    lines.push("```typescript");
    for (const cmd of guide.customCommands) {
      lines.push(`Cypress.Commands.add("${cmd}", ...)`);
    }
    lines.push("```", "");
  }

  // Machine-readable metadata block
  lines.push("---");
  lines.push("");
  lines.push("## Meta");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(guide.meta, null, 2));
  lines.push("```");
  lines.push("");

  return lines.join("\n");
}

// ── Load / Parse guide file ─────────────────────────────────────────────────

export function loadStructureGuide(guidePath: string): { markdown: string; meta: StructureMeta } {
  const absPath = resolve(guidePath);
  if (!existsSync(absPath)) {
    throw new Error(`Structure guide not found: ${absPath}`);
  }
  const content = readFileSync(absPath, "utf-8");
  const meta = extractMeta(content);
  return { markdown: content, meta };
}

function extractMeta(markdown: string): StructureMeta {
  // Try to extract JSON from the ```json block in the ## Meta section
  const metaMatch = markdown.match(/```json\n([\s\S]*?)\n```/);
  if (metaMatch) {
    try {
      const parsed = JSON.parse(metaMatch[1]);
      return {
        outputPaths: { ...DEFAULT_META.outputPaths, ...parsed.outputPaths },
        namingPatterns: { ...DEFAULT_META.namingPatterns, ...parsed.namingPatterns },
      };
    } catch {
      // fall through to default
    }
  }
  return { ...DEFAULT_META };
}

// ── Resolve output paths ────────────────────────────────────────────────────

export function resolveArtifactPath(
  meta: StructureMeta,
  artifactType: string,
  name: string,
  tier?: "smoke" | "regression",
): string {
  let basePath = meta.outputPaths[artifactType] ?? DEFAULT_META.outputPaths[artifactType] ?? `cypress/e2e/${artifactType}`;

  // For tests, handle smoke vs regression
  if (artifactType === "test") {
    if (tier === "regression" && meta.outputPaths.testRegression) {
      basePath = meta.outputPaths.testRegression;
    } else {
      basePath = meta.outputPaths.test ?? meta.outputPaths.smoke ?? basePath;
    }
  }

  const pattern = meta.namingPatterns[artifactType] ?? DEFAULT_META.namingPatterns[artifactType] ?? `{name}.ts`;
  const fileName = applyNamingPattern(pattern, name);

  return `${basePath}/${fileName}`;
}

function applyNamingPattern(pattern: string, rawName: string): string {
  const pascal = rawName
    .split(/[-_\s]+/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join("");

  const camel = pascal.charAt(0).toLowerCase() + pascal.slice(1);

  const safeName = rawName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "artifact";

  return pattern
    .replace(/\{Pascal\}/g, pascal)
    .replace(/\{camel\}/g, camel)
    .replace(/\{name\}/g, safeName);
}

// ── Public rendering API ────────────────────────────────────────────────────

export function renderStructureGuide(guide: StructureGuide): string {
  return guide.rawMarkdown || renderStructureGuideMarkdown(guide);
}

export { renderStructureGuideMarkdown as renderStructureGuideMarkdownInternal };

// ── Detect if a project has a nearby guide ──────────────────────────────────

export function findNearestGuide(projectRoot: string): string | undefined {
  const candidates = [
    join(projectRoot, "structure-guide.md"),
    join(projectRoot, "STRUCTURE-GUIDE.md"),
    join(projectRoot, "guides", "structure-guide.md"),
    join(projectRoot, ".qa-guide.md"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return;
}
