// Creates a GitHub release from main. Publishing it triggers the CD workflow (deploy).
//
//   npm run release                 next patch (v0.0.10 -> v0.0.11)
//   npm run release -- minor        next minor or major
//   npm run release -- v1.2.0       explicit version
//   npm run release -- --draft      create it as a draft: it does not deploy until published
//   npm run release -- --dry-run    only show what would happen
//   npm run release -- --yes        skip the confirmation prompt
//
// Needs git and an authenticated GitHub CLI (gh auth login). Node runs this file as is (type stripping).
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

const BRANCH = 'main';
const SEMVER = /^v(\d+)\.(\d+)\.(\d+)$/;
const FIRST_TAG = 'v0.0.0';

type Version = [number, number, number];

class ReleaseError extends Error {}

// execFile without a shell behaves the same on Windows and macOS.
function run(command: string, args: string[]): string {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    const detail = (error as { stderr?: string }).stderr?.trim() || (error as Error).message;
    throw new ReleaseError(`${command} ${args.join(' ')}\n${detail}`);
  }
}

function parse(tag: string): Version {
  const match = SEMVER.exec(tag);
  if (!match) {
    throw new ReleaseError(`"${tag}" no es una versión válida. Usa el formato v1.2.3.`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isGreater(a: Version, b: Version): boolean {
  for (let index = 0; index < 3; index++) {
    if (a[index] !== b[index]) {
      return a[index] > b[index];
    }
  }
  return false;
}

function nextTag(latest: string, request: string): string {
  const [major, minor, patch] = parse(latest);
  if (request === 'patch') return `v${major}.${minor}.${patch + 1}`;
  if (request === 'minor') return `v${major}.${minor + 1}.0`;
  if (request === 'major') return `v${major + 1}.0.0`;
  if (!isGreater(parse(request), [major, minor, patch])) {
    throw new ReleaseError(`${request} no es mayor que la última versión (${latest}).`);
  }
  return request;
}

function latestTag(): string {
  const tag = run('gh', ['release', 'list', '--limit', '1', '--json', 'tagName', '--jq', '.[0].tagName']);
  return tag || FIRST_TAG;
}

function checkRepository(latest: string): string {
  const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch !== BRANCH) {
    throw new ReleaseError(`Estás en "${branch}". Los releases se crean desde ${BRANCH}.`);
  }
  if (run('git', ['status', '--porcelain'])) {
    throw new ReleaseError('Hay cambios sin confirmar. Confirma o guarda los cambios antes de crear el release.');
  }
  run('git', ['fetch', 'origin', BRANCH, '--tags', '--quiet']);
  const head = run('git', ['rev-parse', 'HEAD']);
  const remote = run('git', ['rev-parse', `origin/${BRANCH}`]);
  if (head !== remote) {
    throw new ReleaseError(`${BRANCH} local no coincide con origin/${BRANCH}. Haz pull o push antes de continuar.`);
  }
  if (latest !== FIRST_TAG && run('git', ['rev-list', '-n', '1', latest]) === head) {
    throw new ReleaseError(`No hay cambios desde ${latest}.`);
  }
  return latest === FIRST_TAG ? run('git', ['log', '--oneline']) : run('git', ['log', '--oneline', `${latest}..HEAD`]);
}

async function confirm(question: string): Promise<boolean> {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await readline.question(`${question} (s/N) `);
    return /^(s|si|sí|y|yes)$/i.test(answer.trim());
  } finally {
    readline.close();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((arg) => arg.startsWith('--')));
  const unknown = [...flags].filter((flag) => !['--draft', '--dry-run', '--yes'].includes(flag));
  if (unknown.length > 0) {
    throw new ReleaseError(`Opción desconocida: ${unknown.join(', ')}`);
  }
  const draft = flags.has('--draft');

  const latest = latestTag();
  const tag = nextTag(latest, args.find((arg) => !arg.startsWith('--')) ?? 'patch');
  if (run('git', ['tag', '--list', tag])) {
    throw new ReleaseError(`El tag ${tag} ya existe.`);
  }
  const commits = checkRepository(latest);

  console.log(`Último release: ${latest}`);
  console.log(`Nuevo release:  ${tag}${draft ? ' (borrador)' : ''}`);
  console.log(`\nCommits incluidos:\n${commits}\n`);

  if (flags.has('--dry-run')) {
    console.log('Simulación: no se creó nada.');
    return;
  }
  if (!flags.has('--yes')) {
    const warning = draft
      ? 'El borrador no despliega hasta que lo publiques.'
      : 'Publicarlo despliega el backend, el portal web y el APK.';
    if (!(await confirm(`${warning} ¿Crear ${tag}?`))) {
      console.log('Cancelado.');
      return;
    }
  }

  const create = ['release', 'create', tag, '--target', BRANCH, '--title', tag, '--generate-notes'];
  console.log(run('gh', draft ? [...create, '--draft'] : create));
}

main().catch((error: unknown) => {
  console.error(error instanceof ReleaseError ? error.message : error);
  process.exitCode = 1;
});
