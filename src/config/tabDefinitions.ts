// 42 功能模块全量定义 (提取自官方原版 Bundle)

export const createField = (name: string, desc?: string, example?: string) => ({
  name,
  desc,
  example,
})
export const createCol = (name: string, options?: string[], width?: string) => ({
  name,
  type: options ? 'select' : 'text',
  options,
  width,
})
export const createDateCol = (name: string, width?: string) => ({
  name,
  type: 'date',
  options: undefined,
  width,
})
export const createCalendarCol = (name: string, width?: string) => ({
  name,
  type: 'calendar',
  options: undefined,
  width,
})
export const createCharCol = (name: string) => ({ name, type: 'character', options: undefined })
export const createCharsCol = (name: string) => ({ name, type: 'characters', options: undefined })
export const createCalendarSelectCol = (name: string) => ({
  name,
  type: 'select',
  options: undefined,
  calendar: true,
})
export const createRefCol = (name: string, refTab: string, refCol: string) => ({
  name,
  type: 'tableRef',
  options: undefined,
  refTab,
  refCol,
})

const createHiddenId = (name: string, options?: string[], width?: string) => ({
  name,
  type: 'text',
  options,
  width,
  hidden: true,
})

const OUTLINE_TABLE_COLUMNS = [
  createCol('章节号'),
  createCol('章节标题'),
  createCol('一句话事件'),
  createCol('出场人物'),
  createCol('埋设伏笔编号'),
  createCol('回收伏笔编号'),
  createCol('细纲状态', ['无', '已排', '已核对']),
  createCol('字数'),
  createCalendarCol('发布日期'),
  createCol('备注'),
]

export const TAB_DEFINITIONS = [
  {
    id: 'positioning',
    name: '作品定位',
    group: '开书定位',
    type: 'form',
    minimal: !0,
    description: '开书商业档案：动笔前第一个填——赛道、平台、读者、卖点没想清楚就动笔，多半会切书。',
    modules: [
      {
        name: '一、基本信息',
        fields: [
          createField('书名', '暂定名与备选名，最好有记忆点', '《吞天神脉》/ 备选《混沌玄脉》'),
          createField('类型赛道', '玄幻/都市/仙侠/科幻/历史/悬疑等，越具体越好', '东方玄幻·升级流'),
          createField('预计篇幅', '预计总字数与卷数，商业网文的体量规划', '约300万字，分七卷'),
          createField('更新节奏', '日更字数目标与存稿策略', '日更4000字，保持15章存稿'),
        ],
      },
      {
        name: '二、平台与读者',
        fields: [
          createField('目标平台', '起点/番茄/七猫/晋江等，平台调性决定写法', '起点中文网'),
          createField(
            '目标读者画像',
            '年龄、阅读习惯、爽点偏好',
            '18-30岁男频读者，偏好升级流+宗门+热血',
          ),
          createField(
            '对标作品',
            '2-3本同赛道成功作品，学习其结构与节奏',
            '《凡人修仙传》《一世之尊》',
          ),
        ],
      },
      {
        name: '三、卖点与差异化',
        fields: [
          createField(
            '核心卖点',
            '一句话说清读者为什么读你的书',
            '废脉少年吞噬进化，从杂役到镇压神族',
          ),
          createField(
            '差异化亮点',
            '与同赛道作品相比的独特之处',
            '吞噬体系与主线真相同步解锁，升级即揭秘',
          ),
          createField(
            '开篇钩子',
            '前三章抓住读者的设计',
            '第一章废脉受辱当夜觉醒，第三章即有反杀爽点',
          ),
        ],
      },
      {
        name: '四、简介与物料',
        fields: [
          createField('一句话简介', '50字以内浓缩全书', '废脉？我吞的就是天！'),
          createField(
            '正式简介',
            '200字左右，投稿与上架用',
            '测灵大典上少年被判废脉，当夜腕间胎记发烫……',
          ),
          createField('书封创意', '封面的画面构想', '少年立于青岚山巅，腕间金纹缠绕如龙'),
        ],
      },
      {
        name: '五、风险预案',
        fields: [
          createField('切书线', '什么数据下考虑切书/调整方向', '上架首订低于500且追读持续下滑'),
          createField('备选方向', '同一世界观下的备选故事', '以妹妹陈瑶为主角的神女视角'),
        ],
      },
    ],
    tips: ['开书前先填本表：商业定位决定写法，不是写完再找读者。'],
  },
  {
    id: 'worldbase',
    name: '世界设定',
    group: '开书定位',
    type: 'form',
    description:
      '世界观顶层档案：世界总览、底层法则、社会文明、成长地图、限制禁忌、剧情钩子。世界观是舞台不是字典，三层填法：底层法则定了不改→社会文明前十章展开→细节随写随补。',
    modules: [
      {
        name: '一、世界总览',
        fields: [
          createField('世界名称', '世界的正式名称', '苍澜大陆'),
          createField(
            '世界体量与格局',
            '几块大陆/几个核心区域，格局决定故事上限',
            '一主陆四域：中州居中，东南西北四洲拱卫',
          ),
          createField(
            '一句话世界观',
            '用一句话概括世界的核心矛盾',
            '神族封仙路收割人族灵气，人族三千年不知',
          ),
          createField('文明程度', '科技/魔法/修行的整体水平', '修行文明鼎盛，凡人社会近似古代东方'),
          createField(
            '当前时代背景',
            '故事开始时世界处于什么时期',
            '末法之末，灵气复苏前夜，旧秩序将崩',
          ),
        ],
      },
      {
        name: '二、底层法则（定了不改）',
        fields: [
          createField(
            '世界核心规则',
            '这个世界最底层的运行规则，一切力量体系由此生长',
            '天地灵气为万物修行之源，灵脉即大地血管',
          ),
          createField(
            '超凡力量是否存在',
            '普通人对超凡的认知程度',
            '修行者真实存在，凡人视宗门如神明',
          ),
          createField(
            '神灵/至高存在',
            '有没有神？神在故事中的位置',
            '上古神族曾统治大陆，如今暗中操控',
          ),
          createField(
            '世界终极真相',
            '世界的终极谜底（只写在设定集，大纲标注"见设定集"）',
            '玄脉是神族种在人族体内的灵气收割器',
          ),
          createField(
            '界外威胁',
            '世界之外还有什么？后期扩容用',
            '神域之外的混沌虚空，登仙者从未真正成仙',
          ),
        ],
      },
      {
        name: '三、社会与文明',
        fields: [
          createField(
            '社会结构',
            '权力如何分配：皇权/宗门/世家/商会',
            '中州皇朝名义共主，实为各大宗门均势',
          ),
          createField('经济与货币', '通行货币与经济体系', '下品灵石为通行货币，百灵石=一中品'),
          createField('日常衣食住行', '普通人与修行人的日常差异', '凡人市井如唐宋，修士辟谷御器'),
          createField('婚姻家庭与继承', '婚俗、家族继承规则', '宗门弟子婚配须报备；世家嫡长继承'),
          createField('司法与惩戒', '法律体系与惩罚方式', '宗门家法+皇朝律令双重管辖'),
          createField(
            '死亡与死后观',
            '人死后去哪？轮回/幽冥/虚无',
            '魂归幽冥，但三千年无人生还轮回——幽冥亦被封',
          ),
          createField(
            '神话传说体系',
            '民间流传的创世神话（与真相的落差即剧情）',
            '传说仙路通达，实为收割通道',
          ),
          createField(
            '语言文字与历法',
            '通用语、文字、纪年方式',
            '通用玄文，以灵历纪年，今为3024年',
          ),
        ],
      },
      {
        name: '四、成长地图（同心圆）',
        fields: [
          createField('核心圈', '主角起步的舞台', '云州·青岚宗：边陲小宗'),
          createField('中间圈', '格局第一次扩展', '东洲：州域大比、南荒秘境'),
          createField('外围圈', '大陆级舞台', '中州：圣地、皇朝、神族浮出'),
          createField('最终圈', '世界尽头与真相舞台', '极北北渊：仙路封印、神域'),
          createField('圈层门槛事件', '每次解锁新圈层的仪式感事件', '州域大比夺魁方可入东洲核心圈'),
        ],
      },
      {
        name: '五、限制与禁忌',
        fields: [
          createField(
            '世界级禁忌',
            '这个世界绝不能碰的规则',
            '不得擅开上古封印；屠戮同门者天下共击',
          ),
          createField('力量天花板', '当世最强者是什么水平', '合道境，全大陆不过一掌之数'),
          createField(
            '资源稀缺点',
            '什么资源最稀缺，稀缺即冲突',
            '灵脉与传承：一脉养一宗，夺脉即灭门',
          ),
        ],
      },
      {
        name: '六、剧情钩子预留',
        fields: [
          createField('世界级悬念', '留给读者的世界之谜', '三千年无人登仙，为什么？'),
          createField(
            '可埋伏笔点',
            '世界设定中天然适合埋伏笔的位置',
            '老瞎子的来历、北渊禁地、青铜古塔',
          ),
        ],
      },
    ],
    tips: ['底层法则模块定了就不能改；社会文明前十章慢慢展开；细节设定随写随补。'],
  },
  {
    id: 'power',
    name: '力量体系',
    group: '开书定位',
    type: 'form',
    lite: !0,
    description:
      '升级流网文的"物理法则"：力量来源、境界阶梯、能力门槛、克制关系、金手指接口。等级表是宪法，正文发布后尽量不改。',
    modules: [
      {
        name: '一、体系总览',
        fields: [
          createField('体系名称', '修炼体系的正式名称', '玄脉体系'),
          createField(
            '体系类型',
            '修炼流/魔法流/斗气流/异能流/科技流/混合流',
            '修炼流（灵气+肉身双修）',
          ),
          createField(
            '力量来源与路线',
            '吸纳天地型/感悟法则型/体内自生型，最好与世界核心规则呼应',
            '吸纳天地型：天地灵气淬体入脉',
          ),
          createField(
            '力量的限制规则',
            '什么情况下力量会失效/被压制/反噬',
            '灵气枯竭之地修为停滞；强行越境经脉俱裂',
          ),
          createField('修炼/提升方式', '怎么变强', '吸纳灵气冲刷玄脉，辅以功法丹药实战'),
          createField(
            '体系等级总表',
            '从低到高全部境界（大境界6~9个为宜）',
            '淬体→聚灵→通脉→凝罡→玄丹→化神→返虚→合道→登仙',
          ),
          createField(
            '等级命名原则',
            '名字要有力量感与画面感',
            '淬体炼皮肉、凝罡气成罡煞、玄丹力凝丹心',
          ),
          createField(
            '各境界标志性外在表现',
            '这个境界的强者出手，天地有什么反应',
            '凝罡罡风割面；玄丹地动三里；化神虚空微颤',
          ),
          createField('顶端模糊地带', '最高境界之上的未知悬念', '登仙之上是什么？三千年来无人登仙'),
          createField(
            '各等级战力量化',
            '每个境界"能做到什么"，防战力崩坏',
            '淬体敌十人；凝罡开碑裂石；玄丹毁一屋；化神毁一街',
          ),
          createField(
            '突破条件',
            '突破需要什么：资源/感悟/机缘/仪式',
            '每境需开启对应脉门，非丹药可强开',
          ),
          createField(
            '修炼时间成本',
            '各境界正常修炼需多久（凡才/天才两档）',
            '凡才聚灵十年、玄丹百年；天才三倍速',
          ),
          createField('瓶颈与寿元', '突破失败后果、各境界寿元上限', '凡人百岁，玄丹三百，合道千载'),
          createField(
            '普通人参照系',
            '平民/士兵/城主各是什么水平',
            '平民=淬体一重；边军精锐=聚灵；一城之主=通脉',
          ),
        ],
      },
      {
        name: '二、修炼路径与资源',
        fields: [
          createField(
            '修炼路径分化',
            '正道流派与旁道（魔道/鬼道）',
            '正统五脉：剑修/体修/阵修/丹修/御兽；旁道血魔教',
          ),
          createField(
            '功法来源与自创',
            '功法从哪来，主角能否自创',
            '功法多出自上古传承；混沌吞天诀后期可自创衍生',
          ),
          createField(
            '功法/技能品级',
            '功法分级标准，与"捡到宝贝"爽点相关',
            '黄玄地天四阶，每阶上中下三品',
          ),
          createField(
            '装备品级与加成',
            '法宝分级及越级战斗加成',
            '灵器/宝器/道器；持道器可越两境而战',
          ),
          createField(
            '天赋与资质分类',
            '天才/庸才/废材判定标准（开局羞辱戏依据）',
            '玄脉九品，九品最劣，主角为失传隐品',
          ),
          createField(
            '修炼资源体系',
            '天材地宝分级、修炼场所、传承途径',
            '灵药一到九品；秘境开启权=势力大战导火索',
          ),
          createField(
            '辅助职业体系',
            '炼丹师/阵法师等级认证与社会地位',
            '丹师一至九品，七品丹师大宗掌门执礼相迎',
          ),
        ],
      },
      {
        name: '三、规则与克制',
        fields: [
          createField(
            '力量克制关系',
            '流派/属性间的克制循环',
            '体修克阵修，阵修克剑修，剑修克体修',
          ),
          createField(
            '越级挑战规则',
            '越级的可能性与代价（爽点上限）',
            '越一境为天才，越两境为妖孽；越级必付代价',
          ),
          createField(
            '基础能力门槛',
            '飞行/神识/传音/辟谷/御器分别从哪个境界开始——读者最高频疑问点',
            '辟谷自凝罡始；御器飞行自玄丹始；神识传音自凝罡始',
          ),
          createField(
            '受伤与恢复规则',
            '伤势影响战力、疗伤手段与恢复时长',
            '玄丹以下重伤需月余；重伤者仅剩三成战力',
          ),
          createField('心魔/走火入魔', '修炼副作用与精神风险', '强行冲关或执念过深生心魔'),
          createField(
            '禁术与禁忌手段',
            '强大但有可怕代价的手段',
            '燃烧玄脉换三息登仙之力，代价永久跌境',
          ),
          createField(
            '等级与年龄常态',
            '几岁到几境算天才/普通人',
            '三十岁前凝罡为天才，五十岁玄丹为精英',
          ),
          createField(
            '战力人口金字塔',
            '各境界占修行人口百分比',
            '淬体聚灵占九成九；凝罡千里挑一；合道全洲双手之数',
          ),
          createField(
            '战力崩坏防范',
            '强敌出场锁上限、越级付代价、战斗查锚点',
            '强敌出场即在历史事件表锁定境界上限',
          ),
        ],
      },
      {
        name: '四、与主角的接口',
        fields: [
          createField(
            '金手指与体系的关系',
            '金手指是例外、漏洞还是更高层规则',
            '废脉实为混沌神体，可吞噬灵气与血脉进化',
          ),
          createField(
            '金手指的限制与代价',
            '规则边界、使用条件与代价',
            '吞噬过量反噬昏迷；气息外泄即遭神族追杀',
          ),
          createField(
            '金手指的成长路线',
            '分段解锁新功能，防前期膨胀后期无牌',
            '卷一吞灵气→卷三吞血脉→卷五吞法则→卷七吞规则',
          ),
          createField(
            '体系的隐藏层级',
            '体系之上还有体系（中后期扩容）',
            '登仙之上另有神境，为上古神族垄断',
          ),
          createField(
            '体系背后的世界观真相',
            '体系为何存在？谁制定的？',
            '玄脉是神族种在人族体内的灵气收割器',
          ),
        ],
      },
    ],
    tips: ['等级一旦正文发布尽量不改；定稿前先写三章试水检验数值膨胀。'],
  },
  {
    id: 'master',
    name: '全书总纲',
    group: '大纲规划',
    type: 'form',
    minimal: !0,
    description:
      '从设定到大纲的桥梁：主线一句话、大结局、反派序列、分卷规划——它是所有分卷大纲的母表，改子表先改母表。',
    modules: [
      {
        name: '一、故事内核',
        fields: [
          createField(
            '主线一句话',
            '全书主线用一句话概括',
            '废脉少年以吞噬神体逆天改命，揭破神族收割真相终封神路',
          ),
          createField('核心冲突', '贯穿全书的主要矛盾', '人族修士与幕后收割者神族的千年之局'),
          createField(
            '主角弧光',
            '主角从哪到哪的内在转变',
            '从"证明自己不是废物"到"为天下废脉开一条活路"',
          ),
          createField('主题立意', '全书想表达什么', '命运不公，则亲手打破命运'),
          createField('情感基调', '热血/暗黑/轻松/悲壮', '热血为主，卷五后渐入悲壮'),
        ],
      },
      {
        name: '二、结局规划',
        fields: [
          createField(
            '大结局',
            '结局画面与主角最终归宿',
            '陈渊于北渊封印仙路，与洛清欢并肩，为苍澜开新纪元',
          ),
          createField(
            '各主要角色结局',
            '主要角色各自的归宿',
            '陈瑶觉醒神女与兄并肩；萧景行兵解；青玄子重建青岚宗',
          ),
          createField('终局悬念（可留续作）', '结局留下的口子', '混沌虚空之外，尚有窥探者'),
        ],
      },
      {
        name: '三、反派序列',
        fields: [
          createField('卷一反派', '每卷的主要对手与结局', '萧景行（外门天才）→雨夜截杀败退'),
          createField('卷二反派', '', '血魔教护法→秘境被斩'),
          createField('卷三反派', '', '萧景行+血魔尊者→入魔线'),
          createField('卷四反派', '', '洛家老祖+中州圣地天才'),
          createField('卷五反派', '', '神族清道夫（掳陈瑶）'),
          createField('终极反派', '贯穿全书幕后黑手', '神族收割计划的执棋者'),
        ],
      },
      {
        name: '四、分卷规划一览',
        fields: [
          createField(
            '分卷数量与各卷卷名',
            '每卷一句话定位',
            '七卷：风起云州/秘境争锋/魔影东洲/中州风云/神族降世/北渊真相/封天',
          ),
          createField(
            '各卷主角境界区间',
            '防止升级节奏失控',
            '卷一淬体→聚灵；卷二通脉；卷三凝罡；卷四玄丹；卷五化神；卷六返虚；卷七合道',
          ),
          createField(
            '贯穿全书的暗线',
            '明线之外的隐藏线',
            '老瞎子身份线：从守塔老奴到上古叛神残魂',
          ),
        ],
      },
      {
        name: '五、修订记录',
        fields: [
          createField('总纲修订记录', '每卷结束回看修订一次', 'v1.0 初稿；卷一完结后修订卷二节奏'),
        ],
      },
    ],
    tips: ['动笔前总纲必填；每卷结束回看修订一次。'],
  },
  {
    id: 'style',
    name: '写作规范',
    group: '运营维护',
    type: 'form',
    minimal: !0,
    description:
      '文风宪法：人称视角、句式偏好、标点格式、个人坏习惯清单——百万字连载文风漂移是大概率事件，先立法后写作。',
    modules: [
      {
        name: '一、叙事规范',
        fields: [
          createField('叙事人称', '第一人称/第三人称限知/全知', '第三人称限知，以陈渊视角为主'),
          createField(
            '视角切换规则',
            '什么情况切换视角、频率限制',
            '每章至多一次视角切换，切前空一行',
          ),
          createField('时态与叙述习惯', '顺叙为主/插闪回规则', '顺叙为主，闪回不超过三百字'),
        ],
      },
      {
        name: '二、语言风格',
        fields: [
          createField(
            '句式偏好',
            '长短句节奏、对话描写比例',
            '短句为主打斗，长句写景；对话:叙述约4:6',
          ),
          createField(
            '对话风格',
            '人物说话的区分度规则',
            '陈渊冷而不装；萧景行绵里藏针；铁柱大白话',
          ),
          createField('描写尺度', '暴力/情感描写的边界', '战斗写实但不嗜血；感情线含蓄'),
          createField('幽默与梗', '是否用网络梗', '少用，铁柱负责轻松戏份'),
        ],
      },
      {
        name: '三、格式规范',
        fields: [
          createField('章节结构习惯', '每章开头/收尾的固定模式', '章末必留钩子；开头三行内入戏'),
          createField('标点规范', '省略号/破折号/引号使用规则', '省略号用"……"；对话一律双引号'),
          createField('数字写法', '境界/年份/数字的写法统一', '境界用汉字"三重"；年份"灵历3024年"'),
        ],
      },
      {
        name: '四、个人坏习惯与自检',
        fields: [
          createField('已知坏习惯清单', '写作中发现自己的高频问题', '高频词："顿时""瞬间"滥用'),
          createField('每章自检三问', '发布前自问', '①钩子够不够②爽点有没有③字数达标没'),
        ],
      },
    ],
    tips: ['开书前把本表填掉，先立法后写作。'],
  },
  {
    id: 'char-main',
    name: '主要角色',
    group: '角色管理',
    type: 'card',
    description:
      '核心人物档案：主角团、贯穿全书的角色与终极反派。先填主角+核心配角3~5人+终极反派；反派要按主角待遇认真填。',
    modules: [
      {
        name: '一、基础信息',
        fields: [
          createField('姓名', '姓名及来历含义', '陈渊：深渊之渊，父望其深沉'),
          createField(
            '别称',
            '外号 / 别名 / 曾用名，多个用顿号或逗号分隔；正文出现别称时系统会识别为同一人物',
            '',
          ),
          createField(
            '保密等级',
            '设定保密/重要度分级：S绝密(剧透管控)/A重要(主线关键)/B次要(支线)/C琐碎(日常)',
            'C',
          ),
          createField('身份定位', '在故事中的核心身份', '主角·青岚宗杂役弟子'),
          createField('种族', '所属种族 / 血脉，选项来自《种族生物》', ''),
          createField('年龄/性别', '开篇年龄', '16岁/男'),
          createField(
            '外貌特征',
            '有记忆点的特征，避免模板化',
            '瘦削但筋骨匀称，左腕有暗金胎记，眼神沉静',
          ),
          createField('首次出场', '第一次登场的章节与方式', '第1章测灵大典'),
          createField(
            '活跃卷与出场频率',
            '哪些卷高频出场、哪些卷退居幕后',
            '全书高频；卷五因重伤沉寂十章',
          ),
          createField('人物状态', '角色在故事中的状态', '未登场'),
        ],
      },
      {
        name: '二、性格与内心',
        fields: [
          createField('核心性格', '3个关键词+具体行为表现', '坚韧、护短、藏拙：受辱不辩但记账'),
          createField(
            '核心矛盾/内在挣扎',
            '最迷人的角色是矛盾的结合体',
            '想守着妹妹安稳，又不得不走向深渊',
          ),
          createField('价值观与底线', '什么绝不会做', '不伤无辜，不用吞噬活人血脉'),
          createField('说话风格', '语言习惯与口头禅', '话少，关键处一句定音'),
          createField(
            '恐惧与渴望',
            '内心最深的恐惧与渴望',
            '恐惧：再次失去家人；渴望：查清灭门真相',
          ),
        ],
      },
      {
        name: '三、能力与成长',
        fields: [
          createField('实力境界', '当前境界与成长轨迹', '淬体一重起步→卷七合道'),
          createField('功法/技能', '修炼的功法与招式', '混沌吞天诀（上古神体配套功法）'),
          createField(
            '金手指/特殊能力',
            '特殊能力及其限制',
            '吞噬进化：吞灵气/血脉/法则，过量反噬',
          ),
          createField('装备法宝', '标志性装备', '青铜小塔（器灵沉睡）'),
          createField('战斗风格', '怎么打架', '先守后攻，藏底牌，绝境爆发'),
        ],
      },
      {
        name: '四、背景与关系',
        fields: [
          createField('出身背景', '家庭与身世', '云州陈家，父母双亡，身负神族血脉'),
          createField('关键过往经历', '塑造性格的往事', '七岁目睹灭门，老瞎子救至青岚山'),
          createField(
            '人际关系',
            '重要关系一览',
            '妹妹陈瑶（唯一血亲）；老瞎子（救命恩人）；洛清欢（CP）',
          ),
          createField('所属势力', '阵营与组织', '青岚宗杂役院→亲传→自立门户'),
          createField(
            '地理位置',
            '该角色当前/主要活动的地理位置，选项来自《地理风物》',
            '云州·青岚宗',
          ),
          createField(
            '隐藏设定',
            '不为读者所知的秘密（仅设定集）',
            '混沌神体：神族收割计划的唯一变数',
          ),
        ],
      },
      {
        name: '五、剧情功能',
        fields: [
          createField('角色弧光', '从哪到哪的转变', '废脉弃子→人族破局者'),
          createField('高光名场面', '预留的高光时刻', '卷六雨夜再战萧景行·兵解'),
          createField('结局归宿', '最终归宿', '封印仙路，开苍澜新纪元'),
          createField('死亡/退场规划', '若退场，怎么退', '不死'),
        ],
      },
    ],
    tips: ['对着角色卡连问三个"为什么"，问到第三个为什么，动机才立得住。'],
  },
  {
    id: 'char-secondary',
    name: '次要角色',
    group: '角色管理',
    type: 'card',
    description:
      '阶段性重要角色：宿敌、导师、重要配角。全书约5~15人，详细度介于主要与NPC之间，戏份变了及时升降级。相比NPC卡多了出身、性格矛盾、能力细节；相比主要卡少了价值观/恐惧等最深层设定与弧光规划。',
    modules: [
      {
        name: '一、基础信息',
        fields: [
          createField('姓名', '', '萧景行'),
          createField('别称', '外号 / 别名 / 曾用名，多个用顿号或逗号分隔', ''),
          createField(
            '保密等级',
            '设定保密/重要度分级：S绝密(剧透管控)/A重要(主线关键)/B次要(支线)/C琐碎(日常)',
            'B',
          ),
          createField('身份定位', '', '中期宿敌·青岚宗内门大师兄'),
          createField('种族', '所属种族 / 血脉，选项来自《种族生物》', ''),
          createField('年龄/性别', '开篇年龄', '19岁/男'),
          createField('外貌特征', '有记忆点的特征，避免模板化', '白衣佩玉，笑容温润'),
          createField('首次出场', '第一次登场的章节与方式', '第3章'),
          createField('活跃卷与出场频率', '哪些卷高频出场、哪些卷退居幕后', '活跃于卷一至卷六'),
          createField('人物状态', '角色在故事中的状态', '未登场'),
        ],
      },
      {
        name: '二、性格与动机',
        fields: [
          createField('核心性格', '', '自尊极高，表面谦和实则阴鸷'),
          createField(
            '核心矛盾/内在挣扎',
            '最迷人的角色是矛盾的结合体',
            '自认天命之子，却总被陈渊压一头',
          ),
          createField('核心动机', '他为什么要做这些事', '证明自己是天命之子，不容任何人遮蔽'),
          createField('说话风格', '语言习惯与口头禅', '温言带刺，捧杀于无形'),
          createField('与主角的关系', '', '假善提携→暗斗→决裂→宿敌'),
        ],
      },
      {
        name: '三、能力与剧情',
        fields: [
          createField('实力境界', '当前境界与成长轨迹', '聚灵巅峰起步→卷六玄丹'),
          createField('实力与功法', '', '天才资质，青岚剑诀大成；卷三入血魔道'),
          createField('金手指/特殊能力', '特殊能力及其限制（无可留空）', ''),
          createField('装备法宝', '标志性装备', '玉令（可调下属散修）'),
          createField('战斗风格', '怎么打架', '剑走轻灵，借势压人'),
          createField('剧情功能', '在故事中承担什么作用', '天才对照组+中期宿敌+入魔线'),
          createField('结局归宿', '', '卷六雨夜再战，兵解'),
        ],
      },
      {
        name: '四、背景与关系',
        fields: [
          createField('出身背景', '家庭与身世', '中州萧家旁支，庶出'),
          createField('关键过往经历', '塑造性格的往事', '少年时被嫡兄夺走机缘，自此不信亲情'),
          createField(
            '人际关系',
            '重要关系一览',
            '陈渊（宿敌）；洛清欢（旧识）；血魔尊者（后期合作）',
          ),
          createField('所属势力', '所属阵营 / 组织，选项来自《国家势力》', '青岚宗'),
          createField('地理位置', '该角色当前/主要活动的地理位置，选项来自《地理风物》', ''),
          createField('隐藏设定', '不为读者所知的秘密（仅设定集，无可留空）', ''),
        ],
      },
    ],
    tips: [
      '次要角色全书约5~15人；戏份变了及时在主要/NPC卡之间升降级。次要卡信息密度介于主要与NPC之间：比NPC多出身/性格矛盾/能力细节/背景关系，比主要少价值观·恐惧等最深层设定与弧光规划。',
    ],
  },
  {
    id: 'char-npc',
    name: 'NPC角色',
    group: '角色管理',
    type: 'card',
    minimal: !0,
    description:
      '功能型角色简明档案：重点写"功能定位"——导师型/打脸对象/情报源/伏笔承载者/氛围组，写清功能就不会写崩。',
    modules: [
      {
        name: 'NPC档案',
        fields: [
          createField('姓名', '', '王铁柱'),
          createField('别称', '外号 / 别名 / 曾用名，多个用顿号或逗号分隔', ''),
          createField(
            '保密等级',
            '设定保密/重要度分级：S绝密(剧透管控)/A重要(主线关键)/B次要(支线)/C琐碎(日常)',
            'C',
          ),
          createField('身份', '', '杂役院伙伴·屠户之子'),
          createField('所属势力', '所属阵营 / 组织，选项来自《国家势力》', ''),
          createField('地理位置', '该角色当前/主要活动的地理位置，选项来自《地理风物》', ''),
          createField('年龄/性别/外貌特征', '', '20岁/男，身材魁梧、剑眉星目'),
          createField('功能定位', '导师/打脸对象/情报源/伏笔承载/氛围组', '损友+氛围组+温情线承载'),
          createField('一句话性格', '', '莽直忠厚，嗓门大心眼实'),
          createField('口癖/记忆点', '', '"渊哥，俺跟你干！"'),
          createField('关键出场', '', '第2章起贯穿杂役院戏份'),
          createField('人物状态', '角色在故事中的状态', '未登场'),
        ],
      },
    ],
    tips: ['NPC的"功能定位"最重要，写清功能就不会写崩。'],
  },
  {
    id: 'relations',
    name: '人物关系',
    group: '角色管理',
    type: 'table',
    lite: !0,
    description:
      '人物两两关系台账：关系现状、知情度、按卷演变——防"关系失忆"与"泄密穿帮"。关系质变新增一行而非覆盖。',
    columns: [
      createCharCol('人物A'),
      createCharCol('人物B'),
      createCol('关系类型', ['亲属', '师徒', '盟友', '敌对', '竞争', 'CP感情线', '主仆', '恩怨']),
      createCol('关系现状'),
      createCol('知情度（互相知道什么）'),
      createCol('关系起点/契机'),
      createCol('演变轨迹（按卷）'),
      createCol('演变触发事件'),
      createCol('关系终点'),
      createCol('戏剧功能'),
      createCol('备注'),
    ],
    displayCol: '人物A',
    subtitleCol: '人物B',
    tips: ['每卷结束整体过一遍本表；"知情度"与《知情权限》联动。'],
  },
  {
    id: 'nations',
    name: '国家势力',
    group: '世界构建',
    type: 'table',
    lite: !0,
    description:
      '王朝/宗门/世家/商会档案：一势力一列，含实力构成、内部派系与剧情作用。支持「上级」隶属（如宗门下的分坛、世家分支），表格内按上下级渲染成可折叠的树。',
    columns: [
      createCol('编号'),
      createCol('名称'),
      createRefCol('上级', 'nations', '名称'),
      createCol('别称'),
      createCol('保密等级', ['S', 'A', 'B', 'C']),
      createCol('类别', ['王朝', '宗门', '世家', '商会', '魔道', '隐秘组织', '神族']),
      createRefCol('地理位置', 'geography', '名称'),
      createCol('实力等级'),
      createCol('镇派功法/核心武力'),
      createCol('掌权者'),
      createCol('内部派系与权力斗争'),
      createCol('历史沿革'),
      createCol('经济来源'),
      createCol('对外关系'),
      createCol('与主角关系'),
      createCol('剧情作用'),
      createCol('备注'),
    ],
    displayCol: '名称',
    subtitleCol: '类型',
    codeRule:
      '编号规则：N + 4 位序号（N0001、N0002…，N=Nation 势力）。新增行自动按当前最大序号 +1 编号（从 0001 起）；同表前缀统一、序号递增；已删除条目的编号不复用，避免别处引用错位。',
    tips: ['一势力一行；内部派系是冲突富矿，别只写"铁板一块"。'],
  },
  {
    id: 'faction-rels',
    name: '势力关系',
    group: '世界构建',
    type: 'table',
    lite: !0,
    description:
      '王朝/宗门/世家/商会之间的同盟·敌对·贸易·从属关系台账，驱动「势力关系」（力导向可视化）。节点可跳转《国家势力》，并挂接所属成员角色（联动角色卡"所属势力"）。',
    columns: [
      createRefCol('势力A', 'nations', '名称'),
      createRefCol('势力B', 'nations', '名称'),
      createCol('关系类型', ['同盟', '敌对', '贸易', '从属', '中立']),
      createCol('关系现状'),
      createCol('备注'),
    ],
    displayCol: '势力A',
    subtitleCol: '关系类型',
    tips: [
      '关系质变新增一行而非覆盖；图谱按关系类型着色（同盟/敌对/贸易/从属/中立）。势力名称来自《国家势力》，无法手动输入，根治同名异写。',
    ],
  },
  {
    id: 'geography',
    name: '地理风物',
    group: '世界构建',
    type: 'table',
    lite: !0,
    description:
      '大陆/区域/城市/秘境/禁地档案，含层级归属、距离行程与危险等级。距离务必写死——很多时间bug其实是路没算。「层级归属」为结构化父级（指向本表其它地名，如城市归属某区域），表格内按地理层级渲染成可折叠的树。',
    columns: [
      createCol('编号'),
      createCol('名称'),
      createCol('别称'),
      createCol('保密等级', ['S', 'A', 'B', 'C']),
      createCol('类别', ['大陆', '区域', '国家', '城市', '秘境', '禁地', '遗迹', '山脉']),
      createRefCol('层级归属', 'geography', '名称'),
      createCol('地理位置'),
      createCol('距离与行程时间'),
      createCol('范围与面积'),
      createCol('相对地理位置'),
      createCol('地貌与气候'),
      createRefCol('势力归属', 'nations', '名称'),
      createCol('特色资源/特产'),
      createCol('危险等级', ['低', '中', '高', '极高']),
      createCol('风土人情（一句话）'),
      createCol('剧情作用'),
      createCol('备注'),
      createHiddenId('地图格子'),
    ],
    displayCol: '名称',
    subtitleCol: '类型',
    codeRule:
      '编号规则：G + 4 位序号（G0001、G0002…，G=Geography 地理）。新增行自动按当前最大序号 +1 编号（从 0001 起）；同表前缀统一、序号递增；已删除条目的编号不复用。',
    tips: [
      '"距离与行程时间"是时间线对账的直接锚点，务必写死（从哪到哪、坐什么、几天）。',
      '「地图格子」为地图编辑内部数据，已在本表隐藏，请勿手填——在地图编辑用「绘制地图」涂格生成。',
      '「范围与面积」自由描述（如"东西八千里、南北六千里，约 42 万平方公里"）；「相对地理位置」写它相对周边的关系（如"北靠中脉、南临沧海"）。',
      '地理形状完全由你在「地图编辑」亲手绘制：不限制形状和格子数，只要求子范围必须完全画在父范围之内（无飞地）。',
    ],
  },
  {
    id: 'geography-map',
    name: '地图编辑',
    group: '世界构建',
    type: 'map',
    lite: !0,
    description:
      '在《地理风物》之上叠一层手绘格子地图：点「绘制地图」选择一个范围后，左键涂格、右键退出，形状与格子数完全由你自由设计；按「层级归属」分层叠色，只要求子范围完全画在父范围之内（无飞地）。可叠加伏笔/角色/时间线关联（按「地理位置」字段精确联动）。',
    tips: [
      '格子档位右上角切换（每格边长 1 公里精细 / 10 公里粗略）：画大陆切粗档快速铺满，画城池切回精档。',
      '滚轮缩放画面、拖空白平移；绘制模式下左键涂/擦格子，右键取消退出。',
      '叠加伏笔/角色/时间线前，先在对应表格或角色卡里填好「地理位置」（下拉选自《地理风物》）。',
    ],
  },
  {
    id: 'races',
    name: '种族生物',
    group: '世界构建',
    type: 'table',
    lite: !0,
    description:
      '种族、魔兽、灵兽档案，含威胁等级与契约关系。支持「上级」隶属（填本表其它条目名称即形成上下级树，可折叠 / 新增子条目）。',
    columns: [
      createCol('编号'),
      createCol('名称'),
      createRefCol('上级', 'races', '名称'),
      createCol('别称'),
      createCol('保密等级', ['S', 'A', 'B', 'C']),
      createCol('类别', ['人族', '神族', '魔族', '魔兽', '灵兽', '古族', '异种']),
      createCol('分布区域'),
      createCol('威胁等级', ['无害', '低', '中', '高', '灾难级']),
      createCol('能力特性'),
      createCol('弱点'),
      createCol('契约/驯化关系'),
      createCol('社会结构'),
      createCol('与主线关系'),
      createCol('备注'),
    ],
    displayCol: '名称',
    subtitleCol: '类别',
    codeRule:
      '编号规则：R + 4 位序号（R0001、R0002…，R=Race 种族生物）。新增行自动按当前最大序号 +1 编号（从 0001 起）；同表前缀统一、序号递增；已删除条目的编号不复用。',
    tips: ['每写出一个新种族/魔兽当日登记。'],
  },
  {
    id: 'items',
    name: '物品资源',
    group: '世界构建',
    type: 'table',
    lite: !0,
    description:
      '功法、法宝、丹药、材料、货币档案，品级体系一目了然。与力量体系的品级标准对齐。支持「上级」隶属（填本表其它条目名称即形成上下级树，可折叠 / 新增子条目）。',
    columns: [
      createCol('编号'),
      createCol('名称'),
      createRefCol('上级', 'items', '名称'),
      createCol('别称'),
      createCol('保密等级', ['S', 'A', 'B', 'C']),
      createCol('类别', ['功法', '法宝', '丹药', '材料', '货币', '传承', '其他']),
      createCol('品级'),
      createCol('来源/出处'),
      createCol('能力/效果'),
      createCol('限制与代价'),
      createCharCol('当前持有者'),
      createCol('流转轨迹'),
      createCol('剧情作用'),
      createCol('备注'),
    ],
    displayCol: '名称',
    subtitleCol: '类别',
    codeRule:
      '编号规则：I + 4 位序号（I0001、I0002…，I=Item 物品资源）。新增行自动按当前最大序号 +1 编号（从 0001 起）；同表前缀统一、序号递增；已删除条目的编号不复用。',
    tips: ['重要物品的"流转轨迹"记清楚——谁给谁、怎么给、何时给。'],
  },
  {
    id: 'history',
    name: '历史事件',
    group: '世界构建',
    type: 'table',
    lite: !0,
    description:
      '编年史台账：倒推法填写（从大结局倒推到开篇），含"民间流传版本vs真相"双版本。支持「上级」隶属（填本表其它事件名称即形成上下级树，可折叠 / 新增子条目）。',
    columns: [
      createCol('编号'),
      createCol('事件名称'),
      createRefCol('上级', 'history', '事件名称'),
      createCol('别称'),
      createCol('保密等级', ['S', 'A', 'B', 'C']),
      createCalendarSelectCol('历法'),
      createDateCol('故事内时间', 'w-40'),
      createCol('距今时长'),
      createCol('事件经过（真相）'),
      createCol('民间流传版本（vs真相）'),
      createCol('参与者/关联者'),
      createCol('影响与后果'),
      createCol('状态', ['已定稿', '待补充', '已变更']),
      createCol('对应伏笔编号'),
      createCol('已发布章节是否提及'),
      createCol('备注'),
    ],
    displayCol: '事件名称',
    subtitleCol: '故事内时间',
    codeRule:
      '编号规则：H + 4 位序号（H0001、H0002…，H=History 历史事件）。新增行自动按当前最大序号 +1 编号（从 0001 起）；关联伏笔填 F 编号，其他表格中输入 H0001 可直接跳转过来。',
    tips: [
      '倒推法：从大结局倒推到开篇；"民间版本vs真相"的落差本身就是剧情。',
      '"故事内时间"须用严格日期格式（某年某月某日）；跨历法顺序由「历法」列的数值判定（如 上古历=-1 早于 灵历=0），同一历法内按故事内时间排序。',
    ],
  },
  {
    id: 'terms',
    name: '名词术语',
    group: '世界构建',
    type: 'table',
    description:
      '全书专有名词字典，防止"同一事物两个名字"的前后矛盾。所有专有名词进术语表。支持「上级」隶属（填本表其它术语名称即形成上下级树，可折叠 / 新增子条目）。',
    columns: [
      createCol('编号'),
      createCol('名称'),
      createRefCol('上级', 'terms', '名称'),
      createCol('保密等级', ['S', 'A', 'B', 'C']),
      createCol('类别', ['境界', '功法', '法宝', '地名', '组织', '种族', '称谓', '物品', '其他']),
      createCol('定义（一句话）'),
      createCol('首次出现章节'),
      createCol('命名备注'),
      createCol('状态', ['使用中', '已废弃', '已改名']),
    ],
    displayCol: '名称',
    subtitleCol: '类别',
    codeRule:
      '编号规则：T + 4 位序号（T0001、T0002…，T=Term 术语）。新增行自动按当前最大序号 +1 编号（从 0001 起）；同表前缀统一、序号递增；已删除条目的编号不复用。',
    tips: ['命名保持同一词根风格，避免读者记忆过载。'],
  },
  {
    id: 'chapter-master',
    name: '章节总表',
    group: '大纲规划',
    type: 'table',
    minimal: !0,
    newestFirst: !0,
    description:
      '全书章节主台账的只读汇总视图。自「按卷建表」后，每卷各自一张「章节台账」表（见左侧「章节总表」下的各卷子项），此处聚合所有卷的章节供全局核对。每章一行，串联伏笔/时间脉络/爽点三张表的对齐主轴。',
    columns: OUTLINE_TABLE_COLUMNS,
    displayCol: '章节标题',
    subtitleCol: '细纲状态',
    tips: [
      '章节按卷分表管理：左侧「章节总表」下每个卷各是一张独立表，点进去编辑该卷章节。',
      '本页是只读汇总（全局核对用），编辑请进入对应卷的台账表。',
      '伏笔/时间脉络/爽点三张"每章一行"的表都靠章节台账对齐。',
    ],
  },
  {
    id: 'foreshadow',
    name: '伏笔追踪',
    group: '创作管理',
    type: 'table',
    lite: !0,
    description:
      '埋一条登记一条。含"重要度"与"回收前置条件"，防止前置没铺就强行回收。全书级伏笔每卷末必点检一次，防烂尾。',
    columns: [
      createCol('编号'),
      createCol('伏笔内容'),
      createCol('重要度', ['全书级', '卷级', '小伏笔']),
      createCol('埋设位置'),
      createCol('计划回收位置'),
      createRefCol('地理位置', 'geography', '名称'),
      createCol('回收前置条件'),
      createCol('状态', ['未回收', '已回收', '已作废']),
      createCol('回收方式与效果'),
      createCol('备注'),
    ],
    displayCol: '伏笔内容',
    subtitleCol: '重要度',
    codeRule:
      '编号规则：F + 4 位序号（F0001、F0002…，F=Foreshadow 伏笔）。新增行自动按当前最大序号 +1 编号（从 0001 起）；埋一条编一号、序号递增不复用；章节总表/支线剧情等处输入 F0001 可直接跳转。',
    tips: [
      '"回收前置条件"必须写清——前置没铺就强行回收，效果大打折扣。',
      '「地理位置」列从《地理风物》下拉选择，地图编辑按它在对应范围上叠加伏笔高亮框。',
    ],
  },
  {
    id: 'timeline',
    name: '时间脉络',
    group: '创作管理',
    type: 'table',
    lite: !0,
    description:
      '正文实际流逝时间的追踪台账：每章一行，防时间线崩坏。写完一章立刻登记，发现冲突立刻改。',
    columns: [
      createCol('章节号'),
      createCol('章节标题'),
      createCol('线/轨道', [
        '主线',
        '支线',
        '暗线',
        '感情线',
        '身世线',
        '成长线',
        '复仇线',
        '其他',
      ]),
      createCalendarSelectCol('历法'),
      createDateCol('故事内时间', 'w-40'),
      createCol('时节/季节'),
      createCol('经过天数', void 0),
      createCol('主角当前境界/年龄'),
      createCol('重要人物位置与状态'),
      createRefCol('地理位置', 'geography', '名称'),
      createCol('本章关键事件'),
      createCol('时间线检查', ['正常', '已修正', '待核对']),
      createCol('备注'),
    ],
    displayCol: '章节标题',
    subtitleCol: '故事内时间',
    tips: [
      '"故事内时间"须用严格日期格式（某年某月某日）；跨历法顺序由「历法」列的数值判定（如 上古历=-1 早于 灵历=0），同一历法内按故事内时间排序。',
      '天数对不上时先查《地理风物》"距离与行程时间"列。',
      '「地理位置」列从《地理风物》下拉选择本章发生地，地图编辑按它在对应范围上叠加时间脉络高亮框。',
    ],
  },
  {
    id: 'plot-canvas',
    name: '情节推演',
    group: '创作管理',
    type: 'canvas',
    lite: !0,
    description:
      '演进简报的可视化升级：多选章节 → 复用「颉文姬·灵感简报」同一套 aiBriefing 管线生成结构化卡片（待办伏笔 / 钩子爽点 / 角色状态 / 下一章衔接）→ 卡片可拖拽、可连成推演链。与简报共享同一 AI 管线，不另起平行孤岛。',
    tips: [
      '先选左侧若干章节，点「生成推演」；卡片可拖动排布，连接模式下点两张卡连成推演链。需先配置 AI 模型。',
    ],
  },
  {
    id: 'hookpoints',
    name: '爽点节奏',
    group: '创作管理',
    type: 'table',
    minimal: !0,
    description:
      '每章爽点/钩子/间隔的节奏管控表。写章节细纲时就排好爽点节奏，间隔超3章必须插爽点。',
    columns: [
      createCol('章节号'),
      createCol('章节标题'),
      createCol('爽点类型', ['打脸', '升级', '获宝', '逆转', '扬名', '复仇', '揭秘', '温情']),
      createCol('爽点内容'),
      createCol('铺垫章节'),
      createCol('爽点强度', ['小', '中', '大', '名场面']),
      createCol('章末钩子'),
      createCol('距上个爽点间隔（章）'),
      createCol('状态', ['已排', '已写', '已发布']),
      createCol('备注'),
    ],
    displayCol: '爽点内容',
    subtitleCol: '爽点类型',
    tips: ['爽点间隔超3章自动预警；每章结尾必有钩子——连载形态下章末平淡=流失读者。'],
  },
  {
    id: 'progress',
    name: '写作进度',
    group: '创作管理',
    type: 'table',
    minimal: !0,
    description: '每日字数流水账。无论写了多少字都记录，底部自动统计产量。',
    columns: [
      createCalendarCol('日期'),
      createCol('章节'),
      createCol('实际字数'),
      createCol('计划字数'),
      createCol('完成状态', ['未达标', '达标', '超额', '断更']),
      createCol('存稿缓冲（章）'),
      createCol('备注'),
    ],
    displayCol: '章节',
    subtitleCol: '完成状态',
    tips: ['存稿缓冲低于3章预警；每日更新，不要攒着补记。'],
  },
  {
    id: 'subplots',
    name: '支线剧情',
    group: '创作管理',
    type: 'table',
    minimal: !0,
    description:
      '感情线/身世线/暗线等多线并行的进度台账：起点、关键节点、与主线汇合点。哪条线断了进度一眼看出。',
    columns: [
      createCol('编号'),
      createCol('支线名称'),
      createCol('类别', ['感情线', '身世线', '暗线', '复仇线', '成长线', '其他']),
      createCol('关联人物'),
      createCol('支线目标'),
      createCol('起点'),
      createCol('关键节点1'),
      createCol('关键节点2'),
      createCol('关键节点3'),
      createCol('与主线汇合点'),
      createCol('当前进度'),
      createCol('状态', ['规划中', '推进中', '已完结', '已搁置']),
      createCol('备注'),
    ],
    displayCol: '支线名称',
    subtitleCol: '类型',
    codeRule:
      '编号规则：LINE + 4 位序号（LINE0001、LINE0002…）。新增行自动按当前最大序号 +1 编号（从 0001 起）；同表前缀统一、序号递增；已删除条目的编号不复用。',
    tips: ['每条支线在进度检查时过一遍：是不是太久没推进了？'],
  },
  {
    id: 'secrets',
    name: '知情权限',
    group: '创作管理',
    type: 'table',
    lite: !0,
    description:
      '谁知道主角的秘密、谁知道哪个真相——防"泄密穿帮"这一吃书重灾区的专用台账。读者对"谁知道什么"记得比你牢。',
    columns: [
      createCol('编号'),
      createCol('秘密内容'),
      createCharsCol('知情者'),
      createCol('知情程度', ['完全知情', '知道部分', '隐约察觉', '已遗忘/被抹除']),
      createCol('如何知道'),
      createCol('何时知道（章节）'),
      createCol('是否可能泄露'),
      createCol('泄露风险等级', ['低', '中', '高']),
      createCol('计划揭晓章节'),
      createCol('备注'),
    ],
    displayCol: '秘密内容',
    subtitleCol: '知情者',
    codeRule:
      '编号规则：S + 4 位序号（S0001、S0002…，S=Secret 秘密）。新增行自动按当前最大序号 +1 编号（从 0001 起）；一秘一号、序号递增不复用；同一秘密新增知情者时另起一行（编号不变可加后缀，如 S0001-002）。',
    tips: ['每当有角色知悉某个秘密，当天登记——写对话前扫一眼本表。'],
  },
  {
    id: 'changelog',
    name: '设定变更',
    group: '运营维护',
    type: 'table',
    lite: !0,
    description:
      '改设定先登记：影响范围、已发布章节冲突、补丁方案——连载防吃书的最后一道闸。红色冲突未处理前不发布后续章节。',
    columns: [
      createCol('编号'),
      createCalendarCol('变更日期'),
      createCol('变更内容'),
      createCol('旧值'),
      createCol('新值'),
      createCol('变更原因'),
      createCol('影响范围'),
      createCol('已发布章节冲突', ['无', '有-已处理', '有-未处理']),
      createCol('补丁方案'),
      createCol('状态', ['已落实', '待处理', '已放弃']),
    ],
    displayCol: '变更内容',
    subtitleCol: '变更日期',
    codeRule:
      '编号规则：C + 4 位序号（C0001、C0002…，C=Change 变更）。新增行自动按当前最大序号 +1 编号（从 0001 起）；按变更时间先后递增编号，不复用。',
    tips: ['要改设定，先在本表登记——冲突未处理前不发布后续章节。'],
  },
  {
    id: 'ideas',
    name: '灵感素材',
    group: '运营维护',
    type: 'table',
    minimal: !0,
    description:
      '平时攒点子/桥段/金句/场景描写，写细纲卡壳时先翻这里再硬编。灵感出现的当天就登记，过了当晚会忘。',
    columns: [
      createCol('编号'),
      createCol('内容'),
      createCol('类型', ['点子', '桥段', '金句', '场景', '人物', '世界观', '其他']),
      createCol('来源/出处'),
      createCol('适用卷/章节'),
      createCol('状态', ['未用', '已用', '已过期']),
      createCol('备注'),
    ],
    displayCol: '内容',
    subtitleCol: '类型',
    codeRule:
      '编号规则：IDEA + 4 位序号（IDEA0001、IDEA0002…）。新增行自动按当前最大序号 +1 编号（从 0001 起）；灵感当日入库即编号，序号递增不复用。',
    tips: ['灵感即时入库；写细纲卡壳先翻素材库再硬编。'],
  },
  {
    id: 'feedback',
    name: '读者反馈',
    group: '运营维护',
    type: 'table',
    lite: !0,
    description: '连载运营侧：追读/留存/均订数据与章评吐槽的复盘台账。差评是最便宜的编辑意见。',
    columns: [
      createCalendarCol('日期'),
      createCol('数据周期'),
      createCol('追读'),
      createCol('均订'),
      createCol('留存'),
      createCol('高频吐槽'),
      createCol('流失点章节'),
      createCol('流失原因分析'),
      createCol('应对动作'),
      createCol('效果跟踪'),
      createCol('备注'),
    ],
    displayCol: '日期',
    subtitleCol: '数据周期',
    tips: ['上架后每周登记一次：数据+吐槽+流失点+应对动作。'],
  },
  {
    id: 'about',
    name: '关于打赏',
    group: '运营维护',
    type: 'about',
    description:
      '关于作者与本作，以及支持作者的打赏方式（微信 / 支付宝收款码）。草稿阶段为占位内容，后续由作者替换为真实资料。',
  },
  {
    id: 'volume-outline',
    name: '分卷大纲',
    group: '大纲规划',
    type: 'card',
    lite: !0,
    description:
      '每卷一份：本卷定位、起止点、事件链、爽点节奏、伏笔管理。左侧目录可新增/改名/删除/排序分卷；填写时从全书总纲的"分卷规划一览"取方向。',
    modules: [
      {
        name: '一、本卷定位',
        fields: [
          createField('卷名', '', '风起云州'),
          createField('本卷一句话定位', '这一卷讲什么', '废脉少年觉醒神体，从杂役到外门第一人'),
          createField('主角境界区间', '从哪境到哪境', '淬体一重→聚灵三重'),
          createField('舞台范围', '地理范围', '云州·青岚宗'),
        ],
      },
      {
        name: '二、起止与节奏',
        fields: [
          createField(
            '本卷开头（卷首状态）',
            '主角/各方势力开场状态',
            '陈渊兄妹寄居杂役院，受尽白眼',
          ),
          createField('第一大高潮', '', '雨夜反杀·越境胜聚灵'),
          createField('卷中转折', '', '萧景行假提携真打压被识破'),
          createField('卷末高潮', '', '外门大比夺魁·真相一角初揭'),
          createField('本卷结尾（卷末状态）', '为下卷留的口子', '获得秘境名额，血魔教浮出水面'),
          createField('本卷章数预估', '', '约60章，18万字'),
        ],
      },
      {
        name: '三、事件链',
        fields: [
          createField(
            '事件链（起→承→转→合）',
            '按顺序列出本卷核心事件',
            '测灵废脉→觉醒神体→杂役受辱→雨夜截杀→外门大比→卷末揭密',
          ),
          createField('支线事件', '本卷的次要事件', '兄妹温情线；铁柱友情线；塔灵初步沟通'),
        ],
      },
      {
        name: '四、伏笔管理',
        fields: [
          createField('本卷新埋伏笔', '编号+内容', 'F0001胎记印记；F0002青铜小塔'),
          createField('本卷回收伏笔', '', 'F0005桂花糖'),
          createField('贯穿伏笔推进', '本卷推进了哪些全书级伏笔', 'F0002塔灵首次出声'),
        ],
      },
      {
        name: '五、角色与势力变化',
        fields: [
          createField('新登场重要角色', '', '洛清欢（卷二起）、血魔教护法'),
          createField('关系变化', '敌友变化', '萧景行：假善→敌意公开化'),
          createField('势力格局变化', '', '血魔教渗入云州'),
        ],
      },
    ],
    tips: ['填写时对照《全书总纲》的分卷规划一览；每卷结束回看修订。'],
  },
  {
    id: 'chapter-outline',
    name: '章节细纲',
    group: '大纲规划',
    type: 'card',
    description:
      '每章一份，细到场景级。左侧目录可新增/改名/删除/排序章节；关键章节用完整细纲，普通章节用"章节总表一行+要点"即可。',
    modules: [
      {
        name: '一、本章定位',
        fields: [
          createField('章节号/标题', '', '第1章 废脉'),
          createField('本章一句话事件', '', '测灵大典判定废脉，当夜神体觉醒'),
          createField('本章功能', '推进主线/铺垫/爽点/情感', '开局冲突+金手指引入'),
          createField('出场人物', '', '陈渊、陈瑶、执事、萧景行'),
          createField('时间地点', '', '灵历3024年三月初九·青岚山演武场'),
        ],
      },
      {
        name: '二、场景细纲',
        fields: [
          createField('场景1', '地点+人物+发生什么', '演武场：测灵珠不亮，满场哄笑，妹妹护兄'),
          createField('场景2', '', '杂役院：兄妹夜话，忆父母'),
          createField('场景3', '', '深夜：胎记发烫，吞灵初觉'),
        ],
      },
      {
        name: '三、爽点与钩子',
        fields: [
          createField('本章爽点', '', '无（第一章立压抑）'),
          createField('章末钩子', '', '识海中传来苍老声音："三千年了……终于等到你"'),
          createField('情绪曲线', '压抑→谷底→微光', '受辱(压)→夜话(缓)→觉醒(扬)'),
        ],
      },
      {
        name: '四、衔接与登记',
        fields: [
          createField('承接上章', '', '无（开篇）'),
          createField(
            '新增设定登记',
            '本章写出的新术语/地点/物品/角色→当日登记到名词术语和各图鉴',
            '神体、测灵大典→名词术语；演武场→地理风物',
          ),
          createField('伏笔操作', '埋/推进/回收了什么', '埋F0001胎记；埋F0002塔灵之声'),
          createField('下章预告方向', '', '首次修炼+塔灵现身'),
        ],
      },
    ],
    tips: ['细纲状态建议：无→已排→已核对；普通章节用章节总表一行+要点即可。'],
  },
  {
    id: 'dashboard',
    name: '写作面板',
    group: '工作面板',
    type: 'dashboard',
    minimal: !0,
    description: '创作全景：今日写作、章节进度、伏笔清点、快捷入口。',
    modules: [],
    columns: [],
  },
  {
    id: 'guide',
    name: '使用指南',
    group: '工作面板',
    type: 'guide',
    minimal: !0,
    description: '页签导航与使用建议。',
    modules: [],
    columns: [],
  },
  {
    id: 'inspire-tools',
    name: '灵感启发',
    group: '灵感工具',
    type: 'inspire',
    description: '随机取名生成器与 AI 辅助规划（脑暴）。',
  },
  {
    id: 'check-tools',
    name: '检查工具',
    group: '灵感工具',
    type: 'check',
    description: '敏感词检测、AI 一致性深度自查与数据体检。',
  },
]
export default TAB_DEFINITIONS

export type TabDefinition = (typeof TAB_DEFINITIONS)[number]
