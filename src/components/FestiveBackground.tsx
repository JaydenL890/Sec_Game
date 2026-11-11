import { useMemo } from 'react';

export function FestiveBackground() {
  const sparkles = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        delay: Math.random() * 3,
        size: Math.random() * 3 + 1.5,
      })),
    [],
  );

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-gradient-to-br from-maroon-950 via-maroon-900 to-maroon-950">
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[60%]"
        style={{ background: 'radial-gradient(ellipse at center, rgba(239,185,40,0.12), transparent 60%)' }}
      />
      <div
        className="absolute bottom-0 left-0 w-[80%] h-[50%]"
        style={{ background: 'radial-gradient(ellipse at left, rgba(249,115,22,0.08), transparent 60%)' }}
      />
      <div
        className="absolute bottom-0 right-0 w-[80%] h-[50%]"
        style={{ background: 'radial-gradient(ellipse at right, rgba(20,184,166,0.06), transparent 60%)' }}
      />

      {sparkles.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full bg-gold-300 animate-sparkle"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDelay: `${s.delay}s`,
            boxShadow: '0 0 6px rgba(251,191,36,0.7)',
          }}
        />
      ))}

      <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-transparent via-gold-500/40 to-transparent" />
      <div className="absolute bottom-0 inset-x-0 h-2 bg-gradient-to-r from-transparent via-marigold-500/40 to-transparent" />
    </div>
  );
}
