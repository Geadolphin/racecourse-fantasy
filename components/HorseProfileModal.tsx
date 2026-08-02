"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { supabase } from "@/lib/supabase";

type Horse = {
  id: string;
  name: string;
  current_price: number;
  starting_price: number;
  total_fantasy_points: number;
  eligible_starts: number;
  average_fantasy_points: number;
  is_active: boolean;
};

type PriceHistoryRow = {
  id: string;
  race_id: string | null;
  price_before: number;
  price_change: number;
  price_after: number;
  recorded_at: string;
  race_name: string | null;
  round_number: number | null;
};

type RaceHistoryRow = {
  result_id: string;
  race_id: string;
  race_name: string;
  race_number: number;
  race_grade: "L" | "G3" | "G2" | "G1";
  racecourse_name: string | null;
  round_number: number;
  scheduled_start: string;
  finishing_position: number | null;
  result_status: string;
  fantasy_points: number;
  price_change: number;
  price_before: number;
  price_after: number;
  is_dead_heat: boolean;
};

type HorseProfileData = {
  success: boolean;
  horse: Horse | null;
  price_history: PriceHistoryRow[];
  race_history: RaceHistoryRow[];
  message?: string;
};

type Props = {
  horseId: string | null;
  onClose: () => void;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatSignedCurrency(value: number) {
  const formatted = formatCurrency(Math.abs(value));

  if (value > 0) {
    return `+${formatted}`;
  }

  if (value < 0) {
    return `-${formatted}`;
  }

  return formatted;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeZone: "Australia/Melbourne",
  }).format(new Date(value));
}

function getFinishLabel(
  finishingPosition: number | null,
  resultStatus: string
) {
  if (resultStatus !== "finished" || finishingPosition === null) {
    return resultStatus
      .replaceAll("_", " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  const remainderTen = finishingPosition % 10;
  const remainderHundred = finishingPosition % 100;

  let suffix = "th";

  if (remainderHundred < 11 || remainderHundred > 13) {
    if (remainderTen === 1) suffix = "st";
    if (remainderTen === 2) suffix = "nd";
    if (remainderTen === 3) suffix = "rd";
  }

  return `${finishingPosition}${suffix}`;
}

export default function HorseProfileModal({
  horseId,
  onClose,
}: Props) {
  const [data, setData] = useState<HorseProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!horseId) {
      setData(null);
      setErrorMessage("");
      return;
    }

    let active = true;

    async function loadProfile() {
      setLoading(true);
      setErrorMessage("");

      const { data: profileData, error } = await supabase.rpc(
        "get_horse_profile",
        {
          p_horse_id: horseId,
        }
      );

      if (!active) {
        return;
      }

      if (error) {
        console.error("Horse profile modal RPC error:", error);
        setErrorMessage(
          error.message || "The horse profile could not be loaded."
        );
        setData(null);
        setLoading(false);
        return;
      }

      setData(profileData as HorseProfileData);
      setLoading(false);
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [horseId]);

  useEffect(() => {
    if (!horseId) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [horseId, onClose]);

  const horse = data?.horse ?? null;

  const highestPrice = useMemo(() => {
    const prices = [
      horse?.starting_price ?? 0,
      horse?.current_price ?? 0,
      ...(data?.price_history ?? []).flatMap((row) => [
        row.price_before,
        row.price_after,
      ]),
    ];

    return Math.max(...prices);
  }, [data, horse]);

  const lowestPrice = useMemo(() => {
    const prices = [
      horse?.starting_price ?? 0,
      horse?.current_price ?? 0,
      ...(data?.price_history ?? []).flatMap((row) => [
        row.price_before,
        row.price_after,
      ]),
    ].filter((value) => value > 0);

    return prices.length > 0 ? Math.min(...prices) : 0;
  }, [data, horse]);

  if (!horseId) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={horse?.name ?? "Horse profile"}
        className="max-h-[92vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-5xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-950 px-5 py-5 text-white sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-300">
              Horse profile
            </p>

            <h2 className="mt-1 text-2xl font-bold">
              {horse?.name ?? "Loading..."}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/20 p-2 text-white transition hover:bg-white/10"
            aria-label="Close horse profile"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-82px)] overflow-y-auto p-5 sm:p-6">
          {loading && (
            <div className="py-16 text-center text-slate-500">
              Loading horse statistics...
            </div>
          )}

          {!loading && errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
              {errorMessage}
            </div>
          )}

          {!loading && !errorMessage && horse && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-slate-100 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Current price
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-950">
                    {formatCurrency(horse.current_price)}
                  </p>
                </div>

                <div className="rounded-xl bg-teal-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-teal-700">
                    Fantasy points
                  </p>
                  <p className="mt-1 text-2xl font-bold text-teal-900">
                    {horse.total_fantasy_points}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-100 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Average
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-950">
                    {horse.average_fantasy_points.toFixed(1)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-100 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Eligible starts
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-950">
                    {horse.eligible_starts}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Starting price
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-950">
                    {formatCurrency(horse.starting_price)}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Highest price
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-950">
                    {formatCurrency(highestPrice)}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Lowest price
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-950">
                    {formatCurrency(lowestPrice)}
                  </p>
                </div>
              </div>

              <section className="mt-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-950">
                      Recent race history
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Latest official fantasy results.
                    </p>
                  </div>

                  <Link
                    href={`/horses/${horse.id}`}
                    className="text-sm font-bold text-teal-700 hover:text-slate-950"
                  >
                    Full profile →
                  </Link>
                </div>

                {(data?.race_history ?? []).length === 0 ? (
                  <div className="mt-4 rounded-xl border border-slate-200 p-6 text-center text-slate-500">
                    No official race history is available yet.
                  </div>
                ) : (
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[760px] divide-y divide-slate-200">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                            Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                            Race
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                            Result
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
                            Points
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
                            Price change
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-200">
                        {(data?.race_history ?? [])
                          .slice(0, 5)
                          .map((row) => (
                            <tr key={row.result_id}>
                              <td className="px-4 py-3 text-sm text-slate-600">
                                {formatDate(row.scheduled_start)}
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-bold text-slate-950">
                                  {row.racecourse_name
                                    ? `${row.racecourse_name} `
                                    : ""}
                                  R{row.race_number}
                                </p>
                                <p className="text-sm text-slate-500">
                                  {row.race_name}
                                </p>
                              </td>
                              <td className="px-4 py-3 font-semibold text-slate-800">
                                {getFinishLabel(
                                  row.finishing_position,
                                  row.result_status
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-teal-700">
                                {row.fantasy_points}
                              </td>
                              <td
                                className={`px-4 py-3 text-right font-bold ${
                                  row.price_change > 0
                                    ? "text-green-700"
                                    : row.price_change < 0
                                      ? "text-red-700"
                                      : "text-slate-600"
                                }`}
                              >
                                {formatSignedCurrency(row.price_change)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="mt-6">
                <h3 className="text-xl font-bold text-slate-950">
                  Recent price history
                </h3>

                {(data?.price_history ?? []).length === 0 ? (
                  <div className="mt-4 rounded-xl border border-slate-200 p-6 text-center text-slate-500">
                    No price history is available yet.
                  </div>
                ) : (
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[680px] divide-y divide-slate-200">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                            Round
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                            Race
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
                            Before
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
                            Change
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
                            After
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-200">
                        {(data?.price_history ?? [])
                          .slice(0, 5)
                          .map((row) => (
                            <tr key={row.id}>
                              <td className="px-4 py-3 text-sm text-slate-600">
                                {row.round_number
                                  ? `Round ${row.round_number}`
                                  : "—"}
                              </td>
                              <td className="px-4 py-3 font-semibold text-slate-800">
                                {row.race_name ?? "Price update"}
                              </td>
                              <td className="px-4 py-3 text-right text-slate-600">
                                {formatCurrency(row.price_before)}
                              </td>
                              <td
                                className={`px-4 py-3 text-right font-bold ${
                                  row.price_change > 0
                                    ? "text-green-700"
                                    : row.price_change < 0
                                      ? "text-red-700"
                                      : "text-slate-600"
                                }`}
                              >
                                {formatSignedCurrency(row.price_change)}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-slate-950">
                                {formatCurrency(row.price_after)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </section>
    </div>
  );
}