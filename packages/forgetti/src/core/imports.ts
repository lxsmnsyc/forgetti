import type { ImportRegistration } from './presets';

export const RUNTIME_EQUALS: ImportRegistration = {
  name: '$$equals',
  source: 'forgetti/runtime',
  kind: 'named',
};

export const RUNTIME_CACHE: ImportRegistration = {
  name: '$$cache',
  source: 'forgetti/runtime',
  kind: 'named',
};
