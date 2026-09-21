import { describe, expect, it } from "vitest";
import { projectStatusRank, projectStatusSchema, projectStatusTransitions } from "../src/index.js";

function validPatch(overrides: Record<string, unknown> = {}) {
  return { status: "IN_PROGRESS", version: 1, ...overrides };
}

describe("project status transition contract", () => {
  it("allows only the staged forward moves and one-step rollbacks", () => {
    expect(projectStatusTransitions.PLANNED).toEqual(["IN_PROGRESS"]);
    expect(projectStatusTransitions.IN_PROGRESS).toEqual(["COMPLETED", "PLANNED"]);
    expect(projectStatusTransitions.COMPLETED).toEqual(["IN_PROGRESS", "ARCHIVED"]);
    expect(projectStatusTransitions.ARCHIVED).toEqual([]);
  });

  it("orders the phase gates for forward/backward classification", () => {
    expect(projectStatusRank.PLANNED).toBeLessThan(projectStatusRank.IN_PROGRESS);
    expect(projectStatusRank.IN_PROGRESS).toBeLessThan(projectStatusRank.COMPLETED);
  });

  it("accepts a forward transition without a reason", () => {
    expect(projectStatusSchema.safeParse(validPatch()).success).toBe(true);
    expect(projectStatusSchema.safeParse(validPatch({ status: "COMPLETED" })).success).toBe(true);
  });

  it("requires a non-trivial reason for rollback payloads", () => {
    expect(projectStatusSchema.safeParse(validPatch({ status: "PLANNED" })).success).toBe(false);
    expect(projectStatusSchema.safeParse(validPatch({ status: "PLANNED", reason: "材料不足暂停" })).success).toBe(true);
    expect(projectStatusSchema.safeParse(validPatch({ status: "PLANNED", reason: "ab" })).success).toBe(false);
  });

  it("carries the explicit gate-skip flag and optimistic version", () => {
    const parsed = projectStatusSchema.parse(validPatch({ status: "COMPLETED", skipGate: true }));
    expect(parsed.skipGate).toBe(true);
    expect(projectStatusSchema.safeParse(validPatch({ version: 0 })).success).toBe(false);
  });
});
