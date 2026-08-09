"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import HorseProfileModal from "@/components/HorseProfileModal";

import { supabase } from "@/lib/supabase";

type Season = {
  id: string;
  name: string;
  salary_cap: number;
  team_size: number;
};

type Round = {
  id: string;
  season_id: string;
  round_number: number;
  name: string | null;
  status: string;
  lockout_at: string;
};

type Horse = {
  id: string;
  name: string;
};

type Racecourse = {
  id: string;
  name: string;
};

type Race = {
  id: string;
  race_number: number;
  race_name: string;
  grade: "L" | "G3" | "G2" | "G1";
  scheduled_start: string;
  racecourse: Racecourse | null;
};

type RaceEntry = {
  id: string;
  race_id: string;
  horse_id: string;
  saddlecloth_number: number | null;
  price_at_entry: number;
  horse: Horse | null;
  race: Race | null;
};

type TeamStatus = "draft" | "submitted" | "locked" | "scored";

type Team = {
  id: string;
  user_id: string;
  round_id: string;
  team_name: string | null;
  status: TeamStatus;
  salary_used: number;
};

type TeamSelection = {
  id: string;
  team_id: string;
  race_entry_id: string;
  is_captain: boolean;
  selected_price: number;
  fantasy_points: number;
  race_entry: RaceEntry | null;
};

type MyTeamData = {
  success: boolean;
  message?: string;
  round: Round | null;
  season: Season | null;
  team: Team | null;
  selections: TeamSelection[];
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string) {
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

function getGradeLabel(grade: Race["grade"]) {
  const labels: Record<Race["grade"], string> = {
    G1: "G1",
    G2: "G2",
    G3: "G3",
    L: "Listed",
  };

  return labels[grade];
}

function getGradeClasses(grade: Race["grade"]) {
  switch (grade) {
    case "G1":
      return "bg-amber-400 text-amber-950";

    case "G2":
      return "bg-blue-600 text-white";

    case "G3":
      return "bg-teal-600 text-white";

    case "L":
      return "bg-slate-300 text-slate-900";
  }
}

function getStatusLabel(status: TeamStatus) {
  const labels: Record<TeamStatus, string> = {
    draft: "Draft",
    submitted: "Submitted",
    locked: "Locked",
    scored: "Scored",
  };

  return labels[status];
}

function getCountdown(lockoutAt: string, currentTime: number) {
  const difference =
    new Date(lockoutAt).getTime() - currentTime;

  if (difference <= 0) {
    return "Round Locked";
  }

  const days = Math.floor(
    difference / (1000 * 60 * 60 * 24)
  );

  const hours = Math.floor(
    (difference % (1000 * 60 * 60 * 24)) /
    (1000 * 60 * 60)
  );

  const minutes = Math.floor(
    (difference % (1000 * 60 * 60)) /
    (1000 * 60)
  );

  const seconds = Math.floor(
    (difference % (1000 * 60)) / 1000
  );

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }

  return `${hours}h ${minutes}m ${seconds}s`;
}

export default function MyTeamPage() {
  const [season, setSeason] = useState<Season | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [team, setTeam] = useState<Team | null>(null);

  const [selections, setSelections] = useState<
    TeamSelection[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedHorseId, setSelectedHorseId] = useState<string | null>(
    null
  );

  const [currentTime, setCurrentTime] = useState(() =>
    Date.now()
  );

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase.rpc(
      "get_my_team_data"
    );

    if (error) {
      console.error("My Team RPC error:", error);

      setRound(null);
      setSeason(null);
      setTeam(null);
      setSelections([]);

      setErrorMessage(
        error.message ||
          "Your team information could not be loaded."
      );

      setLoading(false);
      return;
    }

    const teamData = data as MyTeamData | null;

    if (!teamData?.round || !teamData.season) {
      setRound(null);
      setSeason(null);
      setTeam(null);
      setSelections([]);

      setErrorMessage(
        teamData?.message ||
          "There is no open, locked or completed round."
      );

      setLoading(false);
      return;
    }

    setRound(teamData.round);
    setSeason(teamData.season);
    setTeam(teamData.team);
    setSelections(teamData.selections ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const sortedSelections = useMemo(() => {
    return [...selections].sort((a, b) => {
      const scheduledStartA = a.race_entry?.race?.scheduled_start
        ? new Date(a.race_entry.race.scheduled_start).getTime()
        : Number.MAX_SAFE_INTEGER;

      const scheduledStartB = b.race_entry?.race?.scheduled_start
        ? new Date(b.race_entry.race.scheduled_start).getTime()
        : Number.MAX_SAFE_INTEGER;

      if (scheduledStartA !== scheduledStartB) {
        return scheduledStartA - scheduledStartB;
      }

      const raceNumberA =
        a.race_entry?.race?.race_number ?? 999;

      const raceNumberB =
        b.race_entry?.race?.race_number ?? 999;

      if (raceNumberA !== raceNumberB) {
        return raceNumberA - raceNumberB;
      }

      const saddleclothA =
        a.race_entry?.saddlecloth_number ?? 999;

      const saddleclothB =
        b.race_entry?.saddlecloth_number ?? 999;

      if (saddleclothA !== saddleclothB) {
        return saddleclothA - saddleclothB;
      }

      return (a.race_entry?.horse?.name ?? "").localeCompare(
        b.race_entry?.horse?.name ?? ""
      );
    });
  }, [selections]);

  const salaryUsed = useMemo(() => {
    return selections.reduce((total, selection) => {
      return total + selection.selected_price;
    }, 0);
  }, [selections]);


  const totalPoints = useMemo(() => {
    return selections.reduce((total, selection) => {
      const basePoints = selection.fantasy_points ?? 0;

      return total + (selection.is_captain ? basePoints * 2 : basePoints);
    }, 0);
  }, [selections]);

  const captainName = useMemo(() => {
    return (
      selections.find((selection) => selection.is_captain)
        ?.race_entry?.horse?.name ?? "Not selected"
    );
  }, [selections]);

  const salaryRemaining = season
    ? season.salary_cap - salaryUsed
    : 0;

  const lockoutHasStarted =
    round !== null &&
    currentTime >= new Date(round.lockout_at).getTime();

  const editButtonVisible =
    round !== null &&
    !lockoutHasStarted &&
    team?.status !== "locked" &&
    team?.status !== "scored";

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-6xl rounded-xl border bg-white p-10 text-center text-slate-500">
          Loading your team...
        </div>
      </main>
    );
  }

  if (!round || !season) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-4xl rounded-xl border bg-white p-8">
          <h1 className="text-2xl font-bold text-slate-900">
            My Team
          </h1>

          <p className="mt-4 text-red-700">
            {errorMessage ||
              "There is no current round."}
          </p>
        </div>
      </main>
    );
  }

  if (!team) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 md:p-8">
        <div className="mx-auto max-w-6xl">
          <header className="rounded-2xl bg-teal-700 p-6 text-white shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-green-200">
              {season.name}
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              My Team
            </h1>

            <p className="mt-2 text-teal-100">
              Round {round.round_number}
              {round.name ? ` — ${round.name}` : ""}
            </p>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-300">
                {lockoutHasStarted
                  ? "Lockout Status"
                  : "Lockout Countdown"}
              </p>

              <p className="mt-1 text-2xl font-bold">
                {lockoutHasStarted && "🔒 "}
                {getCountdown(
                  round.lockout_at,
                  currentTime
                )}
              </p>

              <p className="mt-2 text-sm text-teal-100">
                Lockout:{" "}
                {formatDateTime(round.lockout_at)}
              </p>
            </div>
          </header>

          <section className="mt-6 rounded-xl border bg-white p-10 text-center">
            <h2 className="text-2xl font-bold text-slate-900">
              You have not created a team yet
            </h2>

            <p className="mt-3 text-slate-600">
              Select your horses and captain before the
              round lockout.
            </p>

            {!lockoutHasStarted ? (
              <Link
                href="/team/edit"
                className="mt-6 inline-flex rounded-lg bg-teal-700 px-6 py-3 font-bold text-white transition hover:bg-teal-800"
              >
                Create Team
              </Link>
            ) : (
              <p className="mt-6 font-semibold text-red-700">
                Team selection is closed because round
                lockout has commenced.
              </p>
            )}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-5 px-5 py-5 md:px-7 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 xl:max-w-sm">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                <span className="text-teal-700">{season.name}</span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-600">
                  Round {round.round_number}
                  {round.name ? ` — ${round.name}` : ""}
                </span>
              </div>

              <h1 className="mt-1 truncate text-3xl font-bold tracking-tight text-slate-950">
                {team.team_name?.trim() || "My Team"}
              </h1>
            </div>

            <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 xl:max-w-4xl xl:grid-cols-5">
              <div className="border-l-2 border-teal-600 pl-3">
                <p className="text-xs font-medium text-slate-500">Total score</p>
                <p className="mt-0.5 text-2xl font-bold text-teal-700">
                  {totalPoints} <span className="text-sm font-semibold">pts</span>
                </p>
              </div>

              <div className="border-l border-slate-200 pl-3">
                <p className="text-xs font-medium text-slate-500">Team salary</p>
                <p className="mt-1 text-lg font-bold text-slate-950">
                  {formatCurrency(salaryUsed)}
                </p>
              </div>

              <div className="border-l border-slate-200 pl-3">
                <p className="text-xs font-medium text-slate-500">Salary remaining</p>
                <p className="mt-1 text-lg font-bold text-teal-700">
                  {formatCurrency(salaryRemaining)}
                </p>
              </div>

              <div className="border-l border-slate-200 pl-3">
                <p className="text-xs font-medium text-slate-500">Horses</p>
                <p className="mt-1 text-lg font-bold text-slate-950">
                  {selections.length} / {season.team_size}
                </p>
              </div>

              <div className="border-l border-slate-200 pl-3">
                <p className="text-xs font-medium text-slate-500">Captain</p>
                <p className="mt-1 truncate text-lg font-bold text-slate-950">
                  {captainName}
                </p>
              </div>
            </div>

            {editButtonVisible && (
              <Link
                href="/team/edit"
                className="inline-flex shrink-0 items-center justify-center rounded-lg bg-slate-950 px-5 py-3 font-bold text-white transition hover:bg-slate-800"
              >
                Edit Team
              </Link>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200 bg-slate-50/70 px-5 py-3 text-sm md:px-7">
            <span className="font-semibold text-slate-700">
              {getStatusLabel(team.status)}
            </span>

            <span className="text-slate-600">
              {lockoutHasStarted ? "🔒 Round locked" : "Next lockout"}: {" "}
              <strong>{getCountdown(round.lockout_at, currentTime)}</strong>
            </span>

            <span className="text-slate-500">
              {formatDateTime(round.lockout_at)}
            </span>
          </div>
        </header>

        {errorMessage && (
          <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
            {errorMessage}
          </div>
        )}

        {lockoutHasStarted && (
          <div className="mt-4 rounded-lg border border-slate-300 bg-slate-200 px-4 py-3 text-sm text-slate-800">
            Round lockout has commenced. Your team can no longer be edited.
          </div>
        )}

        <section className="mt-5">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Selected Horses</h2>
              <p className="text-sm text-slate-600">
                Your team for Round {round.round_number}. Select a horse card to view its statistics.
              </p>
            </div>

            <p className="text-xs font-medium text-slate-500">
              Captain scores 2× points
            </p>
          </div>

          {sortedSelections.length === 0 ? (
            <div className="rounded-xl border bg-white p-10 text-center text-slate-500 shadow-sm">
              No horses have been selected.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {sortedSelections.map((selection) => {
                const entry = selection.race_entry;
                const horse = entry?.horse;
                const race = entry?.race;

                const displayedPoints = selection.is_captain
                  ? (selection.fantasy_points ?? 0) * 2
                  : selection.fantasy_points ?? 0;

                const raceIsUpcoming = race
                  ? new Date(race.scheduled_start).getTime() > currentTime
                  : false;

                const cardClasses = selection.is_captain
                  ? "border-amber-300 border-l-4 bg-amber-50/60 shadow-sm"
                  : "border-slate-200 bg-white shadow-sm";

                return (
                  <article
                    key={selection.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (horse?.id) {
                        setSelectedHorseId(horse.id);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (
                        (event.key === "Enter" || event.key === " ") &&
                        horse?.id
                      ) {
                        event.preventDefault();
                        setSelectedHorseId(horse.id);
                      }
                    }}
                    className={`cursor-pointer rounded-xl border px-4 py-3.5 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${cardClasses}`}
                    aria-label={
                      horse
                        ? `View statistics for ${horse.name}`
                        : "Horse statistics unavailable"
                    }
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          {selection.is_captain && (
                            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-amber-950">
                              C
                            </span>
                          )}

                          <h3 className="truncate text-base font-bold text-slate-950 sm:text-lg">
                            {horse?.name ?? "Unknown horse"}
                          </h3>
                        </div>

                        <p className="mt-1 truncate text-sm font-medium text-slate-700">
                          {race
                            ? `R${race.race_number} • ${race.race_name}`
                            : "Race unavailable"}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                          {race && (
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-bold ${getGradeClasses(
                                race.grade
                              )}`}
                            >
                              {getGradeLabel(race.grade)}
                            </span>
                          )}

                          {race?.racecourse && (
                            <span className="text-sm text-slate-600">
                              {race.racecourse.name}
                            </span>
                          )}

                          {race && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="text-sm font-medium text-slate-600">
                                {formatRaceTime(race.scheduled_start)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex min-w-[108px] flex-col items-end">
                        {raceIsUpcoming ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">
                            Upcoming
                          </span>
                        ) : (
                          <div className="text-right">
                            <p className="text-2xl font-black leading-none text-teal-700 sm:text-3xl">
                              {displayedPoints}
                            </p>
                            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                              {selection.is_captain ? "pts · 2×" : "pts"}
                            </p>
                          </div>
                        )}

                        <p className="mt-3 text-sm font-bold text-slate-950">
                          {formatCurrency(selection.selected_price)}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <HorseProfileModal
        horseId={selectedHorseId}
        onClose={() => setSelectedHorseId(null)}
      />
    </main>
  );
}