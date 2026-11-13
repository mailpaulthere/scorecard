import type { GameTab } from '../types';
import { Settings } from '../../ui/Settings';
import { StatusCard } from './StatusCard';
import { Play } from './Play';
import { Leaderboard } from './Leaderboard';
import { History } from './History';

export const cocTab: GameTab = {
  id: 'coc',
  name: 'Champion of Champions',
  short: 'Champions',
  icon: '👑',
  views: [
    { id: 'play', label: 'Play', icon: '🃏' },
    { id: 'board', label: 'Leaderboard', icon: '🏆' },
    { id: 'history', label: 'History', icon: '📜' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ],
  render(view, d) {
    switch (view) {
      case 'board':
        return <Leaderboard matches={d.coc.matches} state={d.cocState} />;
      case 'history':
        return <History store={d.cocStore} matches={d.coc.matches} state={d.cocState} actions={d.actions} />;
      case 'settings':
        return <Settings store={d.cocStore} auth={d.auth} snap={d.coc} actions={d.actions} />;
      default:
        return (
          <>
            <StatusCard state={d.cocState} />
            <Play store={d.cocStore} snap={d.coc} state={d.cocState} actions={d.actions} />
          </>
        );
    }
  },
};
