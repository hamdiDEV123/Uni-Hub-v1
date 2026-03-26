export type StudentContext = {
  university?: string | null;
  faculty?: string | null;
  study_year?: string | null;
  onboarding_completed?: boolean | null;
};

export function hasRequiredStudentContext(context: StudentContext): boolean {
  return Boolean(
    context.onboarding_completed &&
      context.university?.trim() &&
      context.faculty?.trim() &&
      context.study_year?.trim()
  );
}
