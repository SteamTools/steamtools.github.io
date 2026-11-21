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
  hub: '/v2/',
  cards: '/v2/cards/',
  emoticons: '/v2/emoticons/',
  backgrounds: '/v2/backgrounds/',
  games: '/v2/games/',
  mosaticon: '/v2/mosaticon/',
  itemvalue: '/v2/itemvalue/',
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
  hub: '/',
  cards: '/cards/',
  emoticons: '/emoticons/',
  backgrounds: '/backgrounds/',
  games: '/games/',
  mosaticon: '/mosaticon/',
  itemvalue: '/itemvalue/',
};

export function parseRouteFromPathname(pathname: string, fallback: RouteId = 'hub'): RouteId {
  const clean = String(pathname || '/').replace(/\/+$/, '');
  if (clean === '/v2/cards' || clean === '/v2/cards/index.html') return 'cards';
  if (clean === '/v2/emoticons' || clean === '/v2/emoticons/index.html') return 'emoticons';
  if (clean === '/v2/backgrounds' || clean === '/v2/backgrounds/index.html') return 'backgrounds';
  if (clean === '/v2/games' || clean === '/v2/games/index.html') return 'games';
  if (clean === '/v2/mosaticon' || clean === '/v2/mosaticon/index.html') return 'mosaticon';
  if (clean === '/v2/itemvalue' || clean === '/v2/itemvalue/index.html') return 'itemvalue';
  if (clean === '/v2' || clean === '/v2/index.html') return 'hub';
  return fallback;
}
