"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock3,
  Flag,
  MapPin,
  Trophy,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type Season = {
  id: string;
  name: string;
  year: number;
  is_active: boolean;
};

type Racecourse = {
  id: string;
  name: string;
  state: string | null;
};

type Race = {
  id: string;
  round_id: string;
  race_number: number;
  race_name: string;
  grade: "L" | "G3" | "G2" | "G1";
  scheduled_start: string;
  status:
    | "scheduled"
    | "running"
    | "official"
    | "abandoned"
    | "cancelled";
  racecourse: Racecourse | null;
};

type Round = {
  id: string;
  season_id: string;
  round_number: number;
  name: string | null;
  date: string;
  status:
    | "draft"
    | "open"
    | "locked"
    | "scoring"
    | "completed";
  lockout_at: string | null;
  races: Race[];
};

type RacecourseGroup = {
  racecourseId: string;
  racecourseName: string;
  racecourseState: string | null;
  races: Race[];
};

type RaceResultRow = {
  result_id: string;
  horse_id: string;
  horse_name: string;
  saddlecloth_number: number | null;
  finishing_position: number | null;
  result_status: string;
  fantasy_points: number;
  price_change: number;
  price_before: number;
  price_after: number;
  is_dead_heat: boolean;
};

type RaceResultsData = {
  success: boolean;
  race: {
    id: string;
    race_number: number;
    race_name: string;
    grade: Race["grade"];
    scheduled_start: string;
    status: Race["status"];
    racecourse: Racecourse | null;
  } | null;
  results: RaceResultRow[];
  message?: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Melbourne",
  }).format(new Date(value));
}

function getGradeLabel(grade: Race["grade"]) {
  const labels: Record<Race["grade"], string> = {
    G1: "Group 1",
    G2: "Group 2",
    G3: "Group 3",
    L: "Listed",
  };

  return labels[grade];
}

function getGradeClasses(grade: Race["grade"]) {
  switch (grade) {
    case "G1":
      return "bg-amber-100 text-amber-900 border-amber-200";
    case "G2":
      return "bg-blue-100 text-blue-900 border-blue-200";
    case "G3":
      return "bg-teal-100 text-teal-900 border-teal-200";
    case "L":
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
}

function getRoundStatusClasses(status: Round["status"]) {
  switch (status) {
    case "open":
      return "bg-green-100 text-green-800 border-green-200";
    case "locked":
      return "bg-red-100 text-red-800 border-red-200";
    case "scoring":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "completed":
      return "bg-slate-200 text-slate-800 border-slate-300";
    case "draft":
    default:
      return "bg-blue-100 text-blue-800 border-blue-200";
  }
}

function getRaceStatusClasses(status: Race["status"]) {
  switch (status) {
    case "running":
      return "bg-amber-100 text-amber-800";
    case "official":
      return "bg-green-100 text-green-800";
    case "abandoned":
    case "cancelled":
      return "bg-red-100 text-red-800";
    case "scheduled":
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getFinishLabel(
  finishingPosition: number | null,
  resultStatus: string
) {
  if (resultStatus !== "finished" || finishingPosition === null) {
    return titleCase(resultStatus);
  }

  const remainderTen = finishingPosition % 10;
  const remainderHundred = finishingPosition % 100;

  let suffix = "th";

  if (remainderHundred < 11 || remainderHundred > 13) {
    if (remainderTen === 1) suffix = "st";
    if (remainderTen === 2) suffix = "nd";
    if (remainderTen === 3) suffix = "rd";
  }

  return `${finishingPosition}${suffix}`;
}

export default function CalendarPage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [expandedRoundIds, setExpandedRoundIds] = useState<Set<string>>(
    new Set()
  );
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(
    null
  );
  const [raceResultsData, setRaceResultsData] =
    useState<RaceResultsData | null>(null);
  const [raceResultsLoading, setRaceResultsLoading] = useState(false);
  const [raceResultsError, setRaceResultsError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCalendar() {
      setLoading(true);
      setErrorMessage("");

      const [calendarResponse, seasonsResponse] = await Promise.all([
        supabase.rpc("get_calendar_data"),
        supabase
          .from("seasons")
          .select("id, name, year, is_active")
          .order("year", { ascending: false }),
      ]);

      if (!active) {
        return;
      }

      if (calendarResponse.error || seasonsResponse.error) {
        const message =
          calendarResponse.error?.message ||
          seasonsResponse.error?.message ||
          "The season calendar could not be loaded.";

        console.error(
          "Calendar load error:",
          calendarResponse.error || seasonsResponse.error
        );
        setErrorMessage(message);
        setRounds([]);
        setSeasons([]);
        setLoading(false);
        return;
      }

      const data = calendarResponse.data;

      const calendarData = data as unknown as {
        success: boolean;
        rounds: Round[];
      };

      const loadedRounds = (
        calendarData?.rounds ?? []
      ).map((round) => ({
        ...round,
        races: [...(round.races ?? [])].sort((a, b) => {
          const timeDifference =
            new Date(a.scheduled_start).getTime() -
            new Date(b.scheduled_start).getTime();

          if (timeDifference !== 0) {
            return timeDifference;
          }

          return a.race_number - b.race_number;
        }),
      }));

      setRounds(loadedRounds);

      const loadedSeasons = (seasonsResponse.data ?? []) as Season[];
      setSeasons(loadedSeasons);

      const preferredSeason =
        loadedSeasons.find((season) => season.is_active) ??
        loadedSeasons[0] ??
        null;

      const preferredSeasonId = preferredSeason?.id ?? "";
      setSelectedSeasonId(preferredSeasonId);

      const seasonRounds = preferredSeasonId
        ? loadedRounds.filter(
            (round) => round.season_id === preferredSeasonId
          )
        : [];

      const activeRound =
        seasonRounds.find((round) =>
          ["open", "locked", "scoring"].includes(round.status)
        ) ??
        [...seasonRounds]
          .reverse()
          .find((round) => round.status === "completed") ??
        seasonRounds[0];

      setExpandedRoundIds(
        activeRound ? new Set([activeRound.id]) : new Set()
      );

      setLoading(false);
    }

    void loadCalendar();

    return () => {
      active = false;
    };
  }, []);

  const filteredRounds = useMemo(() => {
    if (!selectedSeasonId) {
      return [];
    }

    return rounds.filter(
      (round) => round.season_id === selectedSeasonId
    );
  }, [rounds, selectedSeasonId]);

  const selectedSeason = useMemo(() => {
    return (
      seasons.find((season) => season.id === selectedSeasonId) ?? null
    );
  }, [seasons, selectedSeasonId]);

  const totalRaces = useMemo(() => {
    return filteredRounds.reduce(
      (total, round) => total + round.races.length,
      0
    );
  }, [filteredRounds]);

  const completedRounds = useMemo(() => {
    return filteredRounds.filter(
      (round) => round.status === "completed"
    ).length;
  }, [filteredRounds]);

  function handleSeasonChange(seasonId: string) {
    setSelectedSeasonId(seasonId);
    setSelectedRaceId(null);

    const seasonRounds = rounds.filter(
      (round) => round.season_id === seasonId
    );

    const activeRound =
      seasonRounds.find((round) =>
        ["open", "locked", "scoring"].includes(round.status)
      ) ??
      [...seasonRounds]
        .reverse()
        .find((round) => round.status === "completed") ??
      seasonRounds[0];

    setExpandedRoundIds(
      activeRound ? new Set([activeRound.id]) : new Set()
    );
  }

  function toggleRound(roundId: string) {
    setExpandedRoundIds((current) => {
      const next = new Set(current);

      if (next.has(roundId)) {
        next.delete(roundId);
      } else {
        next.add(roundId);
      }

      return next;
    });
  }

  function expandAll() {
    setExpandedRoundIds(new Set(filteredRounds.map((round) => round.id)));
  }

  function collapseAll() {
    setExpandedRoundIds(new Set());
  }

  function groupRacesByRacecourse(races: Race[]) {
    const groups = new Map<string, RacecourseGroup>();

    for (const race of races) {
      const racecourseId = race.racecourse?.id ?? "unknown";
      const currentGroup = groups.get(racecourseId);

      if (currentGroup) {
        currentGroup.races.push(race);
        continue;
      }

      groups.set(racecourseId, {
        racecourseId,
        racecourseName: race.racecourse?.name ?? "Racecourse unavailable",
        racecourseState: race.racecourse?.state ?? null,
        races: [race],
      });
    }

    return [...groups.values()].sort((a, b) =>
      a.racecourseName.localeCompare(b.racecourseName)
    );
  }


  useEffect(() => {
    if (!selectedRaceId) {
      setRaceResultsData(null);
      setRaceResultsError("");
      return;
    }

    let active = true;

    async function loadRaceResults() {
      setRaceResultsLoading(true);
      setRaceResultsError("");

      const { data, error } = await supabase.rpc(
        "get_calendar_race_results",
        {
          p_race_id: selectedRaceId,
        }
      );

      if (!active) {
        return;
      }

      if (error) {
        console.error("Calendar race results error:", error);
        setRaceResultsError(
          error.message || "The race results could not be loaded."
        );
        setRaceResultsData(null);
        setRaceResultsLoading(false);
        return;
      }

      setRaceResultsData(data as unknown as RaceResultsData);
      setRaceResultsLoading(false);
    }

    void loadRaceResults();

    return () => {
      active = false;
    };
  }, [selectedRaceId]);

  useEffect(() => {
    if (!selectedRaceId) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedRaceId(null);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedRaceId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-7xl rounded-xl border bg-white p-10 text-center text-slate-500">
          Loading season calendar...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-2xl bg-slate-950 p-6 text-white shadow-sm md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-300">
                Season schedule
              </p>

              <h1 className="mt-2 text-3xl font-black md:text-4xl">
                Calendar
              </h1>

              <p className="mt-3 max-w-2xl text-slate-300">
                View every round, lockout time and eligible Group and
                Listed race across the season.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {selectedSeason && (
                <p className="text-sm font-bold text-teal-300 lg:text-right">
                  {selectedSeason.name} {selectedSeason.year}
                  {selectedSeason.is_active ? " — Active" : ""}
                </p>
              )}

              <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Rounds
                </p>
                <p className="mt-1 text-2xl font-black">
                  {filteredRounds.length}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Completed
                </p>
                <p className="mt-1 text-2xl font-black">
                  {completedRounds}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Races
                </p>
                <p className="mt-1 text-2xl font-black">
                  {totalRaces}
                </p>
              </div>
              </div>
            </div>
          </div>
        </header>

        {errorMessage && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            {errorMessage}
          </div>
        )}

        {seasons.length > 0 && (
          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <label
                  htmlFor="season-filter"
                  className="block text-sm font-bold text-slate-800"
                >
                  Season
                </label>
                <p className="mt-1 text-sm text-slate-500">
                  Choose which season&apos;s calendar you want to view.
                </p>
              </div>

              <select
                id="season-filter"
                value={selectedSeasonId}
                onChange={(event) =>
                  handleSeasonChange(event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 sm:w-80"
              >
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name} {season.year}
                    {season.is_active ? " — Active" : ""}
                  </option>
                ))}
              </select>
            </div>
          </section>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">
              Season Rounds
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Select a round to view its races, then select a race to
              view the official results.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
            >
              Expand all
            </button>

            <button
              type="button"
              onClick={collapseAll}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
            >
              Collapse all
            </button>
          </div>
        </div>

        {filteredRounds.length === 0 ? (
          <section className="mt-5 rounded-2xl border bg-white p-10 text-center shadow-sm">
            <CalendarDays className="mx-auto h-10 w-10 text-slate-400" />
            <h2 className="mt-4 text-2xl font-black text-slate-950">
              No rounds available
            </h2>
            <p className="mt-2 text-slate-600">
              No rounds are available for the selected season yet.
            </p>
          </section>
        ) : (
          <div className="mt-5 space-y-4">
            {filteredRounds.map((round) => {
              const expanded = expandedRoundIds.has(round.id);
              const racecourseGroups = groupRacesByRacecourse(round.races);

              return (
                <article
                  key={round.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => toggleRound(round.id)}
                    className="flex w-full flex-col gap-4 p-5 text-left transition hover:bg-slate-50 md:flex-row md:items-center md:justify-between"
                    aria-expanded={expanded}
                  >
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="mt-1 text-slate-500">
                        {expanded ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-xl font-black text-slate-950">
                            Round {round.round_number}
                            {round.name ? ` — ${round.name}` : ""}
                          </h3>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-bold ${getRoundStatusClasses(
                              round.status
                            )}`}
                          >
                            {titleCase(round.status)}
                          </span>
                        </div>

                        <p className="mt-2 text-sm font-semibold text-slate-700">
                          {formatDate(round.date)}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {round.races.length}{" "}
                          {round.races.length === 1 ? "race" : "races"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm sm:min-w-[340px]">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Lockout
                        </p>
                        <p className="mt-1 font-bold text-slate-900">
                          {round.lockout_at
                            ? formatTime(round.lockout_at)
                            : "Not set"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {round.lockout_at
                            ? formatShortDate(round.lockout_at)
                            : ""}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Meetings
                        </p>
                        <p className="mt-1 font-bold text-slate-900">
                          {racecourseGroups.length}
                        </p>
                      </div>
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-slate-200 bg-slate-50 p-4 md:p-5">
                      {round.races.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
                          No races have been added to this round yet.
                        </div>
                      ) : (
                        <div className="space-y-5">
                          {racecourseGroups.map((group) => (
                            <section
                              key={group.racecourseId}
                              className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-950 px-4 py-3 text-white">
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-teal-300" />

                                  <h4 className="font-black">
                                    {group.racecourseName}
                                  </h4>

                                  {group.racecourseState && (
                                    <span className="text-sm text-slate-400">
                                      {group.racecourseState}
                                    </span>
                                  )}
                                </div>

                                <span className="text-sm text-slate-300">
                                  {group.races.length}{" "}
                                  {group.races.length === 1 ? "race" : "races"}
                                </span>
                              </div>

                              <div className="divide-y divide-slate-200">
                                {group.races.map((race) => (
                                  <button
                                    type="button"
                                    key={race.id}
                                    onClick={() => setSelectedRaceId(race.id)}
                                    className="grid w-full gap-4 px-4 py-4 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500 sm:grid-cols-[110px_minmax(0,1fr)_120px_120px] sm:items-center"
                                    aria-label={`View results for ${race.race_name}`}
                                  >
                                    <div>
                                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                        Race
                                      </p>
                                      <p className="mt-1 font-black text-slate-950">
                                        R{race.race_number}
                                      </p>
                                    </div>

                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h5 className="font-black text-slate-950">
                                          {race.race_name}
                                        </h5>

                                        <span
                                          className={`rounded-full border px-2.5 py-1 text-xs font-bold ${getGradeClasses(
                                            race.grade
                                          )}`}
                                        >
                                          {getGradeLabel(race.grade)}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 text-sm text-slate-700">
                                      <Clock3 className="h-4 w-4 text-slate-400" />
                                      <span className="font-bold">
                                        {formatTime(race.scheduled_start)}
                                      </span>
                                    </div>

                                    <div className="sm:text-right">
                                      <span
                                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getRaceStatusClasses(
                                          race.status
                                        )}`}
                                      >
                                        {titleCase(race.status)}
                                      </span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </section>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-teal-200 bg-teal-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Flag className="mt-1 h-5 w-5 text-teal-700" />

            <div>
              <h2 className="font-black text-slate-950">
                Ready for the next round?
              </h2>
              <p className="mt-1 text-sm text-slate-700">
                Review the races, research the runners and submit your
                team before lockout.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/horses"
              className="inline-flex items-center gap-2 rounded-lg border border-teal-700 bg-white px-4 py-2.5 text-sm font-bold text-teal-800 transition hover:bg-teal-100"
            >
              <Trophy className="h-4 w-4" />
              Horse Centre
            </Link>

            <Link
              href="/team/edit"
              className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-800"
            >
              Select Team
            </Link>
          </div>
        </section>
      </div>

      {selectedRaceId && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedRaceId(null);
            }
          }}
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Race results"
            className="max-h-[92vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-5xl sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-950 px-5 py-5 text-white sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-300">
                  Race results
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  {raceResultsData?.race
                    ? `R${raceResultsData.race.race_number} — ${raceResultsData.race.race_name}`
                    : "Loading race..."}
                </h2>

                {raceResultsData?.race?.racecourse && (
                  <p className="mt-1 text-sm text-slate-300">
                    {raceResultsData.race.racecourse.name}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedRaceId(null)}
                className="rounded-lg border border-white/20 p-2 transition hover:bg-white/10"
                aria-label="Close race results"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(92vh-96px)] overflow-y-auto p-5 sm:p-6">
              {raceResultsLoading && (
                <div className="py-16 text-center text-slate-500">
                  Loading race results...
                </div>
              )}

              {!raceResultsLoading && raceResultsError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
                  {raceResultsError}
                </div>
              )}

              {!raceResultsLoading &&
                !raceResultsError &&
                raceResultsData?.race && (
                  <>
                    <div className="mb-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-slate-100 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Grade
                        </p>
                        <p className="mt-1 font-black text-slate-950">
                          {getGradeLabel(raceResultsData.race.grade)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-100 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Start time
                        </p>
                        <p className="mt-1 font-black text-slate-950">
                          {formatTime(
                            raceResultsData.race.scheduled_start
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-100 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Status
                        </p>
                        <p className="mt-1 font-black text-slate-950">
                          {titleCase(raceResultsData.race.status)}
                        </p>
                      </div>
                    </div>

                    {(raceResultsData.results ?? []).length === 0 ? (
                      <div className="rounded-xl border border-slate-200 p-8 text-center text-slate-500">
                        No official results are available for this race yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full min-w-[760px] divide-y divide-slate-200">
                          <thead className="bg-slate-100">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                                Finish
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                                Horse
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
                                Points
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
                                Price change
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
                                New price
                              </th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-slate-200">
                            {raceResultsData.results.map((result) => (
                              <tr key={result.result_id}>
                                <td className="px-4 py-4 font-black text-slate-950">
                                  {getFinishLabel(
                                    result.finishing_position,
                                    result.result_status
                                  )}
                                  {result.is_dead_heat ? " (DH)" : ""}
                                </td>

                                <td className="px-4 py-4">
                                  <Link
                                    href={`/horses/${result.horse_id}`}
                                    className="font-bold text-slate-950 hover:text-teal-700"
                                  >
                                    {result.horse_name}
                                  </Link>
                                </td>

                                <td className="px-4 py-4 text-right font-bold text-teal-700">
                                  {result.fantasy_points}
                                </td>

                                <td
                                  className={`px-4 py-4 text-right font-bold ${
                                    result.price_change > 0
                                      ? "text-green-700"
                                      : result.price_change < 0
                                        ? "text-red-700"
                                        : "text-slate-600"
                                  }`}
                                >
                                  {result.price_change > 0 ? "+" : ""}
                                  {formatCurrency(result.price_change)}
                                </td>

                                <td className="px-4 py-4 text-right font-bold text-slate-950">
                                  {formatCurrency(result.price_after)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}