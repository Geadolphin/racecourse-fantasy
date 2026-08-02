"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";

import PageHeader from "@/components/admin/PageHeader";
import AdminModal from "@/components/admin/AdminModal";

import type { Race } from "@/types/race";
import type { Round } from "@/types/round";
import type { Racecourse } from "@/types/racecourse";

type LockoutGroupKey =
  | "main"
  | "group_a"
  | "group_b"
  | "group_c"
  | "group_d";

type RoundLockout = {
  id: string;
  round_id: string;
  group_key: LockoutGroupKey;
  display_name: string;
  lockout_at: string;
  sort_order: number;
};

type RaceWithLockout = Race & {
  lockout_group?: LockoutGroupKey | null;
};

type RaceForm = {
  round_id: string;
  lockout_group: LockoutGroupKey | "";
  racecourse_id: string;
  race_number: number;
  race_name: string;
  grade: "L" | "G3" | "G2" | "G1";
  distance_metres: number;
  scheduled_start: string;
  status:
    | "scheduled"
    | "running"
    | "official"
    | "abandoned"
    | "cancelled";
};

type RoundWithOptionalFields = Round & {
  round_date?: string | null;
  status?: string | null;
  lockout_at?: string | null;
};

const emptyRace: RaceForm = {
  round_id: "",
  lockout_group: "",
  racecourse_id: "",
  race_number: 1,
  race_name: "",
  grade: "L",
  distance_metres: 1200,
  scheduled_start: "",
  status: "scheduled",
};

export default function RacesPage() {
  const [races, setRaces] = useState<RaceWithLockout[]>([]);
  const [rounds, setRounds] = useState<RoundWithOptionalFields[]>([]);
  const [racecourses, setRacecourses] = useState<Racecourse[]>([]);
  const [roundLockouts, setRoundLockouts] =
    useState<RoundLockout[]>([]);

  const [expandedRoundIds, setExpandedRoundIds] = useState<Set<string>>(
    new Set()
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingRaceId, setDeletingRaceId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingRaceId, setEditingRaceId] = useState<string | null>(null);
  const [form, setForm] = useState<RaceForm>(emptyRace);

  useEffect(() => {
    void loadPageData();
  }, []);

  async function loadPageData() {
    setLoading(true);
    setErrorMessage("");

    const [
      { data: racesData, error: racesError },
      { data: roundsData, error: roundsError },
      { data: racecoursesData, error: racecoursesError },
      { data: lockoutsData, error: lockoutsError },
    ] = await Promise.all([
      supabase
        .from("races")
        .select("*")
        .order("scheduled_start", { ascending: true }),

      supabase
        .from("rounds")
        .select("*")
        .order("round_number", { ascending: true }),

      supabase
        .from("racecourses")
        .select("*")
        .order("name", { ascending: true }),

      supabase
        .from("round_lockouts")
        .select(
          `
            id,
            round_id,
            group_key,
            display_name,
            lockout_at,
            sort_order
          `
        )
        .order("sort_order", { ascending: true }),
    ]);

    if (
      racesError ||
      roundsError ||
      racecoursesError ||
      lockoutsError
    ) {
      console.error({
        racesError,
        roundsError,
        racecoursesError,
        lockoutsError,
      });

      setErrorMessage("Could not load race management data.");
      setLoading(false);
      return;
    }

    const loadedRaces =
      (racesData ?? []) as RaceWithLockout[];
    const loadedRounds =
      (roundsData ?? []) as RoundWithOptionalFields[];
    const loadedRacecourses =
      (racecoursesData ?? []) as Racecourse[];
    const loadedLockouts =
      (lockoutsData ?? []) as RoundLockout[];

    setRaces(loadedRaces);
    setRounds(loadedRounds);
    setRacecourses(loadedRacecourses);
    setRoundLockouts(loadedLockouts);

    setExpandedRoundIds((current) => {
      if (current.size > 0 || loadedRounds.length === 0) {
        return current;
      }

      const preferredRound =
        loadedRounds.find((round) =>
          ["open", "locked", "draft"].includes(round.status ?? "")
        ) ??
        [...loadedRounds].sort(
          (a, b) => b.round_number - a.round_number
        )[0];

      return preferredRound
        ? new Set([preferredRound.id])
        : new Set<string>();
    });

    setLoading(false);
  }

  async function deleteRace(race: RaceWithLockout) {
    const confirmed = window.confirm(
      `Delete Race ${race.race_number} — ${race.race_name}?\n\nThis action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingRaceId(race.id);
    setErrorMessage("");

    const { error } = await supabase
      .from("races")
      .delete()
      .eq("id", race.id);

    if (error) {
      console.error("Error deleting race:", error);

      if (error.code === "23503") {
        setErrorMessage(
          "This race cannot be deleted because it has race entries, results, or team selections attached to it. Remove those records first."
        );
      } else {
        setErrorMessage(error.message);
      }

      setDeletingRaceId(null);
      return;
    }

    setRaces((currentRaces) =>
      currentRaces.filter((item) => item.id !== race.id)
    );

    setDeletingRaceId(null);
  }

  async function saveRace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!form.round_id) {
      setErrorMessage("Please select a round.");
      return;
    }

    if (!form.lockout_group) {
      setErrorMessage("Please select a lockout group.");
      return;
    }

    if (!form.racecourse_id) {
      setErrorMessage("Please select a racecourse.");
      return;
    }

    if (form.race_number < 1) {
      setErrorMessage("Race number must be at least 1.");
      return;
    }

    if (!form.race_name.trim()) {
      setErrorMessage("Please enter a race name.");
      return;
    }

    if (form.distance_metres < 1) {
      setErrorMessage("Please enter a valid distance.");
      return;
    }

    if (!form.scheduled_start) {
      setErrorMessage("Please enter a start time.");
      return;
    }

    setSaving(true);

    const raceData = {
      round_id: form.round_id,
      lockout_group: form.lockout_group,
      racecourse_id: form.racecourse_id,
      race_number: form.race_number,
      race_name: form.race_name.trim(),
      grade: form.grade,
      distance_metres: form.distance_metres,
      scheduled_start: new Date(form.scheduled_start).toISOString(),
      status: form.status,
    };

    let saveError;

    if (editingRaceId) {
      const { error } = await supabase
        .from("races")
        .update(raceData)
        .eq("id", editingRaceId);

      saveError = error;
    } else {
      const { error } = await supabase
        .from("races")
        .insert(raceData);

      saveError = error;
    }

    if (saveError) {
      console.error("Error saving race:", saveError);
      setErrorMessage(saveError.message);
      setSaving(false);
      return;
    }

    setExpandedRoundIds((current) => {
      const next = new Set(current);
      next.add(form.round_id);
      return next;
    });

    setEditingRaceId(null);
    setShowModal(false);
    setForm(emptyRace);
    setSaving(false);

    await loadPageData();
  }

  function openNewRaceModal() {
    setErrorMessage("");
    setEditingRaceId(null);

    const defaultRound = rounds[0];
    const defaultLockout = defaultRound
      ? getLockoutsForRound(defaultRound.id)[0]
      : undefined;

    setForm({
      ...emptyRace,
      round_id: defaultRound?.id ?? "",
      lockout_group: defaultLockout?.group_key ?? "",
    });

    setShowModal(true);
  }

  function openNewRaceForRound(roundId: string) {
    setErrorMessage("");
    setEditingRaceId(null);

    const defaultLockout = getLockoutsForRound(roundId)[0];

    setForm({
      ...emptyRace,
      round_id: roundId,
      lockout_group: defaultLockout?.group_key ?? "",
    });

    setShowModal(true);
  }

  function editRace(race: RaceWithLockout) {
    setErrorMessage("");
    setEditingRaceId(race.id);

    setForm({
      round_id: race.round_id,
      lockout_group:
        race.lockout_group ??
        getLockoutsForRound(race.round_id)[0]?.group_key ??
        "",
      racecourse_id: race.racecourse_id,
      race_number: race.race_number,
      race_name: race.race_name,
      grade: race.grade as RaceForm["grade"],
      distance_metres: race.distance_metres ?? 1200,
      scheduled_start: toDateTimeLocalValue(race.scheduled_start),
      status: race.status as RaceForm["status"],
    });

    setShowModal(true);
  }

  function closeModal() {
    if (saving) {
      return;
    }

    setErrorMessage("");
    setEditingRaceId(null);
    setForm(emptyRace);
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

  function expandAllRounds() {
    setExpandedRoundIds(new Set(rounds.map((round) => round.id)));
  }

  function collapseAllRounds() {
    setExpandedRoundIds(new Set());
  }

  function getLockoutsForRound(roundId: string) {
    return roundLockouts
      .filter((lockout) => lockout.round_id === roundId)
      .sort(
        (a, b) =>
          a.sort_order - b.sort_order ||
          new Date(a.lockout_at).getTime() -
            new Date(b.lockout_at).getTime()
      );
  }

  function getLockoutForRace(race: RaceWithLockout) {
    return getLockoutsForRound(race.round_id).find(
      (lockout) =>
        lockout.group_key ===
        (race.lockout_group ?? "main")
    );
  }

  function getLockoutDisplayName(race: RaceWithLockout) {
    return (
      getLockoutForRace(race)?.display_name ??
      (race.lockout_group === "main" ||
      !race.lockout_group
        ? "Main Lockout"
        : race.lockout_group)
    );
  }

  function getRacecourseName(racecourseId: string) {
    const racecourse = racecourses.find(
      (item) => item.id === racecourseId
    );

    return racecourse?.name ?? "Unknown racecourse";
  }

  function getGradeLabel(grade: string) {
    const labels: Record<string, string> = {
      L: "Listed",
      G3: "Group 3",
      G2: "Group 2",
      G1: "Group 1",
    };

    return labels[grade] ?? grade;
  }

  function getRoundLabel(round: RoundWithOptionalFields) {
    return round.name
      ? `Round ${round.round_number} — ${round.name}`
      : `Round ${round.round_number}`;
  }

  function formatDateTime(dateTime: string) {
    return new Intl.DateTimeFormat("en-AU", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Australia/Melbourne",
    }).format(new Date(dateTime));
  }

  function formatRoundDate(round: RoundWithOptionalFields) {
    if (round.round_date) {
      return new Intl.DateTimeFormat("en-AU", {
        dateStyle: "full",
        timeZone: "Australia/Melbourne",
      }).format(new Date(`${round.round_date}T00:00:00`));
    }

    const firstRace = racesByRoundId.get(round.id)?.[0];

    if (!firstRace) {
      return "Date not set";
    }

    return new Intl.DateTimeFormat("en-AU", {
      dateStyle: "full",
      timeZone: "Australia/Melbourne",
    }).format(new Date(firstRace.scheduled_start));
  }

  function toDateTimeLocalValue(value: string) {
    const date = new Date(value);

    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Australia/Melbourne",
    }).formatToParts(date);

    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value])
    );

    return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
  }

  function getRaceStatusLabel(status: string) {
    const labels: Record<string, string> = {
      scheduled: "Scheduled",
      running: "Running",
      official: "Official",
      abandoned: "Abandoned",
      cancelled: "Cancelled",
    };

    return labels[status] ?? status.replaceAll("_", " ");
  }

  function getRaceStatusClasses(status: string) {
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

  function getRoundStatusClasses(status: string | null | undefined) {
    switch (status) {
      case "open":
        return "bg-green-100 text-green-800";

      case "locked":
        return "bg-amber-100 text-amber-800";

      case "completed":
        return "bg-slate-200 text-slate-800";

      default:
        return "bg-blue-100 text-blue-800";
    }
  }

  const sortedRounds = useMemo(() => {
    return [...rounds].sort(
      (a, b) => b.round_number - a.round_number
    );
  }, [rounds]);

  const racesByRoundId = useMemo(() => {
    const grouped = new Map<string, RaceWithLockout[]>();

    for (const race of races) {
      const current = grouped.get(race.round_id) ?? [];
      current.push(race);
      grouped.set(race.round_id, current);
    }

    for (const roundRaces of grouped.values()) {
      roundRaces.sort((a, b) => {
        const timeDifference =
          new Date(a.scheduled_start).getTime() -
          new Date(b.scheduled_start).getTime();

        if (timeDifference !== 0) {
          return timeDifference;
        }

        return a.race_number - b.race_number;
      });
    }

    return grouped;
  }, [races]);

  if (loading) {
    return (
      <main className="p-8">
        <div className="rounded-lg border bg-white p-8 text-center text-slate-500">
          Loading races...
        </div>
      </main>
    );
  }

  return (
    <main className="p-8">
      <PageHeader
        eyebrow="Race management"
        title="Races"
        description="Create and manage races grouped by round."
        buttonLabel="New Race"
        onButtonClick={openNewRaceModal}
        buttonDisabled={
          rounds.length === 0 || racecourses.length === 0
        }
      />

      {errorMessage && !showModal && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
          {errorMessage}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {rounds.length} {rounds.length === 1 ? "round" : "rounds"} ·{" "}
          {races.length} {races.length === 1 ? "race" : "races"}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={expandAllRounds}
            className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Expand All
          </button>

          <button
            type="button"
            onClick={collapseAllRounds}
            className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Collapse All
          </button>
        </div>
      </div>

      {sortedRounds.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-slate-500">
          No rounds have been created yet.
        </div>
      ) : (
        <div className="space-y-4">
          {sortedRounds.map((round) => {
            const roundRaces = racesByRoundId.get(round.id) ?? [];
            const expanded = expandedRoundIds.has(round.id);

            const officialCount = roundRaces.filter(
              (race) => race.status === "official"
            ).length;

            const runningCount = roundRaces.filter(
              (race) => race.status === "running"
            ).length;

            const scheduledCount = roundRaces.filter(
              (race) => race.status === "scheduled"
            ).length;

            const inactiveCount = roundRaces.filter((race) =>
              ["abandoned", "cancelled"].includes(race.status)
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
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-lg font-bold text-slate-900">
                        {expanded ? "▼" : "▶"} {getRoundLabel(round)}
                      </span>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getRoundStatusClasses(
                          round.status
                        )}`}
                      >
                        {round.status ?? "Unknown"}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      {formatRoundDate(round)}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-bold text-slate-900">
                      {roundRaces.length}{" "}
                      {roundRaces.length === 1 ? "race" : "races"}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {officialCount} official · {runningCount} running ·{" "}
                      {scheduledCount} scheduled
                      {inactiveCount > 0
                        ? ` · ${inactiveCount} inactive`
                        : ""}
                    </p>
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-slate-200 bg-slate-50 p-4 md:p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-slate-600">
                        Manage the races for this round.
                      </p>

                      <button
                        type="button"
                        onClick={() => openNewRaceForRound(round.id)}
                        className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
                      >
                        Add Race to Round
                      </button>
                    </div>

                    {roundRaces.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
                        No races have been added to this round.
                      </div>
                    ) : (
                      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                        {roundRaces.map((race) => (
                          <article
                            key={race.id}
                            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-teal-700">
                                  {getRacecourseName(race.racecourse_id)} R
                                  {race.race_number}
                                </p>

                                <h3 className="mt-1 text-lg font-bold text-slate-900">
                                  {race.race_name}
                                </h3>
                              </div>

                              <span
                                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getRaceStatusClasses(
                                  race.status
                                )}`}
                              >
                                {getRaceStatusLabel(race.status)}
                              </span>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                              <div className="rounded-lg bg-slate-100 p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Grade
                                </p>

                                <p className="mt-1 font-bold text-slate-900">
                                  {getGradeLabel(race.grade)}
                                </p>
                              </div>

                              <div className="rounded-lg bg-slate-100 p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Distance
                                </p>

                                <p className="mt-1 font-bold text-slate-900">
                                  {race.distance_metres
                                    ? `${race.distance_metres.toLocaleString()} m`
                                    : "—"}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 rounded-lg border border-slate-200 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Scheduled start
                              </p>

                              <p className="mt-1 font-semibold text-slate-900">
                                {formatDateTime(race.scheduled_start)}
                              </p>
                            </div>

                            <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                                Lockout group
                              </p>

                              <p className="mt-1 font-semibold text-slate-900">
                                {getLockoutDisplayName(race)}
                              </p>
                            </div>

                            <div className="mt-5 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => editRace(race)}
                                disabled={deletingRaceId === race.id}
                                className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => deleteRace(race)}
                                disabled={deletingRaceId === race.id}
                                className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {deletingRaceId === race.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <AdminModal
        isOpen={showModal}
        title={editingRaceId ? "Edit Race" : "New Race"}
        description={
          editingRaceId
            ? "Update the race details, lockout group, and status."
            : "Add the race details, lockout group, and scheduled start."
        }
        onClose={closeModal}
        maxWidth="lg"
      >
        {errorMessage && (
          <div className="mb-5 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {errorMessage}
          </div>
        )}

        <form onSubmit={saveRace} className="space-y-5">
          <div>
            <label className="mb-1 block font-medium">Round</label>

            <select
              required
              value={form.round_id}
              onChange={(event) => {
                const nextRoundId = event.target.value;
                const defaultLockout =
                  getLockoutsForRound(nextRoundId)[0];

                setForm({
                  ...form,
                  round_id: nextRoundId,
                  lockout_group:
                    defaultLockout?.group_key ?? "",
                });
              }}
              className="w-full rounded-lg border p-3"
            >
              <option value="">Select Round</option>

              {rounds.map((round) => (
                <option key={round.id} value={round.id}>
                  Round {round.round_number}
                  {round.name ? ` — ${round.name}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block font-medium">
              Lockout Group
            </label>

            <select
              required
              value={form.lockout_group}
              onChange={(event) =>
                setForm({
                  ...form,
                  lockout_group:
                    event.target.value as RaceForm["lockout_group"],
                })
              }
              disabled={!form.round_id}
              className="w-full rounded-lg border p-3 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="">
                {form.round_id
                  ? "Select Lockout Group"
                  : "Select a round first"}
              </option>

              {getLockoutsForRound(form.round_id).map(
                (lockout) => (
                  <option
                    key={lockout.id}
                    value={lockout.group_key}
                  >
                    {lockout.display_name}
                  </option>
                )
              )}
            </select>

            {form.round_id &&
              getLockoutsForRound(form.round_id).length === 0 && (
                <p className="mt-2 text-sm text-amber-700">
                  This round has no lockout groups. Add one in
                  Admin → Rounds before saving a race.
                </p>
              )}
          </div>

          <div>
            <label className="mb-1 block font-medium">Racecourse</label>

            <select
              required
              value={form.racecourse_id}
              onChange={(event) =>
                setForm({
                  ...form,
                  racecourse_id: event.target.value,
                })
              }
              className="w-full rounded-lg border p-3"
            >
              <option value="">Select Racecourse</option>

              {racecourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-medium">Race Number</label>

              <input
                required
                min={1}
                type="number"
                value={form.race_number}
                onChange={(event) =>
                  setForm({
                    ...form,
                    race_number: Number(event.target.value),
                  })
                }
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <label className="mb-1 block font-medium">Grade</label>

              <select
                value={form.grade}
                onChange={(event) =>
                  setForm({
                    ...form,
                    grade: event.target.value as RaceForm["grade"],
                  })
                }
                className="w-full rounded-lg border p-3"
              >
                <option value="L">Listed</option>
                <option value="G3">Group 3</option>
                <option value="G2">Group 2</option>
                <option value="G1">Group 1</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block font-medium">Race Name</label>

            <input
              required
              value={form.race_name}
              onChange={(event) =>
                setForm({
                  ...form,
                  race_name: event.target.value,
                })
              }
              className="w-full rounded-lg border p-3"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block font-medium">Distance (m)</label>

              <input
                required
                min={1}
                type="number"
                value={form.distance_metres}
                onChange={(event) =>
                  setForm({
                    ...form,
                    distance_metres: Number(event.target.value),
                  })
                }
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <label className="mb-1 block font-medium">Status</label>

              <select
                value={form.status}
                onChange={(event) =>
                  setForm({
                    ...form,
                    status: event.target.value as RaceForm["status"],
                  })
                }
                className="w-full rounded-lg border p-3"
              >
                <option value="scheduled">Scheduled</option>
                <option value="running">Running</option>
                <option value="official">Official</option>
                <option value="abandoned">Abandoned</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block font-medium">Start Time</label>

              <input
                required
                type="datetime-local"
                value={form.scheduled_start}
                onChange={(event) =>
                  setForm({
                    ...form,
                    scheduled_start: event.target.value,
                  })
                }
                className="w-full rounded-lg border p-3"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={closeModal}
              disabled={saving}
              className="rounded-lg border px-5 py-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {saving
                ? "Saving..."
                : editingRaceId
                  ? "Update Race"
                  : "Save Race"}
            </button>
          </div>
        </form>
      </AdminModal>
    </main>
  );
}