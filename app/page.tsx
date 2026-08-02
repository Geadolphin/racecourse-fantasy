import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarClock,
  Check,
  ChessKnight,
  CircleDollarSign,
  Crown,
  Search,
  Trophy,
} from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Pick 10 horses",
    description:
      "Build your team from eligible Group and Listed races while staying within your available salary cap.",
  },
  {
    number: "02",
    title: "Choose a captain",
    description:
      "Nominate one selected horse as captain. Your captain scores double fantasy points for the round.",
  },
  {
    number: "03",
    title: "Follow the races",
    description:
      "Official results update scores, horse prices, rankings and your salary cap for the next round.",
  },
];

const features = [
  {
    icon: CircleDollarSign,
    title: "Rolling salary cap",
    description:
      "Your budget changes each round based on the price movements of the horses you selected.",
  },
  {
    icon: BarChart3,
    title: "Live scoring",
    description:
      "Track your round score, season total and leaderboard position as results become official.",
  },
  {
    icon: ChessKnight,
    title: "Horse research",
    description:
      "Review current prices, fantasy averages, eligible starts, race history and price history.",
  },
  {
    icon: Trophy,
    title: "Team comparison",
    description:
      "After lockout, compare your selections, captain and score against another manager.",
  },
];

const productHighlights = [
  "Selected Victorian and New South Wales Group and Listed races",
  "One team of 10 horses per round",
  "Captain scores double fantasy points",
  "Horse prices update after official results",
  "Round and season leaderboards",
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <section
        className="relative isolate overflow-hidden bg-slate-950 text-white"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(2,6,23,0.98) 0%, rgba(2,6,23,0.91) 44%, rgba(2,6,23,0.38) 74%, rgba(2,6,23,0.62) 100%), url('/landing/hero-racing.jpg')",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-teal-300">
              Fantasy horse racing
            </p>

            <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl lg:text-7xl">
              Pick your stable.
              <span className="block text-teal-300">
                Race for the season.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200 sm:text-xl">
              Select 10 horses from eligible Group and Listed races,
              choose a captain and compete on weekly and season
              leaderboards.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-lg bg-teal-400 px-6 py-3.5 font-bold text-slate-950 transition hover:bg-teal-300"
              >
                Create account
                <ArrowRight className="h-5 w-5" />
              </Link>

              <Link
                href="/rules"
                className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/5 px-6 py-3.5 font-bold text-white backdrop-blur transition hover:bg-white/10"
              >
                <BookOpen className="h-5 w-5" />
                Read the rules
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-200">
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-teal-300" />
                10-horse teams
              </span>

              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-teal-300" />
                Rolling salary cap
              </span>

              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-teal-300" />
                Live leaderboards
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Starting salary
            </p>
            <p className="mt-1 text-xl font-black text-slate-950">
              $2,500,000
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Team size
            </p>
            <p className="mt-1 text-xl font-black text-slate-950">
              10 horses
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Captain
            </p>
            <p className="mt-1 text-xl font-black text-slate-950">
              Double points
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Race scope
            </p>
            <p className="mt-1 text-xl font-black text-slate-950">
              Group & Listed
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-700">
            How it works
          </p>

          <p className="mt-4 text-lg leading-8 text-slate-600">
            Each round rewards strong race research, smart team value
            decisions and the right captain choice.
          </p>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-3">
          {steps.map((step) => (
            <article
              key={step.number}
              className="border-t-4 border-slate-950 pt-6"
            >
              <p className="text-sm font-black text-teal-700">
                {step.number}
              </p>

              <h3 className="mt-3 text-2xl font-black text-slate-950">
                {step.title}
              </h3>

              <p className="mt-3 leading-7 text-slate-600">
                {step.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-300">
              How a round works
            </p>

            <h2 className="mt-3 text-3xl font-black sm:text-4xl">
              Every round follows the same simple cycle.
            </h2>

            <p className="mt-5 text-lg leading-8 text-slate-300">
              Build your team before lockout, follow the races, then watch
              prices and salary caps update for the next round.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-6">
            {[
              ["1","Build your team","Select 10 horses and choose your captain before lockout."],
              ["2","Watch the races","Earn fantasy points from official Group and Listed race results."],
              ["3","Results become official","Scores, horse prices and rankings are updated automatically."],
              ["4","Salary cap changes","Your selected horses determine next round's available budget."],
              ["5","Climb the leaderboard","See where you rank for the round and the full season."],
              ["6","Go again","Use your new salary cap to build next week's team."]
            ].map(([n,t,d])=>(
              <div key={n} className="relative rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-teal-400 text-xl font-black text-slate-950">{n}</div>
                <h3 className="text-xl font-black">{t}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-700">
            Inside the game
          </p>

          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Everything you need for each round.
          </h2>
        </div>

        <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <article key={feature.title} className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-teal-300">
                  <Icon className="h-5 w-5" />
                </div>

                <div>
                  <h3 className="text-xl font-black text-slate-950">
                    {feature.title}
                  </h3>

                  <p className="mt-2 leading-7 text-slate-600">
                    {feature.description}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-700">
              Research before lockout
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Know what you are selecting.
            </h2>

            <p className="mt-5 text-lg leading-8 text-slate-600">
              Search every active horse and review current price,
              fantasy points, average score, eligible starts and
              official race history.
            </p>

            <Link
              href="/horses"
              className="mt-7 inline-flex items-center gap-2 font-black text-teal-700 transition hover:text-slate-950"
            >
              Explore the Horse Centre
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <Search className="h-6 w-6 text-teal-700" />
              <h3 className="mt-4 text-lg font-black">Search horses</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Find horses quickly and sort by price, points or
                average.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <CalendarClock className="h-6 w-6 text-teal-700" />
              <h3 className="mt-4 text-lg font-black">Race history</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Review official finishes, fantasy scores and price
                movements.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:col-span-2">
              <Crown className="h-6 w-6 text-teal-700" />
              <h3 className="mt-4 text-lg font-black">
                Make the captain call
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Your captain receives double fantasy points, making the
                decision one of the most important choices each round.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-teal-600 text-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              Ready to build your stable?
            </h2>

            <p className="mt-2 max-w-2xl text-lg text-teal-950">
              Create your account, select your first team and compete
              across the season.
            </p>
          </div>

          <Link
            href="/register"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-950 px-6 py-3.5 font-bold text-white transition hover:bg-slate-800"
          >
            Register free
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </main>
  );
}