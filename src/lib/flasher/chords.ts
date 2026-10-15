import { BoardsList } from "@/components/boards";
import { DEVICES } from "./devices";
import type { DeviceDef } from "./types";

/**
 * Cloudflare Worker that downloads Chords-Arduino-Firmware GitHub releases
 * using a GitHub token stored as a Worker secret, and serves them to the
 * browser (source: cloudflare/firmware-worker.js).
 */
export const FIRMWARE_WORKER_URL = "https://chords-arduino-firmware.myupsidedownlab.workers.dev/";

/** A board that can be flashed: a flasher device + the release file for it. */
export interface FlashTarget {
    /** Shown to the user, e.g. "Arduino UNO R3". */
    label: string;
    device: DeviceDef;
    /** Release asset name, e.g. "Chords-UNO-R3.bin". */
    asset: string;
}

type TargetSpec = { label?: string; deviceId: string; asset: string; pid?: number; espChip?: string };

/**
 * chords_id (from boards.ts) -> flasher device(s) and release file.
 * `pid` narrows boards whose chords_id covers several USB IDs (UNO-R4).
 * Several entries without `pid` mean the variant can't be told apart by USB
 * (STM32F4 Black Pill), so the user picks.
 */
const TARGETS: Record<string, TargetSpec[]> = {
    "UNO-R3": [{ deviceId: "avr-uno-r3", asset: "Chords-UNO-R3.bin" }],
    "GENUINO-UNO": [{ deviceId: "avr-genuino-uno", asset: "Chords-UNO-R3.bin" }],
    "UNO-CLONE": [{ deviceId: "avr-uno-clone-maker-uno", asset: "Chords-UNO-R3.bin" }],
    "NANO-CLASSIC": [{ deviceId: "avr-nano-classic", asset: "Chords-NANO-CLASSIC.bin" }],
    "NANO-CLONE": [{ deviceId: "avr-nano-clone-maker-nano", asset: "Chords-NANO-CLASSIC.bin" }],
    "MEGA-2560-R3": [{ deviceId: "avr-mega-2560-r3", asset: "Chords-MEGA-2560-R3.bin" }],
    "MEGA-2560-CLONE": [{ deviceId: "avr-mega-2560-clone", asset: "Chords-MEGA-2560-R3.bin" }],
    "UNO-R4": [
        { pid: 105, deviceId: "uno-r4-minima", asset: "Chords-UNO-R4-MINIMA.bin" },
        { pid: 4098, deviceId: "uno-r4-wifi", asset: "Chords-UNO-R4-WIFI.bin" },
    ],
    "RPI-PICO-RP2040": [{ deviceId: "rpi-pico-rp2040", asset: "Chords-RPI-PICO-RP2040.uf2" }],
    "GIGA-R1": [{ deviceId: "giga-r1", asset: "Chords-GIGA-R1.bin" }],
    "STM32G4-CORE-BOARD": [{ deviceId: "stm32g4-core-board", asset: "Chords-STM32G4-CORE-BOARD.bin" }],
    "STM32F4-BLACK-PILL": [
        { label: "STM32F401CC Black Pill", deviceId: "stm32f401cc-black-pill", asset: "Chords-STM32F401CC-BLACK-PILL.bin" },
        { label: "STM32F411CE Black Pill", deviceId: "stm32f411ce-black-pill", asset: "Chords-STM32F411CE-BLACK-PILL.bin" },
    ],
    "NPG-LITE": [{ deviceId: "npg-lite-esp32c6", asset: "Chords-NPG-LITE-Serial-ESP32C6.merged.bin", espChip: "ESP32-C6" }],
    "ESP32-S3": [{ deviceId: "esp32-s3", asset: "Chords-ESP32-S3.merged.bin", espChip: "ESP32-S3" }],
};

/**
 * Windows only lets the browser see a USB bootloader (UNO R4 Minima, STM32,
 * GIGA R1, Pico) that uses the WinUSB driver, and a website can't install
 * drivers. Two ways to set WinUSB up once per PC:
 *  - the Chords installer (public/drivers): double-click, no board needed;
 *    covers every board here, Zadig stays as the manual alternative;
 *  - Zadig (official libwdi release): any board, picked by hand.
 */
export const USB_DRIVER_TOOL_URL = "https://github.com/pbatard/libwdi/releases/download/v1.5.1/zadig-2.9.exe";

// The basePath Next was actually built with (what next/link uses): on GitHub
// Pages, actions/configure-pages injects "/Chords-Web" into the config at build
// time, which an env-based guess (NEXT_PUBLIC_GITHUB_ACTOR is unset there) misses.
const basePath = process.env.__NEXT_ROUTER_BASEPATH || "";
export const CHORDS_DRIVER_INSTALLER_URL = `${basePath}/drivers/ChordsDriverSetup.exe`;

/** Bootloaders (vendor:product) the Chords installer sets up; others need Zadig. */
const CHORDS_DRIVER_IDS = ["0483:df11", "2341:0369", "2341:0366", "2341:0466", "2e8a:0003"];

export function chordsDriverCovers(filter: USBDeviceFilter | undefined) {
    if (filter?.vendorId === undefined || filter.productId === undefined) return false;
    const id = `${filter.vendorId.toString(16).padStart(4, "0")}:${filter.productId.toString(16).padStart(4, "0")}`;
    return CHORDS_DRIVER_IDS.includes(id);
}

export function firmwareUrl(asset: string, tag = "latest") {
    return `${FIRMWARE_WORKER_URL}/firmware/${encodeURIComponent(tag)}/${encodeURIComponent(asset)}`;
}

/** Every board that could be behind this USB product ID. */
export function getFlashTargetsForPid(usbProductId: number): FlashTarget[] {
    const targets: FlashTarget[] = [];
    const seen = new Set<string>();

    for (const board of BoardsList.filter((b) => b.field_pid === usbProductId)) {
        for (const spec of TARGETS[board.chords_id] ?? []) {
            if (spec.pid !== undefined && spec.pid !== usbProductId) continue;
            if (seen.has(spec.deviceId)) continue;
            const base = DEVICES.find((d) => d.id === spec.deviceId);
            if (!base) continue;
            seen.add(spec.deviceId);
            targets.push({
                label: spec.label ?? board.device_name,
                asset: spec.asset,
                device: {
                    ...base,
                    espChip: spec.espChip ?? base.espChip,
                    firmware: [{ url: firmwareUrl(spec.asset), address: base.firmware[0]?.address ?? 0 }],
                },
            });
        }
    }
    return targets;
}

export interface LatestFirmware {
    tag: string;
    html_url: string;
    /** null when the Worker couldn't list the files (GitHub API rate limit). */
    assets: { name: string; size: number; url: string }[] | null;
}

export async function fetchLatestFirmware(): Promise<LatestFirmware> {
    const res = await fetch(`${FIRMWARE_WORKER_URL}/latest`);
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || typeof body.tag !== "string") {
        throw new Error(body?.error ?? `Couldn't check the latest firmware (HTTP ${res.status})`);
    }
    // The Worker sends assets: null when GitHub's API is rate-limited.
    return {
        tag: body.tag,
        html_url: typeof body.html_url === "string" ? body.html_url : "",
        assets: Array.isArray(body.assets) ? body.assets : null,
    };
}
