import { describe, expect, it } from "vitest";
import {
  classifyProjectTransition,
  projectStatusSchema,
  projectStatuses,
  requirementPatchSchema
} from "../src/index.js";

describe("project status transition classification", () => {
  it("covers every status with a distinct rank", () => {
    expect(new Set(projectStatuses).size).toBe(4);
  });

  it("classifies forward moves along the lifecycle", () => {
    expect(classifyProjectTransition("PLANNED", "IN_PROGRESS")).toBe("FORWARD");
    expect(classifyProjectTransition("IN_PROGRESS", "COMPLETED")).toBe("FORWARD");
    expect(classifyProjectTransition("PLANNED", "COMPLETED")).toBe("FORWARD");
    expect(classifyProjectTransition("PLANNED", "ARCHIVED")).toBe("FORWARD");
    expect(classifyProjectTransition("COMPLETED", "ARCHIVED")).toBe("FORWARD");
  });

  it("classifies backward moves as rollbacks", () => {
    expect(classifyProjectTransition("COMPLETED", "IN_PROGRESS")).toBe("ROLLBACK");
    expect(classifyProjectTransition("IN_PROGRESS", "PLANNED")).toBe("ROLLBACK");
    expect(classifyProjectTransition("COMPLETED", "PLANNED")).toBe("ROLLBACK");
    expect(classifyProjectTransition("ARCHIVED", "PLANNED")).toBe("ROLLBACK");
  });

  it("classifies identical statuses as no-op", () => {
    for (const status of projectStatuses) {
      expect(classifyProjectTransition(status, status)).toBe("SAME");
    }
  });
});

describe("project status schema", () => {
  const base = { status: "IN_PROGRESS", version: 1 };

  it("accepts a forward transition without a reason", () => {
    expect(projectStatusSchema.safeParse(base).success).toBe(true);
  });

  it("accepts a rollback reason of at least three characters", () => {
    const result = projectStatusSchema.safeParse({ ...base, status: "PLANNED", reason: "客户改需求" });
    expect(result.success).toBe(true);
  });

  it("rejects blank or too short rollback reasons", () => {
    expect(projectStatusSchema.safeParse({ ...base, reason: "" }).success).toBe(false);
    expect(projectStatusSchema.safeParse({ ...base, reason: "  " }).success).toBe(false);
    expect(projectStatusSchema.safeParse({ ...base, reason: "ab" }).success).toBe(false);
  });

  it("still requires the optimistic-lock version", () => {
    expect(projectStatusSchema.safeParse({ status: "IN_PROGRESS" }).success).toBe(false);
  });
});

describe("requirement patch schema", () => {
  it("requires a version so concurrent edits are rejected", () => {
    expect(requirementPatchSchema.safeParse({ requiredQuantity: "5", unit: "g" }).success).toBe(false);
    expect(requirementPatchSchema.safeParse({ requiredQuantity: "5", unit: "g", version: 2 }).success).toBe(true);
  });
});
