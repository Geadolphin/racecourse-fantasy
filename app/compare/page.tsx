"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { supabase } from "@/lib/supabase";

type RoundOption = {
  id: string;
  round_number: number;
  name: string | null;
  status: string;
  lockout_at: string | null;
};

type AvailableTeam = {
  user_id: string;
  team_id: string;
  team_name: string | null;
  display_name: string;
  status: string;
  round_score: number | null;
  round_rank: number | null;
};

type TeamScore = {
  total_points: number | null;
  captain_points: number | null;
  round_rank: number | null;
};

type ComparisonSelection = {
  race_entry_id: string;
  horse_id: string;
  horse_name: string;
  is_captain: boolean;
  selected_price: number;
  fantasy_points: number;
  display_points: number;
  projected_points?: number | null;
  has_official_result?: boolean;

  race_id: string;
  race_number: number;
  race_name: string;
  race_grade: "L" | "G3" | "G2" | "G1";
  racecourse_name: string | null;
};

type ComparisonTeam = {
  id: string;
  user_id: string;
  team_name: string | null;
  status: string;
  salary_used: number;
  salary_cap: number | null;
  score?: TeamScore | null;
  selections?: ComparisonSelection[];
};

type ComparisonRound = {
  id: string;
  round_number: number;
  name: string | null;
  status: string;
  lockout_at: string | null;
};

type ComparisonData = {
  success: boolean;
  locked: boolean;
  round: ComparisonRound | null;
  available_teams: AvailableTeam[];
  my_team: ComparisonTeam | null;
  opponent_team: ComparisonTeam | null;
  message?: string;
};

type RaceGroup = {
  race_id: string;
  race_number: number;
  race_name: string;
  race_grade: ComparisonSelection["race_grade"];
  racecourse_name: string | null;
  mySelections: ComparisonSelection[];
  opponentSelections: ComparisonSelection[];
};

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function formatSignedNumber(value: number) {
  if (value > 0) {
    return `+${value}`;
  }

  return String(value);
}

function formatSignedCurrency(value: number) {
  const formatted = formatCurrency(Math.abs(value));

  if (value > 0) {
    return `+${formatted}`;
  }

  if (value < 0) {
    return `-${formatted}`;
  }

  return formatted;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Melbourne",
  }).format(new Date(value));
}

function getGradeLabel(grade: ComparisonSelection["race_grade"]) {
  const labels: Record<ComparisonSelection["race_grade"], string> = {
    L: "Listed",
    G3: "Group 3",
    G2: "Group 2",
    G1: "Group 1",
  };

  return labels[grade];
}

function getRankDisplay(rank: number | null | undefined) {
  if (!rank || rank <= 0) {
    return "—";
  }

  return `#${rank}`;
}

function getTeamLabel(team: AvailableTeam) {
  return (
    team.display_name?.trim() ||
    team.team_name?.trim() ||
    "Unnamed Team"
  );
}

export default function CompareTeamsPage() {
  const [rounds, setRounds] = useState<RoundOption[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [selectedOpponentUserId, setSelectedOpponentUserId] =
    useState("");

  const [opponentSearch, setOpponentSearch] =
    useState("");

  const [opponentSearchFocused, setOpponentSearchFocused] =
    useState(false);

  const [comparisonData, setComparisonData] =
    useState<ComparisonData | null>(null);

  const [loadingRounds, setLoadingRounds] = useState(true);
  const [loadingComparison, setLoadingComparison] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [entryProjectionData, setEntryProjectionData] = useState<
    Record<string, { projected_points: number | null; has_official_result: boolean }>
  >({});

  useEffect(() => {
    let active = true;

    async function loadRounds() {
      setLoadingRounds(true);
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      if (userError || !user) {
        setErrorMessage(
          "You must be signed in to compare teams."
        );
        setRounds([]);
        setLoadingRounds(false);
        return;
      }

      const { data, error } = await supabase
        .from("rounds")
        .select(
          `
            id,
            round_number,
            name,
            status,
            lockout_at
          `
        )
        .not("lockout_at", "is", null)
        .order("round_number", { ascending: false });

      if (!active) {
        return;
      }

      if (error) {
        console.error("Comparison rounds load error:", error);

        setErrorMessage(
          error.message ||
            "The comparison rounds could not be loaded."
        );

        setRounds([]);
        setLoadingRounds(false);
        return;
      }

      const loadedRounds = (data ?? []) as RoundOption[];
      const now = Date.now();

      const comparableRounds = loadedRounds.filter((round) => {
        if (!round.lockout_at) {
          return false;
        }

        return new Date(round.lockout_at).getTime() <= now;
      });

      setRounds(comparableRounds);

      if (comparableRounds.length > 0) {
        setSelectedRoundId(comparableRounds[0].id);
      }

      setLoadingRounds(false);
    }

    void loadRounds();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedRoundId) {
      setComparisonData(null);
      setSelectedOpponentUserId("");
      return;
    }

    let active = true;

    async function loadTeamList() {
      setLoadingComparison(true);
      setErrorMessage("");
      setSelectedOpponentUserId("");
      setOpponentSearch("");

      const { data, error } = await supabase.rpc(
        "get_team_comparison_data",
        {
          p_round_id: selectedRoundId,
          p_opponent_user_id: null,
        }
      );

      if (!active) {
        return;
      }

      if (error) {
        console.error("Comparison list RPC error:", error);

        setErrorMessage(
          error.message ||
            "The available teams could not be loaded."
        );

        setComparisonData(null);
        setLoadingComparison(false);
        return;
      }

      setComparisonData(data as ComparisonData);
      setLoadingComparison(false);
    }

    void loadTeamList();

    return () => {
      active = false;
    };
  }, [selectedRoundId]);

  useEffect(() => {
    if (!selectedRoundId || !selectedOpponentUserId) {
      return;
    }

    let active = true;

    async function loadComparison() {
      setLoadingComparison(true);
      setErrorMessage("");

      const { data, error } = await supabase.rpc(
        "get_team_comparison_data",
        {
          p_round_id: selectedRoundId,
          p_opponent_user_id: selectedOpponentUserId,
        }
      );

      if (!active) {
        return;
      }

      if (error) {
        console.error("Team comparison RPC error:", error);

        setErrorMessage(
          error.message ||
            "The selected team comparison could not be loaded."
        );

        setLoadingComparison(false);
        return;
      }

      setComparisonData(data as ComparisonData);
      setLoadingComparison(false);
    }

    void loadComparison();

    return () => {
      active = false;
    };
  }, [selectedOpponentUserId, selectedRoundId]);

  useEffect(() => {
    const entryIds = [
      ...(comparisonData?.my_team?.selections ?? []),
      ...(comparisonData?.opponent_team?.selections ?? []),
    ].map((selection) => selection.race_entry_id);

    const uniqueEntryIds = [...new Set(entryIds)];

    if (uniqueEntryIds.length === 0) {
      setEntryProjectionData({});
      return;
    }

    let active = true;

    async function loadProjectionData() {
      const [
        { data: entryData, error: entryError },
        { data: resultData, error: resultError },
      ] = await Promise.all([
        supabase
          .from("race_entries")
          .select("id, projected_points")
          .in("id", uniqueEntryIds),
        supabase
          .from("race_results")
          .select("race_entry_id")
          .in("race_entry_id", uniqueEntryIds),
      ]);

      if (!active) return;

      if (entryError || resultError) {
        console.error(
          "Comparison projection data error:",
          entryError ?? resultError
        );
        return;
      }

      const officialEntryIds = new Set(
        (resultData ?? []).map((row) => String(row.race_entry_id))
      );

      const nextData: Record<
        string,
        { projected_points: number | null; has_official_result: boolean }
      > = {};

      for (const row of entryData ?? []) {
        const id = String(row.id);
        nextData[id] = {
          projected_points:
            row.projected_points == null ? null : Number(row.projected_points),
          has_official_result: officialEntryIds.has(id),
        };
      }

      setEntryProjectionData(nextData);
    }

    void loadProjectionData();

    return () => {
      active = false;
    };
  }, [comparisonData]);

  const availableTeams = comparisonData?.available_teams ?? [];
  const myTeam = comparisonData?.my_team ?? null;
  const opponentTeam = comparisonData?.opponent_team ?? null;

  const filteredAvailableTeams = useMemo(() => {
    const query = opponentSearch.trim().toLowerCase();

    if (!query) {
      return availableTeams;
    }

    return availableTeams.filter((team) => {
      const displayName =
        team.display_name?.trim().toLowerCase() ?? "";
      const teamName =
        team.team_name?.trim().toLowerCase() ?? "";

      return (
        displayName.includes(query) ||
        teamName.includes(query)
      );
    });
  }, [availableTeams, opponentSearch]);

  const selectedOpponent = useMemo(() => {
    return availableTeams.find(
      (team) => team.user_id === selectedOpponentUserId
    );
  }, [availableTeams, selectedOpponentUserId]);

  function selectOpponent(team: AvailableTeam) {
    setSelectedOpponentUserId(team.user_id);
    setOpponentSearch(getTeamLabel(team));
    setOpponentSearchFocused(false);
  }

  function clearOpponent() {
    setSelectedOpponentUserId("");
    setOpponentSearch("");
    setOpponentSearchFocused(false);
  }

  const mySelections = myTeam?.selections ?? [];
  const opponentSelections = opponentTeam?.selections ?? [];

  const myHorseIds = useMemo(() => {
    return new Set(
      mySelections.map((selection) => selection.horse_id)
    );
  }, [mySelections]);

  const opponentHorseIds = useMemo(() => {
    return new Set(
      opponentSelections.map((selection) => selection.horse_id)
    );
  }, [opponentSelections]);

  const sharedHorseIds = useMemo(() => {
    return new Set(
      [...myHorseIds].filter((horseId) =>
        opponentHorseIds.has(horseId)
      )
    );
  }, [myHorseIds, opponentHorseIds]);

  const myUniqueCount = useMemo(() => {
    return [...myHorseIds].filter(
      (horseId) => !opponentHorseIds.has(horseId)
    ).length;
  }, [myHorseIds, opponentHorseIds]);

  const opponentUniqueCount = useMemo(() => {
    return [...opponentHorseIds].filter(
      (horseId) => !myHorseIds.has(horseId)
    ).length;
  }, [myHorseIds, opponentHorseIds]);

  const raceGroups = useMemo(() => {
    const groups = new Map<string, RaceGroup>();

    function ensureGroup(selection: ComparisonSelection) {
      const existing = groups.get(selection.race_id);

      if (existing) {
        return existing;
      }

      const created: RaceGroup = {
        race_id: selection.race_id,
        race_number: selection.race_number,
        race_name: selection.race_name,
        race_grade: selection.race_grade,
        racecourse_name: selection.racecourse_name,
        mySelections: [],
        opponentSelections: [],
      };

      groups.set(selection.race_id, created);

      return created;
    }

    for (const selection of mySelections) {
      ensureGroup(selection).mySelections.push(selection);
    }

    for (const selection of opponentSelections) {
      ensureGroup(selection).opponentSelections.push(selection);
    }

    return [...groups.values()].sort((a, b) => {
      const courseCompare = (
        a.racecourse_name ?? ""
      ).localeCompare(b.racecourse_name ?? "");

      if (courseCompare !== 0) {
        return courseCompare;
      }

      return a.race_number - b.race_number;
    });
  }, [mySelections, opponentSelections]);

  const myScore = Number(myTeam?.score?.total_points ?? 0);
  const opponentScore = Number(
    opponentTeam?.score?.total_points ?? 0
  );

  function getSelectionDisplay(selection: ComparisonSelection) {
    const data = entryProjectionData[selection.race_entry_id];
    const official = data?.has_official_result ?? false;

    if (official) {
      return {
        points: Number(selection.display_points ?? 0),
        label: selection.is_captain ? "points · 2×" : "points",
        projected: false,
      };
    }

    if (data?.projected_points == null) {
      return { points: null, label: "projected", projected: true };
    }

    return {
      points: selection.is_captain
        ? data.projected_points * 2
        : data.projected_points,
      label: selection.is_captain ? "projected · 2×" : "projected",
      projected: true,
    };
  }

  function getLivePoints(selection: ComparisonSelection) {
    const display = getSelectionDisplay(selection);
    return Number(display.points ?? 0);
  }

  const myProjectedScore = mySelections.reduce(
    (total, selection) => total + getLivePoints(selection),
    0
  );

  const opponentProjectedScore = opponentSelections.reduce(
    (total, selection) => total + getLivePoints(selection),
    0
  );

  const scoreDifference = myScore - opponentScore;
  const salaryDifference =
    Number(myTeam?.salary_used ?? 0) -
    Number(opponentTeam?.salary_used ?? 0);

  if (loadingRounds) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-7xl rounded-xl border bg-white p-10 text-center text-slate-500">
          Loading team comparison...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm md:p-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-300">
            Head-to-head
          </p>

          <h1 className="mt-2 text-3xl font-bold md:text-4xl">
            Compare Teams
          </h1>

          <p className="mt-2 max-w-2xl text-slate-300">
            Compare your selections against another manager after
            round lockout.
          </p>
        </header>

        {errorMessage && (
          <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
            {errorMessage}
          </div>
        )}

        <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="comparison-round"
                className="block text-sm font-bold text-slate-800"
              >
                Round
              </label>

              <select
                id="comparison-round"
                value={selectedRoundId}
                onChange={(event) =>
                  setSelectedRoundId(event.target.value)
                }
                disabled={rounds.length === 0}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-teal-700 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                {rounds.length === 0 ? (
                  <option value="">
                    No rounds available after lockout
                  </option>
                ) : (
                  rounds.map((round) => (
                    <option key={round.id} value={round.id}>
                      Round {round.round_number}
                      {round.name ? ` — ${round.name}` : ""}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="comparison-opponent-search"
                  className="block text-sm font-bold text-slate-800"
                >
                  Compare with
                </label>

                {selectedOpponent && (
                  <button
                    type="button"
                    onClick={clearOpponent}
                    className="text-xs font-bold text-teal-700 transition hover:text-slate-950 hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="relative mt-2">
                <input
                  id="comparison-opponent-search"
                  type="search"
                  value={opponentSearch}
                  onChange={(event) => {
                    setOpponentSearch(event.target.value);
                    setOpponentSearchFocused(true);

                    if (
                      selectedOpponent &&
                      event.target.value !== getTeamLabel(selectedOpponent)
                    ) {
                      setSelectedOpponentUserId("");
                    }
                  }}
                  onFocus={() => setOpponentSearchFocused(true)}
                  onBlur={() => {
                    window.setTimeout(
                      () => setOpponentSearchFocused(false),
                      150
                    );
                  }}
                  placeholder="Search by player or team name..."
                  disabled={
                    loadingComparison ||
                    !comparisonData?.locked ||
                    availableTeams.length === 0
                  }
                  autoComplete="off"
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 pr-24 text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-700 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                />

                {opponentSearch.trim() && (
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setOpponentSearch("");
                      setSelectedOpponentUserId("");
                      setOpponentSearchFocused(true);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    Clear
                  </button>
                )}

                {opponentSearchFocused &&
                  opponentSearch.trim() &&
                  !selectedOpponent && (
                    <div className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                      {filteredAvailableTeams.length === 0 ? (
                        <div className="px-4 py-4 text-sm text-slate-500">
                          No teams match “{opponentSearch.trim()}”.
                        </div>
                      ) : (
                        filteredAvailableTeams.slice(0, 12).map((team) => (
                          <button
                            key={team.user_id}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => selectOpponent(team)}
                            className="flex w-full items-center justify-between gap-4 rounded-lg px-3 py-3 text-left transition hover:bg-teal-50"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-bold text-slate-900">
                                {getTeamLabel(team)}
                              </p>

                              {team.team_name?.trim() &&
                                team.display_name?.trim() &&
                                team.team_name.trim() !==
                                  team.display_name.trim() && (
                                  <p className="mt-0.5 truncate text-xs text-slate-500">
                                    {team.team_name}
                                  </p>
                                )}
                            </div>

                            <div className="shrink-0 text-right">
                              {team.round_rank ? (
                                <p className="text-xs font-bold text-teal-700">
                                  Rank #{team.round_rank}
                                </p>
                              ) : null}

                              {team.round_score != null ? (
                                <p className="mt-0.5 text-xs text-slate-500">
                                  {team.round_score} pts
                                </p>
                              ) : null}
                            </div>
                          </button>
                        ))
                      )}

                      {filteredAvailableTeams.length > 12 && (
                        <div className="border-t border-slate-100 px-3 py-2 text-center text-xs text-slate-500">
                          Type more to narrow {filteredAvailableTeams.length} matches.
                        </div>
                      )}
                    </div>
                  )}
              </div>

              <div className="mt-2 flex items-center gap-2">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  or select
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <select
                id="comparison-opponent"
                value={selectedOpponentUserId}
                onChange={(event) => {
                  const nextUserId = event.target.value;
                  setSelectedOpponentUserId(nextUserId);

                  const nextTeam = availableTeams.find(
                    (team) => team.user_id === nextUserId
                  );

                  setOpponentSearch(
                    nextTeam ? getTeamLabel(nextTeam) : ""
                  );
                }}
                disabled={
                  loadingComparison ||
                  !comparisonData?.locked ||
                  availableTeams.length === 0
                }
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option value="">
                  {loadingComparison
                    ? "Loading teams..."
                    : availableTeams.length === 0
                      ? "No teams available"
                      : "Choose from all teams"}
                </option>

                {availableTeams.map((team) => (
                  <option
                    key={team.user_id}
                    value={team.user_id}
                  >
                    {getTeamLabel(team)}
                    {team.round_rank
                      ? ` — Rank #${team.round_rank}`
                      : ""}
                  </option>
                ))}
              </select>

              {selectedOpponent && (
                <div className="mt-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wide text-teal-700">
                        Selected opponent
                      </p>
                      <p className="mt-1 truncate font-bold text-slate-900">
                        {getTeamLabel(selectedOpponent)}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      {selectedOpponent.round_rank ? (
                        <p className="font-bold text-teal-800">
                          #{selectedOpponent.round_rank}
                        </p>
                      ) : null}
                      {selectedOpponent.round_score != null ? (
                        <p className="text-xs text-slate-600">
                          {selectedOpponent.round_score} pts
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {comparisonData?.round && (
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
              <span>
                Round {comparisonData.round.round_number}
              </span>

              <span>•</span>

              <span>
                Lockout:{" "}
                {formatDateTime(
                  comparisonData.round.lockout_at
                )}
              </span>

              <span>•</span>

              <span className="capitalize">
                {comparisonData.round.status}
              </span>
            </div>
          )}
        </section>

        {rounds.length === 0 && (
          <section className="mt-6 rounded-2xl border bg-white p-10 text-center shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">
              Comparison unavailable
            </h2>

            <p className="mt-3 text-slate-600">
              Teams can only be compared after a round has reached
              lockout.
            </p>
          </section>
        )}

        {comparisonData &&
          !comparisonData.locked &&
          rounds.length > 0 && (
            <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
              <h2 className="text-2xl font-bold text-slate-900">
                Teams are still private
              </h2>

              <p className="mt-3 text-amber-900">
                {comparisonData.message ||
                  "Team comparison becomes available after lockout."}
              </p>
            </section>
          )}

        {comparisonData?.locked && !myTeam && (
          <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900">
              No eligible team found
            </h2>

            <p className="mt-3 text-amber-900">
              You need a submitted, locked or scored team in this
              round before you can compare it.
            </p>
          </section>
        )}

        {comparisonData?.locked &&
          myTeam &&
          availableTeams.length === 0 && (
            <section className="mt-6 rounded-2xl border bg-white p-8 text-center shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">
                No opponents available
              </h2>

              <p className="mt-3 text-slate-600">
                No other eligible teams are available for this round.
              </p>
            </section>
          )}

        {loadingComparison &&
          selectedOpponentUserId && (
            <section className="mt-6 rounded-2xl border bg-white p-10 text-center text-slate-500 shadow-sm">
              Loading comparison...
            </section>
          )}

        {!loadingComparison && myTeam && opponentTeam && (
          <>
            <section className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                  Your Team
                </p>

                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  {myTeam.team_name?.trim() || "My Team"}
                </h2>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Current Score
                    </p>

                    <p className="mt-1 text-3xl font-bold text-slate-900">
                      {myScore}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Rank
                    </p>

                    <p className="mt-1 text-3xl font-bold text-slate-900">
                      {getRankDisplay(myTeam.score?.round_rank)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Salary Used
                    </p>

                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {formatCurrency(myTeam.salary_used)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Projected Score
                    </p>
                    <p className="mt-1 text-3xl font-bold text-slate-900">
                      {myProjectedScore}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-wide text-orange-700">
                  Opponent
                </p>

                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  {selectedOpponent?.display_name?.trim() ||
                    opponentTeam.team_name?.trim() ||
                    "Opponent"}
                </h2>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Current Score
                    </p>

                    <p className="mt-1 text-3xl font-bold text-slate-900">
                      {opponentScore}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Rank
                    </p>

                    <p className="mt-1 text-3xl font-bold text-slate-900">
                      {getRankDisplay(
                        opponentTeam.score?.round_rank
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Salary Used
                    </p>

                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {formatCurrency(opponentTeam.salary_used)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Projected Score
                    </p>
                    <p className="mt-1 text-3xl font-bold text-slate-900">
                      {opponentProjectedScore}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Shared Horses
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {sharedHorseIds.size}
                </p>
              </div>

              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Different Horses
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {myUniqueCount}
                </p>
              </div>

              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Score Difference
                </p>

                <p
                  className={`mt-2 text-3xl font-bold ${
                    scoreDifference > 0
                      ? "text-green-700"
                      : scoreDifference < 0
                        ? "text-red-700"
                        : "text-slate-900"
                  }`}
                >
                  {formatSignedNumber(scoreDifference)}
                </p>
              </div>

              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Salary Difference
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {formatSignedCurrency(salaryDifference)}
                </p>
              </div>
            </section>

            <section className="mt-8">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-slate-900">
                  Horse Comparison
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  Green selections are shared. Blue selections are
                  unique to you. Orange selections are unique to your
                  opponent.
                </p>
              </div>

              <div className="space-y-5">
                {raceGroups.map((group) => (
                  <article
                    key={group.race_id}
                    className="overflow-hidden rounded-2xl border bg-white shadow-sm"
                  >
                    <div className="border-b bg-slate-900 p-5 text-white">
                      <p className="text-sm font-semibold text-teal-300">
                        {group.racecourse_name ?? "Racecourse"} R
                        {group.race_number}
                      </p>

                      <h3 className="mt-1 text-xl font-bold">
                        {group.race_name}
                      </h3>

                      <p className="mt-1 text-sm text-slate-300">
                        {getGradeLabel(group.race_grade)}
                      </p>
                    </div>

                    <div className="grid lg:grid-cols-2">
                      <div className="border-b p-5 lg:border-b-0 lg:border-r">
                        <p className="mb-3 text-sm font-bold uppercase tracking-wide text-blue-700">
                          Your selections
                        </p>

                        {group.mySelections.length === 0 ? (
                          <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-500">
                            No selection in this race.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {group.mySelections.map((selection) => {
                              const shared = sharedHorseIds.has(
                                selection.horse_id
                              );

                              const displayed =
                                getSelectionDisplay(selection);

                              return (
                                <div
                                  key={selection.race_entry_id}
                                  className={`rounded-xl border p-4 ${
                                    shared
                                      ? "border-green-200 bg-green-50"
                                      : "border-blue-200 bg-blue-50"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Link
                                          href={`/horses/${selection.horse_id}`}
                                          className="truncate font-bold text-slate-900 hover:text-teal-700"
                                        >
                                          {selection.horse_name}
                                        </Link>

                                        {selection.is_captain && (
                                          <span className="rounded-full bg-amber-200 px-2 py-1 text-xs font-bold text-amber-900">
                                            Captain
                                          </span>
                                        )}

                                        {shared && (
                                          <span className="rounded-full bg-green-200 px-2 py-1 text-xs font-bold text-green-900">
                                            Shared
                                          </span>
                                        )}
                                      </div>

                                      <p className="mt-1 text-sm text-slate-600">
                                        {formatCurrency(
                                          selection.selected_price
                                        )}
                                      </p>
                                    </div>

                                    <div className="text-right">
                                      <p
                                        className={`text-xl font-bold ${
                                          displayed.projected
                                            ? "text-amber-700"
                                            : "text-slate-900"
                                        }`}
                                      >
                                        {displayed.points ?? "—"}
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        {displayed.label}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="p-5">
                        <p className="mb-3 text-sm font-bold uppercase tracking-wide text-orange-700">
                          Opponent selections
                        </p>

                        {group.opponentSelections.length === 0 ? (
                          <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-500">
                            No selection in this race.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {group.opponentSelections.map(
                              (selection) => {
                                const shared = sharedHorseIds.has(
                                  selection.horse_id
                                );

                              const displayed =
                                getSelectionDisplay(selection);

                                return (
                                  <div
                                    key={selection.race_entry_id}
                                    className={`rounded-xl border p-4 ${
                                      shared
                                        ? "border-green-200 bg-green-50"
                                        : "border-orange-200 bg-orange-50"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Link
                                            href={`/horses/${selection.horse_id}`}
                                            className="truncate font-bold text-slate-900 hover:text-teal-700"
                                          >
                                            {selection.horse_name}
                                          </Link>

                                          {selection.is_captain && (
                                            <span className="rounded-full bg-amber-200 px-2 py-1 text-xs font-bold text-amber-900">
                                              Captain
                                            </span>
                                          )}

                                          {shared && (
                                            <span className="rounded-full bg-green-200 px-2 py-1 text-xs font-bold text-green-900">
                                              Shared
                                            </span>
                                          )}
                                        </div>

                                        <p className="mt-1 text-sm text-slate-600">
                                          {formatCurrency(
                                            selection.selected_price
                                          )}
                                        </p>
                                      </div>

                                      <div className="text-right">
                                      <p
                                        className={`text-xl font-bold ${
                                          displayed.projected
                                            ? "text-amber-700"
                                            : "text-slate-900"
                                        }`}
                                      >
                                        {displayed.points ?? "—"}
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        {displayed.label}
                                      </p>
                                    </div>
                                    </div>
                                  </div>
                                );
                              }
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        {!loadingComparison &&
          comparisonData?.locked &&
          myTeam &&
          !opponentTeam &&
          availableTeams.length > 0 && (
            <section className="mt-6 rounded-2xl border bg-white p-10 text-center shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">
                Select an opponent
              </h2>

              <p className="mt-3 text-slate-600">
                Choose another team above to begin the comparison.
              </p>
            </section>
          )}
      </div>
    </main>
  );
}