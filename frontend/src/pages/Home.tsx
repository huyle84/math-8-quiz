import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Monitor, Smartphone } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <h1 className="text-5xl md:text-7xl font-black text-white mb-4 tracking-tight">
          eSchool <span className="text-eschool-gold">QUIZ</span>
        </h1>
        <p className="text-xl text-slate-300">Trường eSchool - Ôn tập Toán 8</p>
      </motion.div>

      <div className="flex flex-col md:flex-row gap-6">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/host')}
          className="flex flex-col items-center justify-center bg-blue-600 hover:bg-blue-500 text-white rounded-3xl p-8 w-64 h-64 shadow-xl transition-colors cursor-pointer"
        >
          <Monitor size={64} className="mb-4" />
          <span className="text-2xl font-bold">Làm Máy Chủ</span>
          <span className="text-sm opacity-80 mt-2 text-center">Tạo phòng và chiếu lên màn hình lớn</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/play')}
          className="flex flex-col items-center justify-center bg-green-500 hover:bg-green-400 text-white rounded-3xl p-8 w-64 h-64 shadow-xl transition-colors cursor-pointer"
        >
          <Smartphone size={64} className="mb-4" />
          <span className="text-2xl font-bold">Người Chơi</span>
          <span className="text-sm opacity-80 mt-2 text-center">Tham gia phòng bằng mã QR</span>
        </motion.button>
      </div>
    </div>
  );
}
