import * as babel from '@babel/core';
import type { CorpusCase } from '../src/types.ts';
import { applyEdits, findComponentAt, parseFile } from './ast.ts';
import { GLOBAL_READ } from './helpers.ts';
import type { ComponentInfo, Mutant, MutantSpec, Operator, SourceFile } from './types.ts';

// Names the operators insert. A corpus file that already uses one would clash.
const RESERVED = /__mut|\bMutant[A-Z]/;

export interface Generated {
  mutants: Mutant[];
  /** Candidates past the cap, per `<operator>/<variant>`. */
  capped: Map<string, number>;
  /** Specs that could not be built, such as a `memo` name bound to something else. */
  dropped: { operator: string; variant: string; site: string; reason: string }[];
}

/** The import line a spec needs from `react`, or an error when a name is taken. */
function getReactImport(file: SourceFile, spec: MutantSpec): { line: string } | { error: string } {
  const missing: string[] = [];
  for (const name of spec.react ?? []) {
    if (file.reactImports.get(name) === name) {
      continue;
    }
    if (file.topLevel.has(name)) {
      return { error: `"${name}" is bound to something other than react's ${name}` };
    }
    missing.push(name);
  }
  return { line: missing.length > 0 ? `import { ${missing.join(', ')} } from 'react';\n` : '' };
}

/** Applies a spec to the source: the edits, a `react` import on top and the helpers at the end. */
function buildSource(file: SourceFile, spec: MutantSpec, importLine: string): string {
  let source = importLine + applyEdits(file.code, spec.edits);
  const helpers = new Set(spec.helpers ?? []);
  if (helpers.size > 0) {
    source += `\n// Mutant helpers.\n${[...helpers].join('\n')}\n`;
  }
  return source;
}

// Marks what each `memo` body rendered, and when. Every memo body wraps its output in
// `<mut-memo data-s={step}>`, where `step` is the harness step it rendered in. When React
// skips the body, its old output, stamp included, stays. `run.ts` allows a difference
// inside a mark only when the compiled stamp is older than the current step: the
// boundary really skipped. Staleness under a `memo` body that did render still fails.
const MEMO_OPEN = `<mut-memo data-s={${GLOBAL_READ}}>{`;
const MEMO_CLOSE = '}</mut-memo>';

/** The component whose render holds the hazard: the spec's, else the one around its first edit. */
function findHazardComponent(file: SourceFile, spec: MutantSpec): ComponentInfo | null {
  for (const component of file.components) {
    if (component.name === spec.component) {
      return component;
    }
  }
  for (const edit of spec.edits) {
    const found = findComponentAt(file, edit.start);
    if (found !== null) {
      return found;
    }
  }
  return null;
}

/**
 * Adds the `memo` marks to a spec whose hazard component may render behind `memo`.
 * Returns the spec unchanged, with a null reason, when it may not.
 */
function addMemoMarks(
  file: SourceFile,
  spec: MutantSpec,
): { spec: MutantSpec; reason: string | null } {
  const reasons: string[] = [];
  if (spec.memoChild === true) {
    reasons.push('the hazard is in a memo child');
  }
  const hazard = findHazardComponent(file, spec);
  if (hazard === null || !file.behindMemo.has(hazard.name)) {
    return { spec, reason: reasons.length > 0 ? reasons.join('; ') : null };
  }
  reasons.push(`${hazard.name} may render behind memo`);

  // Every memo body stamps its output with the step it rendered in.
  const edits = [...spec.edits];
  for (const component of file.components) {
    if (file.memoBodies.has(component.name)) {
      edits.push(...component.wrapReturns(MEMO_OPEN, MEMO_CLOSE, true));
    }
  }
  return { spec: { ...spec, edits }, reason: reasons.join('; ') };
}

function checkSyntax(source: string, filename: string): string | null {
  try {
    babel.parseSync(source, {
      filename,
      configFile: false,
      babelrc: false,
      parserOpts: { plugins: filename.endsWith('.tsx') ? ['jsx', 'typescript'] : ['jsx'] },
    });
    return null;
  } catch (error) {
    return String(error).slice(0, 200);
  }
}

/**
 * Generates the mutants of a case's input with each operator. Each `<operator>/<variant>`
 * keeps its first `cap` candidates in source order (exported components first), so the
 * set of mutants is the same on every run.
 */
export function generateMutants(
  testCase: CorpusCase,
  operators: Operator[],
  cap: number,
): Generated {
  const id = `${testCase.set}/${testCase.name}`;
  if (RESERVED.test(testCase.source)) {
    throw new Error(`${id}: the input already uses a name that starts with __mut or Mutant`);
  }
  const file = parseFile(id, testCase.source, testCase.inputFile);
  const generated: Generated = { mutants: [], capped: new Map(), dropped: [] };

  for (const operator of operators) {
    const counts = new Map<string, number>();
    for (const original of operator.generate(file)) {
      const key = `${operator.name}/${original.variant}`;
      const { spec, reason } = addMemoMarks(file, original);

      // A spec that needs a react name bound to something else is dropped.
      const reactImport = getReactImport(file, spec);
      if ('error' in reactImport) {
        generated.dropped.push({
          operator: operator.name,
          variant: spec.variant,
          site: spec.site,
          reason: reactImport.error,
        });
        continue;
      }

      // Past the cap, a candidate is only counted.
      const index = counts.get(spec.variant) ?? 0;
      if (index >= cap) {
        generated.capped.set(key, (generated.capped.get(key) ?? 0) + 1);
        continue;
      }

      // A mutant that does not parse is an operator bug. It is dropped with the parse error.
      const source = buildSource(file, spec, reactImport.line);
      const syntax = checkSyntax(source, testCase.inputFile);
      if (syntax !== null) {
        generated.dropped.push({
          operator: operator.name,
          variant: spec.variant,
          site: spec.site,
          reason: `syntax: ${syntax}`,
        });
        continue;
      }
      counts.set(spec.variant, index + 1);
      generated.mutants.push({
        operator: operator.name,
        variant: spec.variant,
        site: spec.site,
        index,
        source,
        exempt: reason,
        propsMutation: spec.propsMutation === true,
      });
    }
  }
  return generated;
}
