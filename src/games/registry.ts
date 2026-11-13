import type { GameTab } from './types';
import { cocTab } from './coc';
import { yahtzeeTab } from './yahtzee';
import { whistTab } from './whist';
import { masterTab } from './master';

/** The tabs along the top, in order. Add new games before the Master leaderboard. */
export const TABS: GameTab[] = [cocTab, yahtzeeTab, whistTab, masterTab];
