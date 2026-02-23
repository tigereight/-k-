import os
import datetime
from enum import Enum
from lunar_python import Solar
import dashscope
from dashscope import Generation
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)

# ==========================================
# 1. 基础定义与枚举 (保持原汁原味的算法)
# ==========================================
class Element(Enum):
    WOOD = "木"; FIRE = "火"; EARTH = "土"; METAL = "金"; WATER = "水"
    def generate(self):
        mapping = {Element.WOOD: Element.FIRE, Element.FIRE: Element.EARTH, Element.EARTH: Element.METAL, Element.METAL: Element.WATER, Element.WATER: Element.WOOD}
        return mapping[self]
    def overcomes(self):
        mapping = {Element.WOOD: Element.EARTH, Element.EARTH: Element.WATER, Element.WATER: Element.FIRE, Element.FIRE: Element.METAL, Element.METAL: Element.WOOD}
        return mapping[self]
    def overcomer(self):
        mapping = {Element.WOOD: Element.METAL, Element.METAL: Element.FIRE, Element.FIRE: Element.WATER, Element.WATER: Element.EARTH, Element.EARTH: Element.WOOD}
        return mapping[self]

class Adequacy(Enum):
    EXCESS = "太过"; DEFICIENCY = "不及"
    def opposite(self): return Adequacy.DEFICIENCY if self == Adequacy.EXCESS else Adequacy.EXCESS

class HeavenlyStem(Enum):
    JIA = (0, "甲", Element.EARTH, Adequacy.EXCESS)
    YI = (1, "乙", Element.METAL, Adequacy.DEFICIENCY)
    BING = (2, "丙", Element.WATER, Adequacy.EXCESS)
    DING = (3, "丁", Element.WOOD, Adequacy.DEFICIENCY)
    WU = (4, "戊", Element.FIRE, Adequacy.EXCESS)
    JI = (5, "己", Element.EARTH, Adequacy.DEFICIENCY)
    GENG = (6, "庚", Element.METAL, Adequacy.EXCESS)
    XIN = (7, "辛", Element.WATER, Adequacy.DEFICIENCY)
    REN = (8, "壬", Element.WOOD, Adequacy.EXCESS)
    GUI = (9, "癸", Element.FIRE, Adequacy.DEFICIENCY)
    def __init__(self, index, char, element, adequacy):
        self.index = index; self.char = char; self.yun_element = element; self.adequacy = adequacy
    @staticmethod
    def from_year(year): return list(HeavenlyStem)[(year - 4) % 10]

class EarthlyBranch(Enum):
    ZI = (0, "子", Element.WATER); CHOU = (1, "丑", Element.EARTH); YIN = (2, "寅", Element.WOOD)
    MAO = (3, "卯", Element.WOOD); CHEN = (4, "辰", Element.EARTH); SI = (5, "巳", Element.FIRE)
    WU = (6, "午", Element.FIRE); WEI = (7, "未", Element.EARTH); SHEN = (8, "申", Element.METAL)
    YOU = (9, "酉", Element.METAL); XU = (10, "戌", Element.EARTH); HAI = (11, "亥", Element.WATER)
    def __init__(self, index, char, element): self.index = index; self.char = char; self.element = element
    @staticmethod
    def from_year(year): return list(EarthlyBranch)[(year - 4) % 12]

class QiType(Enum):
    WEAK_YIN_WOOD = ("厥阴风木", "风", Element.WOOD); MILD_YIN_FIRE = ("少阴君火", "热", Element.FIRE)
    WEAK_YANG_FIRE = ("少阳相火", "火", Element.FIRE); DOMINANT_YIN_EARTH = ("太阴湿土", "湿", Element.EARTH)
    MILD_YANG_METAL = ("阳明燥金", "燥", Element.METAL); DOMINANT_YANG_WATER = ("太阳寒水", "寒", Element.WATER)
    def __init__(self, name, factor, element): self.display_name = name; self.factor = factor; self.element = element
    def previous(self):
        order = list(QiType); idx = order.index(self)
        return order[idx - 1]

class AstronomyEngine:
    @staticmethod
    def get_exact_jieqi(year: int, term_name: str) -> datetime.datetime:
        term_months = {"小寒": 1, "大寒": 1, "立春": 2, "雨水": 2, "惊蛰": 3, "春分": 3, "清明": 4, "谷雨": 4, "立夏": 5, "小满": 5, "芒种": 6, "夏至": 6, "小暑": 7, "大暑": 7, "立秋": 8, "处暑": 8, "白露": 9, "秋分": 9, "寒露": 10, "霜降": 10, "立冬": 11, "小雪": 11, "大雪": 12, "冬至": 12}
        m = term_months.get(term_name)
        if not m: raise ValueError(f"未知的节气: {term_name}")
        for d in [15, 5, 25]:
            jieqi_obj = Solar.fromYmd(year, m, d).getLunar().getJieQiTable().get(term_name)
            if jieqi_obj is not None: break
        return datetime.datetime(jieqi_obj.getYear(), jieqi_obj.getMonth(), jieqi_obj.getDay(), jieqi_obj.getHour(), jieqi_obj.getMinute(), jieqi_obj.getSecond())

class WuYunLiuQi:
    def __init__(self, date_obj: datetime.datetime):
        self.target_date = date_obj
        current_year_dahan = AstronomyEngine.get_exact_jieqi(date_obj.year, "大寒")
        self.wuyun_year = date_obj.year - 1 if self.target_date < current_year_dahan else date_obj.year
        self.stem = HeavenlyStem.from_year(self.wuyun_year)
        self.branch = EarthlyBranch.from_year(self.wuyun_year)
    def get_year_fortune(self): return {"element": self.stem.yun_element.value, "adequacy": self.stem.adequacy.value, "description": f"{self.stem.yun_element.value}运{self.stem.adequacy.value}"}
    def get_guest_fortunes(self):
        fortunes = []; curr_el = self.stem.yun_element; curr_ad = self.stem.adequacy
        for i in range(5):
            fortunes.append({"step": i + 1, "element": curr_el, "adequacy": curr_ad})
            curr_el = curr_el.generate(); curr_ad = curr_ad.opposite()
        return fortunes
    def get_host_fortunes(self): return [Element.WOOD, Element.FIRE, Element.EARTH, Element.METAL, Element.WATER]
    def get_climatic_effect(self):
        mapping = {
            (EarthlyBranch.ZI, EarthlyBranch.WU): (QiType.MILD_YIN_FIRE, QiType.MILD_YANG_METAL),
            (EarthlyBranch.CHOU, EarthlyBranch.WEI): (QiType.DOMINANT_YIN_EARTH, QiType.DOMINANT_YANG_WATER),
            (EarthlyBranch.YIN, EarthlyBranch.SHEN): (QiType.WEAK_YANG_FIRE, QiType.WEAK_YIN_WOOD),
            (EarthlyBranch.MAO, EarthlyBranch.YOU): (QiType.MILD_YANG_METAL, QiType.MILD_YIN_FIRE),
            (EarthlyBranch.CHEN, EarthlyBranch.XU): (QiType.DOMINANT_YANG_WATER, QiType.DOMINANT_YIN_EARTH),
            (EarthlyBranch.SI, EarthlyBranch.HAI): (QiType.WEAK_YIN_WOOD, QiType.WEAK_YANG_FIRE),
        }
        for b, eff in mapping.items():
            if self.branch in b: return {"celestial": eff[0], "terrestrial": eff[1]}
    def get_guest_qi_sequence(self):
        eff = self.get_climatic_effect(); st = eff["celestial"]; zq = eff["terrestrial"]
        return [st.previous().previous(), st.previous(), st, zq.previous().previous(), zq.previous(), zq]
    def get_current_fortune_enums(self):
        term_offsets = [("大寒", 0), ("春分", 13), ("芒种", 10), ("处暑", 7), ("立冬", 4)]
        start_dates = [AstronomyEngine.get_exact_jieqi(self.wuyun_year, t) + datetime.timedelta(days=o) for t, o in term_offsets]
        start_dates.append(AstronomyEngine.get_exact_jieqi(self.wuyun_year + 1, "大寒"))
        step = next((i for i in range(5) if start_dates[i] <= self.target_date < start_dates[i + 1]), 4)
        return self.get_host_fortunes()[step], self.get_guest_fortunes()[step]["element"]
    def get_current_qi_enums(self):
        terms = ["大寒", "春分", "小满", "大暑", "秋分", "小雪", "大寒"]
        bounds = [AstronomyEngine.get_exact_jieqi(self.wuyun_year + (1 if i == 6 else 0), t) for i, t in enumerate(terms)]
        step = next((i for i in range(6) if bounds[i] <= self.target_date < bounds[i + 1]), 5)
        host_qis = [QiType.WEAK_YIN_WOOD, QiType.MILD_YIN_FIRE, QiType.WEAK_YANG_FIRE, QiType.DOMINANT_YIN_EARTH, QiType.MILD_YANG_METAL, QiType.DOMINANT_YANG_WATER]
        return host_qis[step], self.get_guest_qi_sequence()[step]
    def get_current_fortune(self):
        term_offsets = [("大寒", 0), ("春分", 13), ("芒种", 10), ("处暑", 7), ("立冬", 4)]
        start_dates = [AstronomyEngine.get_exact_jieqi(self.wuyun_year, t) + datetime.timedelta(days=o) for t, o in term_offsets]
        start_dates.append(AstronomyEngine.get_exact_jieqi(self.wuyun_year + 1, "大寒"))
        step = next((i for i in range(5) if start_dates[i] <= self.target_date < start_dates[i + 1]), 4)
        h = self.get_host_fortunes()[step]; g = self.get_guest_fortunes()[step]
        return {"step_index": step + 1, "start_date": start_dates[step].strftime("%Y-%m-%d %H:%M:%S"), "host": h.value, "guest": f"{g['element'].value}{g['adequacy'].value}"}
    def get_current_qi(self):
        terms = ["大寒", "春分", "小满", "大暑", "秋分", "小雪", "大寒"]
        bounds = [AstronomyEngine.get_exact_jieqi(self.wuyun_year + (1 if i == 6 else 0), t) for i, t in enumerate(terms)]
        step = next((i for i in range(6) if bounds[i] <= self.target_date < bounds[i + 1]), 5)
        h = list(QiType)[step]; g = self.get_guest_qi_sequence()[step]
        return {"step_index": step + 1, "term_range": f"{bounds[step].strftime('%m-%d')} 至 {bounds[step + 1].strftime('%m-%d')}", "host": f"{h.display_name}", "guest": f"{g.display_name}"}

class AHIEngine:
    def __init__(self, birth_dt: datetime.datetime):
        self.birth_dt = birth_dt; self.natal_calc = WuYunLiuQi(birth_dt)  
        self.natal_sui_yun = self.natal_calc.stem.yun_element  
        self.natal_adequacy = self.natal_calc.stem.adequacy  
        if self.natal_adequacy == Adequacy.EXCESS:
            self.strong_zang = self.natal_sui_yun; self.weak_zang = self.natal_sui_yun.overcomes()
        else:
            self.weak_zang = self.natal_sui_yun; self.strong_zang = self.natal_sui_yun.overcomer()
        self.birth_host_yun, _ = self.natal_calc.get_current_fortune_enums()
        self.birth_host_qi, self.birth_guest_qi = self.natal_calc.get_current_qi_enums()
        self.base_score = self._calc_base_score()
    def _calc_base_score(self):
        score = 50; h_el = self.birth_host_qi.element; g_el = self.birth_guest_qi.element
        if g_el.generate() == h_el or h_el.generate() == g_el or g_el == h_el: score += 20
        elif h_el.overcomes() == g_el: score -= 20  
        elif g_el.overcomes() == h_el: score -= 10  
        if self.birth_guest_qi == QiType.MILD_YIN_FIRE and self.birth_host_qi == QiType.WEAK_YANG_FIRE: score += 15
        elif self.birth_guest_qi == QiType.WEAK_YANG_FIRE and self.birth_host_qi == QiType.MILD_YIN_FIRE: score -= 15
        return score
    def calculate_year_ahi(self, target_year: int) -> float:
        dt = AstronomyEngine.get_exact_jieqi(target_year, "大寒"); flow_year = WuYunLiuQi(dt)
        cy_sui_yun = flow_year.stem.yun_element; cy_adequacy = flow_year.stem.adequacy
        si_tian = flow_year.get_climatic_effect()["celestial"]; zai_quan = flow_year.get_climatic_effect()["terrestrial"]
        sui_yun_pts = 0
        if cy_sui_yun == self.natal_sui_yun: sui_yun_pts += 25  
        elif cy_sui_yun.generate() == self.natal_sui_yun or self.natal_sui_yun.generate() == cy_sui_yun: sui_yun_pts += 18  
        elif cy_sui_yun.overcomes() == self.natal_sui_yun or self.natal_sui_yun.overcomes() == cy_sui_yun: sui_yun_pts -= 22  
        if cy_adequacy == Adequacy.EXCESS and cy_sui_yun.overcomes() == self.weak_zang: sui_yun_pts -= 15  
        if cy_adequacy == Adequacy.DEFICIENCY and cy_sui_yun.generate() == self.strong_zang: sui_yun_pts += 10  
        guest_yuns = [f["element"] for f in flow_year.get_guest_fortunes()]; step_pts_list = []
        for gy in guest_yuns:
            s = 0
            if gy == self.birth_host_yun: s += 20  
            elif gy.generate() == self.birth_host_yun or gy.generate() == self.weak_zang: s += 15  
            elif gy.overcomes() == self.birth_host_yun or gy.overcomes() == self.weak_zang: s -= 25  
            step_pts_list.append(s)
        avg_step_pts = sum(step_pts_list) / 5  
        bh_prefix = self.birth_host_qi.display_name[:2]; st_prefix = si_tian.display_name[:2]; zq_prefix = zai_quan.display_name[:2]; sq_pts1 = 0
        if st_prefix == bh_prefix or zq_prefix == bh_prefix: sq_pts1 += 22  
        if si_tian.element.generate() == self.birth_host_qi.element: sq_pts1 += 16  
        if si_tian.element.overcomes() == self.birth_host_qi.element or si_tian.element.overcomes() == self.weak_zang: sq_pts1 -= 28  
        if zai_quan.element.overcomes() == self.birth_host_qi.element or zai_quan.element.overcomes() == self.weak_zang: sq_pts1 -= 28  
        sq_pts2 = 0; natal_yun = self.natal_sui_yun; cy_branch_el = flow_year.branch.element
        if si_tian.element.generate() == natal_yun: sq_pts2 += 22  
        elif natal_yun == cy_branch_el: sq_pts2 += 20  
        elif natal_yun.generate() == si_tian.element: sq_pts2 -= 15  
        elif natal_yun.overcomes() == si_tian.element: sq_pts2 -= 20  
        elif si_tian.element.overcomes() == natal_yun: sq_pts2 -= 28  
        elif natal_yun == si_tian.element: sq_pts2 -= 12  
        return ((sui_yun_pts * 0.90 + avg_step_pts * 0.10) * 0.30) + ((sq_pts1 * 0.25 + sq_pts2 * 0.75) * 0.70)

# ==========================================
# 2. 接入千问 AI 与 Flask 路由
# ==========================================
def generate_ai_report(wylq_text, kline_data):
    api_key = os.environ.get("DASHSCOPE_API_KEY")
    if not api_key:
        return "⚠️ 服务器未配置千问 API Key。请在 Render 后台的 Environment 中添加 DASHSCOPE_API_KEY。"
    dashscope.api_key = api_key
    
    prompt = f"""你是一位精通《黄帝内经》和《三因司天方》的中医大夫。请根据以下数据写一份通俗易懂的【个人一生健康指南】。
    
    【用户五运六气】：\n{wylq_text}
    【0-60岁健康指数K线】：\n{kline_data}
    
    要求分模块输出：
    1. 【先天体质解码】：解释哪个脏腑强弱。
    2. 【K线原理解密】：简要说明K线受流年运气和生命周期影响。
    3. 【人生健康大势】：挑出黄金十年和最需警惕的高危阶段。
    4. 【定制养生锦囊】：给出饮食和起居建议。
    绝对不要推荐具体中药方剂，纯文本排版输出，勿用代码块。"""
    
    try:
        response = Generation.call(model='qwen-turbo', prompt=prompt)
        if response.status_code == 200: return response.output.text
        else: return f"AI 生成失败：{response.message}"
    except Exception as e: return f"AI 接口异常：{str(e)}"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/calculate', methods=['POST'])
def calculate():
    try:
        data = request.json
        y, m, d = int(data['year']), int(data['month']), int(data['day'])
        target_date = datetime.datetime(y, m, d, 12, 0)
        calc = WuYunLiuQi(target_date)

        yf = calc.get_year_fortune(); ce = calc.get_climatic_effect()
        fortune = calc.get_current_fortune(); qi = calc.get_current_qi()
        
        # 【关键修复】: 在后端把包裹拆成文字，前端就不会报错了！
        wylq_data = {
            "gz": f"{calc.stem.char}{calc.branch.char}年",
            "suiyun": f"{yf['description']} ({yf['element']})",
            "sitian": ce['celestial'].display_name,
            "zaiquan": ce['terrestrial'].display_name,
            "wuyun": f"第 {fortune['step_index']} 运 | 主运: {fortune['host']} | 客运: {fortune['guest']}",
            "liuqi": f"第 {qi['step_index']} 气 | 主气: {qi['host']} | 客气: {qi['guest']}"
        }

        engine = AHIEngine(target_date)
        ages, opens, closes = list(range(1, 61)), [], []
        current_health = engine.base_score

        for age in ages:
            impact = engine.calculate_year_ahi(y + age - 1)
            drift = 0.8 if age <= 20 else 0.0 if age <= 40 else -0.8 if age <= 50 else -1.5
            close_score = max(0, min(100, (current_health * 0.6) + (engine.base_score * 0.4) + impact + drift))
            opens.append(current_health); closes.append(close_score)
            current_health = close_score 

        wylq_summary = f"出生: {y}年{m}月{d}日\n干支: {wylq_data['gz']}\n岁运: {wylq_data['suiyun']}\n司天: {wylq_data['sitian']}\n在泉: {wylq_data['zaiquan']}\n五运: {wylq_data['wuyun']}\n六气: {wylq_data['liuqi']}"
        kline_text = ", ".join([f"{a}岁:{int(c)}分" for a, c in zip(ages, closes)])
        ai_report = generate_ai_report(wylq_summary, kline_text)

        return jsonify({"status": "success", "wylq": wylq_data, "kline": {"ages": ages, "opens": opens, "closes": closes, "base_score": engine.base_score}, "ai_report": ai_report})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
