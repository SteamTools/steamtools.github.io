<script lang="ts">
  import type { Component } from 'svelte';
  import AppShell from './components/AppShell.svelte';
  import { routerStore, type RouteId } from './lib/router.svelte.ts';

  const viewLoaders: Record<RouteId, () => Promise<{ default: Component }>> = {
    hub: () => import('./views/HubView.svelte'),
    cards: () => import('./views/CardsView.svelte'),
    emoticons: () => import('./views/EmoticonsView.svelte'),
    backgrounds: () => import('./views/BackgroundsView.svelte'),
    games: () => import('./views/GamesView.svelte'),
    mosaticon: () => import('./views/MosaticonView.svelte'),
    itemvalue: () => import('./views/ItemValueView.svelte'),
  };

  let activeLoader = $derived(viewLoaders[routerStore.currentRoute] || viewLoaders.hub);
</script>

<AppShell>
  {#await activeLoader()}
    <div class="st-panel" style="text-align: center; padding: 36px 16px; color: var(--st-text-muted);">
      Loading view...
    </div>
  {:then mod}
    {@const ActiveView = mod.default}
    <ActiveView />
  {:catch err}
    <div class="st-alert is-danger" role="alert">
      <span>Failed to load view: {err?.message || 'Unknown error'}</span>
    </div>
  {/await}
</AppShell>
