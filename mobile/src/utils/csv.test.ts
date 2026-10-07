import { toCsv } from "@/utils/csv";

describe("toCsv", () => {
  it("sépare par des points-virgules et échappe guillemets et retours à la ligne", () => {
    expect(
      toCsv(
        ["a", "b"],
        [
          ["x;y", 'dit "oui"'],
          [1, null],
        ],
      ),
    ).toBe('﻿a;b\r\n"x;y";"dit ""oui"""\r\n1;\r\n');
  });

  it("neutralise les formules", () => {
    expect(toCsv(["a"], [["=SUM(A1)"]])).toBe("﻿a\r\n'=SUM(A1)\r\n");
  });
});
