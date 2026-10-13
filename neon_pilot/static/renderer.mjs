import {WORLD, seededRandom} from './rules.mjs';
const TAU = Math.PI * 2;

export class Renderer {
  constructor(canvas) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.particles=[];this.rings=[];
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rng=seededRandom(77);
    this.stars=Array.from({length:110},()=>({x:rng()*1000,y:rng()*640,r:.4+rng()*1.3,s:8+rng()*34,a:.15+rng()*.5}));
  }
  burst(event){
    const color={hit:'#ff977d',coin:'#d4ff75',block:'#55e5d6',shield:'#55e5d6'}[event.type];
    if(!color)return;
    this.rings.push({x:event.x,y:event.y,age:0,color,kind:event.type});
    for(let i=0;i<(this.reduced?5:20);i++){
      const angle=Math.random()*TAU,speed=40+Math.random()*190;
      this.particles.push({x:event.x,y:event.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,age:0,life:.4+Math.random()*.6,color});
    }
  }
  render(game,now,dt,playing){
    const c=this.canvas,ctx=this.ctx,bounds=c.getBoundingClientRect();
    const dpr=Math.min(devicePixelRatio||1,2),w=Math.round(bounds.width*dpr),h=Math.round(bounds.height*dpr);
    if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
    ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#080e11';ctx.fillRect(0,0,w,h);
    const scale=Math.min(w/WORLD.width,h/WORLD.height),ox=(w-WORLD.width*scale)/2,oy=(h-WORLD.height*scale)/2;
    ctx.setTransform(scale,0,0,scale,ox,oy);
    const bg=ctx.createRadialGradient(520,230,10,500,260,650);bg.addColorStop(0,'#172c29');bg.addColorStop(.5,'#0b1c21');bg.addColorStop(1,'#080e11');ctx.fillStyle=bg;ctx.fillRect(0,0,1000,640);
    // A subtle horizon gives the ship a direction without obscuring collisions.
    ctx.strokeStyle='#294743';ctx.lineWidth=.6;ctx.globalAlpha=.3;
    for(let x=-800;x<=1800;x+=150){ctx.beginPath();ctx.moveTo(500+(x-500)*.12,65);ctx.lineTo(x,640);ctx.stroke();}
    for(let i=0;i<13;i++){const n=(i/13+(this.reduced?0:now*.018)% (1/13));const y=65+n*n*700;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1000,y);ctx.stroke();}
    ctx.globalAlpha=1;
    for(const star of this.stars){const y=(star.y+now*star.s*(this.reduced?.15:1))%640;ctx.globalAlpha=star.a;ctx.fillStyle='#c4e7dd';ctx.fillRect(star.x,y,star.r,playing?star.r*2:star.r);}
    ctx.globalAlpha=1;
    for(const item of game.pickups){
      ctx.save();ctx.translate(item.x,item.y);ctx.rotate(Math.PI/4);ctx.shadowColor='#d4ff75';ctx.shadowBlur=17;
      ctx.fillStyle='#d4ff75';ctx.fillRect(-8,-8,16,16);ctx.shadowBlur=0;ctx.strokeStyle='#d4ff7570';ctx.strokeRect(-14,-14,28,28);ctx.restore();
    }
    for(const rock of game.obstacles){
      ctx.save();ctx.translate(rock.x,rock.y);ctx.rotate(rock.angle);ctx.beginPath();
      for(let i=0;i<8;i++){const a=i/8*TAU,r=rock.r*(.85+Math.sin(i*7+rock.seed*20)*.15);const x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();
      ctx.fillStyle='#342a28';ctx.strokeStyle='#dd8d70';ctx.lineWidth=1.8;ctx.shadowColor='#dd8d7030';ctx.shadowBlur=16;ctx.fill();ctx.stroke();
      ctx.shadowBlur=0;ctx.strokeStyle='#b5765145';ctx.beginPath();ctx.moveTo(-rock.r*.4,-rock.r*.3);ctx.lineTo(rock.r*.3,rock.r*.1);ctx.lineTo(rock.r*.5,-rock.r*.4);ctx.stroke();ctx.restore();
    }
    const p=game.player;
    ctx.save();ctx.translate(p.x,p.y);
    if(game.time<game.invulnerableUntil&&Math.floor(now*12)%2)ctx.globalAlpha=.35;
    if(game.shield.active(game.time)){
      ctx.save();ctx.rotate(now*.6);ctx.strokeStyle='#55e5d6';ctx.lineWidth=2.8;ctx.shadowColor='#55e5d6';ctx.shadowBlur=24;
      ctx.beginPath();ctx.arc(0,0,48,0,TAU);ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='#9cffab60';ctx.setLineDash([10,7]);ctx.beginPath();ctx.arc(0,0,55,0,TAU);ctx.stroke();ctx.restore();
      ctx.fillStyle='#55e5d60c';ctx.beginPath();ctx.arc(0,0,47,0,TAU);ctx.fill();
    }
    ctx.shadowBlur=22;ctx.shadowColor='#55e5d6';
    const flame=playing?30+Math.sin(now*35)*10:15+Math.sin(now*5)*4;
    ctx.fillStyle='#55e5d6';ctx.beginPath();ctx.moveTo(-7,15);ctx.lineTo(0,flame+15);ctx.lineTo(7,15);ctx.fill();
    ctx.fillStyle='#d4ff75';ctx.shadowColor='#d4ff75';ctx.shadowBlur=12;
    ctx.beginPath();ctx.moveTo(0,-27);ctx.lineTo(23,23);ctx.lineTo(0,13);ctx.lineTo(-23,23);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#243b29';ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(7,9);ctx.lineTo(-7,9);ctx.closePath();ctx.fill();ctx.restore();
    for(const v of this.particles){v.age+=dt;v.x+=v.vx*dt;v.y+=v.vy*dt;ctx.globalAlpha=Math.max(0,1-v.age/v.life);ctx.fillStyle=v.color;ctx.fillRect(v.x,v.y,3,3);}this.particles=this.particles.filter(v=>v.age<v.life);
    for(const ring of this.rings){ring.age+=dt;ctx.globalAlpha=Math.max(0,1-ring.age/.6);ctx.strokeStyle=ring.color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(ring.x,ring.y,8+ring.age*120,0,TAU);ctx.stroke();if(ring.kind==='coin'||ring.kind==='block'){ctx.font='16px Consolas,monospace';ctx.fillStyle=ring.color;ctx.textAlign='center';ctx.fillText(ring.kind==='coin'?'+100':'+25',ring.x,ring.y-ring.age*60);}}
    this.rings=this.rings.filter(v=>v.age<.6);ctx.globalAlpha=1;
  }
}
