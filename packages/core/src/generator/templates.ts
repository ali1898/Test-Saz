import type { ScaffoldOptions } from "./types";

export interface FileSpec {
  path: string;
  content: string;
}

const isTs = (o: ScaffoldOptions) => o.language === "typescript";
const ext = (o: ScaffoldOptions) => (isTs(o) ? "ts" : "js");

export function packageJson(o: ScaffoldOptions): FileSpec {
  const deps: Record<string, string> = {
    cypress: "^15.17.0",
  };

  const devDeps: Record<string, string> = {};

  if (isTs(o)) {
    devDeps.typescript = "^5.9.3";
    devDeps["@types/node"] = "^22.0.0";
  }

  if (o.bdd) {
    deps["@badeball/cypress-cucumber-preprocessor"] = "^23.2.1";
    if (isTs(o)) {
      devDeps["@bahmutov/cypress-esbuild-preprocessor"] = "^2.2.7";
      devDeps.esbuild = "^0.28.0";
    } else {
      devDeps["@cypress/browserify-preprocessor"] = "^3.0.2";
    }
  }

  if (o.allure) {
    deps["@shelex/cypress-allure-plugin"] = "^2.41.2";
    devDeps["allure-commandline"] = "^2.43.0";
  }

  devDeps["rimraf"] = "^6.1.3";
  devDeps["concurrently"] = "^10.0.3";

  const scripts: Record<string, string> = {
    "setup": "node scripts/setup/check-deps.js",
    "frontend:start": "node frontend/server.js",
    "frontend": "node frontend/server.js",
    "cy:open": "cypress open",
    "cy:run": "cypress run",
    "cy:smoke": "cypress run --env CYPRESS_UNIQUE_ID=smoke,allureResultsPath=allure-results/smoke --spec \"cypress/e2e/test/smoke/**/*.cy.ts\"",
    "cy:smoke:clean": "rimraf allure-results/smoke allure-report/smoke",
    "cy:smoke:report": "node scripts/allure/generate.js allure-results/smoke --clean -o allure-report/smoke",
    "cy:smoke:copy-serve": "node scripts/serve/copy.js allure-report/smoke",
    "cy:smoke:all": "node scripts/run-all.js smoke",
    "cy:regression": "cypress run --env CYPRESS_UNIQUE_ID=regression,allureResultsPath=allure-results/regression --spec \"cypress/e2e/test/regression/**/*.cy.ts\"",
    "cy:regression:clean": "rimraf allure-results/regression allure-report/regression",
    "cy:regression:report": "node scripts/allure/generate.js allure-results/regression --clean -o allure-report/regression",
    "cy:regression:copy-serve": "node scripts/serve/copy.js allure-report/regression",
    "cy:regression:all": "node scripts/run-all.js regression",
    "allure:open:smoke": "node scripts/allure/open.js open allure-report/smoke",
    "allure:open:regression": "node scripts/allure/open.js open allure-report/regression",
    "serve:smoke": "node scripts/serve/index.js allure-report/smoke",
    "serve:regression": "node scripts/serve/index.js allure-report/regression",
    "test": "npm run cy:smoke:all",
    "test:all": "node scripts/run-all.js all",
  };

  if (o.bdd) {
    scripts["cy:bdd"] = "cypress run --env CYPRESS_UNIQUE_ID=bdd,allureResultsPath=allure-results/bdd --spec \"cypress/e2e/features/**/*.feature\"";
    scripts["cy:bdd:clean"] = "rimraf allure-results/bdd allure-report/bdd";
    scripts["cy:bdd:report"] = "node scripts/allure/generate.js allure-results/bdd --clean -o allure-report/bdd";
    scripts["cy:bdd:copy-serve"] = "node scripts/serve/copy.js allure-report/bdd";
    scripts["cy:bdd:all"] = "node scripts/run-all.js bdd";
    scripts["allure:open:bdd"] = "node scripts/allure/open.js open allure-report/bdd";
    scripts["serve:bdd"] = "node scripts/serve/index.js allure-report/bdd";


  }

  const pkg: Record<string, any> = {
    name: o.projectName,
    version: "1.0.0",
    private: true,
    description: o.description || `${o.projectName} — Cypress test project with POM + Allure + CI/CD`,
    scripts,
  };

  if (Object.keys(deps).length > 0) pkg.dependencies = deps;
  if (Object.keys(devDeps).length > 0) pkg.devDependencies = devDeps;

  if (o.bdd && isTs(o)) {
    pkg["cypress-cucumber-preprocessor"] = {
      stepDefinitions: "cypress/e2e/step-definitions/**/*.ts",
    };
  }

  pkg.overrides = {
    uuid: "^11",
    glob: "^13",
  };

  return { path: "package.json", content: JSON.stringify(pkg, null, 2) + "\n" };
}

export function tsconfig(_o: ScaffoldOptions): FileSpec {
  const content = `{
  "compilerOptions": {
    "paths": {
      "cypress/*": ["./cypress/*"],
      "@fixtures/*": ["./cypress/fixtures/*"],
      "@support/*": ["./cypress/support/*"]
    },
    "module": "nodenext",
    "target": "esnext",
    "types": ["cypress", "node"],
    "lib": ["dom", "esnext"],
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,
    "strict": true,
    "jsx": "react-jsx",
    "verbatimModuleSyntax": false,
    "isolatedModules": true,
    "noUncheckedSideEffectImports": true,
    "moduleDetection": "force",
    "skipLibCheck": true
  },
  "include": [
    "cypress/support/**/*.d.ts",
    "cypress/support/**/*.ts",
    "cypress/**/*.ts",
    "./**/*.ts",
  ],
  "exclude": ["node_modules"]
}
`;
  return { path: "tsconfig.json", content };
}

export function cypressConfig(o: ScaffoldOptions): FileSpec {
  const e = ext(o);
  const allureImport = o.allure
    ? `import allureWriter from "@shelex/cypress-allure-plugin/writer";`
    : "";
  const allureSetup = o.allure
    ? `\n      config.env.allure = true;\n      require("@shelex/cypress-allure-plugin/writer")(on, config);`
    : "";
  const bddImports = o.bdd && isTs(o)
    ? `\nimport createBundler from "@bahmutov/cypress-esbuild-preprocessor";\nimport { addCucumberPreprocessorPlugin } from "@badeball/cypress-cucumber-preprocessor";\nimport createEsbuildPlugin from "@badeball/cypress-cucumber-preprocessor/esbuild";`
    : o.bdd
    ? `\nconst browserify = require("@cypress/browserify-preprocessor");`
    : "";
  const bddSetup = o.bdd && isTs(o)
    ? `\n      await addCucumberPreprocessorPlugin(on, config);\n      on("file:preprocessor", createBundler({ plugins: [createEsbuildPlugin(config)] }));`
    : o.bdd
    ? `\n      await addCucumberPreprocessorPlugin(on, config);\n      on("file:preprocessor", browserify.default({ ...browserify.defaultOptions, plugin: [], transformers: [] }));`
    : "";
  const asyncKwd = o.bdd ? "async " : "";
  const specPattern = o.bdd
    ? `["cypress/e2e/**/*.cy.ts", "cypress/e2e/**/*.feature"]`
    : `"cypress/e2e/**/*.cy.ts"`;

  const content = `import { defineConfig } from "cypress";${bddImports}
${allureImport ? `\n${allureImport}` : ""}

export default defineConfig({
  viewportWidth: 1920,
  viewportHeight: 1080,
  defaultCommandTimeout: 10000,
  watchForFileChanges: false,
  experimentalInteractiveRunEvents: true,
  video: true,
  videoCompression: 32,
  videosFolder: "cypress/videos",
  screenshotOnRunFailure: true,
  screenshotsFolder: "cypress/screenshots",
  e2e: {
    baseUrl: "${o.baseUrl}",
    specPattern: ${specPattern},
    supportFile: "cypress/support/e2e.${e}",
    retries: {
      runMode: 0,
      openMode: 0,
    },
    ${asyncKwd}setupNodeEvents(on, config) {${bddSetup}${allureSetup}
      on("task", {
        deleteFileTask(fileName: string): Promise<null> {
          return new Promise((resolve, reject) => {
            const fs = require("fs");
            fs.rm(fileName, { maxRetries: 10, recursive: true }, (err: any) => {
              if (err) return reject(err);
              resolve(null);
            });
          });
        },
      });
      return config;
    },
  },
});
`;
  return { path: `cypress.config.${e}`, content };
}

export function cypressEnvJson(_o: ScaffoldOptions): FileSpec {
  const content = `{
  "DB_USER": "sa",
  "DB_PASSWORD": "",
  "DB_HOST": "localhost",
  "DB_NAME": "testdb"
}
`;
  return { path: "cypress.env.json", content };
}

export function supportE2e(o: ScaffoldOptions): FileSpec {
  const e = ext(o);
  const content = isTs(o)
    ? `import "./commands";
import '@shelex/cypress-allure-plugin';
import { setupApiLogging, attachApiLogsToAllure, clearApiLogs } from "./api-logger";

beforeEach(() => {
  setupApiLogging();
});

afterEach(function () {
  if (this.currentTest?.state === "failed") {
    attachApiLogsToAllure();
  } else {
    clearApiLogs();
  }
});
`
    : `require("./commands");
require("@shelex/cypress-allure-plugin");
const { setupApiLogging, attachApiLogsToAllure, clearApiLogs } = require("./api-logger");

beforeEach(() => {
  setupApiLogging();
});

afterEach(function () {
  if (this.currentTest?.state === "failed") {
    attachApiLogsToAllure();
  } else {
    clearApiLogs();
  }
});
`;
  return { path: `cypress/support/e2e.${e}`, content };
}

export function supportCommands(o: ScaffoldOptions): FileSpec {
  const e = ext(o);
  if (isTs(o)) {
    const content = `/// <reference types="cypress" />

// ── Sample custom command ─────────────────────────────────────────────────────
// Use "qa generate command" to create more commands with AI.

Cypress.Commands.add("getByCy", (value: string) => {
  return cy.get(\`[data-cy="\${value}"]\`);
});

// ── API logger commands ───────────────────────────────────────────────────────
// Use "qa generate command" to create more commands with AI.

import { setupApiLogging, attachApiLogsToAllure, clearApiLogs, getApiLogs } from "./api-logger";

declare global {
  namespace Cypress {
    interface Chainable {
      getByCy(value: string): Chainable<JQuery<HTMLElement>>;
      setupApiLogging(): Chainable<void>;
      attachApiLogsToAllure(): Chainable<void>;
      clearApiLogs(): Chainable<void>;
      getApiLogs(): Chainable<ReadonlyArray<import("./api-logger").ApiCallLog>>;
      watchApiErrors(): Chainable<void>;
    }
  }
}

Cypress.Commands.add("setupApiLogging", () => {
  setupApiLogging();
});

Cypress.Commands.add("attachApiLogsToAllure", () => {
  attachApiLogsToAllure();
});

Cypress.Commands.add("clearApiLogs", () => {
  clearApiLogs();
});

Cypress.Commands.add("getApiLogs", () => {
  return cy.wrap(getApiLogs(), { log: false });
});

Cypress.Commands.add("watchApiErrors", () => {
  cy.on("fail", (err) => {
    if (err.message?.includes("500") || err.message?.includes("502") || err.message?.includes("503")) {
      attachApiLogsToAllure();
    }
    throw err;
  });
});
`;
    return { path: `cypress/support/commands.${e}`, content };
  } else {
    const content = `// ── Sample custom command ─────────────────────────────────────────────────────
// Use "qa generate command" to create more commands with AI.

Cypress.Commands.add("getByCy", (value) => {
  return cy.get(\`[data-cy="\${value}"]\`);
});

// ── API logger commands ───────────────────────────────────────────────────────
// Use "qa generate command" to create more commands with AI.

const { setupApiLogging, attachApiLogsToAllure, clearApiLogs, getApiLogs } = require("./api-logger");

Cypress.Commands.add("setupApiLogging", () => {
  setupApiLogging();
});

Cypress.Commands.add("attachApiLogsToAllure", () => {
  attachApiLogsToAllure();
});

Cypress.Commands.add("clearApiLogs", () => {
  clearApiLogs();
});

Cypress.Commands.add("getApiLogs", () => {
  return cy.wrap(getApiLogs(), { log: false });
});

Cypress.Commands.add("watchApiErrors", () => {
  cy.on("fail", (err) => {
    if (err.message?.includes("500") || err.message?.includes("502") || err.message?.includes("503")) {
      attachApiLogsToAllure();
    }
    throw err;
  });
});
`;
    return { path: `cypress/support/commands.${e}`, content };
  }
}

export function supportIndexDts(_o: ScaffoldOptions): FileSpec {
  const content = `/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      getByCy(value: string): Chainable<JQuery<HTMLElement>>;
    }
  }
}

export {};
`;
  return { path: "cypress/support/index.d.ts", content };
}

export function supportTypesTypesDts(_o: ScaffoldOptions): FileSpec {
  const content = `/// <reference types="@shelex/cypress-allure-plugin" />
`;
  return { path: "cypress/support/types/types.d.ts", content };
}

export function supportTypesUsersJsonDts(_o: ScaffoldOptions): FileSpec {
  const content = `export interface User {
  username: string;
  password: string;
  fullName: string;
  role: "admin" | "operator" | "manager";
}

export interface UsersData {
  [key: string]: User;
}
`;
  return { path: "cypress/support/types/usersJson.d.ts", content };
}

export function supportApiLogger(_o: ScaffoldOptions): FileSpec {
  const content = `/**
 * API Call Logger for Cypress Allure Reports
 * Captures API requests/responses and attaches them to Allure reports on test failure.
 */

interface ApiRequestLog {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

interface ApiResponseLog {
  statusCode: number;
  statusMessage: string;
  headers: Record<string, string>;
  body: unknown;
  duration: number;
}

interface ApiCallLog {
  request: ApiRequestLog;
  response: ApiResponseLog;
  timestamp: number;
}

const MAX_RESPONSE_BODY_LENGTH = 1000;
const MAX_STORED_CALLS = 50;

let apiCalls: ApiCallLog[] = [];
let wasAttachedInCurrentTest = false;

function truncateBody(body: unknown): unknown {
  if (body === null || body === undefined) return body;

  if (typeof body === "string") {
    if (body.length > MAX_RESPONSE_BODY_LENGTH) {
      return body.substring(0, MAX_RESPONSE_BODY_LENGTH) + "... [truncated]";
    }
    return body;
  }

  if (typeof body === "object") {
    try {
      const str = JSON.stringify(body);
      if (str.length > MAX_RESPONSE_BODY_LENGTH) {
        return str.substring(0, MAX_RESPONSE_BODY_LENGTH) + "... [truncated]";
      }
      return body;
    } catch {
      return String(body).substring(0, MAX_RESPONSE_BODY_LENGTH) + "... [truncated]";
    }
  }

  return body;
}

function isApiUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.pathname.includes("/api/") && u.hostname !== "localhost" && u.hostname !== "127.0.0.1";
  } catch {
    return url.includes("/api/") && !url.includes("localhost");
  }
}

function sanitizeHeaders(headers: Record<string, string | string[]>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  const sensitiveKeys = [
    "cookie",
    "set-cookie",
    "x-api-key",
    "api-key",
    "token",
    "access-token",
    "refresh-token",
    "secret",
  ];

  for (const [key, value] of Object.entries(headers)) {
    const val = Array.isArray(value) ? value.join(", ") : String(value);
    const isSensitive = sensitiveKeys.some((sk) => key.toLowerCase().includes(sk));
    sanitized[key] = isSensitive ? "***" : val;
  }

  return sanitized;
}

function getStatusCategory(
  statusCode: number,
): "success" | "redirect" | "client_error" | "server_error" | "unknown" {
  if (statusCode >= 200 && statusCode < 300) return "success";
  if (statusCode >= 300 && statusCode < 400) return "redirect";
  if (statusCode >= 400 && statusCode < 500) return "client_error";
  if (statusCode >= 500) return "server_error";
  return "unknown";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "\x26amp;")
    .replace(/</g, "\x26lt;")
    .replace(/>/g, "\x26gt;")
    .replace(/"/g, "\x26quot;")
    .replace(/'/g, "\x26#039;");
}

function safePrettyBody(body: unknown): unknown {
  if (body === null || body === undefined) return "(empty)";

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }

  return body;
}

function formatJsonBlock(data: unknown): string {
  const pretty = typeof data === "string" ? data : JSON.stringify(data, null, 2);

  return \`<pre class="json-block"><code>\${escapeHtml(pretty)}</code></pre>\`;
}

function getMethodClass(method: string): string {
  return \`method-\${method.toLowerCase()}\`;
}

function getStatusClass(statusCode: number): string {
  if (statusCode >= 200 && statusCode < 300) return "status-success";
  if (statusCode >= 300 && statusCode < 400) return "status-redirect";
  if (statusCode >= 400 && statusCode < 500) return "status-client-error";
  if (statusCode >= 500) return "status-server-error";
  return "status-unknown";
}

function formatApiCallsForHtmlReport(calls: ApiCallLog[]): string {
  const total = calls.length;
  const success = calls.filter((c) => c.response.statusCode >= 200 && c.response.statusCode < 300).length;
  const clientErrors = calls.filter((c) => c.response.statusCode >= 400 && c.response.statusCode < 500).length;
  const serverErrors = calls.filter((c) => c.response.statusCode >= 500).length;
  const redirects = calls.filter((c) => c.response.statusCode >= 300 && c.response.statusCode < 400).length;

  const itemsHtml = calls
    .map((call, index) => {
      const statusClass = getStatusClass(call.response.statusCode);
      const methodClass = getMethodClass(call.request.method);
      const isFailed = call.response.statusCode >= 400;
      const isSlow = call.response.duration >= 2000;

      return \`
        <details class="api-card \${isFailed ? "failed" : "passed"} \${isSlow ? "slow" : ""}">
          <summary class="api-summary">
            <span class="badge method \${methodClass}">\${escapeHtml(call.request.method)}</span>
            <span class="url">\${escapeHtml(call.request.url)}</span>
            <span class="badge status \${statusClass}">
              \${call.response.statusCode} \${escapeHtml(call.response.statusMessage || "")}
            </span>
            <span class="badge duration">\${call.response.duration} ms</span>
          </summary>

          <div class="api-body">
            <div class="section">
              <div class="section-title">Request</div>
              <div class="kv"><span class="k">Method:</span> <span class="v">\${escapeHtml(call.request.method)}</span></div>
              <div class="kv"><span class="k">URL:</span> <span class="v mono">\${escapeHtml(call.request.url)}</span></div>

              <div class="sub-title">Headers</div>
              \${formatJsonBlock(call.request.headers)}

              <div class="sub-title">Body</div>
              \${formatJsonBlock(safePrettyBody(call.request.body))}
            </div>

            <div class="section">
              <div class="section-title">Response</div>
              <div class="kv"><span class="k">Status Code:</span> <span class="v">\${call.response.statusCode}</span></div>
              <div class="kv"><span class="k">Status Message:</span> <span class="v">\${escapeHtml(call.response.statusMessage || "")}</span></div>
              <div class="kv"><span class="k">Category:</span> <span class="v">\${getStatusCategory(call.response.statusCode)}</span></div>
              <div class="kv"><span class="k">Duration:</span> <span class="v">\${call.response.duration} ms</span></div>

              <div class="sub-title">Headers</div>
              \${formatJsonBlock(call.response.headers)}

              <div class="sub-title">Body</div>
              \${formatJsonBlock(safePrettyBody(call.response.body))}
            </div>
          </div>
        </details>
      \`;
    })
    .join("");

  return \`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>API Calls Log</title>
  <style>
    :root {
      --bg: #f6f8fb;
      --card: #ffffff;
      --text: #1f2937;
      --muted: #6b7280;
      --border: #e5e7eb;
      --shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
      --success: #16a34a;
      --redirect: #d97706;
      --client: #dc2626;
      --server: #b91c1c;
      --unknown: #64748b;
      --blue: #2563eb;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      padding: 24px;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.5;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    h1 {
      margin: 0 0 16px;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }

    .subtitle {
      color: var(--muted);
      margin-bottom: 24px;
      font-size: 13px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }

    .summary-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: var(--shadow);
      padding: 16px;
    }

    .summary-label {
      font-size: 12px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: .08em;
      margin-bottom: 8px;
      font-weight: 700;
    }

    .summary-value {
      font-size: 28px;
      font-weight: 800;
      line-height: 1;
    }

    .summary-card.total { border-top: 4px solid var(--blue); }
    .summary-card.success { border-top: 4px solid var(--success); }
    .summary-card.redirect { border-top: 4px solid var(--redirect); }
    .summary-card.client { border-top: 4px solid var(--client); }
    .summary-card.server { border-top: 4px solid var(--server); }

    .api-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: var(--shadow);
      margin-bottom: 12px;
      overflow: hidden;
    }

    .api-card[open] .api-summary {
      border-bottom: 1px solid var(--border);
    }

    .api-summary {
      list-style: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      background: linear-gradient(180deg, #fff, #fbfdff);
    }

    .api-summary::-webkit-details-marker { display: none; }

    .url {
      flex: 1;
      min-width: 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
      color: #111827;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 5px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
      border: 1px solid transparent;
    }

    .method-get { background: #dcfce7; color: #166534; }
    .method-post { background: #dbeafe; color: #1d4ed8; }
    .method-put { background: #ffedd5; color: #c2410c; }
    .method-patch { background: #ede9fe; color: #6d28d9; }
    .method-delete { background: #fee2e2; color: #991b1b; }
    .method-head,
    .method-options { background: #e2e8f0; color: #334155; }

    .status-success { background: #dcfce7; color: #166534; }
    .status-redirect { background: #fef3c7; color: #92400e; }
    .status-client-error { background: #fee2e2; color: #991b1b; }
    .status-server-error { background: #fecaca; color: #7f1d1d; }
    .status-unknown { background: #e2e8f0; color: #334155; }

    .duration {
      background: #f3f4f6;
      color: #374151;
    }

    .api-body {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      padding: 16px;
    }

    .section {
      background: #f9fafb;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px;
      min-width: 0;
    }

    .section-title {
      font-size: 14px;
      font-weight: 800;
      margin-bottom: 12px;
    }

    .sub-title {
      margin: 14px 0 8px;
      font-size: 12px;
      color: var(--muted);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .06em;
    }

    .kv {
      display: flex;
      gap: 8px;
      margin-bottom: 6px;
      font-size: 13px;
      align-items: flex-start;
    }

    .k {
      color: var(--muted);
      min-width: 110px;
      flex: 0 0 auto;
      font-weight: 700;
    }

    .v {
      flex: 1;
      word-break: break-word;
    }

    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
    }

    .json-block {
      margin: 0;
      background: #0f172a;
      color: #e2e8f0;
      border-radius: 10px;
      padding: 12px;
      overflow: auto;
      max-height: 360px;
      font-size: 12px;
      line-height: 1.45;
    }

    .json-block code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      white-space: pre;
    }

    .failed {
      box-shadow: 0 8px 24px rgba(220, 38, 38, 0.06);
    }

    .slow .api-summary {
      background: #fffaf0;
    }

    @media (max-width: 1100px) {
      .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .api-body { grid-template-columns: 1fr; }
      .api-summary { flex-wrap: wrap; }
      .url { order: 3; width: 100%; flex-basis: 100%; white-space: normal; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>API Calls Log</h1>
    <div class="subtitle">Generated at \${escapeHtml(new Date().toISOString())}</div>

    <div class="summary-grid">
      <div class="summary-card total">
        <div class="summary-label">Total Calls</div>
        <div class="summary-value">\${total}</div>
      </div>
      <div class="summary-card success">
        <div class="summary-label">Success (2xx)</div>
        <div class="summary-value">\${success}</div>
      </div>
      <div class="summary-card redirect">
        <div class="summary-label">Redirect (3xx)</div>
        <div class="summary-value">\${redirects}</div>
      </div>
      <div class="summary-card client">
        <div class="summary-label">Client Errors (4xx)</div>
        <div class="summary-value">\${clientErrors}</div>
      </div>
      <div class="summary-card server">
        <div class="summary-label">Server Errors (5xx)</div>
        <div class="summary-value">\${serverErrors}</div>
      </div>
    </div>

    <div class="api-list">
      \${itemsHtml || \`<div class="summary-card">No API calls captured.</div>\`}
    </div>
  </div>
</body>
</html>
\`;
}

export function setupApiLogging(): void {
  apiCalls = [];
  wasAttachedInCurrentTest = false;

  cy.intercept("**/api/**", (req) => {
    if (!isApiUrl(req.url)) return;

    const startTime = Date.now();

    req.continue((res) => {
      try {
        const duration = Date.now() - startTime;

        const safeReqHeaders = sanitizeHeaders(req.headers);
        const safeResHeaders = sanitizeHeaders(res.headers);

        apiCalls.push({
          request: {
            method: req.method,
            url: req.url,
            headers: safeReqHeaders,
            body: truncateBody(req.body),
          },
          response: {
            statusCode: res.statusCode,
            statusMessage: res.statusMessage || "",
            headers: safeResHeaders,
            body: truncateBody(res.body),
            duration,
          },
          timestamp: startTime,
        });

        if (apiCalls.length > MAX_STORED_CALLS) {
          apiCalls.shift();
        }
      } catch {
        // Silently ignore capture errors to not break tests
      }
    });
  });
}

export function attachApiLogsToAllure(): void {
  if (apiCalls.length === 0 || wasAttachedInCurrentTest) return;

  wasAttachedInCurrentTest = true;
  const html = formatApiCallsForHtmlReport(apiCalls);
  clearApiLogs();

  const timestamp = Date.now();
  const filePath = \`allure-report/API-LOGS/api-call-logs-\${timestamp}.html\`;

  cy.writeFile(filePath, html, "utf8").then(() => {
    cy.allure().fileAttachment("API Calls Log", filePath, "text/html");
  });
}

export function clearApiLogs(): void {
  apiCalls = [];
  wasAttachedInCurrentTest = false;
}

export function getApiLogs(): ReadonlyArray<ApiCallLog> {
  return apiCalls;
}

export type { ApiCallLog, ApiRequestLog, ApiResponseLog };
`;
  return { path: "cypress/support/api-logger.ts", content };
}

export function locators(o: ScaffoldOptions): FileSpec {
  const e = ext(o);
  if (isTs(o)) {
    const content = `export const LOCATORS = {
  /** فرم ورود */
  LoginForm: {
    /** فرم */
    Form: "login-form",
    /** نام کاربری */
    Username_Input: "username-input",
    /** رمز عبور */
    Password_Input: "password-input",
    /** دکمه ورود */
    Login_Button: "login-button",
    /** خطا */
    Error_Message: "login-error",
  },

  /** نوار بالایی */
  Navbar: {
    /** نوار */
    Navbar: "navbar",
    /** نام کاربر */
    User_Fullname: "user-fullname",
    /** نقش کاربر */
    User_Role: "user-role",
    /** دکمه خروج */
    Logout_Button: "logout-button",
  },

  /** پیشخوان */
  Dashboard: {
    /** عنوان خوش آمدگویی */
    Welcome_Title: "welcome-title",
    /** زیرعنوان */
    Welcome_Subtitle: "welcome-subtitle",
    /** نشان موفقیت */
    Success_Badge: "success-badge",
  },
} as const;

export type locators = typeof LOCATORS;
`;
    return { path: `cypress/e2e/locators/locators.${e}`, content };
  } else {
    const content = `export const LOCATORS = {
  /** فرم ورود */
  LoginForm: {
    /** فرم */
    Form: "login-form",
    /** نام کاربری */
    Username_Input: "username-input",
    /** رمز عبور */
    Password_Input: "password-input",
    /** دکمه ورود */
    Login_Button: "login-button",
    /** خطا */
    Error_Message: "login-error",
  },

  /** نوار بالایی */
  Navbar: {
    /** نوار */
    Navbar: "navbar",
    /** نام کاربر */
    User_Fullname: "user-fullname",
    /** نقش کاربر */
    User_Role: "user-role",
    /** دکمه خروج */
    Logout_Button: "logout-button",
  },

  /** پیشخوان */
  Dashboard: {
    /** عنوان خوش آمدگویی */
    Welcome_Title: "welcome-title",
    /** زیرعنوان */
    Welcome_Subtitle: "welcome-subtitle",
    /** نشان موفقیت */
    Success_Badge: "success-badge",
  },
};

module.exports = { LOCATORS };
`;
    return { path: `cypress/e2e/locators/locators.${e}`, content };
  }
}

export function loginPage(o: ScaffoldOptions): FileSpec {
  const e = ext(o);
  if (isTs(o)) {
    const content = `import { LOCATORS } from "../locators/locators";

export class LoginPage {
  /**
   * visit page
   */
  openLoginPage(): Cypress.Chainable<Cypress.AUTWindow> {
    return cy.visit("/");
  }

  /**
   * enter username
   * @param username enter username
   */
  enterUserNameInput(username: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.getByCy(LOCATORS.LoginForm.Username_Input).type(username);
  }

  /**
   * enter password
   * @param password enter password
   */
  enterPasswordInput(password: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.getByCy(LOCATORS.LoginForm.Password_Input).type(password);
  }

  /**
   * click login button
   */
  clickLoginButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.getByCy(LOCATORS.LoginForm.Login_Button).click();
  }

  login(username: string, password: string): this {
    this.enterUserNameInput(username);
    this.enterPasswordInput(password);
    this.clickLoginButton();
    return this;
  }
}

export const loginPage = new LoginPage();
`;
    return { path: `cypress/e2e/pages/loginPage.${e}`, content };
  } else {
    const content = `const { LOCATORS } = require("../locators/locators");

class LoginPage {
  openLoginPage() {
    return cy.visit("/");
  }

  enterUserNameInput(username) {
    return cy.getByCy(LOCATORS.LoginForm.Username_Input).type(username);
  }

  enterPasswordInput(password) {
    return cy.getByCy(LOCATORS.LoginForm.Password_Input).type(password);
  }

  clickLoginButton() {
    return cy.getByCy(LOCATORS.LoginForm.Login_Button).click();
  }

  login(username, password) {
    this.enterUserNameInput(username);
    this.enterPasswordInput(password);
    this.clickLoginButton();
    return this;
  }
}

const loginPage = new LoginPage();
module.exports = { LoginPage, loginPage };
`;
    return { path: `cypress/e2e/pages/loginPage.${e}`, content };
  }
}

export function sidebarPage(o: ScaffoldOptions): FileSpec {
  const e = ext(o);
  if (isTs(o)) {
    const content = `import { LOCATORS } from "../locators/locators";

export class Sidebar {
  /** دکمه خروج */
  logout(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.getByCy(LOCATORS.Navbar.Logout_Button).click();
  }
}

export const sidebar = new Sidebar();
`;
    return { path: `cypress/e2e/pages/sidebar.${e}`, content };
  } else {
    const content = `const { LOCATORS } = require("../locators/locators");

class Sidebar {
  logout() {
    return cy.getByCy(LOCATORS.Navbar.Logout_Button).click();
  }
}

const sidebar = new Sidebar();
module.exports = { Sidebar, sidebar };
`;
    return { path: `cypress/e2e/pages/sidebar.${e}`, content };
  }
}

export function frontendServerJs(_o: ScaffoldOptions): FileSpec {
  const content = `const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const FRONTEND_DIR = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function loadUsers() {
  const raw = fs.readFileSync(path.join(FRONTEND_DIR, "users.json"), "utf-8");
  return JSON.parse(raw);
}

function serveStaticFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    return res.end("<h1>404 – Page not found</h1>");
  }
  const content = fs.readFileSync(filePath, "utf-8");
  res.writeHead(200, { "Content-Type": contentType });
  res.end(content);
}

function handleLogin(req, res) {
  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => {
    try {
      const { username, password } = JSON.parse(body);
      const users = loadUsers();
      if (!username || !password) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ success: false, message: "نام کاربری و رمز عبور الزامی است" }));
      }
      const user = users[username];
      if (!user || user.password !== password) {
        res.writeHead(401, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ success: false, message: "نام کاربری یا رمز عبور اشتباه است" }));
      }
      const token = Buffer.from(username + ":" + Date.now()).toString("base64");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: true, token,
        user: { username, fullName: user.fullName, role: user.role },
      }));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, message: "Invalid request" }));
    }
  });
}

const server = http.createServer((req, res) => {
  const { method, url } = req;
  if (url === "/api/login" && method === "POST") return handleLogin(req, res);
  if (url === "/dashboard.html") {
    const cookie = req.headers.cookie || "";
    if (!cookie.includes("token=")) {
      res.writeHead(302, { Location: "/" });
      return res.end();
    }
  }
  let reqPath = url.split("?")[0];
  if (reqPath === "/") reqPath = "/index.html";
  const safePath = path.normalize(reqPath).replace(/^(\\.\\.(\\\\|\\/|$))+/, "");
  const filePath = path.join(FRONTEND_DIR, safePath);
  if (!filePath.startsWith(FRONTEND_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  serveStaticFile(res, filePath);
});

server.listen(PORT, () => {
  console.log("Frontend server running at http://localhost:" + PORT);
  console.log("Test users: admin/123456, operator/123456, manager/123456");
});
`;
  return { path: "frontend/server.js", content };
}

export function frontendUsersJson(_o: ScaffoldOptions): FileSpec {
  const content = `{
  "admin": {
    "password": "123456",
    "fullName": "مدیر سیستم",
    "role": "admin"
  },
  "operator": {
    "password": "123456",
    "fullName": "اپراتور تست",
    "role": "operator"
  },
  "manager": {
    "password": "123456",
    "fullName": "مدیر پروژه",
    "role": "manager"
  }
}
`;
  return { path: "frontend/users.json", content };
}

export function frontendIndexHtml(_o: ScaffoldOptions): FileSpec {
  const content = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ورود به سیستم</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @font-face {
      font-family: 'Vazir';
      src: url('https://cdn.jsdelivr.net/gh/rastikerdar/vazir-font@v30.1.0/dist/Vazir.woff2') format('woff2');
    }
    body {
      font-family: 'Vazir', Tahoma, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh; display: flex; justify-content: center; align-items: center; padding: 20px;
    }
    .login-container {
      background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      padding: 48px 40px; width: 100%; max-width: 420px; text-align: center;
    }
    .login-container h1 { color: #333; font-size: 24px; margin-bottom: 8px; }
    .login-container p { color: #888; font-size: 14px; margin-bottom: 32px; }
    .form-group { text-align: right; margin-bottom: 20px; }
    .form-group label { display: block; margin-bottom: 6px; color: #555; font-size: 13px; font-weight: bold; }
    .form-group input {
      width: 100%; padding: 12px 16px; border: 2px solid #e1e1e1; border-radius: 8px;
      font-family: 'Vazir', Tahoma, sans-serif; font-size: 14px; transition: border-color 0.3s; outline: none;
    }
    .form-group input:focus { border-color: #667eea; }
    .form-group input.error { border-color: #e74c3c; }
    .error-message {
      background: #fde8e8; color: #c0392b; padding: 12px; border-radius: 8px;
      margin-bottom: 20px; font-size: 13px; display: none;
    }
    .error-message.visible { display: block; }
    button {
      width: 100%; padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white; border: none; border-radius: 8px;
      font-family: 'Vazir', Tahoma, sans-serif; font-size: 16px; font-weight: bold;
      cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;
    }
    button:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(102,126,234,0.4); }
    .login-info {
      margin-top: 24px; padding: 16px; background: #f8f9fa; border-radius: 8px;
      font-size: 12px; color: #888; text-align: right; line-height: 2;
    }
    .login-info strong { color: #555; }
    .loader { display: none; width: 20px; height: 20px; border: 3px solid #f3f3f3; border-top: 3px solid #667eea; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; }
    .loader.visible { display: inline-block; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="login-container">
    <h1>به سیستم خوش آمدید</h1>
    <p>لطفاً برای ورود اطلاعات خود را وارد کنید</p>
    <div class="error-message" data-cy="login-error" id="errorMessage"></div>
    <form id="loginForm" data-cy="login-form">
      <div class="form-group">
        <label for="username">نام کاربری</label>
        <input type="text" id="username" data-cy="username-input" placeholder="نام کاربری خود را وارد کنید" autocomplete="username">
      </div>
      <div class="form-group">
        <label for="password">رمز عبور</label>
        <input type="password" id="password" data-cy="password-input" placeholder="رمز عبور خود را وارد کنید" autocomplete="current-password">
      </div>
      <button type="submit" data-cy="login-button">
        <span id="buttonText">ورود به سیستم</span>
        <span class="loader" id="buttonLoader"></span>
      </button>
    </form>
    <div class="login-info">
      <strong>راهنما:</strong><br>
      🧑‍💼 مدیر سیستم: <strong>admin</strong> / <strong>123456</strong><br>
      🧑‍💻 اپراتور: <strong>operator</strong> / <strong>123456</strong><br>
      👨‍💼 مدیر پروژه: <strong>manager</strong> / <strong>123456</strong>
    </div>
  </div>
  <script>
    document.getElementById("loginForm").addEventListener("submit", async function(e) {
      e.preventDefault();
      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value.trim();
      const errorEl = document.getElementById("errorMessage");
      const btnText = document.getElementById("buttonText");
      const btnLoader = document.getElementById("buttonLoader");
      const usernameInput = document.getElementById("username");
      const passwordInput = document.getElementById("password");
      errorEl.classList.remove("visible");
      errorEl.textContent = "";
      usernameInput.classList.remove("error");
      passwordInput.classList.remove("error");
      if (!username) { showError("لطفاً نام کاربری را وارد کنید"); usernameInput.classList.add("error"); usernameInput.focus(); return; }
      if (!password) { showError("لطفاً رمز عبور را وارد کنید"); passwordInput.classList.add("error"); passwordInput.focus(); return; }
      if (password.length < 4) { showError("رمز عبور باید حداقل ۴ کاراکتر باشد"); passwordInput.classList.add("error"); passwordInput.focus(); return; }
      btnText.style.display = "none";
      btnLoader.classList.add("visible");
      try {
        const response = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = await response.json();
        if (data.success) {
          document.cookie = "token=" + data.token + "; path=/; max-age=3600";
          document.cookie = "user=" + encodeURIComponent(JSON.stringify(data.user)) + "; path=/; max-age=3600";
          window.location.href = "/dashboard.html";
        } else { showError(data.message); }
      } catch (err) { showError("خطا در ارتباط با سرور"); }
      finally { btnText.style.display = "inline"; btnLoader.classList.remove("visible"); }
    });
    function showError(message) { const el = document.getElementById("errorMessage"); el.textContent = message; el.classList.add("visible"); }
  </script>
</body>
</html>
`;
  return { path: "frontend/index.html", content };
}

export function frontendDashboardHtml(_o: ScaffoldOptions): FileSpec {
  const content = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>داشبورد</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @font-face {
      font-family: 'Vazir';
      src: url('https://cdn.jsdelivr.net/gh/rastikerdar/vazir-font@v30.1.0/dist/Vazir.woff2') format('woff2');
    }
    body { font-family: 'Vazir', Tahoma, sans-serif; background: #f0f2f5; min-height: 100vh; }
    .navbar { background: white; padding: 16px 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; }
    .navbar h2 { color: #333; font-size: 18px; }
    .navbar .user-info { display: flex; align-items: center; gap: 12px; }
    .navbar .user-info span { color: #555; font-size: 14px; }
    .navbar .user-info .role-badge { background: #667eea; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; }
    .navbar button { background: #e74c3c; color: white; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-family: 'Vazir', Tahoma, sans-serif; font-size: 13px; }
    .navbar button:hover { background: #c0392b; }
    .container { max-width: 800px; margin: 40px auto; padding: 0 20px; }
    .welcome-card { background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); text-align: center; }
    .welcome-card h1 { color: #333; font-size: 28px; margin-bottom: 16px; }
    .welcome-card .subtitle { color: #888; font-size: 16px; margin-bottom: 32px; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 32px; }
    .stat-card { background: #f8f9fa; border-radius: 12px; padding: 24px; text-align: center; }
    .stat-card .number { font-size: 32px; font-weight: bold; color: #667eea; }
    .stat-card .label { color: #888; font-size: 13px; margin-top: 8px; }
    .success-badge { display: inline-flex; align-items: center; gap: 8px; background: #d4edda; color: #155724; padding: 8px 16px; border-radius: 8px; font-size: 14px; margin-top: 24px; }
  </style>
</head>
<body>
  <nav class="navbar" data-cy="navbar">
    <h2>سامانه تست خودکار</h2>
    <div class="user-info">
      <span data-cy="user-fullname" id="userFullname"></span>
      <span class="role-badge" data-cy="user-role" id="userRole"></span>
      <button onclick="logout()" data-cy="logout-button">خروج</button>
    </div>
  </nav>
  <div class="container">
    <div class="welcome-card">
      <h1 data-cy="welcome-title">خوش آمدید!</h1>
      <p class="subtitle" data-cy="welcome-subtitle">شما با موفقیت وارد سیستم شده‌اید.</p>
      <div class="success-badge" data-cy="success-badge">✅ لاگین با موفقیت انجام شد</div>
      <div class="stats">
        <div class="stat-card"><div class="number">۰</div><div class="label">خطاهای امروز</div></div>
        <div class="stat-card"><div class="number">۱۲</div><div class="label">تست‌های اجرا شده</div></div>
        <div class="stat-card"><div class="number">۱۰۰%</div><div class="label">موفقیت</div></div>
      </div>
    </div>
  </div>
  <script>
    function getCookie(name) {
      const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
      return match ? decodeURIComponent(match[2]) : null;
    }
    const userCookie = getCookie('user');
    if (!userCookie) { window.location.href = '/'; }
    else {
      const user = JSON.parse(userCookie);
      document.getElementById('userFullname').textContent = user.fullName;
      const r = { admin: 'مدیر سیستم', operator: 'اپراتور', manager: 'مدیر پروژه' };
      document.getElementById('userRole').textContent = r[user.role] || user.role;
    }
    function logout() {
      document.cookie = 'token=; path=/; max-age=0';
      document.cookie = 'user=; path=/; max-age=0';
      window.location.href = '/';
    }
  </script>
</body>
</html>
`;
  return { path: "frontend/dashboard.html", content };
}

export function frontendStartScript(_o: ScaffoldOptions): FileSpec {
  const content = `#!/usr/bin/env node
const { spawn } = require("child_process");
const path = require("path");

const serverPath = path.resolve(__dirname, "..", "frontend", "server.js");
const server = spawn("node", [serverPath], {
  stdio: "inherit",
  cwd: path.resolve(__dirname, ".."),
  shell: true,
});

process.on("SIGINT", () => { server.kill("SIGINT"); process.exit(0); });
process.on("SIGTERM", () => { server.kill("SIGTERM"); process.exit(0); });
`;
  return { path: "scripts/start-frontend.js", content };
}

export function scriptsSetupCheckDeps(_o: ScaffoldOptions): FileSpec {
  const content = `#!/usr/bin/env node
const { execSync } = require("child_process");
const readline = require("readline");
const os = require("os");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, (a) => r(a.toLowerCase().trim())));

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: "utf-8", stdio: ["pipe", opts.silent ? "pipe" : "inherit", "pipe"], ...opts });
  } catch (e) {
    return "";
  }
}

function getVersion(cmd) {
  try {
    return execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim().split(/\\r?\\n/)[0];
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log("");
  console.log("  \\u2554" + "\\u2550".repeat(46) + "\\u2557");
  console.log("  \\u2551        QA Test Generator \\u2014 Dependency Setup        \\u2551");
  console.log("  \\u255a" + "\\u2550".repeat(46) + "\\u255d");
  console.log("");

  const deps = [];

  // Node.js
  const nodeVer = process.version;
  const nodeMajor = parseInt(nodeVer.slice(1).split(".")[0], 10);
  if (nodeMajor >= 18) {
    console.log("  \\u2713  Node.js " + nodeVer);
  } else {
    console.log("  \\u2717  Node.js " + nodeVer + " (need >= 18)");
    process.exit(1);
  }

  // Java (for Allure)
  const javaVer = getVersion("java -version 2>&1");
  if (javaVer) {
    console.log("  \\u2713  Java " + javaVer);
  } else {
    console.log("  \\u2717  Java not found \\u2014 required for Allure HTML reports");
    const ans1 = os.platform() === "win32" ? "" : "";
    const installMsg = os.platform() === "win32"
      ? "  Install Java? (Y/n) [will open download page]: "
      : "  Install Java? (y/N): ";
    const resp = ans1 || (await ask(installMsg));
    if (resp === "y") {
      if (os.platform() === "win32") {
        console.log("  Opening https://adoptium.net/temurin/releases/ ...");
        try { execSync("start https://adoptium.net/temurin/releases/"); } catch (e) {}
        deps.push("Java (JRE 21+) \\u2014 download from the link opened in your browser");
      } else if (os.platform() === "darwin") {
        try { execSync("brew install openjdk@21", { stdio: "inherit" }); } catch (e) {
          deps.push("Java (JRE 21+) \\u2014 run 'brew install openjdk@21' manually");
        }
      } else {
        try { execSync("sudo apt update && sudo apt install -y default-jre", { stdio: "inherit" }); } catch (e) {
          deps.push("Java (JRE 21+) \\u2014 run 'sudo apt install -y default-jre' manually");
        }
      }
      console.log("  \\u2713  Java installed");
    } else {
      deps.push("Java (JRE 21+) \\u2014 run setup again or install manually");
    }
  }

  // Cypress binary
  const cypressVer = getVersion("npx cypress version 2>&1");
  if (cypressVer) {
    console.log("  \\u2713  Cypress " + cypressVer);
  } else {
    console.log("  \\u2717  Cypress binary not installed");
    const resp = await ask("  Install Cypress binary now? (Y/n): ");
    if (resp !== "n") {
      try { execSync("npx cypress install", { stdio: "inherit" }); } catch (e) {
        deps.push("Cypress binary \\u2014 run 'npx cypress install' manually");
      }
      console.log("  \\u2713  Cypress binary installed");
    } else {
      deps.push("Cypress binary \\u2014 run 'npx cypress install' manually");
    }
  }

  rl.close();

  if (deps.length > 0) {
    console.log("");
    console.log("  \\u26a0  Manual steps required:");
    deps.forEach((d) => console.log("       - " + d));
  }

  console.log("");
  console.log("  \\u2713  Setup complete!");
  console.log("  \\u2192  Run 'npm run frontend' to start the sample app");
  console.log("  \\u2192  Run 'npm run cy:smoke:all' to run tests");
  console.log("");
}

main().catch(function (err) {
  console.error("  \\u2717  Setup failed:", err.message);
  process.exit(1);
});
`;
  return { path: "scripts/setup/check-deps.js", content };
}

export function smokeTest(o: ScaffoldOptions): FileSpec {
  const e = ext(o);
  if (isTs(o)) {
    const content = `import { loginPage } from "../../pages/loginPage";

describe("Login Page — Smoke Tests", () => {

  beforeEach(() => {
    loginPage.openLoginPage();
  });

  it("should login successfully with valid credentials", () => {
    loginPage.login("admin", "123456");
    cy.url().should("include", "/dashboard.html");
  });

  it("should show error message with invalid credentials", () => {
    loginPage.login("wrong", "wrong");
  });
});
`;
    return { path: `cypress/e2e/test/smoke/loginSmoke.cy.${e}`, content };
  } else {
    const content = `const { loginPage } = require("../../pages/loginPage");

describe("Login Page — Smoke Tests", () => {

  beforeEach(() => {
    loginPage.openLoginPage();
  });

  it("should login successfully with valid credentials", () => {
    loginPage.login("admin", "123456");
    cy.url().should("include", "/dashboard.html");
  });

  it("should show error message with invalid credentials", () => {
    loginPage.login("wrong", "wrong");
  });
});
`;
    return { path: `cypress/e2e/test/smoke/loginSmoke.cy.${e}`, content };
  }
}

export function regressionTest(o: ScaffoldOptions): FileSpec {
  const e = ext(o);
  if (isTs(o)) {
    const content = `import { loginPage } from "../../pages/loginPage";
import { sidebar } from "../../pages/sidebar";

describe("Login Page — Regression Tests", () => {

  describe("Login with different users", () => {
    beforeEach(() => {
      loginPage.openLoginPage();
    });

    it("should login as admin user", () => {
      loginPage.login("admin", "123456");
      cy.url().should("include", "/dashboard.html");
    });

    it("should reject invalid credentials", () => {
      loginPage.login("wrong", "wrong");
    });
  });

  describe("Logout", () => {
    beforeEach(() => {
      loginPage.openLoginPage();
      loginPage.login("admin", "123456");
    });

    it("should return to login page after logout", () => {
      sidebar.logout();
      cy.url().should("eq", Cypress.config().baseUrl + "/");
    });
  });
});
`;
    return { path: `cypress/e2e/test/regression/loginRegression.cy.${e}`, content };
  } else {
    const content = `const { loginPage } = require("../../pages/loginPage");
const { sidebar } = require("../../pages/sidebar");

describe("Login Page — Regression Tests", () => {

  describe("Login with different users", () => {
    beforeEach(() => {
      loginPage.openLoginPage();
    });

    it("should login as admin user", () => {
      loginPage.login("admin", "123456");
      cy.url().should("include", "/dashboard.html");
    });

    it("should reject invalid credentials", () => {
      loginPage.login("wrong", "wrong");
    });
  });

  describe("Logout", () => {
    beforeEach(() => {
      loginPage.openLoginPage();
      loginPage.login("admin", "123456");
    });

    it("should return to login page after logout", () => {
      sidebar.logout();
      cy.url().should("eq", Cypress.config().baseUrl + "/");
    });
  });
});
`;
    return { path: `cypress/e2e/test/regression/loginRegression.cy.${e}`, content };
  }
}

export function sampleFeature(_o: ScaffoldOptions): FileSpec {
  const content = `@smoke
Feature: ورود به سیستم (Login)

  Scenario Outline: ورود موفق با کاربران مختلف
    Given کاربر در صفحه لاگین قرار دارد
    When نام کاربری "<username>" و رمز عبور "<password>" را وارد می‌کند
    And روی دکمه ورود کلیک می‌کند
    Then کاربر به داشبورد هدایت می‌شود
    And نام "<fullName>" در داشبورد نمایش داده می‌شود

    Examples:
      | username | password | fullName    |
      | admin    | 123456   | مدیر سیستم  |
      | operator | 123456   | اپراتور تست |
      | manager  | 123456   | مدیر پروژه  |

  @regression
  Scenario: نمایش خطا با رمز عبور کوتاه
    Given کاربر در صفحه لاگین قرار دارد
    When نام کاربری "admin" و رمز عبور "12" را وارد می‌کند
    And روی دکمه ورود کلیک می‌کند
    Then پیام خطای معتبر نمایش داده می‌شود

  @regression
  Scenario: نمایش خطا با فیلد خالی
    Given کاربر در صفحه لاگین قرار دارد
    When رمز عبور "123456" را وارد می‌کند (بدون نام کاربری)
    And روی دکمه ورود کلیک می‌کند
    Then پیام خطای معتبر نمایش داده می‌شود
`;
  return { path: "cypress/e2e/features/login.feature", content };
}

export function sampleStepsTs(): FileSpec {
  const content = `import { Given, When, Then } from "@badeball/cypress-cucumber-preprocessor";
import { loginPage } from "../pages/loginPage";
import { LOCATORS } from "../locators/locators";

Given("کاربر در صفحه لاگین قرار دارد", () => {
  loginPage.openLoginPage();
});

When(
  "نام کاربری {string} و رمز عبور {string} را وارد می‌کند",
  (username: string, password: string) => {
    loginPage.enterUserNameInput(username);
    loginPage.enterPasswordInput(password);
  }
);

When("روی دکمه ورود کلیک می‌کند", () => {
  loginPage.clickLoginButton();
});

When(
  "رمز عبور {string} را وارد می‌کند \\(بدون نام کاربری\\)",
  (password: string) => {
    loginPage.enterPasswordInput(password);
  }
);

Then("کاربر به داشبورد هدایت می‌شود", () => {
  cy.url().should("include", "/dashboard.html");
});

Then("نام {string} در داشبورد نمایش داده می‌شود", (fullName: string) => {
  cy.getByCy("user-fullname").should("contain.text", fullName);
});

Then("پیام خطای معتبر نمایش داده می‌شود", () => {
  cy.getByCy(LOCATORS.LoginForm.Error_Message).should("be.visible");
});
`;
  return { path: "cypress/e2e/step-definitions/loginSteps.ts", content };
}

export function sampleStepsJs(): FileSpec {
  const content = `const { Given, When, Then } = require("@badeball/cypress-cucumber-preprocessor");
const { loginPage } = require("../pages/loginPage");
const { LOCATORS } = require("../locators/locators");

Given("کاربر در صفحه لاگین قرار دارد", () => {
  loginPage.openLoginPage();
});

When(
  "نام کاربری {string} و رمز عبور {string} را وارد می‌کند",
  (username, password) => {
    loginPage.enterUserNameInput(username);
    loginPage.enterPasswordInput(password);
  }
);

When("روی دکمه ورود کلیک می‌کند", () => {
  loginPage.clickLoginButton();
});

When(
  "رمز عبور {string} را وارد می‌کند \\(بدون نام کاربری\\)",
  (password) => {
    loginPage.enterPasswordInput(password);
  }
);

Then("کاربر به داشبورد هدایت می‌شود", () => {
  cy.url().should("include", "/dashboard.html");
});

Then("نام {string} در داشبورد نمایش داده می‌شود", (fullName) => {
  cy.getByCy("user-fullname").should("contain.text", fullName);
});

Then("پیام خطای معتبر نمایش داده می‌شود", () => {
  cy.getByCy(LOCATORS.LoginForm.Error_Message).should("be.visible");
});
`;
  return { path: "cypress/e2e/step-definitions/loginSteps.js", content };
}

export function fixturesUsers(_o: ScaffoldOptions): FileSpec {
  const content = `{
  "admin": {
    "username": "admin",
    "password": "123456",
    "fullName": "مدیر سیستم",
    "role": "admin"
  },
  "operator": {
    "username": "operator",
    "password": "123456",
    "fullName": "اپراتور تست",
    "role": "operator"
  },
  "manager": {
    "username": "manager",
    "password": "123456",
    "fullName": "مدیر پروژه",
    "role": "manager"
  }
}
`;
  return { path: "cypress/fixtures/users.json", content };
}

export function utilsDataGenerator(_o: ScaffoldOptions): FileSpec {
  const content = isTs(_o)
    ? `export function randomString(length = 8): string {
  return Math.random().toString(36).slice(2, 2 + length);
}

export function randomEmail(domain = "test.com"): string {
  return \`user_\${randomString()}@\${domain}\`;
}

export function nationalCodeGenerator(): string {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const sum = digits.reduce((acc, d, i) => acc + d * (10 - i), 0);
  const remainder = sum % 11;
  const control = remainder < 2 ? 0 : 11 - remainder;
  return [...digits, control].join("");
}

export function phoneNumberGenerator(): string {
  const prefix = "0912";
  const rest = Array.from({ length: 7 }, () => Math.floor(Math.random() * 10)).join("");
  return \`\${prefix}\${rest}\`;
}
`
    : `function randomString(length = 8) {
  return Math.random().toString(36).slice(2, 2 + length);
}

function randomEmail(domain = "test.com") {
  return \`user_\${randomString()}@\${domain}\`;
}

function nationalCodeGenerator() {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const sum = digits.reduce((acc, d, i) => acc + d * (10 - i), 0);
  const remainder = sum % 11;
  const control = remainder < 2 ? 0 : 11 - remainder;
  return [...digits, control].join("");
}

function phoneNumberGenerator() {
  const prefix = "0912";
  const rest = Array.from({ length: 7 }, () => Math.floor(Math.random() * 10)).join("");
  return \`\${prefix}\${rest}\`;
}

module.exports = { randomString, randomEmail, nationalCodeGenerator, phoneNumberGenerator };
`;
  return { path: `cypress/utils/dataGenerator.${ext(_o)}`, content };
}

export function scriptsRunAll(_o: ScaffoldOptions): FileSpec {
  const content = `#!/usr/bin/env node
const { execSync } = require("child_process");
const path = require("path");

const SUITES = {
  smoke: {
    clean: "npm run cy:smoke:clean",
    run: "npm run cy:smoke",
    report: "npm run cy:smoke:report",
    copyServe: "npm run cy:smoke:copy-serve",
  },
  regression: {
    clean: "npm run cy:regression:clean",
    run: "npm run cy:regression",
    report: "npm run cy:regression:report",
    copyServe: "npm run cy:regression:copy-serve",
  },
  bdd: {
    clean: "npm run cy:bdd:clean",
    run: "npm run cy:bdd",
    report: "npm run cy:bdd:report",
    copyServe: "npm run cy:bdd:copy-serve",
  },
};

function run(cmd) {
  console.log("  > " + cmd);
  try {
    execSync(cmd, { stdio: "inherit", shell: true, cwd: path.resolve(__dirname, "..") });
    return { ok: true, code: 0 };
  } catch (e) {
    return { ok: false, code: e.status ?? 1 };
  }
}

const suite = process.argv[2];
if (!suite) {
  console.log("Usage: node scripts/run-all.js <smoke | regression | bdd | all>");
  process.exit(1);
}

if (suite === "all") {
  for (const s of ["smoke", "regression", "bdd"]) {
    const c = SUITES[s];
    run(c.clean);
    run(c.run);
    run(c.report);
    if (c.copyServe) run(c.copyServe);
  }
  process.exit(0);
}

const config = SUITES[suite];
if (!config) {
  console.log("Unknown suite: " + suite);
  process.exit(1);
}

run(config.clean);
const result = run(config.run);
run(config.report);
if (config.copyServe) run(config.copyServe);
process.exit(result.code);
`;
  return { path: "scripts/run-all.js", content };
}

export function scriptsAllureGenerate(_o: ScaffoldOptions): FileSpec {
  const content = `const { execSync } = require("child_process");
const path = require("path");
const os = require("os");

const SEP = os.platform() === "win32" ? ";" : ":";
const EXE_SUFFIX = os.platform() === "win32" ? ".exe" : "";

function findJava() {
  const { JAVA_HOME } = process.env;
  if (JAVA_HOME) return path.join(JAVA_HOME, "bin", "java" + EXE_SUFFIX);
  return "java" + EXE_SUFFIX;
}

const allureDist = path.resolve(__dirname, "..", "..", "node_modules", "allure-commandline", "dist");
const classpath = path.join(allureDist, "lib", "*") + SEP + path.join(allureDist, "lib", "config");
const args = process.argv.slice(2).join(" ");
const javaExe = findJava();

const cmd = '"' + javaExe + '" -classpath "' + classpath + '" io.qameta.allure.CommandLine generate ' + args;
execSync(cmd, { stdio: "inherit", shell: true });
`;
  return { path: "scripts/allure/generate.js", content };
}

export function scriptsAllureOpen(_o: ScaffoldOptions): FileSpec {
  const content = `const { execSync } = require("child_process");
const path = require("path");
const os = require("os");

const SEP = os.platform() === "win32" ? ";" : ":";
const EXE_SUFFIX = os.platform() === "win32" ? ".exe" : "";

function findJava() {
  const { JAVA_HOME } = process.env;
  if (JAVA_HOME) return path.join(JAVA_HOME, "bin", "java" + EXE_SUFFIX);
  return "java" + EXE_SUFFIX;
}

const allureDist = path.resolve(__dirname, "..", "..", "node_modules", "allure-commandline", "dist");
const classpath = path.join(allureDist, "lib", "*") + SEP + path.join(allureDist, "lib", "config");
const args = process.argv.slice(2).join(" ");
const javaExe = findJava();

const cmd = '"' + javaExe + '" -classpath "' + classpath + '" io.qameta.allure.CommandLine ' + args;
execSync(cmd, { stdio: "inherit", shell: true });
`;
  return { path: "scripts/allure/open.js", content };
}

export function scriptsServeIndex(_o: ScaffoldOptions): FileSpec {
  const content = `const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const PORT = process.env.PORT || 8080;
const REPORT_PATH = path.resolve(process.argv[2] || ".");

const MIME_MAP = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split("?")[0];
  if (reqPath === "/") reqPath = "/index.html";

  const safePath = path.normalize(reqPath).replace(/^\\.\\.(\\/|\\\\|$)/, "");
  const filePath = path.join(REPORT_PATH, safePath);

  if (!filePath.startsWith(REPORT_PATH)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  if (!fs.existsSync(filePath)) {
    const fallback = path.join(REPORT_PATH, "index.html");
    if (fs.existsSync(fallback)) return serveFile(fallback, res);
    res.writeHead(404);
    return res.end("Not Found");
  }

  serveFile(filePath, res);
});

function serveFile(filePath, res) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_MAP[ext] || "application/octet-stream";
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch (err) {
    console.error("Error serving", filePath, err.message);
    res.writeHead(500);
    res.end("Internal Server Error");
  }
}

server.listen(PORT, () => {
  const url = "http://localhost:" + PORT + "/";
  console.log("Serving Allure report at " + url);
  console.log("Report path: " + REPORT_PATH);

  const platform = process.platform;
  const cmd =
    platform === "win32"
      ? "start " + url
      : platform === "darwin"
        ? "open " + url
        : "xdg-open " + url;

  exec(cmd, () => {});
});
`;
  return { path: "scripts/serve/index.js", content };
}

export function scriptsServeCopy(_o: ScaffoldOptions): FileSpec {
  const content = `#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const reportDir = process.argv[2];
if (!reportDir) {
  console.error("Usage: node scripts/serve/copy.js <report-dir>");
  process.exit(1);
}

const scriptsDir = __dirname;
const dstDir = path.resolve(reportDir);

if (!fs.existsSync(dstDir)) {
  fs.mkdirSync(dstDir, { recursive: true });
}

const files = [
  { src: "report.cmd", dst: "serve.cmd" },
  { src: "report.sh", dst: "serve.sh" },
  { src: "index.js", dst: "serve.js" },
];

for (const { src, dst } of files) {
  const srcPath = path.join(scriptsDir, src);
  const dstPath = path.join(dstDir, dst);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, dstPath);
  }
}
`;
  return { path: "scripts/serve/copy.js", content };
}

export function scriptsServeReportSh(_o: ScaffoldOptions): FileSpec {
  const content = `#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
node "$DIR/serve.js" "$@"
`;
  return { path: "scripts/serve/report.sh", content };
}

export function scriptsServeReportCmd(_o: ScaffoldOptions): FileSpec {
  const content = `@echo off
cd /d "%~dp0"
node serve.js %*
pause
`;
  return { path: "scripts/serve/report.cmd", content };
}

export function scriptsServeReportPs1(_o: ScaffoldOptions): FileSpec {
  const content = `param(
    [string]$ReportPath = "."
)

$port = 8080
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "Serving Allure report at http://localhost:$port/"
Start-Process "http://localhost:$port/"

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $localPath = $request.Url.LocalPath.TrimStart('/')
    if ([string]::IsNullOrEmpty($localPath)) { $localPath = "index.html" }

    $fullPath = [System.IO.Path]::Combine($ReportPath, $localPath)
    $fullPath = [System.IO.Path]::GetFullPath($fullPath)

    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        $fullPath = [System.IO.Path]::Combine($ReportPath, "index.html")
    }

    $mimeMap = @{
        ".html" = "text/html"
        ".js"   = "application/javascript"
        ".css"  = "text/css"
        ".json" = "application/json"
        ".png"  = "image/png"
        ".svg"  = "image/svg+xml"
        ".ico"  = "image/x-icon"
    }
    $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
    $contentType = if ($mimeMap.ContainsKey($ext)) { $mimeMap[$ext] } else { "application/octet-stream" }

    $buffer = [System.IO.File]::ReadAllBytes($fullPath)
    $response.ContentType = $contentType
    $response.ContentLength64 = $buffer.Length
    $response.OutputStream.Write($buffer, 0, $buffer.Length)
    $response.Close()
}

$listener.Stop()
`;
  return { path: "scripts/serve/report.ps1", content };
}

export function azurePipelines(_o: ScaffoldOptions): FileSpec {
  return {
    path: "azure-pipelines.yml",
    content: `trigger:
  branches:
    include:
      - master
      - develop
      - feature/*

pool:
  name: QaTestAgent

variables:
  - name: NODE_VERSION
    value: '22.x'

steps:
  - checkout: self

  - task: NodeTool@0
    inputs:
      versionSpec: '$(NODE_VERSION)'
    displayName: 'Install Node.js $(NODE_VERSION)'

  - script: npm ci
    displayName: 'Install npm packages'

  - script: npx cypress install
    displayName: 'Install Cypress binary'

  - script: |
      npx cypress run --browser chrome --headless
    displayName: 'Run Cypress tests'
    continueOnError: true

  - script: |
      npx allure generate allure-results --clean -o allure-report
    displayName: 'Generate Allure HTML report'
    condition: always()

  - task: PublishBuildArtifacts@1
    inputs:
      PathtoPublish: 'allure-report'
      ArtifactName: 'AllureReport'
      publishLocation: 'Container'
    displayName: 'Publish Allure report'
    condition: always()

  - task: PublishBuildArtifacts@1
    inputs:
      PathtoPublish: 'cypress/videos'
      ArtifactName: 'CypressVideos'
      publishLocation: 'Container'
    displayName: 'Publish test videos'
    condition: always()

  - task: PublishBuildArtifacts@1
    inputs:
      PathtoPublish: 'cypress/screenshots'
      ArtifactName: 'CypressScreenshots'
      publishLocation: 'Container'
    displayName: 'Publish screenshots'
    condition: failed()
`,
  };
}

export function gitignore(_o: ScaffoldOptions): FileSpec {
  return {
    path: ".gitignore",
    content: `node_modules/
npm-debug.log*

.env
.env.local
cypress.env.json

cypress/videos/
cypress/screenshots/
videos/
screenshots/

allure-results/
allure-report/

.idea/
.vscode/
*.swp
*.swo

.DS_Store
Thumbs.db

*.log

.agents/
skills-lock.json

.tmp/
dist/
build/
`,
  };
}

export function readme(o: ScaffoldOptions): FileSpec {
  const lines = [
    `# ${o.projectName}`,
    "",
    o.description || "Cypress test project with POM + BDD + Allure + CI/CD.",
    "",
    "## Project Structure",
    "",
    "```",
    "./",
    "├── frontend/                 # Sample frontend app (login page + API)",
    "├── cypress/",
    "│   ├── e2e/",
    "│   │   ├── locators/         # DOM selectors (data-cy based)",
    "│   │   ├── pages/            # Page Object Model classes",
    "│   │   ├── features/         # BDD scenarios (.feature files)",
    "│   │   ├── step-definitions/ # BDD step implementations",
    "│   │   └── test/",
    "│   │       ├── smoke/        # Quick smoke tests",
    "│   │       └── regression/   # Comprehensive regression tests",
    "│   ├── fixtures/             # Test data",
    "│   ├── support/              # Custom commands + types",
    "│   └── utils/                # Helper utilities",
    "├── scripts/                  # Automation scripts",
    "│   ├── allure/               # Allure report helpers",
    "│   └── serve/                # Report HTTP server",
    "└── cypress.config.ts         # Cypress configuration",
    "```",
    "",
    "## Quick Start",
    "",
    "```bash",
    "# 0. Check & install dependencies (Node.js >= 18, Java for Allure, Cypress binary)",
    "npm run setup",
    "",
    "# 1. Install npm packages",
    "npm install",
    "",
    "# 2. Start the sample frontend app (terminal 1)",
    "npm run frontend",
    "",
    "# 3. Run tests (terminal 2) — choose a suite:",
    "npm run cy:smoke:all          # Smoke tests (clean \u2192 run \u2192 report \u2192 copy)",
    "npm run cy:regression:all     # Regression tests",
  ];

  if (o.bdd) {
    lines.push("npm run cy:bdd:all          # BDD / Cucumber tests");
  }

  lines.push(
    "npm run test                    # Shortcut: smoke tests only",
    "npm run test:all                # Run all suites sequentially",
    "",
    "# 4. View Allure report",
    "npm run serve:smoke             # Opens report in browser",
    "",
    "# 5. Or step-by-step:",
    "npm run cy:smoke                # Run tests only",
    "npm run cy:smoke:report         # Generate Allure HTML report",
    "npm run cy:smoke:copy-serve     # Copy serve scripts into report dir",
    "npm run serve:smoke             # Serve report + open browser",
    "```",
    "",
    "## All Available Commands",
    "",
    "### Frontend",
    "",
    "| Command | Description |",
    "|---------|-------------|",
    "| `npm run frontend` | Start the sample app on http://localhost:3000 |",
    "",
    "### Smoke Tests",
    "",
    "| Command | Description |",
    "|---------|-------------|",
    "| `npm run cy:smoke` | Run smoke tests in headless mode |",
    "| `npm run cy:smoke:clean` | Clean previous smoke results/reports |",
    "| `npm run cy:smoke:report` | Generate Allure report from smoke results |",
    "| `npm run cy:smoke:copy-serve` | Copy serve scripts into the smoke report dir |",
    "| `npm run cy:smoke:all` | Full pipeline: clean \u2192 run \u2192 report \u2192 copy |",
    "| `npm run serve:smoke` | Serve smoke report + auto-open browser (port 8080) |",
    "| `npm run allure:open:smoke` | Open smoke report via Allure CLI |",
    "",
    "### Regression Tests",
    "",
    "| Command | Description |",
    "|---------|-------------|",
    "| `npm run cy:regression` | Run regression tests in headless mode |",
    "| `npm run cy:regression:clean` | Clean previous regression results/reports |",
    "| `npm run cy:regression:report` | Generate Allure report from regression results |",
    "| `npm run cy:regression:copy-serve` | Copy serve scripts into regression report dir |",
    "| `npm run cy:regression:all` | Full pipeline: clean \u2192 run \u2192 report \u2192 copy |",
    "| `npm run serve:regression` | Serve regression report + auto-open browser (port 8080) |",
    "| `npm run allure:open:regression` | Open regression report via Allure CLI |",
  );

  if (o.bdd) {
    lines.push(
      "",
      "### BDD / Cucumber Tests",
      "",
      "| Command | Description |",
      "|---------|-------------|",
      "| `npm run cy:bdd` | Run BDD tests in headless mode |",
      "| `npm run cy:bdd:clean` | Clean previous BDD results/reports |",
      "| `npm run cy:bdd:report` | Generate Allure report from BDD results |",
      "| `npm run cy:bdd:copy-serve` | Copy serve scripts into BDD report dir |",
      "| `npm run cy:bdd:all` | Full pipeline: clean \u2192 run \u2192 report \u2192 copy |",
      "| `npm run serve:bdd` | Serve BDD report + auto-open browser (port 8080) |",
      "| `npm run allure:open:bdd` | Open BDD report via Allure CLI |",
    );
  }

  lines.push(
    "",
    "### General",
    "",
    "| Command | Description |",
    "|---------|-------------|",
    "| `npm run setup` | Check & install required deps (Node.js, Java, Cypress binary) |",
    "| `npm run cy:open` | Open Cypress Test Runner (interactive UI) |",
    "| `npm run cy:run` | Run all specs headless |",
    "| `npm run test` | Alias: run smoke tests only |",
    "| `npm run test:all` | Run smoke + regression + BDD sequentially |",
    "| `npm run frontend` | Start frontend sample app |",
    "",
    "### Scripts (serve / Allure)",
    "",
    "You can also use the scripts directly:",
    "",
    "```bash",
    "# Serve any Allure report directory",
    "node scripts/serve/index.js allure-report/smoke",
    "",
    "# Copy serve scripts into a report dir for deployment",
    "node scripts/serve/copy.js allure-report/smoke",
    "# \u2192 copies: index.js \u2192 serve.js, report.sh \u2192 serve.sh, report.cmd \u2192 serve.cmd",
    "",
    "# Generate Allure report manually",
    "node scripts/allure/generate.js allure-results/smoke --clean -o allure-report/smoke",
    "",
    "# Open Allure report in browser",
    "node scripts/allure/open.js open allure-report/smoke",
    "",
    "# Run full pipeline via run-all.js",
    "node scripts/run-all.js smoke",
    "node scripts/run-all.js regression",
    "node scripts/run-all.js bdd",
    "node scripts/run-all.js all",
    "",
    "# Cross-platform report launcher (inside report dir after copy-serve):",
    "#   ./serve.sh <report-path>       (Linux/macOS)",
    "#   serve.cmd <report-path>        (Windows CMD)",
    "#   ./report.ps1 <report-path>     (PowerShell)",
    "```",
    "",
    "## Example Workflow",
    "",
    "```bash",
    "# 1. Create a project",
    "qa new --name my-tests --language typescript --bdd --allure --yes",
    "cd my-tests",
    "",
    "# 2. Check dependencies & install",
    "npm run setup                  # Checks Node.js, Java, Cypress binary",
    "npm install",
    "npm run frontend &",
    "",
    "# 3. Run smoke tests",
    "npm run cy:smoke:all",
    "",
    "# 4. Open Cypress UI for debugging",
    "npx cypress open",
    "",
    "# 5. Generate + view Allure report",
    "npm run cy:smoke:report",
    "npm run serve:smoke",
    "```",
    "",
    "## Test Users",
    "",
    "| Username | Password | Role |",
    "|----------|----------|------|",
    "| admin | 123456 | مدیر سیستم |",
    "| operator | 123456 | اپراتور |",
    "| manager | 123456 | مدیر پروژه |",
    "",
    "## Platform Notes",
    "",
    "| Platform | `qa` command | Notes |",
    "|----------|-------------|-------|",
    "| Linux / macOS | `qa`, `npm run qa` | All work |",
    "| Windows | `npm run qa` | Bare `qa` requires global install (`npm install -g`) |",
    "",
    "The `npm run setup` script detects your OS and installs the correct packages.",
  );

  return { path: "README.md", content: lines.join("\n") + "\n" };
}

export function scenarioLogin(_o: ScaffoldOptions): FileSpec {
  return {
    path: "scenarios/login-scenario.md",
    content: `## Scenario: Login with Valid Credentials

1. **Visit** /login
2. **Type** "admin" into **username input**
3. **Type** "password123" into **password input**
4. **Click** **login button**
5. **Assert** **dashboard** is visible with user name
`,
  };
}

export function scenarioSearch(_o: ScaffoldOptions): FileSpec {
  return {
    path: "scenarios/search-scenario.md",
    content: `## Scenario: Search for a Product

1. **Visit** /search
2. **Type** "laptop" into **search input**
3. **Click** **search button**
4. **Assert** **product results** are visible
5. **Assert** **result count** shows more than 0 items
`,
  };
}

export function apiStubsFixture(): FileSpec {
  const content = `{
  "POST /api/auth/login": {
    "success": {
      "status": 200,
      "body": { "token": "test-token-123", "user": { "id": 1, "name": "Test User" } }
    },
    "failure": {
      "status": 401,
      "body": { "error": "Invalid credentials" }
    }
  }
}`;
  return { path: "cypress/fixtures/api-stubs/sample.json", content };
}

export function networkStubCommand(): FileSpec {
  const content = `/**
 * Stub API responses for testing.
 * @example cy.stubApi('POST /api/auth/login', 'success')
 */
Cypress.Commands.add("stubApi", (route: string, scenario: string = "success") => {
  cy.fixture(\`api-stubs/sample\`).then((stubs) => {
    const stub = stubs[route]?.[scenario];
    if (!stub) {
      cy.log(\`Warning: No stub found for \${route}:\${scenario}\`);
      return;
    }
    cy.intercept(route.split(" ")[0], route.split(" ")[1], {
      statusCode: stub.status,
      body: stub.body,
    }).as(\`stub_\${route.replace(/[^a-zA-Z0-9]/g, "_")}\`);
  });
});

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Stub API response for a route
       * @param route - e.g., "POST /api/auth/login"
       * @param scenario - e.g., "success", "failure", "error"
       */
      stubApi(route: string, scenario?: string): Chainable<void>;
    }
  }
}`;
  return { path: "cypress/support/commands/stub-api.ts", content };
}

export function visualRegressionCommand(): FileSpec {
  const content = `/**
 * Visual regression testing commands.
 * Requires: npm install cypress-image-snapshot
 */
import { matchImageSnapshot } from "cypress-image-snapshot";

Cypress.Commands.add("matchScreenshot", (name: string, options?: Record<string, unknown>) => {
  cy.matchImageSnapshot({
    name,
    capture: "viewport",
    ...options,
  });
});

Cypress.Commands.add("compareScreenshot", (name: string, threshold = 0.1) => {
  cy.matchImageSnapshot({
    name,
    failureThreshold: threshold,
    failureThresholdType: "percent",
  });
});

declare global {
  namespace Cypress {
    interface Chainable {
      matchScreenshot(name: string, options?: Record<string, unknown>): Chainable<void>;
      compareScreenshot(name: string, threshold?: number): Chainable<void>;
    }
  }
}`;
  return { path: "cypress/support/commands/visual-regression.ts", content };
}

export function accessibilityCommand(): FileSpec {
  const content = `/**
 * Accessibility testing commands.
 * Requires: npm install cypress-axe axe-core
 */
import "cypress-axe";

Cypress.Commands.add("checkA11y", (context?: string | Node, options?: Record<string, unknown>) => {
  cy.injectAxe();
  cy.checkA11y(context, options);
});

Cypress.Commands.add("checkA11yForViolations", (context?: string | Node) => {
  cy.injectAxe();
  cy.checkA11y(
    context,
    { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } },
    (violations) => {
      if (violations.length) {
        cy.log(\`Found \${violations.length} accessibility violations\`);
        violations.forEach((v) => {
          cy.log(\`\${v.impact}: \${v.description}\`);
          v.nodes.forEach((node) => {
            cy.log(\`  - \${node.html}\`);
          });
        });
      }
    }
  );
});

declare global {
  namespace Cypress {
    interface Chainable {
      checkA11y(context?: string | Node, options?: Record<string, unknown>): Chainable<void>;
      checkA11yForViolations(context?: string | Node): Chainable<void>;
    }
  }
}`;
  return { path: "cypress/support/commands/a11y.ts", content };
}

export function structureGuide(o: ScaffoldOptions): FileSpec {
  const lang = o.language === "typescript" ? "TypeScript" : "JavaScript";
  const e = o.language === "typescript" ? "ts" : "js";

  const dirTreeLines: string[] = [
    `${o.projectName}/`,
    `├── frontend/`,
    `│   ├── server.js`,
    `│   ├── index.html`,
    `│   └── dashboard.html`,
    `├── cypress/`,
    `│   ├── e2e/`,
    `│   │   ├── locators/           # data-cy selector constants`,
    `│   │   ├── pages/              # Page Object classes`,
  ];

  if (o.bdd) {
    dirTreeLines.push(
      `│   │   ├── features/          # Gherkin .feature files`,
      `│   │   ├── step-definitions/  # Step implementations`,
    );
  }

  dirTreeLines.push(
    `│   │   └── test/`,
    `│   │       ├── smoke/          # Smoke test specs`,
    `│   │       └── regression/     # Regression test specs`,
    `│   ├── fixtures/               # Test data (users.json)`,
    `│   ├── support/`,
    `│   │   ├── pages/              # (aliased as @pages)`,
    `│   │   ├── locators/           # (aliased as @locators)`,
    `│   │   ├── helpers/            # Utility helper modules`,
    `│   │   ├── commands.${e}       # Custom Cypress commands`,
    `│   │   ├── e2e.${e}            # Global test config`,
    `│   │   └── types/              # Shared interfaces`,
    `│   └── utils/`,
    `│       └── dataGenerator.${e}`,
    `├── scripts/                    # Allure + serve + orchestration`,
    `├── guides/                     # Project documentation`,
    `├── cypress.config.${o.language === "typescript" ? "ts" : "js"}`,
    `├── tsconfig.json`,
    `├── azure-pipelines.yml`,
    `└── package.json`,
  );

  const meta = {
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
      test: `{name}.cy.${e}`,
      page: `{Pascal}Page.${e}`,
      locators: `{Pascal}Locators.${e}`,
      helper: `{camel}Helper.helper.${e}`,
      bdd: "{name}.feature",
      bddSteps: `{Pascal}Steps.${e}`,
      flow: `{camel}Flow.${e}`,
      utils: `{camel}.${e}`,
      fixture: "{Pascal}.json",
      type: `{Pascal}.types.${e}`,
    },
  };

  const layers: string[] = [
    "| Layer | Path | Pattern |",
    "|---|---|---|",
    `| Locators | \`cypress/e2e/locators/\` | \`*Locators.${e}\` |`,
    `| Pages | \`cypress/e2e/pages/\` | \`*Page.${e}\` |`,
    `| Smoke Tests | \`cypress/e2e/test/smoke/\` | \`*.cy.${e}\` |`,
    `| Regression Tests | \`cypress/e2e/test/regression/\` | \`*.cy.${e}\` |`,
  ];

  if (o.bdd) {
    layers.push(
      `| BDD Features | \`cypress/e2e/features/\` | \`*.feature\` |`,
      `| Step Definitions | \`cypress/e2e/step-definitions/\` | \`*Steps.${e}\` |`,
    );
  }

  layers.push(
    `| Helpers | \`cypress/support/helpers/\` | \`*.helper.${e}\` |`,
    `| Fixtures | \`cypress/fixtures/\` | \`*.json\` |`,
  );

  const namingConventions: string[] = [
    "| Layer | Pattern | Example |",
    "|---|---|---|",
    `| Locators | \`*Locators.${e}\` | \`loginLocators.${e}\` |`,
    `| Pages | \`*Page.${e}\` | \`loginPage.${e}\` |`,
    `| Smoke Tests | \`*.cy.${e}\` | \`loginSmoke.cy.${e}\` |`,
    `| Regression Tests | \`*.cy.${e}\` | \`loginRegression.cy.${e}\` |`,
  ];

  if (o.bdd) {
    namingConventions.push(
      `| BDD Features | \`*.feature\` | \`login.feature\` |`,
      `| Step Definitions | \`*Steps.${e}\` | \`loginSteps.${e}\` |`,
    );
  }

  namingConventions.push(
    `| Helpers | \`*.helper.${e}\` | \`authHelper.helper.${e}\` |`,
    `| Fixtures | \`*.json\` | \`users.json\` |`,
  );

  const lines: string[] = [
    `# Structure Guide: ${o.projectName}`,
    "",
    "> Auto-generated by QA Test Generator",
    "",
    "## Overview",
    "",
    "| Property | Value |",
    "|---|---|",
    `| Language | ${lang} |`,
    `| Architecture | Locators → Page Objects → Tests (Smoke) → Tests (Regression) → Helpers → Fixtures → Utils${o.bdd ? " → BDD Features → Step Definitions" : ""} |`,
    `| Code Patterns | class-based Page Objects, singleton instance export, custom commands (getByCy), separate locator imports, exported helper functions, as const for literal types |`,
    `| Sample Frontend | Login page + Dashboard with HTTP API (port 3000) |`,
    "",
    "## Directory Tree",
    "",
    "```",
    ...dirTreeLines,
    "```",
    "",
    "## Layer Structure",
    "",
    ...layers,
    "",
    "## Naming Conventions",
    "",
    ...namingConventions,
    "",
    "## Coding Patterns",
    "",
    "1. **Page Object Model** — Each page is a class with methods for user actions.",
    `   - File: \`cypress/e2e/pages/<Name>Page.${e}\``,
    "   - Export: class + singleton instance",
    "2. **Locators** — data-cy selector constants in a separate file.",
    `   - File: \`cypress/e2e/locators/<Name>Locators.${e}\``,
    "   - Export: `as const` object literal",
    "3. **Tests** — `describe`/`it` blocks, import pages from `../pages`.",
    `   - File: \`cypress/e2e/test/<tier>/<name>.cy.${e}\``,
    "4. **Custom Commands** — registered via `Cypress.Commands.add` in `cypress/support/commands.ts`.",
    "5. **Selectors** — always prefer `data-cy` attributes. Never use brittle CSS/XPath.",
    "6. **No flaky waits** — no `cy.wait()` with arbitrary timeouts. Use Cypress built-in retryability.",
    "",
    "## Custom Cypress Commands",
    "",
    "```typescript",
    'Cypress.Commands.add(\'getByCy\', (selector: string, ...args) => {',
    "  return cy.get(`[data-cy=\"${selector}\"]`, ...args);",
    "});",
    "```",
    "",
    "---",
    "",
    "## Meta",
    "",
    "```json",
    JSON.stringify(meta, null, 2),
    "```",
    "",
  ];

  return { path: "guides/structure-guide.md", content: lines.join("\n") + "\n" };
}

export function healingCommand(): FileSpec {
  return {
    path: "cypress/support/commands/healing.ts",
    content: `/**
 * Self-healing selector commands.
 * Tries multiple selectors to find an element.
 */

Cypress.Commands.add("getHealed", (primarySelector: string, fallbacks: string[] = []) => {
  const selectors = [primarySelector, ...fallbacks];

  cy.get("body").then(($body) => {
    for (const sel of selectors) {
      if ($body.find(sel).length > 0) {
        cy.log(\`Found element with selector: \${sel}\`);
        return cy.get(sel);
      }
    }
    throw new Error(\`No element found for selectors: \${selectors.join(", ")}\`);
  });
});

Cypress.Commands.add("clickHealed", (primarySelector: string, fallbacks: string[] = []) => {
  cy.getHealed(primarySelector, fallbacks).click();
});

Cypress.Commands.add("typeHealed", (primarySelector: string, text: string, fallbacks: string[] = []) => {
  cy.getHealed(primarySelector, fallbacks).type(text);
});

declare global {
  namespace Cypress {
    interface Chainable {
      getHealed(primarySelector: string, fallbacks?: string[]): Chainable<JQuery<HTMLElement>>;
      clickHealed(primarySelector: string, fallbacks?: string[]): Chainable<void>;
      typeHealed(primarySelector: string, text: string, fallbacks?: string[]): Chainable<void>;
    }
  }
}`,
  };
}

export function testIsolationCommand(): FileSpec {
  return {
    path: "cypress/support/commands/isolation.ts",
    content: `/**
 * Test isolation commands for clean test state.
 */

Cypress.Commands.add("resetDatabase", () => {
  cy.request({
    method: "POST",
    url: "/api/test/reset",
    failOnStatusCode: false,
  });
});

Cypress.Commands.add("seedDatabase", (fixture: string) => {
  cy.fixture(fixture).then((data) => {
    cy.request({
      method: "POST",
      url: "/api/test/seed",
      body: data,
      failOnStatusCode: false,
    });
  });
});

Cypress.Commands.add("clearLocalStorage", () => {
  cy.window().then((win) => {
    win.localStorage.clear();
  });
});

Cypress.Commands.add("clearSessionStorage", () => {
  cy.window().then((win) => {
    win.sessionStorage.clear();
  });
});

Cypress.Commands.add("clearAllStorage", () => {
  cy.clearLocalStorage();
  cy.clearSessionStorage();
  cy.clearCookies();
});

declare global {
  namespace Cypress {
    interface Chainable {
      resetDatabase(): Chainable<void>;
      seedDatabase(fixture: string): Chainable<void>;
      clearLocalStorage(): Chainable<void>;
      clearSessionStorage(): Chainable<void>;
      clearAllStorage(): Chainable<void>;
    }
  }
}
`,
  };
}
