const fs=require('fs');
const {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,BorderStyle,
  AlignmentType,ImageRun,PageBreak,ShadingType,VerticalAlign,Footer,PageOrientation}=require('docx');

const spec=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
// Override logo path with local file — the spec's path is a Linux container path, not valid here
const LOCAL_LOGO = 'C:\\Users\\HermesAdmin\\agenda\\dova_logo_sm.png';
if (fs.existsSync(LOCAL_LOGO)) spec.logo = LOCAL_LOGO;
const OUT=process.argv[3];
const F='Aptos';
const INK='181818', GREY='6B6B6B', LGREY='8A8A8A', TEAL='184655', RULE='C8C8C8', HAIR='D8D8D8';
const NONE={style:BorderStyle.NONE,size:0,color:'FFFFFF'};
const noBorders={top:NONE,bottom:NONE,left:NONE,right:NONE};
const W=12240-1440-1440; // letter minus 1in margins = 9360 dxa

const T=(t,o={})=>new TextRun({text:t,font:F,size:o.sz||20,bold:!!o.b,italics:!!o.i,color:o.c||INK});
const P=(runs,o={})=>{
  const sp={before:o.before||0,after:o.after===undefined?0:o.after};
  if(o.line) sp.line=o.line;
  return new Paragraph({children:Array.isArray(runs)?runs:[runs],
    spacing:sp, alignment:o.align, border:o.border, indent:o.indent});};
const cell=(children,o={})=>new TableCell({children,width:{size:o.w,type:WidthType.DXA},
  borders:o.borders||noBorders, shading:o.shade?{type:ShadingType.CLEAR,fill:o.shade,color:'auto'}:undefined,
  margins:{top:o.mt===undefined?60:o.mt,bottom:o.mb===undefined?60:o.mb,left:o.ml||0,right:o.mr||100},
  verticalAlign:o.va});
const table=(rows,widths)=>new Table({rows,columnWidths:widths,width:{size:widths.reduce((a,b)=>a+b,0),type:WidthType.DXA},
  borders:{top:NONE,bottom:NONE,left:NONE,right:NONE,insideHorizontal:NONE,insideVertical:NONE}});
const hr=(sz,color)=>({bottom:{style:BorderStyle.SINGLE,size:sz,color:color}});

const body=[];

// ---------- header: logo left, title right ----------
const logoRun = spec.logo && fs.existsSync(spec.logo)
  ? new ImageRun({type:'png',data:fs.readFileSync(spec.logo),transformation:{width:164,height:37}})
  : T(spec.wordmark||'',{sz:44,b:true,c:TEAL});
body.push(table([new TableRow({children:[
  cell([P(logoRun,{after:0,before:60})],{w:Math.round(W*0.42),va:VerticalAlign.BOTTOM,mt:160,mb:40}),
  cell([P(T(spec.title,{sz:32,b:true}),{align:AlignmentType.RIGHT,after:20}),
        P(T(spec.subtitle||'Agenda',{sz:21,c:GREY}),{align:AlignmentType.RIGHT})],
       {w:Math.round(W*0.58),va:VerticalAlign.BOTTOM,mr:0})
]})],[Math.round(W*0.42),Math.round(W*0.58)]));
body.push(P(T(''),{after:60,border:hr(12,INK)}));

// ---------- meta row ----------
const metas=spec.meta||[];
if(metas.length){
  const mw=Math.floor(W/metas.length);
  body.push(table([new TableRow({children:metas.map(m=>
    cell([P(T(m[0],{sz:15,c:LGREY}),{after:20}),P(T(m[1],{sz:20,b:true}))],{w:mw,mt:125,mb:125}))})],
    metas.map(()=>mw)));
  body.push(P(T(''),{after:100,border:hr(4,RULE)}));
}

// ---------- attendees ----------
if(spec.attendees && spec.attendees.length){
  body.push(P(T('Attendees',{sz:24,b:true}),{before:130,after:85}));
  const g=spec.attendees, half=Math.ceil(g.length/2), cw=Math.floor(W/2)-100;
  const rows=[];
  for(let i=0;i<half;i++){
    const mk=(x)=>{ if(!x) return cell([P(T(''))],{w:cw});
      const hdr=[T(x.firm,{sz:18,b:true})];
      if(x.role) hdr.push(T('  ('+x.role+')',{sz:18,c:LGREY}));
      return cell([P(hdr,{after:20}),P(T((x.people||[]).join(', '),{sz:17,c:'5A5A5A'}))],
        {w:cw,mt:95,mb:95,borders:{...noBorders,bottom:{style:BorderStyle.SINGLE,size:3,color:'E4E4E4'}}});
    };
    rows.push(new TableRow({children:[mk(g[i*2]),mk(g[i*2+1])]}));
  }
  body.push(table(rows,[cw,cw]));
}
// ---------- agenda ----------
const ROMAN=['i','ii','iii','iv','v','vi','vii','viii'];
body.push(P(T('Agenda',{sz:30,b:true}),{before:280,after:110}));
const tw=1180, cw2=W-tw;
const agRows=(spec.agenda||[]).map(r=>{
  if(r.type==='break'){
    return new TableRow({cantSplit:true,children:[
      cell([P(T(r.time||'',{sz:16,c:GREY}))],{w:tw,shade:'F1F1F1',mt:70,mb:70,ml:60}),
      cell([P(T(r.label||'Break',{sz:18,i:true,c:GREY}))],{w:cw2,shade:'F1F1F1',mt:70,mb:70})]});
  }
  const kids=[P([T(r.num+'.  ',{sz:21,b:true}),T(r.title,{sz:21,b:true})],{after:20})];
  (r.subs||[]).forEach((s,j)=>{
    const runs=[T(String.fromCharCode(97+j)+'.  ',{sz:18,c:GREY}),T(s.text,{sz:18})];
    if(s.note) runs.push(T('  '+s.note,{sz:18,c:LGREY}));
    kids.push(P(runs,{after:20,indent:{left:460,hanging:200}}));
    (s.subs||[]).forEach((ss,k)=>kids.push(
      P([T(ROMAN[k]+'.  ',{sz:17,c:GREY}),T(ss,{sz:17,c:'4A4A4A'})],{after:20,indent:{left:880,hanging:200}})));
  });
  return new TableRow({cantSplit:true,children:[
    cell([P(T(r.time||'',{sz:16,c:GREY}))],{w:tw,mt:120,mb:120,
      borders:{...noBorders,bottom:{style:BorderStyle.SINGLE,size:3,color:'E4E4E4'}}}),
    cell(kids,{w:cw2,mt:120,mb:120,
      borders:{...noBorders,bottom:{style:BorderStyle.SINGLE,size:3,color:'E4E4E4'}}})]});
});
body.push(table(agRows,[tw,cw2]));

// ---------- carry-forward ----------
if(spec.carry && spec.carry.rows && spec.carry.rows.length){
  body.push(P(T(spec.carry.title||'Carry-Forward Commitments',{sz:30,b:true}),{before:320,after:40}));
  if(spec.carry.note) body.push(P(T(spec.carry.note,{sz:16,c:LGREY}),{after:100}));
  const cwid=[Math.round(W*0.50),Math.round(W*0.22),Math.round(W*0.28)];
  const hdr=new TableRow({tableHeader:true,cantSplit:true,children:['Commitment','Owner','Status at last meeting'].map((h,i)=>
    cell([P(T(h,{sz:16,b:true,c:'FFFFFF'}))],{w:cwid[i],shade:TEAL,mt:80,mb:80,ml:90}))});
  const rws=spec.carry.rows.map((x,i)=>new TableRow({cantSplit:true,children:[
    cell([P(T(x.item,{sz:17}))],{w:cwid[0],shade:i%2?'F6F6F6':undefined,mt:80,mb:80,ml:90}),
    cell([P(T(x.who||'',{sz:17}))],{w:cwid[1],shade:i%2?'F6F6F6':undefined,mt:80,mb:80,ml:90}),
    cell([P(T(x.status||'',{sz:17}))],{w:cwid[2],shade:i%2?'F6F6F6':undefined,mt:80,mb:80,ml:90})]}));
  body.push(table([hdr,...rws],cwid));
}

// ---------- topical notes sections ----------
function notesPageHeader(){
  body.push(new Paragraph({children:[new PageBreak()]}));
  body.push(table([new TableRow({children:[
    cell([P(T('Notes',{sz:30,b:true}))],{w:Math.round(W*0.3),va:VerticalAlign.BOTTOM}),
    cell([P(T(spec.footer||'',{sz:16,c:GREY}),{align:AlignmentType.RIGHT})],
      {w:Math.round(W*0.7),va:VerticalAlign.BOTTOM,mr:0})]})],
    [Math.round(W*0.3),Math.round(W*0.7)]));
  body.push(P(T(''),{after:40,border:hr(12,INK)}));
}
if((spec.notes&&spec.notes.length)||(spec.actionWindows&&spec.actionWindows.length)||spec.ruledNotes){
  notesPageHeader();
}

(spec.notes||[]).forEach(sec=>{
  body.push(P(T(sec.heading,{sz:23,b:true}),{before:240,after:60}));
  (sec.bullets||[]).forEach(b=>{
    const txt = typeof b==='string'? b : b.text;
    body.push(P([T('\u2022   ',{sz:18,c:GREY}),T(txt,{sz:18})],{after:30,indent:{left:400,hanging:220}}));
    ((typeof b==='object'&&b.subs)||[]).forEach(sb=>
      body.push(P([T('\u2013   ',{sz:17,c:LGREY}),T(sb,{sz:17,c:'4A4A4A'})],{after:30,indent:{left:820,hanging:220}})));
  });
  if(sec.blank) for(let i=0;i<(sec.blank||0);i++) body.push(P(T(''),{after:0,before:190,border:hr(6,'CCCCCC')}));
});

// ---------- action items by window ----------
(spec.actionWindows||[]).forEach((win,wi)=>{
  body.push(P(T(win.heading,{sz:23,b:true}),{before:wi===0?320:240,after:70}));
  if(win.note) body.push(P(T(win.note,{sz:16,c:LGREY}),{after:80}));
  const cwid=[Math.round(W*0.68),Math.round(W*0.32)];
  const hdr=new TableRow({tableHeader:true,cantSplit:true,children:['Action Item','Responsible'].map((h,i)=>
    cell([P(T(h,{sz:16,b:true,c:'FFFFFF'}))],{w:cwid[i],shade:TEAL,mt:80,mb:80,ml:90}))});
  const rws=(win.rows||[]).map((x,i)=>new TableRow({cantSplit:true,children:[
    cell([P(T(x.item,{sz:17}))],{w:cwid[0],shade:i%2?'F6F6F6':undefined,mt:80,mb:80,ml:90}),
    cell([P(T(x.who||'',{sz:17}))],{w:cwid[1],shade:i%2?'F6F6F6':undefined,mt:80,mb:80,ml:90})]}));
  body.push(table([hdr,...rws],cwid));
});

// ---------- ruled notes page ----------
if(spec.ruledNotes){
  if(spec.notes&&spec.notes.length) notesPageHeader();
  const lineRows=[];
  for(let i=0;i<24;i++){
    lineRows.push(new TableRow({cantSplit:true,height:{value:400,rule:'atLeast'},children:[
      cell([P(T('',{sz:18}))],{w:W,mt:0,mb:0,mr:0,
        borders:{top:NONE,left:NONE,right:NONE,
          bottom:{style:BorderStyle.SINGLE,size:4,color:'D0D0D0'}}})]}));
  }
  body.push(table(lineRows,[W]));
}

const doc=new Document({
  styles:{default:{document:{run:{font:F,size:20,color:INK}}}},
  sections:[{
    properties:{page:{size:{width:12240,height:15840},margin:{top:1080,right:1440,bottom:1260,left:1440}}},
    footers:{default:new Footer({children:[P(T(spec.footer||'',{sz:15,c:LGREY}),{align:AlignmentType.CENTER})]})},
    children:body
  }]
});
Packer.toBuffer(doc).then(b=>{fs.writeFileSync(OUT,b);console.log('wrote',OUT);});