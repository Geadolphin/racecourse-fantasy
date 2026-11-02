"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type DashboardCounts = {
  users: number;
  horses: number;
  races: number;
  rounds: number;
};

type AdminRound = {
  id: string;
  season_id: string;
  round_number: number;
  name: string | null;
  status: string;
  lockout_at: string | null;
};

type RaceRow = {
  id: string;
  round_id: string;
  race_number: number;
  race_name: string;
  status: string;
};

type RaceEntryRow = {
  id: string;
  race_id: string;
  horse_id: string;
  entry_status: string;
};

type RaceResultRow = {
  id: string;
  race_entry_id: string;
  is_official: boolean;
};

type TeamRow = {
  id: string;
  round_id: string;
  status: string;
};

type RoundScoreRow = {
  team_id: string;
};

type PriceHistoryRow = {
  id: string;
  race_id: string | null;
  horse_id: string;
  price_after: number;
};

type CheckStatus = "ready" | "pending" | "issue";

type ChecklistItem = {
  label: string;
  status: CheckStatus;
  detail: string;
  href?: string;
};

const initialCounts: DashboardCounts = {
  users: 0,
  horses: 0,
  races: 0,
  rounds: 0,
};

function StatusBadge({ status }: { status: CheckStatus }) {
  const classes =
    status === "ready"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "issue"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  const label =
    status === "ready"
      ? "Ready"
      : status === "issue"
        ? "Issue"
        : "Pending";

  return (
    <span
      className={`inline-flex rounded-sm border px-2 py-0.5 text-[11px] font-semibold ${classes}`}
    >
      {label}
    </span>
  );
}

export default function AdminDashboardPage() {
  const [counts, setCounts] =
    useState<DashboardCounts>(initialCounts);

  const [activeSeason, setActiveSeason] =
    useState<string>("No active season");

  const [activeSeasonId, setActiveSeasonId] =
    useState<string | null>(null);

  const [seasonRounds, setSeasonRounds] =
    useState<AdminRound[]>([]);

  const [selectedRoundId, setSelectedRoundId] =
    useState<string>("");

  const [checklist, setChecklist] =
    useState<ChecklistItem[]>([]);

  const [checklistLoading, setChecklistLoading] =
    useState(false);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [automationMessage, setAutomationMessage] = useState("");

  const [showHorseSilks, setShowHorseSilks] = useState(true);
  const [silksSettingLoading, setSilksSettingLoading] =
    useState(true);
  const [silksSettingSaving, setSilksSettingSaving] =
    useState(false);
  const [silksSettingMessage, setSilksSettingMessage] =
    useState("");

  const [showProjectedScores, setShowProjectedScores] = useState(false);
  const [projectionSettingLoading, setProjectionSettingLoading] =
    useState(true);
  const [projectionSettingSaving, setProjectionSettingSaving] =
    useState(false);
  const [projectionSettingMessage, setProjectionSettingMessage] =
    useState("");

  const [showSpecialTeamProjections, setShowSpecialTeamProjections] =
    useState(false);
  const [specialProjectionSettingSaving, setSpecialProjectionSettingSaving] =
    useState(false);
  const [specialProjectionSettingMessage, setSpecialProjectionSettingMessage] =
    useState("");

  useEffect(() => {
    let active = true;

    async function loadHorseSilksSetting() {
      setSilksSettingLoading(true);

      const { data, error } = await supabase.rpc(
        "get_public_site_settings"
      );

      if (!active) {
        return;
      }

      if (error) {
        console.error(
          "Horse silks setting load error:",
          error
        );
        setSilksSettingMessage(
          `Could not load the horse silks setting: ${error.message}`
        );
        setProjectionSettingMessage(
          `Could not load the projected scores setting: ${error.message}`
        );
        setProjectionSettingLoading(false);
      } else {
        const settings =
          data && typeof data === "object"
            ? (data as {
                show_horse_silks?: boolean;
                show_projected_scores?: boolean;
                show_special_team_projections?: boolean;
              })
            : null;

        setShowHorseSilks(
          settings?.show_horse_silks !== false
        );
        setShowProjectedScores(
          settings?.show_projected_scores === true
        );
        setShowSpecialTeamProjections(
          settings?.show_special_team_projections === true
        );
      }

      setSilksSettingLoading(false);
      setProjectionSettingLoading(false);
    }

    void loadHorseSilksSetting();

    return () => {
      active = false;
    };
  }, []);

  async function toggleHorseSilks() {
    if (silksSettingSaving) {
      return;
    }

    const nextValue = !showHorseSilks;

    setSilksSettingSaving(true);
    setSilksSettingMessage("");

    const { data, error } = await supabase.rpc(
      "admin_set_horse_silks_enabled",
      {
        p_enabled: nextValue,
      }
    );

    if (error) {
      console.error(
        "Horse silks setting update error:",
        error
      );
      setSilksSettingMessage(
        `Could not update horse silks: ${error.message}`
      );
      setSilksSettingSaving(false);
      return;
    }

    const result =
      data && typeof data === "object"
        ? (data as {
            show_horse_silks?: boolean;
          })
        : null;

    const savedValue =
      result?.show_horse_silks ?? nextValue;

    setShowHorseSilks(savedValue);
    setSilksSettingMessage(
      savedValue
        ? "Horse silks are now ON across the website."
        : "Horse silks are now OFF across the website."
    );
    setSilksSettingSaving(false);
  }

  async function toggleProjectedScores() {
    if (projectionSettingSaving) {
      return;
    }

    const nextValue = !showProjectedScores;

    setProjectionSettingSaving(true);
    setProjectionSettingMessage("");

    const { data, error } = await supabase.rpc(
      "admin_set_projected_scores_enabled",
      {
        p_enabled: nextValue,
      }
    );

    if (error) {
      console.error(
        "Projected scores setting update error:",
        error
      );
      setProjectionSettingMessage(
        `Could not update projected scores: ${error.message}`
      );
      setProjectionSettingSaving(false);
      return;
    }

    const result =
      data && typeof data === "object"
        ? (data as {
            show_projected_scores?: boolean;
          })
        : null;

    const savedValue =
      result?.show_projected_scores ?? nextValue;

    setShowProjectedScores(savedValue);
    setProjectionSettingMessage(
      savedValue
        ? "Projected scores are now ON across the website."
        : "Projected scores are now OFF across the website."
    );
    setProjectionSettingSaving(false);
  }

  async function toggleSpecialTeamProjections() {
    if (specialProjectionSettingSaving) {
      return;
    }

    const nextValue = !showSpecialTeamProjections;

    setSpecialProjectionSettingSaving(true);
    setSpecialProjectionSettingMessage("");

    const { data, error } = await supabase.rpc(
      "admin_set_special_team_projections_enabled",
      {
        p_enabled: nextValue,
      }
    );

    if (error) {
      console.error(
        "Special-team projections setting update error:",
        error
      );
      setSpecialProjectionSettingMessage(
        `Could not update special-team projections: ${error.message}`
      );
      setSpecialProjectionSettingSaving(false);
      return;
    }

    const result =
      data && typeof data === "object"
        ? (data as {
            show_special_team_projections?: boolean;
          })
        : null;

    const savedValue =
      result?.show_special_team_projections ?? nextValue;

    setShowSpecialTeamProjections(savedValue);
    setSpecialProjectionSettingMessage(
      savedValue
        ? "Special-team projections are now ON."
        : "Special-team projections are now OFF."
    );
    setSpecialProjectionSettingSaving(false);
  }

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setMessage("");
      setAutomationMessage("");

      const now = new Date().toISOString();

      const {
        data: lockedRounds,
        error: lockRoundsError,
      } = await supabase
        .from("rounds")
        .update({
          status: "locked",
        })
        .eq("status", "open")
        .lte("lockout_at", now)
        .select("id");

      if (lockRoundsError) {
        console.error(
          "Automatic round lock error:",
          lockRoundsError
        );

        setMessage(
          `Could not automatically lock expired rounds: ${lockRoundsError.message}`
        );
      } else if (lockedRounds && lockedRounds.length > 0) {
        const roundWord =
          lockedRounds.length === 1 ? "round" : "rounds";

        setAutomationMessage(
          `${lockedRounds.length} expired ${roundWord} automatically locked.`
        );
      }

      const [
        usersResponse,
        horsesResponse,
        racesResponse,
        roundsResponse,
        seasonResponse,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", {
            count: "exact",
            head: true,
          }),

        supabase
          .from("horses")
          .select("id", {
            count: "exact",
            head: true,
          }),

        supabase
          .from("races")
          .select("id", {
            count: "exact",
            head: true,
          }),

        supabase
          .from("rounds")
          .select("id", {
            count: "exact",
            head: true,
          }),

        supabase
          .from("seasons")
          .select("id, name, year")
          .eq("is_active", true)
          .maybeSingle(),
      ]);

      const responses = [
        usersResponse,
        horsesResponse,
        racesResponse,
        roundsResponse,
        seasonResponse,
      ];

      const firstLoadError = responses.find(
        (response) => response.error
      )?.error;

      if (firstLoadError) {
        console.error(
          "Admin dashboard load error:",
          firstLoadError
        );

        setMessage((currentMessage) => {
          const loadMessage =
            `Could not load some dashboard information: ${firstLoadError.message}`;

          if (currentMessage) {
            return `${currentMessage} ${loadMessage}`;
          }

          return loadMessage;
        });
      }

      setCounts({
        users: usersResponse.count ?? 0,
        horses: horsesResponse.count ?? 0,
        races: racesResponse.count ?? 0,
        rounds: roundsResponse.count ?? 0,
      });

      if (seasonResponse.data) {
        setActiveSeason(
          `${seasonResponse.data.name} ${seasonResponse.data.year}`
        );
        setActiveSeasonId(seasonResponse.data.id);
      } else {
        setActiveSeason("No active season");
        setActiveSeasonId(null);
        setSeasonRounds([]);
        setSelectedRoundId("");
      }

      setLoading(false);
    }

    void loadDashboard();
  }, []);

  useEffect(() => {
    if (!activeSeasonId) {
      return;
    }

    let active = true;

    async function loadSeasonRounds() {
      const { data, error } = await supabase
        .from("rounds")
        .select(
          "id, season_id, round_number, name, status, lockout_at"
        )
        .eq("season_id", activeSeasonId)
        .order("round_number", { ascending: true });

      if (!active) {
        return;
      }

      if (error) {
        console.error("Round checklist round load error:", error);
        setMessage((current) =>
          current
            ? `${current} Could not load the active season rounds: ${error.message}`
            : `Could not load the active season rounds: ${error.message}`
        );
        return;
      }

      const loadedRounds = (data ?? []) as AdminRound[];
      setSeasonRounds(loadedRounds);

      if (loadedRounds.length === 0) {
        setSelectedRoundId("");
        return;
      }

      const preferredRound =
        loadedRounds.find((round) =>
          ["open", "locked"].includes(round.status)
        ) ??
        [...loadedRounds]
          .reverse()
          .find((round) => round.status === "completed") ??
        loadedRounds[0];

      setSelectedRoundId((current) => {
        if (
          current &&
          loadedRounds.some((round) => round.id === current)
        ) {
          return current;
        }

        return preferredRound.id;
      });
    }

    void loadSeasonRounds();

    return () => {
      active = false;
    };
  }, [activeSeasonId]);

  useEffect(() => {
    if (!selectedRoundId) {
      setChecklist([]);
      return;
    }

    let active = true;

    async function loadChecklist() {
      setChecklistLoading(true);

      const selectedRound = seasonRounds.find(
        (round) => round.id === selectedRoundId
      );

      if (!selectedRound) {
        setChecklist([]);
        setChecklistLoading(false);
        return;
      }

      const [
        racesResponse,
        teamsResponse,
      ] = await Promise.all([
        supabase
          .from("races")
          .select(
            "id, round_id, race_number, race_name, status"
          )
          .eq("round_id", selectedRoundId)
          .order("race_number", { ascending: true }),

        supabase
          .from("teams")
          .select("id, round_id, status")
          .eq("round_id", selectedRoundId),
      ]);

      if (!active) {
        return;
      }

      if (racesResponse.error || teamsResponse.error) {
        const error =
          racesResponse.error ?? teamsResponse.error;

        console.error("Round checklist load error:", error);
        setChecklist([
          {
            label: "Checklist data",
            status: "issue",
            detail:
              error?.message ??
              "The checklist could not be loaded.",
          },
        ]);
        setChecklistLoading(false);
        return;
      }

      const races = (racesResponse.data ?? []) as RaceRow[];
      const teams = (teamsResponse.data ?? []) as TeamRow[];

      // Only submitted/locked/scored teams are eligible for round scoring.
      // Draft teams may be incomplete and should not be flagged as missing scores.
      const eligibleTeams = teams.filter((team) =>
        ["submitted", "locked", "scored"].includes(team.status)
      );

      const raceIds = races.map((race) => race.id);
      const teamIds = eligibleTeams.map((team) => team.id);

      let entries: RaceEntryRow[] = [];
      let results: RaceResultRow[] = [];
      let roundScores: RoundScoreRow[] = [];
      let priceHistory: PriceHistoryRow[] = [];

      if (raceIds.length > 0) {
        const [
          entriesResponse,
          priceHistoryResponse,
        ] = await Promise.all([
          supabase
            .from("race_entries")
            .select(
              "id, race_id, horse_id, entry_status"
            )
            .in("race_id", raceIds),

          supabase
            .from("horse_price_history")
            .select(
              "id, race_id, horse_id, price_after"
            )
            .in("race_id", raceIds),
        ]);

        if (!active) {
          return;
        }

        const nestedError =
          entriesResponse.error ??
          priceHistoryResponse.error;

        if (nestedError) {
          console.error(
            "Round checklist detail load error:",
            nestedError
          );
          setChecklist([
            {
              label: "Checklist data",
              status: "issue",
              detail: nestedError.message,
            },
          ]);
          setChecklistLoading(false);
          return;
        }

        entries =
          (entriesResponse.data ?? []) as RaceEntryRow[];

        priceHistory =
          (priceHistoryResponse.data ??
            []) as PriceHistoryRow[];

        const raceEntryIds = entries.map(
          (entry) => entry.id
        );

        if (raceEntryIds.length > 0) {
          const { data: resultsData, error: resultsError } =
            await supabase
              .from("race_results")
              .select(
                "id, race_entry_id, is_official"
              )
              .in("race_entry_id", raceEntryIds);

          if (!active) {
            return;
          }

          if (resultsError) {
            console.error(
              "Round checklist result load error:",
              resultsError
            );
            setChecklist([
              {
                label: "Checklist data",
                status: "issue",
                detail: resultsError.message,
              },
            ]);
            setChecklistLoading(false);
            return;
          }

          results =
            (resultsData ?? []) as RaceResultRow[];
        }
      }

      if (teamIds.length > 0) {
        const { data, error } = await supabase
          .from("player_round_scores")
          .select("team_id")
          .in("team_id", teamIds);

        if (!active) {
          return;
        }

        if (error) {
          console.error(
            "Round checklist score load error:",
            error
          );
        } else {
          roundScores = (data ?? []) as RoundScoreRow[];
        }
      }

      const unresolvedRaces = races.filter(
        (race) =>
          !["official", "abandoned", "cancelled"].includes(
            race.status
          )
      );

      const racesWithoutEntries = races.filter(
        (race) =>
          !entries.some(
            (entry) =>
              entry.race_id === race.id &&
              entry.entry_status !== "scratched_before_lockout"
          )
      );

      const officialRaces = races.filter(
        (race) => race.status === "official"
      );

      const raceIdByEntryId = new Map(
        entries.map((entry) => [
          entry.id,
          entry.race_id,
        ])
      );

      const officialRacesWithoutResults =
        officialRaces.filter(
          (race) =>
            !results.some(
              (result) =>
                raceIdByEntryId.get(
                  result.race_entry_id
                ) === race.id &&
                result.is_official
            )
        );

      const roundResolved =
        races.length > 0 && unresolvedRaces.length === 0;

      const roundCompleted =
        selectedRound.status === "completed";

      // A completed round's historical prices are snapshots. Comparing them
      // with horses.current_price produces false warnings after later updates.
      // Verify that this round has recorded price history instead.
      const recordedPriceCount = priceHistory.length;

      const lockoutPassed =
        selectedRound.lockout_at !== null &&
        new Date(selectedRound.lockout_at).getTime() <=
          Date.now();

      const lockedOrLater =
        ["locked", "completed"].includes(
          selectedRound.status
        ) || lockoutPassed;

      const scoredTeamCount = new Set(
        roundScores.map((score) => score.team_id)
      ).size;

      const checklistItems: ChecklistItem[] = [
        {
          label: "Races created",
          status: races.length > 0 ? "ready" : "issue",
          detail:
            races.length > 0
              ? `${races.length} ${
                  races.length === 1 ? "race" : "races"
                } created for this round.`
              : "No races have been created for this round.",
          href: "/admin/races",
        },
        {
          label: "Race entries added",
          status:
            races.length === 0
              ? "pending"
              : racesWithoutEntries.length === 0
                ? "ready"
                : "issue",
          detail:
            races.length === 0
              ? "Create the round races first."
              : racesWithoutEntries.length === 0
                ? `${entries.length} race entries loaded across all races.`
                : `${racesWithoutEntries.length} ${
                    racesWithoutEntries.length === 1
                      ? "race has"
                      : "races have"
                  } no active entries.`,
          href: "/admin/race-entries",
        },
        {
          label: "Round lockout",
          status: lockedOrLater ? "ready" : "pending",
          detail: lockedOrLater
            ? "The round has reached lockout."
            : selectedRound.lockout_at
              ? `Lockout is ${new Date(
                  selectedRound.lockout_at
                ).toLocaleString("en-AU")}.`
              : "No lockout time is set for this round.",
          href: "/admin/rounds",
        },
        {
          label: "Results entered",
          status:
            officialRaces.length === 0
              ? "pending"
              : officialRacesWithoutResults.length === 0
                ? "ready"
                : "issue",
          detail:
            officialRaces.length === 0
              ? "No races have official results yet."
              : officialRacesWithoutResults.length === 0
                ? `${officialRaces.length} official ${
                    officialRaces.length === 1
                      ? "race has"
                      : "races have"
                  } saved results.`
                : `${officialRacesWithoutResults.length} official ${
                    officialRacesWithoutResults.length === 1
                      ? "race is"
                      : "races are"
                  } missing official result rows.`,
          href: "/admin/results",
        },
        {
          label: "All races resolved",
          status: roundResolved ? "ready" : "pending",
          detail:
            races.length === 0
              ? "No races exist for this round."
              : roundResolved
                ? `All ${races.length} races are official, abandoned or cancelled.`
                : `${unresolvedRaces.length} ${
                    unresolvedRaces.length === 1
                      ? "race remains"
                      : "races remain"
                  } unresolved.`,
          href: "/admin/results",
        },
        {
          label: "Round scoring",
          status:
            !roundResolved
              ? "pending"
              : eligibleTeams.length === 0
                ? "ready"
                : scoredTeamCount >= eligibleTeams.length
                  ? "ready"
                  : "issue",
          detail:
            !roundResolved
              ? "Scoring completes after all races are resolved."
              : eligibleTeams.length === 0
                ? "No eligible teams were submitted for this round."
                : scoredTeamCount >= eligibleTeams.length
                  ? `${scoredTeamCount} of ${eligibleTeams.length} eligible teams have round scores.`
                  : `${eligibleTeams.length - scoredTeamCount} ${
                      eligibleTeams.length - scoredTeamCount === 1
                        ? "eligible team is"
                        : "eligible teams are"
                    } missing a round score.`,
        },
        {
          label: "Prices released",
          status: !roundCompleted
            ? "pending"
            : recordedPriceCount > 0
              ? "ready"
              : "pending",
          detail: !roundCompleted
            ? "Horse prices remain held until the round is completed."
            : recordedPriceCount > 0
              ? `${recordedPriceCount} price history ${recordedPriceCount === 1 ? "record" : "records"} saved for this round. Historical prices are preserved independently of current horse prices.`
              : "No price history records found for this round. If no prices changed, this may be expected; otherwise check the price update process.",
          href: "/admin/horses",
        },
        {
          label: "Round completed",
          status: roundCompleted ? "ready" : "pending",
          detail: roundCompleted
            ? "The round is marked completed."
            : `Current round status: ${selectedRound.status}.`,
          href: "/admin/rounds",
        },
      ];

      setChecklist(checklistItems);
      setChecklistLoading(false);
    }

    void loadChecklist();

    return () => {
      active = false;
    };
  }, [selectedRoundId, seasonRounds]);

  const selectedRound = useMemo(
    () =>
      seasonRounds.find(
        (round) => round.id === selectedRoundId
      ) ?? null,
    [seasonRounds, selectedRoundId]
  );

  const checklistReadyCount = checklist.filter(
    (item) => item.status === "ready"
  ).length;

  const checklistIssueCount = checklist.filter(
    (item) => item.status === "issue"
  ).length;

  const cards = [
    {
      title: "Registered users",
      value: counts.users,
      href: "/admin/users",
    },
    {
      title: "Horses",
      value: counts.horses,
      href: "/admin/horses",
    },
    {
      title: "Races",
      value: counts.races,
      href: "/admin/races",
    },
    {
      title: "Rounds",
      value: counts.rounds,
      href: "/admin/rounds",
    },
  ];

  const navigation = [
    { label: "Seasons", href: "/admin/seasons" },
    { label: "Rounds", href: "/admin/rounds" },
    { label: "Races", href: "/admin/races" },
    { label: "Race entries", href: "/admin/race-entries" },
    { label: "Results", href: "/admin/results" },
    { label: "Horses", href: "/admin/horses" },
    { label: "Users", href: "/admin/users" },
  ];

  const controls = [
    {
      label: "Horse silks",
      description: showHorseSilks
        ? "Displayed across the website"
        : "Hidden across the website",
      enabled: showHorseSilks,
      loading: silksSettingLoading || silksSettingSaving,
      toggle: toggleHorseSilks,
    },
    {
      label: "Projected scores",
      description: showProjectedScores
        ? "Visible to eligible users"
        : "Hidden from general users",
      enabled: showProjectedScores,
      loading: projectionSettingLoading || projectionSettingSaving,
      toggle: toggleProjectedScores,
    },
    {
      label: "Special team projections",
      description: showSpecialTeamProjections
        ? "Special teams can access projections independently"
        : "Special teams follow the main projection setting",
      enabled: showSpecialTeamProjections,
      loading: projectionSettingLoading || specialProjectionSettingSaving,
      toggle: toggleSpecialTeamProjections,
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-300">
                Racecourse Fantasy / Administration
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                Competition control
              </h1>
              <p className="mt-1 text-sm text-slate-300">
                {loading ? "Loading season…" : activeSeason}
              </p>
            </div>
            <Link
              href="/admin/seasons"
              className="inline-flex items-center justify-center border border-slate-600 px-4 py-2 text-sm font-semibold text-white transition hover:border-teal-300 hover:text-teal-200"
            >
              Manage season <span aria-hidden="true" className="ml-2">→</span>
            </Link>
          </div>
          <nav aria-label="Admin sections" className="-mb-5 mt-6 flex gap-1 overflow-x-auto pb-0">
            <span className="shrink-0 border-b-2 border-teal-400 px-3 py-3 text-sm font-bold text-white">
              Overview
            </span>
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 border-b-2 border-transparent px-3 py-3 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-7 px-4 py-7 sm:px-6 lg:px-8">
        {automationMessage && (
          <div role="status" className="border-l-4 border-teal-600 bg-teal-50 px-4 py-3 text-sm text-teal-900">
            {automationMessage}
          </div>
        )}
        {message && (
          <div role="alert" className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">
            {message}
          </div>
        )}

        <section aria-labelledby="overview-heading">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="overview-heading" className="text-lg font-bold">At a glance</h2>
            <span className="text-xs text-slate-500">All-time totals</span>
          </div>
          <div className="grid grid-cols-2 border border-slate-200 bg-white sm:grid-cols-4">
            {cards.map((card, index) => (
              <Link
                key={card.title}
                href={card.href}
                className={`group px-5 py-5 transition hover:bg-slate-50 ${index > 0 ? "border-l border-slate-200" : ""} ${index === 2 ? "max-sm:border-l-0" : ""} ${index > 1 ? "max-sm:border-t max-sm:border-slate-200" : ""}`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.title}</p>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <span className="text-3xl font-bold tabular-nums tracking-tight">
                    {loading ? "—" : card.value.toLocaleString("en-AU")}
                  </span>
                  <span aria-hidden="true" className="text-sm text-teal-700 transition group-hover:translate-x-1">→</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section aria-labelledby="checklist-heading" className="min-w-0 border border-slate-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Race-day operations</p>
                <h2 id="checklist-heading" className="mt-1 text-xl font-bold">Round readiness</h2>
                <p className="mt-1 text-sm text-slate-500">Review the operational checks for each round.</p>
              </div>
              {seasonRounds.length > 0 && (
                <div className="w-full shrink-0 sm:w-60">
                  <label htmlFor="checklist-round" className="mb-1 block text-xs font-semibold text-slate-600">Select round</label>
                  <select
                    id="checklist-round"
                    value={selectedRoundId}
                    onChange={(event) => setSelectedRoundId(event.target.value)}
                    className="w-full border border-slate-300 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  >
                    {seasonRounds.map((round) => (
                      <option key={round.id} value={round.id}>
                        Round {round.round_number}{round.name ? ` — ${round.name}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {selectedRound && !checklistLoading && (
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold">
                <span className="text-slate-700">{checklistReadyCount} of {checklist.length} checks ready</span>
                {checklistIssueCount > 0 && <span className="text-red-700">{checklistIssueCount} requiring attention</span>}
                <span className="ml-auto uppercase tracking-wide text-slate-500">{selectedRound.status}</span>
              </div>
            )}
            {!activeSeasonId ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">Set an active season to view round checks.</p>
            ) : seasonRounds.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">No rounds have been created for the active season.</p>
            ) : checklistLoading ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">Checking round…</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {checklist.map((item) => (
                  <div key={item.label} className="flex flex-wrap items-center gap-3 px-5 py-3.5 sm:flex-nowrap">
                    <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.status === "ready" ? "bg-emerald-600" : item.status === "issue" ? "bg-red-600" : "bg-amber-500"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-500">{item.detail}</p>
                    </div>
                    <div className="flex w-full shrink-0 items-center justify-between gap-3 pl-5 sm:w-auto sm:pl-0">
                      <StatusBadge status={item.status} />
                      {item.href && (
                        <Link href={item.href} className="whitespace-nowrap text-xs font-semibold text-teal-700 hover:underline">
                          Open →
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside aria-label="Admin shortcuts" className="space-y-6">
            <section className="border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-base font-bold">Common tasks</h2>
                <p className="mt-1 text-xs text-slate-500">Go straight to a management page.</p>
              </div>
              <div className="divide-y divide-slate-100">
                {[
                  { label: "Manage race entries", href: "/admin/race-entries" },
                  { label: "Enter race results", href: "/admin/results" },
                  { label: "Manage rounds", href: "/admin/rounds" },
                  { label: "Manage races", href: "/admin/races" },
                  { label: "Add or edit horses", href: "/admin/horses" },
                  { label: "Manage seasons", href: "/admin/seasons" },
                ].map((item) => (
                  <Link key={item.href} href={item.href} className="flex items-center justify-between gap-3 px-5 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-50 hover:text-teal-700">
                    {item.label}<span aria-hidden="true" className="text-teal-700">→</span>
                  </Link>
                ))}
              </div>
            </section>
            <div className="border-l-2 border-teal-600 pl-4 text-xs leading-5 text-slate-500">
              Round checks are informational. Review outstanding issues before completing a round.
            </div>
          </aside>
        </div>

        <section aria-labelledby="display-heading" className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-5">
            <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Website settings</p>
            <h2 id="display-heading" className="mt-1 text-xl font-bold">Display controls</h2>
            <p className="mt-1 text-sm text-slate-500">Manage which racing information appears to users.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {controls.map((control) => (
              <div key={control.label} className="flex items-center justify-between gap-5 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{control.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{control.loading ? "Updating setting…" : control.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-label={control.label}
                  aria-checked={control.enabled}
                  disabled={control.loading}
                  onClick={() => void control.toggle()}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${control.enabled ? "bg-teal-700" : "bg-slate-300"} ${control.loading ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                >
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${control.enabled ? "left-6" : "left-1"}`} />
                </button>
              </div>
            ))}
          </div>
          {[silksSettingMessage, projectionSettingMessage, specialProjectionSettingMessage]
            .filter(Boolean)
            .map((notice, index) => (
              <p key={`${index}-${notice}`} role="status" className={`border-t border-slate-100 px-5 py-3 text-xs ${notice.startsWith("Could not") ? "text-red-700" : "text-teal-800"}`}>
                {notice}
              </p>
            ))}
        </section>
      </div>
    </main>
  );
}
