"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import type { Season } from "../../../types/season";

type Notice = { kind: "error" | "success"; text: string } | null;

const fieldClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100";
const labelClass = "mb-1 block text-xs font-semibold text-slate-600";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency", currency: "AUD", maximumFractionDigits: 0,
  }).format(amount);
}

export default function SeasonsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [salaryCap, setSalaryCap] = useState(2500000);
  const [teamSize, setTeamSize] = useState(10);
  const [isActive, setIsActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [modalError, setModalError] = useState("");

  const loadSeasons = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    const { data, error } = await supabase
      .from("seasons")
      .select("id, name, year, starts_on, ends_on, salary_cap, team_size, is_active")
      .order("year", { ascending: false });
    if (error) setNotice({ kind: "error", text: error.message });
    else setSeasons((data as Season[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { void loadSeasons(true); }, [loadSeasons]);

  const activeCount = seasons.filter((season) => season.is_active).length;

  function resetForm() {
    setName("");
    setYear(new Date().getFullYear());
    setStartDate("");
    setEndDate("");
    setSalaryCap(2500000);
    setTeamSize(10);
    setIsActive(false);
    setModalError("");
  }

  function closeModal() {
    if (saving) return;
    setShowModal(false);
    resetForm();
  }

  async function createSeason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setModalError("");
    const cleanName = name.trim();
    if (!cleanName) return setModalError("Please enter a season name.");
    if (!Number.isInteger(year) || year < 2020 || year > 2100) return setModalError("Enter a valid year between 2020 and 2100.");
    if (!startDate || !endDate) return setModalError("Please enter both dates.");
    if (endDate < startDate) return setModalError("The end date must not be before the start date.");
    if (!Number.isFinite(salaryCap) || salaryCap <= 0) return setModalError("The salary cap must be greater than zero.");
    if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 100) return setModalError("Team size must be between 1 and 100.");

    setSaving(true);
    try {
      if (isActive) {
        const { error } = await supabase.from("seasons").update({ is_active: false }).eq("is_active", true);
        if (error) throw error;
      }
      const { error } = await supabase.from("seasons").insert({
        name: cleanName, year, starts_on: startDate, ends_on: endDate,
        salary_cap: salaryCap, team_size: teamSize, is_active: isActive,
      });
      if (error) throw error;
      setShowModal(false);
      resetForm();
      setNotice({ kind: "success", text: "Season created successfully." });
      await loadSeasons();
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "Unable to create season.");
    } finally {
      setSaving(false);
    }
  }

  async function setActiveSeason(seasonId: string) {
    if (activatingId) return;
    setActivatingId(seasonId);
    setNotice(null);
    try {
      const { error: deactivateError } = await supabase.from("seasons").update({ is_active: false }).eq("is_active", true);
      if (deactivateError) throw deactivateError;
      const { error: activateError } = await supabase.from("seasons").update({ is_active: true }).eq("id", seasonId);
      if (activateError) throw activateError;
      setSeasons((current) => current.map((season) => ({ ...season, is_active: season.id === seasonId })));
      setNotice({ kind: "success", text: "Active season updated." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Unable to activate season." });
      await loadSeasons();
    } finally {
      setActivatingId(null);
    }
  }

  return (
    <main className="min-w-0 p-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Competition management</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Seasons</h1>
            <p className="mt-1 text-sm text-slate-500">Create seasons and manage the active competition.</p>
          </div>
          <button type="button" onClick={() => { resetForm(); setShowModal(true); }}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
            + New Season
          </button>
        </div>

        {notice && (
          <div role="status" className={`rounded-lg border px-3 py-2 text-sm ${notice.kind === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-teal-200 bg-teal-50 text-teal-800"}`}>
            {notice.text}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Total seasons</p>
            <p className="mt-1 text-xl font-bold">{seasons.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Active</p>
            <p className="mt-1 text-xl font-bold">{activeCount}</p>
          </div>
          <div className="col-span-2 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:col-span-1">
            <p className="text-xs text-slate-500">Inactive</p>
            <p className="mt-1 text-xl font-bold">{seasons.length - activeCount}</p>
          </div>
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold">All seasons</h2>
              <p className="text-xs text-slate-500">{seasons.length} seasons</p>
            </div>
            <button type="button" disabled={refreshing || loading} onClick={() => void loadSeasons()}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading seasons...</div>
          ) : seasons.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No seasons created. Select New Season to begin.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Season</th>
                    <th className="px-4 py-2.5">Dates</th>
                    <th className="px-4 py-2.5">Salary cap</th>
                    <th className="px-4 py-2.5">Team size</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {seasons.map((season) => (
                    <tr key={season.id} className="hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold">{season.name} <span className="font-normal text-slate-500">{season.year}</span></td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(season.starts_on)} – {formatDate(season.ends_on)}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatCurrency(season.salary_cap)}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums">{season.team_size} horses</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${season.is_active ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-600"}`}>
                          {season.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {!season.is_active && (
                          <button type="button" disabled={activatingId !== null} onClick={() => void setActiveSeason(season.id)}
                            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50">
                            {activatingId === season.id ? "Activating..." : "Set active"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
          <form onSubmit={createSeason} role="dialog" aria-modal="true" aria-labelledby="new-season-title"
            className="my-6 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="new-season-title" className="text-lg font-bold">New Season</h2>
                <p className="mt-1 text-xs text-slate-500">Configure a new Racecourse Fantasy season.</p>
              </div>
              <button type="button" aria-label="Close" onClick={closeModal} disabled={saving}
                className="rounded-md px-2 py-1 text-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50">×</button>
            </div>
            {modalError && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{modalError}</div>}
            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="season-name" className={labelClass}>Season name</label>
                <input id="season-name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Spring Carnival" className={fieldClass} />
              </div>
              <div>
                <label htmlFor="season-year" className={labelClass}>Year</label>
                <input id="season-year" required type="number" min={2020} max={2100} value={year} onChange={(event) => setYear(Number(event.target.value))} className={fieldClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="season-start" className={labelClass}>Start date</label>
                  <input id="season-start" required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={fieldClass} />
                </div>
                <div>
                  <label htmlFor="season-end" className={labelClass}>End date</label>
                  <input id="season-end" required type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} className={fieldClass} />
                </div>
                <div>
                  <label htmlFor="season-cap" className={labelClass}>Salary cap (AUD)</label>
                  <input id="season-cap" required type="number" min={1} step={1000} value={salaryCap} onChange={(event) => setSalaryCap(Number(event.target.value))} className={fieldClass} />
                </div>
                <div>
                  <label htmlFor="season-size" className={labelClass}>Team size</label>
                  <input id="season-size" required type="number" min={1} max={100} value={teamSize} onChange={(event) => setTeamSize(Number(event.target.value))} className={fieldClass} />
                </div>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3">
                <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="mt-0.5 h-4 w-4 accent-teal-600" />
                <span>
                  <span className="block text-sm font-semibold">Make this the active season</span>
                  <span className="block text-xs text-slate-500">The currently active season will become inactive.</span>
                </span>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" disabled={saving} onClick={closeModal} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{saving ? "Creating..." : "Create Season"}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
