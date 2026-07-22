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
      template_categories: {
        Row:{id:string;name:string;slug:string;description:string|null;created_at:string};Insert:{id?:string;name:string;slug:string;description?:string|null};Update:{name?:string;slug?:string;description?:string|null};Relationships:[];
      };
      marketplace_creator_profiles: {
        Row:{user_id:string;display_name:string;joined_at:string};Insert:{user_id:string;display_name:string;joined_at?:string};Update:{display_name?:string};Relationships:[];
      };
      sop_templates: {
        Row:{id:string;creator_id:string;source_sop_id:string|null;title:string;slug:string;summary:string;description:string;industry:string|null;department:string|null;category_id:string|null;template_content:Json;preview_content:string;visibility:string;publication_status:string;moderation_status:string;version:string;compliance_framework:string|null;risk_level:string|null;is_free:boolean;paid_ready:boolean;usage_count:number;favorite_count:number;rating_average:number;rating_count:number;created_at:string;updated_at:string;published_at:string|null};
        Insert:{id?:string;creator_id:string;source_sop_id?:string|null;title:string;slug:string;summary:string;description:string;industry?:string|null;department?:string|null;category_id?:string|null;template_content:Json;preview_content:string;visibility?:string;publication_status?:string;moderation_status?:string;version?:string;compliance_framework?:string|null;risk_level?:string|null;is_free?:boolean;paid_ready?:boolean;published_at?:string|null};
        Update:{title?:string;slug?:string;summary?:string;description?:string;industry?:string|null;department?:string|null;category_id?:string|null;template_content?:Json;preview_content?:string;visibility?:string;publication_status?:string;moderation_status?:string;version?:string;compliance_framework?:string|null;risk_level?:string|null;published_at?:string|null};Relationships:[];
      };
      template_tags:{Row:{template_id:string;tag:string};Insert:{template_id:string;tag:string};Update:{tag?:string};Relationships:[]};
      template_ratings:{Row:{template_id:string;user_id:string;rating:number;created_at:string;updated_at:string};Insert:{template_id:string;user_id:string;rating:number};Update:{rating:number;updated_at?:string};Relationships:[]};
      template_favorites:{Row:{template_id:string;user_id:string;created_at:string};Insert:{template_id:string;user_id:string};Update:never;Relationships:[]};
      template_usage:{Row:{id:string;template_id:string;user_id:string|null;event_type:string;session_key:string|null;created_at:string};Insert:{id?:string;template_id:string;user_id?:string|null;event_type:"view"|"copy";session_key?:string|null};Update:never;Relationships:[]};
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
    Views: { public_marketplace_templates:{Row:Omit<Database["public"]["Tables"]["sop_templates"]["Row"],"source_sop_id">;Relationships:[]} };
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
