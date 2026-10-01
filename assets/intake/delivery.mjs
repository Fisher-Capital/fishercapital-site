// No answers, identifiers or receipts are stored in browser storage.
export function createDelivery(endpoint,{fetcher=fetch,uuid=()=>crypto.randomUUID(),now=()=>Date.now(),wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 let requestId=uuid(),challenge=null,issuedAt=0,submittedDraft=null;
 async function prepare(){
  const r=await fetcher(endpoint,{method:'GET',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(12000)});
  const body=await r.json();if(!r.ok||typeof body.challenge!=='string')throw new Error('temporarily_unavailable');
  challenge=body.challenge;issuedAt=now();
 }
 return {prepare,reset(){requestId=uuid();challenge=null;issuedAt=0;submittedDraft=null;},async submit(draft,website=''){
  // A receipt belongs to one set of answers, including edits made after going Back.
  const fingerprint=JSON.stringify(draft);
  if(submittedDraft!==null&&submittedDraft!==fingerprint)requestId=uuid();
  submittedDraft=fingerprint;
  if(!challenge||now()-issuedAt>25*60*1000)await prepare();
  if(now()-issuedAt<1100)await wait(1100-(now()-issuedAt));
  const r=await fetcher(endpoint,{method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId,challenge,draft,website}),signal:AbortSignal.timeout(45000)});
  let body;try{body=await r.json();}catch{throw new Error('delivery_not_confirmed');}
  if(!r.ok||body.ok!==true||body.reference!==requestId){if(body.error==='refresh_required')challenge=null;throw new Error(body.error||'delivery_not_confirmed');}
  return body.reference;
 }};
}
export function deliveryMessage(code){
 if(code==='province_unavailable')return 'Online enquiries for this province are not open yet. Nothing was submitted.';
 if(code==='please_wait')return 'Please wait a few minutes before trying again. You can also call Ray.';
 return 'We could not confirm your request reached Ray. Your answers are still here. Please try again or call (416) 898-0181.';
}
