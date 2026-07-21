import { Suspense } from "react";import { AcceptInvitation } from "@/components/processforge/accept-invitation";
export default function AcceptInvitationPage(){return <Suspense fallback={<div className="min-h-screen bg-background"/>}><AcceptInvitation/></Suspense>}
