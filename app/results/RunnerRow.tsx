import type {
  RaceEntry,
  RaceResult,
  TeamSelection,
} from "./types";

type RunnerRowProps = {
  entry: RaceEntry;
  result: RaceResult | null;
  selection: TeamSelection | null;
  showHorseSilks?: boolean;
  silksUrl?: string | null;
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

function getResultLabel(result: RaceResult | null) {
  if (!result) {
    return "TBC";
  }

  if (result.result_status === "scratched") {
    return "SCR";
  }

  if (result.result_status === "non_finisher") {
    return "DNF";
  }

  return formatPosition(result.finishing_position ?? null);
}

export default function RunnerRow({
  entry,
  result,
  selection,
  showHorseSilks = true,
  silksUrl = null,
}: RunnerRowProps) {
  const isSelected = Boolean(selection);
  const isCaptain = selection?.is_captain === true;

  const baseFantasyPoints = result?.fantasy_points ?? 0;

  const displayedFantasyPoints = isCaptain
    ? baseFantasyPoints * 2
    : baseFantasyPoints;

  const rowClasses = isCaptain
    ? "border-amber-300 bg-amber-50/70"
    : isSelected
      ? "border-teal-300 bg-teal-50/70"
      : "border-slate-200 bg-white";

  const pointsClasses = isCaptain
    ? "text-amber-800"
    : isSelected
      ? "text-teal-700"
      : "text-slate-950";

  const priceChange = result?.price_change ?? 0;

  return (
    <div
      className={`rounded-xl border px-4 py-4 shadow-sm transition ${rowClasses}`}
    >
      <div className="grid gap-4 md:grid-cols-[76px_minmax(0,1fr)_auto] md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:hidden">
            Result
          </p>

          <p className="text-xl font-bold text-slate-950">
            {getResultLabel(result)}
          </p>
        </div>

        <div className="flex min-w-0 items-stretch gap-3">
          {showHorseSilks && silksUrl && (
            <div className="flex w-11 shrink-0 items-center justify-center self-stretch">
              <img
                src={silksUrl}
                alt={`${entry.horse?.name ?? "Horse"} silks`}
                className="h-full max-h-14 w-full object-contain"
              />
            </div>
          )}

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {entry.saddlecloth_number !== null && (
                <span className="inline-flex min-w-5 items-center justify-center text-sm font-medium text-slate-500">
                  {entry.saddlecloth_number}
                </span>
              )}

              <p className="truncate text-lg font-semibold text-slate-950">
                {entry.horse?.name ?? "Unknown horse"}
              </p>

              {isSelected && (
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-800">
                  Your Horse
                </span>
              )}

              {isCaptain && (
                <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">
                  Captain
                </span>
              )}

              {result?.is_dead_heat && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-800">
                  Dead Heat
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              <span>
                Current price:{" "}
                <span className="font-medium text-slate-700">
                  {formatCurrency(
                    result?.price_after ??
                      entry.horse?.current_price ??
                      0
                  )}
                </span>
              </span>

              {result && (
                <span
                  className={
                    priceChange > 0
                      ? "font-semibold text-green-700"
                      : priceChange < 0
                        ? "font-semibold text-red-700"
                        : "font-medium text-slate-600"
                  }
                >
                  Price change: {getPriceChangeLabel(priceChange)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="min-w-[120px] text-left md:text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Fantasy Points
          </p>

          {result ? (
            <>
              <p
                className={`mt-1 text-2xl font-bold leading-none ${pointsClasses}`}
              >
                {displayedFantasyPoints} pts
              </p>

              {isCaptain && baseFantasyPoints > 0 && (
                <p className="mt-1 text-xs font-semibold text-amber-700">
                  {baseFantasyPoints} × 2
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-2xl font-semibold leading-none text-slate-400">
              —
            </p>
          )}
        </div>
      </div>
    </div>
  );
}