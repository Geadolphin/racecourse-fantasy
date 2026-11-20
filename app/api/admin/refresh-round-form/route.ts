import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
export const runtime = "nodejs";
export const maxDuration = 60;
const zones: Record<string,string> = { VIC:'Australia/Melbourne', NSW:'Australia/Sydney', WA:'Australia/Perth', SA:'Australia/Adelaide', QLD:'Australia/Brisbane', TAS:'Australia/Hobart', ACT:'Australia/Canberra', NT:'Australia/Darwin' };
function normal(name:string) { return name.normalize('NFKC').replace(/\s*\([A-Za-z]{2,3}\)\s*$/g,'').replace(/[^\p{L}\p{N}]/gu,'').toUpperCase(); }
function localDate(date:string,zone:string) { const p = new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(date)); const get=(t:string)=>p.find(x=>x.type===t)?.value ?? ''; return `${get('year')}-${get('month')}-${get('day')}`; }
function priorDate(date:string) { const d=new Date(date+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()-1); return d.toISOString().slice(0,10); }
function validateUrl(raw:string,date:string,state:string){
 const u=new URL(raw);if(u.protocol!=='https:'||!['www.racingaustralia.horse','racingaustralia.horse'].includes(u.hostname)||u.port||u.username||u.password||u.pathname.toLowerCase()!=='/freefields/form.aspx')throw new Error('Enter a Racing Australia Form.aspx HTTPS URL');
 const [y,m,d]=date.split('-');const month=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m)-1];const parts=(u.searchParams.get('Key')??'').split(',');if(parts[0]?.toLowerCase()!==`${y}${month}${d}`.toLowerCase()||parts[1]?.toUpperCase()!==state||!parts[2])throw new Error('URL date or state does not match meeting');return u;
}
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
 const meetings = new Map<string,{racecourseId:string;meetingDate:string;name:string;state:string;races:typeof rr.data}>();
 for(const race of rr.data){
  const course=courses.data.find(c=>c.id===race.racecourse_id);
  if(!course||course.country!=='Australia'||!zones[course.state])continue;
  const date=localDate(race.scheduled_start,zones[course.state]);
  const k=course.id+':'+date;
  if(!meetings.has(k))meetings.set(k,{racecourseId:course.id,meetingDate:date,name:course.name,state:course.state,races:[]});
  meetings.get(k)!.races.push(race);
 }
 const saved=await admin.from('round_form_urls').select('racecourse_id,meeting_date,form_url').eq('round_id',roundId); if(saved.error)throw saved.error;
 const action=String(body.action??'list');
 if(action==='list')return NextResponse.json({meetings:[...meetings.values()].map(({races,...m})=>({...m,formUrl:saved.data.find(s=>s.racecourse_id===m.racecourseId&&s.meeting_date===m.meetingDate)?.form_url??'',started:races.some(r=>r.status==='official'||Date.parse(r.scheduled_start)<=Date.now())}))});
 const m=meetings.get(String(body.racecourseId)+':'+String(body.meetingDate));
 if(!m)return NextResponse.json({error:'Meeting not found in round'},{status:400});
 if(action==='save'){
  const raw=String(body.formUrl??'').trim();
  if(!raw){const result=await admin.from('round_form_urls').delete().eq('round_id',roundId).eq('racecourse_id',m.racecourseId).eq('meeting_date',m.meetingDate);if(result.error)throw result.error;return NextResponse.json({saved:true});}
  const u=validateUrl(raw,m.meetingDate,m.state);
  const result=await admin.from('round_form_urls').upsert({round_id:roundId,racecourse_id:m.racecourseId,meeting_date:m.meetingDate,form_url:u.toString(),updated_at:new Date().toISOString()},{onConflict:'round_id,racecourse_id,meeting_date'});if(result.error)throw result.error;
  return NextResponse.json({saved:true});
 }
 if(action!=='refresh')return NextResponse.json({error:'Invalid action'},{status:400});
 if(m.races.some(r=>r.status==='official'||Date.parse(r.scheduled_start)<=Date.now()))return NextResponse.json({error:'Meeting already started; existing form preserved'},{status:409});
 const stored=saved.data.find(s=>s.racecourse_id===m.racecourseId&&s.meeting_date===m.meetingDate);
 if(!stored)return NextResponse.json({error:'Save a form URL first'},{status:400});
 const page=await fetchMeeting(validateUrl(stored.form_url,m.meetingDate,m.state));
 const entries=await admin.from('race_entries').select('race_id,horse_id,horse:horses(name)').in('race_id',m.races.map(r=>r.id));if(entries.error)throw entries.error;
 const review:string[]= []; const checked=new Set<string>(); const ambiguous=new Set<string>(); const candidates=new Map<string,{horse_id:string;season_id:string;baseline_form:string;baseline_date:string}>();
 for(const race of m.races){
  const names=entries.data.filter(e=>e.race_id===race.id).map(e=>({id:e.horse_id,name:normal(String((Array.isArray(e.horse)?e.horse[0]:e.horse)?.name??''))}));
  names.forEach(n=>checked.add(n.id)); if(!names.length)continue;
  const field=page.get(race.race_number);
  if(!field||!names.every(n=>n.name&&field.has(n.name))){review.push(`Race ${race.race_number}: source field does not fully match`);continue;}
  for(const horse of names){const form=field.get(horse.name);if(!form){review.push(`${horse.name}: missing form`);continue;}const old=candidates.get(horse.id);if(old&&old.baseline_form!==form)ambiguous.add(horse.id);else candidates.set(horse.id,{horse_id:horse.id,season_id:seasonId,baseline_form:form,baseline_date:priorDate(m.meetingDate)});}
 }
 for(const id of ambiguous){candidates.delete(id);review.push(`${id}: conflicting form`);}
 let updated=0,unchanged=0;
 const rows=[...candidates.values()];
 for(let i=0;i<rows.length;i+=100){
  const batch=rows.slice(i,i+100);
  const existing=await admin.from('horse_form_display_baselines').select('horse_id,baseline_date,baseline_form').eq('season_id',seasonId).in('horse_id',batch.map(r=>r.horse_id));if(existing.error)throw existing.error;
  const changes=batch.filter(row=>{const old=existing.data.find(e=>e.horse_id===row.horse_id);return !old||old.baseline_date<row.baseline_date||(old.baseline_date===row.baseline_date&&old.baseline_form!==row.baseline_form);});
  unchanged+=batch.length-changes.length;
  if(changes.length){const result=await admin.from('horse_form_display_baselines').upsert(changes.map(r=>({...r,updated_at:new Date().toISOString()})),{onConflict:'horse_id,season_id'});if(result.error)throw result.error;updated+=changes.length;}
 }
 return NextResponse.json({checked:checked.size,updated,unchanged,review});
 } catch(error){return NextResponse.json({error:error instanceof Error?error.message:String((error as {message?:string})?.message??error)},{status:500});}
}
