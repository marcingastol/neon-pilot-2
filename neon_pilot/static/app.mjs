import {Game, WORLD} from './rules.mjs';
import {Renderer} from './renderer.mjs';
import {Camera} from './camera.mjs';

const $=s=>document.querySelector(s);
const token=$('meta[name="neon-token"]').content;
let config={shield_enabled:true,ranking_fault:false,version:'1.0.0'};
let control='keyboard',phase='ready',manualPause=false,run=null,game=new Game(),pending=null;
let keys=new Set(),cameraStarting=false,apiReady=false,countdownStart=0,lastFrame=performance.now(),lastHud=0,toastTimer;
let rankGeneration=0,soundOn=false,audioContext,requestBusy=false;
const renderer=new Renderer($('#game'));
const camera=new Camera($('#video'),$('#hand-overlay'),cameraStatus);

function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,5500);}
async function api(path,body){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);
  try{
    const response=await fetch(path,{signal:controller.signal,cache:'no-store',...(body!==undefined?{method:'POST',headers:{'Content-Type':'application/json','X-Neon-Token':token},body:JSON.stringify(body)}:{})});
    const data=await response.json();
    if(!response.ok){const error=new Error(data.error||'Błąd serwera.');error.code=data.code;error.requestId=data.request_id;throw error;}
    return data;
  }catch(error){if(error.name==='AbortError')throw new Error('Serwer nie odpowiedział. Sprawdź okno START.cmd i spróbuj ponownie.');throw error;}
  finally{clearTimeout(timer);}
}
function beep(type){
  if(!soundOn)return;
  try{
    audioContext??=new AudioContext();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
    const osc=audioContext.createOscillator(),gain=audioContext.createGain(),t=audioContext.currentTime;
    osc.type=type==='hit'?'sawtooth':'sine';osc.frequency.setValueAtTime({coin:740,hit:120,shield:280,block:460,start:520,end:240}[type]||440,t);
    osc.frequency.exponentialRampToValueAtTime(type==='hit'?45:900,t+.16);gain.gain.setValueAtTime(.035,t);gain.gain.exponentialRampToValueAtTime(.001,t+.19);osc.connect(gain);gain.connect(audioContext.destination);osc.start(t);osc.stop(t+.2);
  }catch{/* Sound is optional. */}
}
function cameraStatus(status,message){
  $('#camera-status').textContent=message;$('#camera-dot').classList.toggle('dim',status!=='tracking');
  $('#camera-placeholder').hidden=Boolean(camera?.stream);
  $('#camera-badge').textContent=status==='tracking'?'ŚLEDZENIE DŁONI / LOKALNIE':'OBRAZ ZOSTAJE NA LAPTOPIE';
  if(status==='error'){toast(message);$('#camera-placeholder').hidden=false;}
}
function updateControl(){
  $('#keyboard-btn').classList.toggle('selected',control==='keyboard');$('#keyboard-btn').setAttribute('aria-pressed',String(control==='keyboard'));
  $('#camera-btn').classList.toggle('selected',control==='camera');$('#camera-btn').setAttribute('aria-pressed',String(control==='camera'));
  $('#camera-off-btn').hidden=!camera.enabled;
  $('#control-label').textContent=`STEROWANIE: ${control==='camera'?'DŁOŃ':'KLAWIATURA'}`;
  $('#start-hint').textContent=control==='camera'?'Zamknięta dłoń — ruch · otwarta dłoń — tarcza':'← → lub A / D — ruch · Spacja — tarcza';
  $('#intro-description').textContent=control==='camera'?'Pokaż jedną dłoń. Ruszaj nią w lewo i prawo. Gdy kamera ją zobaczy, rozpocznij lot.':'Steruj strzałkami lub A / D. Chcesz zagrać bez dotykania? Włącz kamerę obok.';
  refreshRank();
}
function currentShield(){return run&&phase!=='ready'?run.mode==='shield':config.shield_enabled;}
function updateConfig(){
  $('#version-label').textContent=`v${config.version}`;$('#fault-badge').hidden=!config.ranking_fault;
  $('#mode-label').textContent=currentShield()?'WERSJA Z TARCZĄ':'WERSJA BAZOWA';
  refreshRank();
}
async function refreshRank(){
  const generation=++rankGeneration;
  const mode=currentShield()?'shield':'classic';
  $('#ranking-category').textContent=`${control==='camera'?'Kamera':'Klawiatura'} · ${mode==='shield'?'z tarczą':'bez tarczy'}`;
  try{
    const data=await api(`/api/scores?mode=${mode}&control=${control}`);
    if(generation!==rankGeneration)return;
    $('#ranking-list').replaceChildren();
    for(const row of data.scores){const li=document.createElement('li'),name=document.createElement('span'),score=document.createElement('span');name.className='rank-name';name.textContent=row.name;score.className='rank-points';score.textContent=row.score.toLocaleString('pl-PL');li.append(name,score);$('#ranking-list').append(li);}
    $('#ranking-error').hidden=true;$('#ranking-empty').hidden=data.scores.length>0;
  }catch(error){if(generation!==rankGeneration)return;$('#ranking-list').replaceChildren();$('#ranking-empty').hidden=true;$('#ranking-error').hidden=false;$('#ranking-error').textContent=error.code==='DEMO_RANKING_OFFLINE'?'Ćwiczenie: ranking offline. Napraw w panelu F8.':'Ranking niedostępny. Sprawdź serwer i odśwież.';}
}
async function chooseCamera(){
  if(cameraStarting||phase!=='ready')return;
  cameraStarting=true;$('#camera-btn').disabled=true;$('#camera-btn').textContent='Ładowanie…';
  try{await camera.start();if(camera.enabled){control='camera';updateControl();}}
  catch(error){cameraStatus('error',error.message);}
  finally{cameraStarting=false;$('#camera-btn').textContent='Kamera ↗';$('#camera-btn').disabled=false;}
}
function chooseKeyboard(){
  if(phase!=='ready')return;
  camera.stop();control='keyboard';cameraStatus('off','Steruj strzałkami albo włącz kamerę.');updateControl();
}
function overlays(){
  $('#intro').hidden=phase!=='ready';$('#countdown').hidden=phase!=='countdown';$('#results').hidden=phase!=='ended';
  const lost=control==='camera'&&!camera.tracked();
  const paused=phase==='playing'&&(manualPause||lost);
  $('#pause-overlay').hidden=!paused;
  if(paused){$('#pause-title').textContent=lost?'Gdzie jest Twoja dłoń?':'Chwila przerwy.';$('#pause-detail').textContent=lost?'Pokaż dłoń kamerze. Zegar i przeszkody czekają.':'Naciśnij P lub przycisk, aby kontynuować.';$('#resume-btn').hidden=lost;}
  return paused;
}
async function start(){
  if(requestBusy||!apiReady||phase!=='ready'||control==='camera'&&!camera.tracked())return;
  requestBusy=true;$('#start-btn').disabled=true;
  try{
    run=await api('/api/runs',{control});config=run.config;
    game=new Game({shield:run.mode==='shield'});renderer.particles=[];renderer.rings=[];
    pending=null;manualPause=false;keys.clear();phase='countdown';countdownStart=performance.now();
    $('#save-status').textContent='';$('#save-status').classList.remove('error-text');$('#save-btn').disabled=false;$('#save-btn').textContent='Zapisz wynik ↗';$('#score-form').hidden=false;$('#again-btn').textContent='Kolejny lot →';
    beep('start');updateConfig();overlays();
  }catch(error){toast(error.message);}finally{requestBusy=false;}
}
function finish(){
  phase='ended';keys.clear();beep('end');
  pending={run_id:run.run_id,score:game.score,elapsed_ms:Math.round(game.time*1000)};
  $('#final-score').textContent=game.score.toLocaleString('pl-PL');
  $('#result-title').textContent=game.won?'Misja wykonana.':'Jeszcze jeden lot?';
  $('#result-label').textContent=game.won?'60 SEKUND. DOBRA ROBOTA.':'KONIEC RUNDY';
  $('#result-stats').textContent=`${Math.round(game.time)} s lotu · ${game.coins} energii · ${game.blocks} zablokowanych przeszkód`;
  $('#again-btn').textContent='Pomiń zapis i leć ponownie →';
  overlays();refreshRank();
}
function reset(){phase='ready';manualPause=false;pending=null;run=null;game=new Game({shield:config.shield_enabled});keys.clear();overlays();updateConfig();}
function togglePause(){if(phase==='playing'){manualPause=!manualPause;keys.clear();overlays();}}
async function saveScore(event){
  event.preventDefault();if(!pending)return;
  const name=$('#nickname').value.trim();if(!name){$('#nickname').focus();return;}
  $('#save-btn').disabled=true;$('#save-status').textContent='Zapisuję…';$('#save-status').classList.remove('error-text');
  try{
    const result=await api('/api/scores',{...pending,name});pending=null;
    $('#save-status').textContent=`Zapisano! ${result.name}: ${result.score.toLocaleString('pl-PL')} pkt.`;$('#score-form').hidden=true;$('#again-btn').textContent='Kolejny lot →';refreshRank();
    try{localStorage.setItem('neon:nickname',name);}catch{}
  }catch(error){$('#save-status').textContent=`${error.message}${error.requestId?` [${error.requestId}]`:''}`;$('#save-status').classList.add('error-text');$('#save-btn').textContent='Ponów zapis ↗';}
  finally{$('#save-btn').disabled=false;}
}
async function loadLogs(){
  try{const data=await api('/api/events');$('#event-log').textContent=data.events.map(x=>`${x.at} ${x.code}${x.request_id?` [${x.request_id}]`:''}\n${x.detail}`).join('\n\n')||'Brak zdarzeń.';}catch(error){$('#event-log').textContent=error.message;}
}
async function openStage(){
  if(phase==='playing'){manualPause=true;keys.clear();overlays();}
  if(phase==='countdown'){toast('Otwórz panel po rozpoczęciu rundy.');return;}
  $('#stage-shield').checked=config.shield_enabled;$('#stage-fault').checked=config.ranking_fault;$('#stage-status').textContent='';
  $('#stage-dialog').showModal();await loadLogs();
}
async function saveStage(event){
  event.preventDefault();$('#stage-save').disabled=true;
  try{
    config=await api('/api/stage',{shield_enabled:$('#stage-shield').checked,ranking_fault:$('#stage-fault').checked});
    $('#stage-status').textContent='Zapisano. Tryb tarczy zmieni się od kolejnej rundy.';updateConfig();await loadLogs();
  }catch(error){$('#stage-status').textContent=error.message;}
  finally{$('#stage-save').disabled=false;}
}
async function fullscreen(){try{document.fullscreenElement?await document.exitFullscreen():await document.documentElement.requestFullscreen();}catch{toast('Użyj F11, aby włączyć pełny ekran.');}}
function hud(now){
  $('#score').textContent=String(game.score).padStart(4,'0');
  const seconds=Math.max(0,Math.ceil(WORLD.duration-game.time));$('#time').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  $('#lives').textContent=Array.from({length:3},(_,i)=>i<game.lives?'◆':'◇').join(' ');$('#lives').setAttribute('aria-label',`${Math.max(0,game.lives)} życia`);
  $('#round-state').textContent={ready:'GOTOWOŚĆ',countdown:'START',playing:manualPause||control==='camera'&&!camera.tracked()?'PAUZA':'W LOCIE',ended:'WYNIK'}[phase];
  const shield=phase==='ready'?new Game({shield:config.shield_enabled}).shield:game.shield;
  if(!shield.enabled){$('#shield-status').textContent='WERSJA BAZOWA';$('#shield-meter').value=0;$('#shield-description').textContent='Włącz tarczę w panelu sceny F8.';}
  else if(shield.active(game.time)){$('#shield-status').textContent=`AKTYWNA ${(shield.until-game.time).toFixed(1)} s`;$('#shield-meter').value=(shield.until-game.time)/3;$('#shield-description').textContent='Ochrona działa. Przeszkody dają +25 pkt.';}
  else{const cooldown=shield.cooldown(game.time);$('#shield-status').textContent=cooldown>0?`ŁADOWANIE ${Math.ceil(cooldown)} s`:'GOTOWA';$('#shield-meter').value=1-cooldown/10;$('#shield-description').textContent='3 s ochrony · ponowne użycie po 10 s';}
  const locked=phase!=='ready';$('#keyboard-btn').disabled=locked;$('#camera-btn').disabled=locked||cameraStarting;$('#camera-off-btn').disabled=locked;
  $('#start-btn').disabled=!apiReady||requestBusy||cameraStarting||control==='camera'&&!camera.tracked();
}
function frame(now){
  const dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;
  if(phase==='countdown'){
    if(control==='camera'&&!camera.tracked())countdownStart=now;
    const remain=3-(now-countdownStart)/1000;$('#countdown-number').textContent=control==='camera'&&!camera.tracked()?'✋':String(Math.max(1,Math.ceil(remain)));
    if(remain<=0){phase='playing';keys.clear();beep('start');}
  }
  const paused=overlays();
  if(phase==='playing'&&!paused){
    const axis=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA'));
    const events=game.update(dt,{axis,target:control==='camera'?camera.target:null,shield:control==='camera'?camera.open:keys.has('Space')});
    for(const event of events){renderer.burst(event);if(event.type!=='end')beep(event.type);}
    if(game.ended)finish();
  }else if(phase==='ready'&&control==='camera'&&camera.tracked())game.player.x+=(camera.target*1000-game.player.x)*(1-Math.exp(-10*dt));
  renderer.render(game,now/1000,dt,phase==='playing'&&!paused);
  if(now-lastHud>90){hud(now);lastHud=now;}
  requestAnimationFrame(frame);
}

$('#start-btn').addEventListener('click',start);$('#again-btn').addEventListener('click',reset);
$('#score-form').addEventListener('submit',saveScore);$('#camera-btn').addEventListener('click',chooseCamera);
$('#keyboard-btn').addEventListener('click',chooseKeyboard);$('#camera-off-btn').addEventListener('click',chooseKeyboard);
$('#refresh-rank').addEventListener('click',refreshRank);$('#resume-btn').addEventListener('click',()=>{manualPause=false;keys.clear();});
$('#abort-btn').addEventListener('click',()=>{reset();chooseKeyboard();});
$('#fullscreen-btn').addEventListener('click',fullscreen);$('#stage-btn').addEventListener('click',openStage);
$('#close-stage').addEventListener('click',()=>$('#stage-dialog').close());$('#stage-form').addEventListener('submit',saveStage);
$('#copy-log').addEventListener('click',async()=>{await loadLogs();try{await navigator.clipboard.writeText($('#event-log').textContent);toast('Skopiowano log.');}catch{const range=document.createRange();range.selectNodeContents($('#event-log'));const selection=getSelection();selection.removeAllRanges();selection.addRange(range);toast('Naciśnij Ctrl+C, aby skopiować zaznaczony log.');}});
$('#sound-btn').addEventListener('click',()=>{soundOn=!soundOn;$('#sound-btn').textContent=`Dźwięk: ${soundOn?'on':'off'}`;$('#sound-btn').setAttribute('aria-pressed',String(soundOn));if(soundOn)beep('start');});
document.addEventListener('keydown',event=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)||event.target.isContentEditable)return;
  if($('#stage-dialog').open)return;
  if(['ArrowLeft','ArrowRight','Space','KeyA','KeyD'].includes(event.code)){event.preventDefault();keys.add(event.code);}
  if(event.repeat)return;
  if(event.code==='KeyP')togglePause();if(event.code==='KeyF'){event.preventDefault();fullscreen();}
  if(event.code==='F8'){event.preventDefault();openStage();}
  if(event.code==='Enter'&&phase==='ready'&&event.target.tagName!=='BUTTON')start();
});
document.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>{keys.clear();if(phase==='playing')manualPause=true;});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&phase==='playing')manualPause=true;keys.clear();});
window.addEventListener('pagehide',()=>camera.stop());
try{$('#nickname').value=localStorage.getItem('neon:nickname')||'';}catch{}
try{config=await api('/api/config');apiReady=true;updateConfig();updateControl();}
catch(error){toast(error.message);$('#intro-description').textContent='Brak połączenia z serwerem. Uruchom START.cmd i odśwież stronę.';}
requestAnimationFrame(frame);
