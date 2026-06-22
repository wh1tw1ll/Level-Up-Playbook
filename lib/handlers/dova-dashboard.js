// dova-dashboard.js
// DOVA Arena Command Center — single-page layout matching Chiefs dashboard style
// Reads live data from /api/dova?sheet=NN. Navy/gold theme. No auth.

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>DOVA Arena — Live Project Command Center</title>
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

  /* App shell */
  #app{display:flex;min-height:100vh}
  .sidebar{width:220px;flex:0 0 220px;background:var(--navy);color:#cdd9e6;display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow-y:auto}
  .sidebar .brand{padding:18px 16px 12px;border-bottom:1px solid rgba(255,255,255,.08);text-align:center}
  .sidebar .brand img{height:34px;width:auto}
  .sidebar .section{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#7d93aa;padding:14px 16px 6px}
  .sidebar a{display:flex;align-items:center;gap:10px;padding:9px 16px;color:#bccbd9;text-decoration:none;font-size:13px;font-weight:500}
  .sidebar a:hover{background:rgba(255,255,255,.06);color:#fff}
  .sidebar a .ico{width:16px;text-align:center;opacity:.7;font-size:12px}
  .sidebar .foot{margin-top:auto;padding:14px 16px;font-size:10px;color:#7d93aa;border-top:1px solid rgba(255,255,255,.08)}

  main{flex:1;min-width:0;display:flex;flex-direction:column}
  .masthead{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 26px;background:var(--card);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:10;flex-wrap:wrap}
  .masthead .left{display:flex;align-items:center;gap:14px}
  .masthead .mt{font-size:17px;font-weight:700;color:var(--navy)}
  .masthead .ms{font-size:12px;color:var(--muted);margin-top:1px}
  .masthead .right{display:flex;align-items:center;gap:12px}
  .health-badge{display:flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700}
  .health-badge.g{background:var(--gb);color:var(--g)}
  .health-badge.a{background:var(--ab);color:var(--a)}
  .health-badge.r{background:var(--rb);color:var(--r)}
  .sync{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--muted)}
  .dot{width:9px;height:9px;border-radius:50%;background:var(--g)}
  .dot.stale{background:var(--r)}
  .printbtn{border:1px solid var(--line);background:#fff;color:var(--ink);padding:7px 13px;border-radius:8px;font-size:12px;cursor:pointer;font-weight:600}
  .printbtn:hover{border-color:var(--navy);color:var(--navy)}

  .wrap{padding:22px 26px;max-width:1300px;width:100%}

  /* Section headers */
  .sect{margin-bottom:22px}
  .sect-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
  .sect-title h2{font-size:16px;font-weight:700;color:var(--navy)}
  .sect-title .link{font-size:12px;color:var(--b);text-decoration:none}
  .sect-title .link:hover{text-decoration:underline}

  /* KPI grid */
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px}
  .kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:15px 17px;position:relative;overflow:hidden}
  .kpi:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--gold)}
  .kpi .k{font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.4px}
  .kpi .v{font-size:24px;font-weight:800;color:var(--navy);margin-top:6px;line-height:1.1}
  .kpi .s{font-size:11px;color:var(--muted);margin-top:3px}
  .kpi .v.r{color:var(--r)} .kpi .v.g{color:var(--g)}

  /* Health scorecard */
  .hc{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}
  .hc-item{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:13px;text-align:center}
  .hc-item .hl{font-size:11px;color:var(--muted);font-weight:600;margin-bottom:6px}
  .hc-item .hv{display:inline-block;padding:4px 14px;border-radius:20px;font-size:13px;font-weight:700}
  .hc-item .hv.g{background:var(--gb);color:var(--g)}
  .hc-item .hv.a{background:var(--ab);color:var(--a)}
  .hc-item .hv.r{background:var(--rb);color:var(--r)}

  /* Card */
  .card{background:var(--card);border:1px solid var(--line);border-radius:12px;margin-bottom:16px;overflow:hidden}
  .card>.ch{display:flex;align-items:center;justify-content:space-between;padding:13px 18px;cursor:pointer;user-select:none}
  .card>.ch .ct{font-size:14px;font-weight:700;color:var(--navy)}
  .card>.ch .cv{font-size:12px;color:var(--muted);font-weight:600}
  .chev{transition:transform .18s;color:var(--muted);font-size:12px}
  .card.collapsed .chev{transform:rotate(-90deg)}
  .card.collapsed>.cb{display:none}
  .cb{padding:0 18px 14px;overflow-x:auto}

  table{width:100%;border-collapse:collapse;font-size:13px}
  thead th{text-align:left;color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.4px;padding:8px 10px;border-bottom:2px solid var(--line);white-space:nowrap}
  tbody td{padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}
  tbody tr:hover{background:#fafbfc}
  td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  .pill{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap}
  .pill.g{color:var(--g);background:var(--gb)} .pill.a{color:var(--a);background:var(--ab)}
  .pill.r{color:var(--r);background:var(--rb)} .pill.b{color:var(--b);background:var(--bb)}
  .pill.n{color:var(--n);background:var(--nb)}
  .chartbox{height:280px;padding:6px 4px}
  .empty{padding:24px;text-align:center;color:var(--muted);font-size:13px}
  .grid2{display:grid;grid-template-columns:1.1fr .9fr;gap:16px}

  /* Skeleton shimmer */
  .sk{background:linear-gradient(90deg,#eef1f4 25%,#e3e8ee 37%,#eef1f4 63%);background-size:400% 100%;animation:sh 1.3s ease infinite;border-radius:6px}
  @keyframes sh{0%{background-position:100% 0}100%{background-position:-100% 0}}
  .sk-row{height:36px;margin:6px 0}
  .sk-kpi{height:88px;border-radius:12px}
  .sk-hc{height:66px;border-radius:10px}

  @media (max-width:860px){
    #app{flex-direction:column}
    .sidebar{width:100%;height:auto;flex:none;position:sticky;top:0;overflow-x:auto;flex-direction:row;flex-wrap:wrap}
    .sidebar .brand{display:none}
    .sidebar .section,.sidebar .foot{display:none}
    .sidebar a{flex:0 0 auto;padding:8px 12px;font-size:12px}
    .hc{grid-template-columns:repeat(3,1fr)}
    .kpis{grid-template-columns:repeat(2,1fr)}
    .grid2{grid-template-columns:1fr}
  }
  @media print{
    .sidebar,.printbtn,.sync{display:none !important}
    .card.collapsed>.cb{display:block}
    .masthead{position:static}
    body{background:#fff}
  }
</style>
</head>
<body>

<div id="app" class="hidden">
  <aside class="sidebar">
    <div class="brand"><img src="/assets/dova-logo.jpg" alt="DOVA"/></div>
    <div class="section">Project Controls</div>
    <a href="#" id="lnk-schedule"><span class="ico">&#9776;</span> Executive Schedule</a>
    <a href="#" id="lnk-budget"><span class="ico">&#36;</span> Budget Tracker</a>
    <a href="#" id="lnk-procurement"><span class="ico">&#9881;</span> Procurement Log</a>
    <a href="#" id="lnk-risk"><span class="ico">&#9888;</span> Risk Register</a>
    <a href="#" id="lnk-permits"><span class="ico">&#9939;</span> Permitting Matrix</a>
    <div class="section">Team</div>
    <a href="#" id="lnk-contacts"><span class="ico">&#9993;</span> Key Contacts</a>
    <div class="section">Reports</div>
    <a href="#" id="lnk-actions"><span class="ico">&#10003;</span> Action Items</a>
    <a href="#" id="lnk-issues"><span class="ico">&#9888;</span> Issues & Decisions</a>
    <div class="foot">Level Up Project Development</div>
  </aside>

  <main>
    <header class="masthead">
      <div class="left">
        <div>
          <div class="mt">DOVA Arena</div>
          <div class="ms">Downtown DOVA &middot; Rancho Cordova, CA</div>
        </div>
      </div>
      <div class="right">
        <div class="health-badge g" id="health-badge">&#9679; Project Health</div>
        <div class="sync"><span class="dot" id="dot"></span><span id="updated">Loading...</span></div>
        <button class="printbtn" onclick="window.print()">Export Dashboard</button>
      </div>
    </header>

    <div class="wrap" id="main-content">
      <!-- Render target -->
      <div id="render-target"></div>
    </div>
  </main>
</div>

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script>
"use strict";
var API = "/api/dova?sheet=";
var SHEETS = ["00","01","02","03","04","05","06","08"];
var STATE = {};
var CHART = null;
var CHART2 = null;

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
function healthClass(v){
  var s = low(v);
  if(anyOf(s,["approved","complete","green","on track"])) return "g";
  if(anyOf(s,["progress","in progress","submitted","yellow","watch"])) return "a";
  if(anyOf(s,["not started","red","overdue","at risk","critical"])) return "r";
  if(s.indexOf("progr")>=0||s.indexOf("in-")>=0||s.indexOf("pending")>=0) return "a";
  return "n";
}
function pill(v, cls){ if(v==null||(""+v).trim()==="") return ""; return '<span class="pill '+cls+'">'+esc(v)+'</span>'; }

function normalize(json){
  if(!json) return [];
  if(Array.isArray(json)) return json;
  if(json.data && Array.isArray(json.data)) return json.data;
  if(json.rows && json.columns){
    if(json.rows.length>0 && !json.rows[0].cells && typeof json.rows[0]==="object") return json.rows;
    var byId = {};
    for(var i=0;i<json.columns.length;i++) byId[json.columns[i].id] = json.columns[i].title;
    var out = [];
    for(var r=0;r<json.rows.length;r++){
      var obj = {}, cells = json.rows[r].cells || [];
      for(var c=0;c<cells.length;c++){ var t = byId[cells[c].columnId]; if(t) obj[t] = (cells[c].displayValue!=null?cells[c].displayValue:cells[c].value); }
      out.push(obj);
    }
    return out;
  }
  if(json.rows && Array.isArray(json.rows)) return json.rows;
  return [];
}
function get(row, keys){
  for(var i=0;i<keys.length;i++){ var k=keys[i]; if(row[k]!=null&&(""+row[k]).trim()!=="") return row[k]; for(var kk in row){ if(low(kk)===low(k)&&row[kk]!=null) return row[kk]; } }
  return "";
}
function table(rows, cols){
  if(!rows||!rows.length) return '<div class="empty">No data yet.</div>';
  var h="<table><thead><tr>";
  for(var i=0;i<cols.length;i++) h+="<th>"+esc(cols[i].label)+"</th>";
  h+="</tr></thead><tbody>";
  for(var r=0;r<rows.length;r++){
    h+="<tr>";
    for(var c=0;c<cols.length;c++){
      var col=cols[c], raw=get(rows[r],col.keys), kind=col.kind||"text";
      if(kind==="money") h+='<td class="num">'+((raw+"").trim()===""?"":esc(money(num(raw))))+"</td>";
      else if(kind==="variance"){ var n=num(raw); var cls=n>0?"r":(n<0?"g":"n"); h+='<td class="num"><span class="pill '+cls+'">'+(raw===""?"-":esc(money(n)))+"</span></td>"; }
      else if(kind==="status") h+="<td>"+pill(raw,statusClass(raw))+"</td>";
      else if(kind==="priority") h+="<td>"+pill(raw,priorityClass(raw))+"</td>";
      else if(kind==="health") h+="<td>"+pill(raw,healthClass(raw))+"</td>";
      else if(kind==="pill") h+="<td>"+pill(raw,"b")+"</td>";
      else h+="<td>"+esc(raw)+"</td>";
    }
    h+="</tr>";
  }
  return h+"</tbody></table>";
}
function card(title, sub, bodyHtml, collapsed){
  return '<div class="card'+(collapsed?" collapsed":"")+'"><div class="ch" onclick="this.parentNode.classList.toggle(\\'collapsed\\')">'
    +'<span class="ct">'+esc(title)+'</span><span class="cv">'+(sub?esc(sub)+"  ":"")+'<span class="chev">&#9660;</span></span></div><div class="cb">'+bodyHtml+"</div></div>";
}
function kpi(label, value, sub, cls){
  return '<div class="kpi"><div class="k">'+esc(label)+'</div><div class="v '+(cls||"")+'">'+esc(value)+"</div>"+(sub?'<div class="s">'+esc(sub)+"</div>":"")+"</div>";
}
function sect(title, content){
  return '<div class="sect"><div class="sect-title"><h2>'+esc(title)+'</h2></div>'+content+"</div>";
}
function skeleton(kind){
  if(kind==="kpis"){ var h='<div class="kpis">'; for(var i=0;i<6;i++) h+='<div class="sk sk-kpi"></div>'; return h+"</div>"; }
  if(kind==="hc"){ var h='<div class="hc">'; for(var i=0;i<6;i++) h+='<div class="sk sk-hc"></div>'; return h+"</div>"; }
  var h=""; for(var i=0;i<6;i++) h+='<div class="sk sk-row"></div>'; return h;
}

/* ---- Render everything to a single page ---- */
function renderAll(){
  var s00=STATE["00"]||[], s01=STATE["01"]||[], s02=STATE["02"]||[], s03=STATE["03"]||[];
  var s04=STATE["04"]||[], s05=STATE["05"]||[], s06=STATE["06"]||[], s08=STATE["08"]||[];
  var html = "";

  // — Project Health Scorecard —
  var budgetOk = true; // Default green, could compute from data
  var scheduleOk = s05.length>0;
  var permitsOk = s08.filter(function(r){ return healthClass(get(r,["Status"]))==="g"; }).length>=5;
  var actionsOk = s03.filter(function(r){ return statusClass(get(r,["Status"]))!=="g"; }).length < 5;
  var hcB = budgetOk?"g":"a";
  var hcS = scheduleOk?"g":"a";
  var hcP = permitsOk?"g":"a";
  var hcA = actionsOk?"g":"a";
  var hcR = "g"; // Low risk posture for now
  var hcQ = "g";
  html += sect("Project Health Scorecard",
    '<div class="hc">'
    +'<div class="hc-item"><div class="hl">Budget</div><div class="hv '+hcB+'">'+(hcB==="g"?"GREEN":"YELLOW")+"</div></div>"
    +'<div class="hc-item"><div class="hl">Schedule</div><div class="hv '+hcS+'">'+(hcS==="g"?"GREEN":"YELLOW")+"</div></div>"
    +'<div class="hc-item"><div class="hl">Permitting</div><div class="hv '+hcP+'">'+(hcP==="g"?"GREEN":"YELLOW")+"</div></div>"
    +'<div class="hc-item"><div class="hl">Actions</div><div class="hv '+hcA+'">'+(hcA==="g"?"GREEN":"YELLOW")+"</div></div>"
    +'<div class="hc-item"><div class="hl">Risk</div><div class="hv '+hcR+'">GREEN</div></div>'
    +'<div class="hc-item"><div class="hl">Quality</div><div class="hv '+hcQ+'">GREEN</div></div>'
    +"</div>"
  );

  // — KPI Snapshot —
  var totMay=0, totSep=0;
  for(var i=0;i<s04.length;i++){
    var csi=get(s04[i],["CSI Code"]).toString();
    if(csi==="SUB"||csi==="CONT"||csi==="OVH"||csi==="TOTAL") continue;
    totMay+=num(get(s04[i],["McCarthy May 2026 Estimate"])); totSep+=num(get(s04[i],["Sep 2025 Estimate"]));
  }
  var variance = totMay-totSep;
  var openAct=0; for(i=0;i<s03.length;i++){ if(statusClass(get(s03[i],["Status"]))!=="g") openAct++; }
  var crit=0; for(i=0;i<s02.length;i++){ if(priorityClass(get(s02[i],["Priority"]))==="r") crit++; }
  var permApproved=0; for(i=0;i<s08.length;i++){ if(statusClass(get(s08[i],["Status"]))==="g") permApproved++; }
  var actPri=0; for(i=0;i<s00.length;i++){ if(statusClass(get(s00[i],["Status"]))!=="g") actPri++; }

  html += sect("Project KPI Snapshot",
    '<div class="kpis">'
    +kpi("Total Budget",money(totMay),"McCarthy May 2026")
    +kpi("Budget Variance",money(variance),"vs Target",variance>0?"r":"g")
    +kpi("Active Priorities",""+actPri,"of "+s00.length+" workstreams")
    +kpi("Open Actions",""+openAct,"of "+s03.length+" total")
    +kpi("Critical Issues",""+crit,"needing decision")
    +kpi("Permits Approved",permApproved+" / "+s08.length,"applications")
    +"</div>"
  );

  // — Schedule Milestones —
  html += sect("Schedule Milestones (Executive Report)",
    card("Key Milestones", s05.length+" milestones",
      table(s05, [
        {keys:["Milestone ID"],label:"ID"},
        {keys:["Description"],label:"Description"},
        {keys:["Planned Start"],label:"Start"},
        {keys:["Planned Finish"],label:"Finish"},
        {keys:["Phase"],label:"Phase",kind:"pill"}
      ]), false)
  );

  // — Budget Dashboard (chart + table) —
  html += sect("Budget Dashboard",
    '<div class="grid2">'
	+'<div class="card"><div class="ch"><span class="ct">Budget Allocation</span><span class="cv">Top scopes</span></div><div class="cb"><div class="chartbox"><canvas id="budchart"></canvas></div></div></div>'
	+'<div>'+card("Budget Line Items", s04.length+" rows",
      table(s04, [
        {keys:["CSI Code"],label:"CSI"},
        {keys:["Scope Description"],label:"Scope"},
        {keys:["McCarthy May 2026 Estimate"],label:"May 2026",kind:"money"},
        {keys:["Sep 2025 Estimate"],label:"Sep 2025",kind:"money"},
        {keys:["Variance"],label:"Variance",kind:"variance"}
      ]), true)+"</div></div>"
  );

  // — Permitting Matrix —
  html += sect("Permitting Matrix",
    card("Permit Status", s08.length+" items",
      table(s08, [
        {keys:["ID"],label:"ID"},
        {keys:["Permit / Approval"],label:"Permit / Approval"},
        {keys:["Jurisdiction / Agency"],label:"Agency"},
        {keys:["Status"],label:"Status",kind:"status"},
        {keys:["Application Date"],label:"Applied"},
        {keys:["Dependencies"],label:"Dep."}
      ]), false)
  );

  // — Action Items + Issues —
  var overAct=0; for(i=0;i<s03.length;i++){ if(statusClass(get(s03[i],["Status"]))==="r") overAct++; }
  html += sect("Action Items",
    '<div class="grid2">'
    +'<div>'
    +'<div class="kpis" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">'
    +kpi("Open",""+openAct,"actions")
    +kpi("Overdue",""+overAct,"items",overAct>0?"r":"g")
    +kpi("Critical Issues",""+crit,"needing decision",crit>0?"r":"g")
    +'</div>'
    +'</div>'
    +'<div>'
    +card("Overdue Action Items", "top items",
      table(s03.filter(function(r){ return statusClass(get(r,["Status"]))==="r"; }).slice(0,5), [
        {keys:["Action ID"],label:"ID"},
        {keys:["Action Description"],label:"Action"},
        {keys:["Owner"],label:"Owner"},
        {keys:["Due Date"],label:"Due"}
      ]), false)
    +'</div></div>'
  );

  // — Issues & Decisions —
  html += sect("Issues & Decisions",
    card("Open Issues", s02.length+" items",
      table(s02, [
        {keys:["Issue ID"],label:"ID"},
        {keys:["Issue/Risk Statement","Issue / Risk Statement"],label:"Issue / Risk"},
        {keys:["Category"],label:"Category"},
        {keys:["Priority"],label:"Priority",kind:"priority"},
        {keys:["Status"],label:"Status",kind:"status"}
      ]), false)
  );

  // — Key Contacts —
  html += sect("Key Contacts",
    card("Project Contacts", s06.length+" people",
      table(s06, [
        {keys:["Name"],label:"Name"},
        {keys:["Company"],label:"Company"},
        {keys:["Role"],label:"Role"},
        {keys:["Email"],label:"Email"}
      ]), true)
  );

  $("render-target").innerHTML = html;
  drawCharts(s04);
  updateHealth(s04, s08);
}

function drawCharts(s04){
  if(typeof Chart==="undefined") return;
  var cv=$("budchart"); if(!cv) return;
  var items=[];
  for(var i=0;i<s04.length;i++){
    var csi=get(s04[i],["CSI Code"]).toString();
    if(csi==="SUB"||csi==="CONT"||csi==="OVH"||csi==="TOTAL") continue;
    var v=num(get(s04[i],["McCarthy May 2026 Estimate"]));
    if(v>0) items.push({l:get(s04[i],["Scope Description","CSI Code"]),v:v});
  }
  items.sort(function(a,b){return b.v-a.v;});
  var top=items.slice(0,8);
  var labels=[],data=[];
  for(i=0;i<top.length;i++){ labels.push((""+top[i].l).slice(0,26)); data.push(top[i].v); }
  var palette=["#1F4E79","#C4962B","#2c6fb0","#1e7f4f","#b7791f","#5a7d9a","#e0b554","#8aa4bd"];
  if(CHART){ CHART.destroy(); CHART=null; }
  CHART = new Chart(cv.getContext("2d"), {
    type:"doughnut",
    data:{labels:labels,datasets:[{data:data,backgroundColor:palette,borderWidth:2,borderColor:"#fff"}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"right",labels:{boxWidth:12,font:{size:11}}},
      tooltip:{callbacks:{label:function(c){return c.label+": "+money(c.parsed);}}}}}
  });
}

function updateHealth(s04, s08){
  // Update health badge based on data
  var permApproved=0;
  for(var i=0;i<s08.length;i++){ if(statusClass(get(s08[i],["Status"]))==="g") permApproved++; }
  var hb=$("health-badge");
  if(permApproved<3){ hb.className="health-badge a"; hb.innerHTML="&#9679; Watch"; }
  else{ hb.className="health-badge g"; hb.innerHTML="&#9679; On Track"; }
}

function showSkeleton(){
  $("render-target").innerHTML = '<div class="sect">'+skeleton("hc")+'</div><div class="sect">'+skeleton("kpis")+'</div>'+skeleton("rows");
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
  renderAll();
  var d=new Date();
  $("updated").textContent = "Updated "+d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"});
  $("dot").className = "dot" + (ok?"":" stale");
}

function start(){
  $("app").classList.remove("hidden");
  showSkeleton();
  loadAll();
  setInterval(loadAll, 60000);
}
document.addEventListener("DOMContentLoaded", start);
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