import * as fs from "node:fs";
import { isAnsibleRepo } from "./git.js";
import { getOrBuildCache, getCachePath } from "./cache.js";
import { formatCacheForPrompt } from "./formatter.js";

// Minimal extension context interface compatible with Pi
export interface ExtensionUI {
  notify(message: string, level?: "info" | "warning" | "error" | "success"): void;
}

export interface ExtensionContext {
  cwd: string;
  ui: ExtensionUI;
}

export interface BeforeAgentStartEvent {
  type: "before_agent_start";
  systemPromptOptions: {
    sections: Record<string, string>;
    promptGuidelines: string[];
    [key: string]: any;
  };
  [key: string]: any;
}

export interface ExtensionAPI {
  on(event: "before_agent_start", handler: (event: BeforeAgentStartEvent, ctx: ExtensionContext) => Promise<void> | void): void;
  registerCommand(
    name: string,
    options: {
      description: string;
      handler: (args: string, ctx: ExtensionContext) => Promise<void> | void;
    }
  ): void;
}

export default function registerAnsibleCacheExtension(pi: ExtensionAPI): void {
  // Inject cached Ansible structure on session / turn start
  pi.on("before_agent_start", async (event, ctx) => {
    const cwd = ctx.cwd;
    if (!isAnsibleRepo(cwd)) {
      return;
    }

    try {
      const { cache, source } = getOrBuildCache(cwd);
      const formatted = formatCacheForPrompt(cache);

      if (!event.systemPromptOptions.sections) {
        event.systemPromptOptions.sections = {};
      }
      event.systemPromptOptions.sections["ansible_repo_cache"] = formatted;

      if (!Array.isArray(event.systemPromptOptions.promptGuidelines)) {
        event.systemPromptOptions.promptGuidelines = [];
      }

      event.systemPromptOptions.promptGuidelines.push(
        "Ansible repository state is pre-indexed in <ansible_repo_cache>. Do NOT use read or bash just to check playbooks, roles, tasks, handlers, or vars. Trust the cache and proceed directly to modifying target files if needed."
      );

      if (source === "miss" || source === "rebuilt") {
        ctx.ui?.notify?.(
          `[ansible-cache] Built repo cache for commit ${cache.commit.slice(0, 8)} (${Object.keys(cache.roles).length} roles, ${Object.keys(cache.playbooks).length} playbooks)`,
          "info"
        );
      }
    } catch (err: any) {
      console.error("[ansible-cache] Failed to process cache:", err);
    }
  });

  // Slash command to inspect or rebuild cache manually
  pi.registerCommand("ansible-cache", {
    description: "Manage Ansible repository cache (status | rebuild | clear)",
    handler: async (args, ctx) => {
      const cwd = ctx.cwd;
      if (!isAnsibleRepo(cwd)) {
        ctx.ui?.notify?.("Current directory is not an Ansible repository.", "warning");
        return;
      }

      const subcommand = (args || "").trim().toLowerCase();

      if (subcommand === "rebuild") {
        const { cache, path: cachePath } = getOrBuildCache(cwd, true);
        ctx.ui?.notify?.(
          `Cache rebuilt: ${Object.keys(cache.roles).length} roles, ${Object.keys(cache.playbooks).length} playbooks saved to ${cachePath}`,
          "success"
        );
        return;
      }

      if (subcommand === "clear") {
        const cachePath = getCachePath(cwd);
        if (fs.existsSync(cachePath)) {
          fs.unlinkSync(cachePath);
          ctx.ui?.notify?.(`Cache deleted: ${cachePath}`, "info");
        } else {
          ctx.ui?.notify?.("No cache file found to clear.", "info");
        }
        return;
      }

      // Default: Status
      const { cache, source, path: cachePath } = getOrBuildCache(cwd, false);
      const fileStat = fs.existsSync(cachePath) ? fs.statSync(cachePath) : null;
      const sizeKb = fileStat ? (fileStat.size / 1024).toFixed(1) : "0";

      ctx.ui?.notify?.(
        `[ansible-cache] Status: ${source.toUpperCase()} | Commit: ${cache.commit.slice(0, 8)} | Roles: ${Object.keys(cache.roles).length} | Playbooks: ${Object.keys(cache.playbooks).length} | Size: ${sizeKb}KB (${cachePath})`,
        "info"
      );
    }
  });
}
