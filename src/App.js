import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';

function Home() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!name) return;
    setLoading(true);
    const res = await fetch('http://localhost:5000/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerName: name })
    });
    const data = await res.json();
    setLoading(false);
    navigate(`/rulet/${data.roomId}`, { state: { name } });
  };

  return (
    <div style={{ maxWidth: 400, margin: '40px auto', padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
      <h2>Kahve Ruleti</h2>
      <form onSubmit={handleCreateRoom}>
        <input
          type="text"
          placeholder="İsminiz"
          value={name}
          onChange={e => setName(e.target.value)}
          style={{ width: '100%', padding: 8, marginBottom: 12 }}
          required
        />
        <button type="submit" style={{ width: '100%', padding: 10 }} disabled={loading}>
          {loading ? 'Oluşturuluyor...' : 'Kahve Ruleti Başlat'}
        </button>
      </form>
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

  useEffect(() => {
    if (location.state?.name && !joined) {
      setName(location.state.name);
      setJoined(true);
    }
  }, [location.state, joined]);

  useEffect(() => {
    fetch(`http://localhost:5000/api/rooms/${roomId}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error);
        else {
          setRoomOwner(data.owner);
          setParticipants(data.participants);
        }
      });
  }, [roomId]);

  useEffect(() => {
    if (!joined || !name) return;
    socketRef.current = io('http://localhost:5000');
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
    if (socketRef.current) {
      socketRef.current.emit('start_roulette', { roomId });
    }
  };

  if (error) return <div style={{ maxWidth: 400, margin: '40px auto', padding: 24 }}>{error}</div>;
  if (expired) return <div style={{ maxWidth: 400, margin: '40px auto', padding: 24, color: 'red' }}>Davet linkinin süresi doldu. Rulet başlatıldıktan sonra yeni katılımcı eklenemez.</div>;

  return (
    <div style={{ maxWidth: 400, margin: '40px auto', padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
      <h2>Kahve Ruleti Odası</h2>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input value={inviteLink} readOnly style={{ flex: 1, padding: 8 }} />
          <button onClick={handleCopy}>{copied ? 'Kopyalandı!' : 'Kopyala'}</button>
        </div>
        <p style={{ marginTop: 4, color: '#888', fontSize: 13 }}>Bu linki arkadaşlarınla paylaş!</p>
      </div>
      <p><b>{roomOwner}</b> sizi Kahve Ruleti'ne davet etti!</p>
      {!joined ? (
        <form onSubmit={handleJoin}>
          <input
            type="text"
            placeholder="İsminiz"
            value={inputName}
            onChange={e => setInputName(e.target.value)}
            style={{ width: '100%', padding: 8, marginBottom: 12 }}
            required
          />
          <button type="submit" style={{ width: '100%', padding: 10 }}>
            Katıl
          </button>
          {joinError && (
            <div style={{ color: 'red', marginTop: 8 }}>{joinError}</div>
          )}
        </form>
      ) : (
        <div>
          <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, marginBottom: 12 }}>
            <b>Katılımcılar:</b>
            <ul>
              {participants.map((p, i) => <li key={i}>{p.name}</li>)}
            </ul>
          </div>
          {winner && (
            <div style={{ background: '#d1ffd6', padding: 12, borderRadius: 6, marginBottom: 12, textAlign: 'center' }}>
              <b>{winner.name}</b> kahveyi yapmak için seçildi!
            </div>
          )}
          {name === roomOwner && !winner && (
            <button onClick={handleStartRoulette} style={{ width: '100%', padding: 10, background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, marginBottom: 12 }}>
              Kahve Ruletini Başlat
            </button>
          )}
          {rouletteError && (
            <div style={{ color: 'red', marginBottom: 12 }}>{rouletteError}</div>
          )}
          <button onClick={() => navigate('/')} style={{ width: '100%', padding: 10 }}>Ana Sayfa</button>
        </div>
      )}
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
