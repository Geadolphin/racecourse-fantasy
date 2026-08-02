"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Round = {
  id: string;
  season_id: string;
  round_number: number;
  name: string | null;
  status: string;
  lockout_at: string | null;
};

type Season = {
  id: string;
  name: string;
  salary_cap: number;
  team_size: number;
};

type Team = {
  id: string;
  user_id: string;
  round_id: string;
  status: "draft" | "submitted" | "locked" | "scored";
  salary_used: number;
  salary_cap: number;
  submitted_at: string | null;
  locked_at: string | null;
};

type UpcomingRace = {
  id: string;
  race_number: number;
  race_name: string;
  grade: "G1" | "G2" | "G3" | "L" | "Listed";
  scheduled_start: string;
  status: string;
  racecourse: {
    id: string;
    name: string;
  } | null;
};

type ScoreRecord = Record<string, unknown>;

type MiniLeaderboardEntry = {
  user_id: string;
  display_name: string;
  total_score: number;
  overall_rank: number;
};

type DashboardData = {
  success: boolean;
  message?: string;
  profile: {
    display_name?: string | null;
  } | null;
  round: Round | null;
  season: Season | null;
  team: Team | null;
  selection_count: number;
  round_score: ScoreRecord | null;
  season_score: ScoreRecord | null;
  upcoming_race: UpcomingRace | null;
  mini_leaderboard: Array<{
    user_id: string;
    display_name: string | null;
    total_points: number | null;
    overall_rank: number | null;
  }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Melbourne",
  }).format(new Date(value));
}

function formatTimeUntil(
  value: string,
  currentTime: number,
  label = "jump"
) {
  const difference = new Date(value).getTime() - currentTime;

  if (difference <= 0) {
    return label === "lockout" ? "Locked" : "Starting now";
  }

  const totalMinutes = Math.floor(difference / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h until ${label}`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m until ${label}`;
  }

  return `${minutes}m until ${label}`;
}

function getNumber(
  record: ScoreRecord | null,
  possibleKeys: string[],
  fallback = 0
) {
  if (!record) {
    return fallback;
  }

  for (const key of possibleKeys) {
    const value = record[key];

    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
      const parsedValue = Number(value);

      if (!Number.isNaN(parsedValue)) {
        return parsedValue;
      }
    }
  }

  return fallback;
}

function getTeamStatusLabel(status: Team["status"] | null) {
  switch (status) {
    case "draft":
      return "Draft";
    case "submitted":
      return "Submitted";
    case "locked":
      return "Locked";
    case "scored":
      return "Scored";
    default:
      return "No team";
  }
}

function getTeamStatusClasses(status: Team["status"] | null) {
  switch (status) {
    case "draft":
      return "bg-amber-100 text-amber-800";
    case "submitted":
      return "bg-blue-100 text-blue-800";
    case "locked":
      return "bg-purple-100 text-purple-800";
    case "scored":
      return "bg-teal-50 text-teal-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function Dashboard() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [round, setRound] = useState<Round | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [upcomingRace, setUpcomingRace] =
    useState<UpcomingRace | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const [selectionCount, setSelectionCount] = useState(0);
  const [roundScore, setRoundScore] = useState<ScoreRecord | null>(null);
  const [seasonScore, setSeasonScore] = useState<ScoreRecord | null>(null);
  const [miniLeaderboard, setMiniLeaderboard] = useState<
    MiniLeaderboardEntry[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      if (userError || !user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase.rpc(
        "get_dashboard_data"
      );

      if (!active) {
        return;
      }

      if (error) {
        console.error("Dashboard RPC error:", error);
        setErrorMessage(
          error.message || "The dashboard could not be loaded."
        );
        setLoading(false);
        return;
      }

      const dashboardData = data as DashboardData | null;

      if (!dashboardData?.round || !dashboardData.season) {
        setRound(null);
        setSeason(null);
        setTeam(null);
        setSelectionCount(0);
        setRoundScore(null);
        setSeasonScore(null);
        setUpcomingRace(null);
        setMiniLeaderboard([]);
        setErrorMessage(
          dashboardData?.message ||
            "There are no rounds available yet."
        );
        setLoading(false);
        return;
      }

      setDisplayName(
        dashboardData.profile?.display_name?.trim() ||
          user.email?.split("@")[0] ||
          "Player"
      );

      setRound(dashboardData.round);
      setSeason(dashboardData.season);
      setTeam(dashboardData.team);
      setSelectionCount(dashboardData.selection_count ?? 0);
      setRoundScore(dashboardData.round_score);
      setSeasonScore(dashboardData.season_score);
      setUpcomingRace(dashboardData.upcoming_race);

      setMiniLeaderboard(
        (dashboardData.mini_leaderboard ?? [])
          .map((entry, index) => ({
            user_id: entry.user_id || `leaderboard-${index}`,
            display_name:
              entry.display_name?.trim() || "Player",
            total_score: Number(entry.total_points ?? 0),
            overall_rank:
              Number(entry.overall_rank ?? 0) || index + 1,
          }))
          .sort((a, b) => a.overall_rank - b.overall_rank)
      );

      setLoading(false);
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, [router]);

  const salaryUsed = team?.salary_used ?? 0;
  const salaryCap = team?.salary_cap ?? season?.salary_cap ?? 0;

  const salaryRemaining = useMemo(() => {
    return Math.max(0, salaryCap - salaryUsed);
  }, [salaryUsed, salaryCap]);

  const salaryPercentage = useMemo(() => {
    if (salaryCap <= 0) {
      return 0;
    }

    return Math.min(100, (salaryUsed / salaryCap) * 100);
  }, [salaryUsed, salaryCap]);

  const currentRoundScore = getNumber(roundScore, [
    "total_points",
    "round_score",
    "total_score",
    "fantasy_points",
    "score",
    "points",
  ]);

  const currentRoundRank = getNumber(roundScore, [
    "round_rank",
    "rank",
  ]);

  const currentSeasonScore = getNumber(seasonScore, [
    "total_points",
    "season_score",
    "total_score",
    "fantasy_points",
    "score",
    "points",
  ]);

  const currentOverallRank = getNumber(seasonScore, [
    "overall_rank",
    "season_rank",
    "rank",
  ]);

  const lockoutHasPassed =
    round?.lockout_at !== null &&
    round?.lockout_at !== undefined &&
    new Date(round.lockout_at).getTime() <= Date.now();

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-7xl rounded-xl border bg-white p-10 text-center text-slate-500 shadow-sm">
          Loading dashboard...
        </div>
      </main>
    );
  }

  if (!round || !season) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-4xl rounded-xl border bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900">
            Dashboard
          </h1>

          <p className="mt-4 text-red-700">
            {errorMessage || "Dashboard information is unavailable."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm md:p-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-300">
            {season.name}
          </p>

          <div className="mt-2 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold md:text-4xl">
                Welcome, {displayName}
              </h1>

              <p className="mt-2 text-slate-300">
                Here is your Racecourse Fantasy overview.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/team"
                className="rounded-lg bg-amber-400 px-5 py-3 font-bold text-slate-900 transition hover:bg-amber-300"
              >
                View My Team
              </Link>

              <Link
                href="/leaderboard"
                className="rounded-lg border border-teal-500 px-5 py-3 font-bold text-white transition hover:bg-slate-800"
              >
                View Leaderboard
              </Link>
            </div>
          </div>
        </section>

        {errorMessage && (
          <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
            {errorMessage}
          </div>
        )}

        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* Round Score */}
          <div className="rounded-2xl bg-slate-900 p-5 text-white shadow-sm transition duration-200 hover:shadow-md">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-300">
                  Round Score
                </p>

                <p className="mt-2 text-4xl font-bold">
                  {currentRoundScore}
                </p>

                <p className="mt-1 text-sm text-slate-300">
                  points
                </p>
              </div>

            </div>

            <p className="text-sm text-slate-400">
              Your score for the current round
            </p>
          </div>

          {/* Round Rank */}
          <div className="rounded-2xl bg-teal-600 p-5 text-white shadow-sm transition duration-200 hover:shadow-md">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-teal-100">
                  Round Rank
                </p>

                <p className="mt-2 text-4xl font-bold">
                  {currentRoundRank > 0 ? `#${currentRoundRank}` : "—"}
                </p>

                <p className="mt-1 text-sm text-teal-100">
                  this round
                </p>
              </div>

              
            </div>

            <p className="text-sm text-teal-100">
              Your position for the current round
            </p>
          </div>

          {/* Season Score */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:shadow-md">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Season Score
                </p>

                <p className="mt-2 text-4xl font-bold text-slate-900">
                  {currentSeasonScore}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  points
                </p>
              </div>

            </div>

            <p className="text-sm text-slate-500">
              Total points earned this season
            </p>
          </div>

          {/* Overall Rank */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:shadow-md">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Overall Rank
                </p>

                <p className="mt-2 text-4xl font-bold text-slate-900">
                  {currentOverallRank > 0 ? `#${currentOverallRank}` : "—"}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  overall
                </p>
              </div>

            </div>

            <p className="text-sm text-slate-500">
              Your position on the leaderboard
            </p>
          </div>
        </section>

        {/* Step 4: Lockout Countdown */}
        <section className="mt-6">
          <div
            className={`rounded-2xl border p-6 shadow-sm transition duration-200 hover:shadow-md ${
              lockoutHasPassed
                ? "border-red-200 bg-red-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p
                  className={`text-sm font-semibold uppercase tracking-wide ${
                    lockoutHasPassed ? "text-red-700" : "text-amber-700"
                  }`}
                >
                  Team Lockout
                </p>

                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  {lockoutHasPassed
                    ? "Team selections are locked"
                    : "Time remaining to edit your team"}
                </h2>

                <p className="mt-2 text-sm text-slate-600">
                  {lockoutHasPassed
                    ? "Your team can no longer be changed for this round."
                    : "Teams lock when the first eligible race begins."}
                </p>
              </div>

              <div className="md:text-right">
                <p className="text-sm font-semibold text-slate-500">
                  Lockout time
                </p>

                <p className="mt-1 font-bold text-slate-900">
                  {formatDateTime(round.lockout_at)}
                </p>

                <p
                  className={`mt-2 text-3xl font-bold ${
                    lockoutHasPassed ? "text-red-700" : "text-amber-700"
                  }`}
                >
                  {lockoutHasPassed
                    ? "Locked"
                    : round.lockout_at
                    ? formatTimeUntil(
                        round.lockout_at,
                        currentTime,
                        "lockout"
                      )
                    : "Not set"}
                </p>
              </div>
            </div>

            {!lockoutHasPassed && (
              <div className="mt-5">
                <Link
                  href="/team/edit"
                  className="inline-flex rounded-lg bg-amber-500 px-5 py-3 font-bold text-slate-900 transition hover:bg-amber-400"
                >
                  Edit Team
                </Link>
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Current Round */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:shadow-md">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">
                  Current Round
                </p>

                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  Round {round.round_number}
                  {round.name ? ` — ${round.name}` : ""}
                </h2>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-sm font-bold ${
                  lockoutHasPassed
                    ? "bg-red-100 text-red-800"
                    : "bg-teal-50 text-teal-700"
                }`}
              >
                {lockoutHasPassed ? "Locked" : "Open"}
              </span>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <span className="text-slate-600">Round status</span>

                <span className="font-semibold capitalize text-slate-900">
                  {round.status}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <span className="text-slate-600">Lockout</span>

                <span className="text-right font-semibold text-slate-900">
                  {formatDateTime(round.lockout_at)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Team status</span>

                <span
                  className={`rounded-full px-3 py-1 text-sm font-bold ${getTeamStatusClasses(
                    team?.status ?? null
                  )}`}
                >
                  {getTeamStatusLabel(team?.status ?? null)}
                </span>
              </div>
            </div>
          </div>

          {/* Step 5: My Team Summary */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:shadow-md">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">
                  My Team
                </p>

                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  {selectionCount} of {season.team_size} horses selected
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Round {round.round_number}
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-sm font-bold ${getTeamStatusClasses(
                  team?.status ?? null
                )}`}
              >
                {getTeamStatusLabel(team?.status ?? null)}
              </span>
            </div>

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                <span className="font-semibold text-slate-600">
                  Salary cap
                </span>

                <span className="text-right font-bold text-slate-900">
                  {formatCurrency(salaryUsed)} /{" "}
                  {formatCurrency(salaryCap)}
                </span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-teal-600 transition-all duration-500"
                  style={{ width: `${salaryPercentage}%` }}
                />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-slate-100 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Salary used
                  </p>

                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {formatCurrency(salaryUsed)}
                  </p>
                </div>

                <div className="rounded-xl bg-teal-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">
                    Available
                  </p>

                  <p className="mt-1 text-lg font-bold text-teal-800">
                    {formatCurrency(salaryRemaining)}
                  </p>
                </div>
              </div>
            </div>

            {!team && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                You have not started selecting a team for this round.
              </div>
            )}

            {team?.status === "draft" && (
              <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                Your team is still a draft. Complete and submit it before
                lockout.
              </div>
            )}

            {team?.status === "submitted" && (
              <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800">
                Your team has been submitted for this round.
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/team"
                className="rounded-lg border border-slate-300 px-5 py-3 font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                View Team
              </Link>

              {!lockoutHasPassed && (
                <Link
                  href="/team/edit"
                  className="rounded-lg bg-teal-600 px-5 py-3 font-bold text-white transition hover:bg-teal-700"
                >
                  Edit Team
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* Step 6: Mini Leaderboard */}
        <section className="mt-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:shadow-md">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">
                  Leaderboard
                </p>

                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  Top five
                </h2>
              </div>

              <Link
                href="/leaderboard"
                className="text-sm font-bold text-teal-700 transition hover:text-slate-900"
              >
                View all →
              </Link>
            </div>

            {miniLeaderboard.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {miniLeaderboard.map((entry, index) => (
                  <div
                    key={entry.user_id}
                    className="grid grid-cols-[40px_1fr_auto] items-center gap-3 px-6 py-4 transition hover:bg-slate-50"
                  >
                    <div className="text-center text-lg font-bold text-slate-500">
                      {index === 0
                        ? "🥇"
                        : index === 1
                        ? "🥈"
                        : index === 2
                        ? "🥉"
                        : entry.overall_rank}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900">
                        {entry.display_name}
                      </p>

                      <p className="truncate text-sm text-slate-500">
                        Overall rank #{entry.overall_rank}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-slate-900">
                        {entry.total_score}
                      </p>

                      <p className="text-xs text-slate-500">
                        points
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                No leaderboard scores are available yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}