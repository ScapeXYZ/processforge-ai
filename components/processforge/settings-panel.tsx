"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, LogOut, Save } from "lucide-react";
import { WorkspaceHeader } from "@/components/processforge/workspace-header";
import { LocalMigration } from "@/components/processforge/local-migration";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportAccountData } from "@/lib/cloud/account-export";
import { fetchProfile, updateProfile } from "@/lib/cloud/profile-service";

export function SettingsPanel(){
 const [name,setName]=useState("");const [email,setEmail]=useState("");const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [error,setError]=useState("");
 useEffect(()=>{void fetchProfile().then(result=>{if(result.ok){setName(result.data.displayName??"");setEmail(result.data.email)}else setError(result.error.message)})},[]);
 async function save(){setBusy(true);setMessage("");setError("");const result=await updateProfile(name);if(result.ok)setMessage("Profile saved.");else setError(result.error.message);setBusy(false)}
 async function download(){setBusy(true);const result=await exportAccountData();if(!result.ok)setError(result.error.message);else{const url=URL.createObjectURL(new Blob([JSON.stringify(result.data,null,2)],{type:"application/json"}));const anchor=document.createElement("a");anchor.href=url;anchor.download="processforge-account-data.json";anchor.click();URL.revokeObjectURL(url)}setBusy(false)}
 return <main className="min-h-screen bg-background"><WorkspaceHeader/><div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6"><div><h1 className="text-2xl font-semibold">Settings</h1><p className="mt-1 text-sm text-muted-foreground">Manage your profile, security, and portable account data.</p></div><LocalMigration/><section className="rounded-xl border border-border bg-card/40 p-5"><h2 className="font-medium">Profile</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-xs text-muted-foreground">Display name<Input className="mt-1.5" value={name} maxLength={80} onChange={event=>setName(event.target.value)}/></label><label className="text-xs text-muted-foreground">Account email<Input className="mt-1.5" value={email} disabled/></label></div>{message&&<p className="mt-3 text-sm text-emerald-300">{message}</p>}{error&&<p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}<Button className="mt-4" onClick={()=>void save()} disabled={busy}><Save/>Save profile</Button></section><section className="rounded-xl border border-border bg-card/40 p-5"><h2 className="font-medium">Account and data</h2><p className="mt-1 text-sm text-muted-foreground">Exports contain your profile, SOPs, versions, and knowledge metadata—never authentication tokens or local extracted document text.</p><div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={()=>void download()} disabled={busy}><Download/>Export account data</Button><Link className={buttonVariants({variant:"outline"})} href="/forgot-password">Reset password</Link><form action="/auth/signout" method="post"><Button variant="destructive" type="submit"><LogOut/>Sign out</Button></form></div></section></div></main>
}
