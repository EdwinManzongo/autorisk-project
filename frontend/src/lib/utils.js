import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Normalise a FastAPI/Pydantic error response into a plain string.
 * Pydantic v2 validation errors return detail as an array of
 * {type, loc, msg, input, ctx} objects — rendering those directly
 * in React throws "Objects are not valid as a React child".
 */
export function parseApiError(err, fallback = 'Operation failed') {
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map(e => e.msg ?? JSON.stringify(e)).join('; ') || fallback;
  }
  return fallback;
}
