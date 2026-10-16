import { AnsibleRepoCache } from "./types.js";
export declare function getCachePath(cwd: string): string;
export declare function readCacheFromFile(filePath: string): AnsibleRepoCache | null;
export declare function writeCacheToFile(filePath: string, cache: AnsibleRepoCache): void;
export interface CacheResult {
    cache: AnsibleRepoCache;
    source: "hit" | "miss" | "rebuilt";
    path: string;
}
export declare function getOrBuildCache(cwd: string, forceRebuild?: boolean): CacheResult;
//# sourceMappingURL=cache.d.ts.map