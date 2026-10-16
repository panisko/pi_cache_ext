import * as fs from "node:fs";
import * as path from "node:path";
import { parse as parseYaml } from "yaml";
import { getGitHead, getGitStatusHash } from "./git.js";
const TASK_DIRECTIVE_KEYS = new Set([
    "name",
    "when",
    "register",
    "loop",
    "with_items",
    "with_dict",
    "with_file",
    "with_subelements",
    "notify",
    "tags",
    "vars",
    "become",
    "become_user",
    "become_method",
    "delegate_to",
    "run_once",
    "failed_when",
    "changed_when",
    "ignore_errors",
    "check_mode",
    "environment",
    "diff",
    "no_log",
    "args",
    "block",
    "rescue",
    "always",
    "until",
    "retries",
    "delay",
    "listen"
]);
function safeReadYaml(filePath) {
    try {
        if (!fs.existsSync(filePath))
            return null;
        const content = fs.readFileSync(filePath, "utf-8");
        return parseYaml(content);
    }
    catch {
        return null;
    }
}
function findTaskModule(task) {
    for (const key of Object.keys(task)) {
        if (!TASK_DIRECTIVE_KEYS.has(key)) {
            return key;
        }
    }
    if (task.block)
        return "block";
    return "unknown";
}
function extractTasksFromList(taskList) {
    if (!Array.isArray(taskList))
        return [];
    const results = [];
    for (const item of taskList) {
        if (!item || typeof item !== "object")
            continue;
        if (item.block && Array.isArray(item.block)) {
            if (item.name) {
                results.push({ name: item.name, module: "block" });
            }
            results.push(...extractTasksFromList(item.block));
            continue;
        }
        const taskName = item.name || "(unnamed task)";
        const moduleName = findTaskModule(item);
        results.push({ name: taskName, module: moduleName });
    }
    return results;
}
export function extractPlaybook(filePath, relativePath) {
    const data = safeReadYaml(filePath);
    if (!Array.isArray(data))
        return null;
    const plays = [];
    for (const play of data) {
        if (!play || typeof play !== "object")
            continue;
        const playRoles = [];
        if (Array.isArray(play.roles)) {
            for (const r of play.roles) {
                if (typeof r === "string")
                    playRoles.push(r);
                else if (r && typeof r === "object" && typeof r.role === "string") {
                    playRoles.push(r.role);
                }
            }
        }
        const taskNames = [];
        for (const taskKey of ["pre_tasks", "tasks", "post_tasks"]) {
            if (Array.isArray(play[taskKey])) {
                for (const t of play[taskKey]) {
                    if (t && typeof t === "object" && t.name) {
                        taskNames.push(t.name);
                    }
                }
            }
        }
        const varKeys = play.vars && typeof play.vars === "object" ? Object.keys(play.vars) : [];
        plays.push({
            name: play.name,
            hosts: typeof play.hosts === "string" ? play.hosts : Array.isArray(play.hosts) ? play.hosts.join(",") : undefined,
            roles: playRoles,
            tasks: taskNames,
            vars: varKeys
        });
    }
    return {
        path: relativePath,
        plays
    };
}
export function extractRole(roleDir, roleName) {
    const tasks = [];
    const handlers = [];
    const templates = [];
    const files = [];
    const varKeysSet = new Set();
    // 1. Tasks
    const tasksDir = path.join(roleDir, "tasks");
    if (fs.existsSync(tasksDir)) {
        try {
            const taskFiles = fs.readdirSync(tasksDir).filter(f => f.endsWith(".yaml") || f.endsWith(".yml"));
            for (const tf of taskFiles) {
                const parsed = safeReadYaml(path.join(tasksDir, tf));
                if (Array.isArray(parsed)) {
                    tasks.push(...extractTasksFromList(parsed));
                }
            }
        }
        catch {
            // ignore
        }
    }
    // 2. Handlers
    const handlersDir = path.join(roleDir, "handlers");
    if (fs.existsSync(handlersDir)) {
        try {
            const handlerFiles = fs.readdirSync(handlersDir).filter(f => f.endsWith(".yaml") || f.endsWith(".yml"));
            for (const hf of handlerFiles) {
                const parsed = safeReadYaml(path.join(handlersDir, hf));
                if (Array.isArray(parsed)) {
                    for (const h of parsed) {
                        if (h && typeof h === "object" && h.name) {
                            handlers.push(h.name);
                        }
                    }
                }
            }
        }
        catch {
            // ignore
        }
    }
    // 3. Templates
    const templatesDir = path.join(roleDir, "templates");
    if (fs.existsSync(templatesDir)) {
        try {
            templates.push(...fs.readdirSync(templatesDir).filter(f => !f.startsWith(".")));
        }
        catch {
            // ignore
        }
    }
    // 4. Files
    const filesDir = path.join(roleDir, "files");
    if (fs.existsSync(filesDir)) {
        try {
            files.push(...fs.readdirSync(filesDir).filter(f => !f.startsWith(".")));
        }
        catch {
            // ignore
        }
    }
    // 5. Defaults & Vars (keys only)
    for (const dirName of ["defaults", "vars"]) {
        const vDir = path.join(roleDir, dirName);
        if (fs.existsSync(vDir)) {
            try {
                const vFiles = fs.readdirSync(vDir).filter(f => f.endsWith(".yaml") || f.endsWith(".yml"));
                for (const vf of vFiles) {
                    const parsed = safeReadYaml(path.join(vDir, vf));
                    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                        for (const k of Object.keys(parsed)) {
                            varKeysSet.add(k);
                        }
                    }
                }
            }
            catch {
                // ignore
            }
        }
    }
    return {
        name: roleName,
        tasks,
        handlers,
        templates,
        files,
        vars_keys: Array.from(varKeysSet).sort()
    };
}
export function extractInventory(cwd) {
    const groupsSet = new Set();
    const groupVars = {};
    const hostVars = {};
    const inventoryDirs = [path.join(cwd, "inventory"), cwd];
    for (const baseDir of inventoryDirs) {
        // Check group_vars
        const gvDir = path.join(baseDir, "group_vars");
        if (fs.existsSync(gvDir)) {
            try {
                const entries = fs.readdirSync(gvDir);
                for (const entry of entries) {
                    if (entry.startsWith("."))
                        continue;
                    const groupName = entry.replace(/\.(ya?ml)$/, "");
                    groupsSet.add(groupName);
                    const fullPath = path.join(gvDir, entry);
                    const parsed = safeReadYaml(fullPath);
                    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                        groupVars[groupName] = Object.keys(parsed).sort();
                    }
                }
            }
            catch {
                // ignore
            }
        }
        // Check host_vars
        const hvDir = path.join(baseDir, "host_vars");
        if (fs.existsSync(hvDir)) {
            try {
                const entries = fs.readdirSync(hvDir);
                for (const entry of entries) {
                    if (entry.startsWith("."))
                        continue;
                    const hostName = entry.replace(/\.(ya?ml)$/, "");
                    const fullPath = path.join(hvDir, entry);
                    const parsed = safeReadYaml(fullPath);
                    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                        hostVars[hostName] = Object.keys(parsed).sort();
                    }
                }
            }
            catch {
                // ignore
            }
        }
    }
    return {
        groups: Array.from(groupsSet).sort(),
        group_vars: groupVars,
        host_vars: hostVars
    };
}
export function scanAnsibleRepo(cwd) {
    const playbooks = {};
    const roles = {};
    // Scan playbooks/
    const playbooksDir = path.join(cwd, "playbooks");
    if (fs.existsSync(playbooksDir)) {
        try {
            const files = fs.readdirSync(playbooksDir).filter(f => f.endsWith(".yaml") || f.endsWith(".yml"));
            for (const file of files) {
                const fullPath = path.join(playbooksDir, file);
                const relPath = path.join("playbooks", file);
                const pb = extractPlaybook(fullPath, relPath);
                if (pb) {
                    playbooks[relPath] = pb;
                }
            }
        }
        catch {
            // ignore
        }
    }
    // Scan roles/
    const rolesDir = path.join(cwd, "roles");
    if (fs.existsSync(rolesDir)) {
        try {
            const entries = fs.readdirSync(rolesDir);
            for (const entry of entries) {
                const fullRolePath = path.join(rolesDir, entry);
                if (fs.statSync(fullRolePath).isDirectory()) {
                    const roleSummary = extractRole(fullRolePath, entry);
                    roles[entry] = roleSummary;
                }
            }
        }
        catch {
            // ignore
        }
    }
    const inventory = extractInventory(cwd);
    const commit = getGitHead(cwd);
    const dirtyFilesHash = getGitStatusHash(cwd);
    return {
        version: 1,
        commit,
        dirtyFilesHash,
        generatedAt: new Date().toISOString(),
        playbooks,
        roles,
        inventory
    };
}
//# sourceMappingURL=extractor.js.map