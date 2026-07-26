/**
 * Small form-data helpers. Server actions are a public entry point, so every
 * field a form submits gets read through one of these rather than cast.
 */

export class ValidationError extends Error {}

export function requiredString(
  formData: FormData,
  field: string,
  label: string,
  maxLength = 500,
): string {
  const value = String(formData.get(field) ?? "").trim();
  if (!value) throw new ValidationError(`${label} is required.`);
  if (value.length > maxLength) {
    throw new ValidationError(`${label} must be ${maxLength} characters or fewer.`);
  }
  return value;
}

export function optionalString(
  formData: FormData,
  field: string,
  maxLength = 5000,
): string | null {
  const value = String(formData.get(field) ?? "").trim();
  if (!value) return null;
  return value.slice(0, maxLength);
}

export function requiredEmail(
  formData: FormData,
  field: string,
  label: string,
): string {
  const value = requiredString(formData, field, label, 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new ValidationError(`${label} must be a valid email address.`);
  }
  return value;
}

export function enumValue<T extends string>(
  formData: FormData,
  field: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = String(formData.get(field) ?? "") as T;
  return allowed.includes(value) ? value : fallback;
}

export function optionalDate(formData: FormData, field: string): string | null {
  const value = String(formData.get(field) ?? "").trim();
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError("Dates must be in YYYY-MM-DD format.");
  }
  return value;
}

export function requiredUuid(
  formData: FormData,
  field: string,
  label: string,
): string {
  const value = String(formData.get(field) ?? "").trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new ValidationError(`${label} is required.`);
  }
  return value;
}

export function optionalUuid(formData: FormData, field: string): string | null {
  const value = String(formData.get(field) ?? "").trim();
  if (!value) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  )
    ? value
    : null;
}

/** Parses money/quantity input, rejecting NaN and negatives. */
export function decimal(
  value: FormDataEntryValue | null,
  label: string,
  { min = 0, max = 1_000_000_000 }: { min?: number; max?: number } = {},
): number {
  const raw = String(value ?? "").trim();
  const parsed = Number(raw === "" ? "0" : raw.replace(/[$,]/g, ""));
  if (!Number.isFinite(parsed)) {
    throw new ValidationError(`${label} must be a number.`);
  }
  if (parsed < min || parsed > max) {
    throw new ValidationError(`${label} is out of range.`);
  }
  return Math.round(parsed * 100) / 100;
}

/** Turns any thrown error into a message safe to show in the UI. */
export function toFormError(error: unknown): string {
  if (error instanceof ValidationError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}
