"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const formationRows = [
  {
    label: "Sprinters",
    positions: ["Sprinter 1", "Sprinter 2", "Sprinter 3"],
  },
  {
    label: "Middle Distance",
    positions: ["Middle Distance 1", "Middle Distance 2", "Middle Distance 3"],
  },
  {
    label: "Stayers",
    positions: ["Stayer 1", "Stayer 2", "Stayer 3"],
  },
  {
    label: "Wildcard",
    positions: ["Wildcard"],
  },
] as const;

const slotOrder = [
  "Sprinter 1",
  "Sprinter 2",
  "Sprinter 3",
  "Middle Distance 1",
  "Middle Distance 2",
  "Middle Distance 3",
  "Stayer 1",
  "Stayer 2",
  "Stayer 3",
  "Wildcard",
] as const;

type SlotName = (typeof slotOrder)[number];

function canHorseFillSlot(horse: Horse, slot: SlotName) {
  if (slot === "Wildcard") return true;
  if (slot.startsWith("Sprinter")) return horse.sprinter;
  if (slot.startsWith("Middle Distance")) return horse.middle_distance;
  if (slot.startsWith("Stayer")) return horse.stayer;
  return false;
}

function solveSelectedTeam(selected: Runner[]) {
  const lineup = new Map<SlotName, Runner>();
  const used = new Set<SlotName>();

  const ordered = [...selected].sort((a, b) => {
    const aOptions = slotOrder.filter((slot) =>
      canHorseFillSlot(a.horse, slot)
    ).length;

    const bOptions = slotOrder.filter((slot) =>
      canHorseFillSlot(b.horse, slot)
    ).length;

    return aOptions - bOptions;
  });

  function backtrack(index: number): boolean {
    if (index === ordered.length) return true;

    const runner = ordered[index];

    for (const slot of slotOrder) {
      if (used.has(slot)) continue;
      if (!canHorseFillSlot(runner.horse, slot)) continue;

      used.add(slot);
      lineup.set(slot, runner);

      if (backtrack(index + 1)) return true;

      used.delete(slot);
      lineup.delete(slot);
    }

    return false;
  }

  return backtrack(0) ? lineup : null;
}

type Horse = {
  id: string;
  name: string;
  rating: number;
  sprinter: boolean;
  middle_distance: boolean;
  stayer: boolean;
  silks_url: string | null;
};

type Race = {
  id: string;
  race_name: string;
  year: number;
  track: string;
  distance: number;
  race_grade: string | null;
};

type RunnerRow = {
  id: number;
  race_id: string;
  horse_id: string;
};

type Runner = RunnerRow & { horse: Horse };

function classificationLabels(horse: Horse) {
  const labels: string[] = [];
  if (horse.sprinter) labels.push("Sprinter");
  if (horse.middle_distance) labels.push("Middle Distance");
  if (horse.stayer) labels.push("Stayer");
  return labels;
}

function challengePoints(rating: number) {
  if (rating >= 100) return 15;
  if (rating === 99) return 14;
  if (rating === 98) return 13;
  if (rating === 97) return 12;
  if (rating === 96) return 11;
  if (rating === 95) return 10;
  if (rating === 94) return 9;
  if (rating === 93) return 8;
  if (rating >= 90) return 7;
  if (rating >= 87) return 6;
  if (rating >= 83) return 5;
  if (rating >= 80) return 4;
  if (rating >= 75) return 3;
  if (rating >= 70) return 2;
  if (rating >= 65) return 1;
  return 0;
}

export default function RaceTo100Page() {
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentRace, setCurrentRace] = useState<Race | null>(null);
  const [currentRunners, setCurrentRunners] = useState<Runner[]>([]);
  const [usedRaceIds, setUsedRaceIds] = useState<string[]>([]);
  const [selectedHorses, setSelectedHorses] = useState<Runner[]>([]);
  const [manualLineup, setManualLineup] = useState<Map<SlotName, Runner>>(
    () => new Map()
  );
  const [movingHorseId, setMovingHorseId] = useState<string | null>(null);
  const [respinAvailable, setRespinAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedSet = useMemo(
    () => new Set(selectedHorses.map((runner) => runner.horse.id)),
    [selectedHorses]
  );

  const selectedLineup = useMemo(
    () => manualLineup,
    [manualLineup]
  );

  const gameComplete = selectedHorses.length === 10;

  const finalChallengeScore = useMemo(
    () =>
      selectedHorses.reduce(
        (total, runner) => total + challengePoints(runner.horse.rating),
        0
      ),
    [selectedHorses]
  );

  const finalTeamRating = useMemo(() => {
    if (!gameComplete) return null;

    const total = selectedHorses.reduce(
      (sum, runner) => sum + runner.horse.rating,
      0
    );

    return total / selectedHorses.length;
  }, [gameComplete, selectedHorses]);

  function moveHorseToSlot(targetSlot: SlotName) {
    if (!movingHorseId || !selectedLineup) return;

    const sourceEntry = Array.from(selectedLineup.entries()).find(
      ([, runner]) => runner.horse.id === movingHorseId
    );

    if (!sourceEntry) {
      setMovingHorseId(null);
      return;
    }

    const [sourceSlot, movingRunner] = sourceEntry;
    if (sourceSlot === targetSlot) {
      setMovingHorseId(null);
      return;
    }

    if (!canHorseFillSlot(movingRunner.horse, targetSlot)) return;

    const targetRunner = selectedLineup.get(targetSlot) ?? null;

    // If the target is occupied, the two horses swap places.
    if (
      targetRunner &&
      !canHorseFillSlot(targetRunner.horse, sourceSlot)
    ) {
      return;
    }

    const next = new Map(selectedLineup);
    next.delete(sourceSlot);

    if (targetRunner) {
      next.set(sourceSlot, targetRunner);
    }

    next.set(targetSlot, movingRunner);
    setManualLineup(next);
    setMovingHorseId(null);
    setError(null);
  }

  function canSelectRunner(runner: Runner) {
    if (selectedSet.has(runner.horse.id)) return false;

    return slotOrder.some(
      (slot) =>
        !manualLineup.has(slot) &&
        canHorseFillSlot(runner.horse, slot)
    );
  }

  async function getRandomRace() {
    setLoading(true);
    setError(null);

    try {
      const { data: races, error: raceError } = await supabase
        .from("race_to_100_races")
        .select("id,race_name,year,track,distance,race_grade");

      if (raceError) throw raceError;

      const available = ((races ?? []) as Race[]).filter(
        (race) => !usedRaceIds.includes(race.id)
      );

      if (!available.length) {
        throw new Error("There are no unused races remaining.");
      }

      // Shuffle the unused races so we can skip any race with no usable runners.
      const shuffled = [...available].sort(() => Math.random() - 0.5);

      for (const race of shuffled) {
        const { data: runnerRows, error: runnerError } = await supabase
          .from("race_to_100_runners")
          .select("id,race_id,horse_id")
          .eq("race_id", race.id);

        if (runnerError) throw runnerError;

        const rows = (runnerRows ?? []) as RunnerRow[];
        if (!rows.length) continue;

        const horseIds = rows.map((row) => row.horse_id);

        const { data: horses, error: horseError } = await supabase
          .from("race_to_100_horses")
          .select("id,name,rating,sprinter,middle_distance,stayer,silks_url")
          .in("id", horseIds);

        if (horseError) throw horseError;

        const horseMap = new Map(
          ((horses ?? []) as Horse[]).map((horse) => [horse.id, horse])
        );

        const combined: Runner[] = rows
          .map((row) => {
            const horse = horseMap.get(row.horse_id);
            return horse ? { ...row, horse } : null;
          })
          .filter((runner): runner is Runner => runner !== null)
          .sort((a, b) => b.horse.rating - a.horse.rating);

        const hasAvailableHorse = combined.some((runner) =>
          canSelectRunner(runner)
        );

        if (!hasAvailableHorse) continue;

        setCurrentRace(race);
        setCurrentRunners(combined);
        setUsedRaceIds((previous) => [...previous, race.id]);
        return;
      }

      throw new Error(
        "No unused race currently contains an available horse."
      );
    } catch (err) {
      setCurrentRace(null);
      setCurrentRunners([]);
      setError(
        err instanceof Error ? err.message : "Could not generate a race."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRespin() {
    if (!respinAvailable || !currentRace || loading) return;
    setRespinAvailable(false);
    setCurrentRace(null);
    setCurrentRunners([]);
    await getRandomRace();
  }

  function restartGame() {
    setCurrentRace(null);
    setCurrentRunners([]);
    setUsedRaceIds([]);
    setSelectedHorses([]);
    setManualLineup(new Map());
    setMovingHorseId(null);
    setRespinAvailable(true);
    setError(null);
    setStarted(false);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {!started ? (
          <section className="mx-auto max-w-2xl py-20 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
              Racecourse Fantasy
            </p>

            <h1 className="text-4xl font-black sm:text-6xl">Race to 100</h1>

            <p className="mt-4 text-xl font-semibold text-slate-200">
              Spin a race. Pick a horse. Build your ten.
            </p>

            <p className="mt-5 text-base leading-7 text-slate-400 sm:text-lg">
              Build a team of 10 horses from randomly generated historical
              Australian races and try to reach 100 Challenge Points.
            </p>

            <div className="mt-10 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-left">
              {[
                ["Team size", "10 horses"],
                ["Sprinters", "3"],
                ["Middle Distance", "3"],
                ["Stayers", "3"],
                ["Wildcard", "1"],
                ["Challenge target", "100 points"],
                ["Respin", "1 per game"],
                ["Login required", "No"],
              ].map(([label, value], index, all) => (
                <div
                  key={label}
                  className={`flex items-center justify-between gap-4 px-5 py-4 ${
                    index < all.length - 1 ? "border-b border-slate-800" : ""
                  }`}
                >
                  <span className="text-slate-400">{label}</span>
                  <strong
                    className={
                      label === "Challenge target" ? "text-amber-400" : ""
                    }
                  >
                    {value}
                  </strong>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-left">
              <div className="text-sm font-bold uppercase tracking-wide text-slate-300">
                How it works
              </div>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-400 sm:text-base">
                <p>1. Generate a random historical Australian race.</p>
                <p>2. Select one horse from the field.</p>
                <p>3. Assign it to Sprinter, Middle Distance, Stayer or Wildcard.</p>
                <p>4. Horses with multiple classifications can fill any category they are eligible for.</p>
                <p>5. Rearrange your team throughout the game as new horses are selected.</p>
                <p>6. Reach 100 Challenge Points to join the <strong className="text-white">100 Club</strong>.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStarted(true)}
              className="mt-8 rounded-xl bg-amber-400 px-10 py-4 text-lg font-black text-slate-950 transition hover:bg-amber-300"
            >
              START RACE TO 100
            </button>
          </section>
        ) : (
          <section>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
                  Racecourse Fantasy
                </p>
                <h1 className="mt-1 text-3xl font-black sm:text-4xl">Race to 100</h1>
                <p className="mt-1 text-sm text-slate-400">
                  Spin a race. Pick a horse. Build your ten.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="min-w-[110px] rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Horses
                  </div>
                  <div className="mt-1 text-xl font-black">
                    {selectedHorses.length} / 10
                  </div>
                </div>

                <div className="min-w-[130px] rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Team Rating
                  </div>
                  <div className="mt-1 text-xl font-black">
                    {selectedHorses.length
                      ? (
                          selectedHorses.reduce(
                            (sum, runner) => sum + runner.horse.rating,
                            0
                          ) / selectedHorses.length
                        ).toFixed(1)
                      : "—"}
                  </div>
                </div>

                {gameComplete && (
                  <div className="min-w-[130px] rounded-xl border border-amber-400/30 bg-slate-900 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-amber-400">
                      Challenge
                    </div>
                    <div className="mt-1 text-xl font-black">
                      {finalChallengeScore} / 100
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={restartGame}
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-black text-slate-300 transition hover:border-amber-400 hover:text-white"
              >
                RESTART
              </button>
            </div>

            {error && (
              <div className="mb-5 rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm font-semibold text-red-200">
                {error}
              </div>
            )}

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)]">
              <div className="min-w-0 lg:sticky lg:top-6">
            <div className="min-w-0">
              <div className="mb-4 flex items-end justify-between gap-4">
                <h2 className="text-xl font-black">Your Team</h2>

                <div className="text-sm font-semibold text-slate-500">
                  {selectedHorses.length} / 10
                </div>
              </div>

              <div className="mb-3 text-xs font-semibold text-slate-500">
                {movingHorseId
                  ? "Click a highlighted position to move the horse, or click the horse again to cancel."
                  : selectedHorses.length > 0
                  ? "Click a horse to change its position."
                  : ""}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 px-3 py-6 sm:px-5 sm:py-8">
                <div className="flex flex-col gap-8 sm:gap-10">
                  {formationRows.map((row, rowIndex) => (
                    <div
                      key={row.label}
                      className="grid grid-cols-[78px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-5"
                    >
                      <div className="text-right text-[11px] font-black uppercase tracking-wide text-slate-500 sm:text-sm">
                        {row.label}
                      </div>

                      <div
                        className={`grid items-start justify-items-center gap-4 ${
                          row.positions.length === 1
                            ? "grid-cols-1"
                            : "grid-cols-3"
                        }`}
                      >
                        {row.positions.map((position) => {
                          const selectedRunner =
                            selectedLineup?.get(position as SlotName) ?? null;

                          const movingRunner = movingHorseId
                            ? selectedHorses.find(
                                (runner) => runner.horse.id === movingHorseId
                              ) ?? null
                            : null;

                          const sourceEntry =
                            movingHorseId && selectedLineup
                              ? Array.from(selectedLineup.entries()).find(
                                  ([, runner]) =>
                                    runner.horse.id === movingHorseId
                                )
                              : null;

                          const sourceSlot = sourceEntry?.[0] ?? null;
                          const targetRunner = selectedRunner;

                          const canMoveHere =
                            !!movingRunner &&
                            !!sourceSlot &&
                            (position as SlotName) !== sourceSlot &&
                            canHorseFillSlot(
                              movingRunner.horse,
                              position as SlotName
                            ) &&
                            (!targetRunner ||
                              canHorseFillSlot(
                                targetRunner.horse,
                                sourceSlot
                              ));

                          const isMovingThisHorse =
                            selectedRunner?.horse.id === movingHorseId;

                          return (
                            <div
                              key={position}
                              className={`flex min-h-[128px] w-full max-w-[160px] flex-col items-center justify-start rounded-xl p-2 text-center transition sm:min-h-[148px] sm:max-w-[190px] ${
                                canMoveHere
                                  ? "cursor-pointer border border-amber-400/60 bg-amber-400/5"
                                  : isMovingThisHorse
                                  ? "cursor-pointer border border-amber-400 bg-slate-950/60"
                                  : selectedRunner
                                  ? "cursor-pointer border border-transparent hover:border-slate-700"
                                  : "border border-transparent"
                              }`}
                              onClick={() => {
                                if (canMoveHere) {
                                  moveHorseToSlot(position as SlotName);
                                  return;
                                }

                                if (selectedRunner) {
                                  setMovingHorseId((current) =>
                                    current === selectedRunner.horse.id
                                      ? null
                                      : selectedRunner.horse.id
                                  );
                                }
                              }}
                            >
                              {selectedRunner ? (
                                <>
                                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden sm:h-24 sm:w-24">
                                    {selectedRunner.horse.silks_url ? (
                                      <img
                                        src={selectedRunner.horse.silks_url}
                                        alt={`${selectedRunner.horse.name} silks`}
                                        className="h-full w-full object-contain"
                                      />
                                    ) : (
                                      <div className="h-16 w-16 rounded-xl border border-dashed border-slate-700 sm:h-20 sm:w-20" />
                                    )}
                                  </div>

                                  <div className="mt-2 max-w-full truncate text-xs font-black text-white sm:text-sm">
                                    {selectedRunner.horse.name}
                                  </div>
                                  <div className="mt-1 text-[11px] font-bold text-slate-500 sm:text-xs">
                                    Rating {selectedRunner.horse.rating}
                                  </div>


                                </>
                              ) : (
                                <>
                                  <div className="h-20 w-20 rounded-xl border border-dashed border-slate-800 bg-slate-950/40 sm:h-24 sm:w-24" />
                                  <div className="mt-2 text-xs font-bold text-slate-700">
                                    {canMoveHere ? "Move Here" : "Empty"}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
              </div>

              <div className="min-w-0">
            {!currentRace ? (
              gameComplete ? (
                <div className="rounded-2xl border border-amber-400/30 bg-slate-900 p-5 text-center sm:p-6">
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
                    Final Result
                  </div>

                  <h2 className="mt-3 text-3xl font-black">
                    {finalChallengeScore >= 100 ? "100 CLUB" : "Team Complete"}
                  </h2>

                  <div className="mx-auto mt-8 grid max-w-lg gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-800 bg-slate-950 px-5 py-5">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Team Rating
                      </div>
                      <div className="mt-2 text-3xl font-black">
                        {finalTeamRating?.toFixed(1)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-400/30 bg-slate-950 px-5 py-5">
                      <div className="text-xs font-bold uppercase tracking-wide text-amber-400">
                        Challenge Score
                      </div>
                      <div className="mt-2 text-3xl font-black">
                        {finalChallengeScore}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-center sm:p-6">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                    Race {selectedHorses.length + 1} of 10
                  </div>

                  <h2 className="mt-3 text-2xl font-black">
                    {selectedHorses.length
                      ? "Generate your next race"
                      : "Generate your first race"}
                  </h2>

                  <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">
                    A random historical Australian race will be generated from your Supabase data.
                  </p>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={getRandomRace}
                    className="mt-5 rounded-xl bg-amber-400 px-8 py-3 text-lg font-black text-slate-950 transition hover:bg-amber-300 disabled:opacity-50"
                  >
                    {loading ? "LOADING..." : "SPIN"}
                  </button>

                  <div className="mt-4 text-sm font-semibold text-slate-500">
                    Respin available: {respinAvailable ? 1 : 0}
                  </div>
                </div>
              )
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 p-4">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">
                      Race {selectedHorses.length + 1} of 10
                    </div>
                    <h2 className="mt-1 text-xl font-black sm:text-2xl">
                      {currentRace.race_name}
                    </h2>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-slate-400">
                      <span>{currentRace.year}</span>
                      <span>{currentRace.track}</span>
                      <span>{currentRace.distance}m</span>
                      {currentRace.race_grade && <span>{currentRace.race_grade}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!respinAvailable || loading}
                    onClick={handleRespin}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-bold transition hover:border-amber-400 disabled:opacity-40"
                  >
                    RESPIN
                  </button>
                </div>

                <div className="p-4">
                  <h3 className="text-lg font-black">Select one horse</h3>
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    {currentRunners.map((runner) => {
                      const alreadySelected = selectedSet.has(runner.horse.id);
                    const selectableNow = canSelectRunner(runner);
                    const unavailableNow = !alreadySelected && !selectableNow;
                      const labels = classificationLabels(runner.horse);
                      return (
                        <div
                          key={runner.id}
                          className={`rounded-xl border border-slate-800 bg-slate-950 p-3 ${
                            alreadySelected ? "opacity-50" : ""
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                              {runner.horse.silks_url ? (
                                <img
                                  src={runner.horse.silks_url}
                                  alt={`${runner.horse.name} silks`}
                                  className="h-full w-full object-contain"
                                />
                              ) : (
                                <span className="text-[9px] font-bold uppercase text-slate-600">Silks</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-black">{runner.horse.name}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                {labels.join(" · ")}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <div className="text-right">
                                <div className="text-xl font-black">{runner.horse.rating}</div>
                                <div className="text-[10px] font-bold uppercase text-slate-500">Rating</div>
                              </div>

                              <button
                                type="button"
                                disabled={alreadySelected || unavailableNow}
                                aria-label={
                                  alreadySelected
                                    ? `${runner.horse.name} already selected`
                                    : unavailableNow
                                    ? `${runner.horse.name} has no empty eligible position`
                                    : `Select ${runner.horse.name}`
                                }
                                title={
                                  alreadySelected
                                    ? "Already selected"
                                    : unavailableNow
                                    ? "No empty eligible position"
                                    : "Select horse"
                                }
                                onClick={() => {
                                  const emptyEligibleSlot = slotOrder.find(
                                    (slot) =>
                                      !manualLineup.has(slot) &&
                                      canHorseFillSlot(runner.horse, slot)
                                  );

                                  if (!emptyEligibleSlot) {
                                    setError(
                                      "That horse does not currently have an empty eligible position. Use CHANGE POSITION to rearrange your team first."
                                    );
                                    return;
                                  }

                                  const nextSelected = [...selectedHorses, runner];
                                  const nextLineup = new Map(manualLineup);
                                  nextLineup.set(emptyEligibleSlot, runner);

                                  setSelectedHorses(nextSelected);
                                  setManualLineup(nextLineup);
                                  setMovingHorseId(null);
                                  setCurrentRace(null);
                                  setCurrentRunners([]);
                                  setError(null);
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-lg font-black text-slate-950 transition hover:bg-amber-300 disabled:bg-slate-800 disabled:text-slate-500"
                              >
                                ✓
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
