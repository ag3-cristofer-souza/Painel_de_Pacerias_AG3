import { describe, expect, it } from "vitest";
import { hexToHslTriplet } from "./color";

describe("hexToHslTriplet", () => {
  it("converte o hex da marca para a variável do tema", () => {
    expect(hexToHslTriplet("#2563eb")).toBe("221 83% 53%");
    expect(hexToHslTriplet("#ffffff")).toBe("0 0% 100%");
  });
  it("recusa o que não é #RRGGBB", () => {
    expect(hexToHslTriplet("azul")).toBeNull();
    expect(hexToHslTriplet(undefined)).toBeNull();
  });
});
