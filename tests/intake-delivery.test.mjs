import test from 'node:test';import assert from 'node:assert/strict';
import {createDelivery} from '../assets/intake/delivery.mjs';
const id='dd19760b-31ad-4c70-91e8-8b2c5a4b346b';
const result=(body,ok=true)=>({ok,json:async()=>body});
// Regression: QA-001, Back/edit after an uncertain delivery reused another draft's receipt.
test('edited answers receive a new ID while unchanged retries retain it',async()=>{
 let n=0;const posts=[];
 const d=createDelivery('https://example.invalid/api',{uuid:()=>`request-${++n}`,wait:async()=>{},fetcher:async(u,o)=>{
  if(o.method==='GET')return result({challenge:'sample'});
  posts.push(JSON.parse(o.body));return result({error:'delivery_not_confirmed'},false);
 }});
 const draft={purpose:'Buy a home',contact:{email:'test@example.com'}};
 await assert.rejects(d.submit(draft));
 await assert.rejects(d.submit({...draft}));
 await assert.rejects(d.submit({...draft,purpose:'Refinance my mortgage'}));
 await assert.rejects(d.submit({...draft,purpose:'Refinance my mortgage'}));
 assert.equal(posts[0].requestId,posts[1].requestId);
 assert.notEqual(posts[1].requestId,posts[2].requestId);
 assert.equal(posts[2].requestId,posts[3].requestId);
 d.reset();await assert.rejects(d.submit(draft));assert.notEqual(posts[4].requestId,posts[3].requestId);
});
test('uncertain delivery retries same ID and sends both contact fields',async()=>{
 const posts=[];let count=0;
 const d=createDelivery('https://example.invalid/api',{uuid:()=>id,wait:async()=>{},fetcher:async(u,o)=>{if(o.method==='GET')return result({challenge:'sample'});posts.push(JSON.parse(o.body));if(count++===0)throw new Error('network');return result({ok:true,reference:id});}});
 const draft={contact:{phone:'+14165550199',email:'test@example.com'}};
 await assert.rejects(d.submit(draft));assert.equal(await d.submit(draft),id);assert.equal(posts[0].requestId,posts[1].requestId);assert.deepEqual(posts[1].draft,draft);
});
test('never accepts missing/mismatched receipt or error status as success',async()=>{
 for(const reply of [result({ok:true}),result({ok:true,reference:'wrong'}),result({ok:true,reference:id},false),{ok:true,json:async()=>{throw Error('html')}}]){
  const d=createDelivery('https://example.invalid/api',{uuid:()=>id,wait:async()=>{},fetcher:async(u,o)=>o.method==='GET'?result({challenge:'sample'}):reply});await assert.rejects(d.submit({}));
 }
});
test('expired challenge is refreshed while preserving request ID',async()=>{
 let gets=0,posts=0;const d=createDelivery('https://example.invalid/api',{uuid:()=>id,wait:async()=>{},fetcher:async(u,o)=>o.method==='GET'?(gets++,result({challenge:'sample'})):(posts++===0?result({error:'refresh_required'},false):result({ok:true,reference:id}))});
 await assert.rejects(d.submit({}));assert.equal(await d.submit({}),id);assert.equal(gets,2);
});
