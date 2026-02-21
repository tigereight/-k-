import express from "express";
import { Solar, Lunar } from "lunar-javascript";
import path from "path";
import { fileURLToPath } from "url";

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
      score += 20;
    } else if (ElementOvercomes[hEl] === gEl) {
      score -= 20;
    } else if (ElementOvercomes[gEl] === hEl) {
      score -= 10;
    }

    if (this.birthGuestQi.display_name === QiType.MILD_YIN_FIRE.display_name && this.birthHostQi.display_name === QiType.WEAK_YANG_FIRE.display_name) {
      score += 15;
    } else if (this.birthGuestQi.display_name === QiType.WEAK_YANG_FIRE.display_name && this.birthHostQi.display_name === QiType.MILD_YIN_FIRE.display_name) {
      score -= 15;
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
      current_fortune: `第 ${fortune.step_index} 运 (主: ${fortune.host}, 客: ${fortune.guest})`,
      current_qi: `第 ${qi.step_index} 气 (主: ${qi.host}, 客: ${qi.guest})`
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

const PORT = 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
