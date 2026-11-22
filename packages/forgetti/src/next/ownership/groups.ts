import type { Binding, Group, Range, Scope } from '../ir';
import type { Control, Created, Escape, Facts, MutationSite, Site } from './walk';

export interface GroupContext {
  bindings: Binding[];
  scopes: Scope[];
  unitScope: number;
  locals: Set<number>;
  facts: Facts;
}

/** A closure that escapes while its group still changes. */
export interface EscapeViolation {
  range: Range;
  binding: number;
}

export interface GroupResult {
  groups: Group[];
  opaque: number[];
  violation?: EscapeViolation;
}

interface Draft {
  members: Set<number>;
  created: Created[];
  sites: Site[];
  mutations: MutationSite[];
}

interface Planned {
  group: Group;
  hasClosure: boolean;
  /** End of the last mutation, extended to the loops that repeat it, or -1. */
  mutationEnd: number;
  controls: Control[];
  regions: Range[];
}

interface ReferenceSite {
  binding: number;
  range: Range;
}

class UnionFind {
  private readonly parent = new Map<number, number>();

  add(id: number): void {
    if (!this.parent.has(id)) {
      this.parent.set(id, id);
    }
  }

  find(id: number): number {
    let root = id;
    let next = this.parent.get(root);
    while (next !== undefined && next !== root) {
      root = next;
      next = this.parent.get(root);
    }
    // Path compression keeps later lookups short.
    let current = id;
    while (current !== root) {
      const step = this.parent.get(current) ?? root;
      this.parent.set(current, root);
      current = step;
    }
    return root;
  }

  union(a: number, b: number): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) {
      this.parent.set(Math.max(rootA, rootB), Math.min(rootA, rootB));
    }
  }
}

function isInside(inner: Range, outer: Range): boolean {
  return inner.start >= outer.start && inner.end <= outer.end;
}

function compareRanges(a: Range, b: Range): number {
  return a.start - b.start || a.end - b.end;
}

function dedupeRanges<T extends { range: Range }>(items: T[]): T[] {
  const sorted = [...items].sort((a, b) => compareRanges(a.range, b.range));
  const result: T[] = [];
  for (const item of sorted) {
    const last = result.at(-1);
    if (last && last.range.start === item.range.start && last.range.end === item.range.end) {
      continue;
    }
    result.push(item);
  }
  return result;
}

/** Builds the alias groups of one unit from the walk's facts. */
export class GroupBuilder {
  private readonly union = new UnionFind();

  private readonly unitScopes: Scope[] = [];

  private readonly references: ReferenceSite[] = [];

  /** The planned group of each fresh binding. */
  private readonly groupOf = new Map<number, Planned>();

  constructor(private readonly context: GroupContext) {
    for (const scope of context.scopes) {
      if (this.isInsideScope(scope.id, context.unitScope)) {
        this.unitScopes.push(scope);
      }
    }
    for (const binding of context.bindings) {
      for (const reference of binding.references) {
        this.references.push({ binding: binding.id, range: reference.range });
      }
    }
    this.references.sort((a, b) => compareRanges(a.range, b.range));
  }

  build(): GroupResult {
    const planned = this.planGroups();
    const groups: Group[] = [];
    for (const item of planned) {
      groups.push(item.group);
    }
    this.assignInputs(planned);
    return {
      groups,
      opaque: this.listOpaque(),
      violation: this.findViolation(),
    };
  }

  private isInsideScope(id: number, ancestor: number): boolean {
    for (
      let current: number | null = id;
      current !== null;
      current = this.context.scopes[current].parent
    ) {
      if (current === ancestor) {
        return true;
      }
    }
    return false;
  }

  /** The innermost scope of the unit that holds `range`. Later scopes win ties, as they nest. */
  private findScope(range: Range): number {
    let best = this.context.unitScope;
    let size = Number.POSITIVE_INFINITY;
    for (const scope of this.unitScopes) {
      const length = scope.range.end - scope.range.start;
      if (isInside(range, scope.range) && length <= size) {
        best = scope.id;
        size = length;
      }
    }
    return best;
  }

  private planGroups(): Planned[] {
    const { facts } = this.context;

    // Every fresh binding is a node. Stores, captures and unknown calls join them.
    for (const id of facts.fresh) {
      this.union.add(id);
    }
    for (const [a, b] of facts.unions) {
      this.union.add(a);
      this.union.add(b);
      this.union.union(a, b);
    }

    // Collect each class's members, literals, stores and mutations.
    const drafts = new Map<number, Draft>();
    for (const id of facts.fresh) {
      this.getDraft(drafts, id).members.add(id);
    }
    for (const site of facts.sites) {
      const draft = this.getDraft(drafts, site.binding);
      draft.sites.push(site);
      draft.created.push(...site.created);
    }
    for (const mutation of facts.mutations) {
      this.getDraft(drafts, mutation.binding).mutations.push(mutation);
    }

    // A class with no literal holds only aliases of call results, so it is not a group.
    const ordered: Draft[] = [];
    for (const draft of drafts.values()) {
      if (draft.created.length > 0) {
        draft.created = dedupeRanges(draft.created);
        ordered.push(draft);
      }
    }
    ordered.sort((a, b) => compareRanges(a.created[0].range, b.created[0].range));

    const planned: Planned[] = [];
    for (const [index, draft] of ordered.entries()) {
      const item = this.planGroup(index, draft);
      planned.push(item);
      for (const member of draft.members) {
        this.groupOf.set(member, item);
      }
    }
    return planned;
  }

  private getDraft(drafts: Map<number, Draft>, id: number): Draft {
    const root = this.union.find(id);
    let draft = drafts.get(root);
    if (!draft) {
      draft = { members: new Set(), created: [], sites: [], mutations: [] };
      drafts.set(root, draft);
    }
    return draft;
  }

  private planGroup(id: number, draft: Draft): Planned {
    const created: Range[] = [];
    let hasClosure = false;
    for (const item of draft.created) {
      created.push(item.range);
      hasClosure ||= item.closure;
    }

    // Each mutation runs in its scope. A loop that holds it, and not the whole group, repeats it.
    const mutations: Group['mutations'] = [];
    let mutationEnd = -1;
    const controls: Control[] = [];
    const regions: Range[] = [];
    for (const mutation of dedupeRanges(draft.mutations)) {
      const scope = this.findScope(mutation.range);
      mutations.push({ range: mutation.range, scope });
      mutationEnd = Math.max(mutationEnd, this.extendThroughLoops(mutation.range, scope, created));
      controls.push(...mutation.controls);
      regions.push(mutation.range);
    }

    // With no mutation the group is frozen once its last value is stored.
    let frozenAt = mutationEnd;
    for (const site of draft.sites) {
      controls.push(...site.controls);
      regions.push(site.range);
      if (mutationEnd < 0) {
        frozenAt = Math.max(frozenAt, site.range.end);
      }
    }
    for (const range of created) {
      regions.push(range);
      if (mutationEnd < 0) {
        frozenAt = Math.max(frozenAt, range.end);
      }
    }

    const members = [...draft.members].sort((a, b) => a - b);
    return {
      group: { id, members, created, mutations, frozenAt, inputs: [] },
      hasClosure,
      mutationEnd,
      controls,
      regions,
    };
  }

  private extendThroughLoops(range: Range, scope: number, created: Range[]): number {
    let end = range.end;
    for (
      let current: number | null = scope;
      current !== null && current !== this.context.unitScope;
      current = this.context.scopes[current].parent
    ) {
      const { kind, range: loop } = this.context.scopes[current];
      if (kind !== 'loop') {
        continue;
      }
      let holdsGroup = true;
      for (const item of created) {
        if (!isInside(item, loop)) {
          holdsGroup = false;
          break;
        }
      }
      if (!holdsGroup) {
        end = Math.max(end, loop.end);
      }
    }
    return end;
  }

  /**
   * Inputs are the non-fresh bindings the group's stores, mutations and their conditions read.
   * Locals computed inside the group's span, and call-free consts, are traced to what they
   * read. A read of another group's member adds that group's inputs.
   */
  private assignInputs(planned: Planned[]): void {
    const direct = new Map<Planned, Set<number>>();
    const depends = new Map<Planned, Set<Planned>>();
    for (const item of planned) {
      const inputs = new Set<number>();
      const deps = new Set<Planned>();
      const firstCreated = item.group.created[0];
      const span = { start: firstCreated.start, end: item.group.frozenAt };

      // A condition matters only when it decides more than the whole life of the group.
      const regions = [...item.regions];
      for (const control of item.controls) {
        if (!isInside(firstCreated, control.arm)) {
          regions.push(...control.reads);
        }
      }
      const visited = new Set<number>();
      for (const region of regions) {
        this.collectReads(item, region, span, visited, inputs, deps);
      }
      direct.set(item, inputs);
      depends.set(item, deps);
    }

    // Close over group dependencies, so a frozen group can be keyed alone.
    for (const item of planned) {
      const inputs = new Set<number>();
      const reached = new Set<Planned>([item]);
      const pending = [item];
      for (let next = pending.pop(); next; next = pending.pop()) {
        for (const input of direct.get(next) ?? []) {
          inputs.add(input);
        }
        for (const dep of depends.get(next) ?? []) {
          if (!reached.has(dep)) {
            reached.add(dep);
            pending.push(dep);
          }
        }
      }
      item.group.inputs = [...inputs].sort((a, b) => a - b);
    }
  }

  private collectReads(
    item: Planned,
    region: Range,
    span: Range,
    visited: Set<number>,
    inputs: Set<number>,
    deps: Set<Planned>,
  ): void {
    for (const reference of this.references) {
      if (reference.range.start >= region.end) {
        break;
      }
      if (!isInside(reference.range, region)) {
        continue;
      }
      this.resolveRead(item, reference.binding, region, span, visited, inputs, deps);
    }
  }

  private resolveRead(
    item: Planned,
    id: number,
    region: Range,
    span: Range,
    visited: Set<number>,
    inputs: Set<number>,
    deps: Set<Planned>,
  ): void {
    const binding = this.context.bindings[id];
    const { facts, locals } = this.context;

    // Names declared inside the region, such as closure parameters, are not inputs.
    if (isInside(binding.declaration, region) || binding.scope === 0) {
      return;
    }
    const owner = this.groupOf.get(id);
    if (owner === item) {
      return;
    }
    if (owner) {
      deps.add(owner);
      return;
    }

    // Parameters, outer names, hook results and opaque locals are compared as they are.
    const isRoot = !locals.has(id) || facts.hookResults.has(id) || facts.opaque.has(id);
    const inSpan = binding.declaration.start >= span.start && binding.declaration.end <= span.end;
    if (isRoot || !(inSpan || facts.traceable.has(id))) {
      inputs.add(id);
      return;
    }
    if (visited.has(id)) {
      return;
    }
    visited.add(id);
    for (const source of facts.sources.get(id) ?? []) {
      for (const reference of this.references) {
        if (reference.range.start >= source.end) {
          break;
        }
        if (reference.binding !== id && isInside(reference.range, source)) {
          this.resolveRead(item, reference.binding, source, span, visited, inputs, deps);
        }
      }
    }
  }

  /** Opaque locals, plus the locals they alias, minus fresh ones. */
  private listOpaque(): number[] {
    const { facts } = this.context;
    const result = new Set<number>();
    for (const id of facts.opaque) {
      for (
        let current: number | undefined = id;
        current !== undefined;
        current = facts.aliasOf.get(current)
      ) {
        if (result.has(current) || facts.fresh.has(current)) {
          break;
        }
        result.add(current);
      }
    }
    return [...result].sort((a, b) => a - b);
  }

  /**
   * The first escape to end (the innermost one) of a mutating closure, or of a group with a closure that still has a
   * mutation after the escape.
   */
  private findViolation(): EscapeViolation | undefined {
    let first: EscapeViolation | undefined;
    for (const escape of this.context.facts.escapes) {
      const binding = this.findEscapingBinding(escape);
      if (binding !== undefined && (!first || escape.range.end < first.range.end)) {
        first = { range: escape.range, binding };
      }
    }
    return first;
  }

  private findEscapingBinding(escape: Escape): number | undefined {
    // A closure that changes a group may run after render and change a cached value.
    if (escape.mutating) {
      return escape.bindings[0];
    }
    for (const id of escape.bindings) {
      const item = this.groupOf.get(id);
      if (item?.hasClosure && item.mutationEnd > escape.range.end) {
        return id;
      }
    }
    return undefined;
  }
}
