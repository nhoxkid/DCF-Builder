#!/usr/bin/env node
import { spawn } from 'node:child_process';
import process from 'node:process';

const STALL_TIMEOUT_MS = Number(process.env.TEST_WATCHDOG_STALL ?? 120_000);
const MAX_DURATION_MS = Number(process.env.TEST_WATCHDOG_MAX ?? 900_000);
const COMMAND = process.env.TEST_WATCHDOG_COMMAND?.split(' ')?.filter(Boolean) ?? ['pnpm', '-r', '--if-present', 'test'];

let lastOutput = Date.now();

const child = spawn(COMMAND[0], COMMAND.slice(1), {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: process.platform === 'win32',
});

const resetTimer = () => {
  lastOutput = Date.now();
};

const onData = (stream, writer) => {
  stream.on('data', (chunk) => {
    writer.write(chunk);
    resetTimer();
  });
};

onData(child.stdout, process.stdout);
onData(child.stderr, process.stderr);

const stallTimer = setInterval(() => {
  if (Date.now() - lastOutput > STALL_TIMEOUT_MS) {
    console.error(`\n[watchdog] No output for ${STALL_TIMEOUT_MS / 1000}s – terminating tests.`);
    terminate('STALL');
  }
}, 5_000);

const maxTimer = setTimeout(() => {
  console.error(`\n[watchdog] Max duration ${MAX_DURATION_MS / 1000}s exceeded – terminating tests.`);
  terminate('TIMEOUT');
}, MAX_DURATION_MS);

let terminating = false;

function terminate(reason) {
  if (terminating) {
    return;
  }
  terminating = true;
  clearInterval(stallTimer);
  clearTimeout(maxTimer);
  if (!child.killed) {
    child.kill();
    setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }, 5_000);
  }
  child.on('exit', (code, signal) => {
    const exitCode = code ?? (signal ? 1 : 0);
    process.exit(exitCode !== 0 ? exitCode : reason === 'STALL' ? 124 : 137);
  });
}

child.on('exit', (code, signal) => {
  clearInterval(stallTimer);
  clearTimeout(maxTimer);
  if (!terminating) {
    process.exit(code ?? (signal ? 1 : 0));
  }
});

process.on('SIGINT', () => {
  terminate('TIMEOUT');
});


