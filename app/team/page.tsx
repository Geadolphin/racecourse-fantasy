"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toBlob } from "html-to-image";

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
  current_price: number;
  silks_url: string | null;
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
  projected_points: number | null;
  horse: Horse | null;
  race: Race | null;
};

type ActiveNomination = {
  id: string;
  race_id: string;
  horse_id: string;
  saddlecloth_number: number | null;
  projected_points: number | null;
  entry_status: string;
  race: FixtureRace | null;
};

type LatestRaceResult = {
  race_entry_id: string;
  finishing_position: number;
  fantasy_points: number;
  horse_id: string;
  horse_name: string;
};


type RaceResultRow = {
  result_id: string;
  horse_id: string;
  horse_name: string;
  saddlecloth_number: number | null;
  finishing_position: number | null;
  result_status: string;
  fantasy_points: number;
  price_change: number;
  price_before: number;
  price_after: number;
  is_dead_heat: boolean;
};

type RaceResultsData = {
  success: boolean;
  race: {
    id: string;
    race_number: number;
    race_name: string;
    grade: Race["grade"];
    scheduled_start: string;
    status: string;
    racecourse: Racecourse | null;
  } | null;
  results: RaceResultRow[];
  message?: string;
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
  is_scratched: boolean;
  race_entry: RaceEntry | null;
  active_nominations?: ActiveNomination[];
};

type MyTeamData = {
  success: boolean;
  message?: string;
  round: Round | null;
  season: Season | null;
  team: Team | null;
  selections: TeamSelection[];
  fixture_races?: FixtureRace[];
  latest_result_race?: FixtureRace | null;
  latest_race_results?: LatestRaceResult[];
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
      return "bg-slate-400 text-white";
    case "G3":
      return "bg-teal-500 text-white";
    case "L":
      return "bg-blue-100 text-blue-800";
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

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getFinishLabel(
  finishingPosition: number | null,
  resultStatus: string
) {
  if (resultStatus !== "finished" || finishingPosition === null) {
    return titleCase(resultStatus);
  }

  const remainderTen = finishingPosition % 10;
  const remainderHundred = finishingPosition % 100;
  let suffix = "th";

  if (remainderHundred < 11 || remainderHundred > 13) {
    if (remainderTen === 1) suffix = "st";
    if (remainderTen === 2) suffix = "nd";
    if (remainderTen === 3) suffix = "rd";
  }

  return `${finishingPosition}${suffix}`;
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
  | "share"
  | "chevron"
  | "close";

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
    share: (
      <>
        <circle {...common} cx="18" cy="5" r="2.5" />
        <circle {...common} cx="6" cy="12" r="2.5" />
        <circle {...common} cx="18" cy="19" r="2.5" />
        <path {...common} d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" />
      </>
    ),
    chevron: <path {...common} d="m9 6 6 6-6 6" />,
    close: (
      <>
        <path {...common} d="M6 6l12 12" />
        <path {...common} d="M18 6 6 18" />
      </>
    ),
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
  label,
  value,
  emphasis = "default",
}: {
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


  return (
    <div className="min-w-0 bg-slate-900 px-4 py-3.5">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>

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
  const [currentHorsePrices, setCurrentHorsePrices] = useState<
    Record<string, number>
  >({});
  const [projectedPointsByEntryId, setProjectedPointsByEntryId] = useState<
    Record<string, number | null>
  >({});
  const [fixtureRaces, setFixtureRaces] = useState<FixtureRace[]>([]);
  const [latestResultRace, setLatestResultRace] =
    useState<FixtureRace | null>(null);
  const [latestRaceResults, setLatestRaceResults] =
    useState<LatestRaceResult[]>([]);

  const [selectedRaceId, setSelectedRaceId] =
    useState<string | null>(null);
  const [raceResultsData, setRaceResultsData] =
    useState<RaceResultsData | null>(null);
  const [raceResultsLoading, setRaceResultsLoading] =
    useState(false);
  const [raceResultsError, setRaceResultsError] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedHorseId, setSelectedHorseId] = useState<string | null>(
    null
  );

  const [shareOpen, setShareOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState("");
  const shareCardRef = useRef<HTMLDivElement | null>(null);

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
      setCurrentHorsePrices({});
      setProjectedPointsByEntryId({});
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
      setCurrentHorsePrices({});
      setProjectedPointsByEntryId({});
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

    const loadedSelections = teamData.selections ?? [];

    const priceMap: Record<string, number> = {};
    const projectionMap: Record<string, number | null> = {};

    for (const selection of loadedSelections) {
      const entry = selection.race_entry;
      const horse = entry?.horse;

      if (entry) {
        projectionMap[entry.id] =
          entry.projected_points == null
            ? null
            : Number(entry.projected_points);
      }

      if (horse?.id) {
        priceMap[horse.id] = Number(
          horse.current_price ?? selection.selected_price
        );
      }
    }

    setProjectedPointsByEntryId(projectionMap);
    setCurrentHorsePrices(priceMap);
    setSelections(loadedSelections);

    setFixtureRaces(teamData.fixture_races ?? []);
    setLatestResultRace(teamData.latest_result_race ?? null);
    setLatestRaceResults(teamData.latest_race_results ?? []);

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

  useEffect(() => {
    if (!selectedRaceId) {
      setRaceResultsData(null);
      setRaceResultsError("");
      return;
    }

    let active = true;

    async function loadRaceResults() {
      setRaceResultsLoading(true);
      setRaceResultsError("");

      const { data, error } = await supabase.rpc(
        "get_calendar_race_results",
        {
          p_race_id: selectedRaceId,
        }
      );

      if (!active) {
        return;
      }

      if (error) {
        console.error("My Team race results error:", error);
        setRaceResultsError(
          error.message || "The race results could not be loaded."
        );
        setRaceResultsData(null);
        setRaceResultsLoading(false);
        return;
      }

      setRaceResultsData(data as unknown as RaceResultsData);
      setRaceResultsLoading(false);
    }

    void loadRaceResults();

    return () => {
      active = false;
    };
  }, [selectedRaceId]);

  useEffect(() => {
    if (!selectedRaceId) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedRaceId(null);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedRaceId]);

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

  const liveProjectedScore = useMemo(() => {
    return selections.reduce((total, selection) => {
      const projectedPoints =
        selection.race_entry?.projected_points ??
        projectedPointsByEntryId[selection.race_entry_id] ??
        0;

      const baseValue = selection.has_result
        ? selection.fantasy_points ?? 0
        : projectedPoints;

      return total + (selection.is_captain ? baseValue * 2 : baseValue);
    }, 0);
  }, [selections, projectedPointsByEntryId]);

  const salaryRemaining = season
    ? season.salary_cap - salaryUsed
    : 0;

  const roundIsComplete = round?.status === "completed";

  const lockoutHasStarted =
    round !== null &&
    currentTime >= new Date(round.lockout_at).getTime();

  const editButtonVisible =
    round !== null &&
    !lockoutHasStarted &&
    team?.status !== "locked" &&
    team?.status !== "scored";

  const handleShareTeam = useCallback(async () => {
    if (!shareCardRef.current || !team || !round) return;

    setShareBusy(true);
    setShareError("");

    try {
      const blob = await toBlob(shareCardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#f8fafc",
      });

      if (!blob) {
        throw new Error("The team image could not be created.");
      }

      const fileName = `racecourse-fantasy-round-${round.round_number}-team.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      if (
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        await navigator.share({
          title: `${team.team_name?.trim() || "My Team"} — Racecourse Fantasy`,
          text: `My Racecourse Fantasy team for Round ${round.round_number}`,
          files: [file],
        });
      } else {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      console.error("Share team error:", error);
      setShareError(
        error instanceof Error ? error.message : "The team image could not be shared."
      );
    } finally {
      setShareBusy(false);
    }
  }, [round, team]);

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

                <button
                  type="button"
                  onClick={() => {
                    setShareError("");
                    setShareOpen(true);
                  }}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-black text-white transition hover:border-teal-400 hover:text-teal-300"
                >
                  <Icon name="share" className="mr-1.5 h-3.5 w-3.5" />
                  Share Team
                </button>

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
                label="Current Score"
                value={`${totalPoints} pts`}
                emphasis="teal"
              />

              <OfficialTeamStat
                label="Projected Score"
                value={`${liveProjectedScore} pts`}
                emphasis="amber"
              />

              <OfficialTeamStat
                label="Team Salary"
                value={formatCurrency(salaryUsed)}
              />

              <OfficialTeamStat
                label="Remaining"
                value={formatCurrency(salaryRemaining)}
                emphasis="teal"
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

                  <div className="mt-1">
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
                    const activeNominations = selection.active_nominations ?? [];
                    const isScratched = selection.is_scratched === true;
                    const displayedPoints = selection.is_captain
                      ? (selection.fantasy_points ?? 0) * 2
                      : selection.fantasy_points ?? 0;

                    const projectedPoints =
                      entry?.projected_points ??
                      projectedPointsByEntryId[selection.race_entry_id] ??
                      null;

                    const displayedProjectedPoints =
                      projectedPoints === null
                        ? null
                        : selection.is_captain
                          ? projectedPoints * 2
                          : projectedPoints;

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
                        className={`cursor-pointer overflow-hidden rounded-xl border px-4 py-3.5 shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          isScratched
                            ? "border-red-300 bg-red-50 hover:border-red-400 focus:ring-red-500"
                            : selection.is_captain
                              ? "border-amber-300 bg-amber-50/50 hover:border-amber-400 focus:ring-amber-500"
                              : "border-slate-200 bg-white hover:border-teal-300 focus:ring-teal-500"
                        }`}
                        aria-label={horse ? `View statistics for ${horse.name}` : "Horse statistics unavailable"}
                      >
                        <div className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-4">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center">
                            {horse?.silks_url ? (
                              <img
                                src={horse.silks_url}
                                alt={`${horse.name} silks`}
                                className="max-h-14 max-w-14 object-contain"
                              />
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-[9px] font-black uppercase tracking-wide text-slate-400">
                                No Silks
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <h3 className="truncate text-base font-bold text-slate-950 md:text-xl">
                                {horse?.name ?? "Unknown horse"}
                              </h3>

                              {selection.is_captain && (
                                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-amber-950 shadow-sm">
                                  C
                                </span>
                              )}

                            </div>

                            <div className="mt-2 space-y-2">
                              {activeNominations.length > 0 ? (
                                activeNominations.map((nomination) => {
                                  const nominationRace = nomination.race;

                                  if (!nominationRace) {
                                    return null;
                                  }

                                  return (
                                    <div key={nomination.id} className="min-w-0">
                                      <div className="flex min-w-0 items-center gap-2">
                                        <p className="truncate text-sm font-semibold text-slate-800">
                                          R{nominationRace.race_number} • {nominationRace.race_name}
                                        </p>

                                        <span
                                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${getGradeClasses(
                                            nominationRace.grade
                                          )}`}
                                        >
                                          {getGradeLabel(nominationRace.grade)}
                                        </span>
                                      </div>

                                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-600">
                                        {nominationRace.racecourse && (
                                          <span>{nominationRace.racecourse.name}</span>
                                        )}

                                        {nominationRace.racecourse && (
                                          <span className="text-slate-300">•</span>
                                        )}

                                        <span className="inline-flex items-center gap-1">
                                          <Icon
                                            name="clock"
                                            className="h-3 w-3 text-slate-400"
                                          />
                                          {formatRaceTime(nominationRace.scheduled_start)}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })
                              ) : race ? (
                                <div className="min-w-0">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <p
                                      className={`truncate text-sm font-semibold ${
                                        isScratched ? "text-red-800" : "text-slate-800"
                                      }`}
                                    >
                                      R{race.race_number} • {race.race_name}
                                    </p>

                                    <span
                                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${getGradeClasses(
                                        race.grade
                                      )}`}
                                    >
                                      {getGradeLabel(race.grade)}
                                    </span>
                                  </div>

                                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-600">
                                    {race.racecourse && (
                                      <span>{race.racecourse.name}</span>
                                    )}

                                    {race.racecourse && (
                                      <span className="text-slate-300">•</span>
                                    )}

                                    <span className="inline-flex items-center gap-1">
                                      <Icon
                                        name="clock"
                                        className="h-3 w-3 text-slate-400"
                                      />
                                      {formatRaceTime(race.scheduled_start)}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-slate-500">
                                  Race unavailable
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex min-w-[108px] flex-col items-end">
                            <Icon
                              name="chevron"
                              className="mb-1 hidden h-4 w-4 text-slate-300 sm:block"
                            />
                            {!selection.has_result ? (
                              <div className="text-right">
                                {isScratched ? (
                                  <>
                                    <p className="text-lg font-black uppercase leading-none text-red-700">
                                      Scratched
                                    </p>                                  </>
                                ) : displayedProjectedPoints === null ? (
                                  <>
                                    <p className="text-lg font-semibold leading-none text-slate-400">
                                      —
                                    </p>
                                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      Projection
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <p className="text-2xl font-bold leading-none text-amber-600 sm:text-3xl">
                                      {displayedProjectedPoints}
                                    </p>
                                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      {selection.is_captain
                                        ? "projected pts · 2×"
                                        : "projected pts"}
                                    </p>
                                  </>
                                )}
                              </div>
                            ) : (
                              <div className="text-right">
                                <p className="text-2xl font-bold leading-none text-teal-600 sm:text-3xl">{displayedPoints}</p>
                                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{selection.is_captain ? "pts · 2×" : "pts"}</p>
                              </div>
                            )}
                            <div className="mt-3 text-right">
                              <p className="text-sm font-bold text-slate-950">
                                {formatCurrency(
                                  roundIsComplete && horse?.id
                                    ? currentHorsePrices[horse.id] ??
                                        selection.selected_price
                                    : selection.selected_price
                                )}
                              </p>

                              {roundIsComplete &&
                                horse?.id &&
                                currentHorsePrices[horse.id] !== undefined &&
                                currentHorsePrices[horse.id] !==
                                  selection.selected_price && (
                                  <p
                                    className={`mt-0.5 text-[11px] font-bold ${
                                      currentHorsePrices[horse.id] >
                                      selection.selected_price
                                        ? "text-emerald-700"
                                        : "text-red-700"
                                    }`}
                                  >
                                    {currentHorsePrices[horse.id] >
                                    selection.selected_price
                                      ? "+"
                                      : ""}
                                    {formatCurrency(
                                      currentHorsePrices[horse.id] -
                                        selection.selected_price
                                    )}
                                  </p>
                                )}
                            </div>
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
                        <button
                          key={fixtureRace.id}
                          type="button"
                          onClick={() => setSelectedRaceId(fixtureRace.id)}
                          className="grid w-full grid-cols-[70px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500"
                          aria-label={`View race details for ${fixtureRace.race_name}`}
                        >
                          <p className="text-sm font-bold text-slate-950">
                            {formatRaceTime(fixtureRace.scheduled_start)}
                          </p>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950">
                              R{fixtureRace.race_number} · {fixtureRace.race_name}
                            </p>

                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                              <span className={`rounded px-1.5 py-0.5 font-bold ${getGradeClasses(fixtureRace.grade)}`}>
                                {getGradeLabel(fixtureRace.grade)}
                              </span>

                              {fixtureRace.distance_metres && (
                                <span>{fixtureRace.distance_metres}m</span>
                              )}

                              {fixtureRace.racecourse && (
                                <>
                                  <span>•</span>
                                  <span>{fixtureRace.racecourse.name}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                                isComplete
                                  ? "bg-emerald-100 text-emerald-800"
                                  : fixtureRace.status === "running"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {fixtureRace.status === "official"
                                ? "Complete"
                                : fixtureRace.status}
                            </span>

                            <Icon
                              name="chevron"
                              className="h-4 w-4 text-slate-400"
                            />
                          </div>
                        </button>
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

                <div>
                  {latestResultRace && latestRaceResults.length > 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedRaceId(latestResultRace.id)}
                        className="w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500"
                        aria-label={`View full results for ${latestResultRace.race_name}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-950">
                              R{latestResultRace.race_number} · {latestResultRace.race_name}
                            </p>
                            <p className="mt-1 text-xs font-medium text-slate-500">
                              {getGradeLabel(latestResultRace.grade)}
                              {latestResultRace.racecourse
                                ? ` · ${latestResultRace.racecourse.name}`
                                : ""}
                            </p>
                          </div>

                          <span className="shrink-0 text-xs font-black text-teal-700">
                            Full results →
                          </span>
                        </div>
                      </button>

                      <div className="divide-y divide-slate-100">
                        {latestRaceResults.map((result) => (
                          <button
                            key={result.race_entry_id}
                            type="button"
                            onClick={() =>
                              result.horse_id &&
                              setSelectedHorseId(result.horse_id)
                            }
                            className="grid w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                          >
                            <span className="text-center text-sm font-black text-slate-500">
                              {result.finishing_position}
                            </span>

                            <span className="truncate font-bold text-slate-950">
                              {result.horse_name}
                            </span>

                            <span className="shrink-0 text-right">
                              <span className="text-lg font-black text-teal-700">
                                {result.fantasy_points}
                              </span>
                              <span className="ml-1 text-xs font-bold uppercase text-slate-500">
                                pts
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="p-4 text-sm text-slate-500">
                      No official results yet.
                    </p>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>

      {shareOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !shareBusy) {
              setShareOpen(false);
            }
          }}
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Share team"
            className="w-full max-w-[620px] overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
                  Share Team
                </p>
                <h2 className="mt-0.5 text-lg font-black text-slate-950">
                  Team image preview
                </h2>
              </div>

              <button
                type="button"
                onClick={() => !shareBusy && setShareOpen(false)}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
                aria-label="Close share team"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[72vh] overflow-y-auto bg-slate-200 p-3 sm:p-5">
              <div className="mx-auto w-full max-w-[540px] overflow-hidden rounded-xl shadow-xl">
                <div
                  ref={shareCardRef}
                  className="w-[540px] bg-slate-50 text-slate-950"
                  style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
                >
                  <div className="bg-slate-950 px-7 pb-5 pt-6 text-white">
                    <div className="flex items-start justify-between gap-5">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-teal-300">
                          Racecourse Fantasy
                        </p>
                        <h2 className="mt-2 truncate text-[28px] font-black leading-none">
                          {team.team_name?.trim() || "My Team"}
                        </h2>
                        <p className="mt-2 text-[13px] font-bold text-slate-300">
                          {season.name} · Round {round.round_number}
                          {round.name ? ` — ${round.name}` : ""}
                        </p>
                      </div>

                      <div className="shrink-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-right">
                        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                          Team Salary
                        </p>
                        <p className="mt-1 text-[17px] font-black text-white">
                          {formatCurrency(salaryUsed)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-px bg-slate-200">
                    <div className="bg-white px-5 py-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Current Score
                      </p>
                      <p className="mt-1 text-[22px] font-black text-teal-700">
                        {totalPoints} pts
                      </p>
                    </div>
                    <div className="bg-white px-5 py-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Projected Score
                      </p>
                      <p className="mt-1 text-[22px] font-black text-amber-600">
                        {liveProjectedScore} pts
                      </p>
                    </div>
                  </div>

                  <div className="px-5 py-4">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                      Selected Horses
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      {sortedSelections.map((selection) => {
                        const entry = selection.race_entry;
                        const horse = entry?.horse;
                        const race = entry?.race;
                        const activeNominations = selection.active_nominations ?? [];
                        const isScratched = selection.is_scratched === true;
                        const shareRaces =
                          activeNominations.length > 0
                            ? activeNominations
                                .map((nomination) => nomination.race)
                                .filter((item): item is FixtureRace => Boolean(item))
                            : race
                              ? [race]
                              : [];

                        const points = selection.is_captain
                          ? (selection.fantasy_points ?? 0) * 2
                          : selection.fantasy_points ?? 0;

                        const projected =
                          entry?.projected_points ??
                          projectedPointsByEntryId[selection.race_entry_id] ??
                          null;

                        const shownProjection =
                          projected === null
                            ? null
                            : selection.is_captain
                              ? projected * 2
                              : projected;

                        return (
                          <div
                            key={selection.id}
                            className={`grid min-h-[92px] grid-cols-[minmax(0,1fr)_68px] items-center gap-2 rounded-lg border px-3 py-2 ${
                              isScratched
                                ? "border-red-300 bg-red-50"
                                : selection.is_captain
                                  ? "border-amber-300 bg-amber-50"
                                  : "border-slate-200 bg-white"
                            }`}
                          >
                            <div className="grid grid-cols-[42px_minmax(0,1fr)] items-center gap-2">
                              <div className="flex h-10 w-10 items-center justify-center">
                                {horse?.silks_url ? (
                                  <img
                                    src={horse.silks_url}
                                    alt=""
                                    className="max-h-10 max-w-10 object-contain"
                                  />
                                ) : null}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="truncate text-[17px] font-black leading-tight text-slate-950">
                                    {horse?.name ?? "Unknown horse"}
                                  </p>

                                {selection.is_captain && (
                                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[11px] font-black text-amber-950">
                                    C
                                  </span>
                                )}
                              </div>

                              {isScratched && (
                                <p className="mt-1 text-[11px] font-black uppercase text-red-700">
                                  Scratched
                                </p>
                              )}

                              {shareRaces.length > 0 ? (
                                <div className="mt-1 space-y-0.5">
                                  {shareRaces.map((shareRace) => (
                                    <p
                                      key={shareRace.id}
                                      className="truncate text-[9px] font-bold leading-snug text-slate-600"
                                    >
                                      R{shareRace.race_number} {shareRace.race_name} ·{" "}
                                      {getGradeLabel(shareRace.grade)}
                                    </p>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-1 text-[12px] font-bold text-slate-400">
                                  Race unavailable
                                </p>
                              )}
                              </div>
                            </div>

                            <div className="text-right">
                              {selection.has_result ? (
                                <>
                                  <p className="text-[21px] font-black leading-none text-teal-700">
                                    {points}
                                  </p>
                                  <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-400">
                                    points
                                  </p>
                                </>
                              ) : isScratched ? (
                                <p className="text-[11px] font-black uppercase text-red-700">
                                  Scratched
                                </p>
                              ) : (
                                <>
                                  <p className="text-[21px] font-black leading-none text-amber-600">
                                    {shownProjection ?? "—"}
                                  </p>
                                  <p className="mt-1 text-[7px] font-black uppercase tracking-wide text-slate-400">
                                    projected
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3">
                    <p className="text-[9px] font-bold text-slate-400">
                      Captain scores 2× points
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-teal-700">
                      Racecourse Fantasy
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white p-4 sm:px-5">
              {shareError && (
                <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {shareError}
                </p>
              )}

              <button
                type="button"
                onClick={() => void handleShareTeam()}
                disabled={shareBusy}
                className="inline-flex w-full items-center justify-center rounded-xl bg-teal-700 px-5 py-3 font-black text-white transition hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60"
              >
                <Icon name="share" className="mr-2 h-4 w-4" />
                {shareBusy ? "Creating Image..." : "Share Team Image"}
              </button>

              <p className="mt-2 text-center text-xs text-slate-500">
                On supported phones this opens the native share menu. Otherwise the PNG is saved to your device.
              </p>
            </div>
          </section>
        </div>
      )}

      {selectedRaceId && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedRaceId(null);
            }
          }}
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Race results"
            className="max-h-[92vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-5xl sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-950 px-5 py-5 text-white sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-300">
                  Race results
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  {raceResultsData?.race
                    ? `R${raceResultsData.race.race_number} — ${raceResultsData.race.race_name}`
                    : "Loading race..."}
                </h2>

                {raceResultsData?.race?.racecourse && (
                  <p className="mt-1 text-sm text-slate-300">
                    {raceResultsData.race.racecourse.name}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedRaceId(null)}
                className="rounded-lg border border-white/20 p-2 transition hover:bg-white/10"
                aria-label="Close race results"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(92vh-96px)] overflow-y-auto p-5 sm:p-6">
              {raceResultsLoading && (
                <div className="py-16 text-center text-slate-500">
                  Loading race results...
                </div>
              )}

              {!raceResultsLoading && raceResultsError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
                  {raceResultsError}
                </div>
              )}

              {!raceResultsLoading &&
                !raceResultsError &&
                raceResultsData?.race && (
                  <>
                    <div className="mb-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-slate-100 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Grade
                        </p>
                        <p className="mt-1 font-black text-slate-950">
                          {getGradeLabel(raceResultsData.race.grade)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-100 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Start time
                        </p>
                        <p className="mt-1 font-black text-slate-950">
                          {formatRaceTime(raceResultsData.race.scheduled_start)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-100 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Status
                        </p>
                        <p className="mt-1 font-black text-slate-950">
                          {titleCase(raceResultsData.race.status)}
                        </p>
                      </div>
                    </div>

                    {(raceResultsData.results ?? []).length === 0 ? (
                      <div className="rounded-xl border border-slate-200 p-8 text-center text-slate-500">
                        No official results are available for this race yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full min-w-[760px] divide-y divide-slate-200">
                          <thead className="bg-slate-100">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                                Finish
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                                Horse
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
                                Points
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
                                Price change
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
                                New price
                              </th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-slate-200">
                            {raceResultsData.results.map((result) => (
                              <tr key={result.result_id}>
                                <td className="px-4 py-4 font-black text-slate-950">
                                  {getFinishLabel(
                                    result.finishing_position,
                                    result.result_status
                                  )}
                                  {result.is_dead_heat ? " (DH)" : ""}
                                </td>

                                <td className="px-4 py-4">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedHorseId(result.horse_id)}
                                    className="font-bold text-slate-950 hover:text-teal-700"
                                  >
                                    {result.horse_name}
                                  </button>
                                </td>

                                <td className="px-4 py-4 text-right font-bold text-teal-700">
                                  {result.fantasy_points}
                                </td>

                                <td
                                  className={`px-4 py-4 text-right font-bold ${
                                    result.price_change > 0
                                      ? "text-green-700"
                                      : result.price_change < 0
                                        ? "text-red-700"
                                        : "text-slate-600"
                                  }`}
                                >
                                  {result.price_change > 0 ? "+" : ""}
                                  {formatCurrency(result.price_change)}
                                </td>

                                <td className="px-4 py-4 text-right font-bold text-slate-950">
                                  {formatCurrency(result.price_after)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
            </div>
          </section>
        </div>
      )}

      <HorseProfileModal
        horseId={selectedHorseId}
        onClose={() => setSelectedHorseId(null)}
      />
    </main>
  );
}