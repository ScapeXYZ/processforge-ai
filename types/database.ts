import type { Json } from "@/types/json";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string | null; avatar_url: string | null; created_at: string; updated_at: string };
        Insert: { id: string; display_name?: string | null; avatar_url?: string | null; created_at?: string; updated_at?: string };
        Update: { display_name?: string | null; avatar_url?: string | null; updated_at?: string };
        Relationships: [];
      };
      sops: {
        Row: { id: string; user_id: string; workspace_id: string; title: string; industry: string | null; department: string | null; description: string | null; audience: string | null; detail_level: string | null; status: string; content: Json; readiness_score: number | null; input_quality_score: number | null; source_notes: Json | null; knowledge_source_names: string[]; analytics: Json | null; quality_score: number | null; risk_level: string | null; analyzed_at: string | null; compliance_score:number|null; audit_status:string|null; next_review_at:string|null; last_reviewed_at:string|null; findings:Json|null; is_favorite: boolean; is_archived: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; workspace_id: string; title: string; industry?: string | null; department?: string | null; description?: string | null; audience?: string | null; detail_level?: string | null; status?: string; content: Json; readiness_score?: number | null; input_quality_score?: number | null; source_notes?: Json | null; knowledge_source_names?: string[]; analytics?: Json|null; quality_score?:number|null; risk_level?:string|null; analyzed_at?:string|null; compliance_score?:number|null; audit_status?:string|null; next_review_at?:string|null; last_reviewed_at?:string|null; findings?:Json|null; is_favorite?: boolean; is_archived?: boolean; created_at?: string; updated_at?: string };
        Update: { title?: string; industry?: string | null; department?: string | null; description?: string | null; audience?: string | null; detail_level?: string | null; status?: string; content?: Json; readiness_score?: number | null; input_quality_score?: number | null; source_notes?: Json | null; knowledge_source_names?: string[]; analytics?:Json|null; quality_score?:number|null; risk_level?:string|null; analyzed_at?:string|null; compliance_score?:number|null; audit_status?:string|null; next_review_at?:string|null; last_reviewed_at?:string|null; findings?:Json|null; is_favorite?: boolean; is_archived?: boolean; updated_at?: string };
        Relationships: [];
      };
      sop_versions: {
        Row: { id: string; sop_id: string; user_id: string; version_number: string; change_summary: string | null; snapshot: Json; created_at: string };
        Insert: { id?: string; sop_id: string; user_id: string; version_number: string; change_summary?: string | null; snapshot: Json; created_at?: string };
        Update: { version_number?: string; change_summary?: string | null; snapshot?: Json };
        Relationships: [];
      };
      knowledge_documents: {
        Row: { id: string; user_id: string; name: string; mime_type: string | null; size_bytes: number | null; word_count: number | null; character_count: number | null; enabled: boolean; metadata: Json; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; name: string; mime_type?: string | null; size_bytes?: number | null; word_count?: number | null; character_count?: number | null; enabled?: boolean; metadata?: Json; created_at?: string; updated_at?: string };
        Update: { name?: string; mime_type?: string | null; size_bytes?: number | null; word_count?: number | null; character_count?: number | null; enabled?: boolean; metadata?: Json; updated_at?: string };
        Relationships: [];
      };
      workspaces: {
        Row: { id: string; name: string; owner_id: string; is_personal: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; owner_id: string; is_personal?: boolean; created_at?: string; updated_at?: string };
        Update: { name?: string; updated_at?: string };
        Relationships: [];
      };
      workspace_members: {
        Row: { workspace_id: string; user_id: string; role: "owner"|"admin"|"editor"|"viewer"; joined_at: string };
        Insert: { workspace_id: string; user_id: string; role: "owner"|"admin"|"editor"|"viewer"; joined_at?: string };
        Update: { role?: "admin"|"editor"|"viewer" };
        Relationships: [];
      };
      workspace_invitations: {
        Row: { id: string; workspace_id: string; email: string; role: "owner"|"admin"|"editor"|"viewer"; invited_by: string; status: "pending"|"accepted"|"revoked"|"expired"; created_at: string; expires_at: string; accepted_at: string|null; token_hash:string|null; sent_at:string|null; email_delivery_status:"not_sent"|"pending"|"sent"|"failed"; email_delivery_error:string|null };
        Insert: { id?: string; workspace_id: string; email: string; role: "admin"|"editor"|"viewer"; invited_by: string; status?: "pending"; created_at?: string; expires_at?: string };
        Update: { role?: "admin"|"editor"|"viewer"; status?: "accepted"|"revoked"|"expired"; accepted_at?: string|null; token_hash?:string|null; sent_at?:string|null; email_delivery_status?:"not_sent"|"pending"|"sent"|"failed"; email_delivery_error?:string|null };
        Relationships: [];
      };
      sop_comments: {
        Row: { id:string; sop_id:string; workspace_id:string; author_id:string; section:string; message:string; created_at:string; updated_at:string };
        Insert: { id?:string; sop_id:string; workspace_id:string; author_id:string; section:string; message:string; created_at?:string; updated_at?:string };
        Update: { message?:string; updated_at?:string };
        Relationships: [];
      };
      sop_activity: {
        Row: { id:string; workspace_id:string; sop_id:string|null; actor_id:string|null; activity_type:string; summary:string; metadata:Json; created_at:string };
        Insert: { id?:string; workspace_id:string; sop_id?:string|null; actor_id:string; activity_type:string; summary:string; metadata?:Json; created_at?:string };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_workspace: { Args: { workspace_name:string }; Returns:string };
      accept_workspace_invitation: { Args: { invitation_id:string }; Returns:string };
      invite_workspace_member: { Args: { target_workspace:string; target_email:string; target_role:"admin"|"editor"|"viewer" }; Returns:string };
      create_workspace_email_invitation: { Args: { target_workspace:string; target_email:string; target_role:string; target_token_hash:string }; Returns:string };
      prepare_workspace_invitation_resend: { Args: { target_invitation:string; target_token_hash:string }; Returns:string };
      accept_workspace_invitation_token: { Args: { target_token_hash:string }; Returns:string };
      workspace_role_for: { Args: { target:string }; Returns:"owner"|"admin"|"editor"|"viewer"|null };
    };
    Enums: { workspace_role:"owner"|"admin"|"editor"|"viewer"; sop_workflow_status:"draft"|"in_review"|"approved"|"archived"; invitation_status:"pending"|"accepted"|"revoked"|"expired" };
    CompositeTypes: Record<string, never>;
  };
};
