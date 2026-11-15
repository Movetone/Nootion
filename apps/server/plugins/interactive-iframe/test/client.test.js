import test from "node:test";
import assert from "node:assert/strict";
import { normalizeUrl } from "../client.js";

test("accepts bare domains as https URLs", () => {
  assert.equal(normalizeUrl("example.com/app"), "https://example.com/app");
});

test("accepts only http and https URLs", () => {
  assert.equal(normalizeUrl("javascript:alert(1)"), null);
  assert.equal(normalizeUrl("ftp://example.com/file"), null);
});

test("extracts src from an iframe snippet", () => {
  assert.equal(normalizeUrl('<iframe src="https://example.com/app"></iframe>'), "https://example.com/app");
});
