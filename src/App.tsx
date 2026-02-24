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
  Zap,
  Loader2,
  Clock,
  ArrowRight,
  Sparkles,
  Shield,
  Compass
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

const SectionHeader = ({ title, subtitle, number }: { title: string; subtitle?: string; number: string }) => (
  <div className="mb-12">
    <div className="flex items-center gap-4 mb-2">
      <span className="text-[10px] font-mono text-jade tracking-[0.3em] uppercase">Phase {number}</span>
      <div className="h-px flex-1 bg-white/10"></div>
    </div>
    <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight serif">{title}</h2>
    {subtitle && <p className="text-zinc-500 mt-2 text-sm tracking-wide">{subtitle}</p>}
  </div>
);

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
      
      setTimeout(() => {
        document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      
      setTimeout(() => {
        document.getElementById('report-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (error) {
      console.error("Report generation error:", error);
      alert("报告生成失败，请稍后重试。");
    } finally {
      setIsGeneratingReport(false);
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
        backgroundColor: '#121212',
        borderColor: 'rgba(255,255,255,0.1)',
        padding: 16,
        textStyle: { color: '#f0f0f2', fontSize: 12 },
        formatter: (params: any) => {
          const d = params[0];
          const age = d.name;
          const o = d.value[1];
          const c = d.value[2];
          const diffVal = parseFloat((c - o).toFixed(2));
          const col = c >= o ? '#00A86B' : '#FF4444';
          return `
            <div class="font-sans">
              <div class="font-bold mb-2 border-b border-white/10 pb-1">年龄: ${age} 岁</div>
              <div class="flex justify-between gap-8 mb-1"><span class="text-zinc-500">开盘指数</span><span class="font-mono">${o}</span></div>
              <div class="flex justify-between gap-8 mb-1"><span class="text-zinc-500">收盘指数</span><span class="font-mono">${c}</span></div>
              <div class="flex justify-between gap-8"><span class="text-zinc-500">年度变动</span><span class="font-mono" style="color:${col}">${diffVal > 0 ? '+' : ''}${diffVal}</span></div>
            </div>
          `;
        }
      },
      grid: { left: '2%', right: '2%', bottom: '5%', top: '5%', containLabel: true },
      xAxis: { 
        type: 'category', 
        data: calcData.kline_data.map(d => d.age), 
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, 
        axisLabel: { color: '#666', fontSize: 10, margin: 15 }, 
        axisTick: { show: false } 
      },
      yAxis: { 
        scale: true, 
        min: 0, 
        max: 100, 
        axisLine: { show: false }, 
        axisLabel: { color: '#666', fontSize: 10 }, 
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.02)' } } 
      },
      series: [{
        type: 'candlestick',
        data: calcData.kline_data.map(d => [d.open, d.close, Math.min(d.open, d.close), Math.max(d.open, d.close)]),
        itemStyle: { 
          color: '#00A86B', 
          color0: '#FF4444', 
          borderColor: '#00A86B', 
          borderColor0: '#FF4444', 
          borderWidth: 1 
        },
        markLine: { 
          symbol: ['none', 'none'], 
          data: [{ 
            yAxis: calcData.base_score, 
            lineStyle: { color: 'rgba(212,175,55,0.2)', type: 'dashed' }, 
            label: { show: false } 
          }] 
        }
      }]
    };
  };

  const renderReportContent = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    return (
      <div className="space-y-12 font-sans max-w-2xl mx-auto py-12">
        {lines.map((line, idx) => {
          const titleMatch = line.match(/^(?:\d+\.\s*)?【(.*?)】/);
          if (titleMatch) {
            return (
              <div key={idx} className="mt-16 first:mt-0">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-8 h-px bg-gold/30"></div>
                  <h3 className="text-xl font-bold text-gold tracking-[0.2em] serif uppercase">{titleMatch[1]}</h3>
                  <div className="flex-1 h-px bg-white/5"></div>
                </div>
              </div>
            );
          } else {
            return (
              <p key={idx} className="text-zinc-400 leading-[2] text-lg tracking-wide mb-8 font-light">
                {line}
              </p>
            );
          }
        })}
      </div>
    );
  };

  const years = Array.from({ length: 2026 - 1900 + 1 }, (_, i) => 2026 - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-obsidian selection:bg-jade/30">
      {/* Hero Section */}
      <section className="relative h-screen flex flex-col items-center justify-center overflow-hidden px-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,168,107,0.05),transparent_70%)]"></div>
        <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-jade/10 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gold/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="relative z-10 text-center space-y-8 max-w-4xl"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-px w-12 bg-jade/50"></div>
            <span className="text-[10px] uppercase tracking-[0.5em] text-jade font-medium">Ancient Wisdom // Modern Insight</span>
            <div className="h-px w-12 bg-jade/50"></div>
          </div>
          
          <h1 className="text-6xl md:text-8xl font-bold text-white tracking-tighter serif leading-tight">
            五运六气<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-jade via-white to-gold">健康分析系统</span>
          </h1>
          
          <p className="text-xl text-zinc-500 max-w-2xl mx-auto font-light leading-relaxed tracking-wide">
            基于《黄帝内经》运气学说，演算天人感应之律。<br />
            探索生命周期中的 AHI (Annual Harmony Index) 动态趋势。
          </p>

          <div className="pt-12">
            <motion.a 
              href="#input-section"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="group inline-flex items-center gap-3 px-10 py-5 bg-white text-obsidian rounded-full font-bold transition-all hover:bg-jade hover:text-white"
            >
              <span>开启演算</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </motion.a>
          </div>
        </motion.div>

        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30">
          <span className="text-[10px] uppercase tracking-widest">Scroll to begin</span>
          <div className="w-px h-12 bg-gradient-to-b from-white to-transparent"></div>
        </div>
      </section>

      {/* Input Section */}
      <section id="input-section" className="py-32 px-6 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-24 items-center">
          <div>
            <SectionHeader 
              number="01" 
              title="先天排盘" 
              subtitle="输入您的出生日期，系统将根据天文历法精确定位您的先天运气格局。"
            />
            
            <div className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: "出生年份", value: year, setter: setYear, options: years },
                  { label: "月份", value: month, setter: setMonth, options: months },
                  { label: "日期", value: day, setter: setDay, options: days }
                ].map((item, i) => (
                  <div key={i} className="space-y-3">
                    <label className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] ml-1">{item.label}</label>
                    <div className="relative group">
                      <select 
                        value={item.value}
                        onChange={(e) => item.setter(parseInt(e.target.value))}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white appearance-none focus:outline-none focus:border-jade/50 transition-all group-hover:bg-white/[0.05]"
                      >
                        {item.options.map(opt => <option key={opt} value={opt} className="bg-obsidian">{opt}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none group-hover:text-jade transition-colors" />
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={handleCalculate}
                disabled={isCalculating}
                className="btn-primary w-full flex items-center justify-center gap-3 group"
              >
                {isCalculating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Zap className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span className="text-lg">生成健康 K 线图</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="hidden lg:block relative">
            <div className="absolute inset-0 bg-jade/5 rounded-[40px] blur-3xl"></div>
            <div className="relative glass-panel p-12 aspect-square flex flex-col items-center justify-center text-center space-y-8">
              <div className="w-24 h-24 rounded-full bg-jade/10 flex items-center justify-center">
                <Compass className="w-12 h-12 text-jade animate-float" />
              </div>
              <div className="space-y-4">
                <h3 className="text-2xl font-bold text-white serif">天人相应 · 气周而复</h3>
                <p className="text-zinc-500 leading-relaxed font-light">
                  《三因司天方》云：五运六气，乃天地阴阳运行升降之常道也。凡不合于政令德化者，则为变眚，皆能病人。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Results Section */}
      <AnimatePresence>
        {hasCalculated && calcData && (
          <motion.section 
            id="results-section"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-32 px-6 bg-ink/50 border-y border-white/[0.03]"
          >
            <div className="max-w-7xl mx-auto space-y-24">
              <div className="grid lg:grid-cols-3 gap-12">
                <div className="lg:col-span-1 space-y-8">
                  <SectionHeader 
                    number="02" 
                    title="运气概要" 
                    subtitle="先天底色与当日气场格局"
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "干支纪年", value: calcData.wylq_summary.ganzhi, color: "text-jade" },
                      { label: "岁运", value: calcData.wylq_summary.suiyun, color: "text-gold" },
                      { label: "司天", value: calcData.wylq_summary.sitian, color: "text-orange-400" },
                      { label: "在泉", value: calcData.wylq_summary.zaiquan, color: "text-purple-400" }
                    ].map((item, i) => (
                      <div key={i} className="glass-panel p-6 space-y-2">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest">{item.label}</span>
                        <p className={cn("text-lg font-bold serif", item.color)}>{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <div className="glass-panel p-6 border-l-2 border-l-jade">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="w-4 h-4 text-jade" />
                        <span className="text-xs text-zinc-400 uppercase tracking-widest">当日五运格局</span>
                      </div>
                      <p className="text-zinc-300 leading-relaxed">{calcData.wylq_summary.daily_fortune}</p>
                    </div>
                    <div className="glass-panel p-6 border-l-2 border-l-gold">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-gold" />
                        <span className="text-xs text-zinc-400 uppercase tracking-widest">当日六气格局</span>
                      </div>
                      <p className="text-zinc-300 leading-relaxed">{calcData.wylq_summary.daily_qi}</p>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-8">
                  <div className="flex justify-between items-end mb-8">
                    <SectionHeader 
                      number="03" 
                      title="AHI 动态趋势" 
                      subtitle="0-60岁全生命周期健康指数 K 线分析"
                    />
                    <div className="flex items-center gap-4 mb-12">
                      <div className="px-4 py-2 rounded-xl bg-white/[0.03] border border-white/10">
                        <span className="text-[10px] text-zinc-500 uppercase mr-2">先天基准</span>
                        <span className="text-gold font-mono font-bold">{calcData.base_score.toFixed(1)}</span>
                      </div>
                      <button 
                        onClick={() => {
                          if (chartRef.current) {
                            const instance = chartRef.current.getEchartsInstance();
                            const url = instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#050505' });
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `AHI_Chart_${year}.png`;
                            link.click();
                          }
                        }}
                        className="p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] transition-all"
                      >
                        <Download className="w-5 h-5 text-zinc-400" />
                      </button>
                    </div>
                  </div>

                  <div className="glass-panel p-8 h-[500px] relative">
                    <ReactECharts 
                      ref={chartRef}
                      option={getChartOption()} 
                      style={{ height: '100%', width: '100%' }}
                      theme="dark"
                    />
                    
                    <div className="absolute bottom-8 left-8 flex items-center gap-8 text-[10px] text-zinc-600 uppercase tracking-[0.2em]">
                      <div className="flex items-center gap-2"><div className="w-2 h-2 bg-jade rounded-full"></div> 气场升华</div>
                      <div className="flex items-center gap-2"><div className="w-2 h-2 bg-[#FF4444] rounded-full"></div> 气场损耗</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Report Trigger */}
              <div className="flex flex-col items-center justify-center py-24 text-center space-y-8 border-t border-white/5">
                <div className="w-20 h-20 rounded-full bg-gold/5 flex items-center justify-center">
                  <FileText className="w-10 h-10 text-gold/40" />
                </div>
                <div className="max-w-xl space-y-4">
                  <h3 className="text-3xl font-bold text-white serif">深度生命周期洞察</h3>
                  <p className="text-zinc-500 font-light leading-relaxed">
                    系统已准备好为您生成一份深度融合古法智慧与现代审美的全生命周期健康洞察报告。
                  </p>
                </div>
                <button 
                  onClick={handleGenerateReport}
                  disabled={isGeneratingReport}
                  className="btn-primary bg-gold hover:bg-gold/90 hover:shadow-[0_0_20px_rgba(212,175,85,0.3)] min-w-[240px]"
                >
                  {isGeneratingReport ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>正在构建模型...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Activity className="w-5 h-5" />
                      <span>生成专属报告</span>
                    </div>
                  )}
                </button>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Report Section */}
      <AnimatePresence>
        {hasGeneratedReport && report && (
          <motion.section 
            id="report-section"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-32 px-6 bg-obsidian"
          >
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-center mb-24">
                <div className="space-y-2">
                  <span className="text-[10px] text-jade tracking-[0.5em] uppercase">Confidential Report</span>
                  <h2 className="text-4xl font-bold text-white serif">全生命周期健康洞察</h2>
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(report);
                    alert("报告已复制");
                  }}
                  className="flex items-center gap-2 text-xs text-zinc-500 hover:text-gold transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  <span>COPY REPORT</span>
                </button>
              </div>

              <div className="relative">
                <div className="absolute -left-12 top-0 bottom-0 w-px bg-gradient-to-b from-jade via-gold to-transparent opacity-20"></div>
                {renderReportContent(report)}
              </div>

              <footer className="mt-32 pt-12 border-t border-white/5 text-center">
                <p className="text-[10px] text-zinc-600 uppercase tracking-[0.5em]">
                  End of Analysis // © 2026 五运六气健康分析系统
                </p>
              </footer>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="py-24 px-6 border-t border-white/5 bg-ink/30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-jade/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-jade" />
            </div>
            <span className="text-lg font-bold text-white serif tracking-widest uppercase">AHI System</span>
          </div>
          
          <p className="text-zinc-600 text-[10px] tracking-[0.3em] uppercase text-center md:text-right">
            基于传统中医运气学说 · 仅供学术研究参考 · 不作为医疗诊断依据
          </p>
        </div>
      </footer>

      <style>{`
        html {
          scroll-behavior: smooth;
        }
        body {
          overflow-x: hidden;
        }
        select {
          background-image: none !important;
        }
        /* Custom Scrollbar */
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #050505;
        }
        ::-webkit-scrollbar-thumb {
          background: #1a1a1a;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #2a2a2a;
        }
      `}</style>
    </div>
  );
}
