"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";

type LeagueRow = {
  id: string;
  name: string;
  join_code: string;
  created_at: string;
  owner_user_id: string;
  season_id: string;
  member_count: number;
  owner_name: string;
  season_name: string;
  season_year: number;
};

type LeagueRecord = {
  id: string;
  name: string;
  join_code: string;
  created_at: string;
  owner_user_id: string;
  season_id: string;
};

type SeasonRecord = {
  id: string;
  name: string;
  year: number;
};

type ProfileRecord = {
  id: string;
  display_name: string | null;
};

type MemberRecord = {
  league_id: string;
  user_id: string;
};

export default function AdminLeaguesPage() {
  const [loading, setLoading] = useState(true);
  const [leagues, setLeagues] = useState<LeagueRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSeasonId, setSelectedSeasonId] =
    useState("all");
  const [seasons, setSeasons] =
    useState<SeasonRecord[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadLeagues() {
      setLoading(true);
      setError("");

      const [
        { data: leaguesData, error: leaguesError },
        { data: seasonsData, error: seasonsError },
        { data: profilesData, error: profilesError },
        { data: membersData, error: membersError },
      ] = await Promise.all([
        supabase
          .from("leagues")
          .select(`
            id,
            name,
            join_code,
            created_at,
            owner_user_id,
            season_id
          `)
          .order("created_at", { ascending: false }),

        supabase
          .from("seasons")
          .select("id, name, year"),

        supabase
          .from("profiles")
          .select("id, display_name"),

        supabase
          .from("league_members")
          .select("league_id, user_id"),
      ]);

      if (!active) {
        return;
      }

      const loadError =
        leaguesError ||
        seasonsError ||
        profilesError ||
        membersError;

      if (loadError) {
        console.error("Admin leagues load error:", {
          leaguesError,
          seasonsError,
          profilesError,
          membersError,
        });

        setError(
          loadError.message ||
            "Unable to load private leagues."
        );

        setLeagues([]);
        setLoading(false);
        return;
      }

      const leagueRecords =
        (leaguesData ?? []) as LeagueRecord[];

      const seasonRecords =
        (seasonsData ?? []) as SeasonRecord[];

      const profileRecords =
        (profilesData ?? []) as ProfileRecord[];

      const memberRecords =
        (membersData ?? []) as MemberRecord[];

      const seasonsById = new Map(
        seasonRecords.map((season) => [
          season.id,
          season,
        ])
      );

      const profilesById = new Map(
        profileRecords.map((profile) => [
          profile.id,
          profile,
        ])
      );

      const memberCounts = new Map<string, number>();

      memberRecords.forEach((member) => {
        memberCounts.set(
          member.league_id,
          (memberCounts.get(member.league_id) ?? 0) + 1
        );
      });

      const loadedLeagues: LeagueRow[] =
        leagueRecords.map((league) => {
          const season =
            seasonsById.get(league.season_id);

          const owner =
            profilesById.get(
              league.owner_user_id
            );

          return {
            id: league.id,
            name: league.name,
            join_code: league.join_code,
            created_at: league.created_at,
            owner_user_id: league.owner_user_id,
            season_id: league.season_id,

            member_count:
              memberCounts.get(league.id) ?? 0,

            owner_name:
              owner?.display_name?.trim() ||
              "Unknown owner",

            season_name:
              season?.name ?? "Unknown season",

            season_year:
              season?.year ?? 0,
          };
        });

      setSeasons(
        [...seasonRecords].sort(
          (a, b) => b.year - a.year
        )
      );

      setLeagues(loadedLeagues);
      setLoading(false);
    }

    void loadLeagues();

    return () => {
      active = false;
    };
  }, []);

  const filteredLeagues = useMemo(() => {
    const term =
      searchTerm.trim().toLowerCase();

    return leagues.filter((league) => {
      const matchesSeason =
        selectedSeasonId === "all" ||
        league.season_id === selectedSeasonId;

      const matchesSearch =
        !term ||
        league.name
          .toLowerCase()
          .includes(term) ||
        league.owner_name
          .toLowerCase()
          .includes(term) ||
        league.join_code
          .toLowerCase()
          .includes(term) ||
        league.season_name
          .toLowerCase()
          .includes(term) ||
        league.season_year
          .toString()
          .includes(term);

      return matchesSeason && matchesSearch;
    });
  }, [
    leagues,
    searchTerm,
    selectedSeasonId,
  ]);

  if (loading) {
    return (
      <main className="p-6 md:p-8">
        <div className="rounded-xl border bg-white p-10 text-center shadow-sm">
          Loading leagues...
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
            Administration
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-950">
            Private Leagues
          </h1>

          <p className="mt-2 text-slate-600">
            View and manage private leagues across
            Racecourse Fantasy.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        <section className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Total leagues
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-950">
                {leagues.length}
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:max-w-2xl sm:flex-row">
              <div className="w-full sm:w-56">
                <label
                  htmlFor="season-filter"
                  className="sr-only"
                >
                  Filter by season
                </label>

                <select
                  id="season-filter"
                  value={selectedSeasonId}
                  onChange={(event) =>
                    setSelectedSeasonId(
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                >
                  <option value="all">
                    All Seasons
                  </option>

                  {seasons.map((season) => (
                    <option
                      key={season.id}
                      value={season.id}
                    >
                      {season.name} {season.year}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full sm:flex-1">
                <label
                  htmlFor="league-search"
                  className="sr-only"
                >
                  Search leagues
                </label>

                <input
                  id="league-search"
                  type="search"
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(
                      event.target.value
                    )
                  }
                  placeholder="Search leagues..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                />
              </div>
            </div>
          </div>
        </section>

        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full min-w-[900px]">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                <th className="px-4 py-3">
                  League
                </th>

                <th className="px-4 py-3">
                  Season
                </th>

                <th className="px-4 py-3">
                  Owner
                </th>

                <th className="px-4 py-3 text-right">
                  Members
                </th>

                <th className="px-4 py-3">
                  Join Code
                </th>

                <th className="px-4 py-3">
                  Created
                </th>

                <th className="px-4 py-3 text-right">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredLeagues.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    No leagues found.
                  </td>
                </tr>
              ) : (
                filteredLeagues.map(
                  (league) => (
                    <tr
                      key={league.id}
                      className="border-t hover:bg-slate-50"
                    >
                      <td className="px-4 py-4 font-semibold text-slate-950">
                        {league.name}
                      </td>

                      <td className="px-4 py-4 text-slate-700">
                        {league.season_name}{" "}
                        {league.season_year}
                      </td>

                      <td className="px-4 py-4 text-slate-700">
                        {league.owner_name}
                      </td>

                      <td className="px-4 py-4 text-right font-semibold text-slate-900">
                        {league.member_count} / 24
                      </td>

                      <td className="px-4 py-4">
                        <span className="font-mono font-semibold tracking-wider text-slate-700">
                          {league.join_code}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-slate-600">
                        {new Date(
                          league.created_at
                        ).toLocaleDateString(
                          "en-AU"
                        )}
                      </td>

                      <td className="px-4 py-4 text-right">
                        <Link
                          href={`/admin/leagues/${league.id}`}
                          className="font-semibold text-teal-700 hover:text-teal-900 hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}