import fs from 'node:fs';
import path from 'node:path';
import { CORPUS_DIR } from './loader.ts';
import type { CaseMeta, CorpusCase } from './types.ts';

/** Reads the cases of one set, sorted by name. `heldout` is only read when asked for. */
export function readSet(set: string): CorpusCase[] {
  const setDir = path.join(CORPUS_DIR, set);
  if (!fs.existsSync(setDir)) {
    throw new Error(`Unknown corpus set "${set}" (no folder ${setDir})`);
  }

  const cases: CorpusCase[] = [];
  const names = fs.readdirSync(setDir).sort();
  for (const name of names) {
    const dir = path.join(setDir, name);
    if (!fs.statSync(dir).isDirectory()) {
      continue;
    }

    // The input is `input.jsx` or `input.tsx`.
    let inputFile = path.join(dir, 'input.jsx');
    if (!fs.existsSync(inputFile)) {
      inputFile = path.join(dir, 'input.tsx');
    }
    if (!fs.existsSync(inputFile)) {
      throw new Error(`Case ${set}/${name} has no input.jsx or input.tsx`);
    }
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')) as CaseMeta;
    cases.push({ set, name, dir, inputFile, source: fs.readFileSync(inputFile, 'utf8'), meta });
  }
  return cases;
}
