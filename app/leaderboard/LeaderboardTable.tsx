import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Minus,
} from "lucide-react";

import {
  RoundLeaderboardRow,
  SeasonLeaderboardRow,
} from "./types";

type Props = {
  type: "round" | "season";
  rows: RoundLeaderboardRow[] | SeasonLeaderboardRow[];
};

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
        title={`Up ${value} ${value === 1 ? "place" : "places"}`}
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
  if (rows.length === 0) {
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
            <th className="px-4 py-3 text-left">Rank</th>
            <th className="px-4 py-3 text-left">Player</th>
            <th className="px-4 py-3 text-right">Points</th>

            {type === "round" && (
              <th className="px-4 py-3 text-right">
                Salary Used
              </th>
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
          {rows.map((row, index) => {
            const rank =
              type === "round"
                ? (row as RoundLeaderboardRow).round_rank
                : (row as SeasonLeaderboardRow).overall_rank;

            return (
              <tr
                key={`${row.user_id}-${index}`}
                className="border-t hover:bg-slate-50"
              >
                <td className="px-4 py-4 font-bold">
                  {rank}
                </td>

                <td className="px-4 py-4">
                  <Link
                    href={`/players/${row.user_id}`}
                    className="font-semibold text-teal-700 hover:text-slate-950 hover:underline"
                  >
                    {row.display_name}
                  </Link>
                </td>

                <td className="px-4 py-4 text-right font-bold">
                  {row.total_points}
                </td>

                {type === "round" && (
                  <td className="px-4 py-4 text-right">
                    $
                    {(
                      row as RoundLeaderboardRow
                    ).salary_used.toLocaleString()}
                  </td>
                )}

                {type === "season" && (
                  <>
                    <td className="px-4 py-4 text-right">
                      <RankChange
                        value={
                          (row as SeasonLeaderboardRow)
                            .rank_change
                        }
                      />
                    </td>

                    <td className="px-4 py-4 text-right">
                      {
                        (
                          row as SeasonLeaderboardRow
                        ).rounds_played
                      }
                    </td>

                    <td className="px-4 py-4 text-right">
                      {
                        (
                          row as SeasonLeaderboardRow
                        ).round_wins
                      }
                    </td>

                    <td className="px-4 py-4 text-right">
                      {
                        (
                          row as SeasonLeaderboardRow
                        ).highest_round_score
                      }
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