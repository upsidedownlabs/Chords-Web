/** Parse Intel HEX into a contiguous image starting at the lowest address. */
export function parseIntelHex(text: string): { data: Uint8Array; start: number } {
  const chunks: { addr: number; bytes: number[] }[] = [];
  let base = 0;
  let min = Infinity;
  let max = 0;

  const lines = text.split(/\r?\n/);
  for (let ln = 0; ln < lines.length; ln++) {
    const line = lines[ln].trim();
    if (!line) continue;
    if (line[0] !== ":") throw new Error(`HEX line ${ln + 1}: missing ':'`);
    const b: number[] = [];
    for (let i = 1; i < line.length; i += 2) b.push(parseInt(line.substr(i, 2), 16));
    const len = b[0];
    const off = (b[1] << 8) | b[2];
    const type = b[3];
    const sum = b.reduce((a, v) => (a + v) & 0xff, 0);
    if (sum !== 0) throw new Error(`HEX line ${ln + 1}: bad checksum`);
    const payload = b.slice(4, 4 + len);

    if (type === 0x00) {
      const addr = base + off;
      chunks.push({ addr, bytes: payload });
      min = Math.min(min, addr);
      max = Math.max(max, addr + len);
    } else if (type === 0x01) {
      break;
    } else if (type === 0x02) {
      base = ((payload[0] << 8) | payload[1]) << 4;
    } else if (type === 0x04) {
      base = ((payload[0] << 8) | payload[1]) * 0x10000;
    }
    // 0x03 / 0x05 (start address) are ignored
  }

  if (!chunks.length) throw new Error("HEX file contains no data");
  const data = new Uint8Array(max - min).fill(0xff);
  for (const c of chunks) data.set(c.bytes, c.addr - min);
  return { data, start: min };
}

export function looksLikeHex(bytes: Uint8Array) {
  return bytes.length > 0 && bytes[0] === 0x3a; // ':'
}

/** Normalise a firmware file: HEX -> binary, everything else passes through. */
export function toBinary(bytes: Uint8Array, name: string): { data: Uint8Array; start: number | null } {
  if (name.toLowerCase().endsWith(".hex") || looksLikeHex(bytes)) {
    const { data, start } = parseIntelHex(new TextDecoder().decode(bytes));
    return { data, start };
  }
  return { data: bytes, start: null };
}

export interface FetchFirmwareOptions {
  /** Defaults to "no-store" so bundled files in /public are never stale. */
  cache?: RequestCache;
  /** Bytes received so far, and the total when the server sends it. */
  onProgress?: (loaded: number, total: number | null) => void;
}

export async function fetchFirmware(url: string, opts: FetchFirmwareOptions = {}): Promise<Uint8Array> {
  const res = await fetch(url, { cache: opts.cache ?? "no-store" });
  if (!res.ok) throw new Error(`Couldn't load ${url} (HTTP ${res.status}). Upload a file instead.`);
  if (!opts.onProgress || !res.body) return new Uint8Array(await res.arrayBuffer());

  const total = Number(res.headers.get("Content-Length")) || null;
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    opts.onProgress(loaded, total);
  }
  const out = new Uint8Array(loaded);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

export function padTo(data: Uint8Array, multiple: number, fill = 0xff) {
  const len = Math.ceil(data.length / multiple) * multiple;
  if (len === data.length) return data;
  const out = new Uint8Array(len).fill(fill);
  out.set(data);
  return out;
}

export const hex = (n: number, w = 8) => "0x" + n.toString(16).toUpperCase().padStart(w, "0");
