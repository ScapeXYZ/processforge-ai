const KEY="processforge.compliance-ai-fix.v1";
export function queueComplianceAiFix(prompt:string){if(typeof window==="undefined")return;try{sessionStorage.setItem(KEY,prompt.slice(0,1000))}catch{/* Editor remains available for manual input. */}}
export function takeComplianceAiFix(){if(typeof window==="undefined")return null;try{const value=sessionStorage.getItem(KEY);sessionStorage.removeItem(KEY);return value}catch{return null}}
