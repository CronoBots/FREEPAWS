import { en } from "./en";
import { fr } from "./fr";
import { setLanguage, t, tp } from "./index";
import { formatDayLong } from "@/utils/dates";
import { toUserMessage } from "@/utils/errors";

function keys(node: object, prefix = ""): string[] {
  return Object.entries(node).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : keys(value as object, `${prefix}${key}.`),
  );
}

describe("traductions", () => {
  afterEach(() => setLanguage("fr", { persist: false }));

  it("l’anglais a exactement les mêmes clés que le français", () => {
    expect(keys(en).sort()).toEqual(keys(fr).sort());
  });

  it("conserve les variables dans chaque traduction", () => {
    const vars = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join();
    const lookup = (dict: object, key: string) =>
      key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], dict) as string;
    for (const key of keys(fr)) expect([key, vars(lookup(en, key))]).toEqual([key, vars(lookup(fr, key))]);
  });

  it("traduit textes, erreurs, pluriels et dates", () => {
    setLanguage("en", { persist: false });
    expect(t("tabs.park")).toBe("The park");
    expect(toUserMessage({ message: "slot_unavailable" })).toMatch(/no longer available/);
    expect(tp("booking.places", 1)).toBe("1 place");
    expect(tp("booking.places", 3)).toBe("3 places");
    expect(formatDayLong("2026-10-14T10:00:00Z")).toBe("Wednesday 14 October");
    setLanguage("fr", { persist: false });
    expect(tp("booking.places", 2)).toBe("2 places");
    expect(t("booking.confirm", { day: "mer.", time: "10:00" })).toBe("Confirmer · mer. à\u00a010:00");
  });
});
