"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Clock3,
  Gauge,
  Network,
  Trophy,
} from "lucide-react";

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
  distance_metres?: number | null;
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

type DashboardLeaguePosition = {
  league_id: string;
  league_name: string;
  member_count: number;
  league_rank: number;
};

type DashboardExtras = {
  round_ranked_count: number;
  season_ranked_count: number;
  leagues: DashboardLeaguePosition[];
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

function formatRaceTime(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Melbourne",
  }).format(new Date(value));
}

function formatTimeUntil(
  value: string,
  currentTime: number,
  label = "jump"
) {
  const difference =
    new Date(value).getTime() - currentTime;

  if (difference <= 0) {
    return label === "lockout"
      ? "Locked"
      : "Starting now";
  }

  const totalMinutes =
    Math.floor(difference / 60000);

  const days =
    Math.floor(totalMinutes / 1440);

  const hours =
    Math.floor(
      (totalMinutes % 1440) / 60
    );

  const minutes =
    totalMinutes % 60;

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

    if (
      typeof value === "string" &&
      value.trim() !== ""
    ) {
      const parsedValue = Number(value);

      if (!Number.isNaN(parsedValue)) {
        return parsedValue;
      }
    }
  }

  return fallback;
}

function ordinal(value: number) {
  const mod100 = value % 100;

  if (mod100 >= 11 && mod100 <= 13) {
    return `${value}th`;
  }

  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

function rankOfTotal(
  rank: number,
  total: number
) {
  if (rank <= 0 || total <= 0) {
    return "—";
  }

  return `${ordinal(rank)} of ${total.toLocaleString(
    "en-AU"
  )}`;
}

function getTeamStatusLabel(
  status: Team["status"] | null
) {
  switch (status) {
    case "draft":
      return "Team Draft";
    case "submitted":
      return "Team Submitted";
    case "locked":
      return "Team Locked";
    case "scored":
      return "Team Scored";
    default:
      return "No Team";
  }
}

function getTeamStatusClasses(
  status: Team["status"] | null
) {
  switch (status) {
    case "draft":
      return "bg-amber-100 text-amber-800";
    case "submitted":
      return "bg-teal-100 text-teal-800";
    case "locked":
      return "bg-purple-100 text-purple-800";
    case "scored":
      return "bg-slate-900 text-white";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function Dashboard() {
  const router = useRouter();

  const [displayName, setDisplayName] =
    useState("");

  const [round, setRound] =
    useState<Round | null>(null);

  const [season, setSeason] =
    useState<Season | null>(null);

  const [team, setTeam] =
    useState<Team | null>(null);

  const [upcomingRace, setUpcomingRace] =
    useState<UpcomingRace | null>(null);

  const [currentTime, setCurrentTime] =
    useState(Date.now());

  const [roundScore, setRoundScore] =
    useState<ScoreRecord | null>(null);

  const [seasonScore, setSeasonScore] =
    useState<ScoreRecord | null>(null);

  const [projectedRoundScore, setProjectedRoundScore] =
    useState(0);

  const [horsesRanCount, setHorsesRanCount] =
    useState(0);

  const [
    miniLeaderboard,
    setMiniLeaderboard,
  ] = useState<MiniLeaderboardEntry[]>([]);

  const [
    dashboardExtras,
    setDashboardExtras,
  ] = useState<DashboardExtras>({
    round_ranked_count: 0,
    season_ranked_count: 0,
    leagues: [],
  });

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    const interval =
      window.setInterval(() => {
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

      const {
        data,
        error,
      } = await supabase.rpc(
        "get_dashboard_data"
      );

      if (!active) {
        return;
      }

      if (error) {
        console.error(
          "Dashboard RPC error:",
          error
        );

        setErrorMessage(
          error.message ||
            "The dashboard could not be loaded."
        );

        setLoading(false);
        return;
      }

      const dashboardData =
        data as DashboardData | null;

      if (
        !dashboardData?.round ||
        !dashboardData.season
      ) {
        setRound(null);
        setSeason(null);
        setTeam(null);
        setRoundScore(null);
        setSeasonScore(null);
        setProjectedRoundScore(0);
        setHorsesRanCount(0);
        setUpcomingRace(null);
        setMiniLeaderboard([]);
        setDashboardExtras({
          round_ranked_count: 0,
          season_ranked_count: 0,
          leagues: [],
        });

        setErrorMessage(
          dashboardData?.message ||
            "There are no rounds available yet."
        );

        setLoading(false);
        return;
      }

      setDisplayName(
        dashboardData.profile
          ?.display_name
          ?.trim() ||
          user.email?.split("@")[0] ||
          "Player"
      );

      setRound(dashboardData.round);
      setSeason(dashboardData.season);
      setTeam(dashboardData.team);
      setRoundScore(
        dashboardData.round_score
      );
      setSeasonScore(
        dashboardData.season_score
      );
      setUpcomingRace(
        dashboardData.upcoming_race
      );

      if (dashboardData.team?.id) {
        const {
          data: selectionProjectionData,
          error: selectionProjectionError,
        } = await supabase
          .from("team_selections")
          .select(
            `
              race_entry_id,
              is_captain,
              fantasy_points,
              race_entry:race_entries!inner (
                id,
                projected_points,
                race:races!inner (
                  status
                )
              )
            `
          )
          .eq("team_id", dashboardData.team.id);

        if (!active) {
          return;
        }

        if (selectionProjectionError) {
          console.error(
            "Dashboard projected score error:",
            selectionProjectionError
          );
          setProjectedRoundScore(0);
          setHorsesRanCount(0);
        } else {
          const projectedScore = (
            selectionProjectionData ?? []
          ).reduce((total, selection: any) => {
            const rawEntry = selection.race_entry;

            const raceEntry = Array.isArray(rawEntry)
              ? rawEntry[0] ?? null
              : rawEntry;

            const rawRace = raceEntry?.race;

            const race = Array.isArray(rawRace)
              ? rawRace[0] ?? null
              : rawRace;

            const raceIsOfficial =
              race?.status === "official";

            const basePoints = raceIsOfficial
              ? Number(selection.fantasy_points ?? 0)
              : Number(
                  raceEntry?.projected_points ?? 0
                );

            return (
              total +
              (selection.is_captain
                ? basePoints * 2
                : basePoints)
            );
          }, 0);

          setProjectedRoundScore(projectedScore);

          const ranCount = (
            selectionProjectionData ?? []
          ).filter((selection: any) => {
            const rawEntry = selection.race_entry;

            const raceEntry = Array.isArray(rawEntry)
              ? rawEntry[0] ?? null
              : rawEntry;

            const rawRace = raceEntry?.race;

            const race = Array.isArray(rawRace)
              ? rawRace[0] ?? null
              : rawRace;

            return race?.status === "official";
          }).length;

          setHorsesRanCount(ranCount);
        }
      } else {
        setProjectedRoundScore(0);
        setHorsesRanCount(0);
      }

      setMiniLeaderboard(
        (
          dashboardData.mini_leaderboard ??
          []
        )
          .map((entry, index) => ({
            user_id:
              entry.user_id ||
              `leaderboard-${index}`,
            display_name:
              entry.display_name?.trim() ||
              "Player",
            total_score: Number(
              entry.total_points ?? 0
            ),
            overall_rank:
              Number(
                entry.overall_rank ?? 0
              ) ||
              index + 1,
          }))
          .sort(
            (a, b) =>
              a.overall_rank -
              b.overall_rank
          )
      );

      const {
        data: extrasRaw,
        error: extrasError,
      } = await supabase.rpc(
        "get_dashboard_league_positions",
        {
          p_round_id:
            dashboardData.round.id,
          p_season_id:
            dashboardData.season.id,
        }
      );

      if (!active) {
        return;
      }

      if (extrasError) {
        console.error(
          "Dashboard league positions error:",
          extrasError
        );

        setDashboardExtras({
          round_ranked_count: 0,
          season_ranked_count: 0,
          leagues: [],
        });
      } else {
        const extras =
          extrasRaw as DashboardExtras | null;

        setDashboardExtras({
          round_ranked_count:
            extras?.round_ranked_count ??
            0,
          season_ranked_count:
            extras?.season_ranked_count ??
            0,
          leagues:
            extras?.leagues ?? [],
        });
      }

      setLoading(false);
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, [router]);

  const salaryUsed =
    team?.salary_used ?? 0;

  const salaryCap =
    team?.salary_cap ??
    season?.salary_cap ??
    0;

  const salaryRemaining =
    useMemo(() => {
      return Math.max(
        0,
        salaryCap - salaryUsed
      );
    }, [salaryUsed, salaryCap]);

  const salaryPercentage =
    useMemo(() => {
      if (salaryCap <= 0) {
        return 0;
      }

      return Math.min(
        100,
        (salaryUsed / salaryCap) * 100
      );
    }, [salaryUsed, salaryCap]);

  const currentRoundScore =
    getNumber(roundScore, [
      "total_points",
      "round_score",
      "total_score",
      "fantasy_points",
      "score",
      "points",
    ]);

  const currentRoundRank =
    getNumber(roundScore, [
      "round_rank",
      "rank",
    ]);

  const currentSeasonScore =
    getNumber(seasonScore, [
      "total_points",
      "season_score",
      "total_score",
      "fantasy_points",
      "score",
      "points",
    ]);

  const currentOverallRank =
    getNumber(seasonScore, [
      "overall_rank",
      "season_rank",
      "rank",
    ]);

  const lockoutHasPassed =
    round?.lockout_at !== null &&
    round?.lockout_at !== undefined &&
    new Date(
      round.lockout_at
    ).getTime() <= currentTime;

  const visibleLeagues =
    dashboardExtras.leagues.slice(0, 5);

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
            {errorMessage ||
              "Dashboard information is unavailable."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-3 sm:p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-2xl bg-slate-900 p-4 text-white shadow-sm sm:p-5 md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-300">
                {season.name}
              </p>

              <h1 className="mt-2 text-2xl font-bold sm:text-3xl md:text-4xl">
                Welcome, {displayName}
              </h1>

              <p className="mt-2 text-sm text-slate-300">
                Round {round.round_number}
                {round.name
                  ? ` · ${round.name}`
                  : ""}
              </p>
            </div>

            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
              <Link
                href="/team"
                className="w-full rounded-lg bg-amber-400 px-4 py-2.5 text-center text-sm font-bold text-slate-900 transition hover:bg-amber-300 sm:w-auto"
              >
                View Team
              </Link>

              <Link
                href="/leaderboard"
                className="w-full rounded-lg border border-slate-700 px-4 py-2.5 text-center text-sm font-bold text-white transition hover:bg-slate-800 sm:w-auto"
              >
                Leaderboard
              </Link>
            </div>
          </div>
        </section>

        {errorMessage && (
          <div className="mt-5 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
            {errorMessage}
          </div>
        )}

        <section className="mt-4 sm:mt-5">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
            <div className="flex flex-col gap-2.5 sm:gap-3 xl:contents">
              <div className="rounded-xl bg-slate-900 p-3.5 text-white shadow-sm sm:p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Round Score
                </p>

                <p className="mt-2 text-2xl font-bold sm:text-3xl">
                  {currentRoundScore}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  points
                </p>
              </div>

              <div className="rounded-xl bg-teal-600 p-3.5 text-white shadow-sm sm:p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-100">
                  Round Rank
                </p>

                <p className="mt-2 text-xl font-bold sm:text-2xl">
                  {rankOfTotal(
                    currentRoundRank,
                    dashboardExtras.round_ranked_count
                  )}
                </p>

                <p className="mt-1 text-xs text-teal-100">
                  this round
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 sm:gap-3 xl:contents">
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Season Score
                </p>

                <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                  {currentSeasonScore}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  points
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Overall Rank
                </p>

                <p className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">
                  {rankOfTotal(
                    currentOverallRank,
                    dashboardExtras.season_ranked_count
                  )}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  this season
                </p>
              </div>
            </div>
          </div>

          {team && (
            <div className="mt-2.5 grid grid-cols-2 divide-x divide-slate-700 rounded-xl bg-slate-900 p-4 text-white shadow-sm sm:mt-3">
              <div className="pr-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">
                  Projected Score
                </p>

                <p className="mt-1 text-2xl font-bold text-white sm:text-3xl">
                  {projectedRoundScore}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  points
                </p>
              </div>

              <div className="pl-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Horses Ran
                </p>

                <p className="mt-1 text-2xl font-bold text-white sm:text-3xl">
                  {horsesRanCount}/{season.team_size}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  horses
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="mt-4 grid gap-4 sm:mt-5 sm:gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-amber-700">
                  <Clock3 className="h-4 w-4" />

                  <p className="text-xs font-bold uppercase tracking-wide">
                    Current Round
                  </p>
                </div>

                <h2 className="mt-2 text-xl font-bold text-slate-900">
                  Round {round.round_number}
                  {round.name
                    ? ` — ${round.name}`
                    : ""}
                </h2>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  lockoutHasPassed
                    ? "bg-red-100 text-red-800"
                    : "bg-teal-100 text-teal-800"
                }`}
              >
                {lockoutHasPassed
                  ? "Locked"
                  : "Open"}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-2 sm:gap-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Lockout
                </p>

                <p className="mt-1 font-bold text-slate-900">
                  {formatDateTime(
                    round.lockout_at
                  )}
                </p>

                <p
                  className={`mt-2 text-sm font-bold ${
                    lockoutHasPassed
                      ? "text-red-700"
                      : "text-amber-700"
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

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Next Race
                </p>

                {upcomingRace ? (
                  <>
                    <p className="mt-1 font-bold text-slate-900">
                      {upcomingRace.race_name}
                    </p>

                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Distance
                        </p>

                        <p className="mt-0.5 font-semibold text-slate-700">
                          {upcomingRace.distance_metres
                            ? `${upcomingRace.distance_metres}m`
                            : "—"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Track
                        </p>

                        <p className="mt-0.5 font-semibold text-slate-700">
                          {upcomingRace.racecourse?.name ??
                            "—"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Time
                        </p>

                        <p className="mt-0.5 font-semibold text-slate-700">
                          {formatRaceTime(
                            upcomingRace.scheduled_start
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Race
                        </p>

                        <p className="mt-0.5 font-semibold text-slate-700">
                          Race {upcomingRace.race_number}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">
                    No upcoming race.
                  </p>
                )}
              </div>
            </div>

          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-teal-700">
                  <Gauge className="h-4 w-4" />

                  <p className="text-xs font-bold uppercase tracking-wide">
                    My Team
                  </p>
                </div>

                <h2 className="mt-2 text-xl font-bold text-slate-900">
                  {getTeamStatusLabel(
                    team?.status ?? null
                  )}
                </h2>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${getTeamStatusClasses(
                  team?.status ?? null
                )}`}
              >
                {team?.status
                  ? team.status
                  : "Not started"}
              </span>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-semibold text-slate-600">
                  Salary
                </span>

                <span className="font-bold text-slate-900">
                  {formatCurrency(
                    salaryUsed
                  )}{" "}
                  /{" "}
                  {formatCurrency(
                    salaryCap
                  )}
                </span>
              </div>

              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-teal-600 transition-all duration-500"
                  style={{
                    width: `${salaryPercentage}%`,
                  }}
                />
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl bg-teal-50 px-4 py-3">
                <span className="text-sm font-semibold text-teal-700">
                  Remaining
                </span>

                <span className="font-bold text-teal-900">
                  {formatCurrency(
                    salaryRemaining
                  )}
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Link
                href="/team"
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-bold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
              >
                View Team
              </Link>

              {!lockoutHasPassed && (
                <Link
                  href="/team/edit"
                  className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-center text-sm font-bold text-white transition hover:bg-teal-700 sm:w-auto"
                >
                  Edit Team
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4 sm:gap-4 sm:p-5">
              <div>
                <div className="flex items-center gap-2 text-teal-700">
                  <Network className="h-4 w-4" />

                  <p className="text-xs font-bold uppercase tracking-wide">
                    Your Leagues
                  </p>
                </div>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Private league positions
                </h2>
              </div>

              <Link
                href="/leagues"
                className="text-sm font-bold text-teal-700 transition hover:text-slate-900"
              >
                View all →
              </Link>
            </div>

            {visibleLeagues.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {visibleLeagues.map(
                  (league) => (
                    <Link
                      key={league.league_id}
                      href={`/leagues?league=${league.league_id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-slate-50 sm:gap-4 sm:px-5 sm:py-4"
                    >
                      <span className="truncate font-bold text-slate-900">
                        {league.league_name}
                      </span>

                      <span className="shrink-0 font-bold text-teal-700">
                        {ordinal(
                          league.league_rank
                        )}{" "}
                        of{" "}
                        {league.member_count}
                      </span>
                    </Link>
                  )
                )}
              </div>
            ) : (
              <div className="p-7 text-center">
                <p className="text-slate-500">
                  You have not joined any private leagues for this season.
                </p>

                <Link
                  href="/leagues"
                  className="mt-3 inline-block font-bold text-teal-700 hover:underline"
                >
                  Find your leagues →
                </Link>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4 sm:gap-4 sm:p-5">
              <div>
                <div className="flex items-center gap-2 text-teal-700">
                  <Trophy className="h-4 w-4" />

                  <p className="text-xs font-bold uppercase tracking-wide">
                    Leaderboard
                  </p>
                </div>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
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
                {miniLeaderboard.map(
                  (entry) => (
                    <div
                      key={entry.user_id}
                      className="grid grid-cols-[36px_1fr_auto] items-center gap-2 px-4 py-3 sm:grid-cols-[48px_1fr_auto] sm:gap-3 sm:px-5 sm:py-3.5"
                    >
                      <div className="text-center font-bold text-slate-500">
                        {entry.overall_rank}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-900">
                          {entry.display_name}
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
                  )
                )}
              </div>
            ) : (
              <div className="p-7 text-center text-slate-500">
                No leaderboard scores are available yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}