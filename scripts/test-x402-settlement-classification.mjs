import test from "node:test";
import assert from "node:assert/strict";
import { classifySettlement } from "../lib/agent/settlement-classification.ts";

test("success true with success status is settled", () => {
  assert.equal(classifySettlement({ success: true, status: "success" }), "settled");
});

test("success true without status is settled", () => {
  assert.equal(classifySettlement({ success: true }), "settled");
});

test("success false with pending status is pending", () => {
  assert.equal(classifySettlement({ success: false, status: "pending" }), "pending");
});

test("success false with timeout status is failed", () => {
  assert.equal(classifySettlement({ success: false, status: "timeout" }), "failed");
});

test("success false with success status is failed", () => {
  assert.equal(classifySettlement({ success: false, status: "success" }), "failed");
});

test("missing success is unknown", () => {
  assert.equal(classifySettlement({ status: "success" }), "unknown");
});

test("transaction presence alone does not cause settled", () => {
  assert.equal(
    classifySettlement({ status: "success", transaction: "0xrequired-but-not-success" }),
    "unknown",
  );
});
