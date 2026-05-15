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

export const formatUsd = (cents: number | null | undefined) =>
  `$${((cents ?? 0) / 100).toFixed(2)}`;

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
      .channel("wallet-realtime")
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

export function useDevTopUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dollars: number) => {
      const { data, error } = await supabase.rpc("dev_top_up", {
        _amount_cents: toCents(dollars),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

// ---------- Matches ----------
export function useOpenMatches() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("matches-realtime")
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
  mode: "501" | "Cricket" | "Medley";
  best_of: 1 | 3 | 5;
  stake_cents: number;
  double_in?: boolean;
  finish_rule?: "straight" | "double" | "master" | "both";
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
      .channel("tournaments-realtime")
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
  mode: "501" | "Cricket" | "Medley";
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
