import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useLocation,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

// Public routes accessible without auth. Everything else requires sign-in.
const PUBLIC_ROUTES = new Set<string>(["/login"]);

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-display font-bold text-gradient-neon">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Off the board</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          That target doesn't exist. Get back in the lobby.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-gradient-neon px-4 py-2 text-sm font-semibold uppercase tracking-wider text-background transition-transform hover:scale-105"
          >
            Back to lobby
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Match interrupted
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong. Try again or head home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
          <a href="/" className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium">
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SMYD — Online GranBoard Darts Esports" },
      { name: "description", content: "Wager, compete, and win on real-money GranBoard darts matches in 501 and Cricket." },
      { property: "og:title", content: "SMYD — Online GranBoard Darts Esports" },
      { property: "og:description", content: "Wager, compete, and win on real-money GranBoard darts matches in 501 and Cricket." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "SMYD — Online GranBoard Darts Esports" },
      { name: "twitter:description", content: "Wager, compete, and win on real-money GranBoard darts matches in 501 and Cricket." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/82014772-413d-4d26-a5b3-7435fec5739d/id-preview-e4460279--43439fc8-46f0-471f-9076-130763b5b7f4.lovable.app-1778784395434.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/82014772-413d-4d26-a5b3-7435fec5739d/id-preview-e4460279--43439fc8-46f0-471f-9076-130763b5b7f4.lovable.app-1778784395434.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
