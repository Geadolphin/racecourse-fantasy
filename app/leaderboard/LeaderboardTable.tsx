"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Minus,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

import type {
  RoundLeaderboardRow,
  SeasonLeaderboardRow,
} from "./types";

type Props = {
  type: "round" | "season";
  rows?: RoundLeaderboardRow[] | SeasonLeaderboardRow[] | null;
};

type RoundSortKey = "points" | "projected" | "runners" | "salary";
type SortDirection = "asc" | "desc";

function RankChange({
  value,
}: {
  value: number | null | undefined;
}) {
  if (value == null || value === 0) {
    return (
      <span
        className="inline-flex items-center justify-end gap-1 text-slate-400"
        title={
          value == null
            ? "No previous completed round to compare"
            : "No rank change"
        }
      >
        <Minus className="h-4 w-4" />
      </span>
    );
  }

  if (value > 0) {
    return (
      <span
        className="inline-flex items-center justify-end gap-1 font-bold text-emerald-600"
        title={`Up ${value} ${
          value === 1 ? "place" : "places"
        }`}
      >
        <ArrowUp className="h-4 w-4" />
        {value}
      </span>
    );
  }

  const placesDropped = Math.abs(value);

  return (
    <span
      className="inline-flex items-center justify-end gap-1 font-bold text-red-600"
      title={`Down ${placesDropped} ${
        placesDropped === 1 ? "place" : "places"
      }`}
    >
      <ArrowDown className="h-4 w-4" />
      {placesDropped}
    </span>
  );
}

export default function LeaderboardTable({
  type,
  rows,
}: Props) {
  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [showProjectedScores, setShowProjectedScores] =
    useState(false);

  const [showSpecialTeamProjections, setShowSpecialTeamProjections] =
    useState(false);
  const [hasEarlyProjectionAccess, setHasEarlyProjectionAccess] =
    useState(false);

  const [currentTime, setCurrentTime] =
    useState(() => Date.now());

  const [roundSortKey, setRoundSortKey] =
    useState<RoundSortKey | null>(null);
  const [roundSortDirection, setRoundSortDirection] =
    useState<SortDirection>("desc");

  const safeRows = useMemo<
    RoundLeaderboardRow[] | SeasonLeaderboardRow[]
  >(() => {
    return Array.isArray(rows) ? rows : [];
  }, [rows]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadCurrentUser() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      if (error) {
        console.error(
          "Leaderboard current user error:",
          error
        );
        return;
      }

      setCurrentUserId(user?.id ?? null);

      if (!user) {
        setHasEarlyProjectionAccess(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("projection_access_early")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) {
        return;
      }

      if (profileError) {
        console.error(
          "Leaderboard special projection access error:",
          profileError
        );
        setHasEarlyProjectionAccess(false);
        return;
      }

      setHasEarlyProjectionAccess(
        profile?.projection_access_early === true
      );
    }

    void loadCurrentUser();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadProjectedScoresSetting() {
      const { data, error } = await supabase.rpc(
        "get_public_site_settings"
      );

      if (!active) return;

      if (error) {
        console.error(
          "Leaderboard projected scores setting error:",
          error
        );
        setShowProjectedScores(false);
        return;
      }

      const settings =
        data && typeof data === "object"
          ? (data as {
              show_projected_scores?: boolean;
              show_special_team_projections?: boolean;
            })
          : null;

      setShowProjectedScores(
        settings?.show_projected_scores === true
      );
      setShowSpecialTeamProjections(
        settings?.show_special_team_projections === true
      );
    }

    void loadProjectedScoresSetting();

    return () => {
      active = false;
    };
  }, []);

  const projectionsVisible =
    type !== "round" ||
    showProjectedScores ||
    (showSpecialTeamProjections && hasEarlyProjectionAccess);

  function handleRoundSort(key: RoundSortKey) {
    if (type !== "round") return;
    if (key === "projected" && !projectionsVisible) return;

    if (roundSortKey === key) {
      setRoundSortDirection((current) =>
        current === "desc" ? "asc" : "desc"
      );
      return;
    }

    setRoundSortKey(key);
    setRoundSortDirection("desc");
  }

  const displayedRows = useMemo(() => {
    if (type !== "round" || roundSortKey === null) {
      return safeRows;
    }

    if (roundSortKey === "projected" && !projectionsVisible) {
      return safeRows;
    }

    const sortedRows = [...safeRows] as RoundLeaderboardRow[];

    sortedRows.sort((a, b) => {
      let aValue = 0;
      let bValue = 0;

      switch (roundSortKey) {
        case "points":
          aValue = Number(a.total_points ?? 0);
          bValue = Number(b.total_points ?? 0);
          break;
        case "projected":
          aValue = Number(a.projected_score ?? 0);
          bValue = Number(b.projected_score ?? 0);
          break;
        case "runners":
          aValue = Number(a.runners_used ?? 0);
          bValue = Number(b.runners_used ?? 0);
          break;
        case "salary":
          aValue = Number(a.salary_used ?? 0);
          bValue = Number(b.salary_used ?? 0);
          break;
      }

      const difference =
        roundSortDirection === "desc"
          ? bValue - aValue
          : aValue - bValue;

      if (difference !== 0) return difference;

      return (
        Number(a.round_rank ?? Number.MAX_SAFE_INTEGER) -
        Number(b.round_rank ?? Number.MAX_SAFE_INTEGER)
      );
    });

    return sortedRows;
  }, [
    safeRows,
    type,
    roundSortKey,
    roundSortDirection,
    projectionsVisible,
  ]);

  function SortIcon({ column }: { column: RoundSortKey }) {
    if (roundSortKey !== column) {
      return <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />;
    }

    return roundSortDirection === "desc" ? (
      <ArrowDown className="h-3.5 w-3.5" />
    ) : (
      <ArrowUp className="h-3.5 w-3.5" />
    );
  }

  if (safeRows.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center">
        <h2 className="text-xl font-bold text-slate-900">
          No leaderboard available
        </h2>

        <p className="mt-3 text-slate-500">
          Race results must be finalised before rankings are
          generated.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
      <table className="min-w-full">
        <thead className="bg-slate-100">
          <tr>
            <th className="px-4 py-3 text-left">
              Rank
            </th>

            <th className="px-4 py-3 text-left">
              Player
            </th>

            <th className="px-4 py-3 text-right">
              {type === "round" ? (
                <button
                  type="button"
                  onClick={() => handleRoundSort("points")}
                  className="inline-flex w-full items-center justify-end gap-1.5 font-semibold hover:text-teal-700"
                  title="Sort by points"
                >
                  <span>Points</span>
                  <SortIcon column="points" />
                </button>
              ) : (
                "Points"
              )}
            </th>

            {type === "round" && (
              <>
                <th className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleRoundSort("projected")}
                    disabled={!projectionsVisible}
                    className={`inline-flex w-full items-center justify-end gap-1.5 font-semibold ${
                      projectionsVisible
                        ? "hover:text-teal-700"
                        : "cursor-default opacity-60"
                    }`}
                    title={
                      projectionsVisible
                        ? "Sort by projected score"
                        : "Projected scores are hidden"
                    }
                  >
                    <span>Projected</span>
                    {projectionsVisible && (
                      <SortIcon column="projected" />
                    )}
                  </button>
                </th>

                <th className="px-4 py-3">
                  <div className="inline-grid w-full grid-cols-[48px_28px] items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleRoundSort("runners")}
                      className="inline-flex items-center justify-end gap-1 font-semibold hover:text-teal-700"
                      title="Sort by runners used"
                    >
                      <span>Runners</span>
                      <SortIcon column="runners" />
                    </button>

                    <span className="w-7" />
                  </div>
                </th>

                <th className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleRoundSort("salary")}
                    className="inline-flex w-full items-center justify-end gap-1.5 font-semibold hover:text-teal-700"
                    title="Sort by salary used"
                  >
                    <span>Salary Used</span>
                    <SortIcon column="salary" />
                  </button>
                </th>
              </>
            )}

            {type === "season" && (
              <>
                <th className="px-4 py-3 text-right">
                  Change
                </th>

                <th className="px-4 py-3 text-right">
                  Rounds
                </th>

                <th className="px-4 py-3 text-right">
                  Wins
                </th>

                <th className="px-4 py-3 text-right">
                  Best Round
                </th>
              </>
            )}
          </tr>
        </thead>

        <tbody>
          {displayedRows.map((row, index) => {
            const rank =
              type === "round"
                ? (row as RoundLeaderboardRow).round_rank
                : (row as SeasonLeaderboardRow).overall_rank;

            const isCurrentUser =
              currentUserId !== null &&
              row.user_id === currentUserId;

            const roundRow =
              type === "round"
                ? (row as RoundLeaderboardRow)
                : null;

            return (
              <tr
                key={`${row.user_id ?? "unknown"}-${index}`}
                className={`border-t transition ${
                  isCurrentUser
                    ? "bg-amber-200 hover:bg-amber-200"
                    : "hover:bg-slate-50"
                }`}
              >
                <td className="px-4 py-4 font-bold">
                  {rank ?? "—"}
                </td>

                <td className="px-4 py-4">
                  {row.user_id ? (
                    <Link
                      href={`/players/${row.user_id}`}
                      className="font-semibold text-teal-700 hover:text-slate-950 hover:underline"
                    >
                      {row.display_name ?? "Unknown"}
                    </Link>
                  ) : (
                    <span className="font-semibold text-slate-700">
                      {row.display_name ?? "Unknown"}
                    </span>
                  )}

                  {isCurrentUser && (
                    <span className="ml-2 text-xs font-black uppercase tracking-wide text-amber-900">
                      YOU
                    </span>
                  )}
                </td>

                <td className="px-4 py-4 text-right font-bold tabular-nums">
                  {Number(row.total_points ?? 0)}
                </td>

                {type === "round" && roundRow && (
                  <>
                    <td className="px-4 py-4 text-right font-bold tabular-nums text-amber-600">
                      {projectionsVisible
                        ? Number(roundRow.projected_score ?? 0)
                        : "Hidden"}
                    </td>

                    <td className="px-4 py-4">
                      <div className="inline-grid w-full grid-cols-[48px_28px] items-center justify-end gap-2">
                        <span className="text-right font-semibold tabular-nums text-slate-700">
                          {Number(roundRow.runners_used ?? 0)}
                          /10
                        </span>

                        <span className="flex h-6 w-7 items-center justify-center">
                          {roundRow.captain_ran === true && (
                            <span
                              className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-amber-500 bg-amber-400 px-1.5 text-[11px] font-black text-amber-950 shadow-sm"
                              title="Captain has raced"
                            >
                              C
                            </span>
                          )}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-right tabular-nums">
                      $
                      {Number(
                        roundRow.salary_used ?? 0
                      ).toLocaleString()}
                    </td>
                  </>
                )}

                {type === "season" && (
                  <>
                    <td className="px-4 py-4 text-right">
                      <RankChange
                        value={
                          (
                            row as SeasonLeaderboardRow
                          ).rank_change
                        }
                      />
                    </td>

                    <td className="px-4 py-4 text-right tabular-nums">
                      {Number(
                        (
                          row as SeasonLeaderboardRow
                        ).rounds_played ?? 0
                      )}
                    </td>

                    <td className="px-4 py-4 text-right tabular-nums">
                      {Number(
                        (
                          row as SeasonLeaderboardRow
                        ).round_wins ?? 0
                      )}
                    </td>

                    <td className="px-4 py-4 text-right tabular-nums">
                      {Number(
                        (
                          row as SeasonLeaderboardRow
                        ).highest_round_score ?? 0
                      )}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
