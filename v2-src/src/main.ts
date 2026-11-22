import { mount } from 'svelte';
import App from './App.svelte';
import { ALL_ROUTES } from './lib/route-logic.ts';
import { routerStore, type RouteId } from './lib/router.svelte.ts';
import { shouldSendToSentry } from './lib/diag-bridge.ts';
import './styles/app.css';

if (typeof HTMLElement !== 'undefined' && !Object.hasOwn(HTMLElement.prototype, 'popover')) {
  void import('@oddbird/popover-polyfill');
}

const target = document.getElementById('app');
const initialAttr = target?.dataset.initialRoute;
const fallbackRoute: RouteId =
  ALL_ROUTES.includes(initialAttr as RouteId) ? (initialAttr as RouteId) : 'hub';

routerStore.init(fallbackRoute);

if (target) {
  mount(App, { target });
}

if (shouldSendToSentry()) {
  void import('./lib/diag-client.ts').then((m) => {
    m.initSentry();
  });
}
