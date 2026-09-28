import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
// Usage: node scripts/revise-curated-narration.mjs <player-root> <review.json> <new-output-dir> <profile.json>
// This invokes the existing paid TTS service only for reviewed changed texts.
const library = fileURLToPath(new URL('../', import.meta.url));
const [player, planFile, output, profilePath] = process.argv.slice(2);
assert.ok(player && planFile && output && profilePath, 'Expected player-root, review, new-output-dir, profile');
const {buildCoursePack,validateCoursePackDirectory}=await import(pathToFileURL(join(library,'packages/course-pack/dist/src/index.js')));
const hash=x=>createHash('sha256').update(x).digest('hex');
const readJson=async p=>JSON.parse(await readFile(p,'utf8'));
const plan=await readJson(planFile), source=join(library,'courses',plan.packId);
const manifest=await readJson(join(source,'manifest.json'));
assert.equal(manifest.packId,plan.packId);
await mkdir(output); await cp(source,output,{recursive:true});
const authoring=await readJson(join(output,'course.authoring.json'));
for(const [key,text] of Object.entries(plan.edits)){
 const [step,beat]=key.split('/');
 const found=authoring.steps.find(s=>s.key===step)?.beats.find(b=>b.key===beat);
 assert.ok(found,`Missing beat ${key}`); assert.notEqual(found.say,text); found.say=text;
}
await writeFile(join(output,'course.authoring.json'),JSON.stringify(authoring,null,2)+'\n');
execFileSync('pnpm',['--dir',player,'oll:materialize','--','--authoring',join(output,'course.authoring.json'),'--output',join(output,manifest.entry),'--report',join(output,'compilation.json'),'--lesson-id',`${plan.packId}-${plan.version}`,'--board-id',plan.packId,'--base-revision','0','--region-intent','new_topic','--region-id',`${plan.packId}-${plan.version}-region`],{stdio:'inherit'});
const events=async root=>(await readFile(join(root,manifest.entry),'utf8')).trim().split(/\r?\n/).map(JSON.parse);
const narrations=ev=>ev.flatMap(e=>e.event==='lesson.step'?e.step.beats.filter(b=>b.narration?.text?.trim()).map(b=>({id:b.id,text:b.narration.text.trim()})):[]);
const old=narrations(await events(source)), next=narrations(await events(output));
assert.equal(old.length,next.length);
const changed=next.filter((b,i)=>b.text!==old[i].text);
assert.equal(changed.length,Object.keys(plan.edits).length);
for(const b of changed)assert.ok(Object.values(plan.edits).includes(b.text));
const profile=await readJson(profilePath), cloud=profile.config.tts_cloud, token=profile.config.env_vars.VOLC_TTS_TOKEN;
assert.ok(token&&!token.startsWith('keychain:')); assert.equal(cloud.voice,manifest.narration.voiceId);
let generated=0; const audit=[];
for(let i=0;i<next.length;i++){
 const b=next[i], before=manifest.narration.segments.find(s=>s.beatId===old[i].id);
 assert.ok(before);assert.equal(before.textSha256,hash(old[i].text));
 const segment={...before,beatId:b.id,textSha256:hash(b.text)};
 if(b.text!==old[i].text){
  const response=await fetch('https://openspeech.bytedance.com/api/v1/tts',{method:'POST',headers:{authorization:`Bearer;${token}`,'content-type':'application/json'},body:JSON.stringify({app:{appid:cloud.appid,token,cluster:cloud.cluster??'volcano_tts'},user:{uid:'octos-course-library-authoring'},audio:{voice_type:cloud.voice,encoding:'mp3',speed_ratio:1},request:{reqid:randomUUID(),text:b.text,operation:'query',text_type:'plain'}}),signal:AbortSignal.timeout(60000)});
  assert.equal(response.ok,true,`TTS HTTP ${response.status}`);
  const data=await response.json();assert.equal(data.code,3000,'TTS returned error');assert.ok(data.data);
  await writeFile(join(output,segment.file),Buffer.from(data.data,'base64'));
  segment.durationMs=Math.round(Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',join(output,segment.file)],{encoding:'utf8'}).trim())*1000);
  assert.ok(segment.durationMs>0);generated++;
 }else assert.equal(hash(await readFile(join(source,segment.file))),hash(await readFile(join(output,segment.file))));
 manifest.narration.segments[i]=segment;
 audit.push({beatId:b.id,file:segment.file,regenerated:b.text!==old[i].text,durationMs:segment.durationMs,textSha256:segment.textSha256});
 console.log(JSON.stringify({packId:plan.packId,completed:i+1,total:next.length,generated}));
}
manifest.version=plan.version;manifest.durationSeconds=Math.ceil(manifest.narration.segments.reduce((n,s)=>n+s.durationMs,0)/1000);
const report=await readJson(join(output,'compilation.json'));
manifest.minimumPlayerVersion=report.minimumPlayerVersion;manifest.requiredCapabilities=report.requiredCapabilities;manifest.compilation=report.compilation;
const notice=(await readFile(join(output,'NOTICE.txt'),'utf8')).trimEnd()+`\nNarration review: ${generated} spoken Chinese math clips revised (${plan.version}); other audio unchanged.\n`;
await writeFile(join(output,'NOTICE.txt'),notice);
if(!manifest.files.some(f=>f.path==='compilation.json'))manifest.files.push({path:'compilation.json',role:'asset',mediaType:'application/json'});
for(const file of manifest.files){const bytes=await readFile(join(output,file.path));file.bytes=bytes.length;file.sha256=hash(bytes);}
manifest.licenses[0].appliesTo=[...new Set([...manifest.licenses[0].appliesTo,'compilation.json'])];
await writeFile(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const validation=validateCoursePackDirectory(output);assert.equal(validation.valid,true,JSON.stringify(validation.issues));
const built=buildCoursePack(output,output+'.ocpack');
await writeFile(output+'-audit.json',JSON.stringify({packId:plan.packId,version:plan.version,generated,reused:next.length-generated,sha256:built.sha256,segments:audit},null,2)+'\n');
console.log(JSON.stringify({packId:plan.packId,version:plan.version,generated,sha256:built.sha256}));
