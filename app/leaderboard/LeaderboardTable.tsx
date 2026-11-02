"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSeason } from "@/components/SeasonProvider";
import type { RoundLeaderboardRow, SeasonLeaderboardRow } from "./types";

type Props = {
  type?: "round" | "season" | "combined";
  rows?: RoundLeaderboardRow[] | SeasonLeaderboardRow[] | null;
  roundRows?: RoundLeaderboardRow[] | null;
  seasonRows?: SeasonLeaderboardRow[] | null;
  selectedRoundId?: string;
};
type SortKey = "round" | "total" | "projected";
type CombinedRow = {
  user_id: string;
  display_name: string;
  round_points: number;
  total_points: number;
  projected_score: number;
  runners_used: number;
  captain_ran: boolean;
  salary_used: number;
  rank_change: number | null;
  has_round: boolean;
  has_season: boolean;
};

export default function LeaderboardTable({ type = "combined", rows, roundRows, seasonRows, selectedRoundId }: Props) {
  const { selectedSeason } = useSeason();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showProjectedScores, setShowProjectedScores] = useState(false);
  const [showSpecialTeamProjections, setShowSpecialTeamProjections] = useState(false);
  const [hasEarlyProjectionAccess, setHasEarlyProjectionAccess] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("round");
  const [sortAscending, setSortAscending] = useState(false);
  type HorseCompare = { horse_id: string; horse_name: string; silks_url: string | null; race_number: number | null; race_grade: string | null; racecourse_name: string | null; is_captain: boolean; live_points: number; race_status: string };
  type CompareData = { my_user_id: string; opponent_user_id: string; my_name: string; opponent_name: string; my_score: number; opponent_score: number; my_team: HorseCompare[]; opponent_team: HorseCompare[]; my_autofill_penalty: number; opponent_autofill_penalty: number };
  const [compareOpen, setCompareOpen] = useState(false);
  const [uniqueOnly, setUniqueOnly] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState("");
  const [compareData, setCompareData] = useState<CompareData | null>(null);
  async function openComparison(userId: string) {
    setCompareOpen(true);
    setUniqueOnly(false);
    setCompareLoading(true);
    setCompareError("");
    setCompareData(null);
    if (!selectedRoundId) {
      setCompareError("Select a round before comparing teams.");
      setCompareLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc("get_leaderboard_team_compare", {
      p_round_id: selectedRoundId,
      p_opponent_user_id: userId,
    });
    if (error) setCompareError(error.message);
    else setCompareData(data as CompareData);
    setCompareLoading(false);
  }


  useEffect(() => {
    let active = true;
    async function loadSettings() {
      const [auth, settings] = await Promise.all([
        supabase.auth.getUser(),
        supabase.rpc("get_public_site_settings"),
      ]);
      if (!active) return;
      const user = auth.data.user;
      setCurrentUserId(user?.id ?? null);
      if (!settings.error && settings.data && typeof settings.data === "object") {
        const config = settings.data as { show_projected_scores?: boolean; show_special_team_projections?: boolean };
        setShowProjectedScores(config.show_projected_scores === true);
        setShowSpecialTeamProjections(config.show_special_team_projections === true);
      }
      if (user) {
        const { data, error } = await supabase.from("profiles").select("projection_access_early").eq("id", user.id).maybeSingle();
        if (active && !error) setHasEarlyProjectionAccess(data?.projection_access_early === true);
      }
    }
    void loadSettings();
    return () => { active = false; };
  }, []);

  // The legacy props remain accepted so other pages using this shared component continue to work.
  const effectiveRoundRows = useMemo(() => roundRows ?? (type === "round" ? rows as RoundLeaderboardRow[] : []) ?? [], [roundRows, rows, type]);
  const effectiveSeasonRows = useMemo(() => seasonRows ?? (type === "season" ? rows as SeasonLeaderboardRow[] : []) ?? [], [seasonRows, rows, type]);
  const isSpecialRacedays = /special\s*racedays/i.test(selectedSeason?.name ?? "");
  const projectionsVisible = !isSpecialRacedays && (showProjectedScores || (showSpecialTeamProjections && hasEarlyProjectionAccess));

  useEffect(() => {
    if (sortKey === "projected" && !projectionsVisible) {
      setSortKey("round");
      setSortAscending(false);
    }
  }, [sortKey, projectionsVisible]);

  const combined = useMemo(() => {
    const byUser = new Map<string, CombinedRow>();
    for (const row of effectiveSeasonRows ?? []) {
      if (!row.user_id) continue;
      byUser.set(row.user_id, {
        user_id: row.user_id,
        display_name: row.display_name ?? "Unknown",
        round_points: 0,
        total_points: Number(row.total_points ?? 0),
        projected_score: 0,
        runners_used: 0,
        captain_ran: false,
        salary_used: 0,
        rank_change: row.rank_change ?? null,
        has_round: false,
        has_season: true,
      });
    }
    for (const row of effectiveRoundRows ?? []) {
      if (!row.user_id) continue;
      const current = byUser.get(row.user_id);
      byUser.set(row.user_id, {
        user_id: row.user_id,
        display_name: row.display_name ?? current?.display_name ?? "Unknown",
        round_points: Number(row.total_points ?? 0),
        total_points: current?.total_points ?? 0,
        projected_score: Number(row.projected_score ?? 0),
        runners_used: Number(row.runners_used ?? 0),
        captain_ran: row.captain_ran === true,
        salary_used: Number(row.salary_used ?? 0),
        rank_change: current?.rank_change ?? null,
        has_round: true,
        has_season: current?.has_season ?? false,
      });
    }
    return [...byUser.values()];
  }, [effectiveRoundRows, effectiveSeasonRows]);

  const sorted = useMemo(() => [...combined].sort((a, b) => {
    const aValue = sortKey === "round" ? a.round_points : sortKey === "projected" ? a.projected_score : a.total_points;
    const bValue = sortKey === "round" ? b.round_points : sortKey === "projected" ? b.projected_score : b.total_points;
    if (aValue !== bValue) return sortAscending ? aValue - bValue : bValue - aValue;
    const otherA = sortKey === "round" ? a.total_points : a.round_points;
    const otherB = sortKey === "round" ? b.total_points : b.round_points;
    return otherB - otherA || a.display_name.localeCompare(b.display_name);
  }), [combined, sortKey, sortAscending]);

  function selectSort(next: SortKey) {
    if (next === "projected" && !projectionsVisible) return;
    if (sortKey === next) setSortAscending((value) => !value);
    else { setSortKey(next); setSortAscending(false); }
  }
  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column) return <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />;
    return sortAscending ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
  }

  if (!sorted.length) return <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">No leaderboard results available for this selection.</div>;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <p className="text-sm font-bold text-slate-900">Rankings <span className="ml-1 font-normal text-slate-500">· {sorted.length} players</span></p>
      </div>
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="min-w-max whitespace-nowrap text-xs sm:min-w-full sm:text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="sticky left-0 z-20 w-12 min-w-12 bg-slate-50 px-2 py-3 text-left shadow-[1px_0_0_#e2e8f0] sm:static sm:w-auto sm:min-w-0 sm:px-4 sm:shadow-none">Rank</th>
              <th className="sticky left-12 z-20 w-36 min-w-36 max-w-36 bg-slate-50 px-2 py-3 text-left shadow-[2px_0_3px_-2px_#94a3b8] sm:static sm:w-auto sm:min-w-0 sm:max-w-none sm:px-4 sm:shadow-none">Player</th>
              <th className="px-3 py-3 text-right sm:px-4"><button type="button" onClick={() => selectSort("round")} className="inline-flex items-center gap-1 hover:text-cyan-700">Round points <SortIcon column="round" /></button></th>
              <th className="px-3 py-3 text-right sm:px-4"><button type="button" onClick={() => selectSort("total")} className="inline-flex items-center gap-1 hover:text-cyan-700">Total points <SortIcon column="total" /></button></th>
              {!isSpecialRacedays && <th className="px-3 py-3 text-right sm:px-4"><button type="button" onClick={() => selectSort("projected")} disabled={!projectionsVisible} title={projectionsVisible ? "Sort by projected points" : "Projected points are hidden"} className={`inline-flex items-center gap-1 ${projectionsVisible ? "hover:text-cyan-700" : "cursor-default opacity-60"}`}>Projected {projectionsVisible && <SortIcon column="projected" />}</button></th>}
              <th className="px-3 py-3 text-right sm:px-4">Runners</th>
              <th className="px-3 py-3 text-right sm:px-4">Salary used</th>
              <th className="px-3 py-3 text-right sm:px-4" title="Change in overall season rank since the previous completed round">Overall Change</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, index) => {
              const points = sortKey === "round" ? row.round_points : sortKey === "projected" ? row.projected_score : row.total_points;
              const previous = sorted[index - 1];
              const previousPoints = previous ? (sortKey === "round" ? previous.round_points : sortKey === "projected" ? previous.projected_score : previous.total_points) : null;
              // Equal points receive equal rank (competition ranking: 1, 1, 3).
              const rank = previous && previousPoints === points ? sorted.findIndex((candidate) => (sortKey === "round" ? candidate.round_points : sortKey === "projected" ? candidate.projected_score : candidate.total_points) === points) + 1 : index + 1;
              const mine = row.user_id === currentUserId;
              return (
                <tr key={row.user_id} className={`border-t border-slate-100 ${mine ? "bg-amber-100 hover:bg-amber-100" : "hover:bg-slate-50"}`}>
                  <td className={`sticky left-0 z-10 w-12 min-w-12 px-2 py-3 font-black tabular-nums text-slate-900 shadow-[1px_0_0_#e2e8f0] sm:static sm:w-auto sm:min-w-0 sm:px-4 sm:shadow-none ${mine ? "bg-amber-100" : "bg-white"}`}>{rank}</td>
                  <td className={`sticky left-12 z-10 w-36 min-w-36 max-w-36 overflow-hidden px-2 py-3 shadow-[2px_0_3px_-2px_#94a3b8] sm:static sm:w-auto sm:min-w-0 sm:max-w-none sm:px-4 sm:shadow-none ${mine ? "bg-amber-100" : "bg-white"}`}><div className="max-w-full truncate">{mine ? <Link href={`/players/${row.user_id}`} className="font-semibold text-cyan-700 hover:underline" title="View your profile">{row.display_name}</Link> : <button type="button" onClick={() => void openComparison(row.user_id)} className="font-semibold text-cyan-700 hover:underline" title={`Compare your team with ${row.display_name}`}>{row.display_name}</button>}{mine && <span className="ml-2 text-[10px] font-black text-amber-800">YOU</span>}</div></td>
                  <td className={`px-4 py-3 text-right tabular-nums ${sortKey === "round" ? "font-black text-slate-900" : "text-slate-700"}`}>{row.has_round ? row.round_points.toLocaleString("en-AU") : "—"}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${sortKey === "total" ? "font-black text-slate-900" : "text-slate-700"}`}>{row.has_season ? row.total_points.toLocaleString("en-AU") : "—"}</td>
                  {!isSpecialRacedays && <td className={`px-4 py-3 text-right tabular-nums text-amber-600 ${sortKey === "projected" ? "font-black" : "font-semibold"}`}>{!row.has_round ? "—" : projectionsVisible ? row.projected_score.toLocaleString("en-AU") : "Hidden"}</td>}
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{row.has_round ? <>{row.runners_used}/10 {row.captain_ran && <span title="Captain has raced" className="ml-1 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-black text-amber-950">C</span>}</> : "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{row.has_round ? `$${row.salary_used.toLocaleString("en-AU")}` : "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums" title="Overall season rank movement since the previous completed round">
                    {row.rank_change == null ? (
                      <span className="text-slate-400" title="No previous overall ranking available">—</span>
                    ) : row.rank_change > 0 ? (
                      <span className="inline-flex items-center justify-end gap-1 font-bold text-emerald-600"><ArrowUp className="h-4 w-4" />{row.rank_change}</span>
                    ) : row.rank_change < 0 ? (
                      <span className="inline-flex items-center justify-end gap-1 font-bold text-red-600"><ArrowDown className="h-4 w-4" />{Math.abs(row.rank_change)}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {compareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-2 sm:p-5" role="dialog" aria-modal="true" aria-label="Team comparison" onClick={() => setCompareOpen(false)}>
          <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-20 flex items-center justify-between bg-gradient-to-r from-cyan-600 to-sky-500 px-4 py-3 text-white sm:px-5">
              <div><h2 className="text-lg font-black">Team comparison</h2><p className="text-xs text-white/85">Selected round · Official points</p></div>
              <button type="button" onClick={() => setCompareOpen(false)} className="rounded-lg p-2 hover:bg-white/20" aria-label="Close comparison"><X className="h-5 w-5" /></button>
            </div>
            {compareLoading ? <p className="p-8 text-center text-slate-500">Loading team comparison...</p> : compareError ? <p className="p-6 text-sm text-red-700">{compareError}</p> : compareData ? (() => {
              const myHorses = Array.isArray(compareData.my_team) ? compareData.my_team : [];
              const theirHorses = Array.isArray(compareData.opponent_team) ? compareData.opponent_team : [];
              const myIds = new Set(myHorses.map(h => h.horse_id));
              const theirIds = new Set(theirHorses.map(h => h.horse_id));
              // Order each comparison section by race number, then racecourse.
              // The current RPC does not provide scheduled start times.
              const byRaceOrder = (a: HorseCompare, b: HorseCompare) => {
                const aNumber = a.race_number == null ? Number.MAX_SAFE_INTEGER : Number(a.race_number);
                const bNumber = b.race_number == null ? Number.MAX_SAFE_INTEGER : Number(b.race_number);
                return aNumber - bNumber ||
                  (a.racecourse_name ?? "").localeCompare(b.racecourse_name ?? "") ||
                  a.horse_name.localeCompare(b.horse_name);
              };
              const sortHorses = (horses: HorseCompare[]) => [...horses].sort(byRaceOrder);
              const uniqueMine = sortHorses(myHorses.filter(h => !theirIds.has(h.horse_id)));
              const uniqueTheirs = sortHorses(theirHorses.filter(h => !myIds.has(h.horse_id)));
              const commonMine = sortHorses(myHorses.filter(h => theirIds.has(h.horse_id)));
              const commonTheirs = new Map(theirHorses.map(h => [h.horse_id, h]));
              const uniqueCount = Math.max(uniqueMine.length, uniqueTheirs.length);
              const statusLabel = (horse: HorseCompare | undefined) => !horse ? "" : horse.race_status === "official" ? "Final" : horse.race_status === "live" || horse.race_status === "in_progress" ? "Live" : horse.race_status ? horse.race_status.replace(/_/g, " ") : "Upcoming";
              const renderHorse = (horse: HorseCompare | undefined, side: "left" | "right") => <div className={`flex min-w-0 items-center gap-2 ${side === "right" ? "flex-row-reverse text-right" : ""}`}>
                {horse?.silks_url ? (
                  <img src={horse.silks_url} alt={`${horse.horse_name} silks`} className="h-8 w-8 shrink-0 object-contain" loading="lazy" />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center text-[9px] font-bold text-slate-400" aria-label="No silks available">—</span>
                )}
                <span className={`min-w-0 flex-1 ${side === "right" ? "text-right" : "text-left"}`}>
                  <span className="block truncate font-semibold text-slate-800" title={horse?.horse_name ?? ""}>{horse?.horse_name ?? "—"}{horse?.is_captain && <span className="ml-1 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-black text-amber-950">C</span>}</span>
                  {horse && (horse.racecourse_name || horse.race_number != null || horse.race_grade) && <span className="block truncate text-[10px] font-medium text-slate-500" title={`${horse.racecourse_name ?? "Racecourse unavailable"}${horse.race_number != null ? ` · Race ${horse.race_number}` : ""}${horse.race_grade ? ` · ${horse.race_grade}` : ""}`}>{horse.racecourse_name ?? "Racecourse unavailable"}{horse.race_number != null ? ` · Race ${horse.race_number}` : ""}{horse.race_grade ? ` · ${horse.race_grade}` : ""}</span>}
                </span>
                <span className="hidden shrink-0 text-[10px] text-slate-400 sm:inline">{statusLabel(horse)}</span>
              </div>;
              const comparisonRow = (mine: HorseCompare | undefined, theirs: HorseCompare | undefined, key: string) => <div key={key} className="grid grid-cols-[minmax(0,1fr)_48px_48px_minmax(0,1fr)] items-center gap-1 border-t border-slate-100 px-2 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_64px_64px_minmax(0,1fr)] sm:gap-3 sm:px-4 sm:text-sm">
                {renderHorse(mine, "left")}
                <span className={`text-right font-black tabular-nums ${mine && Number(mine.live_points) > 0 ? "text-emerald-700" : "text-slate-600"}`}>{mine ? Number(mine.live_points ?? 0) : "—"}</span>
                <span className={`text-left font-black tabular-nums ${theirs && Number(theirs.live_points) > 0 ? "text-emerald-700" : "text-slate-600"}`}>{theirs ? Number(theirs.live_points ?? 0) : "—"}</span>
                {renderHorse(theirs, "right")}
              </div>;
              return <div className="p-3 sm:p-5">
                <div className="grid grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)] items-center gap-2 rounded-xl border border-cyan-100 bg-cyan-50/60 p-3 sm:gap-4 sm:p-4">
                  <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wide text-cyan-700">Your team</p><p className="truncate text-sm font-black text-slate-900 sm:text-base">{compareData.my_name}</p><p className="mt-1 text-3xl font-black tabular-nums text-cyan-700">{Number(compareData.my_score).toLocaleString("en-AU")}</p><p className="text-xs text-slate-500">{myHorses.length} horses</p></div>
                  <span className="text-center text-xs font-black uppercase text-slate-400">vs</span>
                  <div className="min-w-0 text-right"><p className="text-[10px] font-black uppercase tracking-wide text-sky-700">Opponent</p><Link href={`/players/${compareData.opponent_user_id}`} className="inline-flex max-w-full items-center justify-end gap-1 text-sm font-black text-sky-800 hover:underline sm:text-base"><span className="truncate">{compareData.opponent_name}</span></Link><p className="mt-1 text-3xl font-black tabular-nums text-sky-700">{Number(compareData.opponent_score).toLocaleString("en-AU")}</p><p className="text-xs text-slate-500">{theirHorses.length} horses</p></div>
                </div>
                <div className="my-3 flex items-center justify-between gap-3"><p className="text-xs font-medium text-slate-500">Captain points included · official results only</p><button type="button" onClick={() => setUniqueOnly(v => !v)} aria-pressed={uniqueOnly} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black transition ${uniqueOnly ? "bg-cyan-600 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-cyan-50"}`}>{uniqueOnly ? "Show all horses" : "Unique only"}</button></div>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="grid grid-cols-[minmax(0,1fr)_48px_48px_minmax(0,1fr)] gap-1 bg-slate-800 px-2 py-3 text-[10px] font-black uppercase text-white sm:grid-cols-[minmax(0,1fr)_64px_64px_minmax(0,1fr)] sm:gap-3 sm:px-4"><span>Your horses</span><span className="text-right">Pts</span><span>Pts</span><span className="text-right">Their horses</span></div>
                  <div className="bg-cyan-50 px-3 py-2 text-center text-xs font-black uppercase tracking-wider text-cyan-800">Unique horses</div>
                  {uniqueCount ? Array.from({length:uniqueCount},(_,i)=>comparisonRow(uniqueMine[i],uniqueTheirs[i],`unique-${i}`)) : <p className="p-3 text-center text-xs text-slate-500">Both teams have identical selections.</p>}
                  {!uniqueOnly && <><div className="bg-cyan-50 px-3 py-2 text-center text-xs font-black uppercase tracking-wider text-cyan-800">Common horses</div>{commonMine.length ? commonMine.map((h,i)=>comparisonRow(h,commonTheirs.get(h.horse_id),`common-${h.horse_id}-${i}`)) : <p className="p-3 text-center text-xs text-slate-500">No common horses.</p>}</>}
                  <div className="grid grid-cols-2 border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"><span>Autofill penalty: −{Number(compareData.my_autofill_penalty ?? 0)}</span><span className="text-right">Autofill penalty: −{Number(compareData.opponent_autofill_penalty ?? 0)}</span></div>
                  <div className="grid grid-cols-[minmax(0,1fr)_48px_48px_minmax(0,1fr)] items-center gap-1 border-t border-slate-200 bg-slate-100 px-2 py-3 text-xs font-black text-slate-900 sm:grid-cols-[minmax(0,1fr)_64px_64px_minmax(0,1fr)] sm:gap-3 sm:px-4 sm:text-sm"><span>Total points</span><span className="text-right tabular-nums">{Number(compareData.my_score).toLocaleString("en-AU")}</span><span className="tabular-nums">{Number(compareData.opponent_score).toLocaleString("en-AU")}</span><span className="text-right">Total points</span></div>
                </div>
                <p className="mt-3 text-xs text-slate-500">Unique horses are selected by one team only. Common horses appear in both teams. A gold C marks the captain. Click your opponent's name above to view their profile.</p>
              </div>;
            })() : null}
          </div>
        </div>
      )}
    </div>
  );
}
