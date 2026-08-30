// ===== 程序化音效（Web Audio 合成，无需外部文件）=====
const AC = new (window.AudioContext||window.webkitAudioContext)();
function tone(f,dur,type,vol,slide){ if(AC.state==='suspended')AC.resume(); const o=AC.createOscillator(),g=AC.createGain(); o.type=type||'sine'; o.frequency.setValueAtTime(f,AC.currentTime); if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(20,f+slide),AC.currentTime+dur); g.gain.setValueAtTime(vol||0.12,AC.currentTime); g.gain.exponentialRampToValueAtTime(0.0001,AC.currentTime+dur); o.connect(g).connect(AC.destination); o.start(); o.stop(AC.currentTime+dur); }
function noise(dur,vol){ const n=Math.floor(AC.sampleRate*dur), b=AC.createBuffer(1,n,AC.sampleRate), d=b.getChannelData(0); for(let i=0;i<n;i++) d[i]=Math.random()*2-1; const s=AC.createBufferSource(), g=AC.createGain(); s.buffer=b; g.gain.setValueAtTime(vol||0.12,AC.currentTime); g.gain.exponentialRampToValueAtTime(0.0001,AC.currentTime+dur); s.connect(g).connect(AC.destination); s.start(); }
const Sfx = {
  click(){ tone(600,0.05,'square',0.06); },
  select(){ tone(440,0.08,'sine',0.1,80); },
  spawn(){ tone(300,0.14,'sine',0.1,120); },
  shoot(){ tone(880,0.05,'square',0.05,-400); },
  hit(){ noise(0.08,0.1); },
  tree(){ tone(150,0.24,'sine',0.14,-40); tone(75,0.3,'sine',0.08,-20); },
  flower(){ [660,990].forEach(f=>tone(f,0.09,'triangle',0.1,150)); },
  capture(){ [523,659,784].forEach((f,i)=>setTimeout(()=>tone(f,0.15,'sine',0.14),i*70)); },
  lose(){ tone(200,0.7,'sawtooth',0.12,-140); },
  win(){ [523,659,784,1046].forEach((f,i)=>setTimeout(()=>tone(f,0.18,'sine',0.15),i*90)); },
  error(){ tone(180,0.12,'square',0.08,-40); },
};
function startAmbient(){ if(AC.state==='suspended')AC.resume(); const g=AC.createGain(); g.gain.value=0.035; g.connect(AC.destination);
  [55,82.4,110,164.8].forEach(f=>{ const o=AC.createOscillator(); o.type='sine'; o.frequency.value=f; const lfo=AC.createOscillator(); lfo.type='sine'; lfo.frequency.value=0.04+Math.random()*0.06; const lg=AC.createGain(); lg.gain.value=0.01; lfo.connect(lg).connect(g.gain); o.connect(g); o.start(); lfo.start(); });
}
