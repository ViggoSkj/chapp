export const sections = [
  { id: "vocabulary", title: "Vocabulary", icon: "book", description: "Your growing collection of Mandarin words. Browse characters, pinyin, meanings, and how well you remember each word.", color: "sage", metric: "1,248", unit: "words in your collection", action: "Explore vocabulary" },
  { id: "reviews", title: "Anki reviews", icon: "cards", description: "A little repetition goes a long way. See your decks, upcoming reviews, and the words that could use another look.", color: "peach", metric: "24", unit: "cards ready to review", action: "View your reviews" },
  { id: "progress", title: "Your progress", icon: "chart", description: "See the bigger picture. Follow your study habits, vocabulary growth, retention, and progress toward your next milestone.", color: "lavender", metric: "12", unit: "day learning streak", action: "See your progress" },
  { id: "practice", title: "Daily practice", icon: "spark", description: "Make Mandarin part of your day. Practice useful expressions and recall words in a short, focused study session.", color: "butter", metric: "5 min", unit: "to build a little momentum", action: "Start practicing" },
  { id: "sentences", title: "Sentence practice", icon: "book", description: "Generate sentences at your level. Try a translation, then reveal the pinyin and English when you’re ready.", color: "sage", metric: "3", unit: "difficulty levels", action: "Practice sentences" },
  { id: "listening", title: "Listening practice", icon: "sound", description: "Train your ear with spoken Mandarin. Choose the character you hear or listen to sentences with optional reveals.", color: "peach", metric: "2", unit: "listening modes", action: "Practice listening" },
] as const;

export const words = [
  { hanzi: "学习", pinyin: "xuéxí", meaning: "to study; to learn", level: "HSK 1", state: "Familiar" },
  { hanzi: "朋友", pinyin: "péngyou", meaning: "friend", level: "HSK 1", state: "Mastered" },
  { hanzi: "觉得", pinyin: "juéde", meaning: "to feel; to think", level: "HSK 2", state: "Learning" },
  { hanzi: "每天", pinyin: "měitiān", meaning: "every day", level: "HSK 1", state: "Mastered" },
  { hanzi: "坚持", pinyin: "jiānchí", meaning: "to persist; to keep at it", level: "HSK 4", state: "Learning" },
  { hanzi: "进步", pinyin: "jìnbù", meaning: "progress; to improve", level: "HSK 3", state: "Familiar" },
];
export const weeklyReviews = [42, 68, 51, 87, 63, 96, 74];
export const monthlyReviews = [35, 52, 48, 71, 56, 83, 96];
