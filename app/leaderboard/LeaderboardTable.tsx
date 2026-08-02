import Link from "next/link";

import {
  RoundLeaderboardRow,
  SeasonLeaderboardRow,
} from "./types";

type Props = {
  type: "round" | "season";
  rows: RoundLeaderboardRow[] | SeasonLeaderboardRow[];
};

function rankDisplay(rank: number) {
  switch (rank) {
    case 1:
      return "🥇";
    case 2:
      return "🥈";
    case 3:
      return "🥉";
    default:
      return rank;
  }
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
                  {rankDisplay(rank)}
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