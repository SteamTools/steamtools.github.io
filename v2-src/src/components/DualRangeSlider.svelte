<script lang="ts">
  interface Props {
    id: string;
    label: string;
    minLimit: number;
    maxLimit: number;
    step?: number;
    low: number;
    high: number;
    variant?: 'default' | 'hue' | 'brightness' | 'saturation';
    formatValue?: (v: number, isUpper: boolean) => string;
  }

  let {
    id,
    label,
    minLimit,
    maxLimit,
    step = 1,
    low = $bindable(),
    high = $bindable(),
    variant = 'default',
    formatValue = (v) => String(v),
  }: Props = $props();

  let topThumb = $state<'low' | 'high'>('high');

  let span = $derived(Math.max(1, maxLimit - minLimit));
  let lowPct = $derived(((low - minLimit) / span) * 100);
  let highPct = $derived(((high - minLimit) / span) * 100);
  let lowText = $derived(formatValue(low, false));
  let highText = $derived(formatValue(high, true));

  function handleLowInput(e: Event) {
    const v = Number((e.currentTarget as HTMLInputElement).value);
    low = Math.min(v, high);
    topThumb = 'low';
  }

  function handleHighInput(e: Event) {
    const v = Number((e.currentTarget as HTMLInputElement).value);
    high = Math.max(v, low);
    topThumb = 'high';
  }
</script>

<div class="st-dual-field">
  <div class="st-dual-head">
    <strong>{label}</strong>
    <span style="font-variant-numeric: tabular-nums;">{lowText} – {highText}</span>
  </div>
  <div class="st-dual-track-wrap">
    <div
      class="st-dual-track-bg"
      class:is-hue={variant === 'hue'}
      class:is-brightness={variant === 'brightness'}
      class:is-saturation={variant === 'saturation'}
      aria-hidden="true"
    >
      {#if variant === 'default'}
        <div
          class="st-dual-track-fill"
          style:left={`${lowPct}%`}
          style:width={`${Math.max(0, highPct - lowPct)}%`}
        ></div>
      {:else}
        <div class="st-dual-mask" style:left="0" style:width={`${lowPct}%`}></div>
        <div class="st-dual-mask" style:right="0" style:width={`${Math.max(0, 100 - highPct)}%`}></div>
        <div
          class="st-dual-track-fill"
          style:left={`${lowPct}%`}
          style:width={`${Math.max(0, highPct - lowPct)}%`}
        ></div>
      {/if}
    </div>

    <input
      id={`${id}-min`}
      class="st-dual-input"
      type="range"
      min={minLimit}
      max={maxLimit}
      {step}
      value={low}
      aria-label={`${label} minimum`}
      aria-valuetext={lowText}
      style:--control-value={low}
      style:--attr-min={minLimit}
      style:--attr-max={maxLimit}
      style:z-index={topThumb === 'low' ? 3 : 2}
      oninput={handleLowInput}
    />
    <input
      id={`${id}-max`}
      class="st-dual-input"
      type="range"
      min={minLimit}
      max={maxLimit}
      {step}
      value={high}
      aria-label={`${label} maximum`}
      aria-valuetext={highText}
      style:--control-value={high}
      style:--attr-min={minLimit}
      style:--attr-max={maxLimit}
      style:z-index={topThumb === 'high' ? 3 : 2}
      oninput={handleHighInput}
    />
  </div>
</div>
