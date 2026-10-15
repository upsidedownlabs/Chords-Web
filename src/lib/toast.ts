import { createElement } from "react";
import { toast } from "sonner";
import { TimeAgo } from "@/components/ui/time-ago";

// Import `toast` from here, not from "sonner", so this runs before any toast
// is shown.
//
// No repeats: every toast gets an id from its type + text, and Sonner
// replaces a toast whose id is already showing instead of stacking a copy.
// Error and warning toasts also stay until the user closes them (X button or
// swipe) so they aren't missed. A call can still pass its own `id` /
// `duration` / `closeButton`.
// Because they stay, they also show when they appeared ("just now", "2 min
// ago"); a repeat of the same toast replaces it, so its time restarts.
// (Plain `toast(...)` can't be patched: use `toast.message(...)` instead.)
type ToastFn = typeof toast.error & { __original?: typeof toast.error };

for (const type of ["error", "warning", "success", "info", "message"] as const) {
    const current = toast[type] as ToastFn;
    const original = current.__original ?? current; // unwrap on hot reload
    const persistent = type === "error" || type === "warning";
    const patched: ToastFn = (message, data) => {
        const description = typeof data?.description === "string" ? data.description : "";
        const id = typeof message === "string" ? `${type}:${message}:${description}` : undefined;
        const opts = {
            id,
            ...(persistent ? { duration: Infinity, closeButton: true, dismissible: true } : {}),
            ...data,
        };
        if (persistent) {
            const time = createElement(TimeAgo, { since: Date.now(), className: "mt-1 block text-xs opacity-70" });
            const given = data?.description;
            // A function description must stay a function: Sonner calls it while
            // rendering the toast, so it may use hooks. Wrap it lazily.
            opts.description = !given
                ? time
                : typeof given === "function"
                    ? () => createElement("div", null, given(), time)
                    : createElement("div", null, given, time);
        }
        return original(message, opts);
    };
    patched.__original = original;
    toast[type] = patched;
}

export { toast };
