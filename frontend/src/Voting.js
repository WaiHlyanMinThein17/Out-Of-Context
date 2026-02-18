import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase client using environment variables (safe for pushing)
const supabase = createClient(
  'https://ialzxgcgkzvgxjzgglkc.supabase.co',
  'sb_publishable_RC7ubywKk9G_vz0eiuBlPw_NwGnvuev'
);

// Temporarily changed function declaration for temp button to go btwn chat and voting 
// OG function declaration: function Voting({ gameData }) {
function Voting({ gameData, onBackToChat }) {
  const [selectedVote, setSelectedVote] = useState(null); 
  const [timeLeft, setTimeLeft] = useState(15); // set to 15 seconds for now
  const [hasVoted, setHasVoted] = useState(false); // false for now
  const [otherPlayers, setOtherPlayers] = useState([]); 
  const [loadingPlayers, setLoadingPlayers] = useState(true); 

  // Fetch other players from Supabase
  useEffect(() => {
    if (!gameData || !gameData.game_id || !gameData.your_id) {
      console.log('Voting: Missing gameData:', { gameData, hasGameId: !!gameData?.game_id, hasYourId: !!gameData?.your_id });
      return;
    }

    const fetchPlayers = async () => {
      try {
        setLoadingPlayers(true);
        console.log('Voting: Fetching players for game_id:', gameData.game_id, 'excluding:', gameData.your_id);
        
        // First, try to get ALL players to debug
        const { data: allData, error: allError } = await supabase
          .from('players')
          .select('user_id')
          .eq('game_id', gameData.game_id);
        
        console.log('Voting: ALL players query result:', { allData, allError });

        // Then get other players (excluding yourself)
        const { data, error } = await supabase
          .from('players')
          .select('user_id')
          .eq('game_id', gameData.game_id)
          .neq('user_id', gameData.your_id);

        console.log('Voting: OTHER players query result:', { data, error, dataLength: data?.length });

        if (error) {
          console.error('Voting: Error fetching players:', error);
          setOtherPlayers([]);
          setLoadingPlayers(false);
          return;
        }

        // store other players in state
        if (data && Array.isArray(data) && data.length > 0) {
          console.log('Voting: Setting players:', data);
          setOtherPlayers(data);
        } else {
          console.log('Voting: No other players found. Data:', data, 'Type:', typeof data, 'IsArray:', Array.isArray(data));
          setOtherPlayers([]);
        }
      } catch (err) {
        console.error('Voting: Unexpected error:', err);
        setOtherPlayers([]);
      } finally {
        setLoadingPlayers(false);
      }
    };

    fetchPlayers();
  }, [gameData]);

  // Timer countdown logic
  useEffect(() => {
    if (timeLeft <= 0) {
      return;
    }

    // Timer countdown interval
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    
    return () => clearInterval(timer);
  }, [timeLeft]);

  // Format timer display (MM:SS)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle vote selection (uses player_id)
  const handleVoteSelect = (playerId) => {
    if (!hasVoted && timeLeft > 0) {
      setSelectedVote(playerId);
    }
  };

  // Helper function to shorten player ID for display
  const shortenPlayerId = (playerId) => {
    if (!playerId) return 'N/A';
    // Show first 8 characters of UUID
    return playerId.substring(0, 8).toUpperCase();
  };

  // Handle vote submission
  const handleSubmitVote = async (e) => {
    e.preventDefault();
    if (!selectedVote || hasVoted) return;

    try {
      // TODO: Submit vote to Supabase votes table (table needs to be created first)
      // const { error } = await supabase.from('votes').insert([
      //   {
      //     game_id: gameData.game_id,
      //     voter_id: gameData.your_id,
      //     voted_for_id: selectedVote, // Now uses actual player_id
      //     timestamp: new Date().toISOString()
      //   }
      // ]);
      
      console.log('Vote submitted for player:', selectedVote);
      setHasVoted(true);
      alert(`Vote cast for player ${shortenPlayerId(selectedVote)}`);
    } catch (err) {
      console.error('Error submitting vote:', err);
      alert('Failed to submit vote');
    }
  };

  // Voting panel layout
  return (
    <div style={{
      height: '100vh',
      background: '#030a16',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Arial'
    }}>

      {/* Header */}
      <div style={{
        padding: '15px 20px',
        borderBottom: '1px solid #1f2a44',
        fontWeight: 'bold'
      }}>
        Theory of Mind — Game Room
        <span style={{ fontSize: '12px', color: '#8aa0c8', marginLeft: '10px' }}>
          ID: {gameData?.game_id || 'N/A'}
        </span>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex' }}>

        {/* LEFT: Game info panel (same as chat panel) */}
        <div style={{
          width: '260px',
          borderRight: '1px solid #1f2a44',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}>

          {/* Round + Timer */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '14px',
            color: '#9fb3d9'
          }}>
            <span>Round {1}/5</span>
            <span>⏱ {formatTime(timeLeft)}</span>
          </div>

          {/* Word Prompt Box */}
          <div style={{
            background: '#111a2e',
            border: '1px solid #2a3a5f',
            borderRadius: '12px',
            padding: '25px 10px',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#8aa0c8',
              marginBottom: '8px'
            }}>
              Your Word
            </div>

            <div style={{
              fontSize: '26px',
              fontWeight: 'bold',
              letterSpacing: '2px'
            }}>
              APPLE
            </div>
          </div>

          {/* Role Box */}
          <div style={{
            textAlign: 'center',
            padding: '15px',
            borderRadius: '10px',
            background: '#0f172a',
            border: '1px solid #1f2a44'
          }}>
            <div style={{ fontSize: '12px', color: '#8aa0c8' }}>
              Your Role
            </div>

            <div style={{
              marginTop: '6px',
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#22c55e'
            }}>
              Crewmate
            </div>
          </div>

          {/* How to Play */}
          <div style={{
            marginTop: 'auto',
            fontSize: '12px',
            color: '#8aa0c8',
            lineHeight: '1.5'
          }}>
            <div style={{
              fontWeight: 'bold',
              marginBottom: '6px',
              color: 'white'
            }}>
              How to Play
            </div>

            Vote for who you think is the imposter.
            Time is running out!
          </div>

          {/* Temporary: Back to Chat Button */}
          {onBackToChat && (
            <button
              onClick={onBackToChat}
              style={{
                marginTop: '20px',
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: 'bold',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                width: '100%',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#1d4ed8';
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#2563eb';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              Back to Chat
            </button>
          )}

        </div>

        {/* RIGHT: Voting panel */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '20px'
        }}>

          {/* Voting Instructions */}
          <div style={{
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>
              Who is the Imposter?
            </h2>
            <p style={{ margin: 0, color: '#8aa0c8', fontSize: '14px' }}>
              Select a player to vote for
            </p>
          </div>

          {/* Voting Options Grid */}
          <div style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '20px',
            marginBottom: '20px'
          }}>
            {loadingPlayers ? (
              <div style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                color: '#8aa0c8',
                padding: '40px'
              }}>
                Loading...
              </div>
            ) : otherPlayers.length === 0 ? (
              <div style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                color: '#8aa0c8',
                padding: '40px'
              }}>
                No other players found in this game.
              </div>
            ) : (
              otherPlayers
                .filter(player => player && player.user_id)
                .map((player, index) => {
                const playerId = player.user_id;
                const isSelected = selectedVote === playerId;
                const label = String.fromCharCode(65 + index); // A, B, C, D (65 is 'A' in ASCII)
                return (
                  <div
                    key={playerId}
                    onClick={() => handleVoteSelect(playerId)}
                    style={{
                      background: isSelected ? '#2563eb' : '#1f2a44',
                      border: isSelected ? '2px solid #3b82f6' : '2px solid #2a3a5f',
                      borderRadius: '12px',
                      padding: '30px',
                      textAlign: 'center',
                      cursor: hasVoted || timeLeft === 0 ? 'not-allowed' : 'pointer',
                      opacity: hasVoted || timeLeft === 0 ? 0.5 : 1,
                      transition: 'all 0.2s ease',
                      transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                      boxShadow: isSelected ? '0 0 20px rgba(37, 99, 235, 0.5)' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (!hasVoted && timeLeft > 0 && !isSelected) {
                        e.currentTarget.style.background = '#2a3a5f';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = '#1f2a44';
                      }
                    }}
                  >
                    <div style={{
                      fontSize: '48px',
                      fontWeight: 'bold',
                      marginBottom: '10px',
                      color: isSelected ? 'white' : '#9fb3d9'
                    }}>
                      {label}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#8aa0c8',
                      fontFamily: 'monospace',
                      marginTop: '5px'
                    }}>
                      {shortenPlayerId(playerId)}
                    </div>
                    {isSelected && (
                      <div style={{
                        marginTop: '10px',
                        fontSize: '14px',
                        color: '#22c55e',
                        fontWeight: 'bold'
                      }}>
                        ✓ Selected
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Submit Button (Bottom Right) */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '10px'
          }}>
            {timeLeft === 0 && !hasVoted && (
              <span style={{ color: '#ef4444', fontSize: '14px' }}>
                Time's up!
              </span>
            )}
            <button
              onClick={handleSubmitVote}
              disabled={!selectedVote || hasVoted || timeLeft === 0}
              style={{
                padding: '12px 30px',
                fontSize: '16px',
                fontWeight: 'bold',
                background: (!selectedVote || hasVoted || timeLeft === 0) 
                  ? '#4b5563' 
                  : '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: (!selectedVote || hasVoted || timeLeft === 0) 
                  ? 'not-allowed' 
                  : 'pointer',
                opacity: (!selectedVote || hasVoted || timeLeft === 0) ? 0.5 : 1,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (selectedVote && !hasVoted && timeLeft > 0) {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {hasVoted ? 'Vote Submitted ✓' : 'Submit Vote'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Voting;
