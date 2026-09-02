import { describe, expect, it } from "vitest";
import { fmtCountdown, fmtProb, fmtUSD, intervalLabel, secsLeftLabel, assetEmoji } from "@/lib/format";

describe("format", () => {
  it("fmtCountdown renders MM:SS floored at zero", () => {
    expect(fmtCountdown(1000, 500)).toBe("08:20");
    expect(fmtCountdown(1000, 999.6)).toBe("00:00");
    expect(fmtCountdown(1000, 1500)).toBe("00:00");
  });
  it("fmtProb renders whole percents or an em dash", () => {
    expect(fmtProb(0.623)).toBe("62%");
    expect(fmtProb(undefined)).toBe("—");
    expect(fmtProb(NaN)).toBe("—");
  });
  it("fmtUSD guards non-finite input", () => {
    expect(fmtUSD(3.14159)).toBe("$3.14");
    expect(fmtUSD(NaN)).toBe("—");
  });
  it("intervalLabel names known cadences", () => {
    expect(intervalLabel(300)).toBe("5m");
    expect(intervalLabel(900)).toBe("15m");
    expect(intervalLabel(3600)).toBe("1h");
    expect(intervalLabel(1800)).toBe("30m");
  });
  it("secsLeftLabel is compact prose", () => {
    expect(secsLeftLabel(492)).toBe("8m 12s");
    expect(secsLeftLabel(9)).toBe("9s");
  });
  it("assetEmoji covers BTC/ETH", () => {
    expect(assetEmoji("BTC")).toBe("₿");
    expect(assetEmoji("ETH")).toBe("Ξ");
  });
});
