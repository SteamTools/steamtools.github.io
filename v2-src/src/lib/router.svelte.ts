import {
  parseRouteFromPathname,
  ROUTE_PATHS,
  ROUTE_TITLES,
  V1_PATHS,
  type RouteId,
} from './route-logic.ts';

export type { RouteId };
export { parseRouteFromPathname };

class RouterStore {
  currentRoute = $state<RouteId>('hub');
  private initialFallback: RouteId = 'hub';

  init(fallback: RouteId): void {
    this.initialFallback = fallback;
    if (typeof window === 'undefined') return;
    this.currentRoute = parseRouteFromPathname(window.location.pathname, fallback);
    document.title = ROUTE_TITLES[this.currentRoute];

    window.addEventListener('popstate', () => {
      this.currentRoute = parseRouteFromPathname(window.location.pathname, this.initialFallback);
      document.title = ROUTE_TITLES[this.currentRoute];
    });
  }

  getPath(route: RouteId): string {
    return ROUTE_PATHS[route];
  }

  getClassicUrl(route: RouteId): string {
    const hasHash =
      route === 'cards' || route === 'itemvalue' || route === 'emoticons' || route === 'backgrounds';
    const hash = typeof window !== 'undefined' && hasHash
      ? window.location.hash
      : '';
    return `${V1_PATHS[route]}${hash}`;
  }

  navigate(route: RouteId, ev?: MouseEvent): void {
    if (ev) {
      if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) {
        return;
      }
      ev.preventDefault();
    }
    const target = ROUTE_PATHS[route];
    if (typeof window !== 'undefined') {
      const curClean = window.location.pathname.replace(/\/+$/, '') + '/';
      if (curClean !== target) {
        window.history.pushState({ route }, '', target);
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
      document.title = ROUTE_TITLES[route];
    }
    this.currentRoute = route;
  }
}

export const routerStore = new RouterStore();
