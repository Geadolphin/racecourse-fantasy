"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Plus, Trash2 } from "lucide-react";

import { supabase } from "../../../lib/supabase";
import type { Round } from "../../../types/round";
import type { Season } from "../../../types/season";

type RoundStatus =
  | "draft"
  | "open"
  | "locked"
  | "completed";

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

type LockoutFormRow = {
  id?: string;
  group_key: LockoutGroupKey;
  display_name: string;
  lockout_at: string;
  sort_order: number;
};

type RoundForm = {
  season_id: string;
  round_number: string;
  name: string;
  round_date: string;
  status: RoundStatus;
  automation_enabled: boolean;
  manual_status_override: boolean;
  scoring_completed: boolean;
  lockouts: LockoutFormRow[];
};

const LOCKOUT_KEYS: LockoutGroupKey[] = [
  "main",
  "group_a",
  "group_b",
  "group_c",
  "group_d",
];

const emptyForm: RoundForm = {
  season_id: "",
  round_number: "",
  name: "",
  round_date: "",
  status: "draft",
  automation_enabled: true,
  manual_status_override: false,
  scoring_completed: false,
  lockouts: [
    {
      group_key: "main",
      display_name: "Main Lockout",
      lockout_at: "",
      sort_order: 1,
    },
  ],
};

export default function AdminRoundsPage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [roundLockouts, setRoundLockouts] =
    useState<RoundLockout[]>([]);

  const [selectedSeasonId, setSelectedSeasonId] =
    useState("");

  const [form, setForm] = useState<RoundForm>(emptyForm);
  const [editingRound, setEditingRound] =
    useState<Round | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingModal, setLoadingModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  useEffect(() => {
    void loadPageData();
  }, []);

  async function loadPageData() {
    setLoading(true);
    setErrorMessage("");

    const [
      roundsResponse,
      seasonsResponse,
      lockoutsResponse,
    ] = await Promise.all([
      supabase
        .from("rounds")
        .select("*")
        .order("round_date", { ascending: true }),

      supabase
        .from("seasons")
        .select("*")
        .order("year", { ascending: false }),

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

    const errors = [
      roundsResponse.error,
      seasonsResponse.error,
      lockoutsResponse.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      setErrorMessage(
        errors
          .map((error) => error?.message)
          .filter(Boolean)
          .join(" ")
      );
    }

    setRounds(roundsResponse.data ?? []);
    setRoundLockouts(
      (lockoutsResponse.data ?? []) as RoundLockout[]
    );

    const loadedSeasons = seasonsResponse.data ?? [];
    setSeasons(loadedSeasons);

    setSelectedSeasonId((current) => {
      if (
        current &&
        loadedSeasons.some(
          (season) => season.id === current
        )
      ) {
        return current;
      }

      const preferredSeason =
        loadedSeasons.find(
          (season) => season.is_active
        ) ?? loadedSeasons[0];

      return preferredSeason?.id ?? "";
    });

    setLoading(false);
  }

  const seasonNames = useMemo(() => {
    return new Map(
      seasons.map((season) => [
        season.id,
        `${season.name} ${season.year}`,
      ])
    );
  }, [seasons]);

  const filteredRounds = useMemo(() => {
    if (!selectedSeasonId) {
      return [];
    }

    return rounds.filter(
      (round) =>
        round.season_id === selectedSeasonId
    );
  }, [rounds, selectedSeasonId]);

  const lockoutsByRound = useMemo(() => {
    const map = new Map<string, RoundLockout[]>();

    for (const lockout of roundLockouts) {
      const current = map.get(lockout.round_id) ?? [];
      current.push(lockout);
      map.set(lockout.round_id, current);
    }

    for (const items of map.values()) {
      items.sort(
        (a, b) =>
          a.sort_order - b.sort_order ||
          new Date(a.lockout_at).getTime() -
            new Date(b.lockout_at).getTime()
      );
    }

    return map;
  }, [roundLockouts]);

  function openCreateModal() {
    setEditingRound(null);

    const selectedSeason =
      seasons.find(
        (season) =>
          season.id === selectedSeasonId
      ) ??
      seasons.find(
        (season) => season.is_active
      ) ??
      seasons[0];

    const selectedSeasonRounds = rounds.filter(
      (round) =>
        round.season_id === selectedSeason?.id
    );

    const nextRoundNumber =
      selectedSeasonRounds.length > 0
        ? Math.max(
            ...selectedSeasonRounds.map(
              (round) => round.round_number
            )
          ) + 1
        : 1;

    setForm({
      ...emptyForm,
      season_id: selectedSeason?.id ?? "",
      round_number: String(nextRoundNumber),
      name: `Round ${nextRoundNumber}`,
      lockouts: [
        {
          group_key: "main",
          display_name: "Main Lockout",
          lockout_at: "",
          sort_order: 1,
        },
      ],
    });

    setErrorMessage("");
    setSuccessMessage("");
    setShowModal(true);
  }

  async function openEditModal(round: Round) {
    setEditingRound(round);
    setLoadingModal(true);
    setErrorMessage("");
    setSuccessMessage("");
    setShowModal(true);

    const { data, error } = await supabase
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
      .eq("round_id", round.id)
      .order("sort_order", { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      setLoadingModal(false);
      return;
    }

    const loadedLockouts =
      (data ?? []) as RoundLockout[];

    const fallbackLockout =
      loadedLockouts.length === 0
        ? [
            {
              group_key: "main" as LockoutGroupKey,
              display_name: "Main Lockout",
              lockout_at: toDateTimeLocal(
                round.lockout_at
              ),
              sort_order: 1,
            },
          ]
        : loadedLockouts.map((lockout) => ({
            id: lockout.id,
            group_key: lockout.group_key,
            display_name: lockout.display_name,
            lockout_at: toDateTimeLocal(
              lockout.lockout_at
            ),
            sort_order: lockout.sort_order,
          }));

    setForm({
      season_id: round.season_id,
      round_number: String(
        round.round_number
      ),
      name: round.name ?? "",
      round_date: round.round_date,
      status: round.status as RoundStatus,
      automation_enabled:
        round.automation_enabled,
      manual_status_override:
        round.manual_status_override,
      scoring_completed:
        round.scoring_completed,
      lockouts: fallbackLockout,
    });

    setLoadingModal(false);
  }

  function closeModal() {
    if (saving) {
      return;
    }

    setShowModal(false);
    setEditingRound(null);
    setForm(emptyForm);
    setErrorMessage("");
    setSuccessMessage("");
    setLoadingModal(false);
  }

  function updateForm<
    K extends keyof Omit<
      RoundForm,
      "lockouts"
    >
  >(
    field: K,
    value: RoundForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateLockout(
    index: number,
    field:
      | "display_name"
      | "lockout_at",
    value: string
  ) {
    setForm((current) => ({
      ...current,
      lockouts: current.lockouts.map(
        (lockout, lockoutIndex) =>
          lockoutIndex === index
            ? {
                ...lockout,
                [field]: value,
              }
            : lockout
      ),
    }));
  }

  function addLockoutGroup() {
    const usedKeys = new Set(
      form.lockouts.map(
        (lockout) => lockout.group_key
      )
    );

    const nextKey = LOCKOUT_KEYS.find(
      (key) => !usedKeys.has(key)
    );

    if (!nextKey) {
      setErrorMessage(
        "The maximum of five lockout groups has been reached."
      );
      return;
    }

    const nextSortOrder =
      form.lockouts.length > 0
        ? Math.max(
            ...form.lockouts.map(
              (lockout) =>
                lockout.sort_order
            )
          ) + 1
        : 1;

    setForm((current) => ({
      ...current,
      lockouts: [
        ...current.lockouts,
        {
          group_key: nextKey,
          display_name:
            nextKey === "main"
              ? "Main Lockout"
              : `Group ${nextKey
                  .replace("group_", "")
                  .toUpperCase()}`,
          lockout_at: "",
          sort_order: nextSortOrder,
        },
      ],
    }));

    setErrorMessage("");
  }

  async function removeLockoutGroup(
    index: number
  ) {
    const lockout = form.lockouts[index];

    if (!lockout) {
      return;
    }

    if (form.lockouts.length === 1) {
      setErrorMessage(
        "A round must have at least one lockout group."
      );
      return;
    }

    if (editingRound) {
      const { count, error } = await supabase
        .from("races")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("round_id", editingRound.id)
        .eq(
          "lockout_group",
          lockout.group_key
        );

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if ((count ?? 0) > 0) {
        setErrorMessage(
          `You cannot remove "${lockout.display_name}" because one or more races currently use it. Reassign those races first.`
        );
        return;
      }
    }

    const confirmed = window.confirm(
      `Remove ${lockout.display_name}?`
    );

    if (!confirmed) {
      return;
    }

    setForm((current) => ({
      ...current,
      lockouts: current.lockouts
        .filter(
          (_, lockoutIndex) =>
            lockoutIndex !== index
        )
        .map((item, itemIndex) => ({
          ...item,
          sort_order: itemIndex + 1,
        })),
    }));

    setErrorMessage("");
  }

  function validateForm() {
    const roundNumber = Number(
      form.round_number
    );

    if (!form.season_id) {
      return "Please select a season.";
    }

    if (
      !Number.isInteger(roundNumber) ||
      roundNumber < 1
    ) {
      return "Round number must be a whole number greater than zero.";
    }

    if (!form.round_date) {
      return "Please select a round date.";
    }

    if (form.lockouts.length === 0) {
      return "Please add at least one lockout group.";
    }

    const displayNames = new Set<string>();
    const groupKeys = new Set<string>();

    for (const lockout of form.lockouts) {
      const displayName =
        lockout.display_name.trim();

      if (!displayName) {
        return "Every lockout group needs a display name.";
      }

      const normalisedName =
        displayName.toLowerCase();

      if (displayNames.has(normalisedName)) {
        return "Lockout group display names must be unique.";
      }

      displayNames.add(normalisedName);

      if (
        groupKeys.has(lockout.group_key)
      ) {
        return "Lockout group keys must be unique.";
      }

      groupKeys.add(lockout.group_key);

      if (!lockout.lockout_at) {
        return `Please select a lockout date and time for ${displayName}.`;
      }

      const lockoutDate = new Date(
        lockout.lockout_at
      );

      if (
        Number.isNaN(
          lockoutDate.getTime()
        )
      ) {
        return `The lockout date and time for ${displayName} is invalid.`;
      }
    }

    return null;
  }

  async function saveRound(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const validationError = validateForm();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setSaving(true);

    const roundNumber = Number(
      form.round_number
    );

    const orderedLockouts = [
      ...form.lockouts,
    ]
      .sort(
        (a, b) =>
          a.sort_order - b.sort_order
      )
      .map((lockout, index) => ({
        ...lockout,
        sort_order: index + 1,
      }));

    const finalLockout = orderedLockouts.reduce(
      (latest, current) => {
        return new Date(
          current.lockout_at
        ).getTime() >
          new Date(
            latest.lockout_at
          ).getTime()
          ? current
          : latest;
      }
    );

    const roundData = {
      season_id: form.season_id,
      round_number: roundNumber,
      name: form.name.trim() || null,
      round_date: form.round_date,

      /*
       * Keep rounds.lockout_at equal to the final
       * lockout for compatibility with existing code.
       */
      lockout_at: new Date(
        finalLockout.lockout_at
      ).toISOString(),

      status: form.status,
      automation_enabled:
        form.automation_enabled,
      manual_status_override:
        form.manual_status_override,
      scoring_completed:
        form.scoring_completed,
    };

    let roundId = editingRound?.id ?? null;

    if (editingRound) {
      const { error } = await supabase
        .from("rounds")
        .update(roundData)
        .eq("id", editingRound.id);

      if (error) {
        setErrorMessage(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("rounds")
        .insert(roundData)
        .select("id")
        .single();

      if (error || !data) {
        setErrorMessage(
          error?.message ||
            "The round could not be created."
        );
        setSaving(false);
        return;
      }

      roundId = data.id;
    }

    if (!roundId) {
      setErrorMessage(
        "The round ID could not be determined."
      );
      setSaving(false);
      return;
    }

    const lockoutRows = orderedLockouts.map(
      (lockout, index) => ({
        round_id: roundId,
        group_key: lockout.group_key,
        display_name:
          lockout.display_name.trim(),
        lockout_at: new Date(
          lockout.lockout_at
        ).toISOString(),
        sort_order: index + 1,
      })
    );

    /*
     * Replace the round's lockout configuration with
     * exactly what is currently shown in the form.
     */
    const { error: deleteError } =
      await supabase
        .from("round_lockouts")
        .delete()
        .eq("round_id", roundId);

    if (deleteError) {
      setErrorMessage(
        `The round was saved, but its existing lockout groups could not be replaced: ${deleteError.message}`
      );
      setSaving(false);
      return;
    }

    const { error: insertError } =
      await supabase
        .from("round_lockouts")
        .insert(lockoutRows);

    if (insertError) {
      setErrorMessage(
        `The round was saved, but its lockout groups could not be saved: ${insertError.message}`
      );
      setSaving(false);
      return;
    }

    setSelectedSeasonId(
      form.season_id
    );

    await loadPageData();

    setSaving(false);
    setShowModal(false);
    setEditingRound(null);
    setForm(emptyForm);
    setSuccessMessage(
      editingRound
        ? "Round updated successfully."
        : "Round created successfully."
    );
  }

  async function deleteRound(round: Round) {
    const roundLabel =
      round.name ||
      `Round ${round.round_number}`;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${roundLabel}?`
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase
      .from("rounds")
      .delete()
      .eq("id", round.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await loadPageData();
    setSuccessMessage(
      `${roundLabel} was deleted.`
    );
  }

  function formatDate(
    dateValue: string
  ) {
    return new Intl.DateTimeFormat(
      "en-AU",
      {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    ).format(
      new Date(
        `${dateValue}T00:00:00`
      )
    );
  }

  function formatDateTime(
    dateValue: string
  ) {
    return new Intl.DateTimeFormat(
      "en-AU",
      {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }
    ).format(new Date(dateValue));
  }

  function statusClass(status: string) {
    switch (status.toLowerCase()) {
      case "open":
        return "bg-teal-100 text-teal-800";

      case "locked":
        return "bg-amber-100 text-amber-800";

      case "completed":
        return "bg-blue-100 text-blue-800";

      default:
        return "bg-slate-200 text-slate-700";
    }
  }

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1 text-sm font-semibold uppercase tracking-wider text-amber-600">
              Competition management
            </p>

            <h1 className="text-3xl font-bold text-slate-900">
              Rounds
            </h1>

            <p className="mt-2 text-slate-600">
              Create rounds and configure one or more
              team lockout times.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            disabled={
              seasons.length === 0
            }
            className="rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            New Round
          </button>
        </div>

        {errorMessage && !showModal && (
          <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
            {errorMessage}
          </div>
        )}

        {successMessage &&
          !showModal && (
            <div className="mb-6 rounded-lg border border-green-300 bg-green-50 p-4 text-green-800">
              {successMessage}
            </div>
          )}

        {seasons.length === 0 &&
          !loading && (
            <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
              Create a season before
              creating a round.
            </div>
          )}

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
                  Choose which season&apos;s
                  rounds you want to manage.
                  New rounds automatically use
                  the selected season.
                </p>
              </div>

              <select
                id="season-filter"
                value={
                  selectedSeasonId
                }
                onChange={(event) =>
                  setSelectedSeasonId(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100 sm:w-80"
              >
                {seasons.map((season) => (
                  <option
                    key={season.id}
                    value={season.id}
                  >
                    {season.name}{" "}
                    {season.year}
                    {season.is_active
                      ? " — Active"
                      : ""}
                  </option>
                ))}
              </select>
            </div>
          </section>
        )}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-slate-600">
              Loading rounds...
            </div>
          ) : filteredRounds.length ===
            0 ? (
            <div className="p-10 text-center">
              <h2 className="text-xl font-semibold text-slate-900">
                No rounds in this
                season
              </h2>

              <p className="mt-2 text-slate-600">
                Create the first round
                for the selected season
                to begin adding races.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Round
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Season
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Round date
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Lockouts
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Status
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredRounds.map(
                    (round) => {
                      const lockouts =
                        lockoutsByRound.get(
                          round.id
                        ) ?? [];

                      return (
                        <tr
                          key={round.id}
                          className="hover:bg-slate-50"
                        >
                          <td className="whitespace-nowrap px-5 py-4">
                            <p className="font-semibold text-slate-900">
                              {round.name ||
                                `Round ${round.round_number}`}
                            </p>

                            <p className="text-sm text-slate-500">
                              Round{" "}
                              {
                                round.round_number
                              }
                            </p>
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                            {seasonNames.get(
                              round.season_id
                            ) ??
                              "Unknown season"}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                            {formatDate(
                              round.round_date
                            )}
                          </td>

                          <td className="min-w-[260px] px-5 py-4">
                            {lockouts.length >
                            0 ? (
                              <div className="space-y-2">
                                {lockouts.map(
                                  (lockout) => (
                                    <div
                                      key={
                                        lockout.id
                                      }
                                      className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"
                                    >
                                      <span className="text-sm font-semibold text-slate-800">
                                        {
                                          lockout.display_name
                                        }
                                      </span>

                                      <span className="whitespace-nowrap text-xs text-slate-600">
                                        {formatDateTime(
                                          lockout.lockout_at
                                        )}
                                      </span>
                                    </div>
                                  )
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-slate-500">
                                {round.lockout_at
                                  ? formatDateTime(
                                      round.lockout_at
                                    )
                                  : "Not configured"}
                              </span>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass(
                                round.status
                              )}`}
                            >
                              {round.status}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                void openEditModal(
                                  round
                                )
                              }
                              className="mr-4 font-semibold text-teal-800 hover:text-teal-950"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void deleteRound(
                                  round
                                )
                              }
                              className="font-semibold text-red-600 hover:text-red-800"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {editingRound
                    ? "Edit Round"
                    : "Create Round"}
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  Configure the round
                  and its lockout groups.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="text-2xl leading-none text-slate-500 hover:text-slate-900"
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            {errorMessage && (
              <div className="mb-5 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                {errorMessage}
              </div>
            )}

            {loadingModal ? (
              <div className="p-10 text-center text-slate-500">
                Loading round...
              </div>
            ) : (
              <form
                onSubmit={saveRound}
                className="space-y-5"
              >
                <div>
                  <label
                    htmlFor="season"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Season
                  </label>

                  <select
                    id="season"
                    value={form.season_id}
                    onChange={(event) =>
                      updateForm(
                        "season_id",
                        event.target.value
                      )
                    }
                    required
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                  >
                    <option value="">
                      Select a season
                    </option>

                    {seasons.map(
                      (season) => (
                        <option
                          key={season.id}
                          value={season.id}
                        >
                          {season.name}{" "}
                          {season.year}
                          {season.is_active
                            ? " — Active"
                            : ""}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="round-number"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Round number
                    </label>

                    <input
                      id="round-number"
                      type="number"
                      min={1}
                      step={1}
                      value={
                        form.round_number
                      }
                      onChange={(event) =>
                        updateForm(
                          "round_number",
                          event.target.value
                        )
                      }
                      required
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="round-name"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Round name
                    </label>

                    <input
                      id="round-name"
                      type="text"
                      value={form.name}
                      onChange={(event) =>
                        updateForm(
                          "name",
                          event.target.value
                        )
                      }
                      placeholder="Round 1"
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="round-date"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Round date
                  </label>

                  <input
                    id="round-date"
                    type="date"
                    value={form.round_date}
                    onChange={(event) =>
                      updateForm(
                        "round_date",
                        event.target.value
                      )
                    }
                    required
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                  />
                </div>

                <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        Lockout Groups
                      </h3>

                      <p className="mt-1 text-sm text-slate-600">
                        Normal rounds need
                        one lockout. Split
                        weekends can have
                        separate Saturday and
                        Sunday lockouts.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={
                        addLockoutGroup
                      }
                      disabled={
                        form.lockouts
                          .length >=
                        LOCKOUT_KEYS.length
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-700 bg-white px-4 py-2.5 text-sm font-semibold text-teal-800 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      Add Lockout Group
                    </button>
                  </div>

                  <div className="mt-5 space-y-4">
                    {form.lockouts.map(
                      (
                        lockout,
                        index
                      ) => (
                        <div
                          key={
                            lockout.group_key
                          }
                          className="rounded-xl border border-slate-200 bg-white p-4"
                        >
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-slate-900">
                                Lockout{" "}
                                {index + 1}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                Internal key:{" "}
                                <code className="rounded bg-slate-100 px-1.5 py-0.5">
                                  {
                                    lockout.group_key
                                  }
                                </code>
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                void removeLockoutGroup(
                                  index
                                )
                              }
                              disabled={
                                form.lockouts
                                  .length === 1
                              }
                              className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove
                            </button>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <label
                                htmlFor={`lockout-name-${lockout.group_key}`}
                                className="mb-2 block text-sm font-semibold text-slate-700"
                              >
                                Display name
                              </label>

                              <input
                                id={`lockout-name-${lockout.group_key}`}
                                type="text"
                                value={
                                  lockout.display_name
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateLockout(
                                    index,
                                    "display_name",
                                    event
                                      .target
                                      .value
                                  )
                                }
                                placeholder="Saturday"
                                required
                                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                              />
                            </div>

                            <div>
                              <label
                                htmlFor={`lockout-time-${lockout.group_key}`}
                                className="mb-2 block text-sm font-semibold text-slate-700"
                              >
                                Lockout date
                                and time
                              </label>

                              <input
                                id={`lockout-time-${lockout.group_key}`}
                                type="datetime-local"
                                value={
                                  lockout.lockout_at
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateLockout(
                                    index,
                                    "lockout_at",
                                    event
                                      .target
                                      .value
                                  )
                                }
                                required
                                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                              />
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  <p className="mt-4 text-xs text-slate-500">
                    The final lockout time is
                    also saved to the round
                    for compatibility with
                    existing pages until the
                    rest of the website is
                    updated.
                  </p>
                </section>

                <div>
                  <label
                    htmlFor="round-status"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Status
                  </label>

                  <select
                    id="round-status"
                    value={form.status}
                    onChange={(event) =>
                      updateForm(
                        "status",
                        event.target
                          .value as RoundStatus
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                  >
                    <option value="draft">
                      Draft
                    </option>
                    <option value="open">
                      Open
                    </option>
                    <option value="locked">
                      Locked
                    </option>
                    <option value="completed">
                      Completed
                    </option>
                  </select>

                  <p className="mt-2 text-xs text-slate-500">
                    Set this to Open so
                    players can select and
                    edit their team.
                  </p>
                </div>

                <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={
                        form.automation_enabled
                      }
                      onChange={(event) =>
                        updateForm(
                          "automation_enabled",
                          event.target
                            .checked
                        )
                      }
                    />

                    <span className="text-sm font-medium text-slate-700">
                      Enable automatic
                      progression
                    </span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={
                        form.manual_status_override
                      }
                      onChange={(event) =>
                        updateForm(
                          "manual_status_override",
                          event.target
                            .checked
                        )
                      }
                    />

                    <span className="text-sm font-medium text-slate-700">
                      Pause automation
                      (manual override)
                    </span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={
                        form.scoring_completed
                      }
                      onChange={(event) =>
                        updateForm(
                          "scoring_completed",
                          event.target
                            .checked
                        )
                      }
                    />

                    <span className="text-sm font-medium text-slate-700">
                      Scoring completed
                    </span>
                  </label>
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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
                      : editingRound
                        ? "Save Changes"
                        : "Create Round"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function toDateTimeLocal(
  dateValue: string | null | undefined
) {
  if (!dateValue) {
    return "";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");
  const hours = String(
    date.getHours()
  ).padStart(2, "0");
  const minutes = String(
    date.getMinutes()
  ).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}