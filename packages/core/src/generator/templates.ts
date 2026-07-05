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
    "frontend:start": "node frontend/server.js",
    "frontend": "node frontend/server.js",
    "cy:open": "cypress open",
    "cy:run": "cypress run",
    "cy:smoke": "cypress run --env CYPRESS_UNIQUE_ID=smoke --spec \"cypress/e2e/test/smoke/**/*.cy.ts\"",
    "cy:smoke:clean": "rimraf allure-results/smoke allure-report/smoke",
    "cy:smoke:report": "node scripts/allure/generate.js allure-results/smoke --clean -o allure-report/smoke",
    "cy:smoke:copy-serve": "node scripts/serve/copy.js allure-report/smoke",
    "cy:smoke:all": "node scripts/run-all.js smoke",
    "cy:regression": "cypress run --env CYPRESS_UNIQUE_ID=regression --spec \"cypress/e2e/test/regression/**/*.cy.ts\"",
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
    scripts["cy:bdd"] = "cypress run --env CYPRESS_UNIQUE_ID=bdd --spec \"cypress/e2e/features/**/*.feature\"";
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
`
    : `require("./commands");
require("@shelex/cypress-allure-plugin");
`;
  return { path: `cypress/support/e2e.${e}`, content };
}

export function supportCommands(o: ScaffoldOptions): FileSpec {
  const e = ext(o);
  if (isTs(o)) {
    const content = `/// <reference types="cypress" />

Cypress.Commands.add("uploadFile", (selector: string, filePath: string) => {
  cy.get(selector).selectFile(filePath, { force: true });
});

Cypress.Commands.add("getByCy", (value: string) => {
  return cy.get(\`[data-cy="\${value}"]\`);
});

Cypress.Commands.add("clickIfVisible", (selector: string) => {
  cy.get("body").then(($body) => {
    const el = $body.find(selector);
    if (el.length && el.is(":visible")) {
      cy.wrap(el).click();
    }
  });
});

Cypress.Commands.add("loginByApi", (username: string, password: string) => {
  cy.request({
    method: "POST",
    url: "/api/login",
    body: { username, password },
  }).then((response) => {
    expect(response.status).to.eq(200);
    expect(response.body.success).to.be.true;
    cy.setCookie("token", response.body.token);
  });
});
`;
    return { path: `cypress/support/commands.${e}`, content };
  } else {
    const content = `Cypress.Commands.add("uploadFile", (selector, filePath) => {
  cy.get(selector).selectFile(filePath, { force: true });
});

Cypress.Commands.add("getByCy", (value) => {
  return cy.get(\`[data-cy="\${value}"]\`);
});

Cypress.Commands.add("clickIfVisible", (selector) => {
  cy.get("body").then(($body) => {
    const el = $body.find(selector);
    if (el.length && el.is(":visible")) {
      cy.wrap(el).click();
    }
  });
});

Cypress.Commands.add("loginByApi", (username, password) => {
  cy.request({
    method: "POST",
    url: "/api/login",
    body: { username, password },
  }).then((response) => {
    expect(response.status).to.eq(200);
    expect(response.body.success).to.be.true;
    cy.setCookie("token", response.body.token);
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
      uploadFile(selector: string, filePath: string): Chainable<void>;
      getByCy(value: string): Chainable<JQuery<HTMLElement>>;
      clickIfVisible(selector: string): Chainable<void>;
      loginByApi(username: string, password: string): Chainable<void>;
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

export function locators(o: ScaffoldOptions): FileSpec {
  const e = ext(o);
  if (isTs(o)) {
    const content = `/**
 * Locators for the sample frontend app
 * =====================================
 *
 * All selectors use data-cy attributes (best practice in Cypress).
 * If the DOM changes, update only this file.
 */
export const LoginLocators = {
  loginForm:        (): Cypress.Chainable<JQuery<HTMLElement>> => cy.getByCy("login-form"),
  usernameInput:    (): Cypress.Chainable<JQuery<HTMLElement>> => cy.getByCy("username-input"),
  passwordInput:    (): Cypress.Chainable<JQuery<HTMLElement>> => cy.getByCy("password-input"),
  loginButton:      (): Cypress.Chainable<JQuery<HTMLElement>> => cy.getByCy("login-button"),
  errorMessage:     (): Cypress.Chainable<JQuery<HTMLElement>> => cy.getByCy("login-error"),
  welcomeTitle:     (): Cypress.Chainable<JQuery<HTMLElement>> => cy.getByCy("welcome-title"),
  welcomeSubtitle:  (): Cypress.Chainable<JQuery<HTMLElement>> => cy.getByCy("welcome-subtitle"),
  userFullname:     (): Cypress.Chainable<JQuery<HTMLElement>> => cy.getByCy("user-fullname"),
  userRole:         (): Cypress.Chainable<JQuery<HTMLElement>> => cy.getByCy("user-role"),
  successBadge:     (): Cypress.Chainable<JQuery<HTMLElement>> => cy.getByCy("success-badge"),
  navbar:           (): Cypress.Chainable<JQuery<HTMLElement>> => cy.getByCy("navbar"),
  logoutButton:     (): Cypress.Chainable<JQuery<HTMLElement>> => cy.getByCy("logout-button"),
};
`;
    return { path: `cypress/e2e/locators/locators.${e}`, content };
  } else {
    const content = `export const LoginLocators = {
  loginForm:        () => cy.getByCy("login-form"),
  usernameInput:    () => cy.getByCy("username-input"),
  passwordInput:    () => cy.getByCy("password-input"),
  loginButton:      () => cy.getByCy("login-button"),
  errorMessage:     () => cy.getByCy("login-error"),
  welcomeTitle:     () => cy.getByCy("welcome-title"),
  welcomeSubtitle:  () => cy.getByCy("welcome-subtitle"),
  userFullname:     () => cy.getByCy("user-fullname"),
  userRole:         () => cy.getByCy("user-role"),
  successBadge:     () => cy.getByCy("success-badge"),
  navbar:           () => cy.getByCy("navbar"),
  logoutButton:     () => cy.getByCy("logout-button"),
};

module.exports = { LoginLocators };
`;
    return { path: `cypress/e2e/locators/locators.${e}`, content };
  }
}

export function loginPage(o: ScaffoldOptions): FileSpec {
  const e = ext(o);
  if (isTs(o)) {
    const content = `import { LoginLocators } from "../locators/locators";

export class LoginPage {

  visit(): this {
    cy.visit("/");
    LoginLocators.loginForm().should("be.visible");
    return this;
  }

  fillUsername(username: string): this {
    LoginLocators.usernameInput()
      .should("be.visible")
      .clear()
      .type(username);
    return this;
  }

  fillPassword(password: string): this {
    LoginLocators.passwordInput()
      .should("be.visible")
      .clear()
      .type(password);
    return this;
  }

  clickLogin(): this {
    LoginLocators.loginButton()
      .should("be.visible")
      .click();
    return this;
  }

  login(username: string, password: string): this {
    return this
      .fillUsername(username)
      .fillPassword(password)
      .clickLogin();
  }

  getErrorMessage(): Cypress.Chainable<JQuery<HTMLElement>> {
    return LoginLocators.errorMessage();
  }

  getWelcomeTitle(): Cypress.Chainable<JQuery<HTMLElement>> {
    return LoginLocators.welcomeTitle();
  }

  getUserFullname(): Cypress.Chainable<JQuery<HTMLElement>> {
    return LoginLocators.userFullname();
  }

  getUserRole(): Cypress.Chainable<JQuery<HTMLElement>> {
    return LoginLocators.userRole();
  }
}

export const loginPage = new LoginPage();
`;
    return { path: `cypress/e2e/pages/loginPage.${e}`, content };
  } else {
    const content = `const { LoginLocators } = require("../locators/locators");

class LoginPage {

  visit() {
    cy.visit("/");
    LoginLocators.loginForm().should("be.visible");
    return this;
  }

  fillUsername(username) {
    LoginLocators.usernameInput()
      .should("be.visible")
      .clear()
      .type(username);
    return this;
  }

  fillPassword(password) {
    LoginLocators.passwordInput()
      .should("be.visible")
      .clear()
      .type(password);
    return this;
  }

  clickLogin() {
    LoginLocators.loginButton()
      .should("be.visible")
      .click();
    return this;
  }

  login(username, password) {
    return this
      .fillUsername(username)
      .fillPassword(password)
      .clickLogin();
  }

  getErrorMessage() {
    return LoginLocators.errorMessage();
  }

  getWelcomeTitle() {
    return LoginLocators.welcomeTitle();
  }

  getUserFullname() {
    return LoginLocators.userFullname();
  }

  getUserRole() {
    return LoginLocators.userRole();
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
  clickDashboard(): Cypress.Chainable<Element> {
    return cy.getDynamicMenu("Dashboard").click();
  }

  siamService(): Cypress.Chainable<Element> {
    return cy.getByCy(LOCATORS.Sidebar.Siam_Service).click();
  }

  announcements(): Cypress.Chainable<Element> {
    return cy.getByCy(LOCATORS.Sidebar.Announcements).click();
  }

  changeTheme(): Cypress.Chainable<Element> {
    return cy.getByCy(LOCATORS.Sidebar.Change_Theme).click();
  }

  loginAs(): Cypress.Chainable<Element> {
    return cy.getByCy(LOCATORS.Sidebar.Login_As).click();
  }

  logoutAndYesButton(): Cypress.Chainable<Element> {
    cy.getByCy(LOCATORS.Sidebar.Logout).click();
    return cy.getByCy(LOCATORS.Sidebar.Yes_Button).click();
  }
}

export const sidebar = new Sidebar();
`;
    return { path: `cypress/e2e/pages/sidebar.${e}`, content };
  } else {
    const content = `const { LOCATORS } = require("../locators/locators");

class Sidebar {
  clickDashboard() {
    return cy.getDynamicMenu("Dashboard").click();
  }

  siamService() {
    return cy.getByCy(LOCATORS.Sidebar.Siam_Service).click();
  }

  announcements() {
    return cy.getByCy(LOCATORS.Sidebar.Announcements).click();
  }

  changeTheme() {
    return cy.getByCy(LOCATORS.Sidebar.Change_Theme).click();
  }

  loginAs() {
    return cy.getByCy(LOCATORS.Sidebar.Login_As).click();
  }

  logoutAndYesButton() {
    cy.getByCy(LOCATORS.Sidebar.Logout).click();
    return cy.getByCy(LOCATORS.Sidebar.Yes_Button).click();
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
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
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

export function smokeTest(o: ScaffoldOptions): FileSpec {
  const e = ext(o);
  if (isTs(o)) {
    const content = `import { loginPage } from "../../pages/loginPage";

describe("Login Page — Smoke Tests", { tags: ["smoke"] }, () => {

  beforeEach(() => {
    loginPage.visit();
  });

  it("should display the login form elements", () => {
    cy.getByCy("login-form").should("be.visible");
    cy.getByCy("username-input").should("be.visible");
    cy.getByCy("password-input").should("be.visible");
    cy.getByCy("login-button").should("be.visible");
  });

  it("should show an error when clicking login with empty fields", () => {
    loginPage.clickLogin();
    loginPage.getErrorMessage()
      .should("be.visible")
      .and("contain.text", "نام کاربری");
  });

  it("should login successfully with valid credentials (admin/123456)", () => {
    loginPage.login("admin", "123456");
    cy.url().should("include", "/dashboard.html");
    loginPage.getWelcomeTitle().should("be.visible");
  });

  it("should show error message with invalid credentials", () => {
    loginPage.login("wrong", "wrong");
    loginPage.getErrorMessage()
      .should("be.visible")
      .and("contain.text", "نام کاربری یا رمز عبور");
  });
});
`;
    return { path: `cypress/e2e/test/smoke/loginSmoke.cy.${e}`, content };
  } else {
    const content = `const { loginPage } = require("../../pages/loginPage");

describe("Login Page — Smoke Tests", { tags: ["smoke"] }, () => {

  beforeEach(() => {
    loginPage.visit();
  });

  it("should display the login form elements", () => {
    cy.getByCy("login-form").should("be.visible");
    cy.getByCy("username-input").should("be.visible");
    cy.getByCy("password-input").should("be.visible");
    cy.getByCy("login-button").should("be.visible");
  });

  it("should show an error when clicking login with empty fields", () => {
    loginPage.clickLogin();
    loginPage.getErrorMessage()
      .should("be.visible")
      .and("contain.text", "نام کاربری");
  });

  it("should login successfully with valid credentials (admin/123456)", () => {
    loginPage.login("admin", "123456");
    cy.url().should("include", "/dashboard.html");
    loginPage.getWelcomeTitle().should("be.visible");
  });

  it("should show error message with invalid credentials", () => {
    loginPage.login("wrong", "wrong");
    loginPage.getErrorMessage()
      .should("be.visible")
      .and("contain.text", "نام کاربری یا رمز عبور");
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

describe("Login Page — Regression Tests", { tags: ["regression"] }, () => {

  describe("Login with different users", () => {
    beforeEach(() => {
      loginPage.visit();
    });

    const users = [
      { username: "admin",    password: "123456", role: "مدیر سیستم" },
      { username: "operator", password: "123456", role: "اپراتور" },
      { username: "manager",  password: "123456", role: "مدیر پروژه" },
    ];

    users.forEach(({ username, password, role }) => {
      it(\`should login as \${username} with role \${role}\`, () => {
        loginPage.login(username, password);
        cy.url().should("include", "/dashboard.html");
        loginPage.getWelcomeTitle().should("be.visible");
        cy.getByCy("user-fullname").should("not.be.empty");
      });
    });
  });

  describe("Form validation", () => {
    beforeEach(() => {
      loginPage.visit();
    });

    it("should show validation error with password shorter than 4 characters", () => {
      loginPage
        .fillUsername("admin")
        .fillPassword("12")
        .clickLogin();
      loginPage.getErrorMessage()
        .should("be.visible")
        .and("contain.text", "۴ کاراکتر");
    });

    it("should show error with empty username", () => {
      loginPage
        .fillPassword("123456")
        .clickLogin();
      loginPage.getErrorMessage()
        .should("be.visible")
        .and("contain.text", "نام کاربری");
    });
  });

  describe("Direct access without login", () => {
    it("should redirect to login page when accessing dashboard directly", () => {
      cy.visit("/dashboard.html");
      cy.url().should("eq", Cypress.config().baseUrl + "/");
    });
  });

  describe("Logout", () => {
    it("should return to login page after logout", () => {
      loginPage.visit().login("admin", "123456");
      cy.url().should("include", "/dashboard.html");
      cy.getByCy("logout-button").click();
      cy.url().should("eq", Cypress.config().baseUrl + "/");
      cy.getByCy("login-form").should("be.visible");
    });
  });
});
`;
    return { path: `cypress/e2e/test/regression/loginRegression.cy.${e}`, content };
  } else {
    const content = `const { loginPage } = require("../../pages/loginPage");

describe("Login Page — Regression Tests", { tags: ["regression"] }, () => {

  describe("Login with different users", () => {
    beforeEach(() => {
      loginPage.visit();
    });

    const users = [
      { username: "admin",    password: "123456", role: "مدیر سیستم" },
      { username: "operator", password: "123456", role: "اپراتور" },
      { username: "manager",  password: "123456", role: "مدیر پروژه" },
    ];

    users.forEach(({ username, password, role }) => {
      it(\`should login as \${username} with role \${role}\`, () => {
        loginPage.login(username, password);
        cy.url().should("include", "/dashboard.html");
        loginPage.getWelcomeTitle().should("be.visible");
        cy.getByCy("user-fullname").should("not.be.empty");
      });
    });
  });

  describe("Form validation", () => {
    beforeEach(() => {
      loginPage.visit();
    });

    it("should show validation error with password shorter than 4 characters", () => {
      loginPage
        .fillUsername("admin")
        .fillPassword("12")
        .clickLogin();
      loginPage.getErrorMessage()
        .should("be.visible")
        .and("contain.text", "۴ کاراکتر");
    });

    it("should show error with empty username", () => {
      loginPage
        .fillPassword("123456")
        .clickLogin();
      loginPage.getErrorMessage()
        .should("be.visible")
        .and("contain.text", "نام کاربری");
    });
  });

  describe("Direct access without login", () => {
    it("should redirect to login page when accessing dashboard directly", () => {
      cy.visit("/dashboard.html");
      cy.url().should("eq", Cypress.config().baseUrl + "/");
    });
  });

  describe("Logout", () => {
    it("should return to login page after logout", () => {
      loginPage.visit().login("admin", "123456");
      cy.url().should("include", "/dashboard.html");
      cy.getByCy("logout-button").click();
      cy.url().should("eq", Cypress.config().baseUrl + "/");
      cy.getByCy("login-form").should("be.visible");
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
import { loginPage } from "../../pages/loginPage";

Given("کاربر در صفحه لاگین قرار دارد", () => {
  loginPage.visit();
});

When(
  "نام کاربری {string} و رمز عبور {string} را وارد می‌کند",
  (username: string, password: string) => {
    loginPage.fillUsername(username).fillPassword(password);
  }
);

When("روی دکمه ورود کلیک می‌کند", () => {
  loginPage.clickLogin();
});

When(
  "رمز عبور {string} را وارد می‌کند (بدون نام کاربری)",
  (password: string) => {
    loginPage.fillPassword(password);
  }
);

Then("کاربر به داشبورد هدایت می‌شود", () => {
  cy.url().should("include", "/dashboard.html");
});

Then("نام {string} در داشبورد نمایش داده می‌شود", (fullName: string) => {
  cy.getByCy("user-fullname").should("contain.text", fullName);
});

Then("پیام خطای معتبر نمایش داده می‌شود", () => {
  loginPage.getErrorMessage().should("be.visible");
});
`;
  return { path: "cypress/e2e/step-definitions/loginSteps.ts", content };
}

export function sampleStepsJs(): FileSpec {
  const content = `const { Given, When, Then } = require("@badeball/cypress-cucumber-preprocessor");
const { loginPage } = require("../../pages/loginPage");

Given("کاربر در صفحه لاگین قرار دارد", () => {
  loginPage.visit();
});

When(
  "نام کاربری {string} و رمز عبور {string} را وارد می‌کند",
  (username, password) => {
    loginPage.fillUsername(username).fillPassword(password);
  }
);

When("روی دکمه ورود کلیک می‌کند", () => {
  loginPage.clickLogin();
});

When(
  "رمز عبور {string} را وارد می‌کند (بدون نام کاربری)",
  (password) => {
    loginPage.fillPassword(password);
  }
);

Then("کاربر به داشبورد هدایت می‌شود", () => {
  cy.url().should("include", "/dashboard.html");
});

Then("نام {string} در داشبورد نمایش داده می‌شود", (fullName) => {
  cy.getByCy("user-fullname").should("contain.text", fullName);
});

Then("پیام خطای معتبر نمایش داده می‌شود", () => {
  loginPage.getErrorMessage().should("be.visible");
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
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split("?")[0];
  if (reqPath === "/") reqPath = "/index.html";

  const safePath = path.normalize(reqPath).replace(/^(\\.\\.(\\/|\\\\|$))+/, "");
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
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_MAP[ext] || "application/octet-stream";
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { "Content-Type": contentType });
  res.end(content);
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
node "$DIR/index.js" "$@"
`;
  return { path: "scripts/serve/report.sh", content };
}

export function scriptsServeReportCmd(_o: ScaffoldOptions): FileSpec {
  const content = `@echo off
cd /d "%~dp0"
node index.js %*
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
    "# 1. Install dependencies",
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
    "npx qa new --name my-tests --language typescript --bdd --allure --yes",
    "cd my-tests",
    "",
    "# 2. Install & start frontend",
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
  );

  return { path: "README.md", content: lines.join("\n") + "\n" };
}
