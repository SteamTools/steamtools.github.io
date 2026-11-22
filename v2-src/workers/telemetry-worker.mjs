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

const ALLOWED_SENTRY_DSN =
  'https://b68144c98d912ae0bab8f38b6719be4d@o4512471924408320.ingest.us.sentry.io/4512471951343616';
const SENTRY_INGEST_URL =
  'https://o4512471924408320.ingest.us.sentry.io/api/4512471951343616/envelope/?sentry_version=7&sentry_key=b68144c98d912ae0bab8f38b6719be4d';
const MAX_ENVELOPE_HEADER_BYTES = 16 * 1024;
const MAX_ENVELOPE_BYTES = 8 * 1024 * 1024;

const FORWARDED_CLIENT_HEADERS = [
  'user-agent',
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'sec-ch-ua-model',
  'sec-ch-ua-platform',
  'sec-ch-ua-platform-version',
  'origin',
  'referer',
];

const FORWARDED_RESPONSE_HEADERS = [
  'content-type',
  'retry-after',
  'x-sentry-rate-limits',
];

function concatUint8Arrays(chunks, totalBytes) {
  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

function extractPrefixBytes(chunks, prefixLen) {
  const prefix = new Uint8Array(prefixLen);
  let remaining = prefixLen;
  let offset = 0;
  for (const chunk of chunks) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, chunk.byteLength);
    prefix.set(chunk.subarray(0, take), offset);
    offset += take;
    remaining -= take;
  }
  return prefix;
}

function validateEnvelopeHeaderBytes(headerBytes) {
  let header;
  try {
    header = JSON.parse(new TextDecoder().decode(headerBytes));
  } catch {
    return new Response('Invalid envelope', {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  if (!header || typeof header !== 'object' || typeof header.dsn !== 'string' || !header.dsn) {
    return new Response('Invalid envelope', {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  if (header.dsn !== ALLOWED_SENTRY_DSN) {
    return new Response('Forbidden DSN', {
      status: 403,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  return null;
}

async function handleEnvelopeTunnel(request, env) {
  const clHeader = request.headers.get('content-length');
  if (clHeader !== null) {
    const cl = Number(clHeader);
    if (Number.isFinite(cl) && cl > MAX_ENVELOPE_BYTES) {
      return new Response('Payload Too Large', {
        status: 413,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
  }
  if (!request.body) {
    return new Response('Invalid envelope', {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  let dsnVerified = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (!dsnVerified) {
          if (totalBytes === 0) {
            return new Response('Invalid envelope', {
              status: 400,
              headers: { 'Cache-Control': 'no-store' },
            });
          }
          const headerBytes = concatUint8Arrays(chunks, totalBytes);
          const rejectRes = validateEnvelopeHeaderBytes(headerBytes);
          if (rejectRes) return rejectRes;
          dsnVerified = true;
        }
        break;
      }
      if (!value || value.byteLength === 0) continue;

      const prevTotal = totalBytes;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_ENVELOPE_BYTES) {
        await reader.cancel().catch(() => {});
        return new Response('Payload Too Large', {
          status: 413,
          headers: { 'Cache-Control': 'no-store' },
        });
      }

      if (!dsnVerified) {
        const nlIdx = value.indexOf(10);
        if (nlIdx !== -1) {
          const headerEndByte = prevTotal + nlIdx;
          if (headerEndByte > MAX_ENVELOPE_HEADER_BYTES) {
            await reader.cancel().catch(() => {});
            return new Response('Invalid envelope', {
              status: 400,
              headers: { 'Cache-Control': 'no-store' },
            });
          }
          chunks.push(value);
          const lineBytes = extractPrefixBytes(chunks, headerEndByte);
          const rejectRes = validateEnvelopeHeaderBytes(lineBytes);
          if (rejectRes) {
            await reader.cancel().catch(() => {});
            return rejectRes;
          }
          dsnVerified = true;
          continue;
        }
        if (totalBytes > MAX_ENVELOPE_HEADER_BYTES) {
          await reader.cancel().catch(() => {});
          return new Response('Invalid envelope', {
            status: 400,
            headers: { 'Cache-Control': 'no-store' },
          });
        }
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const mergedBody = concatUint8Arrays(chunks, totalBytes);
  const outHeaders = new Headers({
    'Content-Type': 'application/x-sentry-envelope',
  });
  for (const name of FORWARDED_CLIENT_HEADERS) {
    const val = request.headers.get(name);
    if (val) outHeaders.set(name, val);
  }

  const fetchImpl = typeof env?._fetchImpl === 'function' ? env._fetchImpl : fetch;
  let upstream;
  try {
    upstream = await fetchImpl(SENTRY_INGEST_URL, {
      method: 'POST',
      headers: outHeaders,
      body: mergedBody,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return new Response('Bad Gateway', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const respHeaders = new Headers({
    'Cache-Control': 'no-store',
  });
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const val = upstream.headers.get(name);
    if (val) respHeaders.set(name, val);
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  });
}

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
      const reqOrigin = request.headers.get('origin') || '';
      const allowOrigin = ALLOWED_ORIGINS.has(reqOrigin) ? reqOrigin : 'https://steam.tools';
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': allowOrigin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
          'Cache-Control': 'no-store',
          Vary: 'Origin',
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

    const url = new URL(request.url);
    if (url.pathname === '/e') {
      return handleEnvelopeTunnel(request, env);
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
