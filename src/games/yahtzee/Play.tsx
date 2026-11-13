import { useState } from 'react';
import { other, PLAYERS, PLAYER_NAME, type Player } from '../../logic/types';
import { formatDate, formatDateTime } from '../../logic/time';
import { Confirm } from '../../ui/Confirm';
import { Modal } from '../../ui/Modal';
import type { AppData } from '../types';
import {
  BOX_RULES, FIXED, LABELS, LOWER, UPPER, faceOf, isOpen, options, totals, validateManual, YAHTZEE_BONUS,
  type Category,
} from './scoring';
import {
  addDie, allDice, canRollAgain, canUndo, clearDice, commitTurn, currentPlayer, currentThrow, editEntry, keepDie,
  lastUndoLabel, newGame, releaseDie, removeLastDie, rollAgain, round, setThrow, standings, undo, ROUNDS,
  type Turn, type YGame,
} from './game';
import { CardList, Die } from './CardList';
import { useYahtzee, type YahtzeeResult } from './useYahtzee';

export function YahtzeePlay({ d }: { d: AppData }) {
  const y = useYahtzee(d);
  const [finishedId, setFinishedId] = useState<string | null>(null);
  const finished = finishedId ? y.results.find((r) => r.id === finishedId) : undefined;

  if (y.game) return <TurnView d={d} y={y} game={y.game} onFinished={setFinishedId} />;
  if (finished) return <ResultView d={d} result={finished} onDone={() => setFinishedId(null)} />;
  return <StartView d={d} y={y} />;
}

type Y = ReturnType<typeof useYahtzee>;

function scoreLine(r: YahtzeeResult) {
  return `${PLAYER_NAME.paul} ${r.scores.paul} · ${PLAYER_NAME.bex} ${r.scores.bex}`;
}

function StartView({ d, y }: { d: AppData; y: Y }) {
  const last = [...y.results].sort((a, b) => b.endedAt - a.endedAt)[0];
  const lastFirst = last?.detail.game?.players[0]?.id;
  const [first, setFirst] = useState<Player | null>(lastFirst ? other(lastFirst) : null);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    if (!first || busy) return;
    setBusy(true);
    await d.actions.run(() =>
      d.gameStore.mutate<YGame, never>('yahtzee', 'none', () => ({ state: newGame(first, { settings: y.settings }) })),
    );
    setBusy(false);
  };

  return (
    <div className="stack">
      <section className="card">
        <h2>New Yahtzee game</h2>
        <p className="muted">Paul v Beccs, 13 rounds each. Both phones follow along live.</p>
        <div className="dealer-pick">
          <span>Who goes first?</span>
          <div className="row">
            {PLAYERS.map((p) => (
              <button key={p} className={`btn small ${first === p ? 'primary' : ''}`} onClick={() => setFirst(p)}>
                {PLAYER_NAME[p]}
              </button>
            ))}
          </div>
        </div>
        <button className="btn primary big full" disabled={!first || busy} onClick={start}>
          Start game
        </button>
      </section>
      {last && (
        <section className="card">
          <h2>Last game</h2>
          <p>
            <strong>{last.winner ? `${PLAYER_NAME[last.winner]} won` : 'Tie'}</strong> · {scoreLine(last)}
          </p>
          <p className="muted small">{formatDateTime(last.endedAt)}</p>
        </section>
      )}
    </div>
  );
}

function ResultView({ d, result, onDone }: { d: AppData; result: YahtzeeResult; onDone: () => void }) {
  const game = result.detail.game;
  const reopen = () =>
    game && d.actions.run(() => d.gameStore.reopen('yahtzee', result.id, undo(game))).then((ok) => ok && onDone());
  return (
    <section className="card result">
      <div className="result-emoji">🎲</div>
      <h2>{result.winner ? `${PLAYER_NAME[result.winner]} wins!` : "It's a tie!"}</h2>
      <div className="result-score">
        {result.scores.paul}–{result.scores.bex}
      </div>
      <p className="muted">Game saved.</p>
      <div className="row">
        {game && (
          <button className="btn" onClick={reopen}>
            ↩ Undo last score
          </button>
        )}
        <button className="btn primary" onClick={onDone}>
          Next game
        </button>
      </div>
    </section>
  );
}

function hint(turn: Turn): string {
  const n = currentThrow(turn);
  const entered = allDice(turn).length;
  const kept = turn.kept.length;
  if (entered === 5) {
    return n < 3 ? 'Tap the dice you are keeping, then roll again. Or tap a box to score now.' : 'Last throw. Tap a box to score it.';
  }
  if (n === 1) return 'Enter your 5 dice, or tap a — to type a score.';
  return kept
    ? `Your ${kept} kept ${kept === 1 ? 'die is' : 'dice are'} in. Enter the ${5 - entered} you just threw.`
    : `Enter the ${5 - entered} dice you just threw.`;
}

function TurnView({ d, y, game, onFinished }: { d: AppData; y: Y; game: YGame; onFinished: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [board, setBoard] = useState(false);
  const [manual, setManual] = useState<Category | null>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const player = currentPlayer(game);
  const turn = y.turn;
  const dice = allDice(turn);
  const complete = dice.length === 5;
  const result = complete ? options(player.card, dice, game.settings) : null;
  const byCat = Object.fromEntries((result?.options ?? []).map((o) => [o.category, o]));

  const flash = (msg: string) => {
    setNote(msg);
    window.setTimeout(() => setNote((n) => (n === msg ? null : n)), 4000);
  };

  const go = async (fn: (g: YGame) => YGame, msg?: string) => {
    if (busy) return;
    setBusy(true);
    let id: string | null = null;
    const ok = await d.actions.run(async () => {
      id = await y.change(fn);
    });
    setBusy(false);
    if (ok && msg) flash(msg);
    if (id) onFinished(id);
  };

  const score = (category: Category, opts: { dice?: number[]; score?: number; yahtzeeBonus?: boolean }) => {
    const card = commitTurn(game, category, opts).players[game.current].card;
    go((g) => commitTurn(g, category, opts), `${PLAYER_NAME[player.id]}: ${card[category]} in ${LABELS[category]}`);
  };

  const doUndo = () => {
    const label = lastUndoLabel(game);
    go(undo, `Undid ${label}`);
  };

  const renderBox = (c: Category) => {
    if (!isOpen(player.card, c)) return <span className="box-score done">{player.card[c]}</span>;
    if (!complete) {
      return (
        <button className="box-score manual" disabled={busy} onClick={() => setManual(c)} aria-label={`Type a score for ${LABELS[c]}`}>
          —
        </button>
      );
    }
    const o = byCat[c];
    return (
      <button
        className={`box-score option ${o.best ? 'best' : ''} ${o.score === 0 ? 'zero' : ''}`}
        disabled={!o.allowed || busy}
        onClick={() => score(c, { dice })}
        aria-label={`Score ${o.score} in ${LABELS[c]}`}
      >
        {o.allowed ? o.score : '✕'}
      </button>
    );
  };

  return (
    <div className="stack ygame">
      <section className="card turn-head">
        <div className="turn-title">
          <div className="muted small">
            Round {round(game)} of {ROUNDS}
            {formatDate(game.startedAt) !== formatDate(Date.now()) && ` · started ${formatDate(game.startedAt)}`}
          </div>
          <h2>{PLAYER_NAME[player.id]}'s turn</h2>
        </div>
        <button className="btn small" disabled={!canUndo(game) || busy} onClick={doUndo} aria-label="Undo last score">
          ↩ Undo
        </button>
      </section>

      <div className="player-strip">
        {game.players.map((p, i) => (
          <button key={p.id} className={`chip ${p.id} ${i === game.current ? 'active' : ''}`} onClick={() => setBoard(true)}>
            <span>{PLAYER_NAME[p.id]}</span>
            <span className="num">{totals(p.card).grandTotal}</span>
          </button>
        ))}
        <button className="chip" onClick={() => setBoard(!board)}>
          {board ? 'Hide' : 'Scoreboard'}
        </button>
      </div>

      {board ? (
        <Scoreboard d={d} y={y} game={game} busy={busy} go={go} />
      ) : (
        <>
          <section className="card dice-entry" aria-label="Dice">
            <ThrowCounter turn={turn} set={(n) => y.setTurn((t) => setThrow(t, n))} />
            <DiceTray turn={turn} y={y} />
            <p className="hint">{hint(turn)}</p>
            {result?.yahtzeeBonus && <div className="banner bonus">Yahtzee bonus! +100 is added with whichever box you pick.</div>}
            {result?.reason && <div className="banner joker">{result.reason}</div>}
          </section>
          <CardList card={player.card} renderBox={renderBox} />
          <button className="btn link danger-text" onClick={() => setConfirmAbandon(true)}>
            Abandon game
          </button>
        </>
      )}

      {note && (
        <div className="toast info" role="status" onClick={() => setNote(null)}>
          {note}
        </div>
      )}

      {manual && (
        <ManualEntry
          category={manual}
          name={PLAYER_NAME[player.id]}
          canBonus={player.card.yahtzee === FIXED.yahtzee}
          onCancel={() => setManual(null)}
          onSave={(s, bonus) => {
            setManual(null);
            score(manual, { score: s, yahtzeeBonus: bonus });
          }}
        />
      )}

      {confirmAbandon && (
        <Confirm
          title="Abandon this game?"
          confirmLabel="Abandon"
          danger
          onCancel={() => setConfirmAbandon(false)}
          onConfirm={() => {
            setConfirmAbandon(false);
            d.actions.run(() => d.gameStore.mutate('yahtzee', y.rev, () => ({ state: null })));
          }}
        >
          <p>Both scorecards will be deleted and the game won't count on any leaderboard.</p>
        </Confirm>
      )}
    </div>
  );
}

function ThrowCounter({ turn, set }: { turn: Turn; set: (n: number) => void }) {
  const current = currentThrow(turn);
  return (
    <div className="throws" role="group" aria-label="Throw number">
      <span className="muted">Throw</span>
      {[1, 2, 3].map((n) => (
        <button key={n} className={`throw ${current >= n ? 'on' : ''}`} aria-pressed={current === n} onClick={() => set(n)}>
          {n}
        </button>
      ))}
      <span className="muted">of 3</span>
    </div>
  );
}

function DiceTray({ turn, y }: { turn: Turn; y: Y }) {
  const entered = turn.kept.length + turn.fresh.length;
  const n = currentThrow(turn);
  const slots = [
    ...turn.kept.map((v, i) => (
      <button key={`k${i}`} className="slot filled kept" aria-pressed onClick={() => y.setTurn((t) => releaseDie(t, i))} aria-label={`${v}, kept. Tap to throw it again`}>
        <Die value={v} small />
      </button>
    )),
    ...turn.fresh.map((v, i) => (
      <button key={`f${i}`} className="slot filled" aria-pressed={false} onClick={() => y.setTurn((t) => keepDie(t, i))} aria-label={`${v}. Tap to keep it`}>
        <Die value={v} small />
      </button>
    )),
  ];
  while (slots.length < 5) slots.push(<span key={`e${slots.length}`} className="slot empty" aria-hidden />);

  return (
    <>
      <div className="tray">
        {slots}
        <button className="clear" disabled={turn.fresh.length === 0} onClick={() => y.setTurn(removeLastDie)} aria-label="Take back the last die entered">
          ⌫
        </button>
      </div>
      <div className="tray-meta">
        <span className="muted small">{turn.kept.length ? `Keeping ${turn.kept.length}` : ''}</span>
        {entered > 0 && (
          <button className="link-btn" onClick={() => y.setTurn(clearDice)}>
            Clear all
          </button>
        )}
      </div>
      {entered < 5 ? (
        <div className="pad">
          {[1, 2, 3, 4, 5, 6].map((v) => (
            <button key={v} className="pad-btn" onClick={() => y.setTurn((t) => addDie(t, v))} aria-label={`Add a ${v}`}>
              <Die value={v} />
            </button>
          ))}
        </div>
      ) : (
        n < 3 && (
          <button className="btn primary big full" disabled={!canRollAgain(turn)} onClick={() => y.setTurn(rollAgain)}>
            {turn.kept.length === 5
              ? 'Keeping all 5'
              : turn.kept.length === 0
                ? `Throw ${n + 1}: roll all 5 again`
                : `Throw ${n + 1}: keep ${turn.kept.length}, roll ${5 - turn.kept.length}`}
          </button>
        )
      )}
    </>
  );
}

function ManualEntry({
  category,
  name,
  canBonus,
  onCancel,
  onSave,
  initial,
  title,
}: {
  category: Category;
  name: string;
  canBonus: boolean;
  onCancel: () => void;
  onSave: (score: number, bonus: boolean) => void;
  initial?: number;
  title?: string;
}) {
  const [raw, setRaw] = useState(initial === undefined ? '' : String(initial));
  const [bonus, setBonus] = useState(false);
  const face = faceOf(category);
  const quick = face ? [0, 1, 2, 3, 4, 5].map((n) => n * face) : category in FIXED ? [FIXED[category as keyof typeof FIXED], 0] : null;
  const value = Number(raw);
  const valid = raw.trim() !== '' && Number.isInteger(value) && value >= 0;
  const warning = valid ? validateManual(category, value) : null;

  return (
    <Modal title={title ?? `${LABELS[category]} for ${name}`} onClose={onCancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSave(value, bonus);
        }}
      >
        <p className="muted">{BOX_RULES[category]}</p>
        {quick && (
          <div className="quick">
            {quick.map((v) => (
              <button key={v} type="button" className={`btn small ${raw === String(v) ? 'primary' : ''}`} onClick={() => setRaw(String(v))}>
                {v}
              </button>
            ))}
          </div>
        )}
        <input
          className="score-input"
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          min={0}
          placeholder="Score"
          value={raw}
          autoFocus={!quick}
          onChange={(e) => setRaw(e.target.value)}
          aria-label={`${LABELS[category]} score`}
        />
        {warning && <p className="warning">{warning} Save anyway?</p>}
        {canBonus && (
          <label className="check">
            <input type="checkbox" checked={bonus} onChange={(e) => setBonus(e.target.checked)} /> This was a repeat Yahtzee (+100 bonus)
          </label>
        )}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn primary" disabled={!valid}>
            {warning ? 'Save anyway' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Both cards side by side. Tapping a filled score edits it. */
function Scoreboard({ game, busy, go }: { d: AppData; y: Y; game: YGame; busy: boolean; go: (fn: (g: YGame) => YGame, msg?: string) => void }) {
  const [edit, setEdit] = useState<{ index: number; category: Category } | null>(null);
  const [bonusFor, setBonusFor] = useState<{ index: number; delta: 1 | -1 } | null>(null);
  const all = game.players.map((p) => ({ ...p, t: totals(p.card) }));
  const ranks = new Map(standings(game).map((s) => [s.player, s.rank]));

  const boxRow = (c: Category) => (
    <tr key={c}>
      <th scope="row">{LABELS[c]}</th>
      {all.map((p, i) => (
        <td key={p.id} className={i === game.current ? 'current' : ''}>
          {isOpen(p.card, c) ? (
            ''
          ) : (
            <button className="cell-btn" disabled={busy} onClick={() => setEdit({ index: i, category: c })}>
              {p.card[c]}
            </button>
          )}
        </td>
      ))}
    </tr>
  );
  const totalRow = (label: string, pick: (t: (typeof all)[number]['t']) => number, cls = 'total') => (
    <tr className={cls}>
      <th scope="row">{label}</th>
      {all.map((p) => (
        <td key={p.id}>{pick(p.t)}</td>
      ))}
    </tr>
  );

  return (
    <section className="card">
      <table className="yboard">
        <thead>
          <tr>
            <th />
            {all.map((p, i) => (
              <th key={p.id} className={`${p.id} ${i === game.current ? 'current' : ''}`}>
                {PLAYER_NAME[p.id]}
                {ranks.get(p.id) === 1 && all.some((q) => q.t.grandTotal > 0) ? ' ★' : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {UPPER.map(boxRow)}
          {totalRow('Upper total', (t) => t.upperTotal)}
          {totalRow('Bonus', (t) => t.upperBonus)}
          {LOWER.map(boxRow)}
          <tr className="total">
            <th scope="row">Yahtzee bonus</th>
            {all.map((p, i) => (
              <td key={p.id}>
                <span className="bonus-step">
                  <button className="cell-btn" disabled={busy || p.card.yahtzeeBonusCount === 0} onClick={() => setBonusFor({ index: i, delta: -1 })} aria-label="Remove a Yahtzee bonus">
                    −
                  </button>
                  {p.t.yahtzeeBonusTotal}
                  <button className="cell-btn" disabled={busy} onClick={() => setBonusFor({ index: i, delta: 1 })} aria-label="Add a Yahtzee bonus">
                    +
                  </button>
                </span>
              </td>
            ))}
          </tr>
          {totalRow('Grand total', (t) => t.grandTotal, 'total grand')}
        </tbody>
      </table>
      <p className="muted small">Tap a score to change it. Changes can be undone.</p>

      {edit && (
        <ManualEntry
          category={edit.category}
          name={PLAYER_NAME[game.players[edit.index].id]}
          canBonus={false}
          initial={game.players[edit.index].card[edit.category] ?? 0}
          title={`Change ${PLAYER_NAME[game.players[edit.index].id]}'s ${LABELS[edit.category]}`}
          onCancel={() => setEdit(null)}
          onSave={(v) => {
            const { index, category } = edit;
            setEdit(null);
            if (v !== game.players[index].card[category]) go((g) => editEntry(g, index, category, v), `Changed ${LABELS[category]} to ${v}`);
          }}
        />
      )}

      {bonusFor && (
        <Confirm
          title={bonusFor.delta > 0 ? 'Add a Yahtzee bonus?' : 'Remove a Yahtzee bonus?'}
          confirmLabel={bonusFor.delta > 0 ? 'Add' : 'Remove'}
          onCancel={() => setBonusFor(null)}
          onConfirm={() => {
            const { index, delta } = bonusFor;
            setBonusFor(null);
            go((g) => editEntry(g, index, 'yahtzeeBonusCount', g.players[index].card.yahtzeeBonusCount + delta), 'Yahtzee bonus changed');
          }}
        >
          <p>
            {PLAYER_NAME[game.players[bonusFor.index].id]}: {bonusFor.delta > 0 ? '+' : '−'}
            {YAHTZEE_BONUS}
          </p>
        </Confirm>
      )}
    </section>
  );
}

