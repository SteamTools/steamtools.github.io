<script lang="ts">
  import { currencyStore } from '../lib/currency.svelte.ts';
  import { enhanceModalDialog } from '../lib/dialog.ts';
  import {
    computeLevelCurve,
    lookupTargetLevel,
    type CardSetRow,
    type LevelCurveResult,
    type LevelPoint,
  } from '../lib/cards-logic.ts';
  import { themeStore } from '../lib/theme.svelte.ts';

  interface Props {
    rows: CardSetRow[];
    userLoaded: boolean;
    hasBadges: boolean;
    userLevel: number;
    userXp: number;
    badgeCount: number;
    badgeUnique: number;
  }

  let { rows, userLoaded, hasBadges, userLevel, userXp, badgeCount, badgeUnique }: Props = $props();

  let dialogEl: HTMLDialogElement | undefined = $state();
  let canvasEl: HTMLCanvasElement | undefined = $state();
  let curve = $state<LevelCurveResult | null>(null);
  let targetLevelInput = $state<number>(100);
  let hoveredPoint = $state<LevelPoint | null>(null);
  let hoverX = $state<number | null>(null);

  let targetLookup = $derived(
    curve ? lookupTargetLevel(curve, targetLevelInput) : null,
  );

  export function open() {
    if (rows.length > 0) {
      const start = userLoaded ? userLevel : 0;
      const computed = computeLevelCurve(rows, start);
      curve = computed;
      targetLevelInput = Math.min(
        computed.maxLevel,
        Math.max(start + 10, start > 0 ? Math.ceil((start + 10) / 10) * 10 : 50),
      );
      hoveredPoint = null;
      hoverX = null;
    } else {
      curve = null;
    }
    dialogEl?.showModal();
    requestAnimationFrame(() => drawChart());
  }

  $effect(() => {
    void themeStore.effectiveScheme;
    void currencyStore.curIndex;
    void currencyStore.revision;
    void hoverX;
    if (dialogEl?.open && curve) {
      drawChart();
    }
  });

  function drawChart() {
    if (!canvasEl || !curve || curve.points.length === 0) return;
    const pts = curve.points;
    const isDark = themeStore.effectiveScheme === 'dark';

    const rect = canvasEl.getBoundingClientRect();
    const cssWidth = Math.max(320, Math.round(rect.width || 620));
    const cssHeight = 320;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvasEl.width = Math.round(cssWidth * dpr);
    canvasEl.height = Math.round(cssHeight * dpr);

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const minLevel = pts[0].level;
    const maxLevel = pts[pts.length - 1].level;
    const levelSpan = Math.max(1, maxLevel - minLevel);

    const minCost = Math.max(0.01, pts[0].cost);
    const maxCost = Math.max(minCost * 10, pts[pts.length - 1].cost);
    const minExp = Math.floor(Math.log10(minCost));
    const maxExp = Math.ceil(Math.log10(maxCost));
    const expSpan = Math.max(1, maxExp - minExp);

    ctx.font = '11px system-ui, -apple-system, sans-serif';
    let maxTickWidth = 60;
    for (let e = minExp; e <= maxExp; e += 1) {
      const label = currencyStore.formatUsd(Math.pow(10, e));
      maxTickWidth = Math.max(maxTickWidth, ctx.measureText(label).width);
    }

    const pad = { left: Math.max(76, Math.ceil(maxTickWidth) + 14), right: 16, top: 14, bottom: 32 };
    const plotW = Math.max(40, cssWidth - pad.left - pad.right);
    const plotH = Math.max(40, cssHeight - pad.top - pad.bottom);

    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const textColor = isDark ? '#b4c0cc' : '#3e464f';
    const gridColor = isDark ? '#2a333f' : '#e0e4e8';
    const axisColor = isDark ? '#4a5565' : '#a8b0b8';
    const lineColor = isDark ? '#5eb6f5' : '#155a9a';
    const fillColor = isDark ? 'rgba(94, 182, 245, 0.16)' : 'rgba(21, 90, 154, 0.14)';

    const xForIndex = (i: number) => pad.left + ((pts[i].level - minLevel) / levelSpan) * plotW;
    const yForCost = (c: number) => {
      const logV = Math.log10(Math.max(0.01, c));
      return pad.top + plotH - ((logV - minExp) / expSpan) * plotH;
    };

    // Horizontal log grid lines
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    for (let e = minExp; e <= maxExp; e += 1) {
      const val = Math.pow(10, e);
      const y = yForCost(val);
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(cssWidth - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.fillText(currencyStore.formatUsd(val), pad.left - 8, y);
    }

    // Vertical level ticks (5 evenly spaced)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const ticks = 5;
    for (let t = 0; t <= ticks; t += 1) {
      const lv = Math.round(minLevel + (levelSpan * t) / ticks);
      const x = pad.left + (plotW * t) / ticks;
      ctx.strokeStyle = gridColor;
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + plotH);
      ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.fillText(String(lv), x, pad.top + plotH + 8);
    }

    // Plot axes
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, pad.top + plotH);
    ctx.lineTo(cssWidth - pad.right, pad.top + plotH);
    ctx.stroke();

    // Area + Curve
    const step = Math.max(1, Math.floor(pts.length / 450));
    ctx.beginPath();
    ctx.moveTo(xForIndex(0), pad.top + plotH);
    for (let i = 0; i < pts.length; i += step) {
      ctx.lineTo(xForIndex(i), yForCost(pts[i].cost));
    }
    ctx.lineTo(xForIndex(pts.length - 1), yForCost(pts[pts.length - 1].cost));
    ctx.lineTo(xForIndex(pts.length - 1), pad.top + plotH);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < pts.length; i += step) {
      const x = xForIndex(i);
      const y = yForCost(pts[i].cost);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(xForIndex(pts.length - 1), yForCost(pts[pts.length - 1].cost));
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Hover crosshair
    if (hoveredPoint) {
      const idx = hoveredPoint.level - minLevel;
      if (idx >= 0 && idx < pts.length) {
        const hx = xForIndex(idx);
        const hy = yForCost(hoveredPoint.cost);
        ctx.strokeStyle = axisColor;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(hx, pad.top);
        ctx.lineTo(hx, pad.top + plotH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = lineColor;
        ctx.beginPath();
        ctx.arc(hx, hy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function handleCanvasMove(ev: PointerEvent) {
    if (!canvasEl || !curve || curve.points.length === 0) return;
    const rect = canvasEl.getBoundingClientRect();
    const padLeft = 74;
    const padRight = 16;
    const plotW = Math.max(40, rect.width - padLeft - padRight);
    const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left - padLeft) / plotW));
    const idx = Math.round(ratio * (curve.points.length - 1));
    hoveredPoint = curve.points[idx] ?? null;
    hoverX = ratio;
  }
</script>

<dialog
  bind:this={dialogEl}
  use:enhanceModalDialog
  class="st-dialog"
  closedby="any"
  aria-labelledby="lvl-calc-title"
  style="width: min(740px, calc(100vw - 24px));"
>
  <div class="st-dialog-head">
    <h2 id="lvl-calc-title" class="st-dialog-title">Level Cost Calculator</h2>
    <button
      type="button"
      class="st-btn st-btn-sm"
      onclick={() => dialogEl?.close('close')}
      aria-label="Close level cost calculator"
    >
      &times;
    </button>
  </div>

  <div class="st-dialog-body">
    <p style="margin: 0; font-size: 12.5px; color: var(--st-text-muted);">
      Approximation built greedily from cheapest remaining Steam trading card sets (excluding infinite sale badges).
      {#if userLoaded && hasBadges}
        Using your current <strong>Level {userLevel}</strong> ({userXp} XP, {badgeCount} badges across {badgeUnique} sets).
      {/if}
    </p>

    {#if curve && curve.points.length > 0}
      <div class="st-deck-row" style="padding: 8px 10px; border: 1px solid var(--st-border); border-radius: 4px; background: var(--st-surface-alt);">
        <div class="st-deck-group">
          <label for="st-target-lvl" style="font-weight: 600;">Target Level:</label>
          <!-- svelte-ignore a11y_autofocus -->
          <input
            id="st-target-lvl"
            type="number"
            class="st-input"
            style="width: 96px;"
            min={curve.startLevel + 1}
            max={curve.maxLevel}
            bind:value={targetLevelInput}
            autofocus
          />
          <span style="font-size: 12px; color: var(--st-text-muted);">
            (range {curve.startLevel + 1}–{curve.maxLevel})
          </span>
        </div>
        <div style="font-size: 13px; font-variant-numeric: tabular-nums;">
          {#if targetLookup}
            <strong>{currencyStore.formatUsd(targetLookup.cost)}</strong>
            <span style="color: var(--st-text-muted);"> ({targetLookup.badges.toLocaleString()} badges)</span>
          {:else}
            <span style="color: var(--st-text-muted);">Enter a target level within range</span>
          {/if}
        </div>
      </div>

      <div style="position: relative;">
        <canvas
          bind:this={canvasEl}
          style="width: 100%; height: 320px; display: block; border: 1px solid var(--st-border); border-radius: 4px; background: var(--st-surface-alt); cursor: crosshair;"
          onpointermove={handleCanvasMove}
          onpointerleave={() => { hoveredPoint = null; hoverX = null; }}
        ></canvas>
      </div>

      <div style="min-height: 20px; font-size: 12.5px; text-align: center; font-variant-numeric: tabular-nums;">
        {#if hoveredPoint}
          <strong>Level {hoveredPoint.level}</strong>:
          {currencyStore.formatUsd(hoveredPoint.cost)}
          ({hoveredPoint.badges.toLocaleString()} badges)
        {:else}
          <span style="color: var(--st-text-muted);">Hover chart to inspect cost at any Steam level.</span>
        {/if}
      </div>
    {:else}
      <div class="st-alert">Set data is still loading or has no craftable levels left.</div>
    {/if}
  </div>

  <div class="st-dialog-foot">
    <button type="button" class="st-btn" onclick={() => dialogEl?.close('close')}>Close</button>
  </div>
</dialog>
