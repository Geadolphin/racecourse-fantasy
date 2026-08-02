"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import type { Round } from "../../../types/round";
import type { Season } from "../../../types/season";

type RoundStatus =
  | "draft"
  | "open"
  | "locked"
  | "completed";

type RoundForm = {
  season_id: string;
  round_number: string;
  name: string;
  round_date: string;
  lockout_at: string;
  status: RoundStatus;
  automation_enabled: boolean;
  manual_status_override: boolean;
  scoring_completed: boolean;
};

const emptyForm: RoundForm = {
  season_id: "",
  round_number: "",
  name: "",
  round_date: "",
  lockout_at: "",
  status: "draft",
  automation_enabled: true,
  manual_status_override: false,
  scoring_completed: false,
};

export default function AdminRoundsPage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState("");

  const [form, setForm] = useState<RoundForm>(emptyForm);
  const [editingRound, setEditingRound] = useState<Round | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadPageData();
  }, []);

  async function loadPageData() {
    setLoading(true);
    setErrorMessage("");

    const [roundsResponse, seasonsResponse] = await Promise.all([
      supabase
        .from("rounds")
        .select("*")
        .order("round_date", { ascending: true }),

      supabase
        .from("seasons")
        .select("*")
        .order("year", { ascending: false }),
    ]);

    if (roundsResponse.error) {
      setErrorMessage(roundsResponse.error.message);
    } else {
      setRounds(roundsResponse.data ?? []);
    }

    if (seasonsResponse.error) {
      setErrorMessage((current) =>
        current
          ? `${current} ${seasonsResponse.error.message}`
          : seasonsResponse.error.message
      );
    } else {
      const loadedSeasons = seasonsResponse.data ?? [];

      setSeasons(loadedSeasons);

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
    }

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
      (round) => round.season_id === selectedSeasonId
    );
  }, [rounds, selectedSeasonId]);

  function openCreateModal() {
    setEditingRound(null);

    const selectedSeason =
      seasons.find(
        (season) => season.id === selectedSeasonId
      ) ??
      seasons.find((season) => season.is_active) ??
      seasons[0];

    const selectedSeasonRounds = rounds.filter(
      (round) => round.season_id === selectedSeason?.id
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
      status: "draft",
    });

    setErrorMessage("");
    setShowModal(true);
  }

  function openEditModal(round: Round) {
    setEditingRound(round);

    setForm({
      season_id: round.season_id,
      round_number: String(round.round_number),
      name: round.name ?? "",
      round_date: round.round_date,
      lockout_at: toDateTimeLocal(round.lockout_at),
      status: round.status as RoundStatus,
      automation_enabled: round.automation_enabled,
      manual_status_override: round.manual_status_override,
      scoring_completed: round.scoring_completed,
    });

    setErrorMessage("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) {
      return;
    }

    setShowModal(false);
    setEditingRound(null);
    setForm(emptyForm);
    setErrorMessage("");
  }

  function updateForm<K extends keyof RoundForm>(
    field: K,
    value: RoundForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveRound(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const roundNumber = Number(form.round_number);

    if (!form.season_id) {
      setErrorMessage("Please select a season.");
      return;
    }

    if (!Number.isInteger(roundNumber) || roundNumber < 1) {
      setErrorMessage("Round number must be a whole number greater than zero.");
      return;
    }

    if (!form.round_date) {
      setErrorMessage("Please select a round date.");
      return;
    }

    if (!form.lockout_at) {
      setErrorMessage("Please select a lockout date and time.");
      return;
    }

    const lockoutDate = new Date(form.lockout_at);

    if (Number.isNaN(lockoutDate.getTime())) {
      setErrorMessage("The lockout date and time is invalid.");
      return;
    }

    setSaving(true);

    const roundData = {
      season_id: form.season_id,
      round_number: roundNumber,
      name: form.name.trim() || null,
      round_date: form.round_date,
      lockout_at: lockoutDate.toISOString(),
      status: form.status,
      automation_enabled: form.automation_enabled,
      manual_status_override: form.manual_status_override,
      scoring_completed: form.scoring_completed,
    };

    let saveError;

    if (editingRound) {
      const response = await supabase
        .from("rounds")
        .update(roundData)
        .eq("id", editingRound.id);

      saveError = response.error;
    } else {
      const response = await supabase.from("rounds").insert(roundData);

      saveError = response.error;
    }

    if (saveError) {
      setErrorMessage(saveError.message);
      setSaving(false);
      return;
    }

    setSelectedSeasonId(form.season_id);

    await loadPageData();

    setSaving(false);
    setShowModal(false);
    setEditingRound(null);
    setForm(emptyForm);
  }

  async function deleteRound(round: Round) {
    const roundLabel = round.name || `Round ${round.round_number}`;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${roundLabel}?`
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage("");

    const { error } = await supabase
      .from("rounds")
      .delete()
      .eq("id", round.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await loadPageData();
  }

  function formatDate(dateValue: string) {
    return new Intl.DateTimeFormat("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(`${dateValue}T00:00:00`));
  }

  function formatDateTime(dateValue: string) {
    return new Intl.DateTimeFormat("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(dateValue));
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
              Create and manage each Saturday round.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            disabled={seasons.length === 0}
            className="rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            New Round
          </button>
        </div>

        {errorMessage && !showModal && (
          <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
            {errorMessage}
          </div>
        )}

        {seasons.length === 0 && !loading && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
            Create a season before creating a round.
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
                  Choose which season&apos;s rounds you want to manage.
                  New rounds will automatically be created for the
                  selected season.
                </p>
              </div>

              <select
                id="season-filter"
                value={selectedSeasonId}
                onChange={(event) =>
                  setSelectedSeasonId(event.target.value)
                }
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

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-slate-600">
              Loading rounds...
            </div>
          ) : filteredRounds.length === 0 ? (
            <div className="p-10 text-center">
              <h2 className="text-xl font-semibold text-slate-900">
                No rounds in this season
              </h2>

              <p className="mt-2 text-slate-600">
                Create the first round for the selected season to
                begin adding races.
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
                      Lockout
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
                  {filteredRounds.map((round) => (
                    <tr key={round.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-4">
                        <p className="font-semibold text-slate-900">
                          {round.name || `Round ${round.round_number}`}
                        </p>

                        <p className="text-sm text-slate-500">
                          Round {round.round_number}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                        {seasonNames.get(round.season_id) ?? "Unknown season"}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                        {formatDate(round.round_date)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                        {formatDateTime(round.lockout_at)}
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
                          onClick={() => openEditModal(round)}
                          className="mr-4 font-semibold text-teal-800 hover:text-teal-950"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteRound(round)}
                          className="font-semibold text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {editingRound ? "Edit Round" : "Create Round"}
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  Set the round date and team lockout time.
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

            <form onSubmit={saveRound} className="space-y-5">
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
                    updateForm("season_id", event.target.value)
                  }
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                >
                  <option value="">Select a season</option>

                  {seasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name} {season.year}
                      {season.is_active ? " — Active" : ""}
                    </option>
                  ))}
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
                    value={form.round_number}
                    onChange={(event) =>
                      updateForm("round_number", event.target.value)
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
                      updateForm("name", event.target.value)
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
                    updateForm("round_date", event.target.value)
                  }
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div>
                <label
                  htmlFor="lockout"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Lockout date and time
                </label>

                <input
                  id="lockout"
                  type="datetime-local"
                  value={form.lockout_at}
                  onChange={(event) =>
                    updateForm("lockout_at", event.target.value)
                  }
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                />

                <p className="mt-2 text-xs text-slate-500">
                  This is when players can no longer change their teams.
                </p>
              </div>

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
                      event.target.value as RoundStatus
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                >
                  <option value="draft">Draft</option>
                  <option value="open">Open</option>
                  <option value="locked">Locked</option>
                  <option value="completed">Completed</option>
                </select>

                <p className="mt-2 text-xs text-slate-500">
                  Set this to Open so players can select and edit their team.
                </p>
              </div>

              <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={form.automation_enabled}
                    onChange={(event) =>
                      updateForm("automation_enabled", event.target.checked)
                    }
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Enable automatic progression
                  </span>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={form.manual_status_override}
                    onChange={(event) =>
                      updateForm("manual_status_override", event.target.checked)
                    }
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Pause automation (manual override)
                  </span>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={form.scoring_completed}
                    onChange={(event) =>
                      updateForm("scoring_completed", event.target.checked)
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
          </div>
        </div>
      )}
    </main>
  );
}

function toDateTimeLocal(dateValue: string) {
  const date = new Date(dateValue);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}