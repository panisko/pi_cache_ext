export interface AnsibleTaskSummary {
  name: string;
  module: string;
}

export interface AnsiblePlaySummary {
  name?: string;
  hosts?: string;
  roles: string[];
  tasks: string[];
  vars: string[];
}

export interface AnsiblePlaybookSummary {
  path: string;
  plays: AnsiblePlaySummary[];
}

export interface AnsibleRoleSummary {
  name: string;
  tasks: AnsibleTaskSummary[];
  handlers: string[];
  templates: string[];
  files: string[];
  vars_keys: string[];
}

export interface AnsibleInventorySummary {
  groups: string[];
  group_vars: Record<string, string[]>;
  host_vars: Record<string, string[]>;
}

export interface AnsibleRepoCache {
  version: number;
  commit: string;
  dirtyFilesHash: string;
  generatedAt: string;
  playbooks: Record<string, AnsiblePlaybookSummary>;
  roles: Record<string, AnsibleRoleSummary>;
  inventory: AnsibleInventorySummary;
}
