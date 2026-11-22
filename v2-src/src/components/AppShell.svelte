<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { isWebviewClient, trackEvent } from '../lib/bridge.ts';
  import { currencyStore } from '../lib/currency.svelte.ts';
  import { routerStore, type RouteId } from '../lib/router.svelte.ts';
  import { syncSentryContext } from '../lib/diag-bridge.ts';
  import { themeStore } from '../lib/theme.svelte.ts';

  let { children }: { children: Snippet } = $props();

  let showWebviewBanner = $state(false);
  let feedbackLoading = $state(false);

  onMount(() => {
    if (isWebviewClient()) {
      try {
        showWebviewBanner = window.sessionStorage.getItem('st_webview_dismissed') !== '1';
      } catch {
        showWebviewBanner = true;
      }
    }
  });

  $effect(() => {
    const route = routerStore.currentRoute;
    const theme = themeStore.effectiveScheme;
    const currency = currencyStore.currencies[currencyStore.curIndex]?.name;
    syncSentryContext({ route, theme, currency });
  });

  async function handleOpenFeedback() {
    if (feedbackLoading) return;
    feedbackLoading = true;
    try {
      const { openSentryFeedback } = await import('../lib/feedback-modal.ts');
      await openSentryFeedback();
    } finally {
      feedbackLoading = false;
    }
  }

  function dismissWebviewBanner() {
    showWebviewBanner = false;
    try {
      window.sessionStorage.setItem('st_webview_dismissed', '1');
    } catch {
      // Ignore storage error
    }
  }

  function handleCurrencyChange(ev: Event) {
    const sel = ev.currentTarget as HTMLSelectElement;
    const nextIdx = Number.parseInt(sel.value, 10);
    currencyStore.setCurrency(nextIdx);
    const curName = currencyStore.currencies[nextIdx]?.name;
    if (curName) {
      trackEvent('currency_change', { app: routerStore.currentRoute, a: curName });
    }
  }

  const v2NavItems: Array<{ route: RouteId; label: string; color: string }> = [
    { route: 'itemvalue', label: 'Item Value', color: 'var(--st-color-itemvalue)' },
    { route: 'cards', label: 'Trading Cards', color: 'var(--st-color-cards)' },
    { route: 'mosaticon', label: 'Mosaticon', color: 'var(--st-color-mosaticon)' },
    { route: 'emoticons', label: 'Emoticons', color: 'var(--st-color-emotes)' },
    { route: 'backgrounds', label: 'Backgrounds', color: 'var(--st-color-bgs)' },
    { route: 'games', label: 'Games', color: 'var(--st-color-games)' },
  ];

  let isHub = $derived(routerStore.currentRoute === 'hub');
</script>

<div id="nn_skinl" class="adswitch_skin"></div>
<div id="nn_skinr" class="adswitch_skin"></div>

<div class="st-shell">
  <header class="st-topbar" class:is-hub={isHub}>
    <div class="st-deck-group">
      <a
        href="/v2/"
        class="st-brand"
        onclick={(e) => routerStore.navigate('hub', e)}
      >
        <svg viewBox="417.5 106.5 2252 1172" width="28" height="15" aria-hidden="true" style="fill: currentColor;">
          <path d="M763.3,291.9c-90.7-0.9-166.4,75.2-166.5,166c-0.1,91.2,73.3,164.7,164.5,164.9c93.1,0.2,166.4-72.2,166.3-164.9 C927.4,359.2,849,292.8,763.3,291.9z"/>
          <path d="M2647.9,525.6c-0.5-8.6-12.7-17-20.8-14.6c-3.9,1.2-8,2.9-10.9,5.5c-12,10.8-23.5,22-35.3,33c-8.7,8.2-17.3,16.5-26.4,24.3 c-17.6,15-35.4,29.9-53.4,44.5c-21.6,17.4-44.2,33.4-69.3,45.3c-14.9,7.1-30.4,9.4-45.9,2.3c-6.2-2.8-11.8-7.3-17.5-11.2 c-18.8-13.1-36.7-27.4-52.9-43.6c-6.3-6.4-12.8-12.7-18.5-19.6c-8.7-10.6-17.4-21.3-25.1-32.7c-11.4-16.8-20.4-34.9-26.8-54.2 c-6.1-18.1-11.7-36.4-10.2-55.8c1-12.4,4.2-24.4,13.2-33.5c10.2-10.4,21-20.2,32-29.9c12.5-11.1,25.3-21.9,38.3-32.4 c15.1-12.3,30.3-24.7,46-36.2c18.3-13.4,37.3-25.9,55.7-39.1c8.4-6.1,15.8-19,11.6-31.1c-1.7-4.8-4.1-9.9-9.4-11.3 c-4.6-1.2-9.5-1.1-14.3-1.2c-9.7-0.2-19.5-0.6-29.2,0.1c-18,1.3-36.1,2.1-53.8,5.3c-45.6,8.1-88.8,24-130.4,44.3 c-30.9,15.1-56.8,29.2-84.9,48.9c-6.2,4.3-25.1,24.4-29.4,30.3c-13,17.7-17.1,23.6-28.8,42.3c-20,32-39.7,64.3-58.8,96.9 c-16.4,28.1-37.1,52.1-63.3,71.1c-14.8,10.8-30.4,20.7-45.9,30.5c-11.1,6.9-22.3,14-34.3,19.1c-130.1,55.4-260.5,110.3-390.5,165.8 c-10.7,4.6-18.9,4.8-29.5-0.6c-36-18.3-74.2-29.5-115-30.2c-2,0-4.5-2-5.8-3.8c-70.1-96.8-140.1-193.6-209.9-290.5 c-3.5-4.9-6.3-10.7-7.7-16.5c-2.3-9-3.4-18.3-4.6-27.5c-1.6-12.4-4.2-33.7-6.5-44c-10.5-46.5-38.5-97.9-77-140.6 c-25.4-28.1-55.7-49.5-88.9-67.1c-34.7-18.4-71.4-30.1-110.4-34.9c-9.1-1.1-18.2-2-27.2-2.9c-11.5-0.3-32.8,0.9-32.8,0.9 c-9.6,1-19.3,1.4-28.8,3.1c-78.3,13.2-145.4,47.7-197.5,108.2c-66.9,77.6-92.1,168.2-76.8,269.2c12.9,84.8,55.7,153,122.6,205.8 c53.8,42.4,116.5,62.6,184.1,68.9c7.8,0.7,15,1.5,21.8,6.7c53.4,40.4,107.3,80.3,160.9,120.4c39,29.2,77.6,58.8,116.9,87.4 c9.2,6.7,13.5,14.6,14.6,25.2c0.9,8.3,1.8,16.6,3.3,24.7c14.9,82.8,59.6,144.1,134.4,182.4c49.2,25.2,101.8,31.4,156.1,22 c62.7-10.8,113.4-42.3,152.7-91.9c24.5-30.9,38.5-67.2,48.5-105c1.4-5.2,3.8-8.1,8.8-10.2c101.6-42.9,203.1-86.1,304.6-129 c52.6-22.2,105.1-44.9,158.2-65.8c40.8-16,83.2-26.9,127.2-29.9c23-1.5,46.1-0.3,68.9,4.5c20.2,4.2,40.4,9,60.7,12.3 c15.8,2.6,32.2,4.6,47.9,5.7c17.6,0.6,36.2,1.8,53.1,0.1c15.2-1.6,40.2-6,53.9-13c27.8-14.2,51-32.7,73.4-54.2 c11.8-11.4,22.9-23.7,33.3-36.3c22.1-26.8,41.3-54.4,57.6-85c16.5-31.1,28.1-62.3,38.5-96C2645.3,550.3,2648.5,537.3,2647.9,525.6z"/>
        </svg>
        <span>steam.tools</span>
        <span class="st-brand-badge">v2</span>
      </a>

      <nav class="st-nav" aria-label="Tools">
        {#each v2NavItems as item}
          <a
            href={routerStore.getPath(item.route)}
            class="st-nav-link"
            class:is-active={routerStore.currentRoute === item.route}
            aria-current={routerStore.currentRoute === item.route ? 'page' : undefined}
            style:--nav-accent={item.color}
            onclick={(e) => routerStore.navigate(item.route, e)}
          >
            <span class="st-nav-dot" aria-hidden="true"></span>
            <span>{item.label}</span>
          </a>
        {/each}
      </nav>
    </div>

    <div class="st-util-group">
      <label class="st-visually-hidden" for="st-global-currency">Currency</label>
      <select
        id="st-global-currency"
        name="currency"
        class="st-select"
        aria-label="Currency"
        value={currencyStore.curIndex}
        onchange={handleCurrencyChange}
      >
        {#each currencyStore.currencies as cur, idx}
          <option value={idx}>{cur.name}</option>
        {/each}
      </select>

      <button
        type="button"
        class="st-btn st-btn-sm st-theme-btn"
        onclick={() => themeStore.toggle()}
        aria-label="Toggle light/dark theme"
        title={themeStore.storedOverride
          ? `Pinned to ${themeStore.storedOverride} theme — click to switch / revert to OS setting`
          : 'Following OS theme — click to switch'}
      >
        <span class="st-theme-label-to-light">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="4"></circle>
            <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"></path>
          </svg>
          <span class="st-visually-hidden">Switch to light theme</span>
        </span>
        <span class="st-theme-label-to-dark">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
          <span class="st-visually-hidden">Switch to dark theme</span>
        </span>
      </button>

      <button
        type="button"
        id="st-feedback-btn"
        class="st-btn st-btn-sm st-feedback-btn"
        disabled={feedbackLoading}
        onclick={handleOpenFeedback}
        aria-label="Report a bug or send feedback"
        title="Report a bug or send feedback with an optional screenshot"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span class="st-feedback-label">{feedbackLoading ? 'Opening...' : 'Feedback'}</span>
      </button>

      <a
        href={routerStore.getClassicUrl(routerStore.currentRoute)}
        class="st-btn st-btn-sm"
        title="Switch back to classic v1 interface"
        onclick={() => trackEvent('classic_switch', { app: routerStore.currentRoute })}
      >
        Classic v1
      </a>
    </div>
  </header>

  <main class="st-sheet" class:is-hub={isHub}>
    {#if showWebviewBanner}
      <div class="st-alert is-warn" role="note">
        <span>
          Using an in-app browser? Steam Sign-In cookies may not persist here — open
          <code>steam.tools</code> in your system browser or use <strong>Import from Steam</strong>.
        </span>
        <button type="button" class="st-btn st-btn-sm" onclick={dismissWebviewBanner}>
          Dismiss
        </button>
      </div>
    {/if}

    <div id="nn_lb1" class="st-ad-lb1"></div>

    {@render children()}
  </main>
</div>
