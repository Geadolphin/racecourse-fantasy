"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Season = {
  id: string;
  name: string;
  year: number;
  is_active: boolean;
};

type Round = {
  id: string;
  season_id: string;
  round_number: number;
  name: string | null;
  status: string;
  lockout_at: string | null;
};

type Team = {
  id: string;
  user_id: string;
  status: string;
};

type Selection = {
  team_id: string;
  race_entry_id: string;
  is_captain: boolean;
};

type Entry = {
  id: string;
  horse_id: string;
  entry_status: string;
  horse:
    | {
        id: string;
        name: string;
      }
    | {
        id: string;
        name: string;
      }[]
    | null;
};

type HorseStat = {
  horse_id: string;
  horse_name: string;
  selection_count: number;
  captain_count: number;
  ownership_percentage: number;
  captain_percentage: number;
};

type SortKey =
  | "horse_name"
  | "selection_count"
  | "ownership_percentage"
  | "captain_count"
  | "captain_percentage";

type SortDirection = "asc" | "desc";

function pct(value: number) {
  return `${value.toFixed(1)}%`;
}

function roundLabel(round: Round) {
  return `Round ${round.round_number}${round.name ? ` — ${round.name}` : ""}`;
}

export default function AdminStatsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [selectedRoundId, setSelectedRoundId] = useState("");

  const [stats, setStats] = useState<HorseStat[]>([]);
  const [totalTeams, setTotalTeams] = useState(0);
  const [draftTeams, setDraftTeams] = useState(0);
  const [completeTeams, setCompleteTeams] = useState(0);
  const [teamsWithSelections, setTeamsWithSelections] = useState(0);

  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [sortKey, setSortKey] =
    useState<SortKey>("ownership_percentage");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("desc");

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      setLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("seasons")
        .select("id, name, year, is_active")
        .order("year", { ascending: false });

      if (!active) return;

      if (error) {
        console.error("Admin stats season load error:", error);
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      const loadedSeasons = (data ?? []) as Season[];
      setSeasons(loadedSeasons);

      const preferred =
        loadedSeasons.find((season) => season.is_active) ??
        loadedSeasons[0];

      setSelectedSeasonId(preferred?.id ?? "");
      setLoading(false);
    }

    void loadInitialData();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedSeasonId) {
      setRounds([]);
      setSelectedRoundId("");
      return;
    }

    let active = true;

    async function loadRounds() {
      setErrorMessage("");

      const { data, error } = await supabase
        .from("rounds")
        .select(
          "id, season_id, round_number, name, status, lockout_at"
        )
        .eq("season_id", selectedSeasonId)
        .order("round_number", { ascending: true });

      if (!active) return;

      if (error) {
        console.error("Admin stats round load error:", error);
        setErrorMessage(error.message);
        setRounds([]);
        setSelectedRoundId("");
        return;
      }

      const loadedRounds = (data ?? []) as Round[];
      setRounds(loadedRounds);

      const preferred =
        loadedRounds.find((round) => round.status === "open") ??
        loadedRounds.find((round) => round.status === "locked") ??
        [...loadedRounds]
          .reverse()
          .find((round) => round.status === "completed") ??
        loadedRounds[0];

      setSelectedRoundId(preferred?.id ?? "");
    }

    void loadRounds();

    return () => {
      active = false;
    };
  }, [selectedSeasonId]);

  useEffect(() => {
    if (!selectedRoundId) {
      setStats([]);
      setTotalTeams(0);
      setDraftTeams(0);
      setCompleteTeams(0);
      setTeamsWithSelections(0);
      return;
    }

    let active = true;

    async function loadStats() {
      setStatsLoading(true);
      setErrorMessage("");

      // Intentionally NO status filter here.
      // Admin pre-lockout stats must include draft teams.
      // Fetch in pages because Supabase/PostgREST may enforce
      // a server-side maximum row count per request.
      const teams: Team[] = [];
      const teamPageSize = 100;
      let teamFrom = 0;

      while (true) {
        const { data: teamPage, error: teamsError } =
          await supabase
            .from("teams")
            .select("id, user_id, status")
            .eq("round_id", selectedRoundId)
            .range(teamFrom, teamFrom + teamPageSize - 1);

        if (!active) return;

        if (teamsError) {
          console.error("Admin stats teams load error:", teamsError);
          setErrorMessage(teamsError.message);
          setStatsLoading(false);
          return;
        }

        const page = (teamPage ?? []) as Team[];
        teams.push(...page);

        if (page.length < teamPageSize) {
          break;
        }

        teamFrom += teamPageSize;
      }

      const teamIds = teams.map((team) => team.id);

      setTotalTeams(teams.length);
      setDraftTeams(
        teams.filter((team) => team.status === "draft").length
      );
      setCompleteTeams(
        teams.filter((team) =>
          ["submitted", "locked", "scored"].includes(team.status)
        ).length
      );

      if (teamIds.length === 0) {
        setStats([]);
        setTeamsWithSelections(0);
        setStatsLoading(false);
        return;
      }

      const selections: Selection[] = [];
      const selectionPageSize = 100;
      let selectionFrom = 0;

      while (true) {
        const { data: selectionPage, error: selectionsError } =
          await supabase
            .from("team_selections")
            .select("team_id, race_entry_id, is_captain")
            .in("team_id", teamIds)
            .range(
              selectionFrom,
              selectionFrom + selectionPageSize - 1
            );

        if (!active) return;

        if (selectionsError) {
          console.error(
            "Admin stats selections load error:",
            selectionsError
          );
          setErrorMessage(selectionsError.message);
          setStatsLoading(false);
          return;
        }

        const page = (selectionPage ?? []) as Selection[];
        selections.push(...page);

        if (page.length < selectionPageSize) {
          break;
        }

        selectionFrom += selectionPageSize;
      }
      const selectedTeamIds = new Set(
        selections.map((selection) => selection.team_id)
      );
      setTeamsWithSelections(selectedTeamIds.size);

      const entryIds = [
        ...new Set(
          selections.map((selection) => selection.race_entry_id)
        ),
      ];

      if (entryIds.length === 0) {
        setStats([]);
        setStatsLoading(false);
        return;
      }

      const entries: Entry[] = [];
      const entryPageSize = 100;
      let entryFrom = 0;

      while (true) {
        const { data: entryPage, error: entriesError } =
          await supabase
            .from("race_entries")
            .select(
              `
                id,
                horse_id,
                entry_status,
                horse:horses (
                  id,
                  name
                )
              `
            )
            .in("id", entryIds)
            .range(entryFrom, entryFrom + entryPageSize - 1);

        if (!active) return;

        if (entriesError) {
          console.error(
            "Admin stats race entry load error:",
            entriesError
          );
          setErrorMessage(entriesError.message);
          setStatsLoading(false);
          return;
        }

        const page = (entryPage ?? []) as Entry[];
        entries.push(...page);

        if (page.length < entryPageSize) {
          break;
        }

        entryFrom += entryPageSize;
      }
      const entryById = new Map(
        entries.map((entry) => [entry.id, entry])
      );

      const accumulator = new Map<
        string,
        {
          horse_name: string;
          team_ids: Set<string>;
          captain_team_ids: Set<string>;
        }
      >();

      for (const selection of selections) {
        const entry = entryById.get(selection.race_entry_id);
        if (!entry) continue;

        const horseRelation = Array.isArray(entry.horse)
          ? entry.horse[0] ?? null
          : entry.horse;

        const horseId = entry.horse_id;
        const horseName =
          horseRelation?.name ?? "Unknown horse";

        const current =
          accumulator.get(horseId) ?? {
            horse_name: horseName,
            team_ids: new Set<string>(),
            captain_team_ids: new Set<string>(),
          };

        current.team_ids.add(selection.team_id);

        if (selection.is_captain) {
          current.captain_team_ids.add(selection.team_id);
        }

        accumulator.set(horseId, current);
      }

      // Percentages use every team currently created for the round.
      // That makes the admin figures truly live before lockout.
      const denominator = teams.length;

      const nextStats: HorseStat[] = Array.from(
        accumulator.entries()
      ).map(([horseId, row]) => {
        const selectionCount = row.team_ids.size;
        const captainCount = row.captain_team_ids.size;

        return {
          horse_id: horseId,
          horse_name: row.horse_name,
          selection_count: selectionCount,
          captain_count: captainCount,
          ownership_percentage:
            denominator > 0
              ? (selectionCount / denominator) * 100
              : 0,
          captain_percentage:
            denominator > 0
              ? (captainCount / denominator) * 100
              : 0,
        };
      });

      setStats(nextStats);
      setStatsLoading(false);
    }

    void loadStats();

    return () => {
      active = false;
    };
  }, [selectedRoundId]);

  const sortedStats = useMemo(() => {
    const rows = [...stats];

    rows.sort((a, b) => {
      let comparison = 0;

      switch (sortKey) {
        case "horse_name":
          comparison = a.horse_name.localeCompare(b.horse_name);
          break;
        case "selection_count":
          comparison = a.selection_count - b.selection_count;
          break;
        case "ownership_percentage":
          comparison =
            a.ownership_percentage - b.ownership_percentage;
          break;
        case "captain_count":
          comparison = a.captain_count - b.captain_count;
          break;
        case "captain_percentage":
          comparison =
            a.captain_percentage - b.captain_percentage;
          break;
      }

      if (comparison === 0) {
        comparison = a.horse_name.localeCompare(b.horse_name);
      }

      return sortDirection === "asc"
        ? comparison
        : -comparison;
    });

    return rows;
  }, [stats, sortDirection, sortKey]);

  const selectedRound =
    rounds.find((round) => round.id === selectedRoundId) ?? null;

  function changeSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) =>
        current === "asc" ? "desc" : "asc"
      );
      return;
    }

    setSortKey(nextKey);
    setSortDirection(
      nextKey === "horse_name" ? "asc" : "desc"
    );
  }

  function sortMarker(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDirection === "asc" ? " ↑" : " ↓";
  }

  return (
    <main className="p-6 sm:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-semibold text-teal-600">
              Administration
            </p>
            <h1 className="mt-1 text-4xl font-bold tracking-tight">
              Ownership & captaincy
            </h1>
            <p className="mt-2 max-w-3xl text-slate-600">
              Live admin-only selection statistics. Draft teams are
              included, so these figures can be viewed before lockout.
            </p>
          </div>

          <Link
            href="/admin"
            className="inline-flex w-fit rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:border-teal-500 hover:text-teal-700"
          >
            ← Admin dashboard
          </Link>
        </div>

        {errorMessage && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {errorMessage}
          </div>
        )}

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Season
              </label>
              <select
                value={selectedSeasonId}
                onChange={(event) =>
                  setSelectedSeasonId(event.target.value)
                }
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-semibold text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              >
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name} {season.year}
                    {season.is_active ? " — Active" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Round
              </label>
              <select
                value={selectedRoundId}
                onChange={(event) =>
                  setSelectedRoundId(event.target.value)
                }
                disabled={rounds.length === 0}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-semibold text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              >
                {rounds.map((round) => (
                  <option key={round.id} value={round.id}>
                    {roundLabel(round)} — {round.status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedRound && (
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                Status: {selectedRound.status}
              </span>
              {selectedRound.lockout_at && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  Lockout:{" "}
                  {new Date(
                    selectedRound.lockout_at
                  ).toLocaleString("en-AU")}
                </span>
              )}
              {selectedRound.status === "open" && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                  Pre-lockout live data
                </span>
              )}
            </div>
          )}
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Teams created
            </p>
            <p className="mt-2 text-3xl font-black text-slate-950">
              {statsLoading ? "—" : totalTeams}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Draft teams
            </p>
            <p className="mt-2 text-3xl font-black text-amber-700">
              {statsLoading ? "—" : draftTeams}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Submitted / locked
            </p>
            <p className="mt-2 text-3xl font-black text-teal-700">
              {statsLoading ? "—" : completeTeams}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Teams with selections
            </p>
            <p className="mt-2 text-3xl font-black text-slate-950">
              {statsLoading ? "—" : teamsWithSelections}
            </p>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
            <h2 className="text-2xl font-bold text-slate-950">
              Horse ownership
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Percentages are calculated against all teams currently
              created for the selected round, including drafts.
            </p>
          </div>

          {statsLoading ? (
            <div className="p-10 text-center font-semibold text-slate-500">
              Loading live ownership…
            </div>
          ) : sortedStats.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              No selections have been made for this round yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th
                      className="cursor-pointer px-5 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500"
                      onClick={() => changeSort("horse_name")}
                    >
                      Horse{sortMarker("horse_name")}
                    </th>
                    <th
                      className="cursor-pointer px-5 py-3 text-right text-xs font-black uppercase tracking-wide text-slate-500"
                      onClick={() =>
                        changeSort("selection_count")
                      }
                    >
                      Selected{sortMarker("selection_count")}
                    </th>
                    <th
                      className="cursor-pointer px-5 py-3 text-right text-xs font-black uppercase tracking-wide text-slate-500"
                      onClick={() =>
                        changeSort("ownership_percentage")
                      }
                    >
                      Ownership
                      {sortMarker("ownership_percentage")}
                    </th>
                    <th
                      className="cursor-pointer px-5 py-3 text-right text-xs font-black uppercase tracking-wide text-slate-500"
                      onClick={() =>
                        changeSort("captain_count")
                      }
                    >
                      Captained{sortMarker("captain_count")}
                    </th>
                    <th
                      className="cursor-pointer px-5 py-3 text-right text-xs font-black uppercase tracking-wide text-slate-500"
                      onClick={() =>
                        changeSort("captain_percentage")
                      }
                    >
                      Captaincy
                      {sortMarker("captain_percentage")}
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {sortedStats.map((horse) => (
                    <tr
                      key={horse.horse_id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/horses/${horse.horse_id}`}
                          className="font-bold text-slate-950 hover:text-teal-700 hover:underline"
                        >
                          {horse.horse_name}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-700">
                        {horse.selection_count}
                      </td>
                      <td className="px-5 py-4 text-right font-black text-teal-700">
                        {pct(horse.ownership_percentage)}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-700">
                        {horse.captain_count}
                      </td>
                      <td className="px-5 py-4 text-right font-black text-amber-700">
                        {pct(horse.captain_percentage)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Admin only:</strong> this page intentionally exposes
          live selections before lockout. Do not link it from the public
          Stats Centre.
        </div>
      </div>
    </main>
  );
}
