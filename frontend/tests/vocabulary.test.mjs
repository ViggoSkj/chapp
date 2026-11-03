import test from "node:test";
import assert from "node:assert/strict";
import { vocabularyContext } from "../app/lib/vocabulary.ts";

test("visible vocabulary context preserves Han scalars within six bounded chunks", () => {
  const entries = Array.from({ length: 10 }, () => ({ text: "𠀀你".repeat(600), character_count: 2 }));
  const context = vocabularyContext(entries);
  assert.ok(context.length <= 6);
  assert.ok(context.every(item => item.text.length <= 4000));
  assert.ok(context.every(item => item.language === "zh-Hans"));
  assert.equal(context.map(item => item.text).join(""), entries.map(entry => entry.text).join("，"));
  assert.ok(context.every(item => !/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/.test(item.text)));
});

test("empty vocabulary publishes no invented learning context", () => {
  assert.deepEqual(vocabularyContext([]), []);
});
