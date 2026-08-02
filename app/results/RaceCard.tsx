import RunnerRow from "./RunnerRow";
import type {
  Race,
  RaceEntry,
  RaceResult,
  TeamSelection,
} from "./types";

type RaceCardProps = {
  race: Race;
  entries: RaceEntry[];
  results: RaceResult[];
  selections: TeamSelection[];
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getGradeLabel(grade: Race["grade"]) {
  switch (grade) {
    case "G1":
      return "Group 1";
    case "G2":
      return "Group 2";
    case "G3":
      return "Group 3";
    case "L":
      return "Listed";
  }
}

function getRaceStatusClasses(status: string) {
  switch (status) {
    case "official":
      return "bg-teal-50 text-teal-700";
    case "running":
      return "bg-amber-100 text-amber-800";
    case "abandoned":
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function RaceCard({
  race,
  entries,
  results,
  selections,
}: RaceCardProps) {
  const resultByEntryId = new Map(
    results.map((result) => [result.race_entry_id, result])
  );

  const selectionByEntryId = new Map(
    selections.map((selection) => [
      selection.race_entry_id,
      selection,
    ])
  );

  const sortedEntries = [...entries].sort((a, b) => {
    const resultA = resultByEntryId.get(a.id);
    const resultB = resultByEntryId.get(b.id);

    const statusOrder = {
      finished: 1,
      non_finisher: 2,
      scratched: 3,
    } as const;

    const resultStatusA =
      resultA?.result_status as keyof typeof statusOrder | undefined;
    const resultStatusB =
      resultB?.result_status as keyof typeof statusOrder | undefined;

    const statusValueA = resultStatusA
      ? statusOrder[resultStatusA]
      : 4;

    const statusValueB = resultStatusB
      ? statusOrder[resultStatusB]
      : 4;

    if (statusValueA !== statusValueB) {
      return statusValueA - statusValueB;
    }

    const positionA =
      resultA?.finishing_position ?? Number.MAX_SAFE_INTEGER;

    const positionB =
      resultB?.finishing_position ?? Number.MAX_SAFE_INTEGER;

    if (positionA !== positionB) {
      return positionA - positionB;
    }

    return (
      (a.saddlecloth_number ?? Number.MAX_SAFE_INTEGER) -
      (b.saddlecloth_number ?? Number.MAX_SAFE_INTEGER)
    );
  });

  const selectedRunnerCount = entries.filter((entry) =>
    selectionByEntryId.has(entry.id)
  ).length;

  const raceFantasyPoints = entries.reduce((total, entry) => {
    const result = resultByEntryId.get(entry.id);
    const selection = selectionByEntryId.get(entry.id);

    if (!result || !selection) {
      return total;
    }

    const multiplier = selection.is_captain ? 2 : 1;

    return total + result.fantasy_points * multiplier;
  }, 0);

  return (
    <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="border-b bg-slate-50 p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-800 px-3 py-1 text-sm font-bold text-white">
                Race {race.race_number}
              </span>

              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-800">
                {getGradeLabel(race.grade)}
              </span>

              <span
                className={`rounded-full px-3 py-1 text-sm font-bold capitalize ${getRaceStatusClasses(
                  race.status
                )}`}
              >
                {race.status}
              </span>
            </div>

            <h2 className="mt-3 text-2xl font-bold text-slate-900">
              {race.race_name}
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              {race.racecourse?.name ?? "Racecourse unavailable"}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              {formatDateTime(race.scheduled_start)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:min-w-64">
            <div className="rounded-lg bg-white p-3 text-center shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Your Runners
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {selectedRunnerCount}
              </p>
            </div>

            <div className="rounded-lg bg-teal-50 p-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">
                Your Points
              </p>

              <p className="mt-1 text-2xl font-bold text-emerald-900">
                {raceFantasyPoints}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4 md:p-6">
        {sortedEntries.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-slate-500">
            No runners have been added to this race.
          </div>
        ) : (
          sortedEntries.map((entry) => (
            <RunnerRow
              key={entry.id}
              entry={entry}
              result={resultByEntryId.get(entry.id) ?? null}
              selection={
                selectionByEntryId.get(entry.id) ?? null
              }
            />
          ))
        )}
      </div>
    </section>
  );
}