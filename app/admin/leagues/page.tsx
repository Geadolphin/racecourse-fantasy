"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type LeagueRecord = {
  id: string;
  name: string;
  join_code: string;
  created_at: string;
  owner_user_id: string;
  season_id: string;
};
type SeasonRecord = { id: string; name: string; year: number };
type ProfileRecord = { id: string; display_name: string | null };
type MemberRecord = { league_id: string };
type LeagueRow = LeagueRecord & {
  member_count: number;
  owner_name: string;
  season_name: string;
  season_year: number;
};

export default function AdminLeaguesPage() {
  const [loading, setLoading] = useState(true);
  const [leagues, setLeagues] = useState<LeagueRow[]>([]);
  const [seasons, setSeasons] = useState<SeasonRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSeasonId, setSelectedSeasonId] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadLeagues() {
      setLoading(true);
      setError("");
      try {
        const [leaguesResult, seasonsResult] = await Promise.all([
          supabase.from("leagues")
            .select("id,name,join_code,created_at,owner_user_id,season_id")
            .order("created_at", { ascending: false }),
          supabase.from("seasons").select("id,name,year"),
        ]);
        if (leaguesResult.error) throw leaguesResult.error;
        if (seasonsResult.error) throw seasonsResult.error;
        if (!active) return;

        const leagueRecords = (leaguesResult.data ?? []) as LeagueRecord[];
        const seasonRecords = (seasonsResult.data ?? []) as SeasonRecord[];
        const ownerIds = [...new Set(leagueRecords.map((league) => league.owner_user_id).filter(Boolean))];
        const leagueIds = leagueRecords.map((league) => league.id);

        // Fetch only the profiles and memberships needed for the leagues on this page.
        const [profilesResult, membersResult] = await Promise.all([
          ownerIds.length
            ? supabase.from("profiles").select("id,display_name").in("id", ownerIds)
            : Promise.resolve({ data: [] as ProfileRecord[], error: null }),
          leagueIds.length
            ? supabase.from("league_members").select("league_id").in("league_id", leagueIds)
            : Promise.resolve({ data: [] as MemberRecord[], error: null }),
        ]);
        if (profilesResult.error) throw profilesResult.error;
        if (membersResult.error) throw membersResult.error;
        if (!active) return;

        const seasonById = new Map(seasonRecords.map((season) => [season.id, season]));
        const ownerById = new Map(((profilesResult.data ?? []) as ProfileRecord[]).map((profile) => [profile.id, profile]));
        const memberCounts = new Map<string, number>();
        ((membersResult.data ?? []) as MemberRecord[]).forEach((member) => {
          memberCounts.set(member.league_id, (memberCounts.get(member.league_id) ?? 0) + 1);
        });

        setSeasons([...seasonRecords].sort((a, b) => b.year - a.year));
        setLeagues(leagueRecords.map((league) => {
          const season = seasonById.get(league.season_id);
          return {
            ...league,
            member_count: memberCounts.get(league.id) ?? 0,
            owner_name: ownerById.get(league.owner_user_id)?.display_name?.trim() || "Unknown owner",
            season_name: season?.name ?? "Unknown season",
            season_year: season?.year ?? 0,
          };
        }));
      } catch (cause) {
        if (!active) return;
        console.error("Admin leagues load error:", cause);
        setError(cause instanceof Error ? cause.message : "Unable to load private leagues.");
        setLeagues([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadLeagues();
    return () => { active = false; };
  }, []);

  const filteredLeagues = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return leagues.filter((league) => {
      if (selectedSeasonId !== "all" && league.season_id !== selectedSeasonId) return false;
      if (!term) return true;
      return [league.name, league.owner_name, league.join_code, league.season_name, String(league.season_year)]
        .some((value) => value.toLowerCase().includes(term));
    });
  }, [leagues, searchTerm, selectedSeasonId]);

  const inputClass = "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700";

  return (
    <main className="min-w-0 px-4 py-5 md:px-6 md:py-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-teal-700">Administration</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Private Leagues</h1>
            <p className="mt-1 text-xs text-slate-500">League membership, owners and season information.</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total leagues</p>
            <p className="text-xl font-bold leading-tight tabular-nums text-slate-900">{leagues.length}</p>
          </div>
        </header>

        {error && <div role="alert" className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

        <section className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-3">
          <label className="min-w-[160px] flex-1 sm:max-w-[225px]">
            <span className="sr-only">Filter by season</span>
            <select value={selectedSeasonId} onChange={(event) => setSelectedSeasonId(event.target.value)} className={inputClass}>
              <option value="all">All seasons</option>
              {seasons.map((season) => <option key={season.id} value={season.id}>{season.name} {season.year}</option>)}
            </select>
          </label>
          <label className="min-w-[190px] flex-[2] sm:max-w-[370px]">
            <span className="sr-only">Search leagues</span>
            <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search league, owner or code" className={inputClass} />
          </label>
          <span className="ml-auto whitespace-nowrap text-xs tabular-nums text-slate-500">
            {loading ? "Loading…" : `${filteredLeagues.length} of ${leagues.length} leagues`}
          </span>
        </section>

        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th scope="col" className="px-3 py-2.5">League</th>
                  <th scope="col" className="px-3 py-2.5">Season</th>
                  <th scope="col" className="px-3 py-2.5">Owner</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Members</th>
                  <th scope="col" className="px-3 py-2.5">Join code</th>
                  <th scope="col" className="px-3 py-2.5">Created</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={7} className="px-3 py-12 text-center text-sm text-slate-500">Loading leagues…</td></tr>
                ) : filteredLeagues.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-12 text-center text-sm text-slate-500">No leagues found.</td></tr>
                ) : filteredLeagues.map((league) => (
                  <tr key={league.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-semibold text-slate-900">{league.name}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{league.season_name} {league.season_year}</td>
                    <td className="px-3 py-2.5 text-slate-700">{league.owner_name}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{league.member_count} / 24</td>
                    <td className="px-3 py-2.5"><span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-1 font-mono text-xs font-semibold tracking-wide text-slate-700">{league.join_code}</span></td>
                    <td className="px-3 py-2.5 whitespace-nowrap tabular-nums text-slate-500">{new Date(league.created_at).toLocaleDateString("en-AU")}</td>
                    <td className="px-3 py-2.5 text-right"><Link href={`/admin/leagues/${league.id}`} className="inline-flex h-7 items-center rounded border border-slate-300 bg-white px-2.5 text-xs font-semibold text-teal-800 hover:border-teal-600 hover:bg-teal-50">View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
