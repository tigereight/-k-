import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Lock, Loader2, Sparkles, ArrowLeft, ShieldCheck } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthView = 'login' | 'signup' | 'forgot' | 'otp' | 'reset-password';
type OtpType = 'signup' | 'magiclink' | 'recovery';

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpType, setOtpType] = useState<OtpType>('magiclink');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [countdown, setCountdown] = useState(0);
  const otpInputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    let timer: any;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setView('login');
      setEmail('');
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setOtp(['', '', '', '', '', '']);
      setMessage(null);
      setLoading(false);
    }
  }, [isOpen]);

  const handleSendOtp = async (type: OtpType) => {
    setLoading(true);
    setMessage(null);
    try {
      let error;
      if (type === 'magiclink') {
        const { error: err } = await supabase.auth.signInWithOtp({ 
          email,
          options: { shouldCreateUser: false }
        });
        error = err;
      } else if (type === 'recovery') {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email);
        error = err;
      } else if (type === 'signup') {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
        });
        error = err;
      }

      if (error) throw error;

      setOtpType(type);
      setView('otp');
      setCountdown(60);
      setMessage({ type: 'success', text: '验证码已发送至您的邮箱，请查收。' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '发送验证码失败，请重试' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const token = otp.join('');
    if (token.length !== 6) {
      setMessage({ type: 'error', text: '请输入6位验证码' });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: otpType,
      });

      if (error) throw error;

      if (otpType === 'recovery') {
        setView('reset-password');
      } else {
        setMessage({ type: 'success', text: '验证成功！' });
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '验证码错误或已过期' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      onClose();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '登录失败，请检查邮箱和密码' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: '两次输入的密码不一致' });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setMessage({ type: 'success', text: '密码重置成功！' });
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '重置密码失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  if (!isOpen) return null;

  const renderHeader = () => {
    let title = '欢迎回来';
    let subtitle = '登录以访问您的报告和草药余额';
    
    if (view === 'signup') {
      title = '开启您的健康旅程';
      subtitle = '创建一个账号以保存您的报告并获取更多功能';
    } else if (view === 'forgot') {
      title = '找回密码';
      subtitle = '输入您的邮箱，我们将向您发送验证码';
    } else if (view === 'otp') {
      title = '输入验证码';
      subtitle = `验证码已发送至 ${email}`;
    } else if (view === 'reset-password') {
      title = '设置新密码';
      subtitle = '请为您的账号设置一个新的登录密码';
    }

    return (
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-jade/10 flex items-center justify-center mb-4 border border-jade/20">
          <Sparkles className="w-8 h-8 text-jade" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
        <p className="text-zinc-400 text-sm">{subtitle}</p>
      </div>
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
        >
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-8 pt-12">
            {renderHeader()}

            {view === 'login' && (
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest ml-1">电子邮箱</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-jade/50 transition-all"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest">密码</label>
                    <button
                      type="button"
                      onClick={() => setView('forgot')}
                      className="text-[10px] text-jade hover:text-jade-dark transition-colors uppercase tracking-wider font-bold"
                    >
                      忘记密码？
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-jade/50 transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {message && (
                  <div className={`p-4 rounded-2xl text-sm ${
                    message.type === 'success' ? 'bg-jade/10 text-jade border border-jade/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {message.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-jade hover:bg-jade-dark text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-jade/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '立即登录'}
                </button>

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-zinc-900 px-2 text-zinc-500">或者</span></div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSendOtp('magiclink')}
                  disabled={loading || !email}
                  className="w-full bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '使用验证码登录'}
                </button>
              </form>
            )}

            {view === 'signup' && (
              <form onSubmit={(e) => { e.preventDefault(); handleSendOtp('signup'); }} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest ml-1">电子邮箱</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-jade/50 transition-all"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest ml-1">设置密码</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-jade/50 transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {message && (
                  <div className={`p-4 rounded-2xl text-sm ${
                    message.type === 'success' ? 'bg-jade/10 text-jade border border-jade/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {message.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-jade hover:bg-jade-dark text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-jade/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '发送验证码并注册'}
                </button>
              </form>
            )}

            {view === 'forgot' && (
              <form onSubmit={(e) => { e.preventDefault(); handleSendOtp('recovery'); }} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest ml-1">电子邮箱</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-jade/50 transition-all"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>

                {message && (
                  <div className={`p-4 rounded-2xl text-sm ${
                    message.type === 'success' ? 'bg-jade/10 text-jade border border-jade/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {message.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-jade hover:bg-jade-dark text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-jade/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '发送重置验证码'}
                </button>
              </form>
            )}

            {view === 'otp' && (
              <div className="space-y-6">
                <div className="flex justify-between gap-2">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={el => { otpInputs.current[index] = el; }}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-12 h-14 bg-white/[0.03] border border-white/10 rounded-xl text-center text-xl font-bold text-white focus:outline-none focus:border-jade transition-all"
                    />
                  ))}
                </div>

                {message && (
                  <div className={`p-4 rounded-2xl text-sm ${
                    message.type === 'success' ? 'bg-jade/10 text-jade border border-jade/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {message.text}
                  </div>
                )}

                <button
                  onClick={handleVerifyOtp}
                  disabled={loading || otp.some(d => !d)}
                  className="w-full bg-jade hover:bg-jade-dark text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-jade/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '验证验证码'}
                </button>

                <div className="text-center">
                  <button
                    onClick={() => handleSendOtp(otpType)}
                    disabled={countdown > 0 || loading}
                    className="text-xs font-bold text-jade hover:text-jade-dark transition-colors disabled:opacity-50 uppercase tracking-widest"
                  >
                    {countdown > 0 ? `重新发送 (${countdown}s)` : '重新发送验证码'}
                  </button>
                </div>
              </div>
            )}

            {view === 'reset-password' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest ml-1">新密码</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-jade/50 transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest ml-1">确认新密码</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-jade/50 transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {message && (
                  <div className={`p-4 rounded-2xl text-sm ${
                    message.type === 'success' ? 'bg-jade/10 text-jade border border-jade/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {message.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-jade hover:bg-jade-dark text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-jade/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '重置密码'}
                </button>
              </form>
            )}

            <div className="mt-8 text-center space-y-4">
              {view === 'otp' ? (
                <button
                  onClick={() => setView(otpType === 'signup' ? 'signup' : (otpType === 'recovery' ? 'forgot' : 'login'))}
                  className="flex items-center justify-center gap-2 text-zinc-400 hover:text-jade text-sm transition-colors mx-auto"
                >
                  <ArrowLeft className="w-4 h-4" /> 返回修改邮箱
                </button>
              ) : view === 'reset-password' ? null : (
                <button
                  onClick={() => {
                    setView(view === 'login' ? 'signup' : 'login');
                    setMessage(null);
                  }}
                  className="text-zinc-400 hover:text-jade text-sm transition-colors"
                >
                  {view === 'signup' ? '已有账号？立即登录' : '还没有账号？立即注册'}
                </button>
              )}
              
              {view === 'forgot' && (
                <button
                  onClick={() => setView('login')}
                  className="block w-full text-zinc-400 hover:text-jade text-sm transition-colors"
                >
                  返回登录
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

