import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Minus,
} from "lucide-react";

export type LeagueLeaderboardRow = {
  user_id: string;
  display_name: string;
  team_name: string;
  score: number;
  rank: number;
  overall_rank?: number | null;
  rank_change?: number | null;
};

type Props = {
  type: "round" | "season";
  rows: LeagueLeaderboardRow[];
  currentUserId: string;
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

function ordinalRank(rank: number | null | undefined) {
  if (rank == null) {
    return "—";
  }

  const mod100 = rank % 100;

  if (mod100 >= 11 && mod100 <= 13) {
    return `${rank}th`;
  }

  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}

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

export default function LeagueLeaderboardTable({
  type,
  rows,
  currentUserId,
}: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center shadow-sm">
        <h3 className="text-xl font-bold text-slate-900">
          No leaderboard available
        </h3>

        <p className="mt-3 text-slate-500">
          Scores will appear here once league members have
          recorded results.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
      <table className="w-full min-w-[640px]">
        <thead className="bg-slate-50">
          <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-600">
            <th className="px-4 py-3">
              Rank
            </th>

            <th className="px-4 py-3">
              Team
            </th>

            <th className="px-4 py-3 text-right">
              Overall Rank
            </th>

            {type === "season" && (
              <th className="px-4 py-3 text-right">
                Change
              </th>
            )}

            <th className="px-4 py-3 text-right">
              Points
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => {
            const isCurrentUser =
              row.user_id === currentUserId;

            return (
              <tr
                key={`${row.user_id}-${index}`}
                className={`border-t transition ${
                  isCurrentUser
                    ? "bg-teal-50"
                    : "hover:bg-slate-50"
                }`}
              >
                <td className="px-4 py-4 font-bold">
                  {rankDisplay(row.rank)}
                </td>

                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/players/${row.user_id}`}
                      className="font-semibold text-teal-700 hover:text-slate-950 hover:underline"
                    >
                      {row.team_name}
                    </Link>

                    {isCurrentUser && (
                      <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-800">
                        You
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-4 py-4 text-right font-semibold text-slate-700">
                  {ordinalRank(row.overall_rank)}
                </td>

                {type === "season" && (
                  <td className="px-4 py-4 text-right">
                    <RankChange
                      value={row.rank_change}
                    />
                  </td>
                )}

                <td className="px-4 py-4 text-right font-bold">
                  {row.score}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}