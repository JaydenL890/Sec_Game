import { useEffect, useRef, useState } from 'react';

type Phase = 'countdown' | 'greeting' | 'done';

const COUNTDOWN_STEPS = ['3', '2', '1'];
const STEP_DURATION = 1200;
const GREETING_DURATION = 2000;

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Firework {
  x: number;
  y: number;
  vy: number;
  exploded: boolean;
  sparks: Spark[];
  color: string;
  delay: number;
}

interface FloatingDiya {
  x: number;
  y: number;
  size: number;
  speed: number;
  sway: number;
  swayOffset: number;
  alpha: number;
}

const FIREWORK_COLORS = [
  '#fbbf24', '#f97316', '#ef4444', '#fcd34d',
  '#fb923c', '#fde68a', '#f59e0b',
];

export function DeepavaliIntro({ onComplete }: { onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = window.devicePixelRatio || 1;
    let bgGrad: CanvasGradient;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = window.devicePixelRatio || 1;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = width + 'px';
      canvas!.style.height = height + 'px';
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      bgGrad = ctx!.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#1a0508');
      bgGrad.addColorStop(0.5, '#3a0d16');
      bgGrad.addColorStop(1, '#1a0508');
    }
    resize();
    window.addEventListener('resize', resize);

    // Fewer diyas for performance
    const diyas: FloatingDiya[] = [];
    for (let i = 0; i < 6; i++) {
      diyas.push({
        x: Math.random() * width,
        y: height + Math.random() * 200,
        size: 18 + Math.random() * 18,
        speed: 1.0 + Math.random() * 1.2,
        sway: 12 + Math.random() * 18,
        swayOffset: Math.random() * Math.PI * 2,
        alpha: 0.25 + Math.random() * 0.3,
      });
    }

    // Fewer fireworks, fewer sparks
    const fireworks: Firework[] = [];
    for (let i = 0; i < 3; i++) {
      fireworks.push({
        x: Math.random() * width,
        y: height,
        vy: -(2.5 + Math.random() * 1.5),
        exploded: false,
        sparks: [],
        color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
        delay: i * 1200 + Math.random() * 800,
      });
    }

    function drawDiya(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);

      // Flame glow
      const glowGrad = ctx.createRadialGradient(0, -size * 0.5, 0, 0, -size * 0.5, size * 1.2);
      glowGrad.addColorStop(0, 'rgba(251, 191, 36, 0.5)');
      glowGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, -size * 0.5, size * 1.2, 0, Math.PI * 2);
      ctx.fill();

      // Flame
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.ellipse(0, -size * 0.45, size * 0.18, size * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      ctx.ellipse(0, -size * 0.38, size * 0.12, size * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();

      // Lamp body
      const bodyGrad = ctx.createLinearGradient(0, -size * 0.1, 0, size * 0.4);
      bodyGrad.addColorStop(0, '#c42f3a');
      bodyGrad.addColorStop(1, '#7a1d2b');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.ellipse(0, size * 0.15, size * 0.5, size * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(239, 185, 40, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, size * 0.05, size * 0.5, size * 0.12, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    function updateFireworks(elapsed: number) {
      for (const fw of fireworks) {
        if (elapsed < fw.delay) continue;
        if (!fw.exploded) {
          fw.y += fw.vy;
          fw.vy += 0.02;
          if (fw.vy >= 0 || fw.y < height * 0.25) {
            fw.exploded = true;
            const numSparks = 25;
            for (let i = 0; i < numSparks; i++) {
              const angle = (i / numSparks) * Math.PI * 2;
              const speed = 1.5 + Math.random() * 2.5;
              fw.sparks.push({
                x: fw.x,
                y: fw.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0,
                maxLife: 50 + Math.random() * 20,
                color: fw.color,
                size: 2 + Math.random() * 1.5,
              });
            }
          }
        } else {
          for (const sp of fw.sparks) {
            sp.x += sp.vx;
            sp.y += sp.vy;
            sp.vy += 0.04;
            sp.vx *= 0.98;
            sp.life++;
          }
          if (fw.sparks.every(s => s.life >= s.maxLife)) {
            fw.x = Math.random() * width;
            fw.y = height;
            fw.vy = -(2.5 + Math.random() * 1.5);
            fw.exploded = false;
            fw.sparks = [];
            fw.color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
            fw.delay = elapsed + 800 + Math.random() * 1200;
          }
        }
      }
    }

    function drawFireworks(ctx: CanvasRenderingContext2D) {
      for (const fw of fireworks) {
        if (!fw.exploded) {
          ctx.fillStyle = fw.color;
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.arc(fw.x, fw.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          for (const sp of fw.sparks) {
            const lifeRatio = sp.life / sp.maxLife;
            if (lifeRatio >= 1) continue;
            ctx.globalAlpha = (1 - lifeRatio) * 0.85;
            ctx.fillStyle = sp.color;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, sp.size * (1 - lifeRatio * 0.5), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    function drawText(
      ctx: CanvasRenderingContext2D,
      text: string,
      fontSize: number,
      alpha: number,
      scale: number,
    ) {
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;

      // Glow
      const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, fontSize * 0.8);
      glowGrad.addColorStop(0, `rgba(251, 191, 36, ${alpha * 0.35})`);
      glowGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, fontSize * 0.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = `900 ${fontSize}px "Cinzel", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Shadow
      ctx.fillStyle = 'rgba(58, 13, 22, 0.9)';
      ctx.fillText(text, 3, 3);

      // Gold fill
      const textGrad = ctx.createLinearGradient(0, -fontSize * 0.3, 0, fontSize * 0.3);
      textGrad.addColorStop(0, '#fef3c7');
      textGrad.addColorStop(0.5, '#fbbf24');
      textGrad.addColorStop(1, '#f59e0b');
      ctx.fillStyle = textGrad;
      ctx.fillText(text, 0, 0);

      // Outline
      ctx.strokeStyle = `rgba(255, 248, 231, ${alpha * 0.8})`;
      ctx.lineWidth = 3;
      ctx.strokeText(text, 0, 0);

      ctx.restore();
    }

    function animate(now: number) {
      if (!startTimeRef.current) startTimeRef.current = now;
      const elapsed = now - startTimeRef.current;

      // Background (cached gradient)
      ctx!.fillStyle = bgGrad;
      ctx!.fillRect(0, 0, width, height);

      // Diyas
      for (const d of diyas) {
        d.y -= d.speed;
        d.swayOffset += 0.02;
        if (d.y < -50) {
          d.y = height + 50;
          d.x = Math.random() * width;
        }
        drawDiya(ctx!, d.x + Math.sin(d.swayOffset) * d.sway, d.y, d.size, d.alpha);
      }

      // Fireworks
      updateFireworks(elapsed);
      drawFireworks(ctx!);

      const totalSteps = COUNTDOWN_STEPS.length;
      const countdownEnd = totalSteps * STEP_DURATION;
      const greetingEnd = countdownEnd + GREETING_DURATION;

      if (elapsed < countdownEnd) {
        // Countdown phase
        const stepIdx = Math.floor(elapsed / STEP_DURATION);
        const stepElapsed = elapsed % STEP_DURATION;
        const progress = stepElapsed / STEP_DURATION;

        // Smooth scale: quick pop then stable, no gap
        let scale: number;
        let alpha: number;
        if (progress < 0.15) {
          const p = progress / 0.15;
          scale = 0.4 + p * 0.6;
          alpha = p;
        } else if (progress > 0.85) {
          const p = (progress - 0.85) / 0.15;
          scale = 1 - p * 0.2;
          alpha = 1 - p;
        } else {
          scale = 1;
          alpha = 1;
        }

        const fontSize = Math.min(width, height) * 0.35;
        drawText(ctx!, COUNTDOWN_STEPS[stepIdx], fontSize, alpha, scale);
      } else if (elapsed < greetingEnd) {
        // Greeting phase — starts immediately, no gap
        const progress = Math.min(1, (elapsed - countdownEnd) / 600);
        const fontSize = Math.min(width, height) * 0.1;
        drawText(ctx!, 'Game Start!', fontSize, progress, 1);

        // Subtitle
        ctx!.save();
        ctx!.translate(width / 2, height / 2);
        ctx!.globalAlpha = progress * 0.8;
        const subSize = fontSize * 0.35;
        ctx!.font = `500 ${subSize}px "Cinzel", serif`;
        ctx!.textAlign = 'center';
        ctx!.textBaseline = 'middle';
        ctx!.fillStyle = 'rgba(253, 230, 138, 0.8)';
        ctx!.fillText('Let the festival of lights begin!', 0, fontSize * 0.8);
        ctx!.restore();
        ctx!.globalAlpha = 1;
      } else if (!fading) {
        setFading(true);
        setTimeout(() => onComplete(), 800);
      }

      animationRef.current = requestAnimationFrame(animate);
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [onComplete, fading]);

  function handleSkip() {
    cancelAnimationFrame(animationRef.current);
    onComplete();
  }

  return (
    <div
      className="fixed inset-0 z-[100]"
      style={{
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.8s ease-out',
      }}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
      <button
        onClick={handleSkip}
        className="absolute bottom-4 right-4 text-gold-200/40 hover:text-gold-200/70 transition text-sm font-display"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        Skip →
      </button>
    </div>
  );
}
