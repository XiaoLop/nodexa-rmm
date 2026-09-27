import { cp, mkdir, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(packageRoot, 'src');
const pluginsRoot = path.resolve(
  packageRoot,
  '../../apps/meshcentral/runtime/data/plugins',
);

const entries = await readdir(sourceRoot, { withFileTypes: true });
const pluginNames = entries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

await mkdir(pluginsRoot, { recursive: true });

for (const pluginName of pluginNames) {
  const sourceDirectory = path.join(sourceRoot, pluginName);
  const entryFile = path.join(sourceDirectory, 'index.ts');
  const configFile = path.join(sourceDirectory, 'config.json');
  const outputDirectory = path.join(pluginsRoot, pluginName);
  const temporaryDirectory = `${outputDirectory}.tmp`;

  await rm(temporaryDirectory, { recursive: true, force: true });
  await mkdir(temporaryDirectory, { recursive: true });

  await build({
    entryPoints: [entryFile],
    outfile: path.join(temporaryDirectory, `${pluginName}.js`),
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node22',
    sourcemap: true,
    logLevel: 'info',
  });

  await cp(configFile, path.join(temporaryDirectory, 'config.json'));
  await rm(outputDirectory, { recursive: true, force: true });
  await rename(temporaryDirectory, outputDirectory);

  console.log(`Built MeshCentral plugin: ${pluginName}`);
}