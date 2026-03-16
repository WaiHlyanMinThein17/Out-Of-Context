import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ialzxgcgkzvgxjzgglkc.supabase.co',
  'sb_publishable_RC7ubywKk9G_vz0eiuBlPw_NwGnvuev'
);

function Voting({ gameId, myId, onBackToChat }) {
  const [selectedVote, setSelectedVote] = useState(null);
  const [timeLeft, setTimeLeft] = useState(30); 
  const [hasVoted, setHasVoted] = useState(false);
  const [otherPlayers, setOtherPlayers] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  
  const [showResults, setShowResults] = useState(false);
  const [voteTally, setVoteTally] = useState({});

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

  // CHANGED: Now fetches amount_votes from the players table
  const fetchResults = async () => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('user_id, turn_order, amount_votes, Imposter')
        .eq('game_id', gameId);

      if (error) throw error;

      if (data) {
        const counts = {};
        data.forEach(player => {
          counts[player.user_id] = player.amount_votes || 0;
        });
        
        setVoteTally(counts);
        // Ensure the results list includes everyone (including the voter)
        const allPlayers = data.sort((a, b) => (a.turn_order || 0) - (b.turn_order || 0));
        setOtherPlayers(allPlayers);
        setShowResults(true);
      }
    } catch (err) {
      console.error("Error fetching results:", err);
    }
  };

  useEffect(() => {
    if (timeLeft <= 0) {
      fetchResults();
      return;
    }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleSubmitVote = async () => {
    if (!selectedVote || hasVoted) return;

    try {
      const { error } = await supabase.rpc('increment_vote', { 
        target_id: selectedVote
      });

      if (error) throw error;
      setHasVoted(true);
    } catch (err) {
      console.error('Voting Error:', err);
    }
  };

  if (showResults) {
    return (
      <div style={{ height: '100vh', background: '#030a16', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial' }}>
        <h1 style={{ fontSize: '40px', marginBottom: '10px' }}>Voting Results</h1>
        <div style={{ background: '#111a2e', padding: '40px', borderRadius: '20px', border: '1px solid #1f2a44', width: '400px' }}>
          {otherPlayers.map(player => (
            <div key={player.user_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px solid #1f2a44' }}>
              <span style={{ fontSize: '20px', fontWeight: 'bold' }}>
                Player {player.turn_order + 1} {player.user_id === myId ? "(You)" : ""}
                  {player.Imposter ? " - Imposter" : ""}
              </span>
              <span style={{ fontSize: '24px', color: '#22c55e' }}>{voteTally[player.user_id] || 0} Votes</span>
            </div>
          ))}
        </div>
        <button onClick={onBackToChat} style={{ marginTop: '30px', padding: '15px 40px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
          Continue to Next Round
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', background: '#030a16', color: 'white', display: 'flex', flexDirection: 'column', fontFamily: 'Arial' }}>
      <div style={{ padding: '15px 20px', borderBottom: '1px solid #1f2a44', fontWeight: 'bold' }}>
        Theory of Mind — Voting Phase
        <span style={{ fontSize: '12px', color: '#8aa0c8', marginLeft: '10px' }}>ID: {gameId}</span>
      </div>

      <div style={{ flex: 1, display: 'flex' }}>
        <div style={{ width: '260px', borderRight: '1px solid #1f2a44', padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#9fb3d9' }}>
            <span>Voting ends in:</span>
            <span style={{ color: timeLeft < 10 ? '#ef4444' : '#9fb3d9', fontWeight: 'bold' }}>
               {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </span>
          </div>
          <div style={{ background: '#111a2e', border: '1px solid #2a3a5f', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: hasVoted ? '#22c55e' : '#f59e0b' }}>
              {hasVoted ? "VOTE CONFIRMED" : "SELECT A SUSPECT"}
            </div>
          </div>
          <button onClick={fetchResults} style={{ padding: '10px', background: 'transparent', border: '1px solid #1f2a44', color: '#8aa0c8', cursor: 'pointer', borderRadius: '5px', fontSize: '11px' }}>
            SKIP TO RESULTS (DEBUG)
          </button>
        </div>

        <div style={{ flex: 1, padding: '40px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ textAlign: 'center', fontSize: '28px', marginBottom: '30px' }}>Who is the Imposter?</h2>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
            {loadingPlayers ? (
              <p>Loading...</p>
            ) : (
              otherPlayers.map((player) => {
                const isSelected = selectedVote === player.user_id;
                return (
                  <div key={player.user_id} onClick={() => !hasVoted && setSelectedVote(player.user_id)}
                    style={{
                      background: isSelected ? '#2563eb' : '#111a2e',
                      border: isSelected ? '3px solid #60a5fa' : '1px solid #1f2a44',
                      borderRadius: '15px', padding: '30px', textAlign: 'center', cursor: hasVoted ? 'default' : 'pointer',
                    }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>Player {player.turn_order + 1}</div>
                    {isSelected && <div style={{ marginTop: '10px', fontWeight: 'bold' }}>SELECTED</div>}
                  </div>
                );
              })
            )}
          </div>

          <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={handleSubmitVote}
              disabled={!selectedVote || hasVoted}
              style={{
                padding: '15px 60px', fontSize: '20px', fontWeight: 'bold', borderRadius: '50px', border: 'none',
                background: hasVoted ? '#1f2a44' : '#22c55e', color: 'white', cursor: (hasVoted || !selectedVote) ? 'not-allowed' : 'pointer'
              }}
            >
              {hasVoted ? 'WAITING FOR OTHERS...' : 'CONFIRM VOTE'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Voting;