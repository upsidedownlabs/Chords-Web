import { NeedsUserGesture, type DeviceDef, type FlashCallbacks, type FlashJob } from "./types";
import { fetchFirmware, toBinary } from "./firmware";
import { findOrPickSerialPort, pickSerialPort, sleep, touch1200 } from "./serial";
import { flashEsp } from "./esp";
import { flashStk500v1, flashStk500v2 } from "./avr";
import { flashDfu, flashDfuse } from "./dfu";
import { findBootloaderUsb } from "./usb";
import { flashUnoR4Wifi } from "./samba-r4";
import { flashUf2 } from "./uf2";
import { flashPicoboot } from "./picoboot";

export * from "./types";
export { setPreferredSerialPort } from "./serial";
export { DEVICES, PROTOCOL_LABEL } from "./devices";

export interface FlashRequest {
  device: DeviceDef;
  /** Custom upload; if absent the bundled firmware is fetched from /public. */
  file?: File | null;
  /** ESP32: flash offset of a custom upload. */
  customAddress?: number;
  eraseAll?: boolean;
  verify?: boolean;
  /** DFU boards: board is already in bootloader mode (double-tapped RESET). */
  skipTouch?: boolean;
}

export function browserSupport() {
  if (typeof navigator === "undefined") return { serial: false, usb: false, fsAccess: false };
  return {
    serial: "serial" in navigator,
    usb: "usb" in navigator,
    fsAccess: typeof window !== "undefined" && "showDirectoryPicker" in window,
  };
}

export function needsApi(device: DeviceDef): "serial" | "usb" | "fs" {
  if (device.protocol === "dfu" || device.protocol === "dfuse" || device.protocol === "picoboot") return "usb";
  if (device.protocol === "uf2") return "fs";
  return "serial";
}

async function loadParts(req: FlashRequest, cb: FlashCallbacks): Promise<FlashJob["parts"]> {
  const { device, file } = req;
  const raw: { bytes: Uint8Array; name: string; address: number }[] = [];

  if (file) {
    raw.push({
      bytes: new Uint8Array(await file.arrayBuffer()),
      name: file.name,
      address: req.customAddress ?? device.firmware[0]?.address ?? 0,
    });
  } else {
    if (!device.firmware.length) throw new Error("No bundled firmware for this board. Upload a file.");
    for (const p of device.firmware) {
      cb.log(`Loading ${p.url}…`);
      raw.push({ bytes: await fetchFirmware(p.url), name: p.label ?? p.url.split("/").pop()!, address: p.address });
    }
  }

  return raw.map((r) => {
    if (device.protocol === "uf2" || device.protocol === "picoboot") return { data: r.bytes, address: r.address, name: r.name };
    const { data, start } = toBinary(r.bytes, r.name);
    return { data, address: start ?? r.address, name: r.name };
  });
}

export async function flashDevice(req: FlashRequest, cb: FlashCallbacks) {
  const parts = await loadParts(req, cb);
  const size = parts.reduce((a, p) => a + p.data.length, 0);
  cb.log(`Firmware: ${parts.map((p) => p.name).join(", ")} (${(size / 1024).toFixed(1)} KB)`);

  const job: FlashJob = {
    device: req.device,
    parts,
    options: { eraseAll: !!req.eraseAll, verify: req.verify ?? true },
    cb,
  };

  switch (req.device.protocol) {
    case "esptool":
      return flashEsp(job);
    case "stk500v1":
      return flashStk500v1(job);
    case "stk500v2":
      return flashStk500v2(job);
    case "samba-r4":
      return flashUnoR4Wifi(job);
    case "uf2":
      return flashUf2(job);
    case "dfu":
    case "dfuse":
    case "picoboot": {
      let afterReset = false;
      const inBootloader = !!(await findBootloaderUsb(req.device.usbFilters!));
      // The sketch's serial port only exists while the sketch runs: if it's
      // gone, the board is (most likely) already in its bootloader, so don't
      // try to reset it and go straight to the DFU device.
      const sketchGone = (await sketchPortPresent(req.device.serialFilters)) === false;
      if (sketchGone && req.device.touch1200 && !req.skipTouch && !inBootloader) {
        cb.log("The board's serial port isn't there, so it's likely already in bootloader mode.");
      }
      if (req.device.touch1200 && !req.skipTouch && !inBootloader && !sketchGone) {
        cb.log("Resetting the board into the bootloader…");
        const port = await findOrPickSerialPort(req.device.serialFilters).catch((e) => {
          // No serial port picked: the board may already be in bootloader mode
          // (it has no serial port then), so go straight to the DFU picker.
          if (e instanceof DOMException && e.name === "NotFoundError") return undefined;
          throw e;
        });
        if (port) {
          // The sketch's serial port goes away when the board really restarts.
          const left = new Promise<boolean>((resolve) => {
            port.addEventListener("disconnect", () => resolve(true), { once: true });
            setTimeout(() => resolve(false), 3000);
          });
          try {
            await touch1200(port);
          } catch (e) {
            // On Windows, opening at 1200 baud can restart the board (UNO R4)
            // before open() returns, so open() fails although the reset worked.
            // The port vanishing tells the two apart.
            if (await left) {
              cb.log("The board restarted into its bootloader.");
            } else {
              // Really couldn't open it (busy, e.g. open in another app): let the
              // user enter the bootloader by hand and continue.
              cb.log(`Couldn't reset the board automatically (${e instanceof Error ? e.message : String(e)}).`);
              throw new NeedsUserGesture(
                `${req.device.resetHint ?? "Double-tap the RESET button on the board to put it in bootloader mode (the LED fades in and out)."} ` +
                  `Then click Continue and select "${req.device.bootloaderName ?? "DFU device"}" in the browser's list.`,
              );
            }
          }
          cb.log("Waiting for the bootloader to enumerate…");
          if (!(await left)) {
            // The reset may still have worked without the browser reporting the
            // disconnect: look for the bootloader anyway instead of giving up.
            cb.log(
              "The serial port didn't report a restart; looking for the bootloader anyway. " +
                "If nothing is found, double-tap RESET and press Flash again.",
            );
          }
          await sleep(1000);
          afterReset = true;
        } else {
          cb.log("No serial port picked. If the board is in bootloader mode, pick its USB bootloader device.");
        }
      }
      if (req.device.protocol === "picoboot") return flashPicoboot(job, afterReset);
      return req.device.protocol === "dfu" ? flashDfu(job, afterReset) : flashDfuse(job, afterReset);
    }
  }
}

/**
 * Whether a serial port matching `filters` that this site may use is plugged in;
 * undefined when that can't be told (no filters / no Web Serial).
 */
async function sketchPortPresent(filters?: SerialPortFilter[]): Promise<boolean | undefined> {
  if (!filters?.length || typeof navigator === "undefined" || !("serial" in navigator)) return undefined;
  const ports = await navigator.serial.getPorts();
  return ports.some((p) => {
    const i = p.getInfo();
    return filters.some(
      (f) =>
        (f.usbVendorId === undefined || f.usbVendorId === i.usbVendorId) &&
        (f.usbProductId === undefined || f.usbProductId === i.usbProductId),
    );
  });
}

/**
 * Revoke every USB device and serial port this site was granted, so the next
 * flash asks for them again. Dead entries Chrome still shows in its picker
 * only go away when the browser restarts.
 */
export async function forgetDevices() {
  let usb = 0;
  let serial = 0;
  if (typeof navigator !== "undefined" && "usb" in navigator) {
    for (const d of await navigator.usb.getDevices()) {
      await d.close().catch(() => {});
      await d.forget();
      usb++;
    }
  }
  if (typeof navigator !== "undefined" && "serial" in navigator) {
    for (const p of await navigator.serial.getPorts()) {
      await p.close().catch(() => {});
      await p.forget();
      serial++;
    }
  }
  return { usb, serial };
}

/** RP2040 running an Arduino sketch: 1200 baud touch reboots into BOOTSEL. */
export async function resetToBootloader() {
  const port = await pickSerialPort();
  await touch1200(port);
}
