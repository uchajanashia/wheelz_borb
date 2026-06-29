#!/usr/bin/env node
// ---------------------------------------------------------------------------
// scripts/dev.mjs — tiny cross-platform dev process manager for this monorepo.
//
// Start/stop/restart our dev services in the background with one command:
//
//   node scripts/dev.mjs start     # start every ENABLED service in the background
//   node scripts/dev.mjs stop      # stop everything this tool started
//   node scripts/dev.mjs restart   # stop, wait a moment for ports to free, start
//   node scripts/dev.mjs status    # show which services are running and their PIDs
//
// Or use the root package.json shortcuts (these run from the repo root for you):
//
//   npm run dev:start | npm run dev:stop | npm run dev:restart | npm run dev:status
//
// No external dependencies — only Node.js built-ins. Works on Windows, macOS
// and Linux. Run it from the repo root (the npm shortcuts above always do).
// ---------------------------------------------------------------------------

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ===========================================================================
// SERVICES REGISTRY  ← edit this list to add/remove services.
// ---------------------------------------------------------------------------
// Adding a service later is a ONE-LINE change: uncomment a template below (or
// copy one) and set `enabled: true`. Nothing else needs to change.
//
//   name     unique short id; also used for the .pid and .log file names
//   cwd      directory to run the command in, RELATIVE to the repo root
//   command  executable to run (almost always "npm")
//   args     arguments passed to the command, e.g. ['run', 'start']
//   port     informational only — shown in `start`/`status` output
//   enabled  `start`/`restart` only act on enabled services
// ===========================================================================
const SERVICES = [
  { name: 'website', cwd: 'apps/website', command: 'npm', args: ['run', 'start'], port: 4200, enabled: true },
  // Future services — leave commented (and disabled) until the app exists:
  // { name: 'api',     cwd: 'apps/api',     command: 'npm', args: ['run', 'start:dev'], port: 3000, enabled: false },
  // { name: 'adminka', cwd: 'apps/adminka', command: 'npm', args: ['run', 'start'],     port: 4300, enabled: false },
];

// ---------------------------------------------------------------------------
// Paths & platform
// ---------------------------------------------------------------------------
const IS_WINDOWS = process.platform === 'win32';
const ROOT = process.cwd();
const DEV_DIR = path.join(ROOT, '.dev');
const LOG_DIR = path.join(DEV_DIR, 'logs');

const pidFile = (name) => path.join(DEV_DIR, `${name}.pid`);
const logFile = (name) => path.join(LOG_DIR, `${name}.log`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Create the state directories (.dev and .dev/logs) if they don't exist yet.
function ensureDirs() {
  fs.mkdirSync(LOG_DIR, { recursive: true }); // recursive => also creates DEV_DIR
}

// ---------------------------------------------------------------------------
// PID file helpers
// ---------------------------------------------------------------------------
function readPid(name) {
  const file = pidFile(name);
  if (!fs.existsSync(file)) return null;
  const pid = Number.parseInt(fs.readFileSync(file, 'utf8').trim(), 10);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

function writePid(name, pid) {
  fs.writeFileSync(pidFile(name), String(pid));
}

function clearPid(name) {
  fs.rmSync(pidFile(name), { force: true });
}

// Is the process actually alive? Signal 0 doesn't kill — it just probes.
// Works the same on Windows, macOS and Linux.
function isAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // ESRCH => no such process (dead). EPERM => exists but we can't signal it
    // (still alive). Anything else: treat as not alive to be safe.
    return err.code === 'EPERM';
  }
}

// ---------------------------------------------------------------------------
// start / stop a single service
// ---------------------------------------------------------------------------
function startService(svc) {
  const running = readPid(svc.name);
  if (running && isAlive(running)) {
    console.log(`  • ${svc.name}: already running (pid ${running}) — skipping`);
    return;
  }
  if (running) clearPid(svc.name); // stale pid file from a process that's gone

  const cwd = path.resolve(ROOT, svc.cwd);
  if (!fs.existsSync(cwd)) {
    console.log(`  • ${svc.name}: directory "${svc.cwd}" not found — skipping`);
    return;
  }

  // Log file: append a session header, then hand the child an append fd so its
  // stdout+stderr stream straight to disk without keeping this process alive.
  const log = logFile(svc.name);
  fs.appendFileSync(log, `\n===== ${svc.name} started ${new Date().toISOString()} =====\n`);
  const out = fs.openSync(log, 'a');

  const child = spawn(svc.command, svc.args, {
    cwd,
    detached: true, // own process group on Unix; new group on Windows
    stdio: ['ignore', out, out], // no stdin; stdout+stderr -> log file
    shell: IS_WINDOWS, // so "npm" resolves to npm.cmd via cmd.exe on Windows
    windowsHide: true, // don't pop up a console window on Windows
  });

  fs.closeSync(out); // child has its own copy of the fd now

  if (!child.pid) {
    console.log(`  • ${svc.name}: failed to spawn`);
    return;
  }

  writePid(svc.name, child.pid);
  child.unref(); // let this manager exit while the service keeps running

  console.log(
    `  • ${svc.name}: started (pid ${child.pid}, port ${svc.port}) -> ${path.relative(ROOT, log)}`,
  );
}

// Returns 'stopped' | 'stale' | 'none' so the caller can summarise.
function stopService(svc) {
  const name = svc.name;
  const pid = readPid(name);
  if (pid === null) return 'none';

  if (!isAlive(pid)) {
    clearPid(name);
    console.log(`  • ${name}: not running (stale pid ${pid} cleaned up)`);
    return 'stale';
  }

  let ok = false;
  if (IS_WINDOWS) {
    // Kill the whole process tree (npm -> node -> ng workers) forcefully.
    const res = spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    ok = res.status === 0;
  } else {
    // Negative pid targets the whole process group, so ng's child workers die
    // too. Falls back to the single pid if the group signal fails.
    try {
      process.kill(-pid, 'SIGTERM');
      ok = true;
    } catch {
      try {
        process.kill(pid, 'SIGTERM');
        ok = true;
      } catch {
        ok = false;
      }
    }
  }

  clearPid(name);
  console.log(`  • ${name}: stopped (pid ${pid})${ok ? '' : ' [terminate signal may have failed]'}`);
  return 'stopped';
}

function statusService(svc) {
  const pid = readPid(svc.name);
  let state;
  if (pid !== null && isAlive(pid)) state = `RUNNING (pid ${pid})`;
  else if (pid !== null) state = `STOPPED (stale pid ${pid})`;
  else state = 'STOPPED';

  const disabled = svc.enabled ? '' : ' [disabled]';
  console.log(`  • ${svc.name.padEnd(8)} ${state.padEnd(24)} port ${svc.port}${disabled}`);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
function cmdStart() {
  ensureDirs();
  console.log('Starting services...');
  const enabled = SERVICES.filter((s) => s.enabled);
  if (enabled.length === 0) {
    console.log('  (no enabled services)');
    return;
  }
  for (const svc of enabled) startService(svc);
}

function cmdStop() {
  console.log('Stopping services...');
  let acted = false;
  // Iterate all services (not just enabled) so a service that was disabled
  // while still running can still be stopped.
  for (const svc of SERVICES) {
    if (stopService(svc) !== 'none') acted = true;
  }
  if (!acted) console.log('  (nothing was running)');
}

async function cmdRestart() {
  cmdStop();
  console.log('Waiting for ports/processes to release...');
  await sleep(1500);
  cmdStart();
}

function cmdStatus() {
  console.log('Service status:');
  for (const svc of SERVICES) statusService(svc);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
const USAGE = 'Usage: node scripts/dev.mjs <start|stop|restart|status>';

switch (process.argv[2]) {
  case 'start':
    cmdStart();
    break;
  case 'stop':
    cmdStop();
    break;
  case 'restart':
    await cmdRestart();
    break;
  case 'status':
    cmdStatus();
    break;
  default:
    console.error(USAGE);
    process.exit(1);
}
