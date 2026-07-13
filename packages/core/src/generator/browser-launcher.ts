import { chromium, type Browser } from "playwright";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface LaunchOptions {
  headless?: boolean;
  debug?: boolean;
}

/**
 * Launches a Chromium browser with multi-strategy fallback:
 * 1. Bundled Chromium (requires `npx playwright install chromium`)
 * 2. System Chrome (via channel: "chrome")
 * 3. System Chromium (via channel: "chromium")
 * 4. Platform-specific common browser paths
 *
 * Works on Windows, Linux, and macOS without requiring `npx playwright install`.
 */
export async function launchBrowser(options: LaunchOptions = {}): Promise<Browser> {
  const { headless = true, debug = false } = options;
  const log = debug ? (msg: string) => console.log(`[qa] DEBUG: ${msg}`) : () => {};

  // Strategy 1: Bundled Chromium (fastest, if downloaded)
  try {
    log("Trying bundled Chromium...");
    const browser = await chromium.launch({ headless });
    log("Launched bundled Chromium successfully");
    return browser;
  } catch (e) {
    log(`Bundled Chromium failed: ${(e as Error).message}`);
  }

  // Strategy 2: System Chrome (channel: "chrome")
  try {
    log("Trying system Chrome (channel: chrome)...");
    const browser = await chromium.launch({ headless, channel: "chrome" });
    log("Launched system Chrome successfully");
    return browser;
  } catch (e) {
    log(`System Chrome failed: ${(e as Error).message}`);
  }

  // Strategy 3: System Chromium (channel: "chromium")
  try {
    log("Trying system Chromium (channel: chromium)...");
    const browser = await chromium.launch({ headless, channel: "chromium" });
    log("Launched system Chromium successfully");
    return browser;
  } catch (e) {
    log(`System Chromium failed: ${(e as Error).message}`);
  }

  // Strategy 4: Find browser by common paths
  const executablePath = findSystemBrowser();
  if (executablePath) {
    try {
      log(`Trying system browser at: ${executablePath}`);
      const browser = await chromium.launch({ headless, executablePath });
      log(`Launched browser from ${executablePath} successfully`);
      return browser;
    } catch (e) {
      log(`Browser at ${executablePath} failed: ${(e as Error).message}`);
    }
  }

  throw new Error(
    "Could not find a Chromium/Chrome browser. Install one of:\n" +
    "  - Google Chrome: https://www.google.com/chrome/\n" +
    "  - Chromium: sudo apt install chromium-browser (Linux) or https://www.chromium.org/getting-involved/download-chromium/ (other)\n" +
    "  - Or install bundled: npx playwright install chromium"
  );
}

/**
 * Finds a system-installed Chrome or Chromium browser by checking common paths.
 */
function findSystemBrowser(): string | null {
  const platform = process.platform;

  const candidates: string[] = [];

  if (platform === "linux") {
    candidates.push(
      // Debian/Ubuntu
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
      // Fedora/RHEL
      "/usr/bin/chromium-browser-freeworld",
      // Snap
      "/snap/bin/chromium",
      // Flatpak
      "/var/lib/flatpak/exports/bin/org.chromium.Chromium",
      // Google Chrome
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      // Common custom paths
      "/opt/google/chrome/chrome",
      "/opt/chromium.org/chromium/chromium",
    );
  } else if (platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
    const programFiles = process.env["PROGRAMFILES"] || "C:\\Program Files";
    const programFilesX86 = process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";

    candidates.push(
      join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
      join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
      join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
      join(programFiles, "Chromium", "Application", "chrome.exe"),
      join(programFilesX86, "Chromium", "Application", "chrome.exe"),
    );
  } else if (platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    );
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  // Try to find via which/where command
  try {
    const names = platform === "win32"
      ? ["chrome", "chromium"]
      : ["chromium-browser", "chromium", "google-chrome", "google-chrome-stable"];
    for (const name of names) {
      try {
        const cmd = platform === "win32" ? `where ${name}` : `which ${name}`;
        const result = execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
        if (result && existsSync(result.split("\n")[0])) {
          return result.split("\n")[0];
        }
      } catch {
        // not found, continue
      }
    }
  } catch {
    // which/where not available
  }

  return null;
}

/**
 * Detects available browsers and returns their info (for setup scripts).
 */
export function detectSystemBrowsers(): Array<{ name: string; path: string; type: "chrome" | "chromium" }> {
  const found: Array<{ name: string; path: string; type: "chrome" | "chromium" }> = [];
  const seen = new Set<string>();

  const platform = process.platform;
  const candidates: Array<{ name: string; path: string; type: "chrome" | "chromium" }> = [];

  if (platform === "linux") {
    candidates.push(
      { name: "Chromium (Debian/Ubuntu)", path: "/usr/bin/chromium-browser", type: "chromium" },
      { name: "Chromium", path: "/usr/bin/chromium", type: "chromium" },
      { name: "Chromium (Snap)", path: "/snap/bin/chromium", type: "chromium" },
      { name: "Google Chrome", path: "/usr/bin/google-chrome", type: "chrome" },
      { name: "Google Chrome Stable", path: "/usr/bin/google-chrome-stable", type: "chrome" },
    );
  } else if (platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
    const programFiles = process.env["PROGRAMFILES"] || "C:\\Program Files";
    candidates.push(
      { name: "Google Chrome", path: join(localAppData, "Google", "Chrome", "Application", "chrome.exe"), type: "chrome" },
      { name: "Google Chrome (x64)", path: join(programFiles, "Google", "Chrome", "Application", "chrome.exe"), type: "chrome" },
    );
  } else if (platform === "darwin") {
    candidates.push(
      { name: "Google Chrome", path: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", type: "chrome" },
      { name: "Chromium", path: "/Applications/Chromium.app/Contents/MacOS/Chromium", type: "chromium" },
    );
  }

  for (const c of candidates) {
    if (existsSync(c.path) && !seen.has(c.type)) {
      found.push(c);
      seen.add(c.type);
    }
  }

  // Also try which/where
  try {
    const names: Array<{ name: string; cmd: string; type: "chrome" | "chromium" }> = platform === "win32"
      ? [
          { name: "Chrome", cmd: "where chrome", type: "chrome" },
          { name: "Chromium", cmd: "where chromium", type: "chromium" },
        ]
      : [
          { name: "Chromium", cmd: "which chromium-browser", type: "chromium" },
          { name: "Chromium", cmd: "which chromium", type: "chromium" },
          { name: "Google Chrome", cmd: "which google-chrome", type: "chrome" },
          { name: "Google Chrome", cmd: "which google-chrome-stable", type: "chrome" },
        ];
    for (const n of names) {
      if (seen.has(n.type)) continue;
      try {
        const result = execSync(n.cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim().split("\n")[0];
        if (result && existsSync(result)) {
          found.push({ name: n.name, path: result, type: n.type });
          seen.add(n.type);
        }
      } catch {
        // not found
      }
    }
  } catch {
    // which/where not available
  }

  return found;
}
