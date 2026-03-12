import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Lock, Loader2, Sparkles, ArrowLeft, CheckCircle2, Send } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup' | 'reset-password';
  onRefresh?: () => void;
}

type AuthMode = 'login' | 'signup' | 'magic-link' | 'forgot-password' | 'mail-sent' | 'reset-password';

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, initialMode = 'login', onRefresh }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>(initialMode as AuthMode);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode as AuthMode);
      setMessage(null);
    }
  }, [isOpen, initialMode]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          }
        });
        if (error) throw error;
        setMode('mail-sent');
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onClose();
      } else if (mode === 'magic-link') {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin,
          }
        });
        if (error) throw error;
        setMode('mail-sent');
      } else if (mode === 'forgot-password') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/?reset=true',
        });
        if (error) throw error;
        setMode('mail-sent');
      } else if (mode === 'reset-password') {
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (error) throw error;
        setMessage({ type: 'success', text: '密码重置成功！正在为您登录...' });
        setTimeout(() => onClose(), 2000);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '操作失败，请重试' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const renderContent = () => {
    if (mode === 'mail-sent') {
      return (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6 py-4"
        >
          <div className="w-20 h-20 rounded-full bg-jade/10 flex items-center justify-center mx-auto border border-jade/20">
            <Send className="w-10 h-10 text-jade animate-pulse" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-white serif">邮件已发送</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              我们已向 <span className="text-jade font-medium">{email}</span> 发送了验证链接。<br />
              请在手机或浏览器中查收邮件并点击链接。
            </p>
          </div>
          <div className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl text-xs text-zinc-500 leading-relaxed">
            提示：如果您在电脑端操作，在手机端点击链接后，此页面将自动感知并为您跳转。
          </div>
          
          <div className="pt-4 space-y-4">
            <button
              onClick={async () => {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                  onRefresh?.();
                } else {
                  setMessage({ type: 'error', text: '未检测到登录状态，请确保您已点击邮件中的链接。' });
                }
              }}
              className="w-full bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl text-sm transition-all border border-white/10"
            >
              我已完成验证，手动刷新状态
            </button>
            
            <button
              onClick={() => setMode('login')}
              className="text-zinc-500 hover:text-white text-sm transition-colors flex items-center justify-center gap-2 mx-auto"
            >
              <ArrowLeft className="w-4 h-4" /> 返回登录
            </button>
          </div>
        </motion.div>
      );
    }

    return (
      <>
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-jade/10 flex items-center justify-center mb-4 border border-jade/20">
            <Sparkles className="w-8 h-8 text-jade" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {mode === 'signup' ? '开启您的健康旅程' : 
             mode === 'magic-link' ? '无密码登录' :
             mode === 'forgot-password' ? '重置密码' :
             mode === 'reset-password' ? '设置新密码' : '欢迎回来'}
          </h2>
          <p className="text-zinc-400 text-sm">
            {mode === 'signup' ? '创建一个账号以保存您的报告并获取更多功能' : 
             mode === 'magic-link' ? '输入邮箱，我们将为您发送登录链接' :
             mode === 'forgot-password' ? '输入您的邮箱以接收密码重置链接' :
             mode === 'reset-password' ? '请为您的账号设置一个新密码' : '登录以访问您的报告和草药余额'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {mode !== 'reset-password' && (
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
          )}

          {(mode === 'login' || mode === 'signup') && (
            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest">
                  密码
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => setMode('forgot-password')}
                    className="text-[10px] text-zinc-500 hover:text-jade transition-colors"
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

          {mode === 'reset-password' && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest ml-1">
                新密码
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-jade/50 transition-all"
                  placeholder="输入新密码"
                />
              </div>
            </div>
          )}

          {message && (
            <div className={`p-4 rounded-2xl text-sm flex items-start gap-3 ${
              message.type === 'success' ? 'bg-jade/10 text-jade border border-jade/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <X className="w-5 h-5 shrink-0" />}
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
              mode === 'signup' ? '立即注册' : 
              mode === 'magic-link' ? '发送登录链接' :
              mode === 'forgot-password' ? '发送重置链接' :
              mode === 'reset-password' ? '重置密码' : '登录'
            )}
          </button>
        </form>

        <div className="mt-8 space-y-4 text-center">
          {mode === 'login' && (
            <button
              onClick={() => setMode('magic-link')}
              className="w-full py-3 rounded-2xl border border-white/5 text-zinc-400 hover:text-white hover:bg-white/[0.02] text-sm transition-all"
            >
              使用邮箱验证链接登录
            </button>
          )}

          <button
            onClick={() => {
              if (mode === 'login') setMode('signup');
              else setMode('login');
              setMessage(null);
            }}
            className="text-zinc-400 hover:text-jade text-sm transition-colors"
          >
            {mode === 'signup' ? '已有账号？立即登录' : 
             mode === 'login' ? '还没有账号？立即注册' : '返回登录'}
          </button>
        </div>
      </>
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
            className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-8 pt-12">
            {renderContent()}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
