import { test } from "node:test";
import assert from "node:assert/strict";
import { isAllowedSlug, hashesMatch, sha256hex, PROTECTED_SLUGS } from "../src/index.js";

test("rejects protected YTD, hub-adjacent, and invalid slugs", () => {
  for (const slug of PROTECTED_SLUGS) {
    assert.equal(isAllowedSlug(slug), false, slug);
  }
  for (const slug of ["", "Assets", "../etc", "foo/bar", "index.html", "a".repeat(90), "Game Report"]) {
    assert.equal(isAllowedSlug(slug), false, slug);
  }
});

test("allows existing deletable report slugs", () => {
  for (const slug of [
    "game-davis-legacy-2026-11-15-9c86fb2e5fba",
    "passing-and-control-91f2292b8b5f",
    "player-data-last-4-7d3f4a3eaae6",
  ]) {
    assert.equal(isAllowedSlug(slug), true, slug);
  }
});

test("passcode comparison checks SHA-256 hex of the submitted value", async () => {
  const hash = await sha256hex("secret");
  assert.equal(hash.length, 64);
  assert.equal(await hashesMatch("secret", hash), true);
  assert.equal(await hashesMatch("secret", hash.toUpperCase()), true);
  assert.equal(await hashesMatch("Secret", hash), false);
  assert.equal(await hashesMatch("secret", await sha256hex("other")), false);
  assert.equal(await hashesMatch("", hash), false);
});
