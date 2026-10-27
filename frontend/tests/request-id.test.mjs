import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
import { requestId } from "../app/lib/api.ts";

test("practice request IDs work when HTTP exposes getRandomValues but not randomUUID", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: { getRandomValues: values => webcrypto.getRandomValues(values) } });
  try {
    const identifiers = new Set(Array.from({ length: 100 }, () => requestId()));
    assert.equal(identifiers.size, 100);
    for (const identifier of identifiers) assert.match(identifier, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  } finally { Object.defineProperty(globalThis, "crypto", original); }
});
