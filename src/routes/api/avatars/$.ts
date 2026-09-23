import { createFileRoute } from "@tanstack/react-router";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export const Route = createFileRoute("/api/avatars/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const splat = params._splat ?? "";
        // Path must be "<user uuid>/<file>" with no traversal
        const segments = splat.split("/").filter(Boolean);
        if (
          segments.length !== 2 ||
          !/^[0-9a-f-]{36}$/i.test(segments[0]) ||
          !/^[a-zA-Z0-9._-]+$/.test(segments[1]) ||
          segments[1].includes("..")
        ) {
          return new Response("Not found", { status: 404 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("avatars").download(segments.join("/"));
        if (error || !data) return new Response("Not found", { status: 404 });

        const ext = segments[1].split(".").pop()?.toLowerCase() ?? "";
        return new Response(data, {
          headers: {
            "content-type": MIME[ext] ?? "application/octet-stream",
            "cache-control": "public, max-age=300",
          },
        });
      },
    },
  },
});
