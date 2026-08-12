"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import HorseProfileModal from "@/components/HorseProfileModal";

import { supabase } from "@/lib/supabase";

type Season = {
  id: string;
  name: string;
  salary_cap: number;
  team_size: number;
};

type Round = {
  id: string;
  season_id: string;
  round_number: number;
  name: string | null;
  status: string;
  lockout_at: string;
};

type Horse = {
  id: string;
  name: string;
};

type Racecourse = {
  id: string;
  name: string;
};

type Race = {
  id: string;
  race_number: number;
  race_name: string;
  grade: "L" | "G3" | "G2" | "G1";
  scheduled_start: string;
  racecourse: Racecourse | null;
};

type FixtureRace = {
  id: string;
  race_number: number;
  race_name: string;
  grade: "L" | "G3" | "G2" | "G1";
  distance_metres: number | null;
  scheduled_start: string;
  status: string;
  racecourse: Racecourse | null;
};

type RaceEntry = {
  id: string;
  race_id: string;
  horse_id: string;
  saddlecloth_number: number | null;
  price_at_entry: number;
  horse: Horse | null;
  race: Race | null;
};

type TeamStatus = "draft" | "submitted" | "locked" | "scored";

type Team = {
  id: string;
  user_id: string;
  round_id: string;
  team_name: string | null;
  status: TeamStatus;
  salary_used: number;
};

type TeamSelection = {
  id: string;
  team_id: string;
  race_entry_id: string;
  is_captain: boolean;
  selected_price: number;
  fantasy_points: number;
  has_result: boolean;
  race_entry: RaceEntry | null;
};

type MyTeamData = {
  success: boolean;
  message?: string;
  round: Round | null;
  season: Season | null;
  team: Team | null;
  selections: TeamSelection[];
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Melbourne",
  }).format(new Date(value));
}

function formatRaceTime(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Melbourne",
  }).format(new Date(value));
}

function getGradeLabel(grade: Race["grade"]) {
  const labels: Record<Race["grade"], string> = {
    G1: "G1",
    G2: "G2",
    G3: "G3",
    L: "Listed",
  };

  return labels[grade];
}

function getGradeClasses(grade: Race["grade"]) {
  switch (grade) {
    case "G1":
      return "bg-amber-400 text-amber-950";

    case "G2":
      return "bg-blue-600 text-white";

    case "G3":
      return "bg-teal-600 text-white";

    case "L":
      return "bg-slate-300 text-slate-900";
  }
}

function getStatusLabel(status: TeamStatus) {
  const labels: Record<TeamStatus, string> = {
    draft: "Draft",
    submitted: "Submitted",
    locked: "Locked",
    scored: "Scored",
  };

  return labels[status];
}

function getCountdown(lockoutAt: string, currentTime: number) {
  const difference =
    new Date(lockoutAt).getTime() - currentTime;

  if (difference <= 0) {
    return "Round Locked";
  }

  const days = Math.floor(
    difference / (1000 * 60 * 60 * 24)
  );

  const hours = Math.floor(
    (difference % (1000 * 60 * 60 * 24)) /
    (1000 * 60 * 60)
  );

  const minutes = Math.floor(
    (difference % (1000 * 60 * 60)) /
    (1000 * 60)
  );

  const seconds = Math.floor(
    (difference % (1000 * 60)) / 1000
  );

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }

  return `${hours}h ${minutes}m ${seconds}s`;
}


type IconName =
  | "trophy"
  | "wallet"
  | "horse"
  | "star"
  | "clock"
  | "calendar"
  | "flag"
  | "edit"
  | "chevron";

function Icon({
  name,
  className = "h-4 w-4",
}: {
  name: IconName;
  className?: string;
}) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const paths: Record<IconName, ReactNode> = {
    trophy: (
      <>
        <path {...common} d="M8 4h8v3a4 4 0 0 1-8 0V4Z" />
        <path {...common} d="M8 6H5v1a3 3 0 0 0 3 3" />
        <path {...common} d="M16 6h3v1a3 3 0 0 1-3 3" />
        <path {...common} d="M12 11v4" />
        <path {...common} d="M9 19h6" />
        <path {...common} d="M10 15h4v4h-4z" />
      </>
    ),
    wallet: (
      <>
        <rect {...common} x="3" y="6" width="18" height="13" rx="2" />
        <path {...common} d="M16 10h5v5h-5a2.5 2.5 0 0 1 0-5Z" />
        <path {...common} d="M5 6V5a2 2 0 0 1 2-2h10" />
      </>
    ),
    horse: (
      <>
        <path {...common} d="M6 19v-5l2-4 4-2 2-4 4 2-1 4 2 3v6" />
        <path {...common} d="M9 19v-4h7v4" />
        <path {...common} d="M14 8l3 2" />
      </>
    ),
    star: (
      <path
        {...common}
        d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9L12 3Z"
      />
    ),
    clock: (
      <>
        <circle {...common} cx="12" cy="12" r="8.5" />
        <path {...common} d="M12 7v5l3 2" />
      </>
    ),
    calendar: (
      <>
        <rect {...common} x="3" y="5" width="18" height="16" rx="2" />
        <path {...common} d="M7 3v4M17 3v4M3 9h18" />
      </>
    ),
    flag: (
      <>
        <path {...common} d="M5 21V4" />
        <path {...common} d="M5 5h11l-2 3 2 3H5" />
      </>
    ),
    edit: (
      <>
        <path {...common} d="M4 20h4l11-11-4-4L4 16v4Z" />
        <path {...common} d="m13.5 6.5 4 4" />
      </>
    ),
    chevron: <path {...common} d="m9 6 6 6-6 6" />,
  };

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}


function OfficialTeamStat({
  icon,
  label,
  value,
  emphasis = "default",
}: {
  icon: IconName;
  label: string;
  value: string;
  emphasis?: "default" | "teal" | "amber";
}) {
  const valueClasses =
    emphasis === "teal"
      ? "text-teal-300"
      : emphasis === "amber"
        ? "text-amber-300"
        : "text-white";

  const iconClasses =
    emphasis === "amber"
      ? "text-amber-300"
      : "text-teal-300";

  return (
    <div className="min-w-0 bg-slate-900 px-4 py-3.5">
      <div className={`flex items-center gap-2 ${iconClasses}`}>
        <Icon name={icon} className="h-4 w-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
          {label}
        </p>
      </div>

      <p className={`mt-1.5 truncate text-lg font-black ${valueClasses}`}>
        {value}
      </p>
    </div>
  );
}

export default function MyTeamPage() {
  const [season, setSeason] = useState<Season | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [team, setTeam] = useState<Team | null>(null);

  const [selections, setSelections] = useState<
    TeamSelection[]
  >([]);
  const [fixtureRaces, setFixtureRaces] = useState<FixtureRace[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedHorseId, setSelectedHorseId] = useState<string | null>(
    null
  );

  const [currentTime, setCurrentTime] = useState(() =>
    Date.now()
  );

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase.rpc(
      "get_my_team_data"
    );

    if (error) {
      console.error("My Team RPC error:", error);

      setRound(null);
      setSeason(null);
      setTeam(null);
      setSelections([]);
      setFixtureRaces([]);

      setErrorMessage(
        error.message ||
          "Your team information could not be loaded."
      );

      setLoading(false);
      return;
    }

    const teamData = data as MyTeamData | null;

    if (!teamData?.round || !teamData.season) {
      setRound(null);
      setSeason(null);
      setTeam(null);
      setSelections([]);
      setFixtureRaces([]);

      setErrorMessage(
        teamData?.message ||
          "There is no open, locked or completed round."
      );

      setLoading(false);
      return;
    }

    setRound(teamData.round);
    setSeason(teamData.season);
    setTeam(teamData.team);
    setSelections(teamData.selections ?? []);

    const { data: fixtureData, error: fixtureError } = await supabase
      .from("races")
      .select(`
        id,
        race_number,
        race_name,
        grade,
        distance_metres,
        scheduled_start,
        status,
        racecourse:racecourses (id, name)
      `)
      .eq("round_id", teamData.round.id)
      .order("scheduled_start", { ascending: true })
      .order("race_number", { ascending: true });

    if (fixtureError) {
      console.error("My Team fixture error:", fixtureError);
      setFixtureRaces([]);
    } else {
      const loadedFixture = ((fixtureData ?? []) as Array<Record<string, unknown>>).map((race) => {
        const rawRacecourse = race.racecourse;
        const racecourse = Array.isArray(rawRacecourse)
          ? (rawRacecourse[0] as Racecourse | undefined) ?? null
          : (rawRacecourse as Racecourse | null);

        return {
          id: String(race.id),
          race_number: Number(race.race_number),
          race_name: String(race.race_name),
          grade: race.grade as FixtureRace["grade"],
          distance_metres: race.distance_metres == null ? null : Number(race.distance_metres),
          scheduled_start: String(race.scheduled_start),
          status: String(race.status),
          racecourse,
        };
      });

      setFixtureRaces(loadedFixture);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const sortedSelections = useMemo(() => {
    return [...selections].sort((a, b) => {
      const scheduledStartA = a.race_entry?.race?.scheduled_start
        ? new Date(a.race_entry.race.scheduled_start).getTime()
        : Number.MAX_SAFE_INTEGER;

      const scheduledStartB = b.race_entry?.race?.scheduled_start
        ? new Date(b.race_entry.race.scheduled_start).getTime()
        : Number.MAX_SAFE_INTEGER;

      if (scheduledStartA !== scheduledStartB) {
        return scheduledStartA - scheduledStartB;
      }

      const raceNumberA =
        a.race_entry?.race?.race_number ?? 999;

      const raceNumberB =
        b.race_entry?.race?.race_number ?? 999;

      if (raceNumberA !== raceNumberB) {
        return raceNumberA - raceNumberB;
      }

      const saddleclothA =
        a.race_entry?.saddlecloth_number ?? 999;

      const saddleclothB =
        b.race_entry?.saddlecloth_number ?? 999;

      if (saddleclothA !== saddleclothB) {
        return saddleclothA - saddleclothB;
      }

      return (a.race_entry?.horse?.name ?? "").localeCompare(
        b.race_entry?.horse?.name ?? ""
      );
    });
  }, [selections]);

  const salaryUsed = useMemo(() => {
    return selections.reduce((total, selection) => {
      return total + selection.selected_price;
    }, 0);
  }, [selections]);


  const totalPoints = useMemo(() => {
    return selections.reduce((total, selection) => {
      const basePoints = selection.fantasy_points ?? 0;

      return total + (selection.is_captain ? basePoints * 2 : basePoints);
    }, 0);
  }, [selections]);


  const latestResultSelection = useMemo(() => {
    return [...selections]
      .filter((selection) => selection.has_result && selection.race_entry?.race?.scheduled_start)
      .sort((a, b) =>
        new Date(b.race_entry!.race!.scheduled_start).getTime() -
        new Date(a.race_entry!.race!.scheduled_start).getTime()
      )[0] ?? null;
  }, [selections]);

  const captainName = useMemo(() => {
    return (
      selections.find((selection) => selection.is_captain)
        ?.race_entry?.horse?.name ?? "Not selected"
    );
  }, [selections]);

  const salaryRemaining = season
    ? season.salary_cap - salaryUsed
    : 0;

  const lockoutHasStarted =
    round !== null &&
    currentTime >= new Date(round.lockout_at).getTime();

  const editButtonVisible =
    round !== null &&
    !lockoutHasStarted &&
    team?.status !== "locked" &&
    team?.status !== "scored";

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-6xl rounded-xl border bg-white p-10 text-center text-slate-500">
          Loading your team...
        </div>
      </main>
    );
  }

  if (!round || !season) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-4xl rounded-xl border bg-white p-8">
          <h1 className="text-2xl font-bold text-slate-900">
            My Team
          </h1>

          <p className="mt-4 text-red-700">
            {errorMessage ||
              "There is no current round."}
          </p>
        </div>
      </main>
    );
  }

  if (!team) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 md:p-8">
        <div className="mx-auto max-w-6xl">
          <header className="rounded-2xl bg-teal-700 p-6 text-white shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-green-200">
              {season.name}
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              My Team
            </h1>

            <p className="mt-2 text-teal-100">
              Round {round.round_number}
              {round.name ? ` — ${round.name}` : ""}
            </p>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-300">
                {lockoutHasStarted
                  ? "Lockout Status"
                  : "Lockout Countdown"}
              </p>

              <p className="mt-1 text-2xl font-bold">
                {lockoutHasStarted && "🔒 "}
                {getCountdown(
                  round.lockout_at,
                  currentTime
                )}
              </p>

              <p className="mt-2 text-sm text-teal-100">
                Lockout:{" "}
                {formatDateTime(round.lockout_at)}
              </p>
            </div>
          </header>

          <section className="mt-6 rounded-xl border bg-white p-10 text-center">
            <h2 className="text-2xl font-bold text-slate-900">
              You have not created a team yet
            </h2>

            <p className="mt-3 text-slate-600">
              Select your horses and captain before the
              round lockout.
            </p>

            {!lockoutHasStarted ? (
              <Link
                href="/team/edit"
                className="mt-6 inline-flex rounded-lg bg-teal-700 px-6 py-3 font-bold text-white transition hover:bg-teal-800"
              >
                Create Team
              </Link>
            ) : (
              <p className="mt-6 font-semibold text-red-700">
                Team selection is closed because round
                lockout has commenced.
              </p>
            )}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-10">
        <header className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-lg">
          <div className="border-b border-slate-800 px-5 py-3 md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-300">
                  Official Team Sheet
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="font-semibold text-slate-400">
                    {season.name} · Round {round.round_number}
                    {round.name ? ` — ${round.name}` : ""}
                  </span>

                  <span className="inline-flex items-center gap-1.5 text-slate-300">
                    <Icon name="clock" className="h-3.5 w-3.5 text-teal-300" />
                    {lockoutHasStarted ? "Round locked" : "Next lockout"}:
                    <strong className="text-white">
                      {getCountdown(round.lockout_at, currentTime)}
                    </strong>
                  </span>

                  <span className="text-slate-500">
                    {formatDateTime(round.lockout_at)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-200">
                  {getStatusLabel(team.status)}
                </span>

                {editButtonVisible && (
                  <Link
                    href="/team/edit"
                    className="inline-flex items-center justify-center rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-black text-slate-950 transition hover:bg-teal-400"
                  >
                    <Icon name="edit" className="mr-1.5 h-3.5 w-3.5" />
                    Edit Team
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(620px,1.5fr)]">
            <div className="p-5 md:p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-300">
                  My Team
                </p>

                <h1 className="mt-1 truncate text-2xl font-black tracking-tight md:text-3xl">
                  {team.team_name?.trim() || "My Team"}
                </h1>
              </div>


            </div>

            <div className="grid grid-cols-2 gap-px border-t border-slate-800 bg-slate-800 lg:grid-cols-4 xl:border-l xl:border-t-0">
              <OfficialTeamStat
                icon="trophy"
                label="Total Score"
                value={`${totalPoints} pts`}
                emphasis="teal"
              />

              <OfficialTeamStat
                icon="wallet"
                label="Team Salary"
                value={formatCurrency(salaryUsed)}
              />

              <OfficialTeamStat
                icon="wallet"
                label="Remaining"
                value={formatCurrency(salaryRemaining)}
                emphasis="teal"
              />

              <OfficialTeamStat
                icon="star"
                label="Captain"
                value={captainName}
                emphasis="amber"
              />
            </div>
          </div>
        </header>

        {errorMessage && (
          <div className="mt-5 rounded-xl border border-red-300 bg-red-50 p-4 font-medium text-red-800">
            {errorMessage}
          </div>
        )}


        <section className="mt-7">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0">
              <div className="mb-4 flex flex-col gap-2 border-b border-slate-300 pb-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">
                    Stable Line-up
                  </p>

                  <div className="mt-1 flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950 text-teal-300">
                      <Icon name="horse" className="h-4.5 w-4.5" />
                    </span>

                    <h2 className="text-2xl font-black text-slate-950">
                      Selected Horses
                    </h2>
                  </div>

                  <p className="mt-1 text-sm text-slate-600">
                    Your team for Round {round.round_number}. Select a horse card to view its statistics.
                  </p>
                </div>

                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Captain scores 2× points
                </p>
              </div>

              {sortedSelections.length === 0 ? (
                <div className="rounded-xl border bg-white p-10 text-center text-slate-500 shadow-sm">
                  No horses have been selected.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {sortedSelections.map((selection) => {
                    const entry = selection.race_entry;
                    const horse = entry?.horse;
                    const race = entry?.race;
                    const displayedPoints = selection.is_captain
                      ? (selection.fantasy_points ?? 0) * 2
                      : selection.fantasy_points ?? 0;

                    return (
                      <article
                        key={selection.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => horse?.id && setSelectedHorseId(horse.id)}
                        onKeyDown={(event) => {
                          if ((event.key === "Enter" || event.key === " ") && horse?.id) {
                            event.preventDefault();
                            setSelectedHorseId(horse.id);
                          }
                        }}
                        className={`cursor-pointer overflow-hidden rounded-xl border px-4 py-3.5 shadow-sm transition hover:border-teal-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                          selection.is_captain
                            ? "border-amber-300 bg-amber-50/50"
                            : "border-slate-200 bg-white"
                        }`}
                        aria-label={horse ? `View statistics for ${horse.name}` : "Horse statistics unavailable"}
                      >
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <h3 className="truncate text-base font-bold text-slate-950 sm:text-lg">
                                {horse?.name ?? "Unknown horse"}
                              </h3>
                              {selection.is_captain && (
                                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-amber-950 shadow-sm">
                                  C
                                </span>
                              )}
                            </div>

                            <p className="mt-1 truncate text-sm font-medium text-slate-800">
                              {race ? `R${race.race_number} • ${race.race_name}` : "Race unavailable"}
                            </p>

                            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                              {race && (
                                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${getGradeClasses(race.grade)}`}>
                                  {getGradeLabel(race.grade)}
                                </span>
                              )}
                              {race?.racecourse && <span className="text-sm font-medium text-slate-700">{race.racecourse.name}</span>}
                              {race && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-700">
                                    <Icon name="clock" className="h-3.5 w-3.5 text-slate-400" />
                                    {formatRaceTime(race.scheduled_start)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex min-w-[108px] flex-col items-end">
                            <Icon
                              name="chevron"
                              className="mb-1 hidden h-4 w-4 text-slate-300 sm:block"
                            />
                            {!selection.has_result ? (
                              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">Upcoming</span>
                            ) : (
                              <div className="text-right">
                                <p className="text-2xl font-bold leading-none text-teal-700 sm:text-3xl">{displayedPoints}</p>
                                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{selection.is_captain ? "pts · 2×" : "pts"}</p>
                              </div>
                            )}
                            <p className="mt-3 text-sm font-bold text-slate-950">{formatCurrency(selection.selected_price)}</p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <aside className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-800 bg-slate-950 px-4 py-3 text-white">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-teal-300 ring-1 ring-slate-700">
                      <Icon name="calendar" />
                    </span>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-teal-300">
                        Race day
                      </p>
                      <h2 className="text-sm font-black uppercase tracking-wide text-white">
                        Round {round.round_number} Fixture
                      </h2>
                    </div>
                  </div>
                </div>
                {fixtureRaces.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-slate-500">Fixture details are not available yet.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {fixtureRaces.map((fixtureRace) => {
                      const isComplete = ["official", "abandoned", "cancelled"].includes(fixtureRace.status);
                      return (
                        <div key={fixtureRace.id} className="grid grid-cols-[70px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition hover:bg-slate-50">
                          <p className="text-sm font-bold text-slate-950">{formatRaceTime(fixtureRace.scheduled_start)}</p>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950">R{fixtureRace.race_number} · {fixtureRace.race_name}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                              <span className={`rounded px-1.5 py-0.5 font-bold ${getGradeClasses(fixtureRace.grade)}`}>{getGradeLabel(fixtureRace.grade)}</span>
                              {fixtureRace.distance_metres && <span>{fixtureRace.distance_metres}m</span>}
                              {fixtureRace.racecourse && <><span>•</span><span>{fixtureRace.racecourse.name}</span></>}
                            </div>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                            isComplete ? "bg-emerald-100 text-emerald-800" : fixtureRace.status === "running" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
                          }`}>
                            {fixtureRace.status === "official" ? "Complete" : fixtureRace.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950 px-4 py-3 text-white">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-teal-300 ring-1 ring-slate-700">
                    <Icon name="flag" />
                  </span>
                  <h2 className="text-sm font-black uppercase tracking-wide text-white">
                    Latest Result
                  </h2>
                </div>

                <div className="p-4">
                {latestResultSelection?.race_entry?.horse && latestResultSelection.race_entry.race ? (
                  <div className="mt-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-950">{latestResultSelection.race_entry.horse.name}</p>
                      <p className="mt-1 truncate text-sm text-slate-600">R{latestResultSelection.race_entry.race.race_number} · {latestResultSelection.race_entry.race.race_name}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-2xl font-bold text-teal-700">{latestResultSelection.is_captain ? latestResultSelection.fantasy_points * 2 : latestResultSelection.fantasy_points}</p>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">pts</p>
                    </div>
                  </div>
                ) : <p className="mt-3 text-sm text-slate-500">No official results yet.</p>}
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>

      <HorseProfileModal
        horseId={selectedHorseId}
        onClose={() => setSelectedHorseId(null)}
      />
    </main>
  );
}