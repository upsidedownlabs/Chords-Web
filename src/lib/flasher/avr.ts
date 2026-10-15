import type { FlashJob } from "./types";
import { SerialIO, pickSerialPort, sleep, TimeoutError } from "./serial";
import { padTo } from "./firmware";

/** Place the image at its load address (HEX files may not start at 0). */
function imageFrom(part: { data: Uint8Array; address: number }, pageSize: number) {
  if (!part.address) return padTo(part.data, pageSize);
  const out = new Uint8Array(part.address + part.data.length).fill(0xff);
  out.set(part.data, part.address);
  return padTo(out, pageSize);
}

/* -------------------------------------------------------------------------- */
/* Shared: toggle DTR/RTS to reset the board into its bootloader               */
/* -------------------------------------------------------------------------- */

async function resetAvr(io: SerialIO) {
  await io.setSignals({ dataTerminalReady: false, requestToSend: false });
  await sleep(250);
  await io.setSignals({ dataTerminalReady: true, requestToSend: true });
  await sleep(50);
  io.flushInput();
}

/* -------------------------------------------------------------------------- */
/* STK500 v1 — Optiboot (UNO) / ATmegaBOOT (old Nano)                          */
/* -------------------------------------------------------------------------- */

const STK_OK = 0x10;
const STK_INSYNC = 0x14;
const CRC_EOP = 0x20;

async function v1cmd(io: SerialIO, bytes: number[], replyData = 0, timeout = 500) {
  await io.write([...bytes, CRC_EOP]);
  const head = await io.read(1, timeout, "STK_INSYNC");
  if (head[0] !== STK_INSYNC) throw new Error(`Not in sync (got 0x${head[0].toString(16)})`);
  const data = replyData ? await io.read(replyData, timeout) : new Uint8Array();
  const tail = await io.read(1, timeout, "STK_OK");
  if (tail[0] !== STK_OK) throw new Error(`Bad reply (0x${tail[0].toString(16)})`);
  return data;
}

async function v1getSync(io: SerialIO): Promise<boolean> {
  io.flushInput();
  await io.write([0x30, CRC_EOP]); // STK_GET_SYNC
  try {
    const r = await io.read(2, 200);
    return r[0] === STK_INSYNC && r[1] === STK_OK;
  } catch (e) {
    if (!(e instanceof TimeoutError)) throw e;
    return false;
  }
}

async function v1sync(io: SerialIO): Promise<boolean> {
  for (let i = 0; i < 10; i++) {
    if (!(await v1getSync(io))) continue;
    // Earlier GET_SYNCs sent while the bootloader was starting can be answered
    // late; those extra 0x14 0x10 pairs would shift every later reply (e.g.
    // "Bad reply 0x95" from the signature). Let them arrive, drop them, and
    // confirm with one clean exchange, as avrdude does.
    await sleep(100);
    io.flushInput();
    if (await v1getSync(io)) {
      await sleep(20);
      if (io.available === 0) return true;
    }
  }
  return false;
}

export async function flashStk500v1({ device, parts, options, cb }: FlashJob) {
  const pageSize = device.pageSize ?? 128;
  const image = imageFrom(parts[0], pageSize);
  const port = await pickSerialPort();
  const bauds = device.baudRates ?? [115200];

  let io: SerialIO | null = null;
  try {
    let synced = false;
    for (const baud of bauds) {
      io = new SerialIO(port);
      await io.open(baud);
      cb.log(`Resetting board, trying ${baud} baud…`);
      await resetAvr(io);
      if (await v1sync(io)) {
        synced = true;
        cb.log(`Bootloader answered at ${baud} baud`);
        break;
      }
      await io.close();
      io = null;
    }
    if (!synced || !io) {
      throw new Error(
        "No answer from the bootloader. Check the port, close other serial apps, or press RESET right as you click Flash.",
      );
    }

    const sig = await v1cmd(io, [0x75], 3); // STK_READ_SIGN
    cb.log(`Signature: ${Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join(" ")}`);

    await v1cmd(io, [0x50]); // STK_ENTER_PROGMODE

    const pages = image.length / pageSize;
    for (let p = 0; p < pages; p++) {
      const addr = p * pageSize;
      const word = addr >> 1;
      await v1cmd(io, [0x55, word & 0xff, (word >> 8) & 0xff]); // STK_LOAD_ADDRESS
      const chunk = image.subarray(addr, addr + pageSize);
      await v1cmd(io, [0x64, pageSize >> 8, pageSize & 0xff, 0x46, ...chunk], 0, 1000); // STK_PROG_PAGE 'F'
      cb.progress(((p + 1) / pages) * (options.verify ? 50 : 100), "Writing flash");
    }

    if (options.verify) {
      for (let p = 0; p < pages; p++) {
        const addr = p * pageSize;
        const word = addr >> 1;
        await v1cmd(io, [0x55, word & 0xff, (word >> 8) & 0xff]);
        const got = await v1cmd(io, [0x74, pageSize >> 8, pageSize & 0xff, 0x46], pageSize, 1000); // STK_READ_PAGE
        const want = image.subarray(addr, addr + pageSize);
        for (let i = 0; i < pageSize; i++) {
          if (got[i] !== want[i]) throw new Error(`Verify failed at 0x${(addr + i).toString(16)}`);
        }
        cb.progress(50 + ((p + 1) / pages) * 50, "Verifying");
      }
      cb.log("Verify OK");
    }

    await v1cmd(io, [0x51]); // STK_LEAVE_PROGMODE -> runs the sketch
  } finally {
    await io?.close();
  }
}

/* -------------------------------------------------------------------------- */
/* STK500 v2 — Wiring bootloader (Mega 2560)                                   */
/* -------------------------------------------------------------------------- */

class Stk500v2 {
  private seq = 0;
  constructor(private io: SerialIO) {}

  async cmd(body: number[], timeout = 1000): Promise<Uint8Array> {
    const msg = [0x1b, this.seq, body.length >> 8, body.length & 0xff, 0x0e, ...body];
    msg.push(msg.reduce((a, v) => a ^ v, 0));
    await this.io.write(msg);

    const head = await this.io.read(5, timeout, "STK500v2 header");
    if (head[0] !== 0x1b || head[4] !== 0x0e) throw new Error("STK500v2: bad frame start");
    if (head[1] !== this.seq) throw new Error("STK500v2: sequence mismatch");
    const len = (head[2] << 8) | head[3];
    const rest = await this.io.read(len + 1, timeout, "STK500v2 body");
    let x = 0;
    for (const b of head) x ^= b;
    for (const b of rest) x ^= b;
    if (x !== 0) throw new Error("STK500v2: checksum error");
    this.seq = (this.seq + 1) & 0xff;

    const reply = rest.subarray(0, len);
    if (reply[0] !== body[0] || reply[1] !== 0x00) {
      throw new Error(`STK500v2: command 0x${body[0].toString(16)} failed (status 0x${reply[1]?.toString(16)})`);
    }
    return reply;
  }

  async signOn(): Promise<boolean> {
    for (let i = 0; i < 10; i++) {
      this.io.flushInput();
      try {
        const r = await this.cmd([0x01], 300); // CMD_SIGN_ON
        const name = new TextDecoder().decode(r.subarray(3, 3 + r[2]));
        return name.length > 0;
      } catch {
        this.seq = 0; // timeout or garbage from the sketch: retry
      }
    }
    return false;
  }

  loadAddress(byteAddr: number) {
    const w = (byteAddr >>> 1) | 0x80000000; // bit31 = extended addressing (>128 KB)
    return this.cmd([0x06, (w >>> 24) & 0xff, (w >>> 16) & 0xff, (w >>> 8) & 0xff, w & 0xff]);
  }
}

export async function flashStk500v2({ device, parts, options, cb }: FlashJob) {
  const pageSize = device.pageSize ?? 256;
  const image = imageFrom(parts[0], pageSize);
  const port = await pickSerialPort();
  const io = new SerialIO(port);

  try {
    await io.open(device.baudRates?.[0] ?? 115200);
    cb.log("Resetting board…");
    await resetAvr(io);
    const stk = new Stk500v2(io);
    if (!(await stk.signOn())) throw new Error("No answer from the Mega bootloader.");
    cb.log("Bootloader signed on");

    // CMD_ENTER_PROGMODE_ISP with avrdude's ATmega2560 parameters
    await stk.cmd([0x10, 200, 100, 25, 32, 0, 0x53, 3, 0xac, 0x53, 0x00, 0x00]);

    const sig: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await stk.cmd([0x1b, 4, 0x30, 0x00, i, 0x00]); // CMD_READ_SIGNATURE_ISP
      sig.push(r[2]);
    }
    cb.log(`Signature: ${sig.map((b) => b.toString(16).padStart(2, "0")).join(" ")}`);

    const pages = image.length / pageSize;
    for (let p = 0; p < pages; p++) {
      const addr = p * pageSize;
      await stk.loadAddress(addr);
      const chunk = image.subarray(addr, addr + pageSize);
      // CMD_PROGRAM_FLASH_ISP, page mode (0xC1)
      await stk.cmd([0x13, pageSize >> 8, pageSize & 0xff, 0xc1, 10, 0x40, 0x4c, 0x20, 0x00, 0x00, ...chunk], 2000);
      cb.progress(((p + 1) / pages) * (options.verify ? 50 : 100), "Writing flash");
    }

    if (options.verify) {
      for (let p = 0; p < pages; p++) {
        const addr = p * pageSize;
        await stk.loadAddress(addr);
        const r = await stk.cmd([0x14, pageSize >> 8, pageSize & 0xff, 0x20], 2000); // CMD_READ_FLASH_ISP
        const got = r.subarray(2, 2 + pageSize);
        const want = image.subarray(addr, addr + pageSize);
        for (let i = 0; i < pageSize; i++) {
          if (got[i] !== want[i]) throw new Error(`Verify failed at 0x${(addr + i).toString(16)}`);
        }
        cb.progress(50 + ((p + 1) / pages) * 50, "Verifying");
      }
      cb.log("Verify OK");
    }

    await stk.cmd([0x11, 1, 1]); // CMD_LEAVE_PROGMODE_ISP
  } finally {
    await io.close();
  }
}
