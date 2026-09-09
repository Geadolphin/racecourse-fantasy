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
      <main className="min-h-screen bg-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center font-semibold text-slate-500 shadow-sm">
            Loading leaderboard...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 pb-10">
      {/* Full-width branded hero */}
      <header className="overflow-hidden border-b border-sky-300 bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-500 text-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 md:py-9">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-white/90">
                <Trophy className="h-5 w-5" />
                <p className="text-xs font-black uppercase tracking-[0.22em]">
                  Racecourse Fantasy
                </p>
              </div>

              <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-white/80">
                Official Rankings
              </p>

              <h1 className="mt-1 text-4xl font-black tracking-tight md:text-5xl">
                Leaderboard
              </h1>

              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-white/90 sm:text-base">
                See how your team ranks across each round and the full season.
              </p>
            </div>

            <div className="w-full rounded-xl border border-white/30 bg-white/15 px-4 py-3 shadow-sm backdrop-blur-md md:w-auto md:min-w-[320px]">
              <label
                htmlFor="leaderboard-viewing"
                className="text-[10px] font-black uppercase tracking-[0.16em] text-white/75"
              >
                Viewing
              </label>

              <select
                id="leaderboard-viewing"
                value={
                  tab === "round"
                    ? selectedRoundId
                    : selectedSeasonId
                }
                onChange={(event) => {
                  if (tab === "round") {
                    setSelectedRoundId(event.target.value);
                  } else {
                    setSelectedSeasonId(event.target.value);
                  }
                }}
                className="mt-1.5 w-full rounded-lg border border-white/30 bg-white/15 px-3 py-2.5 text-sm font-black text-white outline-none backdrop-blur-md focus:border-white/60 focus:ring-2 focus:ring-white/20"
              >
                {tab === "round" ? (
                  seasonRounds.length > 0 ? (
                    seasonRounds.map((round) => (
                      <option
                        key={round.id}
                        value={round.id}
                        className="text-slate-950"
                      >
                        Round {round.round_number}
                        {round.name ? ` — ${round.name}` : ""}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled className="text-slate-950">
                      No round results available
                    </option>
                  )
                ) : seasons.length > 0 ? (
                  seasons.map((season) => (
                    <option
                      key={season.id}
                      value={season.id}
                      className="text-slate-950"
                    >
                      {season.name} {season.year}
                      {season.is_active ? " — Active" : ""}
                    </option>
                  ))
                ) : (
                  <option value="" disabled className="text-slate-950">
                    No seasons available
                  </option>
                )}
              </select>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4 font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Round / Overall switch */}
        <div className="mb-5 grid max-w-md grid-cols-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setTab("round")}
            className={`rounded-lg px-4 py-2.5 text-sm font-black transition ${
              tab === "round"
                ? "bg-gradient-to-r from-cyan-500 to-sky-500 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            Round
          </button>

          <button
            type="button"
            onClick={() => setTab("season")}
            className={`rounded-lg px-4 py-2.5 text-sm font-black transition ${
              tab === "season"
                ? "bg-gradient-to-r from-cyan-500 to-sky-500 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            Overall
          </button>
        </div>

        {/* Stronger context heading */}
        <div className="mb-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-600">
            {tab === "round" ? "Round Competition" : "Season Competition"}
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
            {tab === "round"
              ? selectedRound
                ? `Round ${selectedRound.round_number}${selectedRound.name ? ` · ${selectedRound.name}` : ""}`
                : "Round Rankings"
              : selectedSeason
                ? `${selectedSeason.name} ${selectedSeason.year}`
                : "Season Rankings"}
          </h2>
        </div>

        <LeaderboardTable
          type={tab}
          rows={
            tab === "round"
              ? selectedRoundRows ?? []
              : selectedSeasonRows ?? []
          }
        />
      </div>
    </main>
  );
}
