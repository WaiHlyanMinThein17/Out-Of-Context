import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import Voting from './Voting';
import JoinScreen from './JoinScreen';

const supabase = createClient(
  'https://ialzxgcgkzvgxjzgglkc.supabase.co',
  'sb_publishable_RC7ubywKk9G_vz0eiuBlPw_NwGnvuev'
);

const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7'];

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
  font: '"Courier New", Courier, monospace',
};

const sharedStyles = `
  @keyframes twinkle { 0%,100%{opacity:0.1} 50%{opacity:0.5} }
  @keyframes pulse   { 0%,100%{opacity:0.4} 50%{opacity:0.9} }
  @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes fadeIn  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes timerPulse { 0%,100%{box-shadow:0 0 12px rgba(148,210,255,0.2)} 50%{box-shadow:0 0 24px rgba(148,210,255,0.5)} }
  @keyframes timerUrgent { 0%,100%{box-shadow:0 0 12px rgba(239,68,68,0.3)} 50%{box-shadow:0 0 28px rgba(239,68,68,0.7)} }
  .emergency-btn:hover {
    background: radial-gradient(circle,rgba(185,28,28,.5) 0%,rgba(127,0,0,.25) 60%,transparent 100%) !important;
    border-color: rgba(239,68,68,.8) !important;
    box-shadow: 0 0 50px rgba(185,28,28,.6),inset 0 0 30px rgba(185,28,28,.2) !important;
    transform: scale(1.05);
  }
  .mission-btn:hover {
    background: rgba(124,58,237,.3) !important;
    border-color: rgba(167,139,250,.6) !important;
    box-shadow: 0 0 30px rgba(124,58,237,.4) !important;
  }
  .send-btn:hover:not(:disabled) {
    background: rgba(37,99,235,.35) !important;
    border-color: rgba(148,210,255,.6) !important;
  }
  ::-webkit-scrollbar{width:4px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:rgba(148,210,255,.15);border-radius:2px}
`;

/* ── Shared sub-components ── */

function Stars() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      {Array.from({ length: 60 }, (_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: ((i * 137.5) % 100) + '%',
          top: ((i * 97.3) % 100) + '%',
          width: i % 6 === 0 ? '2px' : '1px',
          height: i % 6 === 0 ? '2px' : '1px',
          borderRadius: '50%', background: 'white',
          opacity: 0.1 + (i % 4) * 0.08,
          animation: `twinkle ${2 + (i % 3)}s ease-in-out infinite`,
          animationDelay: ((i * 0.3) % 3) + 's',
        }} />
      ))}
    </div>
  );
}

function CrewmateIcon({ color, size = 28 }) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="20" cy="30" rx="13" ry="15" fill={color} />
      <ellipse cx="20" cy="16" rx="11" ry="10" fill={color} />
      <ellipse cx="21" cy="14" rx="7" ry="5" fill="#94d2ff" opacity="0.9" />
      <rect x="30" y="24" width="7" height="10" rx="3" fill={color} opacity="0.85" />
    </svg>
  );
}

function InfoCard({ label, children }) {
  return (
    <div style={{
      background: 'rgba(6,15,31,0.7)', border: `1px solid ${tok.border}`,
      borderRadius: '4px', padding: '12px 14px',
    }}>
      <div style={{ fontSize: '9px', letterSpacing: '3px', color: tok.textDim, marginBottom: '8px', textTransform: 'uppercase' }}>{label}</div>
      {children}
    </div>
  );
}

function SectionDivider({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '12px 0 8px' }}>
      <div style={{ flex: 1, height: '1px', background: tok.border }} />
      <span style={{ fontSize: '9px', color: tok.textDim, letterSpacing: '3px' }}>{label}</span>
      <div style={{ flex: 1, height: '1px', background: tok.border }} />
    </div>
  );
}

function MessageBubble({ isMe, label, content, color, faded }) {
  return (
    <div style={{ textAlign: isMe ? 'right' : 'left', margin: '10px 0' }}>
      <div style={{
        fontSize: '9px', letterSpacing: '2px',
        color: faded ? tok.textDim : color,
        marginBottom: '4px', opacity: faded ? 0.6 : 1,
      }}>{label}</div>
      <span style={{
        background: isMe ? (faded ? 'rgba(37,99,235,.12)' : 'rgba(37,99,235,.2)') : (faded ? 'rgba(15,30,60,.5)' : 'rgba(15,30,60,.8)'),
        border: `1px solid ${isMe ? (faded ? 'rgba(37,99,235,.2)' : 'rgba(37,99,235,.4)') : (faded ? tok.border : tok.borderBright)}`,
        padding: '8px 14px',
        borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        display: 'inline-block', fontSize: '13px',
        color: faded ? 'rgba(200,223,248,.5)' : tok.text,
        maxWidth: '80%', wordBreak: 'break-word',
        fontFamily: '"Courier New",monospace', lineHeight: 1.5,
      }}>
        {content}
      </span>
    </div>
  );
}

function ChatInput({ value, onChange, onSubmit, placeholder, disabled }) {
  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', gap: '8px' }}>
      <input
        type="text" value={value} onChange={onChange}
        placeholder={placeholder} disabled={disabled}
        style={{
          flex: 1, padding: '12px 16px', borderRadius: '4px',
          border: `1px solid ${disabled ? tok.border : tok.borderBright}`,
          background: disabled ? 'rgba(6,15,31,.4)' : 'rgba(6,15,31,.8)',
          color: disabled ? tok.textDim : tok.text,
          fontFamily: tok.font, fontSize: '12px', letterSpacing: '1px', outline: 'none',
        }}
      />
      <button type="submit" disabled={disabled} className="send-btn" style={{
        padding: '0 22px',
        background: disabled ? 'transparent' : 'rgba(37,99,235,.2)',
        color: disabled ? tok.textDim : tok.cyan,
        border: `1px solid ${disabled ? tok.border : 'rgba(148,210,255,.35)'}`,
        borderRadius: '4px', fontFamily: tok.font, fontWeight: '700',
        fontSize: '11px', letterSpacing: '3px',
        cursor: disabled ? 'not-allowed' : 'pointer', textTransform: 'uppercase',
        transition: 'all .15s ease',
      }}>SEND</button>
    </form>
  );
}

/* ── Lobby screen ── */
function LobbyScreen({ gameData, playerCount }) {
  const slots = 4;
  const filled = Math.min(playerCount, slots);
  return (
    <div style={{
      height: '100vh', background: tok.bg, color: tok.text,
      fontFamily: tok.font, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      <Stars />
      <style>{sharedStyles}</style>
      <div style={{ position: 'absolute', top: '20%', left: '20%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(37,99,235,.06) 0%,transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', animation: 'fadeIn .5s ease' }}>
        <div style={{ fontSize: '10px', letterSpacing: '6px', color: tok.cyanDim, marginBottom: '4px' }}>A SOCIAL DEDUCTION GAME</div>
        <h1 style={{ margin: 0, fontSize: 'clamp(28px,4vw,52px)', fontWeight: '900', letterSpacing: '4px', color: 'white', textShadow: '0 0 40px rgba(37,99,235,.5)', textAlign: 'center', lineHeight: 1.1 }}>
          THEORY<br /><span style={{ fontSize: '0.55em', letterSpacing: '12px', color: tok.cyanDim }}>OF MIND</span>
        </h1>
        <div style={{ width: '80px', height: '1px', background: 'linear-gradient(90deg,transparent,rgba(148,210,255,.3),transparent)', margin: '12px 0' }} />

        <div style={{ background: 'rgba(6,15,31,.8)', border: `1px solid ${tok.borderBright}`, borderRadius: '6px', padding: '28px 36px', textAlign: 'center', minWidth: '320px', boxShadow: '0 0 40px rgba(37,99,235,.08)' }}>
          <div style={{ fontSize: '10px', letterSpacing: '4px', color: tok.textDim, marginBottom: '20px' }}>WAITING FOR PLAYERS</div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginBottom: '24px' }}>
            {Array.from({ length: slots }, (_, i) => {
              const active = i < filled;
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', opacity: active ? 1 : 0.2, transition: 'opacity .4s ease' }}>
                  <CrewmateIcon color={active ? PLAYER_COLORS[i % PLAYER_COLORS.length] : '#1e3a5f'} size={36} />
                  <span style={{ fontSize: '9px', letterSpacing: '1px', color: active ? PLAYER_COLORS[i % PLAYER_COLORS.length] : tok.textDim }}>P{i + 1}</span>
                </div>
              );
            })}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', opacity: filled >= slots ? 1 : 0.15, transition: 'opacity .4s ease' }}>
              <CrewmateIcon color={filled >= slots ? '#64748b' : '#1e3a5f'} size={36} />
              <span style={{ fontSize: '9px', letterSpacing: '1px', color: tok.textDim }}>AI</span>
            </div>
          </div>

          <div style={{ fontSize: '28px', fontWeight: '900', letterSpacing: '4px', color: tok.cyan, textShadow: '0 0 20px rgba(148,210,255,.4)', marginBottom: '6px' }}>
            {filled} <span style={{ fontSize: '16px', color: tok.textDim }}>/ 4</span>
          </div>
          <div style={{ fontSize: '10px', letterSpacing: '3px', color: tok.textDim, animation: 'pulse 2s ease-in-out infinite' }}>HUMAN PLAYERS JOINED</div>
        </div>

        <div style={{ marginTop: '16px', fontSize: '10px', letterSpacing: '3px', color: 'rgba(148,210,255,.15)' }}>
          ROOM · {gameData.game_id.slice(0, 8).toUpperCase()}
        </div>
        <div style={{ marginTop: '8px', width: '20px', height: '20px', border: '2px solid rgba(148,210,255,.1)', borderTop: '2px solid rgba(148,210,255,.4)', borderRadius: '50%', animation: 'spin 1.2s linear infinite' }} />
      </div>
    </div>
  );
}

/* ── Discussion timer hook ── */
function useDiscussionTimer(isActive, durationSeconds, onExpire) {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);

  useEffect(() => {
    if (!isActive) {
      setTimeLeft(durationSeconds);
      return;
    }
    setTimeLeft(durationSeconds);
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive]); // eslint-disable-line

  return timeLeft;
}

/* ════════════════════════════════════ */
/*              MAIN CHAT              */
/* ════════════════════════════════════ */
function Chat() {
  const [gameData, setGameData]               = useState(null);
  const [messages, setMessages]               = useState([]);
  const [inputText, setInputText]             = useState('');
  const [showVoting, setShowVoting]           = useState(false);
  const [role, setRole]                       = useState('Crewmate');
  const [myTurnID, setMyTurnID]               = useState(-1);
  const [currentTurn, setCurrentTurn]         = useState(-1);
  const [gameStatus, setGameStatus]           = useState('waiting');
  const [round, setRound]                     = useState(1);
  const [playerMap, setPlayerMap]             = useState({});
  const [word, setWord]                       = useState(null);
  const [meetingOpen, setMeetingOpen]         = useState(false);
  const [joining, setJoining]                 = useState(false);
  const [showDiscussion, setShowDiscussion]   = useState(false);
  const [discussionInput, setDiscussionInput] = useState('');
  const [lobbyPlayerCount, setLobbyPlayerCount] = useState(0);
  const msgRef    = useRef(null);
  const discRef   = useRef(null);

  // All messages (game + discussion) live in the same `messages` state,
  // sourced from Supabase. discussionPhaseStarted tracks when we switched
  // so we can render a divider between game chat and discussion chat.
  const [discussionStartMsgCount, setDiscussionStartMsgCount] = useState(null);

  const goToVoting = useCallback(() => {
    setShowDiscussion(false);
    setShowVoting(true);
  }, []);

  const DISCUSSION_SECONDS = 60;
  const timeLeft = useDiscussionTimer(showDiscussion, DISCUSSION_SECONDS, goToVoting);

  useEffect(() => {
    if (msgRef.current) msgRef.current.scrollTop = msgRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (discRef.current) discRef.current.scrollTop = discRef.current.scrollHeight;
  }, [messages]);

  const syncTurnData = useCallback(async (gameId, userId, retryCount = 0) => {
    const { data: player } = await supabase
      .from('players').select('turn_order')
      .eq('game_id', gameId).eq('user_id', userId).single();

    const { data: game } = await supabase
      .from('games').select('current_turn, status, current_round')
      .eq('game_id', gameId).single();

    if (game) {
      setCurrentTurn(game.current_turn);
      setGameStatus(game.status);
      setRound(game.current_round || 1);
    }

    if (!player || player.turn_order === null || player.turn_order === -1) {
      if (retryCount < 15) setTimeout(() => syncTurnData(gameId, userId, retryCount + 1), 500);
      return;
    }

    setMyTurnID(player.turn_order);
    if (game) { setCurrentTurn(game.current_turn); setGameStatus(game.status); }
  }, []);

  const joinServer = async () => {
    setJoining(true);
    try {
      const res = await axios.get('http://localhost:8000/join');
      const data = res.data;
      setGameData(data);
      setGameStatus(data.status);
      setLobbyPlayerCount(data.player_count || 1);
      if (data.status === 'active') syncTurnData(data.game_id, data.your_id);
    } catch {
      alert('Backend error.');
    } finally {
      setJoining(false);
    }
  };

  useEffect(() => {
    if (!gameData) return;

    const fetchExisting = async () => {
      const { data } = await supabase.from('messages').select('*')
        .eq('game_id', gameData.game_id).order('timestamp', { ascending: true });
      if (data) setMessages(data);
    };

    const fetchPlayers = async () => {
      const { data } = await supabase.from('players')
        .select('user_id, turn_order, Imposter, Human')
        .eq('game_id', gameData.game_id);

      if (data) {
        const map = {};
        let humanCount = 0;
        data.forEach(p => {
          map[p.user_id] = p.turn_order;
          if (p.Human) humanCount++;
          if (p.user_id === gameData.your_id) setRole(p.Imposter ? 'Imposter' : 'Crewmate');
        });
        setPlayerMap(map);
        setLobbyPlayerCount(humanCount);
      }
    };

    const fetchGameWord = async () => {
      const { data } = await supabase.from('games').select('word')
        .eq('game_id', gameData.game_id).single();
      if (data?.word) setWord(data.word);
    };

    fetchExisting();
    fetchPlayers();
    fetchGameWord();

    const channel = supabase.channel(`game-${gameData.game_id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `game_id=eq.${gameData.game_id}`
      }, (payload) => setMessages(prev => [...prev, payload.new]))
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'players',
        filter: `game_id=eq.${gameData.game_id}`
      }, (payload) => { if (payload.new.Human) setLobbyPlayerCount(prev => prev + 1); })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'games',
        filter: `game_id=eq.${gameData.game_id}`
      }, (payload) => {
        setGameStatus(payload.new.status);
        setCurrentTurn(payload.new.current_turn);
        if (payload.new.word) setWord(payload.new.word);
        const r = payload.new.current_round || 1;
        setRound(r);
        if (r > 2 && !showDiscussion) {
          // Record how many messages existed when discussion started
          // so we can draw the divider between game chat and discussion
          setMessages(prev => {
            setDiscussionStartMsgCount(prev.length);
            return prev;
          });
          setShowDiscussion(true);
        }
        if (payload.new.status === 'active') {
          syncTurnData(gameData.game_id, gameData.your_id);
          fetchPlayers();
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'players',
        filter: `game_id=eq.${gameData.game_id}`
      }, (payload) => {
        if (payload.new.user_id === gameData.your_id) {
          setRole(payload.new.Imposter ? 'Imposter' : 'Crewmate');
          setMyTurnID(payload.new.turn_order);
        }
        setPlayerMap(prev => ({ ...prev, [payload.new.user_id]: payload.new.turn_order }));
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [gameData, syncTurnData]); // eslint-disable-line

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    try {
      await axios.post('http://localhost:8000/send_message', {
        game_id: gameData.game_id, player_id: gameData.your_id, content: inputText
      });
      setInputText('');
    } catch (err) {
      console.error(err);
      alert('Failed to send message. Is the backend running?');
    }
  };

  // Discussion messages go to Supabase just like regular messages,
  // so all tabs see them via the existing realtime subscription.
  const sendDiscussionMessage = async (e) => {
    e.preventDefault();
    if (!discussionInput.trim()) return;
    try {
      await axios.post('http://localhost:8000/send_message', {
        game_id: gameData.game_id,
        player_id: gameData.your_id,
        content: discussionInput.trim()
      });
      setDiscussionInput('');
    } catch (err) {
      console.error(err);
      alert('Failed to send message.');
    }
  };

  const isMyTurn      = gameStatus === 'active' && myTurnID === currentTurn;
  const inputDisabled = gameStatus !== 'active' || !isMyTurn;

  const urgent = timeLeft <= 10;

  /* ── Screen routing ── */
  if (!gameData) return <JoinScreen onJoin={joinServer} loading={joining} />;

  if (gameStatus === 'waiting' || gameStatus === 'starting')
    return <LobbyScreen gameData={gameData} playerCount={lobbyPlayerCount} />;

  if (showVoting)
    return <Voting gameId={gameData.game_id} myId={gameData.your_id} onClose={() => setShowVoting(false)} />;

  /* ── Discussion phase ── */
  if (showDiscussion) {
    const gameMsgs  = discussionStartMsgCount !== null ? messages.slice(0, discussionStartMsgCount) : messages;
    const discMsgs  = discussionStartMsgCount !== null ? messages.slice(discussionStartMsgCount)    : [];

    return (
      <div style={{ height: '100vh', background: tok.bg, color: tok.text, display: 'flex', flexDirection: 'column', fontFamily: tok.font, position: 'relative', overflow: 'hidden' }}>
        <Stars /><style>{sharedStyles}</style>

        {/* Header */}
        <div style={{ padding: '14px 24px', borderBottom: `1px solid ${tok.border}`, display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(6,15,31,.8)', backdropFilter: 'blur(8px)', position: 'relative', zIndex: 2 }}>
          <span style={{ fontSize: '18px' }}>🗣️</span>
          <span style={{ fontWeight: '700', fontSize: '14px', letterSpacing: '4px', color: tok.cyan, textTransform: 'uppercase' }}>DISCUSSION PHASE</span>

          {/* Timer */}
          <div style={{
            marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: '10px',
            background: urgent ? 'rgba(239,68,68,.1)' : 'rgba(6,15,31,.6)',
            border: `1px solid ${urgent ? 'rgba(239,68,68,.4)' : tok.borderBright}`,
            borderRadius: '4px', padding: '6px 14px',
            animation: urgent ? 'timerUrgent 1s ease-in-out infinite' : 'timerPulse 2s ease-in-out infinite',
            transition: 'all .3s ease',
          }}>
            <span style={{ fontSize: '11px', letterSpacing: '3px', color: urgent ? tok.red : tok.textDim }}>⏱</span>
            <span style={{
              fontSize: '20px', fontWeight: '900', letterSpacing: '2px', fontVariantNumeric: 'tabular-nums',
              color: urgent ? tok.red : tok.cyan,
              textShadow: urgent ? '0 0 16px rgba(239,68,68,.6)' : '0 0 12px rgba(148,210,255,.4)',
              minWidth: '38px', textAlign: 'center',
            }}>
              {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
            </span>
            <span style={{ fontSize: '9px', letterSpacing: '2px', color: tok.textDim }}>UNTIL VOTING</span>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
          {/* Sidebar */}
          <div style={{ width: '210px', borderRight: `1px solid ${tok.border}`, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(6,15,31,.6)' }}>
            <InfoCard label="YOUR ROLE">
              <div style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '3px', color: role === 'Imposter' ? tok.red : tok.green, textShadow: role === 'Imposter' ? '0 0 14px rgba(239,68,68,.6)' : '0 0 14px rgba(34,197,94,.5)' }}>
                {role.toUpperCase()}
              </div>
            </InfoCard>
            <InfoCard label="THE WORD WAS">
              <div style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '2px', color: role === 'Imposter' ? tok.red : tok.cyan, textShadow: `0 0 18px ${role === 'Imposter' ? 'rgba(239,68,68,.5)' : 'rgba(148,210,255,.4)'}` }}>
                {role === 'Imposter' ? '???' : word || '...'}
              </div>
            </InfoCard>

            {/* Manual skip to voting */}
            <button onClick={goToVoting} className="mission-btn" style={{ marginTop: 'auto', padding: '14px', background: 'rgba(124,58,237,.15)', color: '#c084fc', border: '1px solid rgba(167,139,250,.35)', borderRadius: '4px', fontFamily: tok.font, fontWeight: '700', fontSize: '12px', letterSpacing: '3px', cursor: 'pointer', textTransform: 'uppercase', transition: 'all .2s ease' }}>
              🗳️ VOTE NOW
            </button>
          </div>

          {/* Chat */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px' }}>
            <div style={{ background: tok.cyanFaint, border: `1px solid ${tok.border}`, borderRadius: '4px', padding: '8px 14px', marginBottom: '12px', fontSize: '11px', color: tok.textDim, letterSpacing: '2px' }}>
              💬 FREE DISCUSSION — NO TURN ORDER. WHO IS THE IMPOSTER?
            </div>

            <div ref={discRef} style={{ flex: 1, overflowY: 'auto', marginBottom: '10px' }}>
              {/* Game recap (faded) */}
              <SectionDivider label="GAME CHAT RECAP" />
              {gameMsgs.map((msg, i) => {
                const pNum = playerMap[msg.sender_id];
                const isMe = msg.sender_id === gameData.your_id;
                return <MessageBubble key={i} isMe={isMe} label={isMe ? 'YOU' : pNum !== undefined ? `PLAYER ${pNum + 1}` : 'PLAYER'} content={msg.content} color={PLAYER_COLORS[(pNum ?? 0) % PLAYER_COLORS.length]} faded />;
              })}

              {/* Live discussion messages — from Supabase, visible to all tabs */}
              {discMsgs.length > 0 && <SectionDivider label="DISCUSSION" />}
              {discMsgs.map((msg, i) => {
                const pNum = playerMap[msg.sender_id];
                const isMe = msg.sender_id === gameData.your_id;
                return <MessageBubble key={i} isMe={isMe} label={isMe ? 'YOU' : pNum !== undefined ? `PLAYER ${pNum + 1}` : 'PLAYER'} content={msg.content} color={PLAYER_COLORS[(pNum ?? 0) % PLAYER_COLORS.length]} />;
              })}
            </div>

            <ChatInput value={discussionInput} onChange={e => setDiscussionInput(e.target.value)} onSubmit={sendDiscussionMessage} placeholder="SHARE YOUR SUSPICIONS..." disabled={false} />
          </div>
        </div>
      </div>
    );
  }

  /* ── Main game UI ── */
  return (
    <div style={{ height: '100vh', background: tok.bg, color: tok.text, display: 'flex', flexDirection: 'column', fontFamily: tok.font, position: 'relative', overflow: 'hidden' }}>
      <Stars /><style>{sharedStyles}</style>

      {/* Top bar */}
      <div style={{ padding: '12px 24px', borderBottom: `1px solid ${tok.border}`, display: 'flex', alignItems: 'center', gap: '14px', background: 'rgba(6,15,31,.85)', backdropFilter: 'blur(8px)', position: 'relative', zIndex: 2, flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{ fontSize: '15px', fontWeight: '900', letterSpacing: '4px', color: 'white', textShadow: '0 0 20px rgba(37,99,235,.6)' }}>THEORY</span>
          <span style={{ fontSize: '9px', letterSpacing: '6px', color: tok.cyanDim }}>OF MIND</span>
        </div>
        <div style={{ width: '1px', height: '32px', background: tok.border, margin: '0 8px' }} />
        <span style={{ fontSize: '11px', letterSpacing: '3px', color: tok.textDim }}>ROUND {round} OF 2</span>
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: tok.textDim, letterSpacing: '2px' }}>GAME · {gameData.game_id.slice(0, 8).toUpperCase()}</span>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', zIndex: 1 }}>

        {/* Sidebar */}
        <div style={{ width: '230px', borderRight: `1px solid ${tok.border}`, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(6,15,31,.5)', flexShrink: 0, overflowY: 'auto' }}>
          <InfoCard label="YOUR IDENTITY">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CrewmateIcon color={myTurnID !== -1 ? PLAYER_COLORS[myTurnID % PLAYER_COLORS.length] : '#475569'} size={32} />
              <span style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '2px', color: tok.cyan }}>
                {myTurnID === -1 ? '...' : `P${myTurnID + 1}`}
              </span>
            </div>
          </InfoCard>

          <InfoCard label="YOUR ROLE">
            <div style={{ fontSize: '15px', fontWeight: '700', letterSpacing: '3px', color: role === 'Imposter' ? tok.red : tok.green, textShadow: role === 'Imposter' ? '0 0 14px rgba(239,68,68,.5)' : '0 0 14px rgba(34,197,94,.4)' }}>
              {role.toUpperCase()}
            </div>
          </InfoCard>

          <div style={{ background: tok.cyanFaint, border: `1px solid ${tok.borderBright}`, borderRadius: '4px', padding: '18px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', letterSpacing: '3px', color: tok.textDim, marginBottom: '10px' }}>YOUR WORD</div>
            <div style={{ fontSize: role === 'Imposter' ? '28px' : '22px', fontWeight: '900', letterSpacing: '3px', color: role === 'Imposter' ? tok.textDim : tok.cyan, textShadow: role !== 'Imposter' ? '0 0 24px rgba(148,210,255,.5)' : 'none' }}>
              {role === 'Imposter' ? '???' : word || '...'}
            </div>
          </div>

          <div style={{ background: isMyTurn ? 'rgba(34,197,94,.1)' : 'rgba(6,15,31,.6)', border: `1px solid ${isMyTurn ? 'rgba(34,197,94,.4)' : tok.border}`, borderRadius: '4px', padding: '10px 14px', textAlign: 'center', fontSize: '11px', letterSpacing: '3px', color: isMyTurn ? tok.green : tok.textDim, fontWeight: '700', textShadow: isMyTurn ? '0 0 12px rgba(34,197,94,.4)' : 'none' }}>
            {isMyTurn ? '▶ YOUR TURN' : `PLAYER ${currentTurn + 1}'S TURN`}
          </div>

          <button onClick={() => setMeetingOpen(true)} className="emergency-btn" style={{ marginTop: 'auto', width: '120px', height: '120px', borderRadius: '50%', alignSelf: 'center', background: 'radial-gradient(circle,rgba(185,28,28,.3) 0%,rgba(127,0,0,.15) 60%,transparent 100%)', border: '2px solid rgba(239,68,68,.5)', color: '#fca5a5', fontFamily: tok.font, fontWeight: '700', fontSize: '10px', letterSpacing: '2px', cursor: 'pointer', boxShadow: '0 0 30px rgba(185,28,28,.35),inset 0 0 20px rgba(185,28,28,.1)', transition: 'all .2s ease', textTransform: 'uppercase' }}>
            EMERGENCY<br />MEETING
          </button>
        </div>

        {/* Chat panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', minWidth: 0 }}>
          <div ref={msgRef} style={{ flex: 1, overflowY: 'auto', marginBottom: '12px', paddingRight: '4px' }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: tok.textDim, fontSize: '11px', letterSpacing: '3px', marginTop: '40px' }}>— NO MESSAGES YET —</div>
            )}
            {messages.map((msg, i) => {
              const pNum = playerMap[msg.sender_id];
              const isMe = msg.sender_id === gameData.your_id;
              return <MessageBubble key={i} isMe={isMe} label={isMe ? 'YOU' : pNum !== undefined ? `PLAYER ${pNum + 1}` : 'PLAYER'} content={msg.content} color={PLAYER_COLORS[(pNum ?? 0) % PLAYER_COLORS.length]} />;
            })}
          </div>
          <ChatInput value={inputText} onChange={e => setInputText(e.target.value)} onSubmit={sendMessage} placeholder={inputDisabled ? 'WAIT FOR YOUR TURN...' : 'TYPE A MESSAGE...'} disabled={inputDisabled} />
        </div>
      </div>

      {/* Emergency modal */}
      {meetingOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.93)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 1000, fontFamily: tok.font }}>
          <div style={{ fontSize: '10px', letterSpacing: '8px', color: 'rgba(239,68,68,.6)', marginBottom: '16px' }}>⚠ ALERT</div>
          <h1 style={{ color: tok.red, fontSize: 'clamp(28px,5vw,56px)', fontWeight: '900', letterSpacing: '6px', margin: 0, textShadow: '0 0 40px rgba(239,68,68,.8),0 0 80px rgba(239,68,68,.3)', textAlign: 'center' }}>
            🚨 MEETING<br />CALLED
          </h1>
          <div style={{ width: '200px', height: '1px', background: 'linear-gradient(90deg,transparent,rgba(239,68,68,.5),transparent)', margin: '24px 0' }} />
          <button onClick={() => setMeetingOpen(false)} style={{ padding: '12px 36px', background: 'transparent', border: '1px solid rgba(239,68,68,.4)', color: '#fca5a5', fontFamily: tok.font, fontWeight: '700', fontSize: '11px', letterSpacing: '4px', cursor: 'pointer', textTransform: 'uppercase' }}>
            DISMISS
          </button>
        </div>
      )}
    </div>
  );
}

export default Chat;