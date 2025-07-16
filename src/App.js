import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { FaCoffee, FaCopy, FaHome } from 'react-icons/fa';
import { GiCoffeeBeans, GiCoffeeCup } from 'react-icons/gi';
import { Wheel } from 'react-custom-roulette';
import Confetti from 'react-confetti';
import config from './config';
import './App.css';

// Viewport height calculation
const setViewportHeight = () => {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
};

// Home Component
function Home() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    return () => window.removeEventListener('resize', setViewportHeight);
  }, []);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Lütfen isminizi girin');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${config.apiUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerName: name.trim() })
      });
      
      if (!res.ok) {
        throw new Error('Oda oluşturulurken bir hata oluştu');
      }
      
      const data = await res.json();
      navigate(`/rulet/${data.roomId}`, { state: { name: name.trim() } });
    } catch (error) {
      console.error('Error creating room:', error);
      setError('Oda oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <div className="container">
        <GiCoffeeCup className="coffee-icon" size={50} />
        <h1 className="title">Kahve Ruleti</h1>
        <p className="subtitle">Kim kahve yapacak? Hadi öğrenelim!</p>
        <form onSubmit={handleCreateRoom} className="join-form">
          <div className="input-group">
            <input
              type="text"
              placeholder="İsminiz"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoComplete="name"
              maxLength={30}
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" disabled={loading || !name.trim()}>
            {loading ? 'Oluşturuluyor...' : 'Kahve Ruleti Başlat'} <FaCoffee style={{ marginLeft: '8px' }} />
          </button>
        </form>
      </div>
    </div>
  );
}

// JoinRoom Component
function JoinRoom() {
  // State Management
  const [roomState, setRoomState] = useState({
    name: '',
    joined: false,
    participants: [],
    roomOwner: '',
    error: '',
    expired: false,
    rouletteError: '',
    joinError: '',
    inputName: '',
    winner: null,
    displayedWinner: null,
    copied: false,
    newParticipant: null
  });

  const [rouletteState, setRouletteState] = useState({
    mustSpin: false,
    prizeNumber: 0,
    isSpinning: false,
    showConfetti: false
  });

  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  // Hooks
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const winnerRef = useRef(null);

  // Effects
  useEffect(() => {
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    return () => window.removeEventListener('resize', setViewportHeight);
  }, []);

  useEffect(() => {
    if (location.state?.name && !roomState.joined) {
      setRoomState(prev => ({
        ...prev,
        name: location.state.name,
        joined: true
      }));
    }
  }, [location.state, roomState.joined]);

  useEffect(() => {
    const fetchRoomData = async () => {
      try {
        const res = await fetch(`${config.apiUrl}/api/rooms/${roomId}`);
        const data = await res.json();
        
        if (data.error) {
          setRoomState(prev => ({ ...prev, error: data.error }));
        } else {
          setRoomState(prev => ({
            ...prev,
            roomOwner: data.owner,
            participants: data.participants
          }));
        }
      } catch (error) {
        console.error('Error fetching room:', error);
        setRoomState(prev => ({
          ...prev,
          error: 'Oda bulunamadı veya bir hata oluştu.'
        }));
      }
    };

    fetchRoomData();
  }, [roomId]);

  useEffect(() => {
    if (!roomState.joined || !roomState.name) return;

    socketRef.current = io(config.socketUrl, {
      query: { name: roomState.name }
    });

    socketRef.current.emit('join_room', { roomId, name: roomState.name });
    
    const handleParticipantsUpdate = (list) => {
      const newParticipantName = list.length > roomState.participants.length ? 
        list[list.length - 1].name : null;
      
      if (newParticipantName && newParticipantName !== roomState.name) {
        setRoomState(prev => ({ ...prev, newParticipant: newParticipantName }));
        setTimeout(() => setRoomState(prev => ({ ...prev, newParticipant: null })), 10000);
      }
      
      setRoomState(prev => ({ ...prev, participants: list }));
    };

    const handleRouletteResult = (winner) => {
      setRoomState(prev => ({ ...prev, winner }));
    };

    socketRef.current.on('participants_update', handleParticipantsUpdate);
    socketRef.current.on('joined', () => setRoomState(prev => ({ ...prev, joined: true })));
    socketRef.current.on('join_error', (data) => setRoomState(prev => ({ ...prev, joinError: data.message })));
    socketRef.current.on('roulette_result', handleRouletteResult);
    socketRef.current.on('room_expired', () => setRoomState(prev => ({ ...prev, expired: true })));

    return () => {
      socketRef.current?.disconnect();
    };
  }, [roomState.joined, roomId, roomState.name, roomState.participants.length]);

  useEffect(() => {
    if (roomState.winner) {
      const winnerIndex = roomState.participants.findIndex(p => p.name === roomState.winner.name);
      if (winnerIndex !== -1) {
        setRouletteState(prev => ({
          ...prev,
          prizeNumber: winnerIndex,
          mustSpin: true
        }));
      }
    }
  }, [roomState.winner, roomState.participants]);

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handlers
  const handleJoin = (e) => {
    e.preventDefault();
    if (!roomState.inputName.trim()) {
      setRoomState(prev => ({ ...prev, joinError: 'Lütfen isminizi girin' }));
      return;
    }
    setRoomState(prev => ({
      ...prev,
      joinError: '',
      name: roomState.inputName,
      joined: true
    }));
  };

  const handleCopy = () => {
    const inviteLink = `${window.location.origin}/rulet/${roomId}`;
    navigator.clipboard.writeText(inviteLink);
    setRoomState(prev => ({ ...prev, copied: true }));
    setTimeout(() => setRoomState(prev => ({ ...prev, copied: false })), 1500);
  };

  const handleStartRoulette = () => {
    if (roomState.participants.length < 2) {
      setRoomState(prev => ({
        ...prev,
        rouletteError: 'Rulet başlatmak için en az iki katılımcı olmalı.'
      }));
      setTimeout(() => setRoomState(prev => ({ ...prev, rouletteError: '' })), 2500);
      return;
    }
    setRoomState(prev => ({ ...prev, displayedWinner: null }));
    setRouletteState(prev => ({ ...prev, isSpinning: true }));
    socketRef.current?.emit('start_roulette', { roomId });
  };

  // Render Helpers
  const renderError = () => (
    <div className="App">
      <div className="container">
        <div className="error-message">{roomState.error}</div>
        <button onClick={() => navigate('/')}><FaHome /> Ana Sayfa</button>
      </div>
    </div>
  );

  const renderExpired = () => (
    <div className="App">
      <div className="container">
        <div className="error-message">
          Davet linkinin süresi doldu. Rulet başlatıldıktan sonra yeni katılımcı eklenemez.
        </div>
        <button onClick={() => navigate('/')}><FaHome /> Ana Sayfa</button>
      </div>
    </div>
  );

  if (roomState.error) return renderError();
  if (roomState.expired) return renderExpired();

  const wheelData = roomState.participants.map(p => ({
    option: p.name,
    style: { backgroundColor: '#6F4E37', textColor: '#F5E6D3' }
  }));

  const wheelColors = ['#2C1810', '#6F4E37', '#D4A574', '#8B4513'];
  const inviteLink = `${window.location.origin}/rulet/${roomId}`;

  return (
    <div className="App">
      <div className="container">
        {rouletteState.showConfetti && (
          <Confetti
            width={windowSize.width}
            height={windowSize.height}
            recycle={false}
            numberOfPieces={200}
            colors={['#D4A574', '#6F4E37', '#2C1810', '#F5E6D3', '#FFFDD0']}
          />
        )}
        
        <h1 className="title">Kahve Ruleti</h1>

        {roomState.newParticipant && (
          <div className="notification">
            <GiCoffeeCup className="notification-icon" />
            <p>{roomState.newParticipant} kahve ruletine katıldı!</p>
          </div>
        )}

        {!roomState.joined ? (
          <form onSubmit={handleJoin} className="join-form">
            <div className="input-group">
              <input
                type="text"
                placeholder="İsminiz"
                value={roomState.inputName}
                onChange={e => setRoomState(prev => ({ ...prev, inputName: e.target.value }))}
                required
                autoComplete="name"
                maxLength={30}
              />
            </div>
            {roomState.joinError && (
              <div className="error-message">{roomState.joinError}</div>
            )}
            <button type="submit" disabled={!roomState.inputName.trim()}>
              Katıl <FaCoffee />
            </button>
          </form>
        ) : (
          <div className="roulette-wrapper">
            <div className="roulette-container">
              {roomState.participants.length > 0 && (
                <Wheel
                  mustStartSpinning={rouletteState.mustSpin}
                  prizeNumber={rouletteState.prizeNumber}
                  data={wheelData}
                  backgroundColors={wheelColors}
                  textColors={['#F5E6D3']}
                  fontSize={16}
                  outerBorderColor="#2C1810"
                  outerBorderWidth={3}
                  innerRadius={20}
                  innerBorderColor="#D4A574"
                  innerBorderWidth={2}
                  radiusLineColor="#F5E6D3"
                  radiusLineWidth={1}
                  perpendicularText={true}
                  spinDuration={0.4}
                  startingOptionIndex={rouletteState.prizeNumber}
                  rotationOffset={-2}
                  disableInitialAnimation={true}
                  dimensions={windowSize.width <= 768 ? 200 : 300}
                  pointerProps={{
                    src: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDJMNCAyMGwyMC0xMC0xMC0yeiIgZmlsbD0iI0Q0QTU3NCIvPjwvc3ZnPg==",
                    style: { width: '30px', top: '-15px' }
                  }}
                  onStopSpinning={() => {
                    setRouletteState(prev => ({ ...prev, mustSpin: false, isSpinning: false }));
                    setTimeout(() => {
                      setRoomState(prev => ({ ...prev, displayedWinner: prev.winner }));
                      setRouletteState(prev => ({ ...prev, showConfetti: true }));
                      setTimeout(() => setRouletteState(prev => ({ ...prev, showConfetti: false })), 5000);
                    }, 500);
                  }}
                />
              )}
            </div>

            {roomState.displayedWinner && !rouletteState.isSpinning && (
              <div className="winner-announcement" ref={winnerRef}>
                <p className="winner-text">
                  {roomState.displayedWinner.name} kahveyi yapacak! ☕
                </p>
              </div>
            )}

            {roomState.name === roomState.roomOwner && !rouletteState.isSpinning && (
              <button
                className="start-roulette-button"
                onClick={handleStartRoulette}
                disabled={rouletteState.isSpinning || roomState.participants.length < 2}
              >
                {rouletteState.isSpinning ? (
                  <>
                    <GiCoffeeBeans className="spinning" />
                    Çevriliyor...
                  </>
                ) : (
                  <>
                    <GiCoffeeBeans />
                    Ruleti Başlat
                  </>
                )}
              </button>
            )}

            {roomState.rouletteError && (
              <div className="error-message">{roomState.rouletteError}</div>
            )}

            {!roomState.displayedWinner && !rouletteState.isSpinning && (
              <p className="waiting-text">
                {roomState.name === roomState.roomOwner
                  ? 'Katılımcıları bekliyorsunuz...'
                  : 'Oda sahibinin ruleti başlatması bekleniyor...'}
              </p>
            )}
          </div>
        )}

        <div className="bottom-controls">
          <div className="invite-link">
            <input
              type="text"
              value={inviteLink}
              readOnly
              onClick={e => e.target.select()}
            />
            <button onClick={handleCopy}>
              {roomState.copied ? 'Kopyalandı!' : 'Davet Linki Kopyala'} <FaCopy />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// App Component
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/rulet/:roomId" element={<JoinRoom />} />
      </Routes>
    </Router>
  );
}

export default App;
