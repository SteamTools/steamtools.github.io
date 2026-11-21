const ALLOWED_ORIGINS = new Set([
  'https://steam.tools',
  'https://www.steam.tools',
]);

const ALLOWED_EVENTS = new Set([
  'v2_route',
  'v2_banner_click',
  'classic_switch',
  'theme_toggle',
  'currency_change',
  'fetch_ok',
  'fetch_err',
  'turnstile_err',
  'import_open',
  'import_ok',
  'import_err',
  'api_failover',
  'export',
  'mosaticon_gen',
  'js_error',
]);

const ALLOWED_APPS = new Set([
  'hub',
  'itemvalue',
  'cards',
  'mosaticon',
  'emoticons',
  'backgrounds',
  'games',
  'other',
]);

const MAX_BODY_BYTES = 2048;
const MAX_BATCH_EVENTS = 10;

function isAllowedSource(request) {
  const origin = request.headers.get('origin');
  if (origin) {
    return ALLOWED_ORIGINS.has(origin);
  }
  const referer = request.headers.get('referer') || '';
  return (
    referer.startsWith('https://steam.tools/') ||
    referer === 'https://steam.tools' ||
    referer.startsWith('https://www.steam.tools/') ||
    referer === 'https://www.steam.tools'
  );
}

function cleanStr(val) {
  return String(val ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9_.:-]/g, '')
    .slice(0, 48);
}

async function readBoundedText(request, maxBytes) {
  const clHeader = request.headers.get('content-length');
  if (clHeader !== null) {
    const cl = Number(clHeader);
    if (Number.isFinite(cl) && cl > maxBytes) {
      return { tooLarge: true, text: '' };
    }
  }
  if (!request.body) {
    return { tooLarge: false, text: '' };
  }
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return { tooLarge: true, text: '' };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { tooLarge: false, text: new TextDecoder().decode(merged) };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': 'https://steam.tools',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
          'Cache-Control': 'no-store',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response(null, {
        status: 405,
        headers: {
          Allow: 'POST, OPTIONS',
          'Cache-Control': 'no-store',
        },
      });
    }

    if (!isAllowedSource(request)) {
      return new Response('Forbidden', {
        status: 403,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const { tooLarge, text } = await readBoundedText(request, MAX_BODY_BYTES);
    if (tooLarge) {
      return new Response('Payload Too Large', {
        status: 413,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    let parsed;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      return new Response(null, {
        status: 204,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const rawList = Array.isArray(parsed?.events)
      ? parsed.events
      : parsed && typeof parsed === 'object'
        ? [parsed]
        : [];

    const country = String(request.cf?.country || '')
      .replace(/[^A-Za-z]/g, '')
      .slice(0, 4);

    const hasAe = Boolean(env.AE && typeof env.AE.writeDataPoint === 'function');
    const limit = Math.min(rawList.length, MAX_BATCH_EVENTS);
    for (let i = 0; i < limit; i += 1) {
      const item = rawList[i];
      if (!item || typeof item !== 'object') continue;
      const evName = cleanStr(item.e);
      if (!ALLOWED_EVENTS.has(evName)) continue;

      const ver = item.ver === 'v2' ? 'v2' : 'v1';
      const rawApp = cleanStr(item.app);
      const app = ALLOWED_APPS.has(rawApp) ? rawApp : 'other';
      const a = cleanStr(item.a);
      const b = cleanStr(item.b);
      const scheme = item.scheme === 'dark' || item.scheme === 'light' ? item.scheme : '';
      const num = Number(item.n);
      const n = Number.isFinite(num) ? Math.max(0, Math.min(1e9, num)) : 0;

      if (hasAe) {
        env.AE.writeDataPoint({
          indexes: [evName],
          blobs: [evName, ver, app, a, b, country, scheme],
          doubles: [1, n],
        });
      } else {
        console.log(JSON.stringify({ st_ev: evName, ver, app, a, b, country, scheme, n }));
      }
    }

    return new Response(null, {
      status: 204,
      headers: { 'Cache-Control': 'no-store' },
    });
  },
};
