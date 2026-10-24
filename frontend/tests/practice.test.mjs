import assert from "node:assert/strict";
import test from "node:test";
import { generateSentence, generateCharacterRound } from "../app/lib/practice-data.ts";

function seeded(seed) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}

for (const difficulty of ["beginner", "intermediate", "advanced"]) {
  test(`${difficulty}: generated sentences have translations and do not repeat consecutively`, () => {
    const random = seeded(42);
    const unique = new Set();
    let previous;
    for (let i = 0; i < 200; i++) {
      const sentence = generateSentence(difficulty, previous, random);
      assert.notEqual(sentence.chinese, previous);
      assert.match(sentence.chinese, /。$/);
      assert.ok(sentence.pinyin && sentence.english);
      assert.doesNotMatch(JSON.stringify(sentence), /undefined/);
      const length = [...sentence.chinese].length;
      if (difficulty === "beginner") assert.ok(length < 18);
      if (difficulty === "advanced") assert.ok(length > 20);
      previous = sentence.chinese;
      unique.add(previous);
    }
    assert.ok(unique.size > 30, `Only ${unique.size} unique sentences`);
  });

  test(`${difficulty}: deterministic fallback preserves level and avoids a repeated sentence`, () => {
    const first = generateSentence(difficulty, undefined, () => 0);
    const next = generateSentence(difficulty, first.chinese, () => 0);
    assert.notEqual(first.chinese, next.chinese);
    if (difficulty === "advanced") assert.ok([...next.chinese].length > 20);
  });

  test(`${difficulty}: four distinct choices with no ambiguous homophones`, () => {
    const random = seeded(73);
    let previous;
    const positions = new Set();
    for (let i = 0; i < 100; i++) {
      const { target, options } = generateCharacterRound(difficulty, previous, random);
      assert.equal(options.length, 4);
      assert.equal(new Set(options.map(item => item.chinese)).size, 4);
      assert.equal(new Set(options.map(item => item.pinyin)).size, 4);
      assert.equal(options.filter(item => item.chinese === target.chinese).length, 1);
      assert.notEqual(target.chinese, previous);
      positions.add(options.findIndex(item => item.chinese === target.chinese));
      previous = target.chinese;
    }
    assert.equal(positions.size, 4);
  });
}
