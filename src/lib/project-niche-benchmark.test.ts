import { describe, expect, it } from "vitest";
import { buildNicheBenchmarkComparison, parseNicheIntelPayload } from "./project-niche-benchmark";

describe("project-niche-benchmark", () => {
  it("parseNicheIntelPayload aceita array legado", () => {
    const p = parseNicheIntelPayload([{ tag: "Hook", title: "T", desc: "D" }]);
    expect(p.insights).toHaveLength(1);
    expect(p.benchmarks).toBeUndefined();
  });

  it("compara CPA do projeto com benchmark", () => {
    const { lines, hasComparison } = buildNicheBenchmarkComparison({
      projectCpa: 40,
      benchmarks: { cpa_medio_brl: 50 },
    });
    expect(hasComparison).toBe(true);
    expect(lines[0]?.metric).toBe("CPA");
    expect(lines[0]?.verdict).toBe("better");
  });
});
