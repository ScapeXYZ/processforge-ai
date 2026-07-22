import { analyzeSop } from "@/lib/analytics/sop-analytics";
import type { AnalyticsVersionComparison, AnalyticsScoreKey } from "@/types/sop-analytics";

const labels:Record<AnalyticsScoreKey,string>={completeness:"Completeness",clarity:"Clarity",procedureStrength:"Procedure",controlStrength:"Controls",complianceReadiness:"Compliance",trainingReadiness:"Training",knowledgeGrounding:"Knowledge grounding"};
export function compareSopAnalytics(before:unknown,after:unknown):AnalyticsVersionComparison{
  const a=analyzeSop(before,"1970-01-01T00:00:00.000Z"),b=analyzeSop(after,"1970-01-01T00:00:00.000Z");const beforeIds=new Set(a.findings.map(x=>x.id)),afterIds=new Set(b.findings.map(x=>x.id));
  const improvedSections:string[]=[],weakenedSections:string[]=[];
  (Object.keys(a.scores) as AnalyticsScoreKey[]).forEach(key=>{const delta=b.scores[key]-a.scores[key];if(delta>=5)improvedSections.push(labels[key]);if(delta<=-5)weakenedSections.push(labels[key])});
  return{scoreDelta:b.overallQuality-a.overallQuality,resolvedRisks:a.findings.filter(x=>!afterIds.has(x.id)).map(x=>({...x,resolved:true})),newRisks:b.findings.filter(x=>!beforeIds.has(x.id)),improvedSections,weakenedSections};
}
