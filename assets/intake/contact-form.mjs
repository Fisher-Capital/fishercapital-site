import {createDelivery,deliveryMessage} from './delivery.mjs';
import {blankContact,validateContact,buildContact,PURPOSES} from './quick-model.mjs';
import {contextFrom} from './model.mjs';
const root=document.querySelector('#campaign-form,#guided-intake');
const cfg=document.querySelector('#offer-config');const config=cfg?JSON.parse(cfg.textContent):{};
const context={...contextFrom(location.search),...(config.goal&&config.goal!=='general'?{goal:config.goal}:{})};
const privacy=config.privacy||(document.body.dataset.brand==='mortgage-x-ray'?'/privacy/':'/privacy-policy/');
const live=document.body.dataset.mode==='live';
const endpoint=document.body.dataset.endpoint;
const provinces=live?(document.body.dataset.provinces||'Ontario').split(',').filter(p=>['Ontario','Alberta'].includes(p)):['Alberta','Ontario'];
// Endpoint is a build setting, never a visitor-controlled URL parameter.
const delivery=live&&endpoint==='https://fishercapital-chatbot.vercel.app/api/intake'?createDelivery(endpoint):null;
if(delivery)delivery.prepare().catch(()=>{});
const answers=blankContact();let step=0,complete=false,errors={},sending=false,sendError='',reference='';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function input(k,label,type='text'){return `<div class="field"><label for="${k}">${label}</label><input id="${k}" data-field="${k}" type="${type}" autocomplete="${{firstName:'given-name',lastName:'family-name',phone:'tel',email:'email'}[k]}" maxlength="${{firstName:80,lastName:80,phone:30,email:254}[k]}" value="${esc(answers[k])}" aria-invalid="${!!errors[k]}" aria-describedby="${k}-error"${type==='tel'?' inputmode="tel"':''}><p class="error" id="${k}-error">${esc(errors[k]||'')}</p></div>`;}
function render(focus=false){
 if(complete){root.innerHTML=`<h2 id="form-title" tabindex="-1">${live?'Your request reached Ray.':'Preview complete.'}</h2>${live?`<p>Ray will follow up using the phone number or email you provided.</p><p class="privacy-note">Your enquiry has been received. No appointment is booked yet.</p><p class="privacy-note">Reference: ${esc(reference)}</p>`:'<p>Nothing was sent. No enquiry or appointment was created.</p><p class="preview-message">When the live form is connected, this is where you will see confirmation that your request reached Ray.</p>'}<div class="actions">${live&&document.body.dataset.brand==='the-mortgage-room'?'<a class="primary" href="https://calendly.com/raymond-finance-co/mortgage-consultation" target="_blank" rel="noopener">Choose a call time ↗</a>':''}<a class="secondary" href="tel:+14168980181">Call (416) 898-0181 →</a><button class="back" type="button" data-action="restart">Start again</button></div>`;}
 else root.innerHTML=`<div class="progress-label"><span>Step ${step+1} of 3</span><span>${['Property province','Your goal','Contact details'][step]}</span></div><div class="progress-track" aria-hidden="true">${[0,1,2].map(i=>`<span class="${i<=step?'complete':''}"></span>`).join('')}</div><h2 id="form-title" tabindex="-1">${['Where is the property?','What are you looking to do?','Let’s get in touch.'][step]}</h2><p class="intro">${['Choose the province. We’ll discuss the rest with you.','Choose the closest match. Not sure is fine.','Leave your details. Ray will discuss your situation with you by phone or email.'][step]}</p>${step===2?`<div class="fields quick-contact">${input('firstName','First name')}${input('lastName','Last name')}${input('phone','Phone number','tel')}${input('email','Email address','email')}</div><p class="privacy-note">Phone or email is enough. You can provide both.</p><label class="consent"><input id="consent" data-field="consent" type="checkbox" ${answers.consent?'checked':''} aria-invalid="${!!errors.consent}" aria-describedby="consent-error"><span>I agree that Raymond. F may contact me about this mortgage enquiry.</span></label><p class="error" id="consent-error">${esc(errors.consent||'')}</p><p class="privacy-note">Enquiry only, not a marketing subscription. <a href="${privacy}" target="_blank" rel="noopener">Privacy notice (new tab)</a>.</p>`:step===1?`<div class="field"><label for="purpose">I’m looking to</label><select id="purpose" data-field="purpose" aria-invalid="${!!errors.purpose}" aria-describedby="purpose-error"><option value="">Choose your goal</option>${PURPOSES.map(v=>`<option${answers.purpose===v?' selected':''}>${esc(v)}</option>`).join('')}</select><p class="error" id="purpose-error">${esc(errors.purpose||'')}</p></div>`:`<div class="field"><label for="province">Property province</label><select id="province" data-field="province" aria-invalid="${!!errors.province}" aria-describedby="province-error"><option value="">Choose a province</option>${provinces.map(v=>`<option${answers.province===v?' selected':''}>${v}</option>`).join('')}</select><p class="error" id="province-error">${esc(errors.province||'')}</p></div>`}<p class="error-summary" role="alert">${esc(sendError)||(Object.keys(errors).length?'Please check the highlighted fields.':'')}</p><div class="actions">${step?'<button class="back" type="button" data-action="back">← Back</button>':'<span></span>'}<button class="primary" type="submit">${sending?'Sending…':step===2?(live?'Send my request':'Preview submission'):'Continue'} →</button></div>${live?'<p class="privacy-note">No SIN, documents or credit check at this step.</p>':'<p class="privacy-note">Design preview. Nothing is sent.</p>'}`;
 root.setAttribute('aria-busy',String(sending));
 if(sending)root.querySelectorAll('input,select,button').forEach(el=>el.disabled=true);
 if(focus){root.querySelector('#form-title').focus({preventScroll:true});root.scrollIntoView({block:'start',behavior:'instant'});}
}
root.addEventListener('input',e=>{if(sending)return;if(sendError)delivery?.reset();sendError='';const k=e.target.dataset.field;if(Object.hasOwn(answers,k))answers[k]=e.target.type==='checkbox'?e.target.checked:e.target.value;});
root.addEventListener('click',e=>{if(sending)return;sendError='';const action=e.target.closest('[data-action]')?.dataset.action;if(action==='back'){step=Math.max(0,step-1);errors={};render(true);}if(action==='restart'){delivery?.reset();reference='';Object.assign(answers,blankContact());step=0;complete=false;errors={};render(true);}});
root.addEventListener('submit',async e=>{e.preventDefault();if(sending)return;sendError='';errors=validateContact(answers,step);if(Object.keys(errors).length){render();document.getElementById(Object.keys(errors)[0])?.focus();return;}
 if(step<2){step++;render(true);return;}
 const draft=buildContact(answers,document.body.dataset.brand,context);
 if(live){
  sending=true;render();
  try{if(!delivery)throw new Error('temporarily_unavailable');reference=await delivery.submit(draft);}
  catch(error){sendError=deliveryMessage(error.message);sending=false;render();root.querySelector('.error-summary')?.scrollIntoView({block:'nearest'});return;}
  sending=false;
 }
 complete=true;Object.assign(answers,blankContact());render(true);
});
render();
