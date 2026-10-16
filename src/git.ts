import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

export function isAnsibleRepo(cwd: string): boolean {
  try {
    const hasAnsibleCfg = fs.existsSync(path.join(cwd, "ansible.cfg"));
    const hasPlaybooks = fs.existsSync(path.join(cwd, "playbooks")) && fs.statSync(path.join(cwd, "playbooks")).isDirectory();
    const hasRoles = fs.existsSync(path.join(cwd, "roles")) && fs.statSync(path.join(cwd, "roles")).isDirectory();
    const hasInventory = fs.existsSync(path.join(cwd, "inventory")) && fs.statSync(path.join(cwd, "inventory")).isDirectory();

    return hasAnsibleCfg || (hasPlaybooks && hasRoles) || (hasPlaybooks && hasInventory);
  } catch {
    return false;
  }
}

export function getGitHead(cwd: string): string {
  try {
    return execSync("git rev-parse HEAD", { cwd, stdio: ["ignore", "pipe", "ignore"], encoding: "utf-8" }).trim();
  } catch {
    return "no-git-head";
  }
}

export function getGitStatusHash(cwd: string): string {
  try {
    const statusOutput = execSync(
      "git status --porcelain playbooks roles inventory group_vars host_vars",
      { cwd, stdio: ["ignore", "pipe", "ignore"], encoding: "utf-8" }
    ).trim();

    if (!statusOutput) {
      return "clean";
    }

    return crypto.createHash("sha256").update(statusOutput).digest("hex").slice(0, 16);
  } catch {
    // Non-git fallback: hash mtime of target directories
    return fallbackMtimeHash(cwd);
  }
}

function fallbackMtimeHash(cwd: string): string {
  const dirs = ["playbooks", "roles", "inventory"];
  let mtimes = "";
  for (const d of dirs) {
    const p = path.join(cwd, d);
    if (fs.existsSync(p)) {
      try {
        mtimes += `${d}:${fs.statSync(p).mtimeMs};`;
      } catch {
        // ignore
      }
    }
  }
  return crypto.createHash("sha256").update(mtimes).digest("hex").slice(0, 16);
}
