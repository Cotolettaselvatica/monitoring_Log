interface OpenRdpOptions {
  host: string;
  username: string;
  password: string;
  domain?: string | null;
  filename: string;
}

function buildRdpFileContent(host: string, username: string, domain?: string | null): string {
  const lines = [
    "screen mode id:i:2",
    "use multimon:i:0",
    "desktopwidth:i:1920",
    "desktopheight:i:1080",
    "session bpp:i:32",
    "compression:i:1",
    "keyboardhook:i:2",
    "displayconnectionbar:i:1",
    "disable wallpaper:i:0",
    "allow font smoothing:i:0",
    "allow desktop composition:i:0",
    "disable full window drag:i:1",
    "disable menu anims:i:1",
    "disable themes:i:0",
    "bitmapcachepersistenable:i:1",
    `full address:s:${host}`,
    `username:s:${username}`,
  ];

  if (domain?.trim()) {
    lines.push(`domain:s:${domain.trim()}`);
  }

  lines.push("prompt for credentials:i:0");
  return `${lines.join("\r\n")}\r\n`;
}

function downloadBlob(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function openNativeRdpSession({
  host,
  username,
  password,
  domain,
  filename,
}: OpenRdpOptions): Promise<{ passwordCopied: boolean }> {
  const safeName = filename.replace(/[^\w.-]+/g, "_");
  const rdpContent = buildRdpFileContent(host, username, domain);
  downloadBlob(`${safeName}.rdp`, rdpContent, "application/x-rdp");
  const passwordCopied = await copyText(password);
  return { passwordCopied };
}

export function isValidRdpHost(host: string): boolean {
  return Boolean(host.trim()) && !host.includes("?");
}
