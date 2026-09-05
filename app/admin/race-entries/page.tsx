"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";

import PageHeader from "@/components/admin/PageHeader";
import AdminModal from "@/components/admin/AdminModal";

import type {
  EntryStatus,
  RaceEntry,
} from "@/types/race-entry";

type HorseOption = {
  id: string;
  name: string;
  current_price: number;
  is_active: boolean;
};

type RoundOption = {
  id: string;
  season_id: string;
  round_number: number;
  name: string | null;
  round_date: string | null;
  lockout_at: string | null;
  status: string;
};

type SeasonOption = {
  id: string;
  name: string;
  year: number;
  is_active: boolean;
};

type RaceOption = {
  id: string;
  round_id: string;
  race_number: number;
  race_name: string;
  grade: "L" | "G3" | "G2" | "G1";
  scheduled_start: string;
  status: string;
  distance_metres?: number | null;

  racecourse?: {
    id: string;
    name: string;
  } | null;
};

type EntryForm = {
  race_id: string;
  horse_id: string;
  saddlecloth_number: number | "";
  price_at_entry: number;
  entry_status: EntryStatus;
};

type ProjectionGrade =
  | "G1"
  | "G2"
  | "G3"
  | "Listed"
  | "Other";

type ProjectionFormRun = {
  id: string;
  horse_id: string;
  race_id: string | null;
  race_date: string | null;
  form_order: number | null;
  race_grade: ProjectionGrade;
  finish_position: number;
};

type ProjectionFormRow = {
  race_grade: ProjectionGrade | "";
  finish_position: number | "";
};

type RecentFormRow = {
  horse_id: string;
  recent_form: string | null;
};


const emptyEntry: EntryForm = {
  race_id: "",
  horse_id: "",
  saddlecloth_number: "",
  price_at_entry: 30000,
  entry_status: "runner",
};

const emptyProjectionFormRows: ProjectionFormRow[] = [
  {
    race_grade: "",
    finish_position: "",
  },
  {
    race_grade: "",
    finish_position: "",
  },
  {
    race_grade: "",
    finish_position: "",
  },
];

export default function RaceEntriesPage() {
  const [entries, setEntries] = useState<RaceEntry[]>([]);
  const [horses, setHorses] = useState<HorseOption[]>([]);
  const [races, setRaces] = useState<RaceOption[]>([]);
  const [rounds, setRounds] = useState<RoundOption[]>([]);
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState("");

  const [expandedRoundIds, setExpandedRoundIds] = useState<Set<string>>(
    new Set()
  );

  const [expandedRaceIds, setExpandedRaceIds] = useState<Set<string>>(
    new Set()
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(
    null
  );

  const [form, setForm] = useState<EntryForm>(emptyEntry);

  const [showProjectionModal, setShowProjectionModal] = useState(false);
  const [projectionEntry, setProjectionEntry] = useState<RaceEntry | null>(null);
  const [projectionOdds, setProjectionOdds] = useState<string>("");
  const [projectionFormRows, setProjectionFormRows] =
    useState<ProjectionFormRow[]>(emptyProjectionFormRows);
  const [competitionFormRuns, setCompetitionFormRuns] =
    useState<ProjectionFormRun[]>([]);
  const [projectionFormLoading, setProjectionFormLoading] = useState(false);
  const [projectionErrorMessage, setProjectionErrorMessage] = useState("");
  const [generatingProjectionRaceId, setGeneratingProjectionRaceId] =
    useState<string | null>(null);
  const [projectionGenerationMessage, setProjectionGenerationMessage] =
    useState("");
  const [projectionGenerationError, setProjectionGenerationError] =
    useState("");

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkRaceId, setBulkRaceId] = useState("");
  const [bulkSearchTerm, setBulkSearchTerm] = useState("");
  const [selectedBulkHorseIds, setSelectedBulkHorseIds] = useState<
    string[]
  >([]);
  const [bulkErrorMessage, setBulkErrorMessage] = useState("");
  const [bulkSuccessMessage, setBulkSuccessMessage] = useState("");

  const [formRatingsByHorseId, setFormRatingsByHorseId] =
    useState<Record<string, number | null>>({});

  const [recentFormsByHorseId, setRecentFormsByHorseId] =
    useState<Record<string, string>>({});
  const [showRecentFormModal, setShowRecentFormModal] = useState(false);
  const [recentFormEntry, setRecentFormEntry] = useState<RaceEntry | null>(null);
  const [recentFormValue, setRecentFormValue] = useState("");
  const [recentFormErrorMessage, setRecentFormErrorMessage] = useState("");
  const [recentFormSaving, setRecentFormSaving] = useState(false);

  useEffect(() => {
    void loadPageData();
  }, []);

  useEffect(() => {
    void loadRecentForms();
  }, [selectedSeasonId, entries]);

  async function loadPageData() {
    setLoading(true);
    setErrorMessage("");

    const [
      entriesResult,
      horsesResult,
      racesResult,
      roundsResult,
      seasonsResult,
    ] = await Promise.all([
      supabase
        .from("race_entries")
        .select(`
          id,
          race_id,
          horse_id,
          barrier,
          saddlecloth_number,
          price_at_entry,
          entry_status,
          scratched_at,
          starting_odds,
          projected_points,
          projection_calculated_at,
          created_at,
          updated_at,

          horse:horses (
            id,
            name,
            current_price
          ),

          race:races (
            id,
            round_id,
            race_number,
            race_name,
            grade,
            scheduled_start,
            status,
            distance_metres,

            racecourse:racecourses (
              id,
              name
            )
          )
        `)
        .order("created_at", { ascending: false }),

      supabase
        .from("horses")
        .select("id, name, current_price, is_active")
        .order("name", { ascending: true }),

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
          distance_metres,

          racecourse:racecourses (
            id,
            name
          )
        `)
        .order("scheduled_start", { ascending: true }),

      supabase
        .from("rounds")
        .select(`
          id,
          season_id,
          round_number,
          name,
          round_date,
          lockout_at,
          status
        `)
        .order("round_number", { ascending: false }),

      supabase
        .from("seasons")
        .select("id, name, year, is_active")
        .order("year", { ascending: false }),
    ]);

    if (entriesResult.error) {
      console.error(entriesResult.error);
      setErrorMessage("Could not load race entries.");
      setLoading(false);
      return;
    }

    if (horsesResult.error) {
      console.error(horsesResult.error);
      setErrorMessage("Could not load horses.");
      setLoading(false);
      return;
    }

    if (racesResult.error) {
      console.error(racesResult.error);
      setErrorMessage("Could not load races.");
      setLoading(false);
      return;
    }

    if (roundsResult.error) {
      console.error(roundsResult.error);
      setErrorMessage("Could not load rounds.");
      setLoading(false);
      return;
    }

    if (seasonsResult.error) {
      console.error(seasonsResult.error);
      setErrorMessage("Could not load seasons.");
      setLoading(false);
      return;
    }

    const loadedEntries =
      (entriesResult.data ?? []) as unknown as RaceEntry[];

    const loadedHorses =
      (horsesResult.data ?? []) as HorseOption[];

    const loadedRaces =
      (racesResult.data ?? []) as unknown as RaceOption[];

    const loadedRounds =
      (roundsResult.data ?? []) as RoundOption[];

    const loadedSeasons =
      (seasonsResult.data ?? []) as SeasonOption[];

    const enteredHorseIds = Array.from(
      new Set(loadedEntries.map((entry) => entry.horse_id))
    );

    let nextFormRatings: Record<string, number | null> = {};

    if (enteredHorseIds.length > 0) {
      const { data: formRatingRows, error: formRatingError } =
        await supabase.rpc("get_horse_recent_form_ratings", {
          p_horse_ids: enteredHorseIds,
        });

      if (formRatingError) {
        console.error(
          "Could not load recent form ratings:",
          formRatingError
        );
      } else {
        nextFormRatings = Object.fromEntries(
          (
            (formRatingRows ?? []) as Array<{
              horse_id: string;
              form_rating: number | string | null;
            }>
          ).map((row) => [
            row.horse_id,
            row.form_rating === null
              ? null
              : Number(row.form_rating),
          ])
        );
      }
    }

    setEntries(loadedEntries);
    setHorses(loadedHorses);
    setRaces(loadedRaces);
    setRounds(loadedRounds);
    setSeasons(loadedSeasons);
    setFormRatingsByHorseId(nextFormRatings);
    setSelectedSeasonId((current) => {
      if (
        current &&
        loadedSeasons.some((season) => season.id === current)
      ) {
        return current;
      }

      const preferredSeason =
        loadedSeasons.find((season) => season.is_active) ??
        loadedSeasons[0];

      return preferredSeason?.id ?? "";
    });

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

    setLoading(false);
  }

  async function loadRecentForms() {
    if (!selectedSeasonId || entries.length === 0) {
      setRecentFormsByHorseId({});
      return;
    }

    const horseIds = Array.from(
      new Set(entries.map((entry) => entry.horse_id))
    );

    if (horseIds.length === 0) {
      setRecentFormsByHorseId({});
      return;
    }

    const { data, error } = await supabase.rpc(
      "get_horse_recent_forms",
      {
        p_horse_ids: horseIds,
        p_season_id: selectedSeasonId,
      }
    );

    if (error) {
      console.error("Could not load recent forms:", error);
      return;
    }

    setRecentFormsByHorseId(
      Object.fromEntries(
        ((data ?? []) as RecentFormRow[]).map((row) => [
          row.horse_id,
          row.recent_form ?? "",
        ])
      )
    );
  }

  async function openRecentFormModal(entry: RaceEntry) {
    setRecentFormEntry(entry);
    setRecentFormErrorMessage("");

    const { data, error } = await supabase.rpc(
      "get_horse_recent_form_seed",
      {
        p_horse_id: entry.horse_id,
        p_season_id: selectedSeasonId,
      }
    );

    if (error) {
      console.error("Could not load recent form seed:", error);
      setRecentFormErrorMessage(error.message);
      setRecentFormValue("");
    } else {
      const payload = data as { recent_form?: string | null } | null;
      setRecentFormValue(payload?.recent_form ?? "");
    }

    setShowRecentFormModal(true);
  }

  function closeRecentFormModal() {
    if (recentFormSaving) {
      return;
    }

    setShowRecentFormModal(false);
    setRecentFormEntry(null);
    setRecentFormValue("");
    setRecentFormErrorMessage("");
  }

  async function saveRecentForm(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!recentFormEntry || !selectedSeasonId) {
      return;
    }

    const normalisedForm = recentFormValue
      .trim()
      .toUpperCase();

    if (
      normalisedForm &&
      !/^[0-9-]{1,5}$/.test(normalisedForm)
    ) {
      setRecentFormErrorMessage(
        "Recent form can contain up to five characters using 0-9 and - only."
      );
      return;
    }

    setRecentFormSaving(true);
    setRecentFormErrorMessage("");

    const { error } = await supabase.rpc(
      "save_horse_recent_form_seed",
      {
        p_horse_id: recentFormEntry.horse_id,
        p_season_id: selectedSeasonId,
        p_recent_form: normalisedForm,
      }
    );

    if (error) {
      console.error("Could not save recent form:", error);
      setRecentFormErrorMessage(error.message);
      setRecentFormSaving(false);
      return;
    }

    setRecentFormSaving(false);
    closeRecentFormModal();
    await loadRecentForms();
  }

  async function openProjectionModal(entry: RaceEntry) {
    setProjectionEntry(entry);
    setProjectionOdds(
      entry.starting_odds === null
        ? ""
        : String(entry.starting_odds)
    );
    setProjectionFormRows(
      emptyProjectionFormRows.map((row) => ({ ...row }))
    );
    setCompetitionFormRuns([]);
    setProjectionErrorMessage("");
    setProjectionFormLoading(true);
    setShowProjectionModal(true);

    const { data, error } = await supabase.rpc(
      "get_horse_projection_form",
      {
        p_horse_id: entry.horse_id,
      }
    );

    if (error) {
      console.error(error);
      setProjectionErrorMessage(
        `Could not load previous form: ${error.message}`
      );
      setProjectionFormLoading(false);
      return;
    }

    const payload = data as {
      success?: boolean;
      runs?: ProjectionFormRun[];
    } | null;

    const loadedRuns = Array.isArray(payload?.runs)
      ? payload?.runs ?? []
      : [];

    const manualRuns = loadedRuns.filter(
      (run) => run.race_id === null
    );

    const generatedRuns = loadedRuns.filter(
      (run) => run.race_id !== null
    );

    const nextRows = emptyProjectionFormRows.map(
      (row) => ({ ...row })
    );

    manualRuns
      .sort(
        (a, b) =>
          (a.form_order ?? 99) - (b.form_order ?? 99)
      )
      .slice(0, 3)
      .forEach((run, index) => {
        nextRows[index] = {
          race_grade: run.race_grade,
          finish_position: run.finish_position,
        };
      });

    setProjectionFormRows(nextRows);
    setCompetitionFormRuns(generatedRuns);
    setProjectionFormLoading(false);
  }

  function closeProjectionModal() {
    if (saving) {
      return;
    }

    setShowProjectionModal(false);
    setProjectionEntry(null);
    setProjectionOdds("");
    setProjectionFormRows(
      emptyProjectionFormRows.map((row) => ({ ...row }))
    );
    setCompetitionFormRuns([]);
    setProjectionFormLoading(false);
    setProjectionErrorMessage("");
  }

  function updateProjectionFormRow(
    index: number,
    field: keyof ProjectionFormRow,
    value: string
  ) {
    setProjectionFormRows((currentRows) =>
      currentRows.map((row, rowIndex) => {
        if (rowIndex !== index) {
          return row;
        }

        if (field === "finish_position") {
          return {
            ...row,
            finish_position:
              value === "" ? "" : Number(value),
          };
        }

        return {
          ...row,
          [field]: value,
        } as ProjectionFormRow;
      })
    );

    setProjectionErrorMessage("");
  }

  async function saveProjectionData(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!projectionEntry) {
      return;
    }

    setProjectionErrorMessage("");

    const odds =
      projectionOdds.trim() === ""
        ? null
        : Number(projectionOdds);

    if (
      odds !== null &&
      (!Number.isFinite(odds) || odds <= 1)
    ) {
      setProjectionErrorMessage(
        "Starting odds must be greater than 1.00."
      );
      return;
    }

    const completedRuns: Array<{
      race_grade: ProjectionGrade;
      finish_position: number;
    }> = [];

    for (let index = 0; index < projectionFormRows.length; index += 1) {
      const row = projectionFormRows[index];

      const hasAnyValue =
        Boolean(row.race_grade) ||
        row.finish_position !== "";

      if (!hasAnyValue) {
        continue;
      }

      if (
        !row.race_grade ||
        row.finish_position === ""
      ) {
        setProjectionErrorMessage(
          `Previous start ${index + 1} is incomplete. Enter the grade and finish, or leave the whole row blank.`
        );
        return;
      }

      if (
        !Number.isInteger(row.finish_position) ||
        Number(row.finish_position) < 1
      ) {
        setProjectionErrorMessage(
          `Previous start ${index + 1} finish position must be a whole number of 1 or greater.`
        );
        return;
      }

      completedRuns.push({
        race_grade: row.race_grade,
        finish_position: Number(row.finish_position),
      });
    }

    setSaving(true);

    const [oddsResult, formResult] = await Promise.all([
      supabase
        .from("race_entries")
        .update({
          starting_odds: odds,
          projected_points: null,
          projection_calculated_at: null,
        })
        .eq("id", projectionEntry.id),

      supabase.rpc("save_horse_projection_form", {
        p_horse_id: projectionEntry.horse_id,
        p_runs: completedRuns,
      }),
    ]);

    if (oddsResult.error) {
      console.error(oddsResult.error);
      setProjectionErrorMessage(
        `Could not save starting odds: ${oddsResult.error.message}`
      );
      setSaving(false);
      return;
    }

    if (formResult.error) {
      console.error(formResult.error);
      setProjectionErrorMessage(
        `Could not save previous form: ${formResult.error.message}`
      );
      setSaving(false);
      return;
    }

    setSaving(false);
    closeProjectionModal();
    await loadPageData();
  }

  async function generateRaceProjections(race: RaceOption) {
    setProjectionGenerationMessage("");
    setProjectionGenerationError("");
    setGeneratingProjectionRaceId(race.id);

    const { data, error } = await supabase.rpc(
      "generate_race_projections",
      { p_race_id: race.id }
    );

    if (error) {
      console.error(error);
      setProjectionGenerationError(
        `${getRaceLabel(race)}: ${error.message}`
      );
      setGeneratingProjectionRaceId(null);
      return;
    }

    const payload = data as { runner_count?: number } | null;

    setProjectionGenerationMessage(
      `${getRaceLabel(race)}: projections generated successfully${
        payload?.runner_count
          ? ` for ${payload.runner_count} runners`
          : ""
      }.`
    );

    setGeneratingProjectionRaceId(null);
    await loadPageData();
  }

  function openBulkEntryModal(raceId?: string) {
    setBulkRaceId(raceId ?? "");
    setBulkSearchTerm("");
    setSelectedBulkHorseIds([]);
    setBulkErrorMessage("");
    setBulkSuccessMessage("");
    setShowBulkModal(true);
  }

  function closeBulkModal() {
    if (saving) {
      return;
    }

    setShowBulkModal(false);
    setBulkRaceId("");
    setBulkSearchTerm("");
    setSelectedBulkHorseIds([]);
    setBulkErrorMessage("");
    setBulkSuccessMessage("");
  }

  function openNewEntryModal(raceId?: string) {
    setEditingEntryId(null);
    setErrorMessage("");

    if (raceId) {
      setForm({
        ...emptyEntry,
        race_id: raceId,
        saddlecloth_number: getNextSaddleclothNumber(raceId),
      });
    } else {
      setForm(emptyEntry);
    }

    setShowModal(true);
  }

  function editEntry(entry: RaceEntry) {
    setEditingEntryId(entry.id);
    setErrorMessage("");

    setForm({
      race_id: entry.race_id,
      horse_id: entry.horse_id,
      saddlecloth_number: entry.saddlecloth_number ?? "",
      price_at_entry: entry.price_at_entry,
      entry_status: entry.entry_status,
    });

    setShowModal(true);
  }

  function closeModal() {
    if (saving) {
      return;
    }

    setEditingEntryId(null);
    setErrorMessage("");
    setForm(emptyEntry);
    setShowModal(false);
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
    setExpandedRoundIds(
      new Set(filteredRounds.map((round) => round.id))
    );
    setExpandedRaceIds(
      new Set(filteredRaces.map((race) => race.id))
    );
  }

  function collapseAll() {
    setExpandedRoundIds(new Set());
    setExpandedRaceIds(new Set());
  }

  function getNextSaddleclothNumber(raceId: string) {
    const usedNumbers = entries
      .filter(
        (entry) =>
          entry.race_id === raceId &&
          entry.id !== editingEntryId
      )
      .map((entry) => entry.saddlecloth_number)
      .filter(
        (number): number is number =>
          number !== null
      );

    if (usedNumbers.length === 0) {
      return 1;
    }

    return Math.max(...usedNumbers) + 1;
  }

  function handleRaceChange(raceId: string) {
    setForm((currentForm) => ({
      ...currentForm,
      race_id: raceId,
      saddlecloth_number: raceId
        ? getNextSaddleclothNumber(raceId)
        : "",
    }));
  }

  function handleHorseChange(horseId: string) {
    const selectedHorse = horses.find(
      (horse) => horse.id === horseId
    );

    setForm((currentForm) => ({
      ...currentForm,
      horse_id: horseId,
      price_at_entry:
        selectedHorse?.current_price ?? 30000,
    }));
  }

  async function processPreLockoutScratchReplacement(
    raceId: string
  ) {
    const race = races.find((item) => item.id === raceId);

    if (!race) {
      return;
    }

    const round = rounds.find(
      (item) => item.id === race.round_id
    );

    if (!round?.lockout_at) {
      return;
    }

    const lockoutTime = new Date(round.lockout_at).getTime();

    if (
      !Number.isFinite(lockoutTime) ||
      Date.now() < lockoutTime
    ) {
      return;
    }

    const { data, error } = await supabase.rpc(
      "replace_scratched_team_horses",
      {
        p_round_id: round.id,
      }
    );

    if (error) {
      console.error(
        "Retrospective scratch replacement error:",
        error
      );

      throw new Error(
        `Scratch was saved, but team replacements failed: ${error.message}`
      );
    }

    console.log(
      "Retrospective scratch replacement result:",
      data
    );
  }

  async function saveEntry(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setErrorMessage("");

    if (!form.race_id) {
      setErrorMessage("Please select a race.");
      return;
    }

    if (!form.horse_id) {
      setErrorMessage("Please select a horse.");
      return;
    }

    if (
      typeof form.saddlecloth_number === "number" &&
      form.saddlecloth_number < 1
    ) {
      setErrorMessage(
        "Saddlecloth number must be at least 1."
      );
      return;
    }

    if (form.price_at_entry < 30000) {
      setErrorMessage(
        "Entry price cannot be below $30,000."
      );
      return;
    }

    const duplicateEntry = entries.find(
      (entry) =>
        entry.race_id === form.race_id &&
        entry.horse_id === form.horse_id &&
        entry.id !== editingEntryId
    );

    if (duplicateEntry) {
      setErrorMessage(
        "This horse has already been entered in that race."
      );
      return;
    }

    const duplicateSaddlecloth = entries.find(
      (entry) =>
        entry.race_id === form.race_id &&
        typeof form.saddlecloth_number === "number" &&
        entry.saddlecloth_number === form.saddlecloth_number &&
        entry.id !== editingEntryId
    );

    if (duplicateSaddlecloth) {
      setErrorMessage(
        "That saddlecloth number is already being used in this race."
      );
      return;
    }

    setSaving(true);

    const isScratched =
      form.entry_status !== "runner";

    const entryData = {
      race_id: form.race_id,
      horse_id: form.horse_id,

      saddlecloth_number:
        typeof form.saddlecloth_number === "number"
          ? form.saddlecloth_number
          : null,

      price_at_entry: form.price_at_entry,
      entry_status: form.entry_status,

      scratched_at: isScratched
        ? new Date().toISOString()
        : null,

      barrier: null,
    };

    let saveError;

    if (editingEntryId) {
      const { error } = await supabase
        .from("race_entries")
        .update(entryData)
        .eq("id", editingEntryId);

      saveError = error;
    } else {
      const { error } = await supabase
        .from("race_entries")
        .insert(entryData);

      saveError = error;
    }

    if (saveError) {
      console.error(saveError);

      if (saveError.code === "23505") {
        setErrorMessage(
          "This horse or saddlecloth number is already being used in that race."
        );
      } else {
        setErrorMessage(saveError.message);
      }

      setSaving(false);
      return;
    }

    if (
      editingEntryId &&
      form.entry_status === "scratched_before_lockout"
    ) {
      try {
        await processPreLockoutScratchReplacement(
          form.race_id
        );
      } catch (replacementError) {
        console.error(replacementError);
        setErrorMessage(
          replacementError instanceof Error
            ? replacementError.message
            : "Scratch was saved, but team replacements failed."
        );
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    closeModal();

    setExpandedRaceIds((current) => {
      const next = new Set(current);
      next.add(form.race_id);
      return next;
    });

    await loadPageData();
  }

  function toggleBulkHorse(horseId: string) {
    setSelectedBulkHorseIds((currentIds) =>
      currentIds.includes(horseId)
        ? currentIds.filter((id) => id !== horseId)
        : [...currentIds, horseId]
    );

    setBulkErrorMessage("");
    setBulkSuccessMessage("");
  }

  async function saveBulkEntries() {
    setBulkErrorMessage("");
    setBulkSuccessMessage("");

    if (!bulkRaceId) {
      setBulkErrorMessage("Please select a race.");
      return;
    }

    if (selectedBulkHorseIds.length === 0) {
      setBulkErrorMessage("Select at least one horse.");
      return;
    }

    const alreadyUsedNumbers = entries
      .filter(
        (entry) =>
          entry.race_id === bulkRaceId &&
          entry.saddlecloth_number !== null
      )
      .map((entry) => entry.saddlecloth_number as number);

    let nextSaddleclothNumber =
      alreadyUsedNumbers.length > 0
        ? Math.max(...alreadyUsedNumbers) + 1
        : 1;

    const selectedHorses = selectedBulkHorseIds
      .map((horseId) =>
        horses.find((horse) => horse.id === horseId)
      )
      .filter(
        (horse): horse is HorseOption =>
          Boolean(horse)
      );

    const rowsToInsert = selectedHorses.map((horse) => {
      const row = {
        race_id: bulkRaceId,
        horse_id: horse.id,
        barrier: null,
        saddlecloth_number: nextSaddleclothNumber,
        price_at_entry: horse.current_price,
        entry_status: "runner" as EntryStatus,
        scratched_at: null,
      };

      nextSaddleclothNumber += 1;
      return row;
    });

    setSaving(true);

    const { error } = await supabase
      .from("race_entries")
      .insert(rowsToInsert);

    if (error) {
      console.error(error);

      if (error.code === "23505") {
        setBulkErrorMessage(
          "One or more selected horses are already entered in this race."
        );
      } else {
        setBulkErrorMessage(error.message);
      }

      setSaving(false);
      return;
    }

    const addedCount = rowsToInsert.length;

    setSelectedBulkHorseIds([]);
    setBulkSuccessMessage(
      `${addedCount} ${
        addedCount === 1 ? "horse was" : "horses were"
      } added successfully.`
    );

    setExpandedRaceIds((current) => {
      const next = new Set(current);
      next.add(bulkRaceId);
      return next;
    });

    setSaving(false);
    await loadPageData();
  }

  async function toggleScratch(entry: RaceEntry) {
    const changingToScratched =
      entry.entry_status === "runner";

    const confirmed = window.confirm(
      changingToScratched
        ? `Mark ${getHorseName(entry)} as scratched before lockout?`
        : `Return ${getHorseName(entry)} to runner status?`
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage("");

    const { error } = await supabase
      .from("race_entries")
      .update({
        entry_status: changingToScratched
          ? "scratched_before_lockout"
          : "runner",

        scratched_at: changingToScratched
          ? new Date().toISOString()
          : null,
      })
      .eq("id", entry.id);

    if (error) {
      console.error(error);
      setErrorMessage(error.message);
      return;
    }

    if (changingToScratched) {
      try {
        await processPreLockoutScratchReplacement(
          entry.race_id
        );
      } catch (replacementError) {
        console.error(replacementError);
        setErrorMessage(
          replacementError instanceof Error
            ? replacementError.message
            : "Scratch was saved, but team replacements failed."
        );
      }
    }

    await loadPageData();
  }

  function getHorseName(entry: RaceEntry) {
    return entry.horse?.name ?? "Unknown horse";
  }

  function getRacecourseName(
    race: RaceEntry["race"] | RaceOption
  ) {
    return race?.racecourse?.name ?? "Racecourse";
  }

  function getRaceLabel(
    race: RaceEntry["race"] | RaceOption
  ) {
    if (!race) {
      return "Unknown race";
    }

    return `${getRacecourseName(race)} R${race.race_number} — ${race.race_name}`;
  }

  function getRoundLabel(round: RoundOption) {
    return round.name
      ? `Round ${round.round_number} — ${round.name}`
      : `Round ${round.round_number}`;
  }

  function formatMoney(amount: number) {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(amount);
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

  function getStatusLabel(status: EntryStatus) {
    if (status === "scratched_before_lockout") {
      return "Scratched Before Lockout";
    }

    if (status === "scratched_after_lockout") {
      return "Scratched After Lockout";
    }

    return "Runner";
  }

  function getStatusClasses(status: EntryStatus) {
    if (status === "runner") {
      return "bg-green-100 text-green-800";
    }

    if (status === "scratched_before_lockout") {
      return "bg-amber-100 text-amber-800";
    }

    return "bg-red-100 text-red-800";
  }

  function getGradeLabel(grade: RaceOption["grade"]) {
    const labels: Record<RaceOption["grade"], string> = {
      L: "Listed",
      G3: "Group 3",
      G2: "Group 2",
      G1: "Group 1",
    };

    return labels[grade];
  }

  const filteredRounds = useMemo(() => {
    if (!selectedSeasonId) {
      return [];
    }

    return rounds.filter(
      (round) => round.season_id === selectedSeasonId
    );
  }, [rounds, selectedSeasonId]);

  const selectedSeasonRoundIds = useMemo(
    () => new Set(filteredRounds.map((round) => round.id)),
    [filteredRounds]
  );

  const filteredRaces = useMemo(() => {
    return races.filter((race) =>
      selectedSeasonRoundIds.has(race.round_id)
    );
  }, [races, selectedSeasonRoundIds]);

  const sortedRounds = useMemo(() => {
    return [...filteredRounds].sort(
      (a, b) => b.round_number - a.round_number
    );
  }, [filteredRounds]);

  const sortedRaces = useMemo(() => {
    return [...filteredRaces].sort(
      (firstRace, secondRace) =>
        new Date(firstRace.scheduled_start).getTime() -
        new Date(secondRace.scheduled_start).getTime()
    );
  }, [filteredRaces]);

  const racesByRoundId = useMemo(() => {
    const map = new Map<string, RaceOption[]>();

    for (const race of sortedRaces) {
      const current = map.get(race.round_id) ?? [];
      current.push(race);
      map.set(race.round_id, current);
    }

    return map;
  }, [sortedRaces]);

  const entriesByRaceId = useMemo(() => {
    const map = new Map<string, RaceEntry[]>();

    for (const entry of entries) {
      const current = map.get(entry.race_id) ?? [];
      current.push(entry);
      map.set(entry.race_id, current);
    }

    for (const raceEntries of map.values()) {
      raceEntries.sort((a, b) => {
        const saddleclothA = a.saddlecloth_number ?? 999;
        const saddleclothB = b.saddlecloth_number ?? 999;

        if (saddleclothA !== saddleclothB) {
          return saddleclothA - saddleclothB;
        }

        return getHorseName(a).localeCompare(getHorseName(b));
      });
    }

    return map;
  }, [entries]);

  const availableHorses = useMemo(() => {
    return horses.filter(
      (horse) =>
        horse.is_active ||
        horse.id === form.horse_id
    );
  }, [horses, form.horse_id]);

  const enteredHorseIdsForBulkRace = useMemo(() => {
    return new Set(
      entries
        .filter((entry) => entry.race_id === bulkRaceId)
        .map((entry) => entry.horse_id)
    );
  }, [entries, bulkRaceId]);

  const bulkRaceEntriesCount = useMemo(() => {
    return entries.filter(
      (entry) => entry.race_id === bulkRaceId
    ).length;
  }, [entries, bulkRaceId]);

  const bulkHorseOptions = useMemo(() => {
    const normalisedSearch = bulkSearchTerm
      .trim()
      .toLowerCase();

    return horses.filter((horse) => {
      if (!horse.is_active) {
        return false;
      }

      if (enteredHorseIdsForBulkRace.has(horse.id)) {
        return false;
      }

      return (
        !normalisedSearch ||
        horse.name.toLowerCase().includes(normalisedSearch)
      );
    });
  }, [
    horses,
    bulkSearchTerm,
    enteredHorseIdsForBulkRace,
  ]);

  function selectAllVisibleBulkHorses() {
    setSelectedBulkHorseIds(
      bulkHorseOptions.map((horse) => horse.id)
    );
    setBulkErrorMessage("");
    setBulkSuccessMessage("");
  }

  function clearBulkSelection() {
    setSelectedBulkHorseIds([]);
    setBulkErrorMessage("");
    setBulkSuccessMessage("");
  }

  const normalisedSearchTerm = searchTerm
    .trim()
    .toLowerCase();

  const matchingRaceIds = useMemo(() => {
    const matching = new Set<string>();

    if (!normalisedSearchTerm) {
      return matching;
    }

    for (const race of filteredRaces) {
      const raceMatches =
        getRaceLabel(race)
          .toLowerCase()
          .includes(normalisedSearchTerm);

      const entryMatches = (
        entriesByRaceId.get(race.id) ?? []
      ).some((entry) =>
        getHorseName(entry)
          .toLowerCase()
          .includes(normalisedSearchTerm)
      );

      if (raceMatches || entryMatches) {
        matching.add(race.id);
      }
    }

    return matching;
  }, [
    filteredRaces,
    entriesByRaceId,
    normalisedSearchTerm,
  ]);

  const visibleRounds = useMemo(() => {
    if (!normalisedSearchTerm) {
      return sortedRounds;
    }

    return sortedRounds.filter((round) => {
      const roundRaces = racesByRoundId.get(round.id) ?? [];

      return roundRaces.some((race) =>
        matchingRaceIds.has(race.id)
      );
    });
  }, [
    sortedRounds,
    racesByRoundId,
    matchingRaceIds,
    normalisedSearchTerm,
  ]);

  useEffect(() => {
    if (!normalisedSearchTerm) {
      return;
    }

    const roundIdsToOpen = new Set<string>();

    for (const race of filteredRaces) {
      if (matchingRaceIds.has(race.id)) {
        roundIdsToOpen.add(race.round_id);
      }
    }

    setExpandedRoundIds((current) => {
      const next = new Set(current);

      for (const roundId of roundIdsToOpen) {
        next.add(roundId);
      }

      return next;
    });

    setExpandedRaceIds((current) => {
      const next = new Set(current);

      for (const raceId of matchingRaceIds) {
        next.add(raceId);
      }

      return next;
    });
  }, [
    normalisedSearchTerm,
    filteredRaces,
    matchingRaceIds,
  ]);

  return (
    <main className="p-8">
      <PageHeader
        eyebrow="Race management"
        title="Race Entries"
        description="Manage race fields by round and race."
        buttonLabel="New Entry"
        onButtonClick={() => openNewEntryModal()}
      />

      {seasons.length > 0 && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <label
                htmlFor="season-filter"
                className="block text-sm font-semibold text-slate-700"
              >
                Season
              </label>

              <p className="mt-1 text-sm text-slate-500">
                Choose which season&apos;s race entries you want to manage.
              </p>
            </div>

            <select
              id="season-filter"
              value={selectedSeasonId}
              onChange={(event) => {
                setSelectedSeasonId(event.target.value);
                setSearchTerm("");
                setExpandedRoundIds(new Set());
                setExpandedRaceIds(new Set());
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 sm:w-80"
            >
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name} {season.year}
                  {season.is_active ? " — Active" : ""}
                </option>
              ))}
            </select>
          </div>
        </section>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openBulkEntryModal()}
            className="rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white transition hover:bg-teal-800"
          >
            Bulk Add Horses
          </button>

          <button
            type="button"
            onClick={expandAll}
            className="rounded-lg border bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Expand All
          </button>

          <button
            type="button"
            onClick={collapseAll}
            className="rounded-lg border bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Collapse All
          </button>
        </div>

        <p className="text-sm text-slate-500">
          {filteredRaces.reduce(
            (total, race) =>
              total + (entriesByRaceId.get(race.id)?.length ?? 0),
            0
          )}{" "}
          entries
        </p>
      </div>

      {errorMessage && !showModal && !showBulkModal && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      {projectionGenerationError && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          {projectionGenerationError}
        </div>
      )}

      {projectionGenerationMessage && (
        <div className="mb-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800">
          {projectionGenerationMessage}
        </div>
      )}

      <div className="mb-6">
        <input
          type="search"
          placeholder="Search horse or race..."
          value={searchTerm}
          onChange={(event) =>
            setSearchTerm(event.target.value)
          }
          className="w-full rounded-lg border bg-white p-3"
        />
      </div>

      {loading ? (
        <div className="rounded-lg border bg-white p-8 text-center text-slate-500">
          Loading race entries...
        </div>
      ) : visibleRounds.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-slate-500">
          {normalisedSearchTerm
            ? "No race entries match your search."
            : "No rounds are available for this season."}
        </div>
      ) : (
        <div className="space-y-4">
          {visibleRounds.map((round) => {
            const roundRaces =
              racesByRoundId.get(round.id) ?? [];

            const visibleRoundRaces = normalisedSearchTerm
              ? roundRaces.filter((race) =>
                  matchingRaceIds.has(race.id)
                )
              : roundRaces;

            const roundEntryCount = visibleRoundRaces.reduce(
              (total, race) =>
                total +
                (entriesByRaceId.get(race.id)?.length ?? 0),
              0
            );

            const expanded =
              expandedRoundIds.has(round.id) ||
              Boolean(normalisedSearchTerm);

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
                      {visibleRoundRaces.length}{" "}
                      {visibleRoundRaces.length === 1
                        ? "race"
                        : "races"}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {roundEntryCount}{" "}
                      {roundEntryCount === 1
                        ? "entry"
                        : "entries"}
                    </p>
                  </div>
                </button>

                {expanded && (
                  <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-4 md:p-5">
                    {visibleRoundRaces.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
                        No races have been added to this round.
                      </div>
                    ) : (
                      visibleRoundRaces.map((race) => {
                        const raceEntries =
                          entriesByRaceId.get(race.id) ?? [];

                        const runnerCount = raceEntries.filter(
                          (entry) =>
                            entry.entry_status === "runner"
                        ).length;

                        const scratchedCount =
                          raceEntries.length - runnerCount;

                        const raceExpanded =
                          expandedRaceIds.has(race.id) ||
                          Boolean(normalisedSearchTerm);

                        return (
                          <article
                            key={race.id}
                            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                          >
                            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                              <button
                                type="button"
                                onClick={() => toggleRace(race.id)}
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
                                </div>

                                <p className="mt-1 text-sm text-slate-500">
                                  {formatDateTime(
                                    race.scheduled_start
                                  )}
                                  {race.distance_metres
                                    ? ` · ${race.distance_metres.toLocaleString()} m`
                                    : ""}
                                </p>

                                <p className="mt-2 text-sm font-semibold text-slate-700">
                                  {runnerCount}{" "}
                                  {runnerCount === 1
                                    ? "runner"
                                    : "runners"}
                                  {scratchedCount > 0
                                    ? ` · ${scratchedCount} scratched`
                                    : ""}
                                </p>
                              </button>

                              <div className="flex shrink-0 flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    generateRaceProjections(race)
                                  }
                                  disabled={
                                    generatingProjectionRaceId !== null
                                  }
                                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                                >
                                  {generatingProjectionRaceId === race.id
                                    ? "Generating..."
                                    : "Generate Projections"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    openBulkEntryModal(race.id)
                                  }
                                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
                                >
                                  Add Horses
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    openNewEntryModal(race.id)
                                  }
                                  className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                  Add One
                                </button>
                              </div>
                            </div>

                            {raceExpanded && (
                              <div className="border-t border-slate-200">
                                {raceEntries.length === 0 ? (
                                  <div className="p-8 text-center text-slate-500">
                                    No runners have been entered for this race.
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-200">
                                      <thead className="bg-slate-50">
                                        <tr>
                                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                                            No.
                                          </th>

                                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                                            Horse
                                          </th>

                                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                                            Recent Form
                                          </th>

                                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                                            Entry Price
                                          </th>

                                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                                            Odds
                                          </th>

                                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                                            Form Rating
                                          </th>

                                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                                            Projected
                                          </th>

                                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                                            Status
                                          </th>

                                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                                            Actions
                                          </th>
                                        </tr>
                                      </thead>

                                      <tbody className="divide-y divide-slate-200 bg-white">
                                        {raceEntries.map((entry) => (
                                          <tr
                                            key={entry.id}
                                            className="hover:bg-slate-50"
                                          >
                                            <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                                              {entry.saddlecloth_number ??
                                                "—"}
                                            </td>

                                            <td className="px-4 py-4 font-semibold text-slate-900">
                                              {getHorseName(entry)}
                                            </td>

                                            <td className="px-4 py-4">
                                              <span className="font-mono text-sm font-black tracking-[0.18em] text-slate-800">
                                                {recentFormsByHorseId[
                                                  entry.horse_id
                                                ] || "—"}
                                              </span>
                                            </td>

                                            <td className="px-4 py-4 text-sm text-slate-700">
                                              {formatMoney(
                                                entry.price_at_entry
                                              )}
                                            </td>

                                            <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                                              {entry.starting_odds === null
                                                ? "—"
                                                : `$${Number(entry.starting_odds).toFixed(2)}`}
                                            </td>

                                            <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                                              {formRatingsByHorseId[
                                                entry.horse_id
                                              ] === null ||
                                              formRatingsByHorseId[
                                                entry.horse_id
                                              ] === undefined
                                                ? "—"
                                                : Number(
                                                    formRatingsByHorseId[
                                                      entry.horse_id
                                                    ]
                                                  ).toFixed(1)}
                                            </td>

                                            <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                                              {entry.projected_points === null
                                                ? "—"
                                                : `${entry.projected_points} pts`}
                                            </td>

                                            <td className="px-4 py-4">
                                              <span
                                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                                                  entry.entry_status
                                                )}`}
                                              >
                                                {getStatusLabel(
                                                  entry.entry_status
                                                )}
                                              </span>
                                            </td>

                                            <td className="px-4 py-4">
                                              <div className="flex flex-wrap gap-2">
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    openRecentFormModal(entry)
                                                  }
                                                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
                                                >
                                                  Recent Form
                                                </button>

                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    openProjectionModal(entry)
                                                  }
                                                  className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-100"
                                                >
                                                  Projection Data
                                                </button>

                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    editEntry(entry)
                                                  }
                                                  className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                                                >
                                                  Edit
                                                </button>

                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    toggleScratch(
                                                      entry
                                                    )
                                                  }
                                                  className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                                                >
                                                  {entry.entry_status ===
                                                  "runner"
                                                    ? "Scratch"
                                                    : "Restore"}
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )}
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

      <AdminModal
        isOpen={showRecentFormModal}
        title="Recent Form"
        description={
          recentFormEntry
            ? `Set the starting recent form for ${getHorseName(recentFormEntry)} in the selected season.`
            : "Set starting recent form."
        }
        onClose={closeRecentFormModal}
        maxWidth="md"
      >
        <form
          onSubmit={saveRecentForm}
          className="space-y-5"
        >
          {recentFormErrorMessage && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              {recentFormErrorMessage}
            </div>
          )}

          {recentFormEntry && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="font-bold text-slate-900">
                {getHorseName(recentFormEntry)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                This is the horse&apos;s starting form for the selected season.
                Official Racecourse Fantasy results are appended automatically.
              </p>
            </div>
          )}

          <div>
            <label
              htmlFor="recent-form"
              className="mb-1 block font-medium"
            >
              Starting Recent Form
            </label>

            <input
              id="recent-form"
              type="text"
              maxLength={5}
              value={recentFormValue}
              onChange={(event) =>
                setRecentFormValue(
                  event.target.value
                    .toUpperCase()
                    .replace(/[^0-9-]/g, "")
                    .slice(0, 5)
                )
              }
              placeholder="e.g. 125-4"
              className="w-full rounded-lg border p-3 font-mono text-lg font-black tracking-[0.18em]"
            />

            <p className="mt-2 text-sm text-slate-500">
              Use 1-9 for finishing positions, 0 for 10th or worse, and - for a spell.
              The newest character should be on the right. After each official season
              run, the new result is added automatically and only the latest five
              characters are displayed.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeRecentFormModal}
              disabled={recentFormSaving}
              className="rounded-lg border px-5 py-3 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={recentFormSaving}
              className="rounded-lg bg-amber-500 px-5 py-3 font-semibold text-amber-950 hover:bg-amber-400 disabled:bg-slate-300"
            >
              {recentFormSaving ? "Saving..." : "Save Recent Form"}
            </button>
          </div>
        </form>
      </AdminModal>

      <AdminModal
        isOpen={showProjectionModal}
        title="Projection Data"
        description={
          projectionEntry
            ? `Manage projection inputs for ${getHorseName(projectionEntry)}.`
            : "Manage projection inputs."
        }
        onClose={closeProjectionModal}
        maxWidth="lg"
      >
        <form
          onSubmit={saveProjectionData}
          className="space-y-5"
        >
          {projectionErrorMessage && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              {projectionErrorMessage}
            </div>
          )}

          {projectionEntry && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="font-bold text-slate-900">
                {getHorseName(projectionEntry)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {getRaceLabel(projectionEntry.race)}
              </p>
            </div>
          )}

          <div>
            <label
              htmlFor="projection-starting-odds"
              className="mb-1 block font-medium"
            >
              Starting Odds
            </label>

            <input
              id="projection-starting-odds"
              type="number"
              min="1.01"
              step="0.01"
              value={projectionOdds}
              onChange={(event) =>
                setProjectionOdds(event.target.value)
              }
              placeholder="e.g. 5.50"
              className="w-full rounded-lg border p-3"
            />

            <p className="mt-1 text-sm text-slate-500">
              Enter decimal odds without the dollar sign. Changing the odds or previous form clears any previously calculated projection so it can be regenerated later.
            </p>
          </div>

          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">
                  Previous Form
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Enter up to three previous starts in order from most recent to third most recent. Leave all three blank for a debutant.
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                Admin only
              </span>
            </div>

            {projectionFormLoading ? (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                Loading previous form...
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {projectionFormRows.map((row, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <p className="mb-3 text-sm font-bold text-slate-800">
                      {index === 0
                        ? "Most Recent Start"
                        : index === 1
                          ? "2nd Most Recent Start"
                          : "3rd Most Recent Start"}
                    </p>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          Grade
                        </label>
                        <select
                          value={row.race_grade}
                          onChange={(event) =>
                            updateProjectionFormRow(
                              index,
                              "race_grade",
                              event.target.value
                            )
                          }
                          className="w-full rounded-lg border bg-white p-3"
                        >
                          <option value="">Select grade</option>
                          <option value="G1">G1</option>
                          <option value="G2">G2</option>
                          <option value="G3">G3</option>
                          <option value="Listed">Listed</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          Finish
                        </label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={row.finish_position}
                          onChange={(event) =>
                            updateProjectionFormRow(
                              index,
                              "finish_position",
                              event.target.value
                            )
                          }
                          placeholder="e.g. 3"
                          className="w-full rounded-lg border p-3"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {competitionFormRuns.length > 0 && (
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
              <p className="font-semibold text-teal-900">
                Racecourse Fantasy form already recorded
              </p>
              <p className="mt-1 text-sm text-teal-800">
                Official competition results are preserved separately and are not edited by these historical form fields.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeProjectionModal}
              disabled={saving}
              className="rounded-lg border px-5 py-3 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || !projectionEntry || projectionFormLoading}
              className="rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:bg-slate-400"
            >
              {saving ? "Saving..." : "Save Projection Data"}
            </button>
          </div>
        </form>
      </AdminModal>

      <AdminModal
        isOpen={showBulkModal}
        title="Bulk Add Horses"
        description="Choose multiple horses and add them to the selected race."
        onClose={closeBulkModal}
        maxWidth="xl"
      >
        <div className="space-y-5">
          {bulkErrorMessage && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              {bulkErrorMessage}
            </div>
          )}

          {bulkSuccessMessage && (
            <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
              {bulkSuccessMessage}
            </div>
          )}

          <div>
            <label className="mb-1 block font-medium">
              Race
            </label>

            <select
              value={bulkRaceId}
              onChange={(event) => {
                setBulkRaceId(event.target.value);
                setSelectedBulkHorseIds([]);
                setBulkErrorMessage("");
                setBulkSuccessMessage("");
              }}
              className="w-full rounded-lg border bg-white p-3"
            >
              <option value="">
                Select a race
              </option>

              {sortedRaces.map((race) => (
                <option
                  key={race.id}
                  value={race.id}
                >
                  {getRaceLabel(race)} —{" "}
                  {formatDateTime(race.scheduled_start)}
                </option>
              ))}
            </select>
          </div>

          {bulkRaceId && (
            <>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <input
                  type="search"
                  value={bulkSearchTerm}
                  onChange={(event) =>
                    setBulkSearchTerm(
                      event.target.value
                    )
                  }
                  placeholder="Search horses..."
                  className="w-full rounded-lg border p-3"
                />

                <button
                  type="button"
                  onClick={selectAllVisibleBulkHorses}
                  disabled={bulkHorseOptions.length === 0}
                  className="rounded-lg border px-4 py-3 font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Select All
                </button>

                <button
                  type="button"
                  onClick={clearBulkSelection}
                  disabled={
                    selectedBulkHorseIds.length === 0
                  }
                  className="rounded-lg border px-4 py-3 font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-100 px-4 py-3 text-sm">
                <span className="font-semibold text-slate-700">
                  {bulkRaceEntriesCount}{" "}
                  {bulkRaceEntriesCount === 1
                    ? "horse already entered"
                    : "horses already entered"}
                </span>

                <span className="font-semibold text-teal-700">
                  {selectedBulkHorseIds.length} selected
                </span>
              </div>

              <div className="max-h-[420px] overflow-y-auto rounded-lg border">
                {bulkHorseOptions.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    No available horses match this race and search.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {bulkHorseOptions.map((horse) => {
                      const selected =
                        selectedBulkHorseIds.includes(
                          horse.id
                        );

                      return (
                        <label
                          key={horse.id}
                          className={`flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition ${
                            selected
                              ? "bg-teal-50"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() =>
                                toggleBulkHorse(horse.id)
                              }
                              className="h-4 w-4"
                            />

                            <span className="truncate font-semibold text-slate-900">
                              {horse.name}
                            </span>
                          </div>

                          <span className="shrink-0 text-sm font-semibold text-slate-700">
                            {formatMoney(
                              horse.current_price
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <p className="text-sm text-slate-500">
                Saddlecloth numbers are assigned automatically after the highest number already used in this race. Entry prices are copied from each horse&apos;s current price.
              </p>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={closeBulkModal}
              disabled={saving}
              className="rounded-lg border px-5 py-3 disabled:opacity-50"
            >
              Close
            </button>

            <button
              type="button"
              onClick={saveBulkEntries}
              disabled={
                saving ||
                !bulkRaceId ||
                selectedBulkHorseIds.length === 0
              }
              className="rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:bg-slate-400"
            >
              {saving
                ? "Saving..."
                : `Save ${
                    selectedBulkHorseIds.length
                  } ${
                    selectedBulkHorseIds.length === 1
                      ? "Horse"
                      : "Horses"
                  }`}
            </button>
          </div>
        </div>
      </AdminModal>

      <AdminModal
        isOpen={showModal}
        title={
          editingEntryId
            ? "Edit Race Entry"
            : "New Race Entry"
        }
        description={
          editingEntryId
            ? "Update the race entry details."
            : "Add a horse to a race."
        }
        onClose={closeModal}
        maxWidth="lg"
      >
        <form
          onSubmit={saveEntry}
          className="space-y-5"
        >
          {errorMessage && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="mb-1 block font-medium">
              Race
            </label>

            <select
              required
              value={form.race_id}
              onChange={(event) =>
                handleRaceChange(event.target.value)
              }
              className="w-full rounded-lg border bg-white p-3"
            >
              <option value="">
                Select a race
              </option>

              {sortedRaces.map((race) => (
                <option
                  key={race.id}
                  value={race.id}
                >
                  {getRaceLabel(race)} —{" "}
                  {formatDateTime(
                    race.scheduled_start
                  )}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block font-medium">
              Horse
            </label>

            <select
              required
              value={form.horse_id}
              onChange={(event) =>
                handleHorseChange(
                  event.target.value
                )
              }
              className="w-full rounded-lg border bg-white p-3"
            >
              <option value="">
                Select a horse
              </option>

              {availableHorses.map((horse) => (
                <option
                  key={horse.id}
                  value={horse.id}
                >
                  {horse.name} —{" "}
                  {formatMoney(
                    horse.current_price
                  )}
                  {!horse.is_active
                    ? " — Inactive"
                    : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block font-medium">
              Saddlecloth Number
            </label>

            <input
              type="number"
              min={1}
              value={form.saddlecloth_number}
              onChange={(event) =>
                setForm({
                  ...form,
                  saddlecloth_number:
                    event.target.value === ""
                      ? ""
                      : Number(
                          event.target.value
                        ),
                })
              }
              placeholder="Automatically assigned"
              className="w-full rounded-lg border p-3"
            />

            <p className="mt-1 text-sm text-slate-500">
              Automatically assigned when you select a race, but it can still be changed.
            </p>
          </div>

          <div>
            <label className="mb-1 block font-medium">
              Entry Price
            </label>

            <input
              readOnly
              type="number"
              value={form.price_at_entry}
              className="w-full cursor-not-allowed rounded-lg border bg-slate-100 p-3 text-slate-700"
            />

            <p className="mt-1 text-sm text-slate-500">
              Automatically copied from the horse&apos;s current price.
            </p>
          </div>

          <div>
            <label className="mb-1 block font-medium">
              Entry Status
            </label>

            <select
              required
              value={form.entry_status}
              onChange={(event) =>
                setForm({
                  ...form,
                  entry_status:
                    event.target.value as EntryStatus,
                })
              }
              className="w-full rounded-lg border bg-white p-3"
            >
              <option value="runner">
                Runner
              </option>

              <option value="scratched_before_lockout">
                Scratched Before Lockout
              </option>

              <option value="scratched_after_lockout">
                Scratched After Lockout
              </option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={closeModal}
              disabled={saving}
              className="rounded-lg border px-5 py-3 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-green-800 px-5 py-3 font-semibold text-white hover:bg-green-900 disabled:bg-slate-400"
            >
              {saving
                ? "Saving..."
                : editingEntryId
                  ? "Update Entry"
                  : "Save Entry"}
            </button>
          </div>
        </form>
      </AdminModal>
    </main>
  );
}