export type GuideDescriptor = {
    flag: string;
    fileName: string;
    description: string;
};
export declare const CREATE_SUBTASK_HANDOFF_GUIDE_FLAG = "--right-way-to-create-subtask-handoff";
export declare const GUIDE_REGISTRY: GuideDescriptor[];
export declare function renderGuideMarkdown(flag: string): string;
export declare function printGuideMarkdown(flag: string): void;
export declare function tryHandleGuideFlags(rawArgs: string[]): boolean;
export declare function getGuideFlagsHelpText(): string;
//# sourceMappingURL=guides.d.ts.map