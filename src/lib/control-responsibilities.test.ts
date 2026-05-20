import { describe, expect, it } from "vitest";
import { controlResponsibilitySections } from "./control-responsibilities";

describe("control responsibility sections", () => {
  it("separates Control responsibilities instead of treating it as one mixed dashboard", () => {
    expect(controlResponsibilitySections.map((section) => section.key)).toEqual([
      "command",
      "execution",
      "risk",
      "systems",
      "observability"
    ]);

    expect(controlResponsibilitySections).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "command", ownerLabel: "HQ / operator" }),
      expect.objectContaining({ key: "execution", ownerLabel: "Worker / task runner" }),
      expect.objectContaining({ key: "risk", ownerLabel: "Policy / approval gate" }),
      expect.objectContaining({ key: "systems", ownerLabel: "Local system monitor" }),
      expect.objectContaining({ key: "observability", ownerLabel: "Trace / cost ledger" })
    ]));
  });
});
