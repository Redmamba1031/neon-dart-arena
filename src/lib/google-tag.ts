import { createServerFn } from "@tanstack/react-start";
import { onTrackingAllowed } from "@/lib/applovin";

export const getGaMeasurementId = createServerFn({ method: "GET" }).handler(async () => {
  return (process.env.GOOGLE_ANALYTICS_MEASUREMENT_ID ?? "").trim();
});

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let started = false;

/** Load gtag.js once, only after tracking consent rules allow it. */
export function initGoogleTag() {
  if (started || typeof window === "undefined") return;
  started = true;
  onTrackingAllowed(async () => {
    const id = await getGaMeasurementId().catch(() => "");
    if (!id) return;
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      // eslint-disable-next-line prefer-rest-params -- gtag needs the Arguments object
      window.dataLayer!.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", id);
  });
}

export function trackGaPageView(path: string) {
  window.gtag?.("event", "page_view", { page_path: path });
}
