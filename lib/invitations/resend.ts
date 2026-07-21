import { Resend } from "resend";
import { buildInvitationEmail } from "@/lib/invitations/email";

type SendInput={to:string;workspaceName:string;inviterName:string;role:string;expiresAt:string;acceptUrl:string;idempotencyKey:string};
type SendResult={ok:true;id:string}|{ok:false;message:string};

export async function sendInvitationEmail(input:SendInput):Promise<SendResult>{
  const apiKey=process.env.RESEND_API_KEY?.trim();
  const from=process.env.PROCESSFORGE_FROM_EMAIL?.trim();
  if(!apiKey||!from)return{ok:false,message:"Invitation email is not configured."};
  const content=buildInvitationEmail(input);
  try{
    const resend=new Resend(apiKey);
    const{data,error}=await resend.emails.send({from,to:[input.to],subject:content.subject,html:content.html,text:content.text,tags:[{name:"category",value:"workspace_invitation"}]},{idempotencyKey:input.idempotencyKey});
    if(error){if(process.env.NODE_ENV!=="production")console.error("[ProcessForge Resend]",{name:error.name,message:error.message});return{ok:false,message:"Email delivery failed. Check the sender configuration and retry."}}
    return{ok:true,id:data?.id??"unknown"};
  }catch(error){
    if(process.env.NODE_ENV!=="production")console.error("[ProcessForge Resend]",{name:error instanceof Error?error.name:"Error",message:error instanceof Error?error.message:"Provider error"});
    return{ok:false,message:"Email delivery failed. Check the connection and retry."};
  }
}
