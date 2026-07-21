import { createHash, randomBytes } from "node:crypto";
export function createInvitationToken(){const token=randomBytes(32).toString("base64url");return{token,hash:hashInvitationToken(token)}}
export function hashInvitationToken(token:string){return createHash("sha256").update(token,"utf8").digest("hex")}

