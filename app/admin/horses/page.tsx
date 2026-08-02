"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

import PageHeader from "@/components/admin/PageHeader";
import AdminModal from "@/components/admin/AdminModal";

import type { Horse } from "@/types/horse";

const emptyHorse = {
  name: "",
  starting_price: 30000,
  current_price: 30000,
  eligible_starts: 0,
  is_active: true,
};

export default function HorsesPage() {
  const [horses, setHorses] = useState<Horse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingHorseId, setEditingHorseId] = useState<string | null>(
    null
  );

  const [form, setForm] = useState(emptyHorse);

  useEffect(() => {
    loadHorses();
  }, []);

  async function loadHorses() {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("horses")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      setErrorMessage("Could not load horses.");
      setLoading(false);
      return;
    }

    setHorses((data ?? []) as Horse[]);
    setLoading(false);
  }

  async function saveHorse(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setErrorMessage("");

    if (!form.name.trim()) {
      setErrorMessage("Please enter a horse name.");
      return;
    }

    if (
      form.starting_price < 30000 ||
      form.current_price < 30000
    ) {
      setErrorMessage(
        "Horse prices cannot be below $30,000."
      );
      return;
    }

    if (form.eligible_starts < 0) {
      setErrorMessage(
        "Eligible starts cannot be below zero."
      );
      return;
    }

    setSaving(true);

    const horseData = {
      name: form.name.trim(),
      starting_price: form.starting_price,
      current_price: form.current_price,
      eligible_starts: form.eligible_starts,
      is_active: form.is_active,
    };

    let saveError;

    if (editingHorseId) {
      const { error } = await supabase
        .from("horses")
        .update(horseData)
        .eq("id", editingHorseId);

      saveError = error;
    } else {
      const { error } = await supabase
        .from("horses")
        .insert({
          ...horseData,
          total_fantasy_points: 0,
        });

      saveError = error;
    }

    if (saveError) {
      console.error(saveError);
      setErrorMessage(saveError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    closeModal();
    await loadHorses();
  }

  function openNewHorseModal() {
    setEditingHorseId(null);
    setForm(emptyHorse);
    setErrorMessage("");
    setShowModal(true);
  }

  function editHorse(horse: Horse) {
    setErrorMessage("");
    setEditingHorseId(horse.id);

    setForm({
      name: horse.name,
      starting_price: horse.starting_price,
      current_price: horse.current_price,
      eligible_starts: horse.eligible_starts,
      is_active: horse.is_active,
    });

    setShowModal(true);
  }

  function closeModal() {
    if (saving) {
      return;
    }

    setErrorMessage("");
    setEditingHorseId(null);
    setForm(emptyHorse);
    setShowModal(false);
  }

  function formatMoney(amount: number) {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  const filteredHorses = horses.filter((horse) =>
    horse.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  return (
    <main className="p-8">
      <PageHeader
        eyebrow="Horse management"
        title="Horses"
        description="Add and manage horses available in the fantasy competition."
        buttonLabel="New Horse"
        onButtonClick={openNewHorseModal}
      />

      {errorMessage && !showModal && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          placeholder="Search horses..."
          value={searchTerm}
          onChange={(event) =>
            setSearchTerm(event.target.value)
          }
          className="w-full rounded-lg border bg-white p-3 sm:max-w-md"
        />

        <p className="text-sm text-slate-500">
          {filteredHorses.length}{" "}
          {filteredHorses.length === 1
            ? "horse"
            : "horses"}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white">
        {loading ? (
          <div className="p-8 text-center text-slate-500">
            Loading horses...
          </div>
        ) : filteredHorses.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {horses.length === 0
              ? "No horses have been added yet."
              : "No horses match your search."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Horse
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Starting Price
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Current Price
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Points
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Eligible Starts
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Status
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filteredHorses.map((horse) => (
                  <tr
                    key={horse.id}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-4 py-4 font-semibold text-slate-900">
                      {horse.name}
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-700">
                      {formatMoney(
                        horse.starting_price
                      )}
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-700">
                      {formatMoney(
                        horse.current_price
                      )}
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-700">
                      {horse.total_fantasy_points}
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-700">
                      {horse.eligible_starts}
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          horse.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {horse.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() =>
                          editHorse(horse)
                        }
                        className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AdminModal
        isOpen={showModal}
        title={
          editingHorseId
            ? "Edit Horse"
            : "New Horse"
        }
        description={
          editingHorseId
            ? "Update the horse details."
            : "Add a horse to the fantasy competition."
        }
        onClose={closeModal}
        maxWidth="lg"
      >
        <form
          onSubmit={saveHorse}
          className="space-y-5"
        >
          {errorMessage && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="mb-1 block font-medium">
              Horse Name
            </label>

            <input
              required
              type="text"
              value={form.name}
              onChange={(event) =>
                setForm({
                  ...form,
                  name: event.target.value,
                })
              }
              placeholder="Enter horse name"
              className="w-full rounded-lg border p-3"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-medium">
                Starting Price
              </label>

              <input
                required
                min={30000}
                step={1000}
                type="number"
                value={form.starting_price}
                onChange={(event) =>
                  setForm({
                    ...form,
                    starting_price: Number(
                      event.target.value
                    ),
                  })
                }
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <label className="mb-1 block font-medium">
                Current Price
              </label>

              <input
                required
                min={30000}
                step={1000}
                type="number"
                value={form.current_price}
                onChange={(event) =>
                  setForm({
                    ...form,
                    current_price: Number(
                      event.target.value
                    ),
                  })
                }
                className="w-full rounded-lg border p-3"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-medium">
              Eligible Starts
            </label>

            <input
              required
              min={0}
              type="number"
              value={form.eligible_starts}
              onChange={(event) =>
                setForm({
                  ...form,
                  eligible_starts: Number(
                    event.target.value
                  ),
                })
              }
              className="w-full rounded-lg border p-3"
            />
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) =>
                setForm({
                  ...form,
                  is_active:
                    event.target.checked,
                })
              }
              className="h-4 w-4"
            />

            <span className="font-medium">
              Active horse
            </span>
          </label>

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
                : editingHorseId
                  ? "Update Horse"
                  : "Save Horse"}
            </button>
          </div>
        </form>
      </AdminModal>
    </main>
  );
}