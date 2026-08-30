"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LineChart, X } from "lucide-react";

import { supabase } from "@/lib/supabase";

type SeasonOption = {
  id: string;
  name: string;
  year: number;
  is_active: boolean;
};

type SeasonScore = {
  total_points: number;
  rounds_played: number;
  round_wins: number;
  highest_round_score: number;
  top_ten_finishes: number;
  overall_rank: number | null;
};

type HistorySelection = {
  race_entry_id: string;
  horse_id: string;
  horse_name: string;
  silks_url?: string | null;
  is_captain: boolean;
  selected_price: number;
  fantasy_points: number;
  race_name: string;
  race_number: number;
  race_grade: "L" | "G3" | "G2" | "G1";
  racecourse_name: string | null;
  finishing_position: number | null;
  result_status: string | null;
  is_dead_heat: boolean;
};

type RoundHistory = {
  round_id: string;
  round_number: number;
  round_name: string | null;
  round_status: string;

  team_id: string;
  team_status: string;

  salary_cap: number;
  salary_used: number;

  round_score: number;
  captain_points: number;
  round_rank: number | null;
  autofilled_horse_count?: number;
  autofill_penalty?: number;

  price_movement: number;
  next_round_salary_cap: number;
  total_races?: number;

  selections: HistorySelection[];
};

type SeasonHistoryData = {
  success: boolean;
  season_id: string | null;
  season_score: SeasonScore | null;
  rounds: RoundHistory[];
  message?: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
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

function getRankDisplay(rank: number | null) {
  if (!rank || rank <= 0) {
    return "—";
  }

  return `#${rank}`;
}

function getGradeLabel(grade: HistorySelection["race_grade"]) {
  const labels: Record<HistorySelection["race_grade"], string> = {
    L: "Listed",
    G3: "Group 3",
    G2: "Group 2",
    G1: "Group 1",
  };

  return labels[grade];
}

function getFinishLabel(selection: HistorySelection) {
  const status = selection.result_status;

  if (status === "scratched") {
    return "SCR";
  }

  if (
    status === "non_finisher" ||
    status === "did_not_finish" ||
    status === "dnf"
  ) {
    return "DNF";
  }

  const position = selection.finishing_position;

  if (!position || position <= 0) {
    return "—";
  }

  const lastTwoDigits = position % 100;
  const lastDigit = position % 10;

  let suffix = "th";

  if (lastTwoDigits < 11 || lastTwoDigits > 13) {
    if (lastDigit === 1) suffix = "st";
    if (lastDigit === 2) suffix = "nd";
    if (lastDigit === 3) suffix = "rd";
  }

  return `${position}${suffix}${selection.is_dead_heat ? " DH" : ""}`;
}

function getFinishClasses(selection: HistorySelection) {
  const status = selection.result_status;
  const position = selection.finishing_position;

  if (
    status === "scratched" ||
    status === "non_finisher" ||
    status === "did_not_finish" ||
    status === "dnf"
  ) {
    return "bg-red-100 text-red-800";
  }

  if (position === 1) {
    return "bg-amber-200 text-amber-950";
  }

  if (position === 2) {
    return "bg-slate-200 text-slate-800";
  }

  if (position === 3) {
    return "bg-orange-100 text-orange-900";
  }

  if (position && position <= 10) {
    return "bg-blue-50 text-blue-800";
  }

  return "bg-slate-100 text-slate-700";
}


type ProgressPoint = {
  round_number: number;
  label: string;
  value: number;
};

function ProgressChart({
  title,
  description,
  points,
  formatValue,
  invert = false,
}: {
  title: string;
  description: string;
  points: ProgressPoint[];
  formatValue: (value: number) => string;
  invert?: boolean;
}) {
  const width = 640;
  const height = 230;
  const left = 58;
  const right = 18;
  const top = 20;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  if (points.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
        <p className="mt-8 text-sm text-slate-400">
          No completed round data yet.
        </p>
      </div>
    );
  }

  const values = points.map((point) => point.value);
  let minValue = Math.min(...values);
  let maxValue = Math.max(...values);

  if (minValue === maxValue) {
    const padding = Math.max(Math.abs(minValue) * 0.08, 1);
    minValue -= padding;
    maxValue += padding;
  } else {
    const padding = (maxValue - minValue) * 0.12;
    minValue -= padding;
    maxValue += padding;
  }

  if (!invert && minValue > 0) {
    minValue = Math.max(0, minValue);
  }

  const xFor = (index: number) =>
    points.length === 1
      ? left + plotWidth / 2
      : left + (index / (points.length - 1)) * plotWidth;

  const yFor = (value: number) => {
    const ratio = (value - minValue) / (maxValue - minValue);
    const visualRatio = invert ? ratio : 1 - ratio;
    return top + visualRatio * plotHeight;
  };

  const polyline = points
    .map(
      (point, index) =>
        `${xFor(index)},${yFor(point.value)}`
    )
    .join(" ");

  const yTicks = Array.from({ length: 4 }, (_, index) => {
    const ratio = index / 3;
    const value = invert
      ? minValue + ratio * (maxValue - minValue)
      : maxValue - ratio * (maxValue - minValue);

    return {
      y: top + ratio * plotHeight,
      value,
    };
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>

      <div className="mt-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto min-w-[520px] w-full"
          role="img"
          aria-label={title}
        >
          {yTicks.map((tick, index) => (
            <g key={index}>
              <line
                x1={left}
                x2={width - right}
                y1={tick.y}
                y2={tick.y}
                stroke="currentColor"
                className="text-slate-200"
                strokeWidth="1"
              />
              <text
                x={left - 10}
                y={tick.y + 4}
                textAnchor="end"
                className="fill-slate-500 text-[11px]"
              >
                {formatValue(Math.round(tick.value))}
              </text>
            </g>
          ))}

          <polyline
            points={polyline}
            fill="none"
            stroke="currentColor"
            className="text-teal-700"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {points.map((point, index) => {
            const x = xFor(index);
            const y = yFor(point.value);

            return (
              <g key={`${point.round_number}-${point.value}`}>
                <circle
                  cx={x}
                  cy={y}
                  r="5"
                  fill="currentColor"
                  className="text-teal-700"
                >
                  <title>
                    {point.label}: {formatValue(point.value)}
                  </title>
                </circle>

                <text
                  x={x}
                  y={height - 14}
                  textAnchor="middle"
                  className="fill-slate-500 text-[11px] font-semibold"
                >
                  R{point.round_number}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>Round 1</span>
        <span className="font-semibold text-slate-700">
          Latest: {formatValue(points[points.length - 1].value)}
        </span>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [historyData, setHistoryData] =
    useState<SeasonHistoryData | null>(null);

  const [expandedRoundIds, setExpandedRoundIds] = useState<Set<string>>(
    new Set()
  );

  const [errorMessage, setErrorMessage] = useState("");
  const [showHorseSilks, setShowHorseSilks] = useState(true);
  const [activeGraph, setActiveGraph] = useState<
    "score" | "rank" | "salary" | null
  >(null);
  const [overallRankHistory, setOverallRankHistory] = useState<
    Record<number, number>
  >({});

  useEffect(() => {
    let active = true;

    async function loadHorseSilksSetting() {
      const { data, error } = await supabase.rpc(
        "get_public_site_settings"
      );

      if (!active) return;

      if (error) {
        console.error(
          "Horse silks setting load error:",
          error
        );
        setShowHorseSilks(true);
        return;
      }

      const settings =
        data && typeof data === "object"
          ? (data as { show_horse_silks?: boolean })
          : null;

      setShowHorseSilks(
        settings?.show_horse_silks !== false
      );
    }

    void loadHorseSilksSetting();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadPage() {
      setLoading(true);
      setErrorMessage("");

      const { data: seasonsData, error: seasonsError } =
        await supabase
          .from("seasons")
          .select("id, name, year, is_active")
          .order("year", { ascending: false });

      if (!active) {
        return;
      }

      if (seasonsError) {
        console.error(
          "My Season seasons error:",
          seasonsError
        );

        setErrorMessage(
          seasonsError.message ||
            "The season list could not be loaded."
        );
        setLoading(false);
        return;
      }

      const loadedSeasons =
        (seasonsData ?? []) as SeasonOption[];

      setSeasons(loadedSeasons);

      const preferredSeason =
        loadedSeasons.find(
          (season) => season.is_active
        ) ?? loadedSeasons[0];

      if (!preferredSeason) {
        setHistoryData(null);
        setSelectedSeasonId("");
        setLoading(false);
        return;
      }

      setSelectedSeasonId(preferredSeason.id);
      await loadHistoryForSeason(preferredSeason.id);
    }

    async function loadHistoryForSeason(seasonId: string) {
      setLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase.rpc(
        "get_my_season_history",
        {
          p_season_id: seasonId,
        }
      );

      if (!active) {
        return;
      }

      if (error) {
        console.error(
          "Season history RPC error:",
          error
        );

        setErrorMessage(
          error.message ||
            "Your season history could not be loaded."
        );

        setHistoryData(null);
        setLoading(false);
        return;
      }

      const loadedData =
        data as SeasonHistoryData | null;

      const loadedRounds =
        loadedData?.rounds ?? [];

      const roundIds = loadedRounds.map(
        (round) => round.round_id
      );

      let roundsWithRaceCounts =
        loadedRounds;

      if (roundIds.length > 0) {
        const {
          data: raceCountData,
          error: raceCountError,
        } = await supabase
          .from("races")
          .select("round_id")
          .in("round_id", roundIds);

        if (!active) {
          return;
        }

        if (raceCountError) {
          console.error(
            "Season history race count error:",
            raceCountError
          );
        } else {
          const raceCounts = (
            raceCountData ?? []
          ).reduce(
            (
              counts: Record<string, number>,
              race
            ) => {
              const roundId =
                String(race.round_id);

              counts[roundId] =
                (counts[roundId] ?? 0) + 1;

              return counts;
            },
            {}
          );

          roundsWithRaceCounts =
            loadedRounds.map((round) => ({
              ...round,
              total_races:
                raceCounts[round.round_id] ?? 0,
            }));
        }
      }

      let roundsWithAutofillPenalty =
        roundsWithRaceCounts;

      const teamIds = roundsWithRaceCounts
        .map((round) => round.team_id)
        .filter(Boolean);

      if (teamIds.length > 0) {
        const {
          data: teamPenaltyData,
          error: teamPenaltyError,
        } = await supabase
          .from("teams")
          .select("id, autofilled_horse_count")
          .in("id", teamIds);

        if (!active) {
          return;
        }

        if (teamPenaltyError) {
          console.error(
            "Season history autofill penalty error:",
            teamPenaltyError
          );
        } else {
          const autofillByTeamId = new Map(
            (teamPenaltyData ?? []).map((team: any) => [
              String(team.id),
              Number(team.autofilled_horse_count ?? 0),
            ])
          );

          roundsWithAutofillPenalty =
            roundsWithRaceCounts.map((round) => {
              const autofilledHorseCount =
                autofillByTeamId.get(round.team_id) ?? 0;

              return {
                ...round,
                autofilled_horse_count:
                  autofilledHorseCount,
                autofill_penalty:
                  autofilledHorseCount * 3,
              };
            });
        }
      }

      const roundsWithSilks =
        await hydrateRoundSilks(
          roundsWithAutofillPenalty
        );

      const hydratedData = loadedData
        ? {
            ...loadedData,
            rounds: roundsWithSilks,
          }
        : null;

      setHistoryData(hydratedData);

      if (roundsWithSilks.length > 0) {
        const latestRound = [
          ...roundsWithSilks,
        ].sort(
          (a, b) =>
            b.round_number - a.round_number
        )[0];

        setExpandedRoundIds(
          latestRound
            ? new Set([latestRound.round_id])
            : new Set()
        );
      } else {
        setExpandedRoundIds(new Set());
      }

      setLoading(false);
    }

    void loadPage();

    return () => {
      active = false;
    };
  }, []);

  async function hydrateRoundSilks(
    roundsToHydrate: RoundHistory[]
  ) {
    if (!showHorseSilks || roundsToHydrate.length === 0) {
      return roundsToHydrate;
    }

    const horseIds = Array.from(
      new Set(
        roundsToHydrate
          .flatMap((round) => round.selections ?? [])
          .map((selection) => selection.horse_id)
          .filter(Boolean)
      )
    );

    if (horseIds.length === 0) {
      return roundsToHydrate;
    }

    const { data: horseRows, error } = await supabase
      .from("horses")
      .select("id, silks_url")
      .in("id", horseIds);

    if (error) {
      console.error(
        "Season history horse silks load error:",
        error
      );
      return roundsToHydrate;
    }

    const silksByHorseId = new Map(
      (horseRows ?? []).map((horse: any) => [
        String(horse.id),
        horse.silks_url ?? null,
      ])
    );

    return roundsToHydrate.map((round) => ({
      ...round,
      selections: (round.selections ?? []).map((selection) => ({
        ...selection,
        silks_url:
          silksByHorseId.get(selection.horse_id) ?? null,
      })),
    }));
  }

  async function changeSeason(
    seasonId: string
  ) {
    setSelectedSeasonId(seasonId);
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase.rpc(
      "get_my_season_history",
      {
        p_season_id: seasonId,
      }
    );

    if (error) {
      console.error(
        "Season history RPC error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Your season history could not be loaded."
      );

      setLoading(false);
      return;
    }

    const loadedData =
      data as SeasonHistoryData | null;

    const loadedRounds =
      loadedData?.rounds ?? [];

    const roundIds = loadedRounds.map(
      (round) => round.round_id
    );

    let roundsWithRaceCounts =
      loadedRounds;

    if (roundIds.length > 0) {
      const {
        data: raceCountData,
        error: raceCountError,
      } = await supabase
        .from("races")
        .select("round_id")
        .in("round_id", roundIds);

      if (!raceCountError) {
        const raceCounts = (
          raceCountData ?? []
        ).reduce(
          (
            counts: Record<string, number>,
            race
          ) => {
            const roundId =
              String(race.round_id);

            counts[roundId] =
              (counts[roundId] ?? 0) + 1;

            return counts;
          },
          {}
        );

        roundsWithRaceCounts =
          loadedRounds.map((round) => ({
            ...round,
            total_races:
              raceCounts[round.round_id] ?? 0,
          }));
      }
    }

    let roundsWithAutofillPenalty =
      roundsWithRaceCounts;

    const teamIds = roundsWithRaceCounts
      .map((round) => round.team_id)
      .filter(Boolean);

    if (teamIds.length > 0) {
      const {
        data: teamPenaltyData,
        error: teamPenaltyError,
      } = await supabase
        .from("teams")
        .select("id, autofilled_horse_count")
        .in("id", teamIds);

      if (teamPenaltyError) {
        console.error(
          "Season history autofill penalty error:",
          teamPenaltyError
        );
      } else {
        const autofillByTeamId = new Map(
          (teamPenaltyData ?? []).map((team: any) => [
            String(team.id),
            Number(team.autofilled_horse_count ?? 0),
          ])
        );

        roundsWithAutofillPenalty =
          roundsWithRaceCounts.map((round) => {
            const autofilledHorseCount =
              autofillByTeamId.get(round.team_id) ?? 0;

            return {
              ...round,
              autofilled_horse_count:
                autofilledHorseCount,
              autofill_penalty:
                autofilledHorseCount * 3,
            };
          });
      }
    }

    const roundsWithSilks =
      await hydrateRoundSilks(
        roundsWithAutofillPenalty
      );

    setHistoryData(
      loadedData
        ? {
            ...loadedData,
            rounds: roundsWithSilks,
          }
        : null
    );

    if (roundsWithSilks.length > 0) {
      const latestRound = [
        ...roundsWithSilks,
      ].sort(
        (a, b) =>
          b.round_number - a.round_number
      )[0];

      setExpandedRoundIds(
        latestRound
          ? new Set([latestRound.round_id])
          : new Set()
      );
    } else {
      setExpandedRoundIds(new Set());
    }

    setLoading(false);
  }

  useEffect(() => {
    let active = true;

    async function loadOverallRankHistory() {
      const seasonRounds = historyData?.rounds ?? [];

      if (!selectedSeasonId || seasonRounds.length === 0) {
        setOverallRankHistory({});
        return;
      }

      const orderedRounds = [...seasonRounds].sort(
        (a, b) => a.round_number - b.round_number
      );
      const roundIds = orderedRounds.map((round) => round.round_id);
      const ownTeamIds = new Set(
        orderedRounds.map((round) => round.team_id)
      );

      const allTeams: Array<{
        id: string;
        user_id: string;
        round_id: string;
      }> = [];
      const pageSize = 100;
      let from = 0;

      while (true) {
        const { data: page, error } = await supabase
          .from("teams")
          .select("id, user_id, round_id")
          .in("round_id", roundIds)
          .range(from, from + pageSize - 1);

        if (!active) return;

        if (error) {
          console.error("My Season rank history teams error:", error);
          setOverallRankHistory({});
          return;
        }

        const rows = (page ?? []).map((team: any) => ({
          id: String(team.id),
          user_id: String(team.user_id),
          round_id: String(team.round_id),
        }));

        allTeams.push(...rows);

        if (rows.length < pageSize) break;
        from += pageSize;
      }

      const ownTeam = allTeams.find((team) =>
        ownTeamIds.has(team.id)
      );

      if (!ownTeam || allTeams.length === 0) {
        setOverallRankHistory({});
        return;
      }

      const teamById = new Map(
        allTeams.map((team) => [team.id, team])
      );
      const teamIds = allTeams.map((team) => team.id);

      const allScores: Array<{
        team_id: string;
        total_points: number;
      }> = [];
      from = 0;

      while (true) {
        const { data: page, error } = await supabase
          .from("player_round_scores")
          .select("team_id, total_points")
          .in("team_id", teamIds)
          .range(from, from + pageSize - 1);

        if (!active) return;

        if (error) {
          console.error("My Season rank history scores error:", error);
          setOverallRankHistory({});
          return;
        }

        const rows = (page ?? []).map((score: any) => ({
          team_id: String(score.team_id),
          total_points: Number(score.total_points ?? 0),
        }));

        allScores.push(...rows);

        if (rows.length < pageSize) break;
        from += pageSize;
      }

      const scoreByTeamId = new Map(
        allScores.map((score) => [
          score.team_id,
          score.total_points,
        ])
      );

      const cumulativeByUser = new Map<string, number>();
      const rankHistory: Record<number, number> = {};

      for (const round of orderedRounds) {
        const teamsThisRound = allTeams.filter(
          (team) => team.round_id === round.round_id
        );

        for (const team of teamsThisRound) {
          const roundPoints = scoreByTeamId.get(team.id);

          if (roundPoints == null) continue;

          cumulativeByUser.set(
            team.user_id,
            (cumulativeByUser.get(team.user_id) ?? 0) +
              roundPoints
          );
        }

        const standings = [...cumulativeByUser.entries()].sort(
          (a, b) => b[1] - a[1]
        );

        const ownPoints = cumulativeByUser.get(ownTeam.user_id);

        if (ownPoints == null) continue;

        const betterScores = standings.filter(
          ([, points]) => points > ownPoints
        ).length;

        rankHistory[round.round_number] = betterScores + 1;
      }

      if (!active) return;
      setOverallRankHistory(rankHistory);
    }

    void loadOverallRankHistory();

    return () => {
      active = false;
    };
  }, [historyData, selectedSeasonId]);

  const selectedSeason = useMemo(() => {
    return seasons.find(
      (season) =>
        season.id === selectedSeasonId
    ) ?? null;
  }, [seasons, selectedSeasonId]);

  const rounds = useMemo(() => {
    return [...(historyData?.rounds ?? [])].sort(
      (a, b) => b.round_number - a.round_number
    );
  }, [historyData]);

  const seasonScore = historyData?.season_score ?? null;

  const totalPriceMovement = useMemo(() => {
    return rounds.reduce(
      (total, round) => total + round.price_movement,
      0
    );
  }, [rounds]);

  const progressRounds = useMemo(() => {
    return [...rounds].sort(
      (a, b) => a.round_number - b.round_number
    );
  }, [rounds]);

  const seasonScoreProgress = useMemo(() => {
    let cumulative = 0;

    return progressRounds.map((round) => {
      cumulative += Number(round.round_score ?? 0);

      return {
        round_number: round.round_number,
        label: `Round ${round.round_number}`,
        value: cumulative,
      };
    });
  }, [progressRounds]);

  const overallRankProgress = useMemo(() => {
    return progressRounds
      .map((round) => {
        const rank = overallRankHistory[round.round_number];

        return rank == null
          ? null
          : {
              round_number: round.round_number,
              label: `Round ${round.round_number}`,
              value: rank,
            };
      })
      .filter((point): point is ProgressPoint => point !== null);
  }, [progressRounds, overallRankHistory]);

  const salaryProgress = useMemo(() => {
    return progressRounds.map((round) => ({
      round_number: round.round_number,
      label: `After Round ${round.round_number}`,
      value: Number(
        round.next_round_salary_cap ??
          round.salary_cap ??
          0
      ),
    }));
  }, [progressRounds]);

  function toggleRound(roundId: string) {
    setExpandedRoundIds((current) => {
      const next = new Set(current);

      if (next.has(roundId)) {
        next.delete(roundId);
      } else {
        next.add(roundId);
      }

      return next;
    });
  }

  function expandAll() {
    setExpandedRoundIds(
      new Set(rounds.map((round) => round.round_id))
    );
  }

  function collapseAll() {
    setExpandedRoundIds(new Set());
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-7xl rounded-xl border bg-white p-10 text-center text-slate-500">
          Loading season history...
        </div>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 md:p-8">
        <div className="mx-auto max-w-4xl rounded-xl border bg-white p-8">
          <h1 className="text-3xl font-bold text-slate-900">
            My Season
          </h1>

          <p className="mt-4 text-red-700">
            {errorMessage}
          </p>

          <Link
            href="/dashboard"
            className="mt-6 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-bold text-white hover:bg-slate-800"
          >
            Return to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (!historyData?.season_id || rounds.length === 0) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 md:p-8">
        <div className="mx-auto max-w-4xl rounded-xl border bg-white p-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900">
            My Season
          </h1>

          <p className="mt-4 text-slate-600">
            {historyData?.message ||
              "No completed round history is available yet."}
          </p>

          <Link
            href="/dashboard"
            className="mt-6 inline-flex rounded-lg bg-teal-700 px-5 py-3 font-bold text-white hover:bg-teal-800"
          >
            Return to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-teal-300">
                Player history
              </p>

              <h1 className="mt-2 text-3xl font-bold md:text-4xl">
                My Season
              </h1>

              <p className="mt-2 max-w-2xl text-slate-300">
                {selectedSeason
                  ? `${selectedSeason.name} ${selectedSeason.year} — `
                  : ""}
                Review your completed rounds, team selections, scores,
                rankings and rolling salary changes.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label
                  htmlFor="my-season-selector"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400"
                >
                  Season
                </label>

                <select
                  id="my-season-selector"
                  value={selectedSeasonId}
                  onChange={(event) =>
                    void changeSeason(
                      event.target.value
                    )
                  }
                  className="min-w-52 rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 font-semibold text-white outline-none focus:border-teal-400"
                >
                  {seasons.map((season) => (
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

              <Link
                href="/dashboard"
                className="rounded-lg border border-slate-600 px-5 py-3 font-bold text-white hover:bg-slate-800"
              >
                Dashboard
              </Link>

              <Link
                href="/leaderboard"
                className="rounded-lg bg-amber-400 px-5 py-3 font-bold text-slate-900 hover:bg-amber-300"
              >
                Leaderboard
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-teal-700 p-5 text-white shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-teal-100">
                Season Score
              </p>

              <button
                type="button"
                onClick={() => setActiveGraph("score")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
                aria-label="View season score graph"
                title="View graph"
              >
                <LineChart className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-2 text-4xl font-bold">
              {seasonScore?.total_points ?? 0}
            </p>

            <p className="mt-1 text-sm text-teal-100">
              total points
            </p>
          </div>

          <div className="rounded-2xl bg-slate-900 p-5 text-white shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-slate-300">
                Overall Rank
              </p>

              <button
                type="button"
                onClick={() => setActiveGraph("rank")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
                aria-label="View overall rank graph"
                title="View graph"
              >
                <LineChart className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-2 text-4xl font-bold">
              {getRankDisplay(seasonScore?.overall_rank ?? null)}
            </p>

            <p className="mt-1 text-sm text-slate-300">
              season position
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Rounds Played
            </p>

            <p className="mt-2 text-4xl font-bold text-slate-900">
              {seasonScore?.rounds_played ?? rounds.length}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              completed rounds
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Highest Round
            </p>

            <p className="mt-2 text-4xl font-bold text-slate-900">
              {seasonScore?.highest_round_score ?? 0}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              best score
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Round wins
            </p>

            <p className="mt-2 text-2xl font-bold text-slate-900">
              {seasonScore?.round_wins ?? 0}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Top-ten finishes
            </p>

            <p className="mt-2 text-2xl font-bold text-slate-900">
              {seasonScore?.top_ten_finishes ?? 0}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total value movement
            </p>

            <p
              className={`mt-2 text-2xl font-bold ${
                totalPriceMovement > 0
                  ? "text-green-700"
                  : totalPriceMovement < 0
                    ? "text-red-700"
                    : "text-slate-900"
              }`}
            >
              {formatSignedCurrency(totalPriceMovement)}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Current salary
              </p>

              <button
                type="button"
                onClick={() => setActiveGraph("salary")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
                aria-label="View current salary graph"
                title="View graph"
              >
                <LineChart className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2 text-2xl font-bold text-slate-900">
              {formatCurrency(
                rounds[0]?.next_round_salary_cap ??
                  rounds[0]?.salary_cap ??
                  0
              )}
            </p>
          </div>
        </section>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Round History
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Select a round to view the horses in your team.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="rounded-lg border bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Expand All
            </button>

            <button
              type="button"
              onClick={collapseAll}
              className="rounded-lg border bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Collapse All
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {rounds.map((round) => {
            const expanded = expandedRoundIds.has(round.round_id);

            const winnersPicked = round.selections.filter(
              (selection) =>
                selection.result_status === "finished" &&
                selection.finishing_position === 1
            ).length;

            const totalRaces = round.total_races ?? 0;

            return (
              <article
                key={round.round_id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => toggleRound(round.round_id)}
                  className="flex w-full flex-col gap-4 p-5 text-left transition hover:bg-slate-50 md:flex-row md:items-center md:justify-between"
                  aria-expanded={expanded}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-bold text-slate-900">
                        {expanded ? "▼" : "▶"} Round{" "}
                        {round.round_number}
                        {round.round_name
                          ? ` — ${round.round_name}`
                          : ""}
                      </h3>

                      <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">
                        {round.team_status}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-500">
                      {round.selections.length} horses selected
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Score
                      </p>

                      <p className="mt-1 text-lg font-bold text-slate-900">
                        {round.round_score}
                      </p>

                      {(round.autofill_penalty ?? 0) > 0 && (
                        <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-red-600">
                          Autofill penalty · −{round.autofill_penalty} pts
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Rank
                      </p>

                      <p className="mt-1 text-lg font-bold text-slate-900">
                        {getRankDisplay(round.round_rank)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Value change
                      </p>

                      <p
                        className={`mt-1 text-lg font-bold ${
                          round.price_movement > 0
                            ? "text-green-700"
                            : round.price_movement < 0
                              ? "text-red-700"
                              : "text-slate-900"
                        }`}
                      >
                        {formatSignedCurrency(round.price_movement)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Next salary
                      </p>

                      <p className="mt-1 text-lg font-bold text-slate-900">
                        {formatCurrency(round.next_round_salary_cap)}
                      </p>
                    </div>
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-slate-200">
                    <section className="grid gap-4 bg-slate-50 p-5 sm:grid-cols-2 lg:grid-cols-5">
                      <div className="rounded-xl border bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Salary cap
                        </p>

                        <p className="mt-1 text-lg font-bold text-slate-900">
                          {formatCurrency(round.salary_cap)}
                        </p>
                      </div>

                      <div className="rounded-xl border bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Salary used
                        </p>

                        <p className="mt-1 text-lg font-bold text-slate-900">
                          {formatCurrency(round.salary_used)}
                        </p>
                      </div>

                      <div className="rounded-xl border bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Winners Picked
                        </p>

                        <p className="mt-1 text-lg font-bold text-slate-900">
                          {winnersPicked}/{totalRaces}
                        </p>
                      </div>

                      <div className="rounded-xl border bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Captain bonus
                        </p>

                        <p className="mt-1 text-lg font-bold text-slate-900">
                          {round.captain_points}
                        </p>
                      </div>

                      <div className="rounded-xl border bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Autofill penalty
                        </p>

                        <p className={`mt-1 text-lg font-bold ${
                          (round.autofill_penalty ?? 0) > 0
                            ? "text-red-700"
                            : "text-slate-900"
                        }`}>
                          {(round.autofill_penalty ?? 0) > 0
                            ? `−${round.autofill_penalty} pts`
                            : "0 pts"}
                        </p>

                        {(round.autofilled_horse_count ?? 0) > 0 && (
                          <p className="mt-1 text-xs text-slate-500">
                            {round.autofilled_horse_count} autofilled{" "}
                            {round.autofilled_horse_count === 1
                              ? "horse"
                              : "horses"}
                          </p>
                        )}
                      </div>
                    </section>

                    <div className="overflow-x-auto">
                      <table className="w-full table-fixed divide-y divide-slate-200">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="w-[24%] px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                              Horse
                            </th>

                            <th className="w-[30%] px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                              Race
                            </th>

                            <th className="w-[12%] px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                              Grade
                            </th>

                            <th className="w-[10%] px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">
                              Finish
                            </th>

                            <th className="w-[14%] px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                              Selected Price
                            </th>

                            <th className="w-[10%] px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                              Points
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-200 bg-white">
                          {round.selections.map((selection) => (
                            <tr
                              key={selection.race_entry_id}
                              className={
                                selection.is_captain
                                  ? "bg-amber-50"
                                  : "odd:bg-white even:bg-slate-50 hover:bg-slate-100"
                              }
                            >
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  {showHorseSilks &&
                                    selection.silks_url && (
                                      <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                                        <img
                                          src={selection.silks_url}
                                          alt={`${selection.horse_name} silks`}
                                          className="h-full w-full object-contain"
                                        />
                                      </div>
                                    )}

                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Link
                                        href={`/horses/${selection.horse_id}`}
                                        className="truncate text-base font-bold text-slate-900 hover:text-teal-700 hover:underline"
                                      >
                                        {selection.horse_name}
                                      </Link>

                                      {selection.is_captain && (
                                        <span className="rounded-full bg-amber-200 px-2 py-1 text-xs font-bold text-amber-900">
                                          Captain
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="break-words px-5 py-4 text-sm text-slate-700">
                                {selection.racecourse_name
                                  ? `${selection.racecourse_name} `
                                  : ""}
                                R{selection.race_number} —{" "}
                                {selection.race_name}
                              </td>

                              <td className="px-5 py-4 text-sm text-slate-700">
                                {getGradeLabel(
                                  selection.race_grade
                                )}
                              </td>

                              <td className="px-5 py-4 text-center">
                                <span
                                  className={`inline-flex min-w-14 justify-center rounded-full px-3 py-1 text-sm font-bold ${getFinishClasses(
                                    selection
                                  )}`}
                                >
                                  {getFinishLabel(selection)}
                                </span>
                              </td>

                              <td className="px-5 py-4 text-right font-semibold text-slate-700">
                                {formatCurrency(
                                  selection.selected_price
                                )}
                              </td>

                              <td className="px-5 py-4 text-right">
                                <span className="inline-flex w-14 justify-center rounded-full bg-teal-100 px-3 py-1 font-bold text-teal-700">
                                  {selection.fantasy_points}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        {activeGraph && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
            onClick={() => setActiveGraph(null)}
            role="presentation"
          >
            <div
              className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={
                activeGraph === "score"
                  ? "Season Score graph"
                  : activeGraph === "rank"
                    ? "Overall Rank graph"
                    : "Current Salary graph"
              }
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700">
                    Season Progress
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    {activeGraph === "score"
                      ? "Season Score"
                      : activeGraph === "rank"
                        ? "Overall Rank"
                        : "Current Salary"}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveGraph(null)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
                  aria-label="Close graph"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4 sm:p-6">
                {activeGraph === "score" && (
                  <ProgressChart
                    title="Season Score"
                    description="Your cumulative fantasy points after each completed round."
                    points={seasonScoreProgress}
                    formatValue={(value) => `${Math.round(value)} pts`}
                  />
                )}

                {activeGraph === "rank" && (
                  <ProgressChart
                    title="Overall Rank"
                    description="Your overall season position after each completed round. Moving upward means improving toward #1."
                    points={overallRankProgress}
                    formatValue={(value) =>
                      `#${Math.max(1, Math.round(value))}`
                    }
                    invert
                  />
                )}

                {activeGraph === "salary" && (
                  <ProgressChart
                    title="Current Salary"
                    description="Your available salary cap after each completed round."
                    points={salaryProgress}
                    formatValue={(value) =>
                      formatCurrency(Math.round(value))
                    }
                  />
                )}
              </div>
            </div>
          </div>
        )}

        </div>
      </div>
    </main>
  );
}