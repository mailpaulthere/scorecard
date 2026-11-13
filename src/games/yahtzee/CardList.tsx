import { useState, type ReactNode } from 'react';
import { Modal } from '../../ui/Modal';
import {
  BOX_HINTS, BOX_RULES, LABELS, LOWER, UPPER, YAHTZEE_BONUS, isOpen, totals, upperProgress, type Card, type Category,
} from './scoring';

const PIPS: Record<number, number[]> = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };

export function Die({ value, small }: { value: number; small?: boolean }) {
  return (
    <span className={`die ${small ? 'sm' : ''}`} aria-hidden>
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} className={PIPS[value]?.includes(i + 1) ? 'pip' : ''} />
      ))}
    </span>
  );
}

export function paceText(card: Card): string {
  const p = upperProgress(card);
  if (p.secured) return 'Bonus secured';
  if (!p.possible) return 'Bonus out of reach';
  const pace = p.pace === 0 ? 'on pace' : p.pace > 0 ? `+${p.pace} ahead of pace` : `${-p.pace} behind pace`;
  return `${pace} · need ${p.needed}`;
}

/** The scorecard list. renderBox(category) gives the right-hand cell for each box. */
export function CardList({ card, renderBox }: { card: Card; renderBox: (c: Category) => ReactNode }) {
  const [rule, setRule] = useState<Category | null>(null);
  const t = totals(card);

  const row = (c: Category) => (
    <li key={c} className={`box-row ${isOpen(card, c) ? 'open' : 'filled'}`}>
      <button className="box-name" onClick={() => setRule(c)} aria-label={`${LABELS[c]} rule`}>
        <span className="box-label">{LABELS[c]}</span>
        <span className="box-hint">{BOX_HINTS[c]}</span>
      </button>
      {renderBox(c)}
    </li>
  );
  const total = (label: ReactNode, value: ReactNode, cls = '', hint = '') => (
    <li className={`total-row ${cls}`}>
      <span>
        {label}
        {hint && <span className="box-hint">{hint}</span>}
      </span>
      <span className="num">{value}</span>
    </li>
  );
  const marks = card.yahtzeeBonusCount ? ` ${'✓'.repeat(Math.min(card.yahtzeeBonusCount, 6))}${card.yahtzeeBonusCount > 6 ? '…' : ''}` : '';

  return (
    <div className="ycard">
      <div className="section-head">
        <span>Upper section</span>
        <span className="pace">{paceText(card)}</span>
      </div>
      <ul className="box-list">
        {UPPER.map(row)}
        {total('Upper total', t.upperTotal)}
        {total('Bonus', t.upperBonus ? `+${t.upperBonus}` : '0', '', 'Score 35 if upper total is 63 or more')}
        {total('Upper section', t.upperSectionTotal, 'strong')}
      </ul>
      <div className="section-head">
        <span>Lower section</span>
      </div>
      <ul className="box-list">
        {LOWER.map(row)}
        {total(`Yahtzee bonus${marks}`, card.yahtzeeBonusCount ? `+${card.yahtzeeBonusCount * YAHTZEE_BONUS}` : '0', '', '+100 for each extra Yahtzee')}
        {total('Lower section', t.lowerSectionTotal, 'strong')}
      </ul>
      <ul className="box-list grand">{total('Grand total', t.grandTotal, 'grand-total')}</ul>

      {rule && (
        <Modal title={LABELS[rule]} onClose={() => setRule(null)}>
          <p>{BOX_RULES[rule]}</p>
          <div className="modal-actions">
            <button className="btn primary" onClick={() => setRule(null)}>
              Got it
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
