import { describe, expect, it } from "vitest";
import { assertTransitionAllowed, transitionKind } from "../src/lib/projectStatus.js";
import { AppError } from "../src/lib/errors.js";

describe("project status machine", () => {
  it("classifies transition directions", () => {
    expect(transitionKind("PLANNED", "IN_PROGRESS")).toBe("FORWARD");
    expect(transitionKind("IN_PROGRESS", "COMPLETED")).toBe("FORWARD");
    expect(transitionKind("IN_PROGRESS", "PLANNED")).toBe("BACKWARD");
    expect(transitionKind("COMPLETED", "IN_PROGRESS")).toBe("BACKWARD");
    expect(transitionKind("COMPLETED", "ARCHIVED")).toBe("ARCHIVE");
  });

  it("accepts the staged moves", () => {
    expect(() => assertTransitionAllowed("PLANNED", "IN_PROGRESS")).not.toThrow();
    expect(() => assertTransitionAllowed("IN_PROGRESS", "COMPLETED")).not.toThrow();
    expect(() => assertTransitionAllowed("IN_PROGRESS", "PLANNED")).not.toThrow();
    expect(() => assertTransitionAllowed("COMPLETED", "IN_PROGRESS")).not.toThrow();
  });

  it("rejects jumping stages and reopening archived projects", () => {
    expect(() => assertTransitionAllowed("PLANNED", "COMPLETED")).toThrow(AppError);
    expect(() => assertTransitionAllowed("COMPLETED", "PLANNED")).toThrow(/阶段顺序流转/);
    expect(() => assertTransitionAllowed("IN_PROGRESS", "ARCHIVED")).toThrow(/专门的归档接口/);
    expect(() => assertTransitionAllowed("ARCHIVED", "IN_PROGRESS")).toThrow(/阶段顺序流转/);
  });

  it("reports a dedicated error code for illegal transitions", () => {
    try {
      assertTransitionAllowed("PLANNED", "ARCHIVED");
      throw new Error("expected transition to be rejected");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("USE_ARCHIVE_ENDPOINT");
    }
  });
});
