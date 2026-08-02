type RoundSummaryProps = {
  roundScore: number;
  roundRank: number;
  seasonScore: number;
  overallRank: number;
};

export default function RoundSummary({
  roundScore,
  roundRank,
  seasonScore,
  overallRank,
}: RoundSummaryProps) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="mb-6 text-2xl font-bold text-slate-900">
        Round Summary
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-slate-100 p-4">
          <p className="text-sm font-semibold text-slate-500">
            Round Score
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {roundScore}
          </p>
        </div>

        <div className="rounded-lg bg-slate-100 p-4">
          <p className="text-sm font-semibold text-slate-500">
            Round Rank
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {roundRank > 0 ? `#${roundRank}` : "—"}
          </p>
        </div>

        <div className="rounded-lg bg-slate-100 p-4">
          <p className="text-sm font-semibold text-slate-500">
            Season Score
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {seasonScore}
          </p>
        </div>

        <div className="rounded-lg bg-slate-100 p-4">
          <p className="text-sm font-semibold text-slate-500">
            Overall Rank
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {overallRank > 0 ? `#${overallRank}` : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}