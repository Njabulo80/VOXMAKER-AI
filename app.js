'use strict';
const $=id=>document.getElementById(id);
const DB='voxmaker-local',STORE='takes';let db,recorder,stream,chunks=[],started=0,clock,playUrl=null,lastBlob=null,lastAnalysis=null,ctx=null,analyser=null,raf=0;
const fmt=ms=>{const s=Math.floor(ms/1000);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
const slug=s=>(s||'untitled-song').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'untitled-song';
function openDB(){return new Promise((ok,no)=>{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains(STORE)){const st=q.result.createObjectStore(STORE,{keyPath:'id'});st.createIndex('createdAt','createdAt')}};q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})}
function saveTake(t){return new Promise((ok,no)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(t);tx.oncomplete=ok;tx.onerror=()=>no(tx.error)})}
function allTakes(){return new Promise((ok,no)=>{const q=db.transaction(STORE).objectStore(STORE).getAll();q.onsuccess=()=>ok(q.result.sort((a,b)=>b.createdAt-a.createdAt));q.onerror=()=>no(q.error)})}
function removeTake(id){return new Promise((ok,no)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id);tx.oncomplete=ok;tx.onerror=()=>no(tx.error)})}
function draw(data){const c=$('waveform'),g=c.getContext('2d'),w=c.width=Math.max(320,c.clientWidth*devicePixelRatio),h=c.height=100;g.clearRect(0,0,w,h);g.strokeStyle='#5ce1bd';g.lineWidth=2;g.beginPath();for(let x=0;x<w;x++){const y=h/2+(data[Math.floor(x/w*data.length)]||0)*h*.43;x?g.lineTo(x,y):g.moveTo(x,y)}g.stroke();g.strokeStyle='#293750';g.beginPath();g.moveTo(0,h/2);g.lineTo(w,h/2);g.stroke()}
function animate(){if(!analyser)return;const a=new Uint8Array(analyser.fftSize);analyser.getByteTimeDomainData(a);draw(Array.from(a,v=>(v-128)/128));raf=requestAnimationFrame(animate)}
function stopVisual(){cancelAnimationFrame(raf);if(ctx){ctx.close().catch(()=>{});ctx=null}analyser=null}
function note(hz){if(!hz)return'—';const n=Math.round(69+12*Math.log2(hz/440)),names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];return names[(n%12+12)%12]+(Math.floor(n/12)-1)}
function pitch(frame,sr){const stride=4,nSamples=Math.floor(frame.length/stride),rate=sr/stride;let energy=0;for(let i=0;i<nSamples;i++){const x=frame[i*stride];energy+=x*x}if(Math.sqrt(energy/nSamples)<.012)return null;let best=0,score=0;for(let lag=Math.floor(rate/1000);lag<=Math.min(Math.floor(rate/65),nSamples/2);lag++){let sum=0,n=nSamples-lag;for(let i=0;i<n;i++)sum+=frame[i*stride]*frame[(i+lag)*stride];sum/=n;if(sum>score){score=sum;best=lag}}const hz=rate/best;return best&&score>.35&&hz>=65&&hz<=1000?hz:null}
function estimateTempo(samples, sampleRate){
 const step=Math.max(1,Math.floor(sampleRate*.02)), envelope=[];
 for(let i=0;i+step<samples.length;i+=step){let sum=0;for(let j=0;j<step;j++)sum+=samples[i+j]*samples[i+j];envelope.push(Math.sqrt(sum/step))}
 if(envelope.length<100)return {bpm:null,confidence:0};
 const sorted=[...envelope].sort((a,b)=>a-b),floor=sorted[Math.floor(sorted.length*.5)],peak=sorted[Math.floor(sorted.length*.85)];
 const threshold=floor+(peak-floor)*.38, peaks=[], refractory=8;
 for(let i=2;i<envelope.length-2;i++){
  if(envelope[i]>threshold&&envelope[i]>=envelope[i-1]&&envelope[i]>envelope[i+1]&&(!peaks.length||i-peaks[peaks.length-1]>=refractory))peaks.push(i);
 }
 const intervals=[];for(let i=1;i<peaks.length;i++){const ms=(peaks[i]-peaks[i-1])*20;if(ms>=333&&ms<=1500)intervals.push(ms)}
 if(intervals.length<3)return {bpm:null,confidence:0};
 const s=[...intervals].sort((a,b)=>a-b),med=s[Math.floor(s.length/2)],bpm=Math.round(60000/med);
 const deviations=intervals.map(x=>Math.abs(x-med)/med),consistency=1-Math.min(1,deviations.reduce((a,b)=>a+b,0)/deviations.length);
 const confidence=Math.round(Math.min(1,intervals.length/10)*consistency*100);
 return bpm>=40&&bpm<=200?{bpm,confidence}:{bpm:null,confidence:0};
}
async function analyse(blob){
 $('analysisStatus').textContent='Analysing melody and rhythm locally…';
 try{
  const C=window.AudioContext||window.webkitAudioContext;if(!C)throw Error('Audio analysis is not supported here.');
  const c=new C(),a=await c.decodeAudioData(await blob.arrayBuffer()),d=a.getChannelData(0),frame=Math.floor(a.sampleRate*.04),hop=Math.floor(a.sampleRate*.08),p=[];
  for(let i=0;i+frame<d.length;i+=hop){const hz=pitch(d.slice(i,i+frame),a.sampleRate);if(hz)p.push(hz)}
  const tempo=estimateTempo(d,a.sampleRate),coverage=Math.round(p.length/Math.max(1,Math.floor((d.length-frame)/hop))*100);
  await c.close();
  if(!p.length){
   $('pitchValue').textContent='Not detected';$('noteValue').textContent='—';$('rangeValue').textContent='—';$('framesValue').textContent='0';$('tempoValue').textContent=tempo.bpm?tempo.bpm+' BPM':'Not clear';$('confidenceValue').textContent='Low';
   $('analysisStatus').textContent='No stable pitched section found. Try a sustained sung note or hum.';return null
  }
  const s=[...p].sort((x,y)=>x-y),mid=s[Math.floor(s.length/2)],lo=s[Math.floor(s.length*.1)],hi=s[Math.floor(s.length*.9)];
  const result={medianHz:Math.round(mid*10)/10,medianNote:note(mid),lowNote:note(lo),highNote:note(hi),voicedFrames:p.length,pitchCoverage:coverage,estimatedTempo:tempo.bpm,tempoConfidence:tempo.confidence};
  lastAnalysis=result;$('arrangeBtn').disabled=false;
  $('pitchValue').textContent=Math.round(mid)+' Hz';$('noteValue').textContent=result.medianNote;$('rangeValue').textContent=result.lowNote+' – '+result.highNote;$('framesValue').textContent=String(p.length);
  $('tempoValue').textContent=tempo.bpm?tempo.bpm+' BPM':'Not clear';$('confidenceValue').textContent=coverage+'% voiced';
  $('analysisStatus').textContent='Pitch and rhythm estimates are experimental. Tempo follows vocal energy peaks and may not match the intended beat.';
  return result
 }catch(e){$('analysisStatus').textContent=e.message;return null}
}
function setPlayback(blob){if(playUrl)URL.revokeObjectURL(playUrl);playUrl=URL.createObjectURL(blob);$('playback').src=playUrl;$('playback').hidden=false;lastBlob=blob;$('wavBtn').disabled=false;$('download').href=playUrl;$('download').download=slug($('songTitle').value)+(blob.type.includes('mp4')?'.m4a':'.webm');$('download').hidden=false;$('download').textContent='Download original recording'}
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500)}
async function wav(blob,name){try{$('recordStatus').textContent='Preparing WAV export…';const C=window.AudioContext||window.webkitAudioContext;if(!C)throw Error('WAV conversion is unavailable.');const c=new C(),a=await c.decodeAudioData(await blob.arrayBuffer()),channels=Math.min(2,a.numberOfChannels),len=a.length,rate=a.sampleRate,size=44+len*channels*2,b=new ArrayBuffer(size),v=new DataView(b),write=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};write(0,'RIFF');v.setUint32(4,size-8,true);write(8,'WAVE');write(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,rate,true);v.setUint32(28,rate*channels*2,true);v.setUint16(32,channels*2,true);v.setUint16(34,16,true);write(36,'data');v.setUint32(40,len*channels*2,true);const ch=Array.from({length:channels},(_,i)=>a.getChannelData(i));let o=44;for(let i=0;i<len;i++)for(let k=0;k<channels;k++){const x=Math.max(-1,Math.min(1,ch[k][i]));v.setInt16(o,x<0?x*32768:x*32767,true);o+=2}await c.close();download(new Blob([b],{type:'audio/wav'}),name);$('recordStatus').textContent='WAV export ready.'}catch(e){$('recordStatus').textContent=e.message||'WAV export failed; original audio remains available.'}}

function writeWav(buffer){
 const channels=Math.min(2,buffer.numberOfChannels),len=buffer.length,rate=buffer.sampleRate,size=44+len*channels*2,b=new ArrayBuffer(size),v=new DataView(b);
 const write=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
 write(0,'RIFF');v.setUint32(4,size-8,true);write(8,'WAVE');write(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,rate,true);v.setUint32(28,rate*channels*2,true);v.setUint16(32,channels*2,true);v.setUint16(34,16,true);write(36,'data');v.setUint32(40,len*channels*2,true);
 const data=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));let o=44;
 for(let i=0;i<len;i++)for(let k=0;k<channels;k++){const x=Math.max(-1,Math.min(1,data[k][i]));v.setInt16(o,x<0?x*32768:x*32767,true);o+=2}
 return new Blob([b],{type:'audio/wav'})
}
function addTone(out,frequency,start,duration,volume,wave){
 if(start>=out.length/out.sampleRate)return;
 const osc=out.createOscillator(),gain=out.createGain(),t=Math.max(0,start),end=Math.min(out.length/out.sampleRate,t+duration);
 osc.type=wave;osc.frequency.value=frequency;gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),t+.025);gain.gain.exponentialRampToValueAtTime(.0001,Math.max(t+.03,end));osc.connect(gain);gain.connect(out);osc.start(t);osc.stop(Math.max(t+.04,end))
}
async function buildBacking(){
 if(!lastBlob)return;
 const button=$('arrangeBtn');button.disabled=true;$('recordStatus').textContent='Building a local backing sketch around your vocal…';
 try{
  const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!Offline)throw Error('Audio rendering is not supported in this browser.');
  const AC=window.AudioContext||window.webkitAudioContext,live=new AC(),voice=await live.decodeAudioData(await lastBlob.arrayBuffer());await live.close();
  const bpm=lastAnalysis&&lastAnalysis.estimatedTempo?lastAnalysis.estimatedTempo:90,beat=60/Math.max(55,Math.min(180,bpm)),duration=voice.duration,rate=voice.sampleRate,frames=Math.ceil(duration*rate),out=new Offline(2,frames,rate);
  const vocal=out.createBufferSource(),voiceGain=out.createGain();vocal.buffer=voice;voiceGain.gain.value=.92;vocal.connect(voiceGain);voiceGain.connect(out.destination);vocal.start(0);
  const midi=lastAnalysis&&lastAnalysis.medianHz?Math.round(69+12*Math.log2(lastAnalysis.medianHz/440)):60,root=midi%12,progression=[[0,4,7],[7,11,14],[9,12,16],[5,9,12]],bars=Math.ceil(duration/(beat*4));
  const freq=n=>440*Math.pow(2,(n-69)/12);
  for(let bar=0;bar<bars;bar++){
   const chord=progression[bar%4],start=bar*beat*4;
   chord.forEach((iv,i)=>{const n=48+root+iv,remaining=duration-start;addTone(out,freq(n),start,Math.min(beat*3.8,remaining),i===0 ? .045 : .027,'sine');addTone(out,freq(n+12),start,Math.min(beat*3.8,remaining),.018,'triangle')});
   addTone(out,freq(36+root+chord[0]),start,Math.min(beat*1.8,duration-start),.075,'sine');
   for(let b=0;b<4;b++){const t=start+b*beat;if(t>=duration)break;if(b===0||b===2)addTone(out,55,t,.12,.12,'sine');else addTone(out,180,t,.09,.035,'triangle');for(let e=0;e<2;e++){const ht=t+e*beat/2;if(ht<duration)addTone(out,7000,ht,.025,.009,'square')}}
  }
  const rendered=await out.startRendering(),blob=writeWav(rendered);setPlayback(blob);download(blob,slug($('songTitle').value)+'-backing-sketch.wav');$('recordStatus').textContent='Backing sketch rendered and mixed with your original vocal. This is a simple local demo arrangement, not AI-generated instruments.';$('wavBtn').disabled=false;
 }catch(e){$('recordStatus').textContent='Could not build backing sketch: '+e.message}
 finally{button.disabled=false}
}

async function library(){const list=await allTakes();$('takeCount').textContent=list.length+' TAKE'+(list.length===1?'':'S');const root=$('projectList');root.replaceChildren();if(!list.length){const p=document.createElement('p');p.className='empty';p.textContent='Your saved recordings will appear here.';root.append(p);return}for(const t of list){const card=document.createElement('article');card.className='take';const h=document.createElement('h3');h.textContent=t.title;const meta=document.createElement('div');meta.className='take-meta';meta.textContent=t.genre+' · '+fmt(t.durationMs)+' · '+new Date(t.createdAt).toLocaleString();card.append(h,meta);if(t.analysis){const p=document.createElement('p');p.className='take-meta';p.textContent='Pitch estimate: '+t.analysis.medianNote+' ('+t.analysis.medianHz+' Hz)';card.append(p)}const actions=document.createElement('div');actions.className='take-actions';const add=(label,cls,fn)=>{const b=document.createElement('button');b.textContent=label;b.className=cls;b.addEventListener('click',fn);actions.append(b)};add('Play','',()=>{setPlayback(t.blob);$('playback').play().catch(()=>{})});add('Download','secondary',()=>download(t.blob,slug(t.title)+(t.blob.type.includes('mp4')?'.m4a':'.webm')));add('WAV','secondary',()=>wav(t.blob,slug(t.title)+'.wav'));add('Delete','danger',async()=>{if(confirm('Delete this saved take from this device?')){await removeTake(t.id);await library()}});card.append(actions);root.append(card)}}
$('recordBtn').addEventListener('click',async()=>{if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){$('recordStatus').textContent='Recording is not supported. Try updated Chrome over HTTPS.';return}try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});ctx=new(window.AudioContext||window.webkitAudioContext)();const src=ctx.createMediaStreamSource(stream);analyser=ctx.createAnalyser();analyser.fftSize=1024;src.connect(analyser);animate();const type=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(x=>MediaRecorder.isTypeSupported(x));recorder=new MediaRecorder(stream,type?{mimeType:type}:undefined);chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onstop=async()=>{stopVisual();const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'}),durationMs=Date.now()-started;setPlayback(blob);const take={id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),title:$('songTitle').value.trim()||'Untitled song',genre:$('genre').value,idea:$('idea').value.trim(),createdAt:Date.now(),durationMs,blob,analysis:null};try{take.analysis=await analyse(blob);await saveTake(take);await library();$('recordStatus').textContent='Take saved on this device. Your original vocal was not uploaded or replaced.'}catch(e){$('recordStatus').textContent='Recording captured, but saving failed: '+e.message+' Download a backup.'}stream?.getTracks().forEach(t=>t.stop());stream=null;$('recordBtn').disabled=false};recorder.start(250);started=Date.now();$('timer').textContent='00:00';clock=setInterval(()=>$('timer').textContent=fmt(Date.now()-started),250);$('recordBtn').disabled=true;$('stopBtn').disabled=false;$('wavBtn').disabled=true;$('recordStatus').textContent='Recording your original voice… sing or hum naturally.'}catch(e){stopVisual();stream?.getTracks().forEach(t=>t.stop());stream=null;$('recordStatus').textContent=e.name==='NotAllowedError'?'Microphone permission denied. Allow access and try again.':'Could not start recording. Check microphone permission.'}});
$('stopBtn').addEventListener('click',()=>{if(recorder&&recorder.state!=='inactive')recorder.stop();clearInterval(clock);$('timer').textContent=fmt(Date.now()-started);$('stopBtn').disabled=true;$('recordStatus').textContent='Finishing and analysing your take…'});
$('wavBtn').addEventListener('click',()=>{if(lastBlob)wav(lastBlob,slug($('songTitle').value)+'.wav')});
$('arrangeBtn').addEventListener('click',buildBacking);
window.addEventListener('beforeunload',()=>{if(playUrl)URL.revokeObjectURL(playUrl);stream?.getTracks().forEach(t=>t.stop());stopVisual()});
(async()=>{try{db=await openDB();await library()}catch(e){$('recordStatus').textContent='Local project storage is unavailable. You can still record and download a copy.'}})();
if('serviceWorker'in navigator&&location.protocol!=='file:')addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
