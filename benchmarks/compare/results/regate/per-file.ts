// Turns the `INFO file` lines of a gate output into a Markdown table, one row per file.
// Usage: node benchmarks/compare/results/regate/per-file.ts <checks.txt> <out.md>
import fs from 'node:fs';

const FILE_LINE = /^INFO file (\S+): (.*)$/;

function readPart(detail: string, prefix: string): string {
  for (const part of detail.split('; ')) {
    if (part.startsWith(prefix)) {
      return part.slice(prefix.length);
    }
  }
  return '';
}

function readField(part: string, name: string): string {
  // Fields are `name value` pairs split by commas, and a value may hold a note in parentheses.
  for (const field of part.split(', ')) {
    if (field.startsWith(`${name} `)) {
      return field.slice(name.length + 1);
    }
  }
  return '-';
}

function getNumber(value: string): number {
  return Number.parseInt(value, 10);
}

function main(): number {
  const [input, output] = process.argv.slice(2);
  if (input === undefined || output === undefined) {
    console.error('Usage: node per-file.ts <checks.txt> <out.md>');
    return 2;
  }

  // Header: React work, Preact work, React gzip, compiled share, and the result of the work rules.
  const rows: string[] = [
    '| file | next R | RC adj. R | plain R | f0.8 R | next P | plain P | f0.8 P | gzip next | gzip RC | ratio | compiled next | compiled RC | work rules |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];

  // One row per file line, in gate order.
  for (const line of fs.readFileSync(input, 'utf8').split('\n')) {
    const match = FILE_LINE.exec(line);
    if (match === null) {
      continue;
    }
    const [, file = '', detail = ''] = match;
    const react = readPart(detail, 'react ');
    const preact = readPart(detail, 'preact ');
    const gzip = readPart(detail, 'gzip ');
    const compiled = readPart(detail, 'compiled ');

    const nextReact = readField(react, 'next');
    const rc = readField(react, 'react-compiler');
    const nextPreact = readField(preact, 'next');
    const plainPreact = readField(preact, 'plain');
    const misses: string[] = [];
    if (rc !== '-' && getNumber(nextReact) > getNumber(rc)) {
      misses.push('above RC');
    }
    if (preact !== '' && getNumber(nextPreact) > getNumber(plainPreact)) {
      misses.push('above plain P');
    }

    rows.push(
      `| ${file} | ${nextReact} | ${rc} | ${readField(react, 'plain')} | ${readField(react, 'forgetti-0.8')} | ${preact === '' ? '-' : nextPreact} | ${preact === '' ? '-' : plainPreact} | ${preact === '' ? '-' : readField(preact, 'forgetti-0.8')} | ${readField(gzip, 'next')} | ${readField(gzip, 'react-compiler')} | ${readField(gzip, 'ratio')} | ${readField(compiled, 'next')} | ${readField(compiled, 'react-compiler')} | ${misses.length === 0 ? 'pass' : `**${misses.join(', ')}**`} |`,
    );
  }

  fs.writeFileSync(output, `${rows.join('\n')}\n`);
  return 0;
}

process.exitCode = main();
