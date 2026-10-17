import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const DocumentDir = join(tmpdir(), `solventa-report-tests-${process.pid}-${process.env.JEST_WORKER_ID ?? '0'}`);

type Encoding = 'utf8' | 'base64';

function exists(path: string): Promise<boolean> {
  return Promise.resolve(existsSync(path));
}

function mkdir(path: string): Promise<void> {
  mkdirSync(path, { recursive: true });
  return Promise.resolve();
}

function writeFile(path: string, contents: string, encoding: Encoding = 'utf8'): Promise<void> {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, encoding);
  return Promise.resolve();
}

function readFile(path: string, encoding: Encoding): Promise<string> {
  return Promise.resolve(readFileSync(path).toString(encoding));
}

function unlink(path: string): Promise<void> {
  rmSync(path, { recursive: true, force: true });
  return Promise.resolve();
}

function cp(source: string, destination: string): Promise<boolean> {
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  return Promise.resolve(true);
}

function mv(source: string, destination: string): Promise<boolean> {
  renameSync(source, destination);
  return Promise.resolve(true);
}

const ReactNativeBlobUtil = {
  fs: {
    dirs: { DocumentDir },
    exists,
    mkdir,
    writeFile,
    readFile,
    unlink,
    cp,
    mv,
  },
};

export default ReactNativeBlobUtil;
