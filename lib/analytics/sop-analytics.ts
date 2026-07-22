import { migrateSopSnapshot, sopSchema, type Sop } from "@/lib/sop-schema";
import { detectSopRisks, type SopSignals } from "@/lib/analytics/risk-detector";
import type { SopAnalytics, SopRiskLevel } from "@/types/sop-analytics";

const matches=(text:string,terms:RegExp)=>terms.test(text);
const bounded=(n:number)=>Math.max(0,Math.min(100,Math.round(n)));
const words=(value:string)=>value.trim().split(/\s+/).filter(Boolean).length;

export function sopFingerprint(value: unknown): string {
  const input=JSON.stringify(value)??"";let hash=2166136261;
  for(let i=0;i<input.length;i++){hash^=input.charCodeAt(i);hash=Math.imul(hash,16777619)}
  return (hash>>>0).toString(16).padStart(8,"0");
}

export function analyzeSop(value: unknown, analyzedAt=new Date().toISOString()): SopAnalytics {
  const parsed=sopSchema.safeParse(migrateSopSnapshot(value));
  if(!parsed.success)return invalidAnalytics(value,analyzedAt);
  const sop=parsed.data;const all=flattenSop(sop);const assumptions=sop.knowledgeSources.sourceNotes.importantAssumptions.join(" ");
  const processOwner=sop.roles.some(x=>matches(`${x.role} ${x.responsibility}`,/process owner|accountable|owns (?:the )?process|maintains (?:the )?sop/i));
  const trigger=words(sop.agentReadyJson.trigger)>=2||matches(all,/\b(trigger|starts? when|initiated when|upon receipt|when .* received)\b/i);
  const approval=matches(all,/\b(approv(?:al|e[ds]?)|authori[sz]ation|sign[ -]?off|decision authority)\b/i);
  const escalation=sop.escalationRules.length>0&&sop.escalationRules.some(x=>words(x)>=5);
  const exceptions=matches(all,/\b(exception|deviation|failure|reject(?:ed|ion)?|unable to|contingency|fallback)\b/i);
  const successCriteria=sop.agentReadyJson.completionCriteria.length>0&&sop.agentReadyJson.completionCriteria.some(x=>words(x)>=4);
  const kpis=matches(all,/\b(KPI|key performance|metric|target rate|service level|cycle time|accuracy rate|within \d+)\b/i);
  const compliance=matches(all,/\b(compliance|regulat|policy|legal|audit|standard|privacy|safety requirement)\b/i);
  const retention=matches(all,/\b(retain|retention|archive for|records? (?:must|shall|are) (?:be )?(?:kept|stored)|storage period)\b/i);
  const checklist=sop.qualityChecklist.length>=3&&sop.qualityChecklist.every(x=>words(x)>=3);
  const training=sop.trainingQuiz.length>=2&&sop.trainingQuiz.every(x=>x.options.length>=2&&x.options.includes(x.correctAnswer));
  const grounded=sop.knowledgeSources.documentNames.length>0&&sop.knowledgeSources.sourceNotes.documentsUsed.length>0;
  const vagueStepCount=sop.procedureSteps.filter(x=>words(x.instruction)<8||words(x.owner)<1||words(x.evidence)<2||matches(x.instruction,/\b(as needed|appropriate|properly|handle|process it|etc\.?|regularly)\b/i)).length;
  const unsupportedAssumptions=!grounded&&assumptions.length>0&&matches(assumptions,/\b(company|organization|internal|policy|must|required|approval limit)\b/i);
  const signals:SopSignals={valid:true,processOwner,trigger,approval,escalation,exceptions,successCriteria,kpis,compliance,retention,checklist,training,unsupportedAssumptions,grounded,procedureCount:sop.procedureSteps.length,vagueStepCount};
  const completeness=bounded(([sop.purpose,sop.scope].filter(x=>words(x)>=8).length/2)*20+(sop.roles.length>=2?15:sop.roles.length*7)+(sop.prerequisites.length>=2?10:sop.prerequisites.length*5)+(sop.procedureSteps.length>=5?25:sop.procedureSteps.length*5)+(escalation?10:0)+(checklist?10:0)+(training?10:0));
  const clarity=bounded((words(sop.purpose)>=10?15:8)+(words(sop.scope)>=10?15:8)+(sop.procedureSteps.length?40-(vagueStepCount/sop.procedureSteps.length)*40:0)+(sop.procedureSteps.every(x=>words(x.owner)>0)?15:0)+(sop.procedureSteps.every(x=>words(x.evidence)>=2)?15:0));
  const procedureStrength=bounded(Math.min(35,sop.procedureSteps.length*7)+(trigger?15:0)+(successCriteria?15:0)+(exceptions?10:0)+(approval?10:0)+(vagueStepCount===0?15:Math.max(0,15-vagueStepCount*5)));
  const controlStrength=bounded((approval?20:0)+(escalation?20:0)+(checklist?20:0)+(successCriteria?15:0)+(kpis?15:0)+(retention?10:0));
  const complianceReadiness=bounded((compliance?45:10)+(retention?25:0)+(approval?15:0)+(sop.knowledgeSources.sourceNotes.importantAssumptions.length===0?15:5));
  const trainingReadiness=bounded((training?60:Math.min(30,sop.trainingQuiz.length*15))+(checklist?20:0)+(sop.roles.length>=2?10:0)+(successCriteria?10:0));
  const knowledgeGrounding=bounded(grounded?55+Math.min(25,sop.knowledgeSources.documentNames.length*10)+(sop.knowledgeSources.sourceNotes.missingInformation.length===0?10:0)+(sop.knowledgeSources.sourceNotes.importantAssumptions.length===0?10:0):sop.knowledgeSources.sourceNotes.generalBestPracticesAdded?15:5);
  const scores={completeness,clarity,procedureStrength,controlStrength,complianceReadiness,trainingReadiness,knowledgeGrounding};
  const overallQuality=bounded(completeness*.2+clarity*.15+procedureStrength*.2+controlStrength*.18+complianceReadiness*.1+trainingReadiness*.1+knowledgeGrounding*.07);
  const findings=detectSopRisks(signals);const riskLevel=calculateRiskLevel(findings.map(x=>x.severity),overallQuality);
  const badges:SopAnalytics["badges"]=[];
  if(sop.documentReadinessScore>sop.inputReadinessScore)badges.push("AI Enhanced");if(grounded)badges.push("Knowledge Grounded");if(riskLevel==="critical"||riskLevel==="high")badges.push("High Risk");if(overallQuality<75||findings.some(x=>["critical","high"].includes(x.severity)))badges.push("Needs Review");if(overallQuality>=80&&controlStrength>=75&&procedureStrength>=75&&!findings.some(x=>["critical","high"].includes(x.severity)))badges.push("Operationally Ready");if(trainingReadiness>=80)badges.push("Training Ready");
  return{schemaVersion:"1.0",fingerprint:sopFingerprint(sop),analyzedAt,overallQuality,riskLevel,scores,findings,badges};
}

function flattenSop(s:Sop){return [s.purpose,s.scope,...s.roles.flatMap(x=>[x.role,x.responsibility]),...s.prerequisites,...s.procedureSteps.flatMap(x=>[x.title,x.instruction,x.owner,x.evidence]),...s.escalationRules,...s.qualityChecklist,...s.trainingQuiz.flatMap(x=>[x.question,...x.options,x.correctAnswer]),s.agentReadyJson.trigger,...s.agentReadyJson.completionCriteria,...s.agentReadyJson.requiredInputs,...s.knowledgeSources.sourceNotes.importantAssumptions,...s.knowledgeSources.sourceNotes.missingInformation].join(" ")}
function calculateRiskLevel(severities:string[],score:number):SopRiskLevel{if(severities.includes("critical"))return"critical";const highs=severities.filter(x=>x==="high").length;if(highs>=2||score<40)return"high";if(highs||severities.includes("medium")||score<75)return"medium";return"low"}
function invalidAnalytics(value:unknown,analyzedAt:string):SopAnalytics{const signals:SopSignals={valid:false,processOwner:false,trigger:false,approval:false,escalation:false,exceptions:false,successCriteria:false,kpis:false,compliance:false,retention:false,checklist:false,training:false,unsupportedAssumptions:false,grounded:false,procedureCount:0,vagueStepCount:0};return{schemaVersion:"1.0",fingerprint:sopFingerprint(value),analyzedAt,overallQuality:0,riskLevel:"critical",scores:{completeness:0,clarity:0,procedureStrength:0,controlStrength:0,complianceReadiness:0,trainingReadiness:0,knowledgeGrounding:0},findings:detectSopRisks(signals),badges:["High Risk","Needs Review"]}}
