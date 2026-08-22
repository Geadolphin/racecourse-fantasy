"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { supabase } from "@/lib/supabase";

type Horse = {
  id: string;
  name: string;
  silks_url: string | null;
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


type RaceResultRow = {
  result_id: string;
  horse_id: string;
  horse_name: string;
  silks_url?: string | null;
  saddlecloth_number: number | null;
  finishing_position: number | null;
  result_status: string;
  fantasy_points: number;
  price_change: number;
  price_before: number;
  price_after: number;
  is_dead_heat: boolean;
};

type RaceResultsData = {
  success: boolean;
  race: {
    id: string;
    race_number: number;
    race_name: string;
    grade: RaceHistoryRow["race_grade"];
    scheduled_start: string;
    status: string;
    racecourse: Racecourse | null;
  } | null;
  results: RaceResultRow[];
  message?: string;
};

type Racecourse = {
  id: string;
  name: string;
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

function getGradeLabel(grade: RaceHistoryRow["race_grade"]) {
  const labels: Record<RaceHistoryRow["race_grade"], string> = {
    L: "Listed",
    G3: "Group 3",
    G2: "Group 2",
    G1: "Group 1",
  };

  return labels[grade];
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
    if (remainderTen === 1) {
      suffix = "st";
    } else if (remainderTen === 2) {
      suffix = "nd";
    } else if (remainderTen === 3) {
      suffix = "rd";
    }
  }

  return `${finishingPosition}${suffix}`;
}

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function HorseProfilePage() {
  const params = useParams<{ id: string }>();
  const horseId = params.id;

  const [data, setData] = useState<HorseProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [selectedRaceId, setSelectedRaceId] =
    useState<string | null>(null);
  const [raceResultsData, setRaceResultsData] =
    useState<RaceResultsData | null>(null);
  const [raceResultsLoading, setRaceResultsLoading] =
    useState(false);
  const [raceResultsError, setRaceResultsError] =
    useState("");

  useEffect(() => {
    let active = true;

    async function loadHorseProfile() {
      setLoading(true);
      setErrorMessage("");

      const [
        { data: profileData, error },
        { data: horseSilksData, error: horseSilksError },
      ] = await Promise.all([
        supabase.rpc(
          "get_horse_profile",
          {
            p_horse_id: horseId,
          }
        ),
        supabase
          .from("horses")
          .select("id, silks_url")
          .eq("id", horseId)
          .maybeSingle(),
      ]);

      if (!active) {
        return;
      }

      if (error) {
        console.error("Horse profile RPC error:", error);
        setErrorMessage(
          error.message || "The horse profile could not be loaded."
        );
        setData(null);
        setLoading(false);
        return;
      }

      if (horseSilksError) {
        console.error(
          "Horse profile silks load error:",
          horseSilksError
        );
      }

      const loadedProfile =
        profileData as HorseProfileData;

      setData({
        ...loadedProfile,
        horse: loadedProfile.horse
          ? {
              ...loadedProfile.horse,
              silks_url:
                horseSilksData?.silks_url ?? null,
            }
          : null,
      });

      setLoading(false);
    }

    if (horseId) {
      void loadHorseProfile();
    }

    return () => {
      active = false;
    };
  }, [horseId]);

  useEffect(() => {
    if (!selectedRaceId) {
      setRaceResultsData(null);
      setRaceResultsError("");
      return;
    }

    let active = true;

    async function loadRaceResults() {
      setRaceResultsLoading(true);
      setRaceResultsError("");

      const { data: resultData, error } = await supabase.rpc(
        "get_calendar_race_results",
        {
          p_race_id: selectedRaceId,
        }
      );

      if (!active) {
        return;
      }

      if (error) {
        console.error("Horse profile race results error:", error);
        setRaceResultsError(
          error.message || "The race results could not be loaded."
        );
        setRaceResultsData(null);
        setRaceResultsLoading(false);
        return;
      }

      const loadedResults =
        resultData as unknown as RaceResultsData;

      const horseIds = Array.from(
        new Set(
          (loadedResults.results ?? [])
            .map((result) => result.horse_id)
            .filter(Boolean)
        )
      );

      let silksByHorseId: Record<
        string,
        string | null
      > = {};

      if (horseIds.length > 0) {
        const {
          data: resultHorseData,
          error: resultHorseError,
        } = await supabase
          .from("horses")
          .select("id, silks_url")
          .in("id", horseIds);

        if (!active) {
          return;
        }

        if (resultHorseError) {
          console.error(
            "Race result silks load error:",
            resultHorseError
          );
        } else {
          silksByHorseId = Object.fromEntries(
            (resultHorseData ?? []).map((horse) => [
              horse.id,
              horse.silks_url ?? null,
            ])
          );
        }
      }

      setRaceResultsData({
        ...loadedResults,
        results: (loadedResults.results ?? []).map(
          (result) => ({
            ...result,
            silks_url:
              silksByHorseId[result.horse_id] ?? null,
          })
        ),
      });

      setRaceResultsLoading(false);
    }

    void loadRaceResults();

    return () => {
      active = false;
    };
  }, [selectedRaceId]);

  useEffect(() => {
    if (!selectedRaceId) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedRaceId(null);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedRaceId]);

  const horse = data?.horse ?? null;

  const totalPriceMovement = useMemo(() => {
    return (data?.price_history ?? []).reduce(
      (total, row) => total + row.price_change,
      0
    );
  }, [data]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-7xl rounded-xl border bg-white p-10 text-center text-slate-500">
          Loading horse profile...
        </div>
      </main>
    );
  }

  if (errorMessage || !horse) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 md:p-8">
        <div className="mx-auto max-w-4xl rounded-xl border bg-white p-8">
          <h1 className="text-3xl font-bold text-slate-900">
            Horse Profile
          </h1>

          <p className="mt-4 text-red-700">
            {errorMessage ||
              data?.message ||
              "This horse could not be found."}
          </p>

          <Link
            href="/horses"
            className="mt-6 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-bold text-white hover:bg-slate-800"
          >
            Return to Horses
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm md:p-8">
          <Link
            href="/horses"
            className="text-sm font-bold text-teal-300 hover:text-white"
          >
            ← Horse Centre
          </Link>

          <div className="mt-5 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center md:h-24 md:w-24">
                {horse.silks_url ? (
                  <img
                    src={horse.silks_url}
                    alt={`${horse.name} silks`}
                    className="max-h-20 max-w-20 object-contain md:max-h-24 md:max-w-24"
                  />
                ) : null}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="truncate text-3xl font-bold md:text-4xl">
                    {horse.name}
                  </h1>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      horse.is_active
                        ? "bg-teal-500/20 text-teal-200"
                        : "bg-slate-700 text-slate-300"
                    }`}
                  >
                    {horse.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <p className="mt-2 text-slate-300">
                  Fantasy performance and price history
                </p>
              </div>
            </div>

            <div className="md:text-right">
              <p className="text-sm font-medium text-slate-300">
                Current price
              </p>

              <p className="mt-1 text-4xl font-bold text-amber-300">
                {formatCurrency(horse.current_price)}
              </p>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-teal-700 p-5 text-white shadow-sm">
            <p className="text-sm font-medium text-teal-100">
              Fantasy Points
            </p>

            <p className="mt-2 text-4xl font-bold">
              {horse.total_fantasy_points}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-900 p-5 text-white shadow-sm">
            <p className="text-sm font-medium text-slate-300">
              Average Points
            </p>

            <p className="mt-2 text-4xl font-bold">
              {horse.average_fantasy_points.toFixed(1)}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Eligible Starts
            </p>

            <p className="mt-2 text-4xl font-bold text-slate-900">
              {horse.eligible_starts}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Total Price Movement
            </p>

            <p
              className={`mt-2 text-4xl font-bold ${
                totalPriceMovement > 0
                  ? "text-green-700"
                  : totalPriceMovement < 0
                    ? "text-red-700"
                    : "text-slate-900"
              }`}
            >
              {formatSignedCurrency(totalPriceMovement)}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-white shadow-sm">
          <div className="border-b p-6">
            <h2 className="text-2xl font-bold text-slate-900">
              Price History
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Starting price: {formatCurrency(horse.starting_price)}
            </p>
          </div>

          {(data?.price_history ?? []).length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No price history is available yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] divide-y divide-slate-200">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Round
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Race
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Before
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Change
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                      After
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {(data?.price_history ?? []).map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 text-sm text-slate-700">
                        {row.round_number
                          ? `Round ${row.round_number}`
                          : "—"}
                      </td>

                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {row.race_name ?? "Price update"}
                      </td>

                      <td className="px-5 py-4 text-right text-slate-700">
                        {formatCurrency(row.price_before)}
                      </td>

                      <td
                        className={`px-5 py-4 text-right font-bold ${
                          row.price_change > 0
                            ? "text-green-700"
                            : row.price_change < 0
                              ? "text-red-700"
                              : "text-slate-700"
                        }`}
                      >
                        {formatSignedCurrency(row.price_change)}
                      </td>

                      <td className="px-5 py-4 text-right font-bold text-slate-900">
                        {formatCurrency(row.price_after)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border bg-white shadow-sm">
          <div className="border-b p-6">
            <h2 className="text-2xl font-bold text-slate-900">
              Race History
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Official fantasy results
            </p>
          </div>

          {(data?.race_history ?? []).length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No official race history is available yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] divide-y divide-slate-200">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Date
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Round
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Race
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Grade
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Result
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Points
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Price Change
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {(data?.race_history ?? []).map((row) => (
                    <tr
                      key={row.result_id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 text-sm text-slate-700">
                        {formatDate(row.scheduled_start)}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-700">
                        Round {row.round_number}
                      </td>

                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => setSelectedRaceId(row.race_id)}
                          className="text-left transition hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
                          aria-label={`View full results for ${row.race_name}`}
                        >
                          <p className="font-bold text-slate-900">
                            {row.racecourse_name
                              ? `${row.racecourse_name} `
                              : ""}
                            R{row.race_number}
                          </p>

                          <p className="mt-1 text-sm font-medium text-teal-700">
                            {row.race_name}
                          </p>
                        </button>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-700">
                        {getGradeLabel(row.race_grade)}
                      </td>

                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {getFinishLabel(
                          row.finishing_position,
                          row.result_status
                        )}
                        {row.is_dead_heat ? " (DH)" : ""}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <span className="inline-flex min-w-12 justify-center rounded-full bg-teal-50 px-3 py-1 font-bold text-teal-700">
                          {row.fantasy_points}
                        </span>
                      </td>

                      <td
                        className={`px-5 py-4 text-right font-bold ${
                          row.price_change > 0
                            ? "text-green-700"
                            : row.price_change < 0
                              ? "text-red-700"
                              : "text-slate-700"
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
      </div>

      {selectedRaceId && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedRaceId(null);
            }
          }}
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Race results"
            className="max-h-[92vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-5xl sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-950 px-5 py-5 text-white sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-300">
                  Race results
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  {raceResultsData?.race
                    ? `R${raceResultsData.race.race_number} — ${raceResultsData.race.race_name}`
                    : "Loading race..."}
                </h2>

                {raceResultsData?.race?.racecourse && (
                  <p className="mt-1 text-sm text-slate-300">
                    {raceResultsData.race.racecourse.name}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedRaceId(null)}
                className="rounded-lg border border-white/20 px-3 py-2 text-sm font-black transition hover:bg-white/10"
                aria-label="Close race results"
              >
                Close
              </button>
            </div>

            <div className="max-h-[calc(92vh-96px)] overflow-y-auto p-5 sm:p-6">
              {raceResultsLoading && (
                <div className="py-16 text-center text-slate-500">
                  Loading race results...
                </div>
              )}

              {!raceResultsLoading && raceResultsError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
                  {raceResultsError}
                </div>
              )}

              {!raceResultsLoading &&
                !raceResultsError &&
                raceResultsData?.race && (
                  <>
                    <div className="mb-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-slate-100 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Grade
                        </p>
                        <p className="mt-1 font-black text-slate-950">
                          {getGradeLabel(raceResultsData.race.grade)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-100 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Date
                        </p>
                        <p className="mt-1 font-black text-slate-950">
                          {formatDate(raceResultsData.race.scheduled_start)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-100 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Status
                        </p>
                        <p className="mt-1 font-black text-slate-950">
                          {titleCase(raceResultsData.race.status)}
                        </p>
                      </div>
                    </div>

                    {(raceResultsData.results ?? []).length === 0 ? (
                      <div className="rounded-xl border border-slate-200 p-8 text-center text-slate-500">
                        No official results are available for this race yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full min-w-[760px] divide-y divide-slate-200">
                          <thead className="bg-slate-100">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                                Finish
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                                Horse
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
                                Points
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
                                Price Change
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
                                New Price
                              </th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-slate-200">
                            {raceResultsData.results.map((result) => (
                              <tr key={result.result_id}>
                                <td className="px-4 py-4 font-black text-slate-950">
                                  {getFinishLabel(
                                    result.finishing_position,
                                    result.result_status
                                  )}
                                  {result.is_dead_heat ? " (DH)" : ""}
                                </td>

                                <td className="px-4 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                                      {result.silks_url ? (
                                        <img
                                          src={result.silks_url}
                                          alt={`${result.horse_name} silks`}
                                          className="max-h-10 max-w-10 object-contain"
                                          loading="lazy"
                                        />
                                      ) : null}
                                    </div>

                                    <span className="font-bold text-slate-950">
                                      {result.horse_name}
                                    </span>
                                  </div>
                                </td>

                                <td className="px-4 py-4 text-right font-bold text-teal-700">
                                  {result.fantasy_points}
                                </td>

                                <td
                                  className={`px-4 py-4 text-right font-bold ${
                                    result.price_change > 0
                                      ? "text-green-700"
                                      : result.price_change < 0
                                        ? "text-red-700"
                                        : "text-slate-600"
                                  }`}
                                >
                                  {formatSignedCurrency(result.price_change)}
                                </td>

                                <td className="px-4 py-4 text-right font-bold text-slate-950">
                                  {formatCurrency(result.price_after)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}