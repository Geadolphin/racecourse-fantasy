"use client";

import { useEffect, useMemo, useState } from "react";
import { Trophy } from "lucide-react";

import { supabase } from "@/lib/supabase";

import LeaderboardTable from "./LeaderboardTable";

import type {
  RoundLeaderboardRow,
  SeasonLeaderboardRow,
} from "./types";

type LeaderboardData = {
  success?: boolean;
  round_leaderboard?: RoundLeaderboardRow[];
  season_leaderboard?: SeasonLeaderboardRow[];
};

type RoundOption = {
  id: string;
  season_id: string;
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

  const [tab, setTab] =
    useState<"round" | "season">("round");

  const [rounds, setRounds] =
    useState<RoundOption[]>([]);

  const [selectedRoundId, setSelectedRoundId] =
    useState("");

  const [seasons, setSeasons] =
    useState<SeasonOption[]>([]);

  const [selectedSeasonId, setSelectedSeasonId] =
    useState("");

  const [
    roundLeaderboard,
    setRoundLeaderboard,
  ] = useState<RoundLeaderboardRow[]>([]);

  const [
    seasonLeaderboard,
    setSeasonLeaderboard,
  ] = useState<SeasonLeaderboardRow[]>([]);

  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadLeaderboard() {
      setLoading(true);
      setError("");

      const [
        {
          data: leaderboardDataRaw,
          error: rpcError,
        },
        {
          data: roundsData,
          error: roundsError,
        },
        {
          data: seasonsData,
          error: seasonsError,
        },
      ] = await Promise.all([
        supabase.rpc("get_leaderboard_data"),

        supabase
          .from("rounds")
          .select(
            "id, season_id, round_number, name, status"
          )
          .order("round_number", {
            ascending: false,
          }),

        supabase
          .from("seasons")
          .select(
            "id, name, year, is_active"
          )
          .order("year", {
            ascending: false,
          }),
      ]);

      if (!active) {
        return;
      }

      if (
        rpcError ||
        roundsError ||
        seasonsError
      ) {
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
        leaderboardDataRaw as
          | LeaderboardData
          | null
          | undefined;

      /*
       * Defensive array checks.
       *
       * Even if the RPC response is incomplete during
       * prerendering, these will always resolve to arrays.
       */
      const loadedRoundLeaderboard:
        RoundLeaderboardRow[] =
        Array.isArray(
          leaderboardData?.round_leaderboard
        )
          ? leaderboardData.round_leaderboard
          : [];

      const loadedSeasonLeaderboard:
        SeasonLeaderboardRow[] =
        Array.isArray(
          leaderboardData?.season_leaderboard
        )
          ? leaderboardData.season_leaderboard
          : [];

      const safeRoundsData:
        RoundOption[] =
        Array.isArray(roundsData)
          ? (roundsData as RoundOption[])
          : [];

      const safeSeasonsData:
        SeasonOption[] =
        Array.isArray(seasonsData)
          ? (seasonsData as SeasonOption[])
          : [];

      const leaderboardRoundIds =
        new Set(
          loadedRoundLeaderboard
            .map((row) => row?.round_id)
            .filter(
              (roundId): roundId is string =>
                typeof roundId === "string" &&
                roundId.length > 0
            )
        );

      /*
       * Only show rounds that currently have
       * leaderboard rows.
       *
       * This prevents empty future rounds
       * appearing in the selector.
       */
      const availableRounds =
        safeRoundsData.filter((round) =>
          leaderboardRoundIds.has(round.id)
        );

      setRounds(availableRounds);

      setRoundLeaderboard(
        loadedRoundLeaderboard
      );

      setSeasonLeaderboard(
        loadedSeasonLeaderboard
      );

      const loadedSeasons =
        safeSeasonsData;

      setSeasons(loadedSeasons);

      /*
       * Prefer active season.
       * Otherwise use most recent season.
       */
      const preferredSeason =
        loadedSeasons.find(
          (season) => season.is_active
        ) ?? loadedSeasons[0];

      const preferredSeasonId =
        preferredSeason?.id ?? "";

      setSelectedSeasonId(
        preferredSeasonId
      );

      /*
       * Prefer current open/locked round
       * within the selected season.
       */
      const seasonRounds =
        availableRounds.filter(
          (round) =>
            round.season_id ===
            preferredSeasonId
        );

      const preferredRound =
        seasonRounds.find((round) =>
          ["open", "locked"].includes(
            round.status
          )
        ) ?? seasonRounds[0];

      setSelectedRoundId(
        preferredRound?.id ?? ""
      );

      setLoading(false);
    }

    void loadLeaderboard();

    return () => {
      active = false;
    };
  }, []);

  /*
   * All rounds for the selected season.
   */
  const seasonRounds = useMemo(() => {
    if (!selectedSeasonId) {
      return [];
    }

    const safeRounds =
      Array.isArray(rounds)
        ? rounds
        : [];

    return safeRounds.filter(
      (round) =>
        round.season_id ===
        selectedSeasonId
    );
  }, [rounds, selectedSeasonId]);

  /*
   * If the user changes season,
   * ensure the selected round belongs
   * to that season.
   */
  useEffect(() => {
    if (
      !selectedSeasonId ||
      !Array.isArray(seasonRounds) ||
      seasonRounds.length === 0
    ) {
      setSelectedRoundId("");
      return;
    }

    const currentRoundStillValid =
      seasonRounds.some(
        (round) =>
          round.id === selectedRoundId
      );

    if (currentRoundStillValid) {
      return;
    }

    const preferredRound =
      seasonRounds.find((round) =>
        ["open", "locked"].includes(
          round.status
        )
      ) ?? seasonRounds[0];

    setSelectedRoundId(
      preferredRound?.id ?? ""
    );
  }, [
    selectedSeasonId,
    seasonRounds,
    selectedRoundId,
  ]);

  /*
   * Current round metadata.
   */
  const selectedRound = useMemo(() => {
    if (!Array.isArray(seasonRounds)) {
      return undefined;
    }

    return seasonRounds.find(
      (round) =>
        round.id === selectedRoundId
    );
  }, [
    seasonRounds,
    selectedRoundId,
  ]);

  /*
   * Round leaderboard rows.
   */
  const selectedRoundRows =
    useMemo<RoundLeaderboardRow[]>(
      () => {
        if (!selectedRoundId) {
          return [];
        }

        const safeRoundLeaderboard =
          Array.isArray(
            roundLeaderboard
          )
            ? roundLeaderboard
            : [];

        return safeRoundLeaderboard
          .filter(
            (row) =>
              row?.round_id ===
              selectedRoundId
          )
          .sort(
            (a, b) =>
              Number(
                a?.round_rank ?? 999999
              ) -
              Number(
                b?.round_rank ?? 999999
              )
          );
      },
      [
        roundLeaderboard,
        selectedRoundId,
      ]
    );

  /*
   * Current season metadata.
   */
  const selectedSeason =
    useMemo(() => {
      const safeSeasons =
        Array.isArray(seasons)
          ? seasons
          : [];

      return safeSeasons.find(
        (season) =>
          season.id ===
          selectedSeasonId
      );
    }, [
      seasons,
      selectedSeasonId,
    ]);

  /*
   * Season leaderboard rows.
   */
  const selectedSeasonRows =
    useMemo<SeasonLeaderboardRow[]>(
      () => {
        if (!selectedSeasonId) {
          return [];
        }

        const safeSeasonLeaderboard =
          Array.isArray(
            seasonLeaderboard
          )
            ? seasonLeaderboard
            : [];

        return safeSeasonLeaderboard
          .filter(
            (row) =>
              row?.season_id ===
              selectedSeasonId
          )
          .sort(
            (a, b) =>
              Number(
                a?.overall_rank ?? 999999
              ) -
              Number(
                b?.overall_rank ?? 999999
              )
          );
      },
      [
        seasonLeaderboard,
        selectedSeasonId,
      ]
    );

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
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-10">
        <header className="mb-7 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-lg">
          <div className="border-b border-slate-800 px-6 py-4 md:px-8">
            <div className="flex items-center gap-2 text-teal-300">
              <Trophy className="h-5 w-5" />

              <p className="text-xs font-black uppercase tracking-[0.22em]">
                Racecourse Fantasy
              </p>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-300">
              Official Rankings
            </p>

            <h1 className="mt-2 text-4xl font-black tracking-tight md:text-5xl">
              Leaderboard
            </h1>

            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
              See how your team ranks
              against the Racecourse
              Fantasy field across each
              round and the full season.
            </p>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4 font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="mb-6 inline-flex overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
          <button
            type="button"
            onClick={() =>
              setTab("round")
            }
            className={`px-6 py-3 text-sm font-black transition ${
              tab === "round"
                ? "bg-slate-950 text-teal-300"
                : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Round Rankings
          </button>

          <button
            type="button"
            onClick={() =>
              setTab("season")
            }
            className={`border-l border-slate-300 px-6 py-3 text-sm font-black transition ${
              tab === "season"
                ? "bg-slate-950 text-teal-300"
                : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Season Rankings
          </button>
        </div>

        {tab === "round" ? (
          <>
            <section className="mb-6 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
              <div className="border-b border-slate-800 bg-slate-950 px-5 py-3 text-white">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-300">
                  Round Competition
                </p>
              </div>

              <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
                <div>
                  <label
                    htmlFor="leaderboard-round-season"
                    className="block text-xs font-black uppercase tracking-wide text-slate-600"
                  >
                    Select season
                  </label>

                  <select
                    id="leaderboard-round-season"
                    value={
                      selectedSeasonId
                    }
                    onChange={(event) =>
                      setSelectedSeasonId(
                        event.target.value
                      )
                    }
                    disabled={
                      !Array.isArray(
                        seasons
                      ) ||
                      seasons.length === 0
                    }
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    {!Array.isArray(
                      seasons
                    ) ||
                    seasons.length ===
                      0 ? (
                      <option value="">
                        No seasons available
                      </option>
                    ) : (
                      seasons.map(
                        (season) => (
                          <option
                            key={
                              season.id
                            }
                            value={
                              season.id
                            }
                          >
                            {
                              season.name
                            }{" "}
                            {
                              season.year
                            }
                            {season.is_active
                              ? " — Active"
                              : ""}
                          </option>
                        )
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="leaderboard-round"
                    className="block text-xs font-black uppercase tracking-wide text-slate-600"
                  >
                    Select round
                  </label>

                  <select
                    id="leaderboard-round"
                    value={
                      selectedRoundId
                    }
                    onChange={(event) =>
                      setSelectedRoundId(
                        event.target.value
                      )
                    }
                    disabled={
                      !Array.isArray(
                        seasonRounds
                      ) ||
                      seasonRounds.length ===
                        0
                    }
                    className="mt-2 min-w-64 rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    {!Array.isArray(
                      seasonRounds
                    ) ||
                    seasonRounds.length ===
                      0 ? (
                      <option value="">
                        No round results
                        available
                      </option>
                    ) : (
                      seasonRounds.map(
                        (round) => (
                          <option
                            key={
                              round.id
                            }
                            value={
                              round.id
                            }
                          >
                            Round{" "}
                            {
                              round.round_number
                            }
                            {round.name
                              ? ` — ${round.name}`
                              : ""}
                          </option>
                        )
                      )
                    )}
                  </select>
                </div>

                {selectedRound && (
                  <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200 lg:text-right">
                    <p className="font-semibold text-slate-900">
                      Round{" "}
                      {
                        selectedRound.round_number
                      }
                      {selectedRound.name
                        ? ` — ${selectedRound.name}`
                        : ""}
                    </p>

                    <p className="mt-1">
                      {selectedRoundRows?.length ??
                        0}{" "}
                      {(selectedRoundRows?.length ??
                        0) === 1
                        ? "team"
                        : "teams"}
                    </p>
                  </div>
                )}
              </div>
            </section>

            <LeaderboardTable
              type="round"
              rows={
                selectedRoundRows ??
                []
              }
            />
          </>
        ) : (
          <>
            <section className="mb-6 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
              <div className="border-b border-slate-800 bg-slate-950 px-5 py-3 text-white">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-300">
                  Season Competition
                </p>
              </div>

              <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <label
                    htmlFor="leaderboard-season"
                    className="block text-xs font-black uppercase tracking-wide text-slate-600"
                  >
                    Select season
                  </label>

                  <select
                    id="leaderboard-season"
                    value={
                      selectedSeasonId
                    }
                    onChange={(event) =>
                      setSelectedSeasonId(
                        event.target.value
                      )
                    }
                    disabled={
                      !Array.isArray(
                        seasons
                      ) ||
                      seasons.length === 0
                    }
                    className="mt-2 min-w-64 rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    {!Array.isArray(
                      seasons
                    ) ||
                    seasons.length ===
                      0 ? (
                      <option value="">
                        No seasons available
                      </option>
                    ) : (
                      seasons.map(
                        (season) => (
                          <option
                            key={
                              season.id
                            }
                            value={
                              season.id
                            }
                          >
                            {
                              season.name
                            }{" "}
                            {
                              season.year
                            }
                            {season.is_active
                              ? " — Active"
                              : ""}
                          </option>
                        )
                      )
                    )}
                  </select>
                </div>

                {selectedSeason && (
                  <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200 sm:text-right">
                    <p className="font-semibold text-slate-900">
                      {
                        selectedSeason.name
                      }{" "}
                      {
                        selectedSeason.year
                      }
                      {selectedSeason.is_active
                        ? " — Active"
                        : ""}
                    </p>

                    <p className="mt-1">
                      {selectedSeasonRows?.length ??
                        0}{" "}
                      {(selectedSeasonRows?.length ??
                        0) === 1
                        ? "team"
                        : "teams"}
                    </p>
                  </div>
                )}
              </div>
            </section>

            <LeaderboardTable
              type="season"
              rows={
                selectedSeasonRows ??
                []
              }
            />
          </>
        )}
      </div>
    </main>
  );
}