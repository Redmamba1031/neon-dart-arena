// AppLovin Axon pixel with regional consent gating.
// - Visitors outside consent regions: pixel loads automatically.
// - Visitors in consent regions (EEA, UK, CH): pixel loads only after an
//   explicit "Accept" in the consent banner. Denial persists and the pixel
//   never loads. Choices are stored in localStorage and can be changed later
//   from the "Cookies" link in the footer.

const AXON_EVENT_KEY = "0726d6fe-392b-4509-978a-22c38bff0eb4";
const CONSENT_KEY = "smyd_ad_consent"; // "granted" | "denied"

// EEA + UK + Switzerland
const CONSENT_REGIONS = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IS", "IE", "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL",
  "PT", "RO", "SK", "SI", "ES", "SE", "GB", "CH",
]);

type AxonFn = ((...args: unknown[]) => void) & {
  performOperation?: (...args: unknown[]) => void;
  operationQueue?: unknown[];
  ts?: number;
  eventKey?: string;
};

declare global {
  interface Window {
    axon?: AxonFn;
  }
}

let loaded = false;
let regionPromise: Promise<string | null> | null = null;

/** Country code from Cloudflare's same-origin trace endpoint (cached per page visit). */
function detectRegion(): Promise<string | null> {
  if (!regionPromise) {
    regionPromise = (async () => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 2000);
        const res = await fetch("/cdn-cgi/trace", { signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) return null;
        const text = await res.text();
        const loc = /^loc=(.+)$/m.exec(text)?.[1]?.trim() ?? null;
        // Unknown (XX) and Tor (T1) are treated as consent regions.
        if (!loc || loc === "XX" || loc === "T1") return null;
        return loc;
      } catch {
        return null;
      }
    })();
  }
  return regionPromise;
}

export function getSavedConsent(): "granted" | "denied" | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

/** True when the visitor is in a consent region and has not chosen yet. */
export async function needsConsentBanner(): Promise<boolean> {
  const region = await detectRegion();
  // On lookup failure we can't rule out a consent region — show the banner.
  const inConsentRegion = region === null || CONSENT_REGIONS.has(region);
  return inConsentRegion && getSavedConsent() === null;
}

function loadPixel() {
  if (loaded || typeof window === "undefined" || window.axon) return;
  loaded = true;
  const w = window;
  const axon: AxonFn = function (...args: unknown[]) {
    if (axon.performOperation) axon.performOperation(...args);
    else axon.operationQueue!.push(args);
  };
  axon.operationQueue = [];
  axon.ts = Date.now();
  axon.eventKey = AXON_EVENT_KEY;
  w.axon = axon;
  const first = document.getElementsByTagName("script")[0];
  for (const src of [
    "https://s.axon.ai/pixel.js",
    "https://res4.applovin.com/p/l/loader.iife.js",
  ]) {
    const s = document.createElement("script");
    s.async = true;
    s.src = src;
    first.parentNode?.insertBefore(s, first);
  }
  axon("init");
}

/** Load the pixel if tracking is allowed for this visitor right now. */
export async function initApplovin(): Promise<void> {
  const region = await detectRegion();
  const inConsentRegion = region === null || CONSENT_REGIONS.has(region);
  if (inConsentRegion && getSavedConsent() !== "granted") return;
  loadPixel();
}

/** Persist the visitor's choice. Granting loads the pixel immediately. */
export function setAdConsent(choice: "granted" | "denied") {
  try {
    localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    // storage unavailable — choice applies for this page view only
  }
  if (choice === "granted") loadPixel();
}

/** Clear the saved choice so the banner shows again (consent regions only). */
export function resetAdConsent() {
  try {
    localStorage.removeItem(CONSENT_KEY);
  } catch {
    // ignore
  }
}

/** Fire an Axon event. No-op unless the pixel is loaded (i.e. tracking allowed). */
export function trackApplovinEvent(
  event: "page_view" | "generate_lead" | "purchase" | "begin_checkout",
  data?: Record<string, unknown>,
) {
  try {
    window.axon?.("track", event, data ?? {});
  } catch {
    // tracking must never break the app
  }
}
