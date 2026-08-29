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
  silks_url?: string | null;
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
  autofilled_horse_count?: number;
  autofill_penalty?: number;
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

async function hydrateAutofillPenalties(
  data: ComparisonData
): Promise<ComparisonData> {
  const teamIds = [
    data.my_team?.id,
    data.opponent_team?.id,
  ].filter(Boolean) as string[];

  if (teamIds.length === 0) {
    return data;
  }

  const { data: autofillRows, error: autofillError } =
    await supabase
      .from("teams")
      .select("id, autofilled_horse_count")
      .in("id", teamIds);

  if (autofillError) {
    console.error(
      "Compare teams autofill penalty load error:",
      autofillError
    );
    return data;
  }

  const autofillByTeamId = new Map(
    (autofillRows ?? []).map((row: any) => [
      String(row.id),
      Math.max(0, Number(row.autofilled_horse_count ?? 0)),
    ])
  );

  const hydrateTeam = (
    team: ComparisonTeam | null
  ): ComparisonTeam | null => {
    if (!team) {
      return null;
    }

    const count = autofillByTeamId.get(team.id) ?? 0;

    return {
      ...team,
      autofilled_horse_count: count,
      autofill_penalty: count * 3,
    };
  };

  return {
    ...data,
    my_team: hydrateTeam(data.my_team),
    opponent_team: hydrateTeam(data.opponent_team),
  };
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
  const [showHorseSilks, setShowHorseSilks] = useState(true);
  const [entryProjectionData, setEntryProjectionData] = useState<
    Record<string, { projected_points: number | null; has_official_result: boolean }>
  >({});

  useEffect(() => {
    let active = true;

    async function loadSiteSettings() {
      const { data, error } = await supabase.rpc(
        "get_public_site_settings"
      );

      if (!active) {
        return;
      }

      if (error) {
        console.error(
          "Compare teams site settings load error:",
          error
        );
        return;
      }

      const settings =
        data && typeof data === "object"
          ? (data as {
              show_horse_silks?: boolean;
            })
          : null;

      setShowHorseSilks(
        settings?.show_horse_silks !== false
      );
    }

    void loadSiteSettings();

    return () => {
      active = false;
    };
  }, []);

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

      const comparison =
        await hydrateAutofillPenalties(
          data as ComparisonData
        );

      if (!active) {
        return;
      }

      setComparisonData(comparison);
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

      const comparison =
        await hydrateAutofillPenalties(
          data as ComparisonData
        );

      if (!active) {
        return;
      }

      setComparisonData(comparison);
      setLoadingComparison(false);
    }

    void loadComparison();

    return () => {
      active = false;
    };
  }, [selectedOpponentUserId, selectedRoundId]);

  useEffect(() => {
    if (!showHorseSilks || !comparisonData) {
      return;
    }

    const selections = [
      ...(comparisonData.my_team?.selections ?? []),
      ...(comparisonData.opponent_team?.selections ?? []),
    ];

    const horseIds = [
      ...new Set(
        selections
          .map((selection) => selection.horse_id)
          .filter(Boolean)
      ),
    ];

    if (horseIds.length === 0) {
      return;
    }

    let active = true;

    async function loadHorseSilks() {
      const { data, error } = await supabase
        .from("horses")
        .select("id, silks_url")
        .in("id", horseIds);

      if (!active) {
        return;
      }

      if (error) {
        console.error(
          "Compare teams horse silks load error:",
          error
        );
        return;
      }

      const silksByHorseId = new Map(
        (data ?? []).map((horse: any) => [
          String(horse.id),
          horse.silks_url ?? null,
        ])
      );

      setComparisonData((current) => {
        if (!current) {
          return current;
        }

        const hydrateSelections = (
          rows: ComparisonSelection[] | undefined
        ) =>
          (rows ?? []).map((selection) => ({
            ...selection,
            silks_url:
              silksByHorseId.get(selection.horse_id) ?? null,
          }));

        return {
          ...current,
          my_team: current.my_team
            ? {
                ...current.my_team,
                selections: hydrateSelections(
                  current.my_team.selections
                ),
              }
            : null,
          opponent_team: current.opponent_team
            ? {
                ...current.opponent_team,
                selections: hydrateSelections(
                  current.opponent_team.selections
                ),
              }
            : null,
        };
      });
    }

    void loadHorseSilks();

    return () => {
      active = false;
    };
  }, [
    showHorseSilks,
    comparisonData?.my_team?.id,
    comparisonData?.opponent_team?.id,
  ]);

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

  const myAutofilledHorseCount = Math.max(
    0,
    Number(myTeam?.autofilled_horse_count ?? 0)
  );
  const opponentAutofilledHorseCount = Math.max(
    0,
    Number(opponentTeam?.autofilled_horse_count ?? 0)
  );

  const myAutofillPenalty =
    Number(myTeam?.autofill_penalty ?? 0) ||
    myAutofilledHorseCount * 3;

  const opponentAutofillPenalty =
    Number(opponentTeam?.autofill_penalty ?? 0) ||
    opponentAutofilledHorseCount * 3;

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

  const myProjectedScoreAfterPenalty =
    myProjectedScore - myAutofillPenalty;

  const opponentProjectedScoreAfterPenalty =
    opponentProjectedScore - opponentAutofillPenalty;

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
    <main className="min-h-screen bg-slate-100 p-3 md:p-5">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-xl bg-slate-900 p-4 text-white shadow-sm md:p-5">
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-300">
            Head-to-head
          </p>

          <h1 className="mt-1 text-2xl font-bold md:text-3xl">
            Compare Teams
          </h1>

          <p className="mt-1 max-w-2xl text-sm text-slate-300">
            Compare your selections against another manager after
            round lockout.
          </p>
        </header>

        {errorMessage && (
          <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
            {errorMessage}
          </div>
        )}

        <section className="mt-3 rounded-xl border bg-white p-3 shadow-sm">
          <div className="grid gap-2 md:grid-cols-[220px_1fr]">
            <div>
              <label
                htmlFor="comparison-round"
                className="block text-[11px] font-black uppercase tracking-wide text-slate-500"
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
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-700 disabled:cursor-not-allowed disabled:bg-slate-100"
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
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="comparison-opponent-search"
                  className="block text-[11px] font-black uppercase tracking-wide text-slate-500"
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
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-16 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-700 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
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

              <div className="mt-1.5 flex items-center gap-2">
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
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
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
                <div className="mt-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wide text-teal-700">
                        Selected opponent
                      </p>
                      <p className="mt-0.5 truncate text-sm font-bold text-slate-900">
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
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
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
            <section className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-white shadow-lg">
              <div className="border-b border-slate-800 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-300">
                      Official Head-to-Head
                    </p>
                    <h2 className="mt-0.5 text-lg font-black sm:text-xl">
                      Round {comparisonData?.round?.round_number ?? "—"}
                      {comparisonData?.round?.name
                        ? ` · ${comparisonData.round.name}`
                        : ""}
                    </h2>
                  </div>

                  <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-slate-300">
                    {comparisonData?.round?.status ?? "Locked"}
                  </span>
                </div>
              </div>

              <div className="grid lg:grid-cols-[1fr_auto_1fr]">
                <div className="p-4 lg:text-right">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Your Team
                  </p>

                  <h3 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
                    {myTeam.team_name?.trim() || "My Team"}
                  </h3>

                  <div className="mt-2 flex flex-wrap gap-1.5 lg:justify-end">
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-slate-300">
                      Rank {getRankDisplay(myTeam.score?.round_rank)}
                    </span>
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-slate-300">
                      {formatCurrency(myTeam.salary_used)}
                    </span>
                    {myAutofillPenalty > 0 && (
                      <span className="rounded-full bg-red-950/70 px-3 py-1 text-xs font-bold text-red-200 ring-1 ring-inset ring-red-800">
                        Autofill −{myAutofillPenalty} pts
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-center border-y border-slate-800 bg-slate-900 px-4 py-4 lg:border-x lg:border-y-0">
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                      Current Score
                    </p>

                    <div className="mt-1 flex items-center justify-center gap-3">
                      <span className="text-3xl font-black tabular-nums sm:text-4xl">
                        {myScore}
                      </span>

                      <span className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
                        vs
                      </span>

                      <span className="text-3xl font-black tabular-nums sm:text-4xl">
                        {opponentScore}
                      </span>
                    </div>

                    {(myAutofillPenalty > 0 ||
                      opponentAutofillPenalty > 0) && (
                      <div className="mt-2 flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-wide text-red-300">
                        <span>
                          {myAutofillPenalty > 0
                            ? `−${myAutofillPenalty} autofill`
                            : "No penalty"}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span>
                          {opponentAutofillPenalty > 0
                            ? `−${opponentAutofillPenalty} autofill`
                            : "No penalty"}
                        </span>
                      </div>
                    )}

                    <p className="mt-1.5 text-[11px] font-semibold text-slate-400">
                      Projected {myProjectedScoreAfterPenalty} –{" "}
                      {opponentProjectedScoreAfterPenalty}
                    </p>
                  </div>
                </div>

                <div className="p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Opponent
                  </p>

                  <h3 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
                    {selectedOpponent?.display_name?.trim() ||
                      opponentTeam.team_name?.trim() ||
                      "Opponent"}
                  </h3>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-slate-300">
                      Rank {getRankDisplay(opponentTeam.score?.round_rank)}
                    </span>
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-slate-300">
                      {formatCurrency(opponentTeam.salary_used)}
                    </span>
                    {opponentAutofillPenalty > 0 && (
                      <span className="rounded-full bg-red-950/70 px-3 py-1 text-xs font-bold text-red-200 ring-1 ring-inset ring-red-800">
                        Autofill −{opponentAutofillPenalty} pts
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {(myAutofillPenalty > 0 ||
              opponentAutofillPenalty > 0) && (
              <section className="mt-3 grid overflow-hidden rounded-xl border border-red-200 bg-red-50 shadow-sm sm:grid-cols-2">
                <div className="border-b border-red-200 p-4 sm:border-b-0 sm:border-r">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-red-700">
                    Your Autofill Penalty
                  </p>
                  <p className="mt-1 text-sm font-bold text-red-900">
                    {myAutofillPenalty > 0
                      ? `${myAutofilledHorseCount} × 3 pts = −${myAutofillPenalty} pts`
                      : "No autofill penalty"}
                  </p>
                </div>

                <div className="p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-red-700">
                    Opponent Autofill Penalty
                  </p>
                  <p className="mt-1 text-sm font-bold text-red-900">
                    {opponentAutofillPenalty > 0
                      ? `${opponentAutofilledHorseCount} × 3 pts = −${opponentAutofillPenalty} pts`
                      : "No autofill penalty"}
                  </p>
                </div>
              </section>
            )}

            <section className="mt-3 grid overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:grid-cols-2 xl:grid-cols-4">
              <div className="border-b border-slate-200 p-4 sm:border-b-0 sm:border-r">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Shared Horses
                </p>
                <p className="mt-2 text-3xl font-black text-slate-950">
                  {sharedHorseIds.size}
                </p>
              </div>

              <div className="border-b border-slate-200 p-4 xl:border-b-0 xl:border-r">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Captains
                </p>

                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      You
                    </span>
                    <span className="truncate text-right text-sm font-black text-slate-950">
                      {mySelections.find(
                        (selection) => selection.is_captain
                      )?.horse_name ?? "—"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Opponent
                    </span>
                    <span className="truncate text-right text-sm font-black text-slate-950">
                      {opponentSelections.find(
                        (selection) => selection.is_captain
                      )?.horse_name ?? "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-b border-slate-200 p-4 sm:border-b-0 sm:border-r">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Score Margin
                </p>

                <p
                  className={`mt-2 text-3xl font-black ${
                    scoreDifference > 0
                      ? "text-emerald-700"
                      : scoreDifference < 0
                        ? "text-red-700"
                        : "text-slate-950"
                  }`}
                >
                  {formatSignedNumber(scoreDifference)}
                </p>
              </div>

              <div className="p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Salary Margin
                </p>
                <p className="mt-2 text-3xl font-black text-slate-950">
                  {formatSignedCurrency(salaryDifference)}
                </p>
              </div>
            </section>

            <section className="mt-5">
              <div className="mb-3 flex flex-col gap-2 border-b border-slate-300 pb-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">
                    Team Sheets
                  </p>
                  <h2 className="mt-0.5 text-xl font-black text-slate-950">
                    Horse-by-Horse Comparison
                  </h2>
                </div>

                <div className="flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">
                    Shared
                  </span>
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-800">
                    Your unique
                  </span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-900">
                    Captain
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {raceGroups.map((group) => (
                  <article
                    key={group.race_id}
                    className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm"
                  >
                    <div className="border-b border-slate-800 bg-slate-950 px-4 py-2.5 text-white">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-teal-300">
                            {group.racecourse_name ?? "Racecourse"} · Race {group.race_number}
                          </p>

                          <h3 className="mt-0.5 text-lg font-black">
                            {group.race_name}
                          </h3>
                        </div>

                        <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-bold text-slate-300">
                          {getGradeLabel(group.race_grade)}
                        </span>
                      </div>
                    </div>

                    <div className="grid lg:grid-cols-2">
                      <div className="border-b border-slate-200 p-3.5 lg:border-b-0 lg:border-r">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                            Your Team Sheet
                          </p>
                          <span className="text-xs font-bold text-slate-400">
                            {group.mySelections.length} selected
                          </span>
                        </div>

                        {group.mySelections.length === 0 ? (
                          <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-500">
                            No selection in this race.
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {group.mySelections.map((selection) => {
                              const shared = sharedHorseIds.has(
                                selection.horse_id
                              );

                              const displayed =
                                getSelectionDisplay(selection);

                              return (
                                <div
                                  key={selection.race_entry_id}
                                  className={`rounded-lg border px-3 py-2 ${
                                    shared
                                      ? "border-emerald-200 bg-emerald-50"
                                      : "border-slate-200 bg-white"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-4">
                                    <div className="flex min-w-0 items-stretch gap-2.5">
                                      {showHorseSilks &&
                                        selection.silks_url && (
                                          <div className="flex w-10 shrink-0 items-center justify-center self-stretch">
                                            <img
                                              src={selection.silks_url}
                                              alt={`${selection.horse_name} silks`}
                                              className="h-full max-h-12 w-full object-contain"
                                            />
                                          </div>
                                        )}

                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Link
                                            href={`/horses/${selection.horse_id}`}
                                            className="truncate font-black text-slate-900 transition hover:text-teal-700"
                                          >
                                            {selection.horse_name}
                                          </Link>

                                          {selection.is_captain && (
                                            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-900">
                                              Captain
                                            </span>
                                          )}

                                          {shared && (
                                            <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-900">
                                              Shared
                                            </span>
                                          )}
                                        </div>

                                        <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                                          {formatCurrency(
                                            selection.selected_price
                                          )}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="shrink-0 text-right">
                                      <p
                                        className={`text-lg font-black tabular-nums ${
                                          displayed.projected
                                            ? "text-amber-700"
                                            : "text-slate-950"
                                        }`}
                                      >
                                        {displayed.points ?? "—"}
                                      </p>
                                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
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

                      <div className="p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-700">
                            Opponent Team Sheet
                          </p>
                          <span className="text-xs font-bold text-slate-400">
                            {group.opponentSelections.length} selected
                          </span>
                        </div>

                        {group.opponentSelections.length === 0 ? (
                          <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-500">
                            No selection in this race.
                          </p>
                        ) : (
                          <div className="space-y-1.5">
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
                                    className={`rounded-lg border px-3 py-2 ${
                                      shared
                                        ? "border-emerald-200 bg-emerald-50"
                                        : "border-slate-200 bg-white"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-4">
                                      <div className="flex min-w-0 items-stretch gap-2.5">
                                        {showHorseSilks &&
                                          selection.silks_url && (
                                            <div className="flex w-10 shrink-0 items-center justify-center self-stretch">
                                              <img
                                                src={selection.silks_url}
                                                alt={`${selection.horse_name} silks`}
                                                className="h-full max-h-12 w-full object-contain"
                                              />
                                            </div>
                                          )}

                                        <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <Link
                                              href={`/horses/${selection.horse_id}`}
                                              className="truncate font-black text-slate-900 transition hover:text-teal-700"
                                            >
                                              {selection.horse_name}
                                            </Link>

                                            {selection.is_captain && (
                                              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-900">
                                                Captain
                                              </span>
                                            )}

                                            {shared && (
                                              <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-900">
                                                Shared
                                              </span>
                                            )}
                                          </div>

                                          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                                            {formatCurrency(
                                              selection.selected_price
                                            )}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="shrink-0 text-right">
                                        <p
                                          className={`text-lg font-black tabular-nums ${
                                            displayed.projected
                                              ? "text-amber-700"
                                              : "text-slate-950"
                                          }`}
                                        >
                                          {displayed.points ?? "—"}
                                        </p>
                                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
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