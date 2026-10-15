import type { FlashJob } from "./types";
import { isUf2 } from "./uf2";
import { openBootloaderUsb } from "./usb";

/* -------------------------------------------------------------------------- */
/* RP2040 BOOTSEL over WebUSB (PICOBOOT)                                       */
/* -------------------------------------------------------------------------- */

/*
 * In BOOTSEL mode the RP2040 boot ROM exposes, next to the RPI-RP2 drive, a
 * vendor-class "PICOBOOT" interface with one bulk OUT and one bulk IN endpoint
 * (RP2040 datasheet 2.8.5, pico-sdk boot/picoboot.h). Every command is a
 * 32-byte little-endian struct on OUT, then an optional data phase, then a
 * zero-length ack in the opposite direction of the last transfer.
 */

const MAGIC = 0x431fd10b;
const CMD = {
  EXCLUSIVE_ACCESS: 0x01,
  REBOOT: 0x02,
  FLASH_ERASE: 0x03,
  READ: 0x84,
  WRITE: 0x05,
  EXIT_XIP: 0x06,
} as const;
const IF_RESET = 0x41;

const FLASH_START = 0x10000000;
const FLASH_END = 0x11000000;
const SECTOR = 4096;
const SRAM_END = 0x20042000;

const RP2040_FAMILY = 0xe48bff56;
const UF2_FLAG_NOT_MAIN_FLASH = 0x00000001;
const UF2_FLAG_FAMILY = 0x00002000;

/** Flash image as a map of 4 KB sector address -> sector contents (0xFF-padded). */
function toSectors(data: Uint8Array, name: string) {
  const sectors = new Map<number, Uint8Array>();
  const put = (addr: number, bytes: Uint8Array) => {
    if (addr < FLASH_START || addr + bytes.length > FLASH_END) {
      throw new Error(`${name} writes outside flash (0x${addr.toString(16)})`);
    }
    for (let i = 0; i < bytes.length; ) {
      const a = addr + i;
      const base = a - (a % SECTOR);
      let s = sectors.get(base);
      if (!s) sectors.set(base, (s = new Uint8Array(SECTOR).fill(0xff)));
      const n = Math.min(bytes.length - i, base + SECTOR - a);
      s.set(bytes.subarray(i, i + n), a - base);
      i += n;
    }
  };

  if (isUf2(data)) {
    const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
    for (let o = 0; o + 512 <= data.length; o += 512) {
      if (v.getUint32(o, true) !== 0x0a324655 || v.getUint32(o + 4, true) !== 0x9e5d5157) continue;
      const flags = v.getUint32(o + 8, true);
      if (flags & UF2_FLAG_NOT_MAIN_FLASH) continue;
      if (flags & UF2_FLAG_FAMILY && v.getUint32(o + 28, true) !== RP2040_FAMILY) {
        throw new Error(`${name} is not an RP2040 UF2 (family 0x${v.getUint32(o + 28, true).toString(16)})`);
      }
      const addr = v.getUint32(o + 12, true);
      const size = v.getUint32(o + 16, true);
      put(addr, data.subarray(o + 32, o + 32 + size));
    }
  } else {
    // raw .bin linked for XIP flash
    put(FLASH_START, data);
  }
  if (!sectors.size) throw new Error(`${name} has no data for the RP2040's flash`);
  return [...sectors.entries()].sort((a, b) => a[0] - b[0]);
}

class Picoboot {
  private token = 1;

  constructor(
    private dev: USBDevice,
    private intf: number,
    private epOut: number,
    private epIn: number,
  ) {}

  static async open(dev: USBDevice) {
    if (!dev.configuration) await dev.selectConfiguration(1);
    for (const itf of dev.configuration!.interfaces) {
      const alt = itf.alternates[0];
      if (alt.interfaceClass !== 0xff) continue;
      const out = alt.endpoints.find((e) => e.direction === "out" && e.type === "bulk");
      const inp = alt.endpoints.find((e) => e.direction === "in" && e.type === "bulk");
      if (!out || !inp) continue;
      await dev.claimInterface(itf.interfaceNumber);
      const p = new Picoboot(dev, itf.interfaceNumber, out.endpointNumber, inp.endpointNumber);
      // Clear any half-finished command from an earlier session.
      await dev.controlTransferOut({
        requestType: "vendor",
        recipient: "interface",
        request: IF_RESET,
        value: 0,
        index: itf.interfaceNumber,
      });
      return p;
    }
    throw new Error("Selected device has no PICOBOOT interface");
  }

  private async cmd(id: number, args: number[], argSize: number, transferLength = 0, out?: Uint8Array) {
    const buf = new ArrayBuffer(32);
    const v = new DataView(buf);
    v.setUint32(0, MAGIC, true);
    v.setUint32(4, this.token++, true);
    v.setUint8(8, id);
    v.setUint8(9, argSize);
    v.setUint32(12, transferLength, true);
    if (argSize === 1) v.setUint8(16, args[0]);
    else args.forEach((a, i) => v.setUint32(16 + i * 4, a >>> 0, true));

    const sent = await this.dev.transferOut(this.epOut, buf);
    if (sent.status !== "ok") throw new Error(`PICOBOOT command 0x${id.toString(16)} failed (${sent.status})`);

    let data: DataView | undefined;
    if (id & 0x80) {
      const r = await this.dev.transferIn(this.epIn, transferLength);
      if (r.status !== "ok" || !r.data) throw new Error(`PICOBOOT read failed (${r.status})`);
      data = r.data;
      await this.dev.transferOut(this.epOut, new Uint8Array(0)); // ack
    } else {
      if (transferLength) {
        const w = await this.dev.transferOut(this.epOut, out as BufferSource);
        if (w.status !== "ok") throw new Error(`PICOBOOT write failed (${w.status})`);
      }
      const ack = await this.dev.transferIn(this.epIn, 1);
      if (ack.status !== "ok") throw new Error(`PICOBOOT command 0x${id.toString(16)} was rejected (${ack.status})`);
    }
    return data;
  }

  exclusive() {
    return this.cmd(CMD.EXCLUSIVE_ACCESS, [1], 1);
  }
  exitXip() {
    return this.cmd(CMD.EXIT_XIP, [], 0);
  }
  erase(addr: number, size: number) {
    return this.cmd(CMD.FLASH_ERASE, [addr, size], 8);
  }
  write(addr: number, bytes: Uint8Array) {
    return this.cmd(CMD.WRITE, [addr, bytes.length], 8, bytes.length, bytes);
  }
  async read(addr: number, size: number) {
    const d = (await this.cmd(CMD.READ, [addr, size], 8, size))!;
    return new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
  }
  /** Reboot into flash (PC 0 = normal boot) after `delayMs`. */
  reboot(delayMs: number) {
    return this.cmd(CMD.REBOOT, [0, SRAM_END, delayMs], 12);
  }

  async close() {
    try {
      await this.dev.releaseInterface(this.intf);
    } catch {}
    try {
      await this.dev.close();
    } catch {}
  }
}

export async function flashPicoboot({ device, parts, options, cb }: FlashJob, afterReset: boolean) {
  const sectors = toSectors(parts[0].data, parts[0].name);
  const dev = await openBootloaderUsb(device.usbFilters!, afterReset, device.bootloaderName ?? "RP2 Boot", cb);
  const pb = await Picoboot.open(dev);
  cb.log(`PICOBOOT device ${dev.productName ?? ""} · ${sectors.length} sector(s) to write`);

  try {
    await pb.exclusive();
    await pb.exitXip();

    for (let i = 0; i < sectors.length; i++) {
      const [addr, bytes] = sectors[i];
      await pb.erase(addr, SECTOR);
      await pb.write(addr, bytes);
      cb.progress(((i + 1) / sectors.length) * (options.verify ? 80 : 100), "Writing flash");
    }

    if (options.verify) {
      for (let i = 0; i < sectors.length; i++) {
        const [addr, bytes] = sectors[i];
        const got = await pb.read(addr, SECTOR);
        for (let j = 0; j < SECTOR; j++) {
          if (got[j] !== bytes[j]) throw new Error(`Verify failed at 0x${(addr + j).toString(16)}`);
        }
        cb.progress(80 + ((i + 1) / sectors.length) * 20, "Verifying");
      }
      cb.log("Verify OK");
    }

    // Reboot after a delay, so the device can be closed before it leaves the
    // bus (a device that disconnects while open lingers in Chrome's picker).
    cb.log("Rebooting into the new firmware…");
    await pb.reboot(500);
  } finally {
    await pb.close();
  }
}
