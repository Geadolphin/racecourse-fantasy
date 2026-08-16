"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { supabase } from "@/lib/supabase";

type HorseRow = {
  id: string;
  name: string;
  current_price: number;
  total_fantasy_points: number;
  eligible_starts: number;
  average_fantasy_points: number | null;
  is_active: boolean;
};

type SortField =
  | "name"
  | "price"
  | "points"
  | "value"
  | "average"
  | "starts";

type SortDirection = "asc" | "desc";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatAverage(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "0.0";
  }

  return value.toFixed(1);
}

export default function HorsesPage() {
  const [horses, setHorses] = useState<HorseRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] =
    useState<SortField>("name");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("asc");

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadHorses() {
      setLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("horse_statistics")
        .select(
          `
            id,
            name,
            current_price,
            total_fantasy_points,
            eligible_starts,
            average_fantasy_points,
            is_active
          `
        )
        .order("name", { ascending: true });

      if (!active) {
        return;
      }

      if (error) {
        console.error("Horse centre load error:", error);
        setErrorMessage(
          error.message || "The horse centre could not be loaded."
        );
        setHorses([]);
        setLoading(false);
        return;
      }

      setHorses(
        (data ?? []).map((horse) => ({
          ...horse,
          current_price: Number(horse.current_price ?? 0),
          total_fantasy_points: Number(
            horse.total_fantasy_points ?? 0
          ),
          eligible_starts: Number(horse.eligible_starts ?? 0),
          average_fantasy_points:
            horse.average_fantasy_points === null
              ? null
              : Number(horse.average_fantasy_points),
        })) as HorseRow[]
      );

      setLoading(false);
    }

    void loadHorses();

    return () => {
      active = false;
    };
  }, []);

  const filteredHorses = useMemo(() => {
    const normalisedSearch = searchTerm.trim().toLowerCase();

    const filtered = horses.filter((horse) => {
      const matchesSearch =
        normalisedSearch.length === 0 ||
        horse.name.toLowerCase().includes(normalisedSearch);

      return matchesSearch;
    });

    return [...filtered].sort((a, b) => {
      let comparison = 0;

      if (sortField === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === "price") {
        comparison = a.current_price - b.current_price;
      } else if (sortField === "points") {
        comparison =
          a.total_fantasy_points - b.total_fantasy_points;
      } else if (sortField === "value") {
        const valueA =
          a.total_fantasy_points > 0
            ? a.current_price / a.total_fantasy_points
            : Number.POSITIVE_INFINITY;

        const valueB =
          b.total_fantasy_points > 0
            ? b.current_price / b.total_fantasy_points
            : Number.POSITIVE_INFINITY;

        comparison = valueA - valueB;
      } else if (sortField === "average") {
        comparison =
          (a.average_fantasy_points ?? 0) -
          (b.average_fantasy_points ?? 0);
      } else if (sortField === "starts") {
        comparison = a.eligible_starts - b.eligible_starts;
      }

      return sortDirection === "asc"
        ? comparison
        : -comparison;
    });
  }, [
    horses,
    searchTerm,
    sortField,
    sortDirection,
  ]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((current) =>
        current === "asc" ? "desc" : "asc"
      );
      return;
    }

    setSortField(field);
    setSortDirection(field === "name" ? "asc" : "desc");
  }

  function sortIndicator(field: SortField) {
    if (sortField !== field) {
      return "";
    }

    return sortDirection === "asc" ? " ↑" : " ↓";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-7xl rounded-xl border bg-white p-10 text-center text-slate-500">
          Loading horses...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-xl bg-slate-900 p-5 text-white shadow-sm md:p-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-300">
            Horse Centre
          </p>

          <h1 className="mt-1 text-3xl font-bold">
            Horses
          </h1>

          <p className="mt-1 max-w-2xl text-sm text-slate-300">
            Search every horse and review current prices, fantasy
            points, averages and eligible starts.
          </p>
        </header>

        {errorMessage && (
          <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
            {errorMessage}
          </div>
        )}

        <section className="mt-4 rounded-xl border bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              type="search"
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
              placeholder="Search horses"
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-teal-700"
            />

            <select
              value={`${sortField}-${sortDirection}`}
              onChange={(event) => {
                const [field, direction] =
                  event.target.value.split("-") as [
                    SortField,
                    SortDirection,
                  ];

                setSortField(field);
                setSortDirection(direction);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-teal-700"
            >
              <option value="name-asc">Horse name: A–Z</option>
              <option value="name-desc">Horse name: Z–A</option>
              <option value="price-desc">Price: highest first</option>
              <option value="price-asc">Price: lowest first</option>
              <option value="points-desc">Fantasy points: highest first</option>
              <option value="points-asc">Fantasy points: lowest first</option>
              <option value="value-asc">$/Point: best value first</option>
              <option value="value-desc">$/Point: highest first</option>
              <option value="average-desc">Average points: highest first</option>
              <option value="average-asc">Average points: lowest first</option>
              <option value="starts-desc">Starts: highest first</option>
              <option value="starts-asc">Starts: lowest first</option>
            </select>
          </div>

          <p className="mt-2 text-xs font-semibold text-slate-500">
            {filteredHorses.length}{" "}
            {filteredHorses.length === 1 ? "horse" : "horses"}
          </p>
        </section>

        {filteredHorses.length === 0 ? (
          <div className="mt-6 rounded-xl border bg-white p-10 text-center text-slate-500">
            No horses match your filters.
          </div>
        ) : (
          <>
            {/* Mobile horse cards */}
            <section className="mt-4 space-y-2 md:hidden">
              {filteredHorses.map((horse) => (
                <Link
                  key={horse.id}
                  href={`/horses/${horse.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition active:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-bold text-slate-900">
                        {horse.name}
                      </h2>

                      <span
                        className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          horse.is_active
                            ? "bg-teal-50 text-teal-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {horse.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Price
                      </p>
                      <p className="mt-0.5 font-bold text-slate-900">
                        {formatCurrency(horse.current_price)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-100 pt-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Points
                      </p>
                      <p className="mt-0.5 font-bold text-slate-900">
                        {horse.total_fantasy_points}
                      </p>
                    </div>

                    <div className="pl-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Average
                      </p>
                      <p className="mt-0.5 font-bold text-slate-900">
                        {formatAverage(horse.average_fantasy_points)}
                      </p>
                    </div>

                    <div className="pl-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Starts
                      </p>
                      <p className="mt-0.5 font-bold text-slate-900">
                        {horse.eligible_starts}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </section>

            {/* Desktop horse table */}
            <section className="mt-4 hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <button
                          type="button"
                          onClick={() => handleSort("name")}
                          className="transition hover:text-slate-900"
                        >
                          Horse{sortIndicator("name")}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <button
                          type="button"
                          onClick={() => handleSort("price")}
                          className="transition hover:text-slate-900"
                        >
                          Price{sortIndicator("price")}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <button
                          type="button"
                          onClick={() => handleSort("points")}
                          className="transition hover:text-slate-900"
                        >
                          Points{sortIndicator("points")}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <button
                          type="button"
                          onClick={() => handleSort("value")}
                          className="transition hover:text-slate-900"
                        >
                          $/Point{sortIndicator("value")}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <button
                          type="button"
                          onClick={() => handleSort("average")}
                          className="transition hover:text-slate-900"
                        >
                          Average{sortIndicator("average")}
                        </button>
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <button
                          type="button"
                          onClick={() => handleSort("starts")}
                          className="transition hover:text-slate-900"
                        >
                          Starts{sortIndicator("starts")}
                        </button>
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredHorses.map((horse) => (
                      <tr
                        key={horse.id}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="px-5 py-3.5">
                          <Link
                            href={`/horses/${horse.id}`}
                            className="font-bold text-slate-900 transition hover:text-teal-700"
                          >
                            {horse.name}
                          </Link>
                        </td>

                        <td className="px-4 py-3.5 text-right font-semibold text-slate-900">
                          {formatCurrency(horse.current_price)}
                        </td>

                        <td className="px-4 py-3.5 text-right font-semibold text-slate-900">
                          {horse.total_fantasy_points}
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-slate-900">
                          {horse.total_fantasy_points > 0
                            ? formatCurrency(
                                horse.current_price /
                                  horse.total_fantasy_points
                              )
                            : "—"}
                        </td>

                        <td className="px-4 py-3.5 text-right text-slate-700">
                          {formatAverage(horse.average_fantasy_points)}
                        </td>

                        <td className="px-4 py-3.5 text-right text-slate-700">
                          {horse.eligible_starts}
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}