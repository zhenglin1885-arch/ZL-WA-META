export async function runGroupSequence(targets,operation,onProgress=()=>{},wait=ms=>new Promise(r=>setTimeout(r,ms))){
 const results=[];
 for(let i=0;i<targets.length;i++){
  const target=targets[i];onProgress({phase:'running',index:i,total:targets.length,target});
  try{await operation(target);results.push({target,ok:true})}catch(e){results.push({target,ok:false,error:e.message||String(e)})}
  if(i<targets.length-1){onProgress({phase:'waiting',index:i,total:targets.length,target});await wait(3000)}
 }
 return results;
}
