import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readFileSize } from './fileSize';

describe('readFileSize', () => {
  it('returns the size of a saved file, with or without the file scheme', async () => {
    const directory = join(tmpdir(), `solventa-size-${process.pid}-${process.env.JEST_WORKER_ID ?? '0'}`);
    mkdirSync(directory, { recursive: true });
    const path = join(directory, 'foto.jpg');
    writeFileSync(path, Buffer.alloc(1536));

    await expect(readFileSize(path)).resolves.toBe(1536);
    await expect(readFileSize(`file://${path}`)).resolves.toBe(1536);
  });
});
