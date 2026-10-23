import { useMemo, type CSSProperties } from "react";

interface Petal {
  id: number;
  /** Horizontal start position, in percent of the viewport width. */
  left: number;
  size: number;
  aspect: number;
  duration: number;
  delay: number;
  /** Horizontal drift over the whole fall, in px. */
  drift: number;
  spin: number;
  opacity: number;
  variant: 0 | 1;
}

function makePetal(id: number): Petal {
  const duration = 15 + Math.random() * 16; // 15–31s
  return {
    id,
    left: Math.random() * 104 - 2,
    size: 8 + Math.random() * 11, // 8–19px
    aspect: 1 + Math.random() * 0.5,
    duration,
    // Negative delays start petals mid-fall so the screen is never empty.
    delay: -Math.random() * duration,
    drift: (Math.random() - 0.5) * 260, // ±130px
    spin: (Math.random() < 0.5 ? -1 : 1) * (300 + Math.random() * 720),
    opacity: 0.35 + Math.random() * 0.4,
    variant: Math.random() < 0.5 ? 0 : 1,
  };
}

interface Props {
  /** Number of petals on screen. Keep it low — this is ambience, not weather. */
  count?: number;
}

/**
 * Decorative falling cherry-blossom petals. Purely visual: it sits behind the
 * app content, ignores pointer events, and stays still for reduced-motion users.
 */
export default function SakuraLayer({ count = 18 }: Props) {
  const petals = useMemo(
    () => Array.from({ length: count }, (_, index) => makePetal(index)),
    [count],
  );

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {petals.map((petal) => (
        <span
          key={petal.id}
          className={`sakura-petal sakura-petal--${petal.variant}`}
          style={
            {
              left: `${petal.left}%`,
              width: petal.size,
              height: petal.size * petal.aspect,
              animationDuration: `${petal.duration}s`,
              animationDelay: `${petal.delay}s`,
              "--drift": `${petal.drift}px`,
              "--spin": `${petal.spin}deg`,
              "--petal-opacity": petal.opacity,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
