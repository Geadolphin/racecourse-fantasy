"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import type { Racecourse } from "../../../types/racecourse";

type RacecourseForm = {
  name: string;
  state: string;
  city: string;
  is_active: boolean;
};

const emptyForm: RacecourseForm = {
  name: "",
  state: "",
  city: "",
  is_active: true,
};

const australianStates = [
  "VIC",
  "NSW",
  "QLD",
  "SA",
  "WA",
  "TAS",
  "ACT",
  "NT",
];

export default function AdminRacecoursesPage() {
  const [racecourses, setRacecourses] = useState<Racecourse[]>([]);
  const [form, setForm] = useState<RacecourseForm>(emptyForm);
  const [editingRacecourse, setEditingRacecourse] =
    useState<Racecourse | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadRacecourses();
  }, []);

  async function loadRacecourses() {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("racecourses")
      .select("*")
      .order("state", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      setRacecourses([]);
    } else {
      setRacecourses(data ?? []);
    }

    setLoading(false);
  }

  const filteredRacecourses = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) {
      return racecourses;
    }

    return racecourses.filter((racecourse) => {
      return (
        racecourse.name.toLowerCase().includes(search) ||
        racecourse.state.toLowerCase().includes(search) ||
        racecourse.city?.toLowerCase().includes(search)
      );
    });
  }, [racecourses, searchTerm]);

  function openCreateModal() {
    setEditingRacecourse(null);
    setForm(emptyForm);
    setErrorMessage("");
    setShowModal(true);
  }

  function openEditModal(racecourse: Racecourse) {
    setEditingRacecourse(racecourse);

    setForm({
      name: racecourse.name,
      state: racecourse.state,
      city: racecourse.city ?? "",
      is_active: racecourse.is_active,
    });

    setErrorMessage("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) {
      return;
    }

    setShowModal(false);
    setEditingRacecourse(null);
    setForm(emptyForm);
    setErrorMessage("");
  }

  function updateForm<K extends keyof RacecourseForm>(
    field: K,
    value: RacecourseForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveRacecourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const name = form.name.trim();
    const state = form.state.trim().toUpperCase();
    const city = form.city.trim();

    if (!name) {
      setErrorMessage("Please enter the racecourse name.");
      return;
    }

    if (!state) {
      setErrorMessage("Please select a state.");
      return;
    }

    setSaving(true);

    const racecourseData = {
      name,
      state,
      city: city || null,
      is_active: form.is_active,
    };

    let saveError;

    if (editingRacecourse) {
      const response = await supabase
        .from("racecourses")
        .update(racecourseData)
        .eq("id", editingRacecourse.id);

      saveError = response.error;
    } else {
      const response = await supabase
        .from("racecourses")
        .insert(racecourseData);

      saveError = response.error;
    }

    if (saveError) {
      setErrorMessage(saveError.message);
      setSaving(false);
      return;
    }

    await loadRacecourses();

    setSaving(false);
    setShowModal(false);
    setEditingRacecourse(null);
    setForm(emptyForm);
  }

  async function toggleActive(racecourse: Racecourse) {
    setErrorMessage("");

    const { error } = await supabase
      .from("racecourses")
      .update({
        is_active: !racecourse.is_active,
      })
      .eq("id", racecourse.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await loadRacecourses();
  }

  async function deleteRacecourse(racecourse: Racecourse) {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${racecourse.name}?`
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage("");

    const { error } = await supabase
      .from("racecourses")
      .delete()
      .eq("id", racecourse.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await loadRacecourses();
  }

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1 text-sm font-semibold uppercase tracking-wider text-amber-600">
              Race management
            </p>

            <h1 className="text-3xl font-bold text-slate-900">
              Racecourses
            </h1>

            <p className="mt-2 text-slate-600">
              Manage the racecourses used throughout the competition.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white transition hover:bg-teal-800"
          >
            New Racecourse
          </button>
        </div>

        {errorMessage && !showModal && (
          <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
            {errorMessage}
          </div>
        )}

        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label
            htmlFor="racecourse-search"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            Search racecourses
          </label>

          <input
            id="racecourse-search"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by racecourse, city or state"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-slate-600">
              Loading racecourses...
            </div>
          ) : filteredRacecourses.length === 0 ? (
            <div className="p-10 text-center">
              <h2 className="text-xl font-semibold text-slate-900">
                No racecourses found
              </h2>

              <p className="mt-2 text-slate-600">
                Create your first racecourse or change your search.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Racecourse
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      City
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      State
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
                  {filteredRacecourses.map((racecourse) => (
                    <tr
                      key={racecourse.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900">
                        {racecourse.name}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                        {racecourse.city || "—"}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                        {racecourse.state}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            racecourse.is_active
                              ? "bg-teal-100 text-teal-700"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {racecourse.is_active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => openEditModal(racecourse)}
                          className="mr-4 font-semibold text-teal-700 hover:text-teal-800"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleActive(racecourse)}
                          className="mr-4 font-semibold text-amber-700 hover:text-amber-900"
                        >
                          {racecourse.is_active
                            ? "Deactivate"
                            : "Activate"}
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteRacecourse(racecourse)}
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
                  {editingRacecourse
                    ? "Edit Racecourse"
                    : "Create Racecourse"}
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  Add the name and location of the racecourse.
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

            <form onSubmit={saveRacecourse} className="space-y-5">
              <div>
                <label
                  htmlFor="racecourse-name"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Racecourse name
                </label>

                <input
                  id="racecourse-name"
                  type="text"
                  value={form.name}
                  onChange={(event) =>
                    updateForm("name", event.target.value)
                  }
                  placeholder="Flemington"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="racecourse-city"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    City
                  </label>

                  <input
                    id="racecourse-city"
                    type="text"
                    value={form.city}
                    onChange={(event) =>
                      updateForm("city", event.target.value)
                    }
                    placeholder="Melbourne"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="racecourse-state"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    State
                  </label>

                  <select
                    id="racecourse-state"
                    value={form.state}
                    onChange={(event) =>
                      updateForm("state", event.target.value)
                    }
                    required
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
                  >
                    <option value="">Select a state</option>

                    {australianStates.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) =>
                    updateForm("is_active", event.target.checked)
                  }
                  className="h-4 w-4 accent-green-800"
                />

                <span>
                  <span className="block font-semibold text-slate-800">
                    Active racecourse
                  </span>

                  <span className="block text-sm text-slate-500">
                    Active racecourses can be selected when creating races.
                  </span>
                </span>
              </label>

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
                  className="rounded-lg bg-green-800 px-5 py-3 font-semibold text-white hover:bg-green-900 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {saving
                    ? "Saving..."
                    : editingRacecourse
                    ? "Save Changes"
                    : "Create Racecourse"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}