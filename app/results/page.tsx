"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "../../lib/supabase";
import RaceCard from "./RaceCard";
import RoundSummary from "./RoundSummary";
import type {
  Race,
  RaceEntry,
  RaceResult,
  TeamSelection,
} from "./types";

type CurrentRound = {
  id: string;
  season_id: string;
  round_number: number;
  name: string | null;
  status: string;
};

type Team = {
  id: string;
  status: string;
};

type ScoreRecord = Record<string, unknown>;

type ResultsPageData = {
  success: boolean;
  message?: string;
  round: CurrentRound | null;
  team: Team | null;
  round_score: ScoreRecord | null;
  season_score: ScoreRecord | null;
  races: Race[];
  entries: RaceEntry[];
  results: RaceResult[];
  selections: TeamSelection[];
};

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

export default function ResultsPage() {
  const router = useRouter();

  const [currentRound, setCurrentRound] =
    useState<CurrentRound | null>(null);

  const [races, setRaces] = useState<Race[]>([]);
  const [entries, setEntries] = useState<RaceEntry[]>([]);
  const [results, setResults] = useState<RaceResult[]>([]);
  const [selections, setSelections] = useState<TeamSelection[]>([]);

  const [roundScoreRecord, setRoundScoreRecord] =
    useState<ScoreRecord | null>(null);

  const [seasonScoreRecord, setSeasonScoreRecord] =
    useState<ScoreRecord | null>(null);

  const [teamStatus, setTeamStatus] = useState<string | null>(null);
  const [expandedRaceIds, setExpandedRaceIds] = useState<Set<string>>(
    new Set()
  );
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadResultsPage() {
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
        "get_results_page_data"
      );

      if (!active) {
        return;
      }

      if (error) {
        console.error("Results page RPC error:", error);
        setErrorMessage(
          error.message || "The results page could not be loaded."
        );
        setLoading(false);
        return;
      }

      const resultsData = data as ResultsPageData | null;

      if (!resultsData?.round) {
        setCurrentRound(null);
        setRaces([]);
        setEntries([]);
        setResults([]);
        setSelections([]);
        setRoundScoreRecord(null);
        setSeasonScoreRecord(null);
        setTeamStatus(null);
        setErrorMessage(
          resultsData?.message ||
            "No rounds are currently available."
        );
        setLoading(false);
        return;
      }

      setCurrentRound(resultsData.round);
      setRaces(resultsData.races ?? []);
      setEntries(resultsData.entries ?? []);
      setResults(resultsData.results ?? []);
      setSelections(resultsData.selections ?? []);
      setRoundScoreRecord(resultsData.round_score);
      setSeasonScoreRecord(resultsData.season_score);
      setTeamStatus(resultsData.team?.status ?? null);

      const loadedRaces = resultsData.races ?? [];
      const firstRelevantRace =
        loadedRaces.find((race) => race.status === "running") ??
        loadedRaces.find((race) => race.status === "official") ??
        loadedRaces[0];

      setExpandedRaceIds(
        firstRelevantRace ? new Set([firstRelevantRace.id]) : new Set()
      );

      setLoading(false);
    }

    void loadResultsPage();

    return () => {
      active = false;
    };
  }, [router]);

  const roundScore = getNumber(roundScoreRecord, [
    "total_points",
    "round_score",
    "total_score",
    "fantasy_points",
    "score",
    "points",
  ]);

  const roundRank = getNumber(roundScoreRecord, [
    "round_rank",
    "rank",
  ]);

  const seasonScore = getNumber(seasonScoreRecord, [
    "total_points",
    "season_score",
    "total_score",
    "fantasy_points",
    "score",
    "points",
  ]);

  const overallRank = getNumber(seasonScoreRecord, [
    "overall_rank",
    "season_rank",
    "rank",
  ]);

  const entriesByRaceId = useMemo(() => {
    const map = new Map<string, RaceEntry[]>();

    for (const entry of entries) {
      const currentEntries = map.get(entry.race_id) ?? [];

      currentEntries.push(entry);
      map.set(entry.race_id, currentEntries);
    }

    return map;
  }, [entries]);

  const resultsByRaceId = useMemo(() => {
    const entryById = new Map(
      entries.map((entry) => [entry.id, entry])
    );

    const map = new Map<string, RaceResult[]>();

    for (const result of results) {
      const entry = entryById.get(result.race_entry_id);

      if (!entry) {
        continue;
      }

      const currentResults = map.get(entry.race_id) ?? [];

      currentResults.push(result);
      map.set(entry.race_id, currentResults);
    }

    return map;
  }, [entries, results]);

  const selectionsByRaceId = useMemo(() => {
    const entryById = new Map(
      entries.map((entry) => [entry.id, entry])
    );

    const map = new Map<string, TeamSelection[]>();

    for (const selection of selections) {
      const entry = entryById.get(selection.race_entry_id);

      if (!entry) {
        continue;
      }

      const currentSelections = map.get(entry.race_id) ?? [];

      currentSelections.push(selection);
      map.set(entry.race_id, currentSelections);
    }

    return map;
  }, [entries, selections]);

  const officialRaceCount = races.filter(
    (race) => race.status === "official"
  ).length;

  function toggleRace(raceId: string) {
    setExpandedRaceIds((current) => {
      const next = new Set(current);

      if (next.has(raceId)) {
        next.delete(raceId);
      } else {
        next.add(raceId);
      }

      return next;
    });
  }

  function expandAllRaces() {
    setExpandedRaceIds(new Set(races.map((race) => race.id)));
  }

  function collapseAllRaces() {
    setExpandedRaceIds(new Set());
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-7xl rounded-xl border bg-white p-10 text-center text-slate-500 shadow-sm">
          Loading results...
        </div>
      </main>
    );
  }

  if (!currentRound) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-4xl rounded-xl border bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900">
            Results
          </h1>

          <p className="mt-4 text-red-700">
            {errorMessage || "No results are currently available."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-teal-300">
                Racecourse Fantasy
              </p>

              <h1 className="mt-2 text-3xl font-bold md:text-4xl">
                Round {currentRound.round_number} Results
              </h1>

              {currentRound.name && (
                <p className="mt-2 text-emerald-100">
                  {currentRound.name}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-teal-600 px-3 py-1 text-sm font-bold">
                  {officialRaceCount} of {races.length} races official
                </span>

                <span className="rounded-full bg-teal-600 px-3 py-1 text-sm font-bold capitalize">
                  Round status: {currentRound.status}
                </span>

                {teamStatus && (
                  <span className="rounded-full bg-amber-400 px-3 py-1 text-sm font-bold capitalize text-emerald-950">
                    Team: {teamStatus}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="rounded-lg border border-teal-500 px-5 py-3 font-bold text-white transition hover:bg-slate-800"
              >
                Dashboard
              </Link>

              <Link
                href="/team"
                className="rounded-lg bg-amber-400 px-5 py-3 font-bold text-emerald-950 transition hover:bg-amber-300"
              >
                My Team
              </Link>
            </div>
          </div>
        </section>

        {errorMessage && (
          <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
            {errorMessage}
          </div>
        )}

        <div className="mt-6">
          <RoundSummary
            roundScore={roundScore}
            roundRank={roundRank}
            seasonScore={seasonScore}
            overallRank={overallRank}
          />
        </div>

        {!teamStatus && (
          <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-900">
            You do not have a team for this round. You can still view
            the full race results, but no runners will be highlighted.
          </div>
        )}

        {races.length === 0 ? (
          <div className="mt-6 rounded-xl border bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              No races available
            </h2>

            <p className="mt-2 text-slate-600">
              No races have been added to this round yet.
            </p>
          </div>
        ) : (
          <div className="mt-6">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Race Results
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Select a race to expand or collapse its full results.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={expandAllRaces}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Expand all
                </button>

                <button
                  type="button"
                  onClick={collapseAllRaces}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Collapse all
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {races.map((race) => {
                const expanded = expandedRaceIds.has(race.id);
                const raceEntries = entriesByRaceId.get(race.id) ?? [];
                const raceResults = resultsByRaceId.get(race.id) ?? [];
                const raceSelections =
                  selectionsByRaceId.get(race.id) ?? [];

                return (
                  <section
                    key={race.id}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => toggleRace(race.id)}
                      className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-slate-50 sm:px-5"
                      aria-expanded={expanded}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="shrink-0 text-slate-500">
                          {expanded ? (
                            <ChevronDown className="h-5 w-5" />
                          ) : (
                            <ChevronRight className="h-5 w-5" />
                          )}
                        </span>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-bold text-slate-950">
                              R{race.race_number} — {race.race_name}
                            </h3>

                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${
                                race.status === "official"
                                  ? "bg-green-100 text-green-800"
                                  : race.status === "running"
                                    ? "bg-amber-100 text-amber-800"
                                    : race.status === "cancelled" ||
                                        race.status === "abandoned"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {race.status}
                            </span>
                          </div>

                          <p className="mt-1 text-xs text-slate-500">
                            {raceResults.length} results
                            {raceSelections.length > 0
                              ? ` · ${raceSelections.length} selected runner${
                                  raceSelections.length === 1 ? "" : "s"
                                }`
                              : ""}
                          </p>
                        </div>
                      </div>

                      <span className="shrink-0 text-xs font-semibold text-slate-500">
                        {expanded ? "Hide" : "View"}
                      </span>
                    </button>

                    {expanded && (
                      <div className="border-t border-slate-200">
                        <RaceCard
                          race={race}
                          entries={raceEntries}
                          results={raceResults}
                          selections={raceSelections}
                        />
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}