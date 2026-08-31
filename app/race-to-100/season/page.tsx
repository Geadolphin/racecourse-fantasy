"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Category = "Sprint" | "Middle Distance" | "Stayer";
type Half = "Spring" | "Autumn";

type Horse = {
  id: string;
  name: string;
  rating: number;
  sprinter: boolean;
  middle_distance: boolean;
  stayer: boolean;
  silks_url: string | null;
};

type StableEntry = {
  slot: string;
  horse: Horse;
};

type SeasonRace = {
  id: string;
  half: Half;
  name: string;
  distance: number;
  category: Category;
  fieldSize: number;
  grade: "G1" | "G2" | "G3" | "LR";
};

type RaceRunner = {
  horse: Horse;
  isUser: boolean;
};

type RaceResult = {
  raceId: string;
  raceName: string;
  half: Half;
  winnerId: string;
  winnerName: string;
  userWon: boolean;
  userHorseIds: string[];
  finishingOrder: {
    horseId: string;
    horseName: string;
    rating: number;
    isUser: boolean;
    position: number;
  }[];
};

type SavedProgress = {
  raceIndex: number;
  starts: Record<string, { Spring: number; Autumn: number }>;
  results: RaceResult[];
};

const MAX_STARTS_PER_HALF = 3;

const seasonRaces: SeasonRace[] = [
  { id: "spring-moir", half: "Spring", name: "Moir Stakes", distance: 1000, category: "Sprint", fieldSize: 12, grade: "G1" },
  { id: "spring-makybe-diva", half: "Spring", name: "Makybe Diva Stakes", distance: 1600, category: "Middle Distance", fieldSize: 12, grade: "G1" },
  { id: "spring-everest", half: "Spring", name: "The Everest", distance: 1200, category: "Sprint", fieldSize: 12, grade: "G1" },
  { id: "spring-king-charles", half: "Spring", name: "King Charles III Stakes", distance: 1600, category: "Middle Distance", fieldSize: 12, grade: "G1" },
  { id: "spring-caulfield-cup", half: "Spring", name: "Caulfield Cup", distance: 2400, category: "Stayer", fieldSize: 18, grade: "G1" },
  { id: "spring-cox-plate", half: "Spring", name: "Cox Plate", distance: 2040, category: "Middle Distance", fieldSize: 14, grade: "G1" },
  { id: "spring-melbourne-cup", half: "Spring", name: "Melbourne Cup", distance: 3200, category: "Stayer", fieldSize: 24, grade: "G1" },
  { id: "spring-champions-sprint", half: "Spring", name: "Champions Sprint", distance: 1200, category: "Sprint", fieldSize: 12, grade: "G1" },
  { id: "spring-champions-stakes", half: "Spring", name: "Champions Stakes", distance: 2000, category: "Middle Distance", fieldSize: 12, grade: "G1" },
  { id: "spring-zipping", half: "Spring", name: "Zipping Classic", distance: 2400, category: "Stayer", fieldSize: 12, grade: "G2" },

  { id: "autumn-lightning", half: "Autumn", name: "Lightning Stakes", distance: 1000, category: "Sprint", fieldSize: 12, grade: "G1" },
  { id: "autumn-newmarket", half: "Autumn", name: "Newmarket Handicap", distance: 1200, category: "Sprint", fieldSize: 12, grade: "G1" },
  { id: "autumn-all-star-mile", half: "Autumn", name: "All-Star Mile", distance: 1600, category: "Middle Distance", fieldSize: 12, grade: "G1" },
  { id: "autumn-tancred", half: "Autumn", name: "Tancred Stakes", distance: 2400, category: "Stayer", fieldSize: 12, grade: "G1" },
  { id: "autumn-australian-cup", half: "Autumn", name: "Australian Cup", distance: 2000, category: "Middle Distance", fieldSize: 12, grade: "G1" },
  { id: "autumn-tj-smith", half: "Autumn", name: "T J Smith Stakes", distance: 1200, category: "Sprint", fieldSize: 12, grade: "G1" },
  { id: "autumn-doncaster", half: "Autumn", name: "Doncaster Mile", distance: 1600, category: "Middle Distance", fieldSize: 12, grade: "G1" },
  { id: "autumn-queen-elizabeth", half: "Autumn", name: "Queen Elizabeth Stakes", distance: 2000, category: "Middle Distance", fieldSize: 12, grade: "G1" },
  { id: "autumn-sydney-cup", half: "Autumn", name: "Sydney Cup", distance: 3200, category: "Stayer", fieldSize: 12, grade: "G1" },
  { id: "autumn-andrew-ramsden", half: "Autumn", name: "Andrew Ramsden Stakes", distance: 2800, category: "Stayer", fieldSize: 12, grade: "LR" },
];

function eligibleForCategory(horse: Horse, category: Category) {
  if (category === "Sprint") return horse.sprinter;
  if (category === "Middle Distance") return horse.middle_distance;
  return horse.stayer;
}

function buildRandomOpposition(
  horses: Horse[],
  category: Category,
  stableIds: Set<string>,
  count: number,
  grade: SeasonRace["grade"]
) {
  const eligible = horses
    .filter((horse) => !stableIds.has(horse.id))
    .filter((horse) => eligibleForCategory(horse, category));

  if (eligible.length <= count) return eligible;

  const selected: Horse[] = [];
  const used = new Set<string>();

  const pickRandom = (pool: Horse[]) => {
    const available = pool.filter((horse) => !used.has(horse.id));
    if (!available.length) return null;

    return available[Math.floor(Math.random() * available.length)];
  };

  const addFromPool = (pool: Horse[], targetCount: number) => {
    for (let i = 0; i < targetCount; i += 1) {
      const horse = pickRandom(pool);
      if (!horse) break;

      selected.push(horse);
      used.add(horse.id);
    }
  };

  const elitePool = eligible.filter((horse) => horse.rating >= 90);
  const strongPool = eligible.filter(
    (horse) => horse.rating >= 80 && horse.rating <= 89
  );
  const lowerPool = eligible.filter((horse) => horse.rating < 80);

  // Easier non-G1 fields for elite horses.
  const eliteShare =
    grade === "G1"
      ? 0.25
      : grade === "G2"
      ? 0.15
      : grade === "G3"
      ? 0.1
      : 0.05;

  const strongShare =
    grade === "G1"
      ? 0.4
      : grade === "G2"
      ? 0.35
      : grade === "G3"
      ? 0.3
      : 0.25;

  const eliteTarget = Math.min(
    elitePool.length,
    count,
    Math.ceil(count * eliteShare)
  );

  const strongTarget = Math.min(
    strongPool.length,
    Math.max(0, count - eliteTarget),
    Math.round(count * strongShare)
  );

  addFromPool(elitePool, eliteTarget);
  addFromPool(strongPool, strongTarget);

  // Fill remaining field spots from all unused eligible horses.
  // This means fields can naturally contain more than 25% rated 90+.
  while (selected.length < count) {
    const horse = pickRandom(eligible);
    if (!horse) break;

    selected.push(horse);
    used.add(horse.id);
  }

  return selected;
}

function weightedFinishingOrder(field: RaceRunner[], grade: SeasonRace["grade"]) {
  const remaining = [...field];
  const order: RaceRunner[] = [];

  const raceK =
    grade === "G1" ? 5.5 : grade === "G2" ? 5.0 : grade === "G3" ? 4.7 : 4.5;

  const pickWeightedIndex = (pool: RaceRunner[]) => {
    const weights = pool.map((runner) =>
      Math.exp((runner.horse.rating - 80) / raceK)
    );

    const total = weights.reduce((sum, value) => sum + value, 0);
    let draw = Math.random() * total;

    for (let i = 0; i < pool.length; i += 1) {
      draw -= weights[i];
      if (draw <= 0) return i;
    }

    return pool.length - 1;
  };

  // Special elite protection:
  // If a 100-rated horse is in the race, it can only be beaten by a horse
  // rated 95 or higher. Horses rated 94 or below cannot win that race.
  const has100RatedHorse = remaining.some(
    (runner) => runner.horse.rating >= 100
  );

  if (has100RatedHorse) {
    const eligibleWinners = remaining.filter(
      (runner) => runner.horse.rating >= 95
    );

    const winnerIndexInEligible = pickWeightedIndex(eligibleWinners);
    const winner = eligibleWinners[winnerIndexInEligible];

    const winnerIndexInRemaining = remaining.findIndex(
      (runner) => runner.horse.id === winner.horse.id
    );

    order.push(winner);
    remaining.splice(winnerIndexInRemaining, 1);
  }

  // Fill the rest of the finishing order normally.
  while (remaining.length) {
    const chosenIndex = pickWeightedIndex(remaining);
    order.push(remaining[chosenIndex]);
    remaining.splice(chosenIndex, 1);
  }

  return order;
}

export default function RaceTo100SeasonPage() {
  const [stable, setStable] = useState<StableEntry[]>([]);
  const [allHorses, setAllHorses] = useState<Horse[]>([]);
  const [raceIndex, setRaceIndex] = useState(0);
  const [starts, setStarts] = useState<Record<string, { Spring: number; Autumn: number }>>({});
  const [results, setResults] = useState<RaceResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<RaceResult | null>(null);
  const [viewedResult, setViewedResult] = useState<RaceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentRace = seasonRaces[raceIndex] ?? null;
  const complete = raceIndex >= seasonRaces.length;

  useEffect(() => {
    async function load() {
      try {
        const rawStable = window.localStorage.getItem("raceTo100SeasonStable");
        if (!rawStable) {
          setError("No Race to 100 stable found. Complete a team first.");
          return;
        }

        const parsedStable = JSON.parse(rawStable) as StableEntry[];
        setStable(parsedStable);

        const blankStarts: Record<string, { Spring: number; Autumn: number }> = {};
        parsedStable.forEach(({ horse }) => {
          blankStarts[horse.id] = { Spring: 0, Autumn: 0 };
        });

        const savedRaw = window.localStorage.getItem("raceTo100SeasonProgress");
        if (savedRaw) {
          const saved = JSON.parse(savedRaw) as SavedProgress;
          setRaceIndex(saved.raceIndex);
          setStarts(saved.starts);
          setResults(saved.results);
        } else {
          setStarts(blankStarts);
        }

        const { data, error: horseError } = await supabase
          .from("race_to_100_horses")
          .select("id,name,rating,sprinter,middle_distance,stayer,silks_url")
          .order("rating", { ascending: false });

        if (horseError) throw horseError;
        setAllHorses((data ?? []) as Horse[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load Season Mode.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    if (!stable.length || loading) return;
    const progress: SavedProgress = { raceIndex, starts, results };
    window.localStorage.setItem("raceTo100SeasonProgress", JSON.stringify(progress));
  }, [raceIndex, starts, results, stable.length, loading]);

  useEffect(() => {
    setSelectedIds([]);
    setLastResult(null);
  }, [raceIndex]);

  const stableIds = useMemo(
    () => new Set(stable.map(({ horse }) => horse.id)),
    [stable]
  );

  const eligibleStable = useMemo(() => {
    if (!currentRace) return [];
    return stable
      .filter(({ horse }) => eligibleForCategory(horse, currentRace.category))
      .sort((a, b) => b.horse.rating - a.horse.rating);
  }, [stable, currentRace]);

  const wins = results.filter((result) => result.userWon).length;
  const springWins = results.filter((result) => result.half === "Spring" && result.userWon).length;
  const autumnWins = results.filter((result) => result.half === "Autumn" && result.userWon).length;

  function startsUsed(horseId: string, half: Half) {
    return starts[horseId]?.[half] ?? 0;
  }

  function toggleHorse(horse: Horse) {
    if (!currentRace || running || lastResult) return;
    if (startsUsed(horse.id, currentRace.half) >= MAX_STARTS_PER_HALF) return;

    setSelectedIds((current) =>
      current.includes(horse.id)
        ? current.filter((id) => id !== horse.id)
        : [...current, horse.id]
    );
  }

  function runRace() {
    if (!currentRace || running || lastResult) return;
    if (!selectedIds.length) {
      setError("Select at least one horse from your stable.");
      return;
    }

    setRunning(true);
    setError(null);

    try {
      const userRunners: RaceRunner[] = stable
        .filter(({ horse }) => selectedIds.includes(horse.id))
        .map(({ horse }) => ({ horse, isUser: true }));

      const oppositionNeeded = currentRace.fieldSize - userRunners.length;

      const opposition: RaceRunner[] = buildRandomOpposition(
        allHorses,
        currentRace.category,
        stableIds,
        oppositionNeeded,
        currentRace.grade
      ).map((horse) => ({ horse, isUser: false }));

      if (opposition.length < oppositionNeeded) {
        throw new Error(
          `Not enough eligible ${currentRace.category.toLowerCase()} horses in the database to fill this field.`
        );
      }

      const order = weightedFinishingOrder([...userRunners, ...opposition], currentRace.grade);

      const result: RaceResult = {
        raceId: currentRace.id,
        raceName: currentRace.name,
        half: currentRace.half,
        winnerId: order[0].horse.id,
        winnerName: order[0].horse.name,
        userWon: order[0].isUser,
        userHorseIds: [...selectedIds],
        finishingOrder: order.map((runner, index) => ({
          horseId: runner.horse.id,
          horseName: runner.horse.name,
          rating: runner.horse.rating,
          isUser: runner.isUser,
          position: index + 1,
        })),
      };

      setStarts((current) => {
        const next = { ...current };
        selectedIds.forEach((horseId) => {
          const existing = next[horseId] ?? { Spring: 0, Autumn: 0 };
          next[horseId] = {
            ...existing,
            [currentRace.half]: existing[currentRace.half] + 1,
          };
        });
        return next;
      });

      setResults((current) => [...current, result]);
      setLastResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run race.");
    } finally {
      setRunning(false);
    }
  }

  function nextRace() {
    if (!lastResult) return;
    setViewedResult(null);
    setRaceIndex((current) => current + 1);
  }

  function restartGame() {
    setViewedResult(null);
    window.localStorage.removeItem("raceTo100SeasonStable");
    window.localStorage.removeItem("raceTo100SeasonProgress");
    window.location.href = "/race-to-100";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-10 text-center font-bold text-slate-400">
          Loading season...
        </div>
      </main>
    );
  }

  if (error && !stable.length) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <h1 className="text-3xl font-black">Season Mode</h1>
          <p className="mt-4 text-slate-400">{error}</p>
          <a
            href="/race-to-100"
            className="mt-6 inline-block rounded-xl bg-amber-400 px-6 py-3 font-black text-slate-950"
          >
            BUILD A TEAM
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-3 py-3 sm:px-4 sm:py-4">
        <header className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
              Race to 100 · Season Mode
            </div>
            <h1 className="mt-0.5 text-xl font-black sm:text-3xl">
              {complete ? "Season Complete" : `${currentRace?.half} · Race ${raceIndex + 1} of 20`}
            </h1>
            {!complete && currentRace && (
              <p className="mt-1 text-sm text-slate-400">
                {currentRace.name} · {currentRace.distance}m · {currentRace.fieldSize} runners
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5">
              <div className="text-[10px] font-bold uppercase text-slate-500">Wins</div>
              <div className="text-lg font-black">{wins}</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5">
              <div className="text-[10px] font-bold uppercase text-slate-500">Spring</div>
              <div className="text-lg font-black">{springWins}/10</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5">
              <div className="text-[10px] font-bold uppercase text-slate-500">Autumn</div>
              <div className="text-lg font-black">{autumnWins}/10</div>
            </div>
            </div>

            <button
              type="button"
              onClick={restartGame}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-black text-slate-300 transition hover:border-red-500 hover:text-red-300"
            >
              RESTART
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm font-semibold text-red-200">
            {error}
          </div>
        )}

        {viewedResult && (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 p-3 pt-8 sm:p-6 sm:pt-12"
            onClick={() => setViewedResult(null)}
          >
            <div
              className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div
                    className={`text-xs font-black uppercase tracking-[0.18em] ${
                      viewedResult.userWon ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {viewedResult.half} · {viewedResult.userWon ? "WIN" : "LOSS"}
                  </div>
                  <h2 className="mt-1 text-2xl font-black">
                    {viewedResult.raceName}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Winner:{" "}
                    <span className="font-black text-white">
                      {viewedResult.winnerName}
                    </span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setViewedResult(null)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-black text-slate-300 transition hover:border-amber-400 hover:text-white"
                >
                  CLOSE
                </button>
              </div>

              <div className="mt-4 space-y-1">
                {viewedResult.finishingOrder.map((runner) => (
                  <div
                    key={runner.horseId}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                      runner.isUser
                        ? "border-amber-400/30 bg-amber-400/5"
                        : "border-slate-800 bg-slate-950"
                    }`}
                  >
                    <div className="w-7 shrink-0 text-center text-sm font-black text-slate-500">
                      {runner.position}
                    </div>
                    <div className="min-w-0 flex-1 truncate font-bold">
                      {runner.horseName}
                      {runner.isUser && (
                        <span className="ml-2 text-[9px] font-black uppercase text-amber-400">
                          Your horse
                        </span>
                      )}
                    </div>
                    <div className="shrink-0 text-sm font-black text-slate-500">
                      {runner.rating}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {complete ? (
          <section className="rounded-2xl border border-amber-400/30 bg-slate-900 p-4 text-center sm:p-6">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
              Final Season Record
            </div>
            <div className="mt-2 text-4xl font-black sm:text-5xl">{wins}/20</div>
            <div className="mt-1 text-sm text-slate-400">
              Spring {springWins}/10 · Autumn {autumnWins}/10
            </div>

            <div className="mx-auto mt-5 grid max-w-5xl gap-4 text-left sm:grid-cols-2">
              {(["Spring", "Autumn"] as Half[]).map((half) => {
                const halfResults = results.filter((result) => result.half === half);
                const halfWins = halfResults.filter((result) => result.userWon).length;

                return (
                  <div key={half}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                        {half}
                      </div>
                      <div className="text-xs font-black text-slate-500">
                        {halfWins}/10
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {halfResults.map((result, index) => (
                        <button
                          key={result.raceId}
                          type="button"
                          onClick={() => setViewedResult(result)}
                          className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-left transition hover:border-amber-400/60"
                          title={`View ${result.raceName} result`}
                        >
                          <div className="min-w-0">
                            <div className="text-[10px] font-black uppercase text-slate-600">
                              Race {index + 1}
                            </div>
                            <div className="truncate text-sm font-black">
                              {result.raceName}
                            </div>
                            <div className="truncate text-[11px] text-slate-500">
                              Winner: {result.winnerName}
                            </div>
                          </div>

                          <div
                            className={`shrink-0 text-sm font-black ${
                              result.userWon
                                ? "text-amber-400"
                                : "text-slate-500"
                            }`}
                          >
                            {result.userWon ? "WIN" : "LOSS"}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={restartGame}
              className="mt-5 rounded-lg bg-amber-400 px-6 py-2.5 text-sm font-black text-slate-950"
            >
              RESTART GAME
            </button>
          </section>
        ) : (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.08fr)_280px] xl:gap-3">
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-3 sm:p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Select runners
                  </div>
                  <h2 className="mt-0.5 text-xl font-black">{currentRace?.name}</h2>
                </div>
                <div className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-400">
                  {currentRace?.category}
                </div>
              </div>

              <p className="mt-2 text-xs leading-5 text-slate-400">
                Enter as many eligible horses as you want. Each horse can race up to 3 times in {currentRace?.half}.
              </p>

              <div className="mt-3 space-y-1.5">
                {eligibleStable.map(({ slot, horse }) => {
                  const used = startsUsed(horse.id, currentRace!.half);
                  const exhausted = used >= MAX_STARTS_PER_HALF;
                  const selected = selectedIds.includes(horse.id);

                  return (
                    <button
                      key={horse.id}
                      type="button"
                      disabled={exhausted || !!lastResult}
                      onClick={() => toggleHorse(horse)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition ${
                        selected
                          ? "border-amber-400 bg-amber-400/10"
                          : "border-slate-800 bg-slate-950 hover:border-slate-700"
                      } disabled:opacity-40`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-900">
                        {horse.silks_url ? (
                          <img src={horse.silks_url} alt="" className="max-h-full max-w-full object-contain" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-black">{horse.name}</div>
                        <div className="text-xs text-slate-500">{slot} · Rating {horse.rating}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-black">{used}/3</div>
                        <div className="text-[9px] font-bold uppercase text-slate-500">Starts</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {!lastResult && (
                <button
                  type="button"
                  disabled={!selectedIds.length || running}
                  onClick={runRace}
                  className="mt-3 w-full rounded-lg bg-amber-400 px-5 py-2.5 text-base font-black text-slate-950 transition hover:bg-amber-300 disabled:opacity-40"
                >
                  {running ? "RUNNING..." : `RUN ${currentRace?.name.toUpperCase()}`}
                </button>
              )}
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900 p-3 sm:p-4">
              {!lastResult ? (
                <>
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Race setup
                  </div>
                  <h2 className="mt-0.5 text-xl font-black">
                    {selectedIds.length} stable runner{selectedIds.length === 1 ? "" : "s"}
                  </h2>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    The remaining {Math.max(0, (currentRace?.fieldSize ?? 0) - selectedIds.length)} places will be filled by a tiered random field based on race grade. G1 fields are strongest, while G2, G3 and Listed races are easier for 90+ rated horses.
                  </p>

                  <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <div className="text-xs font-black uppercase text-slate-500">Simulation</div>
                    <div className="mt-2 text-sm text-slate-300">
                      Ratings affect each runner's chance, but no horse is guaranteed to win.
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className={`text-xs font-black uppercase tracking-[0.2em] ${lastResult.userWon ? "text-amber-400" : "text-slate-500"}`}>
                    {lastResult.userWon ? "Stable Win" : "Race Result"}
                  </div>
                  <h2 className="mt-2 text-3xl font-black">
                    {lastResult.userWon ? "WIN" : "LOSS"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Winner: <span className="font-black text-white">{lastResult.winnerName}</span>
                  </p>

                  <div className="mt-3 space-y-1 pr-1">
                    {lastResult.finishingOrder.map((runner) => (
                      <div
                        key={runner.horseId}
                        className={`flex items-center gap-3 rounded-lg border px-2.5 py-1.5 ${
                          runner.isUser
                            ? "border-amber-400/30 bg-amber-400/5"
                            : "border-slate-800 bg-slate-950"
                        }`}
                      >
                        <div className="w-7 text-center text-sm font-black text-slate-500">
                          {runner.position}
                        </div>
                        <div className="min-w-0 flex-1 truncate font-bold">
                          {runner.horseName}
                          {runner.isUser && (
                            <span className="ml-2 text-[9px] font-black uppercase text-amber-400">Your horse</span>
                          )}
                        </div>
                        <div className="text-sm font-black text-slate-500">{runner.rating}</div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={nextRace}
                    className="mt-3 w-full rounded-lg bg-amber-400 px-5 py-2.5 font-black text-slate-950"
                  >
                    {raceIndex === 9 ? "START AUTUMN" : raceIndex === 19 ? "FINISH SEASON" : "NEXT RACE"}
                  </button>
                </>
              )}
            </section>

            <aside className="rounded-xl border border-slate-800 bg-slate-900 p-3 sm:p-4 xl:sticky xl:top-4 xl:self-start">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Season Calendar
                  </div>
                  <h2 className="mt-1 text-xl font-black">
                    {wins}-{results.length - wins}
                  </h2>
                </div>
                <div className="text-right text-xs font-bold text-slate-500">
                  {results.length}/20
                </div>
              </div>

              {(["Spring", "Autumn"] as Half[]).map((half) => {
                const halfRaces = seasonRaces.filter((race) => race.half === half);
                const halfResults = results.filter((result) => result.half === half);
                const halfWins = halfResults.filter((result) => result.userWon).length;

                return (
                  <div key={half} className="mt-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                        {half}
                      </div>
                      <div className="text-[10px] font-bold text-slate-600">
                        {halfWins}-{halfResults.length - halfWins}
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      {halfRaces.map((race) => {
                        const result = results.find((item) => item.raceId === race.id);
                        const isCurrent = currentRace?.id === race.id;

                        const categoryCode =
                          race.category === "Sprint"
                            ? "SPR"
                            : race.category === "Middle Distance"
                            ? "MID"
                            : "STY";

                        return (
                          <button
                            key={race.id}
                            type="button"
                            disabled={!result}
                            onClick={() => {
                              if (result) setViewedResult(result);
                            }}
                            title={result ? `View ${race.name} result` : undefined}
                            className={`flex w-full items-center gap-1.5 rounded-md border px-2 py-1 text-left transition ${
                              isCurrent
                                ? "border-amber-400 bg-amber-400/10"
                                : result?.userWon
                                ? "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-400/60"
                                : result
                                ? "border-red-500/30 bg-red-500/5 hover:border-red-400/60"
                                : "cursor-default border-slate-800 bg-slate-950"
                            }`}
                          >
                            <div className="w-8 shrink-0 rounded border border-slate-800 px-1 py-0.5 text-center text-[9px] font-black text-slate-500">
                              {categoryCode}
                            </div>

                            <div className="min-w-0 flex-1 truncate text-[10px] font-bold">
                              {race.name}
                            </div>

                            <div
                              className={`w-9 shrink-0 text-right text-[9px] font-black ${
                                result?.userWon
                                  ? "text-emerald-400"
                                  : result
                                  ? "text-red-400"
                                  : isCurrent
                                  ? "text-amber-400"
                                  : "text-slate-700"
                              }`}
                            >
                              {result?.userWon
                                ? "WIN"
                                : result
                                ? "LOSS"
                                : isCurrent
                                ? "NEXT"
                                : "—"}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
