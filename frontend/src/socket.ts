import { io, Socket } from 'socket.io-client';

// Kết nối động tới Backend (có thể cấu hình qua biến môi trường)
const URL = import.meta.env.VITE_BACKEND_URL || `http://${window.location.hostname}:18346`;

export const socket: Socket = io(URL, {
  autoConnect: true,
  transports: ['websocket', 'polling']
});
