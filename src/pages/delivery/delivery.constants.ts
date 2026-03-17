import type { DeliveryMode } from "./delivery.types";

export const DELIVERY_UNIVERSITIES = [
  "جامعة الدلتا",
  "جامعة المنصورة",
  "القاهرة",
  "الاسكندرية",
  "جامعة عين شمس",
  "جامعة الأزهر",
  "أخرى",
] as const;

export const DELIVERY_MODE_LABELS: Record<DeliveryMode, string> = {
  external: "خارج الحرم الجامعي",
  campus_run: "داخل الحرم الجامعي (Campus Run)",
};

export const DELIVERY_MODE_SHORT_LABELS: Record<DeliveryMode, string> = {
  external: "خارج الحرم الجامعي",
  campus_run: "Campus Run",
};
