import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { socket } from '../socket';

export default function PlayerView() {
  const [searchParams] = useSearchParams();
  const paramRoom = searchParams.get('room') || '';

  const [roomId, setRoomId] = useState(paramRoom);
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [status, setStatus] = useState<'lobby'|'playing'|'waiting_others'|'result'|'game_over'>('lobby');
  
  const [pointsEarned, setPointsEarned] = useState(0);
  const [isCorrect, setIsCorrect] = useState(false);
  const [totalScore, setTotalScore] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [myRank, setMyRank] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);
  // Just track length for UI
  const [options, setOptions] = useState<any[]>([]);

  useEffect(() => {
    socket.on('joined-success', () => {
      setJoined(true);
      setErrorMsg('');
    });

    socket.on('join-error', (msg) => {
      setErrorMsg(msg);
    });

    socket.on('new-question', (q: any) => {
      setOptions(q.options);
      setIsCorrect(false);
      setPointsEarned(0);
      setHasAnswered(false);
      setStatus('playing');
    });

    socket.on('answer-received', (res) => {
      setPointsEarned(res.pointsEarned);
      setIsCorrect(res.isCorrect);
      setTotalScore(prev => prev + res.pointsEarned);
      setHasAnswered(true);
      setStatus('waiting_others');
    });

    socket.on('question-result', (res: any) => {
      if (res && res.playerRanks) {
        setMyRank(res.playerRanks[socket.id as string] || 0);
        setTotalPlayers(res.totalPlayers || 0);
      }
      setStatus('result');
    });

    socket.on('game-over', (res: any) => {
      if (res && res.playerRanks) {
        setMyRank(res.playerRanks[socket.id as string] || 0);
        setTotalPlayers(res.totalPlayers || 0);
      }
      setStatus('game_over');
    });

    socket.on('host-disconnected', () => {
      setErrorMsg('Host đã ngắt kết nối. Vui lòng tải lại trang.');
      setJoined(false);
    });

    return () => {
      socket.off('joined-success');
      socket.off('join-error');
      socket.off('new-question');
      socket.off('answer-received');
      socket.off('question-result');
      socket.off('game-over');
      socket.off('host-disconnected');
    };
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId && name) {
      socket.emit('player:join', { roomId, name });
    }
  };

  const submitAnswer = (answerId: string) => {
    socket.emit('player:submit-answer', { roomId, answerId });
  };

  const colors = ['bg-red-500 hover:bg-red-600', 'bg-blue-500 hover:bg-blue-600', 'bg-yellow-500 hover:bg-yellow-600', 'bg-green-500 hover:bg-green-600'];

  if (!joined) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <form onSubmit={handleJoin} className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm flex flex-col gap-4">
          <h2 className="text-2xl font-black text-center mb-4 text-slate-800">THAM GIA PHÒNG</h2>
          {errorMsg && <div className="bg-red-100 text-red-600 p-3 rounded-lg text-sm text-center font-bold">{errorMsg}</div>}
          <input
            type="number"
            placeholder="Mã phòng (PIN)"
            value={roomId}
            onChange={e => setRoomId(e.target.value)}
            className="border-2 border-slate-200 rounded-lg p-4 font-bold text-center text-xl focus:border-blue-500 outline-none transition"
            required
          />
          <input
            type="text"
            placeholder="Tên của bạn"
            value={name}
            onChange={e => setName(e.target.value)}
            className="border-2 border-slate-200 rounded-lg p-4 font-bold text-center text-xl focus:border-blue-500 outline-none transition"
            required
          />
          <button type="submit" className="bg-black text-white font-bold text-xl p-4 rounded-lg mt-2 cursor-pointer transition hover:bg-slate-800">
            VÀO CHƠI
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white p-4 shadow flex justify-between font-bold text-lg">
        <span className="text-slate-600">{name}</span>
        <span className="text-blue-600 bg-blue-50 px-3 py-1 rounded-md">{totalScore} pt</span>
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <AnimatePresence>
          
          {status === 'lobby' && (
            <motion.div key="lobby" initial={{scale:0.8, opacity:0}} animate={{scale:1, opacity:1}} className="text-center">
              <h2 className="text-2xl font-bold bg-white px-8 py-4 rounded-full shadow text-slate-700">Đã vào phòng. Chờ Host bật game...</h2>
            </motion.div>
          )}

          {status === 'playing' && (
            <motion.div key="playing" initial={{y:50, opacity:0}} animate={{y:0, opacity:1}} className="w-full h-full max-w-lg grid grid-cols-2 gap-4">
              {options.map((opt, i) => (
                <motion.button
                  key={opt.id}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => submitAnswer(opt.id)}
                  className={`${colors[i]} rounded-2xl shadow-md min-h-[160px] text-white flex items-center justify-center text-5xl font-black cursor-pointer`}
                >
                  {opt.id}
                </motion.button>
              ))}
            </motion.div>
          )}

          {status === 'waiting_others' && (
            <motion.div key="waiting" initial={{scale:0.8, opacity:0}} animate={{scale:1, opacity:1}} className="text-center bg-white p-8 rounded-3xl shadow">
              <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <h2 className="text-xl font-bold text-slate-700">Đợi mọi người trả lời...</h2>
            </motion.div>
          )}

          {status === 'result' && hasAnswered && (
            <motion.div key="result-answered" initial={{scale:0.5, opacity:0}} animate={{scale:1, opacity:1}} className={`text-center w-full max-w-sm p-8 rounded-3xl shadow-xl text-white ${isCorrect ? 'bg-green-500' : 'bg-red-500'}`}>
              <h1 className="text-5xl font-black mb-4">{isCorrect ? 'ĐÚNG!' : 'SAI!'}</h1>
              <p className="text-2xl font-bold bg-black/20 inline-block px-6 py-2 rounded-full mb-6">
                +{pointsEarned}
              </p>
              {myRank > 0 && (
                <div className="bg-white/20 p-4 rounded-2xl">
                  <p className="text-lg font-semibold mb-1">Thứ hạng hiện tại</p>
                  <p className="text-3xl font-black">{myRank} / {totalPlayers}</p>
                </div>
              )}
            </motion.div>
          )}

          {status === 'result' && !hasAnswered && (
            <motion.div key="result-missed" initial={{scale:0.5, opacity:0}} animate={{scale:1, opacity:1}} className="text-center w-full max-w-sm p-8 rounded-3xl shadow-xl text-white bg-slate-500">
              <h1 className="text-4xl font-black mb-4">HẾT GIỜ!</h1>
              <p className="text-xl font-bold bg-black/20 inline-block px-6 py-2 rounded-lg mb-6">
                Bạn chưa chọn đáp án
              </p>
              {myRank > 0 && (
                <div className="bg-white/20 p-4 rounded-2xl">
                  <p className="text-lg font-semibold mb-1">Thứ hạng hiện tại</p>
                  <p className="text-3xl font-black">{myRank} / {totalPlayers}</p>
                </div>
              )}
            </motion.div>
          )}

          {status === 'game_over' && (
            <motion.div key="game_over" initial={{y:50, opacity:0}} animate={{y:0, opacity:1}} className="text-center bg-white p-12 rounded-3xl shadow w-full max-w-sm">
              <h1 className="text-4xl font-black text-slate-800 mb-6">KẾT THÚC</h1>
              <p className="text-xl text-slate-500 font-semibold mb-2">Tổng điểm của bạn</p>
              <p className="text-5xl font-black text-blue-600 mb-8">{totalScore}</p>
              
              {myRank > 0 && (
                <div className="bg-slate-100 p-6 rounded-2xl mb-8 border-2 border-slate-200">
                  <p className="text-slate-600 font-bold mb-2 uppercase tracking-widest text-sm">Thứ hạng chung cuộc</p>
                  <p className="text-4xl font-black text-slate-800">Top {myRank} <span className="text-xl text-slate-400">/ {totalPlayers}</span></p>
                </div>
              )}

              <p className="font-bold text-slate-400">Xem màn hình lớn để biết thứ hạng Top 3!</p>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
