import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

function resolveSentryRelease(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD', { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
    if (sha) return `steamtools-v2@${sha}`;
  } catch {
    // Fallback when git metadata is unavailable
  }
  return 'steamtools-v2@dev';
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function serveRepoRootAssets(): Plugin {
  const middleware = (
    req: { url?: string; method?: string },
    res: { statusCode: number; setHeader(k: string, v: string): void; end(chunk?: unknown): void },
    next: () => void,
  ) => {
    const reqMethod = (req.method || 'GET').toUpperCase();
    if (reqMethod !== 'GET' && reqMethod !== 'HEAD') {
      next();
      return;
    }
    const rawUrl = req.url || '/';
    const pathname = decodeURIComponent(rawUrl.split('?')[0]);
    // Let Vite handle root app routes; only serve shared static assets and /v1/ from repo root.
    if (
      !pathname.startsWith('/js/') &&
      !pathname.startsWith('/css/') &&
      !pathname.startsWith('/img/') &&
      !pathname.startsWith('/v1/') &&
      pathname !== '/v1' &&
      pathname !== '/favicon.ico' &&
      pathname !== '/privacy.html'
    ) {
      next();
      return;
    }
    const normalized = path.posix.normalize(pathname).replace(/^\/+/, '');
    let candidate = path.resolve(REPO_ROOT, normalized);
    if (!candidate.startsWith(REPO_ROOT + path.sep) && candidate !== REPO_ROOT) {
      next();
      return;
    }
    if (!fs.existsSync(candidate)) {
      next();
      return;
    }
    const stat = fs.statSync(candidate);
    if (stat.isDirectory()) {
      candidate = path.join(candidate, 'index.html');
      if (!fs.existsSync(candidate) || fs.statSync(candidate).isDirectory()) {
        next();
        return;
      }
    }
    const ext = path.extname(candidate).toLowerCase();
    res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
    if (reqMethod === 'HEAD') {
      res.end();
      return;
    }
    res.end(fs.readFileSync(candidate));
  };

  return {
    name: 'serve-repo-root-assets',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

function cleanRootAssetsDir(): Plugin {
  return {
    name: 'clean-root-assets-dir',
    buildStart() {
      const assetsDir = path.resolve(REPO_ROOT, 'assets');
      if (fs.existsSync(assetsDir)) {
        fs.rmSync(assetsDir, { recursive: true, force: true });
      }
    },
  };
}

export default defineConfig({
  base: '/',
  publicDir: false,
  define: {
    __ST_SENTRY_RELEASE__: JSON.stringify(resolveSentryRelease()),
  },
  plugins: [svelte(), serveRepoRootAssets(), cleanRootAssetsDir()],
  build: {
    outDir: path.resolve(__dirname, '..'),
    emptyOutDir: false,
    sourcemap: 'hidden',
    target: 'es2022',
    rollupOptions: {
      input: {
        hub: path.resolve(__dirname, 'index.html'),
        cards: path.resolve(__dirname, 'cards/index.html'),
        emoticons: path.resolve(__dirname, 'emoticons/index.html'),
        backgrounds: path.resolve(__dirname, 'backgrounds/index.html'),
        games: path.resolve(__dirname, 'games/index.html'),
        mosaticon: path.resolve(__dirname, 'mosaticon/index.html'),
        itemvalue: path.resolve(__dirname, 'itemvalue/index.html'),
      },
      output: {
        chunkFileNames(chunkInfo) {
          const safeName = (chunkInfo.name || 'chunk').replace(/sentry/gi, 'diag');
          return `assets/${safeName}-[hash].js`;
        },
      },
    },
  },
});
