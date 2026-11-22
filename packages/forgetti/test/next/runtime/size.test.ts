import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'tsdown';
import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME = path.resolve(HERE, '../../../runtime/next.ts');

// The brief's budget for the minified runtime, in bytes.
const BUDGET = 400;

describe('runtime size', () => {
  it('minifies to fewer bytes than the budget', async () => {
    const outDir = mkdtempSync(path.join(tmpdir(), 'forgetti-runtime-'));
    try {
      await build({
        config: false,
        entry: { next: RUNTIME },
        outDir,
        format: 'esm',
        platform: 'neutral',
        target: 'es2018',
        minify: true,
        dts: false,
        clean: false,
        logLevel: 'silent',
      });
      const code = readFileSync(path.join(outDir, 'next.js'), 'utf8').trim();
      const bytes = Buffer.byteLength(code);
      const gzip = gzipSync(code).length;
      // vitest hides console output of passing tests, so the size goes to stderr.
      process.stderr.write(`runtime minified: ${bytes} bytes, ${gzip} bytes gzipped\n${code}\n`);
      expect(bytes).toBeGreaterThan(0);
      expect(bytes).toBeLessThan(BUDGET);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
