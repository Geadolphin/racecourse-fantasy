"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Course = { id: string; name: string; state: string };
type Meeting = { id: string; meeting_date: string; racecourse_id: string; meeting_name?: string | null };
type Race = { id: string; meeting_id: string; race_name: string; race_grade: string; race_type: string; race_conditions: string; distance_m: number; prizemoney_aud: number; display_order: number };
type Calendar = { meetings: Meeting[]; races: Race[]; increased_funds_aud?: number };
type Version = { id: string; name: string; is_original: boolean };
type EditRace = Race & { destination_date: string; destination_course: string };
type NewRace = Omit<Race, "id" | "display_order">;
const totalPrize = (c: Calendar | null) => (c?.races ?? []).reduce((sum, r) => sum + r.prizemoney_aud, 0);
const KEY = "racecourse-fantasy-spring-2026-personal-calendar-v1";
const GRADES = ["G1", "G2", "G3", "LR"];
const TYPES = ["WFA", "HCP", "SW", "SWP", "QHCP"];
// Display races by official grade, then highest prizemoney, then name.
function compareRaces(a: Race, b: Race): number {
  return (GRADES.indexOf(a.race_grade) - GRADES.indexOf(b.race_grade))
    || (b.prizemoney_aud - a.prizemoney_aud)
    || a.race_name.localeCompare(b.race_name, "en-AU", { sensitivity: "base" })
    || a.id.localeCompare(b.id);
}
const gradeStyle: Record<string, string> = { G1: "bg-amber-100 text-amber-900", G2: "bg-sky-100 text-sky-900", G3: "bg-violet-100 text-violet-900", LR: "bg-slate-100 text-slate-800" };
const date = (s: string) => new Date(`${s}T12:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const add = (s: string, n: number) => iso(new Date(date(s).getTime() + n * 86400000));
const monday = (s: string) => add(s, -((date(s).getUTCDay() + 6) % 7));
const pretty = (s: string, options: Intl.DateTimeFormatOptions) => date(s).toLocaleDateString("en-AU", { ...options, timeZone: "UTC" });
const money = (n: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
const clone = (c: Calendar): Calendar => ({ meetings: c.meetings.map(x => ({ ...x })), races: c.races.map(x => ({ ...x })), increased_funds_aud: c.increased_funds_aud ?? 0 });
const newId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
function csvCell(v: unknown) { const s = String(v ?? ""); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function download(filename: string, content: string, mime: string) { const url = URL.createObjectURL(new Blob([content], { type: mime })); const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }

function isValidCalendar(c: Calendar, base: Calendar, courses: Course[]): boolean {
  if (!c || !Array.isArray(c.meetings) || !Array.isArray(c.races)) return false;
  const meetingIds = new Set<string>();
  const raceIds = new Set<string>();
  const courseIds = new Set(courses.map(course => course.id));
  const originalIds = new Set(base.races.map(r => r.id));
  for (const m of c.meetings) {
    if (!m || typeof m.id !== "string" || meetingIds.has(m.id) || !/^\d{4}-\d{2}-\d{2}$/.test(m.meeting_date) || !courseIds.has(m.racecourse_id)) return false;
    meetingIds.add(m.id);
  }
  for (const r of c.races) {
    if (!r || typeof r.id !== "string" || raceIds.has(r.id) || (!originalIds.has(r.id) && !r.id.startsWith("local-")) || !meetingIds.has(r.meeting_id) || typeof r.race_name !== "string" || !r.race_name.trim() || !GRADES.includes(r.race_grade) || typeof r.race_type !== "string" || typeof r.race_conditions !== "string" || !Number.isInteger(r.distance_m) || r.distance_m <= 0 || !Number.isSafeInteger(r.prizemoney_aud) || r.prizemoney_aud < 0) return false;
    raceIds.add(r.id);
  }
  if (!Number.isSafeInteger(c.increased_funds_aud ?? 0) || (c.increased_funds_aud ?? 0) < 0) return false;
  return totalPrize(c) <= totalPrize(base) + (c.increased_funds_aud ?? 0);
}

export default function RacingCalendarPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [original, setOriginal] = useState<Calendar | null>(null);
  const [working, setWorking] = useState<Calendar | null>(null);
  const [undoHistory, setUndoHistory] = useState<Calendar[]>([]);
  const [mode, setMode] = useState<"personal" | "original">("personal");
  const [draggedRaceId, setDraggedRaceId] = useState<string | null>(null);
  const [dropMeetingId, setDropMeetingId] = useState<string | null>(null);
  const [newMeetingDate, setNewMeetingDate] = useState("2026-11-07");
  const [newMeetingCourse, setNewMeetingCourse] = useState("");
  const [state, setState] = useState("ALL");
  const [grade, setGrade] = useState("ALL");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [edit, setEdit] = useState<EditRace | null>(null);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);
  const [newRace, setNewRace] = useState<NewRace | null>(null);
  const [fundsToAdd, setFundsToAdd] = useState(100000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showIntro, setShowIntro] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true);
      const [vr, cr] = await Promise.all([
        supabase.from("calendar_versions").select("id,name,is_original").eq("period_label", "Spring 2026"),
        supabase.from("calendar_racecourses").select("id,name,state").order("state").order("name"),
      ]);
      if (!live) return;
      if (vr.error || cr.error) { setError(vr.error?.message ?? cr.error?.message ?? "Could not load calendar"); setLoading(false); return; }
      const vs = (vr.data ?? []) as Version[];
      const cs = (cr.data ?? []) as Course[];
      setCourses(cs);
      const source = vs.find(v => v.is_original);
      if (!source) { setError("Original Spring 2026 calendar was not found in Supabase."); setLoading(false); return; }
      const mr = await supabase.from("calendar_meetings").select("id,meeting_date,racecourse_id,meeting_name").eq("version_id", source.id).order("meeting_date");
      if (!live) return;
      if (mr.error) { setError(mr.error.message); setLoading(false); return; }
      const meetings = (mr.data ?? []) as Meeting[];
      if (!meetings.length) { setError("The original calendar contains no meetings."); setLoading(false); return; }
      const rr = await supabase.from("calendar_races").select("id,meeting_id,race_name,race_grade,race_type,race_conditions,distance_m,prizemoney_aud,display_order").in("meeting_id", meetings.map(m => m.id)).order("display_order");
      if (!live) return;
      if (rr.error) { setError(rr.error.message); setLoading(false); return; }
      const base: Calendar = { meetings, races: ((rr.data ?? []) as (Race & { race_type: string | null; race_conditions: string | null })[]).map(r => ({ ...r, race_type: r.race_type ?? "", race_conditions: r.race_conditions ?? "" })) };
      setOriginal(base);
      try {
        const saved = localStorage.getItem(KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Calendar;
          if (!Array.isArray(parsed.meetings) || !Array.isArray(parsed.races) || !isValidCalendar(parsed, base, cs)) throw Error("Saved data is incompatible");
          setWorking(parsed);
        } else setWorking(clone(base));
      } catch { setWorking(clone(base)); setNotice("Saved browser data could not be loaded. The original calendar was restored in memory."); }
      setNewMeetingDate(meetings.map(m => m.meeting_date).sort()[0]);
      setNewMeetingCourse(cs[0]?.id ?? "");
      setReady(true); setLoading(false);
    }
    void load();
    return () => { live = false; };
  }, []);

  useEffect(() => { if (ready && working) { try { localStorage.setItem(KEY, JSON.stringify(working)); } catch { setNotice("Browser storage is unavailable. Export your calendar to keep your changes."); } } }, [working, ready]);

  const active = mode === "original" ? original : working;
  const courseById = useMemo(() => new Map(courses.map(c => [c.id, c])), [courses]);
  const meetingById = useMemo(() => new Map((active?.meetings ?? []).map(m => [m.id, m])), [active]);
  const shown = useMemo(() => (active?.races ?? []).filter(r => {
    const m = meetingById.get(r.meeting_id), c = m && courseById.get(m.racecourse_id);
    return !!m && !!c && (state === "ALL" || c.state === state) && (grade === "ALL" || r.race_grade === grade) && (!search.trim() || [r.race_name, c.name, r.race_type, r.race_conditions].some(x => x.toLowerCase().includes(search.toLowerCase().trim())));
  }), [active, meetingById, courseById, state, grade, search]);
  const sortedMeetings = useMemo(() => (active?.meetings ?? [])
    .filter(m => {
      const course = courseById.get(m.racecourse_id);
      const isEmpty = !(active?.races ?? []).some(r => r.meeting_id === m.id);
      // Keep ALL empty meetings visible, including emptied original meetings.
      // Respect the state filter; hide empties when searching or filtering by grade.
      return shown.some(r => r.meeting_id === m.id) ||
        (mode === "personal" && isEmpty && !!course &&
         (state === "ALL" || course.state === state) && grade === "ALL" && !search.trim());
    })
    .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date) || (courseById.get(a.racecourse_id)?.name ?? "").localeCompare(courseById.get(b.racecourse_id)?.name ?? "")),
    [active, shown, courseById, mode, state, grade, search]);
  const matchingCount = shown.length;
  const originalPrizeLimit = totalPrize(original);
  const increasedFunds = working?.increased_funds_aud ?? 0;
  const prizeLimit = originalPrizeLimit + increasedFunds;
  const prizeSpent = totalPrize(working);
  const prizeRemaining = prizeLimit - prizeSpent;
  const prizePercent = prizeLimit > 0 ? Math.min(100, Math.max(0, (prizeSpent / prizeLimit) * 100)) : 0;

  function commitCalendar(next: Calendar) {
    if (!working) return;
    setUndoHistory(previous => [...previous.slice(-29), clone(working)]);
    setWorking(next);
  }

  function addFunds() {
    if (mode !== "personal" || !working || !Number.isSafeInteger(fundsToAdd) || fundsToAdd <= 0 || !Number.isSafeInteger(increasedFunds + fundsToAdd)) {
      setNotice("Enter a positive whole-dollar amount to add to the prizemoney pool.");
      return;
    }
    commitCalendar({ ...working, increased_funds_aud: increasedFunds + fundsToAdd });
    setNotice(`${money(fundsToAdd)} added to the pool as increased funds. Use Undo to reverse it.`);
  }

  function undo() {
    if (mode !== "personal" || !undoHistory.length) return;
    const previous = undoHistory[undoHistory.length - 1];
    setUndoHistory(history => history.slice(0, -1));
    setWorking(clone(previous));
    setEdit(null);
    setEditMeeting(null);
    setNewRace(null);
    setNotice("Last calendar change undone.");
  }

  function moveRaceToMeeting(raceId: string, targetMeetingId: string) {
    if (mode !== "personal" || !working) return;
    const race = working.races.find(r => r.id === raceId);
    const target = working.meetings.find(m => m.id === targetMeetingId);
    if (!race || !target || race.meeting_id === target.id) return;
    const nextRaces = working.races.map(r => r.id === raceId ? { ...r, meeting_id: target.id, display_order: Math.max(0, ...working.races.filter(x => x.meeting_id === target.id).map(x => x.display_order)) + 1 } : r);
    // Retain the source meeting even when its final race moves away.
    commitCalendar({ meetings: working.meetings, races: nextRaces });
    setNotice(`${race.race_name} moved to ${courseById.get(target.racecourse_id)?.name ?? "meeting"} on ${pretty(target.meeting_date, { day: "numeric", month: "short", year: "numeric" })}.`);
  }

  function createMeeting() {
    if (mode !== "personal" || !working) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newMeetingDate) || !courses.some(c => c.id === newMeetingCourse)) { setNotice("Choose a valid date and racecourse."); return; }
    if (working.meetings.some(m => m.meeting_date === newMeetingDate && m.racecourse_id === newMeetingCourse)) { setNotice("A meeting already exists at that racecourse on that date."); return; }
    commitCalendar({ ...working, meetings: [...working.meetings, { id: newId(), meeting_date: newMeetingDate, racecourse_id: newMeetingCourse }] });
    setState("ALL"); setGrade("ALL"); setSearch("");
    setNotice("Empty meeting created. Drag races onto it to fill it.");
  }

  function deleteMeeting(meetingId: string) {
    if (mode !== "personal" || !working) return;
    const meeting = working.meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    const removed = working.races.filter(r => r.meeting_id === meetingId).length;
    commitCalendar({ meetings: working.meetings.filter(m => m.id !== meetingId), races: working.races.filter(r => r.meeting_id !== meetingId) });
    setNotice(`Meeting deleted${removed ? ` along with ${removed} race${removed === 1 ? "" : "s"}` : ""}. Use Undo to restore it.`);
  }

  function beginNewRace() {
    if (mode !== "personal" || !working || !working.meetings.length) { setNotice("Create a meeting before adding a race."); return; }
    setNewRace({ meeting_id: working.meetings[0].id, race_name: "", race_grade: "G1", race_type: "WFA", race_conditions: "", distance_m: 1200, prizemoney_aud: 0 });
    setNotice("");
  }
  function saveNewRace() {
    if (!newRace || !working) return;
    if (!newRace.race_name.trim() || !GRADES.includes(newRace.race_grade) || !working.meetings.some(m => m.id === newRace.meeting_id) || !Number.isInteger(newRace.distance_m) || newRace.distance_m <= 0 || !Number.isSafeInteger(newRace.prizemoney_aud) || newRace.prizemoney_aud < 0) { setNotice("Enter a race name, valid meeting, grade, distance and prizemoney."); return; }
    if (prizeSpent + newRace.prizemoney_aud > prizeLimit) { setNotice(`Not enough prizemoney in the pool. Available: ${money(prizeRemaining)}.`); return; }
    const next: Race = { ...newRace, id: newId(), race_name: newRace.race_name.trim(), display_order: Math.max(0, ...working.races.filter(r => r.meeting_id === newRace.meeting_id).map(r => r.display_order)) + 1 };
    commitCalendar({ ...working, races: [...working.races, next] });
    setNewRace(null); setState("ALL"); setGrade("ALL"); setSearch("");
    setNotice("New race created. Drag it between meetings or edit its details.");
  }

  function beginRace(r: Race) { if (mode !== "personal") return; const m = meetingById.get(r.meeting_id); if (!m) return; setEdit({ ...r, destination_date: m.meeting_date, destination_course: m.racecourse_id }); setNotice(""); }
  function saveRace() {
    if (!edit || !working) return;
    if (!edit.race_name.trim() || !GRADES.includes(edit.race_grade) || !Number.isInteger(edit.distance_m) || edit.distance_m <= 0 || !Number.isSafeInteger(edit.prizemoney_aud) || edit.prizemoney_aud < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(edit.destination_date) || !courses.some(c => c.id === edit.destination_course)) { setNotice("Please enter a valid name, grade, distance, prizemoney, date and racecourse."); return; }
    const existing = working.races.find(r => r.id === edit.id);
    if (!existing) return;
    if (prizeSpent - existing.prizemoney_aud + edit.prizemoney_aud > prizeLimit) { setNotice(`Not enough prizemoney in the pool. Maximum for this race: ${money(Math.max(0, prizeRemaining + existing.prizemoney_aud))}.`); return; }
    let meetings = working.meetings.map(m => ({ ...m }));
    let target = meetings.find(m => m.meeting_date === edit.destination_date && m.racecourse_id === edit.destination_course);
    if (!target) { target = { id: newId(), meeting_date: edit.destination_date, racecourse_id: edit.destination_course }; meetings.push(target); }
    const race: Race = { id: edit.id, meeting_id: edit.meeting_id, race_name: edit.race_name, race_grade: edit.race_grade, race_type: edit.race_type, race_conditions: edit.race_conditions, distance_m: edit.distance_m, prizemoney_aud: edit.prizemoney_aud, display_order: edit.display_order };
    const races = working.races.map(r => r.id === race.id ? { ...race, meeting_id: target!.id } : r);
    // Preserve empty source meetings for later drag-and-drop.
    commitCalendar({ meetings, races }); setEdit(null); setNotice("Race saved in this browser.");
  }
  function saveMeeting() {
    if (!editMeeting || !working) return;
    const current = working.meetings.find(m => m.id === editMeeting.id);
    if (!current || !courses.some(c => c.id === editMeeting.racecourse_id)) return;
    const conflict = working.meetings.find(m => m.id !== current.id && m.meeting_date === editMeeting.meeting_date && m.racecourse_id === editMeeting.racecourse_id);
    if (conflict) { setNotice("A meeting already exists at that track on that date. Move individual races to combine meetings."); return; }
    commitCalendar({ ...working, meetings: working.meetings.map(m => m.id === current.id ? { ...m, racecourse_id: editMeeting.racecourse_id } : m) });
    setEditMeeting(null); setNotice("Meeting racecourse updated in this browser.");
  }
  function reset() { if (!original || !working) return; commitCalendar(clone(original)); setEdit(null); setEditMeeting(null); setNewRace(null); setNotice("Personal calendar reset to original."); }
  function exportCSV() {
    if (!working) return;
    const header = ["race_date", "state", "racecourse", "race_name", "race_grade", "race_type", "race_conditions", "distance_m", "prizemoney_aud"];
    const lines = working.races.map(r => { const m = working.meetings.find(x => x.id === r.meeting_id); const c = courses.find(x => x.id === m?.racecourse_id); return [m?.meeting_date, c?.state, c?.name, r.race_name, r.race_grade, r.race_type, r.race_conditions, r.distance_m, r.prizemoney_aud].map(csvCell).join(","); });
    download("spring-2026-personal-racing-calendar.csv", [header.join(","), ...lines].join("\r\n"), "text/csv;charset=utf-8");
  }
  function shareImage() {
    if (!active) return;
    const courseLookup = new Map(courses.map(c => [c.id, c]));
    const stateOrder: Record<string, number> = { VIC: 0, NSW: 1, QLD: 2, SA: 3, WA: 4 };
    const stateColours: Record<string, { background: string; foreground: string }> = {
      VIC: { background: "#0F172A", foreground: "#FFFFFF" },
      NSW: { background: "#7DD3FC", foreground: "#0F172A" },
      QLD: { background: "#800020", foreground: "#FFFFFF" },
      SA: { background: "#DC2626", foreground: "#FFFFFF" },
      WA: { background: "#FACC15", foreground: "#171717" },
    };
    const groups = active.meetings
      .map(meeting => ({ meeting, course: courseLookup.get(meeting.racecourse_id), races: active.races.filter(r => r.meeting_id === meeting.id).sort(compareRaces) }))
      .filter(group => group.course && group.races.length > 0)
      .sort((a, b) => a.meeting.meeting_date.localeCompare(b.meeting.meeting_date)
        || (stateOrder[a.course?.state ?? ""] ?? 99) - (stateOrder[b.course?.state ?? ""] ?? 99)
        || (a.course?.name ?? "").localeCompare(b.course?.name ?? ""));
    if (!groups.length) { setNotice("There are no races to include in the image."); return; }

    const columns = 5;
    const colWidth = 485;
    const gap = 12;
    const margin = 24;
    const top = 90;
    const headerHeight = 28;
    const headerLineHeight = 19;
    const rowHeight = 25;
    const meetingGap = 5;
    const dateGap = 14;
    const blocks = [...new Set(groups.map(g => g.meeting.meeting_date))].map(dateValue => {
      const meetings = groups.filter(g => g.meeting.meeting_date === dateValue);
      const courseNames = [...new Set(meetings.map(g => g.course?.name ?? "Unknown track"))];
      const headerText = `${pretty(dateValue, { weekday: "short", day: "numeric", month: "short", year: "numeric" }).toUpperCase()} - ${courseNames.join(", ")}`;
      // Keep the full list of racecourses beside the date, wrapping long headings if necessary.
      const headerLines: string[] = [];
      let line = "";
      const measure = document.createElement("canvas").getContext("2d");
      if (measure) measure.font = "bold 13px Arial, sans-serif";
      for (const word of headerText.split(" ")) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && (measure?.measureText(candidate).width ?? 0) > colWidth - 18) {
          headerLines.push(line);
          line = word;
        } else line = candidate;
      }
      if (line) headerLines.push(line);
      const dateHeaderHeight = Math.max(headerHeight, headerLines.length * headerLineHeight + 10);
      const height = dateHeaderHeight + 4 + meetings.reduce((sum, g) => sum + g.races.length * rowHeight + meetingGap, 0) + dateGap;
      return { dateValue, meetings, headerLines, dateHeaderHeight, height };
    });
    const target = blocks.reduce((sum, block) => sum + block.height, 0) / columns;
    const columnsData: typeof blocks[] = Array.from({ length: columns }, () => []);
    let column = 0;
    let used = 0;
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (column < columns - 1 && used > 0 && (used + block.height > target * 1.13 || blocks.length - i <= columns - column - 1)) {
        column++;
        used = 0;
      }
      columnsData[column].push(block);
      used += block.height;
    }
    const contentHeight = Math.max(...columnsData.map(col => col.reduce((sum, block) => sum + block.height, 0)));
    const width = margin * 2 + columns * colWidth + (columns - 1) * gap;
    const height = top + contentHeight + 24;
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setNotice("Image export is not supported by this browser."); return; }
    ctx.scale(scale, scale);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#0F172A";
    ctx.fillRect(0, 0, width, 78);
    ctx.fillStyle = "#5EEAD4";
    ctx.font = "bold 27px Arial, sans-serif";
    ctx.fillText("RACECOURSE FANTASY  /  RACING CALENDAR", margin, 36);
    ctx.fillStyle = "#CBD5E1";
    ctx.font = "13px Arial, sans-serif";
    ctx.fillText(`Spring 2026    ${groups.reduce((sum, g) => sum + g.races.length, 0)} races    ${groups.length} meetings`, margin, 60);
    ctx.textBaseline = "middle";

    function shortPrize(value: number): string {
      const formatted = (amount: number) => Number(amount.toFixed(2)).toString();
      if (value >= 1000000) return `$${formatted(value / 1000000)}mil`;
      if (value >= 1000) return `$${formatted(value / 1000)}k`;
      return `$${value.toLocaleString("en-AU")}`;
    }
    // Fixed positions keep every race detail aligned vertically, like a table.
    // Name has the flexible space; numeric details use dedicated right-aligned columns.
    const racePadding = 9;
    const distanceWidth = 65;
    const gradeWidth = 42;
    const prizeWidth = 80;
    const raceNameWidth = colWidth - racePadding * 2 - distanceWidth - gradeWidth - prizeWidth;
    function drawFittedText(
      context: CanvasRenderingContext2D,
      value: string,
      x: number,
      maxWidth: number,
      align: CanvasTextAlign = "left",
    ): void {
      context.save();
      context.textAlign = align;
      context.font = "600 13px Arial, sans-serif";
      let text = value;
      while (text.length > 1 && context.measureText(text).width > maxWidth) {
        text = `${text.slice(0, -2)}…`;
      }
      context.fillText(text, x, 0);
      context.restore();
    }

    for (let c = 0; c < columns; c++) {
      const x = margin + c * (colWidth + gap);
      let y = top;
      for (const block of columnsData[c]) {
        ctx.fillStyle = "#0F766E";
        ctx.fillRect(x, y, colWidth, block.dateHeaderHeight);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 13px Arial, sans-serif";
        ctx.textAlign = "center";
        const firstLineY = y + (block.dateHeaderHeight - block.headerLines.length * headerLineHeight) / 2 + headerLineHeight / 2;
        block.headerLines.forEach((line, index) => ctx.fillText(line, x + colWidth / 2, firstLineY + index * headerLineHeight));
        ctx.textAlign = "left";
        y += block.dateHeaderHeight + 4;
        for (const group of block.meetings) {
          const colours = stateColours[group.course?.state ?? ""] ?? { background: "#E2E8F0", foreground: "#0F172A" };
          for (const race of group.races) {
            ctx.fillStyle = colours.background;
            ctx.fillRect(x, y, colWidth, rowHeight - 1);
            ctx.fillStyle = colours.foreground;
            ctx.save();
            ctx.translate(x, y + rowHeight / 2);
            drawFittedText(ctx, race.race_name, racePadding, raceNameWidth - 10);
            const distanceRight = colWidth - racePadding - gradeWidth - prizeWidth;
            const gradeRight = colWidth - racePadding - prizeWidth;
            const prizeRight = colWidth - racePadding;
            drawFittedText(ctx, `${race.distance_m}m`, distanceRight, distanceWidth - 8, "right");
            drawFittedText(ctx, race.race_grade, gradeRight, gradeWidth - 8, "right");
            drawFittedText(ctx, shortPrize(race.prizemoney_aud), prizeRight, prizeWidth - 8, "right");
            ctx.restore();
            y += rowHeight;
          }
          y += meetingGap;
        }
        y += dateGap;
      }
    }
    canvas.toBlob(blob => {
      if (!blob) { setNotice("Could not generate the PNG image."); return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "spring-2026-racecourse-fantasy-calendar.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }

  function exportJSON() { if (working) download("spring-2026-personal-racing-calendar.json", JSON.stringify({ format: "racing-calendar-local-v1", calendar: working }, null, 2), "application/json"); }
  async function importJSON(file: File | undefined) {
    if (!file || !original) return;
    try {
      const obj = JSON.parse(await file.text()); const c = obj?.calendar as Calendar;
      if (obj?.format !== "racing-calendar-local-v1" || !Array.isArray(c?.meetings) || !Array.isArray(c?.races) || !isValidCalendar(c, original, courses)) throw Error("Invalid or incompatible calendar backup");
      commitCalendar(c); setMode("personal"); setNotice("Calendar backup imported.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not import backup"); }
  }
  function meetingCard(m: Meeting) {
    const c = courseById.get(m.racecourse_id);
    const entries = shown.filter(r => r.meeting_id === m.id).sort(compareRaces);
    const open = expanded[m.id] ?? true;
    const isDropTarget = mode === "personal" && dropMeetingId === m.id;
    return <article key={m.id}
      onDragOver={e => { if (mode !== "personal") return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropMeetingId(m.id); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropMeetingId(current => current === m.id ? null : current); }}
      onDrop={e => { e.preventDefault(); const raceId = e.dataTransfer.getData("text/plain") || draggedRaceId; if (raceId) moveRaceToMeeting(raceId, m.id); setDropMeetingId(null); setDraggedRaceId(null); }}
      className={`min-w-0 overflow-hidden rounded-md border bg-white shadow-sm transition-all duration-150 ${isDropTarget ? "border-teal-600 bg-teal-50 ring-2 ring-teal-400" : "border-slate-200 hover:border-slate-300 hover:shadow-md"}`}>
      <div className="border-b border-slate-200 bg-slate-50/90 px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={() => setExpanded(p => ({ ...p, [m.id]: !open }))} aria-expanded={open} className="min-w-0 flex-1 text-left" title={open ? "Collapse meeting" : "Expand meeting"}>
            <span className="block text-[10px] font-bold uppercase tracking-wide text-teal-700">{pretty(m.meeting_date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
            <span className="mt-0.5 block truncate text-[15px] font-bold leading-5 text-slate-900" title={c?.name ?? "Unknown track"}>{c?.name ?? "Unknown track"}</span>
            <span className="mt-0.5 block text-[11px] text-slate-500">{c?.state ?? "—"} <span className="mx-1 text-slate-300">·</span> {entries.length} {entries.length === 1 ? "race" : "races"} <span className="mx-1 text-slate-300">·</span> {open ? "Hide −" : "Show +"}</span>
          </button>
          {mode === "personal" && <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => { setEditMeeting({ ...m }); setNotice(""); }} title="Change racecourse" aria-label={`Change racecourse for ${c?.name ?? "meeting"}`} className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-teal-300 hover:text-teal-800">Track</button>
            <button type="button" onClick={() => deleteMeeting(m.id)} title="Delete meeting and its races; Undo restores them" aria-label={`Delete ${c?.name ?? "meeting"} meeting`} className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-red-600 hover:border-red-300 hover:bg-red-50">Delete</button>
          </div>}
        </div>
      </div>
      {open && <div className="divide-y divide-slate-100">
        {entries.map(r => <div key={r.id} draggable={mode === "personal"}
          onDragStart={e => { e.dataTransfer.setData("text/plain", r.id); e.dataTransfer.effectAllowed = "move"; setDraggedRaceId(r.id); }}
          onDragEnd={() => { setDraggedRaceId(null); setDropMeetingId(null); }}
          className={`group px-3 py-2 transition-colors ${mode === "personal" ? "cursor-grab active:cursor-grabbing hover:bg-teal-50/60" : ""} ${draggedRaceId === r.id ? "opacity-40" : ""}`}>
          <div className="flex items-start gap-2">
            {mode === "personal" && <span aria-hidden="true" className="mt-0.5 select-none text-sm leading-4 text-slate-300 group-hover:text-teal-600">⠿</span>}
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-extrabold leading-4 ${gradeStyle[r.race_grade] ?? "bg-slate-100 text-slate-700"}`}>{r.race_grade}</span>
                <p className="min-w-0 flex-1 text-[14px] font-semibold leading-5 text-slate-900">{r.race_name}</p>
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-2 text-[11px] text-slate-500">
                <span className="shrink-0">{r.distance_m}m</span>
                <span className="shrink-0">{r.race_type || "—"}</span>
                <span className="shrink-0 font-bold tabular-nums text-teal-800">{money(r.prizemoney_aud)}</span>
                {r.race_conditions && <span className="min-w-0 flex-1 truncate" title={r.race_conditions}>{r.race_conditions}</span>}
                {mode === "personal" && <button type="button" onClick={() => beginRace(r)} className="ml-auto shrink-0 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:border-teal-400 hover:text-teal-800">Edit</button>}
              </div>
            </div>
          </div>
        </div>)}
        {entries.length === 0 && <div className={`m-2 rounded border border-dashed px-3 py-5 text-center text-xs ${isDropTarget ? "border-teal-500 bg-teal-100 font-semibold text-teal-900" : "border-slate-300 bg-slate-50 text-slate-500"}`}>{isDropTarget ? "Release to move race here" : "Empty meeting · Drop races here"}</div>}
      </div>}
      {!open && <div className="px-3 py-2 text-[11px] text-slate-500">{mode === "personal" ? "Drop races here, or expand to view" : "Expand to view races"}</div>}
      {isDropTarget && entries.length > 0 && <div className="border-t border-teal-200 bg-teal-100 px-3 py-2 text-center text-[11px] font-bold text-teal-900">Release to move race to this meeting</div>}
    </article>;
  }

  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-800 bg-slate-950 text-white"><div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-300">Racecourse Fantasy / Independent tools</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">Australian Racing Calendar Editor</h1><p className="mt-1 text-sm text-slate-300">Spring 2026 · Meeting board · Australian states</p></div><Link href="/" className="border border-slate-600 px-4 py-2 text-sm font-semibold hover:border-teal-300">Back to website →</Link></div></div></header>
    <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      {showIntro && <div className="flex items-start gap-3 border-l-4 border-teal-600 bg-teal-50 px-3 py-2.5 text-xs leading-5 text-teal-900"><p className="min-w-0 flex-1">Drag races between meetings to reschedule them. Changes save in this browser only; use Undo to reverse a change. On touch devices, use Edit details to move a race.</p><button type="button" onClick={() => setShowIntro(false)} aria-label="Dismiss calendar information" title="Dismiss message" className="shrink-0 rounded px-2 py-0.5 text-lg font-semibold leading-5 text-teal-900 hover:bg-teal-100">×</button></div>}
      {error && <div role="alert" className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {notice && <div role="status" className="border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm">{notice}</div>}
      <section className="border border-slate-200 bg-white px-3 py-2.5" aria-label="Calendar controls and filters">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-[11px] font-semibold">Calendar<select value={mode} onChange={e => setMode(e.target.value as "personal" | "original")} className="h-9 border border-slate-300 px-2 text-xs"><option value="personal">My editable calendar</option><option value="original">Original (read-only)</option></select></label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold">State<select value={state} onChange={e => setState(e.target.value)} className="h-9 border border-slate-300 px-2 text-xs"><option value="ALL">All states</option><option value="VIC">Victoria</option><option value="NSW">New South Wales</option><option value="QLD">Queensland</option><option value="SA">South Australia</option><option value="WA">Western Australia</option></select></label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold">Grade<select value={grade} onChange={e => setGrade(e.target.value)} className="h-9 border border-slate-300 px-2 text-xs"><option value="ALL">All grades</option>{GRADES.map(g => <option key={g}>{g}</option>)}</select></label>
          <label className="flex min-w-[150px] flex-1 flex-col gap-1 text-[11px] font-semibold">Search<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Race, track, conditions..." className="h-9 w-full border border-slate-300 px-2 text-xs" /></label>
          <button type="button" onClick={() => { setState("ALL"); setGrade("ALL"); setSearch(""); }} className="h-9 border border-slate-300 px-2 text-xs font-semibold">Clear</button>
          <span className="pb-2 text-[11px] text-slate-500">{loading ? "Loading…" : `${active?.races.length ?? 0} races · ${active?.meetings.length ?? 0} meetings`}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
          <button type="button" onClick={undo} disabled={mode !== "personal" || undoHistory.length === 0} title="Undo the last calendar change" className="border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40">↶ Undo{undoHistory.length ? ` (${undoHistory.length})` : ""}</button>
          <button type="button" onClick={exportCSV} disabled={!working} className="bg-teal-700 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Export CSV</button>
          <button type="button" onClick={shareImage} disabled={!active} className="bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Share image (PNG)</button>
          <button type="button" onClick={exportJSON} disabled={!working} className="border border-slate-300 px-2.5 py-1.5 text-xs font-semibold">Backup JSON</button>
          <label className="cursor-pointer border border-slate-300 px-2.5 py-1.5 text-xs font-semibold">Import backup<input type="file" accept=".json,application/json" className="hidden" onChange={e => { void importJSON(e.target.files?.[0]); e.target.value = ""; }} /></label>
          <button type="button" onClick={reset} disabled={!original} className="border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700">Reset my calendar</button>
        </div>
      </section>
      <div className="grid items-start gap-3 lg:grid-cols-2">
        {mode === "personal" && <section className="border border-slate-200 bg-white p-3" aria-label="Create races and meetings">
          <h2 className="mb-2 text-sm font-bold">Create race / meeting</h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-[11px] font-semibold">Meeting date<input type="date" value={newMeetingDate} onChange={e => setNewMeetingDate(e.target.value)} className="h-9 border border-slate-300 px-2 text-xs" /></label>
            <label className="flex min-w-[150px] flex-1 flex-col gap-1 text-[11px] font-semibold">Racecourse<select value={newMeetingCourse} onChange={e => setNewMeetingCourse(e.target.value)} className="h-9 w-full border border-slate-300 px-2 text-xs"><option value="">Choose a racecourse</option>{courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.state})</option>)}</select></label>
            <button type="button" onClick={createMeeting} className="h-9 bg-slate-900 px-3 text-xs font-semibold text-white">+ Add meeting</button>
            <button type="button" onClick={beginNewRace} className="h-9 bg-teal-700 px-3 text-xs font-semibold text-white">+ Add race</button>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Create a meeting as a new drag-and-drop destination, or add a race to any meeting.</p>
        </section>}
        <section className="border border-slate-200 bg-white p-3" aria-label="Prizemoney pool">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-bold">Prizemoney pool</h2><span className={`text-sm font-bold ${prizeRemaining < 0 ? "text-red-700" : "text-teal-800"}`}>{money(prizeRemaining)} remaining</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full transition-all ${prizeRemaining < 0 ? "bg-red-600" : "bg-teal-600"}`} style={{ width: `${prizePercent}%` }} /></div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-600"><span>Original: {money(originalPrizeLimit)}</span><span>Increased funds: <strong className="text-teal-800">+{money(increasedFunds)}</strong></span><span>Allocated: {money(prizeSpent)}</span><span className="font-semibold">Total pool: {money(prizeLimit)}</span></div>
          {mode === "personal" && <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-2"><label className="flex flex-col gap-1 text-[11px] font-semibold">Add funds (AUD)<input type="number" min="1" step="1" value={fundsToAdd} onChange={e => setFundsToAdd(Number(e.target.value))} className="h-9 w-36 border border-slate-300 px-2 text-xs" /></label><button type="button" onClick={addFunds} className="h-9 bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800">+ Add funds</button></div>}
        </section>
      </div>
      <section><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold tracking-tight">Spring 2026 race meetings</h2><p className="text-xs text-slate-500">{sortedMeetings.length} matching meetings · {matchingCount} matching races · ordered by date</p></div><p className="text-xs text-slate-500">Drag a race card to any meeting, even on another date</p></div>
        {sortedMeetings.length === 0 ? <div className="border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No meetings match your filters. Clear the filters to see all meetings.</div> :
        <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{sortedMeetings.map(meetingCard)}</div>}
      </section>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        More races from other states and the Autumn racing calendar are coming in the future.
      </footer>
    </div>
    {newRace && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-label="Create race"><div className="w-full max-w-xl space-y-4 bg-white p-5 shadow-2xl sm:p-7"><div><h2 className="text-xl font-bold">Create a new race</h2><p className="text-xs text-slate-500">Available prizemoney: {money(prizeRemaining)}. New races are saved in your browser only.</p></div><div className="grid gap-3 sm:grid-cols-2">
      <label className="sm:col-span-2 text-xs font-semibold">Race name<input value={newRace.race_name} onChange={e => setNewRace({ ...newRace, race_name: e.target.value })} className="mt-1 w-full border border-slate-300 p-2 text-sm" /></label>
      <label className="sm:col-span-2 text-xs font-semibold">Meeting<select value={newRace.meeting_id} onChange={e => setNewRace({ ...newRace, meeting_id: e.target.value })} className="mt-1 w-full border border-slate-300 p-2 text-sm">{[...(working?.meetings ?? [])].sort((a,b) => a.meeting_date.localeCompare(b.meeting_date)).map(m => <option key={m.id} value={m.id}>{pretty(m.meeting_date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · {courseById.get(m.racecourse_id)?.name ?? "Unknown track"}</option>)}</select></label>
      <label className="text-xs font-semibold">Grade<select value={newRace.race_grade} onChange={e => setNewRace({ ...newRace, race_grade: e.target.value })} className="mt-1 w-full border border-slate-300 p-2 text-sm">{GRADES.map(g => <option key={g} value={g}>{g}</option>)}</select></label>
      <label className="text-xs font-semibold">Race type<select value={TYPES.includes(newRace.race_type) ? newRace.race_type : ""} onChange={e => setNewRace({ ...newRace, race_type: e.target.value })} className="mt-1 w-full border border-slate-300 p-2 text-sm"><option value="" disabled>Select race type</option>{TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
      <label className="sm:col-span-2 text-xs font-semibold">Race conditions<input value={newRace.race_conditions} onChange={e => setNewRace({ ...newRace, race_conditions: e.target.value })} className="mt-1 w-full border border-slate-300 p-2 text-sm" /></label>
      <label className="text-xs font-semibold">Distance (m)<input type="number" min="1" step="1" value={newRace.distance_m} onChange={e => setNewRace({ ...newRace, distance_m: Number(e.target.value) })} className="mt-1 w-full border border-slate-300 p-2 text-sm" /></label>
      <label className="text-xs font-semibold">Prizemoney (AUD)<input type="number" min="0" max={Math.max(0, prizeRemaining)} step="1" value={newRace.prizemoney_aud} onChange={e => setNewRace({ ...newRace, prizemoney_aud: Number(e.target.value) })} className="mt-1 w-full border border-slate-300 p-2 text-sm" /></label>
      </div><div className="flex justify-end gap-2"><button type="button" onClick={() => setNewRace(null)} className="border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel</button><button type="button" onClick={saveNewRace} className="bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Add race</button></div></div></div>}
    {edit && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-label="Edit race"><div className="w-full max-w-xl space-y-4 bg-white p-5 shadow-2xl sm:p-7"><div><h2 className="text-xl font-bold">Edit or move race</h2><p className="text-xs text-slate-500">Changes are saved in your browser only</p></div><div className="grid gap-3 sm:grid-cols-2">
      <label className="sm:col-span-2 text-xs font-semibold">Race name<input value={edit.race_name} onChange={e => setEdit({ ...edit, race_name: e.target.value })} className="mt-1 w-full border border-slate-300 p-2 text-sm" /></label>
      <label className="text-xs font-semibold">Grade<select value={edit.race_grade} onChange={e => setEdit({ ...edit, race_grade: e.target.value })} className="mt-1 w-full border border-slate-300 p-2 text-sm">{GRADES.map(g => <option key={g}>{g}</option>)}</select></label>
      <label className="text-xs font-semibold">Race type<select value={TYPES.includes(edit.race_type) ? edit.race_type : ""} onChange={e => setEdit({ ...edit, race_type: e.target.value })} className="mt-1 w-full border border-slate-300 p-2 text-sm"><option value="" disabled>Select race type</option>{TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
      <label className="sm:col-span-2 text-xs font-semibold">Race conditions<input value={edit.race_conditions} onChange={e => setEdit({ ...edit, race_conditions: e.target.value })} placeholder="e.g. 3YO+ F&M" className="mt-1 w-full border border-slate-300 p-2 text-sm" /></label>
      <label className="text-xs font-semibold">Distance (m)<input type="number" min="1" step="1" value={edit.distance_m} onChange={e => setEdit({ ...edit, distance_m: Number(e.target.value) })} className="mt-1 w-full border border-slate-300 p-2 text-sm" /></label>
      <label className="text-xs font-semibold">Prizemoney (AUD) · max {money(Math.max(0, prizeRemaining + (working?.races.find(r => r.id === edit.id)?.prizemoney_aud ?? 0)))}<input type="number" min="0" max={Math.max(0, prizeRemaining + (working?.races.find(r => r.id === edit.id)?.prizemoney_aud ?? 0))} step="1" value={edit.prizemoney_aud} onChange={e => setEdit({ ...edit, prizemoney_aud: Number(e.target.value) })} className="mt-1 w-full border border-slate-300 p-2 text-sm" /></label>
      <label className="text-xs font-semibold">Move to date<input type="date" value={edit.destination_date} onChange={e => setEdit({ ...edit, destination_date: e.target.value })} className="mt-1 w-full border border-slate-300 p-2 text-sm" /></label>
      <label className="text-xs font-semibold">Destination meeting / track<select value={edit.destination_course} onChange={e => setEdit({ ...edit, destination_course: e.target.value })} className="mt-1 w-full border border-slate-300 p-2 text-sm">{courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.state})</option>)}</select></label>
    </div><p className="text-xs text-slate-500">If no meeting exists at that track on the chosen date, one will be created automatically.</p><div className="flex justify-end gap-2"><button onClick={() => setEdit(null)} className="border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel</button><button onClick={saveRace} className="bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Save changes</button></div></div></div>}
    {editMeeting && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-label="Change meeting track"><div className="w-full max-w-md space-y-4 bg-white p-6"><h2 className="text-xl font-bold">Change meeting track</h2><p className="text-sm text-slate-600">{pretty(editMeeting.meeting_date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}. All races in this meeting will move together.</p><label className="block text-xs font-semibold">Racecourse<select value={editMeeting.racecourse_id} onChange={e => setEditMeeting({ ...editMeeting, racecourse_id: e.target.value })} className="mt-1 w-full border border-slate-300 p-2 text-sm">{courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.state})</option>)}</select></label><div className="flex justify-end gap-2"><button onClick={() => setEditMeeting(null)} className="border border-slate-300 px-4 py-2 text-sm">Cancel</button><button onClick={saveMeeting} className="bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Save track</button></div></div></div>}
  </main>;
}
