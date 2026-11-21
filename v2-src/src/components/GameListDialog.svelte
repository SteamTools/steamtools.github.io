<script lang="ts">
  import { enhanceModalDialog } from '../lib/dialog.ts';
  import { matchPastedGames, type RawCardSetEntry } from '../lib/cards-logic.ts';

  interface Props {
    dataLoaded: boolean;
    nameToAppid: Record<string, string>;
    appidToSet: Record<string, RawCardSetEntry>;
    onApply: (appids: string[]) => void;
  }

  let { dataLoaded, nameToAppid, appidToSet, onApply }: Props = $props();

  let dialogEl: HTMLDialogElement | undefined = $state();
  let inputText = $state('');
  let matchedNames = $state<string[]>([]);
  let errorMsg = $state('');

  export function open() {
    inputText = '';
    matchedNames = [];
    errorMsg = '';
    dialogEl?.showModal();
  }

  function handleImport() {
    errorMsg = '';
    if (!dataLoaded) {
      errorMsg = 'Card data not yet loaded...';
      return;
    }
    const { appids, names } = matchPastedGames(inputText, nameToAppid, appidToSet);
    if (appids.length === 0) {
      errorMsg = 'No matching trading-card game names or AppIDs found.';
      return;
    }
    matchedNames = names;
    onApply(appids);
  }
</script>

<dialog
  bind:this={dialogEl}
  use:enhanceModalDialog
  class="st-dialog"
  closedby="any"
  aria-labelledby="game-imp-title"
>
  <div class="st-dialog-head">
    <h2 id="game-imp-title" class="st-dialog-title">Game List Importer</h2>
    <button
      type="button"
      class="st-btn st-btn-sm"
      onclick={() => dialogEl?.close('close')}
      aria-label="Close game list importer"
    >
      &times;
    </button>
  </div>

  <div class="st-dialog-body">
    {#if matchedNames.length === 0}
      <p style="margin: 0;">
        Paste the games you want to mark as owned — either game titles or Steam AppIDs, one per line.
      </p>
      <label for="st-game-list-input" class="st-visually-hidden">Game titles or AppIDs</label>
      <!-- svelte-ignore a11y_autofocus -->
      <textarea
        id="st-game-list-input"
        bind:value={inputText}
        rows="12"
        autofocus
        placeholder="730&#10;Half-Life 2&#10;Portal 2"
        style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--st-border-strong); background: var(--st-surface-alt); color: var(--st-text); font-family: var(--st-font-mono); font-size: 12px;"
      ></textarea>
    {:else}
      <p style="margin: 0; font-weight: 600;">Loaded {matchedNames.length} matching game(s):</p>
      <div style="max-height: 260px; overflow-y: auto; border: 1px solid var(--st-border); border-radius: 4px; padding: 8px; background: var(--st-surface-alt);">
        {#each matchedNames as name}
          <div>{name}</div>
        {/each}
      </div>
    {/if}

    {#if errorMsg}
      <div class="st-alert is-error" role="status" aria-live="polite" style="margin-bottom: 0;">
        {errorMsg}
      </div>
    {/if}
  </div>

  <div class="st-dialog-foot">
    {#if matchedNames.length === 0}
      <button type="button" class="st-btn st-btn-primary" onclick={handleImport}>Import</button>
    {/if}
    <button type="button" class="st-btn" onclick={() => dialogEl?.close('close')}>Close</button>
  </div>
</dialog>
