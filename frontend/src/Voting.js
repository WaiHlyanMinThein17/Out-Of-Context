import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const tok = {
  bg: '#030a16',
  border: '#0f2040',
  borderBright: '#1a3560',
  cyan: '#94d2ff',
  cyanDim: 'rgba(148,210,255,0.35)',
  cyanFaint: 'rgba(148,210,255,0.08)',
  text: '#c8dff8',
  textDim: 'rgba(148,210,255,0.45)',
  blue: '#2563eb',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#f59e0b',
  font: '"Courier New", Courier, monospace',
};

const sharedStyles = `
  @keyframes twinkle { 0%,100%{opacity:0.1} 50%{opacity:0.5} }
  @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.9} }
  @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes glowPulse {
    0%, 100% { box-shadow: 0 0 20px rgba(148,210,255,0.2); }
    50% { box-shadow: 0 0 40px rgba(148,210,255,0.5); }
  }
  @keyframes voteReveal {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes countdownUrgent {
    0%, 100% { color: #94d2ff; }
    50% { color: #ef4444; text-shadow: 0 0 20px rgba(239,68,68,0.8); }
  }
  @keyframes floatToSpace {
    0% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 1; filter: blur(0px); }
    30% { transform: translateY(-100px) translateX(50px) rotate(15deg); opacity: 0.9; }
    60% { transform: translateY(-300px) translateX(100px) rotate(30deg); opacity: 0.6; filter: blur(2px); }
    100% { transform: translateY(-800px) translateX(200px) rotate(45deg); opacity: 0; filter: blur(8px); }
  }
  @keyframes starTrail {
    0% { opacity: 0; transform: scale(0); }
    50% { opacity: 0.8; transform: scale(1); }
    100% { opacity: 0; transform: scale(0); }
  }
  .float-to-space {
    animation: floatToSpace 2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    position: fixed;
    z-index: 2000;
  }
  .star-trail {
    position: absolute;
    width: 4px;
    height: 4px;
    background: white;
    border-radius: 50%;
    animation: starTrail 0.5s ease-out forwards;
  }
  .vote-card {
    transition: all 0.2s ease;
    cursor: pointer;
    animation: fadeIn 0.3s ease;
  }
  .vote-card:hover:not(.disabled) {
    transform: translateY(-4px);
    border-color: rgba(148,210,255,0.6) !important;
    box-shadow: 0 8px 32px rgba(37,99,235,0.2);
  }
  .vote-card.selected {
    border-color: #22c55e !important;
    background: rgba(34,197,94,0.1) !important;
    box-shadow: 0 0 30px rgba(34,197,94,0.2);
  }
  .results-card { animation: voteReveal 0.4s ease; }
  .imposter-badge { animation: pulse 2s ease-in-out infinite; }
`;

function CrewmateIcon({ color, size = 40, isImposter = false, eliminated = false }) {
  const s = size;
  return (
    <svg width={s} height={s * 1.2} viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="20" cy="30" rx="13" ry="15" fill={eliminated ? '#4a4a4a' : color} />
      <ellipse cx="20" cy="16" rx="11" ry="10" fill={eliminated ? '#4a4a4a' : color} />
      <ellipse cx="21" cy="14" rx="7" ry="5" fill={eliminated ? '#666666' : "#94d2ff"} opacity={eliminated ? 0.5 : 0.9} />
      <rect x="30" y="24" width="7" height="10" rx="3" fill={eliminated ? '#4a4a4a' : color} opacity={eliminated ? 0.5 : 0.85} />
      {isImposter && !eliminated && (
        <>
          <rect x="15" y="38" width="3" height="5" rx="1" fill="#1a1a2e" />
          <rect x="21" y="38" width="3" height="5" rx="1" fill="#1a1a2e" />
          <path d="M26 20 L30 23 L26 26 Z" fill="#ef4444" opacity="0.8" />
        </>
      )}
      {eliminated && (
        <>
          <line x1="12" y1="32" x2="28" y2="40" stroke="#ef4444" strokeWidth="2" />
          <line x1="28" y1="32" x2="12" y2="40" stroke="#ef4444" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}

function Stars() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      {Array.from({ length: 80 }, (_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: ((i * 137.5) % 100) + '%',
          top: ((i * 97.3) % 100) + '%',
          width: i % 5 === 0 ? '2px' : '1px',
          height: i % 5 === 0 ? '2px' : '1px',
          borderRadius: '50%', background: 'white',
          opacity: 0.1 + (i % 4) * 0.08,
          animation: `twinkle ${2 + (i % 3)}s ease-in-out infinite`,
          animationDelay: ((i * 0.3) % 3) + 's',
        }} />
      ))}
    </div>
  );
}

const VOTING_SECONDS = 15;

function Voting({ gameId, myId, onGameEnd, votingStartedAt }) {
  const [selectedVote, setSelectedVote]   = useState(null);
  const [timeLeft, setTimeLeft]           = useState(VOTING_SECONDS);
  const [hasVoted, setHasVoted]           = useState(false);
  const [otherPlayers, setOtherPlayers]   = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [showResults, setShowResults]     = useState(false);
  const [voteTally, setVoteTally]         = useState({});
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [eliminatedPlayer, setEliminatedPlayer] = useState(null);
  const [showEjection, setShowEjection]   = useState(false);
  const [ejectingPlayer, setEjectingPlayer] = useState(null);
  const [winner, setWinner]               = useState(null);
  const [stars, setStars]                 = useState([]);

  useEffect(() => {
    if (!gameId || !myId) return;
    const fetchPlayers = async () => {
      try {
        setLoadingPlayers(true);
        const { data, error } = await supabase
          .from('players')
          .select('user_id, turn_order, Imposter')
          .eq('game_id', gameId);
        if (error) throw error;
        if (data) {
          const others = data.filter(p => p.user_id !== myId);
          setOtherPlayers(others.sort((a, b) => (a.turn_order || 0) - (b.turn_order || 0)));
        }
      } catch (err) {
        console.error('Voting: Error fetching players:', err);
      } finally {
        setLoadingPlayers(false);
      }
    };
    fetchPlayers();
  }, [gameId, myId]);

  const createStarTrail = () => {
    const newStars = [];
    for (let i = 0; i < 20; i++) {
      newStars.push({ id: i, left: Math.random() * 100 + '%', top: Math.random() * 100 + '%', delay: Math.random() * 0.5 });
    }
    setStars(newStars);
    setTimeout(() => setStars([]), 2000);
  };

  const fetchResults = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('user_id, turn_order, amount_votes, Imposter')
        .eq('game_id', gameId);
      if (error) throw error;
      if (data) {
        const counts = {};
        data.forEach(player => { counts[player.user_id] = player.amount_votes || 0; });
        setVoteTally(counts);
        const allPlayers = data.sort((a, b) => (a.turn_order || 0) - (b.turn_order || 0));
        setOtherPlayers(allPlayers);
        const maxVotes  = Math.max(...Object.values(counts), 0);
        const eliminated = allPlayers.find(p => counts[p.user_id] === maxVotes && maxVotes > 0);
        if (eliminated) {
          setEliminatedPlayer(eliminated);
          setEjectingPlayer(eliminated);
          setShowEjection(true);
          createStarTrail();
          setTimeout(() => {
            setWinner(eliminated.Imposter ? 'crewmates' : 'imposter');
            setShowEjection(false);
            setShowResults(true);
          }, 2000);
        } else {
          setShowResults(true);
        }
      }
    } catch (err) {
      console.error("Error fetching results:", err);
    }
  }, [gameId]);

  // ── Server-derived voting timer ──
  useEffect(() => {
    if (!votingStartedAt) return;

    const tick = () => {
      const elapsed   = (Date.now() - new Date(votingStartedAt).getTime()) / 1000;
      const remaining = Math.max(0, VOTING_SECONDS - elapsed);
      setTimeLeft(Math.ceil(remaining));
      return remaining;
    };

    if (tick() <= 0) {
      fetchResults();
      return;
    }

    const interval = setInterval(() => {
      const remaining = tick();
      if (remaining <= 0) {
        clearInterval(interval);
        fetchResults();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [votingStartedAt, fetchResults]);

  const handleSubmitVote = async () => {
    if (!selectedVote || hasVoted || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc('increment_vote', { target_id: selectedVote });
      if (error) throw error;
      setHasVoted(true);
    } catch (err) {
      console.error('Voting Error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPlayerColor = (turnOrder) => {
    const colors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7'];
    return colors[turnOrder % colors.length];
  };

  // Ejection screen
  if (showEjection && ejectingPlayer) {
    return (
      <div style={{ height: '100vh', background: 'radial-gradient(ellipse at 50% 40%, #0a1628 0%, #030a16 60%, #000510 100%)', color: tok.text, fontFamily: tok.font, position: 'relative', overflow: 'hidden' }}>
        <Stars />
        <style>{sharedStyles}</style>
        {stars.map(star => (
          <div key={star.id} className="star-trail" style={{ left: star.left, top: star.top, animationDelay: `${star.delay}s` }} />
        ))}
        <div className="float-to-space" style={{ position: 'absolute', bottom: '20%', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', zIndex: 2000 }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '200px', height: '200px', borderRadius: '50%', background: `radial-gradient(circle, ${ejectingPlayer.Imposter ? 'rgba(239,68,68,0.3)' : 'rgba(148,210,255,0.3)'}, transparent 70%)`, animation: 'pulse 1s ease-out' }} />
          <div style={{ marginBottom: '20px', position: 'relative' }}>
            <CrewmateIcon color={getPlayerColor(ejectingPlayer.turn_order)} size={120} isImposter={ejectingPlayer.Imposter} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: '900', letterSpacing: '4px', color: ejectingPlayer.Imposter ? tok.red : tok.cyan, textShadow: `0 0 30px ${ejectingPlayer.Imposter ? 'rgba(239,68,68,0.8)' : 'rgba(148,210,255,0.8)'}`, marginBottom: '8px' }}>
            PLAYER {ejectingPlayer.turn_order + 1}
          </div>
          <div style={{ fontSize: '20px', letterSpacing: '3px', color: tok.textDim, marginBottom: '12px' }}>
            {ejectingPlayer.Imposter ? '🔴 THE IMPOSTER' : '🟢 CREWMATE'}
          </div>
          <div style={{ fontSize: '14px', letterSpacing: '2px', color: 'rgba(148,210,255,0.6)', animation: 'pulse 1s ease-in-out infinite' }}>FLOATING INTO SPACE...</div>
        </div>
      </div>
    );
  }

  // Results screen
  if (showResults) {
    const sortedResults = [...otherPlayers].sort((a, b) => (voteTally[b.user_id] || 0) - (voteTally[a.user_id] || 0));
    const maxVotes = Math.max(...Object.values(voteTally), 0);
    return (
      <div style={{ height: '100vh', background: 'radial-gradient(ellipse at 50% 40%, #0a1628 0%, #030a16 60%, #000510 100%)', color: tok.text, fontFamily: tok.font, position: 'relative', overflow: 'auto' }}>
        <Stars />
        <style>{sharedStyles}</style>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px', position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px', animation: 'fadeIn 0.5s ease' }}>{winner === 'crewmates' ? '🎉' : '👑'}</div>
            <h1 style={{ margin: 0, fontSize: 'clamp(48px, 8vw, 72px)', fontWeight: '900', letterSpacing: '4px', textTransform: 'uppercase', color: winner === 'crewmates' ? tok.green : tok.red, textShadow: `0 0 60px ${winner === 'crewmates' ? 'rgba(34,197,94,0.8)' : 'rgba(239,68,68,0.8)'}`, animation: 'fadeIn 0.5s ease 0.2s both' }}>
              {winner === 'crewmates' ? 'CREWMATES WIN!' : 'IMPOSTER WINS!'}
            </h1>
            <div style={{ width: '120px', height: '2px', background: `linear-gradient(90deg, transparent, ${winner === 'crewmates' ? tok.green : tok.red}, transparent)`, margin: '24px auto', animation: 'fadeIn 0.5s ease 0.4s both' }} />
          </div>
          {eliminatedPlayer && (
            <div style={{ background: 'rgba(6,15,31,0.8)', border: `1px solid ${eliminatedPlayer.Imposter ? tok.red : tok.borderBright}`, borderRadius: '12px', padding: '24px', marginBottom: '32px', textAlign: 'center', animation: 'fadeIn 0.5s ease 0.6s both' }}>
              <div style={{ fontSize: '14px', color: tok.textDim, marginBottom: '12px' }}>THE CREW VOTED TO EJECT</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                <CrewmateIcon color={getPlayerColor(eliminatedPlayer.turn_order)} size={64} isImposter={eliminatedPlayer.Imposter} />
                <div>
                  <div style={{ fontSize: '28px', fontWeight: '900', letterSpacing: '2px' }}>PLAYER {eliminatedPlayer.turn_order + 1}</div>
                  <div style={{ fontSize: '14px', color: eliminatedPlayer.Imposter ? tok.red : tok.green, marginTop: '4px' }}>{eliminatedPlayer.Imposter ? '🔴 IMPOSTER' : '🟢 CREWMATE'}</div>
                </div>
              </div>
            </div>
          )}
          <div style={{ marginBottom: '32px', animation: 'fadeIn 0.5s ease 0.8s both' }}>
            <div style={{ fontSize: '12px', letterSpacing: '3px', color: tok.textDim, textAlign: 'center', marginBottom: '16px' }}>FINAL VOTE COUNT</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sortedResults.map((player, index) => {
                const votes     = voteTally[player.user_id] || 0;
                const isHighest = votes === maxVotes && maxVotes > 0;
                return (
                  <div key={player.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(6,15,31,0.6)', border: `1px solid ${isHighest ? (player.Imposter ? tok.red : tok.yellow) : tok.border}`, borderRadius: '8px', padding: '12px 20px', animation: `fadeIn 0.3s ease ${1 + index * 0.1}s both` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <CrewmateIcon color={getPlayerColor(player.turn_order)} size={32} />
                      <span style={{ fontSize: '16px', fontWeight: '700' }}>PLAYER {player.turn_order + 1}</span>
                      {player.Imposter && <span style={{ fontSize: '10px', color: tok.red, border: `1px solid ${tok.red}`, padding: '2px 8px', borderRadius: '4px' }}>IMPOSTER</span>}
                    </div>
                    <span style={{ fontSize: '24px', fontWeight: '900', color: isHighest ? (player.Imposter ? tok.red : tok.yellow) : tok.cyan }}>{votes}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease 1.2s both' }}>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '16px 52px', fontSize: '14px', fontFamily: tok.font, fontWeight: '700', letterSpacing: '4px', textTransform: 'uppercase', cursor: 'pointer', background: winner === 'crewmates' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)', color: winner === 'crewmates' ? tok.green : tok.red, border: `2px solid ${winner === 'crewmates' ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'}`, borderRadius: '8px', transition: 'all 0.2s ease' }}
              onMouseEnter={(e) => { e.target.style.background = winner === 'crewmates' ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'; e.target.style.transform = 'scale(1.05)'; }}
              onMouseLeave={(e) => { e.target.style.background = winner === 'crewmates' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'; e.target.style.transform = 'scale(1)'; }}
            >PLAY AGAIN</button>
          </div>
        </div>
      </div>
    );
  }

  // Voting screen
  return (
    <div style={{ height: '100vh', background: 'radial-gradient(ellipse at 50% 40%, #0a1628 0%, #030a16 60%, #000510 100%)', color: tok.text, fontFamily: tok.font, position: 'relative', overflow: 'auto' }}>
      <Stars />
      <style>{sharedStyles}</style>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ fontSize: '10px', letterSpacing: '6px', color: tok.cyanDim, marginBottom: '12px', textTransform: 'uppercase' }}>THE RECKONING</div>
          <h1 style={{ margin: 0, fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: '900', letterSpacing: '4px', textTransform: 'uppercase', color: 'white', textShadow: '0 0 40px rgba(239,68,68,0.4)' }}>
            VOTE<br /><span style={{ fontSize: '0.5em', letterSpacing: '8px', color: tok.red }}>THE IMPOSTER</span>
          </h1>
          <div style={{ width: '120px', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.4), transparent)', margin: '24px auto' }} />
        </div>

        <div style={{ maxWidth: '400px', margin: '0 auto 40px', background: 'rgba(6,15,31,0.8)', border: `1px solid ${timeLeft <= 5 ? 'rgba(239,68,68,0.4)' : tok.borderBright}`, borderRadius: '8px', padding: '20px', textAlign: 'center', animation: timeLeft <= 5 ? 'glowPulse 1s ease-in-out infinite' : 'none' }}>
          <div style={{ fontSize: '11px', letterSpacing: '3px', color: tok.textDim, marginBottom: '12px' }}>TIME REMAINING</div>
          <div style={{ fontSize: '48px', fontWeight: '900', letterSpacing: '4px', fontVariantNumeric: 'tabular-nums', color: timeLeft <= 5 ? tok.red : tok.cyan, textShadow: timeLeft <= 5 ? '0 0 30px rgba(239,68,68,0.6)' : '0 0 20px rgba(148,210,255,0.4)', animation: timeLeft <= 5 ? 'countdownUrgent 0.5s ease-in-out infinite' : 'none' }}>
            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
          </div>
          {hasVoted && (
            <div style={{ marginTop: '16px', fontSize: '11px', color: tok.green, letterSpacing: '2px', borderTop: `1px solid ${tok.border}`, paddingTop: '12px' }}>
              ✓ VOTE CAST - WAITING FOR OTHERS
            </div>
          )}
        </div>

        {loadingPlayers ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <div style={{ width: '40px', height: '40px', border: `2px solid ${tok.border}`, borderTop: `2px solid ${tok.cyan}`, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ fontSize: '11px', letterSpacing: '3px', color: tok.textDim }}>LOADING PLAYERS...</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px', marginBottom: '40px' }}>
              {otherPlayers.map((player) => {
                const isSelected   = selectedVote === player.user_id;
                const playerColor  = getPlayerColor(player.turn_order);
                return (
                  <div
                    key={player.user_id}
                    className={`vote-card ${hasVoted ? 'disabled' : ''}`}
                    onClick={() => !hasVoted && setSelectedVote(player.user_id)}
                    style={{ background: isSelected ? 'rgba(34,197,94,0.05)' : 'rgba(6,15,31,0.6)', border: `2px solid ${isSelected ? tok.green : tok.border}`, borderRadius: '12px', padding: '24px', textAlign: 'center', cursor: hasVoted ? 'default' : 'pointer', position: 'relative', overflow: 'hidden' }}
                  >
                    {isSelected && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle, rgba(34,197,94,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />}
                    <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                      <CrewmateIcon color={playerColor} size={64} />
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '700', letterSpacing: '2px', marginBottom: '8px' }}>PLAYER {player.turn_order + 1}</div>
                    {isSelected && !hasVoted && <div style={{ marginTop: '16px', fontSize: '11px', color: tok.green, letterSpacing: '2px' }}>✓ SELECTED</div>}
                  </div>
                );
              })}
            </div>
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={handleSubmitVote}
                disabled={!selectedVote || hasVoted || isSubmitting}
                style={{ padding: '16px 52px', fontSize: '14px', fontFamily: tok.font, fontWeight: '700', letterSpacing: '4px', textTransform: 'uppercase', cursor: (!selectedVote || hasVoted || isSubmitting) ? 'not-allowed' : 'pointer', background: (!selectedVote || hasVoted || isSubmitting) ? 'rgba(148,210,255,0.1)' : 'rgba(34,197,94,0.2)', color: (!selectedVote || hasVoted || isSubmitting) ? tok.textDim : tok.green, border: `1px solid ${(!selectedVote || hasVoted || isSubmitting) ? tok.border : 'rgba(34,197,94,0.5)'}`, borderRadius: '4px', transition: 'all 0.2s ease', minWidth: '240px' }}
              >
                {isSubmitting ? 'CONFIRMING...' : hasVoted ? 'VOTE CONFIRMED' : 'CONFIRM VOTE'}
              </button>
            </div>
            <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '10px', color: tok.textDim, letterSpacing: '2px' }}>
              {!hasVoted ? 'SELECT A SUSPECT TO ELIMINATE' : 'AWAITING OTHER PLAYERS...'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Voting;