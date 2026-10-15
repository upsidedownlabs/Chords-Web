export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class TimeoutError extends Error {
  constructor(what: string) {
    super(`Timeout waiting for ${what}`);
    this.name = "TimeoutError";
  }
}

/**
 * Small buffered wrapper around a Web Serial port with timed reads.
 * One background loop drains the port into an internal buffer.
 */
export class SerialIO {
  private buf: number[] = [];
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private loop: Promise<void> | null = null;
  private wake: (() => void) | null = null;

  constructor(public readonly port: SerialPort) {}

  async open(baudRate: number) {
    await openPort(this.port, { baudRate, bufferSize: 16384 });
    this.buf = [];
    this.loop = this.readLoop();
  }

  private async readLoop() {
    if (!this.port.readable) return;
    this.reader = this.port.readable.getReader();
    try {
      for (;;) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          for (let i = 0; i < value.length; i++) this.buf.push(value[i]);
          this.wake?.();
        }
      }
    } catch {
      /* port closed / device unplugged */
    } finally {
      this.reader.releaseLock();
      this.reader = null;
    }
  }

  async close() {
    try {
      await this.reader?.cancel();
    } catch {}
    try {
      await this.loop;
    } catch {}
    try {
      await this.port.close();
    } catch {}
  }

  flushInput() {
    this.buf = [];
  }

  get available() {
    return this.buf.length;
  }

  async write(data: Uint8Array | number[] | string) {
    const bytes =
      typeof data === "string"
        ? new TextEncoder().encode(data)
        : data instanceof Uint8Array
          ? data
          : Uint8Array.from(data);
    const w = this.port.writable!.getWriter();
    try {
      await w.write(bytes);
    } finally {
      w.releaseLock();
    }
  }

  private waitForData(ms: number) {
    return new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        this.wake = null;
        resolve();
      }, ms);
      this.wake = () => {
        clearTimeout(t);
        this.wake = null;
        resolve();
      };
    });
  }

  /** Read exactly n bytes or throw after `timeout` ms. */
  async read(n: number, timeout = 1000, what = `${n} bytes`): Promise<Uint8Array> {
    const deadline = performance.now() + timeout;
    while (this.buf.length < n) {
      const left = deadline - performance.now();
      if (left <= 0) throw new TimeoutError(what);
      await this.waitForData(left);
    }
    return Uint8Array.from(this.buf.splice(0, n));
  }

  /** Read up to and including `terminator`. */
  async readUntil(terminator: number, timeout = 1000, what = "response"): Promise<Uint8Array> {
    const deadline = performance.now() + timeout;
    for (;;) {
      const idx = this.buf.indexOf(terminator);
      if (idx >= 0) return Uint8Array.from(this.buf.splice(0, idx + 1));
      const left = deadline - performance.now();
      if (left <= 0) throw new TimeoutError(what);
      await this.waitForData(left);
    }
  }

  async setSignals(s: SerialOutputSignals) {
    await this.port.setSignals(s);
  }
}

// Port the app already has permission for (e.g. the board Chords just
// connected to). Used once by the next pick instead of showing the picker.
let preferredPort: SerialPort | null = null;

export function setPreferredSerialPort(port: SerialPort | null) {
  preferredPort = port;
}

/** Ask for a serial port (must run inside a click handler). */
export async function pickSerialPort(filters?: SerialPortFilter[]) {
  if (!("serial" in navigator)) {
    throw new Error("Web Serial is not available. Use Chrome, Edge or Opera on desktop.");
  }
  if (preferredPort) {
    const port = preferredPort;
    preferredPort = null;
    return port;
  }
  return navigator.serial.requestPort(filters ? { filters } : {});
}

/** Reuse the one already-granted port matching `filters`; otherwise ask. */
export async function findOrPickSerialPort(filters?: SerialPortFilter[]) {
  if (preferredPort) return pickSerialPort(filters);
  if (filters?.length && "serial" in navigator) {
    const ports = (await navigator.serial.getPorts()).filter((p) => {
      const i = p.getInfo();
      return filters.some(
        (f) =>
          (f.usbVendorId === undefined || f.usbVendorId === i.usbVendorId) &&
          (f.usbProductId === undefined || f.usbProductId === i.usbProductId),
      );
    });
    if (ports.length === 1) return ports[0];
  }
  return pickSerialPort(filters);
}

/**
 * Open a serial port. Windows keeps a COM port busy for a moment after it was
 * closed (e.g. by Chords just before flashing, or between two baud rates), so
 * the first open can fail: retry briefly.
 */
async function openPort(port: SerialPort, options: SerialOptions) {
  for (let attempt = 0; ; attempt++) {
    try {
      await port.open(options);
      return;
    } catch (e) {
      if (attempt >= 10 || !(e instanceof DOMException && e.name === "NetworkError")) throw e;
      await sleep(300);
    }
  }
}

/**
 * Arduino "1200 bps touch": opening the sketch's CDC port at 1200 baud and
 * closing it makes the board jump into its bootloader.
 */
export async function touch1200(port: SerialPort) {
  await openPort(port, { baudRate: 1200 });
  try {
    await port.setSignals({ dataTerminalReady: false });
  } catch {}
  await sleep(100);
  await port.close();
}
