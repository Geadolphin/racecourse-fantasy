"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

type LockoutGroupKey =
  | "main"
  | "group_a"
  | "group_b"
  | "group_c"
  | "group_d";

type RoundLockout = {
  id: string;
  round_id: string;
  group_key: LockoutGroupKey;
  display_name: string;
  lockout_at: string;
  sort_order: number;
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
  round_id: string;
  lockout_group: LockoutGroupKey;
  race_number: number;
  race_name: string;
  grade: "L" | "G3" | "G2" | "G1";
  scheduled_start: string;
  racecourse: Racecourse | null;
};

type EntryStatus =
  | "runner"
  | "scratched_before_lockout"
  | "scratched_after_lockout";

type RaceEntry = {
  id: string;
  race_id: string;
  horse_id: string;

  barrier: number | null;
  saddlecloth_number: number | null;
  price_at_entry: number;
  entry_status: EntryStatus;
  scratched_at: string | null;

  created_at: string;
  updated_at: string;

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
  salary_cap: number;
};

type TeamSelection = {
  id: string;
  team_id: string;
  race_entry_id: string;
  is_captain: boolean;
  selected_price: number;
  fantasy_points: number;
};

type RaceTypeFilter = "all" | "G1" | "G2" | "G3" | "L";

type SortOption =
  | "race"
  | "price-high"
  | "price-low"
  | "name";

const priceFilterOptions = [
  30000,
  50000,
  100000,
  150000,
  200000,
  250000,
  300000,
  350000,
  400000,
  450000,
  500000,
  550000,
  600000,
];

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

function getGradeLabel(grade: Race["grade"]) {
  const labels: Record<Race["grade"], string> = {
    L: "Listed",
    G3: "Group 3",
    G2: "Group 2",
    G1: "Group 1",
  };

  return labels[grade];
}

function getEntryStatusLabel(status: EntryStatus) {
  const labels: Record<EntryStatus, string> = {
    runner: "Runner",
    scratched_before_lockout: "Scratched",
    scratched_after_lockout: "Late scratching",
  };

  return labels[status];
}

export default function EditTeamPage() {
  const router = useRouter();

  const [season, setSeason] = useState<Season | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [salaryCap, setSalaryCap] = useState(0);
  const [entries, setEntries] = useState<RaceEntry[]>([]);
  const [roundLockouts, setRoundLockouts] =
    useState<RoundLockout[]>([]);
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [savedSelections, setSavedSelections] =
    useState<TeamSelection[]>([]);
  const [captainEntryId, setCaptainEntryId] = useState<string | null>(
    null
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [raceTypeFilter, setRaceTypeFilter] =
    useState<RaceTypeFilter>("all");
  const [selectedHorseId, setSelectedHorseId] = useState<string | null>(null);

  const [raceFilter, setRaceFilter] = useState("all");
  const [minPriceFilter, setMinPriceFilter] = useState("any");
  const [maxPriceFilter, setMaxPriceFilter] = useState("any");
  const [sortOption, setSortOption] =
    useState<SortOption>("race");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const loadPage = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage("You must be signed in to edit your team.");
      setLoading(false);
      return;
    }

    const { data: roundData, error: roundError } = await supabase
      .from("rounds")
      .select(
        `
          id,
          season_id,
          round_number,
          name,
          status,
          lockout_at
        `
      )
      .eq("status", "open")
      .order("lockout_at", {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

    if (roundError) {
      console.error("Round load error:", roundError);
      setErrorMessage(roundError.message);
      setLoading(false);
      return;
    }

    if (!roundData) {
      setErrorMessage("There is no current round.");
      setLoading(false);
      return;
    }

    const currentRound = roundData as Round;

    setRound(currentRound);

    const {
      data: lockoutData,
      error: lockoutError,
    } = await supabase.rpc("get_round_lockouts", {
      p_round_id: currentRound.id,
    });

    if (lockoutError) {
      console.error("Round lockouts load error:", lockoutError);
      setErrorMessage(
        lockoutError.message ||
          "Could not load this round's lockout groups."
      );
      setLoading(false);
      return;
    }

    const loadedLockouts =
      ((lockoutData ?? []) as RoundLockout[]).sort(
        (a, b) =>
          a.sort_order - b.sort_order ||
          new Date(a.lockout_at).getTime() -
            new Date(b.lockout_at).getTime()
      );

    setRoundLockouts(
      loadedLockouts.length > 0
        ? loadedLockouts
        : [
            {
              id: "legacy-main",
              round_id: currentRound.id,
              group_key: "main",
              display_name: "Main Lockout",
              lockout_at: currentRound.lockout_at,
              sort_order: 1,
            },
          ]
    );

    const { data: seasonData, error: seasonError } = await supabase
      .from("seasons")
      .select(
        `
          id,
          name,
          salary_cap,
          team_size
        `
      )
      .eq("id", currentRound.season_id)
      .single();

    if (seasonError || !seasonData) {
      console.error("Season load error:", seasonError);

      setErrorMessage(
        seasonError?.message ?? "Could not load the current season."
      );

      setLoading(false);
      return;
    }

    setSeason(seasonData as Season);

    const {
      data: playerSalaryCap,
      error: salaryCapError,
    } = await supabase.rpc(
      "get_my_round_salary_cap",
      {
        p_round_id: currentRound.id,
      }
    );

    if (salaryCapError) {
      console.error(
        "Salary cap load error:",
        salaryCapError
      );

      setErrorMessage(
        salaryCapError.message ||
          "Unable to load your salary cap."
      );

      setLoading(false);
      return;
    }

    setSalaryCap(
      typeof playerSalaryCap === "number"
        ? playerSalaryCap
        : seasonData.salary_cap
    );

    const { data: entryData, error: entryError } = await supabase
      .from("race_entries")
      .select(
        `
          id,
          race_id,
          horse_id,
          barrier,
          saddlecloth_number,
          price_at_entry,
          entry_status,
          scratched_at,
          created_at,
          updated_at,

          horse:horses (
            id,
            name,
            current_price
          ),

          race:races!inner (
            id,
            round_id,
            lockout_group,
            race_number,
            race_name,
            grade,
            scheduled_start,

            racecourse:racecourses (
              id,
              name
            )
          )
        `
      )
      .eq("race.round_id", currentRound.id);

    if (entryError) {
      console.error("Race entries load error:", entryError);
      setErrorMessage(entryError.message);
      setLoading(false);
      return;
    }

    setEntries((entryData ?? []) as unknown as RaceEntry[]);

    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .select(
        `
          id,
          user_id,
          round_id,
          team_name,
          status,
          salary_used,
          salary_cap
        `
      )
      .eq("user_id", user.id)
      .eq("round_id", currentRound.id)
      .maybeSingle();

    if (teamError) {
      console.error("Team load error:", teamError);
      setErrorMessage(teamError.message);
      setLoading(false);
      return;
    }

    if (!teamData) {
      setTeam(null);
      setSelectedEntryIds([]);
      setSavedSelections([]);
      setCaptainEntryId(null);
      setLoading(false);
      return;
    }

    const currentTeam = teamData as Team;

    setTeam(currentTeam);

    const { data: selectionData, error: selectionError } =
      await supabase
        .from("team_selections")
        .select(
          `
            id,
            team_id,
            race_entry_id,
            is_captain,
            selected_price,
            fantasy_points
          `
        )
        .eq("team_id", currentTeam.id);

    if (selectionError) {
      console.error("Team selections load error:", selectionError);
      setErrorMessage(selectionError.message);
      setLoading(false);
      return;
    }

    const selections =
      (selectionData ?? []) as TeamSelection[];

    setSavedSelections(selections);

    setSelectedEntryIds(
      selections.map((selection) => selection.race_entry_id)
    );

    const captainSelection = selections.find(
      (selection) => selection.is_captain
    );

    setCaptainEntryId(
      captainSelection?.race_entry_id ?? null
    );

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const lockoutByGroup = useMemo(() => {
    return new Map(
      roundLockouts.map((lockout) => [
        lockout.group_key,
        lockout,
      ])
    );
  }, [roundLockouts]);

  const firstLockout = useMemo(() => {
    if (roundLockouts.length === 0) {
      return null;
    }

    return [...roundLockouts].sort(
      (a, b) =>
        new Date(a.lockout_at).getTime() -
        new Date(b.lockout_at).getTime()
    )[0];
  }, [roundLockouts]);

  const nextLockout = useMemo(() => {
    return (
      [...roundLockouts]
        .filter(
          (lockout) =>
            new Date(lockout.lockout_at).getTime() >
            currentTime
        )
        .sort(
          (a, b) =>
            new Date(a.lockout_at).getTime() -
            new Date(b.lockout_at).getTime()
        )[0] ?? null
    );
  }, [currentTime, roundLockouts]);

  const firstLockoutHasStarted =
    firstLockout !== null &&
    currentTime >=
      new Date(firstLockout.lockout_at).getTime();

  const allLockoutsHaveStarted =
    roundLockouts.length > 0 &&
    roundLockouts.every(
      (lockout) =>
        currentTime >=
        new Date(lockout.lockout_at).getTime()
    );

  const teamIsEditable =
    round !== null &&
    round.status === "open" &&
    !allLockoutsHaveStarted;

  function getEntryLockout(entry: RaceEntry) {
    const groupKey =
      entry.race?.lockout_group ?? "main";

    return (
      lockoutByGroup.get(groupKey) ??
      lockoutByGroup.get("main") ??
      null
    );
  }

  function entryIsLocked(entry: RaceEntry) {
    const lockout = getEntryLockout(entry);

    if (!lockout) {
      return round
        ? currentTime >=
            new Date(round.lockout_at).getTime()
        : true;
    }

    return (
      currentTime >=
      new Date(lockout.lockout_at).getTime()
    );
  }

  function entryIdIsLocked(entryId: string) {
    const entry = entries.find(
      (item) => item.id === entryId
    );

    return entry ? entryIsLocked(entry) : false;
  }

  const lockedSavedEntryIds = useMemo(() => {
    return new Set(
      savedSelections
        .filter((selection) =>
          entryIdIsLocked(selection.race_entry_id)
        )
        .map((selection) => selection.race_entry_id)
    );
  }, [currentTime, entries, savedSelections]);

  const lockedCaptainEntryId = useMemo(() => {
    const savedCaptain = savedSelections.find(
      (selection) => selection.is_captain
    );

    if (
      savedCaptain &&
      lockedSavedEntryIds.has(
        savedCaptain.race_entry_id
      )
    ) {
      return savedCaptain.race_entry_id;
    }

    return null;
  }, [lockedSavedEntryIds, savedSelections]);

  const selectedEntries = useMemo(() => {
    return entries.filter((entry) =>
      selectedEntryIds.includes(entry.id)
    );
  }, [entries, selectedEntryIds]);

  const salaryUsed = useMemo(() => {
    return selectedEntries.reduce((total, entry) => {
      return total + entry.price_at_entry;
    }, 0);
  }, [selectedEntries]);

  const salaryRemaining = salaryCap - salaryUsed;

  const selectedCount = selectedEntryIds.length;
  const teamSize = season?.team_size ?? 0;

  const teamIsComplete =
    selectedCount === teamSize &&
    captainEntryId !== null &&
    salaryUsed <= salaryCap;

  const raceOptions = useMemo(() => {
    const uniqueRaces = new Map<string, Race>();

    for (const entry of entries) {
      if (entry.race) {
        uniqueRaces.set(entry.race.id, entry.race);
      }
    }

    return [...uniqueRaces.values()].sort((a, b) => {
      const startDifference =
        new Date(a.scheduled_start).getTime() -
        new Date(b.scheduled_start).getTime();

      if (startDifference !== 0) {
        return startDifference;
      }

      return a.race_number - b.race_number;
    });
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const normalisedSearch = searchTerm.trim().toLowerCase();

    const filtered = entries.filter((entry) => {
      const horseName = entry.horse?.name.toLowerCase() ?? "";
      const raceName = entry.race?.race_name.toLowerCase() ?? "";
      const racecourseName =
        entry.race?.racecourse?.name.toLowerCase() ?? "";

      const matchesSearch =
        normalisedSearch.length === 0 ||
        horseName.includes(normalisedSearch) ||
        raceName.includes(normalisedSearch) ||
        racecourseName.includes(normalisedSearch);

      const matchesGrade =
        raceTypeFilter === "all" ||
        entry.race?.grade === raceTypeFilter;

      const matchesRace =
        raceFilter === "all" ||
        entry.race_id === raceFilter;

      const matchesMinPrice =
        minPriceFilter === "any" ||
        entry.price_at_entry >= Number(minPriceFilter);

      const matchesMaxPrice =
        maxPriceFilter === "any" ||
        entry.price_at_entry <= Number(maxPriceFilter);

      return (
        matchesSearch &&
        matchesGrade &&
        matchesRace &&
        matchesMinPrice &&
        matchesMaxPrice
      );
    });

    return [...filtered].sort((a, b) => {
      if (sortOption === "price-high") {
        return b.price_at_entry - a.price_at_entry;
      }

      if (sortOption === "price-low") {
        return a.price_at_entry - b.price_at_entry;
      }

      if (sortOption === "name") {
        return (a.horse?.name ?? "").localeCompare(
          b.horse?.name ?? ""
        );
      }

      const startA = a.race?.scheduled_start
        ? new Date(a.race.scheduled_start).getTime()
        : Number.MAX_SAFE_INTEGER;

      const startB = b.race?.scheduled_start
        ? new Date(b.race.scheduled_start).getTime()
        : Number.MAX_SAFE_INTEGER;

      if (startA !== startB) {
        return startA - startB;
      }

      return (
        (a.race?.race_number ?? 999) -
        (b.race?.race_number ?? 999)
      );
    });
  }, [
    entries,
    maxPriceFilter,
    minPriceFilter,
    raceFilter,
    raceTypeFilter,
    searchTerm,
    sortOption,
  ]);

  function clearMessages() {
    setErrorMessage("");
    setSuccessMessage("");
  }

  function toggleEntry(entry: RaceEntry) {
    clearMessages();

    if (!teamIsEditable) {
      setErrorMessage(
        "This team can no longer be edited because all lockouts have commenced."
      );
      return;
    }

    if (entryIsLocked(entry)) {
      setErrorMessage(
        `${entry.horse?.name ?? "This horse"} is locked and can no longer be changed.`
      );
      return;
    }

    if (!team && firstLockoutHasStarted) {
      setErrorMessage(
        "A new team cannot be created after the first lockout has commenced."
      );
      return;
    }

    if (entry.entry_status !== "runner") {
      setErrorMessage(
        `${entry.horse?.name ?? "This horse"} is unavailable for selection.`
      );
      return;
    }

    const alreadySelected = selectedEntryIds.includes(entry.id);

    if (alreadySelected) {
      setSelectedEntryIds((current) =>
        current.filter((id) => id !== entry.id)
      );

      if (captainEntryId === entry.id) {
        setCaptainEntryId(null);
      }

      return;
    }

    if (selectedEntryIds.length >= teamSize) {
      setErrorMessage(
        `You can only select ${teamSize} horses.`
      );
      return;
    }

    const newSalaryUsed = salaryUsed + entry.price_at_entry;

    if (newSalaryUsed > salaryCap) {
      setErrorMessage(
        `Selecting ${entry.horse?.name ?? "this horse"} would exceed your salary cap.`
      );
      return;
    }

    setSelectedEntryIds((current) => [...current, entry.id]);
  }

  function selectCaptain(entryId: string) {
    clearMessages();

    if (!teamIsEditable) {
      setErrorMessage(
        "The captain cannot be changed because all lockouts have commenced."
      );
      return;
    }

    if (lockedCaptainEntryId) {
      setErrorMessage(
        "Your captain is already locked and cannot be changed."
      );
      return;
    }

    if (entryIdIsLocked(entryId)) {
      setErrorMessage(
        "A locked horse cannot be made captain."
      );
      return;
    }

    if (!selectedEntryIds.includes(entryId)) {
      setErrorMessage(
        "Your captain must be one of your selected horses."
      );
      return;
    }

    setCaptainEntryId(entryId);
  }

  async function saveTeamRpc(
    status: "draft" | "submitted"
  ): Promise<boolean> {
    if (!round) {
      setErrorMessage("There is no current round.");
      return false;
    }

    const { error } = await supabase.rpc(
      "save_my_round_team",
      {
        p_round_id: round.id,
        p_entry_ids: selectedEntryIds,
        p_captain_entry_id: captainEntryId,
        p_status: status,
      }
    );

    if (error) {
      console.error("Secure save error:", error);
      setErrorMessage(error.message);
      return false;
    }

    await loadPage();
    return true;
  }

  async function saveDraft() {
    clearMessages();

    if (!teamIsEditable) {
      setErrorMessage(
        "Your team can no longer be edited because all lockouts have commenced."
      );
      return;
    }

    if (salaryUsed > salaryCap) {
      setErrorMessage("Your team is over the salary cap.");
      return;
    }

    setSaving(true);

    const ok = await saveTeamRpc("draft");
    setSaving(false);

    if (!ok) {
      return;
    }

    setSuccessMessage("Your draft team has been saved.");
  }

  async function submitTeam() {
    clearMessages();

    if (!teamIsEditable) {
      setErrorMessage(
        "Your team can no longer be submitted because all lockouts have commenced."
      );
      return;
    }

    if (!team && firstLockoutHasStarted) {
      setErrorMessage(
        "A new team cannot be submitted after the first lockout has commenced."
      );
      return;
    }

    if (selectedCount !== teamSize) {
      setErrorMessage(
        `You must select exactly ${teamSize} horses before submitting your team.`
      );
      return;
    }

    if (!captainEntryId) {
      setErrorMessage(
        "You must choose one selected horse as captain."
      );
      return;
    }

    if (salaryUsed > salaryCap) {
      setErrorMessage("Your team is over the salary cap.");
      return;
    }

    setSubmitting(true);

    const ok = await saveTeamRpc("submitted");

    setSubmitting(false);

    if (!ok) {
      return;
    }

    router.push("/team");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-7xl rounded-xl border bg-white p-10 text-center text-slate-500">
          Loading team selection...
        </div>
      </main>
    );
  }

  if (!round || !season) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-4xl rounded-xl border bg-white p-8">
          <h1 className="text-2xl font-bold text-slate-900">
            Edit Team
          </h1>

          <p className="mt-4 text-red-700">
            {errorMessage || "There is no current round."}
          </p>

          <Link
            href="/team"
            className="mt-6 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-bold text-white hover:bg-slate-800"
          >
            Return to My Team
          </Link>
        </div>
      </main>
    );
  }

  if (!teamIsEditable) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 md:p-8">
        <div className="mx-auto max-w-5xl">
          <section className="rounded-xl border bg-white p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 text-2xl">
              🔒
            </div>

            <h1 className="mt-5 text-3xl font-bold text-slate-900">
              Team editing is closed
            </h1>

            <p className="mt-3 text-slate-600">
              All lockout groups for Round {round.round_number} have
              commenced.
            </p>

            <p className="mt-2 text-slate-600">
              Your selected team can still be viewed on the My Team
              page.
            </p>

            <Link
              href="/team"
              className="mt-7 inline-flex rounded-lg bg-teal-700 px-6 py-3 font-bold text-white hover:bg-teal-800"
            >
              View My Team
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-3 md:p-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="overflow-hidden rounded-2xl bg-teal-700 text-white shadow-sm">
          <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:p-5">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-200">
                {season.name}
              </p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="text-2xl font-bold md:text-3xl">Edit Team</h1>
                <span className="text-sm font-semibold text-teal-100">
                  Round {round.round_number}{round.name ? ` — ${round.name}` : ""}
                </span>
              </div>
              <p className="mt-2 text-sm text-teal-100">
                {nextLockout
                  ? `Next lockout: ${nextLockout.display_name} — ${formatDateTime(nextLockout.lockout_at)}`
                  : "All lockouts have commenced"}
              </p>
            </div>

            <Link
              href="/team"
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-white/35 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
            >
              Cancel and return
            </Link>
          </div>

          <div className="grid grid-cols-2 border-t border-white/15 bg-black/10 sm:grid-cols-4">
            <div className="border-r border-white/10 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-teal-100">Horses</p>
              <p className="mt-1 text-lg font-bold">{selectedCount} / {teamSize}</p>
            </div>
            <div className="px-4 py-3 sm:border-r sm:border-white/10">
              <p className="text-[11px] font-bold uppercase tracking-wide text-teal-100">Used</p>
              <p className="mt-1 text-lg font-bold">{formatCurrency(salaryUsed)}</p>
            </div>
            <div className="border-r border-t border-white/10 px-4 py-3 sm:border-t-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-teal-100">Remaining</p>
              <p className={`mt-1 text-lg font-bold ${salaryRemaining < 0 ? "text-red-200" : "text-white"}`}>
                {formatCurrency(salaryRemaining)}
              </p>
            </div>
            <div className="border-t border-white/10 px-4 py-3 sm:border-t-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-teal-100">Captain</p>
              <p className="mt-1 truncate text-lg font-bold">
                {entries.find((entry) => entry.id === captainEntryId)?.horse?.name ?? "Not selected"}
              </p>
            </div>
          </div>
        </header>

        {roundLockouts.length > 0 && (
          <section className="mt-3 flex flex-wrap gap-2 rounded-xl border bg-white p-3 shadow-sm">
            <span className="mr-1 self-center text-xs font-bold uppercase tracking-wide text-slate-500">
              Lockouts
            </span>
            {roundLockouts.map((lockout) => {
              const isLocked = currentTime >= new Date(lockout.lockout_at).getTime();
              return (
                <span
                  key={lockout.id}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    isLocked ? "bg-slate-200 text-slate-600" : "bg-green-100 text-green-800"
                  }`}
                >
                  <span>{isLocked ? "🔒" : "●"}</span>
                  {lockout.display_name} · {formatDateTime(lockout.lockout_at)}
                </span>
              );
            })}
          </section>
        )}

        {errorMessage && (
          <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-3 rounded-lg border border-teal-300 bg-teal-50 p-3 text-sm text-teal-800">
            {successMessage}
          </div>
        )}

        <details className="mt-3 rounded-xl border bg-white shadow-sm lg:hidden" open={selectedEntries.length > 0}>
          <summary className="cursor-pointer list-none px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-slate-900">Your Team</p>
                <p className="text-sm text-slate-500">
                  {selectedCount}/{teamSize} selected · {formatCurrency(salaryRemaining)} remaining
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">View team</span>
            </div>
          </summary>
          <div className="border-t p-3">
            {selectedEntries.length === 0 ? (
              <p className="py-5 text-center text-sm text-slate-500">No horses selected.</p>
            ) : (
              <div className="divide-y rounded-lg border">
                {selectedEntries.map((entry, index) => {
                  const isCaptain = entry.id === captainEntryId;
                  const isLocked = entryIsLocked(entry);
                  return (
                    <div key={entry.id} className="flex items-center gap-3 p-3">
                      <span className="w-5 text-center text-xs font-bold text-slate-400">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate font-bold text-slate-900">{entry.horse?.name ?? "Unknown horse"}</p>
                          {isCaptain && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">C</span>}
                          {isLocked && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">LOCKED</span>}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {entry.race ? `${getGradeLabel(entry.race.grade)} · ${entry.race.racecourse?.name ?? "Racecourse"} R${entry.race.race_number}` : "Race unavailable"}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-bold text-slate-800">{formatCurrency(entry.price_at_entry)}</p>
                      <button
                        type="button"
                        onClick={() => selectCaptain(entry.id)}
                        disabled={isLocked || Boolean(lockedCaptainEntryId)}
                        className={`rounded-md px-2 py-1.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40 ${
                          isCaptain ? "bg-amber-500 text-white" : "border border-amber-400 text-amber-800"
                        }`}
                        aria-label={`Make ${entry.horse?.name ?? "horse"} captain`}
                      >
                        C
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleEntry(entry)}
                        disabled={isLocked}
                        className="rounded-md border border-red-200 px-2 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Remove ${entry.horse?.name ?? "horse"}`}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </details>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(280px,0.62fr)_minmax(0,1.38fr)] xl:grid-cols-[minmax(300px,0.55fr)_minmax(0,1.45fr)]">
          <section className="min-w-0">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Available Horses</h2>
                  <p className="mt-0.5 text-sm text-slate-500">Select horses for this round.</p>
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <span>{filteredEntries.length} shown</span>
                  <span>·</span>
                  <span>{entries.length} total</span>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search horses or races"
                  className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-700"
                />

                <select
                  value={raceTypeFilter}
                  onChange={(event) => setRaceTypeFilter(event.target.value as RaceTypeFilter)}
                  className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-700"
                >
                  <option value="all">All race types</option>
                  <option value="G1">Group 1</option>
                  <option value="G2">Group 2</option>
                  <option value="G3">Group 3</option>
                  <option value="L">Listed</option>
                </select>

                <select
                  value={raceFilter}
                  onChange={(event) => setRaceFilter(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-700"
                >
                  <option value="all">All races</option>
                  {raceOptions.map((raceOption) => (
                    <option key={raceOption.id} value={raceOption.id}>
                      {raceOption.racecourse?.name ?? "Racecourse"} R{raceOption.race_number} — {raceOption.race_name}
                    </option>
                  ))}
                </select>

                <select
                  value={minPriceFilter}
                  onChange={(event) => {
                    const nextMin = event.target.value;
                    setMinPriceFilter(nextMin);
                    if (nextMin !== "any" && maxPriceFilter !== "any" && Number(nextMin) > Number(maxPriceFilter)) {
                      setMaxPriceFilter("any");
                    }
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-700"
                >
                  <option value="any">Any minimum price</option>
                  {priceFilterOptions.map((price) => (
                    <option key={`min-${price}`} value={price}>{formatCurrency(price)}+</option>
                  ))}
                </select>

                <select
                  value={maxPriceFilter}
                  onChange={(event) => {
                    const nextMax = event.target.value;
                    setMaxPriceFilter(nextMax);
                    if (nextMax !== "any" && minPriceFilter !== "any" && Number(nextMax) < Number(minPriceFilter)) {
                      setMinPriceFilter("any");
                    }
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-700"
                >
                  <option value="any">Any maximum price</option>
                  {priceFilterOptions.map((price) => (
                    <option key={`max-${price}`} value={price}>Up to {formatCurrency(price)}</option>
                  ))}
                </select>

                <select
                  value={sortOption}
                  onChange={(event) => setSortOption(event.target.value as SortOption)}
                  className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-700"
                >
                  <option value="race">Race order</option>
                  <option value="price-high">Price: highest first</option>
                  <option value="price-low">Price: lowest first</option>
                  <option value="name">Horse name</option>
                </select>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {filteredEntries.length === 0 ? (
                <div className="rounded-xl border bg-white p-8 text-center text-slate-500">No horses match your filters.</div>
              ) : (
                filteredEntries.map((entry) => {
                  const isSelected = selectedEntryIds.includes(entry.id);
                  const isUnavailable = entry.entry_status !== "runner";
                  const isLocked = entryIsLocked(entry);
                  const entryLockout = getEntryLockout(entry);
                  const wouldExceedBudget = !isSelected && salaryUsed + entry.price_at_entry > salaryCap;

                  return (
                    <article
                      key={entry.id}
                      className={`rounded-lg border px-3 py-2.5 transition ${
                        isSelected
                          ? "border-teal-600 bg-teal-50"
                          : "bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-1.5">
                            {entry.horse?.id ? (
                              <button
                                type="button"
                                onClick={() => setSelectedHorseId(entry.horse!.id)}
                                className="min-w-0 truncate text-left text-sm font-bold text-slate-900 underline-offset-2 hover:text-teal-700 hover:underline focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
                                aria-label={`View statistics for ${entry.horse.name}`}
                              >
                                {entry.horse.name}
                              </button>
                            ) : (
                              <span className="truncate text-sm font-bold text-slate-900">
                                Unknown horse
                              </span>
                            )}

                            {isSelected && (
                              <span className="shrink-0 rounded bg-teal-700 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                                Selected
                              </span>
                            )}

                            {isUnavailable && (
                              <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-800">
                                {getEntryStatusLabel(entry.entry_status)}
                              </span>
                            )}

                            {isLocked && (
                              <span className="shrink-0 rounded bg-slate-700 px-1.5 py-0.5 text-[9px] font-bold text-white">
                                Locked
                              </span>
                            )}
                          </div>

                          <p className="mt-0.5 truncate text-[11px] text-slate-500">
                            {entry.race
                              ? `${getGradeLabel(entry.race.grade)} · ${entry.race.racecourse?.name ?? "Racecourse"} R${entry.race.race_number}`
                              : "Race unavailable"}
                          </p>

                          {entry.race && (
                            <p className="mt-0.5 truncate text-[10px] text-slate-400">
                              {entry.race.race_name}
                            </p>
                          )}
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold text-slate-900">
                            {formatCurrency(entry.price_at_entry)}
                          </p>
                          {wouldExceedBudget && (
                            <p className="text-[10px] font-bold text-red-700">
                              Over budget
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleEntry(entry)}
                          disabled={
                            isLocked ||
                            isUnavailable ||
                            (!isSelected &&
                              (selectedCount >= teamSize || wouldExceedBudget))
                          }
                          className={`w-[64px] shrink-0 rounded-md px-2 py-1.5 text-xs font-bold ${
                            isSelected
                              ? "bg-red-100 text-red-800 hover:bg-red-200"
                              : "bg-teal-900 text-white hover:bg-teal-700"
                          } disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500`}
                        >
                          {isLocked ? "Locked" : isSelected ? "Remove" : "Select"}
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <aside className="hidden lg:block">
            <div className="sticky top-4 overflow-hidden rounded-xl border bg-white shadow-sm">
              <div className="border-b bg-slate-50 px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Your Team
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Review your selections, open horse profiles and choose your captain.
                    </p>
                  </div>

                  <span className="rounded-full bg-slate-900 px-3 py-1.5 text-sm font-bold text-white">
                    {selectedCount}/{teamSize}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-white p-2.5 ring-1 ring-slate-200">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Remaining
                    </p>
                    <p
                      className={`mt-1 text-lg font-bold ${
                        salaryRemaining < 0 ? "text-red-700" : "text-green-800"
                      }`}
                    >
                      {formatCurrency(salaryRemaining)}
                    </p>
                  </div>

                  <div className="rounded-lg bg-white p-2.5 ring-1 ring-slate-200">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Used
                    </p>
                    <p className="mt-1 text-lg font-bold text-slate-800">
                      {formatCurrency(salaryUsed)}
                    </p>
                  </div>

                  <div className="rounded-lg bg-white p-2.5 ring-1 ring-slate-200">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Captain
                    </p>
                    <p className="mt-1 truncate text-sm font-bold text-slate-800">
                      {entries.find((entry) => entry.id === captainEntryId)?.horse?.name ?? "Not selected"}
                    </p>
                  </div>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full ${
                      salaryUsed > salaryCap ? "bg-red-600" : "bg-green-700"
                    }`}
                    style={{
                      width: `${
                        salaryCap > 0
                          ? Math.min((salaryUsed / salaryCap) * 100, 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className="p-3">
                {selectedEntries.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
                    No horses selected.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
                    {selectedEntries.map((entry) => {
                      const isCaptain = entry.id === captainEntryId;
                      const isLocked = entryIsLocked(entry);
                      const entryLockout = getEntryLockout(entry);

                      return (
                        <article
                          key={entry.id}
                          className={`rounded-xl border px-4 py-3 ${
                            isCaptain
                              ? "border-amber-300 bg-amber-50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              {entry.horse?.id ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedHorseId(entry.horse!.id)
                                  }
                                  className="truncate text-left text-lg font-semibold leading-tight text-slate-950 underline-offset-2 hover:text-teal-700 hover:underline focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
                                  aria-label={`View statistics for ${entry.horse.name}`}
                                >
                                  {entry.horse.name}
                                </button>
                              ) : (
                                <p className="truncate text-lg font-semibold leading-tight text-slate-950">
                                  Unknown horse
                                </p>
                              )}
                            </div>

                            <p className="shrink-0 text-lg font-semibold leading-tight text-slate-950">
                              {formatCurrency(entry.price_at_entry)}
                            </p>
                          </div>

                          <div className="mt-2 flex items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-950">
                                {entry.race
                                  ? `${getGradeLabel(entry.race.grade)} · ${entry.race.racecourse?.name ?? "Racecourse"} R${entry.race.race_number} · ${entry.race.race_name}`
                                  : "Race unavailable"}
                              </p>

                              {entryLockout && (
                                <p className="mt-0.5 truncate text-[10px] font-medium text-slate-700">
                                  {entryLockout.display_name} ·{" "}
                                  {formatDateTime(entryLockout.lockout_at)}
                                </p>
                              )}
                            </div>

                            <div className="flex shrink-0 items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => selectCaptain(entry.id)}
                                disabled={isLocked || Boolean(lockedCaptainEntryId)}
                                className={`inline-flex h-7 items-center justify-center rounded-md px-2.5 text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-40 ${
                                  isCaptain
                                    ? "bg-amber-500 text-white"
                                    : "border border-amber-400 bg-white text-amber-800 hover:bg-amber-50"
                                }`}
                                title={isCaptain ? "Captain" : "Make captain"}
                              >
                                {isCaptain ? "Captain" : "Make C"}
                              </button>

                              <button
                                type="button"
                                onClick={() => toggleEntry(entry)}
                                disabled={isLocked}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-white text-sm font-bold leading-none text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                                title="Remove horse"
                                aria-label={`Remove ${entry.horse?.name ?? "horse"}`}
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t bg-slate-50 p-3">
                {!teamIsComplete && (
                  <p className="mb-3 text-xs leading-5 text-amber-800">
                    Select {teamSize} horses, stay under the cap and choose a captain.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => void saveDraft()}
                    disabled={saving || submitting}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Draft"}
                  </button>

                  <button
                    type="button"
                    onClick={() => void submitTeam()}
                    disabled={!teamIsComplete || submitting || saving}
                    className="rounded-lg bg-teal-700 px-4 py-3 text-sm font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                  >
                    {submitting
                      ? "Submitting..."
                      : team?.status === "submitted"
                        ? "Update Team"
                        : "Submit Team"}
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <section className="sticky bottom-0 z-20 mt-4 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-6px_20px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-2xl items-center gap-2">
            <button
              type="button"
              onClick={() => void saveDraft()}
              disabled={saving || submitting}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button
              type="button"
              onClick={() => void submitTeam()}
              disabled={!teamIsComplete || submitting || saving}
              className="flex-1 rounded-lg bg-teal-700 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
            >
              {submitting ? "Submitting..." : team?.status === "submitted" ? "Update Team" : "Submit Team"}
            </button>
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