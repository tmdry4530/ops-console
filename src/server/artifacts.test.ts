import { describe, expect, it } from "vitest";
import { classifyArtifactContent } from "./artifacts";

describe("classifyArtifactContent", () => {
  it("restricts secret-like artifacts", () => {
    expect(classifyArtifactContent("api_secret=abcdefghijklmnopqrstuvwxyz123456").restricted).toBe(true);
  });
});
