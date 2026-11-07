import { useEffect, useMemo, useRef } from 'react';
import confetti from 'canvas-confetti';
import { celebrationMessage, type TitleEvent } from '../logic/replay';

const BALLOON_COLOURS = ['#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#457b9d', '#9b5de5', '#f15bb5', '#00bbf9'];
const DURATION_MS = 7000;

export function Celebration({ event, onClose }: { event: TitleEvent; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvas.current) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fire = confetti.create(canvas.current, { resize: true, useWorker: true });
    const end = Date.now() + (reduced ? 1500 : DURATION_MS);
    const timers: number[] = [];

    // Opening cannons from both bottom corners.
    fire({ particleCount: 120, angle: 60, spread: 70, origin: { x: 0, y: 0.9 }, startVelocity: 65 });
    fire({ particleCount: 120, angle: 120, spread: 70, origin: { x: 1, y: 0.9 }, startVelocity: 65 });

    if (!reduced) {
      // Fireworks: round bursts at random points in the upper half.
      const burst = () => {
        if (Date.now() > end) return;
        fire({
          particleCount: 70,
          spread: 360,
          startVelocity: 28,
          gravity: 0.7,
          ticks: 90,
          decay: 0.92,
          scalar: 0.9,
          shapes: ['circle'],
          colors: [BALLOON_COLOURS[Math.floor(Math.random() * BALLOON_COLOURS.length)], '#ffffff', '#ffd700'],
          origin: { x: 0.15 + Math.random() * 0.7, y: 0.1 + Math.random() * 0.35 },
        });
        timers.push(window.setTimeout(burst, 350 + Math.random() * 400));
      };
      burst();
      // A gentle confetti shower in between.
      const shower = window.setInterval(() => {
        if (Date.now() > end) return window.clearInterval(shower);
        fire({ particleCount: 6, angle: 90, spread: 120, origin: { x: Math.random(), y: -0.05 }, startVelocity: 10, gravity: 0.6 });
      }, 120);
      timers.push(shower);
    }

    return () => {
      timers.forEach((t) => {
        window.clearTimeout(t);
        window.clearInterval(t);
      });
      fire.reset();
    };
  }, []);

  const balloons = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: 4 + ((i * 37) % 92),
        delay: (i % 7) * 0.45 + Math.random() * 0.4,
        duration: 5 + Math.random() * 3,
        colour: BALLOON_COLOURS[i % BALLOON_COLOURS.length],
        size: 46 + Math.random() * 22,
        sway: (Math.random() * 2 - 1) * 30,
      })),
    [],
  );

  return (
    <div className="celebration" onClick={onClose} role="dialog" aria-label="Celebration">
      <div className="balloons" aria-hidden>
        {balloons.map((b, i) => (
          <span
            key={i}
            className="balloon"
            style={
              {
                left: `${b.left}%`,
                animationDelay: `${b.delay}s`,
                animationDuration: `${b.duration}s`,
                '--c': b.colour,
                '--s': `${b.size}px`,
                '--sway': `${b.sway}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <canvas ref={canvas} className="celebration-canvas" />
      <div className="celebration-text">
        <div className="celebration-crown">👑</div>
        <h1>{celebrationMessage(event)}</h1>
        {event.reign > 1 && <p>Reign count: {event.reign}</p>}
        <p className="tap-hint">Tap anywhere to continue</p>
      </div>
    </div>
  );
}
