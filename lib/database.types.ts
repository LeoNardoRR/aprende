export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          author_id: string
          classroom_id: string
          created_at: string
          id: string
          message: string
        }
        Insert: {
          author_id: string
          classroom_id: string
          created_at?: string
          id?: string
          message: string
        }
        Update: {
          author_id?: string
          classroom_id?: string
          created_at?: string
          id?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          classroom_id: string
          created_at: string
          created_by: string
          due_at: string | null
          id: string
          instructions: string
          kind: string
          points: number
          subject: string
          title: string
        }
        Insert: {
          classroom_id: string
          created_at?: string
          created_by: string
          due_at?: string | null
          id?: string
          instructions?: string
          kind?: string
          points?: number
          subject: string
          title: string
        }
        Update: {
          classroom_id?: string
          created_at?: string
          created_by?: string
          due_at?: string | null
          id?: string
          instructions?: string
          kind?: string
          points?: number
          subject?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          attendance_date: string
          classroom_id: string
          created_at: string
          id: string
          present: boolean
          recorded_by: string
          student_id: string
          updated_at: string
        }
        Insert: {
          attendance_date: string
          classroom_id: string
          created_at?: string
          id?: string
          present?: boolean
          recorded_by: string
          student_id: string
          updated_at?: string
        }
        Update: {
          attendance_date?: string
          classroom_id?: string
          created_at?: string
          id?: string
          present?: boolean
          recorded_by?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      curricula: {
        Row: { id: string; network_id: string | null; name: string; curriculum_type: string; version: string; active: boolean; created_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; network_id?: string | null; name: string; curriculum_type: string; version: string; active?: boolean; created_by?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; network_id?: string | null; name?: string; curriculum_type?: string; version?: string; active?: boolean; created_by?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      curriculum_areas: {
        Row: { id: string; curriculum_id: string; code: string | null; name: string; sort_order: number; created_at: string; updated_at: string }
        Insert: { id?: string; curriculum_id: string; code?: string | null; name: string; sort_order?: number; created_at?: string; updated_at?: string }
        Update: { id?: string; curriculum_id?: string; code?: string | null; name?: string; sort_order?: number; created_at?: string; updated_at?: string }
        Relationships: []
      }
      curriculum_subjects: {
        Row: { id: string; curriculum_id: string; area_id: string; code: string | null; name: string; sort_order: number; created_at: string; updated_at: string }
        Insert: { id?: string; curriculum_id: string; area_id: string; code?: string | null; name: string; sort_order?: number; created_at?: string; updated_at?: string }
        Update: { id?: string; curriculum_id?: string; area_id?: string; code?: string | null; name?: string; sort_order?: number; created_at?: string; updated_at?: string }
        Relationships: []
      }
      curriculum_school_years: {
        Row: { id: string; curriculum_id: string; school_year_id: string | null; code: string; name: string; sort_order: number; created_at: string; updated_at: string }
        Insert: { id?: string; curriculum_id: string; school_year_id?: string | null; code: string; name: string; sort_order?: number; created_at?: string; updated_at?: string }
        Update: { id?: string; curriculum_id?: string; school_year_id?: string | null; code?: string; name?: string; sort_order?: number; created_at?: string; updated_at?: string }
        Relationships: []
      }
      curriculum_thematic_units: {
        Row: { id: string; curriculum_id: string; subject_id: string; curriculum_school_year_id: string | null; name: string; sort_order: number; created_at: string; updated_at: string }
        Insert: { id?: string; curriculum_id: string; subject_id: string; curriculum_school_year_id?: string | null; name: string; sort_order?: number; created_at?: string; updated_at?: string }
        Update: { id?: string; curriculum_id?: string; subject_id?: string; curriculum_school_year_id?: string | null; name?: string; sort_order?: number; created_at?: string; updated_at?: string }
        Relationships: []
      }
      curriculum_knowledge_objects: {
        Row: { id: string; curriculum_id: string; thematic_unit_id: string; name: string; sort_order: number; created_at: string; updated_at: string }
        Insert: { id?: string; curriculum_id: string; thematic_unit_id: string; name: string; sort_order?: number; created_at?: string; updated_at?: string }
        Update: { id?: string; curriculum_id?: string; thematic_unit_id?: string; name?: string; sort_order?: number; created_at?: string; updated_at?: string }
        Relationships: []
      }
      curriculum_skills: {
        Row: { id: string; curriculum_id: string; subject_id: string; curriculum_school_year_id: string; thematic_unit_id: string | null; knowledge_object_id: string | null; code: string; description: string; active: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; curriculum_id: string; subject_id: string; curriculum_school_year_id: string; thematic_unit_id?: string | null; knowledge_object_id?: string | null; code: string; description: string; active?: boolean; created_at?: string; updated_at?: string }
        Update: { id?: string; curriculum_id?: string; subject_id?: string; curriculum_school_year_id?: string; thematic_unit_id?: string | null; knowledge_object_id?: string | null; code?: string; description?: string; active?: boolean; created_at?: string; updated_at?: string }
        Relationships: []
      }
      curriculum_imports: {
        Row: { id: string; network_id: string; curriculum_id: string | null; file_name: string; format: string; status: string; row_count: number; valid_count: number; duplicate_count: number; error_count: number; preview_rows: Json; validation_errors: Json; created_by: string; created_at: string; imported_at: string | null }
        Insert: { id?: string; network_id: string; curriculum_id?: string | null; file_name: string; format: string; status?: string; row_count?: number; valid_count?: number; duplicate_count?: number; error_count?: number; preview_rows?: Json; validation_errors?: Json; created_by: string; created_at?: string; imported_at?: string | null }
        Update: { curriculum_id?: string | null; status?: string; row_count?: number; valid_count?: number; duplicate_count?: number; error_count?: number; preview_rows?: Json; validation_errors?: Json; imported_at?: string | null }
        Relationships: []
      }
      assessment_items: {
        Row: { id: string; network_id: string; curriculum_id: string; curriculum_school_year_id: string; subject_id: string; skill_id: string; thematic_unit_id: string | null; knowledge_object_id: string | null; internal_title: string; statement: string; support_text: string | null; pedagogical_comment: string | null; correct_answer_justification: string | null; difficulty: string; item_type: string; status: string; author_id: string; reviewer_id: string | null; approver_id: string | null; current_version: number; created_at: string; updated_at: string }
        Insert: { id?: string; network_id: string; curriculum_id: string; curriculum_school_year_id: string; subject_id: string; skill_id: string; thematic_unit_id?: string | null; knowledge_object_id?: string | null; internal_title: string; statement: string; support_text?: string | null; pedagogical_comment?: string | null; correct_answer_justification?: string | null; difficulty: string; item_type: string; status?: string; author_id: string; reviewer_id?: string | null; approver_id?: string | null; current_version?: number; created_at?: string; updated_at?: string }
        Update: { internal_title?: string; statement?: string; support_text?: string | null; pedagogical_comment?: string | null; correct_answer_justification?: string | null; difficulty?: string; skill_id?: string; thematic_unit_id?: string | null; knowledge_object_id?: string | null; updated_at?: string }
        Relationships: []
      }
      assessment_item_options: {
        Row: { id: string; item_id: string; label: string; content: string; is_correct: boolean; feedback: string | null; distractor_analysis: string | null; sort_order: number; created_at: string; updated_at: string }
        Insert: { id?: string; item_id: string; label: string; content: string; is_correct?: boolean; feedback?: string | null; distractor_analysis?: string | null; sort_order?: number; created_at?: string; updated_at?: string }
        Update: { label?: string; content?: string; is_correct?: boolean; feedback?: string | null; distractor_analysis?: string | null; sort_order?: number; updated_at?: string }
        Relationships: []
      }
      classrooms: {
        Row: {
          academic_year_id: string | null
          classroom_status: string
          created_at: string
          id: string
          image_url: string | null
          join_code: string
          name: string
          network_id: string | null
          owner_id: string
          school_id: string | null
          school_year_id: string | null
          subject: string
        }
        Insert: {
          academic_year_id?: string | null
          classroom_status?: string
          created_at?: string
          id?: string
          image_url?: string | null
          join_code?: string
          name: string
          network_id?: string | null
          owner_id: string
          school_id?: string | null
          school_year_id?: string | null
          subject: string
        }
        Update: {
          academic_year_id?: string | null
          classroom_status?: string
          created_at?: string
          id?: string
          image_url?: string | null
          join_code?: string
          name?: string
          network_id?: string | null
          owner_id?: string
          school_id?: string | null
          school_year_id?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "classrooms_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_materials: {
        Row: {
          classroom_id: string
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          id: string
          lesson_record_id: string | null
          source: string
          storage_path: string
          teacher_id: string
          title: string
        }
        Insert: {
          classroom_id: string
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          id?: string
          lesson_record_id?: string | null
          source?: string
          storage_path: string
          teacher_id: string
          title: string
        }
        Update: {
          classroom_id?: string
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          lesson_record_id?: string | null
          source?: string
          storage_path?: string
          teacher_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_materials_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_materials_lesson_record_id_fkey"
            columns: ["lesson_record_id"]
            isOneToOne: false
            referencedRelation: "lesson_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_materials_record_classroom_fkey"
            columns: ["lesson_record_id", "classroom_id"]
            isOneToOne: false
            referencedRelation: "lesson_records"
            referencedColumns: ["id", "classroom_id"]
          },
          {
            foreignKeyName: "lesson_materials_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_records: {
        Row: {
          classroom_id: string
          content: string
          created_at: string
          id: string
          lesson_date: string
          observations: string
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          classroom_id: string
          content: string
          created_at?: string
          id?: string
          lesson_date?: string
          observations?: string
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          classroom_id?: string
          content?: string
          created_at?: string
          id?: string
          lesson_date?: string
          observations?: string
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_records_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_records_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          classroom_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          classroom_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          classroom_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_years: {
        Row: {
          created_at: string
          ends_on: string
          id: string
          label: string
          network_id: string
          starts_on: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          id?: string
          label: string
          network_id: string
          starts_on: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          id?: string
          label?: string
          network_id?: string
          starts_on?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      institutional_memberships: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          network_id: string
          role: string
          school_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          network_id: string
          role: string
          school_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          network_id?: string
          role?: string
          school_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      networks: {
        Row: {
          created_at: string
          created_by: string
          id: string
          municipality: string | null
          name: string
          state_code: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          municipality?: string | null
          name: string
          state_code?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          municipality?: string | null
          name?: string
          state_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      schools: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          network_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          network_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          network_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      school_years: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          school_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          school_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          school_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      student_enrollments: {
        Row: {
          academic_year_id: string
          classroom_id: string | null
          created_at: string
          created_by: string | null
          ends_on: string | null
          external_key: string | null
          id: string
          network_id: string
          school_id: string
          source: string
          starts_on: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          classroom_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          external_key?: string | null
          id?: string
          network_id: string
          school_id: string
          source?: string
          starts_on?: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          classroom_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          external_key?: string | null
          id?: string
          network_id?: string
          school_id?: string
          source?: string
          starts_on?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_movements: {
        Row: {
          created_at: string
          created_by: string
          effective_on: string
          enrollment_id: string
          from_classroom_id: string | null
          id: string
          movement_type: string
          reason: string | null
          student_id: string
          to_classroom_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          effective_on?: string
          enrollment_id: string
          from_classroom_id?: string | null
          id?: string
          movement_type: string
          reason?: string | null
          student_id: string
          to_classroom_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          effective_on?: string
          enrollment_id?: string
          from_classroom_id?: string | null
          id?: string
          movement_type?: string
          reason?: string | null
          student_id?: string
          to_classroom_id?: string | null
        }
        Relationships: []
      }
      submissions: {
        Row: {
          answer: string
          assignment_id: string
          feedback: string | null
          id: string
          score: number | null
          status: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          answer?: string
          assignment_id: string
          feedback?: string | null
          id?: string
          score?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          answer?: string
          assignment_id?: string
          feedback?: string | null
          id?: string
          score?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          student_id?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_student_enrollment: {
        Args: {
          target_academic_year: string
          target_classroom: string
          target_email: string
          target_network: string
          target_school: string
        }
        Returns: string
      }
      delete_my_account: { Args: { confirmation: string }; Returns: undefined }
      find_profile_for_institution: {
        Args: {
          target_email: string
          target_network: string
          target_school?: string | null
        }
        Returns: {
          display_name: string
          email: string
          profile_role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      grade_submission: {
        Args: {
          new_feedback: string
          new_score: number
          target_submission: string
        }
        Returns: undefined
      }
      is_teacher_email_allowed: {
        Args: { target_email: string }
        Returns: boolean
      }
      join_class_by_code: { Args: { code: string }; Returns: string }
      link_classroom_to_institution: {
        Args: {
          target_academic_year: string
          target_classroom: string
          target_network: string
          target_school: string
          target_school_year: string
        }
        Returns: undefined
      }
      list_institutional_users: {
        Args: {
          page_offset?: number
          page_size?: number
          search_query?: string
          target_network: string
        }
        Returns: {
          created_at: string
          display_name: string
          email: string
          membership_id: string
          membership_role: string
          membership_status: string
          network_id: string
          network_name: string
          profile_role: Database["public"]["Enums"]["app_role"]
          school_id: string | null
          school_name: string | null
          user_id: string
        }[]
      }
      list_assessment_items: {
        Args: {
          target_network: string
          status_filter?: string
          curriculum_filter?: string | null
          subject_filter?: string | null
          school_year_filter?: string | null
          skill_filter?: string | null
          difficulty_filter?: string
          author_filter?: string | null
          reviewer_filter?: string | null
          approver_filter?: string | null
          search_query?: string
          page_size?: number
          page_offset?: number
        }
        Returns: {
          item_id: string
          internal_title: string
          statement: string
          item_type: string
          difficulty: string
          item_status: string
          curriculum_name: string
          subject_name: string
          school_year_name: string
          skill_code: string
          author_name: string
          reviewer_name: string | null
          approver_name: string | null
          current_version: number
          updated_at: string
          total_count: number
        }[]
      }
      list_legacy_classrooms: {
        Args: {
          page_size?: number
          search_query?: string
          target_network: string
        }
        Returns: {
          classroom_id: string
          classroom_name: string
          owner_email: string
          owner_id: string
          owner_name: string
          subject: string
        }[]
      }
      list_student_enrollments: {
        Args: {
          page_offset?: number
          page_size?: number
          search_query?: string
          status_filter?: string
          target_network: string
        }
        Returns: {
          academic_year_id: string
          academic_year_label: string
          classroom_id: string | null
          classroom_name: string | null
          ends_on: string | null
          enrollment_id: string
          enrollment_status: string
          network_id: string
          school_id: string
          school_name: string
          starts_on: string
          student_email: string
          student_id: string
          student_name: string
        }[]
      }
      set_institutional_classroom_status: {
        Args: { target_classroom: string; target_status: string }
        Returns: undefined
      }
      set_institutional_membership: {
        Args: {
          target_email: string
          target_network: string
          target_role: string
          target_school: string | null
          target_status?: string
        }
        Returns: string
      }
      set_institutional_membership_status: {
        Args: { target_membership: string; target_status: string }
        Returns: undefined
      }
      transition_student_enrollment: {
        Args: {
          action_reason?: string | null
          target_action: string
          target_classroom?: string | null
          target_enrollment: string
        }
        Returns: undefined
      }
      transition_assessment_item: {
        Args: { target_item: string; target_action: string; action_comment?: string | null }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "teacher" | "student" | "network_admin" | "manager" | "reviewer" | "approver"
      submission_status: "draft" | "submitted"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["teacher", "student", "network_admin", "manager", "reviewer", "approver"],
      submission_status: ["draft", "submitted"],
    },
  },
} as const
