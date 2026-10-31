"use client";

import Link from "next/link";
import styles from "./language-practice.module.css";
import { useEffect, useRef, useState } from "react";
import { ExploreText, useLearningPage, useLearningSupport } from "./learning-support";
import { Icon } from "./icons";
import {
  difficultyDescriptions, difficultyLabels, generateCharacterRound, generateSentence,
  type Difficulty, type Sentence,
} from "../lib/practice-data";

function cx(names: string) {
  return names.split(/\s+/).map(name => styles[name] ?? name).join(" ");
}

type PracticeKind = "sentences" | "listening";

function useMandarinSpeech() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState("");
  const [rate, setRate] = useState(0.8);
  const [status, setStatus] = useState("Loading Mandarin voices…");
  const [speaking, setSpeaking] = useState(false);
  const current = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      const unavailable = globalThis.setTimeout(() => setStatus("Speech playback is unavailable in this browser. Try a browser with text-to-speech support."), 0);
      return () => globalThis.clearTimeout(unavailable);
    }
    const synth = window.speechSynthesis;
    function updateVoices() {
      const available = synth.getVoices().filter(voice => /^(zh([-_](CN|SG|TW|Hans|Hant))?|cmn)([-_]|$)/i.test(voice.lang));
      available.sort((a, b) => Number(/CN|Hans/i.test(b.lang)) - Number(/CN|Hans/i.test(a.lang)));
      setVoices(available);
      setStatus(available.length ? "" : "Add a Mandarin speech voice in your device’s language settings, then reload to enable listening.");
    }
    updateVoices();
    synth.addEventListener("voiceschanged", updateVoices);
    return () => {
      current.current = null;
      synth.cancel();
      synth.removeEventListener("voiceschanged", updateVoices);
    };
  }, []);

  function stop() {
    current.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }
  function speak(text: string, onStart?: () => void) {
    const voice = voices.find(item => item.voiceURI === voiceURI) ?? voices[0];
    if (!voice) return;
    stop();
    const utterance = new SpeechSynthesisUtterance(text);
    current.current = utterance;
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = rate;
    utterance.onstart = () => {
      if (current.current === utterance) { setSpeaking(true); onStart?.(); }
    };
    utterance.onend = () => {
      if (current.current === utterance) { setSpeaking(false); current.current = null; }
    };
    utterance.onerror = event => {
      if (current.current !== utterance) return;
      setSpeaking(false);
      if (event.error !== "canceled" && event.error !== "interrupted") {
        setStatus("Playback could not start. Try another Mandarin voice or press Listen again.");
      }
    };
    setStatus("");
    window.speechSynthesis.speak(utterance);
  }
  return { voices, voiceURI, setVoiceURI, rate, setRate, status, speaking, speak, stop };
}

type Speech = ReturnType<typeof useMandarinSpeech>;

function AudioSettings({ speech }: { speech: Speech }) {
  return <details className={cx("audio-settings")} open={!speech.voices.length}><summary><Icon name="sound" size={17} /><strong>Audio settings</strong><span>Voice & playback speed</span><Icon name="down" size={15} /></summary><div className={cx("audio-controls")}>
    <label>Mandarin voice
      <select value={speech.voiceURI || speech.voices[0]?.voiceURI || ""} disabled={!speech.voices.length} onChange={e => { speech.stop(); speech.setVoiceURI(e.target.value); }}>
        {!speech.voices.length && <option value="">No Mandarin voice available</option>}
        {speech.voices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} · {voice.lang}</option>)}
      </select>
    </label>
    <label>Playback speed
      <select value={speech.rate} onChange={e => { speech.stop(); speech.setRate(Number(e.target.value)); }}>
        <option value={0.65}>Extra slow</option><option value={0.8}>Slow</option><option value={1}>Normal</option>
      </select>
    </label>
    {speech.status && <p className={cx("speech-status")}  role="status"><Icon name="info" size={17} />{speech.status}</p>}
  </div></details>;
}

function ListenButton({ speech, text }: { speech: Speech; text: string }) {
  return <div className={cx("listen-actions")}><button className={cx("button primary listen-button")}  disabled={!speech.voices.length} onClick={() => speech.speak(text)}><Icon name="sound" size={21} />{speech.speaking ? "Replay audio" : "Listen"}</button>{speech.speaking && <button className={cx("button secondary")}  onClick={speech.stop}>Stop</button>}</div>;
}

function RevealField({ label, value, language, large = false, onReveal }: { label: string; value: string; language?: string; large?: boolean; onReveal?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const { action } = useLearningSupport();
  return <div className={cx(`reveal-field ${open ? "is-revealed" : ""}`)}>
    <div className={cx("reveal-heading")}><span>{label}</span><button className={cx("reveal-button")}  aria-expanded={open} onClick={() => { setOpen(value => !value); onReveal?.(!open); action((open ? "Hid " : "Revealed ") + label); }}>{open ? "Hide" : "Reveal"} {label.toLowerCase()}<Icon name={open ? "eye-off" : "eye"} size={17} /></button></div>
    {open ? <p className={cx(large ? "sentence-chinese" : "sentence-answer")} lang={language}>{language?.startsWith("zh") && language !== "zh-Latn" ? <ExploreText text={value} /> : value}</p> : <p className={cx("hidden-answer")}>Hidden until you’re ready.</p>}
  </div>;
}

const initialSentence: Sentence = {
  chinese: "我喜欢学习中文。", pinyin: "Wǒ xǐhuan xuéxí Zhōngwén.", english: "I like to study Chinese.",
};
const initialRound = generateCharacterRound("beginner", undefined, () => 0);

export function LanguagePractice({ kind }: { kind: PracticeKind }) {
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const [mode, setMode] = useState<"characters" | "sentences">("characters");
  const [sentence, setSentence] = useState(initialSentence);
  const [round, setRound] = useState(initialRound);
  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [heard, setHeard] = useState(false);
  const [score, setScore] = useState({ correct: 0, attempted: 0 });
  const speech = useMandarinSpeech();
  const [revealed, setRevealed] = useState(false);
  const { action } = useLearningSupport();
  const characterMode = kind === "listening" && mode === "characters";

  useLearningPage({ key: kind + mode + version, page: kind === "listening" ? "/listening" : "/sentences",
    mode: characterMode ? "character-listening" : "sentence-listening", revealed: characterMode ? !!selected : revealed,
    content: characterMode ? (selected ? [{ text: round.target.chinese, language: "zh-Hans" }, { text: round.target.english, language: "en" }] : [])
      : [{ text: sentence.chinese, language: "zh-Hans" }, ...(revealed ? [{ text: sentence.english, language: "en" }, { text: sentence.pinyin, language: "zh-Latn-pinyin" }] : [])] });

  function newExercise(level = difficulty) {
    setRevealed(false); action("Started a new practice item");
    speech.stop();
    setSentence(generateSentence(level, sentence.chinese));
    setRound(generateCharacterRound(level, round.target.chinese));
    setVersion(value => value + 1);
    setSelected(null);
    setHeard(false);
  }
  function changeDifficulty(level: Difficulty) {
    setDifficulty(level);
    newExercise(level);
  }
  function changeMode(value: "characters" | "sentences") {
    setMode(value);
    newExercise();
  }
  function answer(chinese: string) {
    if (selected || !heard) return;
    action("Answered the character listening question");
    setSelected(chinese);
    setScore(value => ({ attempted: value.attempted + 1, correct: value.correct + Number(chinese === round.target.chinese) }));
  }

  return <div className={cx("language-practice")}>
    <div className={cx("page-heading")}><div><div className={cx("eyebrow")}>A LITTLE PRACTICE, EVERY DAY</div><h1>{kind === "sentences" ? "One sentence at a time." : "Listening practice."}</h1><p>{kind === "sentences" ? "Read a fresh sentence, try a translation, then reveal the parts you need." : "Listen closely. Recognize a character or follow a whole sentence."}</p></div><Link className={cx("button secondary")}  href="/practice">All practice <Icon name="arrow" size={16} /></Link></div>
    <div className={cx("practice-page-links")}><Link href="/sentences" aria-current={kind === "sentences" ? "page" : undefined}><Icon name="book" size={17} />Sentence practice</Link><Link href="/listening" aria-current={kind === "listening" ? "page" : undefined}><Icon name="sound" size={17} />Listening practice</Link></div>
    <section className={cx("panel exercise-panel")}>
      <div className={cx("exercise-toolbar")}><div><h2>{kind === "sentences" ? "Sentence generator" : "Listening studio"}</h2><p>{difficultyDescriptions[difficulty]}</p></div><label className={cx("difficulty-select")}>Difficulty<select value={difficulty} onChange={e => changeDifficulty(e.target.value as Difficulty)}>{Object.entries(difficultyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      {kind === "listening" && <div className={cx("listening-modes")}  role="group" aria-label="Listening mode"><button aria-pressed={mode === "characters"} onClick={() => changeMode("characters")}><Icon name="characters" size={18} />Choose the character</button><button aria-pressed={mode === "sentences"} onClick={() => changeMode("sentences")}><Icon name="book" size={18} />Listen to a sentence</button></div>}
      <div className={cx(`exercise-body ${characterMode ? "character-exercise" : ""}`)}>
        <div className={cx("exercise-meta")}><span className={cx("eyebrow")}>{characterMode ? "CHARACTER RECOGNITION" : kind === "sentences" ? "SENTENCE BUILDER" : "SENTENCE LISTENING"}</span><span className={cx("exercise-level")}>{difficultyLabels[difficulty]}</span></div>
        {characterMode ? <>
          <h3 className={cx("exercise-prompt")}>Which character do you hear?</h3><p className={cx("exercise-description")}>Press Listen, then choose one of the four characters.</p>
          <div className={cx("listen-actions")}><button className={cx("button primary listen-button")}  disabled={!speech.voices.length} onClick={() => { speech.speak(round.target.chinese, () => setHeard(true)); }}><Icon name="sound" size={21} />{heard ? "Listen again" : "Listen"}</button>{speech.speaking && <button className={cx("button secondary")}  onClick={speech.stop}>Stop</button>}</div>
          <div className={cx("character-options")}  role="group" aria-label="Character answers">{round.options.map(option => <button key={option.chinese} disabled={!!selected || !heard} className={cx(`character-option ${selected && option.chinese === round.target.chinese ? "correct" : ""} ${selected === option.chinese && selected !== round.target.chinese ? "incorrect" : ""}`)} onClick={() => answer(option.chinese)}><span lang="zh-CN">{option.chinese}</span>{selected && <small>{option.pinyin}</small>}{selected && option.chinese === round.target.chinese && <span className={cx("option-result")}>Correct answer</span>}{selected === option.chinese && selected !== round.target.chinese && <span className={cx("option-result")}>Your answer</span>}</button>)}</div>
          <div className={cx("character-feedback")}  role="status">{selected ? <><strong>{selected === round.target.chinese ? "That’s right!" : "Keep listening — you’ll get there."}</strong><p><span lang="zh-CN"><ExploreText text={round.target.chinese} enabled={!!selected} /></span> · {round.target.pinyin} · {round.target.english}</p></> : <p>{heard ? "Choose the character that matches the sound." : "Listen first, then make your choice."}</p>}</div>
          <div className={cx("exercise-bottom")}><span>{score.correct} correct / {score.attempted} answered this visit</span><button className={cx("button secondary")}  onClick={() => newExercise()}>Next character <Icon name="arrow" size={16} /></button></div>
        </> : <>
          <h3 className={cx("exercise-prompt")}>{kind === "sentences" ? "What does this sentence mean?" : "How much can you understand?"}</h3>
          {kind === "sentences" ? <p className={cx("sentence-prompt")}  lang="zh-CN"><ExploreText text={sentence.chinese} enabled={revealed} /></p> : <p className={cx("exercise-description")}>Listen before opening the text. Reveal just the help you need.</p>}
          <ListenButton speech={speech} text={sentence.chinese} />
          {kind === "sentences" && <label className={cx("translation-draft")}>Your translation or notes <span>Optional · for your own comparison</span><textarea key={`draft-${version}`} placeholder="Try translating before you reveal the answer…" rows={3} /></label>}
          <div className={cx("sentence-reveals")}  key={`reveals-${version}`}>
            {kind === "listening" && <RevealField label="Chinese" value={sentence.chinese} language="zh-CN" large />}
            <RevealField label="Pinyin" value={sentence.pinyin} language="zh-Latn" />
            <RevealField label="English" value={sentence.english} language="en" onReveal={setRevealed} />
          </div>
          <div className={cx("exercise-bottom")}><span>Fresh combinations from built-in grammar patterns.</span><button className={cx("button primary")}  onClick={() => newExercise()}><Icon name="spark" size={17} />Generate sentence</button></div>
        </>}
      </div>
      <AudioSettings speech={speech} />
    </section>
    <p className={cx("practice-source-note")}>Built-in practice · Progress stays in this session</p>
  </div>;
}
