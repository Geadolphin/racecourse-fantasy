"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

import LeaderboardTable from "./LeaderboardTable";
import type {
  RoundLeaderboardRow,
  SeasonLeaderboardRow,
} from "./types";

type LeaderboardData = {
  success: boolean;
  round_leaderboard: RoundLeaderboardRow[];
  season_leaderboard: SeasonLeaderboardRow[];
};

type RoundOption = {
  id: string;
  round_number: number;
  name: string | null;
  status: string;
};

type SeasonOption = {
  id: string;
  name: string;
  year: number;
  is_active: boolean;
};

export default function LeaderboardPage() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"round" | "season">("round");

  const [rounds, setRounds] = useState<RoundOption[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState("");

  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState("");

  const [roundLeaderboard, setRoundLeaderboard] = useState<
    RoundLeaderboardRow[]
  >([]);

  const [seasonLeaderboard, setSeasonLeaderboard] = useState<
    SeasonLeaderboardRow[]
  >([]);

  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadLeaderboard() {
      setLoading(true);
      setError("");

      const [
        { data: leaderboardDataRaw, error: rpcError },
        { data: roundsData, error: roundsError },
        { data: seasonsData, error: seasonsError },
      ] = await Promise.all([
        supabase.rpc("get_leaderboard_data"),

        supabase
          .from("rounds")
          .select("id, round_number, name, status")
          .order("round_number", { ascending: false }),

        supabase
          .from("seasons")
          .select("id, name, year, is_active")
          .order("year", { ascending: false }),
      ]);

      if (!active) {
        return;
      }

      if (rpcError || roundsError || seasonsError) {
        console.error({
          leaderboardError: rpcError,
          roundsError,
          seasonsError,
        });

        setError(
          rpcError?.message ||
            roundsError?.message ||
            seasonsError?.message ||
            "Unable to load leaderboard."
        );

        setRounds([]);
        setSelectedRoundId("");
        setSeasons([]);
        setSelectedSeasonId("");
        setRoundLeaderboard([]);
        setSeasonLeaderboard([]);
        setLoading(false);
        return;
      }

      const leaderboardData =
        leaderboardDataRaw as LeaderboardData | null;

      const loadedRoundLeaderboard =
        leaderboardData?.round_leaderboard ?? [];

      const loadedSeasonLeaderboard =
        leaderboardData?.season_leaderboard ?? [];

      const leaderboardRoundIds = new Set(
        loadedRoundLeaderboard.map((row) => row.round_id)
      );

      /*
       * Only show rounds that currently have leaderboard rows.
       * This prevents empty future rounds appearing in the selector.
       */
      const availableRounds = (
        (roundsData ?? []) as RoundOption[]
      ).filter((round) => leaderboardRoundIds.has(round.id));

      setRounds(availableRounds);
      setRoundLeaderboard(loadedRoundLeaderboard);
      setSeasonLeaderboard(loadedSeasonLeaderboard);

      /*
       * Open the active round when possible. Otherwise, use the
       * highest round number that already has leaderboard data.
       */
      const preferredRound =
        availableRounds.find((round) =>
          ["open", "locked"].includes(round.status)
        ) ?? availableRounds[0];

      setSelectedRoundId(preferredRound?.id ?? "");

      const loadedSeasons = (seasonsData ?? []) as SeasonOption[];
      setSeasons(loadedSeasons);

      const preferredSeason =
        loadedSeasons.find((season) => season.is_active) ??
        loadedSeasons[0];

      setSelectedSeasonId(preferredSeason?.id ?? "");
      setLoading(false);
    }

    void loadLeaderboard();

    return () => {
      active = false;
    };
  }, []);

  const selectedRound = useMemo(() => {
    return rounds.find(
      (round) => round.id === selectedRoundId
    );
  }, [rounds, selectedRoundId]);

  const selectedRoundRows = useMemo(() => {
    if (!selectedRoundId) {
      return [];
    }

    return roundLeaderboard
      .filter((row) => row.round_id === selectedRoundId)
      .sort((a, b) => a.round_rank - b.round_rank);
  }, [roundLeaderboard, selectedRoundId]);

  const selectedSeason = useMemo(() => {
    return seasons.find(
      (season) => season.id === selectedSeasonId
    );
  }, [seasons, selectedSeasonId]);

  const selectedSeasonRows = useMemo(() => {
    if (!selectedSeasonId) {
      return [];
    }

    return seasonLeaderboard
      .filter((row) => row.season_id === selectedSeasonId)
      .sort((a, b) => a.overall_rank - b.overall_rank);
  }, [seasonLeaderboard, selectedSeasonId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-6xl rounded-xl bg-white p-10 text-center">
          Loading leaderboard...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-xl bg-teal-700 p-6 text-white">
          <h1 className="text-3xl font-bold">
            Leaderboard
          </h1>

          <p className="mt-2 text-teal-100">
            See how your team compares against everyone else.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        <div className="mb-6 flex gap-3">
          <button
            type="button"
            onClick={() => setTab("round")}
            className={`rounded-lg px-5 py-3 font-semibold ${
              tab === "round"
                ? "bg-teal-700 text-white"
                : "border bg-white"
            }`}
          >
            Round
          </button>

          <button
            type="button"
            onClick={() => setTab("season")}
            className={`rounded-lg px-5 py-3 font-semibold ${
              tab === "season"
                ? "bg-teal-700 text-white"
                : "border bg-white"
            }`}
          >
            Season
          </button>
        </div>

        {tab === "round" ? (
          <>
            <section className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <label
                    htmlFor="leaderboard-round"
                    className="block text-sm font-bold text-slate-800"
                  >
                    Select round
                  </label>

                  <select
                    id="leaderboard-round"
                    value={selectedRoundId}
                    onChange={(event) =>
                      setSelectedRoundId(event.target.value)
                    }
                    disabled={rounds.length === 0}
                    className="mt-2 min-w-64 rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    {rounds.length === 0 ? (
                      <option value="">
                        No round results available
                      </option>
                    ) : (
                      rounds.map((round) => (
                        <option
                          key={round.id}
                          value={round.id}
                        >
                          Round {round.round_number}
                          {round.name
                            ? ` — ${round.name}`
                            : ""}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {selectedRound && (
                  <div className="text-sm text-slate-600 sm:text-right">
                    <p className="font-semibold text-slate-900">
                      Round {selectedRound.round_number}
                      {selectedRound.name
                        ? ` — ${selectedRound.name}`
                        : ""}
                    </p>

                    <p className="mt-1">
                      {selectedRoundRows.length}{" "}
                      {selectedRoundRows.length === 1
                        ? "team"
                        : "teams"}
                    </p>
                  </div>
                )}
              </div>
            </section>

            <LeaderboardTable
              type="round"
              rows={selectedRoundRows}
            />
          </>
        ) : (
          <>
            <section className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <label
                    htmlFor="leaderboard-season"
                    className="block text-sm font-bold text-slate-800"
                  >
                    Select season
                  </label>

                  <select
                    id="leaderboard-season"
                    value={selectedSeasonId}
                    onChange={(event) =>
                      setSelectedSeasonId(event.target.value)
                    }
                    disabled={seasons.length === 0}
                    className="mt-2 min-w-64 rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    {seasons.length === 0 ? (
                      <option value="">
                        No seasons available
                      </option>
                    ) : (
                      seasons.map((season) => (
                        <option
                          key={season.id}
                          value={season.id}
                        >
                          {season.name} {season.year}
                          {season.is_active
                            ? " — Active"
                            : ""}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {selectedSeason && (
                  <div className="text-sm text-slate-600 sm:text-right">
                    <p className="font-semibold text-slate-900">
                      {selectedSeason.name} {selectedSeason.year}
                      {selectedSeason.is_active
                        ? " — Active"
                        : ""}
                    </p>

                    <p className="mt-1">
                      {selectedSeasonRows.length}{" "}
                      {selectedSeasonRows.length === 1
                        ? "team"
                        : "teams"}
                    </p>
                  </div>
                )}
              </div>
            </section>

            <LeaderboardTable
              type="season"
              rows={selectedSeasonRows}
            />
          </>
        )}
      </div>
    </main>
  );
}