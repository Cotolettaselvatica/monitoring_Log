const STORAGE_KEY = "catis-machine-images";

function readAll(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getLocalMachineImage(machineId: string): string | undefined {
  return readAll()[machineId];
}

export function setLocalMachineImage(machineId: string, dataUrl: string): void {
  const data = readAll();
  data[machineId] = dataUrl;
  writeAll(data);
}

export function removeLocalMachineImage(machineId: string): void {
  const data = readAll();
  delete data[machineId];
  writeAll(data);
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Lettura file non riuscita"));
    reader.readAsDataURL(file);
  });
}
