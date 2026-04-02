import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = dirname(scriptDir);
const sourceDir = join(rootDir, 'src', 'cli', 'guides');
const targetDir = join(rootDir, 'dist', 'cli', 'guides');

if (!existsSync(sourceDir)) {
  throw new Error(`Guide source directory not found: ${sourceDir}`);
}

mkdirSync(join(rootDir, 'dist', 'cli'), { recursive: true });
rmSync(targetDir, { recursive: true, force: true });
cpSync(sourceDir, targetDir, { recursive: true });
