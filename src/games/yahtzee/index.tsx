import type { GameTab } from '../types';
import { YahtzeePlay } from './Play';
import { YahtzeeBoard } from './Board';
import { YahtzeeHistory } from './History';
import { YahtzeeSettings } from './Settings';

export const yahtzeeTab: GameTab = {
  id: 'yahtzee',
  name: 'Yahtzee',
  short: 'Yahtzee',
  icon: '🎲',
  views: [
    { id: 'play', label: 'Play', icon: '🎲' },
    { id: 'board', label: 'Leaderboard', icon: '🏆' },
    { id: 'history', label: 'History', icon: '📜' },
    { id: 'settings', label: 'Rules', icon: '⚙️' },
  ],
  render(view, d) {
    switch (view) {
      case 'board':
        return <YahtzeeBoard d={d} />;
      case 'history':
        return <YahtzeeHistory d={d} />;
      case 'settings':
        return <YahtzeeSettings d={d} />;
      default:
        return <YahtzeePlay d={d} />;
    }
  },
};
