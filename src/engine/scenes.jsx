// SCENE TYPES — each = a View (markup from script data) + animate (timeline recipe).
// Add a new scene type here and it becomes available in every script.
import {P} from './primitives.js'
const html=(a=[])=>a.map((l,i)=><div key={i} dangerouslySetInnerHTML={{__html:l}}/>)
const fmt=c=>v=>`${c.prefix??''}${(+v).toLocaleString(undefined,{minimumFractionDigits:c.decimals??0,maximumFractionDigits:c.decimals??0})}${c.suffix??''}`
const W=460,H=210
const pathFrom=pts=>{const mx=Math.max(...pts),mn=Math.min(...pts)||0,r=(mx-mn)||1
  return pts.map((p,i)=>`${i?'L':'M'}${20+i*(W-40)/Math.max(1,pts.length-1)},${H-20-((p-mn)/r)*(H-40)}`).join(' ')}
const cls=l=>l.startsWith('✓')?'ok':l.startsWith('✗')?'er':''
const Win=({title,children,className=''})=>(<div className={`win a ${className}`}><div className="bar"><i/><i/><i/><span>{title}</span></div>{children}</div>)

export const SCENES={
  hook:{
    View:({s})=>(<><div className="eyebrow a">{s.eyebrow}</div><div className="hook a">{html(s.lines)}</div>{s.sub&&<div className="sub a">{s.sub}</div>}</>),
    animate:(tl,q)=>P.reveal(tl,q('.a'),{stagger:.18}),
  },
  code:{
    View:({s})=>(<><Win title={s.file} className="ed"><div className="code">{s.lines.map((_,i)=><div key={i} className="ln"/>)}</div></Win>
      <div className="btn a">▶ {s.button||'Run'}</div></>),
    animate:(tl,q,s,x)=>{
      P.slide(tl,q('.a'),{x:70,stagger:.15})
      const L=q('.ln'); s.lines.forEach((t,i)=>{P.typeText(tl,L[i],t,{cps:s.cps||x.cps});P.pause(tl,.08)})
      P.pause(tl,x.beat)
      ;(s.highlight||[]).forEach(i=>P.highlight(tl,L[i],{color:x.accent}))
      P.zoom(tl,q('.win')[0],{to:1.03,d:.5}); P.pause(tl,x.beat)
      P.execute(tl,q('.btn')[0],x.accent)
      if(s.run==='error') P.error(tl,q('.win')[0]); P.cameraPunch(tl,x.cam)},
  },
  result:{
    View:({s})=>(<>
      {s.cmd&&<Win title="terminal"><div className="term"><div><span className="p">$ </span><span className="cmd"/></div>{(s.output||[]).map((o,i)=><div key={i} className={`out ${cls(o)}`}/>)}</div></Win>}
      {s.counter&&<div className="stat a"><div className="num">{fmt(s.counter)(s.counter.from)}</div><div className="lab">{s.counter.label}</div></div>}
      {s.progress&&<div className="prog a"><div/></div>}
      {s.graph&&<svg className="g gr a" viewBox={`0 0 ${W} ${H}`}><path d={pathFrom(s.graph.points)} fill="none" stroke="var(--a1)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><text x="20" y="24" fill="#8a89a6" fontSize="13" fontFamily="JetBrains Mono">{s.graph.label}</text></svg>}</>),
    animate:(tl,q,s,x)=>{
      P.reveal(tl,q('.a'),{stagger:.12})
      if(s.cmd){P.typeText(tl,q('.cmd')[0],s.cmd,{cps:x.cps});(s.output||[]).forEach((o,i)=>{P.pause(tl,.2);P.typeText(tl,q('.out')[i],o,{cps:x.cps*1.3})})}
      let first=true; const at=()=>{const r=first?'>':'<';first=false;return r}
      if(s.counter)P.counter(tl,q('.num')[0],fmt(s.counter),s.counter.from,s.counter.to,{at:at()})
      if(s.progress)P.progressBar(tl,q('.prog > div')[0],{at:at()})
      if(s.graph)P.graph(tl,q('.gr path')[0],{at:at()})
      if(s.counter)P.success(tl,q('.num')[0],x.accent); P.cameraPunch(tl,x.cam,.02)},
  },
  list:{
    View:({s})=>(<><div className="eyebrow a">{s.title}</div>{s.items.map((it,i)=><div key={i} className="item a"><span>{it.label}</span><b>{it.value}</b></div>)}</>),
    animate:(tl,q)=>{P.reveal(tl,q('.eyebrow'));P.slide(tl,q('.item'),{x:60,stagger:.3})},
  },
  outro:{
    View:({s})=>(<><div className="hook a" style={{fontSize:58}}>{html(s.lines)}</div>{s.tag&&<div className="eyebrow a">{s.tag}</div>}</>),
    animate:(tl,q)=>{P.scale(tl,q('.hook'),{from:.9});if(q('.eyebrow').length)P.reveal(tl,q('.eyebrow'))},
  },
}
