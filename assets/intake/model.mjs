export const GOALS = [
 {id:'self-employed',title:'Self-employed',hint:'Review my income',question:'How is your business set up?',options:['Sole proprietor','Incorporated','Partnership','Not sure']},
 {id:'equity',title:'Use home equity',hint:'Explore money in my home',question:'What would you like to explore?',options:['A home equity loan','A line of credit (HELOC)','Renovations','A reverse mortgage','Not sure']},
 {id:'debt',title:'Review my debts',hint:'Compare borrowing costs',question:'Do you own a home?',options:['Yes','No','Not sure']},
 {id:'buy',title:'Buy a home',hint:'Understand my next steps',question:'Where are you in your search?',options:['Just starting','Looking at homes','Made an offer','Not sure']},
 {id:'renew',title:'Renew my mortgage',hint:'Review my renewal',question:'When does your mortgage renew?',options:['Within 3 months','In 3 to 6 months','More than 6 months','Not sure']},
 {id:'second-opinion',title:'Get a second opinion',hint:'Take another look',question:'What would you like us to review?',options:['A bank decision','A mortgage offer','My current mortgage','Not sure']},
 {id:'general',title:'Something else / not sure',hint:'Find my starting point',question:'What would help you most?',options:['Understanding my options','Knowing what to prepare','Speaking with Ray','Not sure']}
];
export const TIMINGS=['Just exploring','As soon as possible','Within 3 months','In 3 to 6 months','Later'];
export const PROVINCES=['Ontario','Alberta','Another province'];
export const CALLBACKS=['No preference','Morning','Afternoon','Evening'];
export const ZONES=['Eastern time','Mountain time','Central time','Pacific time','Atlantic time','Newfoundland time'];
export function goalById(id){return GOALS.find(g=>g.id===id);}
export function blankAnswers(){return {goal:'',province:'',city:'',timing:'',detail:'',name:'',method:'Phone',phone:'',email:'',callback:'No preference',zone:'Eastern time',consent:false};}
export function contextFrom(search){
 const q=new URLSearchParams(search),aliases={'debt-review':'debt','buying-a-home':'buy','renewal':'renew','home-equity':'equity','heloc':'equity','renovations':'equity','reverse':'equity','bank-declined':'second-opinion'};
 const raw=q.get('goal'),goal=goalById(raw)?raw: (Object.hasOwn(aliases,raw)?aliases[raw]:'');
 const legacyCreative=q.get('utm_content')||'';
 const source=q.get('source')||(/^(?:se[123]|he[12]|bd1|dc1|rm1)$/.test(legacyCreative)?legacyCreative.toUpperCase():'');
 // No arbitrary URL/referrer text, names, email addresses, or financial answers.
 const creative=/^(?:(?:SE|DEBT|SO)-(?:sq|pt|st)|(?:SE[123]|HE[12]|BD1|DC1|RM1)(?:-(?:sq|pt|st))?)$/.test(source)?source:'';
 return {goal,source:creative};
}
export function validate(a,step){
 const e={};
 if(step===0&&!goalById(a.goal))e.goal='Choose what you would like help with, or select Not sure.';
 if(step===1){
  if(!PROVINCES.includes(a.province))e.province='Choose the province where the property is, or will be.';
  if(!TIMINGS.includes(a.timing))e.timing='Choose a time frame, or select Just exploring.';
  if(!goalById(a.goal)?.options.includes(a.detail))e.detail='Choose the closest answer, or select Not sure.';
  if(a.city.length>80)e.city='Keep the city or town to 80 characters or fewer.';
 }
 if(step===2){
  if(!a.name.trim()||a.name.trim().length>100)e.name='Enter your name (up to 100 characters).';
  if(!['Phone','Email'].includes(a.method))e.method='Choose Phone or Email.';
  if(a.method==='Phone'){
   const phone=a.phone.replace(/[\s().+\-]/g,'');
   if(!/^(1)?[2-9]\d{9}$/.test(phone))e.phone='Enter a 10-digit Canadian phone number. Spaces and dashes are fine.';
   if(!CALLBACKS.includes(a.callback))e.callback='Choose a callback preference.';
   if(!ZONES.includes(a.zone))e.zone='Choose your time zone.';
  }
  if(a.method==='Email'&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)||a.email.length>254))e.email='Enter an email address, such as name@example.com.';
  if(a.consent!==true)e.consent='Please give permission for Ray to contact you about this enquiry.';
 }
 return e;
}
export function buildDraft(a,brand,context={}){
 const errors=[0,1,2].flatMap(step=>Object.keys(validate(a,step)));
 if(errors.length)throw new Error('Please complete the required answers before reviewing.');
 if(!['mortgage-x-ray','the-mortgage-room'].includes(brand))throw new Error('Unknown brand');
 return {schemaVersion:'guided-intake-v1',brand,goal:a.goal,province:a.province,city:a.city.trim(),timing:a.timing,detail:a.detail,
 contact:{name:a.name.trim(),method:a.method,value:a.method==='Phone'?a.phone.trim():a.email.trim(),...(a.method==='Phone'?{callback:a.callback,timeZone:a.zone}:{})},
 consent:{granted:true,textVersion:'enquiry-contact-v1'},source:contextFrom('?source='+encodeURIComponent(context.source||'')).source||null};
}
