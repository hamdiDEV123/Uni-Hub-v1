import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dispatch, SetStateAction } from "react";
import type { ProductFormData } from "../marketplace.types";

interface ListingModeFieldsProps {
  form: ProductFormData;
  setForm: Dispatch<SetStateAction<ProductFormData>>;
}

export function ListingModeFields({ form, setForm }: ListingModeFieldsProps) {
  if (form.listing_mode === "rental") {
    return (
      <div className="space-y-2">
        <Label htmlFor="rental-price">{"سعر الإيجار/اليوم (ج.م)"}</Label>
        <Input
          id="rental-price"
          type="number"
          min="1"
          value={form.rental_price_per_day}
          onChange={(e) => setForm((p) => ({ ...p, rental_price_per_day: e.target.value }))}
          placeholder="مثال: 50"
        />
      </div>
    );
  }

  if (form.listing_mode === "barter") {
    return (
      <div className="space-y-2">
        <Label htmlFor="barter-for">{"مطلوب مقابل"}</Label>
        <Input
          id="barter-for"
          value={form.barter_for}
          onChange={(e) => setForm((p) => ({ ...p, barter_for: e.target.value }))}
          placeholder="مثال: كتب كيمياء فرقة أولى أو آلة حاسبة"
        />
      </div>
    );
  }

  if (form.listing_mode === "service") {
    return (
      <div className="space-y-2">
        <Label htmlFor="service-days">{"مدة التنفيذ (أيام)"}</Label>
        <Input
          id="service-days"
          type="number"
          min="1"
          value={form.service_delivery_days}
          onChange={(e) => setForm((p) => ({ ...p, service_delivery_days: e.target.value }))}
          placeholder="مثال: 2"
        />
      </div>
    );
  }

  return null;
}
