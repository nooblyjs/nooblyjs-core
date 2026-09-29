#!/usr/bin/env node

/**
 * @fileoverview Kills any process listening on the development port (11000).
 * Cross-platform: parses `netstat -ano` on Windows, uses `lsof` on macOS/Linux.
 */

'use strict';

const { execSync } = require('child_process');
const os = require('os');

const PORT = 11001;

/**
 * Finds the PIDs of processes listening on the given TCP port.
 * @param {number} port The port to inspect.
 * @return {number[]} A list of unique listening process IDs.
 */
function findListeningPids(port) {
  const pids = new Set();

  if (os.platform() === 'win32') {
    let output = '';
    try {
      output = execSync('netstat -ano -p TCP', { encoding: 'utf8' });
    } catch (err) {
      return [];
    }
    // Columns: Proto  LocalAddress  ForeignAddress  State  PID
    for (const line of output.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5 && parts[3] === 'LISTENING' && parts[1].endsWith(`:${port}`)) {
        const pid = Number(parts[4]);
        if (Number.isInteger(pid) && pid > 0) {
          pids.add(pid);
        }
      }
    }
  } else {
    try {
      const output = execSync(`lsof -t -i:${port} -sTCP:LISTEN`, { encoding: 'utf8' });
      for (const line of output.split(/\r?\n/)) {
        const pid = Number(line.trim());
        if (Number.isInteger(pid) && pid > 0) {
          pids.add(pid);
        }
      }
    } catch (err) {
      // lsof exits non-zero when nothing matches - treat as "no process".
      return [];
    }
  }

  return [...pids];
}

/**
 * Forcibly terminates a process by PID.
 * @param {number} pid The process ID to kill.
 * @return {boolean} True if the kill succeeded.
 */
function killPid(pid) {
  try {
    if (os.platform() === 'win32') {
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGKILL');
    }
    return true;
  } catch (err) {
    return false;
  }
}

const pids = findListeningPids(PORT);

if (pids.length === 0) {
  console.log(`✓ No process running on port ${PORT}`);
  process.exit(0);
}

let killed = 0;
for (const pid of pids) {
  if (killPid(pid)) {
    console.log(`✓ Killed process ${pid} on port ${PORT}`);
    killed += 1;
  } else {
    console.error(`✗ Failed to kill process ${pid} on port ${PORT}`);
  }
}

process.exit(killed === pids.length ? 0 : 1);
