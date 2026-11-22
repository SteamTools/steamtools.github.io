import {
  addIntegration,
  feedbackSyncIntegration,
  getFeedback,
} from '@sentry/svelte';
import { currencyStore } from './currency.svelte.ts';
import { routerStore } from './router.svelte.ts';
import { initSentry, updateSentryContext } from './diag-client.ts';
import { registerSentryThemeSync } from './diag-bridge.ts';
import { themeStore } from './theme.svelte.ts';

type FeedbackIntegrationInstance = NonNullable<ReturnType<typeof getFeedback>>;
type FeedbackDialog = Awaited<ReturnType<FeedbackIntegrationInstance['createForm']>>;

let activeDialog: FeedbackDialog | null = null;
let feedbackRegistered = false;

registerSentryThemeSync((scheme) => {
  getFeedback()?.setTheme(scheme);
});

function ensureFeedbackIntegration(): FeedbackIntegrationInstance | undefined {
  if (!feedbackRegistered && !getFeedback()) {
    addIntegration(
      feedbackSyncIntegration({
        id: 'st-feedback-host',
        autoInject: false,
        colorScheme: themeStore.effectiveScheme,
        enableScreenshot: true,
        showBranding: false,
        showName: true,
        isNameRequired: false,
        nameLabel: 'Name (optional)',
        namePlaceholder: 'Steam name or handle',
        showEmail: true,
        isEmailRequired: false,
        emailLabel: 'Email (optional)',
        emailPlaceholder: 'Only if you want a reply',
        formTitle: 'Send Feedback / Report a Bug',
        messageLabel: 'Description',
        messagePlaceholder:
          "What's broken or could be better? Feel free to attach a screenshot below.",
        submitButtonLabel: 'Send Feedback',
        successMessageText: 'Thanks! Your feedback has been sent.',
        themeLight: {
          foreground: '#1c2024',
          background: '#ffffff',
          accentForeground: '#ffffff',
          accentBackground: '#1a66ad',
          successColor: '#1d6f42',
          errorColor: '#b92d27',
          boxShadow: '0 8px 24px rgba(20, 26, 33, 0.35)',
        },
        themeDark: {
          foreground: '#e6ecf2',
          background: '#1d232c',
          accentForeground: '#ffffff',
          accentBackground: '#206eb9',
          successColor: '#54c786',
          errorColor: '#f2746d',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.68)',
        },
        onFormSubmitted: () => {
          if (activeDialog) {
            activeDialog.removeFromDom();
            activeDialog = null;
          }
        },
      }),
    );
    feedbackRegistered = true;
  }
  const instance = getFeedback();
  instance?.setTheme(themeStore.effectiveScheme);
  return instance;
}

export async function openSentryFeedback(): Promise<void> {
  initSentry({ allowLocalPreview: true });
  const feedback = ensureFeedbackIntegration();
  if (!feedback) return;

  const activeCurrency = currencyStore.currencies[currencyStore.curIndex]?.name;
  updateSentryContext({
    route: routerStore.currentRoute,
    theme: themeStore.effectiveScheme,
    currency: activeCurrency,
  });

  if (!activeDialog) {
    activeDialog = await feedback.createForm();
  }
  activeDialog.appendToDom();
  activeDialog.open();
}
