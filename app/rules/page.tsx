"use client";

import Link from "next/link";

type PointsRow = {
    position: number;
    G1: number;
    G2: number;
    G3: number;
    Listed: number;
};

type PriceRow = {
    result: string;
    G1: string;
    G2: string;
    G3: string;
    Listed: string;
};

const pointsRows: PointsRow[] = [
    { position: 1, G1: 45, G2: 35, G3: 30, Listed: 25 },
    { position: 2, G1: 35, G2: 30, G3: 25, Listed: 20 },
    { position: 3, G1: 30, G2: 25, G3: 20, Listed: 18 },
    { position: 4, G1: 25, G2: 20, G3: 18, Listed: 16 },
    { position: 5, G1: 20, G2: 18, G3: 16, Listed: 14 },
    { position: 6, G1: 18, G2: 16, G3: 14, Listed: 12 },
    { position: 7, G1: 16, G2: 14, G3: 12, Listed: 10 },
    { position: 8, G1: 14, G2: 12, G3: 10, Listed: 8 },
    { position: 9, G1: 12, G2: 10, G3: 8, Listed: 6 },
    { position: 10, G1: 10, G2: 8, G3: 6, Listed: 4 },
];

const priceRows: PriceRow[] = [
    {
        result: "1st",
        G1: "+$30,000",
        G2: "+$20,000",
        G3: "+$10,000",
        Listed: "+$5,000",
    },
    {
        result: "2nd",
        G1: "+$20,000",
        G2: "+$10,000",
        G3: "+$5,000",
        Listed: "No change",
    },
    {
        result: "3rd",
        G1: "+$10,000",
        G2: "+$5,000",
        G3: "No change",
        Listed: "No change",
    },
    {
        result: "3rd last",
        G1: "-$10,000",
        G2: "-$5,000",
        G3: "No change",
        Listed: "No change",
    },
    {
        result: "2nd last",
        G1: "-$20,000",
        G2: "-$10,000",
        G3: "-$5,000",
        Listed: "No change",
    },
    {
        result: "Last",
        G1: "-$30,000",
        G2: "-$20,000",
        G3: "-$10,000",
        Listed: "-$5,000",
    },
];

const sectionLinks = [
    { id: "objective", label: "Objective" },
    { id: "competition", label: "Competition" },
    { id: "team-selection", label: "Team Selection" },
    { id: "salary-cap", label: "Salary Cap" },
    { id: "lockout", label: "Lockout" },
    { id: "fantasy-points", label: "Fantasy Points" },
    { id: "horse-prices", label: "Horse Prices" },
    { id: "special-rules", label: "Special Rules" },
    { id: "leaderboards", label: "Leaderboards" },
    { id: "team-comparison", label: "Team Comparison" },
];

function RuleSection({
    id,
    title,
    children,
}: {
    id: string;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section
            id={id}
            className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
        >
            <h2 className="text-2xl font-bold text-slate-900">
                {title}
            </h2>

            <div className="mt-4 space-y-4 text-slate-700">
                {children}
            </div>
        </section>
    );
}

export default function RulesPage() {
    return (
        <main className="min-h-screen bg-slate-100 p-4 md:p-8">
            <div className="mx-auto max-w-7xl">
                <header className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm md:p-8">
                    <p className="text-sm font-semibold uppercase tracking-wider text-teal-300">
                        Racecourse Fantasy
                    </p>

                    <h1 className="mt-2 text-3xl font-bold md:text-4xl">
                        Competition Rules
                    </h1>

                    <p className="mt-3 max-w-3xl text-slate-300">
                        These rules explain team selection, scoring, horse prices,
                        lockout, special results and leaderboard calculations.
                    </p>

                    <div className="mt-6 flex flex-wrap gap-3">
                        <Link
                            href="/team/edit"
                            className="rounded-lg bg-amber-400 px-5 py-3 font-bold text-slate-900 transition hover:bg-amber-300"
                        >
                            Select Team
                        </Link>

                        <Link
                            href="/leaderboard"
                            className="rounded-lg border border-slate-600 px-5 py-3 font-bold text-white transition hover:bg-slate-800"
                        >
                            View Leaderboard
                        </Link>
                    </div>
                </header>

                <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <aside className="lg:sticky lg:top-6 lg:self-start">
                        <nav className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <p className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                On this page
                            </p>

                            <div className="mt-3 space-y-1">
                                {sectionLinks.map((section) => (
                                    <a
                                        key={section.id}
                                        href={`#${section.id}`}
                                        className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-teal-700"
                                    >
                                        {section.label}
                                    </a>
                                ))}
                            </div>
                        </nav>
                    </aside>

                    <div className="space-y-6">
                        <RuleSection id="objective" title="1. Objective">
                            <p>
                                Select a team of horses each round and score as many
                                fantasy points as possible. The player with the highest
                                total score at the end of the season finishes first on
                                the season leaderboard.
                            </p>
                        </RuleSection>

                        <RuleSection id="competition" title="2. Competition">
                            <ul className="list-disc space-y-2 pl-5">
                                <li>
                                    The competition is played across the official
                                    Racecourse Fantasy season.
                                </li>

                                <li>
                                    Only eligible Group 1, Group 2, Group 3 and Listed
                                    races in Victoria and New South Wales are included.
                                </li>

                                <li>
                                    Melbourne and Sydney races held in the same round are
                                    combined into one fantasy round.
                                </li>

                                <li>
                                    Abandoned or cancelled races score zero fantasy
                                    points and do not create price movements.
                                </li>
                            </ul>
                        </RuleSection>

                        <RuleSection
                            id="team-selection"
                            title="3. Team Selection"
                        >
                            <ul className="list-disc space-y-2 pl-5">
                                <li>Each team contains 10 horses.</li>
                                <li>
                                    Players must remain within their available salary cap.
                                </li>
                                <li>
                                    A horse may only be selected once in the same team.
                                </li>
                                <li>
                                    One selected horse must be nominated as captain.
                                </li>
                                <li>
                                    Captain fantasy points are doubled. Price movements
                                    are not doubled.
                                </li>
                                <li>
                                    Teams may be saved as drafts and updated until
                                    lockout.
                                </li>
                            </ul>
                        </RuleSection>

                        <RuleSection id="salary-cap" title="4. Salary Cap">
                            <p>
                                Every player begins the season with an available salary
                                cap of <strong>$2,500,000</strong>.
                            </p>

                            <p>
                                After each completed round, the combined price movements
                                of the horses selected in that player&apos;s team are
                                added to or deducted from the player&apos;s salary cap
                                for the next round.
                            </p>

                            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
                                <p className="font-bold text-teal-900">
                                    Example
                                </p>

                                <div className="mt-3 space-y-1 text-sm text-teal-900">
                                    <p>Round 1 salary cap: $2,500,000</p>
                                    <p>Selected-horse price movements: +$100,000</p>
                                    <p className="font-bold">
                                        Round 2 salary cap: $2,600,000
                                    </p>
                                </div>
                            </div>

                            <p>
                                Each player may therefore have a different salary cap
                                after Round 1.
                            </p>
                        </RuleSection>

                        <RuleSection id="lockout" title="5. Lockout">
                            <ul className="list-disc space-y-2 pl-5">
                                <li>
                                    Lockout occurs at the advertised lockout time for the
                                    round and is based on the first designated race of the
                                    day.
                                </li>
                                <li>
                                    Teams may be edited up until lockout. Once lockout
                                    occurs, teams and captains can no longer be manually
                                    changed.
                                </li>
                                <li>
                                    If a player has not completed their team before
                                    lockout, the remaining positions will be automatically
                                    filled using projected scores and the player&apos;s
                                    available salary cap.
                                </li>
                                <li>
                                    Other players&apos; teams remain private before
                                    lockout.
                                </li>
                                <li>
                                    Team comparison becomes available after lockout.
                                </li>
                            </ul>
                        </RuleSection>

                        <RuleSection
                            id="fantasy-points"
                            title="6. Fantasy Points"
                        >
                            <p>
                                Fantasy points are awarded according to the official
                                finishing position and the grade of the race.
                            </p>

                            <div className="overflow-hidden rounded-xl border border-slate-200">
                                <table className="w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-100">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                                                Position
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                                                Group 1
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                                                Group 2
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                                                Group 3
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                                                Listed
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-200 bg-white">
                                        {pointsRows.map((row) => (
                                            <tr key={row.position}>
                                                <td className="px-4 py-3 font-bold text-slate-900">
                                                    {row.position}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-700">
                                                    {row.G1}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-700">
                                                    {row.G2}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-700">
                                                    {row.G3}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-700">
                                                    {row.Listed}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <p>
                                Horses finishing outside the top 10 score zero fantasy
                                points.
                            </p>
                        </RuleSection>

                        <RuleSection
                            id="horse-prices"
                            title="7. Horse Price Changes"
                        >
                            <p>
                                Horse prices change after official results according to
                                race grade and finishing result, provided the race had at
                                least 8 official starters.
                            </p>

                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                                <p className="font-bold text-amber-900">
                                    Minimum field size for price changes
                                </p>

                                <p className="mt-2 text-sm text-amber-900">
                                    A race must have at least 8 official starters for any
                                    horse price changes to apply. If fewer than 8 horses
                                    start the race, all horse prices remain unchanged.
                                    Fantasy points are still awarded normally.
                                </p>
                            </div>

                            <div className="overflow-hidden rounded-xl border border-slate-200">
                                <table className="w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-100">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                                                Result
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                                                Group 1
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                                                Group 2
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                                                Group 3
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                                                Listed
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-200 bg-white">
                                        {priceRows.map((row) => (
                                            <tr key={row.result}>
                                                <td className="px-4 py-3 font-bold text-slate-900">
                                                    {row.result}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-700">
                                                    {row.G1}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-700">
                                                    {row.G2}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-700">
                                                    {row.G3}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-700">
                                                    {row.Listed}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <ul className="list-disc space-y-2 pl-5">
                                <li>Horse prices never fall below $30,000.</li>
                                <li>
                                    Price changes only apply when there are at least 8
                                    official starters in the race.
                                </li>
                                <li>
                                    If fewer than 8 horses officially start, every horse in
                                    the race has no price movement, regardless of finishing
                                    position.
                                </li>
                                <li>
                                    Non-finishers count as official starters for the
                                    8-starter minimum, but still receive no fantasy points
                                    and no price movement themselves.
                                </li>
                                <li>
                                    Scratched horses do not count as official starters and
                                    create no price movement.
                                </li>
                                <li>
                                    Results not listed in the table create no price
                                    movement.
                                </li>
                            </ul>
                        </RuleSection>

                        <RuleSection
                            id="special-rules"
                            title="8. Special Rules"
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-xl border bg-slate-50 p-4">
                                    <h3 className="font-bold text-slate-900">
                                        Scratchings
                                    </h3>
                                    <div className="mt-2 space-y-2 text-sm text-slate-700">
                                        <p>
                                            If a horse in a team is scratched before
                                            lockout, it will automatically be replaced by
                                            the highest-projected horse the team can afford
                                            that is not already selected.
                                        </p>
                                        <p>
                                            A horse with another live nomination in the
                                            round is not treated as fully scratched.
                                        </p>
                                        <p>
                                            If no eligible replacement can be afforded, the
                                            scratched horse remains in the team and scores
                                            zero points.
                                        </p>
                                        <p>
                                            If a scratched captain is replaced, the
                                            highest-projected horse in the updated team
                                            becomes captain. If the scratched captain
                                            cannot be replaced, captaincy moves to the
                                            highest-projected other horse in the team.
                                        </p>
                                        <p>
                                            Scratchings after lockout remain in the team
                                            and score zero points, including when the
                                            scratched horse is captain.
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-xl border bg-slate-50 p-4">
                                    <h3 className="font-bold text-slate-900">
                                        Automatic team fill
                                    </h3>

                                    <p className="mt-2 text-sm text-slate-700">
                                        If a player does not complete their team before
                                        lockout, the remaining positions will be
                                        automatically filled using projected scores and
                                        the team&apos;s available salary cap. Existing
                                        valid selections are retained where possible.
                                    </p>
                                </div>

                                <div className="rounded-xl border bg-slate-50 p-4">
                                    <h3 className="font-bold text-slate-900">
                                        Dead heats
                                    </h3>
                                    <p className="mt-2 text-sm text-slate-700">
                                        Dead-heated horses receive the full fantasy points
                                        attached to their official finishing position. Any
                                        applicable price movement also applies, provided the
                                        race had at least 8 official starters.
                                    </p>
                                </div>

                                <div className="rounded-xl border bg-slate-50 p-4">
                                    <h3 className="font-bold text-slate-900">
                                        Non-finishers
                                    </h3>
                                    <p className="mt-2 text-sm text-slate-700">
                                        Non-finishers receive zero fantasy points and no
                                        price movement. They still count as official
                                        starters when determining whether the race meets the
                                        8-starter minimum for price changes.
                                    </p>
                                </div>

                                <div className="rounded-xl border bg-slate-50 p-4">
                                    <h3 className="font-bold text-slate-900">
                                        Official results
                                    </h3>
                                    <p className="mt-2 text-sm text-slate-700">
                                        Scores are based on the official placings declared
                                        on the day. Later amendments do not alter fantasy
                                        scores.
                                    </p>
                                </div>
                            </div>
                        </RuleSection>

                        <RuleSection id="leaderboards" title="9. Leaderboards">
                            <ul className="list-disc space-y-2 pl-5">
                                <li>
                                    The round leaderboard ranks teams by points scored in
                                    that round.
                                </li>
                                <li>
                                    The season leaderboard ranks players by total points
                                    across completed rounds.
                                </li>
                                <li>
                                    Tied players receive the same rank.
                                </li>
                            </ul>
                        </RuleSection>

                        <RuleSection
                            id="team-comparison"
                            title="10. Team Comparison"
                        >
                            <p>
                                After lockout, players may compare their team with
                                another eligible team from the same round.
                            </p>

                            <p>
                                Team selections remain hidden before lockout to protect
                                competitive integrity.
                            </p>
                        </RuleSection>

                        <section className="rounded-2xl bg-teal-700 p-6 text-white shadow-sm md:p-8">
                            <h2 className="text-2xl font-bold">
                                Ready to play?
                            </h2>

                            <p className="mt-2 text-teal-100">
                                Build your team before lockout and follow your score
                                throughout the round.
                            </p>

                            <div className="mt-5 flex flex-wrap gap-3">
                                <Link
                                    href="/team/edit"
                                    className="rounded-lg bg-amber-400 px-5 py-3 font-bold text-slate-900 transition hover:bg-amber-300"
                                >
                                    Select Team
                                </Link>

                                <Link
                                    href="/dashboard"
                                    className="rounded-lg border border-white/40 px-5 py-3 font-bold text-white transition hover:bg-white/10"
                                >
                                    Dashboard
                                </Link>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </main>
    );
}