"""英语单词闪卡词库（二年级水平）。

内置一份贴近二年级英语课本的词库，按主题分类，每个单词都带
中文释义、emoji、简单例句和例句翻译。每轮随机抽取 10 张卡片
（全部认识后弹出庆祝），没记住的词会稍后再次出现。
"""
import random

DECK_SIZE = 10  # 每轮抽卡数量

# 主题分类：(key, 页面上显示的标签)
CATEGORIES = (
    ("all", "全部"),
    ("animals", "动物"),
    ("food", "水果食物"),
    ("colors", "颜色"),
    ("numbers", "数字"),
    ("body", "身体"),
    ("school", "学校"),
    ("family", "家庭"),
)

# 词库：每条为 (单词, 中文, emoji, 例句, 例句翻译)
_RAW = {
    "animals": (
        ("cat", "猫", "🐱", "The cat is cute.", "猫很可爱。"),
        ("dog", "狗", "🐶", "I have a dog.", "我有一只狗。"),
        ("bird", "鸟", "🐦", "The bird can fly.", "鸟会飞。"),
        ("fish", "鱼", "🐟", "The fish swims fast.", "鱼游得很快。"),
        ("duck", "鸭子", "🦆", "The duck says quack.", "鸭子嘎嘎叫。"),
        ("pig", "猪", "🐷", "The pig is fat.", "猪很胖。"),
        ("bear", "熊", "🐻", "The bear likes honey.", "熊喜欢蜂蜜。"),
        ("tiger", "老虎", "🐯", "The tiger is strong.", "老虎很强壮。"),
        ("lion", "狮子", "🦁", "The lion is the king.", "狮子是百兽之王。"),
        ("monkey", "猴子", "🐵", "The monkey climbs trees.", "猴子会爬树。"),
        ("elephant", "大象", "🐘", "The elephant has a long nose.", "大象有长长的鼻子。"),
        ("rabbit", "兔子", "🐰", "The rabbit runs fast.", "兔子跑得快。"),
        ("panda", "熊猫", "🐼", "The panda is black and white.", "熊猫是黑白色的。"),
    ),
    "food": (
        ("apple", "苹果", "🍎", "I eat an apple every day.", "我每天吃一个苹果。"),
        ("banana", "香蕉", "🍌", "The banana is yellow.", "香蕉是黄色的。"),
        ("orange", "橙子", "🍊", "The orange is sweet.", "橙子很甜。"),
        ("pear", "梨", "🍐", "I like the pear.", "我喜欢梨。"),
        ("grape", "葡萄", "🍇", "The grapes are sweet.", "葡萄很甜。"),
        ("peach", "桃子", "🍑", "The peach is soft.", "桃子软软的。"),
        ("cake", "蛋糕", "🍰", "The cake is yummy.", "蛋糕很好吃。"),
        ("bread", "面包", "🍞", "I have bread for breakfast.", "我早餐吃面包。"),
        ("egg", "鸡蛋", "🥚", "This egg is big.", "这个鸡蛋很大。"),
        ("milk", "牛奶", "🥛", "Drink milk every day.", "每天喝牛奶。"),
        ("rice", "米饭", "🍚", "I eat rice for lunch.", "我午餐吃米饭。"),
        ("noodles", "面条", "🍜", "The noodles are long.", "面条长长的。"),
        ("water", "水", "💧", "Drink more water.", "多喝水。"),
        ("juice", "果汁", "🧃", "The juice is sweet.", "果汁很甜。"),
    ),
    "colors": (
        ("red", "红色", "🟥", "The apple is red.", "苹果是红色的。"),
        ("yellow", "黄色", "🟨", "The banana is yellow.", "香蕉是黄色的。"),
        ("blue", "蓝色", "🟦", "The sky is blue.", "天空是蓝色的。"),
        ("green", "绿色", "🟩", "The grass is green.", "草是绿色的。"),
        ("black", "黑色", "⬛", "The cat is black.", "猫是黑色的。"),
        ("white", "白色", "⬜", "The snow is white.", "雪是白色的。"),
        ("brown", "棕色", "🟤", "The bear is brown.", "熊是棕色的。"),
        ("pink", "粉色", "🌸", "The flower is pink.", "花是粉色的。"),
        ("purple", "紫色", "🟣", "The grape is purple.", "葡萄是紫色的。"),
        ("grey", "灰色", "☁️", "The elephant is grey.", "大象是灰色的。"),
    ),
    "numbers": (
        ("one", "一", "1️⃣", "I have one nose.", "我有一个鼻子。"),
        ("two", "二", "2️⃣", "I have two eyes.", "我有两只眼睛。"),
        ("three", "三", "3️⃣", "Three little cats.", "三只小猫。"),
        ("four", "四", "4️⃣", "The chair has four legs.", "椅子有四条腿。"),
        ("five", "五", "5️⃣", "High five!", "来击个掌！"),
        ("six", "六", "6️⃣", "Six birds in the tree.", "树上有六只鸟。"),
        ("seven", "七", "7️⃣", "Seven days in a week.", "一周有七天。"),
        ("eight", "八", "8️⃣", "The spider has eight legs.", "蜘蛛有八条腿。"),
        ("nine", "九", "9️⃣", "Nine stars in the sky.", "天上有九颗星星。"),
        ("ten", "十", "🔟", "I have ten fingers.", "我有十根手指。"),
    ),
    "body": (
        ("head", "头", "🧑", "This is my head.", "这是我的头。"),
        ("face", "脸", "😊", "Wash your face.", "洗洗脸。"),
        ("eye", "眼睛", "👁️", "I see with my eyes.", "我用眼睛看。"),
        ("ear", "耳朵", "👂", "I hear with my ears.", "我用耳朵听。"),
        ("nose", "鼻子", "👃", "This is my nose.", "这是我的鼻子。"),
        ("mouth", "嘴巴", "👄", "Open your mouth.", "张开嘴巴。"),
        ("hand", "手", "✋", "Clap your hands.", "拍拍手。"),
        ("arm", "胳膊", "💪", "My arm is strong.", "我的胳膊很有力。"),
        ("leg", "腿", "🦵", "I walk with my legs.", "我用腿走路。"),
        ("foot", "脚", "🦶", "I stand on my feet.", "我用脚站立。"),
        ("finger", "手指", "☝️", "I have ten fingers.", "我有十根手指。"),
    ),
    "school": (
        ("book", "书", "📖", "I read a book.", "我在读书。"),
        ("bag", "书包", "🎒", "My bag is new.", "我的书包是新的。"),
        ("pen", "钢笔", "🖊️", "This is my pen.", "这是我的钢笔。"),
        ("pencil", "铅笔", "✏️", "I draw with a pencil.", "我用铅笔画画。"),
        ("ruler", "尺子", "📏", "The ruler is long.", "尺子长长的。"),
        ("crayon", "蜡笔", "🖍️", "I color with crayons.", "我用蜡笔涂色。"),
        ("chair", "椅子", "🪑", "Sit on the chair.", "坐在椅子上。"),
        ("school", "学校", "🏫", "I go to school.", "我去上学。"),
        ("teacher", "老师", "👩‍🏫", "My teacher is kind.", "我的老师很亲切。"),
        ("student", "学生", "🧑‍🎓", "I am a student.", "我是一名学生。"),
    ),
    "family": (
        ("family", "家庭", "👨‍👩‍👧", "I love my family.", "我爱我的家。"),
        ("father", "爸爸", "👨", "My father is tall.", "我爸爸很高。"),
        ("mother", "妈妈", "👩", "My mother is kind.", "我妈妈很温柔。"),
        ("brother", "哥哥；弟弟", "👦", "My brother likes football.", "我哥哥喜欢足球。"),
        ("sister", "姐姐；妹妹", "👧", "My sister is cute.", "我妹妹很可爱。"),
        ("grandpa", "爷爷；外公", "👴", "Grandpa tells stories.", "爷爷会讲故事。"),
        ("grandma", "奶奶；外婆", "👵", "Grandma cooks well.", "奶奶做饭很好吃。"),
        ("uncle", "叔叔", "🧔", "My uncle is funny.", "我叔叔很幽默。"),
        ("baby", "宝宝", "👶", "The baby is sleeping.", "宝宝在睡觉。"),
        ("friend", "朋友", "🧑‍🤝‍🧑", "We are good friends.", "我们是好朋友。"),
    ),
}

WORDS = {
    key: [{"word": w, "cn": cn, "emoji": emoji, "example": example, "example_cn": example_cn}
          for w, cn, emoji, example, example_cn in rows]
    for key, rows in _RAW.items()
}


def build_deck(category=None):
    """抽一轮闪卡：从指定主题（缺省为全部）随机抽 DECK_SIZE 张。"""
    key = category if category in WORDS else "all"
    pool = [card for cards in WORDS.values() for card in cards] if key == "all" else WORDS[key]
    cards = random.sample(pool, min(DECK_SIZE, len(pool)))
    return {"category": key, "count": len(cards), "cards": cards}
