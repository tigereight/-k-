import express from "express";
import { Solar, Lunar } from "lunar-javascript";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static("public"));

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
    return this.list()[(year - 4) % 10];
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
    return this.list()[(year - 4) % 12];
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
    const termMonths: Record<string, number> = {
      "小寒": 1, "大寒": 1, "立春": 2, "雨水": 2, "惊蛰": 3, "春分": 3,
      "清明": 4, "谷雨": 4, "立夏": 5, "小满": 5, "芒种": 6, "夏至": 6,
      "小暑": 7, "大暑": 7, "立秋": 8, "处暑": 8, "白露": 9, "秋分": 9,
      "寒露": 10, "霜降": 10, "立冬": 11, "小雪": 11, "大雪": 12, "冬至": 12
    };
    const m = termMonths[termName];
    if (!m) throw new Error(`未知的节气名称: ${termName}`);

    const testDays = [15, 5, 25];
    let jieqiObj: any = null;
    for (const d of testDays) {
      const lunar = Solar.fromYmd(year, m, d).getLunar();
      jieqiObj = lunar.getJieQiTable()[termName];
      if (jieqiObj) break;
    }

    if (!jieqiObj) throw new Error(`无法定位 ${year}年 的 ${termName} 节气时间`);
    
    return new Date(
      jieqiObj.getYear(), jieqiObj.getMonth() - 1, jieqiObj.getDay(),
      jieqiObj.getHour(), jieqiObj.getMinute(), jieqiObj.getSecond()
    );
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
    const currentYearDahan = AstronomyEngine.getExactJieqi(dateObj.getFullYear(), "大寒");
    if (this.targetDate < currentYearDahan) {
      this.wuyunYear = dateObj.getFullYear() - 1;
    } else {
      this.wuyunYear = dateObj.getFullYear();
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
    let score = 50;
    const hEl = this.birthHostQi.element;
    const gEl = this.birthGuestQi.element;

    if (ElementGeneration[gEl] === hEl || ElementGeneration[hEl] === gEl || gEl === hEl) {
      score += 10;
    } else if (ElementOvercomes[hEl] === gEl) {
      score -= 15;
    } else if (ElementOvercomes[gEl] === hEl) {
      score -= 10;
    }

    if (this.birthGuestQi.display_name === QiType.MILD_YIN_FIRE.display_name && this.birthHostQi.display_name === QiType.WEAK_YANG_FIRE.display_name) {
      score += 8;
    } else if (this.birthGuestQi.display_name === QiType.WEAK_YANG_FIRE.display_name && this.birthHostQi.display_name === QiType.MILD_YIN_FIRE.display_name) {
      score -= 8;
    }

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

    // A. 五运
    let suiYunPts = 0;
    if (cySuiYun === this.natalSuiYun) {
      suiYunPts += 25;
    } else if (ElementGeneration[cySuiYun] === this.natalSuiYun || ElementGeneration[this.natalSuiYun] === cySuiYun) {
      suiYunPts += 18;
    } else if (ElementOvercomes[cySuiYun] === this.natalSuiYun || ElementOvercomes[this.natalSuiYun] === cySuiYun) {
      suiYunPts -= 22;
    }

    if (cyAdequacy === Adequacy.EXCESS && ElementOvercomes[cySuiYun] === this.weakZang) {
      suiYunPts -= 15;
    }
    if (cyAdequacy === Adequacy.DEFICIENCY && ElementGeneration[cySuiYun] === this.strongZang) {
      suiYunPts += 10;
    }

    const guestYuns = flowYear.getGuestFortunes().map(f => f.element);
    let stepPtsSum = 0;
    for (const gy of guestYuns) {
      let s = 0;
      if (gy === this.birthHostYun) {
        s += 20;
      } else if (ElementGeneration[gy] === this.birthHostYun || ElementGeneration[gy] === this.weakZang) {
        s += 15;
      } else if (ElementOvercomes[gy] === this.birthHostYun || ElementOvercomes[gy] === this.weakZang) {
        s -= 25;
      }
      stepPtsSum += s;
    }
    const avgStepPts = stepPtsSum / 5;

    // B. 六气
    const bhPrefix = this.birthHostQi.display_name.substring(0, 2);
    const stPrefix = siTian.display_name.substring(0, 2);
    const zqPrefix = zaiQuan.display_name.substring(0, 2);

    let sqPts1 = 0;
    if (stPrefix === bhPrefix || zqPrefix === bhPrefix) {
      sqPts1 += 22;
    }
    if (ElementGeneration[siTian.element] === this.birthHostQi.element) {
      sqPts1 += 16;
    }
    if (ElementOvercomes[siTian.element] === this.birthHostQi.element || ElementOvercomes[siTian.element] === this.weakZang) {
      sqPts1 -= 28;
    }
    if (ElementOvercomes[zaiQuan.element] === this.birthHostQi.element || ElementOvercomes[zaiQuan.element] === this.weakZang) {
      sqPts1 -= 28;
    }

    let sqPts2 = 0;
    const natalYun = this.natalSuiYun;
    const cyBranchEl = flowYear.branch.element;

    if (ElementGeneration[siTian.element] === natalYun) {
      sqPts2 += 22;
    } else if (natalYun === cyBranchEl) {
      sqPts2 += 20;
    } else if (ElementGeneration[natalYun] === siTian.element) {
      sqPts2 -= 15;
    } else if (ElementOvercomes[natalYun] === siTian.element) {
      sqPts2 -= 20;
    } else if (ElementOvercomes[siTian.element] === natalYun) {
      sqPts2 -= 28;
    } else if (natalYun === siTian.element) {
      sqPts2 -= 12;
    }

    const weightedYun = (suiYunPts * 0.90) + (avgStepPts * 0.10);
    const weightedQi = (sqPts1 * 0.25) + (sqPts2 * 0.75);
    const totalRawCollision = (weightedYun * 0.30) + (weightedQi * 0.70);

    return totalRawCollision;
  }
}

// ==========================================
// API Routes
// ==========================================

app.post("/api/calculate", (req, res) => {
  try {
    const { year, month, day } = req.body;
    if (!year || !month || !day) {
      return res.status(400).json({ error: "Missing year, month, or day" });
    }

    const birthDate = new Date(year, month - 1, day, 12, 0);
    const calc = new WuYunLiuQi(birthDate);
    const engine = new AHIEngine(birthDate);

    // Summary
    const yf = calc.getYearFortune();
    const ce = calc.getClimaticEffect()!;
    const fortune = calc.getCurrentFortune();
    const qi = calc.getCurrentQi();

    const wylq_summary = {
      ganzhi: `${calc.stem.char}${calc.branch.char}年`,
      suiyun: `${yf.description} (${yf.element})`,
      sitian: ce.celestial.display_name,
      zaiquan: ce.terrestrial.display_name,
      fortune_step: fortune.step_index,
      fortune_host: fortune.host,
      fortune_guest: fortune.guest,
      qi_step: qi.step_index,
      qi_host: qi.host,
      qi_guest: qi.guest
    };

    // K-line data
    const kline_data = [];
    let currentHealth = engine.baseScore;

    for (let age = 1; age <= 60; age++) {
      const calcYear = year + age - 1;
      const impact = engine.calculateYearAhi(calcYear);

      let lifecycleDrift = 0;
      if (age >= 1 && age <= 20) lifecycleDrift = 0.8;
      else if (age >= 21 && age <= 40) lifecycleDrift = 0.0;
      else if (age >= 41 && age <= 50) lifecycleDrift = -0.8;
      else lifecycleDrift = -1.5;

      const dynamicBase = (currentHealth * 0.6) + (engine.baseScore * 0.4);
      let closeScore = dynamicBase + impact + lifecycleDrift;
      closeScore = Math.max(0, Math.min(100, closeScore));

      kline_data.push({
        age,
        open: parseFloat(currentHealth.toFixed(2)),
        close: parseFloat(closeScore.toFixed(2))
      });

      currentHealth = closeScore;
    }

    res.json({ wylq_summary, kline_data, base_score: engine.baseScore });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

const SANYIN_KNOWLEDGE = `
【一、 健康指数(AHI)算法与加权规则解析】
告诉用户，其0-60岁的健康K线图并非随机生成，而是基于以下严密的中医运气学数学模型计算得出：

1. 个人基准分 (Base Score)：
   - 基础分为50分。
   - 根据出生日的“主客加临”吉凶决定先天底子：主客相生或同气 +10分；主气克客气 -15分；客气克主气 -10分。
   - 特殊加临：少阴君火为客气，少阳相火为主气 +8分；少阳相火为客气，少阴君火为主气 -8分。

2. 年度流年碰撞分 (Impact Score)：
   - **五运碰撞 (占30%)**：
     - 岁运总碰撞 (90%)：流年岁运与先天大运同气+25分；相生+18分；相克-22分。若流年太过且克制用户弱脏，额外-15分；流年不及但生助用户强脏，反弹+10分。
     - 五运步匹配 (10%)：计算流年5步客运与出生主运的生克平均分。
   - **六气碰撞 (占70%)**：
     - 司天在泉总碰撞 (25%)：流年天地之气与出生主气三阴三阳相同+22分；天气生人+16分。司天或在泉克制出生主气或弱脏，各-28分。
     - 司天主运格局 (75%)：平气之年+22分；岁会之年+20分；逆气之年（运生气）-15分；不和之年（运克气）-20分；天刑之年（气克运，最凶险）-28分；同化之年（天符）-12分。

3. 动态生命周期与健康惯性：
   - 当年最终收盘价 = (去年健康分*0.6 + 先天基准分*0.4) + 流年碰撞净分 + 年龄漂移值。
   - 年龄漂移值遵循《黄帝内经》生长壮老已规律：1-20岁(生长期)+0.8分；21-40岁(鼎盛期)+0.0分；41-50岁(衰退初期)-0.8分；51-60岁(衰老期)-1.5分。
   - 分数被严格限制在0-100分之间。

【二、《三因司天方》核心理论知识库（严禁向用户推荐方药名称）】
（此处省略部分重复文本以节省空间，但在实际代码中应包含完整内容）
《运气总说》引张介宾语，强调运气非“无益于医”，而是“岁气之流行，即安危之关系”。岁运有太过、不及，六气有胜复、逆从，失中和则致病。民病因“众人而患同病”，非偶然，乃运气使然。
《司天方原叙》云：“五运六气，乃天地阴阳运行升降之常道也。五运流行，有太过不及之异；六气升降，有逆从胜复之差。凡不合于政令德化者，则为变眚，皆能病人……前哲知天地有余不足，违戾之气，还以天道所生德味而平治之。”
运有代谢，气有应候；太过泻之，不及补之；本气正方治之，客气加临则分病证加减。缪问补充：“人生于地，气应于天……衰则所胜妄行，己虚而彼实；盛则薄所不胜，己实而虚……无盛盛，无虚虚……有者求之，无者求之。盛者责之，虚者责之。”
（包含十天干、十二地支对应病机...）
`;

app.post("/api/generate-report", async (req, res) => {
  try {
    const { wylq_summary, kline_data } = req.body;
    const apiKey = process.env.API_KEY;

    const klineText = kline_data.map((d: any) => `${d.age}岁:${Math.round(d.close)}分`).join(", ");
    
    const prompt = `
你是一位精通《黄帝内经》和《三因司天方》的顶级中医大夫，同时也是一位深谙现代生活美学与身心管理的私人健康顾问。
请为用户撰写一份【深度融合】古法智慧与现代审美的【全生命周期健康洞察报告】。

${SANYIN_KNOWLEDGE}

【用户先天体质与当日气象数据】：
${JSON.stringify(wylq_summary, null, 2)}

【用户 0-60岁 年度健康指数(AHI)收盘价变化 (满分100，70分为基准分)】：
${klineText}

请按照以下模块撰写，要求将专业术语自然融入现代语境，不要生硬拆分：

【先天体质解码】：
将运气学定义的体质（如岁运、司天）转化为一种“生命底色”的描述。比如将“木气偏胜”描述为“天生具备极强的生发力与探索欲，但也容易像春风般急躁，导致身体的‘电路系统’（肝胆）在高负载下产生燥热”。描述具体的身体反馈，如：容易熬夜后恢复慢、换季时皮肤或情绪的微妙波动等，让用户感到被精准“读心”。

【K线原理解密】：
用一种“宇宙共振”的视角，解释 AHI 指数如何捕捉天地节律对个体能量场的扰动。将人体类比为一个精密且感性的“生物接收器”，让用户理解健康波动是生命与自然环境之间的一场持续对话，而非冰冷的故障。

【人生健康大势】：
结合数据曲线，以“生命周期管理”的口吻，指出那些值得庆祝的“能量巅峰期”与需要静心调养的“系统维护期”。描述低分年份时，要像提醒老朋友一样，指出可能出现的“身心低电量”状态，并赋予其积极的意义（如：这是身体在提醒你进行深度的自我迭代）。

【定制养生锦囊】：
给出极具生活美感的建议。不要说“禁食生冷”，要说“给肠胃一场温暖的治愈仪式”；不要说“早睡早起”，要说“顺应自然的昼夜韵律，在子午时刻完成能量的闭环”。建议要具体、现代且有趣，比如针对其体质推荐某种特定的“情绪断舍离”方式或“节气冥想”。

【极其重要的约束】：
1. 严禁使用 Markdown 的加粗符号（**）、列表符号（- 或 *）或任何代码块。
2. 严禁推荐具体方药名称。
3. 语言风格：专业、考究、灵动。要有一种“老中医在私人会所与你品茶闲谈”的尊贵感与亲和力。
4. 直接输出纯文本。
`;

    const response = await axios.post(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
      {
        model: "qwen-turbo",
        input: { prompt: prompt },
        parameters: { result_format: "message" }
      },
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (response.data && response.data.output && response.data.output.choices) {
      res.json({ report: response.data.output.choices[0].message.content });
    } else {
      res.status(500).json({ error: "AI 响应异常" });
    }
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
