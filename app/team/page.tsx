"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import HorseProfileModal from "@/components/HorseProfileModal";
import { useSeason } from "@/components/SeasonProvider";
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
  auto_filled?: boolean;
  autofilled_horse_count?: number;
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
      ? "text-white"
      : emphasis === "amber"
        ? "text-amber-100"
        : "text-white";
  return (
    <div className="min-w-0 bg-white/12 px-3 py-3 backdrop-blur-sm sm:px-4 sm:py-3.5">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/65">
        {label}
      </p>
      <p className={`mt-1 truncate text-base font-black sm:mt-1.5 sm:text-lg ${valueClasses}`}>
        {value}
      </p>
    </div>
  );
}
export default function MyTeamPage() {
  const { selectedSeasonId, loadingSeasons } = useSeason();
  const [season, setSeason] = useState<Season | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [currentTime, setCurrentTime] = useState(() =>
    Date.now()
  );
  const lockoutHasStarted =
    round !== null &&
    currentTime >= new Date(round.lockout_at).getTime();
  const [salaryCap, setSalaryCap] = useState(0);
  const [roundRank, setRoundRank] = useState<number | null>(null);
  const [overallRank, setOverallRank] = useState<number | null>(null);
  const [showProjectedScores, setShowProjectedScores] = useState(false);
  const [showSpecialTeamProjections, setShowSpecialTeamProjections] =
    useState(false);
  const [hasEarlyProjectionAccess, setHasEarlyProjectionAccess] =
    useState(false);
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
  const [mobileExpandedHorseId, setMobileExpandedHorseId] = useState<string | null>(null);

  // Close touch actions when the user taps anywhere outside a horse card.
  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !target.closest('[data-horse-action-card="true"]')) {
        setMobileExpandedHorseId(null);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);
  const [shareOpen, setShareOpen] = useState(false);
  const [teamActionBusy, setTeamActionBusy] = useState(false);
  const [replacementMode, setReplacementMode] = useState(false);
  const [outgoingSelections, setOutgoingSelections] = useState<TeamSelection[]>([]);
  const [incomingEntries, setIncomingEntries] = useState<Array<{
    id: string; horse_id: string; saddlecloth_number: number | null; price_at_entry: number; projected_points: number | null;
    entry_status: string; horse: { name: string; silks_url: string | null } | null;
    race: { race_name: string; race_number: number; grade: Race["grade"]; scheduled_start: string; racecourse: Racecourse | null } | null;
  }>>([]);
  const [stagedCaptainEntryId, setStagedCaptainEntryId] = useState<string | null>(null);
  const [replacementEntries, setReplacementEntries] = useState<Array<{
    id: string; horse_id: string; saddlecloth_number: number | null; price_at_entry: number; projected_points: number | null;
    entry_status: string; horse: { name: string; silks_url: string | null } | null;
    race: { race_name: string; race_number: number; grade: Race["grade"]; scheduled_start: string; racecourse: Racecourse | null } | null;
  }>>([]);
  // Fetch entries by the round's race IDs rather than relying on a nested
  // PostgREST relationship filter. Normalize joined rows: Supabase may return
  // one-to-one relations as arrays depending on its generated types.
  const fetchRoundHorseEntries = useCallback(async (roundId: string) => {
    const { data: roundRaces, error: racesError } = await supabase
      .from("races")
      .select("id")
      .eq("round_id", roundId);
    if (racesError) throw racesError;
    const raceIds = (roundRaces ?? []).map((race) => race.id);
    if (raceIds.length === 0) return [] as typeof replacementEntries;

    const { data, error } = await supabase.from("race_entries")
      .select(`id, horse_id, saddlecloth_number, price_at_entry, projected_points, entry_status,
        horse:horses(name, silks_url),
        race:races(race_name, race_number, grade, scheduled_start,
          racecourse:racecourses(name))`)
      .in("race_id", raceIds);
    if (error) throw error;
    return (data ?? []).map((raw) => {
      const horse = Array.isArray(raw.horse) ? raw.horse[0] ?? null : raw.horse;
      const race = Array.isArray(raw.race) ? raw.race[0] ?? null : raw.race;
      const racecourse = race && (Array.isArray(race.racecourse)
        ? race.racecourse[0] ?? null : race.racecourse);
      return {
        ...raw,
        saddlecloth_number: raw.saddlecloth_number == null ? null : Number(raw.saddlecloth_number),
        price_at_entry: Number(raw.price_at_entry ?? 0),
        projected_points: raw.projected_points == null ? null : Number(raw.projected_points),
        horse,
        race: race ? { ...race, racecourse } : null,
      };
    }) as unknown as typeof replacementEntries;
  }, []);
  const [newTeamEntries, setNewTeamEntries] = useState<typeof replacementEntries>([]);
  const [newTeamCaptainId, setNewTeamCaptainId] = useState<string | null>(null);
  const [newTeamSearch, setNewTeamSearch] = useState("");
  const [newTeamSaving, setNewTeamSaving] = useState(false);
  const [newTeamError, setNewTeamError] = useState("");
  const [newTeamLoadedRoundId, setNewTeamLoadedRoundId] = useState<string | null>(null);
  // Auto-save new-team drafts after selection/captain changes, without
  // changing the submitted-team replacement workflow.
  const [newTeamDirty, setNewTeamDirty] = useState(false);
  const [newTeamAutoSaveStatus, setNewTeamAutoSaveStatus] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle");
  const newTeamAutoSaveInFlight = useRef(false);
  const newTeamAutoSaveQueued = useRef<null | { roundId: string; entryIds: string[]; captainId: string | null; status: "draft" | "submitted" }>(null);
  const flushNewTeamAutoSave = useCallback(async () => {
    if (newTeamAutoSaveInFlight.current) return;
    const payload = newTeamAutoSaveQueued.current;
    if (!payload) return;
    newTeamAutoSaveQueued.current = null;
    newTeamAutoSaveInFlight.current = true;
    setNewTeamAutoSaveStatus("saving");
    const { error } = await supabase.rpc("save_my_round_team", {
      p_round_id: payload.roundId,
      p_entry_ids: payload.entryIds,
      p_captain_entry_id: payload.captainId,
      p_status: payload.status,
    });
    newTeamAutoSaveInFlight.current = false;
    if (error) {
      setNewTeamAutoSaveStatus("error");
      setNewTeamError(error.message);
    } else {
      setNewTeamAutoSaveStatus("saved");
      setNewTeamError("");
    }
    if (newTeamAutoSaveQueued.current) void flushNewTeamAutoSave();
  }, []);
  useEffect(() => {
    if (!newTeamDirty || team || !round || lockoutHasStarted || newTeamEntries.length === 0) return;
    setNewTeamAutoSaveStatus("pending");
    const timer = window.setTimeout(() => {
      newTeamAutoSaveQueued.current = {
        roundId: round.id,
        entryIds: newTeamEntries.map((entry) => entry.id),
        captainId: newTeamCaptainId,
        status: newTeamEntries.length === (season?.team_size ?? 10) && newTeamCaptainId ? "submitted" : "draft",
      };
      void flushNewTeamAutoSave();
    }, 750);
    return () => window.clearTimeout(timer);
  }, [newTeamDirty, team, round, lockoutHasStarted, newTeamEntries, newTeamCaptainId, season?.team_size, flushNewTeamAutoSave]);

  useEffect(() => {
    if (team || !round) return;
    let cancelled = false;
    setNewTeamLoadedRoundId(null);
    setReplacementLoading(true);
    setNewTeamError("");
    void (async () => {
      try {
        const entries = await fetchRoundHorseEntries(round.id);
        if (!cancelled) {
          setReplacementEntries(entries);
          setNewTeamLoadedRoundId(round.id);
        }
      } catch (error) {
        if (!cancelled) setNewTeamError(error instanceof Error ? error.message : "Unable to load round horses.");
      } finally {
        if (!cancelled) setReplacementLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [team?.id, round?.id, fetchRoundHorseEntries]);
  async function saveNewTeamDraft() {
    if (!round || newTeamSaving || lockoutHasStarted || newTeamEntries.length === 0) return;
    setNewTeamSaving(true);
    setNewTeamError("");
    try {
      const { error } = await supabase.rpc("save_my_round_team", {
        p_round_id: round.id,
        p_entry_ids: newTeamEntries.map((entry) => entry.id),
        p_captain_entry_id: newTeamCaptainId,
        p_status: newTeamEntries.length === (season?.team_size ?? 10) && newTeamCaptainId ? "submitted" : "draft",
      });
      if (error) throw error;
      await loadTeam();
    } catch (error) {
      setNewTeamError(error instanceof Error ? error.message : "Unable to save draft.");
    } finally { setNewTeamSaving(false); }
  }
  const [replacementRecentForms, setReplacementRecentForms] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!selectedSeasonId || replacementEntries.length === 0) {
      setReplacementRecentForms({});
      return;
    }
    let cancelled = false;
    const horseIds = [...new Set(replacementEntries.map((entry) => entry.horse_id))];
    void (async () => {
      const forms: Record<string, string> = {};
      for (let i = 0; i < horseIds.length; i += 200) {
        const { data, error } = await supabase.rpc("get_horse_recent_forms", {
          p_horse_ids: horseIds.slice(i, i + 200),
          p_season_id: selectedSeasonId,
        });
        if (cancelled) return;
        if (error) {
          console.error("Could not load replacement horse forms:", error);
          return;
        }
        for (const row of (data ?? []) as Array<{ horse_id: string; recent_form: string | null }>) {
          forms[row.horse_id] = row.recent_form ?? "";
        }
      }
      if (!cancelled) setReplacementRecentForms(forms);
    })();
    return () => { cancelled = true; };
  }, [replacementEntries, selectedSeasonId]);
  const [replacementLoading, setReplacementLoading] = useState(false);
  const [replacementError, setReplacementError] = useState("");
  const [horseLookup, setHorseLookup] = useState("");
  const [horseLookupResults, setHorseLookupResults] = useState<Array<{
    id: string; name: string; current_price: number; silks_url: string | null; grades: string[];
  }>>([]);
  const [horseLookupLoading, setHorseLookupLoading] = useState(false);
  const [horseLookupError, setHorseLookupError] = useState("");
  useEffect(() => {
    const term = horseLookup.trim();
    if (!term || !round) {
      setHorseLookupResults([]);
      setHorseLookupLoading(false);
      setHorseLookupError("");
      return;
    }
    let cancelled = false;
    setHorseLookupLoading(true);
    setHorseLookupError("");
    const timer = window.setTimeout(async () => {
      const escaped = term.replace(/[\\%_]/g, "\\$&");
      const { data, error } = await supabase
        .from("horses")
        .select("id, name, current_price, silks_url")
        .ilike("name", `%${escaped}%`)
        .order("name", { ascending: true })
        .limit(1000);
      if (cancelled) return;
      if (error) {
        setHorseLookupResults([]);
        setHorseLookupError(error.message);
        setHorseLookupLoading(false);
        return;
      }
      const matches = (data ?? []) as Array<{ id: string; name: string; current_price: number; silks_url: string | null }>;
      const gradesByHorse = new Map<string, Set<string>>();
      if (round && matches.length) {
        const ids = matches.map((horse) => horse.id);
        // Look up the grade of each matching horse's race(s) in this round.
        for (let offset = 0; offset < ids.length; offset += 200) {
          const { data: nominations, error: gradeError } = await supabase
            .from("race_entries")
            .select("horse_id, race:races!inner(grade, round_id)")
            .in("horse_id", ids.slice(offset, offset + 200))
            .eq("race.round_id", round.id);
          if (cancelled) return;
          if (gradeError) {
            setHorseLookupError(gradeError.message);
            setHorseLookupLoading(false);
            return;
          }
          for (const nomination of nominations ?? []) {
            const record = nomination as unknown as { horse_id: string; race: { grade: string } | { grade: string }[] | null };
            const races = Array.isArray(record.race) ? record.race : record.race ? [record.race] : [];
            for (const race of races) {
              if (!race.grade) continue;
              if (!gradesByHorse.has(record.horse_id)) gradesByHorse.set(record.horse_id, new Set());
              gradesByHorse.get(record.horse_id)!.add(race.grade);
            }
          }
        }
      }
      if (cancelled) return;
      setHorseLookupResults(matches
        .filter((horse) => gradesByHorse.has(horse.id))
        .map((horse) => ({
          ...horse,
          grades: [...(gradesByHorse.get(horse.id) ?? [])].sort((a, b) => ["G1", "G2", "G3", "L"].indexOf(a) - ["G1", "G2", "G3", "L"].indexOf(b)),
        })));
      setHorseLookupError("");
      setHorseLookupLoading(false);
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [horseLookup, round?.id]);
  const [replacementSearch, setReplacementSearch] = useState("");
  const [replacementGrade, setReplacementGrade] = useState("all");
  const [replacementSort, setReplacementSort] = useState("race");
  const [teamActionError, setTeamActionError] = useState("");
  const [teamActionSuccess, setTeamActionSuccess] = useState("");
  useEffect(() => {
    if (!teamActionSuccess) return;
    const timeoutId = window.setTimeout(() => setTeamActionSuccess(""), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [teamActionSuccess]);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState("");
  const shareCardRef = useRef<HTMLDivElement | null>(null);
  const [showHorseSilks, setShowHorseSilks] = useState(true);
  const [horseSilks, setHorseSilks] = useState<Record<string, string | null>>(
    {}
  );
  useEffect(() => {
    let active = true;
    async function loadProjectedScoresSetting() {
      const { data, error } = await supabase.rpc(
        "get_public_site_settings"
      );
      if (!active) return;
      if (error) {
        console.error("Projected scores setting load error:", error);
        setShowProjectedScores(false);
        return;
      }
      const settings =
        data && typeof data === "object"
          ? (data as {
              show_projected_scores?: boolean;
              show_special_team_projections?: boolean;
            })
          : null;
      setShowProjectedScores(
        settings?.show_projected_scores === true
      );
      setShowSpecialTeamProjections(
        settings?.show_special_team_projections === true
      );
    }
    void loadProjectedScoresSetting();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    async function loadSpecialProjectionAccess() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (!active) return;
      if (userError || !user) {
        setHasEarlyProjectionAccess(false);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("projection_access_early")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        console.error("My Team special projection access error:", error);
        setHasEarlyProjectionAccess(false);
        return;
      }
      setHasEarlyProjectionAccess(
        data?.projection_access_early === true
      );
    }
    void loadSpecialProjectionAccess();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    async function loadSilkSetting() {
      const { data, error } = await supabase.rpc(
        "get_public_site_settings"
      );
      if (!active) return;
      if (error) {
        console.error("Horse silks setting load error:", error);
        setShowHorseSilks(true);
        return;
      }
      const settings =
        data && typeof data === "object"
          ? (data as { show_horse_silks?: boolean })
          : null;
      setShowHorseSilks(settings?.show_horse_silks !== false);
    }
    void loadSilkSetting();
    return () => {
      active = false;
    };
  }, []);
  const loadTeam = useCallback(async () => {
    if (loadingSeasons) {
      return;
    }
    setLoading(true);
    setErrorMessage("");
    if (!selectedSeasonId) {
      setRound(null);
      setSeason(null);
      setTeam(null);
      setSalaryCap(0);
      setSelections([]);
      setCurrentHorsePrices({});
      setProjectedPointsByEntryId({});
      setFixtureRaces([]);
      setLatestResultRace(null);
      setLatestRaceResults([]);
      setErrorMessage("No season is currently selected.");
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc(
      "get_my_team_data",
      {
        p_season_id: selectedSeasonId,
      }
    );
    if (error) {
      console.error("My Team RPC error:", error);
      setRound(null);
      setSeason(null);
      setTeam(null);
      setSalaryCap(0);
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
      setSalaryCap(0);
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
    // Load the user's round and overall ranks for the share card.
    setRoundRank(null);
    setOverallRank(null);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error("My Team rank auth error:", authError);
    } else if (authData.user) {
      const [roundRankResult, overallRankResult] = await Promise.all([
        supabase
          .from("round_leaderboard")
          .select("round_rank")
          .eq("round_id", teamData.round.id)
          .eq("user_id", authData.user.id)
          .maybeSingle(),
        supabase
          .from("season_leaderboard")
          .select("overall_rank")
          .eq("season_id", teamData.season.id)
          .eq("user_id", authData.user.id)
          .maybeSingle(),
      ]);
      if (roundRankResult.error) {
        console.error("My Team round rank load error:", roundRankResult.error);
      } else {
        setRoundRank(
          roundRankResult.data?.round_rank == null
            ? null
            : Number(roundRankResult.data.round_rank)
        );
      }
      if (overallRankResult.error) {
        console.error("My Team overall rank load error:", overallRankResult.error);
      } else {
        setOverallRank(
          overallRankResult.data?.overall_rank == null
            ? null
            : Number(overallRankResult.data.overall_rank)
        );
      }
    }
    const {
      data: playerSalaryCap,
      error: salaryCapError,
    } = await supabase.rpc("get_my_round_salary_cap", {
      p_round_id: teamData.round.id,
    });
    if (salaryCapError) {
      console.error(
        "My Team salary cap load error:",
        salaryCapError
      );
      setSalaryCap(Number(teamData.season.salary_cap ?? 0));
    } else {
      const resolvedSalaryCap =
        playerSalaryCap == null
          ? Number(teamData.season.salary_cap ?? 0)
          : Number(playerSalaryCap);
      setSalaryCap(
        Number.isFinite(resolvedSalaryCap)
          ? resolvedSalaryCap
          : Number(teamData.season.salary_cap ?? 0)
      );
    }
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
  }, [loadingSeasons, selectedSeasonId]);
  useEffect(() => {
    if (loadingSeasons) {
      return;
    }
    void loadTeam();
  }, [loadTeam, loadingSeasons]);
  useEffect(() => {
    let active = true;
    async function loadHorseSilks() {
      if (!showHorseSilks || selections.length === 0) {
        setHorseSilks({});
        return;
      }
      const horseIds = Array.from(
        new Set(
          selections
            .map((selection) => selection.race_entry?.horse?.id)
            .filter((id): id is string => Boolean(id))
        )
      );
      if (horseIds.length === 0) {
        setHorseSilks({});
        return;
      }
      const { data, error } = await supabase
        .from("horses")
        .select("id, silks_url")
        .in("id", horseIds);
      if (!active) return;
      if (error) {
        console.error("Horse silks load error:", error);
        setHorseSilks({});
        return;
      }
      const silkMap: Record<string, string | null> = {};
      for (const row of data ?? []) {
        silkMap[String(row.id)] =
          typeof row.silks_url === "string" && row.silks_url.trim()
            ? row.silks_url
            : null;
      }
      setHorseSilks(silkMap);
    }
    void loadHorseSilks();
    return () => {
      active = false;
    };
  }, [selections, showHorseSilks]);
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
  const autofilledHorseCount = Math.max(
    0,
    Number(team?.autofilled_horse_count ?? 0)
  );
  const autofillPenalty = autofilledHorseCount * 3;
  const rawTotalPoints = useMemo(() => {
    return selections.reduce((total, selection) => {
      const basePoints = selection.fantasy_points ?? 0;
      return total + (selection.is_captain ? basePoints * 2 : basePoints);
    }, 0);
  }, [selections]);
  const totalPoints = rawTotalPoints - autofillPenalty;
  const rawLiveProjectedScore = useMemo(() => {
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
  const liveProjectedScore = rawLiveProjectedScore - autofillPenalty;
  // Include staged horse removals and additions immediately, before saving.
  const salaryRemaining = salaryCap - (
    salaryUsed
    - outgoingSelections.reduce((total, selection) => total + selection.selected_price, 0)
    + incomingEntries.reduce((total, entry) => total + entry.price_at_entry, 0)
  );
  const roundIsComplete = round?.status === "completed";
  const projectionsVisible =
    showProjectedScores ||
    (showSpecialTeamProjections && hasEarlyProjectionAccess);
  const editButtonVisible =
    round !== null &&
    !lockoutHasStarted &&
    team?.status !== "locked" &&
    team?.status !== "scored";
  // Edit directly from My Team, using the same secure RPC as Edit Team.
  // The round-level lockout is deliberately conservative: no changes after it.
  async function updateMyTeam(
    nextSelections: TeamSelection[],
    nextCaptainId: string | null,
    action: "captain" | "remove"
  ) {
    if (!round || !team || !editButtonVisible || teamActionBusy) return;
    setTeamActionBusy(true);
    setTeamActionError("");
    setTeamActionSuccess("");
    const nextStatus = nextSelections.length === (season?.team_size ?? 10) && nextCaptainId ? "submitted" : "draft";
    try {
      const { error } = await supabase.rpc("save_my_round_team", {
        p_round_id: round.id,
        p_entry_ids: nextSelections.map((selection) => selection.race_entry_id),
        p_captain_entry_id: nextCaptainId,
        p_status: nextStatus,
      });
      if (error) throw error;
      await loadTeam();
      setTeamActionSuccess(
        action === "captain"
          ? "Captain updated successfully."
          : "Horse removed. Your team is now a draft; add a replacement and submit it before lockout."
      );
    } catch (error) {
      setTeamActionError(error instanceof Error ? error.message : "Unable to save team changes.");
    } finally {
      setTeamActionBusy(false);
    }
  }

  function changeCaptainFromTeam(selection: TeamSelection) {
    if (selection.is_captain || !editButtonVisible || teamActionBusy) return;
    void updateMyTeam(selections, selection.race_entry_id, "captain");
  }

  async function removeHorseFromTeam(selection: TeamSelection) {
    if (!editButtonVisible || teamActionBusy) return;
    if (outgoingSelections.some((item) => item.id === selection.id)) return;
    setReplacementMode(true);
    setOutgoingSelections((previous) => [...previous, selection]);
    if (outgoingSelections.length === 0) {
      window.setTimeout(() => document.getElementById("horse-selector")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
    setReplacementError("");
    if (replacementEntries.length > 0) return;
    setReplacementLoading(true);
    try {
      setReplacementEntries(await fetchRoundHorseEntries(round!.id));
    } catch (error) {
      setReplacementError(error instanceof Error ? error.message : "Unable to load available horses.");
    } finally {
      setReplacementLoading(false);
    }
  }

  // Recover complete drafts created before automatic submission was enabled.
  // A round-specific guard prevents duplicate requests while loadTeam refreshes.
  const autoSubmitInFlight = useRef<string | null>(null);
  useEffect(() => {
    if (!round || !team || team.status !== "draft" || lockoutHasStarted ||
        selections.length !== (season?.team_size ?? 10)) return;
    const captainId = selections.find((selection) => selection.is_captain)?.race_entry_id;
    if (!captainId || autoSubmitInFlight.current === round.id) return;
    autoSubmitInFlight.current = round.id;
    void (async () => {
      const { error } = await supabase.rpc("save_my_round_team", {
        p_round_id: round.id,
        p_entry_ids: selections.map((selection) => selection.race_entry_id),
        p_captain_entry_id: captainId,
        p_status: "submitted",
      });
      if (error) {
        setTeamActionError(error.message);
        autoSubmitInFlight.current = null;
      } else {
        await loadTeam();
        setTeamActionSuccess("Team automatically submitted.");
      }
    })();
  }, [round?.id, team?.status, selections, season?.team_size, lockoutHasStarted, loadTeam]);
  const vacantDraftSlots = (!team || team.status === "draft") ? Math.max(0, (season?.team_size ?? 10) - selections.length) : 0;
  const pendingSlots = outgoingSelections.length + vacantDraftSlots - incomingEntries.length;
  const outgoingSalary = outgoingSelections.reduce((sum, selection) => sum + selection.selected_price, 0);
  const incomingSalary = incomingEntries.reduce((sum, entry) => sum + entry.price_at_entry, 0);
  const draftSalary = salaryUsed - outgoingSalary + incomingSalary;
  const draftHorseIds = new Set([
    ...selections.filter((selection) => !outgoingSelections.some((out) => out.id === selection.id))
      .map((selection) => selection.race_entry?.horse?.id),
    ...incomingEntries.map((entry) => entry.horse_id),
  ]);

  function stageReplacement(entry: (typeof replacementEntries)[number]) {
    if (pendingSlots <= 0 || draftHorseIds.has(entry.horse_id) || entry.entry_status !== "runner") return;
    if (draftSalary + entry.price_at_entry > salaryCap) return;
    setIncomingEntries((previous) => [...previous, entry]);
    setReplacementError("");
  }

  function cancelReplacement() {
    setOutgoingSelections([]);
    setIncomingEntries([]);
    setStagedCaptainEntryId(null);
    setReplacementError("");
  }

  async function saveReplacements() {
    if (!round || teamActionBusy || (outgoingSelections.length === 0 && vacantDraftSlots === 0) || (team?.status === "submitted" && pendingSlots !== 0) || incomingEntries.length === 0) return;
    const retained = selections.filter((selection) => !outgoingSelections.some((out) => out.id === selection.id));
    const entryIds = [...retained.map((selection) => selection.race_entry_id), ...incomingEntries.map((entry) => entry.id)];
    const previousCaptain = selections.find((selection) => selection.is_captain);
    const captainOutgoingIndex = outgoingSelections.findIndex((selection) => selection.is_captain);
    const captainId = (stagedCaptainEntryId && entryIds.includes(stagedCaptainEntryId) ? stagedCaptainEntryId : null) ?? (captainOutgoingIndex >= 0
      ? incomingEntries[captainOutgoingIndex]?.id ?? incomingEntries[0]?.id ?? null
      : previousCaptain?.race_entry_id ?? incomingEntries[0]?.id ?? null);
    setTeamActionBusy(true);
    setReplacementError("");
    try {
      const { error } = await supabase.rpc("save_my_round_team", {
        p_round_id: round.id,
        p_entry_ids: entryIds,
        p_captain_entry_id: captainId,
        p_status: entryIds.length === (season?.team_size ?? 10) && captainId ? "submitted" : "draft",
      });
      if (error) throw error;
      cancelReplacement();
      await loadTeam();
      setReplacementMode(false);
      setReplacementEntries([]);
      setReplacementLoading(false);
      setTeamActionSuccess(entryIds.length === (season?.team_size ?? 10) ? "Team automatically submitted." : "Draft saved. You can continue adding horses.");
    } catch (error) {
      setReplacementError(error instanceof Error ? error.message : "Unable to save replacements.");
    } finally {
      setTeamActionBusy(false);
    }
  }

  // A draft created by auto-save may contain fewer than the required horses.
  // Load the selector for these vacant slots, even when no horse is being replaced.
  useEffect(() => {
    if (!round || (team && team.status !== "draft") || selections.length >= (season?.team_size ?? 10) || lockoutHasStarted) return;
    let cancelled = false;
    setReplacementLoading(true);
    void (async () => {
      try {
        const entries = await fetchRoundHorseEntries(round.id);
        if (cancelled) return;
        setReplacementEntries(entries);
        setReplacementError("");
      } catch (error) {
        if (cancelled) return;
        setReplacementError(error instanceof Error ? error.message : "Unable to load round horses.");
      }
      setReplacementLoading(false);
    })();
    return () => { cancelled = true; };
  }, [round?.id, team?.id, team?.status, selections.length, season?.team_size, lockoutHasStarted, fetchRoundHorseEntries]);

  const availableReplacementEntries = replacementEntries
    .filter((entry) => {
      if (replacementGrade !== "all" && entry.race?.grade !== replacementGrade) return false;
      const query = replacementSearch.trim().toLowerCase();
      return !query || [entry.horse?.name, entry.race?.race_name, entry.race?.racecourse?.name]
        .some((value) => value?.toLowerCase().includes(query));
    })
    .sort((a, b) => replacementSort === "price-low"
      ? a.price_at_entry - b.price_at_entry
      : replacementSort === "price-high"
        ? b.price_at_entry - a.price_at_entry
        : replacementSort === "name"
          ? (a.horse?.name ?? "").localeCompare(b.horse?.name ?? "")
          : new Date(a.race?.scheduled_start ?? 0).getTime() - new Date(b.race?.scheduled_start ?? 0).getTime());

  // Default to saddlecloth order within each race; retain explicit alternative sorts.
  const sortEntriesWithinRace = (entries: typeof replacementEntries) =>
    entries.sort((a, b) => {
      if (replacementSort === "price-low") return a.price_at_entry - b.price_at_entry;
      if (replacementSort === "price-high") return b.price_at_entry - a.price_at_entry;
      if (replacementSort === "name") return (a.horse?.name ?? "").localeCompare(b.horse?.name ?? "");
      return (a.saddlecloth_number ?? Number.MAX_SAFE_INTEGER) -
        (b.saddlecloth_number ?? Number.MAX_SAFE_INTEGER) ||
        (a.horse?.name ?? "").localeCompare(b.horse?.name ?? "");
    });

  // Group replacements by race rather than presenting one continuous horse list.
  // Keep races chronological, while applying the selected sort within each race.
  const replacementRaceGroups = Array.from(
    availableReplacementEntries.reduce((groups, entry) => {
      const race = entry.race;
      const key = `${race?.scheduled_start ?? ""}|${race?.racecourse?.name ?? ""}|${race?.race_number ?? ""}|${race?.race_name ?? ""}`;
      const group = groups.get(key);
      if (group) {
        group.entries.push(entry);
      } else {
        groups.set(key, { key, race, entries: [entry] });
      }
      return groups;
    }, new Map<string, {
      key: string;
      race: (typeof replacementEntries)[number]["race"];
      entries: typeof replacementEntries;
    }>()).values()
  ).map((group) => ({ ...group, entries: sortEntriesWithinRace(group.entries) })).sort((a, b) =>
    new Date(a.race?.scheduled_start ?? 0).getTime() -
    new Date(b.race?.scheduled_start ?? 0).getTime() ||
    (a.race?.race_number ?? 0) - (b.race?.race_number ?? 0)
  );

  const handleShareTeam = useCallback(async () => {
    const card = shareCardRef.current;
    if (!card || !team || !round || shareBusy) return;

    setShareBusy(true);
    setShareError("");

    const imageOptions = {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#f8fafc",
    };

    const downloadPng = (blob: Blob, fileName: string) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    };

    try {
      let blob: Blob | null = null;
      let usedImageFallback = false;

      try {
        // First try to capture the complete card, including horse silks.
        blob = await toBlob(card, imageOptions);
      } catch (imageError) {
        console.warn(
          "Share team: full image capture failed; retrying without external images.",
          imageError
        );
      }

      if (!blob) {
        // An external silks image may fail CORS or fail to load. Excluding
        // img elements allows the rest of the team sheet to be captured.
        usedImageFallback = true;
        blob = await toBlob(card, {
          ...imageOptions,
          filter: (node: HTMLElement) =>
            !(node instanceof HTMLImageElement),
        });
      }

      if (!blob) {
        throw new Error("The team image could not be created, even without silks.");
      }

      const fileName = `racecourse-fantasy-round-${round.round_number}-team.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      // The native file-share API is not consistently available on desktop.
      // Even when present, it may fail after asynchronous image generation.
      let shared = false;
      if (typeof navigator.share === "function") {
        let canShareFiles = false;
        try {
          canShareFiles =
            typeof navigator.canShare === "function" &&
            navigator.canShare({ files: [file] });
        } catch (shareSupportError) {
          console.warn("Share team: file sharing check failed", shareSupportError);
        }

        if (canShareFiles) {
          try {
            await navigator.share({
              title: `${team?.team_name?.trim() || "My Team"} — Racecourse Fantasy`,
              text: `My Racecourse Fantasy team for Round ${round.round_number}`,
              files: [file],
            });
            shared = true;
          } catch (shareError) {
            if (
              shareError instanceof DOMException &&
              shareError.name === "AbortError"
            ) {
              return; // User closed the native share sheet.
            }
            console.warn("Share team: native share failed; downloading instead", shareError);
          }
        }
      }

      if (!shared) {
        downloadPng(blob, fileName);
      }

      if (usedImageFallback) {
        console.info("Share team: image generated without horse silks.");
      }
    } catch (error) {
      console.error("Share team error:", error);
      setShareError(
        error instanceof Error
          ? error.message
          : "The team image could not be created. Check the browser console for details."
      );
    } finally {
      setShareBusy(false);
    }
  }, [round, team, shareBusy]);
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
  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-8 md:py-10">
        <header className="overflow-hidden rounded-2xl border border-sky-300 bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-500 text-white shadow-lg">
          <div className="border-b border-white/20 px-4 py-3 sm:px-5 md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-white/85">
                  Official Team Sheet
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="font-semibold text-white/80">
                    {season.name} · Round {round.round_number}
                    {round.name ? ` — ${round.name}` : ""}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-white/85">
                    <Icon name="clock" className="h-3.5 w-3.5 text-white/85" />
                    {lockoutHasStarted ? "Round locked" : "Next lockout"}:
                    <strong className="text-white">
                      {getCountdown(round.lockout_at, currentTime)}
                    </strong>
                  </span>
                  <span className="text-white/65">
                    {formatDateTime(round.lockout_at)}
                  </span>
                </div>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white shadow-sm backdrop-blur-md">
                  {team ? getStatusLabel(team.status) : "New Team"}
                </span>
                <button
                  type="button"
                  disabled={!team}
                  onClick={() => {
                    setShareError("");
                    setShareOpen(true);
                  }}
                  className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-white/30 bg-white/15 px-3 py-2 text-xs font-black text-white shadow-sm backdrop-blur-md transition hover:border-white/50 hover:bg-white/25 sm:min-h-0 sm:flex-none sm:py-1.5"
                >
                  <Icon name="share" className="mr-1.5 h-3.5 w-3.5" />
                  Share Team
                </button>
                {editButtonVisible && (
                  <button
                    type="button"
                    onClick={() => {
                      if (replacementMode) {
                        cancelReplacement();
                        setReplacementMode(false);
                      } else {
                        setReplacementMode(true);
                        window.setTimeout(() => document.getElementById("selected-team")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
                      }
                    }}
                    aria-pressed={replacementMode}
                    className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-white/30 bg-white/15 px-3 py-2 text-xs font-black text-white shadow-sm backdrop-blur-md transition hover:border-white/50 hover:bg-white/25 sm:min-h-0 sm:flex-none sm:py-1.5"
                  >
                    <Icon name="edit" className="mr-1.5 h-3.5 w-3.5" />
                    {replacementMode ? "Done Editing" : "Edit Team"}
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(620px,1.5fr)]">
            <div className="p-4 sm:p-5 md:p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/80">
                  My Team
                </p>
                <h1 className="mt-1 truncate text-xl font-black tracking-tight sm:text-2xl md:text-3xl">
                  {team?.team_name?.trim() || "My Team"}
                </h1>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px border-t border-white/20 bg-white/20 lg:grid-cols-5 xl:border-l xl:border-t-0">
              <OfficialTeamStat
                label="Current Score"
                value={`${totalPoints} pts`}
                emphasis="teal"
              />
              <OfficialTeamStat
                label="Projected Score"
                value={projectionsVisible ? `${liveProjectedScore} pts` : "Hidden"}
                emphasis="amber"
              />
              <div className="hidden lg:contents">
                <OfficialTeamStat
                  label="Team Salary"
                  value={formatCurrency(salaryUsed)}
                />
              </div>
              <OfficialTeamStat
                label="Salary Cap"
                value={formatCurrency(salaryCap)}
              />
              <OfficialTeamStat
                label="Remaining"
                value={formatCurrency(salaryRemaining)}
                emphasis="teal"
              />
            </div>
          </div>
        </header>
        {autofillPenalty > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-red-700">
                Autofill Penalty
              </p>
              <p className="mt-0.5 text-sm font-semibold text-red-800">
                {autofilledHorseCount} autofilled {autofilledHorseCount === 1 ? "horse" : "horses"} × 3 pts
              </p>
            </div>
            <p className="text-xl font-black text-red-700">
              −{autofillPenalty} pts
            </p>
          </div>
        )}
        {errorMessage && (
          <div className="mt-5 rounded-xl border border-red-300 bg-red-50 p-4 font-medium text-red-800">
            {errorMessage}
          </div>
        )}
        {teamActionError && (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{teamActionError}</p>
        )}
        {teamActionSuccess && (
          <p role="status" className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm font-semibold text-teal-800">{teamActionSuccess}</p>
        )}
        <section id="selected-team" className="mt-5 sm:mt-7">
          <div className={`grid gap-4 xl:gap-5 ${outgoingSelections.length > 0 ? "xl:grid-cols-[minmax(0,1fr)_380px]" : "xl:grid-cols-[minmax(0,1fr)_380px]"}`}>
            <div className="min-w-0">
            <div className="min-w-0">
              <div className="mb-3 flex flex-col gap-2 border-b border-slate-300 pb-3 sm:mb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">
                    Stable Line-up
                  </p>
                  <div className="mt-1">
                    <h2 className="text-xl font-black text-slate-950 sm:text-2xl">
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
              {vacantDraftSlots > 0 && editButtonVisible && (
                <p className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900">
                  {vacantDraftSlots} vacant {vacantDraftSlots === 1 ? "position" : "positions"} — add horses using the selector below.
                </p>
              )}
              {sortedSelections.length === 0 && vacantDraftSlots === 0 && incomingEntries.length === 0 ? (
                <div className="rounded-xl border bg-white p-10 text-center text-slate-500 shadow-sm">
                  No horses have been selected.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                  {[...sortedSelections, ...incomingEntries.slice(outgoingSelections.length).map((entry): TeamSelection => ({
                    id: `staged-${entry.id}`, team_id: team?.id ?? "new-team", race_entry_id: entry.id,
                    is_captain: stagedCaptainEntryId === entry.id || (!stagedCaptainEntryId && selections.length === 0 && incomingEntries[0]?.id === entry.id),
                    selected_price: entry.price_at_entry, fantasy_points: 0, has_result: false, is_scratched: false,
                    active_nominations: [],
                    race_entry: {
                      id: entry.id, race_id: `staged-race-${entry.id}`, horse_id: entry.horse_id,
                      saddlecloth_number: null, price_at_entry: entry.price_at_entry,
                      projected_points: entry.projected_points,
                      horse: entry.horse ? { id: entry.horse_id, name: entry.horse.name, current_price: entry.price_at_entry } : null,
                      race: entry.race ? { id: `staged-race-${entry.id}`, race_number: entry.race.race_number,
                        race_name: entry.race.race_name, grade: entry.race.grade, scheduled_start: entry.race.scheduled_start,
                        racecourse: entry.race.racecourse ? { id: `staged-course-${entry.id}`, name: entry.race.racecourse.name } : null } : null,
                    },
                  }))].map((selection) => {
                    const outgoingIndex = outgoingSelections.findIndex((out) => out.id === selection.id);
                    if (outgoingIndex !== -1 && !incomingEntries[outgoingIndex]) {
                      return (
                        <div key={`slot-${selection.id}`} className="flex min-h-[88px] items-center justify-center rounded-xl border-2 border-dashed border-sky-300 bg-sky-50 p-3 text-center">
                          <span aria-label="Vacant horse slot" title="Select a horse from the horse selection panel" className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-sky-300 bg-white text-3xl font-light text-sky-700">+</span>
                        </div>
                      );
                    }
                    const stagedEntry = outgoingIndex !== -1 ? incomingEntries[outgoingIndex] : null;
                    if (stagedEntry) {
                      selection = {
                        ...selection,
                        id: `staged-${stagedEntry.id}`,
                        race_entry_id: stagedEntry.id,
                        selected_price: stagedEntry.price_at_entry,
                        is_captain: stagedCaptainEntryId ? stagedCaptainEntryId === stagedEntry.id : selection.is_captain,
                        has_result: false,
                        is_scratched: false,
                        fantasy_points: 0,
                        active_nominations: [],
                        race_entry: {
                          id: stagedEntry.id,
                          race_id: `staged-race-${stagedEntry.id}`,
                          horse_id: stagedEntry.horse_id,
                          saddlecloth_number: null,
                          price_at_entry: stagedEntry.price_at_entry,
                          projected_points: stagedEntry.projected_points,
                          horse: stagedEntry.horse ? {
                            id: stagedEntry.horse_id,
                            name: stagedEntry.horse.name,
                            current_price: stagedEntry.price_at_entry,
                          } : null,
                          race: stagedEntry.race ? {
                            id: `staged-race-${stagedEntry.id}`,
                            race_number: stagedEntry.race.race_number,
                            race_name: stagedEntry.race.race_name,
                            grade: stagedEntry.race.grade,
                            scheduled_start: stagedEntry.race.scheduled_start,
                            racecourse: stagedEntry.race.racecourse,
                          } : null,
                        },
                      };
                    }
                    if (stagedCaptainEntryId && !stagedEntry) {
                      selection = { ...selection, is_captain: stagedCaptainEntryId === selection.race_entry_id };
                    }
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
                        onClick={() => {
                          if (!horse?.id) return;
                          if (window.matchMedia("(max-width: 767px), (hover: none), (pointer: coarse)").matches) {
                            setMobileExpandedHorseId((current) => current === selection.id ? null : selection.id);
                          } else {
                            setSelectedHorseId(horse.id);
                          }
                        }}
                        onKeyDown={(event) => {
                          if ((event.key === "Enter" || event.key === " ") && horse?.id) {
                            event.preventDefault();
                            if (window.matchMedia("(max-width: 767px), (hover: none), (pointer: coarse)").matches) {
                              setMobileExpandedHorseId((current) => current === selection.id ? null : selection.id);
                            } else {
                              setSelectedHorseId(horse.id);
                            }
                          }
                        }}
                        data-horse-action-card="true"
                        className={`group relative cursor-pointer overflow-hidden rounded-xl border px-2.5 py-2.5 shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 sm:px-3 sm:py-2.5 ${
                          isScratched
                            ? "border-red-300 bg-red-50 hover:border-red-400 focus:ring-red-500"
                            : selection.is_captain
                              ? "border-amber-300 bg-amber-50/50 hover:border-amber-400 focus:ring-amber-500"
                              : "border-slate-200 bg-white hover:border-sky-300 focus:ring-sky-500"
                        }`}
                        aria-label={horse ? `View statistics for ${horse.name}` : "Horse statistics unavailable"}
                      >
                        <div className="grid grid-cols-[minmax(0,1fr)_76px] items-start gap-1.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-3">
                          <div className="flex min-w-0 items-start gap-2 sm:gap-2.5">
                            {showHorseSilks &&
                              horse?.id &&
                              (horseSilks[horse.id] || (stagedEntry && stagedEntry.horse?.silks_url)) && (
                                <div className="flex h-12 w-9 shrink-0 items-center justify-center sm:h-16 sm:w-10">
                                  <img
                                    src={horseSilks[horse.id] ?? stagedEntry?.horse?.silks_url ?? ""}
                                    alt={`${horse.name} silks`}
                                    className="h-full max-h-12 w-full object-contain sm:max-h-16"
                                  />
                                </div>
                              )}
                            <div className="min-w-0 flex-1 self-start">
                            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 sm:gap-2">
                              <h3 className="min-w-0 truncate text-[13px] font-bold leading-tight text-slate-950 sm:text-base md:text-lg">
                                {horse?.name ?? "Unknown horse"}
                              </h3>
                              {selection.is_captain && (
                                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 sm:h-6 sm:w-6 text-xs font-bold text-amber-950 shadow-sm">
                                  C
                                </span>
                              )}
                              {editButtonVisible && (
                                <span className="absolute right-2 top-2 z-10 hidden items-center gap-1 rounded-full bg-white/95 p-1 shadow-sm ring-1 ring-slate-200 transition-opacity duration-150 md:inline-flex md:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-focus-within:opacity-100 [@media(hover:none)]:md:hidden [@media(pointer:coarse)]:md:hidden" onClick={(event) => event.stopPropagation()}>
                                  {!selection.is_captain && (
                                    <button
                                      type="button"
                                      title="Make captain"
                                      aria-label={`Make ${horse?.name ?? "horse"} captain`}
                                      disabled={teamActionBusy}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        if (stagedEntry) {
                                          setStagedCaptainEntryId(stagedEntry.id);
                                        } else if (outgoingSelections.length > 0 || selection.id.startsWith("staged-")) {
                                          setStagedCaptainEntryId(selection.race_entry_id);
                                        } else {
                                          changeCaptainFromTeam(selection);
                                        }
                                      }}
                                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 sm:h-7 sm:w-7 text-xs font-black text-amber-950 transition hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:opacity-50"
                                    >C</button>
                                  )}
                                  <button
                                    type="button"
                                    title={stagedEntry ? "Undo incoming horse" : "Replace horse"}
                                    aria-label={`${stagedEntry ? "Undo" : "Replace"} ${horse?.name ?? "horse"}`}
                                    disabled={teamActionBusy}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      if (stagedEntry) {
                                        setIncomingEntries((previous) => previous.filter((item) => item.id !== stagedEntry.id));
                                        if (stagedCaptainEntryId === stagedEntry.id) setStagedCaptainEntryId(null);
                                      } else if (selection.id.startsWith("staged-")) {
                                        setIncomingEntries((previous) => previous.filter((item) => item.id !== selection.race_entry_id));
                                      } else {
                                        removeHorseFromTeam(selection);
                                      }
                                    }}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-100 sm:h-7 sm:w-7 text-sm font-black text-red-600 transition hover:bg-red-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-50"
                                  >×</button>
                                </span>
                              )}
                            </div>
                            <div className="mt-1 space-y-0.5 sm:mt-1.5 sm:space-y-1">
                              {activeNominations.length > 0 ? (
                                activeNominations.map((nomination) => {
                                  const nominationRace = nomination.race;
                                  if (!nominationRace) {
                                    return null;
                                  }
                                  return (
                                    <div key={nomination.id} className="min-w-0">
                                      <div className="flex min-w-0 items-center gap-2">
                                        <p className="truncate text-xs font-semibold text-slate-800">
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
                                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-medium text-slate-600">
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
                                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-medium text-slate-600">
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
                          </div>
                          <div className="flex min-w-0 flex-col items-end self-start sm:min-w-[92px]">
                            {!selection.has_result ? (
                              <div className="text-right">
                                {isScratched ? (
                                  <>
                                    <p className="text-lg font-black uppercase leading-none text-red-700">
                                      Scratched
                                    </p>                                  </>
                                ) : !projectionsVisible ? (
                                  <>
                                    <p className="text-sm font-black leading-none text-slate-500">
                                      Hidden
                                    </p>
                                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                      Projection
                                    </p>
                                  </>
                                ) : displayedProjectedPoints === null ? (
                                  <>
                                    <p className="text-lg font-semibold leading-none text-slate-400">
                                      —
                                    </p>
                                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:mt-1 sm:text-xs">
                                      Projection
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <p className="text-xl font-bold leading-none text-amber-600 sm:text-2xl">
                                      {displayedProjectedPoints}
                                    </p>
                                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:mt-1 sm:text-xs">
                                      {selection.is_captain
                                        ? "projected pts · 2×"
                                        : "projected pts"}
                                    </p>
                                  </>
                                )}
                              </div>
                            ) : (
                              <div className="text-right">
                                <p className="text-xl font-bold leading-none text-sky-600 sm:text-2xl">{displayedPoints}</p>
                                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:mt-1 sm:text-xs">{selection.is_captain ? "pts · 2×" : "pts"}</p>
                              </div>
                            )}
                            <div className="mt-1 text-right sm:mt-1.5">
                              <p className="text-xs font-bold text-slate-950">
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
                        {mobileExpandedHorseId === selection.id && (
                          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-200 pt-3 md:[@media(hover:none)]:grid md:[@media(pointer:coarse)]:grid md:[@media(hover:hover)_and_(pointer:fine)]:hidden" onClick={(event) => event.stopPropagation()}>
                            <button type="button" disabled={!editButtonVisible || teamActionBusy} onClick={() => {
                              if (stagedEntry) {
                                setIncomingEntries((previous) => previous.filter((item) => item.id !== stagedEntry.id));
                                if (stagedCaptainEntryId === stagedEntry.id) setStagedCaptainEntryId(null);
                              } else if (selection.id.startsWith("staged-")) { setIncomingEntries((previous) => previous.filter((item) => item.id !== selection.race_entry_id)); } else { void removeHorseFromTeam(selection); }
                              setMobileExpandedHorseId(null);
                            }} className="min-h-11 rounded-lg border border-red-200 bg-red-50 px-2 text-xs font-bold text-red-700 disabled:opacity-40">Remove</button>
                            <button type="button" disabled={!editButtonVisible || teamActionBusy || selection.is_captain} onClick={() => {
                              if (stagedEntry) setStagedCaptainEntryId(stagedEntry.id);
                              else if (outgoingSelections.length > 0 || selection.id.startsWith("staged-")) setStagedCaptainEntryId(selection.race_entry_id);
                              else void changeCaptainFromTeam(selection);
                              setMobileExpandedHorseId(null);
                            }} className="min-h-11 rounded-lg border border-amber-200 bg-amber-50 px-2 text-xs font-bold text-amber-900 disabled:opacity-40">Captain</button>
                            <button type="button" disabled={!horse?.id} onClick={() => { if (horse?.id) setSelectedHorseId(horse.id); setMobileExpandedHorseId(null); }} className="min-h-11 rounded-lg border border-sky-200 bg-sky-50 px-2 text-xs font-bold text-sky-800 disabled:opacity-40">Profile</button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                  {Array.from({ length: Math.max(0, vacantDraftSlots - incomingEntries.slice(outgoingSelections.length).length) }, (_, index) => (
                    <div key={`vacant-draft-${index}`} className="flex min-h-[88px] items-center justify-center rounded-xl border-2 border-dashed border-sky-300 bg-sky-50 p-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-sky-300 bg-white text-3xl text-sky-700">+</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {replacementMode && (
            <section aria-label="Fantasy scoring system" className="mt-5 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-md">
              <div className="border-b border-slate-800 bg-slate-950 px-4 py-4 text-white">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-300">Racecourse Fantasy</p>
                <h2 className="mt-1 text-xl font-black">Scoring System</h2>
                <p className="mt-1 text-xs text-slate-300">Captain scores double points.</p>
              </div>
              <div className="p-3">
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full table-fixed text-center text-xs">
                    <thead>
                      <tr className="text-[10px] font-black uppercase tracking-wide">
                        <th className="bg-slate-100 px-2 py-2.5 text-left text-slate-600">Finish</th>
                        <th className="bg-amber-400 px-1 py-2.5 text-amber-950">G1</th>
                        <th className="bg-slate-400 px-1 py-2.5 text-white">G2</th>
                        <th className="bg-teal-500 px-1 py-2.5 text-white">G3</th>
                        <th className="bg-blue-100 px-1 py-2.5 text-blue-800">L</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                      {[
                        ["1st", 45, 35, 30, 25], ["2nd", 35, 30, 25, 20],
                        ["3rd", 30, 25, 20, 18], ["4th", 25, 20, 18, 16],
                        ["5th", 20, 18, 16, 14], ["6th", 18, 16, 14, 12],
                        ["7th", 16, 14, 12, 10], ["8th", 14, 12, 10, 8],
                        ["9th", 12, 10, 8, 6], ["10th", 10, 8, 6, 4],
                      ].map(([finish, g1, g2, g3, listed]) => (
                        <tr key={finish} className="bg-white">
                          <td className="px-2 py-2 text-left font-black text-slate-950">{finish}</td>
                          <td className="px-1 py-2">{g1}</td>
                          <td className="px-1 py-2">{g2}</td>
                          <td className="px-1 py-2">{g3}</td>
                          <td className="px-1 py-2">{listed}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
            )}
            </div>
            <aside className="min-w-0 space-y-4">
        {replacementMode && outgoingSelections.length === 0 && vacantDraftSlots === 0 && editButtonVisible && (
          <section aria-label="Replace horses" className="rounded-xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
            <h2 className="text-sm font-black text-sky-950">Replace horses</h2>
            <p className="mt-1 text-sm text-sky-800">Tap the red × on a horse in your selected team to open the replacement selector here. You can replace multiple horses before saving.</p>
            <button type="button" onClick={() => setReplacementMode(false)} className="mt-3 rounded-lg border border-sky-300 bg-white px-3 py-2 text-xs font-bold text-sky-800">Cancel editing</button>
          </section>
        )}
        {(outgoingSelections.length > 0 || vacantDraftSlots > 0) && editButtonVisible && (
          <section id="horse-selector" aria-label="Horse selection" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Team management</p>
                <h2 className="text-sm font-black">Horse selection</h2>
                <p className="text-[11px] text-slate-500">Select {pendingSlots} {pendingSlots === 1 ? "horse" : "horses"} to complete your team changes.</p>
              </div>
              <button type="button" onClick={cancelReplacement} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600">Cancel</button>
            </div>
            <div className="border-b border-slate-200 bg-white px-3 py-2">
              {outgoingSelections.length > 0 && <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Outgoing horses ({outgoingSelections.length})</p>}
              <div className="space-y-1.5">
                {outgoingSelections.map((selection) => (
                  <div key={selection.id} className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                    {showHorseSilks && selection.race_entry?.horse?.id && horseSilks[selection.race_entry.horse.id] && (
                      <img
                        src={horseSilks[selection.race_entry.horse.id] ?? ""}
                        alt={`${selection.race_entry.horse.name} silks`}
                        className="h-8 w-7 shrink-0 object-contain"
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{selection.race_entry?.horse?.name ?? "Unknown horse"}{selection.is_captain ? " (C)" : ""}</span>
                    <span className="text-xs font-semibold text-slate-600">{formatCurrency(selection.selected_price)}</span>
                    <button type="button" onClick={() => setOutgoingSelections((previous) => previous.filter((item) => item.id !== selection.id))}
                      disabled={incomingEntries.length > 0}
                      title="Restore outgoing horse" className="rounded px-2 py-1 text-xs font-bold text-red-700 disabled:opacity-30">Undo</button>
                  </div>
                ))}
              </div>
              {incomingEntries.length > 0 && (
                <>
                  <p className="mb-1.5 mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Incoming horses ({incomingEntries.length})</p>
                  {incomingEntries.map((entry) => (
                    <div key={entry.id} className="mb-1 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                      {showHorseSilks && entry.horse?.silks_url && (
                        <img src={entry.horse.silks_url} alt={`${entry.horse.name} silks`} className="h-8 w-7 shrink-0 object-contain" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">{entry.horse?.name}</span>
                      <span className="text-xs font-semibold">{formatCurrency(entry.price_at_entry)}</span>
                      <button type="button" onClick={() => { setIncomingEntries((previous) => previous.filter((item) => item.id !== entry.id)); if (stagedCaptainEntryId === entry.id) setStagedCaptainEntryId(null); }}
                        className="rounded px-2 py-1 text-xs font-bold text-red-700">Undo</button>
                    </div>
                  ))}
                </>
              )}
              <p className="mt-2 text-xs font-bold text-slate-700">{pendingSlots} {pendingSlots === 1 ? "position" : "positions"} remaining</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => void saveReplacements()} disabled={teamActionBusy || incomingEntries.length === 0 || (team?.status === "submitted" && pendingSlots !== 0)}
                  className="min-h-9 flex-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:bg-slate-200 disabled:text-slate-500">
                  {teamActionBusy ? "Saving…" : vacantDraftSlots > 0 ? "Save draft horses" : "Save all replacements"}
                </button>
                <button type="button" onClick={cancelReplacement} className="rounded-md border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700">Cancel all</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1 px-2.5 py-2">
              <input aria-label="Search horses" value={replacementSearch} onChange={(e) => setReplacementSearch(e.target.value)}
                placeholder="Search horses or races…" className="col-span-2 h-8 rounded-md border border-slate-300 px-2.5 text-xs text-slate-950" />
              <select aria-label="Filter grade" value={replacementGrade} onChange={(e) => setReplacementGrade(e.target.value)}
                className="h-8 min-w-0 rounded-md border border-slate-300 px-2 text-xs text-slate-950">
                <option value="all">All grades</option><option value="G1">G1</option><option value="G2">G2</option><option value="G3">G3</option><option value="L">Listed</option>
              </select>
              <select aria-label="Sort horses" value={replacementSort} onChange={(e) => setReplacementSort(e.target.value)}
                className="h-8 min-w-0 rounded-md border border-slate-300 px-2 text-xs text-slate-950">
                <option value="race">Saddlecloth number</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Horse name</option>
              </select>
            </div>
            <p className="px-2.5 pb-1.5 text-[11px] font-semibold text-slate-600">
              Available salary: {formatCurrency(salaryCap - draftSalary)}
            </p>
            {replacementError && <p role="alert" className="mx-4 mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{replacementError}</p>}
            {replacementLoading ? <p className="p-5 text-sm text-slate-600">Loading available horses…</p> : (
              <div className="max-h-[65vh] min-h-[320px] divide-y divide-slate-100 overflow-y-auto overscroll-contain border-t border-slate-200">
                {availableReplacementEntries.length === 0 && <p className="p-5 text-sm text-slate-600">No horses match your filters.</p>}
                {replacementRaceGroups.map((group) => (
                  <details key={group.key} open className="group/race border-b border-slate-200 bg-white">
                    <summary className="sticky top-0 z-10 flex cursor-pointer list-none items-center justify-between gap-2 border-b border-slate-200 bg-slate-100 px-2.5 py-1 text-slate-900 marker:hidden [&::-webkit-details-marker]:hidden">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="shrink-0 text-xs font-black text-slate-700">R{group.race?.race_number ?? "—"}</span>
                          <span className="truncate text-xs font-bold">{group.race?.race_name ?? "Race unavailable"}</span>
                          {group.race?.grade && <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${getGradeClasses(group.race.grade)}`}>{getGradeLabel(group.race.grade)}</span>}
                        </div>
                        <p className="text-[10px] font-medium leading-tight text-slate-600">{group.race?.racecourse?.name ?? "Racecourse unavailable"} · {group.race?.scheduled_start ? formatRaceTime(group.race.scheduled_start) : "Time TBC"} · {group.entries.length} {group.entries.length === 1 ? "horse" : "horses"}</p>
                      </div>
                      <span className="shrink-0 text-xs font-bold text-sky-700 group-open/race:rotate-180">⌄</span>
                    </summary>
                    <div className="divide-y divide-slate-100">
                      {group.entries.map((entry) => {
                      const selected = draftHorseIds.has(entry.horse_id);
                      const scratched = entry.entry_status !== "runner";
                      const affordable = entry.price_at_entry <= salaryCap - draftSalary;
                      const canAdd = !selected && !scratched && affordable && pendingSlots > 0;
                      return (
                        <div key={entry.id} className={`flex min-h-10 items-center gap-2 px-2.5 py-1 ${scratched ? "bg-red-50/70" : selected ? "bg-sky-50/70" : "hover:bg-slate-50"}`}>

                      {entry.horse?.silks_url ? <img src={entry.horse.silks_url} alt="" className="h-7 w-6 shrink-0 object-contain" /> : <span className="flex h-7 w-6 shrink-0 items-center justify-center rounded bg-slate-100 text-xs text-slate-400">—</span>}
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <p className="min-w-0 truncate text-sm font-bold text-slate-950">{entry.horse?.name ?? "Unknown horse"}</p>
                          <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] font-semibold text-slate-600" title="Recent form">{replacementRecentForms[entry.horse_id] || "—"}</span>
                          {scratched && <span className="shrink-0 rounded bg-red-100 px-1 py-0.5 text-[10px] font-bold text-red-700">Scratched</span>}
                          {!scratched && selected && <span className="shrink-0 rounded bg-sky-100 px-1 py-0.5 text-[10px] font-bold text-sky-800">Selected</span>}
                        </div>
                      </div>
                      <div className="shrink-0 text-right"><p className="text-xs font-semibold text-slate-900">{formatCurrency(entry.price_at_entry)}</p>
                        {projectionsVisible && <p className="text-[10px] leading-tight text-slate-500">{entry.projected_points ?? "—"} proj.</p>}
                      </div>
                      <button type="button" disabled={!canAdd || teamActionBusy}
                        onClick={() => stageReplacement(entry)}
                        aria-label={scratched ? `${entry.horse?.name ?? "Horse"} scratched` : selected ? `${entry.horse?.name ?? "Horse"} already selected` : `Add ${entry.horse?.name ?? "horse"} to team`}
                        title={scratched ? "Scratched" : selected ? "Already selected" : pendingSlots <= 0 ? "All vacant slots filled" : affordable ? "Add horse" : "Over salary cap"}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-base font-medium text-slate-800 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-35">
                        {selected ? "✓" : scratched ? "×" : pendingSlots <= 0 ? "✓" : affordable ? "+" : "×"}
                      </button>
                    </div>
                      );
                    })}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>
        )}

              {outgoingSelections.length === 0 && vacantDraftSlots === 0 && (
                <>
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Horse search">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <h2 className="text-sm font-black text-slate-900">Horse Search</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Search horses entered in the current round.</p>
                </div>
                <div className="p-3">
                  <input
                    type="search"
                    aria-label="Search horses racing in this round"
                    value={horseLookup}
                    onChange={(event) => setHorseLookup(event.target.value)}
                    placeholder="Enter a horse name…"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                  {horseLookup.trim() && (
                    <div className="mt-2 max-h-80 overflow-y-auto rounded-lg border border-slate-200" aria-live="polite">
                      {horseLookupLoading ? (
                        <p className="px-3 py-4 text-xs text-slate-500">Searching horses…</p>
                      ) : horseLookupError ? (
                        <p role="alert" className="px-3 py-4 text-xs text-red-700">{horseLookupError}</p>
                      ) : horseLookupResults.length === 0 ? (
                        <p className="px-3 py-4 text-xs text-slate-500">No horses racing in this round match your search.</p>
                      ) : (
                        <>
                          <p className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-500">
                            {horseLookupResults.length} matching {horseLookupResults.length === 1 ? "horse" : "horses"}
                          </p>
                          <div className="divide-y divide-slate-100">
                            {horseLookupResults.map((horse) => (
                              <button key={horse.id} type="button" onClick={() => setSelectedHorseId(horse.id)}
                                className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-sky-50 focus-visible:bg-sky-50">
                                {horse.silks_url ? (
                                  <img src={horse.silks_url} alt="" className="h-8 w-7 shrink-0 object-contain" />
                                ) : (
                                  <span className="flex h-8 w-7 shrink-0 items-center justify-center rounded bg-slate-100 text-xs text-slate-400">—</span>
                                )}
                                <span className="min-w-0 flex-1 flex flex-wrap items-center gap-1.5">
                                  <span className="truncate text-sm font-bold text-slate-900">{horse.name}</span>
                                  {horse.grades.map((grade) => (
                                    <span key={grade} className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black ${grade === "G1" ? "bg-amber-100 text-amber-900" : grade === "G2" ? "bg-slate-200 text-slate-800" : grade === "G3" ? "bg-teal-100 text-teal-800" : "bg-sky-100 text-sky-800"}`}>{grade}</span>
                                  ))}
                                </span>
                                <span className="shrink-0 text-xs font-semibold text-slate-600">{formatCurrency(horse.current_price)}</span>
                                <span aria-hidden="true" className="text-slate-400">›</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </section>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-sky-300 bg-gradient-to-r from-cyan-500 to-sky-500 px-4 py-3 text-white">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/25 bg-white/15 text-white backdrop-blur-sm">
                      <Icon name="calendar" />
                    </span>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/80">
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
                          className="grid w-full grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-2 px-3 py-3 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500 sm:grid-cols-[70px_minmax(0,1fr)_auto] sm:gap-3 sm:px-4"
                          aria-label={`View race details for ${fixtureRace.race_name}`}
                        >
                          <p className="text-xs font-bold text-slate-950">
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
                              className={`hidden rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide sm:inline-flex ${
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
                <div className="flex items-center gap-2 border-b border-sky-300 bg-gradient-to-r from-cyan-500 to-sky-500 px-4 py-3 text-white">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/25 bg-white/15 text-white backdrop-blur-sm">
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
                        className="w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500"
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
                          <span className="shrink-0 text-xs font-black text-sky-700">
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
                              <span className="text-lg font-black text-sky-700">
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
                </>
              )}
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
                <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-700">
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
                  className="origin-top-left"
                  style={{
                    width: "540px",
                    transform:
                      typeof window !== "undefined" && window.innerWidth < 580
                        ? `scale(${Math.min((window.innerWidth - 48) / 540, 1)})`
                        : "scale(1)",
                    transformOrigin: "top left",
                  }}
                >
                  <div
                    ref={shareCardRef}
                    className="w-[540px] bg-white text-slate-950"
                    style={{ fontFamily: "Lato, Arial, Helvetica, sans-serif" }}
                  >
                  {/* Match the visual style used by Best of the Round */}
                  <div className="px-5 pb-4 pt-5">
                    <div className="flex items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-400 px-5 py-4 text-slate-950">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">
                          Racecourse Fantasy
                        </p>
                        <h2 className="mt-1 truncate text-[24px] font-black leading-tight">
                          {team?.team_name?.trim() || "My Team"}
                        </h2>
                        <p className="mt-1 text-[11px] font-bold opacity-75">
                          Round {round.round_number}
                          {round.name ? ` · ${round.name}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[34px] font-black leading-none tabular-nums">
                          {totalPoints}
                        </p>
                        <p className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] opacity-70">
                          points
                        </p>
                      </div>
                    </div>
                    {autofillPenalty > 0 && (
                      <div className="mt-3 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-red-700">
                          Autofill penalty · {autofilledHorseCount} × 3 pts
                        </p>
                        <p className="text-[13px] font-black text-red-700">
                          −{autofillPenalty} pts
                        </p>
                      </div>
                    )}
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
                          Selected Horses
                        </p>
                        <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                          {season.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        {lockoutHasStarted ? (
                          <>
                            <div>
                              <p className="text-[8px] font-black uppercase tracking-wide text-slate-400">
                                Rd Rank
                              </p>
                              <p className="mt-0.5 text-[14px] font-black text-sky-700">
                                {roundRank === null ? "—" : `#${roundRank}`}
                              </p>
                            </div>
                            <div>
                              <p className="text-[8px] font-black uppercase tracking-wide text-slate-400">
                                Overall Rank
                              </p>
                              <p className="mt-0.5 text-[14px] font-black text-slate-800">
                                {overallRank === null ? "—" : `#${overallRank}`}
                              </p>
                            </div>
                          </>
                        ) : (
                          <div>
                            <p className="text-[8px] font-black uppercase tracking-wide text-slate-400">
                              Projected
                            </p>
                            <p className="mt-0.5 text-[14px] font-black text-amber-600">
                              {projectionsVisible ? liveProjectedScore : "Hidden"}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {sortedSelections.map((selection) => {
                        const entry = selection.race_entry;
                        const horse = entry?.horse;
                        const race = entry?.race;
                        const activeNominations =
                          selection.active_nominations ?? [];
                        const isScratched =
                          selection.is_scratched === true;
                        const shareRaces =
                          activeNominations.length > 0
                            ? activeNominations
                                .map((nomination) => nomination.race)
                                .filter(
                                  (item): item is FixtureRace =>
                                    Boolean(item)
                                )
                            : race
                              ? [race]
                              : [];
                        const points = selection.is_captain
                          ? (selection.fantasy_points ?? 0) * 2
                          : selection.fantasy_points ?? 0;
                        const projected =
                          entry?.projected_points ??
                          projectedPointsByEntryId[
                            selection.race_entry_id
                          ] ??
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
                            className={`flex min-h-[78px] items-center gap-2 rounded-xl border p-2.5 ${
                              isScratched
                                ? "border-red-200 bg-red-50"
                                : selection.is_captain
                                  ? "border-amber-200 bg-amber-50/60"
                                  : "border-slate-200 bg-white"
                            }`}
                          >
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center">
                              {showHorseSilks &&
                              horse?.id &&
                              horseSilks[horse.id] ? (
                                <img
                                  src={horseSilks[horse.id] ?? ""}
                                  alt={`${horse.name} silks`}
                                  className="h-full w-full object-contain"
                                />
                              ) : (
                                <span className="text-xl font-black text-slate-300">
                                  ?
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <p className="truncate text-[12px] font-black text-slate-950">
                                  {horse?.name ?? "Unknown horse"}
                                </p>
                                {selection.is_captain && (
                                  <span className="shrink-0 rounded-full bg-amber-200 px-1.5 py-0.5 text-[8px] font-black text-amber-900">
                                    C
                                  </span>
                                )}
                              </div>
                              {isScratched ? (
                                <p className="mt-0.5 text-[9px] font-black uppercase text-red-700">
                                  Scratched
                                </p>
                              ) : shareRaces.length > 0 ? (
                                <p className="mt-0.5 truncate text-[9px] font-semibold text-slate-500">
                                  {shareRaces
                                    .map(
                                      (shareRace) =>
                                        `R${shareRace.race_number} · ${shareRace.race_name}`
                                    )
                                    .join(" / ")}
                                </p>
                              ) : (
                                <p className="mt-0.5 text-[9px] font-semibold text-slate-400">
                                  Race unavailable
                                </p>
                              )}
                            </div>
                            <div className="shrink-0 text-right">
                              {selection.has_result ? (
                                <>
                                  <p className="text-[17px] font-black leading-none tabular-nums text-cyan-700">
                                    {points}
                                  </p>
                                  <p className="mt-1 text-[7px] font-black uppercase tracking-wide text-slate-400">
                                    {selection.is_captain ? "pts · 2×" : "pts"}
                                  </p>
                                </>
                              ) : isScratched ? (
                                <p className="text-[8px] font-black uppercase text-red-700">
                                  SCR
                                </p>
                              ) : (
                                <>
                                  <p className="text-[17px] font-black leading-none tabular-nums text-amber-600">
                                    {projectionsVisible
                                      ? shownProjection ?? "—"
                                      : "—"}
                                  </p>
                                  <p className="mt-1 text-[7px] font-black uppercase tracking-wide text-slate-400">
                                    {projectionsVisible ? "proj" : "hidden"}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-3">
                    <p className="text-[9px] font-bold text-slate-400">
                      Captain scores 2× points
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">
                      Racecourse Fantasy
                    </p>
                  </div>
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
                                    className="font-bold text-slate-950 hover:text-sky-700"
                                  >
                                    {result.horse_name}
                                  </button>
                                </td>
                                <td className="px-4 py-4 text-right font-bold text-sky-700">
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
