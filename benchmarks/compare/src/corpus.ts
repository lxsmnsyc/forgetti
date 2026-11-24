import fs from 'node:fs';
import path from 'node:path';
import { CORPUS_DIR } from './loader.ts';
import {
  getOutputName,
  MODULE_FILE,
  type CaseMeta,
  type CorpusCase,
  type SiblingModule,
} from './types.ts';

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

    cases.push(readCase(set, name, dir));
  }
  return cases;
}

/** Reads one case folder: the input, its sibling modules and `meta.json`. */
export function readCase(set: string, name: string, dir: string): CorpusCase {
  // The input is `input.jsx` or `input.tsx`.
  let inputFile = path.join(dir, 'input.jsx');
  if (!fs.existsSync(inputFile)) {
    inputFile = path.join(dir, 'input.tsx');
  }
  if (!fs.existsSync(inputFile)) {
    throw new Error(`Case ${set}/${name} has no input.jsx or input.tsx`);
  }
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')) as CaseMeta;
  return {
    set,
    name,
    dir,
    inputFile,
    source: fs.readFileSync(inputFile, 'utf8'),
    siblings: readSiblings(dir),
    meta,
  };
}

// Files of a case folder that are not sibling modules.
const RESERVED = new Set(['input.jsx', 'input.tsx', 'scenarios.js', 'counter.js']);

/**
 * Reads the modules next to the input: every `.jsx`, `.tsx`, `.js` or `.ts` file in the
 * case folder except the input, `scenarios.js` and `counter.js`. Folders are not read.
 * Two files that differ only by extension are an error, because both compile to `<name>.js`.
 * So is a sibling that would be written over the harness's `input.js` or `counter.js`.
 */
export function readSiblings(dir: string): SiblingModule[] {
  const siblings: SiblingModule[] = [];
  const outputs = new Set<string>(['input.js', 'counter.js']);
  for (const file of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, file);
    if (RESERVED.has(file) || !MODULE_FILE.test(file) || !fs.statSync(full).isFile()) {
      continue;
    }
    const output = getOutputName(file);
    if (outputs.has(output)) {
      throw new Error(`${dir}: two modules compile to ${output}`);
    }
    outputs.add(output);
    siblings.push({ file, path: full, source: fs.readFileSync(full, 'utf8') });
  }
  return siblings;
}
