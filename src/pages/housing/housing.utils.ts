import { HOUSING_AMENITIES } from "./housing.constants";

export function extractPhoneNumber(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(/الهاتف:\s*([0-9+\-\s]+)/);
  return match?.[1]?.trim() || null;
}

export function extractImageUrls(text: string | null | undefined): string[] {
  if (!text) return [];
  const match = text.match(/الصور:\s*(.+)/);
  if (!match?.[1]) return [];
  return match[1]
    .split(" | ")
    .map((url) => url.trim())
    .filter(Boolean);
}

export function extractAmenities(text: string | null | undefined): string[] {
  if (!text) return [];
  const match = text.match(/المرافق:\s*(.+)/);
  if (!match?.[1]) return [];
  return match[1]
    .split("،")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function cleanDescription(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("الهاتف:") && !line.startsWith("المرافق:") && !line.startsWith("الصور:"))
    .join("\n")
    .trim();
}

export function normalizeAmenityLabel(value: string): string {
  const mapped = HOUSING_AMENITIES.find((item) => item.id === value);
  return mapped ? mapped.label : value;
}
