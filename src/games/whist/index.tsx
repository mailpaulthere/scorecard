import type { GameTab } from '../types';
import { WhistPlay } from './Play';
import { WhistBoard } from './Board';
import { WhistHistory } from './History';
import { WhistSettings } from './Settings';

export const whistTab: GameTab = {
  id: 'whist',
  name: 'German Whist',
  short: 'Whist',
  icon: '♠️',
  views: [
    { id: 'play', label: 'Play', icon: '🃏' },
    { id: 'board', label: 'Leaderboard', icon: '🏆' },
    { id: 'history', label: 'History', icon: '📜' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ],
  render(view, d) {
    switch (view) {
      case 'board':
        return <WhistBoard d={d} />;
      case 'history':
        return <WhistHistory d={d} />;
      case 'settings':
        return <WhistSettings d={d} />;
      default:
        return <WhistPlay d={d} />;
    }
  },
};
