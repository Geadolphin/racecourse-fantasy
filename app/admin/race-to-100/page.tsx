"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Race = {
  id: string;
  race_name: string;
  year: number;
  track: string;
  distance: number;
  race_grade: string | null;
};

type Horse = {
  id: string;
  name: string;
  rating: number;
  sprinter: boolean;
  middle_distance: boolean;
  stayer: boolean;
  silks_url: string | null;
};

type RunnerRow = {
  id: number;
  race_id: string;
  horse_id: string;
};

type Runner = RunnerRow & {
  horse: Horse;
};

const SILKS_BUCKET = "race-to-100-silks";

function horseCategories(horse: Horse) {
  const categories: string[] = [];

  if (horse.sprinter) categories.push("Sprinter");
  if (horse.middle_distance) categories.push("Middle Distance");
  if (horse.stayer) categories.push("Stayer");

  return categories.join(" / ");
}

function safeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function raceDistanceBand(distance: number) {
  if (distance <= 1400) return "Sprinter";
  if (distance <= 2200) return "Middle Distance";
  return "Stayer";
}

export default function RaceTo100AdminPage() {
  const [races, setRaces] = useState<Race[]>([]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [runners, setRunners] = useState<Runner[]>([]);

  const [selectedRaceId, setSelectedRaceId] = useState("");
  const [raceSearch, setRaceSearch] = useState("");
  const [raceYear, setRaceYear] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [loadingPage, setLoadingPage] = useState(true);
  const [loadingRunners, setLoadingRunners] = useState(false);
  const [workingHorseId, setWorkingHorseId] = useState<string | null>(null);
  const [uploadingHorseId, setUploadingHorseId] = useState<string | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedRace = useMemo(
    () => races.find((race) => race.id === selectedRaceId) ?? null,
    [races, selectedRaceId],
  );

  const raceYears = useMemo(
    () =>
      Array.from(new Set(races.map((race) => race.year))).sort(
        (a, b) => b - a,
      ),
    [races],
  );

  const filteredRaces = useMemo(() => {
    const query = raceSearch.trim().toLowerCase();

    return races.filter((race) => {
      const matchesYear =
        raceYear === "all" || String(race.year) === raceYear;

      const matchesSearch =
        !query ||
        race.race_name.toLowerCase().includes(query) ||
        race.track.toLowerCase().includes(query) ||
        String(race.distance).includes(query) ||
        (race.race_grade ?? "").toLowerCase().includes(query);

      return matchesYear && matchesSearch;
    });
  }, [races, raceSearch, raceYear]);

  const runnerHorseIds = useMemo(
    () => new Set(runners.map((runner) => runner.horse_id)),
    [runners],
  );

  const filteredAvailableHorses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return horses
      .filter((horse) => !runnerHorseIds.has(horse.id))
      .filter((horse) => {
        if (!query) return true;

        return (
          horse.name.toLowerCase().includes(query) ||
          horseCategories(horse).toLowerCase().includes(query) ||
          String(horse.rating).includes(query)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [horses, runnerHorseIds, search]);


  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedRaceId) {
      setRunners([]);
      return;
    }

    loadRunners(selectedRaceId);
  }, [selectedRaceId]);

  async function loadInitialData() {
    setLoadingPage(true);
    setError(null);

    try {
      const [raceResult, horseResult] = await Promise.all([
        supabase
          .from("race_to_100_races")
          .select("id,race_name,year,track,distance,race_grade")
          .order("year", { ascending: false })
          .order("race_name", { ascending: true }),

        supabase
          .from("race_to_100_horses")
          .select("id,name,rating,sprinter,middle_distance,stayer,silks_url")
          .order("name", { ascending: true }),
      ]);

      if (raceResult.error) throw raceResult.error;
      if (horseResult.error) throw horseResult.error;

      const loadedRaces = (raceResult.data ?? []) as Race[];
      const loadedHorses = (horseResult.data ?? []) as Horse[];

      setRaces(loadedRaces);
      setHorses(loadedHorses);


    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load Race to 100 admin data.",
      );
    } finally {
      setLoadingPage(false);
    }
  }

  async function loadRunners(raceId: string) {
    setLoadingRunners(true);
    setError(null);

    try {
      const { data: runnerRows, error: runnerError } = await supabase
        .from("race_to_100_runners")
        .select("id,race_id,horse_id")
        .eq("race_id", raceId);

      if (runnerError) throw runnerError;

      const rows = (runnerRows ?? []) as RunnerRow[];

      if (rows.length === 0) {
        setRunners([]);
        return;
      }

      const ids = rows.map((runner) => runner.horse_id);

      const { data: horseRows, error: horseError } = await supabase
        .from("race_to_100_horses")
        .select("id,name,rating,sprinter,middle_distance,stayer,silks_url")
        .in("id", ids);

      if (horseError) throw horseError;

      const horseMap = new Map(
        ((horseRows ?? []) as Horse[]).map((horse) => [horse.id, horse]),
      );

      const combined = rows
        .map((runner) => {
          const horse = horseMap.get(runner.horse_id);

          if (!horse) return null;

          return {
            ...runner,
            horse,
          };
        })
        .filter((runner): runner is Runner => runner !== null)
        .sort((a, b) => a.horse.name.localeCompare(b.horse.name));

      setRunners(combined);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load race runners.",
      );
    } finally {
      setLoadingRunners(false);
    }
  }

  async function addHorse(horse: Horse) {
    if (!selectedRaceId) return;

    setWorkingHorseId(horse.id);
    setError(null);
    setMessage(null);

    try {
      const { error: insertError } = await supabase
        .from("race_to_100_runners")
        .insert({
          race_id: selectedRaceId,
          horse_id: horse.id,
        });

      if (insertError) throw insertError;

      setMessage(`${horse.name} added to the race.`);
      await loadRunners(selectedRaceId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not add horse to race.",
      );
    } finally {
      setWorkingHorseId(null);
    }
  }

  async function removeRunner(runner: Runner) {
    if (!selectedRaceId) return;

    const confirmed = window.confirm(
      `Remove ${runner.horse.name} from this race?`,
    );

    if (!confirmed) return;

    setWorkingHorseId(runner.horse.id);
    setError(null);
    setMessage(null);

    try {
      const { error: deleteError } = await supabase
        .from("race_to_100_runners")
        .delete()
        .eq("id", runner.id);

      if (deleteError) throw deleteError;

      setMessage(`${runner.horse.name} removed from the race.`);
      await loadRunners(selectedRaceId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not remove runner.",
      );
    } finally {
      setWorkingHorseId(null);
    }
  }

  async function uploadHorseSilks(horse: Horse, file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Silks must be an image file.");
      return;
    }

    setUploadingHorseId(horse.id);
    setError(null);
    setMessage(null);

    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `horses/${safeFileName(horse.name)}-${horse.id}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(SILKS_BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from(SILKS_BUCKET)
        .getPublicUrl(path);

      const { error: updateError } = await supabase
        .from("race_to_100_horses")
        .update({
          silks_url: publicUrlData.publicUrl,
        })
        .eq("id", horse.id);

      if (updateError) throw updateError;

      setHorses((current) =>
        current.map((item) =>
          item.id === horse.id
            ? { ...item, silks_url: publicUrlData.publicUrl }
            : item,
        ),
      );

      setRunners((current) =>
        current.map((runner) =>
          runner.horse.id === horse.id
            ? {
                ...runner,
                horse: {
                  ...runner.horse,
                  silks_url: publicUrlData.publicUrl,
                },
              }
            : runner,
        ),
      );

      setMessage(`Silks saved for ${horse.name}.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not upload the silks image.",
      );
    } finally {
      setUploadingHorseId(null);
    }
  }

  function handleHorseFileInput(
    horse: Horse,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (file) {
      uploadHorseSilks(horse, file);
    }

    event.target.value = "";
  }

  function handleHorseDrop(
    horse: Horse,
    event: DragEvent<HTMLLabelElement>,
  ) {
    event.preventDefault();

    const file = event.dataTransfer.files?.[0];

    if (file) {
      uploadHorseSilks(horse, file);
    }
  }

  if (loadingPage) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
            Loading Race to 100 admin...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-400">
            Racecourse Fantasy Admin
          </p>

          <h1 className="mt-1 text-3xl font-black sm:text-4xl">
            Race to 100
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Manage race fields and runner silks for the Race to 100 game.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm font-semibold text-red-200">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm font-semibold text-emerald-200">
            {message}
          </div>
        )}

        <section className="mb-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-400">
                  Race Manager
                </div>

                <h2 className="mt-1 text-xl font-black">
                  Choose a Race
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Pick the historical race whose field you want to manage.
                </p>
              </div>

              <div className="text-sm font-bold text-slate-500">
                {filteredRaces.length} of {races.length} races
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                type="text"
                value={raceSearch}
                onChange={(event) => setRaceSearch(event.target.value)}
                placeholder="Search race, track, distance or grade..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-400"
              />

              <button
                type="button"
                onClick={() => {
                  setRaceSearch("");
                  setRaceYear("all");
                }}
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-black text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                CLEAR FILTERS
              </button>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setRaceYear("all")}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-black transition ${
                  raceYear === "all"
                    ? "bg-amber-400 text-slate-950"
                    : "border border-slate-700 bg-slate-950 text-slate-400 hover:text-white"
                }`}
              >
                ALL YEARS
              </button>

              {raceYears.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setRaceYear(String(year))}
                  className={`shrink-0 rounded-lg px-3 py-2 text-xs font-black transition ${
                    raceYear === String(year)
                      ? "bg-amber-400 text-slate-950"
                      : "border border-slate-700 bg-slate-950 text-slate-400 hover:text-white"
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[430px] overflow-y-auto p-4">
            {filteredRaces.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 px-4 py-12 text-center">
                <div className="font-bold text-slate-300">
                  No races found
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  Try changing the year or search.
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredRaces.map((race) => {
                  const active = race.id === selectedRaceId;
                  const distanceBand = raceDistanceBand(race.distance);

                  return (
                    <button
                      key={race.id}
                      type="button"
                      onClick={() => {
                        setSelectedRaceId(race.id);
                        setMessage(null);
                        setError(null);
                      }}
                      className={`rounded-xl border p-4 text-left transition ${
                        active
                          ? "border-amber-400 bg-amber-400/10 ring-1 ring-amber-400/30"
                          : "border-slate-800 bg-slate-950 hover:border-slate-600"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div
                            className={`text-xs font-black uppercase tracking-wide ${
                              active ? "text-amber-400" : "text-slate-500"
                            }`}
                          >
                            {race.year}
                          </div>

                          <div className="mt-1 line-clamp-2 font-black text-white">
                            {race.race_name}
                          </div>
                        </div>

                        {active && (
                          <div className="shrink-0 rounded-md bg-amber-400 px-2 py-1 text-[10px] font-black text-slate-950">
                            SELECTED
                          </div>
                        )}
                      </div>

                      <div className="mt-3 text-sm font-semibold text-slate-400">
                        {race.track}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-bold text-slate-300">
                          {race.distance}m
                        </span>

                        <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-bold text-slate-300">
                          {distanceBand}
                        </span>

                        {race.race_grade && (
                          <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-bold text-slate-300">
                            {race.race_grade}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedRace && (
            <div className="border-t border-amber-400/20 bg-amber-400/5 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-400">
                    Managing
                  </div>

                  <div className="mt-1 font-black text-white">
                    {selectedRace.year} {selectedRace.race_name}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-300">
                  <span>{selectedRace.track}</span>
                  <span className="text-slate-600">•</span>
                  <span>{selectedRace.distance}m</span>
                  {selectedRace.race_grade && (
                    <>
                      <span className="text-slate-600">•</span>
                      <span>{selectedRace.race_grade}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 p-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">Current Field</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Horses currently assigned to this race.
                  </p>
                </div>

                <div className="text-sm font-black text-slate-400">
                  {runners.length} runners
                </div>
              </div>
            </div>

            <div className="p-4">
              {!selectedRaceId ? (
                <div className="rounded-xl border border-dashed border-slate-700 px-4 py-12 text-center">
                  <div className="font-bold text-slate-300">
                    Choose a race above
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    Its current field will appear here.
                  </div>
                </div>
              ) : loadingRunners ? (
                <div className="py-12 text-center text-sm font-semibold text-slate-500">
                  Loading runners...
                </div>
              ) : runners.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 px-4 py-12 text-center">
                  <div className="font-bold text-slate-300">
                    No runners added yet
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    Add horses from the list on the right.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {runners.map((runner) => (
                    <div
                      key={runner.id}
                      className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-lg font-black">
                            {runner.horse.name}
                          </div>

                          <div className="mt-1 text-xs font-semibold text-slate-500">
                            {horseCategories(runner.horse)}
                          </div>
                        </div>

                        <div className="shrink-0 rounded-lg border border-slate-800 px-3 py-2 text-center">
                          <div className="text-lg font-black">
                            {runner.horse.rating}
                          </div>
                          <div className="text-[9px] font-bold uppercase text-slate-500">
                            Rating
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={workingHorseId === runner.horse.id}
                          onClick={() => removeRunner(runner)}
                          className="shrink-0 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-black text-red-300 transition hover:bg-red-950/30 disabled:opacity-50"
                        >
                          REMOVE
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 p-5">
              <h2 className="text-xl font-black">Add Horses</h2>

              <p className="mt-1 text-sm text-slate-500">
                Upload a horse's permanent silks here, then add the horse to the selected historical race.
              </p>

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search horse name, category or rating..."
                className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-400"
              />
            </div>

            <div className="max-h-[720px] overflow-y-auto p-4">
              {!selectedRaceId ? (
                <div className="rounded-xl border border-dashed border-slate-700 px-4 py-12 text-center">
                  <div className="font-bold text-slate-300">
                    Choose a race above
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    Then add horses to its field.
                  </div>
                </div>
              ) : filteredAvailableHorses.length === 0 ? (
                <div className="py-12 text-center text-sm font-semibold text-slate-500">
                  No available horses match your search.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAvailableHorses.map((horse) => (
                    <div
                      key={horse.id}
                      className="rounded-xl border border-slate-800 bg-slate-950 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <label
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => handleHorseDrop(horse, event)}
                          className="group flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-700 bg-slate-900 transition hover:border-amber-400"
                          title="Drop silks here or click to upload"
                        >
                          {uploadingHorseId === horse.id ? (
                            <span className="px-1 text-center text-[9px] font-black uppercase text-slate-500">
                              Uploading
                            </span>
                          ) : horse.silks_url ? (
                            <img
                              src={horse.silks_url}
                              alt={`${horse.name} silks`}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <span className="px-1 text-center text-[9px] font-black uppercase leading-3 text-slate-500 group-hover:text-amber-400">
                              Drop Silks
                            </span>
                          )}

                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingHorseId === horse.id}
                            onChange={(event) =>
                              handleHorseFileInput(horse, event)
                            }
                          />
                        </label>

                        <div className="min-w-0 flex-1">
                          <div className="truncate font-black">{horse.name}</div>

                          <div className="mt-1 text-xs font-semibold text-slate-500">
                            {horseCategories(horse)}
                          </div>

                          <div className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                            {horse.silks_url ? "Silks saved" : "Drop or click to add silks"}
                          </div>
                        </div>

                        <div className="shrink-0 text-center">
                          <div className="text-lg font-black">{horse.rating}</div>
                          <div className="text-[9px] font-bold uppercase text-slate-500">
                            Rating
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={
                            !selectedRaceId ||
                            workingHorseId === horse.id ||
                            uploadingHorseId === horse.id
                          }
                          onClick={() => addHorse(horse)}
                          className="shrink-0 rounded-lg bg-amber-400 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {workingHorseId === horse.id ? "ADDING..." : "ADD"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
