"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";

type Season = {
  id: string;
  name: string;
  year: number;
};

type CupCompetition = {
  id: string;
  season_id: string;
  name: string;
  status:
    | "draft"
    | "ready"
    | "group_stage"
    | "knockout"
    | "completed"
    | "cancelled";
  entry_method: "admin" | "automatic";
  competing_teams: number;
  group_count: number;
  teams_per_group: number;
  automatic_qualifiers_per_group: number;
  additional_qualifier_position: number | null;
  additional_qualifier_count: number;
  created_at: string;
};

type CupRow = CupCompetition & {
  season_name: string;
  season_year: number;
  knockout_teams: number;
};

type FormState = {
  season_id: string;
  name: string;
  entry_method: "admin" | "automatic";
  competing_teams: number;
  group_count: number;
  teams_per_group: number;
  automatic_qualifiers_per_group: number;
  additional_qualifier_position: number | null;
  additional_qualifier_count: number;
};

const EMPTY_FORM: FormState = {
  season_id: "",
  name: "",
  entry_method: "admin",
  competing_teams: 24,
  group_count: 6,
  teams_per_group: 4,
  automatic_qualifiers_per_group: 2,
  additional_qualifier_position: 3,
  additional_qualifier_count: 4,
};

function isPowerOfTwo(value: number) {
  return value >= 2 && (value & (value - 1)) === 0;
}

function getKnockoutStageLabel(teamCount: number) {
  if (teamCount === 2) {
    return "Final";
  }

  if (teamCount === 4) {
    return "Semi-finals";
  }

  if (teamCount === 8) {
    return "Quarter-finals";
  }

  return `Round of ${teamCount}`;
}

function buildKnockoutPath(teamCount: number) {
  if (!isPowerOfTwo(teamCount)) {
    return [];
  }

  const stages: string[] = [];
  let current = teamCount;

  while (current >= 2) {
    stages.push(getKnockoutStageLabel(current));
    current = current / 2;
  }

  return stages;
}

export default function AdminCupsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingCupId, setDeletingCupId] =
    useState<string | null>(null);

  const [seasons, setSeasons] =
    useState<Season[]>([]);

  const [cups, setCups] =
    useState<CupRow[]>([]);

  const [form, setForm] =
    useState<FormState>(EMPTY_FORM);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [
        {
          data: seasonsData,
          error: seasonsError,
        },
        {
          data: cupsData,
          error: cupsError,
        },
      ] = await Promise.all([
        supabase
          .from("seasons")
          .select("id, name, year")
          .order("year", {
            ascending: false,
          }),

        supabase.rpc(
          "get_admin_cups"
        ),
      ]);

      if (seasonsError) {
        throw seasonsError;
      }

      if (cupsError) {
        throw cupsError;
      }

      const loadedSeasons =
        (seasonsData ?? []) as Season[];

      const loadedCupResponse =
        cupsData as
          | {
              success?: boolean;
              cups?: CupCompetition[];
            }
          | null;

      const loadedCups =
        loadedCupResponse?.cups ?? [];

      const seasonsById =
        new Map(
          loadedSeasons.map(
            (season) => [
              season.id,
              season,
            ]
          )
        );

      const cupRows: CupRow[] =
        loadedCups.map((cup) => {
          const season =
            seasonsById.get(
              cup.season_id
            );

          const knockoutTeams =
            cup.group_count *
              cup.automatic_qualifiers_per_group +
            cup.additional_qualifier_count;

          return {
            ...cup,
            season_name:
              season?.name ??
              "Unknown season",
            season_year:
              season?.year ?? 0,
            knockout_teams:
              knockoutTeams,
          };
        });

      setSeasons(loadedSeasons);
      setCups(cupRows);

      setForm((current) => {
        if (
          current.season_id ||
          loadedSeasons.length === 0
        ) {
          return current;
        }

        return {
          ...current,
          season_id:
            loadedSeasons[0].id,
        };
      });
    } catch (loadError) {
      console.error(
        "Admin Cups load error:",
        loadError
      );

      setCups([]);

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load Cup competitions."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const groupStructureValid =
    form.competing_teams ===
    form.group_count *
      form.teams_per_group;

  const automaticQualifierCount =
    form.group_count *
    form.automatic_qualifiers_per_group;

  const knockoutTeamCount =
    automaticQualifierCount +
    form.additional_qualifier_count;

  const knockoutValid =
    isPowerOfTwo(
      knockoutTeamCount
    );

  const automaticQualifierValid =
    form.automatic_qualifiers_per_group >= 1 &&
    form.automatic_qualifiers_per_group <
      form.teams_per_group;

  const additionalQualifierValid =
    form.additional_qualifier_count === 0
      ? form.additional_qualifier_position ===
        null
      : form.additional_qualifier_position !==
          null &&
        form.additional_qualifier_position >
          form.automatic_qualifiers_per_group &&
        form.additional_qualifier_position <=
          form.teams_per_group;

  const knockoutPath =
    useMemo(() => {
      return buildKnockoutPath(
        knockoutTeamCount
      );
    }, [knockoutTeamCount]);

  const canSave =
    Boolean(
      form.season_id &&
        form.name.trim()
    ) &&
    groupStructureValid &&
    automaticQualifierValid &&
    additionalQualifierValid &&
    knockoutValid &&
    !saving;

  function updateNumber(
    key:
      | "competing_teams"
      | "group_count"
      | "teams_per_group"
      | "automatic_qualifiers_per_group"
      | "additional_qualifier_count",
    value: string
  ) {
    const parsed =
      Number(value);

    setForm((current) => ({
      ...current,
      [key]:
        Number.isFinite(parsed)
          ? parsed
          : 0,
    }));
  }

  function updateAdditionalPosition(
    value: string
  ) {
    if (!value) {
      setForm((current) => ({
        ...current,
        additional_qualifier_position:
          null,
      }));

      return;
    }

    setForm((current) => ({
      ...current,
      additional_qualifier_position:
        Number(value),
    }));
  }

  async function handleCreateCup(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!canSave) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    /*
     * Create via admin SECURITY DEFINER RPC.
     *
     * This keeps RLS enabled on cup_competitions
     * while still allowing verified administrators
     * to create Cups.
     */
    const {
      data: createdCupId,
      error: createError,
    } = await supabase.rpc(
      "admin_create_cup",
      {
        p_season_id:
          form.season_id,

        p_name:
          form.name.trim(),

        p_entry_method:
          form.entry_method,

        p_competing_teams:
          form.competing_teams,

        p_group_count:
          form.group_count,

        p_teams_per_group:
          form.teams_per_group,

        p_automatic_qualifiers_per_group:
          form.automatic_qualifiers_per_group,

        p_additional_qualifier_position:
          form.additional_qualifier_count > 0
            ? form.additional_qualifier_position
            : null,

        p_additional_qualifier_count:
          form.additional_qualifier_count,
      }
    );

    if (
      createError ||
      !createdCupId
    ) {
      console.error(
        "Create Cup RPC error:",
        createError
      );

      setError(
        createError?.message ||
          "Unable to create Cup."
      );

      setSaving(false);
      return;
    }

    /*
     * Create the required group and knockout
     * stages immediately after the Cup exists.
     */
    const {
      error: stageError,
    } = await supabase.rpc(
      "generate_cup_stages",
      {
        p_cup_id:
          createdCupId,
      }
    );

    if (stageError) {
      console.error(
        "Generate Cup stages error:",
        stageError
      );

      setError(
        `Cup created, but stages could not be generated: ${stageError.message}`
      );

      setSaving(false);

      await loadData();
      return;
    }

    setSuccessMessage(
      "Cup created successfully."
    );

    setForm((current) => ({
      ...EMPTY_FORM,
      season_id:
        current.season_id,
    }));

    setSaving(false);

    await loadData();
  }

  async function handleDeleteCup(
    cup: CupRow
  ) {
    const confirmed = window.confirm(
      `Delete "${cup.name}"?\n\nThis will permanently delete the Cup and its related participants, groups, stages and matches. This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    const typedConfirmation = window.prompt(
      `Type DELETE to permanently delete "${cup.name}".`
    );

    if (typedConfirmation !== "DELETE") {
      return;
    }

    setDeletingCupId(cup.id);
    setError("");
    setSuccessMessage("");

    const {
      error: deleteError,
    } = await supabase.rpc(
      "admin_delete_cup",
      {
        p_cup_id: cup.id,
      }
    );

    if (deleteError) {
      console.error(
        "Delete Cup error:",
        deleteError
      );

      setError(
        deleteError.message ||
          "Unable to delete Cup."
      );

      setDeletingCupId(null);
      return;
    }

    setSuccessMessage(
      `${cup.name} deleted successfully.`
    );

    setDeletingCupId(null);

    await loadData();
  }

  if (loading) {
    return (
      <main className="p-6 md:p-8">
        <div className="rounded-xl border bg-white p-10 text-center text-slate-500 shadow-sm">
          Loading Cups...
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
            Administration
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-950">
            Cups
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Create and manage configurable
            group-stage and knockout Cup
            competitions.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-5 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm font-medium text-teal-800">
            {successMessage}
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <form
            onSubmit={handleCreateCup}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-xl font-bold text-slate-950">
                Create Cup
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Configure the tournament
                structure before selecting
                participants.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Season
                </label>

                <select
                  value={
                    form.season_id
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        season_id:
                          event.target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                >
                  {seasons.map(
                    (season) => (
                      <option
                        key={season.id}
                        value={season.id}
                      >
                        {season.name}{" "}
                        {season.year}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Cup name
                </label>

                <input
                  type="text"
                  value={form.name}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        name: event.target
                          .value,
                      })
                    )
                  }
                  placeholder="Spring Cup"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Entry method
                </label>

                <select
                  value={
                    form.entry_method
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        entry_method:
                          event.target
                            .value as
                            | "admin"
                            | "automatic",
                      })
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                >
                  <option value="admin">
                    Admin selected
                  </option>

                  <option value="automatic">
                    Automatic qualification
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Competing teams
                  </label>

                  <input
                    type="number"
                    min={4}
                    value={
                      form.competing_teams
                    }
                    onChange={(event) =>
                      updateNumber(
                        "competing_teams",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Groups
                  </label>

                  <input
                    type="number"
                    min={1}
                    value={
                      form.group_count
                    }
                    onChange={(event) =>
                      updateNumber(
                        "group_count",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Teams per group
                  </label>

                  <input
                    type="number"
                    min={2}
                    value={
                      form.teams_per_group
                    }
                    onChange={(event) =>
                      updateNumber(
                        "teams_per_group",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Qualifiers / group
                  </label>

                  <input
                    type="number"
                    min={1}
                    value={
                      form.automatic_qualifiers_per_group
                    }
                    onChange={(event) =>
                      updateNumber(
                        "automatic_qualifiers_per_group",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Additional position
                  </label>

                  <input
                    type="number"
                    min={1}
                    value={
                      form.additional_qualifier_position ??
                      ""
                    }
                    onChange={(event) =>
                      updateAdditionalPosition(
                        event.target.value
                      )
                    }
                    disabled={
                      form.additional_qualifier_count ===
                      0
                    }
                    placeholder="3"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Additional qualifiers
                  </label>

                  <input
                    type="number"
                    min={0}
                    value={
                      form.additional_qualifier_count
                    }
                    onChange={(event) => {
                      const value =
                        Number(
                          event.target
                            .value
                        );

                      setForm(
                        (current) => ({
                          ...current,

                          additional_qualifier_count:
                            value,

                          additional_qualifier_position:
                            value === 0
                              ? null
                              : current.additional_qualifier_position ??
                                current.automatic_qualifiers_per_group +
                                  1,
                        })
                      );
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Tournament Structure
              </p>

              <p className="mt-2 font-bold text-slate-900">
                {form.competing_teams} teams ·{" "}
                {form.group_count} groups ·{" "}
                {form.teams_per_group} per group
              </p>

              <p className="mt-1 text-sm text-slate-600">
                Top{" "}
                {
                  form.automatic_qualifiers_per_group
                }{" "}
                from each group advance
                automatically.
              </p>

              {form.additional_qualifier_count >
                0 && (
                <p className="mt-1 text-sm text-slate-600">
                  Best{" "}
                  {
                    form.additional_qualifier_count
                  }{" "}
                  teams finishing in position{" "}
                  {
                    form.additional_qualifier_position
                  }{" "}
                  also advance.
                </p>
              )}

              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="font-bold text-slate-900">
                  {knockoutTeamCount} knockout
                  teams
                </p>

                {knockoutValid ? (
                  <p className="mt-1 text-sm font-semibold text-teal-700">
                    {knockoutPath.join(
                      " → "
                    )}
                  </p>
                ) : (
                  <p className="mt-1 text-sm font-semibold text-red-700">
                    Knockout field must be a
                    power of two.
                  </p>
                )}
              </div>
            </div>

            {!groupStructureValid && (
              <p className="mt-3 text-sm font-semibold text-red-700">
                Groups × teams per group must
                equal the number of competing
                teams.
              </p>
            )}

            {!automaticQualifierValid && (
              <p className="mt-3 text-sm font-semibold text-red-700">
                Automatic qualifiers must be
                fewer than the number of teams
                in each group.
              </p>
            )}

            {!additionalQualifierValid && (
              <p className="mt-3 text-sm font-semibold text-red-700">
                Additional qualification
                settings are invalid.
              </p>
            )}

            <button
              type="submit"
              disabled={!canSave}
              className="mt-5 w-full rounded-lg bg-teal-600 px-4 py-3 font-bold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Creating Cup..."
                : "Create Cup"}
            </button>
          </form>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-5">
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  Cup Competitions
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {cups.length} Cup
                  {cups.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            {cups.length === 0 ? (
              <div className="p-10 text-center text-slate-500">
                No Cups have been created yet.
              </div>
            ) : (
              <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {cups.map((cup) => (
                  <div
                    key={cup.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-bold text-slate-950">
                          {cup.name}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {cup.season_name} {cup.season_year}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold capitalize text-slate-700">
                        {cup.status.replace("_", " ")}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Teams
                        </p>
                        <p className="mt-1 font-bold text-slate-900">
                          {cup.competing_teams}
                        </p>
                      </div>

                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Groups
                        </p>
                        <p className="mt-1 font-bold text-slate-900">
                          {cup.group_count} × {cup.teams_per_group}
                        </p>
                      </div>

                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Knockout
                        </p>
                        <p className="mt-1 font-bold text-slate-900">
                          {cup.knockout_teams}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-slate-500">
                        {cup.entry_method === "admin"
                          ? "Admin selected"
                          : "Automatic qualification"}
                      </p>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void handleDeleteCup(cup)
                          }
                          disabled={
                            deletingCupId === cup.id
                          }
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingCupId === cup.id
                            ? "Deleting..."
                            : "Delete"}
                        </button>

                        <Link
                          href={`/admin/cups/${cup.id}`}
                          className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-teal-700"
                        >
                          Manage
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}