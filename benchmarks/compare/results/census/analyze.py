"""Census analysis: lost steps, the static join to refusals, and relax runs.

Usage, from the repo root:
  python3 benchmarks/compare/results/census/analyze.py

Reads refusals.json, steps-baseline.json and relax-*.json in this folder.
Writes lost-steps.tsv, join.tsv, relax.tsv, refusals-by-family.tsv and prints a summary.
"""

import collections
import glob
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
CORPUS = os.path.join(HERE, '..', '..', '..', 'corpus')
SETS = ['base', 'tuning', 'heldout', 'heldout2']
RENDER_KEYS = {'Child', 'Row', 'Btn'}
MOUNT = '(mount)'
# Variant cases stand for the corpus case they change.
VARIANTS = {
    'variant/toaster_default': 'heldout2/toaster_store',
    'variant/discussions_columns': 'heldout2/discussions_table',
}


def load(name):
    """Reads a JSON Lines file of this folder."""
    rows = []
    with open(os.path.join(HERE, name)) as handle:
        for line in handle:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def get_work(counts):
    return sum(counts.values())


def index_steps(rows):
    """(case, target, compiler) -> {step: row}."""
    cells = collections.defaultdict(dict)
    failures = set()
    for row in rows:
        key = (row['case'], row['target'], row['compiler'])
        if 'failure' in row:
            failures.add(key)
            continue
        cells[key][row['step']] = row
    return cells, failures


def find_lost_steps(cells):
    """Update steps where next does the uncompiled work, with RC's adjusted count on React."""
    lost = []
    excess = []
    for (case, target, compiler), steps in sorted(cells.items()):
        if compiler != 'next':
            continue
        plain = cells[(case, target, 'plain')]
        rc = cells.get((case, target, 'react-compiler'), {})
        for name, row in steps.items():
            if name.endswith('/' + MOUNT):
                continue
            expected = plain[name]
            own = get_work(row['counts']) if row['same'] and not row.get('error') else get_work(expected['counts'])
            base = get_work(expected['counts'])
            rc_row = rc.get(name)
            rc_work = None
            if target == 'react' and rc_row is not None:
                rc_work = get_work(rc_row['counts']) if rc_row['same'] else base
            if own == base and base > 0:
                lost.append({
                    'case': case, 'target': target, 'step': name, 'units': own,
                    'counts': row['counts'], 'rc': rc_work,
                })
            if rc_work is not None and own > rc_work:
                excess.append({
                    'case': case, 'target': target, 'step': name, 'units': own - rc_work,
                    'next': own, 'rc': rc_work, 'plain': base, 'counts': row['counts'],
                    'rc_counts': rc_row['counts'] if rc_row else {},
                })
    return lost, excess


# ---------------------------------------------------------------------------
# Static join: counter key -> code that bumps it -> elements or calls that run it.

def read_case_sources(case):
    set_name, name = case.split('/')
    folder = os.path.join(CORPUS, set_name, name)
    sources = {}
    for file in sorted(os.listdir(folder)):
        if file in ('scenarios.js', 'meta.json', 'counter.js') or not re.search(r'\.(jsx|tsx|js|ts)$', file):
            continue
        with open(os.path.join(folder, file)) as handle:
            sources[file] = handle.read()
    return sources


FUNC_PATTERNS = [
    re.compile(r'function\s+([A-Za-z_$][\w$]*)\s*\('),
    re.compile(r'(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\w+\()?(?:\(|function|async|[A-Za-z_$][\w$]*\s*=>)'),
    re.compile(r'^\s*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{', re.M),
]


def find_enclosing_name(source, position):
    """The name of the closest function that starts before `position` (a guess by text)."""
    best = None
    for pattern in FUNC_PATTERNS:
        for match in pattern.finditer(source, 0, position):
            if best is None or match.start() > best[0]:
                best = (match.start(), match.group(1))
    return best[1] if best else None


def find_bumpers(sources, key):
    """Functions that count `key`, as (file, name)."""
    if key in RENDER_KEYS:
        found = [('shared', key)]
    else:
        found = []
    pattern = re.compile(r"bump\(\s*['\"]" + re.escape(key) + r"['\"]")
    for file, source in sources.items():
        for match in pattern.finditer(source):
            name = find_enclosing_name(source, match.start())
            if name:
                found.append((file, name))
    return found


def find_sites(sources, name):
    """Elements `<name` and calls `name(` or `.name(`, as (file, start)."""
    sites = []
    tag = re.compile(r'<' + re.escape(name) + r'[\s/>]')
    call = re.compile(r'(?<![\w$])' + re.escape(name) + r'\s*\(')
    decl = re.compile(r'(?:function\s+|const\s+|let\s+)' + re.escape(name) + r'\b')
    for file, source in sources.items():
        for match in tag.finditer(source):
            sites.append((file, match.start(), 'element'))
        for match in call.finditer(source):
            before = source[max(0, match.start() - 9):match.start()]
            if 'function' in before or decl.match(source, max(0, match.start() - 9)):
                continue
            sites.append((file, match.start(), 'call'))
    return sites


def contains(range_, position):
    return range_['start'] <= position < range_['end']


def classify_family(record):
    """Maps a refusal record to a family name. Identity and purity are split."""
    code = record['code']
    sub = record.get('sub') or ''
    detail = sub.split('|', 1)[1] if '|' in sub else sub
    if code == 'outer_binding_unstable':
        if detail.startswith('identity:wrapper_member_write:') or detail.startswith('identity:wrapper_member_read:'):
            return 'identity:member_write_or_read'
        if detail.startswith('identity:init_call:'):
            return 'identity:call_initialized'
        if detail.startswith('identity:'):
            return 'identity:other'
        if detail.startswith('purity:'):
            if 'hidden_member:current' in detail:
                return 'purity:reads_ref_current'
            return 'purity:reads_global'
        return 'identity:written'
    if code == 'cand_result_not_readonly':
        if detail.startswith('hook:'):
            return 'result:hook_call'
        if ':method:' in detail or detail.startswith('call:method:') or 'method:' in detail.split('|')[0]:
            return 'result:method_on_result'
        return 'result:passed_on'
    if code == 'cand_destructuring':
        return 'destructuring'
    if code == 'cand_result_unsafe':
        return 'result:unsafe'
    if code == 'impure_syntax':
        if 'hook:' in detail:
            return 'impure:hook_in_expression'
        if 'mutator:' in detail:
            return 'impure:mutator_call'
        if 'hidden_member' in detail:
            return 'impure:hidden_member'
        return 'impure:other'
    if code == 'unstable_global_read':
        return 'global_read'
    if code == 'hidden_member_in_closure':
        return 'impure:hidden_member'
    if code in ('local_not_plain_input', 'cached_not_plain'):
        return 'local:' + detail.split(':')[0]
    if code == 'group_not_frozen':
        return 'group_not_frozen'
    if code == 'props_not_readonly':
        return 'props_not_readonly'
    if code.startswith('map_') or code.startswith('loop_'):
        return 'loops:' + code
    if code == 'branch_not_hoistable':
        return 'branches:not_hoistable'
    if code.startswith('unit_'):
        return 'unit_bailout'
    return code


def dedupe(records):
    seen = set()
    out = []
    for record in records:
        key = (record['case'], record['target'], record['file'], record.get('unit'), record['site'].split('.')[0],
               record['code'], record['range']['start'], record['range']['end'], record.get('binding'))
        if key in seen:
            continue
        seen.add(key)
        out.append(record)
    return out


def join_step(step, sources, records, blocks):
    """For each counted key of a lost step: its sites and the innermost refusal that holds each."""
    out = []
    for key, count in sorted(step['counts'].items()):
        if count == 0:
            continue
        bumpers = find_bumpers(sources, key)
        sites = []
        for file, name in bumpers:
            if file == 'shared':
                sites.extend(find_sites(sources, name))
            else:
                sites.extend(find_sites(sources, name))
        joined = []
        for file, start, kind in sites:
            holding = [r for r in records if r['file'] == file and contains(r['range'], start)
                       and r['code'] not in ('block', 'cheap_expression') and not r['code'].startswith('unit_')]
            holding.sort(key=lambda r: r['range']['end'] - r['range']['start'])
            cached = [b for b in blocks if b['file'] == file and contains(b['range'], start)]
            unit_bail = [r for r in records if r['file'] == file and r['code'].startswith('unit_') and contains(r['range'], start)]
            joined.append({'file': file, 'start': start, 'kind': kind, 'refusals': holding[:6],
                           'cached': len(cached) > 0, 'unit_bailout': unit_bail[:1]})
        out.append({'key': key, 'count': count, 'bumpers': bumpers, 'sites': joined})
    return out


def main():
    records = dedupe([r for r in load('refusals.jsonl')])
    rows = load('steps-baseline.jsonl')
    cells, failures = index_steps(rows)
    lost, excess = find_lost_steps(cells)

    # Lost steps per file.
    per_file = collections.defaultdict(lambda: [0, 0])
    for item in lost:
        per_file[(item['case'], item['target'])][0] += item['units']
        per_file[(item['case'], item['target'])][1] += 1
    total = {t: sum(i['units'] for i in lost if i['target'] == t) for t in ('react', 'preact')}
    total_excess = sum(i['units'] for i in excess)
    print('lost units', total, 'lost steps', collections.Counter(i['target'] for i in lost))
    print('excess over RC (react)', total_excess, 'steps', len(excess))

    # Per file: lost steps and units, React Compiler's work on those steps, and the excess.
    exc_by_file = collections.Counter()
    for item in excess:
        exc_by_file[item['case']] += item['units']
    with open(os.path.join(HERE, 'per-file.tsv'), 'w') as handle:
        handle.write('case\tlost_steps_react\tlost_units_react\trc_on_lost\tlost_units_preact\texcess_over_rc\n')
        for case in sorted({i['case'] for i in lost} | set(exc_by_file)):
            react = [i for i in lost if i['case'] == case and i['target'] == 'react']
            preact = [i for i in lost if i['case'] == case and i['target'] == 'preact']
            rc_sum = sum(i['rc'] or 0 for i in react)
            react_units = sum(i['units'] for i in react)
            preact_units = sum(i['units'] for i in preact)
            handle.write(f"{case}\t{len(react)}\t{react_units}\t{rc_sum}\t{preact_units}\t{exc_by_file[case]}\n")

    with open(os.path.join(HERE, 'lost-steps.tsv'), 'w') as handle:
        handle.write('case\ttarget\tstep\tunits\trc\tcounts\n')
        for item in lost:
            counts = ','.join(f'{k}={v}' for k, v in sorted(item['counts'].items()) if v)
            handle.write(f"{item['case']}\t{item['target']}\t{item['step']}\t{item['units']}\t{item['rc']}\t{counts}\n")
    with open(os.path.join(HERE, 'excess-steps.tsv'), 'w') as handle:
        handle.write('case\tstep\texcess\tnext\trc\tplain\tnext_counts\trc_counts\n')
        for item in excess:
            counts = ','.join(f'{k}={v}' for k, v in sorted(item['counts'].items()) if v)
            rc_counts = ','.join(f'{k}={v}' for k, v in sorted(item['rc_counts'].items()) if v)
            handle.write(f"{item['case']}\t{item['step']}\t{item['units']}\t{item['next']}\t{item['rc']}\t{item['plain']}\t{counts}\t{rc_counts}\n")

    # Static join, per case and counter key, on React (Preact compiles the same code).
    by_case = collections.defaultdict(list)
    for r in records:
        if r['target'] == 'react':
            by_case[r['case']].append(r)
    key_units = collections.defaultdict(lambda: collections.Counter())
    for item in lost:
        key_units[(item['case'], item['target'])].update(item['counts'])
    lines = ['case\ttarget\tkey\tlost_units\tsite\tkind\tcached\tinnermost_refusals']
    family_units = collections.Counter()
    for (case, target), counter in sorted(key_units.items()):
        sources = read_case_sources(case)
        recs = [r for r in by_case[case] if r['code'] != 'block']
        blocks = [r for r in by_case[case] if r['code'] == 'block']
        step = {'counts': dict(counter)}
        for entry in join_step(step, sources, recs, blocks):
            if not entry['sites']:
                lines.append(f"{case}\t{target}\t{entry['key']}\t{entry['count']}\t-\t-\t-\tno site found")
            for site in entry['sites']:
                source = sources[site['file']]
                line_no = source.count('\n', 0, site['start']) + 1
                refs = ' ; '.join(
                    f"{r['code']}[{r.get('sub') or ''}]{'(' + r['binding'] + ')' if r.get('binding') else ''}@L{source.count(chr(10), 0, r['range']['start']) + 1}"
                    for r in site['refusals'][:3])
                if site['unit_bailout']:
                    refs = f"UNIT {site['unit_bailout'][0]['code']}[{site['unit_bailout'][0].get('sub')}] ; " + refs
                lines.append(f"{case}\t{target}\t{entry['key']}\t{entry['count']}\t{site['file']}:L{line_no}\t{site['kind']}\t{site['cached']}\t{refs}")
    with open(os.path.join(HERE, 'join.tsv'), 'w') as handle:
        handle.write('\n'.join(lines) + '\n')

    # Refusal sites by family, React compiles, de-duplicated.
    fam = collections.Counter()
    fam_files = collections.defaultdict(set)
    for r in records:
        if r['target'] != 'react' or r['code'] in ('block',):
            continue
        f = classify_family(r)
        fam[f] += 1
        fam_files[f].add(r['case'])
    with open(os.path.join(HERE, 'refusals-by-family.tsv'), 'w') as handle:
        handle.write('family\tsites\tfiles\n')
        for f, n in fam.most_common():
            handle.write(f"{f}\t{n}\t{' '.join(sorted(fam_files[f]))}\n")

    # Relax and variant runs: units saved on lost steps and on RC excess, and differences.
    out = ['run\tkeys\tlost_saved_react\tlost_saved_preact\tsteps_saved_react\tsteps_saved_preact\texcess_saved\tdiff_steps_react\tdiff_steps_preact\tlost_saved_react_by_file\texcess_saved_by_file']
    paths = sorted(glob.glob(os.path.join(HERE, 'relax-*.jsonl'))) + sorted(glob.glob(os.path.join(HERE, 'variant-*.jsonl')))
    for path in paths:
        name = os.path.basename(path)[:-6]
        keys_path = path[:-6] + '.keys'
        keys = open(keys_path).read().strip() if os.path.exists(keys_path) else '?'
        rows_ = load(os.path.basename(path))
        for row in rows_:
            row['case'] = VARIANTS.get(row['case'], row['case'])
        rcells, rfail = index_steps(rows_)
        saved = {'react': 0, 'preact': 0}
        steps_saved = {'react': 0, 'preact': 0}
        diffs = {'react': 0, 'preact': 0}
        files = collections.Counter()
        exc_files = collections.Counter()
        for item in lost:
            row = rcells.get((item['case'], item['target'], 'next'), {}).get(item['step'])
            if row is None or not row['same']:
                continue
            gain = item['units'] - get_work(row['counts'])
            if gain > 0:
                saved[item['target']] += gain
                steps_saved[item['target']] += 1
                if item['target'] == 'react':
                    files[item['case']] += gain
        exc_saved = 0
        for item in excess:
            row = rcells.get((item['case'], 'react', 'next'), {}).get(item['step'])
            if row is None or not row['same']:
                continue
            gain = min(item['units'], max(0, item['next'] - get_work(row['counts'])))
            exc_saved += gain
            if gain:
                exc_files[item['case']] += gain
        for (case, target, compiler), steps in rcells.items():
            if compiler != 'next':
                continue
            for row in steps.values():
                if not row['same']:
                    diffs[target] += 1
        top = ' '.join(f'{c}:{n}' for c, n in files.most_common())
        top_exc = ' '.join(f'{c}:{n}' for c, n in exc_files.most_common())
        out.append(f"{name}\t{keys}\t{saved['react']}\t{saved['preact']}\t{steps_saved['react']}\t{steps_saved['preact']}\t{exc_saved}\t{diffs['react']}\t{diffs['preact']}\t{top}\t{top_exc}")
    with open(os.path.join(HERE, 'relax.tsv'), 'w') as handle:
        handle.write('\n'.join(out) + '\n')
    print('\n'.join(out))

if __name__ == '__main__':
    main()
