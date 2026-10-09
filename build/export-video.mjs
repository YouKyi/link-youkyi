// Réception locale des images du tuner, encodage à cadence fixe par FFmpeg.
// node build/export-video.mjs ; puis suivre la procédure du README.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const directory=resolve('assets/video');
mkdirSync(directory,{recursive:true});
const names=new Set(['landscape','portrait']);
const origins=new Set(['http://127.0.0.1:4197','http://127.0.0.1:4198']);
let job;
const server=createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(!origins.has(origin)){res.writeHead(403);res.end();return;}
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  if(req.method!=='POST'){res.writeHead(405);res.end();return;}
  const [,action,name]=req.url.split('/');
  try{
    if(!names.has(name))throw new Error('Format inconnu');
    if(action==='start'){
      if(job)throw new Error('Un export est déjà actif');
      const output=resolve(directory,`datacenter-${name}.mp4`);
      const encoder=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','30','-vcodec','png','-i','pipe:0',
        '-an','-vf','scale=out_color_matrix=bt709:out_range=tv','-c:v','libx264','-preset','slow','-crf','25','-pix_fmt','yuv420p',
        '-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-movflags','+faststart',output],{stdio:['pipe','ignore','pipe']});
      const current=job={name,encoder,frames:0,error:null};
      encoder.stderr.on('data',data=>process.stderr.write(data));
      encoder.on('error',error=>{current.error=error;});
      encoder.stdin.on('error',error=>{current.error=error;});
      current.done=new Promise(resolve=>encoder.once('close',code=>resolve(code)));
      console.log(`Début ${name}`);
    }else if(action==='frame'){
      if(!job||job.name!==name||job.error)throw job?.error||new Error('Export absent');
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>16*1024*1024)throw new Error('Image trop volumineuse');chunks.push(chunk);}
      const image=Buffer.concat(chunks);
      if(!image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error('PNG attendu');
      const [width,height]=name==='landscape'?[1920,1080]:[720,1280];
      if(image.length<24||image.readUInt32BE(16)!==width||image.readUInt32BE(20)!==height)throw new Error('Dimensions PNG incorrectes');
      if(job.frames>=540)throw new Error('540 images maximum');
      if(job.frames===0)writeFileSync(resolve(directory,`${name}-first.png`),image);
      if(job.frames===539)writeFileSync(resolve(directory,`${name}-last.png`),image);
      if(!job.encoder.stdin.write(image))await once(job.encoder.stdin,'drain');
      job.frames++;
      if(job.frames%90===0)console.log(`${name}: ${job.frames}/540 images`);
    }else if(action==='finish'){
      if(!job||job.name!==name)throw new Error('Export absent');
      if(job.frames!==540)throw new Error('540 images attendues');
      const current=job;current.encoder.stdin.end();const code=await current.done;job=null;
      if(code!==0||current.error)throw current.error||new Error(`FFmpeg : ${code}`);
      console.log(`Terminé ${name}: ${current.frames} images`);
    }else throw new Error('Action inconnue');
    res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true}');
  }catch(error){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:String(error)}));}
});
server.listen(4200,'127.0.0.1',()=>console.log('Export vidéo : http://127.0.0.1:4200 (boucle locale uniquement)'));
process.on('SIGINT',()=>{job?.encoder.kill('SIGTERM');server.close(()=>process.exit());});
