import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const V2_DIR = path.resolve(REPO_ROOT, 'v2');
const V2_ASSETS_DIR = path.resolve(V2_DIR, 'assets');

function cleanupMapFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  let removed = 0;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      removed += cleanupMapFiles(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.map')) {
      fs.rmSync(fullPath, { force: true });
      removed += 1;
    }
  }
  return removed;
}

function findSentryBinary() {
  const candidates = [];
  const exeName = process.platform === 'win32' ? 'sentry.exe' : 'sentry';
  candidates.push(path.join(os.homedir(), '.local', 'bin', exeName));

  const locator = process.platform === 'win32' ? 'where.exe' : 'which';
  const located = spawnSync(locator, ['sentry'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true,
  });
  if (located.status === 0 && located.stdout) {
    for (const line of located.stdout.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed) candidates.push(trimmed);
    }
  }

  for (const bin of candidates) {
    if (!fs.existsSync(bin)) continue;
    const probe = spawnSync(bin, ['--version'], {
      stdio: 'pipe',
      windowsHide: true,
    });
    if (probe.status === 0) {
      return bin;
    }
  }
  return null;
}

function resolveRelease() {
  try {
    const sha = execSync('git rev-parse --short HEAD', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    }).trim();
    if (sha) return `steamtools-v2@${sha}`;
  } catch {
    // Fallback when git metadata is unavailable
  }
  return 'steamtools-v2@dev';
}

function runSentry(bin, args, env, inherit = false) {
  return spawnSync(bin, args, {
    cwd: REPO_ROOT,
    env,
    stdio: inherit ? 'inherit' : 'pipe',
    windowsHide: true,
  });
}

let exitCode = 0;

try {
  const sentryBin = findSentryBinary();
  if (!sentryBin) {
    console.log('[sentry] CLI not found; skipping sourcemap upload and cleaning .map files.');
  } else {
    const sentryEnv = {
      ...process.env,
      SENTRY_ORG: process.env.SENTRY_ORG || 'ehsankia',
      SENTRY_PROJECT: process.env.SENTRY_PROJECT || 'steam-tools',
    };
    const isAuthed =
      Boolean(sentryEnv.SENTRY_AUTH_TOKEN) ||
      runSentry(sentryBin, ['auth', 'status'], sentryEnv, false).status === 0;

    if (!isAuthed) {
      console.log('[sentry] Not authenticated; skipping sourcemap upload and cleaning .map files.');
    } else {
      const release = resolveRelease();
      const injectRes = runSentry(sentryBin, ['sourcemap', 'inject', V2_ASSETS_DIR], sentryEnv, true);
      if (injectRes.status !== 0) {
        exitCode = injectRes.status || 1;
      } else {
        const uploadRes = runSentry(
          sentryBin,
          [
            'sourcemap',
            'upload',
            V2_ASSETS_DIR,
            '--release',
            release,
            '--url-prefix',
            '~/v2/assets/',
          ],
          sentryEnv,
          true,
        );
        if (uploadRes.status !== 0) {
          exitCode = uploadRes.status || 1;
        }
      }
    }
  }
} finally {
  const removed = cleanupMapFiles(V2_DIR);
  console.log(`[sentry] Cleaned ${removed} .map file(s) from v2/.`);
}

if (exitCode !== 0) {
  process.exit(exitCode);
}
