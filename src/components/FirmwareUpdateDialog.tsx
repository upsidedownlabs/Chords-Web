"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { toast } from "@/lib/toast";
import { NeedsUserGesture, flashDevice, needsApi, setPreferredSerialPort } from "@/lib/flasher";
import { fetchFirmware } from "@/lib/flasher/firmware";
import {
    CHORDS_DRIVER_INSTALLER_URL,
    USB_DRIVER_TOOL_URL,
    chordsDriverCovers,
    fetchLatestFirmware,
    firmwareUrl,
    getFlashTargetsForPid,
    type FlashTarget,
    type LatestFirmware,
} from "@/lib/flasher/chords";

type Status = "idle" | "flashing" | "waiting" | "done" | "error";
type LogLine = { msg: string; kind: "info" | "ok" | "warn" | "err" };
/** Firmware download from the release to the browser (not to the board). */
type Download = { loaded: number; total: number | null; done: boolean; error?: string };

/** Thrown into a running flash when the user cancels it. */
class FlashCancelled extends Error {
    constructor() {
        super("Flashing cancelled");
        this.name = "FlashCancelled";
    }
}

interface FirmwareUpdateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** USB product ID of the board that needs updating. */
    usbProductId: number | null;
    /**
     * Runs when the user presses Flash: disconnects Chords from the board and
     * returns its (now closed) serial port, reused so the user isn't asked to pick it again.
     */
    beforeFlash: () => Promise<SerialPort | null>;
    /** Called after a successful flash; the dialog has closed and the parent reconnects. */
    onFlashed: () => void;
}

/** Revokes this site's access to every remembered USB device matching `filters`. */
async function forgetBootDevices(filters: USBDeviceFilter[]) {
    if (!("usb" in navigator)) return;
    const devices = await navigator.usb.getDevices();
    await Promise.all(
        devices
            .filter((d) =>
                filters.some(
                    (f) =>
                        (f.vendorId === undefined || f.vendorId === d.vendorId) &&
                        (f.productId === undefined || f.productId === d.productId)
                )
            )
            .map((d) => d.forget().catch(() => { }))
    );
}

export default function FirmwareUpdateDialog({
    open,
    onOpenChange,
    usbProductId,
    beforeFlash,
    onFlashed,
}: FirmwareUpdateDialogProps) {
    // The parent remounts this dialog (via `key`) each time it opens, so state starts fresh.
    const [targets] = useState<FlashTarget[]>(() =>
        usbProductId != null ? getFlashTargetsForPid(usbProductId) : []
    );
    const [selected, setSelected] = useState(0);
    const [latest, setLatest] = useState<LatestFirmware | null>(null);
    const [latestError, setLatestError] = useState<string | null>(null);
    const [status, setStatus] = useState<Status>("idle");
    // Windows couldn't find / open the bootloader: it needs the WinUSB driver.
    const [needsWinUsb, setNeedsWinUsb] = useState(false);
    // What to do next while the board waits in its bootloader for Continue.
    const [waitingMsg, setWaitingMsg] = useState<string | null>(null);
    // Fires when the browser's USB list stays open without a pick.
    const pickerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clearPickerTimer = () => {
        if (pickerTimerRef.current) clearTimeout(pickerTimerRef.current);
        pickerTimerRef.current = null;
    };
    const [progress, setProgress] = useState<{ pct: number; label: string } | null>(null);
    const [logs, setLogs] = useState<LogLine[]>([]);
    const logRef = useRef<HTMLDivElement>(null);
    // Firmware downloaded by the last attempt, reused when Flash is pressed again.
    // Keyed by "<tag>/<asset>"; started as soon as the version is known (see
    // the prefetch effect) so pressing Flash reaches the device picker without
    // waiting on the network.
    const firmwareFileRef = useRef<{ key: string; file: Promise<File> } | null>(null);
    const [download, setDownload] = useState<Download | null>(null);
    const getFirmwareFile = useCallback((tag: string, asset: string) => {
        const key = `${tag}/${asset}`;
        if (firmwareFileRef.current?.key !== key) {
            const isCurrent = () => firmwareFileRef.current?.key === key;
            setDownload({ loaded: 0, total: null, done: false });
            const file = fetchFirmware(firmwareUrl(asset, tag), {
                // A tagged release's files never change, so the browser may
                // keep them; "latest" must always be fetched again.
                cache: tag === "latest" ? "no-store" : "default",
                onProgress: (loaded, total) => {
                    if (isCurrent()) setDownload({ loaded, total, done: false });
                },
            }).then((bytes) => {
                if (isCurrent()) setDownload({ loaded: bytes.length, total: bytes.length, done: true });
                return new File([bytes as BlobPart], asset);
            });
            // Don't keep a failed download: the next attempt retries it.
            file.catch((e) => {
                if (firmwareFileRef.current?.file !== file) return;
                firmwareFileRef.current = null;
                setDownload({ loaded: 0, total: null, done: false, error: e instanceof Error ? e.message : String(e) });
            });
            firmwareFileRef.current = { key, file };
        }
        return firmwareFileRef.current.file;
    }, []);
    // The running flash, so Cancel can stop it.
    const abortRef = useRef<AbortController | null>(null);


    const log = useCallback(
        (msg: string, kind: LogLine["kind"] = "info") => setLogs((l) => [...l.slice(-300), { msg, kind }]),
        []
    );

    useEffect(() => {
        if (!open) return;
        fetchLatestFirmware()
            .then(setLatest)
            .catch((e) => {
                const msg = e instanceof Error ? e.message : String(e);
                setLatestError(msg);
                toast.error("Couldn't check for the latest firmware", { description: msg });
            });
    }, [open]);

    useEffect(() => {
        logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
    }, [logs]);

    const target = targets[selected];
    const isWindows = typeof navigator !== "undefined" && /Win/i.test(navigator.userAgent);
    const usesUsbBootloader = !!target && ["dfu", "dfuse", "picoboot"].includes(target.device.protocol);
    // "0483 DF11" as Zadig shows it, for the steps above.
    const bootloaderFilter = target?.device.usbFilters?.[0];
    const bootloaderUsbId = bootloaderFilter
        ? [bootloaderFilter.vendorId, bootloaderFilter.productId]
            .map((n) => (n ?? 0).toString(16).toUpperCase().padStart(4, "0"))
            .join(" ")
        : "";
    const chordsDriverFits = chordsDriverCovers(bootloaderFilter);

    // Download the firmware as soon as the version and board are known.
    useEffect(() => {
        if (!open || !target || (!latest && !latestError)) return;
        getFirmwareFile(latest?.tag ?? "latest", target.asset).catch(() => { });
    }, [open, target, latest, latestError, getFirmwareFile]);
    const busy = status === "flashing";
    const downloading = !!download && !download.done && !download.error;
    const assetMissing =
        !!target && Array.isArray(latest?.assets) && !latest.assets.some((a) => a.name === target.asset);

    const runFlash = async () => {
        if (!target || busy) return;
        const abort = new AbortController();
        abortRef.current = abort;
        const checkCancelled = () => {
            if (abort.signal.aborted) throw new FlashCancelled();
        };
        setStatus("flashing");
        setWaitingMsg(null);
        setProgress({ pct: 0, label: "connecting" });

        // Pin the download to the version shown in the dialog.
        const tag = latest?.tag ?? "latest";
        const device = {
            ...target.device,
            firmware: [{ ...target.device.firmware[0], url: firmwareUrl(target.asset, tag) }],
        };
        // After a "click Flash again" (status "waiting") the board is already
        // in its bootloader: its sketch serial port is gone, so skip the
        // 1200 baud reset and go straight to the USB device picker. Otherwise
        // the flasher works out by itself whether the board is in bootloader.
        const inBootloader = status === "waiting";
        log(`Flashing ${target.asset} (${tag}) to ${target.label}`, "warn");

        try {
            const port = await beforeFlash();
            checkCancelled();

            // Serial-based flashing (and the 1200 baud reset) can reuse the port
            // Chords was just using instead of asking the user to pick it again.
            if (port && (needsApi(device) === "serial" || device.touch1200) && !inBootloader) {
                setPreferredSerialPort(port);
            }

            // Usually already downloaded by the prefetch: the browser only opens
            // the USB picker shortly after a click, so this mustn't wait on the network.
            const firmwareFile = await getFirmwareFile(tag, target.asset);
            checkCancelled();

            // STM32: forget every boot device remembered from earlier, so the
            // picker only offers what's plugged in now and no old entry is reused.
            const isStm32 = device.protocol === "dfuse" && !device.touch1200;
            if (isStm32) {
                // Its normal (serial) port disappears in boot mode; if it's still
                // there, the picker would have nothing real to offer.
                const stillRunning = (await navigator.serial.getPorts()).some(
                    (p) => p.getInfo().usbVendorId === 0x0483 && p.getInfo().usbProductId === usbProductId
                );
                if (stillRunning) {
                    throw new Error(
                        "The board is still in normal mode. Put it in boot mode (hold BOOT0, tap NRST, release BOOT0), then press Flash."
                    );
                }
                await forgetBootDevices(device.usbFilters ?? []);
            }

            await flashDevice(
                {
                    device,
                    file: firmwareFile,
                    customAddress: device.firmware[0].address,
                    verify: true,
                    skipTouch: inBootloader,
                },
                {
                    // Throwing here stops the flasher at its next step; each
                    // one closes the port / USB device on the way out.
                    log: (m) => {
                        checkCancelled();
                        log(m);
                    },
                    progress: (pct, label) => {
                        checkCancelled();
                        setProgress({ pct: Math.max(0, Math.min(100, pct)), label: label ?? "" });
                    },
                    // Nothing picked within 15 s usually means the board isn't
                    // listed: on Windows, its driver is missing.
                    pickerOpen: (isOpen) => {
                        clearPickerTimer();
                        if (!isOpen) return;
                        setProgress((p) => p && { ...p, label: "waiting for you to select the board" });
                        pickerTimerRef.current = setTimeout(() => {
                            if (abort.signal.aborted) return;
                            setNeedsWinUsb(true);
                            log(
                                isWindows
                                    ? "No board selected yet. If it isn't in the list, or selecting it fails, Windows needs the USB driver: follow the steps below."
                                    : "No board selected yet. If it isn't in the list, make sure it's in bootloader mode, then replug it.",
                                "warn"
                            );
                        }, 15000);
                    },
                }
            );
            checkCancelled();
            setProgress({ pct: 100, label: "Done" });
            // ...and forget this one too once it has left boot mode.
            if (isStm32) await forgetBootDevices(device.usbFilters ?? []);
            setStatus("done");
            log("Firmware updated successfully.", "ok");
            toast.success("Firmware updated", { description: `${target.label} is now on ${tag}. Reconnecting…` });
            // Let the success show briefly, then close and hand over to the reconnect.
            setTimeout(() => {
                onOpenChange(false);
                onFlashed();
            }, 800);
        } catch (e) {
            // Cancel already reset the dialog; ignore whatever the stopped flash threw.
            if (abort.signal.aborted) return;
            setProgress(null);
            if (e instanceof NeedsUserGesture) {
                // The board rebooted into its bootloader; the browser needs a
                // fresh click before it can show the USB device picker.
                setStatus("waiting");
                setWaitingMsg(e.message);
                log(e.message, "warn");
            } else {
                const msg = e instanceof Error ? e.message : String(e);
                const cancelled = /No port selected|No device selected|NotFoundError|aborted a request/i.test(msg);
                setStatus("error");
                if (/Windows is using a driver the browser can't open|only lists a bootloader that has the WinUSB driver/.test(msg)) {
                    setNeedsWinUsb(true);
                }
                log(cancelled ? "Cancelled: no device was selected." : `Error: ${msg}`, "err");
                if (cancelled) toast.message("Flashing cancelled: no device was selected.");
                else toast.error("Firmware update failed", { description: msg });
            }
        } finally {
            clearPickerTimer();
            setPreferredSerialPort(null);
            if (abortRef.current === abort) abortRef.current = null;
        }
    };

    // Stop a running flash. The board may be left in its bootloader, which
    // every supported board recovers from by flashing again.
    const cancelFlash = () => {
        const abort = abortRef.current;
        if (!abort) return;
        abort.abort();
        abortRef.current = null;
        clearPickerTimer();
        // A step waiting on the device (no answer, or mid-transfer) only ends
        // when the device is closed.
        if (target?.device.usbFilters && "usb" in navigator) {
            const filters = target.device.usbFilters;
            navigator.usb.getDevices().then((devs) =>
                devs
                    .filter((d) => d.opened && filters.some((f) => f.vendorId === d.vendorId && (f.productId === undefined || f.productId === d.productId)))
                    .forEach((d) => d.close().catch(() => { }))
            );
        }
        setPreferredSerialPort(null);
        setProgress(null);
        setStatus("idle");
        log("Cancelled. If the board stays in bootloader mode, press Flash again or replug it.", "warn");
    };

    const flashLabel =
        status === "flashing"
            ? "Flashing…"
            : downloading
                ? "Downloading firmware…"
                : status === "waiting"
                    ? "Continue"
                    : status === "error"
                        ? "Try again"
                        : "Flash firmware";
    const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
    const zadigSteps = (
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Keep the board in bootloader mode, download Zadig and open it (click <b>Yes</b>).</li>
            <li>
                Choose <b>Options → List All Devices</b> and pick the device with USB ID <b>{bootloaderUsbId}</b>.
            </li>
            <li>Make sure <b>WinUSB</b> is selected and click <b>Install Driver</b> (or <b>Replace Driver</b>).</li>
            <li>Come back here and press Flash again.</li>
        </ol>
    );

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o && busy) cancelFlash();
                onOpenChange(o);
            }}
        >
            {/* A stray click outside mustn't stop a flash; Cancel, Esc and × still do. */}
            <DialogContent className="max-w-lg" onInteractOutside={(e) => busy && e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>Your firmware is not updated</DialogTitle>
                    <DialogDescription>
                        The device didn&apos;t identify itself, so it was detected by its USB ID.{" "}
                        {latest ? (
                            <>
                                Update it to the latest firmware:{" "}
                                <a href={latest.html_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
                                    {latest.tag}
                                </a>
                            </>
                        ) : latestError ? (
                            <span className="text-destructive">{latestError}</span>
                        ) : (
                            "Checking for the latest firmware…"
                        )}
                    </DialogDescription>
                </DialogHeader>

                {targets.length === 0 ? (
                    <p className="text-sm">
                        This board can&apos;t be updated from here. Please flash the firmware from{" "}
                        <a
                            className="font-semibold text-primary hover:underline"
                            href="https://github.com/Amanmahe/Chords-Arduino-Firmware/releases/latest"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            the latest release
                        </a>
                        .
                    </p>
                ) : (
                    <div className="flex min-w-0 flex-col gap-4">
                        {targets.length > 1 && (status === "idle" || status === "error") && (
                            <div className="flex flex-col gap-2">
                                <p className="text-sm font-medium">Several boards share this USB ID. Which one is yours?</p>
                                <div className="flex flex-col gap-1">
                                    {targets.map((t, i) => (
                                        <label
                                            key={t.device.id}
                                            className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${i === selected ? "border-primary bg-primary/10" : "border-border"} ${busy ? "pointer-events-none opacity-60" : ""}`}
                                        >
                                            <input
                                                type="radio"
                                                name="flash-target"
                                                checked={i === selected}
                                                onChange={() => {
                                                    setSelected(i);
                                                    setStatus("idle");
                                                }}
                                                className="accent-primary"
                                            />
                                            <span className="font-medium">{t.label}</span>
                                            <span className="ml-auto truncate text-xs text-muted-foreground">{t.asset}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {target && (
                            <div className="rounded-md bg-muted p-3 text-sm">
                                <p className="mb-1 font-medium">{target.label}</p>
                                <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                                    {target.device.instructions.map((step) => (
                                        <li key={step}>{step}</li>
                                    ))}
                                </ol>
                            </div>
                        )}

                        {assetMissing && (
                            <p className="text-sm text-destructive">
                                {target.asset} isn&apos;t in release {latest?.tag}.
                            </p>
                        )}

                        {download && (
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>
                                        {download.error
                                            ? "Firmware download failed"
                                            : download.done
                                                ? `Firmware downloaded (${kb(download.loaded)})`
                                                : `Downloading firmware${latest ? ` ${latest.tag}` : ""} to this browser`}
                                    </span>
                                    <span>
                                        {download.done || download.error
                                            ? ""
                                            : download.total
                                                ? `${Math.round((download.loaded / download.total) * 100)}%`
                                                : kb(download.loaded)}
                                    </span>
                                </div>
                                {!download.done && !download.error && (
                                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                        <div
                                            className="h-full bg-primary transition-all"
                                            style={{ width: `${download.total ? (download.loaded / download.total) * 100 : 0}%` }}
                                        />
                                    </div>
                                )}
                                {download.error && <p className="text-xs text-destructive">{download.error}</p>}
                            </div>
                        )}

                        {progress && (
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Flashing to the board: {progress.label}</span>
                                    <span>{Math.round(progress.pct)}%</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-muted">
                                    <div className="h-full bg-primary transition-all" style={{ width: `${progress.pct}%` }} />
                                </div>
                            </div>
                        )}

                        {status === "waiting" && waitingMsg && (
                            <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm">
                                <p className="font-medium">Next step</p>
                                <p className="text-muted-foreground">{waitingMsg}</p>
                            </div>
                        )}

                        {/* Only after Windows couldn't find / open the bootloader: it needs
                            the WinUSB driver once per PC, which the browser can't install. */}
                        {needsWinUsb && usesUsbBootloader && isWindows && (
                            <div className="flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                                <p className="font-medium">Install the USB driver to flash this board (once per PC)</p>
                                {chordsDriverFits ? (
                                    <>
                                        {/* Main: the Chords installer. */}
                                        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                                            <li>Download the installer and double-click it. The board doesn&apos;t need to be plugged in.</li>
                                            <li>
                                                If Windows says <b>&quot;Windows protected your PC&quot;</b>, click <b>More info → Run anyway</b>.
                                            </li>
                                            <li>Click <b>Yes</b> when Windows asks for permission, and wait for <b>Done!</b></li>
                                            <li>Replug the board, then press Flash again.</li>
                                        </ol>
                                        <div>
                                            <Button size="sm" asChild>
                                                <a href={CHORDS_DRIVER_INSTALLER_URL} download="ChordsDriverSetup.exe">
                                                    Download driver installer
                                                </a>
                                            </Button>
                                        </div>
                                        {/* Alternative: Zadig, for when the installer can't be used. */}
                                        <div className="mt-1 flex flex-col gap-2 border-t border-amber-500/30 pt-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-muted-foreground">Or install it with Zadig:</span>
                                                <Button size="sm" variant="outline" asChild>
                                                    <a href={USB_DRIVER_TOOL_URL} target="_blank" rel="noopener noreferrer">
                                                        Download Zadig
                                                    </a>
                                                </Button>
                                            </div>
                                            <details>
                                                <summary className="cursor-pointer text-xs text-muted-foreground">Zadig steps</summary>
                                                <div className="mt-1">{zadigSteps}</div>
                                            </details>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {zadigSteps}
                                        <div>
                                            <Button size="sm" asChild>
                                                <a href={USB_DRIVER_TOOL_URL} target="_blank" rel="noopener noreferrer">
                                                    Download Zadig
                                                </a>
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {logs.length > 0 && (
                            <div
                                ref={logRef}
                                className="max-h-40 overflow-y-auto rounded-md border bg-background p-2 font-mono text-xs [scrollbar-width:thin] [scrollbar-color:hsl(var(--muted-foreground)/0.4)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/40 [&::-webkit-scrollbar-track]:bg-transparent"
                            >
                                {logs.map((l, i) => (
                                    <div
                                        key={i}
                                        className={
                                            l.kind === "err"
                                                ? "text-destructive"
                                                : l.kind === "ok"
                                                    ? "text-green-600 dark:text-green-400"
                                                    : l.kind === "warn"
                                                        ? "text-amber-600 dark:text-amber-400"
                                                        : "text-muted-foreground"
                                        }
                                    >
                                        {l.msg}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter className="gap-2">
                    {status === "done" ? null : (
                        <>
                            <Button variant="outline" onClick={() => (busy ? cancelFlash() : onOpenChange(false))}>
                                {busy ? "Stop" : "Cancel"}
                            </Button>
                            {target && (
                                // The browser only opens the device picker shortly
                                // after a click, so Flash waits for the download.
                                <Button disabled={busy || downloading || (!latest && !latestError) || assetMissing} onClick={runFlash}>
                                    {flashLabel}
                                </Button>
                            )}
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
