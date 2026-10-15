import type { FlashJob } from "./types";
import { SerialIO, TimeoutError, pickSerialPort, sleep, touch1200 } from "./serial";
import { padTo } from "./firmware";

/**
 * UNO R4 WiFi.
 *
 * The ESP32-S3 USB bridge reacts to a 1200 baud "touch" by double-resetting the
 * RA4M1 into the Arduino bootloader, which speaks a small SAM-BA dialect over a
 * 230400 baud UART (arduino-renesas-bootloader, src/bossa.c):
 *
 *   N#                        -> "\n\r"
 *   S<addr8>,<size8>#<bytes>  -> (no reply) bytes land in an 8 KB RAM buffer
 *   Y<addr8>,0#               -> "Y\n\r"  set source offset in that buffer
 *   Y<off8>,<size8>#          -> "Y\n\r"  erase+write flash at sketch offset
 *   Z<off8>,<size8>#          -> "Z<crc8>#\n\r" CRC16-CCITT of flash
 *   K#                        -> reset into the sketch
 */

const BAUD = 230400;
const CHUNK = 4096; // bootloader erases 2 x 2 KB blocks on each 4 KB boundary
const MAX_SIZE = 256 * 1024 - 16 * 1024;

const h8 = (n: number) => n.toString(16).toUpperCase().padStart(8, "0");

function crc16(data: Uint8Array) {
  let crc = 0;
  for (const b of data) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

async function command(io: SerialIO, cmd: string, timeout = 1000) {
  io.flushInput();
  await io.write(cmd);
  const r = await io.readUntil(0x0d /* \r */, timeout, `reply to ${cmd}`);
  return new TextDecoder().decode(r);
}

/**
 * "K#" resets the RA4M1, which should then boot the sketch. It doesn't always
 * (the board then needs a replug), so check: if the bootloader still answers
 * "N#", send "K#" again. The sketch ignores "N#" (it replies "UNKNOWN COMMAND"
 * after its 1 s readStringUntil timeout), and that reply is drained so it
 * can't be mistaken for the next WHORU answer.
 */
async function leaveBootloader(io: SerialIO, cb: FlashJob["cb"]) {
  for (let attempt = 0; attempt < 3; attempt++) {
    io.flushInput();
    await io.write("K#");
    // Bootloader waits 500 ms (double-tap window) before starting the sketch.
    await sleep(1000);
    io.flushInput();
    await io.write("N#");
    try {
      await io.readUntil(0x0d, 500, "bootloader");
    } catch (e) {
      if (!(e instanceof TimeoutError)) throw e;
      await sleep(1200); // let the sketch time out on "N#" and reply
      io.flushInput();
      return; // no bootloader reply: the sketch is running
    }
    cb.log("Board is still in the bootloader, resetting again…");
  }
  throw new Error("The board stayed in its bootloader. Press RESET on the board (or replug it).");
}

export async function flashUnoR4Wifi({ parts, options, cb }: FlashJob) {
  const image = padTo(parts[0].data, CHUNK);
  if (parts[0].data.length > MAX_SIZE) throw new Error("Firmware is larger than the RA4M1 sketch area");

  const port = await pickSerialPort();

  cb.log("Asking the USB bridge to start the bootloader (1200 baud touch)…");
  await touch1200(port);
  await sleep(1500);

  const io = new SerialIO(port);
  await io.open(BAUD);
  try {
    let ok = false;
    for (let i = 0; i < 10 && !ok; i++) {
      try {
        await command(io, "N#", 300);
        ok = true;
      } catch {
        await sleep(200);
      }
    }
    if (!ok) throw new Error("RA4M1 bootloader didn't answer. Unplug/replug the board and try again.");
    const version = await command(io, "V#").catch(() => "");
    if (version) cb.log(version.trim());

    const n = image.length / CHUNK;
    for (let c = 0; c < n; c++) {
      const off = c * CHUNK;
      // upload to RAM buffer at 0
      io.flushInput();
      await io.write(`S${h8(0)},${h8(CHUNK)}#`);
      await sleep(5);
      await io.write(image.subarray(off, off + CHUNK));
      // source offset in buffer, then write to flash
      await command(io, `Y${h8(0)},0#`, 3000);
      const r = await command(io, `Y${h8(off)},${h8(CHUNK)}#`, 5000);
      if (!r.startsWith("Y")) throw new Error(`Write failed at offset 0x${off.toString(16)}`);
      cb.progress(((c + 1) / n) * (options.verify ? 80 : 100), "Writing flash");
    }

    if (options.verify) {
      // The bootloader builds the Z reply in a stack buffer and sends it
      // asynchronously, so the reply can arrive garbled or without its "\r".
      // Arduino's own uploader never verifies this board; treat a missing
      // checksum as "can't verify" rather than a failed flash.
      let verified = true;
      for (let c = 0; c < n; c++) {
        const off = c * CHUNK;
        const r = await command(io, `Z${h8(off)},${h8(CHUNK)}#`, 1000).catch(() => "");
        const m = r.match(/Z([0-9A-F]{8})#/i);
        if (!m) {
          verified = false;
          break;
        }
        const want = crc16(image.subarray(off, off + CHUNK));
        if (parseInt(m[1], 16) !== want) throw new Error(`Verify failed at offset 0x${off.toString(16)}`);
        cb.progress(80 + ((c + 1) / n) * 20, "Verifying");
      }
      cb.log(verified ? "Verify OK" : "The bootloader didn't return a checksum, so verify was skipped.");
    }

    cb.log("Resetting into sketch…");
    await leaveBootloader(io, cb);
  } finally {
    await io.close();
  }
}
