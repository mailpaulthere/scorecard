import { describe, expect, it } from 'vitest';
import { addHand, dealerForNewMatch, newMatch, reopen, score, switchDealer, undoHand } from './match';
import { allowedGames, celebrationMessage, gameOptions, reignLabel, replay } from './replay';
import { leaderboard } from './stats';
import { periodStart } from './time';
import type { CompletedMatch, Game, LiveMatch, Player } from './types';

const DAY = 86_400_000;
let t0 = Date.UTC(2026, 0, 5); // a Monday
let seq = 0;

/** Build a 3-1 completed match won by `winner`, one per "day" in call order. */
function m(winner: Player, game: Game, at?: number): CompletedMatch {
  seq++;
  const endedAt = at ?? t0 + seq * DAY;
  const loser: Player = winner === 'paul' ? 'bex' : 'paul';
  return {
    id: `m${String(seq).padStart(3, '0')}`,
    game,
    target: 3,
    winner,
    hands: [winner, loser, winner, winner].map((w, i) => ({ winner: w, dealer: i % 2 ? 'bex' : 'paul', at: endedAt })),
    startedAt: endedAt,
    endedAt,
    nextDealer: 'paul',
  };
}

/** A full run of three matches for one player. */
const fullRun = (p: Player, order: Game[] = ['bastard', 'switch', 'rummy']) => order.map((g) => m(p, g));

describe('runs', () => {
  it('extends a run and wipes the other player on a loss (the brief example)', () => {
    const log = [m('paul', 'bastard'), m('paul', 'switch')];
    expect(replay(log).run).toMatchObject({ holder: 'paul', games: ['bastard', 'switch'] });

    log.push(m('bex', 'rummy'));
    const s = replay(log);
    expect(s.run).toMatchObject({ holder: 'bex', games: ['rummy'] });
    expect(s.champion).toBeNull();
    expect(allowedGames(s).sort()).toEqual(['bastard', 'switch']);
  });

  it('run broken by a loss: match winner starts their own run at 1', () => {
    const s = replay([m('bex', 'switch'), m('bex', 'rummy'), m('paul', 'bastard')]);
    expect(s.run).toEqual({ holder: 'paul', games: ['bastard'], matchIds: [expect.any(String)] });
    expect(s.titles).toHaveLength(0);
  });

  it('a repeated game within a run (left by a deletion) restarts the winner at 1', () => {
    const s = replay([m('paul', 'bastard'), m('paul', 'switch'), m('paul', 'bastard')]);
    expect(s.run).toMatchObject({ holder: 'paul', games: ['bastard'] });
    expect(s.titles).toHaveLength(0);
  });

  it('replays in endedAt order, not array order', () => {
    const a = m('paul', 'bastard');
    const b = m('paul', 'switch');
    const c = m('paul', 'rummy');
    expect(replay([c, a, b]).titles).toHaveLength(1);
  });
});

describe('game picker', () => {
  it('allows any game at the start of history', () => {
    expect(allowedGames(replay([]))).toEqual(['bastard', 'switch', 'rummy']);
  });

  it('only allows games not in the current run, with a reason', () => {
    const s = replay([m('paul', 'bastard'), m('paul', 'switch')]);
    expect(allowedGames(s)).toEqual(['rummy']);
    const opts = gameOptions(s);
    expect(opts.find((o) => o.game === 'bastard')).toEqual({
      game: 'bastard',
      allowed: false,
      reason: "Bastard is already in Paul's run",
    });
  });

  it('allows any game straight after a title', () => {
    const s = replay(fullRun('paul'));
    expect(s.run).toBeNull();
    expect(allowedGames(s)).toEqual(['bastard', 'switch', 'rummy']);
  });
});

describe('titles and reigns', () => {
  it('first title: reign 1, kind first', () => {
    const s = replay(fullRun('bex', ['rummy', 'bastard', 'switch']));
    expect(s.champion).toBe('bex');
    expect(s.reign).toEqual({ paul: 0, bex: 1 });
    expect(s.titles).toHaveLength(1);
    expect(s.titles[0]).toMatchObject({ player: 'bex', reign: 1, kind: 'first' });
    expect(celebrationMessage(s.titles[0])).toBe('Bex is Champion of Champions!');
  });

  it('defence: reign 1 to 2', () => {
    const s = replay([...fullRun('paul'), ...fullRun('paul', ['rummy', 'switch', 'bastard'])]);
    expect(s.champion).toBe('paul');
    expect(s.reign).toEqual({ paul: 2, bex: 0 });
    expect(s.titles[1]).toMatchObject({ kind: 'defence', reign: 2 });
    expect(celebrationMessage(s.titles[1])).toBe('Paul is DOUBLE Champion of Champions!');
  });

  it('title switching hands: old champ to 0, new champ to 1', () => {
    const s = replay([...fullRun('paul'), ...fullRun('paul'), ...fullRun('bex')]);
    expect(s.champion).toBe('bex');
    expect(s.reign).toEqual({ paul: 0, bex: 1 });
    expect(s.titles[2]).toMatchObject({ kind: 'change', from: 'paul', reign: 1 });
    expect(celebrationMessage(s.titles[2])).toBe('Bex takes the crown from Paul!');
  });

  it('a returning champion restarts at reign 1', () => {
    const s = replay([...fullRun('paul'), ...fullRun('paul'), ...fullRun('bex'), ...fullRun('paul')]);
    expect(s.reign).toEqual({ paul: 1, bex: 0 });
    expect(s.titles[3]).toMatchObject({ kind: 'change', from: 'bex', reign: 1 });
  });

  it('a lost match mid-run does not affect the title', () => {
    const s = replay([...fullRun('paul'), m('bex', 'bastard'), m('bex', 'switch'), m('paul', 'rummy')]);
    expect(s.champion).toBe('paul');
    expect(s.reign.paul).toBe(1);
    expect(s.run).toMatchObject({ holder: 'paul', games: ['rummy'] });
  });

  it('labels by reign count', () => {
    expect(reignLabel(1)).toBe('Champion of Champions');
    expect(reignLabel(2)).toBe('Double Champion of Champions');
    expect(reignLabel(3)).toBe('Triple Champion of Champions');
    expect(reignLabel(4)).toBe('Quadruple Champion of Champions');
    expect(reignLabel(5)).toBe('5x Champion of Champions');
    expect(reignLabel(6)).toBe('6x Champion of Champions');
    expect(celebrationMessage({ matchId: 'x', at: 0, player: 'bex', reign: 3, kind: 'defence', runMatchIds: [] })).toBe(
      'Bex is TRIPLE Champion of Champions!',
    );
    expect(celebrationMessage({ matchId: 'x', at: 0, player: 'bex', reign: 7, kind: 'defence', runMatchIds: [] })).toBe(
      'Bex is 7x Champion of Champions!',
    );
  });
});

describe('deleting and abandoning', () => {
  it('deleting a match that triggered a title recalculates everything', () => {
    const log = [...fullRun('paul'), ...fullRun('bex')];
    expect(replay(log).champion).toBe('bex');

    const withoutBexTitle = log.filter((x) => x !== log[5]);
    const s = replay(withoutBexTitle);
    expect(s.champion).toBe('paul');
    expect(s.reign).toEqual({ paul: 1, bex: 0 });
    expect(s.titles).toHaveLength(1);
    expect(s.run).toMatchObject({ holder: 'bex', games: ['bastard', 'switch'] });
    expect(allowedGames(s)).toEqual(['rummy']);

    const withoutFirstTitle = log.filter((x) => x !== log[2]);
    const s2 = replay(withoutFirstTitle);
    // Paul's run is now B,S then Bex's run completes: Bex's title is now her first.
    expect(s2.champion).toBe('bex');
    expect(s2.titles).toHaveLength(1);
    expect(s2.titles[0]).toMatchObject({ kind: 'first', player: 'bex' });
  });

  it('abandoned matches are ignored (they never enter the log)', () => {
    // An abandoned match is deleted from live state and never becomes a CompletedMatch,
    // so starting and abandoning a match leaves replay state unchanged.
    const log = [m('paul', 'bastard')];
    const before = replay(log);
    let live: LiveMatch = newMatch('switch', 3, 'paul', 0);
    live = addHand(live, 'bex', 1).live!;
    live = addHand(live, 'bex', 2).live!;
    // abandon: discard `live`
    expect(replay(log)).toEqual(before);
    expect(before.run).toMatchObject({ holder: 'paul', games: ['bastard'] });
  });
});

describe('match flow', () => {
  it('ends automatically at the target and records hands, dealer rotation and winner', () => {
    let live = newMatch('rummy', 3, 'bex', 100);
    const winners: Player[] = ['paul', 'bex', 'paul'];
    for (const [i, w] of winners.entries()) live = addHand(live, w, 101 + i).live!;
    expect(score(live.hands)).toEqual({ paul: 2, bex: 1 });
    expect(live.hands.map((h) => h.dealer)).toEqual(['bex', 'paul', 'bex']);
    const r = addHand(live, 'paul', 200);
    expect(r.live).toBeNull();
    expect(r.completed).toMatchObject({ game: 'rummy', winner: 'paul', endedAt: 200, target: 3, nextDealer: 'bex' });
    expect(r.completed!.hands).toHaveLength(4);
  });

  it('respects a different target', () => {
    let live = newMatch('rummy', 4, 'bex', 0);
    for (let i = 0; i < 3; i++) live = addHand(live, 'paul', i).live!;
    expect(addHand(live, 'paul', 9).completed?.winner).toBe('paul');
  });

  it('undo restores the score and the dealer; reopen undoes the winning hand', () => {
    let live = newMatch('switch', 3, 'paul', 0);
    live = addHand(live, 'paul', 1).live!;
    live = switchDealer(live); // manual fix: bex was meant to... now paul deals again
    expect(live.nextDealer).toBe('paul');
    live = addHand(live, 'bex', 2).live!;
    live = undoHand(live);
    expect(score(live.hands)).toEqual({ paul: 1, bex: 0 });
    expect(live.nextDealer).toBe('paul');

    live = addHand(live, 'paul', 3).live!;
    const done = addHand(live, 'paul', 4).completed!;
    const reopened = reopen({ ...done, id: 'x' });
    expect(score(reopened.hands)).toEqual({ paul: 2, bex: 0 });
    expect(reopened.nextDealer).toBe(done.hands[2].dealer);
  });

  it('dealer keeps rotating across matches', () => {
    expect(dealerForNewMatch([])).toBeNull();
    const a = { ...m('paul', 'bastard'), nextDealer: 'bex' as Player };
    const b = { ...m('paul', 'switch'), nextDealer: 'paul' as Player };
    expect(dealerForNewMatch([b, a])).toBe('paul');
  });
});

describe('leaderboard and Brisbane periods', () => {
  it('weeks start Monday 00:00 Brisbane time', () => {
    // Sunday 8 Nov 2026 13:00 UTC = Sunday 23:00 Brisbane -> week began Mon 2 Nov 00:00 Brisbane = Sun 1 Nov 14:00 UTC
    expect(periodStart('week', Date.UTC(2026, 10, 8, 13))).toBe(Date.UTC(2026, 10, 1, 14));
    // Sunday 8 Nov 2026 14:00 UTC = Monday 00:00 Brisbane -> new week
    expect(periodStart('week', Date.UTC(2026, 10, 8, 14))).toBe(Date.UTC(2026, 10, 8, 14));
    expect(periodStart('month', Date.UTC(2026, 10, 30, 15))).toBe(Date.UTC(2026, 10, 30, 14)); // 1 Dec Brisbane
    expect(periodStart('year', Date.UTC(2026, 11, 31, 14))).toBe(Date.UTC(2026, 11, 31, 14)); // 1 Jan 2027 Brisbane
  });

  it('counts matches, hands, win %, game breakdown and title stats', () => {
    seq = 0;
    t0 = Date.UTC(2026, 0, 5);
    const log = [...fullRun('paul'), ...fullRun('bex'), m('paul', 'bastard')];
    const now = t0 + 100 * DAY;
    const lb = leaderboard(log, 'all', now);
    expect(lb.matchesPlayed).toBe(7);
    expect(lb.players.paul.matchesWon).toBe(4);
    expect(lb.players.paul.handsWon).toBe(4 * 3 + 3 * 1);
    expect(lb.players.paul.winPct).toBeCloseTo((4 / 7) * 100);
    expect(lb.players.paul.byGame.bastard).toEqual({ matchesWon: 2, handsWon: 6 + 1 });
    expect(lb.players.bex.titleTakes).toBe(1);
    expect(lb.players.paul.titleTakes).toBe(0);
    expect(lb.runsCompletedAllTime).toBe(2);
    expect(lb.longestReignCount).toEqual({ player: 'paul', reign: 1 });
    expect(lb.longestReignDays).toMatchObject({ player: 'bex', current: true });

    const thisYear = leaderboard(log, 'week', now);
    expect(thisYear.matchesPlayed).toBe(0);
    expect(thisYear.players.paul.winPct).toBeNull();
    expect(thisYear.runsCompleted).toBe(0);
    expect(thisYear.runsCompletedAllTime).toBe(2);
  });
});
