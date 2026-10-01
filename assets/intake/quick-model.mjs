import {contextFrom,goalById} from './model.mjs';
export const PURPOSES=['Buy a home','Renew my mortgage','Refinance my mortgage','Use home equity','Renovate my home','Combine my debts','Explore a reverse mortgage','Something else / not sure'];
export const blankContact=()=>({province:'',purpose:'',firstName:'',lastName:'',phone:'',email:'',consent:false});
export function validateContact(a,step){
 const e={};
 if(step===0&&!['Alberta','Ontario'].includes(a.province))e.province='Choose the property province.';
 if(step===1&&!PURPOSES.includes(a.purpose))e.purpose='Choose what you would like to do, or select Not sure.';
 if(step===2){
  for(const k of ['firstName','lastName'])if(typeof a[k]!=='string'||!a[k].trim()||a[k].trim().length>80||/[<>\x00-\x1f]/.test(a[k]))e[k]=`Enter your ${k==='firstName'?'first':'last'} name.`;
  const phone=typeof a.phone==='string'?a.phone.trim():'',email=typeof a.email==='string'?a.email.trim():'';
  if(!phone&&!email){e.phone='Add a phone number or email so Ray can reach you.';e.email=e.phone;}
  if(phone&&!/^(1)?[2-9]\d{9}$/.test(phone.replace(/[\s().+\-]/g,'')))e.phone='Enter a 10-digit Canadian phone number.';
  if(email&&(email.length>254||! /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)))e.email='Enter a valid email address.';
  if(a.consent!==true)e.consent='Please give permission for Ray to contact you about this enquiry.';
 }
 return e;
}
export function buildContact(a,brand,context={}){
 if(Object.keys({...validateContact(a,0),...validateContact(a,1),...validateContact(a,2)}).length)throw new Error('Please check the highlighted fields.');
 if(!['mortgage-x-ray','the-mortgage-room'].includes(brand))throw new Error('Unknown brand');
 return {schemaVersion:'contact-intake-v2',brand,goal:goalById(context.goal)?context.goal:'general',province:a.province,purpose:a.purpose,contact:{firstName:a.firstName.trim(),lastName:a.lastName.trim(),phone:a.phone.trim(),email:a.email.trim()},consent:{granted:true,textVersion:'enquiry-contact-v1'},source:contextFrom('?source='+encodeURIComponent(context.source||'')).source||null};
}
