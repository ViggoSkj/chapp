import assert from "node:assert/strict";
import test from "node:test";
import { helpContext } from "../app/lib/learning-api.ts";

test("learning requests carry explicit visible context and bounded actions without internal component keys", () => {
  const page = { key: "internal-state", page: "/sentences", mode: "sentence-practice", revealed: false,
    exercise_id: "owned", content: [{ text: "你好。", language: "zh-Hans" }], privateMarker: "not-request-data" };
  const context = helpContext(page, Array.from({ length: 20 }, (_, index) => "action-" + index));
  assert.equal(context.actions.length, 12);
  assert.equal(context.actions[0], "action-8");
  assert.equal(context.exercise_id, "owned");
  assert.equal(context.revealed, false);
  assert.equal("key" in context, false);
  assert.equal("privateMarker" in context, false);
});
