import datetime
from enum import Enum
from lunar_python import Solar
from flask import Flask, request, jsonify, render_template
import os
import requests
import dashscope

# 初始化 Flask 后端应用，配置模板和静态文件的路径
app = Flask(__name__, template_folder='templates', static_folder='public', static_url_path='')

# ==========================================
# 1. 基础定义与枚举 (Basic Definitions)
# 这里定义了中医五行、天干、地支、六气的基础属性和生克关系
# ==========================================

class Element(Enum):
    """五行枚举类，定义木、火、土、金、水"""
    WOOD = "木"
    FIRE = "火"
    EARTH = "土"
    METAL = "金"
    WATER = "水"

    def generate(self):
        """定义五行相生关系：木生火，火生土，土生金，金生水，水生木"""
        mapping = {
            Element.WOOD: Element.FIRE, Element.FIRE: Element.EARTH,
            Element.EARTH: Element.METAL, Element.METAL: Element.WATER,
            Element.WATER: Element.WOOD
        }
        return mapping[self]

    def overcomes(self):
        """定义五行相克关系（我克者）：木克土，土克水，水克火，火克金，金克木"""
        mapping = {
            Element.WOOD: Element.EARTH, Element.EARTH: Element.WATER,
            Element.WATER: Element.FIRE, Element.FIRE: Element.METAL,
            Element.METAL: Element.WOOD
        }
        return mapping[self]

    def overcomer(self):
        """定义五行受克关系（克我者）：金克木，水克火，土克水，木克土，火克金"""
        mapping = {
            Element.WOOD: Element.METAL, Element.METAL: Element.FIRE,
            Element.FIRE: Element.WATER, Element.WATER: Element.EARTH,
            Element.EARTH: Element.WOOD
        }
        return mapping[self]


class Adequacy(Enum):
    """岁运太过与不及的枚举"""
    EXCESS = "太过"
    DEFICIENCY = "不及"

    def opposite(self):
        """返回对立面：太过对应不及，不及对应太过"""
        return Adequacy.DEFICIENCY if self == Adequacy.EXCESS else Adequacy.EXCESS


class HeavenlyStem(Enum):
    """十天干枚举，绑定索引、汉字、所属五行及太过/不及属性"""
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
        """根据公历年份计算天干，公历年份尾数减4取余即可匹配天干"""
        return list(HeavenlyStem)[(year - 4) % 10]


class EarthlyBranch(Enum):
    """十二地支枚举，绑定索引、汉字及基础五行属性"""
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
        """根据公历年份计算地支，公历年份减4除以12取余即可"""
        return list(EarthlyBranch)[(year - 4) % 12]


class QiType(Enum):
    """六气类型枚举，绑定三阴三阳名称、气候特征及所属五行"""
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
        """获取前一气（退一步），用于推算客气加临"""
        order = list(QiType)
        idx = order.index(self)
        return order[idx - 1]


# ==========================================
# 2. 高精度天文历法引擎
# 负责精确计算每年的二十四节气具体时间，用于精准划分运气步位
# ==========================================

class AstronomyEngine:
    @staticmethod
    def get_exact_jieqi(year: int, term_name: str) -> datetime.datetime:
        """
        根据年份和节气名称，借助 lunar_python 库获取精确到秒的节气交接时间
        """
        term_months = {
            "小寒": 1, "大寒": 1, "立春": 2, "雨水": 2, "惊蛰": 3, "春分": 3,
            "清明": 4, "谷雨": 4, "立夏": 5, "小满": 5, "芒种": 6, "夏至": 6,
            "小暑": 7, "大暑": 7, "立秋": 8, "处暑": 8, "白露": 9, "秋分": 9,
            "寒露": 10, "霜降": 10, "立冬": 11, "小雪": 11, "大雪": 12, "冬至": 12
        }
        m = term_months.get(term_name)
        if not m: raise ValueError(f"未知的节气名称: {term_name}")

        test_days = [15, 5, 25] # 用每月的15, 5, 25日去试探节气日历
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
# 3. 五运六气核心逻辑
# 根据出生日期或流年，排盘计算主客运气、司天在泉等
# ==========================================

class WuYunLiuQi:
    def __init__(self, date_obj: datetime.datetime):
        self.target_date = date_obj
        # 中医运气学以每年的"大寒"节气作为运气新一年的起点，需判断目标日期是否已过大寒
        current_year_dahan = AstronomyEngine.get_exact_jieqi(date_obj.year, "大寒")
        if self.target_date < current_year_dahan:
            self.wuyun_year = date_obj.year - 1
        else:
            self.wuyun_year = date_obj.year

        self.stem = HeavenlyStem.from_year(self.wuyun_year)
        self.branch = EarthlyBranch.from_year(self.wuyun_year)

    def get_year_fortune(self):
        """获取全年的大运（岁运）及其太过不及"""
        return {
            "element": self.stem.yun_element.value,
            "adequacy": self.stem.adequacy.value,
            "description": f"{self.stem.yun_element.value}运{self.stem.adequacy.value}"
        }

    def get_guest_fortunes(self):
        """计算全年的五步客运（初运、二运、三运、四运、终运）"""
        fortunes = []
        current_element = self.stem.yun_element
        current_adequacy = self.stem.adequacy
        for i in range(5):
            fortunes.append({"step": i + 1, "element": current_element, "adequacy": current_adequacy})
            current_element = current_element.generate() # 客运按五行相生顺序演进
            current_adequacy = current_adequacy.opposite() # 太过与不及交替出现
        return fortunes

    def get_host_fortunes(self):
        """获取主运（年年固定：木->火->土->金->水）"""
        return [Element.WOOD, Element.FIRE, Element.EARTH, Element.METAL, Element.WATER]

    def get_climatic_effect(self):
        """根据年支计算上半年的司天之气和下半年的在泉之气"""
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
        """计算全年的六步客气推移顺序"""
        effect = self.get_climatic_effect()
        st, zq = effect["celestial"], effect["terrestrial"]
        # 客气顺序由司天（三之气）和在泉（终之气）倒推得出
        return [st.previous().previous(), st.previous(), st, zq.previous().previous(), zq.previous(), zq]

    def get_current_fortune_enums(self):
        """获取目标日期当天所处的主运和客运对象"""
        term_offsets = [("大寒", 0), ("春分", 13), ("芒种", 10), ("处暑", 7), ("立冬", 4)]
        start_dates = [AstronomyEngine.get_exact_jieqi(self.wuyun_year, term) + datetime.timedelta(days=offset) for
                       term, offset in term_offsets]
        start_dates.append(AstronomyEngine.get_exact_jieqi(self.wuyun_year + 1, "大寒"))
        step = next((i for i in range(5) if start_dates[i] <= self.target_date < start_dates[i + 1]), 4)
        return self.get_host_fortunes()[step], self.get_guest_fortunes()[step]["element"]

    def get_current_qi_enums(self):
        """获取目标日期当天所处的主气和客气对象"""
        terms = ["大寒", "春分", "小满", "大暑", "秋分", "小雪", "大寒"]
        bounds = [AstronomyEngine.get_exact_jieqi(self.wuyun_year + (1 if i == 6 else 0), t) for i, t in
                  enumerate(terms)]
        step = next((i for i in range(6) if bounds[i] <= self.target_date < bounds[i + 1]), 5)
        # 主气年年固定
        host_qis = [QiType.WEAK_YIN_WOOD, QiType.MILD_YIN_FIRE, QiType.WEAK_YANG_FIRE, QiType.DOMINANT_YIN_EARTH,
                    QiType.MILD_YANG_METAL, QiType.DOMINANT_YANG_WATER]
        return host_qis[step], self.get_guest_qi_sequence()[step]

    def get_current_fortune(self):
        """获取目标日期的五运详细文本信息，供前端展示"""
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
        """获取目标日期的六气详细文本信息，供前端展示"""
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
# 4. AHI K线图生成引擎
# 将出生日期禀赋与60年间的流年进行碰撞，得出人生健康指数K线
# ==========================================

class AHIEngine:
    def __init__(self, birth_dt: datetime.datetime):
        self.birth_dt = birth_dt
        self.natal_calc = WuYunLiuQi(birth_dt)
        self.natal_sui_yun = self.natal_calc.stem.yun_element
        self.natal_adequacy = self.natal_calc.stem.adequacy

        # 确定先天的强弱脏腑
        if self.natal_adequacy == Adequacy.EXCESS:
            self.strong_zang = self.natal_sui_yun
            self.weak_zang = self.natal_sui_yun.overcomes()
        else:
            self.weak_zang = self.natal_sui_yun
            self.strong_zang = self.natal_sui_yun.overcomer()

        self.birth_host_yun, _ = self.natal_calc.get_current_fortune_enums()
        self.birth_host_qi, self.birth_guest_qi = self.natal_calc.get_current_qi_enums()
        # 计算一个人一生不变的基准分
        self.base_score = self._calc_base_score()

    def _calc_base_score(self):
        """计算先天基础底分"""
        score = 50
        h_el = self.birth_host_qi.element
        g_el = self.birth_guest_qi.element
        # 顺境：主客气相生或同气
        if g_el.generate() == h_el or h_el.generate() == g_el or g_el == h_el:
            score += 10
        # 逆境：主气克客气（逆天而行）
        elif h_el.overcomes() == g_el:
            score -= 15
        # 顺天威：客气克主气
        elif g_el.overcomes() == h_el:
            score -= 10
        
        # 二火特殊加临规则
        if self.birth_guest_qi == QiType.MILD_YIN_FIRE and self.birth_host_qi == QiType.WEAK_YANG_FIRE:
            score += 8
        elif self.birth_guest_qi == QiType.WEAK_YANG_FIRE and self.birth_host_qi == QiType.MILD_YIN_FIRE:
            score -= 8
        return score

    def calculate_year_ahi(self, target_year: int) -> float:
        """核心计算：目标年份的五运六气对用户体质的纯碰撞影响分"""
        dt = AstronomyEngine.get_exact_jieqi(target_year, "大寒")
        flow_year = WuYunLiuQi(dt)
        cy_sui_yun = flow_year.stem.yun_element
        cy_adequacy = flow_year.stem.adequacy
        si_tian = flow_year.get_climatic_effect()["celestial"]
        zai_quan = flow_year.get_climatic_effect()["terrestrial"]

        # 1. 岁运总碰撞评分 (A1)
        sui_yun_pts = 0
        if cy_sui_yun == self.natal_sui_yun:
            sui_yun_pts += 25 # 同气相求
        elif cy_sui_yun.generate() == self.natal_sui_yun or self.natal_sui_yun.generate() == cy_sui_yun:
            sui_yun_pts += 18 # 互相生助
        elif cy_sui_yun.overcomes() == self.natal_sui_yun or self.natal_sui_yun.overcomes() == cy_sui_yun:
            sui_yun_pts -= 22 # 互相克制
        # 弱脏被克或强脏受生
        if cy_adequacy == Adequacy.EXCESS and cy_sui_yun.overcomes() == self.weak_zang: sui_yun_pts -= 15
        if cy_adequacy == Adequacy.DEFICIENCY and cy_sui_yun.generate() == self.strong_zang: sui_yun_pts += 10

        # 2. 五步客运匹配平均分 (A2)
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

        # 3. 司天在泉总碰撞 (B1)
        bh_prefix = self.birth_host_qi.display_name[:2]
        st_prefix = si_tian.display_name[:2]
        zq_prefix = zai_quan.display_name[:2]
        sq_pts1 = 0
        if st_prefix == bh_prefix or zq_prefix == bh_prefix: sq_pts1 += 22
        if si_tian.element.generate() == self.birth_host_qi.element: sq_pts1 += 16
        if si_tian.element.overcomes() == self.birth_host_qi.element or si_tian.element.overcomes() == self.weak_zang: sq_pts1 -= 28
        if zai_quan.element.overcomes() == self.birth_host_qi.element or zai_quan.element.overcomes() == self.weak_zang: sq_pts1 -= 28

        # 4. 司天与主运格局判定 (B2) - 判定岁会、天符等大格局
        sq_pts2 = 0
        natal_yun = self.natal_sui_yun
        cy_branch_el = flow_year.branch.element
        if si_tian.element.generate() == natal_yun:
            sq_pts2 += 22 # 平气
        elif natal_yun == cy_branch_el:
            sq_pts2 += 20 # 岁会
        elif natal_yun.generate() == si_tian.element:
            sq_pts2 -= 15 # 逆气
        elif natal_yun.overcomes() == si_tian.element:
            sq_pts2 -= 20 # 不和
        elif si_tian.element.overcomes() == natal_yun:
            sq_pts2 -= 28 # 天刑
        elif natal_yun == si_tian.element:
            sq_pts2 -= 12 # 同化

        # ==================================
        # 严格执行加权合并算法
        # ==================================
        weighted_yun = (sui_yun_pts * 0.90) + (avg_step_pts * 0.10)
        weighted_qi = (sq_pts1 * 0.25) + (sq_pts2 * 0.75)
        # 五运占 30%，六气占 70%
        total_raw_collision = (weighted_yun * 0.30) + (weighted_qi * 0.70)
        return total_raw_collision


# ==========================================
# 5. 千问 AI 知识库与 Flask 路由
# ==========================================

# 将原版完整的《三因司天方》理论注入常量，不可简略，防止 AI 幻觉
SANYIN_KNOWLEDGE = """
【一、 健康指数(AHI)算法与加权规则解析】
告诉用户，其0-60岁的健康K线图并非随机生成，而是基于以下严密的中医运气学数学模型计算得出：
1. 个人基准分 (Base Score)：基础分为50分。主客相生或同气+10分；主气克客气-15分；客气克主气-10分。特殊加临：少阴君火为客气，少阳相火为主气 +8分；少阳相火为客气，少阴君火为主气 -8分。
2. 年度流年碰撞分 (Impact Score)：五运碰撞占30%，六气碰撞占70%。
3. 动态生命周期与健康惯性：当年最终收盘价 = (去年健康分*0.6 + 先天基准分*0.4) + 流年碰撞净分 + 年龄漂移值。

【二、《三因司天方》核心理论知识库】
（一）五运六气整体理论知识
《运气总说》引张介宾语，强调运气非“无益于医”，而是“岁气之流行，即安危之关系”。岁运有太过、不及，六气有胜复、逆从，失中和则致病。民病因“众人而患同病”，非偶然，乃运气使然。
《司天方原叙》云：“五运六气，乃天地阴阳运行升降之常道也。五运流行，有太过不及之异；六气升降，有逆从胜复之差。凡不合于政令德化者，则为变眚，皆能病人……前哲知天地有余不足，违戾之气，还以天道所生德味而平治之。”
运有代谢，气有应候；太过泻之，不及补之；本气正方治之，客气加临则分病证加减。缪问补充：“人生于地，气应于天……衰则所胜妄行，己虚而彼实；盛则薄所不胜，己实而彼虚……无盛盛，无虚虚……有者求之，无者求之。盛者责之，虚者责之。”

（二）五运不同格局的体质病机症状（天干十方对应）
1. 六甲年（岁土太过，敦阜之纪）病机：雨湿流行，肾水受邪；脾土转失温煦，先后天交病；湿淫于内，火用不宣。体质：阳弱者或阴虚者易感，肾中真气被遏。症状：民病腹痛，清厥，意不乐，体重烦冤。甚则肌肉萎，足痿不收，行善瘦，脚下痛，饮发，中满，食减，四肢不举。病腹满，溏泄，肠鸣，反下甚。太溪绝者死。
2. 六乙年（岁金不及，炎火乃行）病机：肺金自馁，火乘其敝；肩背为云门中府，肺脉所循；肺与大肠表里，气不下摄。体质：肺虚火旺者，气阴两伤。症状：民病肩背瞀重，鼽嚏，血便注下。复则头脑户痛，延及脑顶，发热，口疮，甚则心痛。
3. 六丙年（岁水太过，寒气流行）病机：太阳在上，泽无阳焰，火发待时；少阴在上，寒热凌犯；少阳在上，炎火乃流，阴行阳化，寒甚火郁。体质：水湿郁热体质，心火受邪。症状：民病身热，烦心躁悸，阴厥，上下而寒，谵妄心痛。甚则腹大胫肿，喘咳，寝汗出，憎风。病反腹满，肠鸣溏泄，食不化，渴而妄冒。神门绝者死。
4. 六丁年（岁木不及，燥乃大行）病机：厥阴络下络少腹，肝虚阳下陷；木动风内攻；风燥火热，多阳少阴，液亏阳焰。体质：肝肾阴虚或水火双亏者。症状：民病中清，胠胁痛，少腹痛，肠鸣溏泄。复则病寒热，疮疡痱疹痈疽，咳而鼽。
5. 六戊年（岁火太过，炎暑流行）病机：肺金受邪，烁金败水；岁气之火属气交，与外淫有别。体质：肺脉微弱、气阴两虚者。症状：民病疟、少气、咳喘、血溢、血泄、注下、嗌燥、耳聋、中热、肩背热。甚则胸中痛，胁支满胁痛，膺背肩胛间痛，两臂内痛，身热骨痛而为浸淫。病反谵妄狂越，咳喘息鸣，下甚，血溢血泄不已。太渊绝者死。
6. 六己年（岁土不及，风乃大行）病机：土虚木乘，脾恶湿畏肝；胃气不得降则脾气不得升。体质：脾虚肝旺、湿困中土者。症状：民病飧泄，霍乱，体重腹痛，筋骨繇复，肌肉晦痿，善怒。咸病寒中。复则胸胁暴痛，下引少腹，善太息，食少失味。
7. 六庚年（岁金太过，燥气流行）病机：金性至刚，害必凌木；肺气逆行，上蒙清窍；肝为藏血之会，火复阴伤。体质：肝阴血虚、燥盛者。症状：民病两胁下少腹痛，目赤痛，眦疡，耳无所闻，体重烦冤，胸痛引背，两胁满且痛引少腹。甚则喘咳逆气，肩背痛，尻阴股膝髀腨胻足皆痛。病反暴痛，胠胁不可反侧，咳逆甚而血溢。太冲绝者死。
8. 六辛年（岁水不及，湿乃大行）病机：涸流之纪，肾虚受湿；阳弱少火乏权，阴弱痿痛烦冤。体质：肾阳虚或肾阴弱、湿着者。症状：民病腹满，身重濡泄，寒疡流水，腰股发痛，腘腨股膝不便，烦冤，足痿清厥，脚下痛，甚则跗肿。寒疾于下，甚则腹满浮肿。复则面色时变，筋骨并辟，肉睭瘛，目视眎眎，肌肉彤发，气并鬲中，痛于心腹。
9. 六壬年（岁木太过，风气流行）病机：肝木乘脾极矣，风淫所胜。体质：脾土虚弱、肝风内动者。症状：民病飧泄食减，体重烦冤，肠鸣，腹支满。甚则忽忽善怒，眩冒巅疾。反胁痛而吐甚。冲阳绝者死。
10. 六癸年（岁火不及，寒乃大行）病机：心为生血之脏，血足则荣养百骸，不足则傍见诸痛；肩臂络系于心。体质：心血不足、心气虚弱者。症状：民病胸中痛，胁支满，两胁痛，膺背肩胛间及两臂内痛，郁冒朦昧，心痛暴瘖，胸腹大，胁下与腰背相引而痛，甚则屈不能伸，髋髀如别。复则病鹜溏，腹满，食饮不下，寒中，肠鸣泄注，腹痛，暴挛痿痹，足不任身。

（三）六气不同格局的体质病机症状（地支六方对应）
1. 子午年（少阴司天，阳明在泉）总病机：热病生于上，清病生于下，水火寒热持于气交。体质：寒热交争、上下不调者。总症状：关节禁固，腰痛，气郁而热，小便淋，目赤心痛，寒热更作，咳嗽鼽衄嗌干，饮发黄疸，喘甚下连小腹寒中。
2. 丑未年（太阴司天，太阳在泉）总病机：阴专其令，阳气退避，寒湿合邪。体质：寒湿困脾、关节不利者。总症状：关节不利，筋脉痿弱，湿疠盛行，胸膈不利，浮肿，寒疟，血溢，腰椎痛。
3. 寅申年（少阳司天，厥阴在泉）总病机：风热参布，云物沸腾，火淫风胜。体质：风火相煽、上下维持失调者。总症状：气郁热，血溢，目赤，咳逆，头疼，呕吐，胸臆不利，燥渴，聋瞑身重，心痛，疮疡，烦躁。
4. 卯酉年（阳明司天，少阴在泉）总病机：阳专其令，炎暑大行，金燥火烈。体质：金燥火烈、面浮便赤者。总症状：中热，面浮鼻肿，鼽嚏，小便黄赤甚则淋；或疳气行，善暴仆振栗谵妄寒疟痈肿便血。
5. 辰戌年（太阳司天，少阴在泉）总病机：寒临太虚，阳气不令，寒湿之会。体质：寒湿盛、太阳少阴失调者。总症状：身热头痛呕吐气郁中满瞥闷足痿少气注下赤白肌腠疮疡发痈疽。
6. 巳亥年（厥阴司天，少阳在泉）总病机：热病行于下，风病行于上，风燥胜复形于中，湿化乃行。体质：风燥湿热错杂、右胁寒热不均者。总症状：中热而反右胁下寒，耳鸣掉眩，燥湿相胜，黄疸浮肿时作温厉。
"""

@app.route('/')
def index():
    """渲染前端网页首页"""
    return render_template('index.html')

@app.route('/api/calculate', methods=['POST'])
def calculate():
    """提供给前端的 API 接口，用于计算用户五运六气及60年 K 线数据"""
    try:
        data = request.json
        year, month, day = data['year'], data['month'], data['day']
        target_date = datetime.datetime(year, month, day, 12, 0)
        
        # 实例化算法引擎
        calc = WuYunLiuQi(target_date)
        engine = AHIEngine(target_date)

        yf = calc.get_year_fortune()
        ce = calc.get_climatic_effect()
        fortune = calc.get_current_fortune()
        qi = calc.get_current_qi()

        # 整理好前端需要的文本展示数据，避免前端处理复杂字典对象
        wylq_summary = {
            "ganzhi": f"{calc.stem.char}{calc.branch.char}年",
            "suiyun": f"{yf['description']} ({yf['element']})",
            "sitian": ce['celestial'].display_name,
            "zaiquan": ce['terrestrial'].display_name,
            "daily_fortune": f"第 {fortune['step_index']} 运, 主: {fortune['host']}, 客: {fortune['guest']}",
            "daily_qi": f"第 {qi['step_index']} 气, 主: {qi['host']}, 客: {qi['guest']}"
        }

        kline_data = []
        current_health = engine.base_score
        
        # 循环推演 1 岁到 60 岁的健康起伏
        for age in range(1, 61):
            calc_year = year + age - 1
            impact = engine.calculate_year_ahi(calc_year)
            
            # 加入黄帝内经生命周期“生长壮老已”的自然漂移系数
            lifecycle_drift = 0.8 if age <= 20 else (0.0 if age <= 40 else (-0.8 if age <= 50 else -1.5))
            
            # 引入健康惯性机制（60%前一年状态 + 40%先天基底）
            dynamic_base = (current_health * 0.6) + (engine.base_score * 0.4)
            close_score = max(0, min(100, dynamic_base + impact + lifecycle_drift))
            
            kline_data.append({"age": age, "open": round(current_health, 2), "close": round(close_score, 2)})
            current_health = close_score

        return jsonify({"wylq_summary": wylq_summary, "kline_data": kline_data, "base_score": engine.base_score})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/generate-report', methods=['POST'])
def generate_report():
    """提供给前端的 API 接口，调用千问大模型生成解读报告"""
    try:
        data = request.json
        wylq_summary = data['wylq_summary']
        kline_data = data['kline_data']
        
        # 【极其重要的修复】：必须使用 DASHSCOPE_API_KEY，匹配 Render 里的变量名
        api_key = os.environ.get("DASHSCOPE_API_KEY")
        if not api_key:
            return jsonify({"error": "服务器未配置 DASHSCOPE_API_KEY 环境变量"}), 500
        
        dashscope.api_key = api_key

        kline_text = ", ".join([f"{d['age']}岁:{int(d['close'])}分" for d in kline_data])
        prompt = f"""你是一位精通《黄帝内经》和《三因司天方》的顶级中医大夫，同时也是一位深谙现代生活美学与身心管理的私人健康顾问。
请为用户撰写一份【深度融合】古法智慧与现代审美的【全生命周期健康洞察报告】。

{SANYIN_KNOWLEDGE}

【用户先天体质与当日气象数据】：
{wylq_summary}

【用户 0-60岁 年度健康指数(AHI)收盘价变化】：
{kline_text}

请按照以下模块撰写，要求将专业术语自然融入现代语境，不要生硬拆分：

【先天体质解码】：将运气学定义的体质（如岁运、司天）转化为一种“生命底色”的描述。描述具体的身体反馈，如：容易熬夜后恢复慢、换季时皮肤或情绪的微妙波动等，让用户感到被精准“读心”。
【K线原理解密】：用一种“宇宙共振”的视角，解释 AHI 指数如何捕捉天地节律对个体能量场的扰动。将人体类比为一个精密且感性的“生物接收器”。
【人生健康大势】：结合数据曲线，以“生命周期管理”的口吻，指出能量巅峰期与系统维护期。描述低分年份时，要像提醒老朋友一样，指出可能出现的“身心低电量”状态。
【定制养生锦囊】：给出极具生活美感的建议。不要说“禁食生冷”，要说“给肠胃一场温暖的治愈仪式”。建议要具体、现代且有趣，如针对其体质推荐某种特定的“情绪断舍离”方式。

【极其重要的约束】：
1. 严禁使用 Markdown 的加粗符号（**）、列表符号（- 或 *）或任何代码块。
2. 严禁推荐具体方药名称。
3. 语言风格：专业、考究、灵动。展现尊贵感与亲和力。
4. 直接输出纯文本。"""

        response = dashscope.Generation.call(
            model="qwen-turbo",
            prompt=prompt,
            result_format='message'
        )
        
        if response.status_code == 200:
            return jsonify({"report": response.output.choices[0].message.content})
        else:
            return jsonify({"error": response.message}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # 监听 0.0.0.0 和端口 3000 (根据你的设定)
    app.run(host='0.0.0.0', port=3000)
