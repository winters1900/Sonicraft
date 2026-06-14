// 中文绘画主体 → 英文提示词。
// FLUX.1-schnell 以英文训练为主，直接喂中文裸词（熊猫/大楼/山）理解很差；
// 免费 HF 又无可用的翻译/LLM 模型，故内置一份常见绘画主体词典做本地翻译。
// 命中则替换为英文，未命中保留原文，最后统一追加质量后缀。

const DICT: Record<string, string> = {
  // —— 动物 ——
  熊猫: 'a cute panda', 大熊猫: 'a giant panda', 小熊猫: 'a red panda',
  猫: 'a cute cat', 小猫: 'a kitten', 猫咪: 'a cute cat', 狗: 'a cute dog', 小狗: 'a puppy',
  老虎: 'a tiger', 狮子: 'a lion', 大象: 'an elephant', 兔子: 'a rabbit', 小兔子: 'a bunny',
  鸟: 'a bird', 小鸟: 'a little bird', 鱼: 'a fish', 金鱼: 'a goldfish', 马: 'a horse',
  牛: 'a cow', 羊: 'a sheep', 猪: 'a pig', 鸡: 'a chicken', 鸭子: 'a duck', 鸭: 'a duck',
  龙: 'a Chinese dragon', 恐龙: 'a dinosaur', 蛇: 'a snake', 猴子: 'a monkey', 熊: 'a bear',
  狐狸: 'a fox', 鹿: 'a deer', 长颈鹿: 'a giraffe', 企鹅: 'a penguin', 海豚: 'a dolphin',
  鲸鱼: 'a whale', 鲨鱼: 'a shark', 蝴蝶: 'a butterfly', 蜜蜂: 'a bee', 瓢虫: 'a ladybug',
  独角兽: 'a unicorn', 猫头鹰: 'an owl', 孔雀: 'a peacock', 乌龟: 'a turtle', 青蛙: 'a frog',
  螃蟹: 'a crab', 松鼠: 'a squirrel', 考拉: 'a koala', 袋鼠: 'a kangaroo', 刺猬: 'a hedgehog',
  狼: 'a wolf', 斑马: 'a zebra', 河马: 'a hippo', 犀牛: 'a rhino', 蝙蝠: 'a bat',
  // —— 自然 / 场景 ——
  山: 'a majestic mountain landscape', 山脉: 'a mountain range', 雪山: 'a snowy mountain',
  河: 'a river', 河流: 'a river', 海: 'the sea', 大海: 'the ocean', 海洋: 'the ocean',
  湖: 'a lake', 湖泊: 'a calm lake', 森林: 'a forest', 树林: 'a forest', 草地: 'a grassy meadow',
  沙漠: 'a desert', 瀑布: 'a waterfall', 天空: 'the sky', 云: 'clouds', 云朵: 'fluffy clouds',
  彩虹: 'a rainbow', 太阳: 'the sun', 月亮: 'the moon', 星星: 'stars', 星空: 'a starry night sky',
  银河: 'the galaxy', 雪: 'snow', 雪景: 'a snowy landscape', 日落: 'a sunset', 夕阳: 'a sunset',
  日出: 'a sunrise', 火山: 'a volcano', 岛屿: 'an island', 海滩: 'a beach', 沙滩: 'a beach',
  花园: 'a garden', 田野: 'a field', 竹林: 'a bamboo forest', 樱花: 'cherry blossoms',
  // —— 建筑 / 物体 ——
  大楼: 'a modern skyscraper', 高楼: 'a tall modern building', 摩天大楼: 'a skyscraper',
  房子: 'a house', 小屋: 'a cottage', 城堡: 'a fairytale castle', 桥: 'a bridge', 大桥: 'a large bridge',
  塔: 'a tower', 灯塔: 'a lighthouse', 教堂: 'a church', 寺庙: 'a temple', 宝塔: 'a pagoda',
  长城: 'the Great Wall of China', 城市: 'a city skyline', 街道: 'a city street', 村庄: 'a village',
  汽车: 'a car', 跑车: 'a sports car', 火车: 'a train', 飞机: 'an airplane', 船: 'a boat',
  帆船: 'a sailboat', 轮船: 'a ship', 自行车: 'a bicycle', 火箭: 'a rocket', 热气球: 'a hot air balloon',
  飞船: 'a spaceship', 摩托车: 'a motorcycle', 风车: 'a windmill',
  // —— 食物 ——
  苹果: 'an apple', 香蕉: 'a banana', 芒果: 'a mango', 西瓜: 'a watermelon', 草莓: 'a strawberry',
  橙子: 'an orange', 葡萄: 'grapes', 樱桃: 'cherries', 蛋糕: 'a cake', 生日蛋糕: 'a birthday cake',
  面包: 'bread', 披萨: 'a pizza', 汉堡: 'a hamburger', 冰淇淋: 'an ice cream', 咖啡: 'a cup of coffee',
  寿司: 'sushi', 月饼: 'a mooncake', 饺子: 'dumplings',
  // —— 人物 / 其他 ——
  女孩: 'a girl', 男孩: 'a boy', 小女孩: 'a little girl', 小男孩: 'a little boy',
  机器人: 'a robot', 宇航员: 'an astronaut', 公主: 'a princess', 王子: 'a prince',
  超人: 'a superhero', 天使: 'an angel', 精灵: 'a fairy', 巫师: 'a wizard',
  // —— 风格 / 形容（作前缀拼接）——
  可爱的: 'cute', 卡通: 'cartoon style', 写实: 'realistic', 像素: 'pixel art', 水彩: 'watercolor',
  大的: 'big', 小的: 'small', 红色的: 'red', 蓝色的: 'blue', 绿色的: 'green', 黄色的: 'yellow',
};

const SORTED_KEYS = Object.keys(DICT).sort((a, b) => b.length - a.length);
const QUALITY = ', high quality, highly detailed, sharp focus';

/** 中文主体短语 → 英文提示词；最长匹配分段替换，未命中保留原文。 */
export function toEnglishPrompt(zh: string): string {
  const text = zh.trim();
  if (!text) return '';
  if (DICT[text]) return DICT[text] + QUALITY;

  let out = '';
  let i = 0;
  let translated = false;
  while (i < text.length) {
    let hit = '';
    for (const k of SORTED_KEYS) {
      if (text.startsWith(k, i)) {
        hit = k;
        break;
      }
    }
    if (hit) {
      out += DICT[hit] + ' ';
      i += hit.length;
      translated = true;
    } else {
      out += text[i];
      i += 1;
    }
  }
  // 完全没命中词典时，仍把中文原样发给模型（尽力而为），并加英文质量后缀。
  return (translated ? out.trim() : text) + QUALITY;
}
