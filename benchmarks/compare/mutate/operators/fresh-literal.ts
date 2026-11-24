import { getLine, insert, walk } from '../ast.ts';
import { GLOBAL_READ } from '../helpers.ts';
import type { Edit, MutantSpec, Node, Operator, SourceFile } from '../types.ts';

const LITERALS = new Set(['ObjectExpression', 'ArrayExpression']);

/** Adds a changing global entry to an object or array literal. */
function addEntry(file: SourceFile, literal: Node, key: string): Edit {
  if (literal.type === 'ObjectExpression') {
    return insert(literal.start + 1, ` ${key}: ${GLOBAL_READ}, `);
  }
  const elements = literal.elements as (Node | null)[];
  const before = file.code.slice(literal.start + 1, literal.end - 1).trimEnd();
  const separator = elements.length === 0 || before.endsWith(',') ? '' : ', ';
  return insert(literal.end - 1, `${separator}${GLOBAL_READ}`);
}

// Adds an entry that reads a changing global to an object or array literal nested in a
// JSX attribute, a JSX child or a call argument. A planner that gives such a literal
// its own block and keys it on the wrong inputs keeps the old value. In a `style`
// object the entry is a CSS custom property, so it shows in the HTML.
export const freshLiteral: Operator = {
  name: 'fresh-literal',
  hazard: 'a nested fresh literal that reads a changing value',
  generate(file) {
    const mutants: MutantSpec[] = [];
    for (const component of file.components) {
      walk(
        component.body,
        (node, parent) => {
          // A literal in `attr={...}` or `{...}` as a JSX child.
          if (
            node.type === 'JSXExpressionContainer' &&
            LITERALS.has((node.expression as Node).type)
          ) {
            const literal = node.expression as Node;
            const isAttribute = parent?.type === 'JSXAttribute';
            const isStyle = isAttribute && (parent.name as Node).name === 'style';
            mutants.push({
              variant: isAttribute ? 'attribute' : 'child',
              site: `${component.name}:${getLine(file.code, literal.start)}`,
              edits: [addEntry(file, literal, isStyle ? "'--mut'" : '__mut')],
            });
          }
          // A literal passed straight to a call. A hook's dependency list is skipped: a
          // changing entry there makes an effect that sets state loop forever.
          if (node.type === 'CallExpression') {
            const callee = node.callee as Node;
            const isHook = callee.type === 'Identifier' && /^use[A-Z]/.test(callee.name as string);
            for (const [index, argument] of (node.arguments as Node[]).entries()) {
              if (LITERALS.has(argument.type) && !(isHook && index > 0)) {
                mutants.push({
                  variant: 'argument',
                  site: `${component.name}:${getLine(file.code, argument.start)}`,
                  edits: [addEntry(file, argument, '__mut')],
                });
              }
            }
          }
        },
        false,
      );
    }
    return mutants;
  },
};
