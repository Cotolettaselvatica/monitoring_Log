export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
export const MAX_IMAGE_SIZE_MB = 5;

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "Selezionare un file immagine (JPEG, PNG, WebP, GIF).";
  }
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
    return `Dimensione massima: ${MAX_IMAGE_SIZE_MB} MB.`;
  }
  return null;
}
