"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Crown,
  Medal,
  Trophy,
  UserRound,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type PlayerProfile = {
  id: string;
  display_name: string;
};

type PlayerSeasonOption = {
  id: string;
  name: string;
  year: number;
  is_active: boolean;
};

type SeasonSummary = {
  season_id: string;
  season_name: string;
  total_points: number;
  overall_rank: number | null;
  rounds_played: number;
  round_wins: number;
  highest_round_score: number;
  top_ten_finishes: number;
};

type RoundHistoryRow = {
  round_id: string;
  round_number: number;
  round_name: string | null;
  round_date: string | null;
  round_status: string;
  team_id: string | null;
  team_name: string | null;
  total_points: number;
  captain_points: number;
  round_rank: number | null;
  salary_used: number | null;
};

type PlayerProfileData = {
  success: boolean;
  message?: string;
  profile: PlayerProfile | null;
  seasons: PlayerSeasonOption[];
  selected_season_id: string | null;
  season_summary: SeasonSummary | null;
  round_history: RoundHistoryRow[];
};

type PlayerRoundSelection = {
  race_entry_id: string;
  horse_id: string;
  horse_name: string;
  is_captain: boolean;
  selected_price: number;
  fantasy_points: number;
  saddlecloth_number: number | null;
  race_number: number;
  race_name: string;
  race_grade: "L" | "G3" | "G2" | "G1";
  racecourse_name: string | null;
  finishing_position: number | null;
  result_status: string | null;
};

type PlayerRoundTeamData = {
  success: boolean;
  message?: string;
  team: {
    id: string;
    team_name: string | null;
    status: string;
    salary_used: number;
    round_id: string;
    round_number: number;
    round_name: string | null;
  } | null;
  selections: PlayerRoundSelection[];
};

function formatCurrency(value: number | null) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  }).format(new Date(`${value}T00:00:00`));
}

function rankDisplay(rank: number | null) {
  if (!rank || rank <= 0) {
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

function finishDisplay(
  position: number | null,
  status: string | null
) {
  if (status === "scratched") return "SCR";
  if (
    status === "non_finisher" ||
    status === "did_not_finish" ||
    status === "dnf"
  ) {
    return "DNF";
  }

  if (!position || position <= 0) {
    return "—";
  }

  return rankDisplay(position);
}

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>();
  const playerId = params.id;

  const [data, setData] = useState<PlayerProfileData | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [seasonChanging, setSeasonChanging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [selectedRoundId, setSelectedRoundId] =
    useState<string | null>(null);
  const [roundTeamData, setRoundTeamData] =
    useState<PlayerRoundTeamData | null>(null);
  const [roundTeamLoading, setRoundTeamLoading] =
    useState(false);
  const [roundTeamError, setRoundTeamError] =
    useState("");

  useEffect(() => {
    if (!playerId) return;

    let active = true;

    async function loadPlayerProfile() {
      setLoading(true);
      setErrorMessage("");

      const { data: profileData, error } = await supabase.rpc(
        "get_player_profile_by_season",
        {
          p_user_id: playerId,
          p_season_id: null,
        }
      );

      if (!active) return;

      if (error) {
        console.error("Player profile RPC error:", error);
        setErrorMessage(
          error.message || "The player profile could not be loaded."
        );
        setData(null);
        setLoading(false);
        return;
      }

      const loadedData = profileData as unknown as PlayerProfileData;

      if (!loadedData.success || !loadedData.profile) {
        setErrorMessage(
          loadedData.message || "The player profile could not be found."
        );
        setData(loadedData);
        setLoading(false);
        return;
      }

      setData(loadedData);
      setSelectedSeasonId(
        loadedData.selected_season_id ?? ""
      );
      setLoading(false);
    }

    void loadPlayerProfile();

    return () => {
      active = false;
    };
  }, [playerId]);

  async function changeSeason(seasonId: string) {
    if (!seasonId || seasonId === selectedSeasonId) {
      return;
    }

    setSelectedSeasonId(seasonId);
    setSeasonChanging(true);
    setErrorMessage("");
    closeRoundTeam();

    const { data: profileData, error } =
      await supabase.rpc(
        "get_player_profile_by_season",
        {
          p_user_id: playerId,
          p_season_id: seasonId,
        }
      );

    if (error) {
      console.error(
        "Player profile season change error:",
        error
      );
      setErrorMessage(
        error.message ||
          "The selected season could not be loaded."
      );
      setSeasonChanging(false);
      return;
    }

    const loadedData =
      profileData as unknown as PlayerProfileData;

    setData(loadedData);
    setSelectedSeasonId(
      loadedData.selected_season_id ?? seasonId
    );
    setSeasonChanging(false);
  }

  async function openRoundTeam(roundId: string) {
    setSelectedRoundId(roundId);
    setRoundTeamData(null);
    setRoundTeamError("");
    setRoundTeamLoading(true);

    const { data: teamDataRaw, error } =
      await supabase.rpc(
        "get_player_round_team",
        {
          p_user_id: playerId,
          p_round_id: roundId,
        }
      );

    if (error) {
      console.error(
        "Player round team RPC error:",
        error
      );
      setRoundTeamError(
        error.message ||
          "The team could not be loaded."
      );
      setRoundTeamLoading(false);
      return;
    }

    setRoundTeamData(
      teamDataRaw as unknown as PlayerRoundTeamData
    );
    setRoundTeamLoading(false);
  }

  function closeRoundTeam() {
    setSelectedRoundId(null);
    setRoundTeamData(null);
    setRoundTeamError("");
  }

  const selectedSeason = useMemo(() => {
    return (
      data?.seasons?.find(
        (season) => season.id === selectedSeasonId
      ) ?? null
    );
  }, [data, selectedSeasonId]);

  const averageRoundScore = useMemo(() => {
    const rounds = data?.round_history ?? [];

    if (rounds.length === 0) return 0;

    return (
      rounds.reduce((total, round) => total + round.total_points, 0) /
      rounds.length
    );
  }, [data]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-6xl rounded-xl border bg-white p-10 text-center text-slate-500">
          Loading player profile...
        </div>
      </main>
    );
  }

  if (errorMessage || !data?.profile) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-4xl rounded-xl border bg-white p-8">
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-2 text-sm font-bold text-teal-700 hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to leaderboard
          </Link>

          <h1 className="mt-6 text-2xl font-black text-slate-950">
            Player Profile
          </h1>

          <p className="mt-4 text-red-700">
            {errorMessage || "The player profile could not be found."}
          </p>
        </div>
      </main>
    );
  }

  const summary = data.season_summary;
  const rounds = data.round_history ?? [];

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-2 text-sm font-bold text-teal-700 hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to leaderboard
        </Link>

        <header className="mt-4 rounded-2xl bg-slate-950 p-6 text-white shadow-sm md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-teal-400 text-slate-950">
                <UserRound className="h-8 w-8" />
              </div>

              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-300">
                  Player profile
                </p>

                <h1 className="mt-1 text-3xl font-black md:text-4xl">
                  {data.profile.display_name}
                </h1>

                {selectedSeason && (
                  <p className="mt-2 text-slate-300">
                    {selectedSeason.name} {selectedSeason.year}
                  </p>
                )}
              </div>
            </div>

            {data.seasons.length > 0 && (
              <div className="w-full md:w-auto">
                <label
                  htmlFor="player-profile-season"
                  className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400"
                >
                  Season
                </label>

                <select
                  id="player-profile-season"
                  value={selectedSeasonId}
                  onChange={(event) =>
                    void changeSeason(event.target.value)
                  }
                  disabled={seasonChanging}
                  className="w-full min-w-56 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 font-bold text-white outline-none transition focus:border-teal-400 disabled:cursor-wait disabled:opacity-60 md:w-auto"
                >
                  {data.seasons.map((season) => (
                    <option
                      key={season.id}
                      value={season.id}
                    >
                      {season.name} {season.year}
                      {season.is_active
                        ? " — Active"
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Overall Rank
            </p>
            <p className="mt-2 text-3xl font-black text-slate-950">
              {rankDisplay(summary?.overall_rank ?? null)}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Total Points
            </p>
            <p className="mt-2 text-3xl font-black text-teal-700">
              {summary?.total_points ?? 0}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Round Wins
            </p>
            <p className="mt-2 text-3xl font-black text-slate-950">
              {summary?.round_wins ?? 0}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Highest Round
            </p>
            <p className="mt-2 text-3xl font-black text-slate-950">
              {summary?.highest_round_score ?? 0}
            </p>
          </div>
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-teal-700" />
              <p className="font-bold text-slate-950">Rounds Played</p>
            </div>
            <p className="mt-3 text-2xl font-black text-slate-950">
              {summary?.rounds_played ?? rounds.length}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Medal className="h-5 w-5 text-teal-700" />
              <p className="font-bold text-slate-950">Top 10 Finishes</p>
            </div>
            <p className="mt-3 text-2xl font-black text-slate-950">
              {summary?.top_ten_finishes ?? 0}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-teal-700" />
              <p className="font-bold text-slate-950">Average Round</p>
            </div>
            <p className="mt-3 text-2xl font-black text-slate-950">
              {averageRoundScore.toFixed(1)}
            </p>
          </div>
        </section>

        {seasonChanging && (
          <div className="mt-6 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm font-bold text-teal-800">
            Updating season...
          </div>
        )}

        <section className="mt-8">
          <div>
            <h2 className="text-2xl font-black text-slate-950">
              Round History
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Completed rounds from the selected season.
            </p>
          </div>

          {rounds.length === 0 ? (
            <div className="mt-4 rounded-xl border bg-white p-10 text-center text-slate-500">
              No completed round history is available yet.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {rounds.map((round) => (
                <article
                  key={round.round_id}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    void openRoundTeam(round.round_id)
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" ||
                      event.key === " "
                    ) {
                      event.preventDefault();
                      void openRoundTeam(round.round_id);
                    }
                  }}
                  className="cursor-pointer rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
                  aria-label={`View team for Round ${round.round_number}`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-bold text-teal-700">
                        Round {round.round_number}
                      </p>

                      <h3 className="mt-1 text-lg font-black text-slate-950">
                        {round.team_name?.trim() ||
                          round.round_name ||
                          "Unnamed Team"}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        {formatDate(round.round_date)}
                      </p>

                      <p className="mt-2 text-xs font-bold uppercase tracking-wide text-teal-700">
                        View Team
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Score
                        </p>
                        <p className="mt-1 text-lg font-black text-slate-950">
                          {round.total_points}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Rank
                        </p>
                        <p className="mt-1 text-lg font-black text-slate-950">
                          {rankDisplay(round.round_rank)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Captain Bonus
                        </p>
                        <p className="mt-1 text-lg font-black text-slate-950">
                          {round.captain_points}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Salary
                        </p>
                        <p className="mt-1 text-lg font-black text-slate-950">
                          {formatCurrency(round.salary_used)}
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {selectedRoundId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeRoundTeam();
            }
          }}
        >
          <section className="max-h-[92vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-4xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 bg-slate-950 px-5 py-5 text-white sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-300">
                  Round Team
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  {roundTeamData?.team
                    ? `Round ${roundTeamData.team.round_number}${
                        roundTeamData.team.round_name
                          ? ` — ${roundTeamData.team.round_name}`
                          : ""
                      }`
                    : "Loading team..."}
                </h2>

                {roundTeamData?.team && (
                  <p className="mt-1 text-sm text-slate-300">
                    {roundTeamData.team.team_name?.trim() ||
                      data.profile.display_name}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={closeRoundTeam}
                className="rounded-lg border border-white/20 p-2 transition hover:bg-white/10"
                aria-label="Close round team"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(92vh-96px)] overflow-y-auto p-5 sm:p-6">
              {roundTeamLoading && (
                <div className="py-16 text-center text-slate-500">
                  Loading team...
                </div>
              )}

              {!roundTeamLoading &&
                roundTeamError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
                    {roundTeamError}
                  </div>
                )}

              {!roundTeamLoading &&
                !roundTeamError &&
                roundTeamData?.team && (
                  <>
                    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-xl bg-slate-100 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Score
                        </p>
                        <p className="mt-1 text-xl font-black text-slate-950">
                          {rounds.find(
                            (round) =>
                              round.round_id ===
                              selectedRoundId
                          )?.total_points ?? 0}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-100 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Rank
                        </p>
                        <p className="mt-1 text-xl font-black text-slate-950">
                          {rankDisplay(
                            rounds.find(
                              (round) =>
                                round.round_id ===
                                selectedRoundId
                            )?.round_rank ?? null
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-100 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Salary
                        </p>
                        <p className="mt-1 text-xl font-black text-slate-950">
                          {formatCurrency(
                            roundTeamData.team.salary_used
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-100 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Horses
                        </p>
                        <p className="mt-1 text-xl font-black text-slate-950">
                          {roundTeamData.selections.length}
                        </p>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <div className="divide-y divide-slate-100">
                        {roundTeamData.selections.map(
                          (selection) => (
                            <div
                              key={selection.race_entry_id}
                              className={`grid gap-3 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_180px_90px] sm:items-center ${
                                selection.is_captain
                                  ? "bg-amber-50"
                                  : "bg-white"
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="truncate font-black text-slate-950">
                                    {selection.horse_name}
                                  </p>

                                  {selection.is_captain && (
                                    <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                                      Captain
                                    </span>
                                  )}
                                </div>

                                <p className="mt-1 text-sm text-slate-600">
                                  R{selection.race_number} ·{" "}
                                  {selection.race_name}
                                  {selection.racecourse_name
                                    ? ` · ${selection.racecourse_name}`
                                    : ""}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  Selected at{" "}
                                  {formatCurrency(
                                    selection.selected_price
                                  )}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                  Result
                                </p>
                                <p className="mt-1 font-bold text-slate-900">
                                  {finishDisplay(
                                    selection.finishing_position,
                                    selection.result_status
                                  )}
                                </p>
                              </div>

                              <div className="sm:text-right">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                  Points
                                </p>
                                <p className="mt-1 text-xl font-black text-teal-700">
                                  {selection.is_captain
                                    ? selection.fantasy_points *
                                      2
                                    : selection.fantasy_points}
                                </p>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </>
                )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}