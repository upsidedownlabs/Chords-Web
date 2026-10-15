export type Protocol =
  | "esptool" // ESP32 family over Web Serial (esptool-js)
  | "stk500v1" // Optiboot / ATmegaBOOT (UNO, Nano) over Web Serial
  | "stk500v2" // Wiring bootloader (Mega 2560) over Web Serial
  | "samba-r4" // UNO R4 WiFi (SAM-BA over the ESP32-S3 USB bridge)
  | "dfu" // Plain USB DFU 1.1 over WebUSB (UNO R4 Minima)
  | "dfuse" // ST DfuSe over WebUSB (STM32 ROM bootloader, GIGA R1)
  | "picoboot" // RP2040 BOOTSEL over WebUSB (PICOBOOT interface)
  | "uf2"; // RP2040 BOOTSEL mass-storage drive

export interface FirmwarePart {
  /** Path under /public, e.g. /firmware/esp32-s3/firmware.bin */
  url: string;
  /** Flash offset. Only used by ESP32 (multi-part) and DfuSe devices. */
  address: number;
  label?: string;
}

export interface DeviceDef {
  id: string;
  name: string;
  family: "ESP32" | "STM32" | "Arduino Renesas" | "Arduino Mbed" | "RP2040" | "AVR";
  protocol: Protocol;
  /** Bundled firmware in /public. Leave empty to require a user upload. */
  firmware: FirmwarePart[];
  /** File extensions accepted for a custom upload. */
  accept: string;

  // ---- protocol options ----
  /** AVR: baud rates to try in order (bootloaders differ). */
  baudRates?: number[];
  /** AVR: flash page size in bytes. */
  pageSize?: number;
  /** ESP32: baud used after the stub is loaded. */
  espBaud?: number;
  /** ESP32: expected chip (e.g. "ESP32-C6"); flashing stops if another chip answers. */
  espChip?: string;
  /** WebUSB filters for the bootloader (DFU) device. */
  usbFilters?: USBDeviceFilter[];
  /** How the bootloader is named in the browser's USB device list, e.g. "Giga". */
  bootloaderName?: string;
  /** DfuSe: start address of the application. */
  dfuseAddress?: number;
  /** Open the running sketch's serial port at 1200 baud to jump to the bootloader first. */
  touch1200?: boolean;
  /** Serial port of the running sketch; lets a previously granted port be reused without a picker. */
  serialFilters?: SerialPortFilter[];
  /** Shown when the 1200 baud touch doesn't make the board restart. */
  resetHint?: string;

  /** Short steps shown to the user before flashing. */
  instructions: string[];
}

export interface FlashCallbacks {
  log: (msg: string) => void;
  progress: (percent: number, label?: string) => void;
  /** The browser's USB device list opened (true) or closed (false). */
  pickerOpen?: (open: boolean) => void;
}

export interface FlashJob {
  device: DeviceDef;
  /** Firmware images, already loaded into memory. */
  parts: { data: Uint8Array; address: number; name: string }[];
  options: {
    eraseAll: boolean;
    verify: boolean;
  };
  cb: FlashCallbacks;
}

/**
 * Thrown when the device has been put into bootloader mode but the browser
 * needs a fresh click (user gesture) to open the USB picker.
 */
export class NeedsUserGesture extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NeedsUserGesture";
  }
}
