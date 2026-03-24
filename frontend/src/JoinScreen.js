import React, { useEffect, useRef, useState } from 'react';

const FLOATING_WORDS = [
  'APPLE', 'CASTLE', 'ROCKET', 'TIGER', 'VOLCANO',
  'LAPTOP', 'JUNGLE', 'PIZZA', 'PYRAMID', 'IMPOSTER?',
  'WHO IS IT?', 'TRUST NO ONE', 'BLUFF', 'DECEIVE', 'GUESS',
  'CREWMATE', '???', 'WORD...', 'SPY', 'HIDDEN'
];

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];

function CrewmateIcon({ color, size, isImposter }) {
  const s = size || 36;
  return (
    <svg width={s} height={s * 1.2} viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="20" cy="30" rx="13" ry="15" fill={color} />
      <ellipse cx="20" cy="16" rx="11" ry="10" fill={color} />
      <ellipse cx="21" cy="14" rx="7" ry="5" fill="#94d2ff" opacity="0.9" />
      <rect x="30" y="24" width="7" height="10" rx="3" fill={color} opacity="0.85" />
      {isImposter ? (
        <g>
          <rect x="15" y="38" width="3" height="5" rx="1" fill="#1a1a2e" />
          <rect x="21" y="38" width="3" height="5" rx="1" fill="#1a1a2e" />
        </g>
      ) : null}
    </svg>
  );
}

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

function makeFigures(count, w, h) {
  var result = [];
  for (var i = 0; i < count; i++) {
    var vx = randomBetween(-0.4, 0.4);
    if (vx === 0) vx = 0.2;
    var vy = randomBetween(-0.3, 0.3);
    if (vy === 0) vy = 0.15;
    result.push({
      id: i,
      x: randomBetween(20, w - 80),
      y: randomBetween(20, h - 100),
      vx: vx,
      vy: vy,
      color: COLORS[i % COLORS.length],
      isImposter: i === 3,
      size: randomBetween(28, 46),
      word: FLOATING_WORDS[Math.floor(Math.random() * FLOATING_WORDS.length)],
      showWord: Math.random() > 0.4,
      rotation: randomBetween(-15, 15),
      vr: randomBetween(-0.04, 0.04),
    });
  }
  return result;
}

export default function JoinScreen(props) {
  var onJoin = props.onJoin;
  var loading = props.loading;

  var figuresRef = useRef(null);
  var animRef = useRef(null);
  var dimsRef = useRef({ w: window.innerWidth, h: window.innerHeight });

  var [figures, setFigures] = useState(function() {
    return makeFigures(14, window.innerWidth, window.innerHeight);
  });
  var [pulse, setPulse] = useState(false);

  // Store initial figures in ref too
  useEffect(function() {
    figuresRef.current = makeFigures(14, window.innerWidth, window.innerHeight);
    setFigures(figuresRef.current.slice());

    function handleResize() {
      dimsRef.current = { w: window.innerWidth, h: window.innerHeight };
    }
    window.addEventListener('resize', handleResize);

    var lastTime = performance.now();

    function step(now) {
      var dt = Math.min(now - lastTime, 32);
      lastTime = now;
      var w = dimsRef.current.w;
      var h = dimsRef.current.h;

      var next = figuresRef.current.map(function(f) {
        var x = f.x + f.vx * dt * 0.5;
        var y = f.y + f.vy * dt * 0.5;
        var rotation = f.rotation + f.vr * dt;
        if (x < -60) { x = w + 10; }
        if (x > w + 60) { x = -60; }
        if (y < -80) { y = h + 10; }
        if (y > h + 80) { y = -80; }
        return { id: f.id, x: x, y: y, vx: f.vx, vy: f.vy, color: f.color,
          isImposter: f.isImposter, size: f.size, word: f.word,
          showWord: f.showWord, rotation: rotation, vr: f.vr };
      });

      figuresRef.current = next;
      setFigures(next.slice());
      animRef.current = requestAnimationFrame(step);
    }

    animRef.current = requestAnimationFrame(step);

    return function() {
      window.removeEventListener('resize', handleResize);
      if (animRef.current !== null) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, []);

  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      background: 'radial-gradient(ellipse at 50% 40%, #0a1628 0%, #030a16 60%, #000510 100%)',
      fontFamily: '"Courier New", Courier, monospace',
    }}>

      {/* Stars */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {Array.from({ length: 80 }, function(_, i) {
          return (
            <div key={i} style={{
              position: 'absolute',
              left: ((i * 137.5) % 100) + '%',
              top: ((i * 97.3) % 100) + '%',
              width: i % 5 === 0 ? '2px' : '1px',
              height: i % 5 === 0 ? '2px' : '1px',
              borderRadius: '50%',
              background: 'white',
              opacity: 0.2 + (i % 4) * 0.15,
              animation: 'twinkle ' + (2 + (i % 3)) + 's ease-in-out infinite',
              animationDelay: ((i * 0.3) % 3) + 's',
            }} />
          );
        })}
      </div>

      {/* Background words */}
      {FLOATING_WORDS.slice(0, 10).map(function(w, i) {
        return (
          <div key={i} style={{
            position: 'absolute',
            left: ((i * 10 + 5)) + '%',
            top: ((i * 9 + 8)) + '%',
            fontSize: '11px',
            color: 'rgba(148,210,255,0.06)',
            letterSpacing: '3px',
            pointerEvents: 'none',
            userSelect: 'none',
            transform: 'rotate(' + ((i % 2 === 0 ? 1 : -1) * (i * 7 % 25)) + 'deg)',
          }}>
            {w}
          </div>
        );
      })}

      {/* Glow orbs */}
      <div style={{
        position: 'absolute', top: '20%', left: '15%',
        width: '300px', height: '300px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '25%', right: '10%',
        width: '250px', height: '250px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(239,68,68,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Floating figures */}
      {figures.map(function(f) {
        return (
          <div key={f.id} style={{
            position: 'absolute',
            left: f.x,
            top: f.y,
            transform: 'rotate(' + f.rotation + 'deg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            pointerEvents: 'none',
            userSelect: 'none',
          }}>
            <CrewmateIcon color={f.color} size={f.size} isImposter={f.isImposter} />
            {f.showWord ? (
              <span style={{
                fontSize: '10px',
                color: f.isImposter ? '#ef4444' : 'rgba(148,210,255,0.6)',
                letterSpacing: '1px',
                whiteSpace: 'nowrap',
                textShadow: f.isImposter
                  ? '0 0 8px rgba(239,68,68,0.8)'
                  : '0 0 6px rgba(148,210,255,0.4)',
              }}>
                {f.word}
              </span>
            ) : null}
          </div>
        );
      })}

      {/* Center UI */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        zIndex: 10,
      }}>
        <div style={{
          fontSize: '13px',
          letterSpacing: '6px',
          color: 'rgba(148,210,255,0.5)',
          textTransform: 'uppercase',
          marginBottom: '4px',
        }}>
          A SOCIAL DEDUCTION GAME
        </div>

        <h1 style={{
          margin: 0,
          fontSize: 'clamp(36px, 6vw, 72px)',
          fontWeight: '900',
          letterSpacing: '4px',
          textTransform: 'uppercase',
          color: 'white',
          textShadow: '0 0 40px rgba(37,99,235,0.6), 0 0 80px rgba(37,99,235,0.2)',
          lineHeight: 1.1,
          textAlign: 'center',
        }}>
          THEORY
          <br />
          <span style={{
            fontSize: '0.55em',
            letterSpacing: '12px',
            color: 'rgba(148,210,255,0.8)',
            textShadow: '0 0 20px rgba(148,210,255,0.4)',
          }}>
            OF MIND
          </span>
        </h1>

        <div style={{
          width: '120px',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(148,210,255,0.4), transparent)',
          margin: '8px 0',
        }} />

        <p style={{
          margin: 0,
          fontSize: '13px',
          color: 'rgba(148,210,255,0.45)',
          letterSpacing: '2px',
          textAlign: 'center',
          maxWidth: '280px',
          lineHeight: 1.6,
        }}>
          ONE WORD. FIVE PLAYERS.<br />ONE DOESN'T KNOW IT.
        </p>

        <div style={{ marginTop: '24px' }}>
          <button
            onClick={onJoin}
            disabled={loading}
            onMouseEnter={function() { setPulse(true); }}
            onMouseLeave={function() { setPulse(false); }}
            style={{
              padding: '16px 52px',
              fontSize: '15px',
              fontFamily: '"Courier New", monospace',
              fontWeight: '700',
              letterSpacing: '4px',
              textTransform: 'uppercase',
              cursor: loading ? 'not-allowed' : 'pointer',
              background: pulse ? 'rgba(37,99,235,0.25)' : 'rgba(37,99,235,0.12)',
              color: loading ? 'rgba(148,210,255,0.4)' : '#94d2ff',
              border: '1px solid ' + (pulse ? 'rgba(148,210,255,0.6)' : 'rgba(148,210,255,0.25)'),
              borderRadius: '4px',
              boxShadow: pulse
                ? '0 0 30px rgba(37,99,235,0.4), inset 0 0 20px rgba(37,99,235,0.1)'
                : '0 0 15px rgba(37,99,235,0.15)',
              transition: 'all 0.2s ease',
            }}
          >
            {loading ? 'JOINING...' : 'JOIN SERVER'}
          </button>
        </div>

        <div style={{
          marginTop: '12px',
          fontSize: '11px',
          color: 'rgba(148,210,255,0.2)',
          letterSpacing: '2px',
        }}>
          WAITING FOR 5 PLAYERS
        </div>
      </div>

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}