import { PLAYER_NAME, other } from '../logic/types';
import { makeHandsTab } from './hands/makeTab';

// Paul's rule (Nov 2026): first to N hands won; a push counts for nobody; the dealer swaps every hand.
export const blackjackTab = makeHandsTab({
  id: 'blackjack',
  name: 'Blackjack',
  short: 'Blackjack',
  icon: '🂡',
  tie: 'Push',
  dealerChip: 'deals',
  dealerNote: (d) => `${PLAYER_NAME[d]} is the dealer this hand, ${PLAYER_NAME[other(d)]} plays.`,
  defaults: { mode: 'race', target: 5 },
  modeText: {
    race: { label: 'First to a number of hands', description: 'Tap who won each hand. A push counts for nobody.' },
    bust: { label: 'Chips until someone is bust', description: 'Bet real chips and log each hand. The match ends when you tap who is out of chips.' },
  },
  rules: [
    ['Aim', 'Get closer to 21 than the dealer without going over. Number cards are worth their number, J Q K are 10, an ace is 1 or 11.'],
    ['The deal', 'Player and dealer get two cards each; one of the dealer\'s is face up. A blackjack (ace and a 10-value card) beats any other 21.'],
    ['Player', 'Hit (take a card) or stand. Go over 21 and you bust and lose straight away, even if the dealer busts later.'],
    ['Dealer', 'Draws until 17 or more, then stands. If the dealer busts, the player wins.'],
    ['Result', 'Higher total wins the hand. Equal totals are a push and count for nobody. The dealer swaps every hand.'],
  ],
});
