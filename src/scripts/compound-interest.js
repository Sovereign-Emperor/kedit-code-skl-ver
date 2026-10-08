// Example script. Copy _template.js to make your own.
export default {
  id:'compound-interest', title:'Compound Interest',
  theme:{accent:'#e6c36a',accent2:'#8b6cff'},
  scenes:[
    {type:'hook',eyebrow:'Sovereign Emperor · Money in Code',lines:['Your money grows','<em>on its own.</em>'],sub:'Compound interest in 6 lines.'},
    {type:'code',file:'compound.js',button:'Run',highlight:[3],lines:[
      '// $1,000 at 8% a year','let balance = 1000;','for (let y = 1; y <= 20; y++) {','  balance *= 1.08;','}','console.log(balance);']},
    {type:'result',cmd:'node compound.js',output:['✓ year 5   →  $1,469','✓ year 10  →  $2,159','✓ year 20  →  $4,661'],
      counter:{from:1000,to:4661,prefix:'$',label:'after 20 years'},progress:true,
      graph:{label:'Balance over time',points:[1000,1166,1360,1587,1851,2159,2518,2937,3426,3996,4661]}},
    {type:'outro',lines:['Time does the work.','<em>Start early.</em>'],tag:'Follow for more'},
  ]}
