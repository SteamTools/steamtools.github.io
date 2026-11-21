function foldChar(c: string): string {
  switch (c) {
    case 'æ':
      return 'ae';
    case 'ä':
    case 'å':
    case 'á':
    case 'à':
    case 'ã':
    case 'â':
      return 'a';
    case 'ç':
    case 'č':
      return 'c';
    case 'é':
    case 'ê':
    case 'è':
    case 'ë':
      return 'e';
    case 'î':
    case 'ï':
    case 'í':
      return 'i';
    case 'œ':
      return 'oe';
    case 'ö':
    case 'ó':
    case 'õ':
    case 'ô':
      return 'o';
    case 'ś':
    case 'š':
      return 's';
    case 'ü':
    case 'ù':
    case 'ú':
      return 'u';
    case 'ß':
      return 'ss';
    case 'ё':
      return 'е';
    default:
      return c;
  }
}

export function normalizeForSearch(raw: unknown): string {
  const s = String(raw ?? '').toLowerCase();
  let normalized = '';
  for (let i = 0; i < s.length; i += 1) {
    normalized += foldChar(s.charAt(i));
  }
  return normalized;
}

const rtf = typeof Intl !== 'undefined' && Intl.RelativeTimeFormat
  ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  : null;

const shortDateFmt = typeof Intl !== 'undefined' && Intl.DateTimeFormat
  ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : null;

export function formatRelativeTime(unixSec: number, nowMs: number = Date.now()): string {
  const tsMs = Number(unixSec) * 1000;
  if (!Number.isFinite(tsMs) || tsMs <= 0) return 'recently';
  const diffSec = Math.round((tsMs - nowMs) / 1000);
  const absSec = Math.abs(diffSec);
  if (rtf) {
    if (absSec < 60) return rtf.format(diffSec, 'second');
    const diffMin = Math.round(diffSec / 60);
    if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
    const diffHour = Math.round(diffSec / 3600);
    if (Math.abs(diffHour) < 24) return rtf.format(diffHour, 'hour');
    const diffDay = Math.round(diffSec / 86400);
    if (Math.abs(diffDay) < 30) return rtf.format(diffDay, 'day');
    const diffMonth = Math.round(diffDay / 30);
    if (Math.abs(diffMonth) < 12) return rtf.format(diffMonth, 'month');
    return rtf.format(Math.round(diffDay / 365), 'year');
  }
  return `${Math.round(absSec / 60)}m ago`;
}

export function formatShortDate(unixSec: number): string {
  const num = Number(unixSec);
  if (!Number.isFinite(num) || num <= 0) return '—';
  const d = new Date(num * 1000);
  if (shortDateFmt) {
    return shortDateFmt.format(d);
  }
  return d.toISOString().slice(0, 10);
}

export function formatIsoDate(unixSec: number): string {
  const num = Number(unixSec);
  if (!Number.isFinite(num) || num <= 0) return '';
  const d = new Date(num * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDurationAge(seconds: number): string {
  const secs = Math.max(0, Number(seconds) || 0);
  if (secs >= 3600) {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.round((secs % 3600) / 60);
    return `${hrs}h${mins > 0 ? ` ${mins}m` : ''}`;
  }
  if (secs >= 60) {
    return `${Math.round(secs / 60)}m`;
  }
  return `${secs}s`;
}
