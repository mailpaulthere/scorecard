import { PLAYER_NAME, other } from '../logic/types';
import { makeHandsTab } from './hands/makeTab';

// Paul's rule (Nov 2026): heads-up with real chips; the last one with chips wins the match.
export const holdemTab = makeHandsTab({
  id: 'holdem',
  name: "Texas Hold'em",
  short: "Hold'em",
  icon: '♦️',
  tie: 'Split pot',
  dealerChip: 'button',
  dealerNote: (d) => `${PLAYER_NAME[d]} has the button: posts the small blind and acts first before the flop. ${PLAYER_NAME[other(d)]} posts the big blind.`,
  defaults: { mode: 'bust', target: 10 },
  modeText: {
    bust: { label: 'Last one with chips wins', description: 'Log each hand as you go. The match ends when you tap who is out of chips.' },
    race: { label: 'First to a number of hands', description: 'No chips needed: the first to win this many hands takes the match.' },
  },
  rules: [
    ['Heads-up', 'Each player gets two cards face down. The button posts the small blind, the other player the big blind. The button acts first before the flop and last on every later round.'],
    ['The board', 'Five shared cards come out in three goes: the flop (3), the turn (1) and the river (1), with a round of betting after each.'],
    ['Winning a hand', 'Make the best five-card hand from your two cards and the five on the board, or make the other player fold. Equal hands split the pot.'],
    ['Hand ranks', 'Royal flush, straight flush, four of a kind, full house, flush, straight, three of a kind, two pair, pair, high card.'],
    ['The button', 'Moves every hand. The app tracks it and carries it on to the next match.'],
  ],
});
