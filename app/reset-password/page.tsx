import { AuthCard } from "@/components/processforge/auth-card"; import { ResetPasswordForm } from "@/components/processforge/auth-fields";
export default function ResetPage() { return <AuthCard title="Choose a new password" description="Use a strong password you do not reuse elsewhere."><ResetPasswordForm /></AuthCard>; }

