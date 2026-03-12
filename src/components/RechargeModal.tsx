import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Zap, Loader2, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';

interface RechargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PACKAGES = [
  { id: 'p1', amount: 10, herbs: 10, label: '初试草药' },
  { id: 'p2', amount: 30, herbs: 33, label: '进阶草药', popular: true },
  { id: 'p3', amount: 50, herbs: 60, label: '至尊草药' },
];

export const RechargeModal: React.FC<RechargeModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  const handleRecharge = async (packageId: string) => {
    setLoading(true);
    try {
      const response = await axios.post('/api/pay', { packageId });
      setPayUrl(response.data.pay_url);
      setOrderId(response.data.order_id);
      
      // Start polling for payment status
      startPolling(response.data.order_id);
    } catch (error) {
      console.error('Payment failed:', error);
      alert('发起支付失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (id: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`/api/pay/status/${id}`);
        if (res.data.status === 'success') {
          clearInterval(interval);
          onSuccess();
          onClose();
          alert('充值成功！');
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 3000);

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(interval), 5 * 60 * 1000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-zinc-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
        >
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center border border-gold/20">
                <Zap className="w-6 h-6 text-gold" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">草药充值 🌿</h2>
                <p className="text-zinc-500 text-xs uppercase tracking-widest">Recharge Herbs for Reports</p>
              </div>
            </div>

            {payUrl ? (
              <div className="flex flex-col items-center text-center py-8">
                <div className="p-4 bg-white rounded-2xl mb-6">
                  <QRCodeSVG value={payUrl} size={200} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">请使用微信扫码支付</h3>
                <p className="text-zinc-400 text-sm mb-6">支付完成后余额将自动更新</p>
                <button
                  onClick={() => setPayUrl(null)}
                  className="text-zinc-500 hover:text-white text-sm transition-colors"
                >
                  返回选择套餐
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {PACKAGES.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => handleRecharge(pkg.id)}
                    disabled={loading}
                    className={`relative p-6 rounded-2xl border transition-all flex items-center justify-between group ${
                      pkg.popular 
                        ? 'bg-jade/5 border-jade/30 hover:border-jade/50' 
                        : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                    }`}
                  >
                    {pkg.popular && (
                      <span className="absolute -top-2.5 left-6 px-2 py-0.5 bg-jade text-[10px] font-bold text-white rounded uppercase tracking-widest">
                        最受欢迎
                      </span>
                    )}
                    <div className="text-left">
                      <h3 className="text-white font-bold mb-1">{pkg.label}</h3>
                      <p className="text-zinc-400 text-sm">{pkg.herbs} 棵草药 🌿</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-white">¥{pkg.amount}</div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-widest">微信支付</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-jade" />
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
