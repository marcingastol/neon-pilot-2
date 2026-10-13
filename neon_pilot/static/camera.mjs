import {clamp, GestureLatch} from './rules.mjs';
const EDGES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

export class Camera {
  constructor(video, canvas, onStatus) {
    this.video=video; this.canvas=canvas; this.onStatus=onStatus;
    this.latch=new GestureLatch(); this.lastSeen=0; this.target=.5;
    this.open=false; this.enabled=false; this.busy=false; this.points=[];
    this.generation=0; this.lastSent=0; this.timer=null;
  }
  async start() {
    this.stop();
    const gen=this.generation;
    if (!navigator.mediaDevices?.getUserMedia || typeof OffscreenCanvas === 'undefined') {
      throw new Error('Użyj aktualnego Edge lub Chrome pod adresem localhost. Możesz też grać klawiaturą.');
    }
    this.onStatus('permission','Zezwól na kamerę');
    let stream;
    try {
      stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},frameRate:{ideal:24,max:30}},audio:false});
      if(gen!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
      this.stream=stream; this.video.srcObject=stream; await this.video.play();
      this.worker=new Worker('/static/vision-worker.js');
      this.onStatus('loading','Ładuję lokalny model…');
      await new Promise((resolve,reject)=>{
        const worker=this.worker;
        this.initReject=reject;
        this.timer=setTimeout(()=>reject(new Error('Model nie uruchomił się w 45 sekund. Spróbuj ponownie albo wybierz klawiaturę.')),45000);
        worker.onerror=()=>{reject(new Error('Nie można uruchomić modelu gestów. Sprawdź pliki i przeglądarkę.')); if(this.enabled)this.fail('Błąd modelu gestów. Wybierz klawiaturę.');};
        worker.onmessage=({data})=>{
          if(gen!==this.generation)return;
          if(data.type==='ready'){clearTimeout(this.timer);this.initReject=null;resolve();}
          if(data.type==='result'){
            this.busy=false; this.points=data.landmarks;
            if(this.points.length){
              this.lastSeen=performance.now();
              const x=[0,5,9,13,17].reduce((sum,i)=>sum+this.points[i].x,0)/5;
              this.target=clamp((1-x-.12)/.76,.03,.97);
              this.open=this.latch.update(data.gesture,data.confidence,this.lastSeen);
              this.onStatus('tracking',this.open?'Otwarta dłoń · tarcza':'Sterowanie aktywne');
            } else {this.open=this.latch.update('None',0,performance.now());this.onStatus('searching','Pokaż jedną dłoń');}
            this.draw();
          }
          if(data.type==='error'){
            if(!this.enabled)reject(new Error('Model gestów zgłosił błąd. Sprawdź konsolę przeglądarki i pliki modelu.'));
            else this.fail('Przerwano rozpoznawanie. Wybierz klawiaturę lub uruchom kamerę ponownie.');
            console.error('MediaPipe:',data.message);
          }
        };
        worker.postMessage({type:'init'});
      });
      if(gen!==this.generation)return;
      this.enabled=true; this.onStatus('searching','Pokaż jedną dłoń'); this.loop(gen);
      stream.getVideoTracks()[0].onended=()=>{if(this.enabled)this.fail('Kamera została odłączona. Wybierz klawiaturę.');};
    } catch(error) {
      if(gen!==this.generation)return;
      this.stop();
      if(error.name==='NotAllowedError')throw new Error('Brak zgody na kamerę. Zezwól na nią przy pasku adresu lub wybierz klawiaturę.');
      if(error.name==='NotFoundError')throw new Error('Nie znaleziono kamery. Gra działa także klawiaturą.');
      if(error.name==='NotReadableError')throw new Error('Kamera jest zajęta. Zamknij Teams/Zoom i spróbuj ponownie.');
      throw error;
    }
  }
  async loop(gen) {
    if(!this.enabled||gen!==this.generation)return;
    const now=performance.now();
    if(!this.busy&&now-this.lastSent>65&&this.video.readyState>=2){
      this.busy=true;this.lastSent=now;
      try {
        const bitmap=await createImageBitmap(this.video);
        if(gen!==this.generation){bitmap.close();return;}
        this.worker.postMessage({type:'frame',bitmap,time:now},[bitmap]);
      }catch{this.busy=false;this.fail('Nie udało się odczytać obrazu kamery.');return;}
    }
    this.raf=requestAnimationFrame(()=>this.loop(gen));
  }
  draw(){
    const ctx=this.canvas.getContext('2d');const w=this.canvas.width,h=this.canvas.height;
    ctx.clearRect(0,0,w,h);if(!this.points.length)return;
    ctx.strokeStyle=this.open?'#d4ff75':'#55e5d6';ctx.lineWidth=2;
    for(const[a,b]of EDGES){ctx.beginPath();ctx.moveTo(this.points[a].x*w,this.points[a].y*h);ctx.lineTo(this.points[b].x*w,this.points[b].y*h);ctx.stroke();}
    ctx.fillStyle='#eef9e8';for(const p of this.points){ctx.beginPath();ctx.arc(p.x*w,p.y*h,3,0,Math.PI*2);ctx.fill();}
  }
  tracked(){return this.enabled&&performance.now()-this.lastSeen<800;}
  fail(message){this.stop();this.onStatus('error',message);}
  stop(){
    this.generation++;clearTimeout(this.timer);cancelAnimationFrame(this.raf);
    if(this.initReject){this.initReject(new Error('Anulowano uruchamianie kamery.'));this.initReject=null;}
    this.worker?.terminate();this.worker=null;this.stream?.getTracks().forEach(t=>t.stop());
    this.stream=null;this.video.srcObject=null;this.enabled=false;this.busy=false;
    this.points=[];this.open=false;this.lastSeen=0;this.latch.reset();this.draw();
  }
}
