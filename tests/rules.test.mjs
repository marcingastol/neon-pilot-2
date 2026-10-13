import test from 'node:test';
import assert from 'node:assert/strict';
import {Shield, Game, GestureLatch, seededRandom} from '../neon_pilot/static/rules.mjs';

test('shield lasts exactly three seconds and cannot extend while held',()=>{
  const shield=new Shield();
  assert.equal(shield.input(true,1),true);
  assert.equal(shield.active(3.999),true);
  for(let time=1.1;time<=15;time+=.1)shield.input(true,time);
  assert.equal(shield.active(4),false);assert.equal(shield.activations,1);
});
test('shield cannot reactivate before 10s and needs a fresh press',()=>{
  const shield=new Shield();shield.input(true,0);shield.input(false,1);
  assert.equal(shield.input(true,9.999),false);
  assert.equal(shield.input(true,10.1),false);
  shield.input(false,10.2);assert.equal(shield.input(true,10.3),true);
});
test('baseline has no shield',()=>{
  const shield=new Shield(false);assert.equal(shield.input(true,1),false);assert.equal(shield.active(1),false);
});
test('gesture is debounced; brief uncertain frames do not retrigger',()=>{
  const latch=new GestureLatch();assert.equal(latch.update('Open_Palm',.9,100),false);
  assert.equal(latch.update('Open_Palm',.9,261),true);
  assert.equal(latch.update('None',0,300),true);
  assert.equal(latch.update('Open_Palm',.9,350),true);
  latch.update('Closed_Fist',.9,500);assert.equal(latch.update('Closed_Fist',.9,721),false);
  latch.reset();assert.equal(latch.update('Open_Palm',.4,2000),false);
});
test('collision consumes one life, then grace period protects from double hit',()=>{
  const g=new Game();g.nextRock=g.nextCoin=Infinity;
  const rock=()=>({x:500,y:545,r:25,speed:0,angle:0,spin:0});
  g.obstacles=[rock(),rock()];g.update(.01);
  assert.equal(g.lives,2);g.update(.01);assert.equal(g.lives,2);
});
test('shield blocks collision and earns 25 points',()=>{
  const g=new Game();g.nextRock=g.nextCoin=Infinity;
  g.obstacles=[{x:500,y:545,r:25,speed:0,angle:0,spin:0}];
  g.update(.01,{shield:true});assert.equal(g.lives,3);assert.equal(g.blocks,1);assert.equal(g.score,25);
});
test('game ends after 60 active seconds and never accepts further input',()=>{
  const g=new Game();g.nextRock=g.nextCoin=Infinity;
  for(let i=0;i<1300;i++)g.update(.05);
  assert.equal(g.time,60);assert.equal(g.won,true);assert.equal(g.ended,true);
  const score=g.score;g.update(.05,{axis:1,shield:true});assert.equal(g.score,score);
});
test('pause by not advancing simulation also freezes shield cooldown',()=>{
  const g=new Game();g.update(.01,{shield:true});
  const before=g.shield.cooldown(g.time);
  assert.equal(g.shield.cooldown(g.time),before);
  g.update(.01,{shield:false});assert.ok(g.shield.cooldown(g.time)<before);
});
test('player stays within bounds; repeated seeded run is deterministic',()=>{
  const a=new Game({random:seededRandom(9)}),b=new Game({random:seededRandom(9)});
  for(let i=0;i<700;i++){a.update(.016,{axis:1});b.update(.016,{axis:1});}
  assert.ok(a.player.x<=965);assert.deepEqual(a.obstacles,b.obstacles);assert.equal(a.score,b.score);
});
