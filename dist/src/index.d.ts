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
    registerCommand(name: string, options: {
        description: string;
        handler: (args: string, ctx: ExtensionContext) => Promise<void> | void;
    }): void;
}
export default function registerAnsibleCacheExtension(pi: ExtensionAPI): void;
//# sourceMappingURL=index.d.ts.map