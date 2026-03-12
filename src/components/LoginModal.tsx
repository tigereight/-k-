import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Lock, Loader2, Sparkles } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setMessage({ type: 'success', text: '重置密码链接已发送至您的邮箱，请检查。' });
      } else if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage({ type: 'success', text: '注册成功！请检查邮箱进行验证。' });
        // 自动切换到登录界面
        setTimeout(() => {
          setIsSignUp(false);
        }, 2000);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onClose();
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '操作失败，请重试' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

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
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-jade/10 flex items-center justify-center mb-4 border border-jade/20">
                <Sparkles className="w-8 h-8 text-jade" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {isForgotPassword ? '重置您的密码' : (isSignUp ? '开启您的健康旅程' : '欢迎回来')}
              </h2>
              <p className="text-zinc-400 text-sm">
                {isForgotPassword 
                  ? '输入您的邮箱，我们将向您发送重置密码的链接' 
                  : (isSignUp ? '创建一个账号以保存您的报告并获取更多功能' : '登录以访问您的报告和草药余额')}
              </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest ml-1">
                  电子邮箱
                </label>
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

              {!isForgotPassword && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest">
                      密码
                    </label>
                    {!isSignUp && (
                      <button
                        type="button"
                        onClick={() => setIsForgotPassword(true)}
                        className="text-[10px] text-jade hover:text-jade-dark transition-colors uppercase tracking-wider font-bold"
                      >
                        忘记密码？
                      </button>
                    )}
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
              )}

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
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  isForgotPassword ? '发送重置链接' : (isSignUp ? '立即注册' : '登录')
                )}
              </button>
            </form>

            <div className="mt-8 text-center space-y-4">
              {isForgotPassword ? (
                <button
                  onClick={() => setIsForgotPassword(false)}
                  className="text-zinc-400 hover:text-jade text-sm transition-colors"
                >
                  返回登录
                </button>
              ) : (
                <button
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-zinc-400 hover:text-jade text-sm transition-colors"
                >
                  {isSignUp ? '已有账号？立即登录' : '还没有账号？立即注册'}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>

  );
};
