import { learningApi, type LearningReply } from "./learning-api";

export type CharacterAudio = { content_type: string; audio_data: string; timings?: unknown };
const prefix = "chapp-character-definition-v1:";
const definitions = new Map<string, LearningReply>();
const pendingDefinitions = new Map<string, Promise<LearningReply>>();
const audio = new Map<string, Promise<CharacterAudio>>();

function valid(value: unknown): value is LearningReply {
  const item = value as LearningReply | null;
  return !!item && typeof item.reply?.text === "string" && item.reply.text.trim().length > 0 &&
    item.reply.text.length <= 4000 && item.reply.language === "en" &&
    typeof item.pronunciation?.text === "string" && item.pronunciation.text.trim().length > 0 &&
    item.pronunciation.text.length <= 100 && item.pronunciation.language === "zh-Latn-pinyin";
}

/** Reads only public general definitions; phrase explanations never enter this cache. */
export function readCharacterDefinition(character: string): LearningReply | null {
  const cached = definitions.get(character);
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(prefix + character);
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (valid(value)) { definitions.set(character, value); return value; }
  } catch { /* Storage may be disabled; the server cache remains available. */ }
  return null;
}

export function saveCharacterDefinition(character: string, value: LearningReply) {
  if (!valid(value)) return;
  if (definitions.size >= 512) definitions.delete(definitions.keys().next().value!);
  definitions.set(character, value);
  try {
    // Bound browser storage independently of the durable server dictionary.
    const keys = Object.keys(localStorage).filter(key => key.startsWith(prefix));
    if (keys.length >= 512 && !keys.includes(prefix + character)) localStorage.removeItem(keys[0]);
    localStorage.setItem(prefix + character, JSON.stringify(value));
  } catch { /* A storage limit must not hide a successful definition. */ }
}

/** Shares accepted definition work across panel remounts without cancelling its durable server write. */
export function loadCharacterDefinition(owner: string, character: string, body: unknown): Promise<LearningReply> {
  const cached = readCharacterDefinition(character);
  if (cached) return Promise.resolve(cached);
  const key = JSON.stringify([owner, character]);
  const pending = pendingDefinitions.get(key);
  if (pending) return pending;
  if (pendingDefinitions.size >= 128) return Promise.reject(new Error("Character lookups are busy. Try again shortly."));
  const work = learningApi<LearningReply>("/learning-help/character", body).then(value => {
    if (!valid(value)) throw new Error("Character meaning is unavailable. Try again.");
    saveCharacterDefinition(character, value);
    return value;
  }).finally(() => { if (pendingDefinitions.get(key) === work) pendingDefinitions.delete(key); });
  pendingDefinitions.set(key, work);
  return work;
}

/** Coalesces audio preparation and replay for one signed-in learner, with no page content retained. */
export function loadCharacterAudio(owner: string, character: string, body: unknown): Promise<CharacterAudio> {
  const key = JSON.stringify([owner, character]);
  const cached = audio.get(key);
  if (cached) return cached;
  if (audio.size >= 128) audio.delete(audio.keys().next().value!);
  const work = learningApi<CharacterAudio>("/learning-help/sound", body).then(value => {
    if (!value.content_type?.startsWith("audio/") || !value.audio_data) throw new Error("Character audio is unavailable.");
    return value;
  }).catch(error => { if (audio.get(key) === work) audio.delete(key); throw error; });
  audio.set(key, work);
  return work;
}
