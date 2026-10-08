// ── KEDIT-CODE SCRIPT TEMPLATE ───────────────────────────────
// 1. Copy this file, rename it (e.g. my-video.js)
// 2. Edit the scenes below
// 3. Register it in src/scripts/index.js
// Scene types: hook | code | result | list | outro  (see README.md)
export default {
  id:'my-video',                 // unique, used in ?script=my-video
  title:'My Video',              // shown in the dropdown
  theme:{accent:'#e6c36a',accent2:'#8b6cff'},   // gold + purple
  cps:34,                        // typing speed (characters/second)
  beat:0.45,                     // pause length between beats (seconds)
  scenes:[
    {type:'hook',eyebrow:'TOPIC',lines:['Big claim','<em>highlighted part.</em>'],sub:'One-line promise.'},
    {type:'code',file:'file.js',button:'Run',run:'success',highlight:[1],lines:['// line 0','line 1 gets highlighted','line 2']},
    {type:'result',cmd:'node file.js',output:['✓ good line','✗ bad line'],
      counter:{from:0,to:100,prefix:'$',suffix:'',decimals:0,label:'label'},progress:true,
      graph:{label:'Graph title',points:[1,2,4,8,16]}},
    {type:'list',title:'Key points',items:[{label:'Point one',value:'A'},{label:'Point two',value:'B'}]},
    {type:'outro',lines:['Closing line.','<em>Punchline.</em>'],tag:'Follow for more'},
  ]}
