export type DeliveryMode = "external" | "campus_run";

export interface DeliveryDraftOrder {
  title: string;
  pickup: string;
  dropoff: string;
  fee: string;
  type: DeliveryMode;
  phone: string;
}

export const DEFAULT_DELIVERY_DRAFT: DeliveryDraftOrder = {
  title: "",
  pickup: "",
  dropoff: "",
  fee: "",
  type: "external",
  phone: "",
};

export function normalizeDeliveryMode(value: string | null | undefined): DeliveryMode {
  if (value === "campus_run" || value === "internal") {
    return "campus_run";
  }
  return "external";
}
