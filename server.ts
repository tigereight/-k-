import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { Solar, Lunar } from "lunar-javascript";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import { createServer as createViteServer } from "vite";

declare module "express-session" {
  interface SessionData {
    userId: number;
    insightMessages: any[];
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Database
const db = new Database("database.sqlite");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    birth_date TEXT NOT NULL,
    wylq_data TEXT NOT NULL,
    report_text TEXT,
    base_score REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());

  // Session Configuration
  app.use(session({
    secret: process.env.SESSION_SECRET || "ahi-secret-key",
    resave: true,
    saveUninitialized: true,
    cookie: {
      secure: true,
      sameSite: "none",
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
  }));

  // Auth Middleware
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (req.session.userId) {
      next();
    } else {
      res.status(401).json({ error: "未登录" });
    }
  };

app.delete("/api/history/:id", isAuthenticated, (req, res) => {
  const { id } = req.params;
  const result = db.prepare("DELETE FROM history WHERE id = ? AND user_id = ?").run(id, req.session.userId);
  if (result.changes > 0) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "记录不存在" });
  }
});

// ==========================================
// 1. 基础定义与枚举 (Basic Definitions)
// ==========================================

enum Element {
  WOOD = "木",
  FIRE = "火",
  EARTH = "土",
  METAL = "金",
  WATER = "水",
}

const ElementGeneration: Record<Element, Element> = {
  [Element.WOOD]: Element.FIRE,
  [Element.FIRE]: Element.EARTH,
  [Element.EARTH]: Element.METAL,
  [Element.METAL]: Element.WATER,
  [Element.WATER]: Element.WOOD,
};

const ElementOvercomes: Record<Element, Element> = {
  [Element.WOOD]: Element.EARTH,
  [Element.EARTH]: Element.WATER,
  [Element.WATER]: Element.FIRE,
  [Element.FIRE]: Element.METAL,
  [Element.METAL]: Element.WOOD,
};

const ElementOvercomer: Record<Element, Element> = {
  [Element.WOOD]: Element.METAL,
  [Element.METAL]: Element.FIRE,
  [Element.FIRE]: Element.WATER,
  [Element.WATER]: Element.EARTH,
  [Element.EARTH]: Element.WOOD,
};

enum Adequacy {
  EXCESS = "太过",
  DEFICIENCY = "不及",
}

class HeavenlyStem {
  static JIA = { index: 0, char: "甲", element: Element.EARTH, adequacy: Adequacy.EXCESS };
  static YI = { index: 1, char: "乙", element: Element.METAL, adequacy: Adequacy.DEFICIENCY };
  static BING = { index: 2, char: "丙", element: Element.WATER, adequacy: Adequacy.EXCESS };
  static DING = { index: 3, char: "丁", element: Element.WOOD, adequacy: Adequacy.DEFICIENCY };
  static WU = { index: 4, char: "戊", element: Element.FIRE, adequacy: Adequacy.EXCESS };
  static JI = { index: 5, char: "己", element: Element.EARTH, adequacy: Adequacy.DEFICIENCY };
  static GENG = { index: 6, char: "庚", element: Element.METAL, adequacy: Adequacy.EXCESS };
  static XIN = { index: 7, char: "辛", element: Element.WATER, adequacy: Adequacy.DEFICIENCY };
  static REN = { index: 8, char: "壬", element: Element.WOOD, adequacy: Adequacy.EXCESS };
  static GUI = { index: 9, char: "癸", element: Element.FIRE, adequacy: Adequacy.DEFICIENCY };

  static list() {
    return [this.JIA, this.YI, this.BING, this.DING, this.WU, this.JI, this.GENG, this.XIN, this.REN, this.GUI];
  }

  static fromYear(year: number) {
    return this.list()[((year - 4) % 10 + 10) % 10];
  }
}

class EarthlyBranch {
  static ZI = { index: 0, char: "子", element: Element.WATER };
  static CHOU = { index: 1, char: "丑", element: Element.EARTH };
  static YIN = { index: 2, char: "寅", element: Element.WOOD };
  static MAO = { index: 3, char: "卯", element: Element.WOOD };
  static CHEN = { index: 4, char: "辰", element: Element.EARTH };
  static SI = { index: 5, char: "巳", element: Element.FIRE };
  static WU = { index: 6, char: "午", element: Element.FIRE };
  static WEI = { index: 7, char: "未", element: Element.EARTH };
  static SHEN = { index: 8, char: "申", element: Element.METAL };
  static YOU = { index: 9, char: "酉", element: Element.METAL };
  static XU = { index: 10, char: "戌", element: Element.EARTH };
  static HAI = { index: 11, char: "亥", element: Element.WATER };

  static list() {
    return [this.ZI, this.CHOU, this.YIN, this.MAO, this.CHEN, this.SI, this.WU, this.WEI, this.SHEN, this.YOU, this.XU, this.HAI];
  }

  static fromYear(year: number) {
    return this.list()[((year - 4) % 12 + 12) % 12];
  }
}

class QiType {
  static WEAK_YIN_WOOD = { display_name: "厥阴风木", factor: "风", element: Element.WOOD };
  static MILD_YIN_FIRE = { display_name: "少阴君火", factor: "热", element: Element.FIRE };
  static WEAK_YANG_FIRE = { display_name: "少阳相火", factor: "火", element: Element.FIRE };
  static DOMINANT_YIN_EARTH = { display_name: "太阴湿土", factor: "湿", element: Element.EARTH };
  static MILD_YANG_METAL = { display_name: "阳明燥金", factor: "燥", element: Element.METAL };
  static DOMINANT_YANG_WATER = { display_name: "太阳寒水", factor: "寒", element: Element.WATER };

  static list() {
    return [this.WEAK_YIN_WOOD, this.MILD_YIN_FIRE, this.WEAK_YANG_FIRE, this.DOMINANT_YIN_EARTH, this.MILD_YANG_METAL, this.DOMINANT_YANG_WATER];
  }

  static previous(qi: any) {
    const order = this.list();
    const idx = order.findIndex(q => q.display_name === qi.display_name);
    return order[(idx - 1 + 6) % 6];
  }
}

// ==========================================
// 2. 高精度天文历法引擎 (Astronomical Engine)
// ==========================================

class AstronomyEngine {
  static getExactJieqi(year: number, termName: string): Date {
    try {
      const monthMap: Record<string, number> = {
        "大寒": 1, "春分": 3, "小满": 5, "芒种": 6, "大暑": 7, "处暑": 8, "秋分": 9, "小雪": 11, "立冬": 11
      };
      const m = monthMap[termName] || 6;

      const checkMonths = [
        { y: year, m: m },
        { y: year, m: m - 1 },
        { y: year, m: m + 1 },
        { y: year - 1, m: 12 }
      ];

      for (let pos of checkMonths) {
        let y = pos.y;
        let mon = pos.m;
        if (mon < 1) { y -= 1; mon = 12; }
        if (mon > 12) { y += 1; mon = 1; }
        
        const lunar = Solar.fromYmd(y, mon, 15).getLunar();
        const jieqi = lunar.getJieQiTable();
        const term = (typeof (jieqi as any).get === 'function') ? (jieqi as any).get(termName) : (jieqi as any)[termName];
        
        if (term && term.getYear() === year) {
          return new Date(term.getYear(), term.getMonth() - 1, term.getDay(), term.getHour(), term.getMinute(), term.getSecond());
        }
      }

      for (let targetM = 1; targetM <= 12; targetM++) {
        const lunar = Solar.fromYmd(year, targetM, 15).getLunar();
        const jieqi = lunar.getJieQiTable();
        const term = (typeof (jieqi as any).get === 'function') ? (jieqi as any).get(termName) : (jieqi as any)[termName];
        if (term && term.getYear() === year) {
          return new Date(term.getYear(), term.getMonth() - 1, term.getDay(), term.getHour(), term.getMinute(), term.getSecond());
        }
      }
    } catch (e) {
      console.error(`Error in getExactJieqi for ${termName} in ${year}:`, e);
    }

    throw new Error(`无法定位 ${year}年 的 ${termName} 节气时间，请检查历法库状态`);
  }
}

// ==========================================
// 3. 五运六气核心逻辑 (WuYunLiuQi Engine)
// ==========================================

class WuYunLiuQi {
  targetDate: Date;
  wuyunYear: number;
  stem: any;
  branch: any;

  constructor(dateObj: Date) {
    this.targetDate = dateObj;
    const currentYear = dateObj.getFullYear();
    const stem = HeavenlyStem.fromYear(currentYear);
    const dahan = AstronomyEngine.getExactJieqi(currentYear, "大寒");
    
    const boundary = new Date(dahan);
    if (stem.adequacy === Adequacy.EXCESS) {
      boundary.setDate(boundary.getDate() - 13);
    } else {
      boundary.setDate(boundary.getDate() + 13);
    }

    if (this.targetDate < boundary) {
      this.wuyunYear = currentYear - 1;
    } else {
      this.wuyunYear = currentYear;
    }

    this.stem = HeavenlyStem.fromYear(this.wuyunYear);
    this.branch = EarthlyBranch.fromYear(this.wuyunYear);
  }

  getYearFortune() {
    return {
      element: this.stem.element,
      adequacy: this.stem.adequacy,
      description: `${this.stem.element}运${this.stem.adequacy}`
    };
  }

  getGuestFortunes() {
    const fortunes = [];
    let currentElement = this.stem.element;
    let currentAdequacy = this.stem.adequacy;
    for (let i = 0; i < 5; i++) {
      fortunes.push({
        step: i + 1, element: currentElement, adequacy: currentAdequacy
      });
      currentElement = ElementGeneration[currentElement];
      currentAdequacy = currentAdequacy === Adequacy.EXCESS ? Adequacy.DEFICIENCY : Adequacy.EXCESS;
    }
    return fortunes;
  }

  getHostFortunes() {
    return [Element.WOOD, Element.FIRE, Element.EARTH, Element.METAL, Element.WATER];
  }

  getClimaticEffect() {
    const mapping: any = [
      { branches: [EarthlyBranch.ZI.char, EarthlyBranch.WU.char], effects: [QiType.MILD_YIN_FIRE, QiType.MILD_YANG_METAL] },
      { branches: [EarthlyBranch.CHOU.char, EarthlyBranch.WEI.char], effects: [QiType.DOMINANT_YIN_EARTH, QiType.DOMINANT_YANG_WATER] },
      { branches: [EarthlyBranch.YIN.char, EarthlyBranch.SHEN.char], effects: [QiType.WEAK_YANG_FIRE, QiType.WEAK_YIN_WOOD] },
      { branches: [EarthlyBranch.MAO.char, EarthlyBranch.YOU.char], effects: [QiType.MILD_YANG_METAL, QiType.MILD_YIN_FIRE] },
      { branches: [EarthlyBranch.CHEN.char, EarthlyBranch.XU.char], effects: [QiType.DOMINANT_YANG_WATER, QiType.DOMINANT_YIN_EARTH] },
      { branches: [EarthlyBranch.SI.char, EarthlyBranch.HAI.char], effects: [QiType.WEAK_YIN_WOOD, QiType.WEAK_YANG_FIRE] },
    ];
    for (const item of mapping) {
      if (item.branches.includes(this.branch.char)) {
        return { celestial: item.effects[0], terrestrial: item.effects[1] };
      }
    }
  }

  getGuestQiSequence() {
    const effect = this.getClimaticEffect()!;
    const st = effect.celestial;
    const zq = effect.terrestrial;
    return [
      QiType.previous(QiType.previous(st)),
      QiType.previous(st),
      st,
      QiType.previous(QiType.previous(zq)),
      QiType.previous(zq),
      zq
    ];
  }

  getCurrentFortuneEnums() {
    const termOffsets: [string, number][] = [["大寒", 0], ["春分", 13], ["芒种", 10], ["处暑", 7], ["立冬", 4]];
    const startDates = termOffsets.map(([term, offset]) => {
      const d = AstronomyEngine.getExactJieqi(this.wuyunYear, term);
      d.setDate(d.getDate() + offset);
      return d;
    });
    startDates.push(AstronomyEngine.getExactJieqi(this.wuyunYear + 1, "大寒"));
    
    let step = 4;
    for (let i = 0; i < 5; i++) {
      if (this.targetDate >= startDates[i] && this.targetDate < startDates[i + 1]) {
        step = i;
        break;
      }
    }
    return [this.getHostFortunes()[step], this.getGuestFortunes()[step].element];
  }

  getCurrentQiEnums() {
    const terms = ["大寒", "春分", "小满", "大暑", "秋分", "小雪", "大寒"];
    const bounds = terms.map((t, i) => AstronomyEngine.getExactJieqi(this.wuyunYear + (i === 6 ? 1 : 0), t));
    
    let step = 5;
    for (let i = 0; i < 6; i++) {
      if (this.targetDate >= bounds[i] && this.targetDate < bounds[i + 1]) {
        step = i;
        break;
      }
    }
    const hostQis = QiType.list();
    return [hostQis[step], this.getGuestQiSequence()[step]];
  }

  getCurrentFortune() {
    const termOffsets: [string, number][] = [["大寒", 0], ["春分", 13], ["芒种", 10], ["处暑", 7], ["立冬", 4]];
    const startDates = termOffsets.map(([term, offset]) => {
      const d = AstronomyEngine.getExactJieqi(this.wuyunYear, term);
      d.setDate(d.getDate() + offset);
      return d;
    });
    startDates.push(AstronomyEngine.getExactJieqi(this.wuyunYear + 1, "大寒"));
    
    let step = 4;
    for (let i = 0; i < 5; i++) {
      if (this.targetDate >= startDates[i] && this.targetDate < startDates[i + 1]) {
        step = i;
        break;
      }
    }
    const h = this.getHostFortunes()[step];
    const g = this.getGuestFortunes()[step];
    return {
      step_index: step + 1,
      start_date: startDates[step].toISOString().replace('T', ' ').substring(0, 19),
      host: h,
      guest: `${g.element}${g.adequacy}`
    };
  }

  getCurrentQi() {
    const terms = ["大寒", "春分", "小满", "大暑", "秋分", "小雪", "大寒"];
    const bounds = terms.map((t, i) => AstronomyEngine.getExactJieqi(this.wuyunYear + (i === 6 ? 1 : 0), t));
    
    let step = 5;
    for (let i = 0; i < 6; i++) {
      if (this.targetDate >= bounds[i] && this.targetDate < bounds[i + 1]) {
        step = i;
        break;
      }
    }
    const h = QiType.list()[step];
    const g = this.getGuestQiSequence()[step];
    const formatDate = (d: Date) => `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    return {
      step_index: step + 1,
      term_range: `${formatDate(bounds[step])} 至 ${formatDate(bounds[step + 1])}`,
      host: `${h.display_name} (${h.factor})`,
      guest: `${g.display_name} (${g.factor})`
    };
  }
}

// ==========================================
// 4. AHI K线图生成引擎 (AHI Engine)
// ==========================================

class AHIEngine {
  birthDt: Date;
  natalCalc: WuYunLiuQi;
  natalSuiYun: Element;
  natalAdequacy: Adequacy;
  strongZang: Element;
  weakZang: Element;
  birthHostYun: Element;
  birthHostQi: any;
  birthGuestQi: any;
  baseScore: number;

  constructor(birthDt: Date) {
    this.birthDt = birthDt;
    this.natalCalc = new WuYunLiuQi(birthDt);

    this.natalSuiYun = this.natalCalc.stem.element;
    this.natalAdequacy = this.natalCalc.stem.adequacy;

    if (this.natalAdequacy === Adequacy.EXCESS) {
      this.strongZang = this.natalSuiYun;
      this.weakZang = ElementOvercomes[this.natalSuiYun];
    } else {
      this.weakZang = this.natalSuiYun;
      this.strongZang = ElementOvercomer[this.natalSuiYun];
    }

    const [hostYun, _] = this.natalCalc.getCurrentFortuneEnums();
    this.birthHostYun = hostYun as Element;
    const [hostQi, guestQi] = this.natalCalc.getCurrentQiEnums();
    this.birthHostQi = hostQi;
    this.birthGuestQi = guestQi;

    this.baseScore = this._calcBaseScore();
  }

  _calcBaseScore() {
    let score = 75; // 基础健康分提升至 75
    const hEl = this.birthHostQi.element;
    const gEl = this.birthGuestQi.element;

    if (ElementGeneration[gEl] === hEl || ElementGeneration[hEl] === gEl || gEl === hEl) {
      score += 5;
    } else if (ElementOvercomes[hEl] === gEl) {
      score -= 8;
    } else if (ElementOvercomes[gEl] === hEl) {
      score -= 5;
    }

    const hQi = this.birthHostQi.display_name;
    const gQi = this.birthGuestQi.display_name;
    if (gQi.includes("君火") && hQi.includes("相火")) {
      score += 5;
    } else if (gQi.includes("相火") && hQi.includes("君火")) {
      score -= 5;
    }

    const effect = this.natalCalc.getClimaticEffect()!;
    const siTian = effect.celestial.element;
    const suiYun = this.natalSuiYun;
    const branchEl = this.natalCalc.branch.element;

    if (ElementGeneration[siTian] === suiYun) score += 10;
    if (suiYun === branchEl) score += 8;
    if (ElementGeneration[suiYun] === siTian) score -= 6;
    if (ElementOvercomes[suiYun] === siTian) score -= 8;
    if (ElementOvercomes[siTian] === suiYun) score -= 12;
    if (suiYun === siTian) score -= 5;

    return score;
  }

  calculateYearAhi(targetYear: number): number {
    const dt = AstronomyEngine.getExactJieqi(targetYear, "大寒");
    const flowYear = new WuYunLiuQi(dt);

    const cySuiYun = flowYear.stem.element;
    const cyAdequacy = flowYear.stem.adequacy;
    const effect = flowYear.getClimaticEffect()!;
    const siTian = effect.celestial;
    const zaiQuan = effect.terrestrial;

    let suiYunPts = 0;
    if (cySuiYun === this.natalSuiYun) suiYunPts += 10;
    else if (ElementGeneration[cySuiYun] === this.natalSuiYun || ElementGeneration[this.natalSuiYun] === cySuiYun) suiYunPts += 7;
    else if (ElementOvercomes[cySuiYun] === this.natalSuiYun || ElementOvercomes[this.natalSuiYun] === cySuiYun) suiYunPts -= 10;

    if (cyAdequacy === Adequacy.EXCESS && ElementOvercomes[cySuiYun] === this.weakZang) suiYunPts -= 6;
    if (cyAdequacy === Adequacy.DEFICIENCY && ElementGeneration[cySuiYun] === this.strongZang) suiYunPts += 5;

    const guestYuns = flowYear.getGuestFortunes().map(f => f.element);
    let stepPtsSum = 0;
    for (const gy of guestYuns) {
      let s = 0;
      if (gy === this.birthHostYun) s += 8;
      else if (ElementGeneration[gy] === this.birthHostYun || ElementGeneration[this.birthHostYun] === gy) s += 6;
      else if (ElementOvercomes[gy] === this.birthHostYun || ElementOvercomes[this.birthHostYun] === gy) s -= 10;
      stepPtsSum += s;
    }
    const avgStepPts = stepPtsSum / 5;
    const weightedYun = (suiYunPts * 0.90) + (avgStepPts * 0.10);

    const bhPrefix = this.birthHostQi.display_name.substring(0, 2);
    const stPrefix = siTian.display_name.substring(0, 2);
    const zqPrefix = zaiQuan.display_name.substring(0, 2);

    let sqPts1 = 0;
    if (stPrefix === bhPrefix || zqPrefix === bhPrefix) sqPts1 += 8;
    if (ElementGeneration[siTian.element] === this.birthHostQi.element) sqPts1 += 6;
    if (ElementOvercomes[siTian.element] === this.birthHostQi.element || ElementOvercomes[siTian.element] === this.weakZang) sqPts1 -= 12;
    if (ElementOvercomes[zaiQuan.element] === this.birthHostQi.element || ElementOvercomes[zaiQuan.element] === this.weakZang) sqPts1 -= 12;

    let sqPts2 = 0;
    const siTianEl = siTian.element;
    const guestQiEl = this.birthGuestQi.element;

    if (siTianEl === cySuiYun) {
      if (siTianEl === this.strongZang) sqPts2 += 8;
      if (siTianEl === this.weakZang) sqPts2 -= 12;
    }

    if (ElementOvercomes[siTianEl] === guestQiEl) sqPts2 -= 15;
    if (ElementGeneration[siTianEl] === guestQiEl) sqPts2 += 10;
    if (ElementOvercomes[guestQiEl] === siTianEl) sqPts2 -= 8;

    const weightedQi = (sqPts1 * 0.40) + (sqPts2 * 0.60);
    return (weightedYun * 0.30) + (weightedQi * 0.70);
  }
}

// ==========================================
// Knowledge Bases
// ==========================================

const SANYIN_KNOWLEDGE = `
【一、 健康指数(AHI)算法与加权规则解析】
告诉用户，其0-60岁的健康K线图并非随机生成，而是基于以下严密的中医运气学数学模型计算得出：
1. 个人基准分 (Base Score)：基础分为75分。根据出生日的“主客加临”吉凶决定先天底子。
2. 年度流年碰撞分 (Impact Score)：包含五运碰撞(30%)和六气碰撞(70%)。
3. 动态生命周期与健康惯性：当年最终收盘价 = (去年健康分*0.6 + 先天基准分*0.4) + 流年碰撞净分 + 年龄漂移值。
`;

const CONSTITUTION_KNOWLEDGE_BASE = `
4.1 平和质
定义：平和质指一种强健、壮实的体质状态，表现为体态适中、面色红润、精力充沛。
特征：体形匀称健壮。面色、肤色润泽，头发稠密有光泽，目光有神，鼻色明润，嗅觉通利，口和，唇色红润，不易疲劳，精力充沛，耐受寒热，睡眠良好，胃纳佳，二便正常。性格随和开朗。
文献依据：《素问·调经论》：“阴阳匀平，以充其形，九候若一，命曰平人。”

4.2 气虚质
定义：因元气不足，表现为气息低弱、机体及脏腑功能低下的体质状态。
特征：肌肉不健壮，瘦人为多。语音低怯，气短懒言，肢体容易疲乏，精神不振，易出汗，自汗，面色偏黄或白，目光少神，头晕，健忘。舌淡红，舌体胖大，边有齿痕。性格内向，情绪不稳定，胆小。
发病倾向：易患感冒，内脏下垂，慢性疲劳。

4.3 阳虚质
定义：因阳气不足，以虚寒现象为主要特征的体质状态。
特征：形体白胖、肌肉不壮。平素畏冷，手足不温，喜热饮食，精神不振，睡眠偏多，面色柔白，唇色淡。舌淡胖嫩，苔白润。性格沉静，内向。
发病倾向：易患寒证，如水肿、腹泻、阳痿、甲减。

4.4 阴虚质
定义：体内津液、精血等阴液亏少，以阴虚内热为主要特征的体质状态。
特征：体形瘦长。手足心热，易口燥咽干，面色潮红，有烘热感，睡眠差，心烦易怒。舌红少津少苔。性情急躁，外向好动。
发病倾向：易患阴虚燥热病变，如糖尿病、更年期综合征。

4.5 痰湿质
定义：由于水液内停、痰湿凝聚，以黏滞重浊为主要特征的体质状态。
特征：体形肥胖，腹部肥满松软。面部皮肤油脂较多，多汗且黏，胸闷，痰多，易困倦，身重不爽。口黏腻或甜。舌体胖大，苔白腻。性格偏温和稳重。
发病倾向：易患消渴、中风、胸痹、高脂血症。

4.6 湿热质
定义：以湿热内蕴为主要特征的体质状态。
特征：形体偏胖或瘦削。面垢油光，易生痤疮粉刺，口苦口干，身重困倦，心烦懈怠，眼睛红赤。舌质偏红，苔黄腻。性格多急躁易怒。
发病倾向：易患疮疖、黄疸、皮肤炎。

4.7 瘀血质
定义：体内血液运行不畅，有瘀血内阻的体质状态。
特征：多为瘦人。面色晦暗，皮肤偏暗或色素沉着，易出现瘀斑，易患疼痛，口唇暗淡或紫。舌质暗，有瘀点或瘀斑。性格易烦躁，健忘。
发病倾向：易患出血、中风、胸痹、痛经。

4.8 气郁质
定义：长期情志不畅、气机郁滞形成的体质状态。
特征：多为瘦人。性格内向不稳定，忧郁脆弱，敏感多疑，胸胁胀满，善太息，睡眠较差，食欲减退。舌淡红，苔薄白，脉弦细。
发病倾向：易患郁症、脏躁、梅核气、乳腺增生。

4.9 特禀质
定义：由于先天性和遗传因素造成的体质缺陷，包括先天性、遗传性疾病和过敏体质等。
特征：无特殊，或有畸形。过敏体质者易过敏反应（食物、花粉、药物等），鼻塞喷嚏流涕。
`;

// ==========================================
// API Routes
// ==========================================

app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "邮箱和密码不能为空" });
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const stmt = db.prepare("INSERT INTO users (email, password) VALUES (?, ?)");
    const result = stmt.run(email, hashedPassword);
    req.session.userId = result.lastInsertRowid as number;
    res.json({ success: true, userId: req.session.userId });
  } catch (error: any) {
    if (error.message.includes("UNIQUE constraint failed")) res.status(400).json({ error: "该邮箱已被注册" });
    else res.status(500).json({ error: "注册失败" });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const user: any = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (user && await bcrypt.compare(password, user.password)) {
    req.session.userId = user.id;
    res.json({ success: true, email: user.email });
  } else res.status(401).json({ error: "邮箱或密码错误" });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get("/api/me", (req, res) => {
  if (req.session.userId) {
    const user: any = db.prepare("SELECT email FROM users WHERE id = ?").get(req.session.userId);
    res.json({ loggedIn: true, email: user?.email });
  } else res.json({ loggedIn: false });
});

app.get("/api/history", isAuthenticated, (req, res) => {
  const history = db.prepare("SELECT * FROM history WHERE user_id = ? ORDER BY created_at DESC").all(req.session.userId);
  res.json(history.map((h: any) => ({ ...h, wylq_data: JSON.parse(h.wylq_data) })));
});

app.post("/api/calculate", (req, res) => {
  try {
    const { year, month, day } = req.body;
    if (!year || !month || !day) return res.status(400).json({ error: "请求参数不完整" });
    const birthDate = new Date(year, month - 1, day, 12, 0);
    const calc = new WuYunLiuQi(birthDate);
    const engine = new AHIEngine(birthDate);
    const yf = calc.getYearFortune();
    const ce = calc.getClimaticEffect();
    if (!ce) return res.status(500).json({ error: "无法计算气候效应" });
    const fortune = calc.getCurrentFortune();
    const qi = calc.getCurrentQi();
    const wylq_summary = {
      ganzhi: `${calc.stem.char}${calc.branch.char}年`,
      suiyun: `${yf.description} (${yf.element})`,
      sitian: ce.celestial.display_name,
      zaiquan: ce.terrestrial.display_name,
      daily_fortune: `第 ${fortune.step_index} 运 | 主: ${fortune.host} | 客: ${fortune.guest}`,
      daily_qi: `第 ${qi.step_index} 气 | 主: ${qi.host} | 客: ${qi.guest}`
    };
    const kline_data = [];
    let currentHealth = engine.baseScore;
    for (let age = 1; age <= 60; age++) {
      const calcYear = year + age - 1;
      const impact = engine.calculateYearAhi(calcYear);
      let lifecycleDrift = age <= 20 ? 0.6 : (age <= 40 ? 0.0 : (age <= 50 ? -0.8 : -1.2));
      const dynamicBase = (currentHealth * 0.6) + (engine.baseScore * 0.4);
      let closeScore = Math.max(0, Math.min(100, dynamicBase + impact + lifecycleDrift));
      kline_data.push({ age, open: parseFloat(currentHealth.toFixed(2)), close: parseFloat(closeScore.toFixed(2)) });
      currentHealth = closeScore;
    }
    let historyId = null;
    if (req.session.userId) {
      const birthDateStr = `${year}-${month}-${day}`;
      const wylqDataStr = JSON.stringify({ wylq_summary, kline_data });
      const result = db.prepare("INSERT INTO history (user_id, birth_date, wylq_data, base_score) VALUES (?, ?, ?, ?)")
        .run(req.session.userId, birthDateStr, wylqDataStr, engine.baseScore);
      historyId = result.lastInsertRowid;
    }
    res.json({ wylq_summary, kline_data, base_score: engine.baseScore, historyId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/insight/start", (req, res) => {
  const { age, gender } = req.body;
  if (!age || !gender) return res.status(400).json({ error: "请提供年龄段和性别" });
  const systemPrompt = `你是一位中医专家，同时是大型医院的中医主治医生，你正在门诊进行坐诊。下面的资料是最新的关于中医体质学说的论文。
${CONSTITUTION_KNOWLEDGE_BASE}
首先请你阅读该论文，并对其进行理解吸收。随后请你根据该论文中的内容，经过十轮与用户的问诊，旨在通过这些问诊对所有人群进行体质分类。
请注意你的问诊应当围绕下方论文中的方向进行，围绕论文中的体质判断方法，准确的判断出该用户的体质。

要求：
1. 由你发起提问。
2. 提问必须简洁明了，直击重点，不要有冗长的开场白或过多的感性描述。每轮只提 1-2 个核心问题。
3. 当你经过十轮提问后，需要确定用户的表述的情况和九种体质各有多少相关度，严格按总分100分，各种体质具体内容计算得出分数，并且严格按照下面这样的方式给出结论：
<用户体质：阴虚质80分，平和质10分，气郁质5分，阳虚质5分，痰湿质0分，血瘀质0分，湿热质0分，气虚质0分，特禀质0分>
4. 接下来第一条消息，你应该向用户问好，你已经得到了ta的年龄段为${age}，性别为${gender}，这次前往门诊是想要进行体质辨识，请根据这些信息开始问诊。
5. 在问诊结束后，输出包含结论的回话，并且结合论文与用户回答，向用户介绍其得分不为0分的体质，并重点介绍高分体质及其问诊结果中的对应症状。
6. 严禁输出任何关于“辨证施治”、“食疗建议”、“中药调理”或“寻求医生建议”的免责声明或后续引导文字。
7. 专注于您的角色，当用户询问与本次问诊无关的话题时，您需要将话题引到问诊本身，并同时拒绝回答无关问题。`;
  req.session.insightMessages = [{ role: "system", content: systemPrompt }];
  req.session.save((err) => {
    if (err) return res.status(500).json({ error: "会话保存失败" });
    res.json({ success: true });
  });
});

app.post("/api/insight/chat", async (req, res) => {
  const { message, history, age, gender } = req.body;
  if (!message) return res.status(400).json({ error: "消息不能为空" });
  try {
    const apiKey = process.env.DASHSCOPE_API_KEY || process.env.API_KEY;
    if (!apiKey) return res.status(500).json({ error: "服务器未配置 API Key" });
    let messages = [];
    if ((history && Array.isArray(history)) || (age && gender)) {
      const safeHistory = Array.isArray(history) ? history : [];
      const systemPrompt = `你是一位中医专家，同时是大型医院的中医主治医生，你正在门诊进行坐诊。下面的资料是最新的关于中医体质学说的论文。
${CONSTITUTION_KNOWLEDGE_BASE}
首先请你阅读该论文，并对其进行理解吸收。随后请你根据该论文中的内容，经过十轮与用户的问诊，旨在通过这些问诊对所有人群进行体质分类。
请注意你的问诊应当围绕下方论文中的方向进行，围绕论文中的体质判断方法，准确的判断出该用户的体质。

要求：
1. 由你发起提问。
2. 提问必须简洁明了，直击重点，不要有冗长的开场白或过多的感性描述。每轮只提 1-2 个核心问题。
3. 当你经过十轮提问后，需要确定用户的表述的情况和九种体质各有多少相关度，严格按总分100分，各种体质具体内容计算得出分数，并且严格按照下面按照下面这样的方式给出结论：
<用户体质：阴虚质80分，平和质10分，气郁质5分，阳虚质5分，痰湿质0分，血瘀质0分，湿热质0分，气虚质0分，特禀质0分>
4. 接下来第一条消息，你应该向用户问好，你已经得到了ta的年龄段为${age || '未知'}，性别为${gender || '未知'}，这次前往门诊是想要进行体质辨识，请根据这些信息开始问诊。
5. 在问诊结束后，输出包含结论的回话，并且结合论文与用户回答，向用户介绍其得分不为0分的体质，并重点介绍高分体质及其问诊结果中的对应症状。
6. 严禁输出任何关于“辨证施治”、“食疗建议”、“中药调理”或“寻求医生建议”的免责声明或后续引导文字。
7. 专注于您的角色，当用户询问与本次问诊无关的话题时，您需要将话题引到问诊本身，并同时拒绝回答无关问题。`;
      messages = [{ role: "system", content: systemPrompt }, ...safeHistory.map((m: any) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })), { role: "user", content: message }];
    } else if (req.session.insightMessages) {
      req.session.insightMessages.push({ role: "user", content: message });
      messages = req.session.insightMessages.map(m => ({ role: m.role === "system" ? "system" : (m.role === "user" ? "user" : "assistant"), content: m.content }));
    } else return res.status(400).json({ error: "会话已过期" });

    const response = await axios.post("https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation", {
      model: "qwen-turbo",
      input: { messages: messages },
      parameters: { result_format: "message" }
    }, { headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" } });

    if (response.data?.output?.choices) {
      const reply = response.data.output.choices[0].message.content;
      if (req.session.insightMessages) {
        req.session.insightMessages.push({ role: "assistant", content: reply });
        req.session.save();
      }
      res.json({ reply });
    } else res.status(500).json({ error: "AI 响应异常" });
  } catch (error: any) {
    res.status(500).json({ error: "交流中断" });
  }
});

app.post("/api/generate-report", async (req, res) => {
  try {
    const { wylq_summary, kline_data, historyId } = req.body;
    const apiKey = process.env.DASHSCOPE_API_KEY || process.env.API_KEY;
    if (!apiKey) return res.status(500).json({ error: "服务器未配置 API Key" });
    const klineText = kline_data.map((d: any) => `${d.age}岁:${Math.round(d.close)}分`).join(", ");
    const prompt = `你是一位精通《黄帝内经》和《三因司天方》的顶级中医专家。请为用户撰写一份【全生命周期健康洞察报告】。
数据：${JSON.stringify(wylq_summary)}
K线：${klineText}
要求：1. 严禁Markdown加粗或列表。2. 严禁推荐具体方药。3. 严禁提及AI名称。4. 纯文本输出。`;
    const response = await axios.post("https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation", {
      model: "qwen-turbo",
      input: { prompt: prompt },
      parameters: { result_format: "message" }
    }, { headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" } });
    if (response.data?.output?.choices) {
      const report = response.data.output.choices[0].message.content;
      if (req.session.userId && historyId) db.prepare("UPDATE history SET report_text = ? WHERE id = ? AND user_id = ?").run(report, historyId, req.session.userId);
      res.json({ report });
    } else res.status(500).json({ error: "AI 响应异常" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/generate-health-report", async (req, res) => {
  try {
    const { astrolabeData } = req.body;
    const apiKey = process.env.DASHSCOPE_API_KEY || process.env.API_KEY;
    if (!apiKey) return res.status(500).json({ error: "服务器未配置 API Key" });

    const systemInstruction = `你现在是紫微斗数健康领域的大师级解读专家，同时精通中医经络学、五行体质学、子午流注与现代预防医学。你从业35年以上，擅长将紫微斗数星盘转化为精准、优雅、可落地的个人健康风险报告。
你的分析必须严格遵循以下四大模块顺序，缺一不可。报告风格专业、温暖、赋能，从不恐吓用户，而是用“预警 + 赋能”的方式，帮助用户提前改变生活方式化解隐患。

模块一：十二宫位与人体经脉图（小白第一步 · 最直观致命伤痛定位）
首先忽略传统“疾厄宫”，直接扫视星盘的12个固定地支宫位（子、丑、寅、卯、辰、巳、午、未、申、酉、戌、亥）。哪个宫位里的煞星（擎羊、陀罗、火星、铃星、地空、地劫）+ 化忌数量最多，那个地支对应的经脉就是用户一生的“死穴”。

宫位地支对应经脉核心健康靶点与致命伤痛风险
寅：左下肺经。先天肺弱、慢性呼吸道疾病、严重气喘、顽固性皮肤病
卯：正左大肠经。肠道吸收极差、慢性便秘/腹泻、大肠息肉/肿瘤倾向
辰：左上胃经。胃溃疡、慢性胃炎、胃下垂、严重消化不良
巳：左顶脾经。脾虚湿重、代谢综合征、易发胖、肌肉萎缩
午：正顶心经。先天性心脏问题、心律不齐、突发心梗高危
未：右顶小肠经。营养吸收障碍、肩颈僵硬、免疫力低下
申：右上膀胱经。慢性背痛、风寒易入侵、泌尿系统反复感染
酉：正右肾经。先天肾气不足、骨质疏松、生殖系统疾病、严重腰痛
戌：右下心包经。后天性心脏病、心绞痛、冠心病、血管堵塞
亥：正底三焦经。内分泌失调、淋巴系统问题、全身水肿
子：底左胆经。胆结石、偏头痛、顽固性失眠、肝胆互为表里病变
丑：底右肝经。肝气郁结、重度抑郁、脂肪肝、肝硬化/肝癌高危

额外铁律：午宫主先天心脏，戌宫主后天心脏。午宫煞星多 = 先天心脏缺陷；戌宫煞星多 = 后天熬夜、压力、饮食导致的心脏问题。

模块二：疾厄宫星曜体质字典（体质根源诊断）
看完十二地支后，再看疾厄宫落入的陷落的主星（庙、旺、得、利、平的主星不需要参考），这是用户日常体质的“底盘”。
木系（神经·肝胆）：天机（思虑过重）、贪狼（欲望强）
火系（心血·头部）：太阳（心血管负荷大）、廉贞（最危险星，肿瘤倾向）
土系（脾胃·消化）：紫微/天府（中年易富贵病）、天梁（医药星，带病延年）
金系（肺·骨骼）：武曲（肺弱+骨骼脆弱）、七杀（血光星，手术外伤）
水系（肾·内分泌）：天同（水肿腰痛）、太阴/破军（内分泌失调）、巨门（暗疾）

模块三：动态扫雷 —— 疾病何时引爆
1. 大限排雷（10年周期）：当前大限宫位若出现“大限化忌”飞入先天疾厄宫或飞入模块一中煞星最多的宫位 → 这10年是健康低谷期。
2. 流年排雷（当年风险）：流年疾厄宫或流年命宫出现擎羊+陀罗+化忌 → 当年高危。
3. 福德宫心理预警：流年福德宫化忌 → 心理崩溃会直接导致躯体疾病爆发。

模块四：小白实操3步走
1. 找死穴：扫十二地支宫位，锁定煞星最多的宫位。
2. 看底盘：命宫强 + 疾厄宫弱 → 大难不死；命宫弱 + 疾厄宫化忌 → 立即开始养生。
3. 查流年：每年年初必须看流年命宫与疾厄宫是否撞化忌。

报告输出要求：
标题：【紫微斗数健康大师报告】—— {姓名} 一生健康风险全解析
结构：模块一 → 模块二 → 模块三 → 模块四 → 个性化预防方案
语言：专业、温暖、赋能，结尾加“命由天定，运由己造”励志语
免责声明：本报告仅为传统命理健康趋势预警，非西医诊断，请结合现代医学检查

注意：
1. 报告布局要专业，严禁使用大量的项目符号（Bullet Points）。
2. 采用“报告文学”或“专家诊断书”风格，多用叙述性段落，体现大师解读的深度与连贯性。
3. 语气要像一位面对面坐诊的老中医，既有权威感又不失人文关怀。
4. 避免使用“首先”、“其次”、“最后”等明显的AI常用连接词，转而使用更自然的逻辑衔接。
5. 重点内容可以用加粗或引用块（Blockquote）来强调，但不要过度。`;

    const response = await axios.post("https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation", {
      model: "qwen-max",
      input: { 
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: `请根据以下紫微斗数排盘数据生成健康报告：\n${JSON.stringify(astrolabeData)}` }
        ] 
      },
      parameters: { result_format: "message" }
    }, { headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" } });

    if (response.data?.output?.choices) {
      res.json({ report: response.data.output.choices[0].message.content });
    } else {
      res.status(500).json({ error: "AI 响应异常" });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

  // Vite middleware for development
  let vite: any;
  if (process.env.NODE_ENV !== "production") {
    vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  const PORT = process.env.PORT || 3000;
  const server = app.listen(Number(PORT), "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
  if (vite) server.on('upgrade', (req, socket, head) => vite.ws.handleUpgrade(req, socket, head));
}

startServer();
