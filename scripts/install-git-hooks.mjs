import { chmodSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gitDir = join(root, '.git');

if (!existsSync(gitDir)) {
  process.exit(0);
}

const hooksDir = join(gitDir, 'hooks');
mkdirSync(hooksDir, { recursive: true });
const target = join(hooksDir, 'pre-commit');
copyFileSync(join(root, 'scripts', 'git-hooks', 'pre-commit'), target);
chmodSync(target, 0o755);
