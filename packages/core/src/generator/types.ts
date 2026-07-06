/**
 * Options controlling how a Cypress project is scaffolded.
 */
import { z } from "zod";

export const projectLanguageSchema = z.enum(["typescript", "javascript"]);
export type ProjectLanguage = z.infer<typeof projectLanguageSchema>;

export const scaffoldOptionsSchema = z.object({
  /** Target directory (created if missing). */
  targetDir: z.string(),
  /** npm package name for the generated project. */
  projectName: z.string(),
  /** Human-readable description for package.json / README. */
  description: z.string().default(""),
  /** TypeScript or JavaScript test files. */
  language: projectLanguageSchema.default("typescript"),
  /** Include Cucumber (BDD) preprocessor + sample feature. */
  bdd: z.boolean().default(true),
  /** Include Allure reporter plugin. */
  allure: z.boolean().default(true),
  /** Base URL the generated tests will target. */
  baseUrl: z.string().default("http://localhost:3000"),
  /** Run `npm install` after scaffolding. */
  installDeps: z.boolean().default(true),
  /** Include LLM-Wiki (Structure Guide from reference project). */
  llmWiki: z.boolean().default(false),
});

export type ScaffoldOptions = z.infer<typeof scaffoldOptionsSchema>;

export interface ScaffoldResult {
  /** Absolute path of the created project. */
  projectPath: string;
  /** Files written (relative paths). */
  files: string[];
  /** Whether `npm install` was run. */
  installed: boolean;
}
