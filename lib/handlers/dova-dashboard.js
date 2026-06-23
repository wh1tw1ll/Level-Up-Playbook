// dova-dashboard.js — DOVA Arena Command Center matching Chiefs V3 layout
// Serves a 4-page (Overview/Budget/Schedule/Action Items) single-page app
// Reads live data from /api/dova?sheet=NN. Navy/gold theme.

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>DOVA Arena — Live Project Command Center</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
:root{
  --navy:#1F4E79; --navy-d:#163a5a; --gold:#C4962B; --gold-l:#e0b554;
  --ink:#1c2733; --muted:#67788a; --line:#e4e9ef; --bg:#f4f6f8; --card:#ffffff;
  --green:#1e7f4f; --green-bg:#e6f4ec; --amber:#b7791f; --amber-bg:#fbf1dd;
  --red:#c0392b; --red-bg:#fbe7e4; --blue:#2c6fb0; --blue-bg:#e7f0fa;
  --gray:#7a8896; --gray-bg:#eef1f4;
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased}
.hidden{display:none!important}

/* Rail */
.rail{width:64px;flex:0 0 64px;background:var(--navy);display:flex;flex-direction:column;align-items:center;padding:12px 0;position:sticky;top:0;height:100vh;z-index:20}
.rail .rlogo{width:42px;height:42px;border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:18px}
.rail .rlogo img{width:100%;height:100%;object-fit:contain;display:block}
.rail-icon{display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 0;width:56px;border-radius:10px;cursor:pointer;color:#9fb3c8;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.3px;margin-bottom:2px}
.rail-icon:hover{background:rgba(255,255,255,.08);color:#fff}
.rail-icon.active{background:var(--gold);color:var(--navy-d)}
.rail-icon .ri{font-size:20px;line-height:1}
.rail-spacer{flex:1}

/* Shell */
#app{display:flex;min-height:100vh}
.wrap{flex:1;min-width:0;display:flex;flex-direction:column}

/* Masthead */
.masthead{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 24px;background:var(--card);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:10;flex-wrap:wrap}
.masthead .mt{font-size:16px;font-weight:700;color:var(--navy)}
.masthead .ms{font-size:11px;color:var(--muted);margin-top:1px}
.masthead .right{display:flex;align-items:center;gap:10px}
.sync{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted)}
.dot{width:8px;height:8px;border-radius:50%;background:var(--green)}
.dot.stale{background:var(--red)}
.printbtn{border:1px solid var(--line);background:#fff;color:var(--ink);padding:6px 12px;border-radius:7px;font-size:11px;cursor:pointer;font-weight:600}
.printbtn:hover{border-color:var(--navy);color:var(--navy)}

/* Pages */
.page{display:none}
.page.active{display:block}
.pwrap{padding:20px 24px;max-width:1300px}

/* Card sections */
.card{margin-bottom:14px;border:1px solid var(--line);border-radius:10px;background:var(--card);overflow:hidden}
.card-header{display:flex;align-items:center;gap:8px;padding:11px 16px;cursor:pointer;user-select:none;font-size:13px;font-weight:700;color:var(--navy);background:var(--bg);border-bottom:1px solid var(--line)}
.card-header .chv{flex:1}
.card-header .chev{transition:transform .18s;color:var(--muted);font-size:11px}
.card.collapsed .chev{transform:rotate(-90deg)}
.card.collapsed .card-body{display:none}
.card-body{padding:12px 16px 14px;overflow-x:auto}
.card-body>:last-child{margin-bottom:0}
.srclink{color:var(--blue);text-decoration:none;font-size:12px;margin-left:auto}

/* KPI ticker */
.kpi-ticker{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px}
.kpi-cell{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:13px 14px;position:relative;overflow:hidden}
.kpi-cell:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--gold)}
.kpi-cell .value{font-size:22px;font-weight:800;color:var(--navy);line-height:1.1}
.kpi-cell .label{font-size:11px;color:var(--muted);margin-top:4px;font-weight:600}
.kpi-cell .value.g{color:var(--green)}.kpi-cell .value.r{color:var(--red)}

/* Health table */
.health-tbl{width:100%;border-collapse:collapse}
.health-tbl td{padding:8px 12px;border-bottom:1px solid var(--line);font-size:13px}
.health-tbl td:last-child{text-align:right}
.health-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:middle}
.health-dot.g{background:var(--green)}.health-dot.a{background:var(--amber)}.health-dot.r{background:var(--red)}

/* Tables */
table{width:100%;border-collapse:collapse;font-size:12px}
thead th{text-align:left;color:var(--muted);font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:.4px;padding:7px 8px;border-bottom:2px solid var(--line);white-space:nowrap}
tbody td{padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}
tbody tr:hover{background:#fafbfc}
td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}

/* Pills */
.pill{display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap}
.pill.green{color:var(--green);background:var(--green-bg)}
.pill.amber{color:var(--amber);background:var(--amber-bg)}
.pill.red{color:var(--red);background:var(--red-bg)}
.pill.blue{color:var(--blue);background:var(--blue-bg)}
.pill.gray{color:var(--gray);background:var(--gray-bg)}

/* Charts */
.chartbox{height:260px;padding:4px}
.chartbox-sm{height:180px;padding:4px}
.grid2{display:grid;grid-template-columns:1.1fr .9fr;gap:14px}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}

/* No data */
.no-data{padding:20px;text-align:center;color:var(--muted);font-size:12px}

/* Doc links section */
.doc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:4px 0}
.doc-col h4{font-size:11px;font-weight:700;color:var(--navy);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px}
.doc-link{display:block;padding:5px 0;font-size:12px;color:var(--blue);text-decoration:none}
.doc-link:hover{text-decoration:underline}

/* Team grid */
.team-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
.team-card{padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--card)}
.team-card .name{font-size:13px;font-weight:600;color:var(--ink)}
.team-card .role{font-size:11px;color:var(--muted);margin-top:2px}
.team-card .email{font-size:11px;color:var(--blue);margin-top:1px}

/* Camera placeholder */
.cam-placeholder{background:#2c3e50;border-radius:8px;height:160px;display:flex;align-items:center;justify-content:center;color:#bdc3c7;font-size:13px;margin:4px 0}

/* Skeleton */
.skel-row{background:linear-gradient(90deg,#eef1f4 25%,#e3e8ee 37%,#eef1f4 63%);background-size:400% 100%;animation:sh 1.3s ease infinite;border-radius:6px;height:34px;margin:6px 0}
.skel-row.w60{width:60%}.skel-row.w80{width:80%}.skel-row.w40{width:40%}
@keyframes sh{0%{background-position:100% 0}100%{background-position:-100% 0}}
.skel-ticker{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:14px}
.skel-ticker>div{height:70px;border-radius:10px;background:linear-gradient(90deg,#eef1f4 25%,#e3e8ee 37%,#eef1f4 63%);background-size:400% 100%;animation:sh 1.3s ease infinite}

/* Counters */
.counters{display:flex;gap:20px;padding:6px 0}
.counter .num{font-size:20px;font-weight:800;color:var(--navy)}
.counter .num.amber{color:var(--amber)}
.counter .lbl{font-size:11px;color:var(--muted)}
.swatch{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:middle}
.legend{display:flex;gap:14px;font-size:11px;color:var(--muted);padding:4px 0}

@media (max-width:860px){
  .rail{width:48px;flex:0 0 48px}
  .rail-icon{width:40px;padding:6px 0;font-size:9px}
  .doc-grid{grid-template-columns:1fr 1fr}
  .grid2{grid-template-columns:1fr}
  .grid3{grid-template-columns:1fr}
  .kpi-ticker{grid-template-columns:repeat(2,1fr)}
  .team-grid{grid-template-columns:1fr 1fr}
}
@media print{
  .rail,.printbtn,.sync{display:none!important}
  .masthead{position:static}
  body{background:#fff}
  .card.collapsed .card-body{display:block}
}
</style>
</head>
<body>

<div id="app">
  <!-- Rail -->
  <nav class="rail">
    <div class="rlogo"><img src="/DOVA_Logo.png" alt="DA"></div>
    <div class="rail-icon active" data-page="overview" onclick="switchPage('overview')"><span class="ri">&#9632;</span>Overview</div>
    <div class="rail-icon" data-page="budget" onclick="switchPage('budget')"><span class="ri">&#36;</span>Budget</div>
    <div class="rail-icon" data-page="schedule" onclick="switchPage('schedule')"><span class="ri">&#9202;</span>Schedule</div>
    <div class="rail-icon" data-page="actions" onclick="switchPage('actions')"><span class="ri">&#10003;</span>Actions</div>
    <div class="rail-spacer"></div>
  </nav>

  <!-- Main -->
  <div class="wrap">
    <header class="masthead">
      <div>
        <div class="mt">DOVA Arena</div>
        <div class="ms">Downtown DOVA &middot; Rancho Cordova, CA</div>
      </div>
      <div class="right">
        <div class="sync"><span class="dot" id="dot"></span><span id="updated">Loading...</span></div>
        <button class="printbtn" onclick="window.print()">📄 Print</button>
      </div>
    </header>

    <div class="pwrap">
      <!-- PAGE: Overview -->
      <div id="page-overview" class="page active"></div>
      <!-- PAGE: Budget -->
      <div id="page-budget" class="page"></div>
      <!-- PAGE: Schedule -->
      <div id="page-schedule" class="page"></div>
      <!-- PAGE: Action Items -->
      <div id="page-actions" class="page"></div>
    </div>
  </div>
</div>

<script>
"use strict";
var API="/api/dova?sheet=";
var KEYS=["00","02","03","04","05","06","08","09","10","11","12"];
var STATE={};
var CHARTS=[];

function $(id){return document.getElementById(id)}
function esc(v){v=""+(v==null?"":v);return v.split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;").split('"').join("&quot;")}
function num(v){if(v==null)return 0;var s=""+v,o="";for(var i=0;i<s.length;i++){var c=s.charAt(i);if("0123456789.-".indexOf(c)>=0)o+=c}var n=parseFloat(o);return isNaN(n)?0:n}
function money(n){var neg=n<0;n=Math.round(Math.abs(n));return(neg?"-$":"$")+n.toLocaleString("en-US")}
function fmtM(v){var n=num(v);if(!n)return"$0";return"$"+(n/1e6).toFixed(1)+"M"}
function low(v){return(""+(v||"")).toLowerCase()}
function anyOf(s,a){for(var i=0;i<a.length;i++){if(s.indexOf(a[i])>=0)return true}return false}

function fmtDate(v){
  if(!v)return"&mdash;";
  try{
    var d=new Date(v+"T00:00:00");
    if(isNaN(d.getTime())) return esc(v);
    var mo=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return mo[d.getMonth()]+" "+d.getDate()+", "+d.getFullYear();
  }catch(e){return esc(v)}
}

function sClass(v){
  var s=low(v);if(!s)return"gray";
  if(anyOf(s,["complete","approved","awarded","delivered","closed","signed","done","issued","granted","received","green","on track","healthy"]))return"green";
  if(anyOf(s,["progress","pricing","submitted","review","active","ongoing","pending review","negotiat","in-","yellow","watch","amber"]))return"amber";
  if(anyOf(s,["block","overdue","critical","realized","rejected","at risk","denied","fail","expired","stalled","red","off track"]))return"red";
  if(anyOf(s,["not started","pending"]))return"gray";
  return"blue";
}
function pClass(v){
  var s=low(v);if(s.indexOf("critical")>=0)return"red";
  if(s.indexOf("high")>=0)return"amber";
  if(s.indexOf("medium")>=0||s.indexOf("med")>=0)return"blue";
  return"gray";
}
function pill(v,c){return v&&(""+v).trim()?'<span class="pill '+(c||sClass(v))+'">'+esc(v)+"</span>":'<span class="pill gray">&mdash;</span>'}

function destroyCharts(){CHARTS.forEach(function(c){try{c.destroy()}catch(e){}});CHARTS=[]}
function mkChart(id,cfg){var el=$(id);if(!el)return;try{var c=new Chart(el.getContext("2d"),cfg);CHARTS.push(c);return c}catch(e){return null}}

// Normalize API response
function norm(j){
  if(!j)return[];if(Array.isArray(j))return j;
  if(j.rows&&j.columns){
    if(j.rows.length>0&&!j.rows[0].cells)return j.rows;
    var m={};for(var i=0;i<j.columns.length;i++)m[j.columns[i].id]=j.columns[i].title;
    var o=[];for(var r=0;r<j.rows.length;r++){var x={},cs=j.rows[r].cells||[];for(var c=0;c<cs.length;c++){var t=m[cs[c].columnId];if(t)x[t]=cs[c].value!=null?cs[c].value:null}o.push(x)}
    return o
  }
  return[]
}
function get(r,ks){for(var i=0;i<ks.length;i++){var k=ks[i];if(r[k]!=null&&(""+r[k]).trim()!=="")return r[k];for(var kk in r){if(low(kk)===low(k)&&r[kk]!=null)return r[kk]}}return""}

// Page switching
function switchPage(p){
  document.querySelectorAll(".page").forEach(function(e){e.classList.remove("active")});
  var el=$(p==="overview"?"page-overview":p==="budget"?"page-budget":p==="schedule"?"page-schedule":"page-actions");
  if(el)el.classList.add("active");
  document.querySelectorAll(".rail-icon").forEach(function(e){e.classList.toggle("active",e.getAttribute("data-page")===p)});
  if(STATE._loaded)renderPage(p);
}

// Toggle collapsible
function toggleSec(el){
  var c=el.closest(".card");c.classList.toggle("collapsed");
  try{localStorage.setItem("dova-"+(el.textContent||"").trim().substring(0,15),c.classList.contains("collapsed")?"1":"0")}catch(e){}
}
function restoreSec(){
  document.querySelectorAll(".card-header").forEach(function(h){
    var c=h.closest(".card");if(!c)return;
    try{if(localStorage.getItem("dova-"+(h.textContent||"").trim().substring(0,15))==="1")c.classList.add("collapsed")}catch(e){}
  });
}

// ===== PAGE RENDERERS =====

function skeleton(n){var h="";for(var i=0;i<n;i++)h+='<div class="skel-row w'+(i%3===0?"60":i%3===1?"80":"40")+'"></div>';return h}

function renderPage(p){
  destroyCharts();
  if(p==="overview")renderOverview();
  else if(p==="budget")renderBudget();
  else if(p==="schedule")renderSchedule();
  else if(p==="actions")renderActions();
  restoreSec();
}

function renderOverview(){
  var s00=STATE["00"]||[],s02=STATE["02"]||[],s03=STATE["03"]||[],s04=STATE["04"]||[];
  var s05=STATE["05"]||[],s06=STATE["06"]||[],s08=STATE["08"]||[],s09=STATE["09"]||[];
  var s12=STATE["12"]||[];

  var html="";

  // — KPI Ticker —
  var totMay=0;for(var i=0;i<s04.length;i++){var csi=get(s04[i],["CSI Code"]).toString();if(csi==="SUB"||csi==="CONT"||csi==="OVH"||csi==="TOTAL")continue;totMay+=num(get(s04[i],["McCarthy May 2026 Estimate"]))}
  var openAct=0;for(i=0;i<s03.length;i++){if(sClass(get(s03[i],["Status"]))!=="green")openAct++}
  var crit=0;for(i=0;i<s02.length;i++){if(pClass(get(s02[i],["Priority"]))==="red")crit++}
  var pApp=0;for(i=0;i<s08.length;i++){if(sClass(get(s08[i],["Status"]))==="green")pApp++}
  // Get budget status from s09
  var budgetStatus = "Not Set"; 
  for(i=0;i<s09.length;i++){if(get(s09[i],["Metric"])==="Budget Status")budgetStatus=get(s09[i],["Value"]);if(get(s09[i],["Metric"])==="Total Budget")budgetStatus=get(s09[i],["Value"])}
  var estLabel = ""; for(i=0;i<s09.length;i++){if(get(s09[i],["Metric"]).indexOf("McCarthy")>=0)estLabel=" ("+get(s09[i],["Value"])+" est.)"}

  html+='<div class="kpi-ticker">'
    +'<div class="kpi-cell"><div class="value" style="font-size:18px">'+esc(budgetStatus)+'</div><div class="label">Budget <span style="color:var(--muted);font-weight:400">'+esc(estLabel)+'</span></div></div>'
    +'<div class="kpi-cell"><div class="value">'+openAct+'</div><div class="label">Open Actions</div></div>'
    +'<div class="kpi-cell"><div class="value">'+crit+'</div><div class="label">Critical Issues</div></div>'
    +'<div class="kpi-cell"><div class="value">'+pApp+'/'+s08.length+'</div><div class="label">Permits Approved</div></div>'
    +'<div class="kpi-cell"><div class="value">'+s05.length+'</div><div class="label">Schedule Milestones</div></div>'
    +'<div class="kpi-cell"><div class="value">'+s06.length+'</div><div class="label">Team Contacts</div></div>'
    +"</div>";

  // — Health Scorecard, Documents & Camera —
  html+='<div class="card"><div class="card-header" onclick="toggleSec(this)"><span class="chev">&#9660;</span><span class="chv">PROJECT HEALTH, DOCUMENTS & CAMERA</span></div><div class="card-body">'
    +'<table class="health-tbl">'
    +'<tr><td>Budget</td><td><span class="health-dot a"></span><strong style="color:var(--amber)">Pending Approval</strong><span style="color:var(--muted);font-size:11px;margin-left:6px">McCarthy est. $269.7M</span></td></tr>'
    +'<tr><td>Schedule</td><td><span class="health-dot a"></span><strong style="color:var(--amber)">Watch</strong><span style="color:var(--muted);font-size:11px;margin-left:6px">SD LNTP Jun 26 &bull; Site Prep Sep 18</span></td></tr>'
    +'<tr><td>Permitting</td><td><span class="health-dot g"></span><strong style="color:var(--green)">'+pApp+'/'+s08.length+' Approved</strong></td></tr>'
    +'<tr><td>Actions</td><td><span class="health-dot '+(openAct>5?"a":"g")+'"></span><strong style="color:'+(openAct>5?"var(--amber)":"var(--green)")+'">'+(openAct>0?""+openAct+" Open":"On Track")+'</strong></td></tr>'
    +"</table>"
    +'<div class="doc-grid">'
    +'<div class="doc-col"><h4>Project Controls</h4><a class="doc-link">Executive Schedule</a><a class="doc-link">Budget Tracker</a><a class="doc-link">Procurement Log</a><a class="doc-link">Risk Register</a></div>'
    +'<div class="doc-col"><h4>Meetings</h4><a class="doc-link">OAC Minutes</a><a class="doc-link">Design Meetings</a><a class="doc-link">Client Meetings</a></div>'
    +'<div class="doc-col"><h4>Reports</h4><a class="doc-link">Monthly Reports</a><a class="doc-link">Pay Apps</a><a class="doc-link">Dashboard Archive</a></div>'
    +'<div class="doc-col"><h4>Project Content</h4><a class="doc-link">Drawings</a><a class="doc-link">Renderings</a><a class="doc-link">Site Photos</a></div>'
    +"</div>"
    +'<div style="margin-top:10px"><strong style="font-size:12px">🎞 Camera 1 — South View</strong><br><span style="font-size:11px;color:var(--muted)">Live jobsite camera activates at groundbreaking</span></div>'
    +"</div></div>";

  // — Team — 
  var teamHtml='<div class="card"><div class="card-header" onclick="toggleSec(this)"><span class="chev">&#9660;</span><span class="chv">PROJECT TEAM & CONTACTS</span></div><div class="card-body">';
  var teamRows=s12.length?s12:s06;
  if(!teamRows.length){teamHtml+='<div class="no-data">No team data</div>'}
  else{
    teamHtml+='<div class="team-grid">';
    teamRows.forEach(function(x){teamHtml+='<div class="team-card"><div class="name">'+esc(get(x,["Name"]))+'</div><div class="role">'+esc(get(x,["Role"]))+'</div><div class="email">'+esc(get(x,["Email"]))+"</div></div>"});
    teamHtml+="</div>";
  }
  teamHtml+="</div></div>";
  html+=teamHtml;

  // — Decisions —
  html+='<div class="card"><div class="card-header" onclick="toggleSec(this)"><span class="chev">&#9660;</span><span class="chv">UPCOMING KEY DECISIONS</span></div><div class="card-body">'
    +'<table><thead><tr><th>#</th><th>DECISION</th><th>NEEDED BY</th><th>STATUS</th></tr></thead><tbody>';
  if(!s02.length)html+='<tr><td colspan="4" class="no-data">No decisions</td></tr>';
  else{s02.slice(0,8).forEach(function(x,i){html+='<tr><td>'+(i+1)+'</td><td>'+esc(get(x,["Issue/Risk Statement","Issue / Risk Statement"]))+'</td><td>'+esc(get(x,["Target Date","Due Date"]))+'</td><td>'+pill(get(x,["Status"]))+"</td></tr>"})}
  html+="</tbody></table></div></div>";

  // — Permits —
  html+='<div class="card"><div class="card-header" onclick="toggleSec(this)"><span class="chev">&#9660;</span><span class="chv">PERMITTING MATRIX <span style="font-weight:400;color:var(--muted)">'+s08.length+' items</span></span></div><div class="card-body">'
    +'<table><thead><tr><th>ID</th><th>PERMIT / APPROVAL</th><th>AGENCY</th><th>STATUS</th><th>APPLIED</th></tr></thead><tbody>';
  s08.forEach(function(x){html+='<tr><td>'+esc(get(x,["ID"]))+'</td><td>'+esc(get(x,["Permit / Approval"])).substring(0,50)+'</td><td>'+esc(get(x,["Jurisdiction / Agency"])).substring(0,30)+'</td><td>'+pill(get(x,["Status"]))+'</td><td>'+esc(get(x,["Application Date"]))+"</td></tr>"});
  html+="</tbody></table></div></div>";

  $("page-overview").innerHTML=html;
  restoreSec();
}

function renderBudget(){
  var s04=STATE["04"]||[],s09=STATE["09"]||[],s10=STATE["10"]||[],s11=STATE["11"]||[];
  var html="";

  // Budget KPI ticker
  // Get values from s09 (Budget KPIs)
  var budgetVal = "Not Set";
  var mccarthyEst = "$269.7M";
  var committedVal = "$1.5M";
  var billedVal = "$1.3M";
  var contVal = "TBD";
  for(var i=0;i<s09.length;i++){var m=get(s09[i],["Metric"]);if(m==="Total Budget")budgetVal=get(s09[i],["Value"]);if(m.indexOf("McCarthy")>=0)mccarthyEst=get(s09[i],["Value"]);if(m.indexOf("Committed")>=0)committedVal=get(s09[i],["Value"]);if(m==="Billed to Date")billedVal=get(s09[i],["Value"]);if(m.indexOf("Contingency")>=0)contVal=get(s09[i],["Value"])}
  var showCont = (budgetVal==="Not Set"||budgetVal==="Pending Approval") ? "TBD" : (esc(contVal||"TBD"));
  html+='<div class="kpi-ticker">'
    +'<div class="kpi-cell"><div class="value" style="font-size:16px">'+esc(budgetVal)+'</div><div class="label">Total Budget <span style="color:var(--muted);font-weight:400">(McCarthy est. '+esc(mccarthyEst)+')</span></div></div>'
    +'<div class="kpi-cell"><div class="value">'+esc(committedVal)+'</div><div class="label">Committed (Precon)</div></div>'
    +'<div class="kpi-cell"><div class="value">'+esc(billedVal)+'</div><div class="label">Billed to Date</div></div>'
    +'<div class="kpi-cell"><div class="value">TBD</div><div class="label">Forecast Variance</div></div>'
    +'<div class="kpi-cell"><div class="value">'+showCont+'</div><div class="label">Contingency <span style="color:var(--muted);font-weight:400">(McCarthy est.)</span></div></div>'
    +'<div class="kpi-cell"><div class="value">$0</div><div class="label">Approved Change Orders</div></div>'
    +"</div>";

  // Budget Category Chart + Detail
  var cats=s10.length?s10:[];
  html+='<div class="card"><div class="card-header" onclick="toggleSec(this)"><span class="chev">&#9660;</span><span class="chv">BUDGET BY CATEGORY CHART</span></div><div class="card-body"><div class="chartbox"><canvas id="budgetCatChart"></canvas></div></div></div>';

  html+='<div class="card"><div class="card-header" onclick="toggleSec(this)"><span class="chev">&#9660;</span><span class="chv">BUDGET DETAIL</span></div><div class="card-body">'
    +'<table><thead><tr><th>CATEGORY</th><th>PLANNED</th><th>COMMITTED</th><th>SPENT TO DATE</th><th>FORECAST</th><th>VARIANCE</th><th>% SPENT</th><th>CONT. USED</th><th>STATUS</th></tr></thead><tbody>';
  if(!cats.length)html+='<tr><td colspan="9" class="no-data">Loading budget detail...</td></tr>';
  else cats.forEach(function(x){html+='<tr><td>'+esc(get(x,["Category"]))+'</td><td class="num">'+esc(get(x,["Planned"]))+'</td><td class="num">'+esc(get(x,["Committed"]))+'</td><td class="num">'+esc(get(x,["Spent to Date"]))+'</td><td class="num">'+esc(get(x,["Forecast at Completion"]))+'</td><td class="num">'+(get(x,["Variance"])||"&mdash;")+'</td><td class="num">'+(get(x,["Percent Spent"])||"&mdash;")+'</td><td class="num">'+esc(get(x,["Contingency Used"]))+'</td><td>'+pill(get(x,["Status"]))+"</td></tr>"});
  html+="</tbody></table></div></div>";

  // Budget Position chart
  html+='<div class="card"><div class="card-header" onclick="toggleSec(this)"><span class="chev">&#9660;</span><span class="chv">BUDGET POSITION</span></div><div class="card-body"><div class="chartbox"><canvas id="budgetPosChart"></canvas></div><div class="legend" id="budgetPosLegend"></div></div></div>';

  // Change Orders
  html+='<div class="card"><div class="card-header" onclick="toggleSec(this)"><span class="chev">&#9660;</span><span class="chv">CHANGE ORDER LOG</span></div><div class="card-body"><div id="changeOrderSummary"></div>'
    +'<table><thead><tr><th>CO #</th><th>DESCRIPTION</th><th>TYPE</th><th>VALUE</th><th>FUNDING</th><th>STATUS</th><th>DATE</th></tr></thead><tbody id="changeOrderBody">';
  var cos=s11||[];
  if(!cos.length)html+='<tr><td colspan="7" class="no-data">No change orders</td></tr>';
  else cos.forEach(function(x){html+='<tr><td>'+esc(get(x,["CO Number"]))+'</td><td>'+esc(get(x,["Description"]))+'</td><td>'+esc(get(x,["Type"]))+'</td><td>'+fmtM(get(x,["Value"]))+'</td><td>'+esc(get(x,["Funding Source"]))+'</td><td>'+pill(get(x,["Status"]))+'</td><td>'+esc(get(x,["Date"]))+"</td></tr>"});
  html+="</tbody></table></div></div>";

  $("page-budget").innerHTML=html;

  // Draw charts
  if(cats.length){
    var l=[],p=[];
    cats.forEach(function(x){if(get(x,["Category"])&&get(x,["Category"]).toLowerCase().indexOf("contingency")<0){l.push(get(x,["Category"]));p.push(num(get(x,["Planned"])))}});
    mkChart("budgetCatChart",{type:"bar",data:{labels:l,datasets:[{label:"Planned (M)",data:p,backgroundColor:"#4285F4",borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:"y",plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,grid:{color:"#ECECEC"},ticks:{font:{size:9},callback:function(v){return"$"+v+"M"}}},y:{grid:{display:false},ticks:{font:{size:9}}}}}});

    // Budget Position stacked
    var lb=[],bu=[],co=[],sp=[];
    cats.forEach(function(x){
      var cat=get(x,["Category"]);if(!cat||cat.toLowerCase().indexOf("contingency")>=0)return;
      lb.push(cat);bu.push(num(get(x,["Planned"])));co.push(num(get(x,["Committed"])));sp.push(num(get(x,["Spent to Date"])));
    });
    mkChart("budgetPosChart",{
      type:"bar",data:{labels:lb,datasets:[{label:"Budget",data:bu,backgroundColor:"#4285F4",borderRadius:4,barPercentage:0.98,categoryPercentage:0.95},{label:"Committed",data:co,backgroundColor:"#34A853",borderRadius:4,barPercentage:0.98,categoryPercentage:0.95},{label:"Spent",data:sp,backgroundColor:"#FB8C00",borderRadius:4,barPercentage:0.98,categoryPercentage:0.95}]},
      options:{responsive:true,maintainAspectRatio:false,indexAxis:"y",plugins:{legend:{position:"bottom",labels:{font:{size:10}}}},scales:{x:{stacked:false,grid:{color:"#ECECEC"},ticks:{font:{size:9},callback:function(v){return"$"+v+"M"}}},y:{stacked:false,grid:{display:false},ticks:{font:{size:9}}}}}
    });
    var lg=$("budgetPosLegend");if(lg)lg.innerHTML='<span><span class="swatch" style="background:#4285F4"></span>Budget</span><span><span class="swatch" style="background:#34A853"></span>Committed</span><span><span class="swatch" style="background:#FB8C00"></span>Spent</span>';
  }
}

function renderSchedule(){
  var s05=STATE["05"]||[];
  var html="";

  // Phase order and colors
  var phases=["Predevelopment","Design","Permitting","Construction","Closeout"];
  var pColors={"Predevelopment":"gray","Design":"blue","Permitting":"amber","Construction":"green","Closeout":"#6f42c1"};

  // Group by phase
  var grouped={};
  s05.forEach(function(x){
    var p=get(x,["Phase"]);
    // Skip the project total row for display, add it separately
    if(p==="Project") return;
    if(!grouped[p]) grouped[p]=[];
    grouped[p].push(x);
  });

  // Project total header
  var projTotal = s05.filter(function(x){return get(x,["Phase"])==="Project"})[0];
  if(projTotal){
    html+='<div style="background:var(--navy);color:#fff;padding:10px 16px;border-radius:8px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">'
      +'<div><strong style="font-size:15px">DOVA Arena</strong><br><span style="font-size:11px;opacity:.8">502 days &middot; '+"Jun 15, 2026 – May 16, 2028"+'</span></div>'
      +'<div style="text-align:right"><span style="font-size:22px;font-weight:800">'+s05.length+'</span><br><span style="font-size:10px;opacity:.8">Schedule Items</span></div>'
      +'</div>';
  }

  // Timeline header
  var years=["2026","2027","2028"];
  var months=[];
  for(var y=2026;y<=2028;y++){for(var m=0;m<12;m++){months.push(y+"-"+String(m+1).padStart(2,"0"))}}

  // Render each phase group
  phases.forEach(function(ph){
    var items=grouped[ph]||[];
    if(!items.length) return;
    var color=pColors[ph]||"gray";

    html+='<div class="card" style="border-left:3px solid '+color+'">'
      +'<div class="card-header" onclick="toggleSec(this)"><span class="chev">&#9660;</span><span class="chv">'
      +'<span style="color:'+color+';font-weight:800">&#9632;</span> '+ph+' <span style="font-weight:400;color:var(--muted)">'+items.length+' items</span></span></div>'
      +'<div class="card-body" style="padding:0">'
      +'<table><thead><tr><th style="width:80px">ID</th><th>DESCRIPTION</th><th style="width:100px">START</th><th style="width:100px">FINISH</th><th style="width:50px">DUR</th><th style="width:40px">PRED</th></tr></thead><tbody>';

    items.forEach(function(x){
      var id=get(x,["Milestone ID"]);
      var desc=get(x,["Description"]);
      var start=get(x,["Planned Start"]);
      var finish=get(x,["Planned Finish"]);
      var pred=get(x,["Predecessor"]);
      // Estimate duration from date diff
      var durCalc="";
      if(start && finish && start!==finish){
        try{
          var d1=new Date(start+"T00:00:00"),d2=new Date(finish+"T00:00:00");
          var diff=Math.round((d2-d1)/(86400000))+1;
          if(diff>0) durCalc=diff+"d";
        }catch(e){}
      } else if(start && start===finish) {
        durCalc="0";
      }
      html+='<tr><td style="font-size:10px;color:var(--muted)">'+esc(id)+'</td>'
        +'<td><strong>'+esc(desc)+'</strong></td>'
        +'<td style="font-size:11px">'+fmtDate(start)+'</td>'
        +'<td style="font-size:11px">'+fmtDate(finish)+'</td>'
        +'<td style="font-size:10px;color:var(--muted)">'+durCalc+'</td>'
        +'<td style="font-size:10px;color:var(--muted)">'+esc(pred||"")+'</td>'
        +'</tr>';
    });

    html+="</tbody></table></div></div>";
  });

  // Permitting schedule (hardcoded from PDF data since it's a gating view)
  // Actually let's pull from the phase data instead
  var permItems=grouped["Permitting"]||[];
  html+='<div class="card" style="border-left:3px solid var(--amber)"><div class="card-header" onclick="toggleSec(this)"><span class="chev">&#9660;</span><span class="chv">'
    +'<span style="color:var(--amber);font-weight:800">&#9632;</span> PERMITTING GATING PATH <span style="font-weight:400;color:var(--muted)">Key approval timeline</span></span></div><div class="card-body">'
    +'<table><thead><tr><th>PERMIT / APPROVAL</th><th>SUBMIT</th><th>APPROVAL</th><th>DURATION</th><th>STATUS</th></tr></thead><tbody>';
  if(permItems.length){
    permItems.forEach(function(x){
      var desc=get(x,["Description"]);
      var start=get(x,["Planned Start"]);
      var finish=get(x,["Planned Finish"]);
      var dur="";
      if(start&&finish&&start!==finish){
        try{var d1=new Date(start+"T00:00:00"),d2=new Date(finish+"T00:00:00");dur=Math.round((d2-d1)/(86400000))+1+"d"}catch(e){}
      }
      html+='<tr><td>'+esc(desc)+'</td><td>'+fmtDate(start)+'</td><td>'+fmtDate(finish)+'</td><td>'+dur+'</td><td>'+pill("Not Started","gray")+'</td></tr>';
    });
  } else {
    html+='<tr><td colspan="5" class="no-data">No permitting data</td></tr>';
  }
  html+="</tbody></table></div></div>";

  $("page-schedule").innerHTML=html;
  restoreSec();
}

function renderActions(){
  var s02=STATE["02"]||[],s03=STATE["03"]||[];
  var html="";

  var openAct=0,overAct=0;
  for(var i=0;i<s03.length;i++){var sc=sClass(get(s03[i],["Status"]));if(sc!=="green")openAct++;if(sc==="red")overAct++}
  var crit=0;for(i=0;i<s02.length;i++){if(pClass(get(s02[i],["Priority"]))==="red")crit++}

  html+='<div class="card"><div class="card-header"><span class="chv">ACTION ITEMS OVERVIEW</span></div><div class="card-body">'
    +'<div class="counters">'
    +'<div class="counter"><div class="num">'+openAct+'</div><div class="lbl">Open Actions</div></div>'
    +'<div class="counter"><div class="num '+(overAct>0?"amber":"")+'">'+overAct+'</div><div class="lbl">Overdue</div></div>'
    +'<div class="counter"><div class="num '+(crit>0?"amber":"")+'">'+crit+'</div><div class="lbl">Critical Issues</div></div>'
    +'<div class="counter"><div class="num">'+(s03.length)+'</div><div class="lbl">Total Items</div></div>'
    +"</div></div></div>";

  // — Immediate Next Steps: KozPure Decisions — 
  var kozItems = s03.filter(function(x){return get(x,["Owner"])=="KozPure"});
  if(kozItems.length){
    var kozOpen=0,kozCrit=0;
    kozItems.forEach(function(x){var sc=sClass(get(x,["Status"]));if(sc!=="green")kozOpen++;if(get(x,["Priority"])=="Critical")kozCrit++});
    html+='<div class="card" style="border:2px solid var(--gold)"><div class="card-header" onclick="toggleSec(this)"><span class="chev">&#9660;</span><span class="chv">'
      +'<span style="color:var(--gold);font-weight:800">&#9654;</span> IMMEDIATE NEXT STEPS — Decisions Needed from KozPure <span style="font-weight:400;color:var(--muted)">'+kozItems.length+' items</span></span></div><div class="card-body" style="padding:0">'
      +'<table><thead><tr><th>#</th><th>DECISION NEEDED</th><th>OWNER</th><th>DUE</th><th>PRIORITY</th><th>STATUS</th></tr></thead><tbody>';
    kozItems.forEach(function(x,i){html+='<tr>'
      +'<td style="font-size:10px;color:var(--muted)">'+(i+1)+'</td>'
      +'<td style="font-weight:600">'+esc(get(x,["Action Description"]))+'</td>'
      +'<td>'+pill("KozPure","amber")+'</td>'
      +'<td>'+esc(get(x,["Due Date"]))+'</td>'
      +'<td>'+pill(get(x,["Priority"]),pClass(get(x,["Priority"])))+'</td>'
      +'<td>'+pill(get(x,["Status"]))+'</td>'
      +'</tr>'});
    html+="</tbody></table></div></div>";
  }

  html+='<div class="card"><div class="card-header" onclick="toggleSec(this)"><span class="chev">&#9660;</span><span class="chv">ALL ACTION ITEMS <span style="font-weight:400;color:var(--muted)">'+s03.length+' items</span></span></div><div class="card-body">'
    +'<table><thead><tr><th>ID</th><th>ACTION</th><th>OWNER</th><th>DUE</th><th>PRIORITY</th><th>STATUS</th></tr></thead><tbody>';
  if(!s03.length)html+='<tr><td colspan="6" class="no-data">No action items</td></tr>';
  else s03.forEach(function(x){html+='<tr><td>'+esc(get(x,["Action ID"]))+'</td><td>'+esc(get(x,["Action Description"]))+'</td><td>'+esc(get(x,["Owner"]))+'</td><td>'+esc(get(x,["Due Date"]))+'</td><td>'+pill(get(x,["Priority"]),pClass(get(x,["Priority"])))+'</td><td>'+pill(get(x,["Status"]))+"</td></tr>"});
  html+="</tbody></table></div></div>";

  html+='<div class="card"><div class="card-header" onclick="toggleSec(this)"><span class="chev">&#9660;</span><span class="chv">ISSUES & DECISIONS <span style="font-weight:400;color:var(--muted)">'+s02.length+' items</span></span></div><div class="card-body">'
    +'<table><thead><tr><th>ID</th><th>ISSUE / RISK</th><th>CATEGORY</th><th>PRIORITY</th><th>STATUS</th></tr></thead><tbody>';
  if(!s02.length)html+='<tr><td colspan="5" class="no-data">No issues</td></tr>';
  else s02.forEach(function(x){html+='<tr><td>'+esc(get(x,["Issue ID"]))+'</td><td>'+esc(get(x,["Issue/Risk Statement","Issue / Risk Statement"])).substring(0,80)+'</td><td>'+esc(get(x,["Category"]))+'</td><td>'+pill(get(x,["Priority"]),pClass(get(x,["Priority"])))+'</td><td>'+pill(get(x,["Status"]))+"</td></tr>"});
  html+="</tbody></table></div></div>";

  $("page-actions").innerHTML=html;
}

// ===== DATA =====
function fetchAll(){
  var p=KEYS.length,ok=true;
  KEYS.forEach(function(k){
    fetch(API+k).then(function(r){return r.json()}).then(function(j){STATE[k]=norm(j)})
    .catch(function(){ok=false;if(!STATE[k])STATE[k]=[]})
    .then(function(){if(--p===0)done(ok)});
  });
}
function done(ok){
  STATE._loaded=true;
  renderPage("overview");
  var d=new Date();$("updated").textContent="Updated "+d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  $("dot").className="dot"+(ok?"":" stale");
}
document.addEventListener("DOMContentLoaded",function(){
  // Show skeleton
  $("page-overview").innerHTML='<div class="skel-ticker">'+Array(6).fill('<div></div>').join("")+"</div>"+skeleton(12);
  $("page-budget").innerHTML='<div class="skel-ticker">'+Array(6).fill('<div></div>').join("")+"</div>"+skeleton(10);
  $("page-schedule").innerHTML=skeleton(10);
  $("page-actions").innerHTML=skeleton(14);
  fetchAll();
  setInterval(fetchAll,60000);
});
</script>
</body>
</html>`;

function handler(req, res){
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (typeof res.status === "function") res.status(200);
  res.end(HTML);
}

module.exports = handler;
module.exports.handler = handler;
module.exports.html = HTML;