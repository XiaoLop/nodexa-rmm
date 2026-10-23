import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

await build({
  entryPoints: [path.join(packageRoot, 'src', 'main.ts')],
  outfile: path.join(packageRoot, 'dist', 'main.js'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  logLevel: 'info',
  // Workspace packages ship TypeScript sources and must be bundled. Third-party
  // packages stay external so their optional native bindings keep working.
  external: [
    '@modelcontextprotocol/sdk',
    '@modelcontextprotocol/sdk/*',
    'zod',
    'ws',
    'bufferutil',
    'utf-8-validate',
  ],
});
