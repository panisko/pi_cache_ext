import * as fs from "node:fs";
import * as path from "node:path";
import { AnsibleRepoCache } from "./types.js";
import { scanAnsibleRepo } from "./extractor.js";
import { getGitHead, getGitStatusHash } from "./git.js";

const CURRENT_CACHE_VERSION = 1;

export function getCachePath(cwd: string): string {
  const piDir = path.join(cwd, ".pi");
  if (!fs.existsSync(piDir)) {
    try {
      fs.mkdirSync(piDir, { recursive: true });
    } catch {
      // If unable to create .pi, fall back to cwd
      return path.join(cwd, ".ansible-cache.json");
    }
  }
  return path.join(piDir, "ansible-cache.json");
}

export function readCacheFromFile(filePath: string): AnsibleRepoCache | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === CURRENT_CACHE_VERSION && parsed.commit) {
      return parsed as AnsibleRepoCache;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeCacheToFile(filePath: string, cache: AnsibleRepoCache): void {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(cache, null, 2), "utf-8");
  } catch (err) {
    console.error(`[pi-cache-ext] Failed to write cache to ${filePath}:`, err);
  }
}

export interface CacheResult {
  cache: AnsibleRepoCache;
  source: "hit" | "miss" | "rebuilt";
  path: string;
}

export function getOrBuildCache(cwd: string, forceRebuild = false): CacheResult {
  const cachePath = getCachePath(cwd);
  const currentHead = getGitHead(cwd);
  const currentDirtyHash = getGitStatusHash(cwd);

  if (!forceRebuild) {
    const existing = readCacheFromFile(cachePath);
    if (existing) {
      const commitMatches = existing.commit === currentHead;
      const statusMatches = existing.dirtyFilesHash === currentDirtyHash;

      if (commitMatches && statusMatches) {
        return {
          cache: existing,
          source: "hit",
          path: cachePath
        };
      }
    }
  }

  // Cache miss or force rebuild: scan repo
  const newCache = scanAnsibleRepo(cwd);
  writeCacheToFile(cachePath, newCache);

  return {
    cache: newCache,
    source: forceRebuild ? "rebuilt" : "miss",
    path: cachePath
  };
}
