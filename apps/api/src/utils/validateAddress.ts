import { isValidClassicAddress } from "xrpl";

export function normalizeAddress(value: unknown): string {
  return String(value ?? "").trim();
}

export function getAddressValidationError(value: unknown): string | null {
  const address = normalizeAddress(value);

  if (!address) return "Missing address";
  if (!isValidClassicAddress(address)) return "Invalid XRPL address";

  return null;
}
