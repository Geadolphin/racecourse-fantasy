"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Race = {
  race_date: string;
  state: string;
  racecourse: string;
  race_name: string;
  race_grade: string;
  race_type: string;
  race_conditions: string;
  distance_m: number;
  prizemoney_aud: number;
};

type CalendarVersion = { id: string; name: string; is_original: boolean };
type MeetingRecord = { id: string; meeting_date: string; racecourse_id: string };
type RacecourseRecord = { id: string; name: string; state: string };
type RaceRecord = { id: string; meeting_id: string; race_name: string; race_grade: string; race_type: string | null; race_conditions: string | null; distance_m: number; prizemoney_aud: number; display_order: number };

const grades = ["G1", "G2", "G3", "LR"];
const gradeClasses: Record<string, string> = {
  G1: "bg-amber-100 text-amber-900 border-amber-300",
  G2: "bg-sky-100 text-sky-900 border-sky-300",
  G3: "bg-violet-100 text-violet-900 border-violet-300",
  LR: "bg-slate-100 text-slate-700 border-slate-300",
};
const dayMs = 86400000;
function parseDay(iso: string) { return new Date(`${iso}T12:00:00Z`); }
function isoDay(d: Date) { return d.toISOString().slice(0, 10); }
function startOfWeek(d: Date) {
  const day = new Date(d);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day;
}
function addDays(d: Date, n: number) { return new Date(d.getTime() + n * dayMs); }
function displayDate(iso: string, options: Intl.DateTimeFormatOptions) {
  return parseDay(iso).toLocaleDateString("en-AU", { ...options, timeZone: "UTC" });
}
function dollars(n: number) { return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n); }

export default function RacingCalendarPage() {
  const [races, setRaces] = useState<Race[]>([]);
  const [versions, setVersions] = useState<CalendarVersion[]>([]);
  const [versionId, setVersionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const firstDate = useMemo(() => [...races].map(r => r.race_date).sort()[0] ?? "2026-08-01", [races]);
  const [week, setWeek] = useState(() => isoDay(startOfWeek(parseDay(firstDate))));
  const [state, setState] = useState("ALL");
  const [grade, setGrade] = useState("ALL");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<"week" | "list">("week");
  useEffect(() => {
    let active = true;
    async function loadVersions() {
      setLoading(true);
      const { data, error: loadError } = await supabase
        .from("calendar_versions")
        .select("id, name, is_original")
        .eq("period_label", "Spring 2026")
        .order("is_original", { ascending: true });
      if (!active) return;
      if (loadError) { setError(`Could not load calendar versions: ${loadError.message}`); setLoading(false); return; }
      const available = (data ?? []) as CalendarVersion[];
      setVersions(available);
      setVersionId(available.find(v => !v.is_original)?.id ?? available[0]?.id ?? "");
      if (!available.length) setLoading(false);
    }
    void loadVersions();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!versionId) return;
    let active = true;
    async function loadCalendar() {
      setLoading(true);
      setError("");
      const [meetingsResponse, racecoursesResponse] = await Promise.all([
        supabase.from("calendar_meetings").select("id, meeting_date, racecourse_id").eq("version_id", versionId).order("meeting_date"),
        supabase.from("calendar_racecourses").select("id, name, state"),
      ]);
      if (!active) return;
      const initialError = meetingsResponse.error ?? racecoursesResponse.error;
      if (initialError) { setError(`Could not load calendar: ${initialError.message}`); setRaces([]); setLoading(false); return; }
      const meetings = (meetingsResponse.data ?? []) as MeetingRecord[];
      const courses = new Map(((racecoursesResponse.data ?? []) as RacecourseRecord[]).map(c => [c.id, c]));
      if (!meetings.length) { setRaces([]); setLoading(false); return; }
      const { data: raceData, error: racesError } = await supabase
        .from("calendar_races")
        .select("id, meeting_id, race_name, race_grade, race_type, race_conditions, distance_m, prizemoney_aud, display_order")
        .in("meeting_id", meetings.map(m => m.id))
        .order("display_order", { ascending: true });
      if (!active) return;
      if (racesError) { setError(`Could not load races: ${racesError.message}`); setRaces([]); setLoading(false); return; }
      const meetingMap = new Map(meetings.map(m => [m.id, m]));
      const loaded = ((raceData ?? []) as RaceRecord[]).flatMap(r => {
        const meeting = meetingMap.get(r.meeting_id);
        const course = meeting ? courses.get(meeting.racecourse_id) : undefined;
        return meeting && course ? [{
          race_date: meeting.meeting_date, state: course.state, racecourse: course.name,
          race_name: r.race_name, race_grade: r.race_grade,
          race_type: r.race_type ?? "", race_conditions: r.race_conditions ?? "",
          distance_m: r.distance_m, prizemoney_aud: r.prizemoney_aud,
        }] : [];
      });
      setRaces(loaded);
      if (loaded.length) setWeek(isoDay(startOfWeek(parseDay([...loaded].map(r => r.race_date).sort()[0]))));
      setLoading(false);
    }
    void loadCalendar();
    return () => { active = false; };
  }, [versionId]);

  const weekStart = parseDay(week);
  const days = Array.from({ length: 7 }, (_, i) => isoDay(addDays(weekStart, i)));
  const filtered = useMemo(() => races.filter(r =>
    (state === "ALL" || r.state === state) &&
    (grade === "ALL" || r.race_grade === grade) &&
    (!search.trim() || [r.race_name, r.racecourse, r.race_conditions, r.race_type].some(x => String(x).toLowerCase().includes(search.toLowerCase().trim())))
  ), [state, grade, search]);
  const weekRaces = filtered.filter(r => r.race_date >= days[0] && r.race_date <= days[6]);
  const meetingGroups = (dayRaces: Race[]) => {
    const groups = new Map<string, Race[]>();
    for (const race of dayRaces) {
      const key = `${race.state}|${race.racecourse}`;
      groups.set(key, [...(groups.get(key) ?? []), race]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  };
  const countMeetings = new Set(weekRaces.map(r => `${r.race_date}|${r.state}|${r.racecourse}`)).size;
  const rangeLabel = `${displayDate(days[0], { day: "numeric", month: "short" })} – ${displayDate(days[6], { day: "numeric", month: "short", year: "numeric" })}`;
  const renderMeeting = (key: string, entries: Race[]) => {
    const [, meetingState, venue] = key.split("|");
    const open = expanded[key] ?? true;
    return (
      <div key={key} className="overflow-hidden border border-slate-200 bg-white shadow-sm">
        <button type="button" onClick={() => setExpanded(prev => ({ ...prev, [key]: !open }))} className="flex w-full items-start justify-between gap-2 border-b border-slate-100 px-3 py-3 text-left hover:bg-slate-50" aria-expanded={open}>
          <span className="min-w-0"><span className="block text-sm font-bold text-slate-900">{venue}</span><span className="mt-0.5 block text-xs text-slate-500">{meetingState} · {entries.length} {entries.length === 1 ? "race" : "races"}</span></span>
          <span className="shrink-0 text-sm text-teal-700">{open ? "−" : "+"}</span>
        </button>
        {open && <div className="divide-y divide-slate-100">{entries.map((race, i) => (
          <div key={`${race.race_date}-${race.race_name}-${i}`} className="px-3 py-3">
            <div className="flex items-start justify-between gap-2"><p className="min-w-0 text-sm font-semibold leading-5 text-slate-800">{race.race_name}</p><span className={`shrink-0 border px-1.5 py-0.5 text-[10px] font-bold ${gradeClasses[race.race_grade] ?? gradeClasses.LR}`}>{race.race_grade}</span></div>
            <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-600"><span>{race.distance_m}m</span><span>·</span><span>{race.race_type}</span><span>·</span><span>{race.race_conditions}</span></div>
            <p className="mt-1 text-xs font-semibold text-teal-800">{dollars(race.prizemoney_aud)}</p>
          </div>
        ))}</div>}
      </div>
    );
  };
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-300">Racecourse Fantasy / Independent tools</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Australian Racing Calendar</h1><p className="mt-1 text-sm text-slate-300">Spring 2026 · Victoria and New South Wales</p></div>
            <Link href="/" className="border border-slate-600 px-4 py-2 text-sm font-semibold text-white hover:border-teal-300 hover:text-teal-200">Back to website →</Link>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="border-l-4 border-teal-600 bg-teal-50 px-4 py-3 text-sm text-teal-900">Read-only Supabase calendar. Switch between the original and revised versions below. No edits are saved and no fantasy competition tables are accessed.</div>
        {error && <div role="alert" className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        <div className="flex flex-wrap items-center gap-3 border border-slate-200 bg-white p-4">
          <label className="text-sm font-semibold text-slate-700" htmlFor="calendar-version">Calendar version</label>
          <select id="calendar-version" value={versionId} onChange={e => setVersionId(e.target.value)} disabled={loading || !versions.length} className="min-w-[240px] border border-slate-300 bg-white px-3 py-2 text-sm">
            {versions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          {loading && <span className="text-sm text-slate-500">Loading calendar…</span>}
          {!loading && !error && <span className="text-sm text-slate-500">{races.length} races loaded</span>}
        </div>
        <section className="grid gap-3 sm:grid-cols-3">
          {[{ label: "Races in selected version", value: races.length }, { label: "Races this week", value: weekRaces.length }, { label: "Meetings this week", value: countMeetings }].map(item => <div key={item.label} className="border border-slate-200 bg-white px-5 py-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{item.value}</p></div>)}
        </section>
        <section className="border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[130px] flex-col gap-1 text-xs font-semibold text-slate-600">State<select value={state} onChange={e => setState(e.target.value)} className="border border-slate-300 bg-white px-3 py-2 text-sm"><option value="ALL">All states</option><option value="VIC">Victoria</option><option value="NSW">New South Wales</option></select></label>
            <label className="flex min-w-[120px] flex-col gap-1 text-xs font-semibold text-slate-600">Grade<select value={grade} onChange={e => setGrade(e.target.value)} className="border border-slate-300 bg-white px-3 py-2 text-sm"><option value="ALL">All grades</option>{grades.map(g => <option key={g} value={g}>{g}</option>)}</select></label>
            <label className="flex min-w-[190px] flex-1 flex-col gap-1 text-xs font-semibold text-slate-600">Search races or racecourses<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search calendar..." className="border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Jump to week<input type="date" min="2026-08-01" max="2026-11-30" value={days[0]} onChange={e => e.target.value && setWeek(isoDay(startOfWeek(parseDay(e.target.value))))} className="border border-slate-300 px-3 py-2 text-sm" /></label>
          </div>
        </section>
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">{rangeLabel}</h2><p className="mt-1 text-xs text-slate-500">Meetings are grouped by date and racecourse</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => setWeek(isoDay(addDays(weekStart, -7)))} className="border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100">← Previous</button><button type="button" onClick={() => setWeek(isoDay(startOfWeek(parseDay(firstDate))))} className="border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100">Start</button><button type="button" onClick={() => setWeek(isoDay(addDays(weekStart, 7)))} className="border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100">Next →</button></div></div>
          <div className="mb-3 flex gap-2"><button type="button" onClick={() => setView("week")} className={`px-4 py-2 text-sm font-semibold ${view === "week" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white"}`}>Weekly board</button><button type="button" onClick={() => setView("list")} className={`px-4 py-2 text-sm font-semibold ${view === "list" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white"}`}>Day-by-day list</button></div>
          {view === "week" ? <div className="overflow-x-auto pb-2"><div className="grid min-w-[1050px] grid-cols-7 gap-2">{days.map(day => <div key={day} className="min-w-0"><div className="mb-2 border-t-4 border-teal-600 bg-white px-3 py-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{displayDate(day, { weekday: "long" })}</p><p className="mt-1 text-lg font-bold">{displayDate(day, { day: "numeric", month: "short" })}</p></div><div className="space-y-2">{meetingGroups(weekRaces.filter(r => r.race_date === day)).map(([key, entries]) => renderMeeting(`${day}|${key}`, entries))}{!weekRaces.some(r => r.race_date === day) && <div className="border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-400">No races</div>}</div></div>)}</div></div> : <div className="space-y-4">{days.map(day => <div key={day} className="border border-slate-200 bg-slate-100 p-3"><h3 className="mb-3 font-bold">{displayDate(day, { weekday: "long", day: "numeric", month: "long" })}</h3><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{meetingGroups(weekRaces.filter(r => r.race_date === day)).map(([key, entries]) => renderMeeting(`${day}|${key}`, entries))}{!weekRaces.some(r => r.race_date === day) && <p className="text-sm text-slate-500">No races matching filters</p>}</div></div>)}</div>}
        </section>
        <p className="text-xs text-slate-500">Next phase: editing and moving races between meetings. This viewer reads only dedicated calendar tables and is not connected to fantasy game data.</p>
      </div>
    </main>
  );
}
