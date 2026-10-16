import { AnsibleRepoCache } from "./types.js";

export function formatCacheForPrompt(cache: AnsibleRepoCache): string {
  const lines: string[] = [];

  lines.push(`# Ansible Repository Index`);
  lines.push(`Commit: ${cache.commit.slice(0, 8)} | Status: ${cache.dirtyFilesHash}`);
  lines.push(
    `Rule: This repository architecture is indexed below. Do NOT use 'read' or 'bash' to inspect playbooks, roles, tasks, handlers, or variable names. Only read individual files when making code modifications.`
  );
  lines.push("");

  // 1. Playbooks
  const playbookKeys = Object.keys(cache.playbooks).sort();
  if (playbookKeys.length > 0) {
    lines.push(`## Playbooks (${playbookKeys.length})`);
    for (const pbPath of playbookKeys) {
      const pb = cache.playbooks[pbPath];
      const playDescs: string[] = [];
      for (const p of pb.plays) {
        const parts: string[] = [];
        if (p.name) parts.push(`name: "${p.name}"`);
        if (p.hosts) parts.push(`hosts: "${p.hosts}"`);
        if (p.roles && p.roles.length > 0) parts.push(`roles: [${p.roles.join(", ")}]`);
        if (p.tasks && p.tasks.length > 0) {
          const taskSummary = p.tasks.length <= 4 ? p.tasks.join("; ") : `${p.tasks.slice(0, 3).join("; ")} (+${p.tasks.length - 3} more)`;
          parts.push(`tasks: [${taskSummary}]`);
        }
        if (p.vars && p.vars.length > 0) parts.push(`vars: [${p.vars.join(", ")}]`);
        playDescs.push(`{ ${parts.join(" | ")} }`);
      }
      lines.push(`- \`${pbPath}\`: ${playDescs.join(" -> ")}`);
    }
    lines.push("");
  }

  // 2. Roles
  const roleKeys = Object.keys(cache.roles).sort();
  if (roleKeys.length > 0) {
    lines.push(`## Roles (${roleKeys.length})`);
    for (const roleName of roleKeys) {
      const role = cache.roles[roleName];
      const items: string[] = [];

      if (role.tasks.length > 0) {
        const taskStrs = role.tasks.map(t => `${t.name} (${t.module})`);
        items.push(`tasks (${taskStrs.length}): [${taskStrs.join(" | ")}]`);
      }
      if (role.handlers.length > 0) {
        items.push(`handlers: [${role.handlers.join(", ")}]`);
      }
      if (role.templates.length > 0) {
        items.push(`templates: [${role.templates.join(", ")}]`);
      }
      if (role.files.length > 0) {
        items.push(`files: [${role.files.join(", ")}]`);
      }
      if (role.vars_keys.length > 0) {
        items.push(`vars: [${role.vars_keys.join(", ")}]`);
      }

      lines.push(`- \`${roleName}\`: ${items.join(" ; ")}`);
    }
    lines.push("");
  }

  // 3. Inventory
  lines.push(`## Inventory`);
  if (cache.inventory.groups.length > 0) {
    lines.push(`- Groups: ${cache.inventory.groups.join(", ")}`);
  }

  const gvKeys = Object.keys(cache.inventory.group_vars).sort();
  if (gvKeys.length > 0) {
    const gvSummaries = gvKeys.map(g => `${g}: [${cache.inventory.group_vars[g].join(", ")}]`);
    lines.push(`- Group Vars: ${gvSummaries.join(" ; ")}`);
  }

  const hvKeys = Object.keys(cache.inventory.host_vars).sort();
  if (hvKeys.length > 0) {
    const hvSummaries = hvKeys.map(h => `${h}: [${cache.inventory.host_vars[h].join(", ")}]`);
    lines.push(`- Host Vars: ${hvSummaries.join(" ; ")}`);
  }

  return lines.join("\n");
}
