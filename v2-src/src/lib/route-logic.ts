export type RouteId =
  | 'hub'
  | 'cards'
  | 'emoticons'
  | 'backgrounds'
  | 'games'
  | 'mosaticon'
  | 'itemvalue';

export const ALL_ROUTES: RouteId[] = [
  'hub',
  'cards',
  'emoticons',
  'backgrounds',
  'games',
  'mosaticon',
  'itemvalue',
];

export const ROUTE_PATHS: Record<RouteId, string> = {
  hub: '/',
  cards: '/cards/',
  emoticons: '/emoticons/',
  backgrounds: '/backgrounds/',
  games: '/games/',
  mosaticon: '/mosaticon/',
  itemvalue: '/itemvalue/',
};

export const ROUTE_TITLES: Record<RouteId, string> = {
  hub: 'Steam Tools Hub',
  cards: 'STC Set Prices — steam.tools',
  emoticons: 'EmotesGallery — steam.tools',
  backgrounds: 'BackgroundsGallery — steam.tools',
  games: 'Steam Game Filter — steam.tools',
  mosaticon: 'Mosaticon — steam.tools',
  itemvalue: 'Item Value Sorter — steam.tools',
};

export const V1_PATHS: Record<RouteId, string> = {
  hub: '/v1/',
  cards: '/v1/cards/',
  emoticons: '/v1/emoticons/',
  backgrounds: '/v1/backgrounds/',
  games: '/v1/games/',
  mosaticon: '/v1/mosaticon/',
  itemvalue: '/v1/itemvalue/',
};

export function parseRouteFromPathname(pathname: string, fallback: RouteId = 'hub'): RouteId {
  const clean = String(pathname || '/').replace(/\/+$/, '').replace(/^\/v2(?=\/|$)/, '') || '/';
  if (clean === '/cards' || clean === '/cards/index.html') return 'cards';
  if (clean === '/emoticons' || clean === '/emoticons/index.html') return 'emoticons';
  if (clean === '/backgrounds' || clean === '/backgrounds/index.html') return 'backgrounds';
  if (clean === '/games' || clean === '/games/index.html') return 'games';
  if (clean === '/mosaticon' || clean === '/mosaticon/index.html') return 'mosaticon';
  if (clean === '/itemvalue' || clean === '/itemvalue/index.html') return 'itemvalue';
  if (clean === '/' || clean === '/index.html') return 'hub';
  return fallback;
}
