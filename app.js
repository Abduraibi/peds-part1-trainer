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
    schema:1,
    startDate: todayStr(),
    edits:{},  // id -> {answer, stem, notes}
    seen:{},          // id -> {attempts, correct, lastResult, lastSeen, box(SR), nextDue}
    review:{},        // id -> true (saved for review)
    wrongLoop:{},     // date -> [ids] mistakes made that day, to repeat next active day
    dayLog:{},        // date -> {mode, completedTaskKeys:[], assigned:[ids]}
    mock:[],          // history [{date,score,total,mode}]
    lastActiveDate:null
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
    // auto-login local demo
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
  migrateStalePlans();  // one-time fix: archive any plans not belonging to today
  purgeStaleTodayPlan(); // Issue 1 fix: clear today's slot if its stored day != actual today
  rolloverDay();
  switchView("dashboard");
}

/* Issue 1 fix: if the dayLog entry stored under today's date-string was actually
   built on a different calendar day (e.g. session started yesterday, crossed midnight),
   delete it so buildDayPlan generates a fresh plan for the real today. */
function purgeStaleTodayPlan(){
  const today = todayStr();
  const log = STATE.dayLog && STATE.dayLog[today];
  // If the slot exists but its own .day field doesn't match actual today, it's stale
  if(log && log.day && log.day !== today){
    delete STATE.dayLog[today];
    saveState();
  }
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

/* Midnight rollover: detect date change while app is open */
let _lastKnownDate=todayStr();
setInterval(()=>{
  const now=todayStr();
  if(now!==_lastKnownDate){
    _lastKnownDate=now;
    if(STATE){
      archiveOldPlans();
      purgeStaleTodayPlan(); // clear any slot that crossed midnight
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
   ADAPTIVE DAILY PLAN
   - Pool = all not-yet-mastered questions, prioritised red > high_yield > trap > common
   - Remaining days until FINISH_BY drive per-day quota; skipping compresses (catch-up)
   - Full day mode: memory review (SR due) + wrong loop + red zone + high yield + new
   - Busy day mode: memory review + wrong loop + 10–20 red zone only
--------------------------------------------------------------------------- */
function planPool(){
  // questions not mastered, ordered by zone priority then by frequency
  const order={red:0,high_yield:1,trap:2,common:3};
  return QUESTIONS
    .filter(q=>!isMastered(q.id))
    .sort((a,b)=>(order[a.zone]-order[b.zone]) || ((b.freq_score||0)-(a.freq_score||0)));
}
function remainingDays(){
  const d=daysBetween(todayStr(),FINISH_BY);
  return Math.max(1,d+1);
}
function dailyQuota(){
  // adaptive: spread remaining unmastered "new" questions across remaining days
  const newLeft = planPool().filter(q=>!(STATE.seen[q.id])).length;
  const days=remainingDays();
  const base=Math.ceil(newLeft/days);
  return Math.max(base, 8); // never trivially small while material remains
}
function pickNew(n,exclude){
  const ex=new Set(exclude);
  // unseen questions only, zone-priority ordered
  return planPool().filter(q=>!STATE.seen[q.id]&&!ex.has(q.id)).slice(0,n);
}
function pickZoneNew(zone,n,exclude){
  // unseen questions from a specific zone
  const ex=new Set(exclude);
  return planPool().filter(q=>q.zone===zone&&!STATE.seen[q.id]&&!ex.has(q.id)).slice(0,n);
}
function pickZone(zone,n,exclude){
  // any unmastered question from a zone (seen or unseen) — used for review groups
  const ex=new Set(exclude);
  return planPool().filter(q=>q.zone===zone&&!ex.has(q.id)).slice(0,n);
}

function buildDayPlan(mode){
  const day=todayStr();
  const saved=STATE.dayLog[day];

  // Issue 2 fix: the frozen plan is MODE-INDEPENDENT.
  // We always build (or reuse) the full canonical group list; Busy Day just
  // presents a subset of those same groups/questions, so `done` keys stay valid.

  // Reuse today's frozen plan if it already exists and isn't archived
  if(saved && saved.groups && !saved.archived && saved.day===day){
    return _planFromSaved(saved, mode);
  }

  // --- Build the full canonical plan (Full Day) ---
  const used=[];
  const groups=[];

  // 1. Memory review (spaced repetition due) — always full set, both modes use it
  const sr=dueForReview().slice(0,25);
  sr.forEach(q=>used.push(q.id));
  if(sr.length) groups.push({key:"memory",title:"Memory Review",sub:"Spaced-repetition items due today",icon:"🧠",items:sr});

  // 2. Wrong loop (mistakes from previous days)
  const wl=pendingWrongLoop().filter(q=>!used.includes(q.id)).slice(0,30);
  wl.forEach(q=>used.push(q.id));
  if(wl.length) groups.push({key:"wrongloop",title:"Wrong Loop",sub:"Questions you missed earlier — master them now",icon:"🔁",items:wl});

  const quota=dailyQuota();   // ~20 genuinely new questions per day

  // 3. New Red Zone questions (~55% of quota)
  const rz=pickZoneNew("red",Math.ceil(quota*0.55),used);
  rz.forEach(q=>used.push(q.id));
  if(rz.length) groups.push({key:"red",title:"Red Zone — New",sub:`${rz.length} new must-master questions you haven't seen yet`,icon:"🔴",items:rz});

  // 4. New High-Yield questions (~30% of quota)
  const hy=pickZoneNew("high_yield",Math.ceil(quota*0.30),used);
  hy.forEach(q=>used.push(q.id));
  if(hy.length) groups.push({key:"high_yield",title:"High-Yield — New",sub:`${hy.length} new dense concepts & decision points`,icon:"🔵",items:hy});

  // 5. Fill remaining quota with any new unseen questions (trap/common)
  const fill=pickNew(Math.max(0,quota-rz.length-hy.length),used);
  fill.forEach(q=>used.push(q.id));
  if(fill.length) groups.push({key:"new",title:"New Questions",sub:`${fill.length} remaining new questions to hit today's target of ${quota}`,icon:"✨",items:fill});

  // 6. Seen-but-unmastered review (capped at 10) — separate from new material
  const seenUnmastered=planPool()
    .filter(q=>STATE.seen[q.id]&&!used.includes(q.id))
    .slice(0,10);
  seenUnmastered.forEach(q=>used.push(q.id));
  if(seenUnmastered.length) groups.push({key:"review_seen",title:"Reinforce",sub:`${seenUnmastered.length} questions you've seen before — drill until mastered`,icon:"🔄",items:seenUnmastered});

  // Busy Day subset: memory + wrongloop + first 16 red zone questions
  // We tag the red group's first 16 ids so Busy Day can cap it
  const rzGroup = groups.find(g=>g.key==="red");
  const busyRedIds = rzGroup ? rzGroup.items.slice(0,16).map(q=>q.id) : [];

  const fudul = fudulSessionForToday();
  // FREEZE this plan (mode-independent) — store day for date-guard check on reload
  STATE.dayLog[day]={
    day,
    fudul, used,
    busyRedIds,            // which red-zone ids are included in Busy Day
    done: (saved&&saved.done)||{},
    groups: groups.map(g=>({key:g.key,title:g.title,sub:g.sub,icon:g.icon,itemIds:g.items.map(q=>q.id)}))
  };
  saveState();
  return _planFromSaved(STATE.dayLog[day], mode);
}

/* Reconstruct a plan object from a frozen dayLog entry, applying Busy Day filtering */
function _planFromSaved(saved, mode){
  const day = saved.day;
  const busyKeys = new Set(["memory","wrongloop","red"]);
  const busyRedIds = new Set(saved.busyRedIds||[]);

  const groups = saved.groups
    .filter(g => mode!=="busy" || busyKeys.has(g.key))
    .map(g=>{
      let ids = g.itemIds;
      // For Busy Day, cap red zone to the pre-selected busyRedIds subset
      if(mode==="busy" && g.key==="red"){
        ids = ids.filter(id=>busyRedIds.has(id));
      }
      // Relabel red group for Busy Day
      const title = (mode==="busy" && g.key==="red")
        ? "Red Zone (light)" : g.title;
      const sub = (mode==="busy" && g.key==="red")
        ? "High-frequency must-know — 10–20 today" : g.sub;
      return {key:g.key, title, sub, icon:g.icon,
              items:ids.map(id=>QBY[id]).filter(Boolean)};
    })
    .filter(g=>g.items.length>0);

  return {
    day, mode, groups,
    fudul: saved.fudul||fudulSessionForToday(),
    used: saved.used||[],
    done: saved.done||{}
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
  return {total,seen,mastered,acc,attempts,byZone,
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

  // Detect stale plan: any dayLog entry with groups that isn't today's
  const today=todayStr();
  const hasStale=Object.entries(STATE.dayLog||{}).some(([d,log])=>
    log&&log.groups&&!log.archived&&d!==today);
  const hasTodayPlan=STATE.dayLog&&STATE.dayLog[today]&&STATE.dayLog[today].groups&&!STATE.dayLog[today].archived;

  el.innerHTML=`
  <div class="page-head">
    <div class="eyebrow">${new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</div>
    <h1>Today's Focus</h1>
    <p>${s.daysLeft} days until the exam (July 7, 2026). Plan finishes by July 6. Keep the streak — skipped days are absorbed into the days ahead.</p>
  </div>

  ${hasStale||!hasTodayPlan?`
  <div style="background:var(--gold-bg);border:1px solid color-mix(in srgb,var(--gold) 30%,transparent);border-radius:12px;padding:16px 18px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">
    <div>
      <b style="color:var(--gold)">📅 New day detected</b>
      <div style="font-size:14px;color:var(--ink-soft);margin-top:3px">A stale plan from a previous day is still active. Tap to generate today's fresh plan.</div>
    </div>
    <button class="btn" onclick="forceNewDay()" style="flex-shrink:0">Generate today's plan →</button>
  </div>`:""}

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
          <div class="v" style="font-size:24px;margin-top:8px">Complete plan</div>
          <p style="color:var(--ink-soft);font-size:14px;margin-top:6px">Memory review · wrong loop · red zone · high-yield · new</p>
        </div>
        <div class="card stat" style="cursor:pointer" onclick="startDayMode('busy')">
          <div class="k">Busy Day Mode</div>
          <div class="v" style="font-size:24px;margin-top:8px">Light session</div>
          <p style="color:var(--ink-soft);font-size:14px;margin-top:6px">Memory review · wrong loop · 10–20 red zone</p>
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
        <div class="k">Zone mastery</div>
        <div style="margin-top:14px;display:flex;flex-direction:column;gap:13px">
          ${["red","high_yield","trap","common"].map(z=>{
            const b=s.byZone[z];const p=b.total?Math.round(b.mastered/b.total*100):0;
            return `<div><div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:5px">
              <span>${zonePill({zone:z})}</span><span style="color:var(--ink-soft)">${b.mastered}/${b.total}</span></div>
              <div class="progress-bar"><span style="width:${p}%"></span></div></div>`;
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
  // weakest zone by accuracy
  const zoneAcc=["red","high_yield","trap","common"].map(z=>{
    const qs=QUESTIONS.filter(q=>q.zone===z&&STATE.seen[q.id]);
    const at=qs.reduce((a,q)=>a+STATE.seen[q.id].attempts,0);
    const co=qs.reduce((a,q)=>a+STATE.seen[q.id].correct,0);
    return {z,acc:at?co/at:1,seen:qs.length};
  }).filter(x=>x.seen>=3).sort((a,b)=>a.acc-b.acc);
  if(zoneAcc.length&&zoneAcc[0].acc<0.7){
    advice.push(`Weakest area: <b>${ZONE_LABEL[zoneAcc[0].z]}</b> (${Math.round(zoneAcc[0].acc*100)}%). Re-read those explanations and the page snapshots.`);
  }
  // weakest category
  const catMap={};
  QUESTIONS.forEach(q=>{const sv=STATE.seen[q.id];if(sv){const c=catMap[q.category]||{a:0,co:0};c.a+=sv.attempts;c.co+=sv.correct;catMap[q.category]=c;}});
  const cats=Object.entries(catMap).filter(([,v])=>v.a>=4).map(([k,v])=>({k,acc:v.co/v.a})).sort((a,b)=>a.acc-b.acc);
  if(cats.length&&cats[0].acc<0.65){
    advice.push(`Subject to drill: <b>${cats[0].k}</b> (${Math.round(cats[0].acc*100)}%). Filter the Question Bank to it.`);
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
  // count genuinely new (unseen) questions in today's plan
  const newTodayCount=plan.groups
    .filter(g=>['red','high_yield','new'].includes(g.key))
    .flatMap(g=>g.items).length;

  el.innerHTML=`
  <div class="page-head">
    <div class="eyebrow">Adaptive Plan · ${remainingDays()} study days to finish</div>
    <h1>Daily Plan</h1>
    <p>Auto-balanced toward your July 6 finish. Skip a day and the remaining load redistributes across the days ahead so you still finish on time.</p>
  </div>

  <div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:18px">
    <div class="mode-switch">
      <button class="${currentPlanMode==='full'?'active':''}" onclick="setPlanMode('full')">Full Day</button>
      <button class="${currentPlanMode==='busy'?'active':''}" onclick="setPlanMode('busy')">Busy Day</button>
    </div>
    <div style="color:var(--ink-soft);font-size:14.5px"><b style="color:var(--ink)">${newTodayCount} new</b> · ${totalQ} total today</div>
  </div>

  <div class="card stat" style="margin-bottom:18px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <div>
        <div class="k">Today's progress</div>
        <div class="v" style="font-size:26px;margin-top:4px">${doneQ}<small>/${totalQ}</small> <span style="font-size:15px;color:var(--ink-soft)">· ${remaining} left</span></div>
      </div>
      <div style="display:flex;gap:9px">
        ${remaining>0
          ? `<button class="btn" onclick="resumeToday()">${doneQ>0?'Resume where I left off →':'Start today’s plan →'}</button>`
          : `<span class="pill common">✓ All done — great work</span>`}
        <button class="btn ghost sm" onclick="confirmRegenToday()" title="Rebuild today's plan from scratch">↻ New plan</button>
      </div>
    </div>
    <div class="progress-bar" style="margin-top:14px"><span style="width:${pct}%"></span></div>
  </div>

  ${plan.fudul?`
  <div class="card" style="margin-bottom:18px;padding:18px 20px;border-left:4px solid var(--gold)">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:16px;color:var(--gold);margin-bottom:4px">⭐ ${esc(plan.fudul.label)}</div>
        <div style="font-size:13.5px;color:var(--ink-soft);margin-bottom:10px">${esc(plan.fudul.note)}</div>
        <div class="progress-bar" style="height:7px"><span style="width:${plan.fudul.pct}%"></span></div>
        <div style="font-size:12px;color:var(--ink-soft);margin-top:5px">${plan.fudul.doneSoFar} of ${plan.fudul.total} questions completed</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0;align-items:flex-end">
        <a href="${plan.fudul.url}" target="_blank" rel="noopener" class="btn ghost sm">Open fudoul.com →</a>
        ${plan.fudul.doneSoFar<plan.fudul.total?
          `<button class="btn sm" onclick="toggleFudulDone()" style="background:${plan.fudul.doneToday?'var(--green)':'var(--gold)'};border-color:${plan.fudul.doneToday?'var(--green)':'var(--gold)'}">
            ${plan.fudul.doneToday?'✓ Done today (tap to undo)':'Mark today done ('+plan.fudul.from+'–'+plan.fudul.to+')'}
          </button>`
          :`<span class="pill common">✓ All ${plan.fudul.total} done!</span>`}
        ${plan.fudul.doneSoFar>0?`<button class="btn ghost sm" style="font-size:12px;color:var(--ink-soft)" onclick="resetFudul()">↩ Reset</button>`:''}
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
      <div class="tg-head"><h3>${g.icon} ${g.title}</h3><span class="count">· ${gd} of ${ids.length} done</span></div>
      <div style="color:var(--ink-soft);font-size:14px;margin:-6px 0 12px">${g.sub}</div>
      <div class="tasklist">
        ${ids.length? `
        <div class="task ${complete?'done':''}">
          <div class="check ${complete?'on':''}">${complete?'✓':''}</div>
          <div class="t-body">
            <div class="t-title">${g.title} set</div>
            <div class="t-sub">${gd} completed · ${gleft} remaining</div>
          </div>
          ${complete
            ? `<button class="btn ghost sm t-go" onclick='runGroupResume(${JSON.stringify(g.key)}, ${JSON.stringify(ids)})'>Review again</button>`
            : `<button class="btn sm t-go" onclick='runGroupResume(${JSON.stringify(g.key)}, ${JSON.stringify(ids)})'>${gd>0?'Continue →':'Study →'}</button>`}
        </div>`:`<div style="color:var(--ink-soft);font-size:14px;padding:8px 2px">Nothing pending here today. 🎉</div>`}
      </div>
    </div>`;}).join("")}

  <div style="margin-top:10px">
    <button class="btn" onclick="resumeToday()">${remaining>0?'Continue entire plan →':'Review entire plan →'}</button>
  </div>

  ${renderPastDaysSlider()}`;
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
        <b>Subject:</b> ${q.category}${q.topic?" · "+esc(q.topic):""} &nbsp;·&nbsp;
        <b>Source:</b> ${q.source?esc(q.source):"—"} &nbsp;·&nbsp;
        <b>From file:</b> ${q.year} Pediatric Part 1 (Maryam Altayeb) · Q${q.number} &nbsp;·&nbsp;
        <b>Type:</b> ${ZONE_LABEL[q.zone]} &nbsp;·&nbsp; <b>Difficulty:</b> ${diffDot(q)} ${DIFF_LABEL[q.difficulty]}
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
let browseFilter={year:"",zone:"",diff:"",cat:"",q:"",status:"",sort:"priority"};
function renderBrowse(){
  const el=$("#view-browse");
  const cats=[...new Set(QUESTIONS.map(q=>q.category))].sort();
  const years=[...new Set(QUESTIONS.map(q=>String(q.year)))].sort();
  const yearRange=years.length?`${years[0]}–${years[years.length-1]}`:"";
  el.innerHTML=`
  <div class="page-head">
    <div class="eyebrow">${QUESTIONS.length} questions · ${yearRange}</div>
    <h1>Question Bank</h1>
    <p>Every question is verbatim from the source files, with its explanation, source, zone, and difficulty. Filter and drill any slice.</p>
  </div>
  <div class="filters">
    <input id="fq" placeholder="Search text…" value="${esc(browseFilter.q)}">
    <select id="fyear"><option value="">All years</option>${years.map(y=>`<option ${browseFilter.year==y?'selected':''}>${y}</option>`).join("")}</select>
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
  bind("fq","q");bind("fyear","year");bind("fzone","zone");bind("fdiff","diff");bind("fcat","cat");bind("fstatus","status");bind("fsort","sort");
  drawList();
}
function filteredQuestions(){
  const f=browseFilter;
  const zoneOrder={red:0,high_yield:1,trap:2,common:3};
  let list=QUESTIONS.filter(q=>{
    if(f.year&&String(q.year)!==String(f.year))return false;
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
    list=[...list].sort((a,b)=>(zoneOrder[a.zone]-zoneOrder[b.zone])||((b.freq_score||0)-(a.freq_score||0)));
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
          <div class="qn">${q.year}·${q.number}</div>
          <div class="qt"><div class="txt">${esc(effectiveStem(q))}</div>
            <div class="meta">${zonePill(q)} ${tagPills(q)} <span class="pill common">${diffDot(q)} ${DIFF_LABEL[q.difficulty]}</span>
            <span style="color:var(--ink-soft);font-size:12.5px">${esc(q.category)}</span> ${status}
            ${hasEdits(q.id)?'<span class="edit-badge">✏️ edited</span>':''}</div></div>
        </div>
        <button class="editbtn" style="flex-shrink:0;align-self:center" onclick="openEditModal('${q.id}')">✏️</button>
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
