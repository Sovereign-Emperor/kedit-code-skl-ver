// KEDIT-CODE ENGINE — reusable animation primitives.
// Every primitive adds tweens to a GSAP timeline, so replay/reset/scrub just work.
import gsap from 'gsap'
export const P = {
  pause:(tl,d=.4)=>tl.to({},{duration:d}),
  fade:(tl,t,o={})=>tl.to(t,{autoAlpha:o.to??1,duration:o.d??.5,ease:'power2.out'},o.at),
  reveal:(tl,t,o={})=>tl.fromTo(t,{autoAlpha:0,y:o.y??26},{autoAlpha:1,y:0,duration:o.d??.65,ease:'power3.out',stagger:o.stagger??0},o.at),
  slide:(tl,t,o={})=>tl.fromTo(t,{autoAlpha:0,x:o.x??80},{autoAlpha:1,x:0,duration:o.d??.7,ease:'expo.out',stagger:o.stagger??0},o.at),
  scale:(tl,t,o={})=>tl.fromTo(t,{autoAlpha:0,scale:o.from??.85},{autoAlpha:1,scale:1,duration:o.d??.6,ease:'back.out(1.6)',stagger:o.stagger??0},o.at),
  zoom:(tl,t,o={})=>tl.to(t,{scale:o.to??1.05,duration:o.d??.8,ease:'power2.inOut'},o.at),
  highlight:(tl,t,o={})=>tl.to(t,{backgroundColor:'rgba(255,255,255,.07)',borderLeftColor:o.color||'#e6c36a',duration:.3},o.at),
  glitch:(tl,t)=>tl.to(t,{x:'+=7',skewX:8,duration:.04,repeat:5,yoyo:true,ease:'none'}).set(t,{x:0,skewX:0}),
  shake:(tl,t,i=8)=>tl.to(t,{x:`+=${i}`,duration:.05,repeat:7,yoyo:true,ease:'sine.inOut'}).set(t,{x:0}),
  typeText:(tl,el,text,o={})=>{const s={n:0};
    return tl.fromTo(s,{n:0},{n:text.length,duration:Math.max(.05,text.length/(o.cps||30)),ease:'none',
      onUpdate(){el.textContent=text.slice(0,Math.round(s.n))}},o.at)},
  counter:(tl,el,fmt,from,to,o={})=>{const s={v:from};
    return tl.fromTo(s,{v:from},{v:to,duration:o.d??1.8,ease:'power2.out',onUpdate(){el.textContent=fmt(s.v)}},o.at)},
  progressBar:(tl,el,o={})=>tl.fromTo(el,{scaleX:0},{scaleX:1,duration:o.d??1.8,ease:'power2.inOut'},o.at),
  graph:(tl,path,o={})=>{const L=path.getTotalLength()
    return tl.fromTo(path,{strokeDasharray:L,strokeDashoffset:L},{strokeDashoffset:0,duration:o.d??1.8,ease:'power2.inOut'},o.at)},
  execute:(tl,btn,color='#e6c36a')=>tl.to(btn,{scale:.92,duration:.1}).to(btn,{scale:1,boxShadow:`0 0 60px ${color}`,duration:.3,ease:'back.out(3)'}),
  error:(tl,t)=>{P.glitch(tl,t);return tl.to(t,{color:'#ff6b7a',duration:.2})},
  success:(tl,t,color='#5fd6a0')=>tl.fromTo(t,{scale:1},{scale:1.1,color,duration:.25,yoyo:true,repeat:1,ease:'power2.out'}),
  cameraPunch:(tl,cam,a=.035)=>tl.to(cam,{scale:1+a,duration:.12,ease:'power2.out'}).to(cam,{scale:1,duration:.5,ease:'elastic.out(1,.5)'}),
  sceneTransition:(tl,wipe,prev,next)=>{
    tl.fromTo(wipe,{yPercent:100},{yPercent:0,duration:.35,ease:'power3.in'})
      .set(prev,{autoAlpha:0}).set(next,{autoAlpha:1})
      .to(wipe,{yPercent:-100,duration:.4,ease:'power3.out'})
    return tl},
}
export {gsap}
