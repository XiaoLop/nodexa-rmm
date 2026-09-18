import { spawn } from 'node:child_process';

const meshCentralEntry = require.resolve('meshcentral/meshcentral.js');
const child = spawn(process.execPath, [meshCentralEntry, ...process.argv.slice(2)], {
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
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});