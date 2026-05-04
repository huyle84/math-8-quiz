import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { socket } from '../socket';
import confetti from 'canvas-confetti';
import { Users, Play, Trophy, ArrowRight, Pause } from 'lucide-react';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';

interface Player { id: string; name: string; score: number; }
interface Question { id: string; question: string; timeLimit: number; image?: string; options: {id: string, text: string}[]; }

export default function HostView() {
  const [roomId, setRoomId] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameState, setGameState] = useState<'lobby'|'question'|'result'|'podium'>('lobby');
  const [question, setQuestion] = useState<Question | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [answeredCount, setAnsweredCount] = useState<number>(0);
  const [correctOption, setCorrectOption] = useState<string>('');
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  
  // Local IP hoặc Domain thực tế cho QR code
  const joinUrl = `${window.location.origin}/play?room=${roomId}`;

  useEffect(() => {
    socket.emit('host:create-room');

    socket.on('room-created', (id: string) => {
      setRoomId(id);
    });

    socket.on('update-players', (users: Player[]) => {
      setPlayers(users);
    });

    socket.on('new-question', (q: Question) => {
      setQuestion(q);
      setGameState('question');
      setTimeLeft(q.timeLimit);
      setAnsweredCount(0);
      setIsPaused(false);
    });

    socket.on('player-answered', ({ answeredCount }) => {
      setAnsweredCount(answeredCount);
    });

    socket.on('question-result', ({ correctOption, leaderboard }) => {
      setCorrectOption(correctOption);
      setLeaderboard(leaderboard);
      setGameState('result');
    });

    socket.on('game-over', (res: any) => {
      setLeaderboard(res.leaderboard);
      setGameState('podium');
      triggerConfetti();
    });

    socket.on('timer-paused', () => setIsPaused(true));
    socket.on('timer-resumed', () => setIsPaused(false));

    return () => {
      socket.off('room-created');
      socket.off('update-players');
      socket.off('new-question');
      socket.off('player-answered');
      socket.off('question-result');
      socket.off('game-over');
      socket.off('timer-paused');
      socket.off('timer-resumed');
    };
  }, []);

  useEffect(() => {
    let timer: any;
    if (gameState === 'question' && timeLeft > 0 && !isPaused) {
      timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [gameState, timeLeft, isPaused]);

  useEffect(() => {
    let audio: HTMLAudioElement | null = null;
    if (gameState === 'question') {
      audio = new Audio('/bgm.mp3');
      audio.loop = true;
      audio.play().catch(e => console.error("Audio autoplay bị trình duyệt chặn:", e));
    }
    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, [gameState]);

  const startGame = () => socket.emit('host:start-game', roomId);
  const nextQuestion = () => socket.emit('host:next-question', roomId);
  const togglePause = () => socket.emit('host:toggle-pause', roomId);

  const triggerConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#fbbf24', '#ef4444', '#22c55e', '#3b82f6'] });
      confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#fbbf24', '#ef4444', '#22c55e', '#3b82f6'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  };

  const colors = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500'];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="bg-white shadow py-4 px-8 flex justify-between items-center border-b-4 border-eschool-gold">
        <h1 className="text-3xl font-black text-slate-800">eSchool <span className="text-eschool-gold">QUIZ</span></h1>
        <div className="flex items-center gap-4 bg-slate-100 px-4 py-2 rounded-full font-bold text-lg">
          PIN: <span className="text-3xl tracking-widest text-blue-600">{roomId}</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-8 relative">
        <AnimatePresence mode="wait">
          
          {/* LOBBY */}
          {gameState === 'lobby' && (
            <motion.div key="lobby" initial={{opacity:0, scale:0.9}} animate={{opacity:1, scale:1}} exit={{opacity:0, y:-50}} className="flex flex-col md:flex-row w-full max-w-6xl gap-8 md:gap-12">
              {/* QR Sidebar */}
              <div className="w-full md:w-1/3 bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center border border-slate-200">
                <h2 className="text-2xl font-bold mb-6 text-center text-slate-700">Quét mã để tham gia</h2>
                <div className="bg-white p-4 rounded-xl shadow-inner border border-slate-100 mb-6">
                  {roomId && <QRCodeSVG value={joinUrl} size={240} />}
                </div>
                <div className="text-center w-full bg-slate-100 py-3 rounded-lg font-mono text-sm break-all mb-6">
                  {joinUrl}
                </div>
                <button onClick={startGame} disabled={players.length === 0} className="w-full py-4 bg-eschool-gold hover:bg-yellow-400 text-yellow-900 font-bold text-xl rounded-xl transition shadow flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  <Play /> {players.length === 0 ? "Chờ người chơi..." : "Bắt đầu ngay"}
                </button>
              </div>

              {/* Player Grid */}
              <div className="w-full md:w-2/3">
                <div className="flex justify-between items-end mb-6">
                  <h2 className="text-3xl font-bold flex items-center gap-2"><Users className="text-blue-500" /> Sảnh chờ</h2>
                  <span className="text-xl font-bold bg-blue-100 text-blue-800 px-4 py-1 rounded-full">{players.length} người</span>
                </div>
                <div className="flex flex-wrap gap-4">
                  <AnimatePresence>
                    {players.map(p => (
                      <motion.div key={p.id} initial={{scale:0}} animate={{scale:1}} className="bg-white px-6 py-3 rounded-xl shadow font-bold text-lg text-slate-700">
                        {p.name}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

          {/* QUESTION */}
          {gameState === 'question' && question && (
            <motion.div key="question" initial={{opacity:0, y:50}} animate={{opacity:1, y:0}} exit={{opacity:0, scale:0.9}} className="w-full max-w-5xl flex flex-col items-center h-full justify-between">
              
              <div className="w-full text-center bg-white p-12 rounded-3xl shadow-xl flex-1 flex items-center justify-center mb-8 relative overflow-hidden">
                {/* Timer Circle & Pause Button */}
                <div className="absolute -left-6 -top-6 flex flex-col items-center gap-2 z-20">
                  <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center shadow-lg border-4 border-white text-3xl font-black text-white">
                    {timeLeft}
                  </div>
                  <button 
                    onClick={togglePause} 
                    className="flex items-center gap-1 bg-white border-2 border-slate-200 shadow rounded-full px-4 py-1 text-slate-700 font-bold hover:bg-slate-50 transition ml-8 cursor-pointer"
                  >
                    {isPaused ? <><Play size={16}/> Tiếp</> : <><Pause size={16}/> Ngưng</>}
                  </button>
                </div>
                {question.image && (
                  <img src={question.image} alt="Minh hoạ" className="absolute w-full h-full object-cover opacity-20 pointer-events-none z-0" />
                )}
                <h2 className="text-4xl md:text-5xl font-bold leading-tight text-slate-800 z-10"><Latex>{question.question}</Latex></h2>
              </div>
              
              <div className="w-full flex justify-end font-bold text-xl text-slate-500 mb-4 px-4">
                Đã trả lời: {answeredCount} / {players.length}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full md:h-64 h-auto">
                {question.options.map((opt, i) => (
                  <div key={opt.id} className={`${colors[i]} rounded-2xl flex items-center p-6 shadow-md text-white min-h-24`}>
                    <div className="w-12 h-12 bg-white/20 rounded flex shrink-0 items-center justify-center font-bold text-3xl mr-6">{opt.id}</div>
                    <span className="text-xl md:text-3xl font-semibold leading-tight"><Latex>{opt.text}</Latex></span>
                  </div>
                ))}
              </div>

            </motion.div>
          )}

          {/* RESULT & LEADERBOARD (COMBINED) */}
          {gameState === 'result' && question && (
            <motion.div key="result" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="w-full max-w-6xl flex flex-col md:flex-row gap-8 md:gap-12 h-full">
              {/* Question overview */}
              <div className="w-full md:w-1/2 flex flex-col justify-between">
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow flex-1 flex items-center justify-center mb-6 relative overflow-hidden min-h-32">
                  {question.image && (
                    <img src={question.image} alt="Minh hoạ" className="absolute w-full h-full object-cover opacity-20 pointer-events-none z-0" />
                  )}
                  <h2 className="text-2xl md:text-3xl font-bold text-slate-800 text-center z-10"><Latex>{question.question}</Latex></h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:h-64 h-auto">
                  {question.options.map((opt, i) => {
                    const isCorrect = opt.id === correctOption;
                    return (
                      <div key={opt.id} className={`${colors[i]} ${!isCorrect && 'opacity-30'} rounded-2xl flex items-center p-4 shadow text-white transition-all`}>
                        <span className="text-2xl font-bold"><Latex>{opt.text}</Latex></span>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Leaderboard side */}
              <div className="w-full md:w-1/2 bg-white rounded-3xl shadow-xl p-6 md:p-8 flex flex-col overflow-y-auto">
                <h2 className="text-2xl md:text-3xl font-bold mb-6 text-slate-800 flex items-center gap-3"><Trophy className="text-yellow-500"/> Bảng Xếp Hạng</h2>
                <div className="flex-1 flex flex-col gap-4">
                  {leaderboard.map((p, i) => (
                    <motion.div initial={{x:50, opacity:0}} animate={{x:0, opacity:1}} transition={{delay: i*0.1}} key={p.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border-l-8 border-blue-500 shadow-sm">
                      <div className="flex gap-4 items-center">
                        <span className="font-bold text-2xl text-slate-400 w-6">{i+1}</span>
                        <span className="font-bold text-2xl text-slate-700">{p.name}</span>
                      </div>
                      <span className="font-bold text-2xl text-blue-600">{p.score}</span>
                    </motion.div>
                  ))}
                </div>
                <button onClick={nextQuestion} className="mt-8 py-4 w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xl rounded-xl shadow flex justify-center items-center gap-2">
                  Câu tiếp theo <ArrowRight />
                </button>
              </div>
            </motion.div>
          )}

          {/* PODIUM */}
          {gameState === 'podium' && (
            <motion.div key="podium" initial={{scale:0.8, opacity:0}} animate={{scale:1, opacity:1}} className="w-full max-w-4xl flex flex-col items-center">
              <Trophy size={120} className="text-yellow-500 mb-8" />
              <h2 className="text-4xl md:text-6xl font-black text-slate-800 mb-12 uppercase tracking-wide text-center">Nhà Vô Địch</h2>
              <div className="flex items-end justify-center w-full min-h-64 md:h-96 gap-2 md:gap-4 px-2">
                
                {/* 2nd place */}
                {leaderboard[1] && (
                  <motion.div initial={{y:200}} animate={{y:0}} transition={{delay: 0.5}} className="flex flex-col items-center flex-1">
                    <span className="text-2xl font-bold mb-2 text-slate-600">{leaderboard[1].name}</span>
                    <span className="font-bold text-blue-600 mb-2">{leaderboard[1].score} pts</span>
                    <div className="w-full bg-slate-300 h-48 rounded-t-lg flex justify-center pt-4 text-4xl font-bold text-slate-500">2</div>
                  </motion.div>
                )}
                
                {/* 1st place */}
                {leaderboard[0] && (
                  <motion.div initial={{y:200}} animate={{y:0}} transition={{delay: 1}} className="flex flex-col items-center flex-1 z-10">
                    <span className="text-3xl font-black mb-2 text-slate-800">{leaderboard[0].name}</span>
                    <span className="font-bold text-xl text-yellow-600 mb-2">{leaderboard[0].score} pts</span>
                    <div className="w-full bg-yellow-400 h-64 rounded-t-lg flex justify-center pt-6 text-6xl font-black text-yellow-700 shadow-[0_-10px_20px_rgba(250,204,21,0.3)]">1</div>
                  </motion.div>
                )}

                {/* 3rd place */}
                {leaderboard[2] && (
                  <motion.div initial={{y:200}} animate={{y:0}} transition={{delay: 0.2}} className="flex flex-col items-center flex-1">
                    <span className="text-2xl font-bold mb-2 text-slate-600">{leaderboard[2].name}</span>
                    <span className="font-bold text-blue-600 mb-2">{leaderboard[2].score} pts</span>
                    <div className="w-full bg-orange-300 h-32 rounded-t-lg flex justify-center pt-4 text-4xl font-bold text-orange-700">3</div>
                  </motion.div>
                )}

              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
