/**
 * Hand-maintained mirror of supabase/migrations. If you change a migration,
 * change this file in the same commit — every query in the app is typed
 * against it.
 */

export type UserRole = "admin" | "client";
export type ClientStatus = "lead" | "active" | "past";
export type ProjectStatus =
  | "inquiry"
  | "booked"
  | "in_progress"
  | "delivered"
  | "completed";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

type Timestamp = string;
type DateOnly = string;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          client_id: string | null;
          full_name: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id: string;
          role?: UserRole;
          client_id?: string | null;
          full_name?: string | null;
        };
        Update: {
          role?: UserRole;
          client_id?: string | null;
          full_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          id: string;
          name: string;
          email: string;
          phone: string | null;
          company: string | null;
          status: ClientStatus;
          notes: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          phone?: string | null;
          company?: string | null;
          status?: ClientStatus;
          notes?: string | null;
        };
        Update: {
          name?: string;
          email?: string;
          phone?: string | null;
          company?: string | null;
          status?: ClientStatus;
          notes?: string | null;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          client_id: string;
          title: string;
          description: string | null;
          status: ProjectStatus;
          event_date: DateOnly | null;
          delivery_due_date: DateOnly | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: string;
          client_id: string;
          title: string;
          description?: string | null;
          status?: ProjectStatus;
          event_date?: DateOnly | null;
          delivery_due_date?: DateOnly | null;
        };
        Update: {
          client_id?: string;
          title?: string;
          description?: string | null;
          status?: ProjectStatus;
          event_date?: DateOnly | null;
          delivery_due_date?: DateOnly | null;
        };
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          is_done: boolean;
          due_date: DateOnly | null;
          position: number;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          is_done?: boolean;
          due_date?: DateOnly | null;
          position?: number;
        };
        Update: {
          name?: string;
          is_done?: boolean;
          due_date?: DateOnly | null;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          id: string;
          project_id: string | null;
          client_id: string;
          invoice_number: string;
          title: string | null;
          status: InvoiceStatus;
          issue_date: DateOnly;
          due_date: DateOnly | null;
          subtotal: number;
          tax_rate: number;
          tax: number;
          total: number;
          amount_paid: number;
          notes: string | null;
          sent_at: Timestamp | null;
          paid_at: Timestamp | null;
          paypal_order_id: string | null;
          paypal_transaction_id: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          client_id: string;
          invoice_number?: string;
          title?: string | null;
          status?: InvoiceStatus;
          issue_date?: DateOnly;
          due_date?: DateOnly | null;
          tax_rate?: number;
          notes?: string | null;
          sent_at?: Timestamp | null;
          amount_paid?: number;
        };
        Update: {
          client_id?: string;
          project_id?: string | null;
          title?: string | null;
          status?: InvoiceStatus;
          issue_date?: DateOnly;
          due_date?: DateOnly | null;
          tax_rate?: number;
          amount_paid?: number;
          notes?: string | null;
          sent_at?: Timestamp | null;
          paid_at?: Timestamp | null;
          paypal_order_id?: string | null;
          paypal_transaction_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_line_items: {
        Row: {
          id: string;
          invoice_id: string;
          description: string;
          quantity: number;
          rate: number;
          amount: number;
          position: number;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          description: string;
          quantity?: number;
          rate?: number;
          position?: number;
        };
        Update: {
          description?: string;
          quantity?: number;
          rate?: number;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      deliverables: {
        Row: {
          id: string;
          project_id: string;
          title: string | null;
          file_name: string;
          storage_path: string;
          content_type: string | null;
          size_bytes: number | null;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          project_id: string;
          title?: string | null;
          file_name: string;
          storage_path: string;
          content_type?: string | null;
          size_bytes?: number | null;
        };
        Update: {
          title?: string | null;
          file_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deliverables_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      auth_client_id: { Args: Record<string, never>; Returns: string | null };
      mark_overdue_invoices: { Args: Record<string, never>; Returns: number };
    };
    Enums: {
      user_role: UserRole;
      client_status: ClientStatus;
      project_status: ProjectStatus;
      invoice_status: InvoiceStatus;
    };
    CompositeTypes: Record<never, never>;
  };
}

export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
export type InvoiceLineItem =
  Database["public"]["Tables"]["invoice_line_items"]["Row"];
export type Deliverable = Database["public"]["Tables"]["deliverables"]["Row"];
