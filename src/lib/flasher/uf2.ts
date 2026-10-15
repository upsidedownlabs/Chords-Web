import type { FlashJob } from "./types";

const RP2040_FAMILY = 0xe48bff56;

export function isUf2(data: Uint8Array) {
  if (data.length < 512) return false;
  const v = new DataView(data.buffer, data.byteOffset, 512);
  return v.getUint32(0, true) === 0x0a324655 && v.getUint32(4, true) === 0x9e5d5157;
}

/** Wrap a raw .bin (linked for XIP flash at 0x10000000) into UF2 blocks. */
export function binToUf2(bin: Uint8Array, base = 0x10000000, family = RP2040_FAMILY) {
  const payload = 256;
  const blocks = Math.ceil(bin.length / payload);
  const out = new Uint8Array(blocks * 512);
  const v = new DataView(out.buffer);
  for (let i = 0; i < blocks; i++) {
    const o = i * 512;
    v.setUint32(o + 0, 0x0a324655, true);
    v.setUint32(o + 4, 0x9e5d5157, true);
    v.setUint32(o + 8, 0x00002000, true); // familyID present
    v.setUint32(o + 12, base + i * payload, true);
    v.setUint32(o + 16, payload, true);
    v.setUint32(o + 20, i, true);
    v.setUint32(o + 24, blocks, true);
    v.setUint32(o + 28, family, true);
    out.set(bin.subarray(i * payload, (i + 1) * payload), o + 32);
    v.setUint32(o + 508, 0x0ab16f30, true);
  }
  return out;
}

export function downloadFile(data: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type: "application/octet-stream" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * RP2040 in BOOTSEL mode shows up as a USB drive (RPI-RP2). The browser can
 * write to it through the File System Access API; the Pico reboots as soon as
 * the whole UF2 has been written.
 */
export async function flashUf2({ parts, cb }: FlashJob) {
  const src = parts[0].data;
  const uf2 = isUf2(src) ? src : binToUf2(src);

  if (!("showDirectoryPicker" in window)) {
    cb.log("This browser can't write to drives. Downloading the .uf2: drag it onto RPI-RP2.");
    downloadFile(uf2, "firmware.uf2");
    return;
  }

  cb.log("Select the RPI-RP2 drive…");
  const dir = await window.showDirectoryPicker({ id: "rpi-rp2", mode: "readwrite" });

  try {
    await dir.getFileHandle("INFO_UF2.TXT");
  } catch {
    throw new Error("That folder isn't the RPI-RP2 drive (INFO_UF2.TXT not found).");
  }

  const fh = await dir.getFileHandle("firmware.uf2", { create: true });
  const w = await fh.createWritable();
  const step = 64 * 1024;
  for (let i = 0; i < uf2.length; i += step) {
    await w.write(uf2.subarray(i, i + step) as BufferSource);
    cb.progress(Math.min(99, ((i + step) / uf2.length) * 100), "Copying UF2");
  }
  try {
    await w.close();
  } catch {
    /* the drive can disappear the moment the last block lands */
  }
  cb.progress(100, "Copied");
  cb.log("UF2 copied. The Pico reboots into the new firmware.");
}
