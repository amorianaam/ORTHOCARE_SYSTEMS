import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import { toast } from 'react-toastify';
import { Eye, EyeOff, Stethoscope } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        login(data.user, data.token);
        const name = data.user.fullName || data.user.full_name || data.user.username;
        toast.success('أهلاً وسهلاً، ' + name);
        const role = data.user.role;
        const roleRoutes = {
          doctor:               '/doctor/queue',
          secretary:            '/secretary/register',
          cashier:              '/cashier/board',
          lab:                  '/lab/dashboard?tab=pending',
          radiology:            '/radiology/dashboard?tab=pending',
          surgery_coordinator:  '/surgery/operations',
          or_store:             '/or-store',
          general_store:        '/general-store',
          auditor:              '/auditor/dashboard',
        };
        navigate(roleRoutes[role] || '/doctor/queue');
      } else {
        setShake(true);
        setTimeout(() => setShake(false), 500);
        toast.error(data.message || 'اسم المستخدم أو كلمة المرور غير صحيحة');
      }
    } catch {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      toast.error('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" dir="rtl"
      style={{ background: 'linear-gradient(135deg, #1E3A8A 0%, #1E40AF 40%, #3B82F6 100%)' }}
    >
      {/* Decorative blobs */}
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, #60A5FA, transparent)' }} />
      <div className="absolute bottom-[-10%] left-[-5%] w-80 h-80 rounded-full opacity-15"
        style={{ background: 'radial-gradient(circle, #93C5FD, transparent)' }} />
      <div className="absolute top-1/2 left-[10%] w-40 h-40 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #BFDBFE, transparent)' }} />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg,#fff 0px,transparent 1px,transparent 40px,#fff 40px),repeating-linear-gradient(90deg,#fff 0px,transparent 1px,transparent 40px,#fff 40px)',
          backgroundSize: '40px 40px'
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-10 pb-6 text-center"
            style={{ background: 'linear-gradient(135deg, #1E40AF, #3B82F6)' }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
              className="w-20 h-20 mx-auto rounded-2xl bg-white/20 flex items-center justify-center mb-4 shadow-lg backdrop-blur"
            >
              <Stethoscope className="w-10 h-10 text-white" />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-2xl font-bold text-white tracking-wide"
            >
              ORTHOCARE
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-blue-100 text-sm mt-1"
            >
              مركز الدكتور أحمد أنعم لجراحة العظام والمفاصل
            </motion.p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
            {/* Username */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <label className="block text-sm font-semibold text-gray-700 mb-2">اسم المستخدم</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="input-base"
                placeholder="أدخل اسم المستخدم"
              />
            </motion.div>

            {/* Password */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <label className="block text-sm font-semibold text-gray-700 mb-2">كلمة المرور</label>
              <motion.div
                animate={shake ? { x: [0, -10, 10, -10, 10, 0] } : { x: 0 }}
                transition={{ duration: 0.4 }}
                className="relative"
              >
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="input-base pl-12"
                  placeholder="أدخل كلمة المرور"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </motion.div>
            </motion.div>

            {/* Submit */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-white text-base transition-all duration-300 shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                style={{
                  background: loading
                    ? '#93C5FD'
                    : 'linear-gradient(135deg, #1E40AF, #3B82F6)',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    جاري تسجيل الدخول...
                  </>
                ) : (
                  'تسجيل الدخول'
                )}
              </button>
            </motion.div>
          </form>

          {/* Footer */}
          <div className="px-8 pb-6 text-center">
            <p className="text-xs text-gray-400">ORTHOCARE System &copy; {new Date().getFullYear()}</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
