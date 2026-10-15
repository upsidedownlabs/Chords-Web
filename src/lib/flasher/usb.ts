import { NeedsUserGesture, type FlashCallbacks } from "./types";
import { sleep } from "./serial";

/* -------------------------------------------------------------------------- */
/* WebUSB bootloader selection, shared by DFU and PICOBOOT                     */
/* -------------------------------------------------------------------------- */

async function authorizedDevices(filters: USBDeviceFilter[]) {
  if (!("usb" in navigator)) return [];
  const devs = await navigator.usb.getDevices();
  return devs.filter((d) =>
    filters.some(
      (f) =>
        (f.vendorId === undefined || f.vendorId === d.vendorId) &&
        (f.productId === undefined || f.productId === d.productId),
    ),
  );
}

/**
 * Open an already-authorized device matching `filters`, retrying for `ms`.
 *
 * Chrome can keep listing a device after it has disconnected (e.g. the previous
 * bootloader session), and opening that stale entry fails with "Access denied".
 * A freshly enumerated device can also fail until udev has applied its
 * permissions. So every match is tried, newest first, until one opens.
 */
async function openAuthorized(filters: USBDeviceFilter[], ms: number) {
  const until = performance.now() + ms;
  let error: unknown;
  for (;;) {
    for (const d of (await authorizedDevices(filters)).reverse()) {
      try {
        if (!d.opened) await d.open();
        return { dev: d };
      } catch (e) {
        error = e;
      }
    }
    if (performance.now() >= until) return { error };
    await sleep(250);
  }
}

/** The bootloader device, opened, if it is connected and this site was already granted access. */
export async function findBootloaderUsb(filters: USBDeviceFilter[]) {
  return (await openAuthorized(filters, 0)).dev;
}

/** Shown when the board is in its bootloader and the user must pick it. */
function pickBootloaderMessage(label: string) {
  return (
    `The board is now in bootloader (DFU) mode. Click Continue and select "${label}" in the browser's list. ` +
    "The browser remembers it, so next time a single click is enough."
  );
}

async function requestUsb(filters: USBDeviceFilter[], label: string, cb?: FlashCallbacks): Promise<USBDevice> {
  cb?.pickerOpen?.(true);
  try {
    return await navigator.usb.requestDevice({ filters });
  } catch (e) {
    if (e instanceof DOMException && e.name === "SecurityError") {
      throw new NeedsUserGesture(pickBootloaderMessage(label));
    }
    if (e instanceof DOMException && e.name === "NotFoundError") {
      throw new Error(
        `No ${label} selected. Is the board in bootloader mode?` +
          (/Win/i.test(navigator.userAgent)
            ? " On Windows the browser only lists a bootloader that has the WinUSB driver:" +
              " install it once (steps in the popup), then try again."
            : ""),
      );
    }
    throw e;
  } finally {
    cb?.pickerOpen?.(false);
  }
}

export function accessDenied(filters: USBDeviceFilter[], label: string, cause: unknown) {
  const f = filters[0] ?? {};
  const id = `${(f.vendorId ?? 0).toString(16).padStart(4, "0")}:${(f.productId ?? 0).toString(16).padStart(4, "0")}`;
  const hint = /Win/i.test(navigator.userAgent)
    ? `Windows is using a driver the browser can't open for the ${label} (${id}). Install the WinUSB driver once (steps in the popup), then try again.`
    : /Linux/i.test(navigator.userAgent)
      ? "Unplug and replug the board and try again. " +
        `If it still fails, add a udev rule: SUBSYSTEM=="usb", ATTRS{idVendor}=="${id.slice(0, 4)}", MODE="0666", then run "sudo udevadm control --reload && sudo udevadm trigger" and replug.`
      : "Close any other app that is using the board, then replug it.";
  return new Error(`USB access denied. ${hint}`, { cause });
}

/**
 * Open the bootloader: reuse a device this site was already granted, or ask
 * the user to pick one (needs a click, so it may throw NeedsUserGesture).
 */
export async function openBootloaderUsb(
  filters: USBDeviceFilter[],
  afterReset: boolean,
  label: string,
  cb?: FlashCallbacks,
) {
  if (!("usb" in navigator)) {
    throw new Error("WebUSB is not available. Use Chrome, Edge or Opera on desktop.");
  }
  // After a reset, give the bootloader time to enumerate and udev time to set permissions.
  const first = await openAuthorized(filters, afterReset ? 5000 : 0);
  let dev = first.dev;
  if (dev) return dev;

  // Windows: the paired bootloader is plugged in but can't be opened, i.e. it
  // lacks the WinUSB driver. The list would only offer that same unusable
  // board, so go straight to the driver steps instead of showing it.
  if (first.error && /Win/i.test(navigator.userAgent)) throw accessDenied(filters, label, first.error);

  // We just reset the board ourselves and it isn't granted yet: always stop
  // and let the user press Continue. Opening the list straight away would
  // depend on timing (the click may still count, and the bootloader may not
  // be listed yet), which made some boards fail where others asked.
  if (afterReset) throw new NeedsUserGesture(pickBootloaderMessage(label));

  // Nothing authorized opened (none granted yet, e.g. a different board, or
  // only stale entries). Ask the user; each board is granted separately.
  const picked = await requestUsb(filters, label, cb);
  ({ dev } = await openAuthorized(filters, 3000));
  if (dev) return dev;
  try {
    await picked.open();
    return picked;
  } catch (e) {
    // Chrome can keep listing a bootloader that has already disconnected,
    // under the same name as the live one. If that stale entry was picked,
    // let the next click try again instead of failing.
    const listed = await authorizedDevices(filters);
    if (listed.some((d) => d !== picked)) {
      throw new NeedsUserGesture(
        "That was an old entry the browser still lists. Click Continue; if the list opens, " +
          `pick the other "${label}" with the same name.`,
      );
    }
    throw accessDenied(filters, label, e);
  }
}

/**
 * Close the device *before* it leaves the bus: if it disconnects while still
 * open (e.g. during reset()), Chrome keeps listing it as a dead, duplicate
 * entry in the device picker. Only if the bootloader doesn't restart on its
 * own (e.g. after DFU DETACH) do we reopen it and issue a USB reset.
 */
export async function restartIfStillThere(dev: USBDevice) {
  const gone = new Promise<boolean>((resolve) => {
    const onDisconnect = (e: USBConnectionEvent) => {
      if (e.device !== dev) return;
      navigator.usb.removeEventListener("disconnect", onDisconnect);
      resolve(true);
    };
    navigator.usb.addEventListener("disconnect", onDisconnect);
    setTimeout(() => {
      navigator.usb.removeEventListener("disconnect", onDisconnect);
      resolve(false);
    }, 1500);
  });
  if (await gone) return;
  try {
    await dev.open();
    await dev.reset();
  } catch {
    /* it resets under us; expected */
  }
  try {
    await dev.close();
  } catch {}
}
