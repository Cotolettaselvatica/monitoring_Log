/**
 * Portale telemetria VettaSoft — servito via proxy same-origin (/vettasoft)
 * così i cookie di sessione funzionano nell'iframe (no third-party cookies).
 */
export const VETTASOFT_TELEMETRY_URL =
  (import.meta.env.VITE_VETTASOFT_TELEMETRY_URL as string | undefined)?.trim() ||
  "/vettasoft/login";

/** Macchinari con tracciamento VettaSoft (label visuali in /machines). */
export const VETTASOFT_TRACKED_LABELS = ["Logicat Telaini", "Logicat verniciatura sifoni"] as const;
