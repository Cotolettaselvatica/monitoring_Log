import axios from "axios";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

export const hasApi = API_BASE_URL.trim().length > 0;

export const API_WRITE_MESSAGE =
  "Operazione non disponibile: configurare VITE_API_BASE_URL per collegare il backend.";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  headers: { "Content-Type": "application/json" },
});

export function requireApiWrite(): void {
  if (!hasApi) {
    throw new Error(API_WRITE_MESSAGE);
  }
}

export async function withFallback<T>(
  apiCall: () => Promise<T>,
  fallback: () => T,
): Promise<T> {
  if (!hasApi) {
    return Promise.resolve(fallback());
  }
  try {
    return await apiCall();
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[API] chiamata fallita, uso dati mock di fallback:", error);
    }
    return fallback();
  }
}

export async function apiWrite<T>(apiCall: () => Promise<T>): Promise<T> {
  requireApiWrite();
  return apiCall();
}

/** Scrittura su API se configurata, altrimenti mock locale (es. CRUD demo). */
export async function writeOrMock<T>(apiCall: () => Promise<T>, mockCall: () => T): Promise<T> {
  if (hasApi) return apiWrite(apiCall);
  return Promise.resolve(mockCall());
}
