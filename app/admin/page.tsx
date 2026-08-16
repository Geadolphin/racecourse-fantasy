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
  race_id: string;
  horse_id: string;
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
      const raceIds = races.map((race) => race.id);
      const teamIds = teams.map((team) => team.id);

      let entries: RaceEntryRow[] = [];
      let results: RaceResultRow[] = [];
      let roundScores: RoundScoreRow[] = [];
      let priceHistory: PriceHistoryRow[] = [];

      if (raceIds.length > 0) {
        const [
          entriesResponse,
          resultsResponse,
          priceHistoryResponse,
        ] = await Promise.all([
          supabase
            .from("race_entries")
            .select(
              "id, race_id, horse_id, entry_status"
            )
            .in("race_id", raceIds),

          supabase
            .from("race_results")
            .select(
              "id, race_id, horse_id, is_official"
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
          resultsResponse.error ??
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
        results =
          (resultsResponse.data ?? []) as RaceResultRow[];
        priceHistory =
          (priceHistoryResponse.data ??
            []) as PriceHistoryRow[];
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

      const officialRacesWithoutResults =
        officialRaces.filter(
          (race) =>
            !results.some(
              (result) =>
                result.race_id === race.id &&
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
              : teams.length === 0
                ? "ready"
                : scoredTeamCount >= teams.length
                  ? "ready"
                  : "issue",
          detail:
            !roundResolved
              ? "Scoring completes after all races are resolved."
              : teams.length === 0
                ? "No teams were submitted for this round."
                : scoredTeamCount >= teams.length
                  ? `${scoredTeamCount} of ${teams.length} teams have round scores.`
                  : `${teams.length - scoredTeamCount} ${
                      teams.length - scoredTeamCount === 1
                        ? "team is"
                        : "teams are"
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