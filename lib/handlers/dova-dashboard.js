// dova-dashboard.js
// DOVA Arena command center. Serves a multi-page HTML dashboard that reads live
// data from /api/dova?sheet=NN. Navy/gold theme, 4 pages, no auth.

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>02 - DOVA Arena | Command Center</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
  :root{
    --navy:#1F4E79; --navy-d:#163a5a; --gold:#C4962B; --gold-l:#e0b554;
    --ink:#1c2733; --muted:#67788a; --line:#e4e9ef; --bg:#f4f6f8; --card:#ffffff;
    --g:#1e7f4f; --gb:#e6f4ec; --a:#b7791f; --ab:#fbf1dd; --r:#c0392b; --rb:#fbe7e4;
    --b:#2c6fb0; --bb:#e7f0fa; --n:#7a8896; --nb:#eef1f4;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased}
  .hidden{display:none !important}

  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased}

  /* App shell */
  #app{display:flex;min-height:100vh}
  .nav{width:212px;flex:0 0 212px;background:var(--navy);color:#cdd9e6;display:flex;flex-direction:column;position:sticky;top:0;height:100vh}
  .nav .brand{display:flex;align-items:center;gap:11px;padding:18px 16px;border-bottom:1px solid rgba(255,255,255,.08)}
  .nav .brand .badge{width:38px;height:38px;border-radius:9px;background:var(--gold);color:var(--navy-d);font-weight:800;display:flex;align-items:center;justify-content:center;font-size:15px}
  .nav .brand .bt{font-size:13px;font-weight:700;color:#fff;line-height:1.2}
  .nav .brand .bs{font-size:11px;color:#9fb3c8}
  .nav .items{padding:12px 10px;flex:1}
  .nav a{display:flex;align-items:center;gap:11px;padding:11px 13px;border-radius:9px;color:#cdd9e6;text-decoration:none;font-size:14px;font-weight:500;cursor:pointer;margin-bottom:3px}
  .nav a .ic{width:18px;text-align:center;opacity:.85}
  .nav a:hover{background:rgba(255,255,255,.06);color:#fff}
  .nav a.active{background:var(--gold);color:var(--navy-d);font-weight:700}
  .nav .foot{padding:14px 16px;font-size:11px;color:#7d93aa;border-top:1px solid rgba(255,255,255,.08)}

  main{flex:1;min-width:0;display:flex;flex-direction:column}
  .masthead{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 26px;background:var(--card);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:10}
  .masthead .mt{font-size:17px;font-weight:700;color:var(--navy)}
  .masthead .ms{font-size:12px;color:var(--muted);margin-top:2px}
  .masthead .right{display:flex;align-items:center;gap:14px}
  .sync{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--muted)}
  .dot{width:9px;height:9px;border-radius:50%;background:var(--g)}
  .dot.stale{background:var(--r)}
  .printbtn{border:1px solid var(--line);background:#fff;color:var(--ink);padding:8px 13px;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600}
  .printbtn:hover{border-color:var(--navy);color:var(--navy)}

  .wrap{padding:24px 26px;max-width:1240px;width:100%}
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:22px}
  .kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 17px;position:relative;overflow:hidden}
  .kpi:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--gold)}
  .kpi .k{font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.4px}
  .kpi .v{font-size:25px;font-weight:800;color:var(--navy);margin-top:7px;line-height:1.1}
  .kpi .s{font-size:12px;color:var(--muted);margin-top:4px}
  .kpi .v.r{color:var(--r)} .kpi .v.g{color:var(--g)}

  .card{background:var(--card);border:1px solid var(--line);border-radius:12px;margin-bottom:18px;overflow:hidden}
  .card>.ch{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;cursor:pointer;user-select:none}
  .card>.ch .ct{font-size:14px;font-weight:700;color:var(--navy)}
  .card>.ch .cv{font-size:12px;color:var(--muted);font-weight:600}
  .chev{transition:transform .18s;color:var(--muted);font-size:13px}
  .card.collapsed .chev{transform:rotate(-90deg)}
  .card.collapsed>.cb{display:none}
  .cb{padding:0 18px 16px;overflow-x:auto}

  table{width:100%;border-collapse:collapse;font-size:13px}
  thead th{text-align:left;color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.4px;padding:9px 10px;border-bottom:2px solid var(--line);white-space:nowrap}
  tbody td{padding:10px;border-bottom:1px solid var(--line);vertical-align:top}
  tbody tr:hover{background:#fafbfc}
  td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  .pill{display:inline-block;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap}
  .pill.g{color:var(--g);background:var(--gb)} .pill.a{color:var(--a);background:var(--ab)}
  .pill.r{color:var(--r);background:var(--rb)} .pill.b{color:var(--b);background:var(--bb)}
  .pill.n{color:var(--n);background:var(--nb)}
  .chartbox{height:300px;padding:6px 4px}
  .empty{padding:26px;text-align:center;color:var(--muted);font-size:13px}
  .grid2{display:grid;grid-template-columns:1.1fr .9fr;gap:18px}

  /* Skeleton shimmer */
  .sk{background:linear-gradient(90deg,#eef1f4 25%,#e3e8ee 37%,#eef1f4 63%);background-size:400% 100%;animation:sh 1.3s ease infinite;border-radius:6px}
  @keyframes sh{0%{background-position:100% 0}100%{background-position:-100% 0}}
  .sk-row{height:38px;margin:8px 0}
  .sk-kpi{height:92px;border-radius:12px}

  @media (max-width:860px){
    #app{flex-direction:column}
    .nav{width:100%;height:auto;flex:none;flex-direction:row;position:sticky;top:0;overflow-x:auto}
    .nav .brand{border-bottom:0;border-right:1px solid rgba(255,255,255,.08);white-space:nowrap}
    .nav .items{display:flex;padding:8px;flex:0 0 auto}
    .nav a{margin-bottom:0;white-space:nowrap}
    .nav .foot{display:none}
    .grid2{grid-template-columns:1fr}
  }
  @media print{
    .nav,.printbtn,.sync{display:none !important}
    .card.collapsed>.cb{display:block}
    .masthead{position:static}
    body{background:#fff}
  }
</style>
</head>
<body>

<div id="app" class="hidden">
  <!-- Masthead -->
    <div class="brand">
      <div class="badge">DA</div>
      <div><div class="bt">DOVA Arena</div><div class="bs">Command Center</div></div>
    </div>
    <div class="items">
      <a data-page="overview" class="active"><span class="ic">&#9632;</span> Overview</a>
      <a data-page="budget"><span class="ic">&#36;</span> Budget</a>
      <a data-page="schedule"><span class="ic">&#9202;</span> Schedule</a>
      <a data-page="actions"><span class="ic">&#10003;</span> Actions</a>
    </div>
    <div class="foot">Level Up Project Development</div>
  </aside>

  <main>
    <header class="masthead">
      <div>
        <div class="mt" id="pgtitle">Overview</div>
        <div class="ms">DOVA Arena &middot; Rancho Cordova, CA</div>
      </div>
      <div class="right">
        <div class="sync"><span class="dot" id="dot"></span><span id="updated">Loading...</span></div>
        <button class="printbtn" onclick="window.print()">Print</button>
      </div>
    </header>

    <div class="wrap">
      <section id="page-overview" class="page"></section>
      <section id="page-budget" class="page hidden"></section>
      <section id="page-schedule" class="page hidden"></section>
      <section id="page-actions" class="page hidden"></section>
    </div>
  </main>
</div>

<script>
"use strict";
var PASSWORD = "dova2026";
var API = "/api/dova?sheet=";
var SHEETS = ["00","01","02","03","04","05","06","08"];
var STATE = {};
var CURRENT = "overview";
var CHART = null;
var FIRST = true;

function $(id){ return document.getElementById(id); }
function esc(v){ v = "" + (v==null?"":v); return v.split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;").split('"').join("&quot;"); }
function num(v){ if(v==null) return 0; var s=""+v,o=""; for(var i=0;i<s.length;i++){ var c=s.charAt(i); if("0123456789.-".indexOf(c)>=0) o+=c; } var n=parseFloat(o); return isNaN(n)?0:n; }
function money(n){ var neg=n<0; n=Math.round(Math.abs(n)); return (neg?"-$":"$")+n.toLocaleString("en-US"); }
function low(v){ return ("" + (v||"")).toLowerCase(); }
function anyOf(s, arr){ for(var i=0;i<arr.length;i++){ if(s.indexOf(arr[i])>=0) return true; } return false; }

function statusClass(v){
  var s = low(v);
  if(!s) return "n";
  if(anyOf(s,["complete","approved","awarded","delivered","closed","signed","done","issued","granted","received"])) return "g";
  if(anyOf(s,["progress","pricing","submitted","review","active","ongoing","pending review","negotiat","in-"])) return "a";
  if(anyOf(s,["block","overdue","critical","realized","rejected","at risk","denied","fail","expired","stalled"])) return "r";
  return "n";
}
function priorityClass(v){
  var s = low(v);
  if(s.indexOf("critical")>=0) return "r";
  if(s.indexOf("high")>=0) return "a";
  if(s.indexOf("medium")>=0||s.indexOf("med")>=0) return "b";
  return "n";
}
function pill(v, cls){ if(v==null||(""+v).trim()==="") return ""; return '<span class="pill '+cls+'">'+esc(v)+'</span>'; }

// Normalize a /api/dova response into an array of row objects keyed by column title.
function normalize(json){
  if(!json) return [];
  if(Array.isArray(json)) return json;
  if(json.data && Array.isArray(json.data)) return json.data;
  if(json.rows && json.columns){
    var byId = {};
    for(var i=0;i<json.columns.length;i++){ byId[json.columns[i].id] = json.columns[i].title; }
    var out = [];
    for(var r=0;r<json.rows.length;r++){
      var obj = {}, cells = json.rows[r].cells || [];
      for(var c=0;c<cells.length;c++){
        var t = byId[cells[c].columnId];
        if(t) obj[t] = (cells[c].displayValue!=null ? cells[c].displayValue : cells[c].value);
      }
      out.push(obj);
    }
    return out;
  }
  if(json.rows && Array.isArray(json.rows)) return json.rows;
  return [];
}

function get(row, keys){
  for(var i=0;i<keys.length;i++){
    var k = keys[i];
    if(row[k]!=null && (""+row[k]).trim()!=="") return row[k];
    // case-insensitive fallback
    for(var kk in row){ if(low(kk)===low(k) && row[kk]!=null) return row[kk]; }
  }
  return "";
}

// Generic table builder. cols = [{keys:[...], label, kind}]
function table(rows, cols){
  if(!rows || !rows.length) return '<div class="empty">No rows in this sheet yet.</div>';
  var h = "<table><thead><tr>";
  for(var i=0;i<cols.length;i++){ h += "<th>"+esc(cols[i].label)+"</th>"; }
  h += "</tr></thead><tbody>";
  for(var r=0;r<rows.length;r++){
    h += "<tr>";
    for(var c=0;c<cols.length;c++){
      var col = cols[c], raw = get(rows[r], col.keys), kind = col.kind || "text";
      if(kind==="money"){ h += '<td class="num">'+(("" + raw).trim()===""?"":esc(money(num(raw))))+"</td>"; }
      else if(kind==="variance"){ var n=num(raw); var cls=n>0?"r":(n<0?"g":"n"); h += '<td class="num"><span class="pill '+cls+'">'+(raw===""?"-":esc(money(n)))+"</span></td>"; }
      else if(kind==="status"){ h += "<td>"+pill(raw, statusClass(raw))+"</td>"; }
      else if(kind==="priority"){ h += "<td>"+pill(raw, priorityClass(raw))+"</td>"; }
      else if(kind==="pill"){ h += "<td>"+pill(raw, "b")+"</td>"; }
      else if(kind==="flag"){ var f=low(raw); var fc=(f==="y"||f==="yes"||f==="true")?"a":"n"; var ft=(f==="y"||f==="yes"||f==="true")?"OPOI":"-"; h += "<td>"+pill(ft, fc)+"</td>"; }
      else { h += "<td>"+esc(raw)+"</td>"; }
    }
    h += "</tr>";
  }
  return h + "</tbody></table>";
}

function card(title, sub, bodyHtml, collapsed){
  return '<div class="card'+(collapsed?" collapsed":"")+'"><div class="ch" onclick="this.parentNode.classList.toggle(\'collapsed\')">'
    +'<span class="ct">'+esc(title)+'</span><span class="cv">'+(sub?esc(sub)+'  ':'')+'<span class="chev">&#9660;</span></span></div>'
    +'<div class="cb">'+bodyHtml+'</div></div>';
}

function kpi(label, value, sub, cls){
  return '<div class="kpi"><div class="k">'+esc(label)+'</div><div class="v '+(cls||"")+'">'+esc(value)+'</div>'+(sub?'<div class="s">'+esc(sub)+'</div>':'')+'</div>';
}

function skeleton(kind){
  if(kind==="kpis"){ var h='<div class="kpis">'; for(var i=0;i<6;i++) h+='<div class="sk sk-kpi"></div>'; return h+'</div>'; }
  var h=''; for(var i=0;i<6;i++) h+='<div class="sk sk-row"></div>'; return h;
}

/* ---- Pages ---- */
function renderOverview(){
  var s00=STATE["00"]||[], s02=STATE["02"]||[], s03=STATE["03"]||[], s04=STATE["04"]||[], s06=STATE["06"]||[], s08=STATE["08"]||[];
  var totMay=0, totSep=0;
  for(var i=0;i<s04.length;i++){ totMay+=num(get(s04[i],["McCarthy May 2026 Estimate"])); totSep+=num(get(s04[i],["Sep 2025 Estimate"])); }
  var variance = totMay-totSep;
  var openAct=0; for(i=0;i<s03.length;i++){ if(statusClass(get(s03[i],["Status"]))!=="g") openAct++; }
  var crit=0; for(i=0;i<s02.length;i++){ if(priorityClass(get(s02[i],["Priority"]))==="r") crit++; }
  var permApproved=0; for(i=0;i<s08.length;i++){ if(statusClass(get(s08[i],["Status"]))==="g") permApproved++; }
  var actPri=0; for(i=0;i<s00.length;i++){ if(statusClass(get(s00[i],["Status"]))!=="g") actPri++; }

  var k = '<div class="kpis">'
    + kpi("Total Budget", money(totMay), "McCarthy May 2026")
    + kpi("Budget Variance", money(variance), "vs Sep 2025", variance>0?"r":"g")
    + kpi("Active Priorities", ""+actPri, "of "+s00.length+" workstreams")
    + kpi("Open Actions", ""+openAct, "of "+s03.length+" total")
    + kpi("Critical Issues", ""+crit, "needing decision")
    + kpi("Permits Approved", permApproved+" / "+s08.length, "applications")
    + '</div>';

  var prio = card("Reset Priorities", s00.length+" workstreams",
    table(s00, [
      {keys:["Priority"],label:"Priority",kind:"priority"},
      {keys:["Workstream","Title"],label:"Workstream"},
      {keys:["Status"],label:"Status",kind:"status"},
      {keys:["Target Date","Due Date"],label:"Target"}
    ]), false);

  var perm = card("Permitting Snapshot", s08.length+" items",
    table(s08, [
      {keys:["ID","Permit ID"],label:"ID"},
      {keys:["Permit/Approval","Permit / Approval","Permit"],label:"Permit / Approval"},
      {keys:["Status"],label:"Status",kind:"status"},
      {keys:["Application Date"],label:"Applied"},
      {keys:["Dependencies"],label:"Dependencies"}
    ]), true);

  var contacts = card("Key Contacts", s06.length+" people",
    table(s06, [
      {keys:["Name"],label:"Name"},
      {keys:["Company"],label:"Company"},
      {keys:["Role"],label:"Role"},
      {keys:["Email"],label:"Email"}
    ]), true);

  $("page-overview").innerHTML = k + prio + perm + contacts;
}

function renderBudget(){
  var s04=STATE["04"]||[];
  var totMay=0,totSep=0;
  for(var i=0;i<s04.length;i++){ totMay+=num(get(s04[i],["McCarthy May 2026 Estimate"])); totSep+=num(get(s04[i],["Sep 2025 Estimate"])); }
  var k='<div class="kpis">'
    + kpi("McCarthy May 2026", money(totMay), s04.length+" line items")
    + kpi("Sep 2025 Estimate", money(totSep), "prior baseline")
    + kpi("Total Variance", money(totMay-totSep), "May vs Sep", (totMay-totSep)>0?"r":"g")
    + '</div>';

  var chartCard = card("Budget Distribution", "top scopes by May 2026 estimate",
    '<div class="chartbox"><canvas id="budchart"></canvas></div>', false);

  var tbl = card("Budget Line Items", s04.length+" rows",
    table(s04, [
      {keys:["CSI Code"],label:"CSI"},
      {keys:["Scope Description"],label:"Scope"},
      {keys:["McCarthy May 2026 Estimate"],label:"May 2026",kind:"money"},
      {keys:["Sep 2025 Estimate"],label:"Sep 2025",kind:"money"},
      {keys:["Variance"],label:"Variance",kind:"variance"}
    ]), false);

  $("page-budget").innerHTML = k + chartCard + tbl;
  drawChart(s04);
}

function drawChart(s04){
  if(typeof Chart==="undefined") return;
  var cv = $("budchart"); if(!cv) return;
  var items=[];
  for(var i=0;i<s04.length;i++){ var v=num(get(s04[i],["McCarthy May 2026 Estimate"])); if(v>0) items.push({l:get(s04[i],["Scope Description","CSI Code"]),v:v}); }
  items.sort(function(a,b){return b.v-a.v;});
  var top=items.slice(0,8);
  var labels=[],data=[];
  for(i=0;i<top.length;i++){ labels.push((""+top[i].l).slice(0,28)); data.push(top[i].v); }
  var palette=["#1F4E79","#C4962B","#2c6fb0","#1e7f4f","#b7791f","#5a7d9a","#e0b554","#8aa4bd"];
  if(CHART){ CHART.destroy(); CHART=null; }
  CHART = new Chart(cv.getContext("2d"), {
    type:"doughnut",
    data:{labels:labels,datasets:[{data:data,backgroundColor:palette,borderWidth:2,borderColor:"#fff"}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"right",labels:{boxWidth:12,font:{size:11}}},
      tooltip:{callbacks:{label:function(c){return c.label+": "+money(c.parsed);}}}}}
  });
}

function renderSchedule(){
  var s05=STATE["05"]||[];
  $("page-schedule").innerHTML = card("Schedule Milestones", s05.length+" milestones",
    table(s05, [
      {keys:["Milestone ID"],label:"ID"},
      {keys:["Description"],label:"Description"},
      {keys:["Planned Start"],label:"Planned Start"},
      {keys:["Planned Finish"],label:"Planned Finish"},
      {keys:["Phase"],label:"Phase",kind:"pill"}
    ]), false);
}

function renderActions(){
  var s03=STATE["03"]||[], s02=STATE["02"]||[];
  var a = card("Action Items", s03.length+" actions",
    table(s03, [
      {keys:["Action ID"],label:"ID"},
      {keys:["Action Description"],label:"Action"},
      {keys:["Owner"],label:"Owner"},
      {keys:["Due Date"],label:"Due"},
      {keys:["Priority"],label:"Priority",kind:"priority"},
      {keys:["Status"],label:"Status",kind:"status"}
    ]), false);
  var b = card("Issues & Decisions", s02.length+" items",
    table(s02, [
      {keys:["Issue ID"],label:"ID"},
      {keys:["Issue/Risk Statement","Issue / Risk Statement"],label:"Issue / Risk"},
      {keys:["Category"],label:"Category"},
      {keys:["Priority"],label:"Priority",kind:"priority"},
      {keys:["Status"],label:"Status",kind:"status"}
    ]), false);
  $("page-actions").innerHTML = a + b;
}

function renderCurrent(){
  if(CURRENT==="overview") renderOverview();
  else if(CURRENT==="budget") renderBudget();
  else if(CURRENT==="schedule") renderSchedule();
  else if(CURRENT==="actions") renderActions();
}

function showSkeleton(){
  $("page-overview").innerHTML = skeleton("kpis") + skeleton("rows");
  $("page-budget").innerHTML = skeleton("kpis") + skeleton("rows");
  $("page-schedule").innerHTML = skeleton("rows");
  $("page-actions").innerHTML = skeleton("rows");
}

function loadAll(){
  var pending = SHEETS.length, ok = true;
  for(var i=0;i<SHEETS.length;i++){
    (function(key){
      fetch(API+key).then(function(r){ return r.json(); }).then(function(j){ STATE[key]=normalize(j); })
      .catch(function(){ ok=false; if(!STATE[key]) STATE[key]=[]; })
      .then(function(){ if(--pending===0) finishLoad(ok); });
    })(SHEETS[i]);
  }
}
function finishLoad(ok){
  FIRST=false;
  renderCurrent();
  var d=new Date();
  $("updated").textContent = "Updated "+d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"});
  $("dot").className = "dot" + (ok?"":" stale");
}

function setPage(p, el){
  CURRENT=p;
  var pages=["overview","budget","schedule","actions"];
  for(var i=0;i<pages.length;i++){ $("page-"+pages[i]).classList.toggle("hidden", pages[i]!==p); }
  var links=document.querySelectorAll(".nav a");
  for(i=0;i<links.length;i++){ links[i].classList.toggle("active", links[i].getAttribute("data-page")===p); }
  $("pgtitle").textContent = p.charAt(0).toUpperCase()+p.slice(1);
  if(!FIRST) renderCurrent();
}

function start(){
  $("app").classList.remove("hidden");
  showSkeleton();
  loadAll();
  setInterval(loadAll, 60000);
}
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