import type { FlashJob } from "./types";
import { pickSerialPort } from "./serial";

/** esptool-js 0.5 takes flash data as a "binary string" (one char per byte). */
function toBinaryString(data: Uint8Array) {
  let out = "";
  for (let i = 0; i < data.length; i += 0x8000) {
    out += String.fromCharCode(...data.subarray(i, i + 0x8000));
  }
  return out;
}

// esptool-js is pinned to 0.5.7, the version the NPG Lite flasher uses. 0.7's
// chip detection (GET_SECURITY_INFO) can fail on the ESP32-C6, and its fallback
// closes, reopens and resets the port, after which the chip goes silent
// ("Serial data stream stopped"). 0.5.7 just reads the chip's magic register.
export async function flashEsp({ device, parts, options, cb }: FlashJob) {
  // esptool-js touches `window`, so load it only in the browser.
  const { ESPLoader, Transport } = await import("esptool-js");

  const port = await pickSerialPort();
  const transport = new Transport(port, false);

  const loader = new ESPLoader({
    transport,
    baudrate: device.espBaud ?? 921600,
    romBaudrate: 115200,
    terminal: {
      clean: () => {},
      writeLine: (s) => cb.log(s),
      write: (s) => {
        const t = s.trim();
        if (t) cb.log(t);
      },
    },
  });

  try {
    cb.log("Connecting to ESP bootloader…");
    const chip = await loader.main();
    cb.log(`Detected ${chip}`);
    // Boards that share a USB ID (NPG Lite / ESP32-S3) are told apart here, so
    // an image for the wrong chip is never written.
    if (device.espChip && !chip.toUpperCase().includes(device.espChip.toUpperCase())) {
      throw new Error(`This board is an ${chip}, not ${device.espChip}. Pick the matching board and try again.`);
    }

    const total = parts.reduce((a, p) => a + p.data.length, 0);
    const done: number[] = parts.map(() => 0);

    await loader.writeFlash({
      fileArray: parts.map((p) => ({ data: toBinaryString(p.data), address: p.address })),
      flashMode: "keep",
      flashFreq: "keep",
      flashSize: "keep",
      eraseAll: options.eraseAll,
      compress: true,
      reportProgress: (i, written, size) => {
        done[i] = (written / size) * parts[i].data.length;
        const pct = (done.reduce((a, v) => a + v, 0) / total) * 100;
        cb.progress(pct, `Writing ${parts[i].name}`);
      },
    });

    // esptool-js's after("hard_reset") only drops RTS without raising it
    // first, so the chip never resets. Pulse EN ourselves: RTS high with DTR
    // low holds the chip in reset (works for USB-Serial-JTAG and the classic
    // DTR/RTS auto-reset circuit), then release both so it boots the new app
    // instead of the ROM bootloader.
    cb.log("Resetting board…");
    await transport.setDTR(false);
    await transport.setRTS(true);
    await new Promise((r) => setTimeout(r, 200));
    await transport.setRTS(false);
    await new Promise((r) => setTimeout(r, 200));
  } finally {
    await transport.disconnect().catch(() => {});
  }
}
