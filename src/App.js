import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { FaCoffee, FaCopy, FaHome } from 'react-icons/fa';
import { GiCoffeeBeans, GiCoffeeCup } from 'react-icons/gi';
import { Wheel } from 'react-custom-roulette';
import Confetti from 'react-confetti';
import config from './config';
import './App.css';

function Home() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!name) return;
    setLoading(true);
    try {
      const res = await fetch(`${config.apiUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerName: name })
      });
      const data = await res.json();
      setLoading(false);
      navigate(`/rulet/${data.roomId}`, { state: { name } });
    } catch (error) {
      console.error('Error creating room:', error);
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <div className="container">
        <GiCoffeeCup className="coffee-icon" size={50} />
        <h1 className="title">Kahve Ruleti</h1>
        <p className="subtitle">Kim kahve yapacak? Hadi öğrenelim!</p>
        <form onSubmit={handleCreateRoom}>
          <div className="input-group">
            <input
              type="text"
              placeholder="İsminiz"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Oluşturuluyor...' : 'Kahve Ruleti Başlat'} <FaCoffee style={{ marginLeft: '8px' }} />
          </button>
        </form>
      </div>
    </div>
  );
}

function JoinRoom() {
  const { roomId } = useParams();
  const location = useLocation();
  const [name, setName] = useState(location.state?.name || '');
  const [joined, setJoined] = useState(!!location.state?.name);
  const [participants, setParticipants] = useState([]);
  const [roomOwner, setRoomOwner] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const [winner, setWinner] = useState(null);
  const [copied, setCopied] = useState(false);
  const [expired, setExpired] = useState(false);
  const [rouletteError, setRouletteError] = useState('');
  const [joinError, setJoinError] = useState('');
  const [inputName, setInputName] = useState('');
  const [mustSpin, setMustSpin] = useState(false);
  const [prizeNumber, setPrizeNumber] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    if (location.state?.name && !joined) {
      setName(location.state.name);
      setJoined(true);
    }
  }, [location.state, joined]);

  useEffect(() => {
    fetch(`${config.apiUrl}/api/rooms/${roomId}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error);
        else {
          setRoomOwner(data.owner);
          setParticipants(data.participants);
        }
      })
      .catch(error => {
        console.error('Error fetching room:', error);
        setError('Oda bulunamadı veya bir hata oluştu.');
      });
  }, [roomId]);

  useEffect(() => {
    if (!joined || !name) return;
    socketRef.current = io(config.socketUrl);
    socketRef.current.emit('join_room', { roomId, name });
    socketRef.current.on('participants_update', (list) => {
      setParticipants(list);
    });
    socketRef.current.on('joined', () => {
      setJoined(true);
    });
    socketRef.current.on('join_error', (data) => {
      setJoinError(data.message);
    });
    socketRef.current.on('roulette_result', (winner) => {
      setWinner(winner);
    });
    socketRef.current.on('room_expired', (data) => {
      setExpired(true);
    });
    return () => {
      socketRef.current && socketRef.current.disconnect();
    };
  }, [joined, roomId, name]);

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (winner) {
      const winnerIndex = participants.findIndex(p => p.name === winner.name);
      if (winnerIndex !== -1) {
        setPrizeNumber(winnerIndex);
        setMustSpin(true);
      }
    }
  }, [winner, participants]);

  const handleJoin = (e) => {
    e.preventDefault();
    if (!inputName) return;
    setName(inputName);
    setJoined(true);
  };

  const inviteLink = `${window.location.origin}/rulet/${roomId}`;
  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleStartRoulette = () => {
    if (participants.length < 2) {
      setRouletteError('Rulet başlatmak için en az iki katılımcı olmalı.');
      setTimeout(() => setRouletteError(''), 2500);
      return;
    }
    setIsSpinning(true);
    if (socketRef.current) {
      socketRef.current.emit('start_roulette', { roomId });
    }
  };

  const data = participants.map(p => ({
    option: p.name,
    style: { backgroundColor: '#6F4E37', textColor: '#F5E6D3' }
  }));

  const wheelColors = ['#2C1810', '#6F4E37', '#D4A574', '#8B4513'];

  if (error) return (
    <div className="App">
      <div className="container">
        <div className="error-message">{error}</div>
        <button onClick={() => navigate('/')}><FaHome /> Ana Sayfa</button>
      </div>
    </div>
  );

  if (expired) return (
    <div className="App">
      <div className="container">
        <div className="error-message">Davet linkinin süresi doldu. Rulet başlatıldıktan sonra yeni katılımcı eklenemez.</div>
        <button onClick={() => navigate('/')}><FaHome /> Ana Sayfa</button>
      </div>
    </div>
  );

  return (
    <div className="App">
      <div className="container">
        {showConfetti && (
          <Confetti
            width={windowSize.width}
            height={windowSize.height}
            recycle={false}
            numberOfPieces={200}
            colors={['#D4A574', '#6F4E37', '#2C1810', '#F5E6D3', '#FFFDD0']}
          />
        )}
        <GiCoffeeBeans className="coffee-icon" size={40} />
        <h1 className="title">Kahve Ruleti Odası</h1>
        
        <div className="invite-link">
          <input value={inviteLink} readOnly />
          <button onClick={handleCopy}>
            {copied ? 'Kopyalandı!' : 'Kopyala'} <FaCopy />
          </button>
          <p className="subtitle">Bu linki arkadaşlarınla paylaş!</p>
        </div>

        <p className="subtitle"><b>{roomOwner}</b> sizi Kahve Ruleti'ne davet etti!</p>

        {!joined ? (
          <form onSubmit={handleJoin}>
            <div className="input-group">
              <input
                type="text"
                placeholder="İsminiz"
                value={inputName}
                onChange={e => setInputName(e.target.value)}
                required
              />
            </div>
            <button type="submit">Katıl <FaCoffee /></button>
            {joinError && (
              <div className="error-message">{joinError}</div>
            )}
          </form>
        ) : (
          <div>
            <div className="participants-list">
              <h3>Katılımcılar:</h3>
              {participants.map((p, i) => (
                <div key={i} className={`participant-card ${winner && winner.name === p.name ? 'winner' : ''}`}>
                  <span>{p.name}</span>
                  {winner && winner.name === p.name && <FaCoffee />}
                </div>
              ))}
            </div>

            {participants.length >= 2 && (
              <div className="roulette-container">
                {participants.length > 0 && (
                  <>
                    <Wheel
                      mustStartSpinning={mustSpin}
                      prizeNumber={prizeNumber}
                      data={data}
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
                      onStopSpinning={() => {
                        setMustSpin(false);
                        setIsSpinning(false);
                        setShowConfetti(true);
                        setTimeout(() => setShowConfetti(false), 5000);
                      }}
                    />
                    <div className="roulette-overlay">
                      <FaCoffee className={isSpinning ? 'spinning' : ''} />
                    </div>
                  </>
                )}
              </div>
            )}

            {winner && !isSpinning && (
              <div className="winner-announcement">
                <h3><FaCoffee /> Sonuç <FaCoffee /></h3>
                <p className="winner-text">
                  {winner.name} kahveyi yapmak için seçildi! ☕
                </p>
              </div>
            )}

            {name === roomOwner && !winner && (
              <button 
                className="start-roulette-button" 
                onClick={handleStartRoulette}
                disabled={isSpinning || participants.length < 2}
              >
                {isSpinning ? 'Çekiliş yapılıyor...' : 'Kahve Ruletini Başlat'} <FaCoffee />
              </button>
            )}

            {rouletteError && (
              <div className="error-message">{rouletteError}</div>
            )}

            <button onClick={() => navigate('/')} style={{ marginTop: '1rem' }}>
              <FaHome /> Ana Sayfa
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

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
