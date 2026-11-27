<script lang="ts">
  import { onMount } from 'svelte';
  import {
    apiRequestWithFailover,
    computeShardHex64,
    fetchCdnJson,
    getCfg,
    getImporter,
    httpShim,
    loadDataset,
    sanitizeEmoteName,
    trackEvent,
  } from '../lib/bridge.ts';
  import { enhanceModalDialog } from '../lib/dialog.ts';
  import {
    decodeBase64ToBytes42,
    encodeBytes42ToBase64,
    exportMosaicText,
    extractRegionBytes42,
    flipGridHorizontal,
    flipGridVertical,
    floodFillGrid,
    generateMosaicFromRgba,
    paintCell,
    paintCircle,
    paintLine,
    paintRect,
    parseImportedMosaic,
    resizeGrid,
    shiftGrid,
    type EmoteColorEntry,
    type MosColorMode,
    type MosTool,
  } from '../lib/mosaticon-logic.ts';

  const IDB_NAME = 'steamtools_mosaticon_colors_v1';
  const IDB_STORE = 'emote_colors';
  const MAX_UNDO = 30;
  const SHOWCASE_LIMIT = 8000;
  const COMMENT_LIMIT = 800;

  interface SpritePos {
    sheet: number;
    col: number;
    row: number;
  }

  let cdnBase = $state('https://cdn.steam.tools');
  let econBase = $state('https://community.fastly.steamstatic.com/economy');
  let authSteamId = $state<string | null>(null);
  let importSteamId = $state('');
  let fetchingEmotes = $state(false);
  let resolvingColors = $state(false);
  let statusMsg = $state('');
  let errorMsg = $state('');

  let spriteLookup = new Map<string, SpritePos>();
  let catalogLoaded = $state(false);
  let palette = $state<EmoteColorEntry[]>([]);
  let paletteFilter = $state('');

  // Source image rgba buffer
  let srcRgba: Uint8ClampedArray | null = null;
  let srcWidth = $state(0);
  let srcHeight = $state(0);
  let srcLabel = $state('No image loaded');

  // Mosaic dimensions & generator settings
  let cols = $state(20);
  let rows = $state(20);
  let lockAspect = $state(true);
  let quality = $state<1 | 2 | 3>(2);
  let colorMode = $state<MosColorMode>('lab');
  let blankEmote = $state(':steamthumbsup:');

  // Editor state
  let grid = $state<string[]>(new Array(20 * 20).fill(''));
  let previewGrid = $state<string[] | null>(null);
  let undoStack = $state<string[][]>([]);
  let tool = $state<MosTool>('pen');
  let filledShape = $state(false);
  let selectedBrush = $state<string>(':steamhappy:');
  let showGridlines = $state(true);
  let cellPx = $state(20);
  let hoverInfo = $state('');

  // Pointer drag tracking
  let isDrawing = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragSnapshot: string[] = [];

  // Modals / Dialogs
  let importDialogEl = $state<HTMLDialogElement | null>(null);
  let importModalOpen = $state(false);
  let importPasteText = $state('');
  let shortcutsDialogEl = $state<HTMLDialogElement | null>(null);
  let shortcutsDialogOpen = $state(false);

  $effect(() => {
    if (importDialogEl) {
      if (importModalOpen && !importDialogEl.open) {
        importDialogEl.returnValue = '';
        importDialogEl.showModal();
      } else if (!importModalOpen && importDialogEl.open) {
        importDialogEl.close();
      }
    }
    if (shortcutsDialogEl) {
      if (shortcutsDialogOpen && !shortcutsDialogEl.open) {
        shortcutsDialogEl.returnValue = '';
        shortcutsDialogEl.showModal();
      } else if (!shortcutsDialogOpen && shortcutsDialogEl.open) {
        shortcutsDialogEl.close();
      }
    }
  });

  let steamInputEl = $state<HTMLInputElement | null>(null);
  let fileInputEl = $state<HTMLInputElement | null>(null);

  function openIdb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async function idbGetMany(cleanNames: string[]): Promise<Map<string, Uint8Array>> {
    const out = new Map<string, Uint8Array>();
    const db = await openIdb();
    if (!db || cleanNames.length === 0) return out;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      let pending = cleanNames.length;
      for (const name of cleanNames) {
        const req = store.get(`v1:${name}`);
        req.onsuccess = () => {
          if (typeof req.result === 'string') {
            const bytes = decodeBase64ToBytes42(req.result);
            if (bytes) out.set(name, bytes);
          }
          pending -= 1;
          if (pending === 0) resolve();
        };
        req.onerror = () => {
          pending -= 1;
          if (pending === 0) resolve();
        };
      }
      tx.oncomplete = () => db.close();
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
    return out;
  }

  async function idbPutMany(entries: Array<{ name: string; bytes: Uint8Array }>) {
    const db = await openIdb();
    if (!db || entries.length === 0) return;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      for (const e of entries) {
        store.put(encodeBytes42ToBase64(e.bytes), `v1:${e.name}`);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  }

  async function clearIdbCache() {
    const db = await openIdb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
    statusMsg = 'Cleared cached emoticon color signatures.';
  }

  function extractColorFromCorsImage(cleanName: string): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
      const base = getCfg().EMOTE_CORS_BASE || 'https://emotes.steam.tools';
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 18;
          canvas.height = 18;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.clearRect(0, 0, 18, 18);
          ctx.drawImage(img, 0, 0, 18, 18);
          const data = ctx.getImageData(0, 0, 18, 18).data;
          resolve(extractRegionBytes42(data, 18, 0, 0, 18, 18));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = `${base.replace(/\/+$/, '')}/${encodeURIComponent(cleanName)}`;
    });
  }

  async function loadSpriteLookupCatalog() {
    try {
      const cfg = getCfg();
      cdnBase = cfg.CDN_BASE || 'https://cdn.steam.tools';
      econBase = cfg.STEAM_ECON_BASE || 'https://community.fastly.steamstatic.com/economy';
      const [cat, prices] = await Promise.all([
        loadDataset('data/emote_catalog_v3.json'),
        loadDataset('data/emote_prices_v3.json'),
      ]);
      const unpacked = getCfg().unpackGalleryV3(cat, prices);
      if (unpacked && Array.isArray(unpacked.items)) {
        const nextMap = new Map<string, SpritePos>();
        for (const it of unpacked.items) {
          const clean = sanitizeEmoteName(String(it.name || '')).toLowerCase();
          const pos = Array.isArray(it.pos) ? it.pos : null;
          if (clean && pos) {
            nextMap.set(clean, { sheet: pos[0] || 0, col: pos[1] || 0, row: pos[2] || 0 });
          }
        }
        spriteLookup = nextMap;
        catalogLoaded = true;
      }
    } catch {
      // Fallback to direct emote images when spritesheet catalog isn't loaded
    }
  }

  async function resolveAndSetPalette(
    inputs: Array<{ cleanName: string; inlineB64?: string }>,
  ) {
    resolvingColors = true;
    errorMsg = '';
    const dedup = new Map<string, string | undefined>();
    for (const item of inputs) {
      const clean = sanitizeEmoteName(item.cleanName);
      if (clean && !dedup.has(clean)) dedup.set(clean, item.inlineB64);
    }
    const cleanNames = Array.from(dedup.keys());
    const resolved = new Map<string, Uint8Array>();

    // Tier 1: inline
    const missingAfterInline: string[] = [];
    for (const name of cleanNames) {
      const b64 = dedup.get(name);
      const decoded = b64 ? decodeBase64ToBytes42(b64) : null;
      if (decoded) resolved.set(name, decoded);
      else missingAfterInline.push(name);
    }

    // Tier 2: IndexedDB
    const idbHits = await idbGetMany(missingAfterInline);
    for (const [k, v] of idbHits) resolved.set(k, v);
    let remaining = missingAfterInline.filter((n) => !resolved.has(n));

    const newForIdb: Array<{ name: string; bytes: Uint8Array }> = [];

    // Tier 3: Sharded CDN or POST /v1/emote-colors or monolith
    if (remaining.length > 0) {
      statusMsg = `Resolving color data for ${remaining.length} emoticons...`;
      const byShard = new Map<string, string[]>();
      for (const name of remaining) {
        const sh = computeShardHex64(name);
        const arr = byShard.get(sh);
        if (arr) arr.push(name);
        else byShard.set(sh, [name]);
      }

      if (byShard.size <= 8) {
        await Promise.all(
          Array.from(byShard.keys()).map(async (sh) => {
            try {
              const shardDoc = await fetchCdnJson<Record<string, string>>(`data/emote_colors/${sh}.json`);
              for (const n of byShard.get(sh) || []) {
                const b64 = shardDoc?.[n] || shardDoc?.[`:${n}:`] || shardDoc?.[n.toLowerCase()];
                const bytes = b64 ? decodeBase64ToBytes42(b64) : null;
                if (bytes) {
                  resolved.set(n, bytes);
                  newForIdb.push({ name: n, bytes });
                }
              }
            } catch {
              // Fall through
            }
          }),
        );
      } else {
        for (let i = 0; i < remaining.length; i += 2000) {
          const chunk = remaining.slice(i, i + 2000);
          try {
            const resp = await apiRequestWithFailover('/v1/emote-colors', {
              method: 'POST',
              data: { names: chunk },
            });
            const colorObj = resp?.data?.colors || resp?.data || {};
            for (const n of chunk) {
              const b64 = colorObj?.[n] || colorObj?.[`:${n}:`];
              const bytes = b64 ? decodeBase64ToBytes42(b64) : null;
              if (bytes) {
                resolved.set(n, bytes);
                newForIdb.push({ name: n, bytes });
              }
            }
          } catch {
            // Try monolith fallback if batch POST fails
            try {
              const mono = await loadDataset<Record<string, string>>('data/emote_colors.json');
              for (const n of chunk) {
                const b64 = mono?.[n] || mono?.[`:${n}:`];
                const bytes = b64 ? decodeBase64ToBytes42(b64) : null;
                if (bytes) {
                  resolved.set(n, bytes);
                  newForIdb.push({ name: n, bytes });
                }
              }
            } catch {
              // Fall through to CORS extract
            }
            break;
          }
        }
      }
      remaining = remaining.filter((n) => !resolved.has(n));
    }

    // Tier 4: Live CORS image extract (concurrency = 6)
    if (remaining.length > 0 && remaining.length <= 400) {
      let idx = 0;
      const workers = Array.from({ length: Math.min(6, remaining.length) }, async () => {
        while (idx < remaining.length) {
          const n = remaining[idx];
          idx += 1;
          const bytes = await extractColorFromCorsImage(n);
          if (bytes) {
            resolved.set(n, bytes);
            newForIdb.push({ name: n, bytes });
          }
        }
      });
      await Promise.all(workers);
    }

    if (newForIdb.length > 0) {
      void idbPutMany(newForIdb);
    }

    const entries: EmoteColorEntry[] = [];
    for (const name of cleanNames) {
      const bytes = resolved.get(name);
      if (bytes) {
        entries.push({
          name: name.toLowerCase(),
          displayName: `:${name}:`,
          bytes,
        });
      }
    }

    palette = entries;
    if (entries.length > 0) {
      selectedBrush = entries[0].displayName;
      if (!blankEmote || !entries.some((e) => e.displayName === blankEmote)) {
        blankEmote = entries[0].displayName;
      }
      statusMsg = `Loaded ${entries.length.toLocaleString()} palette emoticons with color signatures.`;
    } else {
      statusMsg = 'No matching emoticon color signatures could be loaded.';
    }
    resolvingColors = false;

    if (srcRgba) {
      runMosaicGenerator();
    }
  }

  function applySamplePreset() {
    const w = 120;
    const h = 120;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#1e3c72');
    grad.addColorStop(0.5, '#d9534f');
    grad.addColorStop(1, '#f0ad4e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(60, 60, 32, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1b2838';
    ctx.beginPath();
    ctx.arc(49, 53, 5, 0, Math.PI * 2);
    ctx.arc(71, 53, 5, 0, Math.PI * 2);
    ctx.fill();

    const imgData = ctx.getImageData(0, 0, w, h);
    srcRgba = imgData.data;
    srcWidth = w;
    srcHeight = h;
    srcLabel = 'Sample Emblem (120×120)';
    cols = 20;
    rows = 20;
    runMosaicGenerator();
  }

  function handleImageUpload(ev: Event) {
    const file = (ev.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const maxDim = 640;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
        srcRgba = ctx.getImageData(0, 0, w, h).data;
        srcWidth = w;
        srcHeight = h;
        srcLabel = `${file.name} (${img.width}×${img.height})`;
        if (lockAspect) {
          rows = Math.max(4, Math.min(64, Math.round((cols * img.height) / Math.max(1, img.width))));
        }
        runMosaicGenerator();
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      errorMsg = 'Could not decode image file.';
    };
    img.src = url;
  }

  function pushUndo(prev: string[]) {
    undoStack = [...undoStack.slice(-(MAX_UNDO - 1)), prev];
  }

  function handleUndo() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    undoStack = undoStack.slice(0, -1);
    grid = prev;
  }

  function runMosaicGenerator() {
    if (!srcRgba || palette.length === 0) return;
    trackEvent('mosaticon_gen', { app: 'mosaticon', a: colorMode });
    pushUndo(grid);
    grid = generateMosaicFromRgba({
      rgba: srcRgba,
      imgWidth: srcWidth,
      imgHeight: srcHeight,
      cols,
      rows,
      palette,
      quality,
      mode: colorMode,
    });
  }

  function handleDimensionsChange(nextCols: number, nextRows: number) {
    const w = Math.max(4, Math.min(64, nextCols));
    const h = Math.max(4, Math.min(64, nextRows));
    if (srcRgba) {
      cols = w;
      rows = h;
      runMosaicGenerator();
    } else {
      pushUndo(grid);
      grid = resizeGrid(grid, cols, rows, w, h);
      cols = w;
      rows = h;
    }
  }

  function createBlankCanvas() {
    pushUndo(grid);
    srcRgba = null;
    srcLabel = 'Blank canvas';
    grid = new Array(cols * rows).fill('');
  }

  function openSteamImport(initialJson?: unknown) {
    const imp = getImporter();
    if (!imp) return;
    imp.openImportDialog({
      mode: 'emotes',
      appid: '753',
      contextid: '6',
      steamId: importSteamId.trim() || authSteamId || '',
      initialJson: typeof initialJson === 'string' ? initialJson : undefined,
      title: 'Import Emotes from Steam',
      subtitle: 'Build a mosaic palette from the Steam emoticons in your inventory — no captcha needed.',
      onImport: (res: any) => {
        const rawList = Array.isArray(res?.emoticons)
          ? res.emoticons
          : (Array.isArray(res?.emotes)
            ? res.emotes
            : (Array.isArray(res?.owned) ? res.owned : (Array.isArray(res?.items) ? res.items : [])));
        const mapped = rawList
          .map((e: any) => ({
            cleanName: sanitizeEmoteName(typeof e === 'string' ? e : String(e?.name || '')),
            inlineB64: typeof e === 'object' && typeof e?.colors === 'string' ? e.colors : undefined,
          }))
          .filter((x: { cleanName: string }) => Boolean(x.cleanName));
        if (mapped.length > 0) {
          try {
            window.localStorage.setItem(
              'lastEmotes',
              JSON.stringify(mapped.map((x: { cleanName: string }) => x.cleanName)),
            );
          } catch {
            // Ignore quota
          }
          if (res?.steamid64) {
            authSteamId = String(res.steamid64);
            if (!importSteamId.trim()) importSteamId = String(res.steamid64);
          }
          void resolveAndSetPalette(mapped);
        } else {
          errorMsg = 'No emoticons found in imported Steam inventory.';
        }
      },
    });
  }

  async function fetchOwnedEmotes() {
    const id = importSteamId.trim() || authSteamId || '';
    if (!id) {
      openSteamImport();
      return;
    }
    fetchingEmotes = true;
    errorMsg = '';
    try {
      const resp = await apiRequestWithFailover(`/FetchEmotes?id=${encodeURIComponent(id)}`, {
        method: 'GET',
        withCredentials: true,
      });
      const body = resp?.data || {};
      const list = Array.isArray(body.owned)
        ? body.owned
        : (Array.isArray(body.emotes) ? body.emotes : (Array.isArray(body.items) ? body.items : []));
      const colorsObj = body.colors && typeof body.colors === 'object' ? body.colors : {};
      const mapped = list
        .map((e: any) => {
          const cleanName = sanitizeEmoteName(typeof e === 'string' ? e : String(e?.name || ''));
          return {
            cleanName,
            inlineB64: (typeof e === 'object' && e?.colors) || colorsObj[cleanName] || colorsObj[`:${cleanName}:`],
          };
        })
        .filter((x: { cleanName: string }) => Boolean(x.cleanName));
      if (mapped.length > 0) {
        await resolveAndSetPalette(mapped);
      } else {
        errorMsg = 'No owned emoticons returned — try Import from Steam (No Captcha).';
      }
    } catch {
      errorMsg = 'Could not fetch owned emoticons — try Import from Steam (No Captcha).';
    } finally {
      fetchingEmotes = false;
    }
  }

  function handleExport() {
    const text = exportMosaicText(grid, cols, rows, blankEmote);
    getCfg().openTextExportDialog({
      title: `Export Mosaic (${cols}×${rows})`,
      filename: 'mosaticon.txt',
      text,
    });
  }

  function handleApplyImportText() {
    const parsed = parseImportedMosaic(importPasteText);
    if (parsed.width === 0 || parsed.height === 0) {
      errorMsg = 'No :emoticon: codes found in imported text.';
      return;
    }
    pushUndo(grid);
    cols = Math.min(64, Math.max(4, parsed.width));
    rows = Math.min(64, Math.max(4, parsed.height));
    grid = resizeGrid(parsed.cells, parsed.width, parsed.height, cols, rows);
    importModalOpen = false;
    importPasteText = '';
  }

  function getCellCoordsFromPointer(ev: PointerEvent): { x: number; y: number } | null {
    const target = (ev.target as HTMLElement | null)?.closest<HTMLElement>('[data-cell-idx]');
    if (!target) return null;
    const idx = Number.parseInt(target.dataset.cellIdx || '', 10);
    if (!Number.isFinite(idx)) return null;
    return { x: idx % cols, y: Math.floor(idx / cols) };
  }

  function handleGridPointerDown(ev: PointerEvent) {
    if (ev.button !== 0 && ev.button !== 2) return;
    const pt = getCellCoordsFromPointer(ev);
    if (!pt) return;
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    const activeBrush = ev.button === 2 ? '' : selectedBrush;
    isDrawing = true;
    dragStartX = pt.x;
    dragStartY = pt.y;
    dragSnapshot = grid.slice();

    if (tool === 'fill') {
      pushUndo(grid);
      grid = floodFillGrid(grid, cols, rows, pt.x, pt.y, activeBrush);
      isDrawing = false;
      return;
    }
    if (tool === 'pen') {
      pushUndo(grid);
      grid = paintCell(grid, cols, rows, pt.x, pt.y, activeBrush);
    }
  }

  function handleGridPointerMove(ev: PointerEvent) {
    const pt = getCellCoordsFromPointer(ev);
    if (pt) {
      const val = (previewGrid || grid)[pt.y * cols + pt.x];
      hoverInfo = `(${pt.x + 1}, ${pt.y + 1}) ${val || '[empty]'}`;
    }
    if (!isDrawing || !pt) return;
    const activeBrush = (ev.buttons & 2) !== 0 ? '' : selectedBrush;
    if (tool === 'pen') {
      grid = paintCell(grid, cols, rows, pt.x, pt.y, activeBrush);
    } else if (tool === 'line') {
      previewGrid = paintLine(dragSnapshot, cols, rows, dragStartX, dragStartY, pt.x, pt.y, activeBrush);
    } else if (tool === 'rect') {
      previewGrid = paintRect(dragSnapshot, cols, rows, dragStartX, dragStartY, pt.x, pt.y, activeBrush, filledShape);
    } else if (tool === 'circle') {
      previewGrid = paintCircle(dragSnapshot, cols, rows, dragStartX, dragStartY, pt.x, pt.y, activeBrush, filledShape);
    } else if (tool === 'move') {
      previewGrid = shiftGrid(dragSnapshot, cols, rows, pt.x - dragStartX, pt.y - dragStartY);
    }
  }

  function handleGridPointerUp() {
    if (!isDrawing) return;
    isDrawing = false;
    if (previewGrid) {
      pushUndo(dragSnapshot);
      grid = previewGrid;
      previewGrid = null;
    }
  }

  function handleKeyDown(ev: KeyboardEvent) {
    const tag = (ev.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') {
      ev.preventDefault();
      handleUndo();
      return;
    }
    switch (ev.key.toLowerCase()) {
      case 'q': tool = 'pen'; break;
      case 'w': tool = 'line'; break;
      case 'e': tool = 'rect'; break;
      case 'a': tool = 'circle'; break;
      case 's': tool = 'fill'; break;
      case 'd': tool = 'move'; break;
      case 'h':
        pushUndo(grid);
        grid = flipGridHorizontal(grid, cols, rows);
        break;
      case 'v':
        pushUndo(grid);
        grid = flipGridVertical(grid, cols, rows);
        break;
    }
  }

  async function loadStarterPaletteFromShard() {
    resolvingColors = true;
    errorMsg = '';
    try {
      const [, shardDoc] = await Promise.all([
        loadSpriteLookupCatalog(),
        fetchCdnJson<Record<string, string>>('data/emote_colors/00.json'),
      ]);
      const keys = Object.keys(shardDoc || {});
      const spriteKeys = keys.filter((k) => spriteLookup.has(k.toLowerCase()));
      const pool = spriteKeys.length >= 24 ? spriteKeys : keys;
      const targetCount = Math.min(96, pool.length);
      const step = Math.max(1, Math.floor(pool.length / Math.max(1, targetCount)));
      const picks: Array<{ cleanName: string; inlineB64: string }> = [];

      for (let i = 0; i < pool.length && picks.length < targetCount; i += step) {
        const key = pool[i];
        const b64 = shardDoc[key];
        if (b64 && decodeBase64ToBytes42(b64)) {
          picks.push({ cleanName: key, inlineB64: b64 });
        }
      }
      if (picks.length > 0) {
        await resolveAndSetPalette(picks);
      } else {
        statusMsg = 'Import your Steam inventory to populate the emoticon palette.';
        resolvingColors = false;
      }
    } catch {
      statusMsg = 'Could not load starter palette shard — use Import Steam Inventory.';
      resolvingColors = false;
    }
  }

  function getSpriteBackgroundStyle(displayEmote: string, px = 20): string {
    void catalogLoaded;
    if (!displayEmote) return '';
    const clean = sanitizeEmoteName(displayEmote).toLowerCase();
    const pos = spriteLookup.get(clean);
    if (pos) {
      return `background-image: url("${cdnBase}/emoticons/${pos.sheet}s.webp?v4"); background-position: -${pos.col * px}px -${pos.row * px}px; background-size: ${8 * px}px ${16 * px}px;`;
    }
    return `background-image: url("${econBase.replace(/\/+$/, '')}/emoticon/${encodeURIComponent(sanitizeEmoteName(displayEmote))}"); background-size: contain; background-position: center;`;
  }

  let displayedGrid = $derived(previewGrid || grid);
  let filteredPalette = $derived.by(() => {
    const q = paletteFilter.trim().toLowerCase();
    if (!q) return palette;
    return palette.filter((e) => e.name.includes(q));
  });

  let charCounts = $derived.by(() => {
    const text = exportMosaicText(grid, cols, rows, blankEmote);
    const total = text.length;
    return { total, showcaseOk: total <= SHOWCASE_LIMIT, commentOk: total <= COMMENT_LIMIT };
  });

  onMount(() => {
    let savedEmotes: string[] = [];
    try {
      const savedUser = window.localStorage.getItem('lastUser');
      if (savedUser) importSteamId = savedUser;
      const rawEmotes = window.localStorage.getItem('lastEmotes');
      if (rawEmotes) {
        const parsed = JSON.parse(rawEmotes);
        if (Array.isArray(parsed)) {
          savedEmotes = parsed
            .map((x) => sanitizeEmoteName(String(x || '')))
            .filter(Boolean);
        }
      }
    } catch {
      // Ignore
    }

    if (steamInputEl) {
      getCfg().attachSteamIdPasteGuard(steamInputEl, {
        onJsonPaste: (text) => openSteamImport(text),
      });
    }

    void getCfg()
      .checkAuthSession(httpShim)
      .then((res) => {
        if (res?.authenticated && res.steamid) {
          authSteamId = res.steamid;
          if (!importSteamId) importSteamId = res.steamid;
        }
      })
      .catch(() => {});

    if (savedEmotes.length > 0) {
      void loadSpriteLookupCatalog();
      void resolveAndSetPalette(savedEmotes.map((cleanName) => ({ cleanName })));
    } else {
      void loadStarterPaletteFromShard();
    }
  });
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if errorMsg}
  <div class="st-alert is-danger" role="alert">
    <span>{errorMsg}</span>
    <button type="button" class="st-btn st-btn-sm" onclick={() => { errorMsg = ''; }}>&times;</button>
  </div>
{/if}

<div class="st-mos-workspace">
  <aside class="st-mos-sidebar" aria-label="Mosaticon Controls">
    <section class="st-panel" style="margin-bottom: 0;">
      <div class="st-deck-group" style="margin-bottom: 8px;">
        <button
          type="button"
          class="st-btn st-btn-sm st-btn-primary"
          onclick={() => fileInputEl?.click()}
        >
          Upload Image
        </button>
        <input
          bind:this={fileInputEl}
          type="file"
          accept="image/*"
          style="display: none;"
          onchange={handleImageUpload}
        />
        <button type="button" class="st-btn st-btn-sm" onclick={applySamplePreset}>
          Sample Image
        </button>
        <button type="button" class="st-btn st-btn-sm" onclick={createBlankCanvas}>
          Blank Canvas
        </button>
      </div>
      <div style="font-size: 11.5px; color: var(--st-text-muted); margin-bottom: 8px;">
        Source: <strong>{srcLabel}</strong>
      </div>

      <div class="st-slider-row" style="margin-bottom: 6px;">
        <label for="st-mos-cols">Width:</label>
        <input
          id="st-mos-cols"
          class="st-slider"
          type="range"
          min="4"
          max="60"
          value={cols}
          aria-valuetext={`${cols} emoticons wide`}
          style:--control-value={cols}
          style:--attr-min={4}
          style:--attr-max={60}
          oninput={(e) => {
            const nextW = Number((e.currentTarget as HTMLInputElement).value);
            const nextH = lockAspect && srcWidth > 0
              ? Math.max(4, Math.min(60, Math.round((nextW * srcHeight) / srcWidth)))
              : rows;
            handleDimensionsChange(nextW, nextH);
          }}
        />
        <span style="font-variant-numeric: tabular-nums;">{cols}</span>
      </div>

      <div class="st-slider-row" style="margin-bottom: 6px;">
        <label for="st-mos-rows">Height:</label>
        <input
          id="st-mos-rows"
          class="st-slider"
          type="range"
          min="4"
          max="60"
          value={rows}
          aria-valuetext={`${rows} emoticons tall`}
          style:--control-value={rows}
          style:--attr-min={4}
          style:--attr-max={60}
          oninput={(e) => {
            const nextH = Number((e.currentTarget as HTMLInputElement).value);
            const nextW = lockAspect && srcHeight > 0
              ? Math.max(4, Math.min(60, Math.round((nextH * srcWidth) / srcHeight)))
              : cols;
            handleDimensionsChange(nextW, nextH);
          }}
        />
        <span style="font-variant-numeric: tabular-nums;">{rows}</span>
      </div>

      <div class="st-slider-row" style="margin-bottom: 8px;">
        <label for="st-mos-quality">Detail:</label>
        <input
          id="st-mos-quality"
          class="st-slider"
          type="range"
          min="1"
          max="3"
          step="1"
          value={quality}
          aria-valuetext={quality === 1 ? 'Fast (1x1)' : (quality === 2 ? 'Balanced (2x2)' : 'Detailed (3x3)')}
          style:--control-value={quality}
          style:--attr-min={1}
          style:--attr-max={3}
          oninput={(e) => {
            quality = Number((e.currentTarget as HTMLInputElement).value) as 1 | 2 | 3;
            runMosaicGenerator();
          }}
        />
        <span>{quality === 1 ? '1x1' : (quality === 2 ? '2x2' : '3x3')}</span>
      </div>

      <div class="st-deck-group" style="font-size: 12px;">
        <label for="st-mos-mode">Match:</label>
        <select
          id="st-mos-mode"
          name="colorMode"
          class="st-select"
          bind:value={colorMode}
          onchange={runMosaicGenerator}
        >
          <option value="lab">CIE Lab</option>
          <option value="rgb">RGB</option>
          <option value="hsl">HSL</option>
        </select>
        <label style="display: inline-flex; align-items: center; gap: 4px;">
          <input type="checkbox" bind:checked={lockAspect} /> Lock ratio
        </label>
      </div>
    </section>

    <section class="st-panel" style="margin-bottom: 0;">
      <div class="st-join" style="display: flex; width: 100%; margin-bottom: 6px;">
        <label class="st-visually-hidden" for="st-mos-steamid">Steam ID</label>
        <input
          id="st-mos-steamid"
          type="text"
          class="st-input"
          style="flex: 1; min-width: 120px;"
          placeholder="SteamID64 or URL"
          bind:this={steamInputEl}
          bind:value={importSteamId}
        />
        <button
          type="button"
          class="st-btn st-btn-primary"
          disabled={fetchingEmotes}
          onclick={fetchOwnedEmotes}
        >
          {fetchingEmotes ? 'Loading...' : 'Fetch'}
        </button>
      </div>
      <div class="st-deck-group" style="margin-bottom: 8px;">
        <button type="button" class="st-btn st-btn-sm" onclick={openSteamImport}>
          Manual import
        </button>
        <button type="button" class="st-btn st-btn-sm" onclick={clearIdbCache}>
          Clear Cache
        </button>
      </div>
      {#if statusMsg}
        <div style="font-size: 11.5px; color: var(--st-text-muted); margin-bottom: 6px;">
          {statusMsg}
        </div>
      {/if}

      <div style="margin-bottom: 6px; display: flex; gap: 6px; align-items: center;">
        <label class="st-visually-hidden" for="st-mos-palfilter">Filter palette</label>
        <input
          id="st-mos-palfilter"
          type="search"
          class="st-input"
          style="flex: 1;"
          placeholder={`Palette (${palette.length} emotes)...`}
          bind:value={paletteFilter}
        />
        <span style="font-size: 11.5px; color: var(--st-text-muted);" title="Selected brush">
          {selectedBrush || '[eraser]'}
        </span>
      </div>

      <div class="st-mos-palette" role="listbox" aria-label="Owned Emoticon Palette">
        <button
          type="button"
          class="st-mos-pal-btn"
          class:is-selected={selectedBrush === ''}
          title="Eraser / Empty cell"
          onclick={() => { selectedBrush = ''; }}
        >
          &empty;
        </button>
        {#each filteredPalette.slice(0, 250) as em (em.name)}
          <button
            type="button"
            class="st-mos-pal-btn"
            class:is-selected={selectedBrush === em.displayName}
            title={em.displayName}
            onclick={() => { selectedBrush = em.displayName; }}
          >
            <span
              class="st-emote-sprite-sm"
              style={getSpriteBackgroundStyle(em.displayName)}
            ></span>
          </button>
        {/each}
      </div>
    </section>

    <section class="st-panel" style="margin-bottom: 0;">
      <div class="st-mos-tools" style="margin-bottom: 8px;">
        <button type="button" class="st-btn st-btn-sm" class:is-pressed={tool === 'pen'} onclick={() => { tool = 'pen'; }}>Pen (Q)</button>
        <button type="button" class="st-btn st-btn-sm" class:is-pressed={tool === 'line'} onclick={() => { tool = 'line'; }}>Line (W)</button>
        <button type="button" class="st-btn st-btn-sm" class:is-pressed={tool === 'rect'} onclick={() => { tool = 'rect'; }}>Rect (E)</button>
        <button type="button" class="st-btn st-btn-sm" class:is-pressed={tool === 'circle'} onclick={() => { tool = 'circle'; }}>Circle (A)</button>
        <button type="button" class="st-btn st-btn-sm" class:is-pressed={tool === 'fill'} onclick={() => { tool = 'fill'; }}>Fill (S)</button>
        <button type="button" class="st-btn st-btn-sm" class:is-pressed={tool === 'move'} onclick={() => { tool = 'move'; }}>Move (D)</button>
        <button
          type="button"
          class="st-btn st-btn-sm"
          onclick={() => {
            pushUndo(grid);
            grid = flipGridHorizontal(grid, cols, rows);
          }}
        >
          Flip H
        </button>
        <button
          type="button"
          class="st-btn st-btn-sm"
          onclick={() => {
            pushUndo(grid);
            grid = flipGridVertical(grid, cols, rows);
          }}
        >
          Flip V
        </button>
        <button
          type="button"
          class="st-btn st-btn-sm"
          disabled={undoStack.length === 0}
          onclick={handleUndo}
        >
          Undo ({undoStack.length})
        </button>
      </div>

      <div class="st-deck-group" style="font-size: 12px; margin-bottom: 8px;">
        {#if tool === 'rect' || tool === 'circle'}
          <label style="display: inline-flex; align-items: center; gap: 4px;">
            <input type="checkbox" bind:checked={filledShape} /> Filled shape
          </label>
        {/if}
        <label style="display: inline-flex; align-items: center; gap: 4px;">
          <input type="checkbox" bind:checked={showGridlines} /> Gridlines
        </label>
      </div>

      <div class="st-deck-group" style="margin-bottom: 8px; font-size: 12px;">
        <label for="st-mos-blank">Blank cell:</label>
        <input
          id="st-mos-blank"
          type="text"
          class="st-input"
          style="width: 150px;"
          bind:value={blankEmote}
        />
      </div>

      <div class="st-deck-group">
        <button type="button" class="st-btn st-btn-sm st-btn-primary" onclick={handleExport}>
          Export Text
        </button>
        <button type="button" class="st-btn st-btn-sm" onclick={() => { importModalOpen = true; }}>
          Import Text
        </button>
        <button type="button" class="st-btn st-btn-sm" onclick={() => { shortcutsDialogOpen = true; }}>
          Shortcuts
        </button>
      </div>
    </section>
  </aside>

  <section class="st-mos-stage" aria-label="Mosaic Canvas">
    <div class="st-deck-row" style="margin-bottom: 8px; font-size: 12px; color: #b7c6d4;">
      <div class="st-deck-group">
        <span>Left-click draw · Right-click erase</span>
        <span class="st-pill">{cols} &times; {rows}</span>
        <span
          class="st-pill"
          style:border-color={charCounts.showcaseOk ? undefined : 'var(--st-danger)'}
          style:color={charCounts.showcaseOk ? undefined : 'var(--st-danger)'}
          title="Steam Profile Showcase limit is 8,000 characters; Comments limit is 800 characters"
        >
          {charCounts.total.toLocaleString()} / {SHOWCASE_LIMIT.toLocaleString()} chars
        </span>
        {#if resolvingColors}
          <span class="st-pill is-loading">Resolving colors...</span>
        {/if}
        {#if hoverInfo}
          <span style="color: #8fd3ff;">{hoverInfo}</span>
        {/if}
      </div>
      <div class="st-deck-group">
        <label for="st-mos-zoom">Zoom:</label>
        <select id="st-mos-zoom" name="zoom" class="st-select" bind:value={cellPx}>
          <option value={14}>14px</option>
          <option value={20}>20px (1:1)</option>
          <option value={24}>24px</option>
        </select>
      </div>
    </div>

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="st-mos-grid"
      class:has-gridlines={showGridlines}
      aria-label="Emoticon Mosaic Canvas"
      style:grid-template-columns={`repeat(${cols}, ${cellPx}px)`}
      style:--cell-px={`${cellPx}px`}
      oncontextmenu={(e) => e.preventDefault()}
      onpointerdown={handleGridPointerDown}
      onpointermove={handleGridPointerMove}
      onpointerup={handleGridPointerUp}
      onpointercancel={handleGridPointerUp}
      onpointerleave={() => { hoverInfo = ''; }}
    >
      {#each displayedGrid as cell, idx (idx)}
        <div
          class="st-mos-cell"
          class:is-empty={!cell}
          data-cell-idx={idx}
          style={cell ? getSpriteBackgroundStyle(cell, cellPx) : ''}
        ></div>
      {/each}
    </div>
  </section>
</div>

<dialog
  class="st-dialog"
  closedby="any"
  bind:this={importDialogEl}
  use:enhanceModalDialog
  onclose={() => { importModalOpen = false; }}
>
  <div class="st-dialog-head">
    <h2 class="st-dialog-title">Import Existing Mosaic Text</h2>
    <button type="button" class="st-btn st-btn-sm" onclick={() => { importModalOpen = false; }} aria-label="Close">
      &times;
    </button>
  </div>
  <div class="st-dialog-body">
    <p style="margin-top: 0; font-size: 12.5px; color: var(--st-text-muted);">
      Paste an exported Steam mosaic using <code>:emoticon:</code> or <code>&#x02D0;emoticon&#x02D0;</code> codes.
    </p>
    <textarea
      class="st-input"
      style="width: 100%; height: 180px; padding: 8px; font-family: monospace; resize: vertical;"
      placeholder=":steamhappy::steamhappy::steamhappy:"
      bind:value={importPasteText}
    ></textarea>
    <div style="margin-top: 10px; display: flex; justify-content: flex-end; gap: 8px;">
      <button type="button" class="st-btn st-btn-sm" onclick={() => { importModalOpen = false; }}>
        Cancel
      </button>
      <button type="button" class="st-btn st-btn-sm st-btn-primary" onclick={handleApplyImportText}>
        Load into Canvas
      </button>
    </div>
  </div>
</dialog>

<dialog
  class="st-dialog is-compact"
  closedby="any"
  bind:this={shortcutsDialogEl}
  use:enhanceModalDialog
  onclose={() => { shortcutsDialogOpen = false; }}
>
  <div class="st-dialog-head">
    <h2 class="st-dialog-title">Keyboard Shortcuts</h2>
    <button type="button" class="st-btn st-btn-sm" onclick={() => { shortcutsDialogOpen = false; }} aria-label="Close">
      &times;
    </button>
  </div>
  <div class="st-dialog-body">
    <div class="st-shortcuts-list">
      <kbd class="st-kbd">Q</kbd><span>Pen tool (left draw, right erase)</span>
      <kbd class="st-kbd">W</kbd><span>Line tool</span>
      <kbd class="st-kbd">E</kbd><span>Rectangle tool</span>
      <kbd class="st-kbd">A</kbd><span>Circle / Ellipse tool</span>
      <kbd class="st-kbd">S</kbd><span>Flood Fill tool</span>
      <kbd class="st-kbd">D</kbd><span>Move / Shift grid tool</span>
      <kbd class="st-kbd">H / V</kbd><span>Flip horizontally / vertically</span>
      <kbd class="st-kbd">Ctrl + Z</kbd><span>Undo (up to 30 steps)</span>
    </div>
  </div>
</dialog>
