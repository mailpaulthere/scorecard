import type { ReactNode } from 'react';
import type { ReplayState } from '../logic/replay';
import type { AuthApi, Snapshot, Store } from '../data/store';
import type { GameStore, GamesSnapshot } from '../data/games';
import type { Actions } from '../ui/App';

/** Everything a tab can read or change. */
export interface AppData {
  /** Champion of Champions data */
  coc: Snapshot;
  cocState: ReplayState;
  cocStore: Store;
  /** Every other game's data */
  games: GamesSnapshot;
  gameStore: GameStore;
  auth: AuthApi;
  actions: Actions;
}

export interface TabView {
  id: string;
  label: string;
  icon: string;
}

/**
 * One tab along the top of the app. To add a game: write its logic and screens in
 * src/games/<id>/, export a GameTab from its index.tsx and add it to TABS in registry.ts.
 * Games stored through GameStore also need their id in SIMPLE_GAMES (data/games.ts) and firestore.rules.
 */
export interface GameTab {
  id: string;
  name: string;
  /** Short label for the tab bar */
  short: string;
  icon: string;
  views: TabView[];
  render(view: string, data: AppData): ReactNode;
}
