import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Lock, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthView = 'login' | 'signup' | 'forgot' | 'success';

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setView('login');
      setEmail('');
      setPassword('');
      setMessage(null);
      setLoading(false);
    }
  }, [isOpen]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setMessage({ type: 'error', text: '密码长度至少需要6位' });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('User already registered')) {
          setMessage({ type: 'error', text: '该邮箱已注册，请直接登录' });
        } else {
          throw error;
        }
        return;
      }

      if (data.session) {
        setView('success');
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        // This might happen if email confirmation is still enabled on Supabase dashboard
        // but the user said it's closed. We'll handle it gracefully.
        setMessage({ type: 'success', text: '注册成功！请登录。' });
        setTimeout(() => setView('login'), 2000);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '注册失败，请稍后重试' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      if (data.session) {
        onClose();
      }
    } catch (error: any) {
      let errorText = '登录失败，请检查邮箱和密码';
      if (error.message.includes('Invalid login credentials')) {
        errorText = '邮箱或密码错误';
      }
      setMessage({ type: 'error', text: errorText });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setMessage({ type: 'success', text: '重置邮件已发送，请检查您的邮箱' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '发送失败，请重试' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const renderHeader = () => {
    if (view === 'success') return null;

    let title = '欢迎回来';
    let subtitle = '登录以访问您的报告和草药余额';
    
    if (view === 'signup') {
      title = '开启您的健康旅程';
      subtitle = '创建一个账号以保存您的报告并获取更多功能';
    } else if (view === 'forgot') {
      title = '找回密码';
      subtitle = '输入您的邮箱，我们将向您发送重置链接';
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
          {view !== 'success' && (
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="p-8 pt-12">
            {view === 'success' ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center text-center py-12"
              >
                <div className="w-20 h-20 rounded-full bg-jade/20 flex items-center justify-center mb-6 border border-jade/30">
                  <CheckCircle2 className="w-10 h-10 text-jade" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">欢迎加入</h2>
                <p className="text-zinc-400">正在进入系统，请稍候...</p>
                <div className="mt-8">
                  <Loader2 className="w-6 h-6 text-jade animate-spin" />
                </div>
              </motion.div>
            ) : (
              <>
                {renderHeader()}

                {view === 'login' && (
                  <form onSubmit={handleLogin} className="space-y-4">
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

                    <div className="pt-4 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setView('signup');
                          setMessage(null);
                        }}
                        className="text-zinc-400 hover:text-jade text-sm transition-colors"
                      >
                        还没有账号？立即注册
                      </button>
                    </div>
                  </form>
                )}

                {view === 'signup' && (
                  <form onSubmit={handleSignUp} className="space-y-4">
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
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '立即注册'}
                    </button>

                    <div className="pt-4 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setView('login');
                          setMessage(null);
                        }}
                        className="text-zinc-400 hover:text-jade text-sm transition-colors"
                      >
                        已有账号？立即登录
                      </button>
                    </div>
                  </form>
                )}

                {view === 'forgot' && (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
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
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '发送重置链接'}
                    </button>

                    <div className="pt-4 text-center">
                      <button
                        type="button"
                        onClick={() => setView('login')}
                        className="text-zinc-400 hover:text-jade text-sm transition-colors"
                      >
                        返回登录
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

