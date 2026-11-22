import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';

export const COMPARE_DIR = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
export const REPO_DIR = path.resolve(COMPARE_DIR, '../..');
export const CORPUS_DIR = path.join(REPO_DIR, 'benchmarks/corpus');
export const OUT_DIR = path.join(COMPARE_DIR, '.out');

const NEXT_ENTRY = path.join(REPO_DIR, 'packages/forgetti/src/next/index.ts');
const NEXT_RUNTIME = path.join(REPO_DIR, 'packages/forgetti/runtime/next.ts');

export interface Loader {
  load(file: string): Promise<Record<string, unknown>>;
  close(): Promise<void>;
}

/**
 * Loads TypeScript and compiled modules through Vite, so the new compiler and its
 * runtime run from source. Any import of `forgetti` or `forgetti/...` from compiled
 * output resolves to the new runtime. The 0.8 output is rewritten before it is
 * written to disk and never reaches this hook.
 */
export async function createLoader(): Promise<Loader> {
  const server: ViteDevServer = await createServer({
    root: COMPARE_DIR,
    configFile: false,
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [
      {
        name: 'compare-next-runtime',
        enforce: 'pre',
        resolveId(id) {
          if (id === 'forgetti' || id.startsWith('forgetti/')) {
            return NEXT_RUNTIME;
          }
          return null;
        },
      },
    ],
  });
  return {
    load: (file) => server.ssrLoadModule(file),
    close: () => server.close(),
  };
}

export async function loadNextCompile(
  loader: Loader,
): Promise<(code: string, options: { preset: 'react' | 'preact'; filename: string }) => unknown> {
  const mod = await loader.load(NEXT_ENTRY);
  return mod.compile as never;
}
