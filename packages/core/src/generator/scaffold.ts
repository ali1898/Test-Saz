import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import {
  azurePipelines,
  cypressConfig,
  cypressEnvJson,
  fixturesUsers,
  frontendDashboardHtml,
  frontendIndexHtml,
  frontendServerJs,
  frontendStartScript,
  frontendUsersJson,
  gitignore,
  locators,
  loginPage,
  packageJson,
  readme,
  regressionTest,
  sampleFeature,
  sampleStepsJs,
  sampleStepsTs,
  scriptsAllureGenerate,
  scriptsAllureOpen,
  scriptsRunAll,
  scriptsServeCopy,
  scriptsServeIndex,
  scriptsServeReportSh,
  scriptsServeReportCmd,
  scriptsServeReportPs1,
  smokeTest,
  supportCommands,
  supportE2e,
  supportIndexDts,
  supportTypesTypesDts,
  supportTypesUsersJsonDts,
  tsconfig,
  utilsDataGenerator,
  type FileSpec,
} from "./templates";
import { scaffoldOptionsSchema, type ScaffoldOptions, type ScaffoldResult } from "./types";

export function collectFiles(o: ScaffoldOptions): FileSpec[] {
  const files: FileSpec[] = [
    packageJson(o),
    tsconfig(o),
    cypressConfig(o),
    cypressEnvJson(o),
    supportE2e(o),
    supportCommands(o),
    supportIndexDts(o),
    supportTypesTypesDts(o),
    supportTypesUsersJsonDts(o),
    locators(o),
    loginPage(o),
    smokeTest(o),
    regressionTest(o),
    fixturesUsers(o),
    utilsDataGenerator(o),
    frontendServerJs(o),
    frontendUsersJson(o),
    frontendIndexHtml(o),
    frontendDashboardHtml(o),
    frontendStartScript(o),
    scriptsRunAll(o),
    scriptsAllureGenerate(o),
    scriptsAllureOpen(o),
    scriptsServeIndex(o),
    scriptsServeCopy(o),
    scriptsServeReportSh(o),
    scriptsServeReportCmd(o),
    scriptsServeReportPs1(o),
    azurePipelines(o),
    gitignore(o),
    readme(o),
  ];

  if (o.bdd) {
    files.push(sampleFeature(o));
    files.push(o.language === "typescript" ? sampleStepsTs() : sampleStepsJs());
  }

  return files;
}

function ensureDirFor(filePath: string): void {
  const dir = join(filePath, "..");
  const normalized = dir.replace(/^\.[\\/]/, "");
  if (normalized && normalized !== ".") {
    mkdirSync(normalized, { recursive: true });
  }
}

export async function scaffoldProject(
  rawOptions: ScaffoldOptions,
): Promise<ScaffoldResult> {
  const o = scaffoldOptionsSchema.parse(rawOptions);
  const projectPath = resolve(o.targetDir);

  if (existsSync(projectPath) && existsSync(join(projectPath, "package.json"))) {
    throw new Error(
      `A package.json already exists in "${projectPath}". ` +
        `Choose a different target directory.`,
    );
  }

  mkdirSync(projectPath, { recursive: true });

  const files = collectFiles(o);
  for (const spec of files) {
    const absPath = join(projectPath, spec.path);
    ensureDirFor(absPath);
    writeFileSync(absPath, spec.content, "utf-8");
  }

  let installed = false;
  if (o.installDeps) {
    await runNpmInstall(projectPath);
    installed = true;
  }

  return {
    projectPath,
    files: files.map((f) => f.path),
    installed,
  };
}

function runNpmInstall(cwd: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("npm", ["install", "--no-fund", "--no-audit"], {
      cwd,
      stdio: "inherit",
      shell: true,
    });

    child.on("error", (err) => {
      reject(
        new Error(
          `Failed to launch npm install: ${err.message}. ` +
            `Make sure Node.js/npm is installed and on your PATH.`,
        ),
      );
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(`npm install exited with code ${code}.`));
      }
    });
  });
}
