import { useEffect, useState } from "react";
import {
  initApplovin,
  needsConsentBanner,
  resetAdConsent,
  setAdConsent,
  trackApplovinEvent,
} from "@/lib/applovin";
import { useLocation } from "@tanstack/react-router";
import { initGoogleTag, trackGaPageView } from "@/lib/google-tag";

/** Opens the banner again from the footer "Cookies" link. */
export function openCookieSettings() {
  resetAdConsent();
  window.dispatchEvent(new Event("smyd:open-cookie-settings"));
}

export function AdConsentBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    initGoogleTag();
    void initApplovin();
    void needsConsentBanner().then(setShow);
    const reopen = () => setShow(true);
    window.addEventListener("smyd:open-cookie-settings", reopen);
    return () => window.removeEventListener("smyd:open-cookie-settings", reopen);
  }, []);

  if (!show) return null;

  const choose = (choice: "granted" | "denied") => {
    setAdConsent(choice);
    setShow(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4">
      <div className="w-full max-w-[448px] rounded-2xl bg-surface p-4 ring-1 ring-border shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-widest text-foreground">
          Ad measurement
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          We use AppLovin to measure how our ads perform. Accept to allow ad
          measurement cookies, or reject to keep them off. You can change this
          anytime from the Cookies link in the footer.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => choose("denied")}
            className="flex-1 rounded-lg bg-background py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground ring-1 ring-border transition-colors hover:text-foreground"
          >
            Reject
          </button>
          <button
            onClick={() => choose("granted")}
            className="flex-1 rounded-lg bg-gradient-neon py-2.5 text-xs font-bold uppercase tracking-widest text-background transition-transform active:scale-[0.98]"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

/** Fires a page_view event on every route change (only when tracking is allowed). */
export function ApplovinPageViews() {
  const { pathname } = useLocation();
  useEffect(() => {
    trackApplovinEvent("page_view");
    trackGaPageView(pathname);
  }, [pathname]);
  return null;
}
