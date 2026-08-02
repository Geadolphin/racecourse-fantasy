"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
  round_id: string;
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
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [captainEntryId, setCaptainEntryId] = useState<string | null>(
    null
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [raceTypeFilter, setRaceTypeFilter] =
    useState<RaceTypeFilter>("all");
  const [raceFilter, setRaceFilter] = useState("all");
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

  const lockoutHasStarted =
    round !== null &&
    currentTime >= new Date(round.lockout_at).getTime();

  const teamIsEditable =
    round !== null &&
    round.status === "open" &&
    !lockoutHasStarted;

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

      return matchesSearch && matchesGrade && matchesRace;
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
        "This team can no longer be edited because round lockout has commenced."
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
        "The captain cannot be changed after lockout."
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

  async function createOrUpdateTeam(
    status: "draft" | "submitted"
  ): Promise<Team | null> {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage("You must be signed in to save your team.");
      return null;
    }

    if (!round) {
      setErrorMessage("There is no current round.");
      return null;
    }

    if (team) {
      const { data: updatedTeam, error: updateError } =
        await supabase
          .from("teams")
          .update({
            status,
            salary_used: salaryUsed,
            salary_cap: salaryCap,
          })
          .eq("id", team.id)
          .select(
            `
              id,
              user_id,
              round_id,
              team_name,
              status,
              salary_used
            `
          )
          .single();

      if (updateError || !updatedTeam) {
        console.error("Team update error:", updateError);

        setErrorMessage(
          updateError?.message ?? "Could not update the team."
        );

        return null;
      }

      const savedTeam = updatedTeam as Team;
      setTeam(savedTeam);

      return savedTeam;
    }

    const { data: createdTeam, error: createError } =
      await supabase
        .from("teams")
        .insert({
          user_id: user.id,
          round_id: round.id,
          status,
          salary_used: salaryUsed,
          salary_cap: salaryCap,
        })
        .select(
          `
            id,
            user_id,
            round_id,
            team_name,
            status,
            salary_used
          `
        )
        .single();

    if (createError || !createdTeam) {
      console.error("Team creation error:", createError);

      setErrorMessage(
        createError?.message ?? "Could not create the team."
      );

      return null;
    }

    const savedTeam = createdTeam as Team;
    setTeam(savedTeam);

    return savedTeam;
  }

  async function saveSelections(savedTeam: Team) {
    const selectedRaceEntryIds = selectedEntries.map(
      (entry) => entry.id
    );

    const officialPointsByEntryId = new Map<string, number>();

    if (selectedRaceEntryIds.length > 0) {
      const { data: officialResults, error: resultsError } =
        await supabase
          .from("race_results")
          .select("race_entry_id, fantasy_points")
          .in("race_entry_id", selectedRaceEntryIds)
          .eq("is_official", true);

      if (resultsError) {
        console.error(
          "Official result points load error:",
          resultsError
        );

        setErrorMessage(
          "Could not load the official points for your selected horses."
        );

        return false;
      }

      for (const result of officialResults ?? []) {
        officialPointsByEntryId.set(
          result.race_entry_id,
          result.fantasy_points ?? 0
        );
      }
    }

    const { error: deleteError } = await supabase
      .from("team_selections")
      .delete()
      .eq("team_id", savedTeam.id);

    if (deleteError) {
      console.error(
        "Old selection delete error:",
        deleteError
      );

      setErrorMessage(deleteError.message);
      return false;
    }

    if (selectedEntries.length === 0) {
      return true;
    }

    const rows = selectedEntries.map((entry) => ({
      team_id: savedTeam.id,
      race_entry_id: entry.id,
      is_captain: entry.id === captainEntryId,
      selected_price: entry.price_at_entry,

      // Preserve points from races that are already official.
      fantasy_points:
        officialPointsByEntryId.get(entry.id) ?? 0,
    }));

    const { error: insertError } = await supabase
      .from("team_selections")
      .insert(rows);

    if (insertError) {
      console.error(
        "Selection save error:",
        insertError
      );

      setErrorMessage(insertError.message);
      return false;
    }

    return true;
  }

  async function saveDraft() {
    clearMessages();

    if (!teamIsEditable) {
      setErrorMessage(
        "Your team can no longer be edited because lockout has commenced."
      );
      return;
    }

    if (salaryUsed > salaryCap) {
      setErrorMessage("Your team is over the salary cap.");
      return;
    }

    setSaving(true);

    const savedTeam = await createOrUpdateTeam("draft");

    if (!savedTeam) {
      setSaving(false);
      return;
    }

    const selectionsSaved = await saveSelections(savedTeam);

    if (!selectionsSaved) {
      setSaving(false);
      return;
    }

    setSuccessMessage("Your draft team has been saved.");
    setSaving(false);
  }

  async function submitTeam() {
    clearMessages();

    if (!teamIsEditable) {
      setErrorMessage(
        "Your team can no longer be submitted because lockout has commenced."
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

    const savedTeam = await createOrUpdateTeam("submitted");

    if (!savedTeam) {
      setSubmitting(false);
      return;
    }

    const selectionsSaved = await saveSelections(savedTeam);

    if (!selectionsSaved) {
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
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
              Round {round.round_number} locked at{" "}
              {formatDateTime(round.lockout_at)}.
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
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-xl bg-teal-700 p-6 text-white">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-200">
                {season.name}
              </p>

              <h1 className="mt-1 text-3xl font-bold">
                Edit Team
              </h1>

              <p className="mt-2 text-teal-100">
                Round {round.round_number}
                {round.name ? ` — ${round.name}` : ""}
              </p>

              <p className="mt-1 text-sm text-teal-100">
                Lockout: {formatDateTime(round.lockout_at)}
              </p>
            </div>

            <Link
              href="/team"
              className="inline-flex items-center justify-center rounded-lg border border-white/40 px-5 py-3 font-bold text-white hover:bg-white/10"
            >
              Cancel and return
            </Link>
          </div>
        </header>

        {errorMessage && (
          <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-6 rounded-lg border border-teal-300 bg-teal-50 p-4 text-teal-800">
            {successMessage}
          </div>
        )}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Horses selected
            </p>

            <p className="mt-2 text-2xl font-bold text-slate-900">
              {selectedCount} / {teamSize}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Salary used
            </p>

            <p className="mt-2 text-2xl font-bold text-slate-900">
              {formatCurrency(salaryUsed)}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Available salary
            </p>

            <p
              className={`mt-2 text-2xl font-bold ${
                salaryRemaining < 0
                  ? "text-red-700"
                  : "text-green-800"
              }`}
            >
              {formatCurrency(salaryRemaining)}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Captain
            </p>

            <p className="mt-2 truncate text-xl font-bold text-slate-900">
              {entries.find(
                (entry) => entry.id === captainEntryId
              )?.horse?.name ?? "Not selected"}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-xl border bg-white p-5">
          {!teamIsComplete && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Select {teamSize} horses, remain under the salary cap and
              choose a captain before submitting.
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => void saveDraft()}
              disabled={saving || submitting}
              className="rounded-lg border border-slate-400 px-5 py-3 font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>

            <button
              type="button"
              onClick={() => void submitTeam()}
              disabled={
                !teamIsComplete ||
                submitting ||
                saving
              }
              className="rounded-lg bg-teal-700 px-5 py-3 font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
            >
              {submitting
                ? "Submitting..."
                : team?.status === "submitted"
                  ? "Update Submitted Team"
                  : teamIsComplete
                    ? "Submit Team"
                    : "Complete Team to Submit"}
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-xl border bg-white p-5">
          <div className="h-3 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full transition-all ${
                salaryUsed > salaryCap
                  ? "bg-red-600"
                  : "bg-green-700"
              }`}
              style={{
                width: `${
                  salaryCap > 0
                    ? Math.min(
                        (salaryUsed / salaryCap) * 100,
                        100
                      )
                    : 0
                }%`,
              }}
            />
          </div>

          <div className="mt-2 flex justify-between text-sm text-slate-600">
            <span>{formatCurrency(salaryUsed)} used</span>
            <span>Available: {formatCurrency(salaryCap)}</span>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Your available salary carries forward from the previous
            round based on the price movements of your selected horses.
          </p>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section>
            <div className="rounded-xl border bg-white p-5">
              <h2 className="text-xl font-bold text-slate-900">
                Available Horses
              </h2>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(event.target.value)
                  }
                  placeholder="Search horses or races"
                  className="rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-teal-700"
                />

                <select
                  value={raceTypeFilter}
                  onChange={(event) =>
                    setRaceTypeFilter(
                      event.target.value as RaceTypeFilter
                    )
                  }
                  className="rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-teal-700"
                >
                  <option value="all">All race types</option>
                  <option value="G1">Group 1</option>
                  <option value="G2">Group 2</option>
                  <option value="G3">Group 3</option>
                  <option value="L">Listed</option>
                </select>

                <select
                  value={raceFilter}
                  onChange={(event) =>
                    setRaceFilter(event.target.value)
                  }
                  className="rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-teal-700"
                >
                  <option value="all">All races</option>

                  {raceOptions.map((raceOption) => (
                    <option
                      key={raceOption.id}
                      value={raceOption.id}
                    >
                      {raceOption.racecourse?.name ?? "Racecourse"} R
                      {raceOption.race_number} —{" "}
                      {raceOption.race_name}
                    </option>
                  ))}
                </select>

                <select
                  value={sortOption}
                  onChange={(event) =>
                    setSortOption(
                      event.target.value as SortOption
                    )
                  }
                  className="rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-teal-700"
                >
                  <option value="race">Race order</option>
                  <option value="price-high">
                    Price: highest first
                  </option>
                  <option value="price-low">
                    Price: lowest first
                  </option>
                  <option value="name">Horse name</option>
                </select>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {filteredEntries.length === 0 ? (
                <div className="rounded-xl border bg-white p-10 text-center text-slate-500">
                  No horses match your filters.
                </div>
              ) : (
                filteredEntries.map((entry) => {
                  const isSelected =
                    selectedEntryIds.includes(entry.id);

                  const isUnavailable =
                    entry.entry_status !== "runner";

                  const wouldExceedBudget =
                    !isSelected &&
                    salaryUsed + entry.price_at_entry >
                      salaryCap;

                  return (
                    <article
                      key={entry.id}
                      className={`rounded-xl border p-5 ${
                        isSelected
                          ? "border-teal-700 bg-teal-50"
                          : "bg-white"
                      }`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start">

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-bold text-slate-900">
                                {entry.horse?.name ??
                                  "Unknown horse"}
                              </h3>

                              {isSelected && (
                                <span className="rounded-full bg-teal-700 px-2 py-1 text-xs font-bold text-white">
                                  Selected
                                </span>
                              )}

                              {isUnavailable && (
                                <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-800">
                                  {getEntryStatusLabel(
                                    entry.entry_status
                                  )}
                                </span>
                              )}
                            </div>

                            <p className="mt-1 text-sm text-slate-600">
                              {entry.race
                                ? `Race ${entry.race.race_number} — ${entry.race.race_name}`
                                : "Race unavailable"}
                            </p>

                            {entry.race && (
                              <p className="mt-1 text-sm text-slate-500">
                                {getGradeLabel(entry.race.grade)}
                                {entry.race.racecourse
                                  ? ` · ${entry.race.racecourse.name}`
                                  : ""}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 sm:justify-end">
                          <div className="sm:text-right">
                            <p className="text-lg font-bold text-slate-900">
                              {formatCurrency(
                                entry.price_at_entry
                              )}
                            </p>

                            {wouldExceedBudget && (
                              <p className="mt-1 text-xs font-semibold text-red-700">
                                Over budget
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleEntry(entry)}
                            disabled={
                              isUnavailable ||
                              (!isSelected &&
                                (selectedCount >= teamSize ||
                                  wouldExceedBudget))
                            }
                            className={`min-w-24 rounded-lg px-4 py-2 font-bold ${
                              isSelected
                                ? "bg-red-100 text-red-800 hover:bg-red-200"
                                : "bg-teal-900 text-white hover:bg-teal-700"
                            } disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500`}
                          >
                            {isSelected ? "Remove" : "Select"}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <aside>
            <div className="sticky top-6 overflow-hidden rounded-xl border bg-white">
              <div className="border-b bg-slate-50 p-5">
                <h2 className="text-xl font-bold text-slate-900">
                  Your Team
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  Select one horse as captain.
                </p>
              </div>

              {selectedEntries.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  No horses selected.
                </div>
              ) : (
                <div className="divide-y">
                  {selectedEntries.map((entry) => {
                    const isCaptain =
                      entry.id === captainEntryId;

                    return (
                      <div key={entry.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold text-slate-900">
                                {entry.horse?.name ??
                                  "Unknown horse"}
                              </p>

                              {isCaptain && (
                                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900">
                                  Captain
                                </span>
                              )}
                            </div>

                            <p className="mt-1 text-sm text-slate-500">
                              {entry.race
                                ? `Race ${entry.race.race_number}`
                                : "Race unavailable"}
                            </p>

                            <p className="mt-1 text-sm font-semibold text-slate-700">
                              {formatCurrency(
                                entry.price_at_entry
                              )}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              selectCaptain(entry.id)
                            }
                            className={`rounded-lg px-3 py-2 text-xs font-bold ${
                              isCaptain
                                ? "bg-amber-500 text-white"
                                : "border border-amber-500 text-amber-800 hover:bg-amber-50"
                            }`}
                          >
                            {isCaptain
                              ? "Captain"
                              : "Make Captain"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}