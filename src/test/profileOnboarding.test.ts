import { describe, expect, it } from "vitest";
import { hasRequiredStudentContext } from "@/pages/profile/profile.utils";

describe("profile onboarding utils", () => {
  it("returns true when onboarding flag and required fields exist", () => {
    expect(
      hasRequiredStudentContext({
        onboarding_completed: true,
        university: "Delta University",
        faculty: "Engineering",
        study_year: "First",
      })
    ).toBe(true);
  });

  it("returns false when any required field is missing", () => {
    expect(
      hasRequiredStudentContext({
        onboarding_completed: true,
        university: "",
        faculty: "Engineering",
        study_year: "First",
      })
    ).toBe(false);

    expect(
      hasRequiredStudentContext({
        onboarding_completed: false,
        university: "Delta University",
        faculty: "Engineering",
        study_year: "First",
      })
    ).toBe(false);
  });
});
