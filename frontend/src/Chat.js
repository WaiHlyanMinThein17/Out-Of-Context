import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import Voting from './Voting';

const supabase = createClient(
  'https://ialzxgcgkzvgxjzgglkc.supabase.co',
  'sb_publishable_RC7ubywKk9G_vz0eiuBlPw_NwGnvuev'
);

function Chat() {
  const [gameData, setGameData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [showVoting, setShowVoting] = useState(false);
  const [role, setRole] = useState("Crewmate");
  const [gameOver, setGameOver] = useState(false); // ADDED
  const [myTurnID, setMyTurnID] = useState(-1);
  const [currentTurn, setCurrentTurn] = useState(-1);
  const [gameStatus, setGameStatus] = useState('waiting');
  const [round, setRound] = useState(1);
  const [playerMap, setPlayerMap] = useState({});
  const [word, setWord] = useState(null);
  const [meetingOpen, setMeetingOpen] = useState(false);

  const syncTurnData = useCallback(async (gameId, userId, retryCount = 0) => {
    const { data: player } = await supabase
      .from('players')
      .select('turn_order')
      .eq('game_id', gameId)
      .eq('user_id', userId)
      .single();

    const { data: game } = await supabase
      .from('games')
      .select('current_turn, status, current_round')
      .eq('game_id', gameId)
      .single();

    if (game) {
      setCurrentTurn(game.current_turn);
      setGameStatus(game.status);
      setRound(game.current_round || 1);
    }

    if (!player || player.turn_order === null || player.turn_order === -1) {
      if (retryCount < 10) {
        console.log("Sync: Data not ready, retrying...");
        setTimeout(() => syncTurnData(gameId, userId, retryCount + 1), 500);
      }
      return;
    }

    setMyTurnID(player.turn_order);

    if (game) {
      setCurrentTurn(game.current_turn);
      setGameStatus(game.status);
    }
  }, []);

  const joinServer = async () => {
    try {
      const res = await axios.get('http://localhost:8000/join');
      setGameData(res.data);
      setGameStatus(res.data.status);

      if (res.data.status === 'active') {
        syncTurnData(res.data.game_id, res.data.your_id);
      }
    } catch (err) {
      alert("Backend error.");
    }
  };

  useEffect(() => {
    if (!gameData) return;

    const fetchExisting = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('game_id', gameData.game_id)
        .order('timestamp', { ascending: true });
      if (data) setMessages(data);
    };

    const fetchPlayers = async () => {
      const { data } = await supabase
        .from('players')
        .select('user_id, turn_order, Imposter')
        .eq('game_id', gameData.game_id);

      if (data) {
        const map = {};
        data.forEach(p => {
          map[p.user_id] = p.turn_order;
          if (p.user_id === gameData.your_id) {
            setRole(p.Imposter ? "Imposter" : "Crewmate");
          }
        });
        setPlayerMap(map);
      }
    };

    const fetchGameWord = async () => {
      const { data } = await supabase
        .from('games')
        .select('word')
        .eq('game_id', gameData.game_id)
        .single();

      if (data?.word) {
        setWord(data.word);
      }
    };

    fetchExisting();
    fetchPlayers();
    fetchGameWord();

    const channel = supabase
      .channel(`game-${gameData.game_id}`)
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages', 
          filter: `game_id=eq.${gameData.game_id}` 
        }, (payload) => setMessages((prev) => [...prev, payload.new]))
      .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'games', 
          filter: `game_id=eq.${gameData.game_id}` 
        }, (payload) => {
          setGameStatus(payload.new.status);
          setCurrentTurn(payload.new.current_turn);
          if (payload.new.word) {
            setWord(payload.new.word);
          }
          const currentRound = payload.new.current_round || 1;
          setRound(currentRound);

          // ADDED: Check for Game Over after 2 rounds
          if (currentRound > 2) {
            setGameOver(true);
          }

          if (payload.new.status === 'active') {
            syncTurnData(gameData.game_id, gameData.your_id);
            fetchPlayers(); 
          }
        })
      
      .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'players', 
          filter: `game_id=eq.${gameData.game_id}` 
        }, (payload) => {
          if (payload.new.user_id === gameData.your_id) {
            setRole(payload.new.Imposter ? "Imposter" : "Crewmate");
            setMyTurnID(payload.new.turn_order);
          }
          setPlayerMap(prev => ({
            ...prev,
            [payload.new.user_id]: payload.new.turn_order
          }));
        })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [gameData, syncTurnData]);

  const sendMessage = async (e) => {
    e.preventDefault();

    if (!inputText.trim()) return;

    try {
      await axios.post('http://localhost:8000/send_message', {
        game_id: gameData.game_id,
        player_id: gameData.your_id,
        content: inputText
      });

      setInputText('');

    } catch (err) {
      console.error("Error sending message:", err);
      alert("Failed to send message. Is the backend running?");
    }
  };

  const isLobby = gameStatus === 'waiting';
  const isMyTurn = gameStatus === 'active' && myTurnID === currentTurn;
  const inputDisabled = !isLobby && !isMyTurn;

  if (!gameData) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#030a16'
        }}
      >
        <button
          onClick={joinServer}
          style={{
            padding: '20px 40px',
            fontSize: '24px',
            cursor: 'pointer',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '12px'
          }}
        >
          Join Server
        </button>
      </div>
    );
  }
  if (showVoting) {
    return (
      <Voting 
        gameId={gameData.game_id} 
        myId={gameData.your_id} 
        onClose={() => setShowVoting(false)} 
      />
    );
  }
  return (
    <div
      style={{
        height: '100vh',
        background: '#030a16',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Arial',
        position: 'relative',
        overflow: 'scroll'
      }}
    >
      <div
        style={{
          padding: '15px 20px',
          borderBottom: '1px solid #1f2a44',
          fontWeight: 'bold'
        }}
      >
        Theory of Mind — {isLobby ? 'Lobby' : 'Game Room'}

        <span
          style={{
            fontSize: '12px',
            color: '#8aa0c8',
            marginLeft: '10px'
          }}
        >
          ID: {gameData.game_id}
        </span>
      </div>

      <div style={{ flex: 1, display: 'flex' }}>
        <div
          style={{
            width: '260px',
            borderRight: '1px solid #1f2a44',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
          }}
        >
          <div
            style={{
              background: '#111a2e',
              padding: '15px',
              borderRadius: '10px',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '11px', color: '#8aa0c8' }}>
              YOUR IDENTITY
            </div>

            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
              {myTurnID === -1
                ? "Assigning..."
                : `Player ${myTurnID + 1}`}
            </div>
          </div>

          <div
            style={{
              background: '#0f172a',
              border: '1px solid #1f2a44',
              borderRadius: '10px',
              padding: '15px',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '12px', color: '#8aa0c8' }}>
              YOUR ROLE
            </div>

            <div
              style={{
                marginTop: '6px',
                fontSize: '18px',
                fontWeight: 'bold',
                color: role === "Imposter" ? '#ef4444' : '#22c55e'
              }}
            >
              {role}
            </div>
          </div>

          <div
            style={{
              background: '#111a2e',
              border: '1px solid #2a3a5f',
              borderRadius: '12px',
              padding: '25px 10px',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                fontSize: '12px',
                color: '#8aa0c8',
                marginBottom: '8px'
              }}
            >
              Your Word
            </div>

            <div
              style={{
                fontSize: '26px',
                fontWeight: 'bold',
                letterSpacing: '2px'
              }}
            >
              {gameStatus !== "active" ? "???" : role === "Imposter" ? "???" : word || "Loading..."}
            </div>
          </div>

          <div
            style={{
              fontSize: '14px',
              color: '#9fb3d9',
              textAlign: 'center'
            }}
          >
            {!isLobby && (
              <div
                style={{
                  fontSize: '12px',
                  color: '#8aa0c8',
                  marginBottom: '4px'
                }}
              >
                Round {round}
              </div>
            )}

            {isLobby
              ? "Waiting for players..."
              : isMyTurn
                ? "🟢 YOUR TURN"
                : `Player ${currentTurn + 1}'s Turn`}
          </div>

          <button
            onClick={() => gameOver ? setShowVoting(true) : setMeetingOpen(true)} // UPDATED
            style={{
              marginTop: '20px',
              padding: '20px',
              background: gameOver ? '#22c55e' : '#b91c1c', // UPDATED
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '140px',
              height: '140px',
              margin: '20px auto',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: gameOver ? '0 0 25px rgba(34, 197, 94, 0.6)' : '0 0 20px rgba(185, 28, 28, 0.4)' // UPDATED
            }}
          >
            {gameOver ? "GO TO VOTING" : "EMERGENCY MEETING"} {/* UPDATED */}
          </button>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '15px',
            position: 'relative'
          }}
        >
          {/* ADDED: GAME OVER OVERLAY */}
          {gameOver && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.9)', padding: '40px', borderRadius: '20px', border: '2px solid #ef4444', textAlign: 'center', zIndex: 100, width: '80%' }}>
              <h1 style={{ color: '#ef4444', fontSize: '36px', marginBottom: '10px' }}>GAME OVER</h1>
              <p style={{ fontSize: '18px', color: '#8aa0c8' }}>Two rounds are complete. Everyone must vote now!</p>
              <p style={{ fontWeight: 'bold', color: 'white' }}>Click the Green Button on the left to Vote.</p>
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '10px' }}>
            {messages.map((msg, i) => {
              const playerNumber = playerMap[msg.sender_id];

              return (
                <div
                  key={i}
                  style={{
                    textAlign: msg.sender_id === gameData.your_id ? 'right' : 'left',
                    margin: '10px 0'
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#8aa0c8',
                      marginBottom: '2px'
                    }}
                  >
                    {msg.sender_id === gameData.your_id
                      ? "You"
                      : playerNumber !== undefined ? `Player ${playerNumber + 1}` : "Player"}
                  </div>

                  <span
                    style={{
                      background: msg.sender_id === gameData.your_id ? '#2563eb' : '#1f2a44',
                      padding: '8px 12px',
                      borderRadius: '14px',
                      display: 'inline-block'
                    }}
                  >
                    {msg.content}
                  </span>
                </div>
              );
            })}
          </div>

          <form
            onSubmit={sendMessage}
            style={{ display: 'flex', gap: '8px' }}
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={inputDisabled ? "Wait for your turn..." : "Type a message..."}
              disabled={inputDisabled}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                background: inputDisabled ? '#1e293b' : '#fff'
              }}
            />

            <button
              type="submit"
              disabled={inputDisabled}
              style={{
                padding: '0 20px',
                background: inputDisabled ? '#334155' : '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '8px'
              }}
            >
              Send
            </button>
          </form>
        </div>
      </div>

      {meetingOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.9)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ color: '#ef4444', fontSize: '48px' }}>
              🚨 MEETING CALLED
            </h1>

            <button
              onClick={() => setMeetingOpen(false)}
              style={{
                marginTop: '20px',
                padding: '10px 20px',
                background: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ADDED: VOTING COMPONENT RENDER */}
      {showVoting && (
        <Voting 
          gameId={gameData.game_id} 
          myId={gameData.your_id} 
          onClose={() => setShowVoting(false)} 
        />
      )}
    </div>
  );
}

export default Chat;