import type {
  RaceEntry,
  RaceResult,
  TeamSelection,
} from "./types";

type RunnerRowProps = {
  entry: RaceEntry;
  result: RaceResult | null;
  selection: TeamSelection | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPosition(position: number | null) {
  if (position === null) {
    return "—";
  }

  const lastTwoDigits = position % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return `${position}th`;
  }

  switch (position % 10) {
    case 1:
      return `${position}st`;
    case 2:
      return `${position}nd`;
    case 3:
      return `${position}rd`;
    default:
      return `${position}th`;
  }
}

function getPriceChangeLabel(priceChange: number) {
  if (priceChange > 0) {
    return `+${formatCurrency(priceChange)}`;
  }

  if (priceChange < 0) {
    return `-${formatCurrency(Math.abs(priceChange))}`;
  }

  return formatCurrency(0);
}

export default function RunnerRow({
  entry,
  result,
  selection,
}: RunnerRowProps) {
  const isSelected = Boolean(selection);
  const isCaptain = selection?.is_captain === true;

  const baseFantasyPoints = result?.fantasy_points ?? 0;

  const displayedFantasyPoints = isCaptain
    ? baseFantasyPoints * 2
    : baseFantasyPoints;

  const rowClasses = isCaptain
    ? "border-amber-300 bg-amber-50"
    : isSelected
      ? "border-teal-300 bg-teal-50"
      : "border-slate-200 bg-white";

  const pointsClasses = isCaptain
    ? "text-amber-800"
    : isSelected
      ? "text-teal-700"
      : "text-slate-900";

  return (
    <div
      className={`grid gap-4 rounded-lg border p-4 md:grid-cols-[70px_minmax(0,1fr)_120px_140px_140px] md:items-center ${rowClasses}`}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:hidden">
          Position
        </p>

        <p className="text-lg font-bold text-slate-900">
          {result?.result_status === "scratched"
            ? "SCR"
            : result?.result_status === "non_finisher"
              ? "DNF"
              : formatPosition(result?.finishing_position ?? null)}
        </p>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {entry.saddlecloth_number !== null && (
            <span className="flex h-7 min-w-7 items-center justify-center rounded bg-slate-900 px-2 text-sm font-bold text-white">
              {entry.saddlecloth_number}
            </span>
          )}

          <p className="truncate text-lg font-bold text-slate-900">
            {entry.horse?.name ?? "Unknown horse"}
          </p>

          {isSelected && (
            <span className="rounded-full bg-teal-600 px-2 py-1 text-xs font-bold text-white">
              Your Horse
            </span>
          )}

          {isCaptain && (
            <span className="rounded-full bg-amber-400 px-2 py-1 text-xs font-bold text-amber-950">
              Captain
            </span>
          )}

          {result?.is_dead_heat && (
            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-800">
              Dead Heat
            </span>
          )}
        </div>

        <p className="mt-1 text-sm text-slate-500">
          Current price:{" "}
          {formatCurrency(
            result?.price_after ??
              entry.horse?.current_price ??
              0
          )}
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Fantasy Points
        </p>

        <p className={`mt-1 text-xl font-bold ${pointsClasses}`}>
          {displayedFantasyPoints} pts
        </p>

        {isCaptain && baseFantasyPoints > 0 && (
          <p className="text-xs font-semibold text-amber-700">
            {baseFantasyPoints} × 2
          </p>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Price Change
        </p>

        <p
          className={`mt-1 text-lg font-bold ${
            (result?.price_change ?? 0) > 0
              ? "text-green-600"
              : (result?.price_change ?? 0) < 0
                ? "text-red-700"
                : "text-slate-700"
          }`}
        >
          {getPriceChangeLabel(result?.price_change ?? 0)}
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Result
        </p>

        <p className="mt-1 text-sm font-semibold capitalize text-slate-900">
          {result
            ? result.result_status.replaceAll("_", " ")
            : "Awaiting result"}
        </p>
      </div>
    </div>
  );
}