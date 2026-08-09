"use client";

import { useEffect, useMemo, useState } from "react";

import PageHeader from "@/components/admin/PageHeader";
import { supabase } from "@/lib/supabase";

import type { ResultStatus } from "@/types/race-result";

type RaceGrade = "L" | "G3" | "G2" | "G1";

type RaceStatus =
  | "scheduled"
  | "running"
  | "official"
  | "abandoned"
  | "cancelled";

type RoundOption = {
  id: string;
  round_number: number;
  name: string | null;
  round_date: string | null;
  status: string;
};

type EntryStatus =
  | "runner"
  | "scratched_before_lockout"
  | "scratched_after_lockout";

type RaceOption = {
  id: string;
  round_id: string;
  race_number: number;
  race_name: string;
  grade: RaceGrade;
  scheduled_start: string;
  status: RaceStatus;

  racecourse?: {
    id: string;
    name: string;
  } | null;
};

type RaceEntryOption = {
  id: string;
  race_id: string;
  horse_id: string;
  saddlecloth_number: number | null;
  price_at_entry: number;
  entry_status: EntryStatus;

  horse?: {
    id: string;
    name: string;
    current_price: number;
  } | null;
};

type ResultFormRow = {
  race_entry_id: string;
  finishing_position: number | "";
  result_status: ResultStatus;
  is_dead_heat: boolean;
};

type FantasyPointsRule = {
  grade: RaceGrade;
  finishing_position: number;
  fantasy_points: number;
};

type PriceResultKey =
  | "first"
  | "second"
  | "third"
  | "third_last"
  | "second_last"
  | "last";

type PriceChangeRule = {
  grade: RaceGrade;
  result_key: PriceResultKey;
  price_change: number;
};

type CalculatedResult = {
  race_entry_id: string;
  fantasy_points: number;
  price_change: number;
  price_before: number;
  price_after: number;
  price_result_key: PriceResultKey | null;
};

type FinaliseRaceResponse = {
  success: boolean;
  race_id: string;
  results_saved: number;
  horses_updated: number;
  race_status: "official";
};

export default function ResultsPage() {
  const [rounds, setRounds] = useState<RoundOption[]>([]);
  const [races, setRaces] = useState<RaceOption[]>([]);
  const [raceEntryCounts, setRaceEntryCounts] = useState<
    Record<string, number>
  >({});

  const [expandedRoundIds, setExpandedRoundIds] = useState<Set<string>>(
    new Set()
  );

  const [expandedRaceIds, setExpandedRaceIds] = useState<Set<string>>(
    new Set()
  );

  const [entries, setEntries] = useState<RaceEntryOption[]>([]);
  const [resultRows, setResultRows] = useState<ResultFormRow[]>([]);

  const [fantasyPointsRules, setFantasyPointsRules] = useState<
    FantasyPointsRule[]
  >([]);

  const [priceChangeRules, setPriceChangeRules] = useState<
    PriceChangeRule[]
  >([]);

  const [calculatedResults, setCalculatedResults] = useState<
    CalculatedResult[]
  >([]);

  const [selectedRaceId, setSelectedRaceId] = useState("");

  const [loadingPage, setLoadingPage] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [loadingRules, setLoadingRules] = useState(true);
  const [savingResults, setSavingResults] = useState(false);

  const [resultsSaved, setResultsSaved] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    void loadPageData();
  }, []);

  async function loadPageData() {
    setLoadingPage(true);
    setErrorMessage("");

    const [
      roundsResponse,
      racesResponse,
      entriesResponse,
      fantasyPointsResponse,
      priceChangeResponse,
    ] = await Promise.all([
      supabase
        .from("rounds")
        .select("id, round_number, name, round_date, status")
        .order("round_number", { ascending: false }),

      supabase
        .from("races")
        .select(`
          id,
          round_id,
          race_number,
          race_name,
          grade,
          scheduled_start,
          status,
          racecourse:racecourses (
            id,
            name
          )
        `)
        .order("scheduled_start", { ascending: false }),

      supabase
        .from("race_entries")
        .select("id, race_id"),

      supabase
        .from("fantasy_points_rules")
        .select("grade, finishing_position, fantasy_points"),

      supabase
        .from("price_change_rules")
        .select("grade, result_key, price_change"),
    ]);

    if (roundsResponse.error) {
      console.error(roundsResponse.error);
      setErrorMessage("Could not load rounds.");
      setLoadingPage(false);
      return;
    }

    if (racesResponse.error) {
      console.error(racesResponse.error);
      setErrorMessage("Could not load races.");
      setLoadingPage(false);
      return;
    }

    if (entriesResponse.error) {
      console.error(entriesResponse.error);
      setErrorMessage("Could not load race entry counts.");
      setLoadingPage(false);
      return;
    }

    if (fantasyPointsResponse.error) {
      console.error(fantasyPointsResponse.error);
      setErrorMessage("Could not load fantasy points rules.");
      setLoadingPage(false);
      return;
    }

    if (priceChangeResponse.error) {
      console.error(priceChangeResponse.error);
      setErrorMessage("Could not load price-change rules.");
      setLoadingPage(false);
      return;
    }

    const loadedRounds =
      (roundsResponse.data ?? []) as RoundOption[];

    const loadedRaces =
      (racesResponse.data ?? []) as unknown as RaceOption[];

    const counts: Record<string, number> = {};

    for (const entry of entriesResponse.data ?? []) {
      counts[entry.race_id] = (counts[entry.race_id] ?? 0) + 1;
    }

    setRounds(loadedRounds);
    setRaces(loadedRaces);
    setRaceEntryCounts(counts);

    setFantasyPointsRules(
      (fantasyPointsResponse.data ?? []) as FantasyPointsRule[]
    );

    setPriceChangeRules(
      (priceChangeResponse.data ?? []) as PriceChangeRule[]
    );

    setLoadingRules(false);

    setExpandedRoundIds((current) => {
      if (current.size > 0 || loadedRounds.length === 0) {
        return current;
      }

      const preferredRound =
        loadedRounds.find((round) =>
          ["open", "locked", "draft"].includes(round.status)
        ) ?? loadedRounds[0];

      return preferredRound
        ? new Set([preferredRound.id])
        : new Set<string>();
    });

    setLoadingPage(false);
  }

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

  function toggleRace(raceId: string) {
    setExpandedRaceIds((current) => {
      const next = new Set(current);

      if (next.has(raceId)) {
        next.delete(raceId);
      } else {
        next.add(raceId);
      }

      return next;
    });
  }

  function expandAll() {
    setExpandedRoundIds(new Set(rounds.map((round) => round.id)));
    setExpandedRaceIds(new Set(races.map((race) => race.id)));
  }

  function collapseAll() {
    setExpandedRoundIds(new Set());
    setExpandedRaceIds(new Set());
  }

  async function selectRace(raceId: string) {
    setSelectedRaceId(raceId);

    setEntries([]);
    setResultRows([]);
    setCalculatedResults([]);
    setResultsSaved(false);

    setErrorMessage("");
    setSuccessMessage("");

    setExpandedRaceIds((current) => {
      const next = new Set(current);
      next.add(raceId);
      return next;
    });

    await loadRaceEntries(raceId);
  }

  async function loadRaceEntries(raceId: string) {
    setLoadingEntries(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("race_entries")
      .select(`
        id,
        race_id,
        horse_id,
        saddlecloth_number,
        price_at_entry,
        entry_status,
        horse:horses (
          id,
          name,
          current_price
        )
      `)
      .eq("race_id", raceId)
      .order("saddlecloth_number", {
        ascending: true,
        nullsFirst: false,
      });

    if (error) {
      console.error(error);
      setErrorMessage(
        "Could not load the entries for this race."
      );
      setLoadingEntries(false);
      return;
    }

    const loadedEntries =
      (data ?? []) as unknown as RaceEntryOption[];

    setEntries(loadedEntries);

    setResultRows(
      loadedEntries.map((entry) => {
        const isScratched =
          entry.entry_status !== "runner";

        return {
          race_entry_id: entry.id,
          finishing_position: "",
          result_status: isScratched
            ? "scratched"
            : "finished",
          is_dead_heat: false,
        };
      })
    );

    setLoadingEntries(false);
  }

  function updateResultRow(
    raceEntryId: string,
    changes: Partial<ResultFormRow>
  ) {
    setCalculatedResults([]);
    setResultsSaved(false);
    setSuccessMessage("");
    setErrorMessage("");

    setResultRows((currentRows) =>
      currentRows.map((row) =>
        row.race_entry_id === raceEntryId
          ? {
              ...row,
              ...changes,
            }
          : row
      )
    );
  }

  function handleStatusChange(
    raceEntryId: string,
    status: ResultStatus
  ) {
    updateResultRow(raceEntryId, {
      result_status: status,
      finishing_position: "",
      is_dead_heat: false,
    });
  }

  function getResultRow(raceEntryId: string) {
    return resultRows.find(
      (row) => row.race_entry_id === raceEntryId
    );
  }

  function getCalculatedResult(raceEntryId: string) {
    return calculatedResults.find(
      (result) => result.race_entry_id === raceEntryId
    );
  }

  function getHorseName(entry: RaceEntryOption) {
    return entry.horse?.name ?? "Unknown horse";
  }

  function getRacecourseName(race: RaceOption) {
    return race.racecourse?.name ?? "Racecourse";
  }

  function getRaceLabel(race: RaceOption) {
    return `${getRacecourseName(race)} R${race.race_number} — ${race.race_name}`;
  }

  function getRoundLabel(round: RoundOption) {
    return round.name
      ? `Round ${round.round_number} — ${round.name}`
      : `Round ${round.round_number}`;
  }

  function getGradeLabel(grade: RaceGrade) {
    return grade === "L" ? "Listed" : grade;
  }

  function formatDateTime(value: string) {
    return new Intl.DateTimeFormat("en-AU", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Australia/Melbourne",
    }).format(new Date(value));
  }

  function formatRoundDate(round: RoundOption) {
    if (!round.round_date) {
      return "";
    }

    return new Intl.DateTimeFormat("en-AU", {
      dateStyle: "full",
      timeZone: "Australia/Melbourne",
    }).format(new Date(`${round.round_date}T00:00:00`));
  }

  function formatMoney(amount: number) {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function getEntryStatusLabel(status: EntryStatus) {
    if (status === "scratched_before_lockout") {
      return "Scratched Before Lockout";
    }

    if (status === "scratched_after_lockout") {
      return "Scratched After Lockout";
    }

    return "Runner";
  }

  function getPriceRuleLabel(resultKey: PriceResultKey | null) {
    if (!resultKey) {
      return "No price rule";
    }

    const labels: Record<PriceResultKey, string> = {
      first: "1st",
      second: "2nd",
      third: "3rd",
      third_last: "Third last",
      second_last: "Second last",
      last: "Last",
    };

    return labels[resultKey];
  }

  function getRaceStatusLabel(status: RaceStatus) {
    const labels: Record<RaceStatus, string> = {
      scheduled: "Scheduled",
      running: "Running",
      official: "Official",
      abandoned: "Abandoned",
      cancelled: "Cancelled",
    };

    return labels[status];
  }

  function getRaceStatusClasses(status: RaceStatus) {
    switch (status) {
      case "official":
        return "bg-green-100 text-green-800";

      case "running":
        return "bg-amber-100 text-amber-800";

      case "abandoned":
      case "cancelled":
        return "bg-red-100 text-red-800";

      default:
        return "bg-blue-100 text-blue-800";
    }
  }

  function getFantasyPoints(
    grade: RaceGrade,
    finishingPosition: number
  ) {
    if (finishingPosition > 10) {
      return 0;
    }

    const rule = fantasyPointsRules.find(
      (item) =>
        item.grade === grade &&
        item.finishing_position === finishingPosition
    );

    return rule?.fantasy_points ?? 0;
  }

  function getPriceResultKey(
    finishingPosition: number,
    distinctFinishedPositions: number[]
  ): PriceResultKey | null {
    if (finishingPosition === 1) {
      return "first";
    }

    if (finishingPosition === 2) {
      return "second";
    }

    if (finishingPosition === 3) {
      return "third";
    }

    const descendingPositions = [
      ...distinctFinishedPositions,
    ].sort((a, b) => b - a);

    if (finishingPosition === descendingPositions[0]) {
      return "last";
    }

    if (finishingPosition === descendingPositions[1]) {
      return "second_last";
    }

    if (finishingPosition === descendingPositions[2]) {
      return "third_last";
    }

    return null;
  }

  function getPriceChange(
    grade: RaceGrade,
    resultKey: PriceResultKey | null
  ) {
    if (!resultKey) {
      return 0;
    }

    const rule = priceChangeRules.find(
      (item) =>
        item.grade === grade &&
        item.result_key === resultKey
    );

    return rule?.price_change ?? 0;
  }

  function calculateResults() {
    setErrorMessage("");
    setSuccessMessage("");
    setCalculatedResults([]);
    setResultsSaved(false);

    if (!selectedRace) {
      setErrorMessage("Please select a race.");
      return;
    }

    if (selectedRace.status === "official") {
      setErrorMessage("This race is already official.");
      return;
    }

    if (
      selectedRace.status === "abandoned" ||
      selectedRace.status === "cancelled"
    ) {
      setErrorMessage(
        "Results cannot be entered for an abandoned or cancelled race."
      );
      return;
    }

    if (loadingRules) {
      setErrorMessage(
        "The calculation rules are still loading."
      );
      return;
    }

    if (
      fantasyPointsRules.length === 0 ||
      priceChangeRules.length === 0
    ) {
      setErrorMessage(
        "The fantasy-points or price-change rules could not be found."
      );
      return;
    }

    if (entries.length === 0) {
      setErrorMessage(
        "This race does not have any entries."
      );
      return;
    }

    for (const row of resultRows) {
      if (
        row.result_status === "finished" &&
        typeof row.finishing_position !== "number"
      ) {
        const entry = entries.find(
          (item) => item.id === row.race_entry_id
        );

        setErrorMessage(
          `Enter a finishing position for ${
            entry
              ? getHorseName(entry)
              : "every finished horse"
          }.`
        );
        return;
      }

      if (
        typeof row.finishing_position === "number" &&
        row.finishing_position < 1
      ) {
        setErrorMessage(
          "Finishing positions must be at least 1."
        );
        return;
      }

      if (
        typeof row.finishing_position === "number" &&
        !Number.isInteger(row.finishing_position)
      ) {
        setErrorMessage(
          "Finishing positions must be whole numbers."
        );
        return;
      }
    }

    const finishedRows = resultRows.filter(
      (
        row
      ): row is ResultFormRow & {
        finishing_position: number;
      } =>
        row.result_status === "finished" &&
        typeof row.finishing_position === "number"
    );

    if (finishedRows.length === 0) {
      setErrorMessage(
        "At least one horse must have a finished result."
      );
      return;
    }

    const positions = finishedRows.map(
      (row) => row.finishing_position
    );

    const positionCounts = new Map<number, number>();

    for (const position of positions) {
      positionCounts.set(
        position,
        (positionCounts.get(position) ?? 0) + 1
      );
    }

    for (const row of finishedRows) {
      const countAtPosition =
        positionCounts.get(row.finishing_position) ?? 0;

      if (countAtPosition > 1 && !row.is_dead_heat) {
        setErrorMessage(
          `Position ${row.finishing_position} is used more than once. Every horse sharing that position must be marked as a dead heat.`
        );
        return;
      }

      if (countAtPosition === 1 && row.is_dead_heat) {
        setErrorMessage(
          `Position ${row.finishing_position} is marked as a dead heat, but no other horse shares that position.`
        );
        return;
      }
    }

    const distinctFinishedPositions = [
      ...new Set(positions),
    ].sort((a, b) => a - b);

    const calculations: CalculatedResult[] =
      resultRows.map((row) => {
        const entry = entries.find(
          (item) => item.id === row.race_entry_id
        );

        const priceBefore =
          entry?.price_at_entry ?? 30000;

        if (
          row.result_status !== "finished" ||
          typeof row.finishing_position !== "number"
        ) {
          return {
            race_entry_id: row.race_entry_id,
            fantasy_points: 0,
            price_change: 0,
            price_before: priceBefore,
            price_after: priceBefore,
            price_result_key: null,
          };
        }

        const fantasyPoints = getFantasyPoints(
          selectedRace.grade,
          row.finishing_position
        );

        const priceResultKey = getPriceResultKey(
          row.finishing_position,
          distinctFinishedPositions
        );

        const priceChange =
          runnerCount >= 8
            ? getPriceChange(
                selectedRace.grade,
                priceResultKey
              )
            : 0;

        const priceAfter = Math.max(
          30000,
          priceBefore + priceChange
        );

        return {
          race_entry_id: row.race_entry_id,
          fantasy_points: fantasyPoints,
          price_change: priceChange,
          price_before: priceBefore,
          price_after: priceAfter,
          price_result_key: priceResultKey,
        };
      });

    setCalculatedResults(calculations);

    setSuccessMessage(
      "Results calculated successfully. Review every fantasy-points and price-change value before saving."
    );
  }

  async function saveOfficialResults() {
    setErrorMessage("");
    setSuccessMessage("");

    if (!selectedRace) {
      setErrorMessage("Please select a race.");
      return;
    }

    if (selectedRace.status === "official") {
      setErrorMessage(
        "This race has already been made official."
      );
      return;
    }

    if (
      selectedRace.status === "abandoned" ||
      selectedRace.status === "cancelled"
    ) {
      setErrorMessage(
        "Results cannot be saved for an abandoned or cancelled race."
      );
      return;
    }

    if (calculatedResults.length !== entries.length) {
      setErrorMessage(
        "Calculate the results before saving them."
      );
      return;
    }

    const confirmed = window.confirm(
      "Make these results official?\n\nThis will update horse prices, fantasy points and price history. The race cannot be processed twice."
    );

    if (!confirmed) {
      return;
    }

    setSavingResults(true);

    const submittedResults = resultRows.map((row) => ({
      race_entry_id: row.race_entry_id,

      finishing_position:
        row.result_status === "finished" &&
        typeof row.finishing_position === "number"
          ? row.finishing_position
          : null,

      result_status: row.result_status,

      is_dead_heat:
        row.result_status === "finished"
          ? row.is_dead_heat
          : false,
    }));

    const { data, error } = await supabase.rpc(
      "finalise_race_results",
      {
        p_race_id: selectedRace.id,
        p_results: submittedResults,
      }
    );

    if (error) {
      console.error(error);
      setErrorMessage(
        error.message ||
          "Could not save the official race results."
      );
      setSavingResults(false);
      return;
    }

    const { error: liveScoreError } = await supabase.rpc(
      "refresh_live_round_scores",
      {
        p_round_id: selectedRace.round_id,
      }
    );

    if (liveScoreError) {
      console.error(
        "Live round score refresh error:",
        liveScoreError
      );

      setErrorMessage(
        `The race results were saved, but live team scores could not be refreshed: ${liveScoreError.message}`
      );

      setSavingResults(false);
      return;
    }

    const response =
      data as FinaliseRaceResponse | null;

    setResultsSaved(true);

    setRaces((currentRaces) =>
      currentRaces.map((race) =>
        race.id === selectedRace.id
          ? {
              ...race,
              status: "official",
            }
          : race
      )
    );

    setEntries((currentEntries) =>
      currentEntries.map((entry) => {
        const calculation =
          calculatedResults.find(
            (result) =>
              result.race_entry_id === entry.id
          );

        if (!calculation || !entry.horse) {
          return entry;
        }

        return {
          ...entry,
          horse: {
            ...entry.horse,
            current_price:
              calculation.price_after,
          },
        };
      })
    );

    setSuccessMessage(
      `Official results saved. ${
        response?.results_saved ?? entries.length
      } results and ${
        response?.horses_updated ?? entries.length
      } horse records were updated. Live team scores were refreshed.`
    );

    setSavingResults(false);
  }

  const sortedRounds = useMemo(() => {
    return [...rounds].sort(
      (a, b) => b.round_number - a.round_number
    );
  }, [rounds]);

  const sortedRaces = useMemo(() => {
    return [...races].sort(
      (a, b) =>
        new Date(a.scheduled_start).getTime() -
        new Date(b.scheduled_start).getTime()
    );
  }, [races]);

  const racesByRoundId = useMemo(() => {
    const map = new Map<string, RaceOption[]>();

    for (const race of sortedRaces) {
      const current = map.get(race.round_id) ?? [];
      current.push(race);
      map.set(race.round_id, current);
    }

    return map;
  }, [sortedRaces]);

  const selectedRace = useMemo(() => {
    return races.find(
      (race) => race.id === selectedRaceId
    );
  }, [races, selectedRaceId]);

  const runnerCount = useMemo(() => {
    return entries.filter(
      (entry) => entry.entry_status === "runner"
    ).length;
  }, [entries]);

  const scratchedCount = useMemo(() => {
    return entries.filter(
      (entry) => entry.entry_status !== "runner"
    ).length;
  }, [entries]);

  const isRaceOfficial =
    selectedRace?.status === "official";

  const isRaceUnavailable =
    selectedRace?.status === "abandoned" ||
    selectedRace?.status === "cancelled";

  const inputsDisabled =
    isRaceOfficial ||
    isRaceUnavailable ||
    savingResults;

  const calculationsReady =
    entries.length > 0 &&
    calculatedResults.length === entries.length;

  function renderResultsEditor(race: RaceOption) {
    if (selectedRaceId !== race.id) {
      return null;
    }

    if (loadingEntries) {
      return (
        <div className="border-t border-slate-200 p-10 text-center text-slate-500">
          Loading race entries...
        </div>
      );
    }

    if (entries.length === 0) {
      return (
        <div className="border-t border-slate-200 p-10 text-center">
          <p className="font-semibold text-slate-700">
            No race entries
          </p>

          <p className="mt-1 text-sm text-slate-500">
            No horses have been entered in this race.
          </p>
        </div>
      );
    }

    return (
      <div className="border-t border-slate-200">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h3 className="text-lg font-bold text-slate-900">
            Enter Results
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Enter a position for every finished horse. Non-finishers and scratched horses receive zero fantasy points and no price change. Horse price changes only apply when there are at least 8 official starters.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <span className="rounded-full bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
              Total entries: {entries.length}
            </span>

            <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-800">
              Runners: {runnerCount}
            </span>

            <span className="rounded-full bg-red-100 px-4 py-2 text-sm font-medium text-red-800">
              Scratched: {scratchedCount}
            </span>
          </div>

          {runnerCount < 8 && (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-800">
              No horse price changes will apply because this race has fewer
              than 8 official starters. Fantasy points will still be awarded
              normally.
            </div>
          )}

          {isRaceOfficial && (
            <div className="mt-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm font-medium text-green-800">
              This race is official. Results cannot be processed again.
            </div>
          )}

          {isRaceUnavailable && (
            <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-800">
              Results cannot be entered for this race because it is {selectedRace?.status}.
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1300px] divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {[
                  "No.",
                  "Horse",
                  "Entry Status",
                  "Entry Price",
                  "Result Status",
                  "Position",
                  "Dead Heat",
                  "Fantasy Points",
                  "Price Rule",
                  "Price Change",
                  "New Price",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white">
              {entries.map((entry) => {
                const resultRow =
                  getResultRow(entry.id);

                const calculatedResult =
                  getCalculatedResult(entry.id);

                if (!resultRow) {
                  return null;
                }

                const entryIsScratched =
                  entry.entry_status !== "runner";

                const isFinished =
                  resultRow.result_status === "finished";

                const rowDisabled =
                  inputsDisabled || entryIsScratched;

                return (
                  <tr
                    key={entry.id}
                    className={
                      entryIsScratched
                        ? "bg-red-50/50"
                        : "hover:bg-slate-50"
                    }
                  >
                    <td className="px-4 py-4 font-bold text-slate-900">
                      {entry.saddlecloth_number ?? "—"}
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">
                        {getHorseName(entry)}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Current price:{" "}
                        {formatMoney(
                          entry.horse?.current_price ??
                            entry.price_at_entry
                        )}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={
                          entry.entry_status === "runner"
                            ? "inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800"
                            : "inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"
                        }
                      >
                        {getEntryStatusLabel(
                          entry.entry_status
                        )}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-sm font-medium text-slate-700">
                      {formatMoney(entry.price_at_entry)}
                    </td>

                    <td className="px-4 py-4">
                      <select
                        value={resultRow.result_status}
                        disabled={rowDisabled}
                        onChange={(event) =>
                          handleStatusChange(
                            entry.id,
                            event.target.value as ResultStatus
                          )
                        }
                        className="min-w-40 rounded-lg border border-slate-300 bg-white p-2 text-sm outline-none focus:border-green-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                      >
                        <option value="finished">
                          Finished
                        </option>
                        <option value="non_finisher">
                          Non-finisher
                        </option>
                        <option value="scratched">
                          Scratched
                        </option>
                      </select>
                    </td>

                    <td className="px-4 py-4">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        disabled={
                          rowDisabled || !isFinished
                        }
                        value={
                          resultRow.finishing_position
                        }
                        onChange={(event) =>
                          updateResultRow(entry.id, {
                            finishing_position:
                              event.target.value === ""
                                ? ""
                                : Number(
                                    event.target.value
                                  ),
                          })
                        }
                        placeholder="—"
                        className="w-24 rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-green-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                      />
                    </td>

                    <td className="px-4 py-4">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          disabled={
                            rowDisabled || !isFinished
                          }
                          checked={resultRow.is_dead_heat}
                          onChange={(event) =>
                            updateResultRow(entry.id, {
                              is_dead_heat:
                                event.target.checked,
                            })
                          }
                          className="h-5 w-5 rounded border-slate-300"
                        />

                        <span className="text-sm text-slate-600">
                          Yes
                        </span>
                      </label>
                    </td>

                    <td className="px-4 py-4">
                      {calculatedResult ? (
                        <span className="inline-flex min-w-12 justify-center rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-800">
                          {
                            calculatedResult.fantasy_points
                          }
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          —
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-sm font-medium text-slate-700">
                      {calculatedResult
                        ? runnerCount < 8
                          ? "No change (< 8 starters)"
                          : getPriceRuleLabel(
                              calculatedResult.price_result_key
                            )
                        : "—"}
                    </td>

                    <td className="px-4 py-4 font-semibold">
                      {calculatedResult ? (
                        <span
                          className={
                            calculatedResult.price_change > 0
                              ? "text-green-700"
                              : calculatedResult.price_change < 0
                                ? "text-red-700"
                                : "text-slate-600"
                          }
                        >
                          {calculatedResult.price_change > 0
                            ? "+"
                            : ""}
                          {formatMoney(
                            calculatedResult.price_change
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          —
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4 font-bold text-slate-900">
                      {calculatedResult
                        ? formatMoney(
                            calculatedResult.price_after
                          )
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-700">
              {isRaceOfficial || resultsSaved
                ? "Official results saved"
                : calculationsReady
                  ? "Calculations ready for review"
                  : "Results are not saved yet"}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {isRaceOfficial || resultsSaved
                ? "Horse prices, fantasy points and price history have been updated."
                : calculationsReady
                  ? "Check every result before making the race official."
                  : "Enter the results and calculate them before saving."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={calculateResults}
              disabled={
                loadingRules ||
                loadingEntries ||
                savingResults ||
                isRaceOfficial ||
                isRaceUnavailable
              }
              className="rounded-lg border border-green-800 bg-white px-6 py-3 font-semibold text-green-800 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingRules
                ? "Loading Rules..."
                : "Calculate Results"}
            </button>

            <button
              type="button"
              onClick={() =>
                void saveOfficialResults()
              }
              disabled={
                !calculationsReady ||
                savingResults ||
                resultsSaved ||
                isRaceOfficial ||
                isRaceUnavailable
              }
              className="rounded-lg bg-green-800 px-6 py-3 font-semibold text-white transition hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingResults
                ? "Saving Results..."
                : resultsSaved || isRaceOfficial
                  ? "Results Official"
                  : "Save Official Results"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="p-8">
      <PageHeader
        eyebrow="Race management"
        title="Race Results"
        description="Enter and finalise race results by round."
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {rounds.length}{" "}
          {rounds.length === 1 ? "round" : "rounds"} ·{" "}
          {races.length}{" "}
          {races.length === 1 ? "race" : "races"}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Expand All
          </button>

          <button
            type="button"
            onClick={collapseAll}
            className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Collapse All
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm font-medium text-red-800">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mb-6 rounded-lg border border-green-300 bg-green-50 p-4 text-sm font-medium text-green-800">
          {successMessage}
        </div>
      )}

      {loadingPage ? (
        <div className="rounded-lg border bg-white p-8 text-center text-slate-500">
          Loading race results...
        </div>
      ) : sortedRounds.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-slate-500">
          No rounds have been created yet.
        </div>
      ) : (
        <div className="space-y-4">
          {sortedRounds.map((round) => {
            const roundRaces =
              racesByRoundId.get(round.id) ?? [];

            const expanded =
              expandedRoundIds.has(round.id);

            const officialCount =
              roundRaces.filter(
                (race) => race.status === "official"
              ).length;

            return (
              <section
                key={round.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => toggleRound(round.id)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition hover:bg-slate-50"
                  aria-expanded={expanded}
                >
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-slate-900">
                      {expanded ? "▼" : "▶"}{" "}
                      {getRoundLabel(round)}
                    </h2>

                    {round.round_date && (
                      <p className="mt-1 text-sm text-slate-500">
                        {formatRoundDate(round)}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-bold text-slate-900">
                      {roundRaces.length}{" "}
                      {roundRaces.length === 1
                        ? "race"
                        : "races"}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {officialCount} official
                    </p>
                  </div>
                </button>

                {expanded && (
                  <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-4 md:p-5">
                    {roundRaces.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
                        No races have been added to this round.
                      </div>
                    ) : (
                      roundRaces.map((race) => {
                        const raceExpanded =
                          expandedRaceIds.has(race.id);

                        const entryCount =
                          raceEntryCounts[race.id] ?? 0;

                        return (
                          <article
                            key={race.id}
                            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                          >
                            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                              <button
                                type="button"
                                onClick={() =>
                                  toggleRace(race.id)
                                }
                                className="min-w-0 flex-1 text-left"
                                aria-expanded={raceExpanded}
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="font-bold text-slate-900">
                                    {raceExpanded ? "▼" : "▶"}{" "}
                                    {getRaceLabel(race)}
                                  </h3>

                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                    {getGradeLabel(race.grade)}
                                  </span>

                                  <span
                                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getRaceStatusClasses(
                                      race.status
                                    )}`}
                                  >
                                    {getRaceStatusLabel(
                                      race.status
                                    )}
                                  </span>
                                </div>

                                <p className="mt-1 text-sm text-slate-500">
                                  {formatDateTime(
                                    race.scheduled_start
                                  )}
                                </p>

                                <p className="mt-2 text-sm font-semibold text-slate-700">
                                  {entryCount}{" "}
                                  {entryCount === 1
                                    ? "entry"
                                    : "entries"}
                                </p>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void selectRace(race.id)
                                }
                                disabled={
                                  loadingEntries &&
                                  selectedRaceId === race.id
                                }
                                className="shrink-0 rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-900 disabled:cursor-not-allowed disabled:bg-slate-400"
                              >
                                {selectedRaceId === race.id &&
                                loadingEntries
                                  ? "Loading..."
                                  : selectedRaceId === race.id
                                    ? "Reload Results"
                                    : "Enter Results"}
                              </button>
                            </div>

                            {raceExpanded &&
                              renderResultsEditor(race)}
                          </article>
                        );
                      })
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}