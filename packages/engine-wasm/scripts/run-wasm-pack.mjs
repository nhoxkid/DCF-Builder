import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const env = { ...process.env };
const nodeDir = path.dirname(process.execPath);
if (nodeDir) {
  env.PATH = `${nodeDir}${path.delimiter}${env.PATH ?? ''}`;
}

function resolveCargoBin() {
  if (env.CARGO && existsSync(env.CARGO)) {
    return env.CARGO;
  }

  const candidateHomes = [];
  if (env.CARGO_HOME) {
    candidateHomes.push(env.CARGO_HOME);
  }
  candidateHomes.push(path.join(homedir(), '.cargo'));

  for (const home of candidateHomes) {
    const binDir = path.join(home, 'bin');
    const executable = path.join(binDir, process.platform === 'win32' ? 'cargo.exe' : 'cargo');
    if (existsSync(executable)) {
      env.CARGO = executable;
      env.PATH = `${binDir}${path.delimiter}${env.PATH ?? ''}`;
      return executable;
    }
  }

  return null;
}

const cargoBin = resolveCargoBin();
if (!cargoBin) {
  console.error('Unable to locate `cargo`. Install Rust and ensure it is on your PATH.');
  process.exit(1);
}

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const result = spawnSync(command, ['exec', 'wasm-pack', ...args], {
  stdio: 'inherit',
  env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
