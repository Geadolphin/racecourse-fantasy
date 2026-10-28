import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

import * as cheerio from "cheerio";



export const runtime = "nodejs";

export const maxDuration = 60;



const PRICE_LEVELS: [number, number][] = [

  [30000000,800000],[25000000,750000],[20000000,700000],[18000000,680000],

  [16000000,660000],[14000000,640000],[12000000,620000],[10000000,600000],

  [9000000,590000],[8000000,580000],[7000000,570000],[6000000,560000],

  [5000000,550000],[4500000,540000],[4000000,530000],[3500000,520000],

  [3000000,510000],[2500000,500000],[2000000,480000],[1500000,450000],

  [1000000,420000],[950000,400000],[900000,380000],[850000,360000],

  [800000,340000],[750000,320000],[700000,300000],[650000,270000],

  [600000,240000],[550000,220000],[500000,210000],[450000,200000],

  [400000,190000],[375000,180000],[350000,170000],[325000,160000],

  [300000,150000],[275000,140000],[250000,130000],[225000,120000],

  [200000,110000],[175000,100000],[150000,90000],[125000,80000],

  [100000,70000],[75000,60000],[50000,50000],[25000,40000],[0,30000],

];



type Runner = { name: string; profileUrl: string | null; silkUrl: string | null; raceNumber: number; prizeMoney: number | null; saddleclothNumber: number | null; barrier: number | null; scratched: boolean };

type SiteRace = { number: number; runners: Runner[] };

type DbRace = { id: string; race_number: number; race_name: string | null; racecourse_id: string | null };

type Review = { name: string; reason: string };



function normal(name: string): string {

  return name.normalize("NFKC").replace(/\s*\([A-Za-z]{2,3}\)\s*$/g, "").replace(/[^\p{L}\p{N}]/gu, "").toUpperCase();

}

// Display names in title case while preserving the original matching key.

function formatHorseName(name: string): string {

  return name.replace(/\s*\([A-Za-z]{2,3}\)\s*$/g, "").trim().toLocaleLowerCase("en-AU").replace(/(^|[^\p{L}])([\p{L}])/gu, (_match, prefix: string, letter: string) =>

    prefix + letter.toLocaleUpperCase("en-AU")

  );

}

function priceFor(money: number): number {

  return PRICE_LEVELS.find(([threshold]) => money >= threshold)?.[1] ?? 30000;

}

function sourceUrl(raw: string, kind: "meeting" | "profile" | "image"): URL {

  const url = new URL(raw);

  if (url.protocol !== "https:" || !(kind === "image" ? ["www.racingaustralia.horse", "racingaustralia.horse"].includes(url.hostname.toLowerCase()) : url.hostname.toLowerCase() === "www.racingaustralia.horse") || url.username || url.password || url.port) {

    throw new Error("Only HTTPS Racing Australia URLs are permitted.");

  }

  if (kind === "meeting") {

    if (!/^\/FreeFields\/(Form|Acceptances)\.aspx$/i.test(url.pathname) ||

        !/^\d{4}[A-Za-z]{3}\d{2},[A-Za-z]{2,3},.+$/.test(url.searchParams.get("Key") ?? "")) {

      throw new Error("Provide a Racing Australia Form.aspx or Acceptances.aspx meeting URL with a valid Key.");

    }

  } else if (kind === "profile" && !/^\/InteractiveForm\/HorseFullForm\.aspx$/i.test(url.pathname)) {

    throw new Error("Unsupported horse profile URL.");

  } else if (kind === "image" && !/\.(png|jpe?g|webp)(?:$)/i.test(url.pathname)) {

    throw new Error("Unsupported silks image URL.");

  }

  return url;

}

async function getHtml(url: URL): Promise<string> {

  const response = await fetch(url.toString(), {

    headers: { Accept: "text/html", "User-Agent": "RacecourseFantasyImporter/1.0" },

    redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(12000),

  });

  if (!response.ok) throw new Error(`Racing Australia returned HTTP ${response.status}.`);

  if (!(response.headers.get("content-type") ?? "").toLowerCase().includes("text/html")) throw new Error("Source did not return HTML.");

  if (Number(response.headers.get("content-length") ?? 0) > 3_000_000) throw new Error("HTML is too large.");

  const html = await response.text();

  if (html.length > 3_000_000) throw new Error("HTML is too large.");

  return html;

}

function absoluteSource(href: string | undefined, base: URL, kind: "profile" | "image"): string | null {

  if (!href) return null;

  try { return sourceUrl(new URL(href, base).toString(), kind).toString(); } catch { return null; }

}

function raceNumber(text: string): number | null {

  const match = text.match(/\b(?:race|r)\s*(?:no\.?\s*)?(\d{1,2})\b/i);

  return match ? Number(match[1]) : null;

}



// Racing Australia Form.aspx places each race in a race-title table followed by

// race-strip-fields and individual horse-form-table siblings. These are NOT nested.

// Extract each runner only from its own form table, never from historical form links.

function parseMeeting(html: string, base: URL): SiteRace[] {

  const $ = cheerio.load(html);

  const found = new Map<number, SiteRace>();

  for (const titleNode of $("table.race-title").toArray()) {

    const title = $(titleNode);

    const number = raceNumber(title.find(".raceNum").first().text() || title.find("th").first().text());

    if (!number || found.has(number)) continue;

    const runners: Runner[] = [];

    let sibling = title.next();

    while (sibling.length && !sibling.is("table.race-title")) {

      if (sibling.is("table.horse-form-table")) {

        const nameLink = sibling.find(".horse-info .horse-name a[href]").first();

        const name = nameLink.text().replace(/\s+/g, " ").trim();

        const profileUrl = absoluteSource(nameLink.attr("href"), base, "profile");

        if (name && name.length <= 80) {

          const silkUrl = absoluteSource(sibling.find(".Silks img[src]").first().attr("src"), base, "image");

          const prizeMoney = prizeMoneyFromText(sibling.text());

          const saddleclothText = sibling.find(".horse-number").first().text().trim();

          const saddleclothNumber = Number(saddleclothText.match(/^\d+/)?.[0] ?? NaN);

          const barrierMatch = sibling.text().match(/\bBarrier\s*:\s*(\d+)/i);

          const barrier = barrierMatch ? Number(barrierMatch[1]) : null;

          const stripRow = title.nextAll("table.race-strip-fields").first().find("tr").filter((_i, el) =>

            normal($(el).find("td.horse a").first().text()) === normal(name)

          ).first();

          const scratched = stripRow.hasClass("Scratched");

          runners.push({ name, profileUrl, silkUrl, raceNumber: number, prizeMoney,

            saddleclothNumber: Number.isInteger(saddleclothNumber) ? saddleclothNumber : null,

            barrier, scratched });

        }

      }

      sibling = sibling.next();

    }

    if (runners.length) {

      found.set(number, { number, runners: [...new Map(runners.map(r => [normal(r.name), r])).values()] });

    }

  }

  return [...found.values()];

}

function prizeMoneyFromText(text: string): number | null {

  const match = text.replace(/\s+/g, " ").match(/\bPrize\s?money\s*:?\s*(?:AUD\s*)?\$\s*([\d,]+(?:\.\d{1,2})?)/i);

  if (!match) return null;

  const money = Number(match[1].replace(/,/g, ""));

  return Number.isFinite(money) && money >= 0 ? money : null;

}

function profileDetails(html: string, base: URL): { prizeMoney: number | null; silkUrl: string | null } {

  const $ = cheerio.load(html);

  const img = $(".Silks img[src]").first();

  return { prizeMoney: prizeMoneyFromText($("body").text()), silkUrl: absoluteSource(img.attr("src"), base, "image") };

}



export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Missing server Supabase environment variables.");

    const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: "Sign in before importing." }, { status: 401 });
    const auth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: identity, error: authError } = await auth.auth.getUser(token);
    if (authError || !identity.user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: profile, error: profileError } = await admin.from("profiles").select("is_admin").eq("id", identity.user.id).single();
    if (profileError || profile?.is_admin !== true) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

    const body = await request.json();
    const seasonId = String(body?.seasonId ?? "");
    const roundId = String(body?.roundId ?? "");
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(seasonId) || !uuid.test(roundId)) return NextResponse.json({ error: "Select a valid season and round." }, { status: 400 });
    const meetingUrl = sourceUrl(String(body?.url ?? body?.meetingUrl ?? ""), "meeting");
    const [{ data: round, error: roundError }, { data: dbRaces, error: racesError }] = await Promise.all([
      admin.from("rounds").select("id,season_id,name").eq("id", roundId).eq("season_id", seasonId).single(),
      admin.from("races").select("id,race_number,race_name,racecourse_id").eq("round_id", roundId),
    ]);
    if (roundError || !round) return NextResponse.json({ error: "Round does not belong to the selected season." }, { status: 400 });
    if (racesError) throw racesError;
    const races = (dbRaces ?? []) as DbRace[];
    if (!races.length) return NextResponse.json({ error: "No races have been entered for this round." }, { status: 422 });

    const courseIds = [...new Set(races.map(r => r.racecourse_id).filter((id): id is string => Boolean(id)))];
    const { data: courseRows, error: courseError } = await admin.from("racecourses").select("id,name").in("id", courseIds.length ? courseIds : ["00000000-0000-0000-0000-000000000000"]);
    if (courseError) throw courseError;
    const courseNameById = new Map((courseRows ?? []).map(c => [String(c.id), String(c.name)]));
    const meetingCourse = (meetingUrl.searchParams.get("Key") ?? "").split(",").slice(2).join(",").trim();
    // Racing Australia uses "Royal Randwick" while the app may store "Randwick".
    // Keep this alias explicit so unrelated racecourses cannot be matched accidentally.
    const racecourseAliases: Record<string, string> = {
      ROYALRANDWICK: "RANDWICK",
    };
    const canonicalCourse = (name: string): string => {
      const key = normal(name);
      return racecourseAliases[key] ?? key;
    };
    const meetingCourseKey = canonicalCourse(meetingCourse);
    const courseRaces = races.filter(r => r.racecourse_id && canonicalCourse(courseNameById.get(r.racecourse_id) ?? "") === meetingCourseKey);
    if (!courseRaces.length) return NextResponse.json({ error: `No races in this round match the meeting racecourse (${meetingCourse}). Check the racecourse values in Supabase.` }, { status: 422 });
    const counts = new Map<number, number>();
    for (const race of courseRaces) counts.set(Number(race.race_number), (counts.get(Number(race.race_number)) ?? 0) + 1);
    const uniqueRaceNumbers = courseRaces.filter(r => Number.isInteger(Number(r.race_number)) && counts.get(Number(r.race_number)) === 1);
    if (!uniqueRaceNumbers.length) return NextResponse.json({ error: "The selected round has no unambiguous race numbers." }, { status: 422 });

    const siteRaces = parseMeeting(await getHtml(meetingUrl), meetingUrl);
    const byNumber = new Map(siteRaces.map(r => [r.number, r]));
    const matchedRaces = uniqueRaceNumbers.filter(r => byNumber.has(Number(r.race_number)));
    const unmatchedRaces = races.filter(r => !matchedRaces.some(m => m.id === r.id)).map(r => `${r.race_name ?? "Race"} (${r.race_number})`);
    if (!matchedRaces.length) return NextResponse.json({ error: "No numbered races could be matched. No horses were imported.", unmatchedRaces }, { status: 422 });

    const raceEntriesToImport = matchedRaces.flatMap(dbRace => (byNumber.get(Number(dbRace.race_number))?.runners ?? []).map(runner => ({ raceId: dbRace.id, runner })));
    const runners = [...new Map(raceEntriesToImport.map(({runner}) => [normal(runner.name), runner])).values()];
    const { data: existing, error: existingError } = await admin.from("horses").select("id,name,silks_url,current_price");
    if (existingError) throw existingError;
    type KnownHorse = { id: string; name: string; silks_url: string | null; current_price: number };
    const known = new Map<string, KnownHorse>((existing ?? []).map(h => [normal(h.name), h as KnownHorse]));
    const added: { name: string; prizeMoney: number; price: number; silksImported: boolean }[] = [];
    const skipped: string[] = [];
    const review: Review[] = [];
    const silksUpdated: string[] = [];
    const startedAt = Date.now();
    // Process a bounded number of runners per request. Re-running the same URL
    // resumes safely because existing horses and entries are not overwritten.
    const MAX_RUNNERS_PER_REQUEST = 18;
    const pending = [
      ...runners.filter(r => !known.has(normal(r.name))),
      ...runners.filter(r => known.has(normal(r.name)) && !known.get(normal(r.name))?.silks_url),
    ];
    const selected = pending.slice(0, MAX_RUNNERS_PER_REQUEST);
    const unprocessedCount = Math.max(0, runners.filter(r => !known.has(normal(r.name))).length - selected.length);

    async function uploadSilks(horseId: string, urlString: string): Promise<string> {
      const url = sourceUrl(urlString, "image");
      const response = await fetch(url.toString(), { redirect: "manual", signal: AbortSignal.timeout(6500), cache: "no-store" });
      if (!response.ok) throw new Error(`Silks image returned HTTP ${response.status}`);
      const mime = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      const extensions: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
      const extension = extensions[mime];
      if (!extension) throw new Error("Silks image is not PNG, JPEG or WebP.");
      if (Number(response.headers.get("content-length") ?? 0) > 5_000_000) throw new Error("Silks image exceeds 5 MB.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > 5_000_000) throw new Error("Silks image exceeds 5 MB.");
      const storagePath = `${horseId}/silks.${extension}`;
      const { error } = await admin.storage.from("horse-silks").upload(storagePath, bytes, { contentType: mime, upsert: true });
      if (error) throw error;
      return admin.storage.from("horse-silks").getPublicUrl(storagePath).data.publicUrl;
    }

    // Bounded concurrency avoids dozens of sequential 12-second network waits.
    let cursor = 0;
    const workers = Array.from({ length: Math.min(5, selected.length) }, async () => {
      while (cursor < selected.length) {
        const runner = selected[cursor++];
        const key = normal(runner.name);
        const existingHorse = known.get(key);
        let prizeMoney = runner.prizeMoney;
        let silkUrl = runner.silkUrl;
        if (runner.profileUrl && (prizeMoney === null || !silkUrl)) {
          try {
            const details = profileDetails(await getHtml(sourceUrl(runner.profileUrl, "profile")), new URL(runner.profileUrl));
            prizeMoney = prizeMoney ?? details.prizeMoney;
            silkUrl = silkUrl ?? details.silkUrl;
          } catch (error) { review.push({ name: runner.name, reason: `Profile retrieval: ${error instanceof Error ? error.message : "failed"}` }); }
        }
        if (existingHorse) {
          skipped.push(runner.name);
          if (!silkUrl) { review.push({ name: runner.name, reason: "Existing horse has no silks; source image not found." }); continue; }
          try {
            const publicUrl = await uploadSilks(existingHorse.id, silkUrl);
            const { error } = await admin.from("horses").update({ silks_url: publicUrl }).eq("id", existingHorse.id).is("silks_url", null);
            if (error) throw error;
            silksUpdated.push(runner.name);
          } catch (error) { review.push({ name: runner.name, reason: `Silks: ${error instanceof Error ? error.message : "upload failed"}` }); }
          continue;
        }
        if (prizeMoney === null) { review.push({ name: runner.name, reason: "Career prizemoney unavailable; horse not inserted." }); continue; }
        const price = priceFor(prizeMoney);
        const { data: inserted, error: insertError } = await admin.from("horses").insert({
          name: formatHorseName(runner.name), starting_price: price, current_price: price,
          career_prize_money: prizeMoney, racing_australia_url: runner.profileUrl,
          eligible_starts: 0, total_fantasy_points: 0, is_active: true,
        }).select("id").single();
        if (insertError || !inserted) { review.push({ name: runner.name, reason: insertError?.message ?? "Insert failed" }); continue; }
        const horse: KnownHorse = { id: inserted.id, name: formatHorseName(runner.name), silks_url: null, current_price: price };
        known.set(key, horse);
        let silksImported = false;
        if (silkUrl) {
          try {
            const publicUrl = await uploadSilks(inserted.id, silkUrl);
            const { error } = await admin.from("horses").update({ silks_url: publicUrl }).eq("id", inserted.id);
            if (error) throw error;
            silksImported = true;
          } catch (error) { review.push({ name: runner.name, reason: `Horse added but silks failed: ${error instanceof Error ? error.message : "unknown error"}` }); }
        } else review.push({ name: runner.name, reason: "Horse added; no verifiable silks image found." });
        added.push({ name: horse.name, prizeMoney, price, silksImported });
      }
    });
    await Promise.all(workers);

    const { data: existingEntries, error: entriesError } = await admin.from("race_entries").select("id,race_id,horse_id").in("race_id", matchedRaces.map(r => r.id));
    if (entriesError) throw entriesError;
    const entryKeys = new Set((existingEntries ?? []).map(e => `${e.race_id}:${e.horse_id}`));
    const raceEntriesAdded: { raceId: string; horse: string }[] = [];
    const raceEntriesSkipped: { raceId: string; horse: string; reason: string }[] = [];
    const rows: Array<{ race_id: string; horse_id: string; saddlecloth_number: number | null; barrier: number | null; price_at_entry: number; entry_status: string }> = [];
    for (const { raceId, runner } of raceEntriesToImport) {
      const horse = known.get(normal(runner.name));
      if (!horse) { raceEntriesSkipped.push({ raceId, horse: runner.name, reason: "Horse not yet imported or missing prizemoney." }); continue; }
      const key = `${raceId}:${horse.id}`;
      if (entryKeys.has(key)) { raceEntriesSkipped.push({ raceId, horse: runner.name, reason: "Entry already exists; left unchanged." }); continue; }
      entryKeys.add(key);
      rows.push({ race_id: raceId, horse_id: horse.id, saddlecloth_number: runner.saddleclothNumber, barrier: runner.barrier, price_at_entry: horse.current_price, entry_status: runner.scratched ? "scratched_before_lockout" : "runner" });
      raceEntriesAdded.push({ raceId, horse: horse.name });
    }
    // A single database request replaces one price lookup + insert per runner.
    // Fallback to individual inserts when a row conflicts with an existing manual entry.
    if (rows.length) {
      const { error: batchError } = await admin.from("race_entries").insert(rows);
      if (batchError) {
        raceEntriesAdded.length = 0;
        for (const row of rows) {
          const { error } = await admin.from("race_entries").insert(row);
          const horse = [...known.values()].find(h => h.id === row.horse_id);
          if (error) raceEntriesSkipped.push({ raceId: row.race_id, horse: horse?.name ?? row.horse_id, reason: `Insert failed: ${error.message}` });
          else raceEntriesAdded.push({ raceId: row.race_id, horse: horse?.name ?? row.horse_id });
        }
      }
    }
    return NextResponse.json({
      raceEntriesAddedCount: raceEntriesAdded.length, raceEntriesSkippedCount: raceEntriesSkipped.length,
      raceEntriesAdded, raceEntriesSkipped, checked: runners.length, alreadyExists: skipped.length,
      addedCount: added.length, needsReview: review.length,
      eligibleRaces: matchedRaces.map(r => r.race_name ?? `Race ${r.race_number}`),
      matchedRaces: matchedRaces.map(r => ({ id: r.id, name: r.race_name, number: r.race_number })),
      unmatchedRaces, silksUpdated, added, skipped, review,
      incomplete: unprocessedCount > 0, remainingHorses: unprocessedCount,
      message: unprocessedCount > 0 ? `Partial import completed. Run the same URL again to process ${unprocessedCount} remaining horses.` : "Import completed.",
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error: unknown) {
    console.error("[import-horses] Unhandled import error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
