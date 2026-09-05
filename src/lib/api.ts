import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Match = Database["public"]["Tables"]["matches"]["Row"];
export type WalletTxn = Database["public"]["Tables"]["wallet_transactions"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type LeaderboardRow = Database["public"]["Views"]["leaderboard_view"]["Row"];
export type Tournament = Database["public"]["Tables"]["tournaments"]["Row"];
export type TournamentParticipant = Database["public"]["Tables"]["tournament_participants"]["Row"];
export type TournamentMatch = Database["public"]["Tables"]["tournament_matches"]["Row"];

// Balances are stored in cents (100 stored units = $1.00).
export const formatMoney = (cents: number | null | undefined) =>
  (Math.round(cents ?? 0) / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });

// Back-compat aliases used across routes — all render real money now.
export const formatCoins = formatMoney;
export const formatUsd = formatMoney;

// Convert a dollar amount typed by the user into stored cents.
export const toCents = (dollars: number) => Math.round(dollars * 100);






// ---------- Profiles ----------
export function useMyProfile() {
  return useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useProfilesByIds(ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  return useQuery({
    queryKey: ["profiles", unique.sort().join(",")],
    enabled: unique.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", unique);
      if (error) throw error;
      const map = new Map<string, Pick<Profile, "id" | "username" | "display_name" | "avatar_url">>();
      data?.forEach((p) => map.set(p.id, p));
      return map;
    },
  });
}

// ---------- Wallet ----------
export function useWallet() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`wallet-realtime-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets" }, () => {
        qc.invalidateQueries({ queryKey: ["wallet"] });
        qc.invalidateQueries({ queryKey: ["transactions"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return useQuery({
    queryKey: ["wallet"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useTransactions(limit = 20) {
  return useQuery({
    queryKey: ["transactions", limit],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// dev_top_up removed — coins are earned via gameplay or purchased in the shop.


// ---------- Matches ----------
export function useOpenMatches() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`matches-realtime-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
        qc.invalidateQueries({ queryKey: ["open-matches"] });
        qc.invalidateQueries({ queryKey: ["my-matches"] });
        qc.invalidateQueries({ queryKey: ["match-history"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return useQuery({
    queryKey: ["open-matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMyMatches() {
  return useQuery({
    queryKey: ["my-matches"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .or(`creator_id.eq.${user.id},opponent_id.eq.${user.id}`)
        .in("status", ["open", "live"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMatchHistory(limit = 50) {
  return useQuery({
    queryKey: ["match-history", limit],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .or(`creator_id.eq.${user.id},opponent_id.eq.${user.id}`)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}

type CreateMatchArgs = {
  mode: "501" | "Cricket" | "Medley" | "Piddle";
  best_of: 1 | 3 | 5;
  stake_cents: number;
  double_in?: boolean;
  finish_rule?: "straight" | "double" | "master" | "both";
  opponent_id?: string | null;
};

export function useCreateMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: CreateMatchArgs) => {
      const { data, error } = await supabase.rpc("create_match", {
        _mode: args.mode,
        _best_of: args.best_of,
        _stake_cents: args.stake_cents,
        _double_in: args.double_in ?? false,
        _finish_rule: args.finish_rule ?? "double",
        _opponent_id: args.opponent_id ?? undefined,
      });
      if (error) throw error;
      return data as string; // match id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["open-matches"] });
      qc.invalidateQueries({ queryKey: ["my-matches"] });
    },
  });
}

export function useJoinMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (matchId: string) => {
      const { error } = await supabase.rpc("join_match", { _match_id: matchId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["open-matches"] });
      qc.invalidateQueries({ queryKey: ["my-matches"] });
    },
  });
}

export function useCancelMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (matchId: string) => {
      const { error } = await supabase.rpc("cancel_match", { _match_id: matchId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["open-matches"] });
      qc.invalidateQueries({ queryKey: ["my-matches"] });
    },
  });
}

export function useSettleMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { matchId: string; winnerId: string }) => {
      const { error } = await supabase.rpc("settle_match", {
        _match_id: args.matchId,
        _winner_id: args.winnerId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["my-matches"] });
      qc.invalidateQueries({ queryKey: ["match-history"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

// ---------- Leaderboard ----------
export function useLeaderboard(limit = 50) {
  return useQuery({
    queryKey: ["leaderboard", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leaderboard_view")
        .select("*")
        .order("total_winnings_cents", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as LeaderboardRow[];
    },
  });
}

// ---------- Tournaments ----------
export function useTournaments() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`tournaments-realtime-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, () => {
        qc.invalidateQueries({ queryKey: ["tournaments"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_participants" }, () => {
        qc.invalidateQueries({ queryKey: ["tournaments"] });
        qc.invalidateQueries({ queryKey: ["tournament-detail"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_matches" }, () => {
        qc.invalidateQueries({ queryKey: ["tournament-detail"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return useQuery({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("*")
        .in("status", ["open", "live"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTournamentDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["tournament-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const [t, parts, matches] = await Promise.all([
        supabase.from("tournaments").select("*").eq("id", id!).maybeSingle(),
        supabase.from("tournament_participants").select("*").eq("tournament_id", id!).order("seed", { ascending: true, nullsFirst: false }),
        supabase.from("tournament_matches").select("*").eq("tournament_id", id!).order("round").order("slot"),
      ]);
      if (t.error) throw t.error;
      if (parts.error) throw parts.error;
      if (matches.error) throw matches.error;
      return {
        tournament: t.data,
        participants: parts.data ?? [],
        matches: matches.data ?? [],
      };
    },
  });
}

type CreateTournamentArgs = {
  name: string;
  mode: "501" | "Cricket" | "Medley" | "Piddle";
  best_of: 1 | 3 | 5;
  size: 4 | 8 | 16 | 32;
  entry_cents: number;
  double_in?: boolean;
  finish_rule?: "straight" | "double" | "master" | "both";
};

export function useCreateTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: CreateTournamentArgs) => {
      const { data, error } = await supabase.rpc("create_tournament", {
        _name: args.name,
        _mode: args.mode,
        _best_of: args.best_of,
        _size: args.size,
        _entry_cents: args.entry_cents,
        _double_in: args.double_in ?? false,
        _finish_rule: args.finish_rule ?? "double",
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["tournaments"] });
    },
  });
}

export function useJoinTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("join_tournament", { _tournament_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      qc.invalidateQueries({ queryKey: ["tournament-detail"] });
    },
  });
}

export function useCancelTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("cancel_tournament", { _tournament_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      qc.invalidateQueries({ queryKey: ["tournament-detail"] });
    },
  });
}

export function useReportTournamentMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { matchId: string; winnerId: string }) => {
      const { error } = await supabase.rpc("report_tournament_match", {
        _match_id: args.matchId,
        _winner_id: args.winnerId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["tournament-detail"] });
      qc.invalidateQueries({ queryKey: ["tournaments"] });
    },
  });
}


export function useIsOwner() {
  return useQuery({
    queryKey: ["is-owner"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "owner")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

// ---------- Profile editing ----------
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { username?: string; display_name?: string; avatar_url?: string | null }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
      if (error) {
        if (error.code === "23505") throw new Error("That username is already taken");
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function usePlayerSearch(term: string) {
  const q = term.trim();
  return useQuery({
    queryKey: ["player-search", q],
    enabled: q.length >= 2,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(8);
      if (error) throw error;
      return (data ?? []).filter((p) => p.id !== user?.id);
    },
  });
}

// ---------- Challenges ----------
export type Challenge = Database["public"]["Tables"]["challenges"]["Row"];

export function useMyChallenges() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`challenges-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "challenges" }, () => {
        qc.invalidateQueries({ queryKey: ["challenges"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return useQuery({
    queryKey: ["challenges"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("challenges")
        .select("*, matches(stake_cents, mode, best_of)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRespondChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { challengeId: string; accept: boolean }) => {
      const { error } = await supabase.rpc("respond_challenge", {
        _challenge_id: args.challengeId,
        _accept: args.accept,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      ["challenges", "wallet", "my-matches", "open-matches"].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      );
    },
  });
}

// ---------- Live play ----------
export function useMatch(id: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`match-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["match", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "match_legs", filter: `match_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["match", id] });
        qc.invalidateQueries({ queryKey: ["legs", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc, id]);

  return useQuery({
    queryKey: ["match", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("matches").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useMatchLegs(matchId: string | undefined) {
  return useQuery({
    queryKey: ["legs", matchId],
    enabled: !!matchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_legs")
        .select("*")
        .eq("match_id", matchId!)
        .order("leg_number");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useStartLeg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { matchId: string; legMode: "501" | "Cricket" | "Medley" | "Piddle" }) => {
      const { data, error } = await supabase.rpc("start_leg", {
        _match_id: args.matchId,
        _leg_mode: args.legMode,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["legs", v.matchId] }),
  });
}

export function useRecordDart() {
  return useMutation({
    mutationFn: async (args: {
      legId: string; turnNumber: number; dartNumber: number;
      segment: number; multiplier: number; busted?: boolean;
      remainingAfter?: number | null; state?: unknown;
    }) => {
      const { error } = await supabase.rpc("record_dart", {
        _leg_id: args.legId,
        _turn_number: args.turnNumber,
        _dart_number: args.dartNumber,
        _segment: args.segment,
        _multiplier: args.multiplier,
        _busted: args.busted ?? false,
        _remaining_after: args.remainingAfter ?? undefined,
        _state: (args.state ?? null) as never,
      });
      if (error) throw error;
    },
  });
}

export function useCompleteLeg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { legId: string; winnerId: string }) => {
      const { error } = await supabase.rpc("complete_leg", {
        _leg_id: args.legId,
        _winner_id: args.winnerId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      ["match", "legs", "wallet", "my-matches", "match-history", "leaderboard", "my-profile"].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      );
    },
  });
}

export function useDartThrows(legId: string | undefined) {
  return useQuery({
    queryKey: ["darts", legId],
    enabled: !!legId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dart_throws")
        .select("*")
        .eq("leg_id", legId!)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ---------- Result reporting (45 minute window) ----------
export const REPORT_WINDOW_MINUTES = 45;

export function timeLeftLabel(deadline: string | null | undefined) {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "Time expired";
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${String(secs).padStart(2, "0")} left`;
}

export function useReportMatchWinner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { matchId: string; winnerId: string }) => {
      const { data, error } = await supabase.rpc("report_match_winner", {
        _match_id: args.matchId,
        _winner_id: args.winnerId,
      });
      if (error) throw error;
      return data as "reported" | "settled" | "disputed";
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["my-matches"] });
      qc.invalidateQueries({ queryKey: ["match"] });
      qc.invalidateQueries({ queryKey: ["match-history"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function useFinalizeMatchReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (matchId: string) => {
      const { error } = await supabase.rpc("finalize_match_report", { _match_id: matchId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["my-matches"] });
      qc.invalidateQueries({ queryKey: ["match"] });
      qc.invalidateQueries({ queryKey: ["match-history"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function useReportTournamentWinner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { matchId: string; winnerId: string }) => {
      const { data, error } = await supabase.rpc("report_tournament_winner", {
        _match_id: args.matchId,
        _winner_id: args.winnerId,
      });
      if (error) throw error;
      return data as "reported" | "settled" | "disputed";
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["tournament-detail"] });
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function useFinalizeTournamentReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (matchId: string) => {
      const { error } = await supabase.rpc("finalize_tournament_match_report", { _match_id: matchId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["tournament-detail"] });
      qc.invalidateQueries({ queryKey: ["tournaments"] });
    },
  });
}

// ---------- Admin ----------
export function useIsStaff() {
  return useQuery({
    queryKey: ["is-staff"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { staff: false, owner: false };
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      const roles = (data ?? []).map((r) => r.role as string);
      return { staff: roles.includes("owner") || roles.includes("admin"), owner: roles.includes("owner") };
    },
  });
}

export function useMyBan() {
  return useQuery({
    queryKey: ["my-ban"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("player_bans")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useDisputedMatches() {
  return useQuery({
    queryKey: ["admin-disputes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("disputed", true)
        .eq("status", "live")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAllBans() {
  return useQuery({
    queryKey: ["admin-bans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_bans")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAllRedemptions() {
  return useQuery({
    queryKey: ["admin-redemptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gift_card_redemptions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAdminActions() {
  return useQuery({
    queryKey: ["admin-actions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_actions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useAdminMutation<T>(fn: (args: T) => Promise<void>, keys: string[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      qc.invalidateQueries({ queryKey: ["admin-actions"] });
    },
  });
}

export function useAdminResolveDispute() {
  return useAdminMutation(async (args: { matchId: string; winnerId: string; note?: string }) => {
    const { error } = await supabase.rpc("admin_resolve_dispute", {
      _match_id: args.matchId, _winner_id: args.winnerId, _note: args.note,
    });
    if (error) throw error;
  }, ["admin-disputes", "matches", "wallet", "leaderboard"]);
}

export function useAdminBanPlayer() {
  return useAdminMutation(async (args: { userId: string; reason: string }) => {
    const { error } = await supabase.rpc("admin_ban_player", { _user_id: args.userId, _reason: args.reason });
    if (error) throw error;
  }, ["admin-bans"]);
}

export function useAdminUnbanPlayer() {
  return useAdminMutation(async (userId: string) => {
    const { error } = await supabase.rpc("admin_unban_player", { _user_id: userId });
    if (error) throw error;
  }, ["admin-bans"]);
}

export function useAdminAdjustCoins() {
  return useAdminMutation(async (args: { userId: string; amount: number; note: string }) => {
    const { error } = await supabase.rpc("admin_adjust_coins", {
      _user_id: args.userId, _amount_cents: Math.round(args.amount), _note: args.note,
    });
    if (error) throw error;
  }, ["wallet", "transactions"]);
}

export function useAdminRefundRedemption() {
  return useAdminMutation(async (args: { redemptionId: string; reason: string }) => {
    const { error } = await supabase.rpc("admin_refund_redemption", {
      _redemption_id: args.redemptionId, _reason: args.reason,
    });
    if (error) throw error;
  }, ["admin-redemptions"]);
}

export function useAdminSetRole() {
  return useAdminMutation(async (args: { userId: string; grant: boolean }) => {
    const { error } = await supabase.rpc("admin_set_role", {
      _user_id: args.userId, _role: "admin", _grant: args.grant,
    });
    if (error) throw error;
  }, ["admin-staff"]);
}

export function useStaffList() {
  return useQuery({
    queryKey: ["admin-staff"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data ?? [];
    },
  });
}
