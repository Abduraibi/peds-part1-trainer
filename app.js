/* ============================================================================
   PEDIATRICS PART 1 — BOARD TRAINER
   ----------------------------------------------------------------------------
   >>> SETUP: paste your Supabase project URL + anon key below.  <<<
   Find them in Supabase → Project Settings → API.
   Leave as-is to run in LOCAL DEMO mode (progress saved only in this browser).
   ============================================================================ */
const SUPABASE_CONFIG = {
  url:  "https://nernppmpfpmwzosutzbi.supabase.co",
  anon: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lcm5wcG1wZnBtd3pvc3V0emJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMjQyNDQsImV4cCI6MjA5NTgwMDI0NH0.uGjSwIoqBkLF26Ia1iNU_YmBsghbkVfu33Sruc8nnfk"
};

const ASSET_BASE = "https://nernppmpfpmwzosutzbi.supabase.co/storage/v1/object/public/snapshots/";

const EXAM_DATE = "2026-07-07";   // Pediatrics Part 1 exam
const FINISH_BY = "2026-07-06";   // finish at least one day before

/* Study modes: Full, Busy, On-Call */
const STUDY_MODES = {
  full: { core: 50, secondary: 10, wrongLoop: 10, label: "Full Day", icon: "📚", description: "50 core + high-yield + wrong loop" },
  busy: { core: 30, secondary: 5, wrongLoop: 5, label: "Busy Day", icon: "⏰", description: "30 core + 5–10 secondary" },
  oncall: { core: 15, secondary: 5, wrongLoop: 0, label: "On-Call Min", icon: "🏥", description: "15 core + traps only" }
};

/* Clinical specialties — exactly matching questions_data.json specialty field */
const SPECIALTIES = [
  "General Pediatrics",
  "Infectious Diseases",
  "Neurology",
  "Cardiology",
  "Gastroenterology",
  "Hematology",
  "Emergency Medicine",
  "Endocrinology",
  "Nephrology",
  "Pulmonology",
  "Neonatology",
  "Immunology",
  "Developmental & Behavioral",
  "Rheumatology",
  "Adolescent Medicine",
  "Critical Care Medicine",
  "Dermatology"
];

/* Visual metadata per specialty: icon + CSS color variable suffix */
const SPECIALTY_META = {
  "General Pediatrics":        { icon:"👶", color:"spec-gen"   },
  "Infectious Diseases":       { icon:"🦠", color:"spec-inf"   },
  "Neurology":                 { icon:"🧠", color:"spec-neu"   },
  "Cardiology":                { icon:"❤️", color:"spec-card"  },
  "Gastroenterology":          { icon:"🫁", color:"spec-gas"   },
  "Hematology":                { icon:"🩸", color:"spec-hem"   },
  "Emergency Medicine":        { icon:"🚨", color:"spec-em"    },
  "Endocrinology":             { icon:"⚗️", color:"spec-end"   },
  "Nephrology":                { icon:"🫘", color:"spec-nep"   },
  "Pulmonology":               { icon:"🫧", color:"spec-pul"   },
  "Neonatology":               { icon:"🍼", color:"spec-neo"   },
  "Immunology":                { icon:"🛡️", color:"spec-imm"   },
  "Developmental & Behavioral":{ icon:"🧩", color:"spec-dev"   },
  "Rheumatology":              { icon:"🦴", color:"spec-rhe"   },
  "Adolescent Medicine":       { icon:"🏃", color:"spec-ado"   },
  "Critical Care Medicine":    { icon:"🏥", color:"spec-crit"  },
  "Dermatology":               { icon:"🔬", color:"spec-derm"  },
};

/* 35-day specialty schedule: Jun 2 → Jul 6, 2026
   Distributed by question count (General Peds gets most days).
   Each entry: [dayNumber, specialty, landmark?]            */
const STUDY_SCHEDULE = [
  // ── Week 1: Core foundations ──────────────────────────
  { day:1,  spec:"General Pediatrics",         landmark:"🚀 Day 1 — Start" },
  { day:2,  spec:"General Pediatrics"         },
  { day:3,  spec:"General Pediatrics"         },
  { day:4,  spec:"Infectious Diseases",        landmark:"🦠 Infectious Block" },
  { day:5,  spec:"Infectious Diseases"        },
  { day:6,  spec:"Cardiology",                 landmark:"❤️ Cardio Block" },
  { day:7,  spec:"Cardiology",                 landmark:"🧪 Week 1 Review" },
  // ── Week 2: Systems ────────────────────────────────────
  { day:8,  spec:"Neurology",                  landmark:"🧠 Neuro Block" },
  { day:9,  spec:"Neurology"                  },
  { day:10, spec:"Gastroenterology",           landmark:"🫁 GI Block" },
  { day:11, spec:"Gastroenterology"           },
  { day:12, spec:"Hematology",                 landmark:"🩸 Heme Block" },
  { day:13, spec:"Pulmonology",                landmark:"🫧 Pulm Block" },
  { day:14, spec:"General Pediatrics",         landmark:"🧪 Week 2 Review" },
  // ── Week 3: Subspecialties ─────────────────────────────
  { day:15, spec:"Endocrinology",              landmark:"⚗️ Endo Block" },
  { day:16, spec:"Nephrology",                 landmark:"🫘 Nephro Block" },
  { day:17, spec:"Neonatology",                landmark:"🍼 Neonate Block" },
  { day:18, spec:"Emergency Medicine",         landmark:"🚨 EM Block" },
  { day:19, spec:"Emergency Medicine"         },
  { day:20, spec:"Immunology",                 landmark:"🛡️ Immuno Block" },
  { day:21, spec:"Rheumatology",               landmark:"⭐ Midpoint — Major Review" },
  // ── Week 4: Niche + reinforcement ─────────────────────
  { day:22, spec:"Developmental & Behavioral", landmark:"🧩 Dev-Behav Block" },
  { day:23, spec:"Adolescent Medicine",        landmark:"🏃 Adolescent Block" },
  { day:24, spec:"Critical Care Medicine",     landmark:"🏥 Critical Care Block" },
  { day:25, spec:"Dermatology",                landmark:"🔬 Derm Block" },
  { day:26, spec:"General Pediatrics"         },
  { day:27, spec:"General Pediatrics"         },
  { day:28, spec:"General Pediatrics",         landmark:"🧪 Week 4 Review" },
  // ── Week 5: Consolidation sprint ──────────────────────
  { day:29, spec:"Infectious Diseases",        landmark:"🔁 Consolidation Sprint" },
  { day:30, spec:"Neurology"                  },
  { day:31, spec:"Cardiology"                 },
  { day:32, spec:"Hematology"                 },
  { day:33, spec:"General Pediatrics",         landmark:"🔥 Final Intensive" },
  { day:34, spec:"General Pediatrics",         landmark:"🔥 Final Intensive" },
  { day:35, spec:"General Pediatrics",         landmark:"✨ Final Polish — Exam tomorrow" },
];

/* Question type labels */
const QUESTION_TYPES = {
  scenario: "Clinical Scenario",
  recall:   "Direct Recall",
  concept:  "Concept Training",
  image:    "Image-Based"
};

/* ---------------------------------------------------------------------------
   State
--------------------------------------------------------------------------- */
let QUESTIONS = [];
let QBY = {};                 // id -> question
let sb = null;                // supabase client (or null in local mode)
let USER = null;              // {id,email}
let LOCAL_MODE = false;
let STATE = null;             // progress state (synced)
let runnerCtx = null;         // active question-runner context

const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];

/* Get today's date in Riyadh timezone (UTC+3) */
const todayStr = ()=> {
  const now = new Date();
  const riyadhTime = new Date(now.toLocaleString('en-US', {timeZone: 'Asia/Riyadh'}));
  return riyadhTime.toISOString().slice(0,10);
};

const daysBetween = (a,b)=> Math.round((new Date(b)-new Date(a))/86400000);

/* ---------------------------------------------------------------------------
   Default progress state
--------------------------------------------------------------------------- */
function freshState(){
  return {
    schema: 3,
    startDate: todayStr(),
    edits:{},       // id -> {answer, stem, notes}
    seen:{},        // id -> {attempts, correct, lastResult, lastSeen, box(SR), nextDue}
    review:{},      // id -> true (saved for review)
    wrongLoop:{},   // date -> [ids]
    dayLog:{},      // date -> frozen plan object
    mock:[],        // [{date,score,total,mode}]
    lastActiveDate: null,
    fudulDone: 0,
    fudulDoneDate: null,
    specialtyStats: {}  // specialty -> {attempts, correct}
  };
}

/* ---------------------------------------------------------------------------
   Boot
--------------------------------------------------------------------------- */
async function boot(){
  // load questions
  try{
    const r = await fetch("questions_data.json");
    QUESTIONS = await r.json();
  }catch(e){
    QUESTIONS = window.__QUESTIONS__ || [];
  }
  QUESTIONS.forEach(q=>QBY[q.id]=q);

  // init supabase or local mode
  const configured = SUPABASE_CONFIG.url.startsWith("http") && SUPABASE_CONFIG.anon.length>20;
  if(configured && window.supabase){
    sb = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anon);
    const {data:{session}} = await sb.auth.getSession();
    if(session){ await onLogin(session.user); }
    else showAuth();
    sb.auth.onAuthStateChange((_e,s)=>{ if(!s) showAuth(); });
  }else{
    LOCAL_MODE = true;
    $("#configWarn").style.display="block";
    const email = localStorage.getItem("demo_email");
    if(email){ await onLogin({id:"local",email}); }
    else showAuth();
  }
  bindGlobalUI();
}

/* ---------------------------------------------------------------------------
   Auth UI
--------------------------------------------------------------------------- */
let authIsSignup=false;
function showAuth(){
  $("#app").style.display="none";
  $("#authView").style.display="grid";
}
function bindGlobalUI(){
  $("#authSwitch").onclick=()=>{
    authIsSignup=!authIsSignup;
    $("#authBtn").textContent = authIsSignup?"Create account":"Sign in";
    $("#authSub").textContent = authIsSignup?"Create an account to sync across devices":"Sign in to continue your study plan";
    $("#authToggle").innerHTML = authIsSignup
      ? `Already have an account? <button id="authSwitch2">Sign in</button>`
      : `New here? <button id="authSwitch2">Create an account</button>`;
    $("#authSwitch2").onclick=$("#authSwitch").onclick;
  };
  $("#authBtn").onclick=doAuth;
  $("#authPass").addEventListener("keydown",e=>{if(e.key==="Enter")doAuth();});
  $("#themeBtn").onclick=toggleTheme;
  $("#logoutBtn").onclick=doLogout;
  $$("#nav button").forEach(b=>b.onclick=()=>switchView(b.dataset.view));
  // restore theme
  const t=localStorage.getItem("theme")||"light";
  document.documentElement.dataset.theme=t;
}
async function doAuth(){
  const email=$("#authEmail").value.trim(), pass=$("#authPass").value;
  const msg=$("#authMsg");
  msg.className="auth-msg";
  if(!email||!pass){msg.className="auth-msg err";msg.textContent="Enter email and password.";return;}
  if(LOCAL_MODE){
    localStorage.setItem("demo_email",email);
    await onLogin({id:"local",email});
    return;
  }
  try{
    let res;
    if(authIsSignup){
      res=await sb.auth.signUp({email,password:pass});
      if(res.error) throw res.error;
      if(!res.data.session){
        msg.className="auth-msg ok";
        msg.textContent="Account created. Check your email to confirm, then sign in.";
        return;
      }
    }else{
      res=await sb.auth.signInWithPassword({email,password:pass});
      if(res.error) throw res.error;
    }
    await onLogin(res.data.user);
  }catch(e){
    msg.className="auth-msg err";
    msg.textContent=e.message||"Authentication failed.";
  }
}
async function doLogout(){
  if(LOCAL_MODE){ localStorage.removeItem("demo_email"); }
  else if(sb){ await sb.auth.signOut(); }
  USER=null; STATE=null;
  showAuth();
}

async function onLogin(user){
  USER=user;
  $("#authView").style.display="none";
  $("#app").style.display="block";
  $("#userEmail").textContent=user.email;
  $("#userAv").textContent=(user.email[0]||"?").toUpperCase();
  await loadState();
  await purgeStaleTodayPlan(); // archive old days + build today's plan if missing
  rolloverDay();
  switchView("dashboard");
}

/* Detect and purge stale plans from previous days, then auto-build today's plan.
   Saves immediately (bypasses debounce) so the clean state persists to Supabase. */
async function purgeStaleTodayPlan(){
  const today = todayStr();
  if(!STATE||!STATE.dayLog) return;

  // Check if any entry is from before today
  const hasOldEntries = Object.keys(STATE.dayLog).some(d => d < today);
  const hasTodayPlan = STATE.dayLog[today] && STATE.dayLog[today].groups && !STATE.dayLog[today].archived;

  if(!hasOldEntries && hasTodayPlan) return; // nothing to do

  // Archive old entries (keep for history), delete today's slot so it rebuilds fresh
  Object.keys(STATE.dayLog).forEach(d => {
    if(d < today && STATE.dayLog[d]) STATE.dayLog[d].archived = true;
  });
  // Always delete today's slot if it exists but isn't a real today plan
  if(STATE.dayLog[today] && !hasTodayPlan) delete STATE.dayLog[today];

  // Save immediately — bypass debounce so this persists even if page reloads
  if(LOCAL_MODE){
    localStorage.setItem(localKey(), JSON.stringify(STATE));
  } else if(sb && USER){
    try{
      await sb.from("progress").upsert({
        user_id: USER.id, state: STATE, updated_at: new Date().toISOString()
      });
    }catch(e){ console.warn("purge save error", e); }
  }

  // Rebuild today's plan immediately and switch to it
  buildDayPlan(currentPlanMode||"full");
  if($("#view-dashboard").classList.contains("active")) renderDashboard();
}

/* One-time migration: any dayLog entry with groups whose key != today
   gets archived immediately so it never blocks today's fresh plan.     */
function migrateStalePlans(){
  if(!STATE||!STATE.dayLog) return;
  const today=todayStr(); let changed=false;
  Object.keys(STATE.dayLog).forEach(d=>{
    const log=STATE.dayLog[d];
    if(!log||!log.groups) return;
    if(d<today || !log.day || log.day!==d || log.day!==today){
      if(!log.archived){ log.archived=true; changed=true; }
    }
  });
  if(changed){ saveState(); }
}

async function forceNewDay(){
  const today=todayStr();
  // archive everything that isn't today's fresh plan
  Object.keys(STATE.dayLog||{}).forEach(d=>{
    if(STATE.dayLog[d]&&STATE.dayLog[d].groups) STATE.dayLog[d].archived=true;
  });
  // delete today's stale entry so buildDayPlan makes a fresh one
  delete STATE.dayLog[today];
  // save synchronously to Supabase before navigating
  if(LOCAL_MODE){
    localStorage.setItem(localKey(),JSON.stringify(STATE));
  }else if(sb&&USER){
    try{
      await sb.from("progress").upsert({
        user_id:USER.id,state:STATE,updated_at:new Date().toISOString()
      });
    }catch(e){ console.warn("forceNewDay save error",e); }
  }
  toast("Fresh plan for today!");
  switchView("plan");
}

/* ---------------------------------------------------------------------------
   State persistence (Supabase row or localStorage)
--------------------------------------------------------------------------- */
function localKey(){ return "peds_state_"+(USER?USER.email:"anon"); }
async function loadState(){
  if(LOCAL_MODE){
    const raw=localStorage.getItem(localKey());
    STATE = raw?JSON.parse(raw):freshState();
    return;
  }
  const {data,error}=await sb.from("progress").select("state").eq("user_id",USER.id).maybeSingle();
  if(error){ console.warn(error); }
  STATE = (data&&data.state)?data.state:freshState();
}
let saveTimer=null;
function saveState(){
  if(LOCAL_MODE){ localStorage.setItem(localKey(),JSON.stringify(STATE)); return; }
  clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{
    await sb.from("progress").upsert({user_id:USER.id,state:STATE,updated_at:new Date().toISOString()});
  },600);
}

/* ---------------------------------------------------------------------------
   Theme + toast + nav
--------------------------------------------------------------------------- */
function toggleTheme(){
  const cur=document.documentElement.dataset.theme;
  const next=cur==="dark"?"light":"dark";
  document.documentElement.dataset.theme=next;
  localStorage.setItem("theme",next);
}
let toastTimer=null;
function toast(msg){
  const t=$("#toast");t.textContent=msg;t.classList.add("show");
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2200);
}
function switchView(v){
  if(["dashboard","plan","browse","review","mock"].includes(v)){
    $$("#nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===v));
  }
  $$(".view").forEach(s=>s.classList.remove("active"));
  $("#view-"+v).classList.add("active");
  window.scrollTo({top:0,behavior:"smooth"});
  // Archive old plans (not delete) then render
  if(STATE) archiveOldPlans();
  if(v==="dashboard")renderDashboard();
  if(v==="plan")renderPlan();
  if(v==="browse")renderBrowse();
  if(v==="review")renderReview();
  if(v==="mock")renderMock();
}

/* Archive plans from previous days — keeps them for history browsing */
function archiveOldPlans(){
  const today=todayStr(); let changed=false;
  Object.keys(STATE.dayLog||{}).forEach(d=>{
    const log=STATE.dayLog[d];
    if(d<today && log && log.groups && !log.archived){ log.archived=true; changed=true; }
  });
  if(changed) saveState();
}

/* Midnight rollover: detect date change while app is open (Riyadh time) */
let _lastKnownDate=todayStr();
setInterval(async()=>{
  const now=todayStr();
  if(now!==_lastKnownDate){
    _lastKnownDate=now;
    if(STATE){
      await purgeStaleTodayPlan();
      if($("#view-plan").classList.contains("active")) renderPlan();
      toast("New day — your daily plan has been refreshed.");
    }
  }
},60000);

/* ---------------------------------------------------------------------------
   Spaced repetition (Leitner) + scheduling helpers
--------------------------------------------------------------------------- */
const SR_INTERVALS=[1,2,4,8,16,32]; // days by box
function recordResult(id,correct){
  const s=STATE.seen[id]||{attempts:0,correct:0,box:0,lastResult:null,lastSeen:null,nextDue:null};
  s.attempts++;
  if(correct){ s.correct++; s.box=Math.min(s.box+1,SR_INTERVALS.length-1); }
  else{ s.box=0; }
  s.lastResult=correct?"correct":"wrong";
  s.lastSeen=todayStr();
  const iv=SR_INTERVALS[s.box];
  const d=new Date();d.setDate(d.getDate()+iv);
  s.nextDue=d.toISOString().slice(0,10);
  STATE.seen[id]=s;
  
  // Record specialty stats
  recordSpecialtyResult(id, correct);
  
  // wrong loop bookkeeping
  if(!correct){
    const day=todayStr();
    STATE.wrongLoop[day]=STATE.wrongLoop[day]||[];
    if(!STATE.wrongLoop[day].includes(id))STATE.wrongLoop[day].push(id);
  }
  saveState();
}
function isMastered(id){ const s=STATE.seen[id]; return s&&s.box>=3&&s.lastResult==="correct"; }
function dueForReview(){ // spaced-repetition due today
  const t=todayStr();
  return QUESTIONS.filter(q=>{const s=STATE.seen[q.id];return s&&s.nextDue&&s.nextDue<=t;});
}

/* day rollover: collect yesterday's (and earlier) wrong items into the active wrong-loop */
function rolloverDay(){
  STATE.lastActiveDate=todayStr();
  saveState();
}
function pendingWrongLoop(){
  // all wrong items from prior days not yet re-answered correctly since
  const ids=new Set();
  Object.entries(STATE.wrongLoop).forEach(([day,arr])=>{
    if(day<todayStr()) arr.forEach(id=>{
      const s=STATE.seen[id];
      if(!(s&&s.lastResult==="correct"&&s.lastSeen>day)) ids.add(id);
    });
  });
  return [...ids].map(id=>QBY[id]).filter(Boolean);
}

/* ---------------------------------------------------------------------------
   SPECIALTY HELPERS
--------------------------------------------------------------------------- */
/* Get today's scheduled specialty from STUDY_SCHEDULE */
function getTodayScheduleEntry(){
  const PLAN_START = "2026-06-02";
  const dayNum = daysBetween(PLAN_START, todayStr()) + 1; // 1-indexed
  // Clamp to schedule bounds; after day 35 keep using day 35
  const clamped = Math.max(1, Math.min(dayNum, STUDY_SCHEDULE.length));
  return STUDY_SCHEDULE.find(e => e.day === clamped) || STUDY_SCHEDULE[STUDY_SCHEDULE.length - 1];
}

/* Compute specialty accuracy stats live from STATE.seen */
function specialtyAccStats(){
  const map = {};
  QUESTIONS.forEach(q => {
    const sv = STATE.seen[q.id];
    const spec = q.specialty || "General Pediatrics";
    if(!map[spec]) map[spec] = {attempts:0, correct:0, mastered:0, total:0};
    map[spec].total++;
    if(sv){
      map[spec].attempts += sv.attempts;
      map[spec].correct  += sv.correct;
      if(isMastered(q.id)) map[spec].mastered++;
    }
  });
  return map;
}

/* ---------------------------------------------------------------------------
   PLAN POOL  (zone + priority combined)
--------------------------------------------------------------------------- */
function planPool(){
  // Priority order: P1(red) > P2(high_yield) > Tier2 > Tier1
  const zoneOrder = {red:0, high_yield:1, trap:2, common:3};
  const prioOrder = {P1:0, P2:1, Tier2:2, Tier1:3};
  return QUESTIONS
    .filter(q => !isMastered(q.id))
    .sort((a,b) =>
      (prioOrder[a.priority]??3) - (prioOrder[b.priority]??3) ||
      (zoneOrder[a.zone]??3)     - (zoneOrder[b.zone]??3)     ||
      (b.freq_score||0)          - (a.freq_score||0)
    );
}
function remainingDays(){
  const d = daysBetween(todayStr(), FINISH_BY);
  return Math.max(1, d + 1);
}
function dailyQuota(){
  const newLeft = planPool().filter(q => !STATE.seen[q.id]).length;
  const days = remainingDays();
  return Math.max(8, Math.ceil(newLeft / days));
}

/* Pick n unseen questions from a given specialty, sorted by priority+zone */
function pickSpecialtyUnseen(spec, n, exclude){
  const ex = new Set(exclude);
  return planPool()
    .filter(q => q.specialty === spec && !STATE.seen[q.id] && !ex.has(q.id))
    .slice(0, n);
}
/* Pick n unseen questions from a given specialty × priority tier */
function pickSpecialtyPrio(spec, prio, n, exclude){
  const ex = new Set(exclude);
  return planPool()
    .filter(q => q.specialty === spec && q.priority === prio && !STATE.seen[q.id] && !ex.has(q.id))
    .slice(0, n);
}
/* Pick any unmastered (seen or unseen) from a given specialty */
function pickSpecialtyAny(spec, n, exclude){
  const ex = new Set(exclude);
  return planPool()
    .filter(q => q.specialty === spec && !ex.has(q.id))
    .slice(0, n);
}
/* Fill remaining quota from any specialty, unseen, priority-ordered */
function pickNew(n, exclude){
  const ex = new Set(exclude);
  return planPool().filter(q => !STATE.seen[q.id] && !ex.has(q.id)).slice(0, n);
}

/* ---------------------------------------------------------------------------
   BUILD DAY PLAN  (specialty-aware, zone-informed)
--------------------------------------------------------------------------- */
function buildDayPlan(mode){
  const day = todayStr();
  const saved = STATE.dayLog[day];

  // Reuse frozen plan if already built for today
  if(saved && saved.groups && !saved.archived && saved.day === day){
    return _planFromSaved(saved, mode);
  }

  // Determine today's specialty from the 35-day schedule
  const schedEntry  = getTodayScheduleEntry();
  const specialty   = schedEntry.spec;
  const specMeta    = SPECIALTY_META[specialty] || { icon:"📋", color:"spec-gen" };

  const used   = [];
  const groups = [];

  // ── 1. Memory Review (spaced repetition due) ─────────────────────────
  const sr = dueForReview().slice(0, 25);
  sr.forEach(q => used.push(q.id));
  if(sr.length) groups.push({
    key: "memory",
    title: "Memory Review",
    sub:  "Spaced-repetition items due today — do these first",
    icon: "🧠",
    items: sr
  });

  // ── 2. Wrong Loop (prior-day mistakes) ───────────────────────────────
  const wl = pendingWrongLoop().filter(q => !used.includes(q.id)).slice(0, 30);
  wl.forEach(q => used.push(q.id));
  if(wl.length) groups.push({
    key: "wrongloop",
    title: "Wrong Loop",
    sub:  "Questions you missed on a previous day — master them now",
    icon: "🔁",
    items: wl
  });

  // ── 3. Specialty Focus P1 — must-master for today's domain ───────────
  const specP1 = pickSpecialtyPrio(specialty, "P1", 20, used);
  specP1.forEach(q => used.push(q.id));
  if(specP1.length) groups.push({
    key:   "spec_p1",
    title: `${specMeta.icon} ${specialty} — Must Master`,
    sub:   `${specP1.length} P1 priority questions · highest-frequency exam material`,
    icon:  specMeta.icon,
    specialty,
    items: specP1
  });

  // ── 4. Specialty Focus P2 — high-yield supplemental ──────────────────
  const specP2 = pickSpecialtyPrio(specialty, "P2", 12, used);
  specP2.forEach(q => used.push(q.id));
  if(specP2.length) groups.push({
    key:   "spec_p2",
    title: `${specMeta.icon} ${specialty} — High Yield`,
    sub:   `${specP2.length} P2 questions · dense concepts and decision points`,
    icon:  specMeta.icon,
    specialty,
    items: specP2
  });

  // ── 5. Seen-but-unmastered from this specialty ────────────────────────
  const specReview = pickSpecialtyAny(specialty, 8, used)
    .filter(q => STATE.seen[q.id]);
  specReview.forEach(q => used.push(q.id));
  if(specReview.length) groups.push({
    key:   "spec_review",
    title: `🔄 ${specialty} — Reinforce`,
    sub:   `${specReview.length} previously seen questions to drill until mastered`,
    icon:  "🔄",
    specialty,
    items: specReview
  });

  // ── 6. New cross-specialty questions to hit daily quota ───────────────
  const quota      = dailyQuota();
  const specTotal  = specP1.length + specP2.length;
  const fillCount  = Math.max(0, quota - specTotal);
  const fill       = pickNew(fillCount, used);
  fill.forEach(q => used.push(q.id));
  if(fill.length) groups.push({
    key:  "new",
    title: "✨ New Questions",
    sub:  `${fill.length} new questions across all specialties to hit today's target of ${quota}`,
    icon: "✨",
    items: fill
  });

  // Busy Day: only memory + wrongloop + first 15 spec_p1
  const busyP1Ids = specP1.slice(0, 15).map(q => q.id);

  const fudul = fudulSessionForToday();

  // ── FREEZE ────────────────────────────────────────────────────────────
  STATE.dayLog[day] = {
    day,
    specialty,
    schedDay: schedEntry.day,
    landmark: schedEntry.landmark || null,
    fudul,
    used,
    busyP1Ids,
    done: (saved && saved.done) || {},
    groups: groups.map(g => ({
      key:       g.key,
      title:     g.title,
      sub:       g.sub,
      icon:      g.icon,
      specialty: g.specialty || null,
      itemIds:   g.items.map(q => q.id)
    }))
  };
  saveState();
  return _planFromSaved(STATE.dayLog[day], mode);
}

/* Reconstruct a plan object from a frozen dayLog entry, applying mode filter */
function _planFromSaved(saved, mode){
  mode = mode || "full";
  const busyKeys  = new Set(["memory","wrongloop","spec_p1"]);
  const busyP1Ids = new Set(saved.busyP1Ids || []);

  const groups = saved.groups
    .filter(g => mode !== "busy" || busyKeys.has(g.key))
    .map(g => {
      let ids = g.itemIds;
      // Busy Day: cap spec_p1 to pre-selected 15
      if(mode === "busy" && g.key === "spec_p1"){
        ids = ids.filter(id => busyP1Ids.has(id));
      }
      // Relabel for busy
      const title = (mode === "busy" && g.key === "spec_p1")
        ? g.title.replace("— Must Master","— Light Session") : g.title;
      return {
        key:       g.key,
        title,
        sub:       g.sub,
        icon:      g.icon,
        specialty: g.specialty || null,
        items:     ids.map(id => QBY[id]).filter(Boolean)
      };
    })
    .filter(g => g.items.length > 0);

  return {
    day:       saved.day,
    mode,
    specialty: saved.specialty,
    landmark:  saved.landmark || null,
    schedDay:  saved.schedDay || null,
    groups,
    fudul:     saved.fudul || fudulSessionForToday(),
    used:      saved.used || [],
    done:      saved.done || {}
  };
}

/* mark a question complete within today's frozen plan */
function markDayDone(id){
  const day=todayStr();
  const log=STATE.dayLog[day];
  if(log){ log.done=log.done||{}; log.done[id]=true; saveState(); }
}
/* flatten today's plan into an ordered id list (for resume / study-all) */
function todayOrderedIds(){
  const day=todayStr();
  const log=STATE.dayLog[day];
  if(!log||!log.groups) return [];
  const ids=[];
  log.groups.forEach(g=>g.itemIds.forEach(id=>{if(!ids.includes(id))ids.push(id);}));
  return ids;
}
function todayDoneCount(){
  const log=STATE.dayLog[todayStr()];
  if(!log||!log.done) return 0;
  return todayOrderedIds().filter(id=>log.done[id]).length;
}
function regenerateToday(){
  delete STATE.dayLog[todayStr()];
  saveState();
  renderPlan();
}

/* Fudul reminder: rotate a session number so the user does ~1 block/day on fudoul.com */
function fudulSessionForToday(){
  const FUDUL_TOTAL = 677;
  const today = todayStr();
  const daysLeft = Math.max(1, daysBetween(today, FINISH_BY) + 1);
  const doneSoFar = STATE.fudulDone || 0;
  const remaining = Math.max(0, FUDUL_TOTAL - doneSoFar);
  const dailyTarget = Math.max(1, Math.min(remaining, Math.ceil(remaining / daysLeft)));
  const from = doneSoFar + 1;
  const to = Math.min(FUDUL_TOTAL, doneSoFar + dailyTarget);
  const pct = Math.round(doneSoFar / FUDUL_TOTAL * 100);
  const doneToday = (STATE.fudulDoneDate === today);
  return {
    label: `Fudul Q-bank — Questions ${from}–${to} today (${dailyTarget} questions)`,
    note: `${doneSoFar}/${FUDUL_TOTAL} done (${pct}%) · ${remaining} remaining · ${daysLeft} days left. Practice on fudoul.com then mark done below.`,
    url: "https://fudoul.com/exams/residency/pediatric",
    from, to, dailyTarget, doneSoFar, total: FUDUL_TOTAL, pct, doneToday
  };
}
function toggleFudulDone(){
  const f=fudulSessionForToday();
  if(!STATE.fudulDone) STATE.fudulDone=0;
  const alreadyDoneToday=(STATE.fudulDoneDate===todayStr());
  if(alreadyDoneToday){
    // unmark — subtract today's batch
    STATE.fudulDone=Math.max(0,STATE.fudulDone-f.dailyTarget);
    STATE.fudulDoneDate=null;
    saveState(); renderPlan();
    toast(`Fudul unmarked — back to ${STATE.fudulDone}/${f.total}`);
  }else{
    // mark done
    STATE.fudulDone=Math.min(f.total,STATE.fudulDone+f.dailyTarget);
    STATE.fudulDoneDate=todayStr();
    saveState(); renderPlan();
    toast(`Fudul done ✓ — ${STATE.fudulDone}/${f.total} total`);
  }
}
function resetFudul(){
  if(!confirm("Reset Fudul progress back to 0?")) return;
  STATE.fudulDone=0; STATE.fudulDoneDate=null;
  saveState(); renderPlan();
}

/* ---- Edit helpers ---- */
function getEdit(id){ return (STATE.edits||{})[id]||{}; }
function effectiveAnswer(q){
  const e=getEdit(q.id);
  return e.answer||q.answer;
}
function effectiveStem(q){
  const e=getEdit(q.id);
  return e.stem!==undefined?e.stem:q.stem;
}
function hasEdits(id){
  const e=getEdit(id);
  return !!(e.answer||e.stem!==undefined||e.notes);
}

function openEditModal(id){
  const q=QBY[id]; if(!q) return;
  const e=getEdit(id);
  const backdrop=document.createElement('div');
  backdrop.className='modal-backdrop';
  backdrop.id='editBackdrop';
  backdrop.onclick=function(ev){if(ev.target===backdrop)closeEditModal();};
  const opts=q.options.map(o=>`<option value="${o.label}" ${(e.answer||q.answer).startsWith(o.label)?'selected':''}>${o.label}. ${esc(o.text)}</option>`).join('');
  backdrop.innerHTML=`<div class="modal">
    <h2>✏️ Edit Question <span style="font-size:15px;color:var(--ink-soft);font-weight:500">${q.year} · Q${q.number}</span></h2>

    <div class="modal-field">
      <label>Correct answer</label>
      <select id="editAns">${opts}</select>
      <div style="font-size:12.5px;color:var(--ink-soft);margin-top:6px">Original file answer: <b>${esc(q.answer)}</b></div>
    </div>

    <div class="modal-field">
      <label>Question stem (edit to fix typos or clarify)</label>
      <textarea id="editStem" rows="4">${esc(e.stem!==undefined?e.stem:q.stem)}</textarea>
    </div>

    <div class="modal-field">
      <label>My notes (hidden until you tap "Show my notes")</label>
      <textarea id="editNotes" placeholder="Your mnemonics, corrections, clinical pearls…" rows="4">${esc(e.notes||'')}</textarea>
    </div>

    <div class="modal-foot">
      ${hasEdits(id)?`<button class="btn ghost" onclick="clearEdit('${id}')">↩ Restore original</button>`:''}
      <button class="btn ghost" onclick="closeEditModal()">Cancel</button>
      <button class="btn" onclick="saveEdit('${id}')">Save changes</button>
    </div>
  </div>`;
  document.body.appendChild(backdrop);
}
function closeEditModal(){
  const b=document.getElementById('editBackdrop');
  if(b) b.remove();
}
function saveEdit(id){
  const q=QBY[id]; if(!q) return;
  if(!STATE.edits) STATE.edits={};
  const ansVal=document.getElementById('editAns').value;
  const stemVal=document.getElementById('editStem').value.trim();
  const notesVal=document.getElementById('editNotes').value.trim();
  const ansLabel=ansVal;
  const ansText=q.options.find(o=>o.label===ansLabel)?.text||'';
  STATE.edits[id]={
    answer: ansLabel!== (q.answer.match(/^([A-G])/)||[])[1] ? `${ansLabel}. ${ansText}` : '',
    stem: stemVal!==q.stem ? stemVal : undefined,
    notes: notesVal
  };
  // clean up empty edits
  const e=STATE.edits[id];
  if(!e.answer && e.stem===undefined && !e.notes) delete STATE.edits[id];
  saveState();
  closeEditModal();
  // re-render current question if in runner
  if(document.getElementById('view-runner').classList.contains('active')) renderRunner();
  toast("Saved ✓");
}
function clearEdit(id){
  if(STATE.edits) delete STATE.edits[id];
  saveState();
  closeEditModal();
  if(document.getElementById('view-runner').classList.contains('active')) renderRunner();
  toast("Restored to original");
}
function toggleUserNote(id){
  const el=document.getElementById('userNote_'+id);
  if(!el) return;
  const hidden=el.style.display==='none'||!el.style.display;
  el.style.display=hidden?'block':'none';
  const btn=document.getElementById('noteBtn_'+id);
  if(btn) btn.textContent=hidden?'▲ Hide my notes':'📝 Show my notes';
}

/* ============================================================================
   VIEWS
   ============================================================================ */
const ZONE_LABEL={red:"Red Zone",high_yield:"High-Yield",trap:"Trap",common:"Common"};
const DIFF_LABEL={green:"Easier",yellow:"Moderate",red:"Hard"};

function esc(s){return (s||"").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));}
function zonePill(q){return `<span class="pill ${q.zone}">${ZONE_LABEL[q.zone]}</span>`;}
function diffDot(q){return `<span class="dot-diff ${q.difficulty}" title="${DIFF_LABEL[q.difficulty]}"></span>`;}
function tagPills(q){
  return (q.tags||[]).filter(t=>t!==q.zone).map(t=>`<span class="pill ${t}">${ZONE_LABEL[t]||t}</span>`).join("");
}
function specialtyPill(spec){
  const m = SPECIALTY_META[spec] || {icon:"📋", color:"spec-gen"};
  return `<span class="pill spec ${m.color}">${m.icon} ${esc(spec)}</span>`;
}
function priorityPill(prio){
  const map = {P1:"pill-p1",P2:"pill-p2",Tier1:"pill-tier1",Tier2:"pill-tier2"};
  return `<span class="pill ${map[prio]||'common'}">${esc(prio)}</span>`;
}

/* ---------- progress maths ---------- */
function stats(){
  const total=QUESTIONS.length;
  const seen=Object.keys(STATE.seen).length;
  const mastered=QUESTIONS.filter(q=>isMastered(q.id)).length;
  const attempts=Object.values(STATE.seen).reduce((a,s)=>a+s.attempts,0);
  const corrects=Object.values(STATE.seen).reduce((a,s)=>a+s.correct,0);
  const acc=attempts?Math.round(corrects/attempts*100):0;
  const byZone={};
  ["red","high_yield","trap","common"].forEach(z=>{
    const qs=QUESTIONS.filter(q=>q.zone===z);
    byZone[z]={total:qs.length,mastered:qs.filter(q=>isMastered(q.id)).length};
  });
  const bySpecialty = specialtyAccStats();
  return {total,seen,mastered,acc,attempts,byZone,bySpecialty,
    pct:Math.round(mastered/total*100), daysLeft:daysBetween(todayStr(),EXAM_DATE)};
}

/* ============================================================================
   DASHBOARD  (Today)
   ============================================================================ */
function renderDashboard(){
  const s=stats();
  const wl=pendingWrongLoop().length;
  const due=dueForReview().length;
  const coach=coachAdvice(s);
  const el=$("#view-dashboard");

  // Detect stale plan
  const today=todayStr();
  const hasStale=Object.entries(STATE.dayLog||{}).some(([d,log])=>
    log&&log.groups&&!log.archived&&d!==today);
  const hasTodayPlan=STATE.dayLog&&STATE.dayLog[today]&&STATE.dayLog[today].groups&&!STATE.dayLog[today].archived;

  // Today's schedule entry
  const sched = getTodayScheduleEntry();
  const specMeta = SPECIALTY_META[sched.spec] || {icon:"📋", color:"spec-gen"};

  // Top 5 specialties by question count for mastery display
  const specList = SPECIALTIES.map(sp => {
    const b = s.bySpecialty[sp] || {total:0,mastered:0,attempts:0,correct:0};
    const qs = QUESTIONS.filter(q=>q.specialty===sp);
    const tot = qs.length;
    const mast = qs.filter(q=>isMastered(q.id)).length;
    const acc = b.attempts ? Math.round(b.correct/b.attempts*100) : null;
    return {sp, tot, mast, acc, pct: tot ? Math.round(mast/tot*100) : 0};
  }).sort((a,b) => b.tot - a.tot).slice(0,8);

  el.innerHTML=`
  <div class="page-head">
    <div class="eyebrow">${new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</div>
    <h1>Today's Focus</h1>
    <p>${s.daysLeft} days until the exam (July 7, 2026). Plan finishes by July 6. Skipped days are absorbed ahead.</p>
  </div>

  ${hasStale||!hasTodayPlan?`
  <div style="background:var(--gold-bg);border:1px solid color-mix(in srgb,var(--gold) 30%,transparent);border-radius:12px;padding:16px 18px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">
    <div>
      <b style="color:var(--gold)">📅 New day detected</b>
      <div style="font-size:14px;color:var(--ink-soft);margin-top:3px">A stale plan from a previous day is still active. Tap to generate today's fresh plan.</div>
    </div>
    <button class="btn" onclick="forceNewDay()" style="flex-shrink:0">Generate today's plan →</button>
  </div>`:""}

  <!-- Today's Specialty Banner -->
  <div class="specialty-banner spec-banner-${specMeta.color}" style="margin-bottom:20px">
    <div class="spec-banner-icon">${specMeta.icon}</div>
    <div class="spec-banner-body">
      <div class="spec-banner-eyebrow">Day ${sched.day} of 35 · Today's specialty focus</div>
      <div class="spec-banner-title">${esc(sched.spec)}</div>
      ${sched.landmark?`<div class="spec-banner-landmark">${esc(sched.landmark)}</div>`:""}
    </div>
    <button class="btn sm" onclick="switchView('plan')" style="flex-shrink:0;align-self:center">Start studying →</button>
  </div>

  <div class="stat-row">
    <div class="card stat"><div class="k">Questions seen</div><div class="v">${s.seen}<small>/${s.total}</small></div>
      <div class="progress-bar"><span style="width:${Math.round(s.seen/s.total*100)}%"></span></div></div>
    <div class="card stat"><div class="k">Accuracy</div><div class="v">${s.acc}<small>%</small></div></div>
    <div class="card stat"><div class="k">Mastered <span style="font-size:12px;font-weight:400;color:var(--ink-soft)">(box ≥3)</span></div><div class="v">${s.mastered}<small>/${s.total}</small></div>
      <div class="progress-bar"><span style="width:${s.pct}%"></span></div></div>
    <div class="card stat"><div class="k">Days left</div><div class="v">${s.daysLeft}</div></div>
  </div>

  <div class="two-col">
    <div>
      <div class="card coach">
        <h3>🩺 Your Coach</h3>
        <div class="msg">${coach.message}</div>
        <ul class="advice">${coach.advice.map(a=>`<li>${a}</li>`).join("")}</ul>
      </div>

      <div class="section-divider"><span>Start studying</span></div>
      <div class="grid" style="grid-template-columns:1fr 1fr">
        <div class="card stat" style="cursor:pointer" onclick="startDayMode('full')">
          <div class="k">Full Day Mode</div>
          <div class="v" style="font-size:22px;margin-top:6px">Complete plan</div>
          <p style="color:var(--ink-soft);font-size:13.5px;margin-top:6px">Memory · wrong loop · specialty focus · new</p>
        </div>
        <div class="card stat" style="cursor:pointer" onclick="startDayMode('busy')">
          <div class="k">Busy Day Mode</div>
          <div class="v" style="font-size:22px;margin-top:6px">Light session</div>
          <p style="color:var(--ink-soft);font-size:13.5px;margin-top:6px">Memory · wrong loop · 15 P1 specialty Qs</p>
        </div>
      </div>
    </div>

    <div>
      <div class="card stat">
        <div class="k">Needs attention</div>
        <div style="margin-top:14px;display:flex;flex-direction:column;gap:12px">
          <div style="display:flex;justify-content:space-between"><span>🔁 Wrong-loop pending</span><b>${wl}</b></div>
          <div style="display:flex;justify-content:space-between"><span>🧠 Memory review due</span><b>${due}</b></div>
          <div style="display:flex;justify-content:space-between"><span>⭐ Saved for review</span><b>${Object.keys(STATE.review).length}</b></div>
        </div>
      </div>

      <div class="card stat" style="margin-top:18px">
        <div class="k">Specialty mastery</div>
        <div style="margin-top:14px;display:flex;flex-direction:column;gap:11px">
          ${specList.map(b=>{
            const m = SPECIALTY_META[b.sp]||{icon:"📋"};
            return `<div>
              <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:4px;align-items:center">
                <span>${m.icon} <b>${esc(b.sp)}</b></span>
                <span style="color:var(--ink-soft)">${b.mast}/${b.tot}${b.acc!==null?` · ${b.acc}%`:''}</span>
              </div>
              <div class="progress-bar"><span style="width:${b.pct}%"></span></div>
            </div>`;
          }).join("")}
        </div>
      </div>
    </div>
  </div>`;
}

/* ============================================================================
   RULE-BASED COACH
   ============================================================================ */
function coachAdvice(s){
  const advice=[];
  const wl=pendingWrongLoop().length;
  const due=dueForReview().length;
  const daysLeft=s.daysLeft;
  const pace=Math.ceil((s.total-s.mastered)/Math.max(1,daysBetween(todayStr(),FINISH_BY)+1));
  let message="";

  if(s.seen===0){
    message=`<p>Welcome. You have <b>${s.total} board questions</b> drawn from the 2021–2025 Part 1 papers, and <b>${daysLeft} days</b> before the exam.</p>
    <p>Start with <b>Full Day Mode</b> today so I can learn your accuracy and tune the plan. The red zone is your highest-frequency, must-master material — we lead with it every day.</p>`;
    advice.push("Begin with Full Day Mode to calibrate your baseline.");
    advice.push(`Aim for about ${pace} questions/day to finish by July 6 with a buffer.`);
    advice.push("Use the ⭐ Review button on anything you want to revisit.");
    return {message,advice};
  }

  // pacing assessment
  const onTrack = pace<=dailyQuota()+4;
  if(daysLeft>30){
    message=`<p>You've mastered <b>${s.mastered}/${s.total}</b> (${s.pct}%) at <b>${s.acc}% accuracy</b>. Solid base-building phase — depth over speed right now.</p>`;
  }else if(daysLeft>10){
    message=`<p><b>${daysLeft} days out.</b> Mastery ${s.pct}%, accuracy ${s.acc}%. This is the consolidation window — tighten the red zone and clear the wrong loop daily.</p>`;
  }else{
    message=`<p><b>Final stretch — ${daysLeft} days.</b> Mastery ${s.pct}%. Switch to review-heavy days: memory review + wrong loop first, then red zone. Avoid cramming brand-new low-yield material now.</p>`;
  }

  // targeted advice
  if(wl>0) advice.push(`Clear your <b>wrong loop (${wl})</b> first today — repeated misses are where points leak.`);
  if(due>0) advice.push(`<b>${due}</b> spaced-repetition items are due — doing them today locks them into long-term memory.`);
  // weakest specialty by accuracy (min 5 attempts)
  const specStats = specialtyAccStats();
  const weakSpecs = Object.entries(specStats)
    .filter(([,v])=>v.attempts>=5)
    .map(([sp,v])=>({sp, acc: v.correct/v.attempts}))
    .sort((a,b)=>a.acc-b.acc);
  if(weakSpecs.length && weakSpecs[0].acc<0.70){
    const m = SPECIALTY_META[weakSpecs[0].sp]||{icon:"📋"};
    advice.push(`Weakest specialty: ${m.icon} <b>${weakSpecs[0].sp}</b> (${Math.round(weakSpecs[0].acc*100)}%). Filter the Question Bank to this specialty and drill it.`);
  }
  // weakest zone fallback
  const zoneAcc=["red","high_yield","trap","common"].map(z=>{
    const qs=QUESTIONS.filter(q=>q.zone===z&&STATE.seen[q.id]);
    const at=qs.reduce((a,q)=>a+STATE.seen[q.id].attempts,0);
    const co=qs.reduce((a,q)=>a+STATE.seen[q.id].correct,0);
    return {z,acc:at?co/at:1,seen:qs.length};
  }).filter(x=>x.seen>=3).sort((a,b)=>a.acc-b.acc);
  if(zoneAcc.length&&zoneAcc[0].acc<0.65&&weakSpecs.length===0){
    advice.push(`Weakest zone: <b>${ZONE_LABEL[zoneAcc[0].z]}</b> (${Math.round(zoneAcc[0].acc*100)}%). Re-read the explanations and source snapshots.`);
  }
  if(!onTrack){
    advice.push(`You're slightly behind pace (need ~${pace}/day). A couple of Full Day sessions will catch you up — the plan already front-loads red zone.`);
  }else{
    advice.push(`Pace looks good — about ${pace} questions/day keeps your July 6 finish with buffer.`);
  }
  if(s.acc>=85) advice.push("Accuracy is strong — add a Mock Exam this week to test under time pressure.");
  if(advice.length<2) advice.push("Keep a steady daily rhythm; consistency beats long irregular sessions.");

  return {message,advice};
}

/* ============================================================================
   DAILY PLAN VIEW
   ============================================================================ */
let currentPlanMode="full";
function renderPlan(){
  const plan=buildDayPlan(currentPlanMode);
  const log=STATE.dayLog[plan.day]||{done:{}};
  const done=log.done||{};
  const el=$("#view-plan");
  const allIds=plan.groups.flatMap(g=>g.items.map(q=>q.id));
  const totalQ=allIds.length;
  const doneQ=allIds.filter(id=>done[id]).length;
  const remaining=totalQ-doneQ;
  const pct=totalQ?Math.round(doneQ/totalQ*100):0;
  const newTodayCount=plan.groups
    .filter(g=>['spec_p1','spec_p2','new'].includes(g.key))
    .flatMap(g=>g.items).filter(q=>!STATE.seen[q.id]).length;
  const specMeta=SPECIALTY_META[plan.specialty]||{icon:"\u{1f4cb}",color:"spec-gen"};

  el.innerHTML=`
  <div class="page-head">
    <div class="eyebrow">Adaptive Plan \u00b7 ${remainingDays()} study days to finish</div>
    <h1>Daily Plan</h1>
    <p>Auto-balanced toward your July 6 finish. Skipped days redistribute the load forward.</p>
  </div>

  <div class="specialty-banner spec-banner-${specMeta.color}" style="margin-bottom:18px">
    <div class="spec-banner-icon">${specMeta.icon}</div>
    <div class="spec-banner-body">
      <div class="spec-banner-eyebrow">Day ${plan.schedDay||'\u2014'} of 35 \u00b7 Today\u2019s specialty</div>
      <div class="spec-banner-title">${esc(plan.specialty||'\u2014')}</div>
      ${plan.landmark?`<div class="spec-banner-landmark">${esc(plan.landmark)}</div>`:""}
    </div>
    <button class="btn ghost sm" onclick="document.getElementById('cal-section').scrollIntoView({behavior:'smooth'})" style="flex-shrink:0;align-self:center">\uD83D\uDCC5 View schedule</button>
  </div>

  <div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:18px">
    <div class="mode-switch">
      <button class="${currentPlanMode==='full'?'active':''}" onclick="setPlanMode('full')">Full Day</button>
      <button class="${currentPlanMode==='busy'?'active':''}" onclick="setPlanMode('busy')">Busy Day</button>
    </div>
    <div style="color:var(--ink-soft);font-size:14.5px"><b style="color:var(--ink)">${newTodayCount} new</b> \u00b7 ${totalQ} total today</div>
  </div>

  <div class="card stat" style="margin-bottom:18px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <div>
        <div class="k">Today\u2019s progress</div>
        <div class="v" style="font-size:26px;margin-top:4px">${doneQ}<small>/${totalQ}</small> <span style="font-size:15px;color:var(--ink-soft)">\u00b7 ${remaining} left</span></div>
      </div>
      <div style="display:flex;gap:9px">
        ${remaining>0
          ? `<button class="btn" onclick="resumeToday()">${doneQ>0?'Resume where I left off \u2192':'Start today\u2019s plan \u2192'}</button>`
          : `<span class="pill common">\u2713 All done \u2014 great work</span>`}
        <button class="btn ghost sm" onclick="confirmRegenToday()" title="Rebuild today's plan from scratch">\u21bb New plan</button>
      </div>
    </div>
    <div class="progress-bar" style="margin-top:14px"><span style="width:${pct}%"></span></div>
  </div>

  ${plan.fudul?`
  <div class="card" style="margin-bottom:18px;padding:18px 20px;border-left:4px solid var(--gold)">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:16px;color:var(--gold);margin-bottom:4px">\u2b50 ${esc(plan.fudul.label)}</div>
        <div style="font-size:13.5px;color:var(--ink-soft);margin-bottom:10px">${esc(plan.fudul.note)}</div>
        <div class="progress-bar" style="height:7px"><span style="width:${plan.fudul.pct}%"></span></div>
        <div style="font-size:12px;color:var(--ink-soft);margin-top:5px">${plan.fudul.doneSoFar} of ${plan.fudul.total} questions completed</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0;align-items:flex-end">
        <a href="${plan.fudul.url}" target="_blank" rel="noopener" class="btn ghost sm">Open fudoul.com \u2192</a>
        ${plan.fudul.doneSoFar<plan.fudul.total?
          `<button class="btn sm" onclick="toggleFudulDone()" style="background:${plan.fudul.doneToday?'var(--green)':'var(--gold)'};border-color:${plan.fudul.doneToday?'var(--green)':'var(--gold)'}">
            ${plan.fudul.doneToday?'\u2713 Done today (tap to undo)':'Mark today done ('+plan.fudul.from+'\u2013'+plan.fudul.to+')'}
          </button>`
          :`<span class="pill common">\u2713 All ${plan.fudul.total} done!</span>`}
        ${plan.fudul.doneSoFar>0?`<button class="btn ghost sm" style="font-size:12px;color:var(--ink-soft)" onclick="resetFudul()">\u21a9 Reset</button>`:''}
      </div>
    </div>
  </div>`:""}

  ${plan.groups.map(g=>{
    const ids=g.items.map(q=>q.id);
    const gd=ids.filter(id=>done[id]).length;
    const gleft=ids.length-gd;
    const complete=gleft===0&&ids.length>0;
    return `
    <div class="task-group">
      <div class="tg-head"><h3>${g.icon} ${g.title}</h3><span class="count">\u00b7 ${gd} of ${ids.length} done</span></div>
      <div style="color:var(--ink-soft);font-size:14px;margin:-6px 0 12px">${g.sub}</div>
      <div class="tasklist">
        ${ids.length?`
        <div class="task ${complete?'done':''}">
          <div class="check ${complete?'on':''}">${complete?'\u2713':''}</div>
          <div class="t-body">
            <div class="t-title">${g.title} set</div>
            <div class="t-sub">${gd} completed \u00b7 ${gleft} remaining</div>
          </div>
          ${complete
            ?`<button class="btn ghost sm t-go" onclick='runGroupResume(${JSON.stringify(g.key)}, ${JSON.stringify(ids)})'>Review again</button>`
            :`<button class="btn sm t-go" onclick='runGroupResume(${JSON.stringify(g.key)}, ${JSON.stringify(ids)})'>${gd>0?'Continue \u2192':'Study \u2192'}</button>`}
        </div>`:`<div style="color:var(--ink-soft);font-size:14px;padding:8px 2px">Nothing pending here today. \uD83C\uDF89</div>`}
      </div>
    </div>`;}).join("")}

  <div style="margin-top:10px">
    <button class="btn" onclick="resumeToday()">${remaining>0?'Continue entire plan \u2192':'Review entire plan \u2192'}</button>
  </div>

  <div class="section-divider" style="margin-top:28px" id="cal-section"><span>35-day study calendar</span></div>
  ${renderCalendar()}

  ${renderPastDaysSlider()}`;
}
/* ============================================================================
   35-DAY STUDY CALENDAR
   ============================================================================ */
function renderCalendar(){
  const PLAN_START = "2026-06-02";
  const today = todayStr();

  const weeks = [];
  let week = [];
  STUDY_SCHEDULE.forEach((entry, i) => {
    const dateObj = new Date(PLAN_START + "T12:00:00");
    dateObj.setDate(dateObj.getDate() + entry.day - 1);
    const dateStr = dateObj.toISOString().slice(0,10);
    const isToday = dateStr === today;
    const isPast  = dateStr < today;
    const log = STATE.dayLog[dateStr];
    const allIds = log && log.groups ? log.groups.flatMap(g=>g.itemIds||[]) : [];
    const doneIds = log && log.done ? allIds.filter(id=>log.done[id]) : [];
    const pct = allIds.length ? Math.round(doneIds.length/allIds.length*100) : 0;
    const complete = allIds.length>0 && doneIds.length===allIds.length;
    const m = SPECIALTY_META[entry.spec]||{icon:"📋",color:"spec-gen"};
    const dayLabel = dateObj.toLocaleDateString(undefined,{month:'short',day:'numeric'});

    week.push({...entry, dateStr, isToday, isPast, pct, complete, allIds, doneIds, m, dayLabel});
    if(week.length===7 || i===STUDY_SCHEDULE.length-1){
      weeks.push(week);
      week=[];
    }
  });

  const calHTML = weeks.map((wk, wi) => `
    <div class="cal-week">
      ${wk.map(d=>`
        <div class="cal-cell ${d.isToday?'today':''} ${d.isPast?'past':''} ${d.complete?'done':''} spec-cell-${d.m.color}"
             title="Day ${d.day}: ${d.spec}${d.landmark?' · '+d.landmark:''}\n${d.dayLabel}${d.allIds.length?' · '+d.doneIds.length+'/'+d.allIds.length+' done':''}">
          <div class="cal-daynum">${d.day}</div>
          <div class="cal-icon">${d.m.icon}</div>
          <div class="cal-date">${d.dayLabel}</div>
          ${d.landmark?`<div class="cal-lm">${d.landmark.split(' ').slice(0,2).join(' ')}</div>`:''}
          ${d.allIds.length>0?`
            <div class="cal-prog">
              <div class="cal-prog-bar" style="width:${d.pct}%"></div>
            </div>`:''}
          ${d.isToday?'<div class="cal-today-dot"></div>':''}
          ${d.complete?'<div class="cal-done-badge">\u2713</div>':''}
        </div>`).join("")}
    </div>`).join("");

  // Legend
  const seen = new Set(STUDY_SCHEDULE.map(e=>e.spec));
  const legendHTML = [...seen].map(sp=>{
    const m = SPECIALTY_META[sp]||{icon:"📋",color:"spec-gen"};
    return `<div class="cal-legend-item">
      <span class="cal-legend-swatch spec-cell-${m.color}">${m.icon}</span>
      <span>${esc(sp)}</span>
    </div>`;
  }).join("");

  return `<div class="cal-wrap">
    <div class="cal-grid">${calHTML}</div>
    <div class="cal-legend">${legendHTML}</div>
  </div>`;
}

function renderPastDaysSlider(){
  const pastDays=Object.entries(STATE.dayLog||{})
    .filter(([d,log])=>d<todayStr()&&log&&log.groups&&log.archived)
    .sort((a,b)=>b[0].localeCompare(a[0]))
    .slice(0,30);
  if(!pastDays.length) return "";
  const chips=pastDays.map(([d,log])=>{
    const allIds=log.groups.flatMap(g=>g.itemIds||[]);
    const doneCount=Object.keys(log.done||{}).filter(id=>allIds.includes(id)).length;
    const total=allIds.length;
    const pct=total?Math.round(doneCount/total*100):0;
    const complete=doneCount===total&&total>0;
    const label=new Date(d+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
    return `<div class="past-chip ${complete?'complete':'incomplete'}" onclick='openPastDay("${d}")'>
      <div class="chip-date">${label}</div>
      <div class="chip-pct">${pct}%</div>
      <div class="chip-status" style="color:${complete?'var(--green)':'var(--yellow)'}">${complete?'✓ Done':'⚠ Incomplete'}</div>
    </div>`;
  }).join("");
  return `<div class="past-slider-wrap">
    <div class="past-slider-label">Previous days</div>
    <div class="past-slider">${chips}</div>
  </div>`;
}

function openPastDay(d){
  const log=STATE.dayLog[d];
  if(!log||!log.groups){ toast("No plan data for that day."); return; }
  const done=log.done||{};
  const allIds=log.groups.flatMap(g=>g.itemIds||[]);
  const doneCount=allIds.filter(id=>done[id]).length;
  const total=allIds.length;
  const pct=total?Math.round(doneCount/total*100):0;
  const label=new Date(d+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
  const el=$("#view-pastday");
  el.innerHTML=`
  <div class="page-head">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <button class="btn ghost sm" onclick="switchView('plan')">← Back to plan</button>
    </div>
    <div class="eyebrow">Past Day Review</div>
    <h1>${label}</h1>
    <p>${doneCount} of ${total} questions completed (${pct}%)</p>
  </div>
  <div class="card stat" style="margin-bottom:20px">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div>
        <div class="k">Day progress</div>
        <div class="v" style="font-size:26px;margin-top:4px">${doneCount}<small>/${total}</small></div>
      </div>
      <div style="display:flex;gap:9px">
        <button class="btn" onclick='runPastDayAll("${d}")'>Study all questions →</button>
        <button class="btn ghost" onclick='runPastDayRemaining("${d}")'>Study incomplete →</button>
      </div>
    </div>
    <div class="progress-bar" style="margin-top:14px"><span style="width:${pct}%"></span></div>
  </div>
  ${log.groups.map(g=>{
    const ids=(g.itemIds||[]).filter(id=>QBY[id]);
    const gd=ids.filter(id=>done[id]).length;
    const complete=gd===ids.length&&ids.length>0;
    return `<div class="task-group">
      <div class="tg-head"><h3>${g.icon||'📋'} ${g.title}</h3><span class="count">· ${gd} of ${ids.length} done</span></div>
      <div class="tasklist" style="margin-top:10px">
        <div class="task ${complete?'done':''}">
          <div class="check ${complete?'on':''}">${complete?'✓':''}</div>
          <div class="t-body">
            <div class="t-title">${g.title}</div>
            <div class="t-sub">${gd} completed · ${ids.length-gd} remaining</div>
          </div>
          <button class="btn sm t-go" onclick='runPastGroup("${d}","${g.key}")'>
            ${complete?'Review again':'Continue →'}
          </button>
        </div>
      </div>
    </div>`;
  }).join("")}`;
  // register view in nav so switchView works
  $$(".view").forEach(s=>s.classList.remove("active"));
  el.classList.add("active");
  window.scrollTo({top:0,behavior:"smooth"});
}
function runPastDayAll(d){
  const log=STATE.dayLog[d]; if(!log) return;
  const ids=log.groups.flatMap(g=>g.itemIds||[]).filter(id=>QBY[id]);
  runnerCtx={ids,idx:0,key:'past_'+d,answered:{},origin:"pastday",pastDay:d};
  switchView("runner"); renderRunner();
}
function runPastDayRemaining(d){
  const log=STATE.dayLog[d]; if(!log) return;
  const done=log.done||{};
  const ids=log.groups.flatMap(g=>g.itemIds||[]).filter(id=>QBY[id]&&!done[id]);
  if(!ids.length){ toast("All questions already completed for that day!"); return; }
  runnerCtx={ids,idx:0,key:'past_'+d,answered:{},origin:"pastday",pastDay:d};
  switchView("runner"); renderRunner();
}
function runPastGroup(d,key){
  const log=STATE.dayLog[d]; if(!log) return;
  const g=log.groups.find(g=>g.key===key); if(!g) return;
  const ids=(g.itemIds||[]).filter(id=>QBY[id]);
  runnerCtx={ids,idx:0,key:'past_'+d+'_'+key,answered:{},origin:"pastday",pastDay:d};
  switchView("runner"); renderRunner();
}
function setPlanMode(m){currentPlanMode=m;renderPlan();}
function startDayMode(m){currentPlanMode=m;switchView("plan");}
function confirmRegenToday(){
  if(confirm("Rebuild today's plan from scratch? Your answered questions stay saved, but today's list will be regenerated and progress markers reset.")){
    regenerateToday();
  }
}

/* ============================================================================
   QUESTION RUNNER
   ============================================================================ */
function runGroup(key,ids){
  ids=ids.filter(id=>QBY[id]);
  if(!ids.length){toast("Nothing to study here right now.");return;}
  runnerCtx={ids,idx:0,key,answered:{},origin:"plan"};
  switchView("runner");
  renderRunner();
}
/* run a group but jump to the first question not yet completed today */
function runGroupResume(key,ids){
  ids=ids.filter(id=>QBY[id]);
  if(!ids.length){toast("Nothing to study here right now.");return;}
  const log=STATE.dayLog[todayStr()]||{done:{}};
  const done=log.done||{};
  let start=ids.findIndex(id=>!done[id]);
  if(start<0) start=0;  // all done → allow review from the top
  runnerCtx={ids,idx:start,key,answered:{},origin:"plan"};
  switchView("runner");
  renderRunner();
}
function runList(ids,origin){
  ids=ids.filter(id=>QBY[id]);
  if(!ids.length){toast("No questions.");return;}
  runnerCtx={ids,idx:0,key:origin,answered:{},origin};
  switchView("runner");
  renderRunner();
}
/* Resume today's plan: run the full ordered day list, jumping to first not-done */
function resumeToday(){
  const ids=todayOrderedIds();
  if(!ids.length){toast("No plan yet — tap a Study button to begin.");return;}
  const log=STATE.dayLog[todayStr()]||{done:{}};
  let start=ids.findIndex(id=>!(log.done&&log.done[id]));
  if(start<0) start=0;  // all done → start at top for review
  runnerCtx={ids,idx:start,key:"all",answered:{},origin:"plan"};
  switchView("runner");
  renderRunner();
}
function renderRunner(){
  const {ids,idx}=runnerCtx;
  const q=QBY[ids[idx]];
  const el=$("#view-runner");
  const saved=STATE.review[q.id];
  const figs=(q.snapshots||[]).map(s=>ASSET_BASE+s);
  el.innerHTML=`
  <div class="runner-top">
    <button class="btn ghost sm" onclick="exitRunner()">← Back</button>
    <div class="runner-progress">Question ${idx+1} of ${ids.length}</div>
    <div style="display:flex;gap:8px;align-items:center">
      <button class="editbtn" onclick="openEditModal('${q.id}')">✏️ Edit${hasEdits(q.id)?'<span class=\"edit-badge\">edited</span>':''}</button>
      <button class="btn ghost sm reviewbtn ${saved?'on':''}" id="revBtn" onclick="toggleReview('${q.id}')">${saved?'★ Saved':'☆ Review'}</button>
    </div>
  </div>

  <div class="card q-card">
    <div class="q-meta">
      ${zonePill(q)} ${tagPills(q)}
      <span class="pill common">${diffDot(q)} &nbsp;${DIFF_LABEL[q.difficulty]}</span>
    </div>

    <div class="q-stem">${esc(effectiveStem(q))}</div>

    ${q.question_image?`<div class="q-figure"><img loading="lazy" src="${ASSET_BASE+q.question_image}" alt="figure for this question"><div class="cap">Figure shown with this question (from ${q.year} source)</div></div>`:""}

    <div class="options" id="opts">
      ${q.options.map(o=>`
        <div class="option" data-lab="${o.label}" onclick="answer('${q.id}','${o.label}')">
          <div class="lab">${o.label}</div><div class="otext">${esc(o.text)}</div>
        </div>`).join("")}
    </div>

    <div class="explain" id="explain">
      <h4>Explanation</h4>
      <div class="ans" id="ansLine"></div>
      <div class="etext">${q.explanation?esc(q.explanation):'<span style="color:var(--ink-soft)">No written explanation was provided for this question in the source file. Check the original page below for any figure or context.</span>'}</div>
      ${(()=>{const e=getEdit(q.id);return e&&e.notes?`<div style="margin-top:14px"><button class="btn ghost sm" id="noteBtn_${q.id}" onclick="toggleUserNote('${q.id}')">📝 Show my notes</button><div id="userNote_${q.id}" style="display:none;margin-top:10px" class="user-note"><div class="note-label">My notes</div><div class="note-body">${esc(e.notes)}</div></div></div>`:''})()}
      <div class="snap-toggle">
        <button class="btn ghost sm" onclick="toggleSnaps()">📄 View original page${figs.length>1?'s':''} (figures &amp; all)</button>
        <div class="snaps" id="snaps">${figs.map(f=>`<img loading="lazy" src="${f}" alt="source page">`).join("")}</div>
      </div>
      <div class="srcline">
        <b>Subject:</b> ${q.category}${q.topic?" \u00b7 "+esc(q.topic):""} &nbsp;\u00b7&nbsp;
        <b>Specialty:</b> ${specialtyPill(q.specialty||q.category)} &nbsp;\u00b7&nbsp;
        <b>Priority:</b> ${priorityPill(q.priority||'P2')} &nbsp;\u00b7&nbsp;
        <b>Source:</b> ${q.source?esc(q.source):"\u2014"} &nbsp;\u00b7&nbsp;
        <b>From file:</b> ${q.year} Pediatric Part 1 (Maryam Altayeb) \u00b7 Q${q.number} &nbsp;\u00b7&nbsp;
        <b>Type:</b> ${ZONE_LABEL[q.zone]} &nbsp;\u00b7&nbsp; <b>Difficulty:</b> ${diffDot(q)} ${DIFF_LABEL[q.difficulty]}
      </div>
    </div>

    <div class="q-foot">
      <div class="left">
        <button class="btn ghost" onclick="prevQ()" ${idx===0?'disabled style=opacity:.4':''}>← Prev</button>
      </div>
      <button class="btn" id="nextBtn" onclick="nextQ()">${idx+1===ids.length?'Finish':'Next →'}</button>
    </div>
  </div>`;

  // restore answered state: this session's pick, or a completion logged earlier today
  const prev=runnerCtx.answered[q.id];
  if(prev){
    revealAnswer(q,prev,true);
  }else if(runnerCtx.origin==="plan"){
    const log=STATE.dayLog[todayStr()];
    if(log&&log.done&&log.done[q.id]){
      // already completed today in an earlier session — show answer + explanation
      const correctLab=(q.answer.match(/^([A-G])/)||[])[1];
      revealAnswer(q, correctLab||"", true);
      const note=$("#ansLine");
      if(note&&correctLab) note.innerHTML=`✓ Already completed today · Correct answer: <b>${esc(q.answer)}</b>`;
    }
  }
}
function answer(id,lab){
  const q=QBY[id];
  if(runnerCtx.answered[id]) return;
  runnerCtx.answered[id]=lab;
  const effAns=effectiveAnswer(q);
  const correctLab=(effAns.match(/^([A-G])/)||[])[1];
  if(correctLab){ recordResult(id, lab===correctLab); }
  if(runnerCtx.origin==="plan") markDayDone(id);
  revealAnswer(q,lab,false);
}
function revealAnswer(q,lab,restore){
  const effAns=effectiveAnswer(q);
  const correctLab=(effAns.match(/^([A-G])/)||[])[1];
  const edited=hasEdits(q.id)&&getEdit(q.id).answer;
  $$("#opts .option").forEach(o=>{
    o.classList.add("disabled");
    const L=o.dataset.lab;
    if(correctLab && L===correctLab)o.classList.add("correct");
    else if(L===lab && (!correctLab||L!==correctLab))o.classList.add(correctLab?"wrong":"correct");
  });
  if(correctLab){
    const origLab=(q.answer.match(/^([A-G])/)||[])[1];
    const editNote=edited&&origLab!==correctLab?` <span style="color:var(--gold);font-size:13px">(edited — original: ${esc(q.answer)})</span>`:"";
    $("#ansLine").innerHTML=`✓ Correct answer: <b>${esc(effAns)}</b>${editNote}`;
  }else{
    $("#ansLine").innerHTML=`<span style="color:var(--ink-soft)">⚠ No answer key in source file.</span>`;
  }
  $("#explain").classList.add("show");
}
function toggleSnaps(){ $("#snaps").classList.toggle("show"); }
function toggleReview(id){
  if(STATE.review[id]) delete STATE.review[id];
  else STATE.review[id]=true;
  saveState();
  const b=$("#revBtn");
  const on=!!STATE.review[id];
  b.classList.toggle("on",on);
  b.textContent=on?"★ Saved":"☆ Review";
  toast(on?"Saved to Review page":"Removed from Review");
}
function nextQ(){
  if(runnerCtx.idx+1>=runnerCtx.ids.length){ finishRunner(); return; }
  runnerCtx.idx++; renderRunner();
}
function prevQ(){ if(runnerCtx.idx>0){runnerCtx.idx--;renderRunner();} }
function exitRunner(){
  if(runnerCtx&&runnerCtx.origin==="review") switchView("review");
  else if(runnerCtx&&runnerCtx.origin==="pastday") openPastDay(runnerCtx.pastDay);
  else switchView("plan");
}
function finishRunner(){
  const n=Object.keys(runnerCtx.answered).length;
  const c=Object.entries(runnerCtx.answered).filter(([id,l])=>{
    const q=QBY[id];return l===(q.answer.match(/^([A-G])/)||[])[1];
  }).length;
  toast(`Session done — ${c}/${n} correct`);
  switchView(runnerCtx.origin==="review"?"review":runnerCtx.origin==="plan"?"plan":"dashboard");
}

/* ============================================================================
   QUESTION BANK (browse + filter)
   ============================================================================ */
let browseFilter={year:"",zone:"",spec:"",diff:"",cat:"",q:"",status:"",sort:"priority"};
function renderBrowse(){
  const el=$("#view-browse");
  const cats=[...new Set(QUESTIONS.map(q=>q.category))].sort();
  const years=[...new Set(QUESTIONS.map(q=>String(q.year)))].sort();
  const yearRange=years.length?`${years[0]}\u2013${years[years.length-1]}`:"";
  el.innerHTML=`
  <div class="page-head">
    <div class="eyebrow">${QUESTIONS.length} questions \u00b7 ${yearRange}</div>
    <h1>Question Bank</h1>
    <p>Every question verbatim from the source files, with explanation, zone, specialty, and difficulty. Filter and drill any slice.</p>
  </div>
  <div class="filters">
    <input id="fq" placeholder="Search text\u2026" value="${esc(browseFilter.q)}">
    <select id="fyear"><option value="">All years</option>${years.map(y=>`<option ${browseFilter.year==y?'selected':''}>${y}</option>`).join("")}</select>
    <select id="fspec"><option value="">All specialties</option>${SPECIALTIES.map(s=>{const m=SPECIALTY_META[s]||{icon:''};return`<option value="${esc(s)}" ${browseFilter.spec==s?'selected':''}>${m.icon} ${esc(s)}</option>`;}).join("")}</select>
    <select id="fzone"><option value="">All zones</option>${["red","high_yield","trap","common"].map(z=>`<option value="${z}" ${browseFilter.zone==z?'selected':''}>${ZONE_LABEL[z]}</option>`).join("")}</select>
    <select id="fdiff"><option value="">Any difficulty</option>${["green","yellow","red"].map(d=>`<option value="${d}" ${browseFilter.diff==d?'selected':''}>${DIFF_LABEL[d]}</option>`).join("")}</select>
    <select id="fcat"><option value="">All subjects</option>${cats.map(c=>`<option ${browseFilter.cat==c?'selected':''}>${esc(c)}</option>`).join("")}</select>
    <select id="fstatus"><option value="">Any status</option>
      <option value="unseen" ${browseFilter.status=='unseen'?'selected':''}>Unseen</option>
      <option value="wrong" ${browseFilter.status=='wrong'?'selected':''}>Last wrong</option>
      <option value="mastered" ${browseFilter.status=='mastered'?'selected':''}>Mastered</option></select>
    <select id="fsort">
      <option value="priority" ${browseFilter.sort==='priority'?'selected':''}>Sort: Priority</option>
      <option value="year" ${browseFilter.sort==='year'?'selected':''}>Sort: Year / Number</option>
    </select>
  </div>
  <div class="card" id="qlist"></div>`;
  const bind=(id,key)=>{$("#"+id).oninput=$("#"+id).onchange=(e)=>{browseFilter[key]=e.target.value;drawList();};};
  bind("fq","q");bind("fyear","year");bind("fspec","spec");bind("fzone","zone");bind("fdiff","diff");bind("fcat","cat");bind("fstatus","status");bind("fsort","sort");
  drawList();
}
function filteredQuestions(){
  const f=browseFilter;
  const prioOrder={P1:0,P2:1,Tier2:2,Tier1:3};
  const zoneOrder={red:0,high_yield:1,trap:2,common:3};
  let list=QUESTIONS.filter(q=>{
    if(f.year&&String(q.year)!==String(f.year))return false;
    if(f.spec&&q.specialty!==f.spec)return false;
    if(f.zone&&q.zone!=f.zone)return false;
    if(f.diff&&q.difficulty!=f.diff)return false;
    if(f.cat&&q.category!=f.cat)return false;
    if(f.q){const t=(q.stem+" "+q.explanation).toLowerCase();if(!t.includes(f.q.toLowerCase()))return false;}
    if(f.status){
      const s=STATE.seen[q.id];
      if(f.status==="unseen"&&s)return false;
      if(f.status==="wrong"&&!(s&&s.lastResult==="wrong"))return false;
      if(f.status==="mastered"&&!isMastered(q.id))return false;
    }
    return true;
  });
  if(f.sort==="year"){
    list=[...list].sort((a,b)=>String(a.year).localeCompare(String(b.year))||a.number-b.number);
  } else {
    list=[...list].sort((a,b)=>
      ((prioOrder[a.priority]??3)-(prioOrder[b.priority]??3)) ||
      ((zoneOrder[a.zone]??3)-(zoneOrder[b.zone]??3)) ||
      ((b.freq_score||0)-(a.freq_score||0))
    );
  }
  return list;
}
function drawList(){
  const list=filteredQuestions();
  const wrap=$("#qlist");
  if(!list.length){wrap.innerHTML=`<div class="empty"><div class="ico">🔍</div>No questions match these filters.</div>`;return;}
  wrap.innerHTML=`
    <div style="padding:13px 18px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center">
      <b>${list.length} questions</b>
      <button class="btn sm" onclick='runList(${JSON.stringify(list.map(q=>q.id))},"browse")'>Study these →</button>
    </div>`+
    list.slice(0,300).map(q=>{
      const s=STATE.seen[q.id];
      const status=isMastered(q.id)?'<span class="pill common">✓ mastered</span>':s&&s.lastResult==='wrong'?'<span class="pill red">last wrong</span>':s?'<span class="pill common">seen</span>':'';
      return `<div class="qrow" style="gap:10px">
        <div style="flex:1;display:flex;gap:14px;align-items:flex-start;cursor:pointer;min-width:0" onclick='openOne("${q.id}")'>
          <div class="qn">${q.year}\u00b7${q.number}</div>
          <div class="qt"><div class="txt">${esc(effectiveStem(q))}</div>
            <div class="meta">${zonePill(q)} ${specialtyPill(q.specialty||q.category)} <span class="pill common">${diffDot(q)} ${DIFF_LABEL[q.difficulty]}</span>
            ${status}
            ${hasEdits(q.id)?'<span class="edit-badge">\u270f\ufe0f edited</span>':''}</div></div>
        </div>
        <button class="editbtn" style="flex-shrink:0;align-self:center" onclick="openEditModal('${q.id}')">\u270f\ufe0f</button>
      </div>`;
    }).join("") + (list.length>300?`<div style="padding:14px;text-align:center;color:var(--ink-soft);font-size:14px">Showing first 300. Narrow the filters to see more.</div>`:"");
}
function openOne(id){ runList([id],"browse"); }

/* ============================================================================
   REVIEW PAGE  (saved questions)
   ============================================================================ */
function renderReview(){
  const ids=Object.keys(STATE.review).filter(id=>QBY[id]);
  const el=$("#view-review");
  el.innerHTML=`
  <div class="page-head">
    <div class="eyebrow">${ids.length} saved</div>
    <h1>Review List</h1>
    <p>Questions you starred with the ⭐ Review button. Revisit them anytime — they also feed naturally into spaced repetition.</p>
  </div>`;
  if(!ids.length){
    el.innerHTML+=`<div class="card"><div class="empty"><div class="ico">⭐</div>No saved questions yet.<br>Tap <b>☆ Review</b> on any question to keep it here.</div></div>`;
    return;
  }
  el.innerHTML+=`<div class="card">
    <div style="padding:13px 18px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center">
      <b>${ids.length} saved questions</b>
      <button class="btn sm" onclick='runList(${JSON.stringify(ids)},"review")'>Study all →</button>
    </div>
    ${ids.map(id=>{const q=QBY[id];return `<div class="qrow" onclick='runList(["${id}"],"review")'>
      <div class="qn">${q.year}·${q.number}</div>
      <div class="qt"><div class="txt">${esc(q.stem)}</div>
        <div class="meta">${zonePill(q)} <span class="pill common">${diffDot(q)} ${DIFF_LABEL[q.difficulty]}</span>
        <span style="color:var(--ink-soft);font-size:12.5px">${esc(q.category)}</span></div></div>
    </div>`;}).join("")}
  </div>`;
}

/* ============================================================================
   MOCK EXAM
   ============================================================================ */
let mockCtx=null,mockLen=50;
function renderMock(){
  const el=$("#view-mock");
  if(mockCtx&&mockCtx.active){renderMockRunner();return;}
  if(mockCtx&&mockCtx.finished){renderMockResult();return;}
  const hist=STATE.mock.slice(-6).reverse();
  el.innerHTML=`
  <div class="page-head">
    <div class="eyebrow">Test under pressure</div>
    <h1>Mock Exam</h1>
    <p>A timed, mixed-subject paper sampled across all five years and zones. No explanations until you submit — just like the real thing.</p>
  </div>
  <div class="card mock-setup">
    <h3 style="font-size:20px;margin-bottom:6px">Build your mock</h3>
    <p style="color:var(--ink-soft);font-size:15px;margin-bottom:8px">How many questions?</p>
    <div class="mock-opt">
      ${[25,50,75,100].map(n=>`<button class="${mockLen==n?'sel':''}" onclick="setMockLen(${n})">${n}</button>`).join("")}
    </div>
    <button class="btn" onclick="startMock()">Start mock exam →</button>
  </div>
  ${hist.length?`<div class="section-divider"><span>Recent attempts</span></div>
    <div class="card">${hist.map(m=>`<div class="qrow" style="cursor:default">
      <div class="qn">${m.date.slice(5)}</div>
      <div class="qt"><div class="txt"><b>${m.score}/${m.total}</b> (${Math.round(m.score/m.total*100)}%) · ${m.total}-question paper</div></div>
    </div>`).join("")}</div>`:""}`;
}
function setMockLen(n){mockLen=n;renderMock();}
function startMock(){
  const pool=[...QUESTIONS].sort(()=>Math.random()-0.5).slice(0,mockLen);
  mockCtx={active:true,finished:false,ids:pool.map(q=>q.id),idx:0,answers:{},start:Date.now()};
  renderMock();
}
function renderMockRunner(){
  const q=QBY[mockCtx.ids[mockCtx.idx]];
  const el=$("#view-mock");
  const picked=mockCtx.answers[q.id];
  el.innerHTML=`
  <div class="runner-top">
    <button class="btn ghost sm" onclick="quitMock()">✕ Quit</button>
    <div class="runner-progress">Question ${mockCtx.idx+1} / ${mockCtx.ids.length} · <span id="mclock">00:00</span></div>
    <div style="width:60px"></div>
  </div>
  <div class="card q-card">
    <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
      <button class="editbtn" onclick="openEditModal('${q.id}')">✏️ Edit${hasEdits(q.id)?'<span class=\"edit-badge\">edited</span>':''}</button>
    </div>
    <div class="q-stem">${esc(effectiveStem(q))}</div>
    ${q.question_image?`<div class="q-figure"><img loading="lazy" src="${ASSET_BASE+q.question_image}" alt="figure for this question"></div>`:""}
    <div class="options" id="mopts">
      ${q.options.map(o=>`<div class="option ${picked===o.label?'correct':''}" data-lab="${o.label}" onclick="mockPick('${q.id}','${o.label}')">
        <div class="lab">${o.label}</div><div class="otext">${esc(o.text)}</div></div>`).join("")}
    </div>
    <div class="q-foot">
      <button class="btn ghost" onclick="mockPrev()" ${mockCtx.idx===0?'disabled style=opacity:.4':''}>← Prev</button>
      <button class="btn" onclick="mockNext()">${mockCtx.idx+1===mockCtx.ids.length?'Submit exam':'Next →'}</button>
    </div>
  </div>`;
  startMockClock();
}
function mockPick(id,lab){
  mockCtx.answers[id]=lab;
  $$("#mopts .option").forEach(o=>o.classList.toggle("correct",o.dataset.lab===lab));
}
function mockNext(){ if(mockCtx.idx+1>=mockCtx.ids.length){submitMock();return;} mockCtx.idx++;renderMockRunner(); }
function mockPrev(){ if(mockCtx.idx>0){mockCtx.idx--;renderMockRunner();} }
function quitMock(){ if(confirm("Quit this mock? Progress won't be saved.")){mockCtx=null;renderMock();} }
let mockClockTimer=null;
function startMockClock(){
  clearInterval(mockClockTimer);
  mockClockTimer=setInterval(()=>{
    const s=Math.floor((Date.now()-mockCtx.start)/1000);
    const el=$("#mclock");if(el)el.textContent=`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  },1000);
}
function submitMock(){
  clearInterval(mockClockTimer);
  let score=0;
  mockCtx.ids.forEach(id=>{
    const q=QBY[id];const lab=mockCtx.answers[id];
    const correct=lab===(effectiveAnswer(q).match(/^([A-G])/)||[])[1];
    if(lab) recordResult(id,correct);  // mock answers also feed SR + wrong loop
    if(correct)score++;
  });
  mockCtx.score=score;mockCtx.active=false;mockCtx.finished=true;
  STATE.mock.push({date:todayStr(),score,total:mockCtx.ids.length,mode:"mixed"});
  saveState();
  renderMockResult();
}
function renderMockResult(){
  const el=$("#view-mock");
  const pct=Math.round(mockCtx.score/mockCtx.ids.length*100);
  // zone breakdown
  const zb={};
  mockCtx.ids.forEach(id=>{const q=QBY[id];const lab=mockCtx.answers[id];
    const ok=lab===(effectiveAnswer(q).match(/^([A-G])/)||[])[1];
    zb[q.zone]=zb[q.zone]||{t:0,c:0};zb[q.zone].t++;if(ok)zb[q.zone].c++;});
  el.innerHTML=`
  <div class="card mock-result">
    <div class="ring" style="--p:${pct};position:relative"><div class="inner">${pct}%</div></div>
    <div class="mock-score" style="font-size:30px">${mockCtx.score} / ${mockCtx.ids.length}</div>
    <p style="color:var(--ink-soft);margin-top:8px">${pct>=80?"Strong — exam-ready pace.":pct>=65?"Solid. Tighten the weak zones below.":"Keep drilling — focus on red zone and your wrong loop."}</p>
    <div style="max-width:420px;margin:24px auto 0;text-align:left">
      ${Object.entries(zb).map(([z,v])=>`<div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:5px"><span>${zonePill({zone:z})}</span><span style="color:var(--ink-soft)">${v.c}/${v.t}</span></div>
        <div class="progress-bar"><span style="width:${Math.round(v.c/v.t*100)}%"></span></div></div>`).join("")}
    </div>
    <div style="margin-top:26px;display:flex;gap:10px;justify-content:center">
      <button class="btn ghost" onclick="reviewMockWrong()">Review my mistakes</button>
      <button class="btn" onclick="mockCtx=null;renderMock()">New mock</button>
    </div>
  </div>`;
}
function reviewMockWrong(){
  const wrong=mockCtx.ids.filter(id=>{const q=QBY[id];return mockCtx.answers[id]!==(effectiveAnswer(q).match(/^([A-G])/)||[])[1];});
  if(!wrong.length){toast("No mistakes — perfect paper!");return;}
  runList(wrong,"mock");
}

/* ---------------------------------------------------------------------------
   Go
--------------------------------------------------------------------------- */
boot();
