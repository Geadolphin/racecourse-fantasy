"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Crown,
  Medal,
  Trophy,
  UserRound,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type PlayerProfile = {
  id: string;
  display_name: string;
};

type SeasonSummary = {
  season_id: string;
  season_name: string;
  total_points: number;
  overall_rank: number | null;
  rounds_played: number;
  round_wins: number;
  highest_round_score: number;
  top_ten_finishes: number;
};

type RoundHistoryRow = {
  round_id: string;
  round_number: number;
  round_name: string | null;
  round_date: string | null;
  round_status: string;
  team_id: string | null;
  team_name: string | null;
  total_points: number;
  captain_points: number;
  round_rank: number | null;
  salary_used: number | null;
};

type PlayerProfileData = {
  success: boolean;
  message?: string;
  profile: PlayerProfile | null;
  season_summary: SeasonSummary | null;
  round_history: RoundHistoryRow[];
};

function formatCurrency(value: number | null) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  }).format(new Date(`${value}T00:00:00`));
}

function rankDisplay(rank: number | null) {
  if (!rank) return "—";
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>();
  const playerId = params.id;

  const [data, setData] = useState<PlayerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!playerId) return;

    let active = true;

    async function loadPlayerProfile() {
      setLoading(true);
      setErrorMessage("");

      const { data: profileData, error } = await supabase.rpc(
        "get_player_profile",
        {
          p_user_id: playerId,
        }
      );

      if (!active) return;

      if (error) {
        console.error("Player profile RPC error:", error);
        setErrorMessage(
          error.message || "The player profile could not be loaded."
        );
        setData(null);
        setLoading(false);
        return;
      }

      const loadedData = profileData as unknown as PlayerProfileData;

      if (!loadedData.success || !loadedData.profile) {
        setErrorMessage(
          loadedData.message || "The player profile could not be found."
        );
        setData(loadedData);
        setLoading(false);
        return;
      }

      setData(loadedData);
      setLoading(false);
    }

    void loadPlayerProfile();

    return () => {
      active = false;
    };
  }, [playerId]);

  const averageRoundScore = useMemo(() => {
    const rounds = data?.round_history ?? [];

    if (rounds.length === 0) return 0;

    return (
      rounds.reduce((total, round) => total + round.total_points, 0) /
      rounds.length
    );
  }, [data]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-6xl rounded-xl border bg-white p-10 text-center text-slate-500">
          Loading player profile...
        </div>
      </main>
    );
  }

  if (errorMessage || !data?.profile) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-4xl rounded-xl border bg-white p-8">
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-2 text-sm font-bold text-teal-700 hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to leaderboard
          </Link>

          <h1 className="mt-6 text-2xl font-black text-slate-950">
            Player Profile
          </h1>

          <p className="mt-4 text-red-700">
            {errorMessage || "The player profile could not be found."}
          </p>
        </div>
      </main>
    );
  }

  const summary = data.season_summary;
  const rounds = data.round_history ?? [];

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-2 text-sm font-bold text-teal-700 hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to leaderboard
        </Link>

        <header className="mt-4 rounded-2xl bg-slate-950 p-6 text-white shadow-sm md:p-8">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-teal-400 text-slate-950">
              <UserRound className="h-8 w-8" />
            </div>

            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-300">
                Player profile
              </p>

              <h1 className="mt-1 text-3xl font-black md:text-4xl">
                {data.profile.display_name}
              </h1>

              {summary && (
                <p className="mt-2 text-slate-300">
                  {summary.season_name}
                </p>
              )}
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Overall Rank
            </p>
            <p className="mt-2 text-3xl font-black text-slate-950">
              {rankDisplay(summary?.overall_rank ?? null)}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Total Points
            </p>
            <p className="mt-2 text-3xl font-black text-teal-700">
              {summary?.total_points ?? 0}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Round Wins
            </p>
            <p className="mt-2 text-3xl font-black text-slate-950">
              {summary?.round_wins ?? 0}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Highest Round
            </p>
            <p className="mt-2 text-3xl font-black text-slate-950">
              {summary?.highest_round_score ?? 0}
            </p>
          </div>
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-teal-700" />
              <p className="font-bold text-slate-950">Rounds Played</p>
            </div>
            <p className="mt-3 text-2xl font-black text-slate-950">
              {summary?.rounds_played ?? rounds.length}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Medal className="h-5 w-5 text-teal-700" />
              <p className="font-bold text-slate-950">Top 10 Finishes</p>
            </div>
            <p className="mt-3 text-2xl font-black text-slate-950">
              {summary?.top_ten_finishes ?? 0}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-teal-700" />
              <p className="font-bold text-slate-950">Average Round</p>
            </div>
            <p className="mt-3 text-2xl font-black text-slate-950">
              {averageRoundScore.toFixed(1)}
            </p>
          </div>
        </section>

        <section className="mt-8">
          <div>
            <h2 className="text-2xl font-black text-slate-950">
              Round History
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Completed rounds from the current season.
            </p>
          </div>

          {rounds.length === 0 ? (
            <div className="mt-4 rounded-xl border bg-white p-10 text-center text-slate-500">
              No completed round history is available yet.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {rounds.map((round) => (
                <article
                  key={round.round_id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-bold text-teal-700">
                        Round {round.round_number}
                      </p>

                      <h3 className="mt-1 text-lg font-black text-slate-950">
                        {round.team_name?.trim() ||
                          round.round_name ||
                          "Unnamed Team"}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        {formatDate(round.round_date)}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Score
                        </p>
                        <p className="mt-1 text-lg font-black text-slate-950">
                          {round.total_points}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Rank
                        </p>
                        <p className="mt-1 text-lg font-black text-slate-950">
                          {rankDisplay(round.round_rank)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Captain Bonus
                        </p>
                        <p className="mt-1 text-lg font-black text-slate-950">
                          {round.captain_points}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Salary
                        </p>
                        <p className="mt-1 text-lg font-black text-slate-950">
                          {formatCurrency(round.salary_used)}
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}