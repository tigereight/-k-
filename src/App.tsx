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
  MessageSquare,
  Shield,
  Compass,
  Home,
  History,
  User,
  LogOut,
  Trash2,
  X,
  Mail,
  Lock,
  HeartPulse,
  ShieldCheck,
  Printer,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GoogleGenAI } from "@google/genai";
import { astro } from 'iztro';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { LoginModal } from './components/LoginModal';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { RechargeModal } from './components/RechargeModal';
import { supabase } from './lib/supabase';

// --- Components ---
const TermTooltip = ({ term, definition }: { term: string; definition: string }) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-flex items-center ml-1 group" ref={tooltipRef}>
      <button
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        className="p-0.5 rounded-full transition-colors focus:outline-none"
        aria-label={`Definition for ${term}`}
      >
        <HelpCircle 
          size={12} 
          className={cn(
            "transition-colors",
            isVisible ? "text-gold" : "text-jade/40 group-hover:text-gold"
          )} 
        />
      </button>
      
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 5 }}
            className={cn(
              "absolute z-[100] w-48 p-3 rounded-lg bg-black/90 backdrop-blur-md border border-white/10 shadow-2xl pointer-events-none",
              "left-1/2 -translate-x-1/2 bottom-full mb-2",
              "sm:w-64"
            )}
          >
            <div className="text-[11px] leading-relaxed text-zinc-300 font-sans">
              <span className="font-bold text-gold block mb-1">{term}</span>
              {definition}
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-black/90" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

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
  historyId?: number | null;
}

interface ReportResponse {
  report: string;
}

interface UserInfo {
  loggedIn: boolean;
  user?: {
    id: string;
    email: string;
    herbs_balance: number;
  };
}

interface HistoryItem {
  id: number;
  user_id: string;
  report_type: 'wuyun' | 'ziwei' | 'spatial';
  content: {
    report: string;
    wylq_summary?: WylqSummary;
    kline_data?: KlinePoint[];
    riskScores?: any;
    [key: string]: any;
  };
  created_at: string;
}

// --- Constants ---
const TERM_DEFINITIONS = {
  "干支纪年": "东方古老的纪年方式，由天干与地支组合，反映年份基础宇宙磁场能量。",
  "岁运": "全年的气象总司令。主导全年五行能量的偏向（如木、火、土、金、水）。",
  "司天": "主导上半年（大寒至小暑）的气候基调，是决定全年“天气”属性的核心。",
  "在泉": "主导下半年（大暑至小寒）的气候基调，是决定全年“地气”属性的核心。",
  "主位": "每年固定不变的五行节律（如春木夏火），是生命适应自然的常规背景。",
  "客位": "逐年轮动、变幻无常的动态气象能量，是导致体质波动和健康风险的主要诱因。",
  "太过": "该年份对应的五行能量过盛，容易产生因能量亢奋导致的身体压力。",
  "不及": "该年份对应的五行能量虚弱，代表该维度的身体防线较为脆弱，需针对性调养。"
};

const TIME_OPTIONS = [
  "子时 (23:00-01:00)", "丑时 (01:00-03:00)", "寅时 (03:00-05:00)", 
  "卯时 (05:00-07:00)", "辰时 (07:00-09:00)", "巳时 (09:00-11:00)", 
  "午时 (11:00-13:00)", "未时 (13:00-15:00)", "申时 (15:00-17:00)", 
  "酉时 (17:00-19:00)", "戌时 (19:00-21:00)", "亥时 (21:00-23:00)",
  "未知时辰"
];

// --- Components ---

const StarMutagenBadge = ({ mutagen }: { mutagen: string }) => {
  if (!mutagen) return null;
  const styles: Record<string, string> = {
    '禄': 'bg-gold/10 text-gold border-gold/20',
    '权': 'bg-jade/10 text-jade border-jade/20',
    '科': 'bg-blue-400/10 text-blue-400 border-blue-400/20',
    '忌': 'bg-red-500/10 text-red-500 border-red-500/20 shadow-[0_0_5px_rgba(239,68,68,0.2)]',
  };
  return (
    <span className={cn(
      "text-[9px] px-1 rounded border font-bold leading-none py-0.5",
      styles[mutagen] || "bg-zinc-800 text-zinc-400 border-zinc-700"
    )}>
      {mutagen}
    </span>
  );
};

const PalaceCell = ({ palace, isCurrentYear }: { palace: any; isCurrentYear: boolean }) => {
  const majorStars = palace.majorStars || [];
  const minorStars = palace.minorStars || [];
  const adjectiveStars = palace.adjectiveStars || [];
  
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, scale: 0.98 },
        visible: { opacity: 1, scale: 1 }
      }}
      whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
      className={cn(
        "glass-panel p-1 md:p-2 flex flex-col h-full transition-all border-white/10 relative group overflow-hidden bg-zinc-900/60",
        isCurrentYear && "border-jade/40 ring-1 ring-jade/20 bg-jade/[0.02]",
        palace.isBodyPalace && "bg-jade/[0.04]"
      )}
    >
      {/* Top Section: Stars */}
      <div className="flex justify-between gap-0.5 flex-1 min-h-0">
        {/* Left: Major Stars */}
        <div className="flex flex-col gap-0 overflow-hidden">
          {majorStars.map((star: any, idx: number) => (
            <div key={idx} className="flex items-baseline gap-0.5">
              <span className={cn(
                "text-[10px] sm:text-[11px] md:text-[13px] font-bold serif leading-tight truncate",
                ['紫微', '天府', '太阳', '太阴'].includes(star.name) ? "text-gold" : "text-white"
              )}>
                {star.name}
              </span>
              {star.brightness && (
                <span className={cn(
                  "text-[7px] md:text-[9px] font-bold scale-90 origin-left",
                  ['庙', '旺', '得'].includes(star.brightness) ? "text-jade" : 
                  ['陷', '不'].includes(star.brightness) ? "text-red-500" : "text-zinc-500"
                )}>
                  {star.brightness}
                </span>
              )}
              <StarMutagenBadge mutagen={star.mutagen} />
            </div>
          ))}
        </div>

        {/* Right: Minor Stars */}
        <div className="flex flex-col items-end gap-0 text-right overflow-hidden">
          {minorStars.map((star: any, idx: number) => (
            <div key={idx} className="flex items-baseline gap-0.5 justify-end">
              <StarMutagenBadge mutagen={star.mutagen} />
              <span className={cn(
                "text-[8px] sm:text-[9px] md:text-[10px] font-medium leading-tight truncate",
                ['火星', '铃星', '擎羊', '陀罗', '地空', '地劫'].includes(star.name) ? "text-red-400" : "text-zinc-300"
              )}>
                {star.name}
              </span>
              {star.brightness && (
                <span className="text-[6px] md:text-[8px] text-zinc-500 scale-75 origin-right">{star.brightness}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Middle Section: Adjective Stars & Ages */}
      <div className="my-0.5 md:my-1 flex flex-col gap-0.5">
        <div className="flex flex-wrap gap-x-0.5 md:gap-x-1 gap-y-0 leading-none h-3 md:h-auto overflow-hidden">
          {adjectiveStars.slice(0, 6).map((star: any, idx: number) => (
            <span key={idx} className="text-[7px] md:text-[9px] text-zinc-500 opacity-60 flex items-baseline gap-0.5 whitespace-nowrap">
              {star.name}
            </span>
          ))}
        </div>
        
        <div className="flex justify-between items-center">
           <div className="flex gap-0.5 md:gap-1 overflow-hidden">
            {palace.ages.slice(0, 4).map((age: number, i: number) => (
              <span key={i} className="text-[7px] md:text-[9px] font-mono text-zinc-600">{age}</span>
            ))}
          </div>
          <span className="text-[7px] md:text-[10px] text-zinc-500 font-mono italic truncate">{palace.changsheng12}</span>
        </div>
      </div>

      {/* Bottom Section: Decadal & Palace Info */}
      <div className="pt-0.5 border-t border-white/5 flex justify-between items-end">
        <div className="flex flex-col overflow-hidden">
          <span className="text-[8px] md:text-[11px] text-zinc-300 font-mono font-bold leading-none truncate">
            {palace.decadal.range[0]}-{palace.decadal.range[1]}
          </span>
          <span className="text-[8px] md:text-[10px] font-bold text-jade/90 serif mt-0.5 truncate">
            {palace.name}{palace.isBodyPalace ? '·身' : ''}
          </span>
        </div>
        
        <div className="flex flex-col items-end overflow-hidden">
          {isCurrentYear && (
            <span className="text-[6px] md:text-[8px] text-jade font-black uppercase tracking-tighter animate-pulse mb-0.5">流年</span>
          )}
          <span className="text-[8px] md:text-[10px] font-mono text-zinc-500 font-bold leading-none truncate">
            {palace.heavenlyStem}{palace.earthlyBranch}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

const MatrixAstrolabe = ({ data }: { data: any }) => {
  if (!data) return null;

  const gridMap = [5, 6, 7, 8, 4, null, null, 9, 3, null, null, 10, 2, 1, 0, 11];
  const currentYearBranch = data.yearly?.earthlyBranch;

  return (
    <div className="max-w-7xl mx-auto px-1 md:px-4 py-4 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-jade/[0.01] rounded-full blur-[120px] pointer-events-none" />
      
      <motion.div 
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.01 } } }}
        className="grid grid-cols-4 grid-rows-4 gap-0.5 md:gap-1.5 relative z-10 aspect-square md:aspect-auto md:h-[750px]"
      >
        {gridMap.map((palaceIdx, gridIdx) => {
          if (palaceIdx !== null) {
            const palace = data.palaces[palaceIdx];
            const isCurrentYear = palace.earthlyBranch === currentYearBranch;
            return (
              <div key={gridIdx} className="col-span-1 row-span-1">
                <PalaceCell palace={palace} isCurrentYear={isCurrentYear} />
              </div>
            );
          }
          
          if (gridIdx === 5) {
            return (
              <div key="center" className="col-span-2 row-span-2 glass-panel p-2 md:p-5 flex flex-col justify-between relative overflow-hidden border-white/5 bg-zinc-900/30">
                <div className="relative z-10 flex flex-col h-full text-[8px] sm:text-[9px] md:text-[11px]">
                  <div className="grid grid-cols-2 gap-x-1 md:gap-x-4 gap-y-0.5 md:gap-y-2">
                    <div className="space-y-0.5 md:space-y-1">
                      <p className="text-zinc-500 truncate">四柱：<span className="text-gold font-bold">{data.chineseDate}</span></p>
                      <p className="text-zinc-500 truncate">阳历：<span className="text-zinc-200">{data.solarDate}</span></p>
                      <p className="text-zinc-500 truncate">农历：<span className="text-zinc-200">{data.lunarDate}</span></p>
                      <p className="text-zinc-500 truncate">时辰：<span className="text-zinc-200">{data.time}</span></p>
                      <p className="text-zinc-500 truncate">生肖：<span className="text-zinc-200">{data.zodiac}</span></p>
                      <p className="text-zinc-500 truncate">星座：<span className="text-zinc-200">{data.sign}</span></p>
                    </div>
                    <div className="space-y-0.5 md:space-y-1 border-l border-white/5 pl-1 md:pl-4">
                      <p className="text-zinc-500 truncate">命主：<span className="text-jade font-bold">{data.soul}</span></p>
                      <p className="text-zinc-500 truncate">身主：<span className="text-jade font-bold">{data.body}</span></p>
                      <p className="text-zinc-500 truncate">五行局：<span className="text-gold font-bold">{data.fiveElementsClass}</span></p>
                      <p className="text-zinc-500 truncate">阴阳：<span className="text-zinc-200">{data.gender === 'male' ? '乾' : '坤'}造 / {data.yinYang || data.lunarDate?.yinYang || '未知'}</span></p>
                    </div>
                  </div>
                  
                  <div className="mt-auto pt-1 md:pt-4 border-t border-white/5 flex justify-between items-end">
                    <div className="space-y-0.5">
                       <p className="text-[6px] md:text-[9px] font-mono text-zinc-600 tracking-widest uppercase">Powered by iztro</p>
                    </div>
                    <div className="text-right">
                       <h3 className="text-xs sm:text-sm md:text-xl font-bold text-white serif tracking-tighter">生命全息看板</h3>
                    </div>
                  </div>
                </div>
                
                {/* Decorative background element */}
                <div className="absolute -bottom-4 -right-4 opacity-5 pointer-events-none">
                  <Activity className="w-16 h-16 md:w-32 md:h-32 text-gold" />
                </div>
              </div>
            );
          }
          return null;
        })}
      </motion.div>
    </div>
  );
};

const SectionHeader = ({ title, subtitle, number }: { title: string; subtitle?: string; number: string }) => (
  <div className="mb-12">
    <div className="flex items-center gap-4 mb-2">
      <span className="text-[9px] font-mono text-jade tracking-[0.3em] uppercase">Phase {number}</span>
      <div className="h-px flex-1 bg-white/10"></div>
    </div>
    <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight serif">{title}</h2>
    {subtitle && <p className="text-zinc-500 mt-2 text-sm tracking-wide">{subtitle}</p>}
  </div>
);

export default function App() {
  const [year, setYear] = useState(1990);
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [timeIndex, setTimeIndex] = useState(0);
  const [daysInMonth, setDaysInMonth] = useState(31);

  const [calcData, setCalcData] = useState<CalcResponse | null>(null);
  const [astrolabeData, setAstrolabeData] = useState<any>(null);
  const [report, setReport] = useState<string | null>(null);

  const [isGeneratingHealthReport, setIsGeneratingHealthReport] = useState(false);
  const [healthReport, setHealthReport] = useState<string | null>(null);
  const [riskScores, setRiskScores] = useState<any>({
    structuralVulnerability: 65,
    energyDeficit: 45,
    temporalPressure: 70,
    overallRisk: 60
  });

  const formatAstrolabeForAI = (data: any) => {
    if (!data) return null;
    
    return {
      basicInfo: {
        gender: data.gender,
        solarDate: data.solarDate,
        lunarDate: data.lunarDate,
        chineseDate: data.chineseDate,
        zodiac: data.zodiac,
        fiveElements: data.fiveElements,
        fateResonance: data.fateResonance,
        lifePalaceBranch: data.lifePalaceBranch,
        bodyPalaceBranch: data.bodyPalaceBranch,
      },
      palaces: (data.palaces || []).map((p: any) => ({
        name: p.name,
        earthlyBranch: p.earthlyBranch,
        heavenlyStem: p.heavenlyStem,
        isLifePalace: p.isLifePalace,
        isBodyPalace: p.isBodyPalace,
        majorStars: (p.majorStars || []).map((s: any) => ({ name: s.name, type: s.type, brightness: s.brightness })),
        minorStars: (p.minorStars || []).map((s: any) => ({ name: s.name, type: s.type, brightness: s.brightness })),
        adjectiveStars: (p.adjectiveStars || []).map((s: any) => ({ name: s.name, type: s.type })),
        chuanqiStars: (p.chuanqiStars || []).map((s: any) => ({ name: s.name })),
        zodiacStars: (p.zodiacStars || []).map((s: any) => ({ name: s.name })),
        transformations: [
          p.isYearlyHualu && "流年化禄",
          p.isYearlyHuaquan && "流年化权",
          p.isYearlyHuake && "流年化科",
          p.isYearlyHuaji && "流年化忌",
          p.isDecadalHualu && "大限化禄",
          p.isDecadalHuaquan && "大限化权",
          p.isDecadalHuake && "大限化科",
          p.isDecadalHuaji && "大限化忌",
        ].filter(Boolean),
      })),
      decadal: data.decadal ? {
        index: data.decadal.index,
        heavenlyStem: data.decadal.heavenlyStem,
        earthlyBranch: data.decadal.earthlyBranch,
        range: data.decadal.range,
      } : null,
      yearly: data.yearly ? {
        index: data.yearly.index,
        heavenlyStem: data.yearly.heavenlyStem,
        earthlyBranch: data.yearly.earthlyBranch,
      } : null
    };
  };

  const formatAIReport = (text: string) => {
    if (!text) return "";
    
    let cleaned = text
      // 1. Remove brackets and backslashes
      .replace(/[\[\]\\]/g, '')
      // 2. Handle double-escaped newlines
      .replace(/\\n/g, '\n')
      // 3. Ensure headers have a space after #
      .replace(/^(#+)([^\s#])/mg, '$1 $2')
      // 4. Remove stray # at start/end of lines that aren't headers
      .replace(/(?<!#)#(?!#|\s)/g, '')
      .trim();

    // 5. Heuristic cleaning for each line
    const lines = cleaned.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      
      // If line contains "风险" or "策略" or "建议" and isn't already a header, make it h3
      if ((trimmed.includes('风险') || trimmed.includes('策略') || trimmed.includes('建议')) && !trimmed.startsWith('#')) {
        return `### ${trimmed}`;
      }
      
      // Convert **Text** to ## Text if it's the whole line (likely a title)
      const boldHeaderMatch = trimmed.match(/^\*\*(.*?)\*\*$/);
      if (boldHeaderMatch && boldHeaderMatch[1].length < 60) {
        return `## ${boldHeaderMatch[1]}`;
      }
      
      return trimmed;
    });

    // 6. Reconstruct with forced paragraph breaks
    return lines
      .filter(line => line !== "")
      .join('\n\n');
  };

  const generateHealthReport = async () => {
    if (!user.loggedIn) {
      setIsLoginModalOpen(true);
      return;
    }
    if (!astrolabeData) return;
    setIsGeneratingHealthReport(true);
    setHealthReport(null);

    try {
      const formattedData = formatAstrolabeForAI(astrolabeData);
      const response = await axios.post('/api/generate-health-report', {
        astrolabeData: formattedData
      });

      if (response.data.riskScores) {
        setRiskScores(response.data.riskScores);
      }
      
      const rawReport = response.data.report || "未能生成报告，请稍后再试。";
      setHealthReport(formatAIReport(rawReport));
      checkUser(); // Refresh balance
      
      // Scroll to report
      setTimeout(() => {
        const element = document.getElementById('health-report-section');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (err: any) {
      if (err.response?.status === 402) {
        setIsRechargeModalOpen(true);
      } else {
        console.error("Health report generation failed", err);
        const errorMsg = err.response?.data?.error || err.message || "未知错误";
        setHealthReport(`生成报告时发生错误: ${errorMsg}\n\n请检查网络连接或稍后再试。`);
      }
    } finally {
      setIsGeneratingHealthReport(false);
    }
  };
  
  const generateSpatialReport = async () => {
    if (!user.loggedIn) {
      setIsLoginModalOpen(true);
      return;
    }
    setIsGeneratingSpatialReport(true);
    setSpatialReport(null);

    try {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const placements: any[] = [];
      
      spatialRooms.forEach(r => {
        const direction = getDirection(r.x, r.y, r.w, r.h, canvas.width, canvas.height, compassRotation);
        placements.push({ type: 'room', value: r.value, direction });
      });

      spatialPersons.forEach(p => {
        const bedroom = spatialRooms[p.bedroomId];
        if (bedroom) {
          const direction = getDirection(bedroom.x, bedroom.y, bedroom.w, bedroom.h, canvas.width, canvas.height, compassRotation);
          placements.push({ type: 'person', value: p.value, direction });
        }
      });

      const response = await axios.post('/api/generate-spatial-report', {
        placements
      });

      if (response.data.riskScores) {
        setSpatialRiskScores(response.data.riskScores);
      }
      setSpatialReport(formatAIReport(response.data.report));
      checkUser(); // Refresh balance
      
      setTimeout(() => {
        const element = document.getElementById('spatial-report-section');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (err: any) {
      if (err.response?.status === 402) {
        setIsRechargeModalOpen(true);
      } else {
        console.error("Spatial report generation failed", err);
        setSpatialReport("生成空间分析报告时发生错误，请稍后再试。");
      }
    } finally {
      setIsGeneratingSpatialReport(false);
    }
  };

  const [isCalculating, setIsCalculating] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  
  const [hasCalculated, setHasCalculated] = useState(false);
  const [hasGeneratedReport, setHasGeneratedReport] = useState(false);
  const [currentHistoryId, setCurrentHistoryId] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState<'home' | 'matrix' | 'insight' | 'spatial' | 'history' | 'profile'>('home');
  
  // --- Scroll Memory Logic ---
  const scrollPositions = useRef<Record<string, number>>({});
  const prevTab = useRef<string>(activeTab);

  useEffect(() => {
    // Initial load: scroll to top
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    // Save scroll position of the previous tab
    scrollPositions.current[prevTab.current] = window.scrollY;
    
    // Update previous tab reference
    const currentTab = activeTab;
    prevTab.current = currentTab;

    // Restore scroll position of the new tab
    const savedPosition = scrollPositions.current[currentTab] || 0;
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      window.scrollTo({
        top: savedPosition,
        behavior: 'instant'
      });
    });
  }, [activeTab]);
  const [user, setUser] = useState<UserInfo>({ loggedIn: false });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  // Spatial Energy State
  const [spatialRooms, setSpatialRooms] = useState<any[]>([]);
  const [spatialPersons, setSpatialPersons] = useState<any[]>([]);
  const [compassRotation, setCompassRotation] = useState(0);
  const [selectedRoomIdx, setSelectedRoomIdx] = useState<number | null>(null);
  const [selectedPersonIdx, setSelectedPersonIdx] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragMode, setDragMode] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [originalState, setOriginalState] = useState<any>(null);

  const ROOM_MIN_SIZE = 60;
  const ROOM_DEFAULT_SIZE = 100;
  const PERSON_SIZE = 32;
  const HANDLE_SIZE = 10;

  const getDirection = (x: number, y: number, w: number, h: number, canvasWidth: number, canvasHeight: number, rotation: number) => {
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const objCenterX = x + w / 2;
    const objCenterY = y + h / 2;

    const dx = objCenterX - centerX;
    const dy = objCenterY - centerY;

    const threshold = 50;
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return '中央';

    let angle = Math.atan2(-dy, dx) * 180 / Math.PI;
    angle = angle - rotation;

    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;

    if (angle >= -22.5 && angle < 22.5) return '正东';
    if (angle >= 22.5 && angle < 67.5) return '东北';
    if (angle >= 67.5 && angle < 112.5) return '正北';
    if (angle >= 112.5 && angle < 157.5) return '西北';
    if (angle >= 157.5 || angle < -157.5) return '正西';
    if (angle >= -157.5 && angle < -112.5) return '西南';
    if (angle >= -112.5 && angle < -67.5) return '正南';
    if (angle >= -67.5 && angle < -22.5) return '东南';

    return '中央';
  };

  const isInsideRoom = (px: number, py: number, room: any) => {
    return px >= room.x && px <= room.x + room.w &&
           py >= room.y && py <= room.y + room.h;
  };

  const findBedroomAt = (x: number, y: number) => {
    for (let i = spatialRooms.length - 1; i >= 0; i--) {
      const r = spatialRooms[i];
      if ((r.value.includes('卧室') || r.value === '主卧室') && isInsideRoom(x, y, r)) {
        return i;
      }
    }
    return null;
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid background
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Center crosshair
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.1)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0); ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.moveTo(0, canvas.height / 2); ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw rooms
    spatialRooms.forEach((room, idx) => {
      ctx.save();
      const cx = room.x + room.w / 2;
      const cy = room.y + room.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(room.rotation || 0);
      ctx.translate(-cx, -cy);

      const isBedroom = room.value.includes('卧室') || room.value === '主卧室';
      const colors = isBedroom ? { fill: 'rgba(0, 168, 107, 0.1)', stroke: '#00A86B' } : 
                    (room.type === 'room' ? { fill: 'rgba(212, 175, 55, 0.1)', stroke: '#D4AF37' } : 
                    { fill: 'rgba(74, 159, 223, 0.1)', stroke: '#4A9FDF' });

      ctx.fillStyle = colors.fill;
      ctx.fillRect(room.x, room.y, room.w, room.h);
      ctx.strokeStyle = selectedRoomIdx === idx ? '#fff' : colors.stroke;
      ctx.lineWidth = selectedRoomIdx === idx ? 2 : 1;
      ctx.strokeRect(room.x, room.y, room.w, room.h);

      ctx.fillStyle = '#fff';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(room.icon, cx, cy - 5);
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(room.value, cx, cy + 15);

      const dir = getDirection(room.x, room.y, room.w, room.h, canvas.width, canvas.height, compassRotation);
      ctx.fillStyle = 'rgba(212, 175, 55, 0.6)';
      ctx.font = '9px sans-serif';
      ctx.fillText(dir, cx, room.y + room.h - 5);

      ctx.restore();

      if (selectedRoomIdx === idx) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(room.x + room.w - HANDLE_SIZE, room.y + room.h - HANDLE_SIZE, HANDLE_SIZE, HANDLE_SIZE);
        ctx.beginPath();
        ctx.arc(room.x + room.w / 2, room.y - 15, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#D4AF37';
        ctx.fill();
      }
    });

    // Draw persons
    spatialPersons.forEach((person, idx) => {
      const bedroom = spatialRooms[person.bedroomId];
      if (!bedroom) return;
      const px = bedroom.x + bedroom.w / 2 + (person.offsetX || 0);
      const py = bedroom.y + bedroom.h / 2 + (person.offsetY || 0);

      ctx.font = '22px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(person.icon, px, py);
      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = selectedPersonIdx === idx ? '#fff' : '#00A86B';
      ctx.fillText(person.value, px, py + 16);
    });
  };

  useEffect(() => {
    if (activeTab === 'spatial') {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.parentElement?.getBoundingClientRect();
        if (rect) {
          canvas.width = rect.width;
          canvas.height = rect.height;
        }
      }
      drawCanvas();
    }
  }, [activeTab, spatialRooms, spatialPersons, compassRotation, selectedRoomIdx, selectedPersonIdx]);

  const handleSpatialMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Check persons
    for (let i = spatialPersons.length - 1; i >= 0; i--) {
      const p = spatialPersons[i];
      const bedroom = spatialRooms[p.bedroomId];
      if (!bedroom) continue;
      const px = bedroom.x + bedroom.w / 2 + (p.offsetX || 0);
      const py = bedroom.y + bedroom.h / 2 + (p.offsetY || 0);
      if (Math.abs(mx - px) < PERSON_SIZE / 2 && Math.abs(my - py) < PERSON_SIZE / 2) {
        setSelectedPersonIdx(i);
        setSelectedRoomIdx(null);
        setDragMode('move-person');
        setDragStart({ x: mx, y: my });
        setOriginalState({ bedroomId: p.bedroomId, offsetX: p.offsetX, offsetY: p.offsetY });
        return;
      }
    }

    // Check rooms
    for (let i = spatialRooms.length - 1; i >= 0; i--) {
      const r = spatialRooms[i];
      if (selectedRoomIdx === i) {
        if (mx >= r.x + r.w - HANDLE_SIZE && mx <= r.x + r.w &&
            my >= r.y + r.h - HANDLE_SIZE && my <= r.y + r.h) {
          setDragMode('resize');
          setDragStart({ x: mx, y: my });
          setOriginalState({ w: r.w, h: r.h });
          return;
        }
        const rotateX = r.x + r.w / 2;
        const rotateY = r.y - 15;
        if (Math.sqrt((mx - rotateX) ** 2 + (my - rotateY) ** 2) < 10) {
          setDragMode('rotate');
          setDragStart({ x: mx, y: my });
          setOriginalState({ rotation: r.rotation || 0 });
          return;
        }
      }
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        setSelectedRoomIdx(i);
        setSelectedPersonIdx(null);
        setDragMode('move-room');
        setDragStart({ x: mx - r.x, y: my - r.y });
        return;
      }
    }
    setSelectedRoomIdx(null);
    setSelectedPersonIdx(null);
  };

  const handleSpatialMouseMove = (e: React.MouseEvent) => {
    if (!dragMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (dragMode === 'move-room' && selectedRoomIdx !== null) {
      setSpatialRooms(prev => {
        const next = [...prev];
        next[selectedRoomIdx] = { ...next[selectedRoomIdx], x: mx - dragStart.x, y: my - dragStart.y };
        return next;
      });
    } else if (dragMode === 'resize' && selectedRoomIdx !== null) {
      setSpatialRooms(prev => {
        const next = [...prev];
        const dx = mx - dragStart.x;
        const dy = my - dragStart.y;
        next[selectedRoomIdx] = { 
          ...next[selectedRoomIdx], 
          w: Math.max(ROOM_MIN_SIZE, originalState.w + dx),
          h: Math.max(ROOM_MIN_SIZE, originalState.h + dy)
        };
        return next;
      });
    } else if (dragMode === 'rotate' && selectedRoomIdx !== null) {
      setSpatialRooms(prev => {
        const next = [...prev];
        const r = next[selectedRoomIdx];
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        const angle = Math.atan2(my - cy, mx - cx);
        next[selectedRoomIdx] = { ...r, rotation: angle + Math.PI / 2 };
        return next;
      });
    } else if (dragMode === 'move-person' && selectedPersonIdx !== null) {
      setSpatialPersons(prev => {
        const next = [...prev];
        const p = next[selectedPersonIdx];
        const bedroom = spatialRooms[p.bedroomId];
        if (bedroom) {
          next[selectedPersonIdx] = {
            ...p,
            offsetX: mx - (bedroom.x + bedroom.w / 2),
            offsetY: my - (bedroom.y + bedroom.h / 2)
          };
        }
        return next;
      });
    }
  };

  const handleSpatialMouseUp = (e: React.MouseEvent) => {
    if (dragMode === 'move-person' && selectedPersonIdx !== null) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const newBedroomIdx = findBedroomAt(mx, my);
        
        setSpatialPersons(prev => {
          const next = [...prev];
          const p = next[selectedPersonIdx];
          if (newBedroomIdx === null) {
            next[selectedPersonIdx] = { ...p, ...originalState };
          } else {
            const newBedroom = spatialRooms[newBedroomIdx];
            next[selectedPersonIdx] = {
              ...p,
              bedroomId: newBedroomIdx,
              offsetX: mx - (newBedroom.x + newBedroom.w / 2),
              offsetY: my - (newBedroom.y + newBedroom.h / 2)
            };
          }
          return next;
        });
      }
    }
    setDragMode(null);
    setOriginalState(null);
  };

  const handleSpatialDoubleClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Check persons
    for (let i = spatialPersons.length - 1; i >= 0; i--) {
      const p = spatialPersons[i];
      const bedroom = spatialRooms[p.bedroomId];
      if (!bedroom) continue;
      const px = bedroom.x + bedroom.w / 2 + (p.offsetX || 0);
      const py = bedroom.y + bedroom.h / 2 + (p.offsetY || 0);
      if (Math.abs(mx - px) < PERSON_SIZE / 2 && Math.abs(my - py) < PERSON_SIZE / 2) {
        setSpatialPersons(prev => prev.filter((_, idx) => idx !== i));
        setSelectedPersonIdx(null);
        return;
      }
    }

    // Check rooms
    for (let i = spatialRooms.length - 1; i >= 0; i--) {
      const r = spatialRooms[i];
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        setSpatialPersons(prev => prev.filter(p => p.bedroomId !== i).map(p => ({
          ...p,
          bedroomId: p.bedroomId > i ? p.bedroomId - 1 : p.bedroomId
        })));
        setSpatialRooms(prev => prev.filter((_, idx) => idx !== i));
        setSelectedRoomIdx(null);
        return;
      }
    }
  };

  const handleSpatialDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const type = e.dataTransfer.getData('type') as 'room' | 'person';
    const value = e.dataTransfer.getData('value');
    const icon = e.dataTransfer.getData('icon');

    if (type === 'person') {
      const bedroomIdx = findBedroomAt(x, y);
      if (bedroomIdx !== null) {
        const bedroom = spatialRooms[bedroomIdx];
        setSpatialPersons(prev => {
          const filtered = prev.filter(p => p.value !== value);
          const count = filtered.filter(p => p.bedroomId === bedroomIdx).length;
          return [...filtered, {
            value,
            icon,
            bedroomId: bedroomIdx,
            offsetX: (count % 2) * 30 - 15,
            offsetY: Math.floor(count / 2) * 25
          }];
        });
      }
    } else {
      setSpatialRooms(prev => [...prev, {
        type,
        value,
        icon,
        x: x - ROOM_DEFAULT_SIZE / 2,
        y: y - ROOM_DEFAULT_SIZE / 2,
        w: ROOM_DEFAULT_SIZE,
        h: ROOM_DEFAULT_SIZE,
        rotation: 0
      }]);
    }
  };

  const [isGeneratingSpatialReport, setIsGeneratingSpatialReport] = useState(false);
  const [spatialReport, setSpatialReport] = useState<string | null>(null);
  const [spatialRiskScores, setSpatialRiskScores] = useState<any>({
    environmentalStress: 50,
    spatialResonance: 50,
    biologicalResponse: 50,
    overallRisk: 50
  });
  const [insightStep, setInsightStep] = useState<'form' | 'chat'>('form');
  const [insightAge, setInsightAge] = useState('');
  const [insightGender, setInsightGender] = useState('');
  const [insightMessages, setInsightMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const [insightInput, setInsightInput] = useState('');
  const [isInsightLoading, setIsInsightLoading] = useState(false);
  const [constitutionData, setConstitutionData] = useState<any>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null);

  const chartRef = useRef<any>(null);

  const checkUser = async () => {
    try {
      const res = await axios.get<UserInfo>('/api/me');
      setUser(res.data);
    } catch (err) {
      setUser({ loggedIn: false });
    } finally {
      setIsCheckingAuth(false);
    }
  };

  // Initialize days
  useEffect(() => {
    const days = new Date(year, month, 0).getDate();
    setDaysInMonth(days);
    if (day > days) setDay(days);
  }, [year, month]);

  // Check auth status
  useEffect(() => {
    checkUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResetPasswordModalOpen(true);
      }
      
      if (session) {
        await axios.post('/api/login', { access_token: session.access_token });
        checkUser();
      } else {
        await axios.post('/api/logout');
        setUser({ loggedIn: false });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load history when tab changes
  useEffect(() => {
    if (activeTab === 'history' && user.loggedIn) {
      loadHistory();
    }
  }, [activeTab, user.loggedIn]);

  // Scroll chat to bottom
  useEffect(() => {
    // Only auto-scroll when the report is generated (constitutionData is present)
    // This prevents annoying page jumps during the initial consultation phase
    if (activeTab === 'insight' && insightStep === 'chat' && constitutionData) {
      document.getElementById('chat-end')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [insightMessages, activeTab, insightStep, constitutionData]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await axios.get<HistoryItem[]>('/api/history');
      setHistory(res.data);
    } catch (err) {
      console.error("Failed to load history", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleLogout = async () => {
    await axios.post('/api/logout');
    setUser({ loggedIn: false });
    setActiveTab('home');
  };

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCalculating(true);
    setHasCalculated(false);
    setHasGeneratedReport(false);
    setReport(null);
    setCurrentHistoryId(null);

    try {
      // Ensure month and day are zero-padded for iztro
      const paddedMonth = month.toString().padStart(2, '0');
      const paddedDay = day.toString().padStart(2, '0');
      const dateStr = `${year}-${paddedMonth}-${paddedDay}`;
      
      const response = await axios.post<CalcResponse>('/api/calculate', { year, month, day });
      setCalcData(response.data);
      
      // Iztro calculation
      const astrolabe = astro.bySolar(dateStr, timeIndex, gender, true);
      setAstrolabeData(astrolabe);

      setHasCalculated(true);
      if (response.data.historyId) {
        setCurrentHistoryId(response.data.historyId);
        if (user.loggedIn) loadHistory();
      }
      
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
    if (!user.loggedIn) {
      setIsLoginModalOpen(true);
      return;
    }
    if (!calcData) return;
    setIsGeneratingReport(true);

    try {
      const response = await axios.post<ReportResponse>('/api/generate-report', {
        wylq_summary: calcData.wylq_summary,
        kline_data: calcData.kline_data,
        historyId: currentHistoryId
      });
      setReport(formatAIReport(response.data.report));
      setHasGeneratedReport(true);
      checkUser(); // Refresh balance
      
      setTimeout(() => {
        document.getElementById('report-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (error: any) {
      if (error.response?.status === 402) {
        setIsRechargeModalOpen(true);
      } else {
        console.error("Report generation error:", error);
        alert("报告生成失败，请稍后重试。");
      }
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const getChartOption = () => {
    if (!calcData) return {};
    
    return {
      backgroundColor: '#050505',
      animationDuration: 2000,
      title: {
        text: 'AHI (天人和谐) 全生命周期趋势图',
        left: 'center',
        top: 10,
        textStyle: { color: '#fff', fontSize: 16, fontWeight: 'bold', fontFamily: 'serif' }
      },
      legend: {
        bottom: 10,
        left: 'center',
        textStyle: { color: '#666', fontSize: 10 },
        data: ['能量升华', '能量损耗', '先天基准']
      },
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
              <div class="flex justify-between gap-8 mb-1"><span class="text-zinc-500">岁初生命力</span><span class="font-mono">${o}</span></div>
              <div class="flex justify-between gap-8 mb-1"><span class="text-zinc-500">岁末生命力</span><span class="font-mono">${c}</span></div>
              <div class="flex justify-between gap-8"><span class="text-zinc-500">年度盈亏</span><span class="font-mono" style="color:${col}">${diffVal > 0 ? '+' : ''}${diffVal}</span></div>
            </div>
          `;
        }
      },
      grid: { left: '5%', right: '8%', bottom: '15%', top: '15%', containLabel: true },
      xAxis: { 
        type: 'category', 
        name: '年龄 (岁)',
        nameLocation: 'end',
        nameTextStyle: { color: '#444', fontSize: 10, padding: [0, 0, 0, 10] },
        data: calcData.kline_data.map(d => d.age), 
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, 
        axisLabel: { color: '#666', fontSize: 10, margin: 15 }, 
        axisTick: { show: false } 
      },
      yAxis: { 
        scale: true, 
        min: 0, 
        max: 100, 
        name: '健康能量指数',
        nameLocation: 'end',
        nameTextStyle: { color: '#444', fontSize: 10, padding: [0, 0, 10, 0] },
        axisLine: { show: false }, 
        axisLabel: { color: '#666', fontSize: 10 }, 
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.02)' } } 
      },
      series: [
        {
          name: '能量升华',
          type: 'candlestick',
          data: [], // Dummy for legend
          itemStyle: { color: '#00A86B' }
        },
        {
          name: '能量损耗',
          type: 'candlestick',
          data: [], // Dummy for legend
          itemStyle: { color: '#FF4444' }
        },
        {
          name: '先天基准',
          type: 'line',
          data: [], // Dummy for legend
          lineStyle: { color: 'rgba(212,175,55,0.4)', type: 'dashed' }
        },
        {
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
        }
      ]
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

  const deleteHistory = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确定要删除这条记录吗？")) return;
    try {
      await axios.delete(`/api/history/${id}`);
      setHistory(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error("Delete failed", err);
      alert("删除失败");
    }
  };

  const handleInsightStart = async () => {
    if (!insightAge || !insightGender) return;
    setIsInsightLoading(true);
    try {
      await axios.post('/api/insight/start', { age: insightAge, gender: insightGender });
      setInsightStep('chat');
      // Initial message from AI
      const res = await axios.post('/api/insight/chat', { 
        message: "你好",
        age: insightAge,
        gender: insightGender,
        history: []
      });
      if (res.data.reply) {
        setInsightMessages([{ role: 'assistant', content: res.data.reply }]);
      } else {
        throw new Error("AI 响应异常");
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || "启动失败，请稍后再试");
      setInsightStep('form');
    } finally {
      setIsInsightLoading(false);
    }
  };

  const handleInsightChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!insightInput.trim() || isInsightLoading) return;

    const userMsg = insightInput;
    setInsightInput('');
    setInsightMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsInsightLoading(true);

    try {
      const res = await axios.post('/api/insight/chat', { 
        message: userMsg,
        history: insightMessages,
        age: insightAge,
        gender: insightGender
      });
      const reply = res.data.reply;
      
      if (!reply) throw new Error("AI 响应异常");

      // Check for constitution result
      const match = reply.match(/<用户体质：(.+?)>/);
      if (match) {
        const dataStr = match[1];
        const parts = dataStr.split('，');
        const scores: any = {};
        parts.forEach((p: string) => {
          const m = p.match(/(.+)质(\d+)分/);
          if (m) scores[m[1]] = parseInt(m[2]);
        });
        setConstitutionData(scores);
        // Auto scroll to result
        setTimeout(() => {
          document.getElementById('constitution-result')?.scrollIntoView({ behavior: 'smooth' });
        }, 500);
      }

      setInsightMessages(prev => [...prev, { role: 'assistant', content: reply.replace(/<用户体质：.+?>/, '') }]);
    } catch (err: any) {
      console.error(err);
      setInsightMessages(prev => [...prev, { role: 'assistant', content: "抱歉，交流中断，请稍后再试。" }]);
    } finally {
      setIsInsightLoading(false);
    }
  };

  const years = Array.from({ length: 2026 - 1900 + 1 }, (_, i) => 2026 - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-obsidian selection:bg-jade/30 pb-24">
      {/* Main Content Sections */}
      <AnimatePresence mode="wait">
        {activeTab === 'home' && (
          <motion.div 
            key="home"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
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
            <span className="text-[10px] uppercase tracking-[0.5em] text-jade font-medium">Traditional Wisdom // AI-Powered Health</span>
            <div className="h-px w-12 bg-jade/50"></div>
          </div>
          
          <h1 className="text-6xl md:text-8xl font-bold text-white tracking-tighter serif leading-tight">
            健康K线<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-jade via-white to-gold">健康资产预测系统</span>
          </h1>
          
          <p className="text-xl text-zinc-500 max-w-2xl mx-auto font-light leading-relaxed tracking-wide">
            结合《黄帝内经》时空医学与 AI 大模型算法，为您揭示先天体质弱点、预测全生命周期健康趋势、提供居住空间能量优化方案。了解身体节律，掌握健康主动权。
          </p>

          <div className="pt-12">
            <motion.a 
              href="#features-section"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="group inline-flex items-center gap-3 px-10 py-5 bg-white text-obsidian rounded-full font-bold transition-all hover:bg-jade hover:text-white"
            >
              <span>免费生成专属健康图谱</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </motion.a>
          </div>
        </motion.div>

        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30">
          <span className="text-[10px] uppercase tracking-widest">Scroll to begin</span>
          <div className="w-px h-12 bg-gradient-to-b from-white to-transparent"></div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="features-section" className="py-24 px-6 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: <Activity className="w-6 h-6 text-jade" />,
              title: "逐年健康K线图",
              desc: "基于五运六气气象医学模型，推演您 0-60 岁的逐年健康起伏趋势与关键转折点。",
              color: "jade",
              action: () => document.getElementById('input-section')?.scrollIntoView({ behavior: 'smooth' })
            },
            {
              icon: <Compass className="w-6 h-6 text-gold" />,
              title: "脏腑经络弱点扫描",
              desc: "透过东方星象算法，透视您十二脏腑经络的先天能量强弱，提供结构性健康风险预警。",
              color: "gold",
              action: () => setActiveTab('matrix')
            },
            {
              icon: <Shield className="w-6 h-6 text-blue-400" />,
              title: "居住空间风险扫描",
              desc: "基于阳宅健康理论，精算房屋空间布局对人体生物节律的影响，帮您规避隐形的环境健康杀手。",
              color: "blue",
              action: () => setActiveTab('spatial')
            },
            {
              icon: <MessageSquare className="w-6 h-6 text-purple-400" />,
              title: "AI 专家中医问诊",
              desc: "基于最新中医体质学说，通过多轮智能对话精准辨识您的九种体质并提供养生建议。",
              color: "purple",
              action: () => setActiveTab('insight')
            }
          ].map((feature, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
              onClick={feature.action}
              className="glass-panel p-8 space-y-4 hover:bg-white/[0.05] transition-all group cursor-pointer active:scale-[0.98]"
            >
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center mb-6",
                feature.color === 'jade' ? "bg-jade/10" : 
                feature.color === 'gold' ? "bg-gold/10" : 
                feature.color === 'blue' ? "bg-blue-400/10" : "bg-purple-400/10"
              )}>
                {feature.icon}
              </div>
              <h3 className="text-lg font-bold text-white serif">{feature.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed font-light">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Input Section */}
      <section id="input-section" className="py-32 px-6 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-24 items-center">
          <div>
            <SectionHeader 
              number="01" 
              title="Step 01 / 建立生命体质基线模型" 
              subtitle="在中医学中，您出生时的时空环境决定了先天的体质底色。请输入您的基本信息，系统将进行本地加密演算。（您的数据仅用于生成报告，绝不上传泄露）"
            />
            
            <div className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { id: 'year', label: "出生年份", value: year, setter: setYear, options: years },
                  { id: 'month', label: "月份", value: month, setter: setMonth, options: months },
                  { id: 'day', label: "日期", value: day, setter: setDay, options: days },
                  { id: 'gender', label: "性别", note: "脏腑图谱必需", value: gender, setter: setGender, options: ['male', 'female'], labels: { 'male': '乾造 (男)', 'female': '坤造 (女)' } },
                  { id: 'time', label: "时辰", note: "脏腑图谱必需", value: timeIndex, setter: setTimeIndex, options: TIME_OPTIONS.map((_, i) => i), labels: TIME_OPTIONS }
                ].map((item) => (
                  <div key={item.id} className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[10px] text-zinc-500 uppercase tracking-[0.2em]">{item.label}</label>
                      {item.note && (
                        <span className="text-[9px] text-jade/60 font-medium">{item.note}</span>
                      )}
                    </div>
                    <div className="relative group">
                      <select 
                        value={item.value}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (item.id === 'gender') {
                            (item.setter as React.Dispatch<React.SetStateAction<'male' | 'female'>>)(val as 'male' | 'female');
                          } else {
                            (item.setter as React.Dispatch<React.SetStateAction<number>>)(parseInt(val));
                          }
                        }}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white appearance-none focus:outline-none focus:border-jade/50 transition-all group-hover:bg-white/[0.05]"
                      >
                        {item.options.map((opt, idx) => (
                          <option key={opt} value={opt} className="bg-obsidian">
                            {item.labels ? (Array.isArray(item.labels) ? item.labels[idx] : (item.labels as any)[opt]) : opt}
                          </option>
                        ))}
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
                    <span className="text-lg">生成健康K线图</span>
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
              {!user.loggedIn && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-panel p-4 border-jade/20 bg-jade/5 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-4 h-4 text-jade" />
                    <p className="text-xs text-jade/80">登录后可永久保存您的演算记录与 AI 报告</p>
                  </div>
                  <button 
                    onClick={() => setIsLoginModalOpen(true)}
                    className="text-xs font-bold text-jade hover:underline"
                  >
                    立即登录
                  </button>
                </motion.div>
              )}
              
              <div className="grid lg:grid-cols-3 gap-12">
                <div className="lg:col-span-1 space-y-8">
                  <SectionHeader 
                    number="02" 
                    title="Step 02 / 先天体质与流年环境" 
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
                        <div className="flex items-center">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-widest">{item.label}</span>
                          <TermTooltip 
                            term={item.label} 
                            definition={TERM_DEFINITIONS[item.label as keyof typeof TERM_DEFINITIONS]} 
                          />
                        </div>
                        <p className={cn("text-lg font-bold serif", item.color)}>{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <div className="glass-panel p-6 border-l-2 border-l-jade">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="w-4 h-4 text-jade" />
                        <div className="flex items-center">
                          <span className="text-xs text-zinc-400 uppercase tracking-widest">当日五运格局</span>
                          <div className="flex gap-1 ml-1">
                            <TermTooltip term="主位" definition={TERM_DEFINITIONS["主位"]} />
                            <TermTooltip term="客位" definition={TERM_DEFINITIONS["客位"]} />
                          </div>
                        </div>
                      </div>
                      <p className="text-zinc-300 leading-relaxed">
                        {calcData.wylq_summary.daily_fortune}
                        {calcData.wylq_summary.daily_fortune.includes('太过') && <TermTooltip term="太过" definition={TERM_DEFINITIONS["太过"]} />}
                        {calcData.wylq_summary.daily_fortune.includes('不及') && <TermTooltip term="不及" definition={TERM_DEFINITIONS["不及"]} />}
                      </p>
                    </div>
                    <div className="glass-panel p-6 border-l-2 border-l-gold">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-gold" />
                        <div className="flex items-center">
                          <span className="text-xs text-zinc-400 uppercase tracking-widest">当日六气格局</span>
                          <div className="flex gap-1 ml-1">
                            <TermTooltip term="主位" definition={TERM_DEFINITIONS["主位"]} />
                            <TermTooltip term="客位" definition={TERM_DEFINITIONS["客位"]} />
                          </div>
                        </div>
                      </div>
                      <p className="text-zinc-300 leading-relaxed">{calcData.wylq_summary.daily_qi}</p>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-8">
                  <div className="flex justify-between items-end mb-8">
                    <SectionHeader 
                      number="03" 
                      title="Step 03 / 年度健康指数趋势图 (0-60岁)" 
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
                  <h3 className="text-3xl font-bold text-white serif">五运六气AI 健康节律解析</h3>
                  <p className="text-zinc-500 font-light leading-relaxed">
                    基于《黄帝内经》运气学说，针对您的先天格局深度拆解未来 60 年的关键健康转折点，提供养生建议。
                  </p>
                </div>
                <div className="flex flex-col items-center gap-4">
                  <button 
                    onClick={handleGenerateReport}
                    disabled={isGeneratingReport}
                    className="btn-primary bg-gold hover:bg-gold/90 hover:shadow-[0_0_20px_rgba(212,175,85,0.3)] min-w-[240px]"
                  >
                    {isGeneratingReport ? (
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>正在从《黄帝内经》等 12 部经典中调取算法...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5" />
                        <div className="flex flex-col items-start">
                          <span>生成专属报告 (消耗2草药)</span>
                          <span className="text-[9px] opacity-60 font-light">获取由 AI 结合古籍精算出的深度解析</span>
                        </div>
                      </div>
                    )}
                  </button>
                  <p className="text-[10px] text-zinc-600 italic">* 生成的报告将永久同步至您的‘健康档案’中，支持随时查阅。</p>
                </div>
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

          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Insight Section */}
      <AnimatePresence mode="wait">
        {activeTab === 'matrix' && (
          <motion.section
            key="matrix"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="pb-32"
          >
            {hasCalculated && astrolabeData ? (
              <div className="space-y-24">
                <MatrixAstrolabe data={astrolabeData} />
                
                {/* Health Report Trigger */}
                <div className="max-w-3xl mx-auto text-center space-y-8">
                  <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-jade/10 border border-jade/20 text-jade text-xs font-bold uppercase tracking-widest">
                    <HeartPulse className="w-4 h-4" />
                    AI Health Insight
                  </div>
                  <h2 className="text-2xl md:text-5xl font-bold text-white serif tracking-tight">先天脏腑经络能量图谱</h2>
                  <p className="text-zinc-500 text-sm md:text-lg max-w-2xl mx-auto leading-relaxed">
                    结合东方星象矩阵与中医经络学说，为您扫描身体系统的先天能量分布。寻找隐藏的健康风险敞口，提前进行干预与保养。
                  </p>
                  <div className="flex flex-col items-center gap-4">
                    <button 
                      onClick={generateHealthReport}
                      disabled={isGeneratingHealthReport}
                      className="btn-primary px-8 md:px-12 py-4 md:py-5 text-base md:text-lg flex items-center justify-center gap-4 mx-auto group"
                    >
                      {isGeneratingHealthReport ? (
                        <>
                          <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin" />
                          正在从《黄帝内经》等 12 部经典中调取算法...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 md:w-6 md:h-6 group-hover:rotate-12 transition-transform" />
                          立即生成先天脏腑经络能量图谱 (消耗2草药)
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-zinc-600 italic">* 生成的报告将永久同步至您的‘健康档案’中，支持随时查阅。</p>
                  </div>
                </div>

                {/* Health Report Display */}
                <AnimatePresence>
                  {healthReport && (
                    <motion.div 
                      id="health-report-section"
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -40 }}
                      className="max-w-5xl mx-auto"
                    >
                      <div className="glass-panel p-8 md:p-16 border-white/10 bg-black/40 shadow-[0_40px_120px_rgba(0,0,0,0.8)] relative overflow-hidden">
                        {/* Financial Report Header Decor */}
                        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                          <Activity className="w-64 h-64 text-gold" />
                        </div>
                        
                        <div className="flex flex-col md:flex-row justify-between items-start mb-12 border-b border-white/10 pb-8 gap-6 relative">
                          {/* Decorative Seal */}
                          <div className="absolute -top-4 left-1/2 -translate-x-1/2 opacity-10 pointer-events-none">
                            <div className="w-24 h-24 border-2 border-gold rounded-full flex items-center justify-center rotate-12">
                              <div className="w-20 h-20 border border-gold rounded-full flex items-center justify-center">
                                <span className="text-[8px] text-gold font-black uppercase tracking-tighter text-center">Matrix<br/>Verified<br/>Actuary</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-6 bg-gold" />
                              <h3 className="text-gold font-black tracking-[0.3em] uppercase text-sm">Asset Quality Report</h3>
                            </div>
                            <div className="space-y-1">
                              <p className="text-zinc-500 text-[9px] font-mono uppercase tracking-widest">Serial: {Math.random().toString(36).substr(2, 12).toUpperCase()}</p>
                              <p className="text-zinc-500 text-[9px] font-mono uppercase tracking-widest">Classification: Strictly Confidential</p>
                              <p className="text-zinc-500 text-[9px] font-mono uppercase tracking-widest">Methodology: Matrix Energy Actuarial v4.2</p>
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <p className="text-white font-bold text-2xl tracking-tight leading-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>生命资产质量深度评估报告</p>
                            <div className="flex items-center justify-end gap-3 text-zinc-500 text-[9px] font-mono uppercase tracking-widest">
                              <span className="text-gold/60">Matrix Analysis</span>
                              <span className="w-1 h-1 bg-zinc-700 rounded-full" />
                              <span>{new Date().toLocaleDateString()}</span>
                              <span className="w-1 h-1 bg-zinc-700 rounded-full" />
                              <span>{new Date().toLocaleTimeString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
                          <div className="lg:col-span-3">
                            <div className="prose prose-invert prose-jade max-w-none custom-report-style">
                              <Markdown remarkPlugins={[remarkGfm]}>{healthReport}</Markdown>
                            </div>
                          </div>
                          
                          <div className="space-y-8">
                            <div className="p-6 border border-white/5 bg-white/5 rounded-sm space-y-4">
                              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest border-b border-white/5 pb-2">Risk Rating</p>
                              <div className="flex items-end gap-2">
                                <span className="text-4xl font-black text-white">
                                  {riskScores.overallRisk > 80 ? 'AAA' : 
                                   riskScores.overallRisk > 60 ? 'AA+' : 
                                   riskScores.overallRisk > 40 ? 'A-' : 'BBB'}
                                </span>
                                <span className="text-xs text-zinc-600 mb-1">
                                  {riskScores.overallRisk > 70 ? 'Stable' : 'Volatile'}
                                </span>
                              </div>
                              <p className="text-[10px] text-zinc-500 leading-relaxed">
                                基于全息能量矩阵精算，该生命资产结构在当前周期内表现出{riskScores.overallRisk > 60 ? '较强的韧性' : '一定的波动性'}，局部风险敞口{riskScores.energyDeficit > 50 ? '需重点关注' : '受控'}。
                              </p>
                            </div>

                            <div className="p-6 border border-white/5 bg-white/5 rounded-sm space-y-4">
                              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest border-b border-white/5 pb-2">Analysis Vector</p>
                              <div className="space-y-3">
                                {[
                                  { label: 'Structural Vulnerability', value: riskScores.structuralVulnerability },
                                  { label: 'Energy Deficit', value: riskScores.energyDeficit },
                                  { label: 'Temporal Pressure', value: riskScores.temporalPressure }
                                ].map(item => (
                                  <div key={item.label} className="space-y-1">
                                    <div className="flex justify-between text-[10px] uppercase tracking-tighter">
                                      <span className="text-zinc-400">{item.label}</span>
                                      <span className="text-zinc-200">{item.value}%</span>
                                    </div>
                                    <div className="h-1 bg-white/5 w-full overflow-hidden">
                                      <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${item.value}%` }}
                                        className="h-full bg-gradient-to-r from-zinc-700 to-zinc-400" 
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="p-6 border border-gold/20 bg-gold/5 rounded-sm">
                              <div className="flex items-center gap-3 mb-4">
                                <ShieldCheck className="w-5 h-5 text-gold" />
                                <p className="text-[10px] text-gold font-bold uppercase tracking-widest">Actuary Verified</p>
                              </div>
                              <p className="text-[10px] text-zinc-400 leading-relaxed">
                                本报告由全息能量精算系统深度生成，已通过时空维度压力测试验证。
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8">
                          <div className="flex gap-4">
                            <button 
                              onClick={() => window.print()}
                              className="px-4 py-2 bg-gold/10 border border-gold/20 text-gold text-[10px] font-mono uppercase tracking-widest hover:bg-gold/20 transition-all flex items-center gap-2"
                            >
                              <Printer className="w-3 h-3" />
                              Print Report
                            </button>
                            <div className="px-3 py-1 border border-white/10 text-[9px] text-zinc-500 font-mono uppercase tracking-widest flex items-center">Confidential</div>
                            <div className="px-3 py-1 border border-white/10 text-[9px] text-zinc-500 font-mono uppercase tracking-widest flex items-center">Internal Use Only</div>
                          </div>
                          <p className="text-[9px] text-zinc-600 font-mono uppercase tracking-widest">
                            © {new Date().getFullYear()} Matrix Health Actuarial Services // Protocol v3.0
                          </p>
                        </div>
                        
                        {/* Watermark */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.02] pointer-events-none select-none">
                          <p className="text-[12rem] font-black whitespace-nowrap rotate-[-25deg]">ACTUARIAL</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="py-32 px-6 text-center max-w-md mx-auto space-y-6">
                <div className="w-16 h-16 rounded-full bg-jade/5 flex items-center justify-center mx-auto">
                  <Compass className="w-8 h-8 text-jade/30" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white serif">矩阵尚未初始化</h3>
                  <p className="text-zinc-500 text-sm">请先在首页输入您的出生信息并点击“开启演算”以同步能量矩阵。</p>
                </div>
                <button 
                  onClick={() => setActiveTab('home')}
                  className="btn-primary"
                >
                  前往初始化
                </button>
              </div>
            )}
          </motion.section>
        )}

        {activeTab === 'spatial' && (
          <motion.section
            key="spatial"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="py-32 px-6 max-w-7xl mx-auto min-h-screen"
          >
            <SectionHeader 
              number="04" 
              title="环境与生物节律分析 (空间健康引擎)" 
              subtitle="居住环境健康风险分析引擎：AI 深度扫描房屋布局对你健康的潜在风险"
            />

            <div className="grid lg:grid-cols-12 gap-12">
              {/* Toolbox */}
              <div className="lg:col-span-3 space-y-8">
                <div className="glass-panel p-6 space-y-6">
                  <h3 className="text-xs font-bold text-jade uppercase tracking-widest border-b border-white/5 pb-2">家庭角色</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: '父亲', icon: '👴' },
                      { value: '母亲', icon: '👵' },
                      { value: '长子', icon: '👦' },
                      { value: '长女', icon: '👧' },
                      { value: '中男', icon: '👦' },
                      { value: '中女', icon: '👧' },
                      { value: '少男', icon: '👶' },
                      { value: '少女', icon: '👶' }
                    ].map(person => (
                      <div
                        key={person.value}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('type', 'person');
                          e.dataTransfer.setData('value', person.value);
                          e.dataTransfer.setData('icon', person.icon);
                        }}
                        className="flex flex-col items-center justify-center p-3 bg-white/[0.02] border border-white/5 rounded-xl cursor-grab hover:bg-white/[0.05] transition-all active:cursor-grabbing"
                      >
                        <span className="text-2xl mb-1">{person.icon}</span>
                        <span className="text-[10px] text-zinc-400">{person.value}</span>
                      </div>
                    ))}
                  </div>

                  <h3 className="text-xs font-bold text-gold uppercase tracking-widest border-b border-white/5 pb-2 pt-4">功能空间</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: '厨房', icon: '🍳' },
                      { value: '厕所', icon: '🚽' },
                      { value: '卧室', icon: '🛏️' },
                      { value: '主卧室', icon: '🛏️' },
                      { value: '客厅', icon: '🛋️' },
                      { value: '餐厅', icon: '🍽️' },
                      { value: '书房', icon: '📚' },
                      { value: '阳台', icon: '🌿' }
                    ].map(room => (
                      <div
                        key={room.value}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('type', 'room');
                          e.dataTransfer.setData('value', room.value);
                          e.dataTransfer.setData('icon', room.icon);
                        }}
                        className="flex flex-col items-center justify-center p-3 bg-white/[0.02] border border-white/5 rounded-xl cursor-grab hover:bg-white/[0.05] transition-all active:cursor-grabbing"
                      >
                        <span className="text-2xl mb-1">{room.icon}</span>
                        <span className="text-[10px] text-zinc-400">{room.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Canvas Area */}
              <div className="lg:col-span-6">
                <div className="glass-panel p-4 h-[600px] relative overflow-hidden flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-jade rounded-full animate-pulse"></div>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Spatial Energy Canvas</span>
                    </div>
                    <button 
                      onClick={() => { setSpatialRooms([]); setSpatialPersons([]); }}
                      className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors uppercase tracking-widest"
                    >
                      Clear Canvas
                    </button>
                  </div>

                  <div className="flex-1 relative bg-black/40 rounded-xl border border-white/5 overflow-hidden">
                    <canvas 
                      ref={canvasRef}
                      onMouseDown={handleSpatialMouseDown}
                      onMouseMove={handleSpatialMouseMove}
                      onMouseUp={handleSpatialMouseUp}
                      onMouseLeave={handleSpatialMouseUp}
                      onDoubleClick={handleSpatialDoubleClick}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleSpatialDrop}
                      className="w-full h-full cursor-crosshair"
                    />
                    
                    {/* Compass UI */}
                    <div className="absolute bottom-6 right-6 group">
                      <div 
                        className="w-20 h-20 rounded-full bg-zinc-900/80 border-2 border-white/10 flex items-center justify-center cursor-grab active:cursor-grabbing relative"
                        onMouseDown={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const cx = rect.left + rect.width / 2;
                          const cy = rect.top + rect.height / 2;
                          const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI - compassRotation;
                          
                          const handleMove = (moveEvent: MouseEvent) => {
                            const currentAngle = Math.atan2(moveEvent.clientY - cy, moveEvent.clientX - cx) * 180 / Math.PI;
                            setCompassRotation(currentAngle - startAngle);
                          };
                          
                          const handleUp = () => {
                            window.removeEventListener('mousemove', handleMove);
                            window.removeEventListener('mouseup', handleUp);
                          };
                          
                          window.addEventListener('mousemove', handleMove);
                          window.addEventListener('mouseup', handleUp);
                        }}
                      >
                        <div 
                          className="w-full h-full relative transition-transform duration-75"
                          style={{ transform: `rotate(${compassRotation}deg)` }}
                        >
                          <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-bold text-red-500">北</span>
                          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gold">南</span>
                          <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400">东</span>
                          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400">西</span>
                        </div>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">拖拽旋转罗盘</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Analysis Trigger & Results */}
              <div className="lg:col-span-3 space-y-8">
                <div className="glass-panel p-8 text-center space-y-6">
                  <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mx-auto">
                    <Zap className="w-8 h-8 text-gold" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-white serif">居住空间风险扫描</h3>
                    <p className="text-zinc-500 text-xs">基于阳宅健康理论，精算房屋空间布局对人体生物节律的影响，帮您规避隐形的环境健康杀手。</p>
                  </div>

                  <div className="glass-panel p-4 bg-jade/5 border-jade/20 text-left">
                    <p className="text-[10px] text-jade/80 leading-relaxed">
                      <strong>操作指引：</strong><br/>
                      • 拖拽房间至画布布局。<br/>
                      • 拖拽角色至卧室内。<br/>
                      • 拖拽边角缩放，顶部圆点旋转。<br/>
                      • 双击元素删除。<br/>
                      • 旋转罗盘调整朝向。
                    </p>
                  </div>

                  <button 
                    onClick={generateSpatialReport}
                    disabled={spatialRooms.length === 0 || isGeneratingSpatialReport}
                    className="btn-primary w-full py-4 bg-gold hover:bg-gold/90 text-obsidian font-bold"
                  >
                    {isGeneratingSpatialReport ? (
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : (
                      "生成空间健康报告 (消耗2草药)"
                    )}
                  </button>
                  <p className="text-[10px] text-zinc-600 italic">* 生成的报告将永久同步至您的‘健康档案’中，支持随时查阅。</p>
                </div>

                {spatialReport && (
                  <div className="glass-panel p-6 space-y-4">
                    <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest border-b border-white/5 pb-2">Risk Summary</p>
                    <div className="space-y-3">
                      {[
                        { label: 'Environmental Stress', value: spatialRiskScores.environmentalStress },
                        { label: 'Spatial Resonance', value: spatialRiskScores.spatialResonance },
                        { label: 'Biological Response', value: spatialRiskScores.biologicalResponse }
                      ].map(item => (
                        <div key={item.label} className="space-y-1">
                          <div className="flex justify-between text-[9px] uppercase tracking-tighter">
                            <span className="text-zinc-400">{item.label}</span>
                            <span className="text-zinc-200">{item.value}%</span>
                          </div>
                          <div className="h-1 bg-white/5 w-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${item.value}%` }}
                              className="h-full bg-gold/50" 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Spatial Report Display */}
            <AnimatePresence>
              {spatialReport && (
                <motion.div 
                  id="spatial-report-section"
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-24 max-w-5xl mx-auto"
                >
                  <div className="glass-panel p-8 md:p-16 border-white/10 bg-black/40 shadow-[0_40px_120px_rgba(0,0,0,0.8)] relative overflow-hidden">
                    <div className="flex flex-col md:flex-row justify-between items-start mb-12 border-b border-white/10 pb-8 gap-6 relative">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-6 bg-jade" />
                          <h3 className="text-jade font-black tracking-[0.3em] uppercase text-sm">Spatial Risk Analysis</h3>
                        </div>
                        <div className="space-y-1">
                          <p className="text-zinc-500 text-[9px] font-mono uppercase tracking-widest">Engine: Spatial Resonance v1.0</p>
                          <p className="text-zinc-500 text-[9px] font-mono uppercase tracking-widest">Protocol: Health-Only Focus</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold text-2xl tracking-tight leading-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>居住环境健康风险评估</p>
                        <p className="text-zinc-500 text-[9px] font-mono uppercase tracking-widest mt-2">Matrix Actuarial Services</p>
                      </div>
                    </div>

                    <div className="prose prose-invert prose-jade max-w-none custom-report-style">
                      <Markdown remarkPlugins={[remarkGfm]}>{spatialReport}</Markdown>
                    </div>

                    <div className="mt-16 pt-8 border-t border-white/5 flex justify-between items-center">
                      <p className="text-[9px] text-zinc-600 font-mono uppercase tracking-widest">
                        © {new Date().getFullYear()} Matrix Spatial Health // Protocol v1.0
                      </p>
                      <div className="flex gap-4">
                        <div className="px-3 py-1 border border-white/10 text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Objective Analysis</div>
                        <div className="px-3 py-1 border border-white/10 text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Health Focused</div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-24 pt-12 border-t border-white/5 text-center space-y-2">
              <p className="text-zinc-600 text-[10px] tracking-[0.3em] uppercase">
                基于传统中医运气学说 · 仅供学术研究参考 · 不作为医疗诊断依据
              </p>
              <p className="text-zinc-700 text-[9px] tracking-widest uppercase opacity-50">
                Technical support by yijing-fengshui engine | Powered by Health K-Line AI
              </p>
            </div>
          </motion.section>
        )}

        {activeTab === 'insight' && (
          <motion.section
            key="insight"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="py-32 px-6 max-w-4xl mx-auto min-h-screen"
          >
            <SectionHeader 
              number="07" 
              title="体质辨识" 
              subtitle="基于中医体质学说，通过 AI 问诊深度解析您的生命底色。"
            />

            {insightStep === 'form' ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-panel p-8 md:p-12 space-y-8 max-w-2xl mx-auto"
              >
                <div className="text-center space-y-4 mb-8">
                  <div className="w-20 h-20 rounded-full bg-jade/10 flex items-center justify-center mx-auto">
                    <Sparkles className="w-10 h-10 text-jade" />
                  </div>
                  <h3 className="text-2xl font-bold text-white serif">开启 AI 问诊</h3>
                  <p className="text-zinc-500 text-sm">请提供您的基本信息，AI 专家将为您进行深度体质辨识。</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] text-zinc-500 uppercase tracking-widest ml-1">年龄段</label>
                    <select 
                      value={insightAge}
                      onChange={(e) => setInsightAge(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-jade/50 transition-all"
                    >
                      <option value="" className="bg-obsidian">请选择年龄段</option>
                      <option value="少年 (0-18岁)" className="bg-obsidian">少年 (0-18岁)</option>
                      <option value="青年 (19-35岁)" className="bg-obsidian">青年 (19-35岁)</option>
                      <option value="中年 (36-55岁)" className="bg-obsidian">中年 (36-55岁)</option>
                      <option value="中老年 (56-65岁)" className="bg-obsidian">中老年 (56-65岁)</option>
                      <option value="老年 (66岁以上)" className="bg-obsidian">老年 (66岁以上)</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] text-zinc-500 uppercase tracking-widest ml-1">性别</label>
                    <select 
                      value={insightGender}
                      onChange={(e) => setInsightGender(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-jade/50 transition-all"
                    >
                      <option value="" className="bg-obsidian">请选择性别</option>
                      <option value="男" className="bg-obsidian">男</option>
                      <option value="女" className="bg-obsidian">女</option>
                    </select>
                  </div>
                </div>

                <button 
                  onClick={handleInsightStart}
                  disabled={!insightAge || !insightGender || isInsightLoading}
                  className="btn-primary w-full py-5 flex items-center justify-center gap-3 group"
                >
                  {isInsightLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageSquare className="w-5 h-5 group-hover:scale-110 transition-transform" />}
                  <span>开始问诊</span>
                </button>
              </motion.div>
            ) : (
              <div className="space-y-12">
                {/* Chat Interface */}
                <div className="glass-panel flex flex-col h-[600px] overflow-hidden border-white/10 bg-black/20">
                  <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-jade rounded-full animate-pulse"></div>
                      <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">AI 专家坐诊中</span>
                    </div>
                    <button 
                      onClick={() => {
                        setInsightStep('form');
                        setInsightMessages([]);
                        setConstitutionData(null);
                      }}
                      className="text-[10px] text-zinc-600 hover:text-white transition-colors uppercase tracking-widest"
                    >
                      重新开始
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                    {insightMessages.map((msg, idx) => (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={cn(
                          "flex gap-4 max-w-[85%]",
                          msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                          msg.role === 'user' ? "bg-jade/20 text-jade" : "bg-gold/20 text-gold"
                        )}>
                          {msg.role === 'user' ? <User className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                        </div>
                        <div className={cn(
                          "p-4 rounded-2xl text-sm leading-relaxed",
                          msg.role === 'user' ? "bg-jade/10 text-white border border-jade/20" : "bg-white/[0.03] text-zinc-300 border border-white/10"
                        )}>
                          <Markdown>{msg.content}</Markdown>
                        </div>
                      </motion.div>
                    ))}
                    {isInsightLoading && (
                      <div className="flex gap-4 mr-auto">
                        <div className="w-8 h-8 rounded-full bg-gold/20 text-gold flex items-center justify-center animate-pulse">
                          <Activity className="w-4 h-4" />
                        </div>
                        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                          <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                        </div>
                      </div>
                    )}
                    <div id="chat-end" />
                  </div>

                  <form onSubmit={handleInsightChat} className="p-4 border-t border-white/5 bg-white/[0.02]">
                    <div className="relative">
                      <input 
                        type="text"
                        value={insightInput}
                        onChange={(e) => setInsightInput(e.target.value)}
                        placeholder="输入您的回答..."
                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-6 pr-16 py-4 text-white focus:outline-none focus:border-jade/50 transition-all"
                      />
                      <button 
                        type="submit"
                        disabled={!insightInput.trim() || isInsightLoading}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-3 text-jade hover:scale-110 transition-transform disabled:opacity-30"
                      >
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  </form>
                </div>

                {/* Constitution Result */}
                {constitutionData && (
                  <motion.div 
                    id="constitution-result"
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-8"
                  >
                    <div className="text-center space-y-4">
                      <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-gold/10 border border-gold/20 text-gold text-xs font-bold uppercase tracking-widest">
                        <ShieldCheck className="w-4 h-4" />
                        辨识结果已生成
                      </div>
                      <h2 className="text-3xl font-bold text-white serif">中医体质能量分布</h2>
                    </div>

                    <div className="glass-panel p-8 md:p-12">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                        <div className="h-[300px]">
                          <ReactECharts 
                            option={{
                              backgroundColor: 'transparent',
                              radar: {
                                indicator: Object.keys(constitutionData).map(name => ({ name, max: 100 })),
                                splitArea: { show: false },
                                axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
                                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
                              },
                              series: [{
                                type: 'radar',
                                data: [{
                                  value: Object.values(constitutionData),
                                  name: '体质得分',
                                  itemStyle: { color: '#00A86B' },
                                  areaStyle: { color: 'rgba(0, 168, 107, 0.2)' }
                                }]
                              }]
                            }}
                            style={{ height: '100%', width: '100%' }}
                          />
                        </div>
                        <div className="space-y-6">
                          {Object.entries(constitutionData).sort((a: any, b: any) => b[1] - a[1]).map(([name, score]: any) => (
                            <div key={name} className="space-y-2">
                              <div className="flex justify-between text-xs uppercase tracking-widest">
                                <span className={cn("font-bold", score > 60 ? "text-jade" : "text-zinc-500")}>{name}</span>
                                <span className="text-zinc-300 font-mono">{score} 分</span>
                              </div>
                              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${score}%` }}
                                  className={cn(
                                    "h-full rounded-full",
                                    score > 60 ? "bg-jade" : "bg-zinc-700"
                                  )}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* History Section */}
      <AnimatePresence mode="wait">
        {activeTab === 'history' && (
          <motion.section 
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="py-32 px-6 max-w-4xl mx-auto"
          >
            <SectionHeader 
              number="05" 
              title="历史演算" 
              subtitle="回顾您的生命周期健康趋势记录"
            />

            {!user.loggedIn ? (
              <div className="glass-panel p-12 text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-jade/5 flex items-center justify-center mx-auto">
                  <Shield className="w-8 h-8 text-jade/30" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white serif">登录以查看历史</h3>
                  <p className="text-zinc-500 text-sm">您的测算记录将安全地存储在云端，随时随地回顾。</p>
                </div>
                <button 
                  onClick={() => setIsLoginModalOpen(true)}
                  className="btn-primary"
                >
                  立即登录
                </button>
              </div>
            ) : isLoadingHistory ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="w-8 h-8 text-jade animate-spin" />
                <p className="text-zinc-500 text-sm">正在调取云端档案...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="glass-panel p-12 text-center space-y-4">
                <p className="text-zinc-500 serif">暂无演算记录</p>
                <button 
                  onClick={() => setActiveTab('home')}
                  className="text-jade text-sm hover:underline"
                >
                  去开启第一次演算
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {history.map((item) => (
                  <motion.div 
                    key={item.id}
                    whileHover={{ scale: 1.005 }}
                    className="glass-panel p-6 flex flex-col gap-4 hover:bg-white/[0.05] transition-all group relative"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center",
                          item.report_type === 'wuyun' ? "bg-jade/10 text-jade" :
                          item.report_type === 'ziwei' ? "bg-gold/10 text-gold" :
                          "bg-blue-400/10 text-blue-400"
                        )}>
                          {item.report_type === 'wuyun' ? <Calendar className="w-5 h-5" /> :
                           item.report_type === 'ziwei' ? <Activity className="w-5 h-5" /> :
                           <Compass className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-white font-bold serif">
                            {item.report_type === 'wuyun' ? '健康趋势报告' :
                             item.report_type === 'ziwei' ? '脏腑图谱报告' :
                             '居家风水报告'}
                          </p>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">
                            {new Date(item.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => setSelectedHistoryItem(selectedHistoryItem?.id === item.id ? null : item)}
                          className="text-jade text-sm hover:underline flex items-center gap-1"
                        >
                          {selectedHistoryItem?.id === item.id ? '收起内容' : '查看完整报告'}
                          <ChevronDown className={cn("w-4 h-4 transition-transform", selectedHistoryItem?.id === item.id && "rotate-180")} />
                        </button>
                        <button 
                          onClick={(e) => deleteHistory(item.id, e)}
                          className="p-2 text-zinc-700 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {selectedHistoryItem?.id === item.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-6 border-t border-white/5 mt-2">
                            <div className="prose prose-invert prose-jade max-w-none custom-report-style">
                              <Markdown remarkPlugins={[remarkGfm]}>
                                {formatAIReport(item.content.report)}
                              </Markdown>
                            </div>
                            
                            {item.report_type === 'wuyun' && item.content.wylq_summary && (
                              <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                                  <p className="text-[10px] text-zinc-500 uppercase mb-1">干支</p>
                                  <p className="text-xs text-white">{item.content.wylq_summary.ganzhi}</p>
                                </div>
                                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                                  <p className="text-[10px] text-zinc-500 uppercase mb-1">岁运</p>
                                  <p className="text-xs text-white">{item.content.wylq_summary.suiyun}</p>
                                </div>
                                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                                  <p className="text-[10px] text-zinc-500 uppercase mb-1">司天</p>
                                  <p className="text-xs text-white">{item.content.wylq_summary.sitian}</p>
                                </div>
                                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                                  <p className="text-[10px] text-zinc-500 uppercase mb-1">在泉</p>
                                  <p className="text-xs text-white">{item.content.wylq_summary.zaiquan}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* Profile Section */}
      <AnimatePresence mode="wait">
        {activeTab === 'profile' && (
          <motion.section 
            key="profile"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="py-32 px-6 max-w-4xl mx-auto space-y-12"
          >
            <SectionHeader 
              number="06" 
              title="个人中心" 
              subtitle="管理您的账户、草药余额与偏好设置"
            />

            {!user.loggedIn ? (
              <div className="glass-panel p-16 text-center space-y-8">
                <div className="w-24 h-24 rounded-full bg-gold/5 flex items-center justify-center mx-auto border border-white/5">
                  <User className="w-10 h-10 text-gold/20" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-2xl font-bold text-white serif">尚未登录</h3>
                  <p className="text-zinc-500 max-w-sm mx-auto">登录以解锁报告生成、草药充值及历史记录同步功能。</p>
                </div>
                <button 
                  onClick={() => setIsLoginModalOpen(true)}
                  className="bg-jade hover:bg-jade-dark text-white font-bold px-10 py-4 rounded-2xl transition-all shadow-lg shadow-jade/20"
                >
                  立即登录
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {/* User Info & Balance */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-1 glass-panel p-8 flex flex-col items-center text-center space-y-4">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-jade to-gold flex items-center justify-center text-3xl font-bold text-white serif shadow-xl">
                      {user.user?.email?.[0].toUpperCase()}
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold text-white serif truncate w-full max-w-[180px]">{user.user?.email}</h3>
                      <p className="text-zinc-500 text-[10px] uppercase tracking-[0.2em]">正式会员</p>
                    </div>
                    <button 
                      onClick={handleLogout}
                      className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-red-400 hover:bg-red-500/5 transition-all text-xs font-medium flex items-center justify-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      退出登录
                    </button>
                  </div>

                  <div className="md:col-span-2 glass-panel p-8 bg-gradient-to-br from-jade/10 to-transparent border-jade/20 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:scale-110 transition-transform">
                      <Zap className="w-48 h-48 text-jade" />
                    </div>
                    <div className="relative z-10 h-full flex flex-col justify-between space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-jade text-[10px] font-bold uppercase tracking-[0.2em]">
                          <Zap className="w-3.5 h-3.5" />
                          当前草药余额
                        </div>
                        <div className="flex items-baseline gap-3">
                          <span className="text-7xl font-black text-white tracking-tighter">{user.user?.herbs_balance}</span>
                          <span className="text-xl text-jade font-bold serif">棵 🌿</span>
                        </div>
                        <p className="text-zinc-500 text-xs leading-relaxed max-w-sm">
                          草药是健康K线的虚拟能量，用于生成专业报告。每次生成消耗 2 棵草药。
                        </p>
                      </div>
                      <button 
                        onClick={() => setIsRechargeModalOpen(true)}
                        className="bg-jade hover:bg-jade-dark text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-lg shadow-jade/20 flex items-center justify-center gap-2 w-full md:w-auto"
                      >
                        <Zap className="w-5 h-5" />
                        立即充值
                      </button>
                    </div>
                  </div>
                </div>

                {/* Account Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="glass-panel p-8 space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center border border-gold/20">
                        <Shield className="w-5 h-5 text-gold" />
                      </div>
                      <h3 className="text-lg font-bold text-white serif">账户安全</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-3 border-b border-white/5">
                        <span className="text-zinc-400 text-sm">邮箱验证</span>
                        <span className="text-jade text-sm font-bold">已验证</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-white/5">
                        <span className="text-zinc-400 text-sm">数据加密</span>
                        <span className="text-jade text-sm font-bold">AES-256</span>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel p-8 flex flex-col justify-between space-y-6">
                    <div className="space-y-4">
                      <div className="w-10 h-10 rounded-xl bg-jade/10 flex items-center justify-center border border-jade/20">
                        <FileText className="w-5 h-5 text-jade" />
                      </div>
                      <h3 className="text-lg font-bold text-white serif">数据同步</h3>
                      <p className="text-zinc-500 text-sm leading-relaxed">
                        您的所有报告数据均已进行端到端加密，并同步至云端。
                      </p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('history')}
                      className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white transition-all text-sm font-medium"
                    >
                      查看历史报告
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] w-[calc(100%-2rem)] md:w-auto max-w-lg md:max-w-none">
        <div className="glass-panel px-2 md:px-6 py-3 flex items-center justify-around md:justify-center md:gap-8 backdrop-blur-2xl bg-obsidian/40 border-white/10 shadow-2xl rounded-3xl">
          {[
            { id: 'home', icon: Home, label: '健康趋势' },
            { id: 'matrix', icon: Compass, label: '脏腑图谱' },
            { id: 'spatial', icon: Zap, label: '居家风水' },
            { id: 'insight', icon: Sparkles, label: '体质辨识' },
            { id: 'history', icon: History, label: '健康档案' },
            { id: 'profile', icon: User, label: '个人中心' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "flex flex-col items-center gap-1.5 px-2 md:px-4 py-1 rounded-2xl transition-all duration-300 min-w-[64px] md:min-w-0",
                activeTab === item.id ? "text-jade scale-110" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <item.icon className={cn("w-5 h-5", activeTab === item.id && "animate-pulse")} />
              <span className="text-[9px] md:text-[10px] font-medium tracking-tighter whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <footer className="py-24 px-6 border-t border-white/5 bg-ink/30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-jade/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-jade" />
            </div>
            <span className="text-lg font-bold text-white serif tracking-widest uppercase">健康K线 (Health K-Line) 系统</span>
          </div>
          
          <div className="flex flex-col gap-2 text-center md:text-right">
            <p className="text-zinc-500 text-[11px] font-medium tracking-wide max-w-2xl ml-auto">
              本系统基于传统中医古籍算法与前沿 AI 大模型生成。分析结果仅供预防医学、个人养生保健及学术文化研究参考。系统无法替代执业医师的专业诊断。若有不适，请务必及时就医。
            </p>
            <p className="text-zinc-700 text-[9px] tracking-widest uppercase opacity-50">
              Technical support by yijing-fengshui engine | 健康K线 (Health K-Line) 系统
            </p>
          </div>
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

        .custom-report-style {
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }
        .custom-report-style h2 { 
          color: #FFFFFF !important; 
          font-size: 1.4rem !important; 
          font-weight: 800 !important; 
          margin-bottom: 1.5rem !important; 
          border-left: 4px solid #D4AF37 !important; 
          padding-left: 0.8rem !important;
          border-bottom: none !important;
          margin-top: 2rem !important;
        }
        .custom-report-style h3 { 
          color: #D4AF37 !important; 
          font-size: 1.1rem !important; 
          font-weight: 700 !important; 
          margin-top: 1.2rem !important; 
          margin-bottom: 0.8rem !important;
        }
        .custom-report-style p, .custom-report-style li {
          color: #A1A1AA !important; 
          font-size: 0.95rem !important; 
          line-height: 1.8 !important; 
          filter: brightness(0.8) !important;
          margin-bottom: 1rem !important;
        }
        .custom-report-style strong {
          color: #FACC15 !important;
        }
        .custom-report-style ul, .custom-report-style ol {
          margin-bottom: 1.5rem;
          padding-left: 1.5rem;
        }
        .custom-report-style li {
          list-style-type: disc;
          position: relative;
        }
        .custom-report-style li::marker {
          color: #D4AF37;
        }
      `}</style>
      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
      />
      <ResetPasswordModal
        isOpen={isResetPasswordModalOpen}
        onClose={() => setIsResetPasswordModalOpen(false)}
      />
      <RechargeModal 
        isOpen={isRechargeModalOpen} 
        onClose={() => setIsRechargeModalOpen(false)} 
        onSuccess={checkUser}
      />
    </div>
  );
}
