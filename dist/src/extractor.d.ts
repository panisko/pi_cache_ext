import { AnsiblePlaybookSummary, AnsibleRoleSummary, AnsibleInventorySummary, AnsibleRepoCache } from "./types.js";
export declare function extractPlaybook(filePath: string, relativePath: string): AnsiblePlaybookSummary | null;
export declare function extractRole(roleDir: string, roleName: string): AnsibleRoleSummary;
export declare function extractInventory(cwd: string): AnsibleInventorySummary;
export declare function scanAnsibleRepo(cwd: string): AnsibleRepoCache;
//# sourceMappingURL=extractor.d.ts.map