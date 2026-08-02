"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowDownRight,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  BarChart3,
  Crown,
  Flag,
  Trophy,
  Users,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type SeasonSummary = {
  rounds: number;
  completed_rounds: number;
  races: number;
  official_races: number;
  players: number;
  highest_round_score: number;
};

type HorseLeader = {
  horse_id: string;
  horse_name: string;
  current_price: number;
  season_points: number;
  eligible_starts: number;
  average_points: number;
};

type PlayerLeader = {
  user_id: string;
  display_name: string;
  total_points: number;
  overall_rank: number | null;
  rounds_played: number;
  round_wins: number;
  highest_round_score: number;
  top_ten_finishes: number;
};

type SelectionLeader = {
  horse_id: string;
  horse_name: string;
  selection_count?: number;
  captain_count?: number;
  ownership_percentage?: number;
  captain_percentage?: number;
};

type OwnershipRound = {
  id: string;
  round_number: number;
  name: string | null;
  round_date: string | null;
  status: string;
};

type PriceLeader = {
  horse_id: string;
  horse_name: string;
  total_change: number;
  current_price: number;
};

type StatsData = {
  success: boolean;
  message?: string;
  season: {
    id: string;
    name: string;
  } | null;
  season_summary: SeasonSummary | null;
  ownership_rounds: OwnershipRound[];
  selected_round_id: string | null;
  selected_round: OwnershipRound | null;
  total_teams_in_round: number;
  horse_leaders: HorseLeader[];
  player_leaders: PlayerLeader[];
  most_selected: SelectionLeader[];
  most_captained: SelectionLeader[];
  price_risers: PriceLeader[];
  price_fallers: PriceLeader[];
};

type Tab = "horses" | "players" | "ownership" | "prices";

type SortDirection = "asc" | "desc";

type HorseSortKey =
  | "horse_name"
  | "season_points"
  | "eligible_starts"
  | "average_points"
  | "current_price";

type PlayerSortKey =
  | "overall_rank"
  | "display_name"
  | "total_points"
  | "rounds_played"
  | "round_wins"
  | "top_ten_finishes"
  | "highest_round_score";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatSignedCurrency(value: number) {
  const formatted = formatCurrency(Math.abs(value));

  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

function rankDisplay(rank: number | null, index: number) {
  const resolvedRank = rank ?? index + 1;

  if (resolvedRank === 1) return "🥇";
  if (resolvedRank === 2) return "🥈";
  if (resolvedRank === 3) return "🥉";

  return `#${resolvedRank}`;
}

export default function StatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("horses");
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [loading, setLoading] = useState(true);
  const [ownershipLoading, setOwnershipLoading] = useState(false);

  const [horseSortKey, setHorseSortKey] =
    useState<HorseSortKey>("season_points");
  const [horseSortDirection, setHorseSortDirection] =
    useState<SortDirection>("desc");

  const [playerSortKey, setPlayerSortKey] =
    useState<PlayerSortKey>("overall_rank");
  const [playerSortDirection, setPlayerSortDirection] =
    useState<SortDirection>("asc");

  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadInitialStats() {
      setLoading(true);
      setErrorMessage("");

      const { data: statsData, error } = await supabase.rpc(
        "get_stats_page_data",
        {
          p_round_id: null,
        }
      );

      if (!active) return;

      if (error) {
        console.error("Stats page RPC error:", error);
        setErrorMessage(
          error.message || "The Stats Centre could not be loaded."
        );
        setData(null);
        setLoading(false);
        return;
      }

      const loadedData = statsData as unknown as StatsData;

      setData(loadedData);
      setSelectedRoundId(loadedData.selected_round_id ?? "");
      setLoading(false);
    }

    void loadInitialStats();

    return () => {
      active = false;
    };
  }, []);

  async function changeOwnershipRound(roundId: string) {
    setSelectedRoundId(roundId);
    setOwnershipLoading(true);
    setErrorMessage("");

    const { data: statsData, error } = await supabase.rpc(
      "get_stats_page_data",
      {
        p_round_id: roundId || null,
      }
    );

    if (error) {
      console.error("Ownership round RPC error:", error);
      setErrorMessage(
        error.message || "The ownership statistics could not be loaded."
      );
      setOwnershipLoading(false);
      return;
    }

    const loadedData = statsData as unknown as StatsData;

    setData(loadedData);
    setSelectedRoundId(loadedData.selected_round_id ?? roundId);
    setOwnershipLoading(false);
  }

  const sortedHorseLeaders = useMemo(() => {
    const rows = [...(data?.horse_leaders ?? [])];

    rows.sort((a, b) => {
      let comparison = 0;

      switch (horseSortKey) {
        case "horse_name":
          comparison = a.horse_name.localeCompare(b.horse_name);
          break;

        case "season_points":
          comparison = a.season_points - b.season_points;
          break;

        case "eligible_starts":
          comparison = a.eligible_starts - b.eligible_starts;
          break;

        case "average_points":
          comparison =
            Number(a.average_points) - Number(b.average_points);
          break;

        case "current_price":
          comparison = a.current_price - b.current_price;
          break;
      }

      if (comparison === 0) {
        comparison = a.horse_name.localeCompare(b.horse_name);
      }

      return horseSortDirection === "asc"
        ? comparison
        : -comparison;
    });

    return rows;
  }, [data, horseSortDirection, horseSortKey]);

  const sortedPlayerLeaders = useMemo(() => {
    const rows = [...(data?.player_leaders ?? [])];

    rows.sort((a, b) => {
      let comparison = 0;

      switch (playerSortKey) {
        case "overall_rank": {
          const rankA = a.overall_rank ?? Number.MAX_SAFE_INTEGER;
          const rankB = b.overall_rank ?? Number.MAX_SAFE_INTEGER;
          comparison = rankA - rankB;
          break;
        }

        case "display_name":
          comparison = a.display_name.localeCompare(b.display_name);
          break;

        case "total_points":
          comparison = a.total_points - b.total_points;
          break;

        case "rounds_played":
          comparison = a.rounds_played - b.rounds_played;
          break;

        case "round_wins":
          comparison = a.round_wins - b.round_wins;
          break;

        case "top_ten_finishes":
          comparison =
            a.top_ten_finishes - b.top_ten_finishes;
          break;

        case "highest_round_score":
          comparison =
            a.highest_round_score - b.highest_round_score;
          break;
      }

      if (comparison === 0) {
        comparison = a.display_name.localeCompare(b.display_name);
      }

      return playerSortDirection === "asc"
        ? comparison
        : -comparison;
    });

    return rows;
  }, [data, playerSortDirection, playerSortKey]);

  function changeHorseSort(nextKey: HorseSortKey) {
    if (horseSortKey === nextKey) {
      setHorseSortDirection((current) =>
        current === "asc" ? "desc" : "asc"
      );
      return;
    }

    setHorseSortKey(nextKey);
    setHorseSortDirection(
      nextKey === "horse_name" ? "asc" : "desc"
    );
  }

  function changePlayerSort(nextKey: PlayerSortKey) {
    if (playerSortKey === nextKey) {
      setPlayerSortDirection((current) =>
        current === "asc" ? "desc" : "asc"
      );
      return;
    }

    setPlayerSortKey(nextKey);
    setPlayerSortDirection(
      nextKey === "overall_rank" ||
        nextKey === "display_name"
        ? "asc"
        : "desc"
    );
  }

  function sortIcon(
    active: boolean,
    direction: SortDirection
  ) {
    if (!active) {
      return <ArrowUpDown className="h-4 w-4 text-slate-400" />;
    }

    return direction === "asc" ? (
      <ArrowUp className="h-4 w-4 text-teal-700" />
    ) : (
      <ArrowDown className="h-4 w-4 text-teal-700" />
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-7xl rounded-xl border bg-white p-10 text-center text-slate-500">
          Loading Stats Centre...
        </div>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 md:p-8">
        <div className="mx-auto max-w-4xl rounded-xl border bg-white p-8">
          <h1 className="text-3xl font-black text-slate-950">
            Stats Centre
          </h1>

          <p className="mt-4 text-red-700">{errorMessage}</p>
        </div>
      </main>
    );
  }

  if (!data?.season || !data.season_summary) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 md:p-8">
        <div className="mx-auto max-w-4xl rounded-xl border bg-white p-8 text-center">
          <h1 className="text-3xl font-black text-slate-950">
            Stats Centre
          </h1>

          <p className="mt-4 text-slate-600">
            {data?.message || "No season statistics are available yet."}
          </p>
        </div>
      </main>
    );
  }

  const summary = data.season_summary;

  const tabs: { id: Tab; label: string }[] = [
    { id: "horses", label: "Horse Leaders" },
    { id: "players", label: "Player Leaders" },
    { id: "ownership", label: "Ownership" },
    { id: "prices", label: "Price Movers" },
  ];

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-2xl bg-slate-950 p-6 text-white shadow-sm md:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-300">
            {data.season.name}
          </p>

          <h1 className="mt-2 text-3xl font-black md:text-4xl">
            Stats Centre
          </h1>

          <p className="mt-3 max-w-2xl text-slate-300">
            Explore the season's leading horses, managers, ownership
            trends and biggest price movements.
          </p>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Flag className="h-5 w-5 text-teal-700" />
              <p className="text-sm font-bold text-slate-700">
                Completed Rounds
              </p>
            </div>
            <p className="mt-3 text-3xl font-black text-slate-950">
              {summary.completed_rounds} / {summary.rounds}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-teal-700" />
              <p className="text-sm font-bold text-slate-700">
                Official Races
              </p>
            </div>
            <p className="mt-3 text-3xl font-black text-slate-950">
              {summary.official_races} / {summary.races}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-teal-700" />
              <p className="text-sm font-bold text-slate-700">
                Players
              </p>
            </div>
            <p className="mt-3 text-3xl font-black text-slate-950">
              {summary.players}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-teal-700" />
              <p className="text-sm font-bold text-slate-700">
                Highest Round
              </p>
            </div>
            <p className="mt-3 text-3xl font-black text-slate-950">
              {summary.highest_round_score}
            </p>
          </div>
        </section>

        <div className="mt-6 overflow-x-auto rounded-xl border bg-white p-2 shadow-sm">
          <div className="flex min-w-max gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${
                  activeTab === tab.id
                    ? "bg-slate-950 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "horses" && (
          <section className="mt-5 overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="border-b bg-slate-50 px-5 py-4">
              <h2 className="text-xl font-black text-slate-950">
                Horse Leaders
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Official fantasy performance during the current season.
              </p>
            </div>

            {(data.horse_leaders ?? []).length === 0 ? (
              <div className="p-10 text-center text-slate-500">
                No official horse statistics are available yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px]">
                  <thead className="sticky top-0 z-10 bg-slate-100">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-bold uppercase text-slate-600">
                        Rank
                      </th>
                      <th className="px-5 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => changeHorseSort("horse_name")}
                          className="inline-flex items-center gap-2 text-xs font-bold uppercase text-slate-600 hover:text-teal-700"
                        >
                          Horse
                          {sortIcon(
                            horseSortKey === "horse_name",
                            horseSortDirection
                          )}
                        </button>
                      </th>
                      <th className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => changeHorseSort("season_points")}
                          className="ml-auto inline-flex items-center gap-2 text-xs font-bold uppercase text-slate-600 hover:text-teal-700"
                        >
                          Points
                          {sortIcon(
                            horseSortKey === "season_points",
                            horseSortDirection
                          )}
                        </button>
                      </th>
                      <th className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => changeHorseSort("eligible_starts")}
                          className="ml-auto inline-flex items-center gap-2 text-xs font-bold uppercase text-slate-600 hover:text-teal-700"
                        >
                          Starts
                          {sortIcon(
                            horseSortKey === "eligible_starts",
                            horseSortDirection
                          )}
                        </button>
                      </th>
                      <th className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => changeHorseSort("average_points")}
                          className="ml-auto inline-flex items-center gap-2 text-xs font-bold uppercase text-slate-600 hover:text-teal-700"
                        >
                          Average
                          {sortIcon(
                            horseSortKey === "average_points",
                            horseSortDirection
                          )}
                        </button>
                      </th>
                      <th className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => changeHorseSort("current_price")}
                          className="ml-auto inline-flex items-center gap-2 text-xs font-bold uppercase text-slate-600 hover:text-teal-700"
                        >
                          Price
                          {sortIcon(
                            horseSortKey === "current_price",
                            horseSortDirection
                          )}
                        </button>
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {sortedHorseLeaders.map((horse, index) => (
                      <tr key={horse.horse_id} className="hover:bg-slate-50">
                        <td className="px-5 py-4 font-black">
                          {rankDisplay(null, index)}
                        </td>
                        <td className="px-5 py-4">
                          <Link
                            href={`/horses/${horse.horse_id}`}
                            className="font-bold text-slate-950 hover:text-teal-700 hover:underline"
                          >
                            {horse.horse_name}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-right font-black text-teal-700">
                          {horse.season_points}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {horse.eligible_starts}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {Number(horse.average_points).toFixed(1)}
                        </td>
                        <td className="px-5 py-4 text-right font-bold">
                          {formatCurrency(horse.current_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === "players" && (
          <section className="mt-5 overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="border-b bg-slate-50 px-5 py-4">
              <h2 className="text-xl font-black text-slate-950">
                Player Leaders
              </h2>
            </div>

            {(data.player_leaders ?? []).length === 0 ? (
              <div className="p-10 text-center text-slate-500">
                No player statistics are available yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px]">
                  <thead className="sticky top-0 z-10 bg-slate-100">
                    <tr>
                      <th className="px-5 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => changePlayerSort("overall_rank")}
                          className="inline-flex items-center gap-2 text-xs font-bold uppercase text-slate-600 hover:text-teal-700"
                        >
                          Rank
                          {sortIcon(
                            playerSortKey === "overall_rank",
                            playerSortDirection
                          )}
                        </button>
                      </th>
                      <th className="px-5 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => changePlayerSort("display_name")}
                          className="inline-flex items-center gap-2 text-xs font-bold uppercase text-slate-600 hover:text-teal-700"
                        >
                          Manager
                          {sortIcon(
                            playerSortKey === "display_name",
                            playerSortDirection
                          )}
                        </button>
                      </th>
                      <th className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => changePlayerSort("total_points")}
                          className="ml-auto inline-flex items-center gap-2 text-xs font-bold uppercase text-slate-600 hover:text-teal-700"
                        >
                          Points
                          {sortIcon(
                            playerSortKey === "total_points",
                            playerSortDirection
                          )}
                        </button>
                      </th>
                      <th className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => changePlayerSort("rounds_played")}
                          className="ml-auto inline-flex items-center gap-2 text-xs font-bold uppercase text-slate-600 hover:text-teal-700"
                        >
                          Rounds
                          {sortIcon(
                            playerSortKey === "rounds_played",
                            playerSortDirection
                          )}
                        </button>
                      </th>
                      <th className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => changePlayerSort("round_wins")}
                          className="ml-auto inline-flex items-center gap-2 text-xs font-bold uppercase text-slate-600 hover:text-teal-700"
                        >
                          Wins
                          {sortIcon(
                            playerSortKey === "round_wins",
                            playerSortDirection
                          )}
                        </button>
                      </th>
                      <th className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            changePlayerSort("top_ten_finishes")
                          }
                          className="ml-auto inline-flex items-center gap-2 text-xs font-bold uppercase text-slate-600 hover:text-teal-700"
                        >
                          Top 10
                          {sortIcon(
                            playerSortKey === "top_ten_finishes",
                            playerSortDirection
                          )}
                        </button>
                      </th>
                      <th className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            changePlayerSort("highest_round_score")
                          }
                          className="ml-auto inline-flex items-center gap-2 text-xs font-bold uppercase text-slate-600 hover:text-teal-700"
                        >
                          Best Round
                          {sortIcon(
                            playerSortKey === "highest_round_score",
                            playerSortDirection
                          )}
                        </button>
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {sortedPlayerLeaders.map((player, index) => (
                      <tr key={player.user_id} className="hover:bg-slate-50">
                        <td className="px-5 py-4 font-black">
                          {rankDisplay(player.overall_rank, index)}
                        </td>
                        <td className="px-5 py-4">
                          <Link
                            href={`/players/${player.user_id}`}
                            className="font-bold text-slate-950 hover:text-teal-700 hover:underline"
                          >
                            {player.display_name}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-right font-black text-teal-700">
                          {player.total_points}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {player.rounds_played}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {player.round_wins}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {player.top_ten_finishes}
                        </td>
                        <td className="px-5 py-4 text-right font-bold">
                          {player.highest_round_score}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === "ownership" && (
          <section className="mt-5">
            <div className="mb-5 flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Round Ownership
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  View selection and captain percentages for an
                  individual round. Only locked, scoring and completed
                  rounds are available.
                </p>
              </div>

              <div className="w-full sm:w-72">
                <label
                  htmlFor="ownership-round"
                  className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500"
                >
                  Choose round
                </label>

                <select
                  id="ownership-round"
                  value={selectedRoundId}
                  onChange={(event) =>
                    void changeOwnershipRound(event.target.value)
                  }
                  disabled={
                    ownershipLoading ||
                    (data.ownership_rounds ?? []).length === 0
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-semibold text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  {(data.ownership_rounds ?? []).length === 0 && (
                    <option value="">No locked rounds available</option>
                  )}

                  {(data.ownership_rounds ?? []).map((round) => (
                    <option key={round.id} value={round.id}>
                      Round {round.round_number}
                      {round.name ? ` — ${round.name}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {ownershipLoading ? (
              <div className="rounded-2xl border bg-white p-10 text-center text-slate-500 shadow-sm">
                Loading round ownership...
              </div>
            ) : !data.selected_round ? (
              <div className="rounded-2xl border bg-white p-10 text-center text-slate-500 shadow-sm">
                Ownership statistics become available after a round
                locks.
              </div>
            ) : (
              <>
                <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-5 py-4">
                  <p className="font-black text-slate-950">
                    Round {data.selected_round.round_number}
                    {data.selected_round.name
                      ? ` — ${data.selected_round.name}`
                      : ""}
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    Based on {data.total_teams_in_round}{" "}
                    {data.total_teams_in_round === 1 ? "team" : "teams"}.
                  </p>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <section className="rounded-2xl border bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-teal-700" />

                      <div>
                        <h3 className="text-xl font-black text-slate-950">
                          Most Selected
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Percentage of teams that selected each horse.
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 space-y-4">
                      {(data.most_selected ?? []).map((horse, index) => {
                        const percentage = Number(
                          horse.ownership_percentage ?? 0
                        );

                        return (
                          <div key={horse.horse_id}>
                            <div className="flex items-center justify-between gap-4 text-sm">
                              <Link
                                href={`/horses/${horse.horse_id}`}
                                className="font-bold text-slate-950 hover:text-teal-700"
                              >
                                {index + 1}. {horse.horse_name}
                              </Link>

                              <div className="text-right">
                                <span className="font-black">
                                  {percentage.toFixed(1)}%
                                </span>
                                <span className="ml-2 text-xs text-slate-500">
                                  ({horse.selection_count ?? 0})
                                </span>
                              </div>
                            </div>

                            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full rounded-full bg-teal-600"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.max(0, percentage)
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}

                      {(data.most_selected ?? []).length === 0 && (
                        <p className="text-slate-500">
                          No submitted teams are available for this
                          round.
                        </p>
                      )}
                    </div>
                  </section>

                  <section className="rounded-2xl border bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <Crown className="h-5 w-5 text-amber-600" />

                      <div>
                        <h3 className="text-xl font-black text-slate-950">
                          Most Captained
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Percentage of teams that captained each horse.
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 space-y-4">
                      {(data.most_captained ?? []).map((horse, index) => {
                        const percentage = Number(
                          horse.captain_percentage ?? 0
                        );

                        return (
                          <div key={horse.horse_id}>
                            <div className="flex items-center justify-between gap-4 text-sm">
                              <Link
                                href={`/horses/${horse.horse_id}`}
                                className="font-bold text-slate-950 hover:text-teal-700"
                              >
                                {index + 1}. {horse.horse_name}
                              </Link>

                              <div className="text-right">
                                <span className="font-black">
                                  {percentage.toFixed(1)}%
                                </span>
                                <span className="ml-2 text-xs text-slate-500">
                                  ({horse.captain_count ?? 0})
                                </span>
                              </div>
                            </div>

                            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full rounded-full bg-amber-500"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.max(0, percentage)
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}

                      {(data.most_captained ?? []).length === 0 && (
                        <p className="text-slate-500">
                          No captain selections are available for this
                          round.
                        </p>
                      )}
                    </div>
                  </section>
                </div>
              </>
            )}
          </section>
        )}

        {activeTab === "prices" && (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <ArrowUpRight className="h-5 w-5 text-green-700" />
                <h2 className="text-xl font-black text-slate-950">
                  Biggest Price Rises
                </h2>
              </div>

              <div className="mt-5 divide-y">
                {(data.price_risers ?? []).map((horse, index) => (
                  <div
                    key={horse.horse_id}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div>
                      <Link
                        href={`/horses/${horse.horse_id}`}
                        className="font-bold text-slate-950 hover:text-teal-700"
                      >
                        {index + 1}. {horse.horse_name}
                      </Link>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatCurrency(horse.current_price)}
                      </p>
                    </div>

                    <span className="font-black text-green-700">
                      {formatSignedCurrency(horse.total_change)}
                    </span>
                  </div>
                ))}

                {(data.price_risers ?? []).length === 0 && (
                  <p className="py-4 text-slate-500">
                    No price rises are available yet.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <ArrowDownRight className="h-5 w-5 text-red-700" />
                <h2 className="text-xl font-black text-slate-950">
                  Biggest Price Falls
                </h2>
              </div>

              <div className="mt-5 divide-y">
                {(data.price_fallers ?? []).map((horse, index) => (
                  <div
                    key={horse.horse_id}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div>
                      <Link
                        href={`/horses/${horse.horse_id}`}
                        className="font-bold text-slate-950 hover:text-teal-700"
                      >
                        {index + 1}. {horse.horse_name}
                      </Link>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatCurrency(horse.current_price)}
                      </p>
                    </div>

                    <span className="font-black text-red-700">
                      {formatSignedCurrency(horse.total_change)}
                    </span>
                  </div>
                ))}

                {(data.price_fallers ?? []).length === 0 && (
                  <p className="py-4 text-slate-500">
                    No price falls are available yet.
                  </p>
                )}
              </div>
            </section>
          </div>
        )}

      </div>
    </main>
  );
}