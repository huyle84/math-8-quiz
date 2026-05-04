import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { questions } from './questions';

const app = express();
app.use(cors());

app.get('/', (req, res) => {
  res.send('eSchool Math Backend is running perfectly! Socket.io is ready.');
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

interface Player {
  id: string;
  name: string;
  score: number;
}

interface Room {
  roomId: string;
  hostId: string;
  players: Record<string, Player>;
  gameState: 'lobby' | 'question' | 'result' | 'podium';
  selectedQuestions: any[]; // Lưu trữ 10 câu hỏi ngẫu nhiên cho ván này
  currentQuestionIndex: number;
  questionStartTime: number;
  answeredCount: number;
  isPaused: boolean;
  timeRemainingMs: number;
  lastResumeTime: number;
  timerId?: NodeJS.Timeout;
}

const rooms: Record<string, Room> = {};

const generateRoomId = () => Math.floor(1000 + Math.random() * 9000).toString();

const forceShowResult = (roomId: string) => {
  const room = rooms[roomId];
  if (room && room.gameState === 'question') {
    if (room.timerId) clearTimeout(room.timerId);
    room.gameState = 'result';
    const question = room.selectedQuestions[room.currentQuestionIndex];
    if (!question) return;
    const correctOption = question.options.find((o:any) => o.isCorrect)?.id;
    const sortedPlayers = Object.values(room.players).sort((a, b) => b.score - a.score);
    const playerRanks: Record<string, number> = {};
    sortedPlayers.forEach((p, i) => { playerRanks[p.id] = i + 1; });
    
    io.to(roomId).emit('question-result', { 
      correctOption, 
      leaderboard: sortedPlayers.slice(0, 5),
      playerRanks,
      totalPlayers: sortedPlayers.length
    });
  }
};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('host:create-room', () => {
    let roomId = generateRoomId();
    while (rooms[roomId]) { roomId = generateRoomId(); }
    rooms[roomId] = {
      roomId, hostId: socket.id, players: {},
      gameState: 'lobby', selectedQuestions: [], currentQuestionIndex: -1,
      questionStartTime: 0, answeredCount: 0,
      isPaused: false, timeRemainingMs: 0, lastResumeTime: 0
    };
    socket.join(roomId);
    socket.emit('room-created', roomId);
    console.log(`Room created: ${roomId}`);
  });

  socket.on('host:start-game', (roomId) => {
    const room = rooms[roomId];
    if (room && room.hostId === socket.id) {
      const chapters: Record<string, any[]> = {};
      questions.forEach(q => {
        const chapterName = q.category.split(' - ')[0]; // vd: "Chương 6"
        if (!chapters[chapterName]) chapters[chapterName] = [];
        chapters[chapterName].push(q);
      });
      
      let gameQuestions: any[] = [];
      Object.keys(chapters).forEach(chapPrefix => {
        const chapQs = chapters[chapPrefix];
        const lessons: Record<string, any[]> = {};
        chapQs.forEach(q => {
          if (!lessons[q.category]) lessons[q.category] = [];
          lessons[q.category].push(q);
        });
        
        let pool: Record<string, any[]> = {};
        Object.keys(lessons).forEach(k => pool[k] = [...lessons[k]].sort(() => 0.5 - Math.random()));
        const randomizedLessons = Object.keys(lessons).sort(() => 0.5 - Math.random());
        
        let chapResult: any[] = [];
        let index = 0;
        while (chapResult.length < 4 && randomizedLessons.some(k => pool[k].length > 0)) {
          const lKey = randomizedLessons[index % randomizedLessons.length];
          if (pool[lKey].length > 0) chapResult.push(pool[lKey].pop());
          index++;
        }
        gameQuestions.push(...chapResult);
      });

      gameQuestions = gameQuestions.map(q => ({ ...q, timeLimit: 30 }));
      room.selectedQuestions = gameQuestions.sort(() => 0.5 - Math.random());

      room.currentQuestionIndex = 0;
      room.gameState = 'question';
      room.questionStartTime = Date.now();
      room.answeredCount = 0;
      room.isPaused = false;
      const question = room.selectedQuestions[room.currentQuestionIndex];
      if (!question) return;
      
      room.timeRemainingMs = question.timeLimit * 1000;
      room.lastResumeTime = Date.now();

      // Bắt đầu đếm ngược thời gian ở Backend
      if (room.timerId) clearTimeout(room.timerId);
      room.timerId = setTimeout(() => forceShowResult(roomId), room.timeRemainingMs);

      const sanitizedQuestion = { ...question, options: question.options.map((o:any) => ({ id: o.id, text: o.text })) };
      io.to(roomId).emit('game-started');
      io.to(roomId).emit('new-question', sanitizedQuestion);
    }
  });

  socket.on('host:next-question', (roomId) => {
    const room = rooms[roomId];
    if (room && room.hostId === socket.id) {
      if (room.currentQuestionIndex < room.selectedQuestions.length - 1) {
        room.currentQuestionIndex++;
        room.gameState = 'question';
        room.questionStartTime = Date.now();
        room.answeredCount = 0;
        room.isPaused = false;
        const question = room.selectedQuestions[room.currentQuestionIndex];
        if (!question) return;

        room.timeRemainingMs = question.timeLimit * 1000;
        room.lastResumeTime = Date.now();

        if (room.timerId) clearTimeout(room.timerId);
        room.timerId = setTimeout(() => forceShowResult(roomId), room.timeRemainingMs);

        const sanitizedQuestion = { ...question, options: question.options.map((o:any) => ({ id: o.id, text: o.text })) };
        io.to(roomId).emit('new-question', sanitizedQuestion);
      } else {
        room.gameState = 'podium';
        const sortedPlayers = Object.values(room.players).sort((a, b) => b.score - a.score);
        const playerRanks: Record<string, number> = {};
        sortedPlayers.forEach((p, i) => { playerRanks[p.id] = i + 1; });
        io.to(roomId).emit('game-over', { leaderboard: sortedPlayers.slice(0, 5), playerRanks, totalPlayers: sortedPlayers.length });
      }
    }
  });

  socket.on('host:show-result', (roomId) => {
    const room = rooms[roomId];
    if (room && room.hostId === socket.id) {
      forceShowResult(roomId);
    }
  });

  socket.on('host:toggle-pause', (roomId) => {
    const room = rooms[roomId];
    if (room && room.hostId === socket.id && room.gameState === 'question') {
      if (room.isPaused) {
        room.isPaused = false;
        room.lastResumeTime = Date.now();
        room.timerId = setTimeout(() => forceShowResult(roomId), room.timeRemainingMs);
        io.to(roomId).emit('timer-resumed');
      } else {
        room.isPaused = true;
        clearTimeout(room.timerId);
        const passed = Date.now() - room.lastResumeTime;
        room.timeRemainingMs -= passed;
        if (room.timeRemainingMs < 0) room.timeRemainingMs = 0;
        io.to(roomId).emit('timer-paused');
      }
    }
  });

  socket.on('player:join', ({ roomId, name }) => {
    const room = rooms[roomId];
    if (room && room.gameState === 'lobby') {
      room.players[socket.id] = { id: socket.id, name, score: 0 };
      socket.join(roomId);
      socket.emit('joined-success', { id: socket.id, name });
      io.to(roomId).emit('update-players', Object.values(room.players));
    } else {
      socket.emit('join-error', 'Phòng không tồn tại hoặc trò chơi đã bắt đầu.');
    }
  });

  socket.on('player:submit-answer', ({ roomId, answerId }) => {
    const room = rooms[roomId];
    if (room && room.players[socket.id] && room.gameState === 'question') {
      const question = room.selectedQuestions[room.currentQuestionIndex];
      if (!question) return;
      const timeLimitMs = question.timeLimit * 1000;
      
      const passedSinceResume = room.isPaused ? 0 : (Date.now() - room.lastResumeTime);
      const totalPassed = timeLimitMs - (room.timeRemainingMs - passedSinceResume);
      
      const correctOption = question.options.find((o:any) => o.isCorrect)?.id;
      
      let pointsEarned = 0;
      if (answerId === correctOption) {
        const timeRatio = Math.max(0, 1 - (totalPassed / timeLimitMs));
        pointsEarned = 500 + Math.round(500 * timeRatio);
      }

      room.players[socket.id]!.score += pointsEarned;
      room.answeredCount++;
      
      socket.emit('answer-received', { pointsEarned, isCorrect: answerId===correctOption });
      
      // Tự động chuyển qua kết quả nếu tất cả đều nộp bài xong
      if (room.answeredCount >= Object.keys(room.players).length) {
        io.to(room.hostId).emit('player-answered', { 
          totalPlayers: Object.keys(room.players).length, 
          answeredCount: room.answeredCount 
        });
        setTimeout(() => forceShowResult(roomId), 1500);
      } else {
        io.to(room.hostId).emit('player-answered', { 
          totalPlayers: Object.keys(room.players).length, 
          answeredCount: room.answeredCount 
        });
      }
    }
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (!room) continue;
      if (room.hostId === socket.id) {
        io.to(roomId).emit('host-disconnected');
        delete rooms[roomId];
      } else if (room.players[socket.id]) {
        delete room.players[socket.id];
        io.to(roomId).emit('update-players', Object.values(room.players));
      }
    }
  });
});

const PORT = process.env.PORT || 18346;
server.listen(PORT, () => {
  console.log(`Socket.io Server is running on port ${PORT}`);
});
