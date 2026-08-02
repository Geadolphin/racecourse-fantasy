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

type SortOption =
  | "name"
  | "price-high"
  | "price-low"
  | "points-high"
  | "average-high";

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
  const [statusFilter, setStatusFilter] =
    useState<"all" | "active" | "inactive">("active");
  const [sortOption, setSortOption] =
    useState<SortOption>("name");

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

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active"
          ? horse.is_active
          : !horse.is_active);

      return matchesSearch && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      if (sortOption === "price-high") {
        return b.current_price - a.current_price;
      }

      if (sortOption === "price-low") {
        return a.current_price - b.current_price;
      }

      if (sortOption === "points-high") {
        return b.total_fantasy_points - a.total_fantasy_points;
      }

      if (sortOption === "average-high") {
        return (
          (b.average_fantasy_points ?? 0) -
          (a.average_fantasy_points ?? 0)
        );
      }

      return a.name.localeCompare(b.name);
    });
  }, [horses, searchTerm, sortOption, statusFilter]);

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
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm md:p-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-300">
            Horse Centre
          </p>

          <h1 className="mt-2 text-3xl font-bold md:text-4xl">
            Horses
          </h1>

          <p className="mt-2 max-w-2xl text-slate-300">
            Search every horse and review current prices, fantasy
            points, averages and eligible starts.
          </p>
        </header>

        {errorMessage && (
          <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
            {errorMessage}
          </div>
        )}

        <section className="mt-6 rounded-xl border bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-3">
            <input
              type="search"
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
              placeholder="Search horses"
              className="rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-teal-700"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as
                    | "all"
                    | "active"
                    | "inactive"
                )
              }
              className="rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-teal-700"
            >
              <option value="active">Active horses</option>
              <option value="all">All horses</option>
              <option value="inactive">Inactive horses</option>
            </select>

            <select
              value={sortOption}
              onChange={(event) =>
                setSortOption(event.target.value as SortOption)
              }
              className="rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-teal-700"
            >
              <option value="name">Horse name</option>
              <option value="price-high">
                Price: highest first
              </option>
              <option value="price-low">
                Price: lowest first
              </option>
              <option value="points-high">
                Fantasy points: highest first
              </option>
              <option value="average-high">
                Average points: highest first
              </option>
            </select>
          </div>

          <p className="mt-4 text-sm text-slate-500">
            {filteredHorses.length}{" "}
            {filteredHorses.length === 1 ? "horse" : "horses"}
          </p>
        </section>

        {filteredHorses.length === 0 ? (
          <div className="mt-6 rounded-xl border bg-white p-10 text-center text-slate-500">
            No horses match your filters.
          </div>
        ) : (
          <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredHorses.map((horse) => (
              <Link
                key={horse.id}
                href={`/horses/${horse.id}`}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-bold text-slate-900">
                      {horse.name}
                    </h2>

                    <span
                      className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                        horse.is_active
                          ? "bg-teal-50 text-teal-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {horse.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <p className="shrink-0 text-lg font-bold text-slate-900">
                    {formatCurrency(horse.current_price)}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-slate-100 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Points
                    </p>

                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {horse.total_fantasy_points}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-100 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Average
                    </p>

                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {formatAverage(horse.average_fantasy_points)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-100 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Starts
                    </p>

                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {horse.eligible_starts}
                    </p>
                  </div>
                </div>

                <p className="mt-5 text-sm font-bold text-teal-700">
                  View horse profile →
                </p>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}