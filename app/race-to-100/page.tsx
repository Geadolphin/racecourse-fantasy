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
  finishing_position: number | null;
};

type Runner = RunnerRow & {
  horse: Horse;
  source_race_name: string;
  source_race_year: number;
  source_race_grade: string | null;
};

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

function hiddenFinishBonus(
  finishingPosition: number | null,
  raceGrade: string | null
) {
  if (!finishingPosition || !raceGrade) return 0;

  const normalizedGrade = raceGrade.trim().toUpperCase();

  const isGroup1 =
    normalizedGrade === "G1" ||
    normalizedGrade === "GROUP 1" ||
    normalizedGrade === "GROUP1";

  const isGroup2 =
    normalizedGrade === "G2" ||
    normalizedGrade === "GROUP 2" ||
    normalizedGrade === "GROUP2";

  const isGroup3 =
    normalizedGrade === "G3" ||
    normalizedGrade === "GROUP 3" ||
    normalizedGrade === "GROUP3";

  if (isGroup1) {
    if (finishingPosition === 1) return 3;
    if (finishingPosition === 2) return 2;
    if (finishingPosition === 3) return 1;
    return 0;
  }

  if (isGroup2) {
    if (finishingPosition === 1) return 2;
    if (finishingPosition === 2) return 1;
    return 0;
  }

  if (isGroup3) {
    if (finishingPosition === 1) return 1;
    return 0;
  }

  return 0;
}

function hiddenAdjustedRating(runner: Runner) {
  const baseRating = runner.horse.rating;

  // Horses rated 97+ receive no finishing bonus.
  if (baseRating >= 97) {
    return baseRating;
  }

  const bonus = hiddenFinishBonus(
    runner.finishing_position,
    runner.source_race_grade
  );

  // Finishing bonuses cannot increase a horse above 97.
  return Math.min(97, baseRating + bonus);
}

export default function RaceTo100Page() {
  const [started, setStarted] = useState(false);
  const [hardMode, setHardMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentRace, setCurrentRace] = useState<Race | null>(null);
  const [spinningRace, setSpinningRace] = useState<Race | null>(null);
  const [currentRunners, setCurrentRunners] = useState<Runner[]>([]);
  const [usedRaceIds, setUsedRaceIds] = useState<string[]>([]);
  const [selectedHorses, setSelectedHorses] = useState<Runner[]>([]);
  const [manualLineup, setManualLineup] = useState<Map<SlotName, Runner>>(
    () => new Map()
  );
  const [movingHorseId, setMovingHorseId] = useState<string | null>(null);
  const [respinAvailable, setRespinAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

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
        (total, runner) =>
          total + challengePoints(hiddenAdjustedRating(runner)),
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

  function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function animateRaceSpin(races: Race[], finalRace: Race) {
    const animationPool = races.length ? races : [finalRace];

    // Rapidly cycle through races, then progressively slow down.
    const delays = [
      70, 70, 80, 80, 90, 100, 110, 120, 135, 150,
      170, 190, 220, 250, 290, 340, 400,
    ];

    let previousId: string | null = null;

    for (const delay of delays) {
      const choices = animationPool.filter((race) => race.id !== previousId);
      const pool = choices.length ? choices : animationPool;
      const race = pool[Math.floor(Math.random() * pool.length)];

      setSpinningRace(race);
      previousId = race.id;
      await wait(delay);
    }

    // Finish by visibly landing on the race that was actually selected.
    setSpinningRace(finalRace);
    await wait(550);
  }

  async function getRandomRace() {
    setLoading(true);
    setError(null);
    setSpinningRace(null);

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
          .select("id,race_id,horse_id,finishing_position")
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
            return horse
              ? {
                  ...row,
                  horse,
                  source_race_name: race.race_name,
                  source_race_year: race.year,
                  source_race_grade: race.race_grade,
                }
              : null;
          })
          .filter((runner): runner is Runner => runner !== null)
          .sort((a, b) => b.horse.rating - a.horse.rating);

        const hasAvailableHorse = combined.some((runner) =>
          canSelectRunner(runner)
        );

        if (!hasAvailableHorse) continue;

        await animateRaceSpin(available, race);

        setCurrentRace(race);
        setCurrentRunners(combined);
        setUsedRaceIds((previous) => [...previous, race.id]);
        setSpinningRace(null);
        return;
      }

      throw new Error(
        "No unused race currently contains an available horse."
      );
    } catch (err) {
      setCurrentRace(null);
      setSpinningRace(null);
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

  async function shareTeam() {
    if (!gameComplete) return;

    const lineupLines = slotOrder
      .map((slot) => {
        const runner = selectedLineup.get(slot);
        return runner
          ? `${slot}: ${runner.horse.name} (${runner.horse.rating})`
          : `${slot}: —`;
      })
      .join("\n");

    const shareText = [
      hardMode ? "Race to 100 — HARD MODE" : "Race to 100",
      `Challenge Score: ${finalChallengeScore}/100`,
      `Team Rating: ${finalTeamRating?.toFixed(1) ?? "—"}`,
      "",
      lineupLines,
    ].join("\n");

    const shareUrl = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "My Race to 100 Team",
          text: shareText,
          url: shareUrl,
        });
        setShareMessage(null);
        return;
      }

      await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
      setShareMessage("Team copied to clipboard.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;

      try {
        await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
        setShareMessage("Team copied to clipboard.");
      } catch {
        setShareMessage("Could not share this team on this browser.");
      }
    }
  }

  function restartGame() {
    setCurrentRace(null);
    setSpinningRace(null);
    setCurrentRunners([]);
    setUsedRaceIds([]);
    setSelectedHorses([]);
    setManualLineup(new Map());
    setMovingHorseId(null);
    setRespinAvailable(true);
    setError(null);
    setShareMessage(null);
    setHardMode(false);
    setStarted(false);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-8">
        {!started ? (
          <section className="mx-auto max-w-5xl py-4 sm:py-16">
            <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
              <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="p-5 sm:p-10 lg:p-12">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
                    Racecourse Fantasy
                  </p>

                  <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-7xl">
                    Race to 100
                  </h1>

                  <p className="mt-4 max-w-xl text-lg font-bold leading-7 text-slate-200 sm:mt-5 sm:text-2xl sm:leading-8">
                    Spin a real race. Draft one horse. Build the best 10-horse team you can.
                  </p>

                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:mt-5 sm:text-lg sm:leading-7">
                    Every spin gives you a random historical Australian race. You must take
                    one horse from the field and fit it into your team. Once you reach 10,
                    your hidden Challenge Score is revealed.
                  </p>

                  <div className="mt-6 sm:mt-8">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Choose mode
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 sm:max-w-md">
                      <button
                        type="button"
                        onClick={() => setHardMode(false)}
                        className={`min-h-[72px] rounded-xl border px-3 py-3 text-left transition ${
                          !hardMode
                            ? "border-amber-400 bg-amber-400/10"
                            : "border-slate-700 bg-slate-950 hover:border-slate-600"
                        }`}
                      >
                        <div className={`text-sm font-black ${!hardMode ? "text-amber-400" : "text-white"}`}>
                          NORMAL
                        </div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">
                          Ratings visible
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setHardMode(true)}
                        className={`min-h-[72px] rounded-xl border px-3 py-3 text-left transition ${
                          hardMode
                            ? "border-amber-400 bg-amber-400/10"
                            : "border-slate-700 bg-slate-950 hover:border-slate-600"
                        }`}
                      >
                        <div className={`text-sm font-black ${hardMode ? "text-amber-400" : "text-white"}`}>
                          HARD MODE
                        </div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">
                          Ratings hidden until the end
                        </div>
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStarted(true)}
                    className="mt-5 w-full rounded-xl bg-amber-400 px-6 py-4 text-base font-black text-slate-950 transition hover:bg-amber-300 sm:w-auto sm:px-8 sm:text-lg"
                  >
                    SPIN YOUR FIRST RACE
                  </button>

                  <div className="mt-6 grid grid-cols-3 gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-400 sm:mt-8 sm:flex sm:flex-wrap sm:text-xs">
                    <span className="flex min-h-[38px] items-center justify-center rounded-full border border-slate-700 bg-slate-950 px-2 py-2 text-center leading-tight sm:min-h-0 sm:px-3">
                      10 horses
                    </span>
                    <span className="flex min-h-[38px] items-center justify-center rounded-full border border-slate-700 bg-slate-950 px-2 py-2 text-center leading-tight sm:min-h-0 sm:px-3">
                      1 respin
                    </span>
                    <span className="flex min-h-[38px] items-center justify-center rounded-full border border-slate-700 bg-slate-950 px-2 py-2 text-center leading-tight sm:min-h-0 sm:px-3">
                      100 point target
                    </span>
                  </div>

                  <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3">
                    <div className="text-xs font-black uppercase tracking-[0.14em] text-amber-400">
                      Hidden placement bonus
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      Horses that placed highly in the race you spin can earn bonus Challenge Points.
                      The bonus stays hidden while you build your team.
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-800 bg-slate-950/50 p-5 sm:p-8 lg:border-l lg:border-t-0">
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
                    Build your team
                  </div>

                  <div className="mt-4 space-y-3">
                    {[
                      ["Sprinters", "3", "1000–1400m"],
                      ["Middle Distance", "3", "1500–2200m"],
                      ["Stayers", "3", "2300m+"],
                      ["Wildcard", "1", "Any horse"],
                    ].map(([label, count, detail]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900 px-4 py-4"
                      >
                        <div>
                          <div className="font-black text-white">{label}</div>
                          <div className="mt-0.5 text-xs font-semibold text-slate-500">
                            {detail}
                          </div>
                        </div>

                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 text-lg font-black text-slate-950">
                          {count}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-400">
                      The challenge
                    </div>
                    <div className="mt-2 text-3xl font-black text-white">Reach 100</div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Horse ratings convert into Challenge Points. Your score stays hidden
                      until all 10 positions are filled.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </section>
        ) : (
          <section>
            <div className="mb-5 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
                  Racecourse Fantasy
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black sm:text-4xl">Race to 100</h1>
                  {hardMode && (
                    <span className="inline-flex items-center justify-center rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-400">
                      Hard Mode
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-400">
                  {hardMode
                    ? "Ratings are hidden until your team is complete."
                    : "Spin a race. Pick a horse. Build your ten."}
                </p>
              </div>

              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 sm:min-w-[110px] sm:px-4 sm:py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Horses
                  </div>
                  <div className="mt-1 text-xl font-black">
                    {selectedHorses.length} / 10
                  </div>
                </div>

                {(!hardMode || gameComplete) && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 sm:min-w-[130px] sm:px-4 sm:py-3">
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
                )}

                {gameComplete && (
                  <div className="col-span-2 rounded-xl border border-amber-400/30 bg-slate-900 px-3 py-2.5 sm:col-span-1 sm:min-w-[130px] sm:px-4 sm:py-3">
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
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-black text-slate-300 transition hover:border-amber-400 hover:text-white sm:w-auto"
              >
                RESTART
              </button>
            </div>

            {error && (
              <div className="mb-5 rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm font-semibold text-red-200">
                {error}
              </div>
            )}

            <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)]">
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

              <div className="rounded-2xl border border-slate-800 bg-slate-900 px-2 py-4 sm:px-5 sm:py-6">
                <div className="flex flex-col gap-5 sm:gap-6">
                  {formationRows.map((row, rowIndex) => (
                    <div
                      key={row.label}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-[96px_minmax(0,1fr)] sm:items-center sm:gap-4"
                    >
                      <div className="px-1 text-left text-[10px] font-black uppercase tracking-wide text-slate-500 sm:px-0 sm:text-right sm:text-sm">
                        {row.label}
                      </div>

                      <div
                        className={`grid items-start justify-items-stretch gap-2 sm:justify-items-center sm:gap-3 ${
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
                              className={`flex min-h-[94px] w-full max-w-none flex-col items-center justify-start rounded-xl p-1 text-center transition sm:min-h-[118px] sm:max-w-[170px] sm:p-1.5 ${
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
                                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden sm:h-20 sm:w-20">
                                    {selectedRunner.horse.silks_url ? (
                                      <img
                                        src={selectedRunner.horse.silks_url}
                                        alt={`${selectedRunner.horse.name} silks`}
                                        className="h-auto w-auto max-h-full max-w-full object-contain"
                                        draggable={false}
                                        style={{
                                          imageRendering: "auto",
                                          transform: "translateZ(0)",
                                        }}
                                      />
                                    ) : (
                                      <div className="h-16 w-16 rounded-xl border border-dashed border-slate-700 sm:h-20 sm:w-20" />
                                    )}
                                  </div>

                                  <div className="mt-1 max-w-full truncate px-1 text-[11px] font-black text-white sm:text-sm">
                                    {selectedRunner.horse.name}
                                  </div>
                                  {(!hardMode || gameComplete) && (
                                    <div className="mt-0.5 text-[11px] font-bold text-slate-500 sm:text-xs">
                                      Rating {selectedRunner.horse.rating}
                                    </div>
                                  )}


                                </>
                              ) : (
                                <>
                                  <div className="h-14 w-14 rounded-xl border border-dashed border-slate-800 bg-slate-950/40 sm:h-20 sm:w-20" />
                                  <div className="mt-1 text-xs font-bold text-slate-700">
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
                    {hardMode ? "Hard Mode · Final Result" : "Final Result"}
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

                  <div className="mt-6 text-left">
                    <div className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      Your 10 Horses
                    </div>

                    <div className="space-y-2">
                      {slotOrder.map((slot) => {
                        const runner = selectedLineup.get(slot);

                        if (!runner) return null;

                        return (
                          <div
                            key={slot}
                            className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[10px] font-black uppercase tracking-wide text-slate-600">
                                  {slot}
                                </div>

                                <div className="mt-1 font-black text-white">
                                  {runner.horse.name}
                                </div>

                                <div className="mt-1 text-xs font-semibold text-slate-500">
                                  {runner.source_race_year} {runner.source_race_name}
                                  {runner.source_race_grade
                                    ? ` · ${runner.source_race_grade}`
                                    : ""}
                                </div>
                              </div>

                              <div className="shrink-0 rounded-lg border border-slate-800 px-3 py-2 text-center">
                                <div className="text-base font-black">
                                  {runner.horse.rating}
                                </div>
                                <div className="text-[9px] font-bold uppercase text-slate-500">
                                  Rating
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={shareTeam}
                    className="mt-6 rounded-xl bg-amber-400 px-8 py-3 text-base font-black text-slate-950 transition hover:bg-amber-300"
                  >
                    SHARE TEAM
                  </button>

                  {shareMessage && (
                    <div className="mt-3 text-sm font-semibold text-slate-400">
                      {shareMessage}
                    </div>
                  )}
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-5 text-center sm:p-6">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                    Race {selectedHorses.length + 1} of 10
                  </div>

                  {loading ? (
                    <div className="py-4">
                      <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
                        Spinning...
                      </div>

                      <div className="mx-auto mt-4 flex min-h-[112px] max-w-xl items-center justify-center overflow-hidden rounded-2xl border border-amber-400/30 bg-slate-950 px-5 py-6">
                        <div
                          key={spinningRace?.id ?? "starting-spin"}
                          className="w-full animate-pulse"
                        >
                          <div className="text-2xl font-black sm:text-3xl">
                            {spinningRace?.race_name ?? "Selecting a race..."}
                          </div>

                          {spinningRace && (
                            <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-400">
                              <span>{spinningRace.year}</span>
                              <span>{spinningRace.track}</span>
                              <span>{spinningRace.distance}m</span>
                              {spinningRace.race_grade && (
                                <span>{spinningRace.race_grade}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 text-sm font-semibold text-slate-500">
                        Finding your race...
                      </div>
                    </div>
                  ) : (
                    <>
                      <h2 className="mt-3 text-2xl font-black">
                        {selectedHorses.length
                          ? "Spin your next race"
                          : "Spin your first race"}
                      </h2>

                      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">
                        The race wheel will cycle through historical races before landing on your draw.
                      </p>

                      <button
                        type="button"
                        onClick={getRandomRace}
                        className="mt-5 rounded-xl bg-amber-400 px-8 py-3 text-lg font-black text-slate-950 transition hover:bg-amber-300"
                      >
                        SPIN
                      </button>

                      <div className="mt-4 text-sm font-semibold text-slate-500">
                        Respin available: {respinAvailable ? 1 : 0}
                      </div>
                    </>
                  )}
                </div>
              )
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                <div className="flex flex-col gap-3 border-b border-slate-800 p-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:p-4">
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
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold transition hover:border-amber-400 disabled:opacity-40 sm:w-auto sm:py-2"
                  >
                    RESPIN
                  </button>
                </div>

                <div className="p-3 sm:p-4">
                  <h3 className="text-base font-black sm:text-lg">Select one horse</h3>
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    {(hardMode
                      ? [...currentRunners].sort((a, b) =>
                          a.horse.name.localeCompare(b.horse.name)
                        )
                      : currentRunners
                    ).map((runner) => {
                      const alreadySelected = selectedSet.has(runner.horse.id);
                    const selectableNow = canSelectRunner(runner);
                    const unavailableNow = !alreadySelected && !selectableNow;
                      const labels = classificationLabels(runner.horse);
                      return (
                        <div
                          key={runner.id}
                          className={`rounded-xl border border-slate-800 bg-slate-950 p-2.5 sm:p-3 ${
                            alreadySelected ? "opacity-50" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2.5 sm:gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-slate-900 sm:h-12 sm:w-12">
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
                              {!hardMode && (
                                <div className="min-w-[46px] text-right">
                                  <div className="text-lg font-black sm:text-xl">
                                    {runner.horse.rating}
                                  </div>
                                  <div className="text-[10px] font-bold uppercase text-slate-500">
                                    Rating
                                  </div>
                                </div>
                              )}

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
                                      "That horse does not currently have an empty eligible position. Rearrange your team by clicking a selected horse first."
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
                                className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-400 text-lg font-black text-slate-950 transition hover:bg-amber-300 disabled:bg-slate-800 disabled:text-slate-500 sm:h-8 sm:w-8"
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
