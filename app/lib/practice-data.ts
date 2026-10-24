export type Difficulty = "beginner" | "intermediate" | "advanced";
export type Sentence = { chinese: string; pinyin: string; english: string };
export type Character = { chinese: string; pinyin: string; english: string };
export const difficultyLabels: Record<Difficulty, string> = {
  beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced",
};
export const difficultyDescriptions: Record<Difficulty, string> = {
  beginner: "Short sentences about daily life.",
  intermediate: "Time, location, and connected ideas.",
  advanced: "Longer sentences with reasons, conditions, and contrast.",
};

const subjects = [
  { chinese: "我", pinyin: "Wǒ", english: "I" },
  { chinese: "我们", pinyin: "Wǒmen", english: "We" },
  { chinese: "他们", pinyin: "Tāmen", english: "They" },
];
const activities = [
  { chinese: "学习中文", pinyin: "xuéxí Zhōngwén", english: "study Chinese" },
  { chinese: "看书", pinyin: "kàn shū", english: "read books" },
  { chinese: "听音乐", pinyin: "tīng yīnyuè", english: "listen to music" },
  { chinese: "做饭", pinyin: "zuò fàn", english: "cook" },
  { chinese: "喝茶", pinyin: "hē chá", english: "drink tea" },
  { chinese: "练习写字", pinyin: "liànxí xiě zì", english: "practice writing characters" },
];
const places = [
  { chinese: "家里", pinyin: "jiā lǐ", english: "at home" },
  { chinese: "学校", pinyin: "xuéxiào", english: "at school" },
  { chinese: "朋友家", pinyin: "péngyou jiā", english: "at a friend's home" },
];
const times = [
  { chinese: "今天", pinyin: "jīntiān", english: "today" },
  { chinese: "明天", pinyin: "míngtiān", english: "tomorrow" },
  { chinese: "周末", pinyin: "zhōumò", english: "this weekend" },
];

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Compose matching Chinese, pinyin, and English from built-in grammar patterns. */
export function generateSentence(difficulty: Difficulty, previous?: string, random = Math.random): Sentence {
  function compose(): Sentence {
    const s = pick(subjects, random);
    const a = pick(activities, random);
    const p = pick(places, random);
    const t = pick(times, random);
    const pattern = Math.floor(random() * 3);
    if (difficulty === "beginner") {
      if (pattern === 0) return { chinese: `${s.chinese}喜欢${a.chinese}。`, pinyin: `${s.pinyin} xǐhuan ${a.pinyin}.`, english: `${s.english} like to ${a.english}.` };
      if (pattern === 1) return { chinese: `${s.chinese}每天${a.chinese}。`, pinyin: `${s.pinyin} měitiān ${a.pinyin}.`, english: `${s.english} ${a.english} every day.` };
      return { chinese: `${s.chinese}想${a.chinese}。`, pinyin: `${s.pinyin} xiǎng ${a.pinyin}.`, english: `${s.english} want to ${a.english}.` };
    }
    if (difficulty === "intermediate") {
      if (pattern === 0) return { chinese: `${s.chinese}${t.chinese}打算在${p.chinese}${a.chinese}。`, pinyin: `${s.pinyin} ${t.pinyin} dǎsuàn zài ${p.pinyin} ${a.pinyin}.`, english: `${s.english} plan to ${a.english} ${p.english} ${t.english}.` };
      if (pattern === 1) return { chinese: `${s.chinese}吃完饭以后，想在${p.chinese}${a.chinese}。`, pinyin: `${s.pinyin} chī wán fàn yǐhòu, xiǎng zài ${p.pinyin} ${a.pinyin}.`, english: `After eating, ${s.english.toLowerCase() === "i" ? "I" : s.english.toLowerCase()} want to ${a.english} ${p.english}.` };
      return { chinese: `${s.chinese}觉得在${p.chinese}${a.chinese}很有意思。`, pinyin: `${s.pinyin} juéde zài ${p.pinyin} ${a.pinyin} hěn yǒu yìsi.`, english: `${s.english} think it is interesting to ${a.english} ${p.english}.` };
    }
    if (pattern === 0) return { chinese: `虽然${s.chinese}最近很忙，但是每天还是会花时间${a.chinese}。`, pinyin: `Suīrán ${s.pinyin.toLowerCase()} zuìjìn hěn máng, dànshì měitiān háishi huì huā shíjiān ${a.pinyin}.`, english: `Although ${s.english === "I" ? "I have" : s.english.toLowerCase() + " have"} been busy lately, ${s.english === "I" ? "I" : s.english.toLowerCase()} still make time to ${a.english} every day.` };
    if (pattern === 1) return { chinese: `如果${t.chinese}有时间，${s.chinese}就会在${p.chinese}${a.chinese}，而不是出去玩。`, pinyin: `Rúguǒ ${t.pinyin} yǒu shíjiān, ${s.pinyin.toLowerCase()} jiù huì zài ${p.pinyin} ${a.pinyin}, ér bú shì chūqù wán.`, english: `If there is time ${t.english}, ${s.english === "I" ? "I" : s.english.toLowerCase()} will ${a.english} ${p.english} instead of going out.` };
    return { chinese: `为了更好地利用空闲时间，${s.chinese}决定${t.chinese}在${p.chinese}${a.chinese}。`, pinyin: `Wèile gèng hǎo de lìyòng kòngxián shíjiān, ${s.pinyin.toLowerCase()} juédìng ${t.pinyin} zài ${p.pinyin} ${a.pinyin}.`, english: `To make better use of free time, ${s.english === "I" ? "I have" : s.english.toLowerCase() + " have"} decided to ${a.english} ${p.english} ${t.english}.` };
  }
  for (let attempt = 0; attempt < 12; attempt++) {
    const sentence = compose();
    if (sentence.chinese !== previous) return sentence;
  }
  // A deterministic fallback also prevents repetition with a constant RNG.
  random = () => 0;
  const fallback = compose();
  if (fallback.chinese !== previous) return fallback;
  random = () => 0.5;
  return compose();
}

export const characters: Record<Difficulty, Character[]> = {
  beginner: [
    { chinese: "猫", pinyin: "māo", english: "cat" }, { chinese: "狗", pinyin: "gǒu", english: "dog" },
    { chinese: "书", pinyin: "shū", english: "book" }, { chinese: "水", pinyin: "shuǐ", english: "water" },
    { chinese: "茶", pinyin: "chá", english: "tea" }, { chinese: "人", pinyin: "rén", english: "person" },
    { chinese: "山", pinyin: "shān", english: "mountain" }, { chinese: "米", pinyin: "mǐ", english: "rice" },
  ],
  intermediate: [
    { chinese: "买", pinyin: "mǎi", english: "to buy" }, { chinese: "卖", pinyin: "mài", english: "to sell" },
    { chinese: "近", pinyin: "jìn", english: "near" }, { chinese: "进", pinyin: "jìn", english: "to enter" },
    { chinese: "快", pinyin: "kuài", english: "fast" }, { chinese: "块", pinyin: "kuài", english: "piece" },
    { chinese: "远", pinyin: "yuǎn", english: "far" }, { chinese: "慢", pinyin: "màn", english: "slow" },
  ],
  advanced: [
    { chinese: "辨", pinyin: "biàn", english: "to distinguish" }, { chinese: "辩", pinyin: "biàn", english: "to debate" },
    { chinese: "渐", pinyin: "jiàn", english: "gradually" }, { chinese: "暂", pinyin: "zàn", english: "temporary" },
    { chinese: "勤", pinyin: "qín", english: "diligent" }, { chinese: "谨", pinyin: "jǐn", english: "careful" },
    { chinese: "悟", pinyin: "wù", english: "to comprehend" }, { chinese: "雾", pinyin: "wù", english: "fog" },
  ],
};

/** Homophones are excluded: a spoken syllable must identify exactly one option. */
export function generateCharacterRound(difficulty: Difficulty, previous?: string, random = Math.random) {
  const pool = characters[difficulty];
  const target = pick(pool.filter(item => item.chinese !== previous), random);
  const pronunciations = new Set([target.pinyin]);
  const distractors = shuffle(pool, random).filter(item => {
    if (pronunciations.has(item.pinyin)) return false;
    pronunciations.add(item.pinyin);
    return true;
  }).slice(0, 3);
  return { target, options: shuffle([target, ...distractors], random) };
}
