import { displayToIso, isoToDisplay } from "./date-field";

jest.mock("@/i18n", () => ({ useLanguage: () => ({ t: (key: string) => key }) }));

describe("date-field", () => {
  it("convertit entre ISO et JJ/MM/AAAA", () => {
    expect(isoToDisplay("2026-10-27")).toBe("27/10/2026");
    expect(isoToDisplay("")).toBe("");
    expect(displayToIso("27/10/2026")).toBe("2026-10-27");
  });

  it("refuse les dates qui n’existent pas", () => {
    expect(displayToIso("31/02/2026")).toBeNull();
    expect(displayToIso("27/13/2026")).toBeNull();
    expect(displayToIso("27/10/26")).toBeNull();
  });
});
