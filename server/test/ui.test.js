const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.join(__dirname,'../../client/public');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const contract=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/original-design-contract.json'),'utf8'));
test('responsive pages retain original controls, public/admin CSS and ticket CSS',()=>{
 for(const [file,hash] of Object.entries(contract.css))assert.equal(sha(fs.readFileSync(path.join(root,file))),hash,file);
 for(const file of Object.keys(contract.templates)){
  const dom=new JSDOM(read(file)),doc=dom.window.document;
  const ids=[...doc.querySelectorAll('[id]')].map(element=>element.id);
  assert.equal(new Set(ids).size,ids.length,`${file}: duplicate IDs`);
  for(const id of contract.originalIds[file])assert(doc.getElementById(id),`${file}: original ${id}`);
  assert(doc.querySelector('link[href*="mobile.css"]'),`${file}: responsive styles`);
  assert(doc.querySelector('script[src*="ui.js"]'),`${file}: accessible controls`);
  assert(!/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/.test(doc.querySelector('meta[name="viewport"]').content),`${file}: zoom allowed`);
  for(const label of doc.querySelectorAll('label[for]'))assert(doc.getElementById(label.htmlFor),`${file}: label ${label.htmlFor}`);
  if(file==='ticket.html')assert.equal(sha(doc.querySelector('style').textContent),contract.ticketInlineCss);
  dom.window.close();
 }
});
test('original particle/reveal code, ticket motion, chart settings and transition delays are preserved',()=>{
 const app=read('app.js'),admin=read('admin/admin.js'),ticket=read('ticket.js');
 assert.equal(sha(app.slice(app.indexOf("  const canvas = document.getElementById('ambientCanvas');"))),contract.publicAnimationTail);
 assert.equal(sha(ticket.replace(/\r\n/g,'\n').split('\n').slice(-100).join('\n')),contract.ticketMotionTail);
 assert.equal(sha(admin.slice(admin.indexOf('      volumeChart = new Chart(ctx, {'),admin.indexOf('    } catch (err)'))),contract.chartConfiguration);
 assert(app.includes("setTimeout(() => { generateTimes(); navigateTo('view-time'); }, 200)"));
 assert(app.includes("setTimeout(() => navigateTo('view-details'), 250)"));
});
test('all executable scripts are local, dynamic actions use no inline handlers, and vendor hashes match',()=>{
 for(const file of Object.keys(contract.templates)){
  const dom=new JSDOM(read(file)),doc=dom.window.document;
  assert.equal(doc.querySelectorAll('script:not([src])').length,0,file);
  for(const element of doc.querySelectorAll('*'))for(const attr of element.attributes)assert(!/^on/i.test(attr.name),`${file}: inline ${attr.name}`);
  for(const script of doc.querySelectorAll('script[src]')){
   const source=script.getAttribute('src').split('?')[0];assert(!source.startsWith('http'));
   assert(fs.existsSync(path.join(root,source.startsWith('/')?source.slice(1):path.join(path.dirname(file),source))));
  }
  dom.window.close();
 }
 assert(!/onclick\s*=/.test(read('admin/admin.js')));
 const lock=JSON.parse(fs.readFileSync(path.join(__dirname,'../package-lock.json'),'utf8'));
 for(const item of JSON.parse(read('vendor/manifest.json'))){assert.equal(sha(fs.readFileSync(path.join(root,'vendor',item.file))),item.sha256);assert.equal(lock.packages[`node_modules/${item.package}`].version,item.version);}
});
const malicious='<img src=x onerror="window.injected=true">';
const slots=['3:00 PM - 4:30 PM','4:30 PM - 6:00 PM','6:00 PM - 7:30 PM','7:30 PM - 9:00 PM','9:00 PM - 10:30 PM','10:30 PM - 12:00 AM'].map((time,i)=>({time,available:i!==0,isPopular:i===3}));
const booking={id:'RES-ABC123',name:malicious,phone:'03696325',date:'2099-01-01',time:slots[2].time,status:'PENDING',ticketUrl:'/ticket.html?token=signed-test'};
async function fixture(file,scripts,handler,search=''){
 const errors=[],calls=[],alerts=[],virtualConsole=new VirtualConsole();
 virtualConsole.on('jsdomError',e=>{if(!/navigation \(except hash changes\)/.test(e.message))errors.push(e.message);});
 const dom=new JSDOM(read(file),{url:`http://kickoff.test/${search}`,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole});
 const w=dom.window;
 w.scrollTo=()=>{};w.confirm=()=>true;w.alert=value=>alerts.push(String(value));
 w.HTMLCanvasElement.prototype.getContext=()=>null;
 w.requestAnimationFrame=()=>1;
 w.IntersectionObserver=class{observe(){}unobserve(){}};
 w.HTMLCanvasElement.prototype.getContext=function(){return this.id==='analyticsChart'?{createLinearGradient:()=>({addColorStop(){}})}:null;};
 // Original public particles require a canvas; remove only that canvas in the test fixture.
 w.document.getElementById('ambientCanvas')?.remove();
 w.Chart=class{constructor(context,config){w.chartConfig=config;}destroy(){}};
 w.flatpickr=(selector,options)=>{(w.pickers||=[]).push({selector,options});};
 w.fetch=async(url,options={})=>{
  calls.push({url:String(url),options});const result=await handler(String(url),options);
  const response={ok:(result.status||200)<400,status:result.status||200,json:async()=>result.body??result};response.clone=()=>({...response});return response;
 };
 await new Promise(resolve=>w.document.readyState==='loading'?w.document.addEventListener('DOMContentLoaded',resolve,{once:true}):resolve());
 for(const script of scripts)w.eval(read(script));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 return{dom,w,doc:w.document,errors,calls,alerts,close:()=>w.close()};
}
async function until(check){for(let i=0;i<200;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,5));}throw new Error('DOM state did not settle');}
const session={csrfToken:'test-csrf',user:null,settings:{bookingDays:14,businessWhatsApp:'9613696325'}};
test('staff sign-in supports password visibility, blocks duplicate submits and recovers after network errors',async()=>{
 let rejectLogin;
 const f=await fixture('admin/index.html',['shared.js','admin/login.js','ui.js'],url=>{
  if(url==='/api/session')return session;
  if(url==='/api/admin/login')return new Promise((resolve,reject)=>{rejectLogin=reject;});
  throw new Error(url);
 });
 try{
  const password=f.doc.getElementById('password'),toggle=f.doc.getElementById('togglePassword');
  password.value='example-password';f.doc.getElementById('username').value='staff';
  toggle.click();assert.equal(password.type,'text');assert.equal(toggle.getAttribute('aria-pressed'),'true');
  toggle.click();assert.equal(password.type,'password');
  const form=f.doc.getElementById('loginForm'),button=f.doc.getElementById('loginBtn');
  form.dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));
  form.dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));
  await until(()=>rejectLogin);
  assert.equal(f.calls.filter(c=>c.url==='/api/admin/login').length,1);
  assert.equal(button.disabled,true);assert.equal(button.getAttribute('aria-busy'),'true');
  rejectLogin(new Error('Connection failed. Please try again.'));
  await until(()=>!button.disabled);
  assert.equal(f.doc.getElementById('loginButtonLabel').textContent,'Sign in');
  assert.equal(f.doc.getElementById('loginError').textContent,'Connection failed. Please try again.');
  assert.equal(f.doc.activeElement.id,'loginError');assert.equal(password.value,'example-password');
  assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
test('customer login errors keep guest access available and preview explains disabled Google sign-in',async()=>{
 const f=await fixture('index.html',['shared.js','app.js','ui.js'],url=>url==='/api/auth/me'?{loggedIn:false,preview:true}:session,'?error=login_failed');
 try{
  await until(()=>f.doc.getElementById('btnGoogleLogin').dataset.preview==='true');
  assert.equal(f.doc.getElementById('authError').hidden,false);
  assert(f.doc.getElementById('authError').textContent.includes('Try again or continue as a guest'));
  assert(f.doc.getElementById('guestHint').textContent.includes('Local preview'));
  assert.equal(f.doc.getElementById('btnGuestLogin').disabled,false);
  f.doc.getElementById('btnGuestLogin').click();assert(f.doc.getElementById('view-home').classList.contains('active'));
  assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
test('original customer match cards escape untrusted fields and use signed pass URLs',async()=>{
 const f=await fixture('index.html',['shared.js','app.js'],url=>url==='/api/auth/me'?{loggedIn:true,user:{id:1,name:'Alice',email:'alice@example.invalid',phone:''}}:{reservations:[booking]});
 try{
  await until(()=>f.doc.getElementById('desktopProfileLink').style.display==='block');
  f.doc.getElementById('desktopProfileLink').click();await until(()=>f.doc.getElementById('userMatchesList').querySelector('a'));
  const list=f.doc.getElementById('userMatchesList');assert.equal(list.querySelector('img'),null);assert(list.textContent.includes(malicious));assert(list.querySelector('a').href.includes('?token=signed-test'));assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
test('original guest flow retains selection delays and sends one CSRF-protected request with a local QR',async()=>{
 const f=await fixture('index.html',['shared.js','app.js'],(url,options)=>{
  if(url==='/api/auth/me')return{loggedIn:false};if(url==='/api/session')return session;
  if(url.startsWith('/api/availability'))return{schedule:slots};
  if(url==='/api/reservations')return{status:201,body:{reservation:booking,ticket:{url:booking.ticketUrl,qrUrl:'/api/tickets/signed-test/qr.svg'}}};
  throw new Error(url);
 });
 try{
  f.doc.getElementById('btnGuestLogin').click();f.doc.getElementById('btnStart').click();
  assert.equal(f.doc.querySelectorAll('.date-node').length,14);
  f.doc.querySelectorAll('.date-node')[1].click();assert(f.doc.getElementById('view-date').classList.contains('active'));
  await until(()=>f.doc.querySelector('.time-node'));
  f.doc.querySelectorAll('.time-node')[2].click();assert(f.doc.querySelectorAll('.time-node')[2].classList.contains('selected'));
  await until(()=>f.doc.getElementById('view-details').classList.contains('active'));
  f.doc.getElementById('playerName').value='Test Player';f.doc.getElementById('playerPhone').value='03696325';
  f.doc.getElementById('bookingForm').dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));
  assert(f.doc.getElementById('confirmModal').classList.contains('active'));
  f.doc.getElementById('btnProceedConfirm').click();f.doc.getElementById('btnProceedConfirm').click();
  await until(()=>f.doc.getElementById('view-confirm').classList.contains('active'));
  const submits=f.calls.filter(c=>c.url==='/api/reservations');assert.equal(submits.length,1);assert.equal(submits[0].options.headers['X-CSRF-Token'],'test-csrf');
  assert.equal(f.doc.querySelector('.qr-img').getAttribute('src'),'/api/tickets/signed-test/qr.svg');
  assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
test('original staff table and chart render safely; rejected approvals retain the original modal',async()=>{
 const f=await fixture('admin/dashboard.html',['shared.js','admin/admin.js'],(url,options)=>{
  if(url==='/api/session')return session;
  if(url==='/api/admin/check-session')return{authenticated:true,user:'staff'};
  if(url.startsWith('/api/availability'))return{schedule:slots};
  if(url.startsWith('/api/admin/reservations?')){
   const secondPage=new URL(url,'http://kickoff.test').searchParams.get('page')==='2';
   return{reservations:[secondPage?{...booking,id:'RES-SECOND',name:'Second Team',time:slots[3].time}:booking],pagination:{hasNext:!secondPage}};
  }
  if(url==='/api/admin/dashboard-stats')return{todayMatches:1,pending:1,upcoming:1,cancelled:0};
  if(url==='/api/admin/analytics')return{analytics:[]};
  if(url==='/api/admin/standing-bookings')return{standingBookings:[{id:1,playerName:'Weekly',phone:'03696325',dayOfWeek:1,time:slots[1].time}]};
  if(url.endsWith('/confirm'))return{status:409,body:{error:'Slot already confirmed.'}};
  throw new Error(url);
 });
 try{
  await until(()=>f.w.chartConfig);assert.equal(f.w.chartConfig.type,'line');assert.equal(f.w.pickers.length,2);
  f.doc.querySelector('[data-view="list"]').click();await until(()=>f.doc.querySelectorAll('#reservationsTableBody tr').length===2);
  assert.equal(f.doc.querySelector('#reservationsTableBody img'),null);
  await f.w.openDetailsModal(booking.id);assert(f.doc.getElementById('detailsModal').classList.contains('active'));
  f.doc.querySelector('#detailsActions [data-action="confirmReservation"]').click();await until(()=>f.alerts.includes('Slot already confirmed.'));
  assert(f.doc.getElementById('detailsModal').classList.contains('active'));
  f.doc.querySelector('[data-view="fixed"]').click();await until(()=>f.doc.querySelector('#fixedBookingsTableBody [data-action="openEditFixedModal"]'));
  f.doc.querySelector('#fixedBookingsTableBody [data-action="openEditFixedModal"]').click();await until(()=>f.doc.getElementById('editFixedModal').classList.contains('active'));
  assert.equal(f.doc.getElementById('editFId').value,'1');assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
test('original pass verifies server data without blocking motion initialization and follows cancellation status',async()=>{
 let status='PENDING';
 const f=await fixture('ticket.html',['shared.js','ticket.js'],()=>({reservation:{...booking,status,ends_at:'2099-01-02T00:00:00Z'}}),'?token=signed&name=FORGED');
 try{
  await until(()=>f.doc.getElementById('p-name').textContent===malicious);
  assert.equal(f.doc.querySelector('#p-name img'),null);assert(f.doc.querySelector('.verified-status').textContent.includes('PENDING APPROVAL'));
  status='CANCELLED';f.doc.dispatchEvent(new f.w.Event('visibilitychange'));await until(()=>f.doc.querySelector('.verified-status').textContent.includes('CANCELLED'));
  assert.equal(f.doc.getElementById('saveTicketBtn').disabled,false);assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
test('unsigned pass stays unverified with exports disabled while original display code initializes',async()=>{
 const f=await fixture('ticket.html',['shared.js','ticket.js'],()=>{throw new Error('Unsigned pass must not call ticket API');},'?id=FORGED&name=Fake');
 try{
  assert(f.doc.querySelector('.verified-status').textContent.includes('UNVERIFIED PASS'));
  assert.equal(f.doc.getElementById('saveTicketBtn').disabled,true);assert.equal(f.calls.length,0);assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
