import {useEffect,useLayoutEffect,useRef,useState} from 'react'
import {buildTimeline} from './engine/build.js'
import {SCENES} from './engine/scenes.jsx'
import {SCRIPTS} from './scripts/index.js'
const qs=new URLSearchParams(location.search), CLEAN=qs.has('clean')

function Player({script}){
  const stage=useRef(),tl=useRef(),[t,setT]=useState(0),[dur,setDur]=useState(1),[speed,setSpeed]=useState(1)
  useEffect(()=>{tl.current=buildTimeline(stage.current,script,()=>setT(tl.current.time()))
    setDur(tl.current.duration());tl.current.timeScale(speed).play();return()=>tl.current.kill()},[script])
  useEffect(()=>{tl.current?.timeScale(speed)},[speed])
  const th=script.theme||{}
  return(<>
    <div id="fit"><div className="stage" ref={stage} style={{'--a1':th.accent||'#e6c36a','--a2':th.accent2||'#8b6cff'}}>
      <div className="cam">{script.scenes.map((s,i)=>{const D=SCENES[s.type]
        return <div key={i} className={`scene sc${i}`}>{D?<D.View s={s}/>:<div className="sub">Unknown scene type “{s.type}” (scene {i+1})</div>}</div>})}</div>
      <div className="wipe"/></div></div>
    {!CLEAN&&<div className="ctl"><button onClick={()=>tl.current.restart()}>↻ Replay</button><button onClick={()=>tl.current.pause(0)}>Reset</button>
      <input type="range" min="0" max={dur} step=".01" value={t} onChange={e=>tl.current.pause(+e.target.value)}/>
      <span>{t.toFixed(1)}/{dur.toFixed(1)}s</span>
      <select value={speed} onChange={e=>setSpeed(+e.target.value)}>{[.5,1,2].map(v=><option key={v} value={v}>{v}x</option>)}</select></div>}</>)
}
export default function App(){
  const [id,setId]=useState(qs.get('script')||SCRIPTS[0].id)
  const script=SCRIPTS.find(s=>s.id===id)||SCRIPTS[0]
  useLayoutEffect(()=>{const f=()=>document.documentElement.style.setProperty('--s',
    Math.min(innerWidth*.96/540,(innerHeight-(CLEAN?0:120))/960,CLEAN?3:1.4));f();addEventListener('resize',f);return()=>removeEventListener('resize',f)},[])
  return(<>{!CLEAN&&<select className="pick" value={script.id} onChange={e=>setId(e.target.value)}>{SCRIPTS.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select>}
    <Player key={script.id} script={script}/></>)
}
