"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import type { Season } from "../../../types/season";

export default function SeasonsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [salaryCap, setSalaryCap] = useState(2500000);
  const [teamSize, setTeamSize] = useState(10);
  const [isActive, setIsActive] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadSeasons() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("seasons")
      .select(
        "id, name, year, starts_on, ends_on, salary_cap, team_size, is_active"
      )
      .order("year", { ascending: false });

    if (error) {
      setMessage(error.message);
      setSeasons([]);
    } else {
      setSeasons((data as Season[]) ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadSeasons();
  }, []);

  function resetForm() {
    setName("");
    setYear(new Date().getFullYear());
    setStartDate("");
    setEndDate("");
    setSalaryCap(2500000);
    setTeamSize(10);
    setIsActive(false);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    resetForm();
  }

  async function createSeason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setMessage("");

    if (!name.trim()) {
      setMessage("Please enter a season name.");
      setSaving(false);
      return;
    }

    if (!startDate || !endDate) {
      setMessage("Please enter both the start date and end date.");
      setSaving(false);
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setMessage("The end date must be after the start date.");
      setSaving(false);
      return;
    }

    if (salaryCap <= 0) {
      setMessage("The salary cap must be greater than zero.");
      setSaving(false);
      return;
    }

    if (teamSize <= 0) {
      setMessage("The team size must be greater than zero.");
      setSaving(false);
      return;
    }

    if (isActive) {
      const { error: deactivateError } = await supabase
        .from("seasons")
        .update({ is_active: false })
        .eq("is_active", true);

      if (deactivateError) {
        setMessage(deactivateError.message);
        setSaving(false);
        return;
      }
    }

    const { error } = await supabase.from("seasons").insert({
      name: name.trim(),
      year,
      starts_on: startDate,
      ends_on: endDate,
      salary_cap: salaryCap,
      team_size: teamSize,
      is_active: isActive,
    });

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowModal(false);
    resetForm();
    await loadSeasons();
  }

  async function setActiveSeason(seasonId: string) {
    setMessage("");

    const { error: deactivateError } = await supabase
      .from("seasons")
      .update({ is_active: false })
      .eq("is_active", true);

    if (deactivateError) {
      setMessage(deactivateError.message);
      return;
    }

    const { error: activateError } = await supabase
      .from("seasons")
      .update({ is_active: true })
      .eq("id", seasonId);

    if (activateError) {
      setMessage(activateError.message);
      return;
    }

    await loadSeasons();
  }

  function formatDate(date: string) {
    return new Date(`${date}T00:00:00`).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  return (
    <main className="p-6 sm:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-teal-600">
              Competition management
            </p>

            <h1 className="mt-1 text-4xl font-bold tracking-tight">
              Seasons
            </h1>

            <p className="mt-2 text-slate-600">
              Create and manage Racecourse Fantasy seasons.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setMessage("");
              setShowModal(true);
            }}
            className="rounded-lg bg-teal-600 px-5 py-3 font-semibold text-white transition hover:bg-teal-600"
          >
            + New Season
          </button>
        </div>

        {message && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {message}
          </div>
        )}

        <div className="mt-8 space-y-4">
          {loading && (
            <div className="rounded-xl border border-slate-200 bg-white p-8">
              <p className="text-slate-600">Loading seasons...</p>
            </div>
          )}

          {!loading && seasons.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <h2 className="text-xl font-bold">No seasons created</h2>

              <p className="mt-2 text-slate-600">
                Click “New Season” to create your first season.
              </p>
            </div>
          )}

          {!loading &&
            seasons.map((season) => (
              <div
                key={season.id}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-bold">
                        {season.name} {season.year}
                      </h2>

                      {season.is_active ? (
                        <span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-600">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                          Inactive
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-slate-600">
                      {formatDate(season.starts_on)} to{" "}
                      {formatDate(season.ends_on)}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
                      <span>
                        Salary cap:{" "}
                        <strong className="text-slate-900">
                          {formatCurrency(season.salary_cap)}
                        </strong>
                      </span>

                      <span>
                        Team size:{" "}
                        <strong className="text-slate-900">
                          {season.team_size} horses
                        </strong>
                      </span>
                    </div>
                  </div>

                  {!season.is_active && (
                    <button
                      type="button"
                      onClick={() => setActiveSeason(season.id)}
                      className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-teal-600 transition hover:bg-teal-50"
                    >
                      Set as active
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <form
            onSubmit={createSeason}
            className="my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">New Season</h2>

                <p className="mt-1 text-sm text-slate-600">
                  Enter the details for the new competition season.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg px-3 py-1 text-2xl text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                aria-label="Close popup"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="season-name"
                  className="mb-2 block text-sm font-semibold"
                >
                  Season name
                </label>

                <input
                  id="season-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Spring Carnival"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-teal-600"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="season-year"
                  className="mb-2 block text-sm font-semibold"
                >
                  Year
                </label>

                <input
                  id="season-year"
                  type="number"
                  value={year}
                  onChange={(event) =>
                    setYear(Number(event.target.value))
                  }
                  min={2020}
                  max={2100}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-teal-600"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="start-date"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Start date
                  </label>

                  <input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-teal-600"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="end-date"
                    className="mb-2 block text-sm font-semibold"
                  >
                    End date
                  </label>

                  <input
                    id="end-date"
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-teal-600"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="salary-cap"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Salary cap
                  </label>

                  <input
                    id="salary-cap"
                    type="number"
                    value={salaryCap}
                    min={0}
                    step={1000}
                    onChange={(event) =>
                      setSalaryCap(Number(event.target.value))
                    }
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-teal-600"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="team-size"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Team size
                  </label>

                  <input
                    id="team-size"
                    type="number"
                    value={teamSize}
                    min={1}
                    max={100}
                    onChange={(event) =>
                      setTeamSize(Number(event.target.value))
                    }
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-teal-600"
                    required
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                  className="h-5 w-5"
                />

                <div>
                  <p className="font-semibold">Make this the active season</p>

                  <p className="text-sm text-slate-600">
                    Any currently active season will become inactive.
                  </p>
                </div>
              </label>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-5 py-2.5 font-semibold hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-teal-600 px-5 py-2.5 font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Create Season"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}