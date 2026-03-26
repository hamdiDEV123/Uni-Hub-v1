export const HOUSING_AMENITIES = [
  { id: "wifi", label: "واي فاي" },
  { id: "ac", label: "تكييف" },
  { id: "laundry", label: "غسالة" },
  { id: "kitchen", label: "مطبخ مجهز" },
] as const;

export const ROOMMATE_SLEEP_OPTIONS = [
  { value: "early", label: "نوم بدري" },
  { value: "late", label: "نوم متأخر" },
  { value: "flexible", label: "مرن" },
] as const;

export const ROOMMATE_SMOKING_OPTIONS = [
  { value: "no", label: "غير مدخن" },
  { value: "yes", label: "مدخن" },
  { value: "either", label: "لا يفرق" },
] as const;
