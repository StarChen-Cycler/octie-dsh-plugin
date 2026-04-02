import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type GuideDescriptor = {
  flag: string;
  fileName: string;
  description: string;
};

export const CREATE_SUBTASK_HANDOFF_GUIDE_FLAG = '--right-way-to-create-subtask-handoff';

export const GUIDE_REGISTRY: GuideDescriptor[] = [
  {
    flag: '--right-way-to-form-tasks',
    fileName: 'right-way-to-form-tasks.md',
    description: 'Print the task formation guide',
  },
  {
    flag: '--right-way-to-manage-dependencies',
    fileName: 'right-way-to-manage-dependencies.md',
    description: 'Print the dependency management guide',
  },
  {
    flag: '--right-way-to-find-work',
    fileName: 'right-way-to-find-work.md',
    description: 'Print the task selection guide',
  },
  {
    flag: '--right-way-to-review-and-approve',
    fileName: 'right-way-to-review-and-approve.md',
    description: 'Print the review and approval guide',
  },
  {
    flag: '--right-way-to-refine-tasks',
    fileName: 'right-way-to-refine-tasks.md',
    description: 'Print the graph refinement guide',
  },
  {
    flag: '--right-way-to-use-notes-and-files',
    fileName: 'right-way-to-use-notes-and-files.md',
    description: 'Print the metadata placement guide',
  },
  {
    flag: CREATE_SUBTASK_HANDOFF_GUIDE_FLAG,
    fileName: 'right-way-to-create-subtask-handoff.md',
    description: 'Print the subtask handoff guide',
  },
];

function resolveGuideDirectories(): string[] {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return [
    join(currentDir, '..', 'guides'),
    join(currentDir, '..', '..', '..', 'src', 'cli', 'guides'),
  ];
}

function findGuide(flag: string): GuideDescriptor {
  const guide = GUIDE_REGISTRY.find(entry => entry.flag === flag);
  if (!guide) {
    throw new Error(`Unknown guide flag: ${flag}`);
  }

  return guide;
}

export function renderGuideMarkdown(flag: string): string {
  const guide = findGuide(flag);
  const guidePath = resolveGuideDirectories()
    .map(dir => join(dir, guide.fileName))
    .find(candidate => existsSync(candidate));

  if (!guidePath) {
    throw new Error(`Guide content file not found for ${flag}`);
  }

  return readFileSync(guidePath, 'utf-8').trim();
}

export function printGuideMarkdown(flag: string): void {
  console.log(renderGuideMarkdown(flag));
}

function tryHandleRootGuideFlag(rawArgs: string[]): boolean {
  if (rawArgs.length !== 1) {
    return false;
  }

  const guide = GUIDE_REGISTRY.find(entry => entry.flag === rawArgs[0]);
  if (!guide) {
    return false;
  }

  printGuideMarkdown(guide.flag);
  return true;
}

function tryHandleHandoffCreateGuideFlag(rawArgs: string[]): boolean {
  if (
    rawArgs.length === 3 &&
    rawArgs[0] === 'handoff' &&
    rawArgs[1] === 'create' &&
    rawArgs[2] === CREATE_SUBTASK_HANDOFF_GUIDE_FLAG
  ) {
    printGuideMarkdown(CREATE_SUBTASK_HANDOFF_GUIDE_FLAG);
    return true;
  }

  return false;
}

export function tryHandleGuideFlags(rawArgs: string[]): boolean {
  return tryHandleRootGuideFlag(rawArgs) || tryHandleHandoffCreateGuideFlag(rawArgs);
}

export function getGuideFlagsHelpText(): string {
  const lines = GUIDE_REGISTRY.map(entry =>
    `  ${entry.flag.padEnd(42)} ${entry.description}`,
  );

  return `
Guide Flags:
${lines.join('\n')}
`;
}
