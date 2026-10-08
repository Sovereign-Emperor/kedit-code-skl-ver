// TIMELINE — turns a script's scene list into one GSAP master timeline.
import {gsap,P} from './primitives.js'
import {SCENES} from './scenes.jsx'
export function buildTimeline(root,script,onUpdate){
  const tl=gsap.timeline({paused:true,onUpdate})
  const cam=root.querySelector('.cam'),wipe=root.querySelector('.wipe')
  const x={cps:script.cps||34,beat:script.beat??.45,accent:script.theme?.accent||'#e6c36a',cam}
  const sc=i=>root.querySelector('.sc'+i)
  gsap.set(root.querySelectorAll('.scene'),{autoAlpha:0}); gsap.set(root.querySelectorAll('.a'),{autoAlpha:0})
  gsap.set(wipe,{yPercent:100})
  script.scenes.forEach((s,i)=>{
    const def=SCENES[s.type]; if(!def)return
    if(i===0)tl.set(sc(0),{autoAlpha:1}); else P.sceneTransition(tl,wipe,sc(i-1),sc(i))
    def.animate(tl,gsap.utils.selector(sc(i)),s,x)
    P.pause(tl,s.hold??(i===script.scenes.length-1?2:.8))
  })
  return tl
}
