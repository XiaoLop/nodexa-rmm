import { spawn } from 'node:child_process';
import { prepareConfig } from './config';
import './config.default.json';

let prepared: ReturnType<typeof prepareConfig>;
try {
  prepared = prepareConfig(
    process.argv.slice(2).filter((argument) => argument !== '--'),
    require.resolve('./config.default.json'),
  );
} catch {
  console.error(
    'Unable to prepare MeshCentral configuration. Check configuration arguments, YAML structure and file access.',
  );
  process.exit(1);
}
process.once('exit', prepared.cleanup);
const meshCentralEntry = require.resolve('meshcentral/meshcentral.js');
const child = spawn(process.execPath, [meshCentralEntry, ...prepared.args], {
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => child.kill(signal));
}

child.once('error', (error) => {
  console.error(`Unable to start MeshCentral: ${error.message}`);
  process.exitCode = 1;
});

child.once('exit', (code, signal) => {
  prepared.cleanup();
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
