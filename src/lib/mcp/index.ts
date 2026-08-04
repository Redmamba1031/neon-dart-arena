import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listTournaments from "./tools/list-tournaments";
import getTournament from "./tools/get-tournament";
import joinTournament from "./tools/join-tournament";
import getMyWallet from "./tools/get-my-wallet";
import getMyProfile from "./tools/get-my-profile";
import getLeaderboard from "./tools/get-leaderboard";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "smyd",
  title: "SMYD",
  version: "0.1.0",
  instructions:
    "Tools for SMYD, an online GranBoard darts esports app. Browse tournaments, inspect brackets, join an open tournament, and read the signed-in player's coin wallet, profile, and the leaderboard. All data is scoped to the signed-in player.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listTournaments, getTournament, joinTournament, getMyWallet, getMyProfile, getLeaderboard],
});
