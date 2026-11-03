export type VocabularyEntry = { text: string; character_count: number };
export type VocabularyPage = {
  read_at: string; total_expressions: number; total_characters: number;
  filtered_count: number; offset: number; limit: number; entries: VocabularyEntry[];
};

/** Keep every visible expression in bounded chat context without splitting a Unicode scalar. */
export function vocabularyContext(entries: VocabularyEntry[]) {
  const chunks: string[] = [];
  let current = "";
  for (const character of entries.map(entry => entry.text).join("，")) {
    if (current.length + character.length > 4000) { chunks.push(current); current = ""; }
    current += character;
  }
  if (current) chunks.push(current);
  return chunks.slice(0, 6).map(text => ({ text, language: "zh-Hans" }));
}
