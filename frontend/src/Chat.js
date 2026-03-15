import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import Voting from './Voting';


// Supabase client using environment variables (safe for pushing)
const supabase = createClient(
  'https://ialzxgcgkzvgxjzgglkc.supabase.co',
  'sb_publishable_RC7ubywKk9G_vz0eiuBlPw_NwGnvuev'
);

function Chat() {
  const [gameData, setGameData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [showVoting, setShowVoting] = useState(false); 
  const [meetingOpen, setMeetingOpen] = useState(false);

  const [currentTurn, setCurrentTurn] = useState(false);

  // Join the server via Django
  const joinServer = async () => {
    try {
      const res = await axios.get('http://localhost:8000/join/');
      setGameData(res.data);
    } catch (err) {
      alert("Backend not reached. Is Docker running?");
    }
  };



  useEffect(() => {
    if (!gameData) return;

    const fetchMessages = async () => {
      const { data: messageData, error } = await supabase
        .from('messages')
        .select('*')
        .eq('game_id', gameData.game_id)
        .order('timestamp', { ascending: true });

      console.log("insert result", messageData, error);
      if (error) console.error("Fetch error:", error);

      if (messageData) {
        setMessages(messageData);
      }
    };

    const checkTurn = async () => {

      console.log("Checking turn...");
      const { data: turnData } = await supabase
        .from("games")
        .select("current_turn")
        .eq("game_id", gameData.game_id)
        .single();

      const { data: playerData } = await supabase
        .from("players")
        .select("turn_order")
        .eq("user_id", gameData.your_id)
        .single();
      
      console.log(playerData?.turn_order, turnData?.current_turn);

      if (playerData?.turn_order === turnData?.current_turn || turnData?.current_turn === -1) {
        setCurrentTurn(true);
      } else {
        setCurrentTurn(false);
      }
    };

    fetchMessages();
    checkTurn();

    console.log(gameData?.status, gameData?.name);
    return; //() => {};
  }, [gameData]); // ✅ hooks can depend on state/props

  // Send message
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const { error } = await supabase.from('messages').insert([
      {
        game_id: gameData.game_id,
        sender_id: gameData.your_id,
        content: inputText
      }
    ]);

    if (!error) setInputText('');
  };

  // Temporary: if voting view is toggled on, render Voting panel instead of chat
  if (showVoting && gameData) {
    return <Voting gameData={gameData} onBackToChat={() => setShowVoting(false)} />;
  }

  // If not joined yet, show big centered "Join Server" button
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
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            transition: 'transform 0.1s ease, box-shadow 0.1s ease'
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          Join Server
        </button>
      </div>
    );
  }

  // Game room / lobby layout
  return (
    <div
      style={{
        height: '100vh',
        background: '#030a16',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Arial'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '15px 20px',
          borderBottom: '1px solid #1f2a44',
          fontWeight: 'bold'
        }}
      >
        Theory of Mind — Game Room
        <span style={{ fontSize: '12px', color: '#8aa0c8', marginLeft: '10px' }}>
          ID: {gameData.game_id}
        </span>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex' }}>
        {/* LEFT: Game info panel */}
        <div
          style={{
            width: '260px',
            borderRight: '1px solid #1f2a44',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}
        >
          {/* Round + Timer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '14px',
              color: '#9fb3d9'
            }}
          >
            <span>Round {1}/5</span>
            <span>⏱ 00:45</span>
          </div>

          {/* Word Prompt Box */}
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
              APPLE
            </div>
          </div>

          {/* Role Box */}
          <div
            style={{
              textAlign: 'center',
              padding: '15px',
              borderRadius: '10px',
              background: '#0f172a',
              border: '1px solid #1f2a44'
            }}
          >
            <div style={{ fontSize: '12px', color: '#8aa0c8' }}>Your Role</div>

            <div
              style={{
                marginTop: '6px',
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#22c55e'
              }}
            >
              Crewmate
            </div>
          </div>

          {/* Emergency Meeting Button */}
          <button
            onClick={() => setMeetingOpen(true)}
            style={{
              background: '#b91c1c',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '140px',
              height: '140px',
              margin: '0 auto',
              fontWeight: 'bold',
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 0 25px rgba(255,0,0,0.6)',
              transition: 'transform 0.1s ease'
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            EMERGENCY
            <br />
            MEETING
          </button>

          {/* How to Play */}
          <div
            style={{
              marginTop: 'auto',
              fontSize: '12px',
              color: '#8aa0c8',
              lineHeight: '1.5'
            }}
          >
            <div
              style={{
                fontWeight: 'bold',
                marginBottom: '6px',
                color: 'white'
              }}
            >
              How to Play
            </div>

            Describe your word without saying it directly. Find the imposter before time runs out.
          </div>

          {/*Temporary: used to create temp button to go btwn chat and voting*/}
  <button
    onClick={() => setShowVoting(true)}
    style={{
      marginTop: '20px',
      padding: '12px 20px',
      fontSize: '14px',
      fontWeight: 'bold',
      background: '#ef4444',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      width: '100%',
      transition: 'all 0.2s ease'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = '#dc2626';
      e.currentTarget.style.transform = 'scale(1.02)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = '#ef4444';
      e.currentTarget.style.transform = 'scale(1)';
    }}
  >
    🗳️ Go to Voting
  </button>
        </div>

        {/* RIGHT: Chat area */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '15px'
          }}
        >
          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              marginBottom: '10px',
              paddingRight: '5px'
            }}
          >
            {messages.length === 0 && (
              <p style={{ color: '#6f85b3', textAlign: 'center' }}>
                No messages yet. Start the conversation!
              </p>
            )}

            {messages.map((msg, index) => (
              <div
                key={index}
                style={{
                  textAlign: msg.sender_id === gameData.your_id ? 'right' : 'left',
                  margin: '6px 0'
                }}
              >
                <span
                  style={{
                    background: msg.sender_id === gameData.your_id ? '#2563eb' : '#1f2a44',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '14px',
                    display: 'inline-block',
                    maxWidth: '70%',
                    wordWrap: 'break-word'
                  }}
                >
                  {msg.content}
                </span>
              </div>
            ))}
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a message..."
	      disabled={!currentTurn}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '6px',
                border: 'none',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              style={{
                padding: '10px 18px',
                background: '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Send
            </button>
          </form>
        </div>
      </div>

      {/* Emergency Meeting Modal */}
      {meetingOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              background: '#0f172a',
              padding: '30px',
              borderRadius: '12px',
              width: '420px',
              textAlign: 'center',
              border: '2px solid #ef4444'
            }}
          >
            <h2 style={{ color: '#ef4444', marginBottom: '10px' }}>🚨 Emergency Meeting</h2>

            <p style={{ color: '#9fb3d9', fontSize: '14px' }}>
              Meeting UI will go here next (player voting, discussion timer, etc.)
            </p>

            <button
              onClick={() => setMeetingOpen(false)}
              style={{
                marginTop: '20px',
                padding: '10px 20px',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Chat;
