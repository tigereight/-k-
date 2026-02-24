import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactECharts from 'echarts-for-react';
import { 
  Activity, 
  Calendar, 
  ChevronDown, 
  Copy, 
  Download, 
  FileText, 
  Info, 
  Zap,
  Loader2,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface WylqSummary {
  ganzhi: string;
  suiyun: string;
  sitian: string;
  zaiquan: string;
  daily_fortune: string;
  daily_qi: string;
}

interface KlinePoint {
  age: number;
  open: number;
  close: number;
}

interface CalcResponse {
  wylq_summary: WylqSummary;
  kline_data: KlinePoint[];
  base_score: number;
}

interface ReportResponse {
  report: string;
}

// --- Components ---

const ModuleWrapper = ({ 
  id, 
  title, 
  number, 
  children, 
  isWaiting = false, 
  waitingText = "等待生成...",
  className = ""
}: { 
  id?: string;
  title: string; 
  number: string; 
  children: React.ReactNode; 
  isWaiting?: boolean;
  waitingText?: string;
  className?: string;
}) => {
  return (
    <div id={id} className={cn("glass-card relative overflow-hidden", className)}>
      <div className="p-6 md:p-8">
        <div className="flex items-center mb-6">
          <span className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mr-3 text-sm font-mono border border-emerald-500/20">
            {number}
          </span>
          <h2 className="text-xl font-semibold text-white tracking-tight serif">{title}</h2>
        </div>
        
        <div className={cn("relative transition-all duration-500", isWaiting && "min-h-[240px]")}>
          {children}
          
          <AnimatePresence>
            {isWaiting && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950/60 backdrop-blur-[2px] rounded-xl border border-dashed border-white/5"
              >
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <Clock className="w-6 h-6 text-white/20" />
                </div>
                <p className="text-zinc-500 text-base serif tracking-wide">{waitingText}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [year, setYear] = useState(1990);
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [daysInMonth, setDaysInMonth] = useState(31);

  const [calcData, setCalcData] = useState<CalcResponse | null>(null);
  const [report, setReport] = useState<string | null>(null);
  
  const [isCalculating, setIsCalculating] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  
  const [hasCalculated, setHasCalculated] = useState(false);
  const [hasGeneratedReport, setHasGeneratedReport] = useState(false);

  const chartRef = useRef<any>(null);

  // Initialize days
  useEffect(() => {
    const days = new Date(year, month, 0).getDate();
    setDaysInMonth(days);
    if (day > days) setDay(days);
  }, [year, month]);

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCalculating(true);
    setHasCalculated(false);
    setHasGeneratedReport(false);
    setReport(null);

    try {
      const response = await axios.post<CalcResponse>('/api/calculate', { year, month, day });
      setCalcData(response.data);
      setHasCalculated(true);
      
      // Scroll to results
      setTimeout(() => {
        document.getElementById('module-02')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (error) {
      console.error("Calculation error:", error);
      alert("计算失败，请检查网络连接或输入数据。");
    } finally {
      setIsCalculating(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!calcData) return;
    setIsGeneratingReport(true);

    try {
      const response = await axios.post<ReportResponse>('/api/generate-report', {
        wylq_summary: calcData.wylq_summary,
        kline_data: calcData.kline_data
      });
      setReport(response.data.report);
      setHasGeneratedReport(true);
      
      // Scroll to report
      setTimeout(() => {
        document.getElementById('module-04')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (error) {
      console.error("Report generation error:", error);
      alert("报告生成失败，请稍后重试。");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleCopyReport = () => {
    if (report) {
      navigator.clipboard.writeText(report);
      alert("报告已复制到剪贴板");
    }
  };

  const handleSaveImage = () => {
    if (chartRef.current) {
      const instance = chartRef.current.getEchartsInstance();
      const url = instance.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: '#141417'
      });
      const link = document.createElement('a');
      link.href = url;
      link.download = `AHI_Health_Chart_${year}_${month}_${day}.png`;
      link.click();
    }
  };

  const getChartOption = () => {
    if (!calcData) return {};
    
    return {
      backgroundColor: 'transparent',
      animationDuration: 2000,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        backgroundColor: '#1c1c21',
        borderColor: 'rgba(255,255,255,0.1)',
        padding: 12,
        textStyle: { color: '#f0f0f2', fontSize: 12 },
        formatter: (params: any) => {
          const d = params[0];
          const age = d.name;
          const o = d.value[1];
          const c = d.value[2];
          const diffVal = parseFloat((c - o).toFixed(2));
          const col = c >= o ? '#2ca02c' : '#d62728';
          return `
            <div class="font-sans">
              <div class="font-bold mb-2 border-b border-white/10 pb-1">年龄: ${age} 岁</div>
              <div class="flex justify-between gap-4 mb-1"><span class="text-zinc-500">开盘指数</span><span class="font-mono">${o}</span></div>
              <div class="flex justify-between gap-4 mb-1"><span class="text-zinc-500">收盘指数</span><span class="font-mono">${c}</span></div>
              <div class="flex justify-between gap-4"><span class="text-zinc-500">年度变动</span><span class="font-mono" style="color:${col}">${diffVal > 0 ? '+' : ''}${diffVal}</span></div>
            </div>
          `;
        }
      },
      grid: { left: '4%', right: '4%', bottom: '8%', top: '8%', containLabel: true },
      xAxis: { 
        type: 'category', 
        data: calcData.kline_data.map(d => d.age), 
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, 
        axisLabel: { color: '#666', fontSize: 10 }, 
        axisTick: { show: false } 
      },
      yAxis: { 
        scale: true, 
        min: 0, 
        max: 100, 
        axisLine: { show: false }, 
        axisLabel: { color: '#666', fontSize: 10 }, 
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } } 
      },
      series: [{
        type: 'candlestick',
        data: calcData.kline_data.map(d => [d.open, d.close, Math.min(d.open, d.close), Math.max(d.open, d.close)]),
        itemStyle: { 
          color: '#2ca02c', 
          color0: '#d62728', 
          borderColor: '#2ca02c', 
          borderColor0: '#d62728', 
          borderWidth: 1 
        },
        markLine: { 
          symbol: ['none', 'none'], 
          data: [{ 
            yAxis: calcData.base_score, 
            lineStyle: { color: 'rgba(255,255,255,0.2)', type: 'dashed' }, 
            label: { show: false } 
          }] 
        }
      }]
    };
  };

  const renderReportContent = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    return (
      <div className="space-y-10 font-sans max-w-3xl mx-auto">
        <div className="h-1 w-20 bg-purple-500 mb-12"></div>
        {lines.map((line, idx) => {
          const titleMatch = line.match(/^(?:\d+\.\s*)?【(.*?)】/);
          if (titleMatch) {
            return (
              <div key={idx} className="mt-12 first:mt-0">
                <div className="flex items-baseline mb-6 border-b border-white/10 pb-2">
                  <span className="text-[10px] font-mono text-purple-500/50 mr-4 tracking-tighter uppercase">Section //</span>
                  <h3 className="text-lg font-bold text-white tracking-[0.2em] serif uppercase">{titleMatch[1]}</h3>
                </div>
              </div>
            );
          } else {
            return (
              <div key={idx} className="relative group">
                <div className="absolute -left-4 top-0 bottom-0 w-px bg-white/5 group-hover:bg-purple-500/30 transition-colors duration-500"></div>
                <p className="text-zinc-400 leading-[1.8] text-justify tracking-wide mb-6">{line}</p>
              </div>
            );
          }
        })}
        <div className="mt-20 pt-8 border-t border-white/5">
          <p className="text-[10px] text-zinc-600 uppercase tracking-[0.3em] text-center">End of Confidential Health Insight Report</p>
        </div>
      </div>
    );
  };

  const years = Array.from({ length: 2026 - 1900 + 1 }, (_, i) => 2026 - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#f0f0f2] selection:bg-emerald-500/30 p-4 md:p-10">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Header */}
        <header className="text-center space-y-4">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold text-white tracking-tight serif"
          >
            五运六气健康分析系统
          </motion.h1>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center"
          >
            <p className="text-lg text-zinc-500 max-w-2xl leading-relaxed">
              基于传统中医运气学说的年度天人和谐健康指数<br />
              <span className="text-sm opacity-60 font-light tracking-widest uppercase mt-1 block">Annual Harmony Index (AHI)</span>
            </p>
            <div className="h-1 w-20 bg-emerald-500 mt-6 rounded-full opacity-50"></div>
          </motion.div>
        </header>

        <main className="space-y-8">
          
          {/* Module 01: Input */}
          <ModuleWrapper title="先天排盘" number="01">
            <form onSubmit={handleCalculate} className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-widest">出生年份</label>
                  <div className="relative">
                    <select 
                      value={year}
                      onChange={(e) => setYear(parseInt(e.target.value))}
                      className="w-full bg-zinc-900 border border-white/5 rounded-xl p-3 text-sm appearance-none focus:outline-none focus:border-emerald-500/50 transition-colors"
                    >
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-widest">月份</label>
                  <div className="relative">
                    <select 
                      value={month}
                      onChange={(e) => setMonth(parseInt(e.target.value))}
                      className="w-full bg-zinc-900 border border-white/5 rounded-xl p-3 text-sm appearance-none focus:outline-none focus:border-emerald-500/50 transition-colors"
                    >
                      {months.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-widest">日期</label>
                  <div className="relative">
                    <select 
                      value={day}
                      onChange={(e) => setDay(parseInt(e.target.value))}
                      className="w-full bg-zinc-900 border border-white/5 rounded-xl p-3 text-sm appearance-none focus:outline-none focus:border-emerald-500/50 transition-colors"
                    >
                      {days.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
                  </div>
                </div>
              </div>
              
              <button 
                type="submit" 
                disabled={isCalculating}
                className="w-full py-4 px-6 rounded-xl font-bold bg-emerald-800 hover:bg-emerald-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white transition-all flex items-center justify-center space-x-2 shadow-lg shadow-emerald-900/20"
              >
                {isCalculating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Zap className="w-5 h-5" />
                )}
                <span>生成健康 K 线图</span>
              </button>
            </form>
          </ModuleWrapper>

          {/* Module 02: Summary */}
          <ModuleWrapper 
            id="module-02"
            title="运气概要" 
            number="02" 
            isWaiting={!hasCalculated}
            waitingText="待命 · 请在上方输入出生日期"
          >
            {calcData && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
                    <p className="text-[10px] text-zinc-500 uppercase mb-1">干支纪年</p>
                    <p className="text-sm font-bold text-blue-400 font-mono">{calcData.wylq_summary.ganzhi}</p>
                  </div>
                  <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
                    <p className="text-[10px] text-zinc-500 uppercase mb-1">岁运</p>
                    <p className="text-sm font-bold text-emerald-400">{calcData.wylq_summary.suiyun}</p>
                  </div>
                  <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
                    <p className="text-[10px] text-zinc-500 uppercase mb-1">司天</p>
                    <p className="text-sm font-bold text-orange-400">{calcData.wylq_summary.sitian}</p>
                  </div>
                  <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
                    <p className="text-[10px] text-zinc-500 uppercase mb-1">在泉</p>
                    <p className="text-sm font-bold text-purple-400">{calcData.wylq_summary.zaiquan}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-zinc-900/50 border border-white/5 p-4 rounded-xl">
                    <div className="flex items-center mb-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></div>
                      <span className="text-xs text-zinc-500">当日五运格局</span>
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed">{calcData.wylq_summary.daily_fortune}</p>
                  </div>
                  <div className="bg-zinc-900/50 border border-white/5 p-4 rounded-xl">
                    <div className="flex items-center mb-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                      <span className="text-xs text-zinc-500">当日六气格局</span>
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed">{calcData.wylq_summary.daily_qi}</p>
                  </div>
                </div>
              </div>
            )}
          </ModuleWrapper>

          {/* Module 03: Chart */}
          <ModuleWrapper 
            id="module-03"
            title="AHI 天人和谐动态趋势" 
            number="03" 
            isWaiting={!hasCalculated}
            waitingText="系统将为您演算六十载运气碰撞"
          >
            {calcData && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-zinc-500">0-60岁全生命周期健康指数 K 线分析</p>
                  <div className="flex items-center space-x-3">
                    <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px]">
                      <span className="text-zinc-500">先天基准:</span>
                      <span className="text-emerald-400 font-bold ml-1 font-mono">{calcData.base_score.toFixed(1)}</span>
                    </div>
                    <button 
                      onClick={handleSaveImage}
                      className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                    >
                      <Download className="w-4 h-4 text-zinc-400" />
                    </button>
                  </div>
                </div>

                <div className="h-[400px] w-full">
                  <ReactECharts 
                    ref={chartRef}
                    option={getChartOption()} 
                    style={{ height: '100%', width: '100%' }}
                    theme="dark"
                  />
                </div>

                <div className="flex items-center justify-center space-x-8 text-[10px] text-zinc-600 uppercase tracking-widest">
                  <div className="flex items-center"><div className="w-3 h-3 bg-[#2ca02c] rounded-sm mr-2"></div> 气场升华</div>
                  <div className="flex items-center"><div className="w-3 h-3 bg-[#d62728] rounded-sm mr-2"></div> 气场损耗</div>
                  <div className="flex items-center"><div className="w-6 h-0 border-t border-dashed border-zinc-700 mr-2"></div> 先天基准线</div>
                </div>
              </div>
            )}
          </ModuleWrapper>

          {/* Module 04: Report */}
          <ModuleWrapper 
            id="module-04"
            title="专属健康报告" 
            number="04"
          >
            <div className="relative min-h-[200px]">
              {!hasGeneratedReport && !isGeneratingReport && (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6">
                  <div className="w-16 h-16 rounded-full bg-purple-500/5 flex items-center justify-center">
                    <FileText className="w-8 h-8 text-purple-500/30" />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-zinc-500 serif">深度报告模块已就绪</p>
                    <p className="text-zinc-600 text-xs">点击下方按钮，启动 AI 深度解析生命周期健康大势</p>
                  </div>
                  <button 
                    onClick={handleGenerateReport}
                    disabled={!hasCalculated || isGeneratingReport}
                    className="px-8 py-3 rounded-xl font-bold bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white transition-all flex items-center space-x-2 shadow-lg shadow-purple-900/20"
                  >
                    <Activity className="w-4 h-4" />
                    <span>生成专属报告</span>
                  </button>
                </div>
              )}

              {isGeneratingReport && (
                <div className="flex flex-col items-center justify-center py-20 space-y-6">
                  <div className="relative">
                    <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-ping"></div>
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-zinc-300 font-medium tracking-wide">正在构建 AHI 动态健康模型...</p>
                    <p className="text-zinc-500 text-sm">正在处理流年碰撞与生命周期数据，专属深度报告生成中</p>
                  </div>
                </div>
              )}

              {hasGeneratedReport && report && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6"
                >
                  <div className="flex justify-end">
                    <button 
                      onClick={handleCopyReport}
                      className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      复制报告
                    </button>
                  </div>
                  {renderReportContent(report)}
                </motion.div>
              )}
            </div>
          </ModuleWrapper>

        </main>

        <footer className="text-center py-12 border-t border-white/5">
          <p className="text-zinc-600 text-[10px] tracking-[0.3em] uppercase">
            © 2026 五运六气健康分析系统 · 仅供学术研究参考
          </p>
        </footer>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&display=swap');
        .glass-card {
          background: #141417;
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 1.5rem;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
        }
        .serif {
          font-family: 'Noto Serif SC', serif;
        }
      `}</style>
    </div>
  );
}
