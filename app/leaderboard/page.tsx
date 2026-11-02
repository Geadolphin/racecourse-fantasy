"use client";
import { useEffect, useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSeason } from "@/components/SeasonProvider";
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
  const {
    selectedSeasonId: siteSelectedSeasonId,
    loadingSeasons,
  } = useSeason();

  const [loading, setLoading] = useState(true);
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
       * Use the season selected in the site navbar.
       * Fall back to the first loaded season only if needed.
       */
      const preferredSeason =
        loadedSeasons.find(
          (season) => season.id === siteSelectedSeasonId
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
  }, [siteSelectedSeasonId]);
  useEffect(() => {
    if (loadingSeasons || !siteSelectedSeasonId) {
      return;
    }
    setSelectedSeasonId(siteSelectedSeasonId);
  }, [siteSelectedSeasonId, loadingSeasons]);

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
      <header className="border-b border-cyan-500 bg-gradient-to-r from-cyan-500 via-cyan-500 to-sky-400 text-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/90"><Trophy className="h-4 w-4" /> Racecourse Fantasy</p>
              <h1 className="mt-2 text-3xl font-black">Leaderboard</h1>
              <p className="mt-1 text-sm text-white/90">Round and overall rankings together.</p>
            </div>
            <div className="w-full sm:w-80">
              <label htmlFor="leaderboard-round" className="text-xs font-bold text-white/90">Viewing round</label>
              <select id="leaderboard-round" value={selectedRoundId} onChange={(e) => setSelectedRoundId(e.target.value)} className="mt-1 w-full rounded-lg border border-white/40 bg-white/20 px-3 py-2 text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-white/50">
                {seasonRounds.length ? seasonRounds.map((item) => <option key={item.id} value={item.id} className="text-slate-900">Round {item.round_number}{item.name ? ` — ${item.name}` : ""}</option>) : <option value="" className="text-slate-900">No round results available</option>}
              </select>
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="mb-3">
          <p className="text-xs font-bold uppercase tracking-wider text-sky-600">{selectedSeason?.name ?? "Season"}</p>
          <h2 className="text-xl font-black text-slate-900">{selectedRound ? `Round ${selectedRound.round_number}${selectedRound.name ? ` · ${selectedRound.name}` : ""}` : "Rankings"}</h2>
        </div>
        <LeaderboardTable roundRows={selectedRoundRows} seasonRows={selectedSeasonRows} selectedRoundId={selectedRoundId} />
      </div>
    </main>
  );
}
