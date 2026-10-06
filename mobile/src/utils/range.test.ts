import { parseRange, toRangeLiteral } from "./range";

describe("parseRange", () => {
  it("lit le format renvoyé par PostgREST", () => {
    const range = parseRange('["2026-10-14 08:00:00+00","2026-10-14 09:00:00+00")');
    expect(range.start.toISOString()).toBe("2026-10-14T08:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-10-14T09:00:00.000Z");
  });

  it("accepte un décalage horaire non nul", () => {
    expect(parseRange('["2026-10-14 10:00:00+02","2026-10-14 11:00:00+02")').start.toISOString()).toBe(
      "2026-10-14T08:00:00.000Z",
    );
  });

  it("refuse une valeur illisible", () => {
    expect(() => parseRange("empty")).toThrow();
  });

  it("produit un littéral réutilisable", () => {
    const start = new Date("2026-10-14T08:00:00Z");
    const end = new Date("2026-10-14T09:00:00Z");
    expect(toRangeLiteral(start, end)).toBe("[2026-10-14T08:00:00.000Z,2026-10-14T09:00:00.000Z)");
  });
});
