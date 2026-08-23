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

type HorsePriceRow = {
  id: string;
  current_price: number;
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
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${classes}`}
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
      } else {
        const settings =
          data && typeof data === "object"
            ? (data as {
                show_horse_silks?: boolean;
              })
            : null;

        setShowHorseSilks(
          settings?.show_horse_silks !== false
        );
      }

      setSilksSettingLoading(false);
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

      let priceMismatchCount = 0;

      if (roundCompleted && priceHistory.length > 0) {
        const latestPriceByHorse = new Map<
          string,
          PriceHistoryRow
        >();

        for (const row of priceHistory) {
          latestPriceByHorse.set(row.horse_id, row);
        }

        const horseIds = [...latestPriceByHorse.keys()];

        if (horseIds.length > 0) {
          const { data: horsePriceData, error } =
            await supabase
              .from("horses")
              .select("id, current_price")
              .in("id", horseIds);

          if (!active) {
            return;
          }

          if (error) {
            console.error(
              "Round checklist horse price load error:",
              error
            );
          } else {
            const horses =
              (horsePriceData ?? []) as HorsePriceRow[];

            priceMismatchCount = horses.filter((horse) => {
              const expected =
                latestPriceByHorse.get(horse.id)?.price_after;

              return (
                expected !== undefined &&
                horse.current_price !== expected
              );
            }).length;
          }
        }
      }

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
          status:
            !roundCompleted
              ? "pending"
              : priceMismatchCount === 0
                ? "ready"
                : "issue",
          detail:
            !roundCompleted
              ? "Horse prices remain held until the round is completed."
              : priceMismatchCount === 0
                ? "Completed-round horse prices match the stored price history."
                : `${priceMismatchCount} ${
                    priceMismatchCount === 1
                      ? "horse price does"
                      : "horse prices do"
                  } not match the stored completed-round price.`,
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

  return (
    <main className="p-6 sm:p-10">
      <div className="mx-auto max-w-7xl">
        <div>
          <p className="font-semibold text-teal-600">
            Administration
          </p>

          <h1 className="mt-1 text-4xl font-bold tracking-tight">
            Dashboard
          </h1>

          <p className="mt-2 text-slate-600">
            Manage the Racecourse Fantasy competition.
          </p>
        </div>

        {automationMessage && (
          <div className="mt-6 rounded-xl border border-teal-200 bg-teal-50 p-4 text-teal-700">
            {automationMessage}
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {message}
          </div>
        )}

        <section className="mt-8 rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-300">
            Active season
          </p>

          <p className="mt-2 text-2xl font-bold">
            {loading ? "Loading..." : activeSeason}
          </p>

          <Link
            href="/admin/seasons"
            className="mt-5 inline-block rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-emerald-950 transition hover:bg-amber-300"
          >
            Manage seasons
          </Link>
        </section>

        <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <p className="text-sm font-medium text-slate-500">
                {card.title}
              </p>

              <p className="mt-3 text-4xl font-bold">
                {loading ? "—" : card.value}
              </p>

              <p className="mt-4 text-sm font-semibold text-teal-600">
                Manage →
              </p>
            </Link>
          ))}
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-teal-600">
                  Race-day control
                </p>

                <h2 className="mt-1 text-2xl font-bold text-slate-950">
                  Round checklist
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Check that each round is ready before racing and
                  has completed correctly afterwards.
                </p>
              </div>

              {seasonRounds.length > 0 && (
                <div className="w-full sm:w-80">
                  <label
                    htmlFor="checklist-round"
                    className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500"
                  >
                    Round
                  </label>

                  <select
                    id="checklist-round"
                    value={selectedRoundId}
                    onChange={(event) =>
                      setSelectedRoundId(event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-semibold text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  >
                    {seasonRounds.map((round) => (
                      <option key={round.id} value={round.id}>
                        Round {round.round_number}
                        {round.name ? ` — ${round.name}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {selectedRound && !checklistLoading && (
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  {checklistReadyCount}/{checklist.length} ready
                </span>

                {checklistIssueCount > 0 && (
                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                    {checklistIssueCount}{" "}
                    {checklistIssueCount === 1
                      ? "issue"
                      : "issues"}
                  </span>
                )}

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize text-slate-700">
                  {selectedRound.status}
                </span>
              </div>
            )}
          </div>

          {!activeSeasonId ? (
            <div className="p-8 text-center text-slate-500">
              Set an active season to use the round checklist.
            </div>
          ) : seasonRounds.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No rounds have been created for the active season.
            </div>
          ) : checklistLoading ? (
            <div className="p-8 text-center text-slate-500">
              Checking round...
            </div>
          ) : (
            <div className="grid divide-y divide-slate-200 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
              <div className="divide-y divide-slate-200">
                {checklist
                  .slice(0, 4)
                  .map((item) => (
                    <div
                      key={item.label}
                      className="flex items-start justify-between gap-4 p-5"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-950">
                          {item.label}
                        </p>

                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          {item.detail}
                        </p>

                        {item.href && (
                          <Link
                            href={item.href}
                            className="mt-2 inline-flex text-sm font-bold text-teal-700 hover:underline"
                          >
                            Manage →
                          </Link>
                        )}
                      </div>

                      <StatusBadge status={item.status} />
                    </div>
                  ))}
              </div>

              <div className="divide-y divide-slate-200">
                {checklist
                  .slice(4)
                  .map((item) => (
                    <div
                      key={item.label}
                      className="flex items-start justify-between gap-4 p-5"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-950">
                          {item.label}
                        </p>

                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          {item.detail}
                        </p>

                        {item.href && (
                          <Link
                            href={item.href}
                            className="mt-2 inline-flex text-sm font-bold text-teal-700 hover:underline"
                          >
                            Manage →
                          </Link>
                        )}
                      </div>

                      <StatusBadge status={item.status} />
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
            <p className="text-sm font-semibold text-teal-600">
              Site display
            </p>

            <h2 className="mt-1 text-2xl font-bold text-slate-950">
              Horse silks
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Control whether jockey silks are shown across
              Racecourse Fantasy. Turning this off does not
              delete any uploaded silk images.
            </p>
          </div>

          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-slate-950">
                Show horse silks
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {silksSettingLoading
                  ? "Loading current setting..."
                  : showHorseSilks
                    ? "Silks are currently visible across the website."
                    : "Silks are currently hidden across the website."}
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={showHorseSilks}
              disabled={
                silksSettingLoading ||
                silksSettingSaving
              }
              onClick={() => void toggleHorseSilks()}
              className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition ${
                showHorseSilks
                  ? "bg-teal-600"
                  : "bg-slate-300"
              } ${
                silksSettingLoading ||
                silksSettingSaving
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer"
              }`}
            >
              <span
                className={`inline-block h-6 w-6 rounded-full bg-white shadow-sm transition ${
                  showHorseSilks
                    ? "translate-x-7"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {silksSettingMessage && (
            <div
              className={`border-t px-6 py-3 text-sm font-semibold ${
                silksSettingMessage.startsWith(
                  "Could not"
                )
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-teal-200 bg-teal-50 text-teal-700"
              }`}
            >
              {silksSettingMessage}
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-bold">
            Quick actions
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/admin/seasons"
              className="rounded-xl border border-slate-200 bg-white p-5 font-semibold shadow-sm hover:border-teal-500"
            >
              Create a season
            </Link>

            <Link
              href="/admin/rounds"
              className="rounded-xl border border-slate-200 bg-white p-5 font-semibold shadow-sm hover:border-teal-500"
            >
              Create a round
            </Link>

            <Link
              href="/admin/horses"
              className="rounded-xl border border-slate-200 bg-white p-5 font-semibold shadow-sm hover:border-teal-500"
            >
              Add horses
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}