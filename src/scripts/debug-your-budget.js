export default {
  id:'debug-your-budget', title:'Debug Your Budget',
  theme:{accent:'#8b6cff',accent2:'#e6c36a'}, cps:30,
  scenes:[
    {type:'hook',eyebrow:'Fintech Bug Report',lines:['Your budget has','<em>a bug.</em>'],sub:'Spot it in 10 seconds.'},
    {type:'code',file:'budget.js',button:'Run',run:'error',highlight:[2],lines:[
      'const income = 3000;','const spend = 3400;','const saved = income - spend;','if (saved < 0) throw new Error("overspent");']},
    {type:'result',cmd:'node budget.js',output:['✗ Error: overspent','✗ saved = -400'],counter:{from:0,to:-400,prefix:'$',label:'per month'}},
    {type:'list',title:'The fix',items:[{label:'Track spending',value:'week 1'},{label:'Cut one subscription',value:'-$30'},{label:'Auto-save on payday',value:'+$100'}]},
    {type:'outro',lines:['Fix the bug.','<em>Keep the money.</em>'],tag:'Follow for more'},
  ]}
