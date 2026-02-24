import { describe, expect, it } from "vitest";

describe("mobile scaffold", () => {
  it("keeps health flags disabled by default", () => {
    expect(process.env.EXPO_PUBLIC_HEALTH_FEATURE_ENABLED ?? "false").toBe("false");
    expect(process.env.EXPO_PUBLIC_HEALTH_ENABLED ?? "false").toBe("false");
    expect(process.env.EXPO_PUBLIC_HEALTH_IOS ?? "false").toBe("false");
    expect(process.env.EXPO_PUBLIC_HEALTH_ANDROID ?? "false").toBe("false");
  });
});
