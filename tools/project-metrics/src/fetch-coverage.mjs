import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const REPOSITORY = 'MISOG6ProyectoFinal/solventa';
const BRANCH = 'main';

const REPORTS = {
  'backend-test-reports': {
    app: 'Backend',
    fileName: 'coverage.xml'
  },
  'mobile-test-reports': {
    app: 'Mobile',
    fileName: 'lcov.info'
  },
  'web-test-reports': {
    app: 'Web',
    fileName: 'lcov.info'
  }
};

const DOWNLOADS_AT_ONCE = 4;

function roundPercent(value) {
  return Math.round(value * 10) / 10;
}

function readAttribute(tag, name) {
  const match = tag.match(new RegExp(`${name}="([^"]+)"`));
  return match ? match[1] : '';
}

function parseCobertura(xml) {
  const match = xml.match(/<coverage\b[^>]*>/);

  if (!match) {
    throw new Error('coverage.xml has no coverage element');
  }

  const tag = match[0];
  const lineRate = Number(readAttribute(tag, 'line-rate'));
  const linesValid = Number(readAttribute(tag, 'lines-valid'));
  const linesCovered = Number(readAttribute(tag, 'lines-covered'));

  if (!Number.isFinite(lineRate)) {
    throw new Error('coverage.xml has no line-rate');
  }

  return {
    coverage: roundPercent(lineRate * 100),
    linesCovered,
    linesValid
  };
}

function parseLcov(text) {
  let linesCovered = 0;
  let linesValid = 0;

  for (const line of text.split('\n')) {
    if (line.startsWith('LH:')) {
      linesCovered += Number(line.slice(3));
    } else if (line.startsWith('LF:')) {
      linesValid += Number(line.slice(3));
    }
  }

  if (!Number.isFinite(linesValid) || linesValid === 0) {
    throw new Error('lcov.info has no executable lines');
  }

  return {
    coverage: roundPercent((linesCovered / linesValid) * 100),
    linesCovered,
    linesValid
  };
}

async function findFile(dir, fileName) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      const found = await findFile(path, fileName);

      if (found) {
        return found;
      }
    } else if (entry.name === fileName) {
      return path;
    }
  }

  return null;
}

async function gh(args) {
  try {
    const { stdout } = await execFileAsync('gh', args, {
      maxBuffer: 32 * 1024 * 1024,
      windowsHide: true
    });

    return stdout;
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message;
    throw new Error(`gh ${args[0]} failed: ${detail}`);
  }
}

async function listCoverageArtifacts() {
  const stdout = await gh([
    'api',
    '--paginate',
    `repos/${REPOSITORY}/actions/artifacts?per_page=100`,
    '--jq',
    '.artifacts[] | {name,id,created_at,expired,branch:.workflow_run.head_branch,run:.workflow_run.id}'
  ]);

  const artifacts = [];

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    const artifact = JSON.parse(trimmed);

    if (!REPORTS[artifact.name] || artifact.branch !== BRANCH || artifact.expired) {
      continue;
    }

    artifacts.push(artifact);
  }

  return artifacts;
}

async function readCache(cachePath) {
  try {
    const content = await readFile(cachePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }

    throw error;
  }
}

async function downloadReport(artifact) {
  const report = REPORTS[artifact.name];
  const dir = join(tmpdir(), `solventa-coverage-${artifact.id}`);

  await rm(dir, { recursive: true, force: true });

  try {
    await gh([
      'run',
      'download',
      String(artifact.run),
      '--repo',
      REPOSITORY,
      '--name',
      artifact.name,
      '--dir',
      dir
    ]);

    const filePath = await findFile(dir, report.fileName);

    if (!filePath) {
      throw new Error(`${report.fileName} was not in the artifact`);
    }

    const content = await readFile(filePath, 'utf8');
    const measured = report.fileName === 'coverage.xml'
      ? parseCobertura(content)
      : parseLcov(content);

    return {
      date: artifact.created_at,
      app: report.app,
      coverage: measured.coverage,
      linesCovered: measured.linesCovered,
      linesValid: measured.linesValid,
      runId: artifact.run
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]);
    }
  }

  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => run()));

  return results;
}

export async function fetchCoverage(projectRoot) {
  const dataPath = join(projectRoot, 'data', 'coverage.json');
  const cachePath = join(projectRoot, '.cache', 'coverage-artifacts.json');

  await mkdir(join(projectRoot, '.cache'), { recursive: true });

  const artifacts = await listCoverageArtifacts();
  const cache = await readCache(cachePath);
  const missing = artifacts.filter((artifact) => !cache[artifact.id]);

  if (missing.length > 0) {
    console.log(`Descargando ${missing.length} reportes de cobertura de la rama ${BRANCH}...`);
  }

  const downloaded = await mapPool(missing, DOWNLOADS_AT_ONCE, async (artifact) => {
    try {
      const point = await downloadReport(artifact);
      console.log(`✓ ${point.app} ${point.date.slice(0, 10)}: ${point.coverage}%`);
      return [artifact.id, point];
    } catch (error) {
      console.error(`✗ ${artifact.name} ${artifact.id}: ${error.message}`);
      return null;
    }
  });

  for (const entry of downloaded) {
    if (entry) {
      cache[entry[0]] = entry[1];
    }
  }

  await writeFile(cachePath, JSON.stringify(cache, null, 2), 'utf8');

  const points = artifacts
    .map((artifact) => cache[artifact.id])
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date) || a.app.localeCompare(b.app));

  const payload = {
    source: `GitHub Actions coverage artifacts on ${BRANCH}`,
    repository: REPOSITORY,
    points
  };

  await mkdir(join(projectRoot, 'data'), { recursive: true });
  await writeFile(dataPath, JSON.stringify(payload, null, 2), 'utf8');

  const counts = points.reduce((summary, point) => {
    summary[point.app] = (summary[point.app] ?? 0) + 1;
    return summary;
  }, {});

  console.log(
    `Cobertura en ${BRANCH}: Backend ${counts.Backend ?? 0}, Mobile ${counts.Mobile ?? 0}, Web ${counts.Web ?? 0}.`
  );

  return points;
}
