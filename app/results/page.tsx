"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
          <div className="mt-6 space-y-6">
            {races.map((race) => (
              <RaceCard
                key={race.id}
                race={race}
                entries={entriesByRaceId.get(race.id) ?? []}
                results={resultsByRaceId.get(race.id) ?? []}
                selections={
                  selectionsByRaceId.get(race.id) ?? []
                }
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}