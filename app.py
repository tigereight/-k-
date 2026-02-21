import datetime
from flask import Flask, request, jsonify, render_template
from enum import Enum
from lunar_python import Solar
import os

app = Flask(__name__, static_folder='public', static_url_path='')

# ==========================================
# 1. 基础定义与枚举 (Basic Definitions)
# ==========================================

class Element(Enum):
    WOOD = "木"
    FIRE = "火"
    EARTH = "土"
    METAL = "金"
    WATER = "水"

    def generate(self):
        mapping = {
            Element.WOOD: Element.FIRE,
            Element.FIRE: Element.EARTH,
            Element.EARTH: Element.METAL,
            Element.METAL: Element.WATER,
            Element.WATER: Element.WOOD
        }
        return mapping[self]

    def overcomes(self):
        mapping = {
            Element.WOOD: Element.EARTH,
            Element.EARTH: Element.WATER,
            Element.WATER: Element.FIRE,
            Element.FIRE: Element.METAL,
            Element.METAL: Element.WOOD
        }
        return mapping[self]

    def overcomer(self):
        mapping = {
            Element.WOOD: Element.METAL,
            Element.METAL: Element.FIRE,
            Element.FIRE: Element.WATER,
            Element.WATER: Element.EARTH,
            Element.EARTH: Element.WOOD
        }
        return mapping[self]


class Adequacy(Enum):
    EXCESS = "太过"
    DEFICIENCY = "不及"

    def opposite(self):
        return Adequacy.DEFICIENCY if self == Adequacy.EXCESS else Adequacy.EXCESS


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
        self.index = index
        self.char = char
        self.yun_element = element
        self.adequacy = adequacy

    @staticmethod
    def from_year(year):
        return list(HeavenlyStem)[(year - 4) % 10]


class EarthlyBranch(Enum):
    ZI = (0, "子", Element.WATER)
    CHOU = (1, "丑", Element.EARTH)
    YIN = (2, "寅", Element.WOOD)
    MAO = (3, "卯", Element.WOOD)
    CHEN = (4, "辰", Element.EARTH)
    SI = (5, "巳", Element.FIRE)
    WU = (6, "午", Element.FIRE)
    WEI = (7, "未", Element.EARTH)
    SHEN = (8, "申", Element.METAL)
    YOU = (9, "酉", Element.METAL)
    XU = (10, "戌", Element.EARTH)
    HAI = (11, "亥", Element.WATER)

    def __init__(self, index, char, element):
        self.index = index
        self.char = char
        self.element = element

    @staticmethod
    def from_year(year):
        return list(EarthlyBranch)[(year - 4) % 12]


class QiType(Enum):
    WEAK_YIN_WOOD = ("厥阴风木", "风", Element.WOOD)
    MILD_YIN_FIRE = ("少阴君火", "热", Element.FIRE)
    WEAK_YANG_FIRE = ("少阳相火", "火", Element.FIRE)
    DOMINANT_YIN_EARTH = ("太阴湿土", "湿", Element.EARTH)
    MILD_YANG_METAL = ("阳明燥金", "燥", Element.METAL)
    DOMINANT_YANG_WATER = ("太阳寒水", "寒", Element.WATER)

    def __init__(self, name, factor, element):
        self.display_name = name
        self.factor = factor
        self.element = element

    def previous(self):
        order = list(QiType)
        idx = order.index(self)
        return order[idx - 1]


# ==========================================
# 2. 高精度天文历法引擎 (Astronomical Engine)
# ==========================================

class AstronomyEngine:
    @staticmethod
    def get_exact_jieqi(year: int, term_name: str) -> datetime.datetime:
        term_months = {
            "小寒": 1, "大寒": 1, "立春": 2, "雨水": 2, "惊蛰": 3, "春分": 3,
            "清明": 4, "谷雨": 4, "立夏": 5, "小满": 5, "芒种": 6, "夏至": 6,
            "小暑": 7, "大暑": 7, "立秋": 8, "处暑": 8, "白露": 9, "秋分": 9,
            "寒露": 10, "霜降": 10, "立冬": 11, "小雪": 11, "大雪": 12, "冬至": 12
        }
        m = term_months.get(term_name)
        if not m: raise ValueError(f"未知的节气名称: {term_name}")

        test_days = [15, 5, 25]
        jieqi_obj = None
        for d in test_days:
            lunar = Solar.fromYmd(year, m, d).getLunar()
            jieqi_obj = lunar.getJieQiTable().get(term_name)
            if jieqi_obj is not None: break

        if jieqi_obj is None: raise RuntimeError(f"无法定位 {year}年 的 {term_name} 节气时间")
        return datetime.datetime(
            jieqi_obj.getYear(), jieqi_obj.getMonth(), jieqi_obj.getDay(),
            jieqi_obj.getHour(), jieqi_obj.getMinute(), jieqi_obj.getSecond()
        )


# ==========================================
# 3. 五运六气核心逻辑 (WuYunLiuQi Engine)
# ==========================================

class WuYunLiuQi:
    def __init__(self, date_obj: datetime.datetime):
        self.target_date = date_obj
        current_year_dahan = AstronomyEngine.get_exact_jieqi(date_obj.year, "大寒")
        if self.target_date < current_year_dahan:
            self.wuyun_year = date_obj.year - 1
        else:
            self.wuyun_year = date_obj.year

        self.stem = HeavenlyStem.from_year(self.wuyun_year)
        self.branch = EarthlyBranch.from_year(self.wuyun_year)

    def get_year_fortune(self):
        return {
            "element": self.stem.yun_element.value,
            "adequacy": self.stem.adequacy.value,
            "description": f"{self.stem.yun_element.value}运{self.stem.adequacy.value}"
        }

    def get_guest_fortunes(self):
        fortunes = []
        current_element = self.stem.yun_element
        current_adequacy = self.stem.adequacy
        for i in range(5):
            fortunes.append({
                "step": i + 1, "element": current_element, "adequacy": current_adequacy
            })
            current_element = current_element.generate()
            current_adequacy = current_adequacy.opposite()
        return fortunes

    def get_host_fortunes(self):
        return [Element.WOOD, Element.FIRE, Element.EARTH, Element.METAL, Element.WATER]

    def get_climatic_effect(self):
        mapping = {
            (EarthlyBranch.ZI, EarthlyBranch.WU): (QiType.MILD_YIN_FIRE, QiType.MILD_YANG_METAL),
            (EarthlyBranch.CHOU, EarthlyBranch.WEI): (QiType.DOMINANT_YIN_EARTH, QiType.DOMINANT_YANG_WATER),
            (EarthlyBranch.YIN, EarthlyBranch.SHEN): (QiType.WEAK_YANG_FIRE, QiType.WEAK_YIN_WOOD),
            (EarthlyBranch.MAO, EarthlyBranch.YOU): (QiType.MILD_YANG_METAL, QiType.MILD_YIN_FIRE),
            (EarthlyBranch.CHEN, EarthlyBranch.XU): (QiType.DOMINANT_YANG_WATER, QiType.DOMINANT_YIN_EARTH),
            (EarthlyBranch.SI, EarthlyBranch.HAI): (QiType.WEAK_YIN_WOOD, QiType.WEAK_YANG_FIRE),
        }
        for branches, effects in mapping.items():
            if self.branch in branches:
                return {"celestial": effects[0], "terrestrial": effects[1]}

    def get_guest_qi_sequence(self):
        effect = self.get_climatic_effect()
        st, zq = effect["celestial"], effect["terrestrial"]
        return [st.previous().previous(), st.previous(), st, zq.previous().previous(), zq.previous(), zq]

    def get_current_fortune_enums(self):
        term_offsets = [("大寒", 0), ("春分", 13), ("芒种", 10), ("处暑", 7), ("立冬", 4)]
        start_dates = [AstronomyEngine.get_exact_jieqi(self.wuyun_year, term) + datetime.timedelta(days=offset) for
                       term, offset in term_offsets]
        start_dates.append(AstronomyEngine.get_exact_jieqi(self.wuyun_year + 1, "大寒"))
        step = next((i for i in range(5) if start_dates[i] <= self.target_date < start_dates[i + 1]), 4)
        return self.get_host_fortunes()[step], self.get_guest_fortunes()[step]["element"]

    def get_current_qi_enums(self):
        terms = ["大寒", "春分", "小满", "大暑", "秋分", "小雪", "大寒"]
        bounds = [AstronomyEngine.get_exact_jieqi(self.wuyun_year + (1 if i == 6 else 0), t) for i, t in
                  enumerate(terms)]
        step = next((i for i in range(6) if bounds[i] <= self.target_date < bounds[i + 1]), 5)
        host_qis = [QiType.WEAK_YIN_WOOD, QiType.MILD_YIN_FIRE, QiType.WEAK_YANG_FIRE, QiType.DOMINANT_YIN_EARTH,
                    QiType.MILD_YANG_METAL, QiType.DOMINANT_YANG_WATER]
        return host_qis[step], self.get_guest_qi_sequence()[step]

    def get_current_fortune(self):
        term_offsets = [("大寒", 0), ("春分", 13), ("芒种", 10), ("处暑", 7), ("立冬", 4)]
        start_dates = [AstronomyEngine.get_exact_jieqi(self.wuyun_year, term) + datetime.timedelta(days=offset) for
                       term, offset in term_offsets]
        start_dates.append(AstronomyEngine.get_exact_jieqi(self.wuyun_year + 1, "大寒"))
        step = next((i for i in range(5) if start_dates[i] <= self.target_date < start_dates[i + 1]), 4)
        h = self.get_host_fortunes()[step]
        g = self.get_guest_fortunes()[step]
        return {"step_index": step + 1, "start_date": start_dates[step].strftime("%Y-%m-%d %H:%M:%S"), "host": h.value,
                "guest": f"{g['element'].value}{g['adequacy'].value}"}

    def get_current_qi(self):
        terms = ["大寒", "春分", "小满", "大暑", "秋分", "小雪", "大寒"]
        bounds = [AstronomyEngine.get_exact_jieqi(self.wuyun_year + (1 if i == 6 else 0), t) for i, t in
                  enumerate(terms)]
        step = next((i for i in range(6) if bounds[i] <= self.target_date < bounds[i + 1]), 5)
        h = list(QiType)[step]
        g = self.get_guest_qi_sequence()[step]
        return {"step_index": step + 1,
                "term_range": f"{bounds[step].strftime('%m-%d')} 至 {bounds[step + 1].strftime('%m-%d')}",
                "host": f"{h.display_name} ({h.factor})", "guest": f"{g.display_name} ({g.factor})"}


# ==========================================
# 4. AHI K线图生成引擎 (AHI Engine)
# ==========================================

class AHIEngine:
    def __init__(self, birth_dt: datetime.datetime):
        self.birth_dt = birth_dt
        self.natal_calc = WuYunLiuQi(birth_dt)
        self.natal_sui_yun = self.natal_calc.stem.yun_element
        self.natal_adequacy = self.natal_calc.stem.adequacy

        if self.natal_adequacy == Adequacy.EXCESS:
            self.strong_zang = self.natal_sui_yun
            self.weak_zang = self.natal_sui_yun.overcomes()
        else:
            self.weak_zang = self.natal_sui_yun
            self.strong_zang = self.natal_sui_yun.overcomer()

        self.birth_host_yun, _ = self.natal_calc.get_current_fortune_enums()
        self.birth_host_qi, self.birth_guest_qi = self.natal_calc.get_current_qi_enums()
        self.base_score = self._calc_base_score()

    def _calc_base_score(self):
        score = 50
        h_el = self.birth_host_qi.element
        g_el = self.birth_guest_qi.element

        if g_el.generate() == h_el or h_el.generate() == g_el or g_el == h_el:
            score += 20
        elif h_el.overcomes() == g_el:
            score -= 20
        elif g_el.overcomes() == h_el:
            score -= 10

        if self.birth_guest_qi == QiType.MILD_YIN_FIRE and self.birth_host_qi == QiType.WEAK_YANG_FIRE:
            score += 15
        elif self.birth_guest_qi == QiType.WEAK_YANG_FIRE and self.birth_host_qi == QiType.MILD_YIN_FIRE:
            score -= 15

        return score

    def calculate_year_ahi(self, target_year: int) -> float:
        dt = AstronomyEngine.get_exact_jieqi(target_year, "大寒")
        flow_year = WuYunLiuQi(dt)
        cy_sui_yun = flow_year.stem.yun_element
        cy_adequacy = flow_year.stem.adequacy
        effect = flow_year.get_climatic_effect()
        si_tian = effect["celestial"]
        zai_quan = effect["terrestrial"]

        sui_yun_pts = 0
        if cy_sui_yun == self.natal_sui_yun:
            sui_yun_pts += 25
        elif cy_sui_yun.generate() == self.natal_sui_yun or self.natal_sui_yun.generate() == cy_sui_yun:
            sui_yun_pts += 18
        elif cy_sui_yun.overcomes() == self.natal_sui_yun or self.natal_sui_yun.overcomes() == cy_sui_yun:
            sui_yun_pts -= 22

        if cy_adequacy == Adequacy.EXCESS and cy_sui_yun.overcomes() == self.weak_zang:
            sui_yun_pts -= 15
        if cy_adequacy == Adequacy.DEFICIENCY and cy_sui_yun.generate() == self.strong_zang:
            sui_yun_pts += 10

        guest_yuns = [f["element"] for f in flow_year.get_guest_fortunes()]
        step_pts_list = []
        for gy in guest_yuns:
            s = 0
            if gy == self.birth_host_yun:
                s += 20
            elif gy.generate() == self.birth_host_yun or gy.generate() == self.weak_zang:
                s += 15
            elif gy.overcomes() == self.birth_host_yun or gy.overcomes() == self.weak_zang:
                s -= 25
            step_pts_list.append(s)
        avg_step_pts = sum(step_pts_list) / 5

        bh_prefix = self.birth_host_qi.display_name[:2]
        st_prefix = si_tian.display_name[:2]
        zq_prefix = zai_quan.display_name[:2]

        sq_pts1 = 0
        if st_prefix == bh_prefix or zq_prefix == bh_prefix:
            sq_pts1 += 22
        if si_tian.element.generate() == self.birth_host_qi.element:
            sq_pts1 += 16
        if si_tian.element.overcomes() == self.birth_host_qi.element or si_tian.element.overcomes() == self.weak_zang:
            sq_pts1 -= 28
        if zai_quan.element.overcomes() == self.birth_host_qi.element or zai_quan.element.overcomes() == self.weak_zang:
            sq_pts1 -= 28

        sq_pts2 = 0
        natal_yun = self.natal_sui_yun
        cy_branch_el = flow_year.branch.element

        if si_tian.element.generate() == natal_yun:
            sq_pts2 += 22
        elif natal_yun == cy_branch_el:
            sq_pts2 += 20
        elif natal_yun.generate() == si_tian.element:
            sq_pts2 -= 15
        elif natal_yun.overcomes() == si_tian.element:
            sq_pts2 -= 20
        elif si_tian.element.overcomes() == natal_yun:
            sq_pts2 -= 28
        elif natal_yun == si_tian.element:
            sq_pts2 -= 12

        weighted_yun = (sui_yun_pts * 0.90) + (avg_step_pts * 0.10)
        weighted_qi = (sq_pts1 * 0.25) + (sq_pts2 * 0.75)
        total_raw_collision = (weighted_yun * 0.30) + (weighted_qi * 0.70)
        return total_raw_collision


# ==========================================
# Flask Routes
# ==========================================

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/calculate', methods=['POST'])
def calculate():
    try:
        data = request.json
        year = int(data.get('year'))
        month = int(data.get('month'))
        day = int(data.get('day'))

        target_date = datetime.datetime(year, month, day, 12, 0)
        calc = WuYunLiuQi(target_date)
        engine = AHIEngine(target_date)

        # Summary
        yf = calc.get_year_fortune()
        ce = calc.get_climatic_effect()
        fortune = calc.get_current_fortune()
        qi = calc.get_current_qi()

        wylq_summary = {
            "ganzhi": f"{calc.stem.char}{calc.branch.char}年",
            "suiyun": f"{yf['description']} ({yf['element']})",
            "sitian": ce['celestial'].display_name,
            "zaiquan": ce['terrestrial'].display_name,
            "current_fortune": f"第 {fortune['step_index']} 运 (主: {fortune['host']}, 客: {fortune['guest']})",
            "current_qi": f"第 {qi['step_index']} 气 (主: {qi['host']}, 客: {qi['guest']})"
        }

        # K-line data
        kline_data = []
        current_health = engine.base_score

        for age in range(1, 61):
            calc_year = year + age - 1
            impact = engine.calculate_year_ahi(calc_year)

            if 1 <= age <= 20: lifecycle_drift = 0.8
            elif 21 <= age <= 40: lifecycle_drift = 0.0
            elif 41 <= age <= 50: lifecycle_drift = -0.8
            else: lifecycle_drift = -1.5

            dynamic_base = (current_health * 0.6) + (engine.base_score * 0.4)
            close_score = dynamic_base + impact + lifecycle_drift
            close_score = max(0, min(100, close_score))

            kline_data.append({
                "age": age,
                "open": round(current_health, 2),
                "close": round(close_score, 2)
            })
            current_health = close_score

        return jsonify({
            "wylq_summary": wylq_summary,
            "kline_data": kline_data,
            "base_score": round(engine.base_score, 2)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=3000)
