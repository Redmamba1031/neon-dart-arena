import type { Match } from "@/components/MatchCard";

export const liveMatches: Match[] = [
  { id: "m1", mode: "501", modeLabel: "501 • Master Out", stake: 50, bestOf: 3, hostName: "Ghost_99", status: "open", rules: "Master Out" },
  { id: "m2", mode: "Cricket", modeLabel: "Cricket Pro", stake: 200, bestOf: 5, hostName: "ViperX", opponentName: "Bullseye", status: "live" },
  { id: "m3", mode: "501", modeLabel: "501 • Double Out", stake: 25, bestOf: 3, hostName: "TripleKing", status: "open", rules: "Double Out" },
  { id: "m4", mode: "Cricket", modeLabel: "Cricket Casual", stake: 10, bestOf: 1, hostName: "Newbie22", status: "open", rules: "Standard" },
];

export const matchHistory = [
  { id: "h1", mode: "501", opponent: "DartsDestroyer", result: "W", stake: 50, payout: 95, date: "2h ago" },
  { id: "h2", mode: "Cricket", opponent: "Triple20King", result: "L", stake: 25, payout: -25, date: "Yesterday" },
  { id: "h3", mode: "501", opponent: "Ghost_99", result: "W", stake: 100, payout: 190, date: "2d ago" },
  { id: "h4", mode: "501", opponent: "Bullseye", result: "W", stake: 20, payout: 38, date: "3d ago" },
  { id: "h5", mode: "Cricket", opponent: "ViperX", result: "L", stake: 75, payout: -75, date: "5d ago" },
];

export const leaderboard = [
  { rank: 1, name: "GranMaster_99", earnings: 24800, wins: 412, winRate: 78 },
  { rank: 2, name: "TripleKing", earnings: 18200, wins: 320, winRate: 72 },
  { rank: 3, name: "ViperX", earnings: 14600, wins: 289, winRate: 69 },
  { rank: 4, name: "Bullseye_Betty", earnings: 11200, wins: 240, winRate: 66 },
  { rank: 5, name: "Ghost_99", earnings: 9800, wins: 210, winRate: 64 },
  { rank: 6, name: "DartsDestroyer", earnings: 8400, wins: 188, winRate: 61 },
  { rank: 7, name: "Triple20King", earnings: 7200, wins: 170, winRate: 60 },
  { rank: 1402, name: "You (Viper_X)", earnings: 4200, wins: 86, winRate: 68, isYou: true },
];
