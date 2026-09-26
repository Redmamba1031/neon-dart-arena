import { supabase } from "@/integrations/supabase/client";

function sessionId(): string {
  let sid = localStorage.getItem("smyd_sid");
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem("smyd_sid", sid);
  }
  return sid;
}

/** Fire-and-forget page event tracking (anonymous-friendly). */
export function trackEvent(event: "howto_signup_click" | "dashboard_view", path?: string) {
  try {
    void supabase.rpc("track_page_event" as never, {
      _event: event,
      _path: path ?? window.location.pathname,
      _session: sessionId(),
    } as never);
  } catch {
    // tracking must never break the app
  }
}
