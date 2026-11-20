import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
export const runtime = "nodejs";
export const maxDuration = 60;
const zones: Record<string,string> = { VIC:'Australia/Melbourne', NSW:'Australia/Sydney', WA:'Australia/Perth', SA:'Australia/Adelaide', QLD:'Australia/Brisbane', TAS:'Australia/Hobart', ACT:'Australia/Canberra', NT:'Australia/Darwin' };
const aliases: Record<string,string[]> = { Cranbourne:['Southside Cranbourne','Cranbourne'], Randwick:['Royal Randwick','Randwick'], Rosehill:['Rosehill Gardens','Rosehill'], Sandown:['Sportsbet Sandown Hillside','Sportsbet Sandown Lakeside','Sandown Hillside','Sandown Lakeside'] };
const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function normal(name:string) { return name.normalize('NFKC').replace(/\s*\([A-Za-z]{2,3}\)\s*$/g,'').replace(/[^\p{L}\p{N}]/gu,'').toUpperCase(); }
function localDate(date:string,zone:string) { const p = new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(date)); const get=(t:string)=>p.find(x=>x.type===t)?.value ?? ''; return `${get('year')}-${get('month')}-${get('day')}`; }
function priorDate(date:string) { const d=new Date(date+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()-1); return d.toISOString().slice(0,10); }
function meetingUrl(date:string,state:string,course:string) { const [y,m,d]=date.split('-'); const url=new URL('https://www.racingaustralia.horse/FreeFields/Form.aspx'); url.searchParams.set('Key',`${y}${months[Number(m)-1]}${d},${state},${course}`); return url; }
function parse(html:string) {
 const $=cheerio.load(html); const races=new Map<number,Map<string,string|null>>();
 for(const node of $('table.race-title').toArray()) {
  const title=$(node); const n=Number((title.find('.raceNum').first().text()||title.find('th').first().text()).match(/\b(?:race|r)\s*(?:no\.?\s*)?(\d{1,2})\b/i)?.[1]);
  if(!n||races.has(n)) continue;
  let strip=title.next(); while(strip.length&&!strip.is('table.race-title,table.race-strip-fields')) strip=strip.next();
  if(!strip.is('table.race-strip-fields')) continue;
  const header=strip.find('tr').filter((_i,e)=>$(e).children('th,td').toArray().some(c=>/^last\s*10$/i.test($(c).text().trim()))).first();
  const idx=header.children('th,td').toArray().findIndex(c=>/^last\s*10$/i.test($(c).text().trim()));
  const runners=new Map<string,string|null>();
  strip.find('tr').each((_i,e)=>{ const row=$(e); const name=normal(row.find('td.horse a').first().text()); if(!name)return; const raw=(idx>=0?row.children('td').eq(idx).text():row.find('td.last10,td.last-10,td.Last10').first().text()).replace(/\s+/g,'').replace(/x/gi,'-'); const form=/^[0-9-]+$/.test(raw)&&/[0-9]/.test(raw)?raw.slice(-5):null; runners.set(name,runners.has(name)?null:form); });
  races.set(n,runners);
 }
 return races;
}
async function fetchMeeting(url:URL) { const r=await fetch(url,{cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(7000),headers:{Accept:'text/html','User-Agent':'RacecourseFantasyImporter/1.0'}}); if(!r.ok||!r.headers.get('content-type')?.includes('text/html')) throw new Error(`Meeting unavailable (${r.status})`); const html=await r.text(); if(html.length>3000000)throw new Error('Meeting too large'); return parse(html); }
export async function POST(request:NextRequest) {
 try {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL, anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!anon||!key)throw new Error('Missing Supabase configuration');
 const token=request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]; if(!token)return NextResponse.json({error:'Sign in required'},{status:401});
 const auth=createClient(url,anon,{auth:{persistSession:false}}); const identity=await auth.auth.getUser(token); if(identity.error||!identity.data.user)return NextResponse.json({error:'Invalid session'},{status:401});
 const admin=createClient(url,key,{auth:{persistSession:false}}); const profile=await admin.from('profiles').select('is_admin').eq('id',identity.data.user.id).single(); if(profile.error||profile.data?.is_admin!==true)return NextResponse.json({error:'Administrator access required'},{status:403});
 const body=await request.json(); const roundId=String(body.roundId??''); if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(roundId))return NextResponse.json({error:'Invalid round'},{status:400});
 const round=await admin.from('rounds').select('id,season_id').eq('id',roundId).single(); if(round.error)throw round.error; const seasonId=round.data.season_id;
 const rr=await admin.from('races').select('id,race_number,scheduled_start,status,racecourse_id').eq('round_id',roundId); if(rr.error)throw rr.error;
 const courses=await admin.from('racecourses').select('id,name,state,country').in('id',[...new Set(rr.data.map(r=>r.racecourse_id))]); if(courses.error)throw courses.error;
 const review:string[]=[]; const candidates=new Map<string,{horse_id:string;season_id:string;baseline_form:string;baseline_date:string}>(); const ambiguous=new Set<string>(); const checked=new Set<string>(); const cache=new Map<string,ReturnType<typeof fetchMeeting>>();
 for(const race of rr.data) {
 const course=courses.data.find(c=>c.id===race.racecourse_id); if(!course||course.country!=='Australia'||!zones[course.state]){review.push(`Race ${race.race_number}: unsupported course`);continue;}
 if(race.status==='official'||Date.parse(race.scheduled_start)<=Date.now()){review.push(`${course.name} race ${race.race_number}: started or completed`);continue;}
 const entries=await admin.from('race_entries').select('horse_id,horse:horses(name)').eq('race_id',race.id); if(entries.error)throw entries.error;
 const names=entries.data.map(e=>({id:e.horse_id,name:normal(String((Array.isArray(e.horse)?e.horse[0]:e.horse)?.name??''))})); names.forEach(e=>checked.add(e.id)); if(!names.length)continue;
 const date=localDate(race.scheduled_start,zones[course.state]); if(date!==localDate(new Date().toISOString(),zones[course.state])&&date<localDate(new Date().toISOString(),zones[course.state]))continue;
 // A same-day meeting may have already produced results for another horse. Never refresh once any race in this meeting has started.
 if(rr.data.some(r=>r.racecourse_id===race.racecourse_id&&localDate(r.scheduled_start,zones[course.state])===date&&Date.parse(r.scheduled_start)<=Date.now())){review.push(`${course.name}: meeting already started`);continue;}
 const pages=await Promise.all((aliases[course.name]??[course.name]).map(async name=>{const u=meetingUrl(date,course.state,name); const k=u.toString(); if(!cache.has(k))cache.set(k,fetchMeeting(u)); try{return (await cache.get(k))?.get(race.race_number);}catch{return undefined;}}));
 const valid=pages.filter(p=>p&&names.every(n=>n.name&&p.has(n.name))); if(!valid.length){review.push(`${course.name} race ${race.race_number}: no fully matched field`);continue;}
 for(const horse of names){const forms=[...new Set(valid.map(p=>p?.get(horse.name)))]; if(forms.length!==1||!forms[0]){review.push(`${horse.name}: missing or ambiguous form`);continue;} const row={horse_id:horse.id,season_id:seasonId,baseline_form:forms[0],baseline_date:priorDate(date)}; const old=candidates.get(horse.id); if(old&&(old.baseline_form!==row.baseline_form||old.baseline_date!==row.baseline_date))ambiguous.add(horse.id); else candidates.set(horse.id,row);}
 }
 let updated=0,unchanged=0; for(const id of ambiguous){candidates.delete(id);review.push(`${id}: conflicting meeting form`);}
 for(const row of candidates.values()) { const existing=await admin.from('horse_form_display_baselines').select('baseline_date,baseline_form').eq('horse_id',row.horse_id).eq('season_id',seasonId).maybeSingle(); if(existing.error){review.push(existing.error.message);continue;} if((existing.data?.baseline_date??'')>row.baseline_date||(existing.data?.baseline_date===row.baseline_date&&existing.data?.baseline_form===row.baseline_form)){unchanged++;continue;} const result=await admin.from('horse_form_display_baselines').upsert({...row,updated_at:new Date().toISOString()},{onConflict:'horse_id,season_id'}); if(result.error)review.push(result.error.message);else updated++; }
 return NextResponse.json({checked:checked.size,updated,unchanged,review});
 } catch(error){return NextResponse.json({error:error instanceof Error?error.message:String((error as {message?:string})?.message??error)},{status:500});}
}
