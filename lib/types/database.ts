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
      accounting_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          fiscal_year: number
          id: string
          notes: string | null
          period_month: number
          portfolio_id: string
          reopened_at: string | null
          reopened_by: string | null
          status: Database["public"]["Enums"]["period_status"]
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          fiscal_year: number
          id?: string
          notes?: string | null
          period_month: number
          portfolio_id: string
          reopened_at?: string | null
          reopened_by?: string | null
          status?: Database["public"]["Enums"]["period_status"]
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          fiscal_year?: number
          id?: string
          notes?: string | null
          period_month?: number
          portfolio_id?: string
          reopened_at?: string | null
          reopened_by?: string | null
          status?: Database["public"]["Enums"]["period_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_periods_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_periods_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "accounting_periods_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      activity: {
        Row: {
          action: string
          agent: string | null
          created_at: string | null
          details: string | null
          file: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          agent?: string | null
          created_at?: string | null
          details?: string | null
          file?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          agent?: string | null
          created_at?: string | null
          details?: string | null
          file?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      agents: {
        Row: {
          created_at: string | null
          files: Json | null
          id: string
          name: string
          slug: string
          summary: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          files?: Json | null
          id?: string
          name: string
          slug: string
          summary?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          files?: Json | null
          id?: string
          name?: string
          slug?: string
          summary?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      amenity_tags: {
        Row: {
          category: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          portfolio_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          portfolio_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          portfolio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "amenity_tags_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amenity_tags_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "amenity_tags_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          key_hash: string
          last_used_at: string | null
          last_used_ip: string | null
          name: string
          portfolio_id: string
          prefix: string
          revoked_at: string | null
          revoked_by: string | null
          scopes: string[]
          updated_at: string
          use_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          last_used_at?: string | null
          last_used_ip?: string | null
          name: string
          portfolio_id: string
          prefix: string
          revoked_at?: string | null
          revoked_by?: string | null
          scopes?: string[]
          updated_at?: string
          use_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          last_used_at?: string | null
          last_used_ip?: string | null
          name?: string
          portfolio_id?: string
          prefix?: string
          revoked_at?: string | null
          revoked_by?: string | null
          scopes?: string[]
          updated_at?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "api_keys_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          amount: number | null
          archived_at: string | null
          association_id: string
          attachments: Json
          board_member_ids: string[]
          created_at: string
          decision_at: string | null
          decision_by: string | null
          description: string | null
          due_date: string | null
          id: string
          notes: string | null
          owner_id: string | null
          percentage_required: number | null
          portfolio_id: string
          request_type: string
          requested_at: string
          requested_by_email: string | null
          requested_by_name: string | null
          required_votes: number
          signatures_required: boolean
          status: Database["public"]["Enums"]["approval_request_status"]
          title: string
          unit_id: string | null
          updated_at: string
          vendor_id: string | null
          votes_abstain: number
          votes_against: number
          votes_for: number
          voting_scheme: Database["public"]["Enums"]["voting_scheme"]
        }
        Insert: {
          amount?: number | null
          archived_at?: string | null
          association_id: string
          attachments?: Json
          board_member_ids?: string[]
          created_at?: string
          decision_at?: string | null
          decision_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          percentage_required?: number | null
          portfolio_id: string
          request_type: string
          requested_at?: string
          requested_by_email?: string | null
          requested_by_name?: string | null
          required_votes?: number
          signatures_required?: boolean
          status?: Database["public"]["Enums"]["approval_request_status"]
          title: string
          unit_id?: string | null
          updated_at?: string
          vendor_id?: string | null
          votes_abstain?: number
          votes_against?: number
          votes_for?: number
          voting_scheme?: Database["public"]["Enums"]["voting_scheme"]
        }
        Update: {
          amount?: number | null
          archived_at?: string | null
          association_id?: string
          attachments?: Json
          board_member_ids?: string[]
          created_at?: string
          decision_at?: string | null
          decision_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          percentage_required?: number | null
          portfolio_id?: string
          request_type?: string
          requested_at?: string
          requested_by_email?: string | null
          requested_by_name?: string | null
          required_votes?: number
          signatures_required?: boolean
          status?: Database["public"]["Enums"]["approval_request_status"]
          title?: string
          unit_id?: string | null
          updated_at?: string
          vendor_id?: string | null
          votes_abstain?: number
          votes_against?: number
          votes_for?: number
          voting_scheme?: Database["public"]["Enums"]["voting_scheme"]
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "approval_requests_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "approval_requests_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "approval_requests_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "approval_requests_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "approval_requests_homeowner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_homeowner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "approval_requests_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "approval_requests_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "approval_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "delinquent_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "approval_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "approval_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "approval_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_unit_account_summary"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "approval_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_insurance_expirations"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "approval_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_votes: {
        Row: {
          approval_request_id: string
          board_member_id: string | null
          cast_at: string
          choice: Database["public"]["Enums"]["approval_vote_choice"]
          comment: string | null
          id: string
          voter_user_id: string | null
        }
        Insert: {
          approval_request_id: string
          board_member_id?: string | null
          cast_at?: string
          choice: Database["public"]["Enums"]["approval_vote_choice"]
          comment?: string | null
          id?: string
          voter_user_id?: string | null
        }
        Update: {
          approval_request_id?: string
          board_member_id?: string | null
          cast_at?: string
          choice?: Database["public"]["Enums"]["approval_vote_choice"]
          comment?: string | null
          id?: string
          voter_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_votes_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_votes_board_member_id_fkey"
            columns: ["board_member_id"]
            isOneToOne: false
            referencedRelation: "board_members"
            referencedColumns: ["id"]
          },
        ]
      }
      architectural_review_settings: {
        Row: {
          association_id: string
          created_at: string
          default_approver_ids: string[]
          default_approver_scope: string
          default_committee_id: string | null
          default_percentage_required: number | null
          default_voting_scheme: Database["public"]["Enums"]["voting_scheme"]
          document_upload_html: string | null
          online_requests_disabled: boolean
          portal_homepage_html: string | null
          submission_form_html: string | null
          updated_at: string
        }
        Insert: {
          association_id: string
          created_at?: string
          default_approver_ids?: string[]
          default_approver_scope?: string
          default_committee_id?: string | null
          default_percentage_required?: number | null
          default_voting_scheme?: Database["public"]["Enums"]["voting_scheme"]
          document_upload_html?: string | null
          online_requests_disabled?: boolean
          portal_homepage_html?: string | null
          submission_form_html?: string | null
          updated_at?: string
        }
        Update: {
          association_id?: string
          created_at?: string
          default_approver_ids?: string[]
          default_approver_scope?: string
          default_committee_id?: string | null
          default_percentage_required?: number | null
          default_voting_scheme?: Database["public"]["Enums"]["voting_scheme"]
          document_upload_html?: string | null
          online_requests_disabled?: boolean
          portal_homepage_html?: string | null
          submission_form_html?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "architectural_review_settings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: true
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "architectural_review_settings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: true
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "architectural_review_settings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: true
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "architectural_review_settings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: true
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "architectural_review_settings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: true
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "architectural_review_settings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: true
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "architectural_review_settings_default_committee_id_fkey"
            columns: ["default_committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_periods: {
        Row: {
          association_id: string
          base_amount: number
          created_at: string
          created_by: string | null
          id: string
          name: string
          period_end: string
          period_start: string
          status: string
        }
        Insert: {
          association_id: string
          base_amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          period_end: string
          period_start: string
          status?: string
        }
        Update: {
          association_id?: string
          base_amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          period_end?: string
          period_start?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_periods_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "assessment_periods_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "assessment_periods_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_periods_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "assessment_periods_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "assessment_periods_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
        ]
      }
      association_additional_fees: {
        Row: {
          amount: number | null
          association_id: string
          created_at: string
          gl_account_id: string | null
          id: string
          label: string | null
          percentage: number | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          association_id: string
          created_at?: string
          gl_account_id?: string | null
          id?: string
          label?: string | null
          percentage?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          association_id?: string
          created_at?: string
          gl_account_id?: string | null
          id?: string
          label?: string | null
          percentage?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "association_additional_fees_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_additional_fees_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_additional_fees_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "association_additional_fees_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_additional_fees_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_additional_fees_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_additional_fees_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      association_amenities: {
        Row: {
          allow_reservations: boolean
          amenity_tag_id: string | null
          archived_at: string | null
          association_id: string
          closes_at: string | null
          created_at: string
          description_html: string | null
          id: string
          image_url: string | null
          name: string
          notes: string | null
          opens_at: string | null
          price_amount: number | null
          pricing_mode:
            | Database["public"]["Enums"]["amenity_pricing_mode"]
            | null
          reservation_email: string | null
          reservation_url: string | null
          reserve_method:
            | Database["public"]["Enums"]["amenity_reserve_method"]
            | null
        }
        Insert: {
          allow_reservations?: boolean
          amenity_tag_id?: string | null
          archived_at?: string | null
          association_id: string
          closes_at?: string | null
          created_at?: string
          description_html?: string | null
          id?: string
          image_url?: string | null
          name: string
          notes?: string | null
          opens_at?: string | null
          price_amount?: number | null
          pricing_mode?:
            | Database["public"]["Enums"]["amenity_pricing_mode"]
            | null
          reservation_email?: string | null
          reservation_url?: string | null
          reserve_method?:
            | Database["public"]["Enums"]["amenity_reserve_method"]
            | null
        }
        Update: {
          allow_reservations?: boolean
          amenity_tag_id?: string | null
          archived_at?: string | null
          association_id?: string
          closes_at?: string | null
          created_at?: string
          description_html?: string | null
          id?: string
          image_url?: string | null
          name?: string
          notes?: string | null
          opens_at?: string | null
          price_amount?: number | null
          pricing_mode?:
            | Database["public"]["Enums"]["amenity_pricing_mode"]
            | null
          reservation_email?: string | null
          reservation_url?: string | null
          reserve_method?:
            | Database["public"]["Enums"]["amenity_reserve_method"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "association_amenities_amenity_tag_id_fkey"
            columns: ["amenity_tag_id"]
            isOneToOne: false
            referencedRelation: "amenity_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "association_amenities_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_amenities_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_amenities_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "association_amenities_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_amenities_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_amenities_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
        ]
      }
      association_attachments: {
        Row: {
          archived_at: string | null
          association_id: string
          byte_size: number | null
          content_type: string | null
          created_at: string
          file_name: string
          folder: string | null
          id: string
          shared_with_owner: boolean
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          archived_at?: string | null
          association_id: string
          byte_size?: number | null
          content_type?: string | null
          created_at?: string
          file_name: string
          folder?: string | null
          id?: string
          shared_with_owner?: boolean
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          archived_at?: string | null
          association_id?: string
          byte_size?: number | null
          content_type?: string | null
          created_at?: string
          file_name?: string
          folder?: string | null
          id?: string
          shared_with_owner?: boolean
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "association_attachments_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_attachments_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_attachments_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "association_attachments_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_attachments_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_attachments_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
        ]
      }
      association_keys: {
        Row: {
          archived_at: string | null
          association_id: string
          created_at: string
          created_by: string | null
          held_by: string | null
          id: string
          key_number: string | null
          label: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          association_id: string
          created_at?: string
          created_by?: string | null
          held_by?: string | null
          id?: string
          key_number?: string | null
          label: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          association_id?: string
          created_at?: string
          created_by?: string | null
          held_by?: string | null
          id?: string
          key_number?: string | null
          label?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "association_keys_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_keys_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_keys_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "association_keys_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_keys_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_keys_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
        ]
      }
      association_lease_template_settings: {
        Row: {
          addenda_template_ids: string[]
          association_id: string
          attachment_ids: string[]
          created_at: string
          primary_template_id: string | null
          slot: Database["public"]["Enums"]["lease_template_slot"]
          updated_at: string
        }
        Insert: {
          addenda_template_ids?: string[]
          association_id: string
          attachment_ids?: string[]
          created_at?: string
          primary_template_id?: string | null
          slot: Database["public"]["Enums"]["lease_template_slot"]
          updated_at?: string
        }
        Update: {
          addenda_template_ids?: string[]
          association_id?: string
          attachment_ids?: string[]
          created_at?: string
          primary_template_id?: string | null
          slot?: Database["public"]["Enums"]["lease_template_slot"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "association_lease_template_settings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_lease_template_settings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_lease_template_settings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "association_lease_template_settings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_lease_template_settings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_lease_template_settings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_lease_template_settings_primary_template_id_fkey"
            columns: ["primary_template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      association_managers: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          association_id: string
          ended_at: string | null
          id: string
          portfolio_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          association_id: string
          ended_at?: string | null
          id?: string
          portfolio_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          association_id?: string
          ended_at?: string | null
          id?: string
          portfolio_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "association_managers_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_managers_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_managers_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "association_managers_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_managers_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_managers_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_managers_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "association_managers_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "association_managers_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      association_notes: {
        Row: {
          archived_at: string | null
          association_id: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_standard: boolean
        }
        Insert: {
          archived_at?: string | null
          association_id: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_standard?: boolean
        }
        Update: {
          archived_at?: string | null
          association_id?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_standard?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "association_notes_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_notes_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_notes_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "association_notes_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_notes_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_notes_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
        ]
      }
      association_renewal_options: {
        Row: {
          additional_fee: number
          association_id: string
          change_amount: number
          created_at: string
          id: string
          sort_order: number
          term_months: number
        }
        Insert: {
          additional_fee?: number
          association_id: string
          change_amount?: number
          created_at?: string
          id?: string
          sort_order?: number
          term_months: number
        }
        Update: {
          additional_fee?: number
          association_id?: string
          change_amount?: number
          created_at?: string
          id?: string
          sort_order?: number
          term_months?: number
        }
        Relationships: [
          {
            foreignKeyName: "association_renewal_options_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_renewal_options_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_renewal_options_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "association_renewal_options_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_renewal_options_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "association_renewal_options_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
        ]
      }
      associations: {
        Row: {
          address: string
          address_line_2: string | null
          amenities: Json | null
          annual_interest_rate: number
          archived_at: string | null
          basis_for_owner_packets: string | null
          budget_variance_threshold_amount: number | null
          budget_variance_threshold_op: string | null
          budget_variance_threshold_pct: number | null
          charge_history_includes: string
          city: string
          county: string | null
          created_at: string
          created_by: string
          default_renewal_letter_template_id: string | null
          description: string | null
          disable_contacts_editing_in_portal: boolean
          disable_online_maintenance_requests: boolean
          disable_renter_editing_in_portal: boolean
          electronic_doc_delivery_terms: string | null
          fiscal_year_start: number
          hide_calendar_in_portal: boolean
          home_warranty_covered: boolean
          id: string
          include_current_and_upcoming_charges: boolean
          include_current_message_on_statement: boolean
          include_logo_on_statement: boolean
          include_payment_coupon_on_statement: boolean
          include_payments_due_date: boolean
          include_payments_history_and_balance_forward: boolean
          include_upcoming_in_amount_due: boolean
          insurance_expiration: string | null
          interest_grace_balance: number
          interest_grace_days: number | null
          interest_income_gl_account_id: string | null
          interest_post_day_of_month: number | null
          late_fee_amount_override: number | null
          late_fee_eligible_charges: string | null
          late_fee_grace_day_of_following_month: number | null
          late_fee_grace_days_override: number | null
          late_fee_type: string | null
          lease_fee_amount: number | null
          lease_fee_pct: number | null
          lease_fee_type: string | null
          lease_generation_method: Database["public"]["Enums"]["lease_generation_method"]
          legal_name: string | null
          lockbox_id: string | null
          maintenance_contact_email: string | null
          maintenance_contact_name: string | null
          maintenance_contact_phone: string | null
          maintenance_limit: number | null
          maintenance_notes: string | null
          maintenance_phone: string | null
          management_end_date: string | null
          management_end_reason: string | null
          management_fee_schedule_id: string | null
          management_start_date: string | null
          name: string
          nsf_fee_amount_override: number | null
          online_maintenance_request_instructions: string | null
          operating_bank_account_id: string | null
          owner_can_override_frequency: boolean
          owner_payout_basis: string | null
          payment_frequency: string | null
          portfolio_id: string | null
          primary_bank_account_id: string | null
          property_group_id: string | null
          property_type: string | null
          renewal_fee_amount: number | null
          renewal_fee_pct: number | null
          renewal_fee_type: string | null
          rent_change_kind: Database["public"]["Enums"]["rent_change_kind"]
          reserve_bank_account_id: string | null
          reserve_funds: number
          residents_check_fee_coverage_enabled: boolean
          show_remaining_amount_for_past_due_charges: boolean
          site_manager: string | null
          site_manager_first_name: string | null
          site_manager_last_name: string | null
          site_manager_phone: string | null
          site_manager_user_id: string | null
          state: string
          status: string
          tax_id: string | null
          unit_count: number | null
          unit_entry_pre_authorized: boolean
          upcoming_charges_timeframe: string
          use_enhanced_statement: boolean
          vendor_1099_payer: string | null
          violation_sender_email: string | null
          violation_sender_email_uses_logged_in_user: boolean
          violation_sender_name: string | null
          year_built: number | null
          zip: string
        }
        Insert: {
          address: string
          address_line_2?: string | null
          amenities?: Json | null
          annual_interest_rate?: number
          archived_at?: string | null
          basis_for_owner_packets?: string | null
          budget_variance_threshold_amount?: number | null
          budget_variance_threshold_op?: string | null
          budget_variance_threshold_pct?: number | null
          charge_history_includes?: string
          city: string
          county?: string | null
          created_at?: string
          created_by: string
          default_renewal_letter_template_id?: string | null
          description?: string | null
          disable_contacts_editing_in_portal?: boolean
          disable_online_maintenance_requests?: boolean
          disable_renter_editing_in_portal?: boolean
          electronic_doc_delivery_terms?: string | null
          fiscal_year_start: number
          hide_calendar_in_portal?: boolean
          home_warranty_covered?: boolean
          id?: string
          include_current_and_upcoming_charges?: boolean
          include_current_message_on_statement?: boolean
          include_logo_on_statement?: boolean
          include_payment_coupon_on_statement?: boolean
          include_payments_due_date?: boolean
          include_payments_history_and_balance_forward?: boolean
          include_upcoming_in_amount_due?: boolean
          insurance_expiration?: string | null
          interest_grace_balance?: number
          interest_grace_days?: number | null
          interest_income_gl_account_id?: string | null
          interest_post_day_of_month?: number | null
          late_fee_amount_override?: number | null
          late_fee_eligible_charges?: string | null
          late_fee_grace_day_of_following_month?: number | null
          late_fee_grace_days_override?: number | null
          late_fee_type?: string | null
          lease_fee_amount?: number | null
          lease_fee_pct?: number | null
          lease_fee_type?: string | null
          lease_generation_method?: Database["public"]["Enums"]["lease_generation_method"]
          legal_name?: string | null
          lockbox_id?: string | null
          maintenance_contact_email?: string | null
          maintenance_contact_name?: string | null
          maintenance_contact_phone?: string | null
          maintenance_limit?: number | null
          maintenance_notes?: string | null
          maintenance_phone?: string | null
          management_end_date?: string | null
          management_end_reason?: string | null
          management_fee_schedule_id?: string | null
          management_start_date?: string | null
          name: string
          nsf_fee_amount_override?: number | null
          online_maintenance_request_instructions?: string | null
          operating_bank_account_id?: string | null
          owner_can_override_frequency?: boolean
          owner_payout_basis?: string | null
          payment_frequency?: string | null
          portfolio_id?: string | null
          primary_bank_account_id?: string | null
          property_group_id?: string | null
          property_type?: string | null
          renewal_fee_amount?: number | null
          renewal_fee_pct?: number | null
          renewal_fee_type?: string | null
          rent_change_kind?: Database["public"]["Enums"]["rent_change_kind"]
          reserve_bank_account_id?: string | null
          reserve_funds?: number
          residents_check_fee_coverage_enabled?: boolean
          show_remaining_amount_for_past_due_charges?: boolean
          site_manager?: string | null
          site_manager_first_name?: string | null
          site_manager_last_name?: string | null
          site_manager_phone?: string | null
          site_manager_user_id?: string | null
          state: string
          status?: string
          tax_id?: string | null
          unit_count?: number | null
          unit_entry_pre_authorized?: boolean
          upcoming_charges_timeframe?: string
          use_enhanced_statement?: boolean
          vendor_1099_payer?: string | null
          violation_sender_email?: string | null
          violation_sender_email_uses_logged_in_user?: boolean
          violation_sender_name?: string | null
          year_built?: number | null
          zip: string
        }
        Update: {
          address?: string
          address_line_2?: string | null
          amenities?: Json | null
          annual_interest_rate?: number
          archived_at?: string | null
          basis_for_owner_packets?: string | null
          budget_variance_threshold_amount?: number | null
          budget_variance_threshold_op?: string | null
          budget_variance_threshold_pct?: number | null
          charge_history_includes?: string
          city?: string
          county?: string | null
          created_at?: string
          created_by?: string
          default_renewal_letter_template_id?: string | null
          description?: string | null
          disable_contacts_editing_in_portal?: boolean
          disable_online_maintenance_requests?: boolean
          disable_renter_editing_in_portal?: boolean
          electronic_doc_delivery_terms?: string | null
          fiscal_year_start?: number
          hide_calendar_in_portal?: boolean
          home_warranty_covered?: boolean
          id?: string
          include_current_and_upcoming_charges?: boolean
          include_current_message_on_statement?: boolean
          include_logo_on_statement?: boolean
          include_payment_coupon_on_statement?: boolean
          include_payments_due_date?: boolean
          include_payments_history_and_balance_forward?: boolean
          include_upcoming_in_amount_due?: boolean
          insurance_expiration?: string | null
          interest_grace_balance?: number
          interest_grace_days?: number | null
          interest_income_gl_account_id?: string | null
          interest_post_day_of_month?: number | null
          late_fee_amount_override?: number | null
          late_fee_eligible_charges?: string | null
          late_fee_grace_day_of_following_month?: number | null
          late_fee_grace_days_override?: number | null
          late_fee_type?: string | null
          lease_fee_amount?: number | null
          lease_fee_pct?: number | null
          lease_fee_type?: string | null
          lease_generation_method?: Database["public"]["Enums"]["lease_generation_method"]
          legal_name?: string | null
          lockbox_id?: string | null
          maintenance_contact_email?: string | null
          maintenance_contact_name?: string | null
          maintenance_contact_phone?: string | null
          maintenance_limit?: number | null
          maintenance_notes?: string | null
          maintenance_phone?: string | null
          management_end_date?: string | null
          management_end_reason?: string | null
          management_fee_schedule_id?: string | null
          management_start_date?: string | null
          name?: string
          nsf_fee_amount_override?: number | null
          online_maintenance_request_instructions?: string | null
          operating_bank_account_id?: string | null
          owner_can_override_frequency?: boolean
          owner_payout_basis?: string | null
          payment_frequency?: string | null
          portfolio_id?: string | null
          primary_bank_account_id?: string | null
          property_group_id?: string | null
          property_type?: string | null
          renewal_fee_amount?: number | null
          renewal_fee_pct?: number | null
          renewal_fee_type?: string | null
          rent_change_kind?: Database["public"]["Enums"]["rent_change_kind"]
          reserve_bank_account_id?: string | null
          reserve_funds?: number
          residents_check_fee_coverage_enabled?: boolean
          show_remaining_amount_for_past_due_charges?: boolean
          site_manager?: string | null
          site_manager_first_name?: string | null
          site_manager_last_name?: string | null
          site_manager_phone?: string | null
          site_manager_user_id?: string | null
          state?: string
          status?: string
          tax_id?: string | null
          unit_count?: number | null
          unit_entry_pre_authorized?: boolean
          upcoming_charges_timeframe?: string
          use_enhanced_statement?: boolean
          vendor_1099_payer?: string | null
          violation_sender_email?: string | null
          violation_sender_email_uses_logged_in_user?: boolean
          violation_sender_name?: string | null
          year_built?: number | null
          zip?: string
        }
        Relationships: [
          {
            foreignKeyName: "associations_default_renewal_letter_template_id_fkey"
            columns: ["default_renewal_letter_template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associations_interest_income_gl_account_id_fkey"
            columns: ["interest_income_gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associations_management_fee_schedule_id_fkey"
            columns: ["management_fee_schedule_id"]
            isOneToOne: false
            referencedRelation: "management_fee_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associations_operating_bank_account_id_fkey"
            columns: ["operating_bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associations_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associations_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "associations_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "associations_primary_bank_account_id_fkey"
            columns: ["primary_bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associations_property_group_id_fkey"
            columns: ["property_group_id"]
            isOneToOne: false
            referencedRelation: "property_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associations_reserve_bank_account_id_fkey"
            columns: ["reserve_bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associations_site_manager_user_id_fkey"
            columns: ["site_manager_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      autopay_mandates: {
        Row: {
          association_id: string | null
          authorized_amount_max_cents: number
          canceled_at: string | null
          canceled_by: string | null
          created_at: string
          day_of_month: number | null
          end_date: string | null
          failure_count: number
          frequency: Database["public"]["Enums"]["autopay_frequency"]
          id: string
          last_failure_at: string | null
          last_failure_reason: string | null
          last_run_at: string | null
          last_run_payment_intent_id: string | null
          mandate_document_url: string | null
          mandate_ip_address: string | null
          mandate_signed_at: string | null
          mandate_user_agent: string | null
          next_run_date: string | null
          owner_id: string
          paused_at: string | null
          paused_reason: string | null
          payment_method_id: string
          portfolio_id: string
          processor_mandate_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["autopay_status"]
          success_count: number
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          association_id?: string | null
          authorized_amount_max_cents: number
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          day_of_month?: number | null
          end_date?: string | null
          failure_count?: number
          frequency?: Database["public"]["Enums"]["autopay_frequency"]
          id?: string
          last_failure_at?: string | null
          last_failure_reason?: string | null
          last_run_at?: string | null
          last_run_payment_intent_id?: string | null
          mandate_document_url?: string | null
          mandate_ip_address?: string | null
          mandate_signed_at?: string | null
          mandate_user_agent?: string | null
          next_run_date?: string | null
          owner_id: string
          paused_at?: string | null
          paused_reason?: string | null
          payment_method_id: string
          portfolio_id: string
          processor_mandate_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["autopay_status"]
          success_count?: number
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          association_id?: string | null
          authorized_amount_max_cents?: number
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          day_of_month?: number | null
          end_date?: string | null
          failure_count?: number
          frequency?: Database["public"]["Enums"]["autopay_frequency"]
          id?: string
          last_failure_at?: string | null
          last_failure_reason?: string | null
          last_run_at?: string | null
          last_run_payment_intent_id?: string | null
          mandate_document_url?: string | null
          mandate_ip_address?: string | null
          mandate_signed_at?: string | null
          mandate_user_agent?: string | null
          next_run_date?: string | null
          owner_id?: string
          paused_at?: string | null
          paused_reason?: string | null
          payment_method_id?: string
          portfolio_id?: string
          processor_mandate_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["autopay_status"]
          success_count?: number
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "autopay_mandates_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "autopay_mandates_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "autopay_mandates_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopay_mandates_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "autopay_mandates_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "autopay_mandates_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "autopay_mandates_last_run_payment_intent_id_fkey"
            columns: ["last_run_payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopay_mandates_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopay_mandates_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "autopay_mandates_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopay_mandates_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopay_mandates_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "autopay_mandates_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "autopay_mandates_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "delinquent_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "autopay_mandates_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "autopay_mandates_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopay_mandates_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "autopay_mandates_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_unit_account_summary"
            referencedColumns: ["unit_id"]
          },
        ]
      }
      ballots: {
        Row: {
          archived_at: string | null
          association_id: string
          ballot_type: string
          closes_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          opens_at: string | null
          options: Json
          quorum_pct: number | null
          require_quorum: boolean
          results: Json | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          association_id: string
          ballot_type?: string
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          opens_at?: string | null
          options?: Json
          quorum_pct?: number | null
          require_quorum?: boolean
          results?: Json | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          association_id?: string
          ballot_type?: string
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          opens_at?: string | null
          options?: Json
          quorum_pct?: number | null
          require_quorum?: boolean
          results?: Json | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ballots_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "ballots_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "ballots_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ballots_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "ballots_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "ballots_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
        ]
      }
      bank_account_owners: {
        Row: {
          bank_account_id: string
          created_at: string
          full_name: string
          id: string
          owner_id: string | null
          role: string | null
        }
        Insert: {
          bank_account_id: string
          created_at?: string
          full_name: string
          id?: string
          owner_id?: string | null
          role?: string | null
        }
        Update: {
          bank_account_id?: string
          created_at?: string
          full_name?: string
          id?: string
          owner_id?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_account_owners_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_account_owners_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_account_owners_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["owner_id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          account_type: Database["public"]["Enums"]["bank_account_type"]
          address_city: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          archived_at: string | null
          association_id: string | null
          auto_reconciliation: boolean
          bank_name: string | null
          check_signature: string | null
          company_address: string | null
          company_name: string | null
          created_at: string
          description: string | null
          entity_address: string | null
          entity_name: string | null
          gl_account_id: string | null
          id: string
          last_reconciliation_date: string | null
          name: string
          next_check_number: number | null
          payments_enabled: boolean
          portfolio_id: string
          purpose: Database["public"]["Enums"]["bank_account_purpose"]
          routing_number: string | null
          updated_at: string
          use_printable_deposit_slip: boolean
        }
        Insert: {
          account_number?: string | null
          account_type?: Database["public"]["Enums"]["bank_account_type"]
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          archived_at?: string | null
          association_id?: string | null
          auto_reconciliation?: boolean
          bank_name?: string | null
          check_signature?: string | null
          company_address?: string | null
          company_name?: string | null
          created_at?: string
          description?: string | null
          entity_address?: string | null
          entity_name?: string | null
          gl_account_id?: string | null
          id?: string
          last_reconciliation_date?: string | null
          name: string
          next_check_number?: number | null
          payments_enabled?: boolean
          portfolio_id: string
          purpose?: Database["public"]["Enums"]["bank_account_purpose"]
          routing_number?: string | null
          updated_at?: string
          use_printable_deposit_slip?: boolean
        }
        Update: {
          account_number?: string | null
          account_type?: Database["public"]["Enums"]["bank_account_type"]
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          archived_at?: string | null
          association_id?: string | null
          auto_reconciliation?: boolean
          bank_name?: string | null
          check_signature?: string | null
          company_address?: string | null
          company_name?: string | null
          created_at?: string
          description?: string | null
          entity_address?: string | null
          entity_name?: string | null
          gl_account_id?: string | null
          id?: string
          last_reconciliation_date?: string | null
          name?: string
          next_check_number?: number | null
          payments_enabled?: boolean
          portfolio_id?: string
          purpose?: Database["public"]["Enums"]["bank_account_purpose"]
          routing_number?: string | null
          updated_at?: string
          use_printable_deposit_slip?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "bank_accounts_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "bank_accounts_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "bank_accounts_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "bank_accounts_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "bank_accounts_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "bank_accounts_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      bank_transfers: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          from_bank_account_id: string
          id: string
          journal_entry_id: string | null
          memo: string | null
          portfolio_id: string
          reference_number: string | null
          to_bank_account_id: string
          transfer_date: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          from_bank_account_id: string
          id?: string
          journal_entry_id?: string | null
          memo?: string | null
          portfolio_id: string
          reference_number?: string | null
          to_bank_account_id: string
          transfer_date?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          from_bank_account_id?: string
          id?: string
          journal_entry_id?: string | null
          memo?: string | null
          portfolio_id?: string
          reference_number?: string | null
          to_bank_account_id?: string
          transfer_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transfers_from_bank_account_id_fkey"
            columns: ["from_bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transfers_journal_entry_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transfers_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transfers_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "bank_transfers_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "bank_transfers_to_bank_account_id_fkey"
            columns: ["to_bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      board_approval_settings: {
        Row: {
          association_id: string
          bills_threshold: number | null
          created_at: string
          default_board_member_ids: string[]
          default_percentage_required: number | null
          default_voting_scheme: Database["public"]["Enums"]["voting_scheme"]
          sends_bills_to_board: string
          signatures_required: boolean
          updated_at: string
        }
        Insert: {
          association_id: string
          bills_threshold?: number | null
          created_at?: string
          default_board_member_ids?: string[]
          default_percentage_required?: number | null
          default_voting_scheme?: Database["public"]["Enums"]["voting_scheme"]
          sends_bills_to_board?: string
          signatures_required?: boolean
          updated_at?: string
        }
        Update: {
          association_id?: string
          bills_threshold?: number | null
          created_at?: string
          default_board_member_ids?: string[]
          default_percentage_required?: number | null
          default_voting_scheme?: Database["public"]["Enums"]["voting_scheme"]
          sends_bills_to_board?: string
          signatures_required?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_approval_settings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: true
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "board_approval_settings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: true
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "board_approval_settings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: true
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_approval_settings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: true
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "board_approval_settings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: true
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "board_approval_settings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: true
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
        ]
      }
      board_members: {
        Row: {
          active: boolean
          association_id: string
          auth_user_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          owner_id: string | null
          phone: string | null
          role: Database["public"]["Enums"]["board_role"]
          signature_on_file: boolean
          signature_url: string | null
          term_end: string | null
          term_start: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          association_id: string
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          owner_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["board_role"]
          signature_on_file?: boolean
          signature_url?: string | null
          term_end?: string | null
          term_start?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          association_id?: string
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          owner_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["board_role"]
          signature_on_file?: boolean
          signature_url?: string | null
          term_end?: string | null
          term_start?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_members_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "board_members_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "board_members_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_members_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "board_members_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "board_members_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "board_members_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_members_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["owner_id"]
          },
        ]
      }
      budget_lines: {
        Row: {
          association_id: string
          category: Database["public"]["Enums"]["budget_category"]
          created_at: string
          fiscal_year: number
          gl_account_id: string
          id: string
          monthly_amounts: number[]
          notes: string | null
          updated_at: string
        }
        Insert: {
          association_id: string
          category: Database["public"]["Enums"]["budget_category"]
          created_at?: string
          fiscal_year: number
          gl_account_id: string
          id?: string
          monthly_amounts?: number[]
          notes?: string | null
          updated_at?: string
        }
        Update: {
          association_id?: string
          category?: Database["public"]["Enums"]["budget_category"]
          created_at?: string
          fiscal_year?: number
          gl_account_id?: string
          id?: string
          monthly_amounts?: number[]
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_lines_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "budget_lines_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "budget_lines_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "budget_lines_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "budget_lines_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "budget_lines_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      buildings: {
        Row: {
          address: string
          address_line_2: string | null
          amenities: Json | null
          archived_at: string | null
          association_id: string
          city: string | null
          county: string | null
          created_at: string
          description: string | null
          disable_online_maintenance_requests: boolean | null
          home_warranty_covered: boolean | null
          id: string
          insurance_expiration: string | null
          is_primary: boolean | null
          lockbox_id: string | null
          maintenance_limit: number | null
          maintenance_notes: string | null
          management_start_date: string | null
          name: string
          online_maintenance_request_instructions: string | null
          property_type: string | null
          site_manager: string | null
          site_manager_phone: string | null
          state: string | null
          unit_entry_pre_authorized: boolean | null
          year_built: number | null
          zip: string | null
        }
        Insert: {
          address: string
          address_line_2?: string | null
          amenities?: Json | null
          archived_at?: string | null
          association_id: string
          city?: string | null
          county?: string | null
          created_at?: string
          description?: string | null
          disable_online_maintenance_requests?: boolean | null
          home_warranty_covered?: boolean | null
          id?: string
          insurance_expiration?: string | null
          is_primary?: boolean | null
          lockbox_id?: string | null
          maintenance_limit?: number | null
          maintenance_notes?: string | null
          management_start_date?: string | null
          name: string
          online_maintenance_request_instructions?: string | null
          property_type?: string | null
          site_manager?: string | null
          site_manager_phone?: string | null
          state?: string | null
          unit_entry_pre_authorized?: boolean | null
          year_built?: number | null
          zip?: string | null
        }
        Update: {
          address?: string
          address_line_2?: string | null
          amenities?: Json | null
          archived_at?: string | null
          association_id?: string
          city?: string | null
          county?: string | null
          created_at?: string
          description?: string | null
          disable_online_maintenance_requests?: boolean | null
          home_warranty_covered?: boolean | null
          id?: string
          insurance_expiration?: string | null
          is_primary?: boolean | null
          lockbox_id?: string | null
          maintenance_limit?: number | null
          maintenance_notes?: string | null
          management_start_date?: string | null
          name?: string
          online_maintenance_request_instructions?: string | null
          property_type?: string | null
          site_manager?: string | null
          site_manager_phone?: string | null
          state?: string | null
          unit_entry_pre_authorized?: boolean | null
          year_built?: number | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          archived_at: string | null
          association_id: string | null
          attendees: Json
          calendar_scope: Database["public"]["Enums"]["calendar_scope"]
          created_at: string
          created_by: string | null
          description: string | null
          end_datetime: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          location: string | null
          maintenance_instructions: string | null
          maintenance_notified_at: string | null
          maintenance_notify_error: string | null
          notify_maintenance: boolean
          notify_sms: boolean
          portfolio_id: string
          recurrence_rule: string | null
          reminder_acknowledged_at: string | null
          reminder_acknowledged_by: string | null
          reminder_days_before: number | null
          reminder_triggered_at: string | null
          sms_notified_at: string | null
          sms_notify_error: string | null
          start_datetime: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          archived_at?: string | null
          association_id?: string | null
          attendees?: Json
          calendar_scope?: Database["public"]["Enums"]["calendar_scope"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_datetime?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          location?: string | null
          maintenance_instructions?: string | null
          maintenance_notified_at?: string | null
          maintenance_notify_error?: string | null
          notify_maintenance?: boolean
          notify_sms?: boolean
          portfolio_id: string
          recurrence_rule?: string | null
          reminder_acknowledged_at?: string | null
          reminder_acknowledged_by?: string | null
          reminder_days_before?: number | null
          reminder_triggered_at?: string | null
          sms_notified_at?: string | null
          sms_notify_error?: string | null
          start_datetime: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          archived_at?: string | null
          association_id?: string | null
          attendees?: Json
          calendar_scope?: Database["public"]["Enums"]["calendar_scope"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_datetime?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          location?: string | null
          maintenance_instructions?: string | null
          maintenance_notified_at?: string | null
          maintenance_notify_error?: string | null
          notify_maintenance?: boolean
          notify_sms?: boolean
          portfolio_id?: string
          recurrence_rule?: string | null
          reminder_acknowledged_at?: string | null
          reminder_acknowledged_by?: string | null
          reminder_days_before?: number | null
          reminder_triggered_at?: string | null
          sms_notified_at?: string | null
          sms_notify_error?: string | null
          start_datetime?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "calendar_events_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "calendar_events_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "calendar_events_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "calendar_events_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "calendar_events_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "calendar_events_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      charge_categories: {
        Row: {
          active: boolean
          applies_by_default: boolean
          archived_at: string | null
          association_id: string | null
          charge_type: Database["public"]["Enums"]["charge_type"]
          code: string | null
          color: string | null
          created_at: string
          created_by: string | null
          default_amount: number
          default_frequency: Database["public"]["Enums"]["recurring_frequency"]
          description: string | null
          gl_account_id: string | null
          icon: string | null
          id: string
          is_assessment: boolean
          is_fee: boolean
          is_income: boolean
          is_system: boolean
          name: string
          portfolio_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          applies_by_default?: boolean
          archived_at?: string | null
          association_id?: string | null
          charge_type?: Database["public"]["Enums"]["charge_type"]
          code?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          default_amount?: number
          default_frequency?: Database["public"]["Enums"]["recurring_frequency"]
          description?: string | null
          gl_account_id?: string | null
          icon?: string | null
          id?: string
          is_assessment?: boolean
          is_fee?: boolean
          is_income?: boolean
          is_system?: boolean
          name: string
          portfolio_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          applies_by_default?: boolean
          archived_at?: string | null
          association_id?: string | null
          charge_type?: Database["public"]["Enums"]["charge_type"]
          code?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          default_amount?: number
          default_frequency?: Database["public"]["Enums"]["recurring_frequency"]
          description?: string | null
          gl_account_id?: string | null
          icon?: string | null
          id?: string
          is_assessment?: boolean
          is_fee?: boolean
          is_income?: boolean
          is_system?: boolean
          name?: string
          portfolio_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "charge_categories_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "charge_categories_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "charge_categories_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charge_categories_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "charge_categories_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "charge_categories_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "charge_categories_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charge_categories_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charge_categories_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "charge_categories_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      charges: {
        Row: {
          amount: number
          assessment_period_id: string | null
          charge_category_id: string | null
          charge_type: Database["public"]["Enums"]["charge_type"]
          created_at: string
          created_by: string | null
          description: string
          due_date: string
          gl_account_id: string | null
          id: string
          unit_id: string
        }
        Insert: {
          amount: number
          assessment_period_id?: string | null
          charge_category_id?: string | null
          charge_type?: Database["public"]["Enums"]["charge_type"]
          created_at?: string
          created_by?: string | null
          description: string
          due_date: string
          gl_account_id?: string | null
          id?: string
          unit_id: string
        }
        Update: {
          amount?: number
          assessment_period_id?: string | null
          charge_category_id?: string | null
          charge_type?: Database["public"]["Enums"]["charge_type"]
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string
          gl_account_id?: string | null
          id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "charges_assessment_period_id_fkey"
            columns: ["assessment_period_id"]
            isOneToOne: false
            referencedRelation: "assessment_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_charge_category_id_fkey"
            columns: ["charge_category_id"]
            isOneToOne: false
            referencedRelation: "charge_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_charge_category_id_fkey"
            columns: ["charge_category_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "charges_charge_category_id_fkey"
            columns: ["charge_category_id"]
            isOneToOne: false
            referencedRelation: "v_unit_charge_schedule"
            referencedColumns: ["charge_category_id"]
          },
          {
            foreignKeyName: "charges_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "delinquent_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_unit_account_summary"
            referencedColumns: ["unit_id"]
          },
        ]
      }
      committee_members: {
        Row: {
          committee_id: string
          created_at: string
          id: string
          joined_at: string
          left_at: string | null
          owner_id: string | null
          role: string
        }
        Insert: {
          committee_id: string
          created_at?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          owner_id?: string | null
          role?: string
        }
        Update: {
          committee_id?: string
          created_at?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          owner_id?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_members_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_members_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_members_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["owner_id"]
          },
        ]
      }
      committees: {
        Row: {
          archived_at: string | null
          association_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          association_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          association_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "committees_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "committees_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "committees_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committees_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "committees_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "committees_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
        ]
      }
      communication_triggers: {
        Row: {
          active: boolean
          association_id: string | null
          channel: Database["public"]["Enums"]["communication_channel"]
          created_at: string
          created_by: string | null
          delay_days: number
          description: string | null
          id: string
          last_fired_at: string | null
          name: string
          portfolio_id: string
          recipient_rule: string | null
          template_id: string | null
          trigger_event: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          association_id?: string | null
          channel?: Database["public"]["Enums"]["communication_channel"]
          created_at?: string
          created_by?: string | null
          delay_days?: number
          description?: string | null
          id?: string
          last_fired_at?: string | null
          name: string
          portfolio_id: string
          recipient_rule?: string | null
          template_id?: string | null
          trigger_event: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          association_id?: string | null
          channel?: Database["public"]["Enums"]["communication_channel"]
          created_at?: string
          created_by?: string | null
          delay_days?: number
          description?: string | null
          id?: string
          last_fired_at?: string | null
          name?: string
          portfolio_id?: string
          recipient_rule?: string | null
          template_id?: string | null
          trigger_event?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_triggers_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "communication_triggers_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "communication_triggers_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_triggers_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "communication_triggers_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "communication_triggers_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "communication_triggers_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_triggers_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "communication_triggers_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "communication_triggers_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      data_diagnostics: {
        Row: {
          category: string
          details: string | null
          entity_id: string | null
          entity_type: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          occurrence_count: number
          portfolio_id: string
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["diagnostic_severity"]
          title: string
        }
        Insert: {
          category: string
          details?: string | null
          entity_id?: string | null
          entity_type?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          occurrence_count?: number
          portfolio_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["diagnostic_severity"]
          title: string
        }
        Update: {
          category?: string
          details?: string | null
          entity_id?: string | null
          entity_type?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          occurrence_count?: number
          portfolio_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["diagnostic_severity"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_diagnostics_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_diagnostics_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "data_diagnostics_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      data_export_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          download_count: number
          error_message: string | null
          expires_at: string | null
          file_size_bytes: number | null
          file_url: string | null
          format: string
          id: string
          portfolio_id: string | null
          requested_by: string | null
          scope: Database["public"]["Enums"]["export_scope"]
          started_at: string | null
          status: Database["public"]["Enums"]["export_status"]
          subject_auth_user_id: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          download_count?: number
          error_message?: string | null
          expires_at?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          format?: string
          id?: string
          portfolio_id?: string | null
          requested_by?: string | null
          scope?: Database["public"]["Enums"]["export_scope"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["export_status"]
          subject_auth_user_id?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          download_count?: number
          error_message?: string | null
          expires_at?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          format?: string
          id?: string
          portfolio_id?: string | null
          requested_by?: string | null
          scope?: Database["public"]["Enums"]["export_scope"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["export_status"]
          subject_auth_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_export_requests_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_export_requests_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "data_export_requests_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      depreciation_entries: {
        Row: {
          amount: number
          created_at: string
          fixed_asset_id: string
          id: string
          journal_entry_id: string | null
          notes: string | null
          period_month: number
          period_year: number
        }
        Insert: {
          amount: number
          created_at?: string
          fixed_asset_id: string
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          period_month: number
          period_year: number
        }
        Update: {
          amount?: number
          created_at?: string
          fixed_asset_id?: string
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          period_month?: number
          period_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "depreciation_entries_fixed_asset_id_fkey"
            columns: ["fixed_asset_id"]
            isOneToOne: false
            referencedRelation: "fixed_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depreciation_entries_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      document_requests: {
        Row: {
          attachment_urls: Json
          created_at: string
          description: string | null
          doc_type: string
          due_date: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string | null
          portfolio_id: string
          requested_at: string
          requested_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["document_request_status"]
          submitted_at: string | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          attachment_urls?: Json
          created_at?: string
          description?: string | null
          doc_type: string
          due_date?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id?: string | null
          portfolio_id: string
          requested_at?: string
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["document_request_status"]
          submitted_at?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          attachment_urls?: Json
          created_at?: string
          description?: string | null
          doc_type?: string
          due_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string | null
          portfolio_id?: string
          requested_at?: string
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["document_request_status"]
          submitted_at?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_requests_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "document_requests_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "document_requests_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "document_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_insurance_expirations"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "document_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          active: boolean
          archived_at: string | null
          attachments: Json
          body: string
          created_at: string
          created_by: string | null
          id: string
          letter_type: string | null
          merge_variables: Json
          name: string
          portfolio_id: string
          subject: string | null
          template_category: Database["public"]["Enums"]["template_category"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          attachments?: Json
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          letter_type?: string | null
          merge_variables?: Json
          name: string
          portfolio_id: string
          subject?: string | null
          template_category?: Database["public"]["Enums"]["template_category"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          attachments?: Json
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          letter_type?: string | null
          merge_variables?: Json
          name?: string
          portfolio_id?: string
          subject?: string | null
          template_category?: Database["public"]["Enums"]["template_category"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_templates_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "document_templates_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      documents: {
        Row: {
          doc_type: string
          entity_id: string
          entity_type: string
          expires_at: string | null
          file_name: string
          file_url: string
          id: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          doc_type: string
          entity_id: string
          entity_type: string
          expires_at?: string | null
          file_name: string
          file_url: string
          id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          doc_type?: string
          entity_id?: string
          entity_type?: string
          expires_at?: string | null
          file_name?: string
          file_url?: string
          id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      dues_increase_lines: {
        Row: {
          change_type: string
          change_value: number | null
          created_at: string
          dues_increase_id: string
          id: string
          letter_generated_at: string | null
          new_amount: number
          occupancy_id: string
          old_amount: number
          unit_id: string
        }
        Insert: {
          change_type?: string
          change_value?: number | null
          created_at?: string
          dues_increase_id: string
          id?: string
          letter_generated_at?: string | null
          new_amount: number
          occupancy_id: string
          old_amount: number
          unit_id: string
        }
        Update: {
          change_type?: string
          change_value?: number | null
          created_at?: string
          dues_increase_id?: string
          id?: string
          letter_generated_at?: string | null
          new_amount?: number
          occupancy_id?: string
          old_amount?: number
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dues_increase_lines_dues_increase_id_fkey"
            columns: ["dues_increase_id"]
            isOneToOne: false
            referencedRelation: "dues_increases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dues_increase_lines_occupancy_id_fkey"
            columns: ["occupancy_id"]
            isOneToOne: false
            referencedRelation: "occupancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dues_increase_lines_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "delinquent_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "dues_increase_lines_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "dues_increase_lines_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dues_increase_lines_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "dues_increase_lines_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_unit_account_summary"
            referencedColumns: ["unit_id"]
          },
        ]
      }
      dues_increases: {
        Row: {
          association_id: string
          created_at: string
          created_by: string | null
          effective_date: string
          id: string
          letter_template_id: string | null
          name: string
          notes: string | null
          portfolio_id: string
          posted_at: string | null
          posted_by: string | null
          status: Database["public"]["Enums"]["dues_increase_status"]
          updated_at: string
        }
        Insert: {
          association_id: string
          created_at?: string
          created_by?: string | null
          effective_date: string
          id?: string
          letter_template_id?: string | null
          name: string
          notes?: string | null
          portfolio_id: string
          posted_at?: string | null
          posted_by?: string | null
          status?: Database["public"]["Enums"]["dues_increase_status"]
          updated_at?: string
        }
        Update: {
          association_id?: string
          created_at?: string
          created_by?: string | null
          effective_date?: string
          id?: string
          letter_template_id?: string | null
          name?: string
          notes?: string | null
          portfolio_id?: string
          posted_at?: string | null
          posted_by?: string | null
          status?: Database["public"]["Enums"]["dues_increase_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dues_increases_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "dues_increases_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "dues_increases_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dues_increases_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "dues_increases_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "dues_increases_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "dues_increases_letter_template_id_fkey"
            columns: ["letter_template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dues_increases_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dues_increases_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "dues_increases_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      email_queue: {
        Row: {
          association_id: string | null
          body: string
          created_at: string
          error_message: string | null
          id: string
          notice_id: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          subject: string
          template_id: string | null
          to_email: string
          to_name: string | null
        }
        Insert: {
          association_id?: string | null
          body: string
          created_at?: string
          error_message?: string | null
          id?: string
          notice_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject: string
          template_id?: string | null
          to_email: string
          to_name?: string | null
        }
        Update: {
          association_id?: string | null
          body?: string
          created_at?: string
          error_message?: string | null
          id?: string
          notice_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject?: string
          template_id?: string | null
          to_email?: string
          to_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "email_queue_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "email_queue_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "email_queue_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "email_queue_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "email_queue_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "notices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_entitlements: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          key: string
          min_tier: Database["public"]["Enums"]["portfolio_tier"]
          name: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key: string
          min_tier?: Database["public"]["Enums"]["portfolio_tier"]
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          min_tier?: Database["public"]["Enums"]["portfolio_tier"]
          name?: string
        }
        Relationships: []
      }
      fixed_assets: {
        Row: {
          accumulated_depreciation: number
          archived_at: string | null
          asset_type: string | null
          association_id: string | null
          created_at: string
          created_by: string | null
          depreciation_method: Database["public"]["Enums"]["depreciation_method"]
          description: string | null
          disposed_amount: number | null
          disposed_at: string | null
          gl_account_id: string | null
          id: string
          name: string
          portfolio_id: string
          purchase_date: string | null
          purchase_price: number | null
          salvage_value: number
          status: Database["public"]["Enums"]["asset_status"]
          unit_id: string | null
          updated_at: string
          useful_life_years: number | null
        }
        Insert: {
          accumulated_depreciation?: number
          archived_at?: string | null
          asset_type?: string | null
          association_id?: string | null
          created_at?: string
          created_by?: string | null
          depreciation_method?: Database["public"]["Enums"]["depreciation_method"]
          description?: string | null
          disposed_amount?: number | null
          disposed_at?: string | null
          gl_account_id?: string | null
          id?: string
          name: string
          portfolio_id: string
          purchase_date?: string | null
          purchase_price?: number | null
          salvage_value?: number
          status?: Database["public"]["Enums"]["asset_status"]
          unit_id?: string | null
          updated_at?: string
          useful_life_years?: number | null
        }
        Update: {
          accumulated_depreciation?: number
          archived_at?: string | null
          asset_type?: string | null
          association_id?: string | null
          created_at?: string
          created_by?: string | null
          depreciation_method?: Database["public"]["Enums"]["depreciation_method"]
          description?: string | null
          disposed_amount?: number | null
          disposed_at?: string | null
          gl_account_id?: string | null
          id?: string
          name?: string
          portfolio_id?: string
          purchase_date?: string | null
          purchase_price?: number | null
          salvage_value?: number
          status?: Database["public"]["Enums"]["asset_status"]
          unit_id?: string | null
          updated_at?: string
          useful_life_years?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fixed_assets_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "fixed_assets_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "fixed_assets_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "fixed_assets_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "fixed_assets_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "fixed_assets_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "fixed_assets_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "fixed_assets_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "delinquent_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "fixed_assets_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "fixed_assets_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "fixed_assets_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_unit_account_summary"
            referencedColumns: ["unit_id"]
          },
        ]
      }
      form_templates: {
        Row: {
          active: boolean
          archived_at: string | null
          created_at: string
          description: string | null
          field_definitions: Json
          file_url: string | null
          form_type: string | null
          id: string
          name: string
          portfolio_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          created_at?: string
          description?: string | null
          field_definitions?: Json
          file_url?: string | null
          form_type?: string | null
          id?: string
          name: string
          portfolio_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          created_at?: string
          description?: string | null
          field_definitions?: Json
          file_url?: string | null
          form_type?: string | null
          id?: string
          name?: string
          portfolio_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_templates_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_templates_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "form_templates_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      gl_account_role_permissions: {
        Row: {
          created_at: string
          gl_account_id: string
          id: string
          permission: Database["public"]["Enums"]["gl_permission"]
          role_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gl_account_id: string
          id?: string
          permission?: Database["public"]["Enums"]["gl_permission"]
          role_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gl_account_id?: string
          id?: string
          permission?: Database["public"]["Enums"]["gl_permission"]
          role_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gl_account_role_permissions_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_account_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["gl_account_type"]
          active: boolean
          association_id: string | null
          created_at: string
          description: string | null
          fund_account: Database["public"]["Enums"]["gl_fund_account"] | null
          id: string
          include_on_cash_flow: boolean
          name: string
          number: number
          portfolio_id: string
          sub_account_of_id: string | null
          subject_to_management_fees: boolean
          updated_at: string
        }
        Insert: {
          account_type: Database["public"]["Enums"]["gl_account_type"]
          active?: boolean
          association_id?: string | null
          created_at?: string
          description?: string | null
          fund_account?: Database["public"]["Enums"]["gl_fund_account"] | null
          id?: string
          include_on_cash_flow?: boolean
          name: string
          number: number
          portfolio_id: string
          sub_account_of_id?: string | null
          subject_to_management_fees?: boolean
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["gl_account_type"]
          active?: boolean
          association_id?: string | null
          created_at?: string
          description?: string | null
          fund_account?: Database["public"]["Enums"]["gl_fund_account"] | null
          id?: string
          include_on_cash_flow?: boolean
          name?: string
          number?: number
          portfolio_id?: string
          sub_account_of_id?: string | null
          subject_to_management_fees?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gl_accounts_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "gl_accounts_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "gl_accounts_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_accounts_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "gl_accounts_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "gl_accounts_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "gl_accounts_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_accounts_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "gl_accounts_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "gl_accounts_sub_account_of_id_fkey"
            columns: ["sub_account_of_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      income_recertifications: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          association_id: string | null
          created_at: string
          current_income: number | null
          documents: Json
          due_date: string
          household_size: number | null
          id: string
          notes: string | null
          occupancy_id: string | null
          owner_id: string | null
          portfolio_id: string
          previous_income: number | null
          program: string | null
          status: Database["public"]["Enums"]["recert_status"]
          submitted_at: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          association_id?: string | null
          created_at?: string
          current_income?: number | null
          documents?: Json
          due_date: string
          household_size?: number | null
          id?: string
          notes?: string | null
          occupancy_id?: string | null
          owner_id?: string | null
          portfolio_id: string
          previous_income?: number | null
          program?: string | null
          status?: Database["public"]["Enums"]["recert_status"]
          submitted_at?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          association_id?: string | null
          created_at?: string
          current_income?: number | null
          documents?: Json
          due_date?: string
          household_size?: number | null
          id?: string
          notes?: string | null
          occupancy_id?: string | null
          owner_id?: string | null
          portfolio_id?: string
          previous_income?: number | null
          program?: string | null
          status?: Database["public"]["Enums"]["recert_status"]
          submitted_at?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_recertifications_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "income_recertifications_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "income_recertifications_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_recertifications_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "income_recertifications_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "income_recertifications_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "income_recertifications_occupancy_id_fkey"
            columns: ["occupancy_id"]
            isOneToOne: false
            referencedRelation: "occupancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_recertifications_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_recertifications_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "income_recertifications_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_recertifications_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "income_recertifications_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "income_recertifications_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "delinquent_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "income_recertifications_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "income_recertifications_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_recertifications_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "income_recertifications_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_unit_account_summary"
            referencedColumns: ["unit_id"]
          },
        ]
      }
      inspection_items: {
        Row: {
          area: string | null
          created_at: string
          id: string
          inspection_id: string
          issue: string
          photo_urls: Json
          resolution_notes: string | null
          resolved: boolean
          resolved_at: string | null
          severity: Database["public"]["Enums"]["inspection_severity"]
          sort_order: number
          updated_at: string
          work_order_id: string | null
        }
        Insert: {
          area?: string | null
          created_at?: string
          id?: string
          inspection_id: string
          issue: string
          photo_urls?: Json
          resolution_notes?: string | null
          resolved?: boolean
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["inspection_severity"]
          sort_order?: number
          updated_at?: string
          work_order_id?: string | null
        }
        Update: {
          area?: string | null
          created_at?: string
          id?: string
          inspection_id?: string
          issue?: string
          photo_urls?: Json
          resolution_notes?: string | null
          resolved?: boolean
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["inspection_severity"]
          sort_order?: number
          updated_at?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_items_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          archived_at: string | null
          association_id: string
          completed_date: string | null
          created_at: string
          created_by: string | null
          id: string
          inspection_type: string | null
          inspector_user_id: string | null
          inspector_vendor_id: string | null
          notes: string | null
          portfolio_id: string
          scheduled_date: string | null
          status: Database["public"]["Enums"]["inspection_status"]
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          association_id: string
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          inspection_type?: string | null
          inspector_user_id?: string | null
          inspector_vendor_id?: string | null
          notes?: string | null
          portfolio_id: string
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["inspection_status"]
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          association_id?: string
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          inspection_type?: string | null
          inspector_user_id?: string | null
          inspector_vendor_id?: string | null
          notes?: string | null
          portfolio_id?: string
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["inspection_status"]
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "inspections_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "inspections_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "inspections_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "inspections_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "inspections_inspector_vendor_id_fkey"
            columns: ["inspector_vendor_id"]
            isOneToOne: false
            referencedRelation: "v_insurance_expirations"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "inspections_inspector_vendor_id_fkey"
            columns: ["inspector_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "inspections_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "inspections_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "delinquent_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "inspections_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "inspections_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "inspections_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_unit_account_summary"
            referencedColumns: ["unit_id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          batch_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          entry_date: string
          id: string
          memo: string | null
          portfolio_id: string
          posted: boolean
          posted_at: string | null
          reference_number: string | null
          source_id: string | null
          source_type: string | null
          updated_at: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          id?: string
          memo?: string | null
          portfolio_id: string
          posted?: boolean
          posted_at?: string | null
          reference_number?: string | null
          source_id?: string | null
          source_type?: string | null
          updated_at?: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          id?: string
          memo?: string | null
          portfolio_id?: string
          posted?: boolean
          posted_at?: string | null
          reference_number?: string | null
          source_id?: string | null
          source_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "journal_entry_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "journal_entries_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      journal_entry_batches: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          error_message: string | null
          id: string
          name: string
          portfolio_id: string
          posted_at: string | null
          posted_by: string | null
          status: Database["public"]["Enums"]["je_batch_status"]
          total_credit: number
          total_debit: number
          total_entries: number
          updated_at: string
          upload_url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          name: string
          portfolio_id: string
          posted_at?: string | null
          posted_by?: string | null
          status?: Database["public"]["Enums"]["je_batch_status"]
          total_credit?: number
          total_debit?: number
          total_entries?: number
          updated_at?: string
          upload_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          name?: string
          portfolio_id?: string
          posted_at?: string | null
          posted_by?: string | null
          status?: Database["public"]["Enums"]["je_batch_status"]
          total_credit?: number
          total_debit?: number
          total_entries?: number
          updated_at?: string
          upload_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_batches_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_batches_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "journal_entry_batches_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          association_id: string | null
          created_at: string
          credit_amount: number
          debit_amount: number
          entry_id: string
          gl_account_id: string
          id: string
          memo: string | null
          sort_order: number
        }
        Insert: {
          association_id?: string | null
          created_at?: string
          credit_amount?: number
          debit_amount?: number
          entry_id: string
          gl_account_id: string
          id?: string
          memo?: string | null
          sort_order?: number
        }
        Update: {
          association_id?: string | null
          created_at?: string
          credit_amount?: number
          debit_amount?: number
          entry_id?: string
          gl_account_id?: string
          id?: string
          memo?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "journal_lines_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "journal_lines_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "journal_lines_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "journal_lines_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      lockbox_batches: {
        Row: {
          bank_account_id: string | null
          batch_date: string
          created_at: string
          deposit_reference: string | null
          deposited_at: string | null
          id: string
          notes: string | null
          portfolio_id: string
          provider: string
          provider_batch_id: string | null
          received_at: string
          reconciled_at: string | null
          status: Database["public"]["Enums"]["lockbox_batch_status"]
          total_amount_cents: number
          total_items: number
          updated_at: string
        }
        Insert: {
          bank_account_id?: string | null
          batch_date?: string
          created_at?: string
          deposit_reference?: string | null
          deposited_at?: string | null
          id?: string
          notes?: string | null
          portfolio_id: string
          provider: string
          provider_batch_id?: string | null
          received_at?: string
          reconciled_at?: string | null
          status?: Database["public"]["Enums"]["lockbox_batch_status"]
          total_amount_cents?: number
          total_items?: number
          updated_at?: string
        }
        Update: {
          bank_account_id?: string | null
          batch_date?: string
          created_at?: string
          deposit_reference?: string | null
          deposited_at?: string | null
          id?: string
          notes?: string | null
          portfolio_id?: string
          provider?: string
          provider_batch_id?: string | null
          received_at?: string
          reconciled_at?: string | null
          status?: Database["public"]["Enums"]["lockbox_batch_status"]
          total_amount_cents?: number
          total_items?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lockbox_batches_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lockbox_batches_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lockbox_batches_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "lockbox_batches_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      lockbox_items: {
        Row: {
          account_number_masked: string | null
          association_id: string | null
          batch_id: string
          check_amount_cents: number
          check_number: string | null
          created_at: string
          id: string
          manually_matched: boolean
          matched_confidence: number | null
          owner_id: string | null
          payer_name: string | null
          payment_id: string | null
          portfolio_id: string
          rejected: boolean
          rejection_reason: string | null
          routing_number: string | null
          scan_url: string | null
          unit_id: string | null
        }
        Insert: {
          account_number_masked?: string | null
          association_id?: string | null
          batch_id: string
          check_amount_cents: number
          check_number?: string | null
          created_at?: string
          id?: string
          manually_matched?: boolean
          matched_confidence?: number | null
          owner_id?: string | null
          payer_name?: string | null
          payment_id?: string | null
          portfolio_id: string
          rejected?: boolean
          rejection_reason?: string | null
          routing_number?: string | null
          scan_url?: string | null
          unit_id?: string | null
        }
        Update: {
          account_number_masked?: string | null
          association_id?: string | null
          batch_id?: string
          check_amount_cents?: number
          check_number?: string | null
          created_at?: string
          id?: string
          manually_matched?: boolean
          matched_confidence?: number | null
          owner_id?: string | null
          payer_name?: string | null
          payment_id?: string | null
          portfolio_id?: string
          rejected?: boolean
          rejection_reason?: string | null
          routing_number?: string | null
          scan_url?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lockbox_items_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "lockbox_items_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "lockbox_items_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lockbox_items_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "lockbox_items_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "lockbox_items_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "lockbox_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "lockbox_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lockbox_items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lockbox_items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "lockbox_items_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lockbox_items_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_unapplied_credits"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "lockbox_items_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lockbox_items_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "lockbox_items_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "lockbox_items_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "delinquent_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "lockbox_items_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "lockbox_items_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lockbox_items_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "lockbox_items_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_unit_account_summary"
            referencedColumns: ["unit_id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          at: string
          auth_user_id: string | null
          email: string | null
          failure_reason: string | null
          id: string
          ip_address: string | null
          mfa_used: boolean
          portfolio_id: string | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          at?: string
          auth_user_id?: string | null
          email?: string | null
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          mfa_used?: boolean
          portfolio_id?: string | null
          success: boolean
          user_agent?: string | null
        }
        Update: {
          at?: string
          auth_user_id?: string | null
          email?: string | null
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          mfa_used?: boolean
          portfolio_id?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "login_attempts_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "login_attempts_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "login_attempts_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      management_agreements: {
        Row: {
          archived_at: string | null
          association_id: string | null
          auto_renew: boolean
          created_at: string
          created_by: string | null
          document_url: string | null
          end_date: string | null
          id: string
          management_fee_schedule_id: string | null
          name: string
          notes: string | null
          owner_id: string | null
          portfolio_id: string
          renewal_term_months: number | null
          signed_at: string | null
          signed_by_manager: string | null
          signed_by_owner: string | null
          start_date: string
          status: Database["public"]["Enums"]["agreement_status"]
          termination_notice_days: number | null
          terms: Json
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          association_id?: string | null
          auto_renew?: boolean
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          end_date?: string | null
          id?: string
          management_fee_schedule_id?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          portfolio_id: string
          renewal_term_months?: number | null
          signed_at?: string | null
          signed_by_manager?: string | null
          signed_by_owner?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["agreement_status"]
          termination_notice_days?: number | null
          terms?: Json
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          association_id?: string | null
          auto_renew?: boolean
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          end_date?: string | null
          id?: string
          management_fee_schedule_id?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          portfolio_id?: string
          renewal_term_months?: number | null
          signed_at?: string | null
          signed_by_manager?: string | null
          signed_by_owner?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["agreement_status"]
          termination_notice_days?: number | null
          terms?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "management_agreements_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "management_agreements_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "management_agreements_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_agreements_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "management_agreements_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "management_agreements_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "management_agreements_management_fee_schedule_id_fkey"
            columns: ["management_fee_schedule_id"]
            isOneToOne: false
            referencedRelation: "management_fee_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_agreements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_agreements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "management_agreements_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_agreements_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "management_agreements_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      management_fee_policies: {
        Row: {
          amount: number
          association_id: string
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          fee_type: string
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          association_id: string
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          fee_type?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          association_id?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          fee_type?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "management_fee_policies_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "management_fee_policies_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "management_fee_policies_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_fee_policies_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "management_fee_policies_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "management_fee_policies_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
        ]
      }
      management_fee_schedules: {
        Row: {
          amount: number
          archived_at: string | null
          created_at: string
          fee_type: Database["public"]["Enums"]["management_fee_type"]
          id: string
          name: string
          notes: string | null
          percentage: number | null
          portfolio_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          archived_at?: string | null
          created_at?: string
          fee_type?: Database["public"]["Enums"]["management_fee_type"]
          id?: string
          name: string
          notes?: string | null
          percentage?: number | null
          portfolio_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          archived_at?: string | null
          created_at?: string
          fee_type?: Database["public"]["Enums"]["management_fee_type"]
          id?: string
          name?: string
          notes?: string | null
          percentage?: number | null
          portfolio_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "management_fee_schedules_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_fee_schedules_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "management_fee_schedules_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      notice_recipients: {
        Row: {
          created_at: string
          delivered_at: string | null
          email: string
          id: string
          name: string | null
          notice_id: string
          owner_id: string | null
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          email: string
          id?: string
          name?: string | null
          notice_id: string
          owner_id?: string | null
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          email?: string
          id?: string
          name?: string | null
          notice_id?: string
          owner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notice_recipients_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "notices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notice_recipients_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notice_recipients_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["owner_id"]
          },
        ]
      }
      notices: {
        Row: {
          archived_at: string | null
          association_id: string
          body: string
          channel: Database["public"]["Enums"]["communication_channel"]
          created_at: string
          created_by: string | null
          id: string
          notice_type: Database["public"]["Enums"]["notice_type"]
          send_to: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notice_status"]
          subject: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          association_id: string
          body: string
          channel?: Database["public"]["Enums"]["communication_channel"]
          created_at?: string
          created_by?: string | null
          id?: string
          notice_type?: Database["public"]["Enums"]["notice_type"]
          send_to?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notice_status"]
          subject: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          association_id?: string
          body?: string
          channel?: Database["public"]["Enums"]["communication_channel"]
          created_at?: string
          created_by?: string | null
          id?: string
          notice_type?: Database["public"]["Enums"]["notice_type"]
          send_to?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notice_status"]
          subject?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notices_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "notices_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "notices_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notices_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "notices_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "notices_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "notices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notices_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      occupancies: {
        Row: {
          association_id: string
          created_at: string
          dues_amount: number
          dues_frequency: Database["public"]["Enums"]["recurring_frequency"]
          dues_paid_through: string | null
          id: string
          is_primary: boolean
          last_dues_increase_amount: number | null
          last_dues_increase_date: string | null
          late_count: number
          move_in_date: string | null
          move_out_date: string | null
          next_scheduled_increase_amount: number | null
          next_scheduled_increase_date: string | null
          nsf_count: number
          occupancy_type: Database["public"]["Enums"]["occupancy_type"]
          online_payments_recurring_count: number
          online_payments_recurring_total: number
          online_portal_activated: boolean
          owner_id: string | null
          share_pct: number
          status: Database["public"]["Enums"]["occupancy_status"]
          unit_id: string
          updated_at: string
        }
        Insert: {
          association_id: string
          created_at?: string
          dues_amount?: number
          dues_frequency?: Database["public"]["Enums"]["recurring_frequency"]
          dues_paid_through?: string | null
          id?: string
          is_primary?: boolean
          last_dues_increase_amount?: number | null
          last_dues_increase_date?: string | null
          late_count?: number
          move_in_date?: string | null
          move_out_date?: string | null
          next_scheduled_increase_amount?: number | null
          next_scheduled_increase_date?: string | null
          nsf_count?: number
          occupancy_type?: Database["public"]["Enums"]["occupancy_type"]
          online_payments_recurring_count?: number
          online_payments_recurring_total?: number
          online_portal_activated?: boolean
          owner_id?: string | null
          share_pct?: number
          status?: Database["public"]["Enums"]["occupancy_status"]
          unit_id: string
          updated_at?: string
        }
        Update: {
          association_id?: string
          created_at?: string
          dues_amount?: number
          dues_frequency?: Database["public"]["Enums"]["recurring_frequency"]
          dues_paid_through?: string | null
          id?: string
          is_primary?: boolean
          last_dues_increase_amount?: number | null
          last_dues_increase_date?: string | null
          late_count?: number
          move_in_date?: string | null
          move_out_date?: string | null
          next_scheduled_increase_amount?: number | null
          next_scheduled_increase_date?: string | null
          nsf_count?: number
          occupancy_type?: Database["public"]["Enums"]["occupancy_type"]
          online_payments_recurring_count?: number
          online_payments_recurring_total?: number
          online_portal_activated?: boolean
          owner_id?: string | null
          share_pct?: number
          status?: Database["public"]["Enums"]["occupancy_status"]
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "occupancies_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "occupancies_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "occupancies_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occupancies_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "occupancies_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "occupancies_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "occupancies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occupancies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "occupancies_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "delinquent_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "occupancies_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "occupancies_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occupancies_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "occupancies_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_unit_account_summary"
            referencedColumns: ["unit_id"]
          },
        ]
      }
      owners: {
        Row: {
          address_city: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          archived_at: string | null
          auth_user_id: string | null
          created_at: string
          created_by: string | null
          electronic_consent: boolean
          electronic_consent_date: string | null
          email: string
          emails: Json
          first_name: string | null
          full_name: string
          id: string
          last_name: string | null
          mailing_address: string | null
          notes: string | null
          phone: string | null
          phone_numbers: Json
          portal_activated: boolean
          portal_login_last_at: string | null
          portfolio_id: string | null
          preferred_comm: string
        }
        Insert: {
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          archived_at?: string | null
          auth_user_id?: string | null
          created_at?: string
          created_by?: string | null
          electronic_consent?: boolean
          electronic_consent_date?: string | null
          email: string
          emails?: Json
          first_name?: string | null
          full_name: string
          id?: string
          last_name?: string | null
          mailing_address?: string | null
          notes?: string | null
          phone?: string | null
          phone_numbers?: Json
          portal_activated?: boolean
          portal_login_last_at?: string | null
          portfolio_id?: string | null
          preferred_comm?: string
        }
        Update: {
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          archived_at?: string | null
          auth_user_id?: string | null
          created_at?: string
          created_by?: string | null
          electronic_consent?: boolean
          electronic_consent_date?: string | null
          email?: string
          emails?: Json
          first_name?: string | null
          full_name?: string
          id?: string
          last_name?: string | null
          mailing_address?: string | null
          notes?: string | null
          phone?: string | null
          phone_numbers?: Json
          portal_activated?: boolean
          portal_login_last_at?: string | null
          portfolio_id?: string | null
          preferred_comm?: string
        }
        Relationships: [
          {
            foreignKeyName: "owners_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owners_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "owners_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      payable_bill_line_items: {
        Row: {
          amount: number
          association_id: string | null
          bill_id: string
          created_at: string
          description: string | null
          gl_account_id: string | null
          id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          amount: number
          association_id?: string | null
          bill_id: string
          created_at?: string
          description?: string | null
          gl_account_id?: string | null
          id?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          association_id?: string | null
          bill_id?: string
          created_at?: string
          description?: string | null
          gl_account_id?: string | null
          id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payable_bill_line_items_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "payable_bill_line_items_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "payable_bill_line_items_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payable_bill_line_items_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "payable_bill_line_items_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "payable_bill_line_items_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "payable_bill_line_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "payable_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payable_bill_line_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "v_check_writing_queue"
            referencedColumns: ["bill_id"]
          },
          {
            foreignKeyName: "payable_bill_line_items_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      payable_bills: {
        Row: {
          amount: number
          approval_required: boolean
          approved_at: string | null
          approved_by: string | null
          archived_at: string | null
          association_id: string | null
          bank_account_id: string | null
          bill_date: string
          bill_number: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          gl_account_id: string | null
          id: string
          memo: string | null
          occurred_on: string | null
          paid_at: string | null
          portfolio_id: string
          status: Database["public"]["Enums"]["payable_bill_status"]
          updated_at: string
          vendor_id: string
          work_order_id: string | null
        }
        Insert: {
          amount: number
          approval_required?: boolean
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string | null
          association_id?: string | null
          bank_account_id?: string | null
          bill_date?: string
          bill_number?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          gl_account_id?: string | null
          id?: string
          memo?: string | null
          occurred_on?: string | null
          paid_at?: string | null
          portfolio_id: string
          status?: Database["public"]["Enums"]["payable_bill_status"]
          updated_at?: string
          vendor_id: string
          work_order_id?: string | null
        }
        Update: {
          amount?: number
          approval_required?: boolean
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string | null
          association_id?: string | null
          bank_account_id?: string | null
          bill_date?: string
          bill_number?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          gl_account_id?: string | null
          id?: string
          memo?: string | null
          occurred_on?: string | null
          paid_at?: string | null
          portfolio_id?: string
          status?: Database["public"]["Enums"]["payable_bill_status"]
          updated_at?: string
          vendor_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payable_bills_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "payable_bills_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "payable_bills_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payable_bills_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "payable_bills_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "payable_bills_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "payable_bills_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payable_bills_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payable_bills_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payable_bills_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "payable_bills_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "payable_bills_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_insurance_expirations"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "payable_bills_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payable_bills_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_applications: {
        Row: {
          amount_applied: number
          application_method: string
          applied_at: string
          applied_by: string | null
          charge_id: string
          created_at: string
          id: string
          notes: string | null
          payment_id: string
        }
        Insert: {
          amount_applied: number
          application_method?: string
          applied_at?: string
          applied_by?: string | null
          charge_id: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_id: string
        }
        Update: {
          amount_applied?: number
          application_method?: string
          applied_at?: string
          applied_by?: string | null
          charge_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_applications_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["charge_id"]
          },
          {
            foreignKeyName: "payment_applications_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_applications_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "v_charge_balances"
            referencedColumns: ["charge_id"]
          },
          {
            foreignKeyName: "payment_applications_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_applications_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_unapplied_credits"
            referencedColumns: ["payment_id"]
          },
        ]
      }
      payment_intents: {
        Row: {
          amount: number
          charge_id: string | null
          convenience_fee_cents: number
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          failure_reason: string | null
          id: string
          metadata: Json | null
          method: string | null
          net_to_association_cents: number | null
          owner_id: string
          owner_paid_cents: number | null
          paid_at: string | null
          processor: Database["public"]["Enums"]["payment_processor"]
          processor_fee_cents: number | null
          processor_payment_id: string | null
          refunded_at: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          charge_id?: string | null
          convenience_fee_cents?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          failure_reason?: string | null
          id?: string
          metadata?: Json | null
          method?: string | null
          net_to_association_cents?: number | null
          owner_id: string
          owner_paid_cents?: number | null
          paid_at?: string | null
          processor?: Database["public"]["Enums"]["payment_processor"]
          processor_fee_cents?: number | null
          processor_payment_id?: string | null
          refunded_at?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          charge_id?: string | null
          convenience_fee_cents?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          failure_reason?: string | null
          id?: string
          metadata?: Json | null
          method?: string | null
          net_to_association_cents?: number | null
          owner_id?: string
          owner_paid_cents?: number | null
          paid_at?: string | null
          processor?: Database["public"]["Enums"]["payment_processor"]
          processor_fee_cents?: number | null
          processor_payment_id?: string | null
          refunded_at?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["charge_id"]
          },
          {
            foreignKeyName: "payment_intents_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "v_charge_balances"
            referencedColumns: ["charge_id"]
          },
          {
            foreignKeyName: "payment_intents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "payment_intents_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "delinquent_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "payment_intents_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "payment_intents_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "payment_intents_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_unit_account_summary"
            referencedColumns: ["unit_id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          account_type: string | null
          archived_at: string | null
          bank_name: string | null
          brand: string | null
          created_at: string
          exp_month: number | null
          exp_year: number | null
          failed_attempts: number
          id: string
          is_default: boolean
          is_verified: boolean
          last_failure_at: string | null
          last_failure_reason: string | null
          last_four: string | null
          method_type: Database["public"]["Enums"]["payment_method_type"]
          owner_id: string
          portfolio_id: string
          processor: Database["public"]["Enums"]["payment_processor"]
          processor_customer_id: string | null
          processor_token: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          account_type?: string | null
          archived_at?: string | null
          bank_name?: string | null
          brand?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          failed_attempts?: number
          id?: string
          is_default?: boolean
          is_verified?: boolean
          last_failure_at?: string | null
          last_failure_reason?: string | null
          last_four?: string | null
          method_type: Database["public"]["Enums"]["payment_method_type"]
          owner_id: string
          portfolio_id: string
          processor: Database["public"]["Enums"]["payment_processor"]
          processor_customer_id?: string | null
          processor_token: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          account_type?: string | null
          archived_at?: string | null
          bank_name?: string | null
          brand?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          failed_attempts?: number
          id?: string
          is_default?: boolean
          is_verified?: boolean
          last_failure_at?: string | null
          last_failure_reason?: string | null
          last_four?: string | null
          method_type?: Database["public"]["Enums"]["payment_method_type"]
          owner_id?: string
          portfolio_id?: string
          processor?: Database["public"]["Enums"]["payment_processor"]
          processor_customer_id?: string | null
          processor_token?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "payment_methods_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "payment_methods_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      payment_processor_configs: {
        Row: {
          ach_fee_bps: number | null
          ach_fee_cap_cents: number | null
          ach_fee_fixed_cents: number | null
          card_fee_bps: number | null
          card_fee_fixed_cents: number | null
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          metadata: Json
          portfolio_id: string
          processor: Database["public"]["Enums"]["payment_processor"]
          public_key: string | null
          supports_ach: boolean
          supports_apple_pay: boolean
          supports_card: boolean
          updated_at: string
          vault_secret_name: string | null
          webhook_secret_vault_name: string | null
        }
        Insert: {
          ach_fee_bps?: number | null
          ach_fee_cap_cents?: number | null
          ach_fee_fixed_cents?: number | null
          card_fee_bps?: number | null
          card_fee_fixed_cents?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          metadata?: Json
          portfolio_id: string
          processor: Database["public"]["Enums"]["payment_processor"]
          public_key?: string | null
          supports_ach?: boolean
          supports_apple_pay?: boolean
          supports_card?: boolean
          updated_at?: string
          vault_secret_name?: string | null
          webhook_secret_vault_name?: string | null
        }
        Update: {
          ach_fee_bps?: number | null
          ach_fee_cap_cents?: number | null
          ach_fee_fixed_cents?: number | null
          card_fee_bps?: number | null
          card_fee_fixed_cents?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          metadata?: Json
          portfolio_id?: string
          processor?: Database["public"]["Enums"]["payment_processor"]
          public_key?: string | null
          supports_ach?: boolean
          supports_apple_pay?: boolean
          supports_card?: boolean
          updated_at?: string
          vault_secret_name?: string | null
          webhook_secret_vault_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_processor_configs_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_processor_configs_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "payment_processor_configs_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bank_account_id: string | null
          charge_id: string | null
          created_at: string
          created_by: string | null
          gl_account_id: string | null
          id: string
          method: string
          notes: string | null
          payment_date: string
          reference: string | null
          unit_id: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          charge_id?: string | null
          created_at?: string
          created_by?: string | null
          gl_account_id?: string | null
          id?: string
          method?: string
          notes?: string | null
          payment_date?: string
          reference?: string | null
          unit_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          charge_id?: string | null
          created_at?: string
          created_by?: string | null
          gl_account_id?: string | null
          id?: string
          method?: string
          notes?: string | null
          payment_date?: string
          reference?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["charge_id"]
          },
          {
            foreignKeyName: "payments_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "v_charge_balances"
            referencedColumns: ["charge_id"]
          },
          {
            foreignKeyName: "payments_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "delinquent_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "payments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "payments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "payments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_unit_account_summary"
            referencedColumns: ["unit_id"]
          },
        ]
      }
      permission_audit_log: {
        Row: {
          action: string
          actor_portfolio_id: string | null
          actor_user_id: string | null
          after_state: Json | null
          at: string
          before_state: Json | null
          details: Json
          id: string
          ip_address: string | null
          target_entity_id: string
          target_entity_type: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_portfolio_id?: string | null
          actor_user_id?: string | null
          after_state?: Json | null
          at?: string
          before_state?: Json | null
          details?: Json
          id?: string
          ip_address?: string | null
          target_entity_id: string
          target_entity_type: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_portfolio_id?: string | null
          actor_user_id?: string | null
          after_state?: Json | null
          at?: string
          before_state?: Json | null
          details?: Json
          id?: string
          ip_address?: string | null
          target_entity_id?: string
          target_entity_type?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permission_audit_log_actor_portfolio_id_fkey"
            columns: ["actor_portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_audit_log_actor_portfolio_id_fkey"
            columns: ["actor_portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "permission_audit_log_actor_portfolio_id_fkey"
            columns: ["actor_portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      platform_impersonation_log: {
        Row: {
          ended_at: string | null
          id: string
          impersonated_email: string | null
          impersonated_portfolio_id: string | null
          impersonated_user_id: string | null
          ip_address: string | null
          operator_email: string
          operator_id: string
          reason: string | null
          started_at: string
          user_agent: string | null
        }
        Insert: {
          ended_at?: string | null
          id?: string
          impersonated_email?: string | null
          impersonated_portfolio_id?: string | null
          impersonated_user_id?: string | null
          ip_address?: string | null
          operator_email: string
          operator_id: string
          reason?: string | null
          started_at?: string
          user_agent?: string | null
        }
        Update: {
          ended_at?: string | null
          id?: string
          impersonated_email?: string | null
          impersonated_portfolio_id?: string | null
          impersonated_user_id?: string | null
          ip_address?: string | null
          operator_email?: string
          operator_id?: string
          reason?: string | null
          started_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_impersonation_log_impersonated_portfolio_id_fkey"
            columns: ["impersonated_portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_impersonation_log_impersonated_portfolio_id_fkey"
            columns: ["impersonated_portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "platform_impersonation_log_impersonated_portfolio_id_fkey"
            columns: ["impersonated_portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "platform_impersonation_log_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "platform_operators"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_operators: {
        Row: {
          active: boolean
          auth_user_id: string
          created_at: string
          created_by: string | null
          email: string
          full_name: string | null
          id: string
          mfa_enrolled_at: string | null
          mfa_required: boolean
          role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          auth_user_id: string
          created_at?: string
          created_by?: string | null
          email: string
          full_name?: string | null
          id?: string
          mfa_enrolled_at?: string | null
          mfa_required?: boolean
          role?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          auth_user_id?: string
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string | null
          id?: string
          mfa_enrolled_at?: string | null
          mfa_required?: boolean
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      portfolios: {
        Row: {
          address_city: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          allowed_email_domains: string[]
          archived_at: string | null
          company_name: string
          convenience_fee_ach_fixed_cents: number
          convenience_fee_ach_pct: number
          convenience_fee_card_fixed_cents: number
          convenience_fee_card_pct: number
          convenience_fee_label: string
          convenience_fee_minimum_cents: number
          convenience_fee_mode: Database["public"]["Enums"]["convenience_fee_mode"]
          created_at: string
          created_by: string | null
          default_late_fee_amount: number
          default_late_fee_grace_days: number
          default_nsf_fee_amount: number
          default_payment_reminder_days: number[]
          entitlements: string[]
          fiscal_year_start_month: number
          id: string
          password_min_length: number
          phone_number: string | null
          profile_type: Database["public"]["Enums"]["portfolio_profile_type"]
          require_mfa_for_admins: boolean
          require_mfa_for_staff: boolean
          session_timeout_minutes: number
          statement_generation_day: number
          suspended_at: string | null
          suspension_reason: string | null
          texting_phone_number: string | null
          tier: Database["public"]["Enums"]["portfolio_tier"]
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          allowed_email_domains?: string[]
          archived_at?: string | null
          company_name: string
          convenience_fee_ach_fixed_cents?: number
          convenience_fee_ach_pct?: number
          convenience_fee_card_fixed_cents?: number
          convenience_fee_card_pct?: number
          convenience_fee_label?: string
          convenience_fee_minimum_cents?: number
          convenience_fee_mode?: Database["public"]["Enums"]["convenience_fee_mode"]
          created_at?: string
          created_by?: string | null
          default_late_fee_amount?: number
          default_late_fee_grace_days?: number
          default_nsf_fee_amount?: number
          default_payment_reminder_days?: number[]
          entitlements?: string[]
          fiscal_year_start_month?: number
          id?: string
          password_min_length?: number
          phone_number?: string | null
          profile_type?: Database["public"]["Enums"]["portfolio_profile_type"]
          require_mfa_for_admins?: boolean
          require_mfa_for_staff?: boolean
          session_timeout_minutes?: number
          statement_generation_day?: number
          suspended_at?: string | null
          suspension_reason?: string | null
          texting_phone_number?: string | null
          tier?: Database["public"]["Enums"]["portfolio_tier"]
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          allowed_email_domains?: string[]
          archived_at?: string | null
          company_name?: string
          convenience_fee_ach_fixed_cents?: number
          convenience_fee_ach_pct?: number
          convenience_fee_card_fixed_cents?: number
          convenience_fee_card_pct?: number
          convenience_fee_label?: string
          convenience_fee_minimum_cents?: number
          convenience_fee_mode?: Database["public"]["Enums"]["convenience_fee_mode"]
          created_at?: string
          created_by?: string | null
          default_late_fee_amount?: number
          default_late_fee_grace_days?: number
          default_nsf_fee_amount?: number
          default_payment_reminder_days?: number[]
          entitlements?: string[]
          fiscal_year_start_month?: number
          id?: string
          password_min_length?: number
          phone_number?: string | null
          profile_type?: Database["public"]["Enums"]["portfolio_profile_type"]
          require_mfa_for_admins?: boolean
          require_mfa_for_staff?: boolean
          session_timeout_minutes?: number
          statement_generation_day?: number
          suspended_at?: string | null
          suspension_reason?: string | null
          texting_phone_number?: string | null
          tier?: Database["public"]["Enums"]["portfolio_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      privacy_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["privacy_action_type"]
          completed_at: string | null
          created_at: string
          deadline: string
          details: Json
          evidence_url: string | null
          handler_user_id: string | null
          id: string
          jurisdiction: string | null
          portfolio_id: string | null
          rejected_at: string | null
          rejection_reason: string | null
          requested_at: string
          status: Database["public"]["Enums"]["privacy_action_status"]
          subject_auth_user_id: string | null
          subject_email: string
          subject_owner_id: string | null
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          action_type: Database["public"]["Enums"]["privacy_action_type"]
          completed_at?: string | null
          created_at?: string
          deadline?: string
          details?: Json
          evidence_url?: string | null
          handler_user_id?: string | null
          id?: string
          jurisdiction?: string | null
          portfolio_id?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["privacy_action_status"]
          subject_auth_user_id?: string | null
          subject_email: string
          subject_owner_id?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["privacy_action_type"]
          completed_at?: string | null
          created_at?: string
          deadline?: string
          details?: Json
          evidence_url?: string | null
          handler_user_id?: string | null
          id?: string
          jurisdiction?: string | null
          portfolio_id?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["privacy_action_status"]
          subject_auth_user_id?: string | null
          subject_email?: string
          subject_owner_id?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "privacy_actions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_actions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "privacy_actions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "privacy_actions_subject_owner_id_fkey"
            columns: ["subject_owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_actions_subject_owner_id_fkey"
            columns: ["subject_owner_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["owner_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          full_name: string | null
          gl_account_permissions: Json
          hoa_role: Database["public"]["Enums"]["hoa_role"] | null
          id: string
          last_login_at: string | null
          last_login_ip: string | null
          mfa_enrolled_at: string | null
          mfa_required: boolean
          mvp_role: Database["public"]["Enums"]["mvp_company_role"] | null
          portal_login_last_at: string | null
          portfolio_id: string | null
          profile_access: string[]
          role: string | null
          role_id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          gl_account_permissions?: Json
          hoa_role?: Database["public"]["Enums"]["hoa_role"] | null
          id: string
          last_login_at?: string | null
          last_login_ip?: string | null
          mfa_enrolled_at?: string | null
          mfa_required?: boolean
          mvp_role?: Database["public"]["Enums"]["mvp_company_role"] | null
          portal_login_last_at?: string | null
          portfolio_id?: string | null
          profile_access?: string[]
          role?: string | null
          role_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          gl_account_permissions?: Json
          hoa_role?: Database["public"]["Enums"]["hoa_role"] | null
          id?: string
          last_login_at?: string | null
          last_login_ip?: string | null
          mfa_enrolled_at?: string | null
          mfa_required?: boolean
          mvp_role?: Database["public"]["Enums"]["mvp_company_role"] | null
          portal_login_last_at?: string | null
          portfolio_id?: string | null
          profile_access?: string[]
          role?: string | null
          role_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "profiles_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          portfolio_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          portfolio_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          portfolio_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_groups_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_groups_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "property_groups_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      purchase_order_line_items: {
        Row: {
          created_at: string
          description: string | null
          gl_account_id: string | null
          id: string
          line_total: number | null
          purchase_order_id: string
          qty: number
          sort_order: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          gl_account_id?: string | null
          id?: string
          line_total?: number | null
          purchase_order_id: string
          qty?: number
          sort_order?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          gl_account_id?: string | null
          id?: string
          line_total?: number | null
          purchase_order_id?: string
          qty?: number
          sort_order?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_line_items_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_line_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          archived_at: string | null
          association_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          number: string | null
          po_billed: number
          po_total: number
          portfolio_id: string
          status: Database["public"]["Enums"]["purchase_order_status"]
          updated_at: string
          vendor_id: string
          work_order_id: string | null
        }
        Insert: {
          archived_at?: string | null
          association_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          number?: string | null
          po_billed?: number
          po_total?: number
          portfolio_id: string
          status?: Database["public"]["Enums"]["purchase_order_status"]
          updated_at?: string
          vendor_id: string
          work_order_id?: string | null
        }
        Update: {
          archived_at?: string | null
          association_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          number?: string | null
          po_billed?: number
          po_total?: number
          portfolio_id?: string
          status?: Database["public"]["Enums"]["purchase_order_status"]
          updated_at?: string
          vendor_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "purchase_orders_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "purchase_orders_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "purchase_orders_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "purchase_orders_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "purchase_orders_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "purchase_orders_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_insurance_expirations"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_bills: {
        Row: {
          amount: number
          archived_at: string | null
          association_id: string | null
          auto_generate: boolean
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          end_date: string | null
          frequency: Database["public"]["Enums"]["recurring_frequency"]
          gl_account_id: string | null
          id: string
          interval_count: number
          is_auto_pay: boolean
          last_generated_at: string | null
          memo: string | null
          name: string
          next_post_date: string
          portfolio_id: string
          start_date: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          amount: number
          archived_at?: string | null
          association_id?: string | null
          auto_generate?: boolean
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          gl_account_id?: string | null
          id?: string
          interval_count?: number
          is_auto_pay?: boolean
          last_generated_at?: string | null
          memo?: string | null
          name: string
          next_post_date?: string
          portfolio_id: string
          start_date?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          amount?: number
          archived_at?: string | null
          association_id?: string | null
          auto_generate?: boolean
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          gl_account_id?: string | null
          id?: string
          interval_count?: number
          is_auto_pay?: boolean
          last_generated_at?: string | null
          memo?: string | null
          name?: string
          next_post_date?: string
          portfolio_id?: string
          start_date?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_bills_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "recurring_bills_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "recurring_bills_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_bills_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "recurring_bills_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "recurring_bills_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "recurring_bills_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_bills_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_bills_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_bills_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "recurring_bills_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "recurring_bills_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_insurance_expirations"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "recurring_bills_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_journal_entries: {
        Row: {
          archived_at: string | null
          auto_generate: boolean
          created_at: string
          created_by: string | null
          frequency: Database["public"]["Enums"]["recurring_frequency"]
          id: string
          interval_count: number
          last_generated_at: string | null
          memo: string | null
          name: string
          next_post_date: string
          portfolio_id: string
          template_lines: Json
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          auto_generate?: boolean
          created_at?: string
          created_by?: string | null
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          id?: string
          interval_count?: number
          last_generated_at?: string | null
          memo?: string | null
          name: string
          next_post_date?: string
          portfolio_id: string
          template_lines?: Json
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          auto_generate?: boolean
          created_at?: string
          created_by?: string | null
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          id?: string
          interval_count?: number
          last_generated_at?: string | null
          memo?: string | null
          name?: string
          next_post_date?: string
          portfolio_id?: string
          template_lines?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_journal_entries_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_journal_entries_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "recurring_journal_entries_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      recurring_work_orders: {
        Row: {
          archived_at: string | null
          association_id: string
          auto_generate: boolean
          category: Database["public"]["Enums"]["work_order_category"] | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          frequency: Database["public"]["Enums"]["recurring_frequency"]
          gl_account_id: string | null
          id: string
          interval_count: number
          last_generated_at: string | null
          next_due_date: string
          portfolio_id: string
          priority: Database["public"]["Enums"]["work_order_priority"]
          start_date: string
          title: string
          trade: Database["public"]["Enums"]["vendor_trade"] | null
          unit_id: string | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          archived_at?: string | null
          association_id: string
          auto_generate?: boolean
          category?: Database["public"]["Enums"]["work_order_category"] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          gl_account_id?: string | null
          id?: string
          interval_count?: number
          last_generated_at?: string | null
          next_due_date?: string
          portfolio_id: string
          priority?: Database["public"]["Enums"]["work_order_priority"]
          start_date?: string
          title: string
          trade?: Database["public"]["Enums"]["vendor_trade"] | null
          unit_id?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          archived_at?: string | null
          association_id?: string
          auto_generate?: boolean
          category?: Database["public"]["Enums"]["work_order_category"] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          gl_account_id?: string | null
          id?: string
          interval_count?: number
          last_generated_at?: string | null
          next_due_date?: string
          portfolio_id?: string
          priority?: Database["public"]["Enums"]["work_order_priority"]
          start_date?: string
          title?: string
          trade?: Database["public"]["Enums"]["vendor_trade"] | null
          unit_id?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_work_orders_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "recurring_work_orders_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "recurring_work_orders_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_work_orders_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "recurring_work_orders_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "recurring_work_orders_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "recurring_work_orders_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_work_orders_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_work_orders_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "recurring_work_orders_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "recurring_work_orders_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "delinquent_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "recurring_work_orders_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "recurring_work_orders_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_work_orders_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "recurring_work_orders_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_unit_account_summary"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "recurring_work_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_insurance_expirations"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "recurring_work_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      report_definitions: {
        Row: {
          active: boolean
          category: Database["public"]["Enums"]["report_category"]
          created_at: string
          default_filters: Json
          description: string | null
          id: string
          is_system: boolean
          name: string
          output_formats: Database["public"]["Enums"]["report_format"][]
          parameter_schema: Json
          portfolio_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: Database["public"]["Enums"]["report_category"]
          created_at?: string
          default_filters?: Json
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          output_formats?: Database["public"]["Enums"]["report_format"][]
          parameter_schema?: Json
          portfolio_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: Database["public"]["Enums"]["report_category"]
          created_at?: string
          default_filters?: Json
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          output_formats?: Database["public"]["Enums"]["report_format"][]
          parameter_schema?: Json
          portfolio_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_definitions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_definitions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "report_definitions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      report_runs: {
        Row: {
          created_at: string
          definition_id: string
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          output_format: Database["public"]["Enums"]["report_format"]
          output_size_bytes: number | null
          output_url: string | null
          parameters: Json
          portfolio_id: string
          row_count: number | null
          saved_report_id: string | null
          scheduled_report_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["report_run_status"]
          triggered_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          definition_id: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          output_format?: Database["public"]["Enums"]["report_format"]
          output_size_bytes?: number | null
          output_url?: string | null
          parameters?: Json
          portfolio_id: string
          row_count?: number | null
          saved_report_id?: string | null
          scheduled_report_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["report_run_status"]
          triggered_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          definition_id?: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          output_format?: Database["public"]["Enums"]["report_format"]
          output_size_bytes?: number | null
          output_url?: string | null
          parameters?: Json
          portfolio_id?: string
          row_count?: number | null
          saved_report_id?: string | null
          scheduled_report_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["report_run_status"]
          triggered_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_runs_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "report_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_runs_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_runs_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "report_runs_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "report_runs_saved_report_id_fkey"
            columns: ["saved_report_id"]
            isOneToOne: false
            referencedRelation: "saved_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_runs_scheduled_report_id_fkey"
            columns: ["scheduled_report_id"]
            isOneToOne: false
            referencedRelation: "scheduled_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_snapshots: {
        Row: {
          association_id: string
          created_at: string
          data: Json
          definition_id: string | null
          generated_at: string
          generated_by: string | null
          id: string
          parameters: Json
          report_type: string
          run_id: string | null
        }
        Insert: {
          association_id: string
          created_at?: string
          data?: Json
          definition_id?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          parameters?: Json
          report_type: string
          run_id?: string | null
        }
        Update: {
          association_id?: string
          created_at?: string
          data?: Json
          definition_id?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          parameters?: Json
          report_type?: string
          run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_snapshots_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "report_snapshots_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "report_snapshots_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_snapshots_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "report_snapshots_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "report_snapshots_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "report_snapshots_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "report_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_snapshots_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "report_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_reports: {
        Row: {
          created_at: string
          definition_id: string
          id: string
          last_run_at: string | null
          name: string
          parameters: Json
          pinned: boolean
          portfolio_id: string
          run_count: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          definition_id: string
          id?: string
          last_run_at?: string | null
          name: string
          parameters?: Json
          pinned?: boolean
          portfolio_id: string
          run_count?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          definition_id?: string
          id?: string
          last_run_at?: string | null
          name?: string
          parameters?: Json
          pinned?: boolean
          portfolio_id?: string
          run_count?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_reports_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "report_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_reports_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_reports_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "saved_reports_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      scheduled_reports: {
        Row: {
          active: boolean
          archived_at: string | null
          created_at: string
          created_by: string | null
          day_of_month: number | null
          day_of_week: number | null
          definition_id: string
          delivery_channel: Database["public"]["Enums"]["report_delivery_channel"]
          delivery_targets: Json
          frequency: Database["public"]["Enums"]["schedule_frequency"]
          hour_utc: number
          id: string
          last_run_at: string | null
          name: string
          next_run_at: string | null
          output_format: Database["public"]["Enums"]["report_format"]
          parameters: Json
          portfolio_id: string
          saved_report_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          definition_id: string
          delivery_channel?: Database["public"]["Enums"]["report_delivery_channel"]
          delivery_targets?: Json
          frequency: Database["public"]["Enums"]["schedule_frequency"]
          hour_utc?: number
          id?: string
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          output_format?: Database["public"]["Enums"]["report_format"]
          parameters?: Json
          portfolio_id: string
          saved_report_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          definition_id?: string
          delivery_channel?: Database["public"]["Enums"]["report_delivery_channel"]
          delivery_targets?: Json
          frequency?: Database["public"]["Enums"]["schedule_frequency"]
          hour_utc?: number
          id?: string
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          output_format?: Database["public"]["Enums"]["report_format"]
          parameters?: Json
          portfolio_id?: string
          saved_report_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_reports_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "report_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_reports_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_reports_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "scheduled_reports_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "scheduled_reports_saved_report_id_fkey"
            columns: ["saved_report_id"]
            isOneToOne: false
            referencedRelation: "saved_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_migrations: {
        Row: {
          applied_at: string
          checksum: string
          duration_ms: number | null
          error: string | null
          status: string
          version: string
        }
        Insert: {
          applied_at?: string
          checksum: string
          duration_ms?: number | null
          error?: string | null
          status: string
          version: string
        }
        Update: {
          applied_at?: string
          checksum?: string
          duration_ms?: number | null
          error?: string | null
          status?: string
          version?: string
        }
        Relationships: []
      }
      service_requests: {
        Row: {
          archived_at: string | null
          association_id: string
          created_at: string
          created_by: string | null
          created_on: string
          description: string
          homeowner_id: string | null
          id: string
          number: string | null
          owner_id: string | null
          permission_to_enter: boolean
          portfolio_id: string
          priority: Database["public"]["Enums"]["service_request_priority"]
          source: Database["public"]["Enums"]["service_request_source"]
          status: Database["public"]["Enums"]["service_request_status"]
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          association_id: string
          created_at?: string
          created_by?: string | null
          created_on?: string
          description: string
          homeowner_id?: string | null
          id?: string
          number?: string | null
          owner_id?: string | null
          permission_to_enter?: boolean
          portfolio_id: string
          priority?: Database["public"]["Enums"]["service_request_priority"]
          source?: Database["public"]["Enums"]["service_request_source"]
          status?: Database["public"]["Enums"]["service_request_status"]
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          association_id?: string
          created_at?: string
          created_by?: string | null
          created_on?: string
          description?: string
          homeowner_id?: string | null
          id?: string
          number?: string | null
          owner_id?: string | null
          permission_to_enter?: boolean
          portfolio_id?: string
          priority?: Database["public"]["Enums"]["service_request_priority"]
          source?: Database["public"]["Enums"]["service_request_source"]
          status?: Database["public"]["Enums"]["service_request_status"]
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "service_requests_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "service_requests_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "service_requests_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "service_requests_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "service_requests_homeowner_id_fkey"
            columns: ["homeowner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_homeowner_id_fkey"
            columns: ["homeowner_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "service_requests_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "service_requests_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "service_requests_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "service_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "delinquent_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "service_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "service_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "service_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_unit_account_summary"
            referencedColumns: ["unit_id"]
          },
        ]
      }
      shares: {
        Row: {
          created_at: string | null
          description: string | null
          expires_at: string | null
          id: string
          resource_id: string
          resource_type: string
          slug: string
          snapshot: Json
          title: string | null
          user_id: string
          view_count: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          resource_id: string
          resource_type: string
          slug?: string
          snapshot: Json
          title?: string | null
          user_id: string
          view_count?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          resource_id?: string
          resource_type?: string
          slug?: string
          snapshot?: Json
          title?: string | null
          user_id?: string
          view_count?: number | null
        }
        Relationships: []
      }
      sms_conversations: {
        Row: {
          archived_at: string | null
          association_id: string | null
          created_at: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          our_phone_number: string | null
          portfolio_id: string
          unread_count: number
          updated_at: string
          with_entity_id: string | null
          with_entity_type: string | null
          with_name: string | null
          with_phone_number: string
        }
        Insert: {
          archived_at?: string | null
          association_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          our_phone_number?: string | null
          portfolio_id: string
          unread_count?: number
          updated_at?: string
          with_entity_id?: string | null
          with_entity_type?: string | null
          with_name?: string | null
          with_phone_number: string
        }
        Update: {
          archived_at?: string | null
          association_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          our_phone_number?: string | null
          portfolio_id?: string
          unread_count?: number
          updated_at?: string
          with_entity_id?: string | null
          with_entity_type?: string | null
          with_name?: string | null
          with_phone_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_conversations_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "sms_conversations_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "sms_conversations_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_conversations_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "sms_conversations_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "sms_conversations_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "sms_conversations_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_conversations_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "sms_conversations_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      sms_messages: {
        Row: {
          body: string | null
          conversation_id: string
          created_at: string
          delivered_at: string | null
          direction: Database["public"]["Enums"]["sms_direction"]
          error_code: string | null
          error_message: string | null
          from_number: string
          id: string
          media_urls: Json
          provider: string | null
          provider_message_id: string | null
          read_at: string | null
          sent_at: string | null
          sent_by: string | null
          status: Database["public"]["Enums"]["sms_status"]
          to_number: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          direction: Database["public"]["Enums"]["sms_direction"]
          error_code?: string | null
          error_message?: string | null
          from_number: string
          id?: string
          media_urls?: Json
          provider?: string | null
          provider_message_id?: string | null
          read_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: Database["public"]["Enums"]["sms_status"]
          to_number: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          direction?: Database["public"]["Enums"]["sms_direction"]
          error_code?: string | null
          error_message?: string | null
          from_number?: string
          id?: string
          media_urls?: Json
          provider?: string | null
          provider_message_id?: string | null
          read_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: Database["public"]["Enums"]["sms_status"]
          to_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "sms_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      soft_delete_log: {
        Row: {
          archived_at: string
          archived_by: string | null
          entity_id: string
          entity_type: string
          id: string
          portfolio_id: string | null
          prior_state: Json
          reason: string | null
        }
        Insert: {
          archived_at?: string
          archived_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          portfolio_id?: string | null
          prior_state: Json
          reason?: string | null
        }
        Update: {
          archived_at?: string
          archived_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          portfolio_id?: string | null
          prior_state?: Json
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "soft_delete_log_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soft_delete_log_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "soft_delete_log_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      statements: {
        Row: {
          association_id: string
          closing_balance: number
          created_at: string
          created_by: string | null
          emailed_at: string | null
          generated_at: string
          id: string
          opening_balance: number
          owner_id: string
          pdf_path: string | null
          period_month: number
          period_year: number
          total_charges: number
          total_payments: number
          unit_id: string
        }
        Insert: {
          association_id: string
          closing_balance?: number
          created_at?: string
          created_by?: string | null
          emailed_at?: string | null
          generated_at?: string
          id?: string
          opening_balance?: number
          owner_id: string
          pdf_path?: string | null
          period_month: number
          period_year: number
          total_charges?: number
          total_payments?: number
          unit_id: string
        }
        Update: {
          association_id?: string
          closing_balance?: number
          created_at?: string
          created_by?: string | null
          emailed_at?: string | null
          generated_at?: string
          id?: string
          opening_balance?: number
          owner_id?: string
          pdf_path?: string | null
          period_month?: number
          period_year?: number
          total_charges?: number
          total_payments?: number
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "statements_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "statements_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "statements_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statements_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "statements_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "statements_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "statements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "statements_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "delinquent_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "statements_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "statements_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statements_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "statements_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_unit_account_summary"
            referencedColumns: ["unit_id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          actor_user_id: string | null
          at: string
          event_type: string
          from_status: Database["public"]["Enums"]["subscription_status"] | null
          from_tier: Database["public"]["Enums"]["portfolio_tier"] | null
          id: string
          payload: Json
          portfolio_id: string
          stripe_event_id: string | null
          subscription_id: string
          to_status: Database["public"]["Enums"]["subscription_status"] | null
          to_tier: Database["public"]["Enums"]["portfolio_tier"] | null
        }
        Insert: {
          actor_user_id?: string | null
          at?: string
          event_type: string
          from_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          from_tier?: Database["public"]["Enums"]["portfolio_tier"] | null
          id?: string
          payload?: Json
          portfolio_id: string
          stripe_event_id?: string | null
          subscription_id: string
          to_status?: Database["public"]["Enums"]["subscription_status"] | null
          to_tier?: Database["public"]["Enums"]["portfolio_tier"] | null
        }
        Update: {
          actor_user_id?: string | null
          at?: string
          event_type?: string
          from_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          from_tier?: Database["public"]["Enums"]["portfolio_tier"] | null
          id?: string
          payload?: Json
          portfolio_id?: string
          stripe_event_id?: string | null
          subscription_id?: string
          to_status?: Database["public"]["Enums"]["subscription_status"] | null
          to_tier?: Database["public"]["Enums"]["portfolio_tier"] | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "subscription_events_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "subscription_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          associations_limit: number | null
          billing_email: string | null
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          currency: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          portfolio_id: string
          price_monthly_cents: number | null
          price_per_seat_cents: number | null
          seats_included: number
          seats_used: number
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: Database["public"]["Enums"]["portfolio_tier"]
          trial_ends_at: string | null
          units_limit: number | null
          updated_at: string
        }
        Insert: {
          associations_limit?: number | null
          billing_email?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          portfolio_id: string
          price_monthly_cents?: number | null
          price_per_seat_cents?: number | null
          seats_included?: number
          seats_used?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["portfolio_tier"]
          trial_ends_at?: string | null
          units_limit?: number | null
          updated_at?: string
        }
        Update: {
          associations_limit?: number | null
          billing_email?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          portfolio_id?: string
          price_monthly_cents?: number | null
          price_per_seat_cents?: number | null
          seats_included?: number
          seats_used?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["portfolio_tier"]
          trial_ends_at?: string | null
          units_limit?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: true
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: true
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "subscriptions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: true
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          answers: Json
          comments: string | null
          created_at: string
          id: string
          rating: number | null
          submitted_at: string
          submitted_by_email: string | null
          submitted_by_name: string | null
          submitted_by_owner_id: string | null
          survey_id: string
          work_order_id: string | null
        }
        Insert: {
          answers?: Json
          comments?: string | null
          created_at?: string
          id?: string
          rating?: number | null
          submitted_at?: string
          submitted_by_email?: string | null
          submitted_by_name?: string | null
          submitted_by_owner_id?: string | null
          survey_id: string
          work_order_id?: string | null
        }
        Update: {
          answers?: Json
          comments?: string | null
          created_at?: string
          id?: string
          rating?: number | null
          submitted_at?: string
          submitted_by_email?: string | null
          submitted_by_name?: string | null
          submitted_by_owner_id?: string | null
          survey_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_submitted_by_owner_id_fkey"
            columns: ["submitted_by_owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_submitted_by_owner_id_fkey"
            columns: ["submitted_by_owner_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          active: boolean
          archived_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          portfolio_id: string
          questions: Json
          survey_type: Database["public"]["Enums"]["survey_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          portfolio_id: string
          questions?: Json
          survey_type?: Database["public"]["Enums"]["survey_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          portfolio_id?: string
          questions?: Json
          survey_type?: Database["public"]["Enums"]["survey_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "surveys_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "surveys_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      tag_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["tag_entity_type"]
          id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["tag_entity_type"]
          id?: string
          tag_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["tag_entity_type"]
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          portfolio_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          portfolio_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          portfolio_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tags_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "tags_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      tenancies: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          lease_end: string | null
          lease_start: string
          rent_amount: number | null
          tenant_email: string | null
          tenant_name: string
          tenant_phone: string | null
          unit_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          lease_end?: string | null
          lease_start: string
          rent_amount?: number | null
          tenant_email?: string | null
          tenant_name: string
          tenant_phone?: string | null
          unit_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          lease_end?: string | null
          lease_start?: string
          rent_amount?: number | null
          tenant_email?: string | null
          tenant_name?: string
          tenant_phone?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenancies_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "delinquent_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "tenancies_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "tenancies_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancies_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "tenancies_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_unit_account_summary"
            referencedColumns: ["unit_id"]
          },
        ]
      }
      unit_amenities: {
        Row: {
          amenity_tag_id: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          unit_id: string
        }
        Insert: {
          amenity_tag_id?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          unit_id: string
        }
        Update: {
          amenity_tag_id?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_amenities_amenity_tag_id_fkey"
            columns: ["amenity_tag_id"]
            isOneToOne: false
            referencedRelation: "amenity_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_amenities_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "delinquent_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "unit_amenities_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "unit_amenities_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_amenities_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "unit_amenities_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_unit_account_summary"
            referencedColumns: ["unit_id"]
          },
        ]
      }
      unit_owners: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          is_primary: boolean
          owner_id: string
          share_pct: number
          start_date: string
          unit_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_primary?: boolean
          owner_id: string
          share_pct?: number
          start_date?: string
          unit_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_primary?: boolean
          owner_id?: string
          share_pct?: number
          start_date?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_owners_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_owners_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "unit_owners_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "delinquent_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "unit_owners_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "unit_owners_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_owners_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "unit_owners_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_unit_account_summary"
            referencedColumns: ["unit_id"]
          },
        ]
      }
      unit_recurring_charges: {
        Row: {
          active: boolean
          amount: number
          charge_category_id: string
          created_at: string
          created_by: string | null
          end_date: string | null
          frequency: Database["public"]["Enums"]["recurring_frequency"]
          id: string
          last_posted_at: string | null
          memo: string | null
          next_post_date: string
          start_date: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount: number
          charge_category_id: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          id?: string
          last_posted_at?: string | null
          memo?: string | null
          next_post_date?: string
          start_date?: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          charge_category_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          id?: string
          last_posted_at?: string | null
          memo?: string | null
          next_post_date?: string
          start_date?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_recurring_charges_charge_category_id_fkey"
            columns: ["charge_category_id"]
            isOneToOne: false
            referencedRelation: "charge_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_recurring_charges_charge_category_id_fkey"
            columns: ["charge_category_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "unit_recurring_charges_charge_category_id_fkey"
            columns: ["charge_category_id"]
            isOneToOne: false
            referencedRelation: "v_unit_charge_schedule"
            referencedColumns: ["charge_category_id"]
          },
          {
            foreignKeyName: "unit_recurring_charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "delinquent_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "unit_recurring_charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "unit_recurring_charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_recurring_charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "unit_recurring_charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_unit_account_summary"
            referencedColumns: ["unit_id"]
          },
        ]
      }
      units: {
        Row: {
          address_override: string | null
          archived_at: string | null
          bathrooms: number | null
          bedrooms: number | null
          building_id: string
          created_at: string
          home_warranty_company: string | null
          home_warranty_expires: string | null
          id: string
          name: string | null
          notes: string | null
          ownership_pct: number
          parking_spaces: string | null
          sqft: number | null
          storage_number: string | null
          unit_number: string
        }
        Insert: {
          address_override?: string | null
          archived_at?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          building_id: string
          created_at?: string
          home_warranty_company?: string | null
          home_warranty_expires?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          ownership_pct: number
          parking_spaces?: string | null
          sqft?: number | null
          storage_number?: string | null
          unit_number: string
        }
        Update: {
          address_override?: string | null
          archived_at?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          building_id?: string
          created_at?: string
          home_warranty_company?: string | null
          home_warranty_expires?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          ownership_pct?: number
          parking_spaces?: string | null
          sqft?: number | null
          storage_number?: string | null
          unit_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_metrics: {
        Row: {
          api_calls: number
          association_count: number
          bills_posted: number
          created_at: string
          emails_sent: number
          id: string
          owner_count: number
          payments_received: number
          period_month: number
          period_year: number
          portfolio_id: string
          service_requests_created: number
          sms_sent: number
          staff_count: number
          storage_bytes: number
          unit_count: number
          updated_at: string
          work_orders_created: number
        }
        Insert: {
          api_calls?: number
          association_count?: number
          bills_posted?: number
          created_at?: string
          emails_sent?: number
          id?: string
          owner_count?: number
          payments_received?: number
          period_month: number
          period_year: number
          portfolio_id: string
          service_requests_created?: number
          sms_sent?: number
          staff_count?: number
          storage_bytes?: number
          unit_count?: number
          updated_at?: string
          work_orders_created?: number
        }
        Update: {
          api_calls?: number
          association_count?: number
          bills_posted?: number
          created_at?: string
          emails_sent?: number
          id?: string
          owner_count?: number
          payments_received?: number
          period_month?: number
          period_year?: number
          portfolio_id?: string
          service_requests_created?: number
          sms_sent?: number
          staff_count?: number
          storage_bytes?: number
          unit_count?: number
          updated_at?: string
          work_orders_created?: number
        }
        Relationships: [
          {
            foreignKeyName: "usage_metrics_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_metrics_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "usage_metrics_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      user_invitations: {
        Row: {
          association_ids: string[]
          created_at: string
          email: string
          expires_at: string
          full_name: string | null
          hoa_role: Database["public"]["Enums"]["hoa_role"]
          id: string
          invited_by: string | null
          message: string | null
          mvp_role: Database["public"]["Enums"]["mvp_company_role"] | null
          portfolio_id: string
          role_id: string | null
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
          unit_id: string | null
          updated_at: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          association_ids?: string[]
          created_at?: string
          email: string
          expires_at?: string
          full_name?: string | null
          hoa_role?: Database["public"]["Enums"]["hoa_role"]
          id?: string
          invited_by?: string | null
          message?: string | null
          mvp_role?: Database["public"]["Enums"]["mvp_company_role"] | null
          portfolio_id: string
          role_id?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
          unit_id?: string | null
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          association_ids?: string[]
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string | null
          hoa_role?: Database["public"]["Enums"]["hoa_role"]
          id?: string
          invited_by?: string | null
          message?: string | null
          mvp_role?: Database["public"]["Enums"]["mvp_company_role"] | null
          portfolio_id?: string
          role_id?: string | null
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
          unit_id?: string | null
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "user_invitations_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "user_invitations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "delinquent_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "user_invitations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "user_invitations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "user_invitations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_unit_account_summary"
            referencedColumns: ["unit_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          description: string | null
          gl_account_permissions: Json
          id: string
          is_system: boolean
          name: string
          portfolio_id: string | null
          profile_access: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          gl_account_permissions?: Json
          id?: string
          is_system?: boolean
          name: string
          portfolio_id?: string | null
          profile_access?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          gl_account_permissions?: Json
          id?: string
          is_system?: boolean
          name?: string
          portfolio_id?: string | null
          profile_access?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "user_roles_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          auth_user_id: string
          device_fingerprint: string | null
          ended_at: string | null
          ended_reason: string | null
          expires_at: string | null
          id: string
          ip_address: string | null
          last_active_at: string
          portfolio_id: string | null
          started_at: string
          user_agent: string | null
        }
        Insert: {
          auth_user_id: string
          device_fingerprint?: string | null
          ended_at?: string | null
          ended_reason?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          last_active_at?: string
          portfolio_id?: string | null
          started_at?: string
          user_agent?: string | null
        }
        Update: {
          auth_user_id?: string
          device_fingerprint?: string | null
          ended_at?: string | null
          ended_reason?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          last_active_at?: string
          portfolio_id?: string | null
          started_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sessions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "user_sessions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      vendor_compliance: {
        Row: {
          auto_insurance_expiration: string | null
          contract_expiration: string | null
          epa_certification_expiration: string | null
          general_liability_expiration: string | null
          state_license_expiration: string | null
          updated_at: string
          vendor_id: string
          workers_comp_expiration: string | null
        }
        Insert: {
          auto_insurance_expiration?: string | null
          contract_expiration?: string | null
          epa_certification_expiration?: string | null
          general_liability_expiration?: string | null
          state_license_expiration?: string | null
          updated_at?: string
          vendor_id: string
          workers_comp_expiration?: string | null
        }
        Update: {
          auto_insurance_expiration?: string | null
          contract_expiration?: string | null
          epa_certification_expiration?: string | null
          general_liability_expiration?: string | null
          state_license_expiration?: string | null
          updated_at?: string
          vendor_id?: string
          workers_comp_expiration?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_compliance_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "v_insurance_expirations"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_compliance_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address_city: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          archived_at: string | null
          auth_user_id: string | null
          auto_pay_notes: string | null
          auto_pay_setup_at: string | null
          bank_account_number: string | null
          bank_routing_number: string | null
          check_consolidation: string | null
          check_stub_breakdown: string | null
          created_at: string
          created_by: string | null
          default_check_memo: string | null
          default_gl_account_id: string | null
          email_echeck_receipt: boolean
          emails: Json
          hold_payments: boolean
          id: string
          is_auto_pay: boolean
          is_utility: boolean
          name: string
          notes: string | null
          payment_terms: string | null
          payment_type:
            | Database["public"]["Enums"]["vendor_payment_type"]
            | null
          phone_numbers: Json
          portal_activated: boolean
          portal_login_last_at: string | null
          portfolio_id: string
          savings_account: boolean
          send_1099: boolean
          tax_account_number: string | null
          taxpayer_id: string | null
          taxpayer_name: string | null
          trade: Database["public"]["Enums"]["vendor_trade"]
          updated_at: string
          vendor_type: Database["public"]["Enums"]["vendor_type"]
          work_order_adjustment: number
        }
        Insert: {
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          archived_at?: string | null
          auth_user_id?: string | null
          auto_pay_notes?: string | null
          auto_pay_setup_at?: string | null
          bank_account_number?: string | null
          bank_routing_number?: string | null
          check_consolidation?: string | null
          check_stub_breakdown?: string | null
          created_at?: string
          created_by?: string | null
          default_check_memo?: string | null
          default_gl_account_id?: string | null
          email_echeck_receipt?: boolean
          emails?: Json
          hold_payments?: boolean
          id?: string
          is_auto_pay?: boolean
          is_utility?: boolean
          name: string
          notes?: string | null
          payment_terms?: string | null
          payment_type?:
            | Database["public"]["Enums"]["vendor_payment_type"]
            | null
          phone_numbers?: Json
          portal_activated?: boolean
          portal_login_last_at?: string | null
          portfolio_id: string
          savings_account?: boolean
          send_1099?: boolean
          tax_account_number?: string | null
          taxpayer_id?: string | null
          taxpayer_name?: string | null
          trade?: Database["public"]["Enums"]["vendor_trade"]
          updated_at?: string
          vendor_type?: Database["public"]["Enums"]["vendor_type"]
          work_order_adjustment?: number
        }
        Update: {
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          archived_at?: string | null
          auth_user_id?: string | null
          auto_pay_notes?: string | null
          auto_pay_setup_at?: string | null
          bank_account_number?: string | null
          bank_routing_number?: string | null
          check_consolidation?: string | null
          check_stub_breakdown?: string | null
          created_at?: string
          created_by?: string | null
          default_check_memo?: string | null
          default_gl_account_id?: string | null
          email_echeck_receipt?: boolean
          emails?: Json
          hold_payments?: boolean
          id?: string
          is_auto_pay?: boolean
          is_utility?: boolean
          name?: string
          notes?: string | null
          payment_terms?: string | null
          payment_type?:
            | Database["public"]["Enums"]["vendor_payment_type"]
            | null
          phone_numbers?: Json
          portal_activated?: boolean
          portal_login_last_at?: string | null
          portfolio_id?: string
          savings_account?: boolean
          send_1099?: boolean
          tax_account_number?: string | null
          taxpayer_id?: string | null
          taxpayer_name?: string | null
          trade?: Database["public"]["Enums"]["vendor_trade"]
          updated_at?: string
          vendor_type?: Database["public"]["Enums"]["vendor_type"]
          work_order_adjustment?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendors_default_gl_account_id_fkey"
            columns: ["default_gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "vendors_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      violation_followup_steps: {
        Row: {
          archived_at: string | null
          association_id: string
          created_at: string
          days_after_previous: number
          delivery_methods: string[] | null
          fee: number | null
          follow_up_name: string
          gl_account_id: string | null
          id: string
          letter_template_id: string | null
          step_order: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          association_id: string
          created_at?: string
          days_after_previous?: number
          delivery_methods?: string[] | null
          fee?: number | null
          follow_up_name: string
          gl_account_id?: string | null
          id?: string
          letter_template_id?: string | null
          step_order?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          association_id?: string
          created_at?: string
          days_after_previous?: number
          delivery_methods?: string[] | null
          fee?: number | null
          follow_up_name?: string
          gl_account_id?: string | null
          id?: string
          letter_template_id?: string | null
          step_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "violation_followup_steps_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "violation_followup_steps_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "violation_followup_steps_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "violation_followup_steps_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "violation_followup_steps_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "violation_followup_steps_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "violation_followup_steps_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "violation_followup_steps_letter_template_id_fkey"
            columns: ["letter_template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      violation_updates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          new_status: Database["public"]["Enums"]["violation_status"] | null
          note: string
          violation_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["violation_status"] | null
          note: string
          violation_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["violation_status"] | null
          note?: string
          violation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "violation_updates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "violation_updates_violation_id_fkey"
            columns: ["violation_id"]
            isOneToOne: false
            referencedRelation: "violations"
            referencedColumns: ["id"]
          },
        ]
      }
      violations: {
        Row: {
          archived_at: string | null
          association_id: string
          attachments: Json
          closed_at: string | null
          created_at: string
          created_by: string | null
          cured_at: string | null
          date_observed: string
          description: string | null
          due_date: string | null
          fine_amount: number | null
          fine_assessed_at: string | null
          hearing_date: string | null
          id: string
          owner_id: string | null
          reported_date: string | null
          status: Database["public"]["Enums"]["violation_status"]
          title: string
          unit_id: string | null
          updated_at: string
          violation_type: Database["public"]["Enums"]["violation_type"]
        }
        Insert: {
          archived_at?: string | null
          association_id: string
          attachments?: Json
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          cured_at?: string | null
          date_observed?: string
          description?: string | null
          due_date?: string | null
          fine_amount?: number | null
          fine_assessed_at?: string | null
          hearing_date?: string | null
          id?: string
          owner_id?: string | null
          reported_date?: string | null
          status?: Database["public"]["Enums"]["violation_status"]
          title: string
          unit_id?: string | null
          updated_at?: string
          violation_type?: Database["public"]["Enums"]["violation_type"]
        }
        Update: {
          archived_at?: string | null
          association_id?: string
          attachments?: Json
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          cured_at?: string | null
          date_observed?: string
          description?: string | null
          due_date?: string | null
          fine_amount?: number | null
          fine_assessed_at?: string | null
          hearing_date?: string | null
          id?: string
          owner_id?: string | null
          reported_date?: string | null
          status?: Database["public"]["Enums"]["violation_status"]
          title?: string
          unit_id?: string | null
          updated_at?: string
          violation_type?: Database["public"]["Enums"]["violation_type"]
        }
        Relationships: [
          {
            foreignKeyName: "violations_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "violations_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "violations_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "violations_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "violations_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "violations_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "violations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "violations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "violations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "violations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "delinquent_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "violations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "violations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "violations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "violations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_unit_account_summary"
            referencedColumns: ["unit_id"]
          },
        ]
      }
      votes: {
        Row: {
          ballot_id: string
          cast_at: string
          choice: string
          id: string
          owner_id: string
          unit_id: string
          weight: number
        }
        Insert: {
          ballot_id: string
          cast_at?: string
          choice: string
          id?: string
          owner_id: string
          unit_id: string
          weight?: number
        }
        Update: {
          ballot_id?: string
          cast_at?: string
          choice?: string
          id?: string
          owner_id?: string
          unit_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "votes_ballot_id_fkey"
            columns: ["ballot_id"]
            isOneToOne: false
            referencedRelation: "ballots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "votes_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "delinquent_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "votes_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "votes_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "votes_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_unit_account_summary"
            referencedColumns: ["unit_id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          endpoint_id: string
          error_message: string | null
          event_type: Database["public"]["Enums"]["webhook_event"]
          id: string
          last_attempt_at: string | null
          next_attempt_at: string
          payload: Json
          response_body: string | null
          response_code: number | null
          signature: string | null
          status: Database["public"]["Enums"]["webhook_delivery_status"]
          succeeded_at: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          endpoint_id: string
          error_message?: string | null
          event_type: Database["public"]["Enums"]["webhook_event"]
          id?: string
          last_attempt_at?: string | null
          next_attempt_at?: string
          payload: Json
          response_body?: string | null
          response_code?: number | null
          signature?: string | null
          status?: Database["public"]["Enums"]["webhook_delivery_status"]
          succeeded_at?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          endpoint_id?: string
          error_message?: string | null
          event_type?: Database["public"]["Enums"]["webhook_event"]
          id?: string
          last_attempt_at?: string | null
          next_attempt_at?: string
          payload?: Json
          response_body?: string | null
          response_code?: number | null
          signature?: string | null
          status?: Database["public"]["Enums"]["webhook_delivery_status"]
          succeeded_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          disabled_until: string | null
          events: Database["public"]["Enums"]["webhook_event"][]
          failure_count: number
          id: string
          last_failure_at: string | null
          last_failure_message: string | null
          last_success_at: string | null
          name: string
          portfolio_id: string
          signing_secret: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          disabled_until?: string | null
          events?: Database["public"]["Enums"]["webhook_event"][]
          failure_count?: number
          id?: string
          last_failure_at?: string | null
          last_failure_message?: string | null
          last_success_at?: string | null
          name: string
          portfolio_id: string
          signing_secret?: string
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          disabled_until?: string | null
          events?: Database["public"]["Enums"]["webhook_event"][]
          failure_count?: number
          id?: string
          last_failure_at?: string | null
          last_failure_message?: string | null
          last_success_at?: string | null
          name?: string
          portfolio_id?: string
          signing_secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_endpoints_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "webhook_endpoints_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      work_order_estimates: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          notes: string | null
          rejected_at: string | null
          rejection_reason: string | null
          submitted_at: string
          updated_at: string
          vendor_id: string | null
          work_order_id: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          submitted_at?: string
          updated_at?: string
          vendor_id?: string | null
          work_order_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          submitted_at?: string
          updated_at?: string
          vendor_id?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_estimates_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_insurance_expirations"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "work_order_estimates_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_estimates_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_labor_entries: {
        Row: {
          created_at: string
          created_by: string | null
          date_worked: string
          description: string | null
          hourly_rate: number | null
          hours: number
          id: string
          labor_cost: number | null
          tech_id: string | null
          tech_name: string | null
          updated_at: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_worked?: string
          description?: string | null
          hourly_rate?: number | null
          hours: number
          id?: string
          labor_cost?: number | null
          tech_id?: string | null
          tech_name?: string | null
          updated_at?: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_worked?: string
          description?: string | null
          hourly_rate?: number | null
          hours?: number
          id?: string
          labor_cost?: number | null
          tech_id?: string | null
          tech_name?: string | null
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_labor_entries_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_updates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          new_status: Database["public"]["Enums"]["work_order_status"] | null
          note: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["work_order_status"] | null
          note: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["work_order_status"] | null
          note?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_updates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_updates_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          archived_at: string | null
          assigned_to: string | null
          assignee_id: string | null
          association_id: string
          category: Database["public"]["Enums"]["work_order_category"]
          completed_date: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          internal_notes: string | null
          issue: string | null
          job_description: string | null
          next_followup_date: string | null
          number: string | null
          owner_approved: boolean
          owner_availability: string | null
          portfolio_id: string | null
          priority: Database["public"]["Enums"]["work_order_priority"]
          requested_by: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          service_request_id: string | null
          status: Database["public"]["Enums"]["work_order_status"]
          title: string
          trade: Database["public"]["Enums"]["vendor_trade"] | null
          unit_id: string | null
          updated_at: string
          vendor_id: string | null
          vendor_instructions: string | null
          withheld_amount_from_owner: number
        }
        Insert: {
          archived_at?: string | null
          assigned_to?: string | null
          assignee_id?: string | null
          association_id: string
          category?: Database["public"]["Enums"]["work_order_category"]
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          internal_notes?: string | null
          issue?: string | null
          job_description?: string | null
          next_followup_date?: string | null
          number?: string | null
          owner_approved?: boolean
          owner_availability?: string | null
          portfolio_id?: string | null
          priority?: Database["public"]["Enums"]["work_order_priority"]
          requested_by?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          service_request_id?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          title: string
          trade?: Database["public"]["Enums"]["vendor_trade"] | null
          unit_id?: string | null
          updated_at?: string
          vendor_id?: string | null
          vendor_instructions?: string | null
          withheld_amount_from_owner?: number
        }
        Update: {
          archived_at?: string | null
          assigned_to?: string | null
          assignee_id?: string | null
          association_id?: string
          category?: Database["public"]["Enums"]["work_order_category"]
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          internal_notes?: string | null
          issue?: string | null
          job_description?: string | null
          next_followup_date?: string | null
          number?: string | null
          owner_approved?: boolean
          owner_availability?: string | null
          portfolio_id?: string | null
          priority?: Database["public"]["Enums"]["work_order_priority"]
          requested_by?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          service_request_id?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          title?: string
          trade?: Database["public"]["Enums"]["vendor_trade"] | null
          unit_id?: string | null
          updated_at?: string
          vendor_id?: string | null
          vendor_instructions?: string | null
          withheld_amount_from_owner?: number
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "work_orders_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "work_orders_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "work_orders_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "work_orders_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "work_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "work_orders_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "work_orders_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "delinquent_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "work_orders_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "work_orders_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "work_orders_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_unit_account_summary"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "work_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_insurance_expirations"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "work_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          steps: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          steps?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          steps?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      aged_receivables: {
        Row: {
          aging_bucket: string | null
          amount: number | null
          association_id: string | null
          association_name: string | null
          balance_due: number | null
          building_name: string | null
          charge_id: string | null
          description: string | null
          due_date: string | null
          total_paid: number | null
          unit_id: string | null
          unit_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "delinquent_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_unit_account_summary"
            referencedColumns: ["unit_id"]
          },
        ]
      }
      association_ownership_totals: {
        Row: {
          association_id: string | null
          total_pct: number | null
          unit_count: number | null
        }
        Relationships: []
      }
      budget_line_totals: {
        Row: {
          annual_total: number | null
          association_id: string | null
          category: Database["public"]["Enums"]["budget_category"] | null
          created_at: string | null
          fiscal_year: number | null
          gl_account_id: string | null
          id: string | null
          monthly_amounts: number[] | null
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          annual_total?: never
          association_id?: string | null
          category?: Database["public"]["Enums"]["budget_category"] | null
          created_at?: string | null
          fiscal_year?: number | null
          gl_account_id?: string | null
          id?: string | null
          monthly_amounts?: number[] | null
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          annual_total?: never
          association_id?: string | null
          category?: Database["public"]["Enums"]["budget_category"] | null
          created_at?: string | null
          fiscal_year?: number | null
          gl_account_id?: string | null
          id?: string | null
          monthly_amounts?: number[] | null
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_lines_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "budget_lines_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "budget_lines_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "budget_lines_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "budget_lines_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "budget_lines_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      delinquent_units: {
        Row: {
          association_id: string | null
          balance: number | null
          building_id: string | null
          oldest_due: string | null
          unit_id: string | null
          unit_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "units_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_income: {
        Row: {
          association_id: string | null
          association_name: string | null
          method: string | null
          month: string | null
          payment_count: number | null
          total_amount: number | null
        }
        Relationships: []
      }
      unit_balances: {
        Row: {
          association_id: string | null
          balance: number | null
          building_id: string | null
          total_charges: number | null
          total_payments: number | null
          unit_id: string | null
          unit_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "units_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      v_charge_balances: {
        Row: {
          applied_amount: number | null
          assessment_period_id: string | null
          balance_due: number | null
          charge_id: string | null
          charge_type: Database["public"]["Enums"]["charge_type"] | null
          charged_amount: number | null
          description: string | null
          due_date: string | null
          is_past_due: boolean | null
          payment_status: string | null
          unit_id: string | null
        }
        Insert: {
          applied_amount?: never
          assessment_period_id?: string | null
          balance_due?: never
          charge_id?: string | null
          charge_type?: Database["public"]["Enums"]["charge_type"] | null
          charged_amount?: number | null
          description?: string | null
          due_date?: string | null
          is_past_due?: never
          payment_status?: never
          unit_id?: string | null
        }
        Update: {
          applied_amount?: never
          assessment_period_id?: string | null
          balance_due?: never
          charge_id?: string | null
          charge_type?: Database["public"]["Enums"]["charge_type"] | null
          charged_amount?: number | null
          description?: string | null
          due_date?: string | null
          is_past_due?: never
          payment_status?: never
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "charges_assessment_period_id_fkey"
            columns: ["assessment_period_id"]
            isOneToOne: false
            referencedRelation: "assessment_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "delinquent_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_unit_account_summary"
            referencedColumns: ["unit_id"]
          },
        ]
      }
      v_charges_by_category: {
        Row: {
          association_id: string | null
          association_name: string | null
          category_code: string | null
          category_id: string | null
          category_name: string | null
          charge_count: number | null
          is_assessment: boolean | null
          is_fee: boolean | null
          outstanding_balance: number | null
          period_month: string | null
          portfolio_id: string | null
          total_applied: number | null
          total_charged: number | null
        }
        Relationships: [
          {
            foreignKeyName: "associations_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associations_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "associations_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      v_check_writing_queue: {
        Row: {
          address_city: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          amount: number | null
          association_id: string | null
          association_name: string | null
          bank_account_id: string | null
          bill_date: string | null
          bill_id: string | null
          days_past_due: number | null
          due_date: string | null
          gl_account_id: string | null
          memo: string | null
          portfolio_id: string | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payable_bills_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "payable_bills_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "payable_bills_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payable_bills_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "payable_bills_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "payable_bills_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "payable_bills_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payable_bills_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payable_bills_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payable_bills_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "payable_bills_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "payable_bills_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_insurance_expirations"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "payable_bills_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      v_dashboard_summary: {
        Row: {
          company_name: string | null
          delinquency_0_30: number | null
          delinquency_31_60: number | null
          delinquency_61_plus: number | null
          insurance_expirations_60d: number | null
          occupancy_pct: number | null
          open_diagnostics: number | null
          outstanding_bills: number | null
          pending_approvals: number | null
          portal_activated_count: number | null
          portal_no_email_count: number | null
          portal_not_activated_count: number | null
          portfolio_id: string | null
          recent_payment_count: number | null
          suspended_at: string | null
          tier: Database["public"]["Enums"]["portfolio_tier"] | null
          upcoming_recerts: number | null
          wo_assigned: number | null
          wo_completed: number | null
          wo_in_progress: number | null
          wo_new: number | null
          wo_scheduled: number | null
          wo_total: number | null
        }
        Insert: {
          company_name?: string | null
          delinquency_0_30?: never
          delinquency_31_60?: never
          delinquency_61_plus?: never
          insurance_expirations_60d?: never
          occupancy_pct?: never
          open_diagnostics?: never
          outstanding_bills?: never
          pending_approvals?: never
          portal_activated_count?: never
          portal_no_email_count?: never
          portal_not_activated_count?: never
          portfolio_id?: string | null
          recent_payment_count?: never
          suspended_at?: string | null
          tier?: Database["public"]["Enums"]["portfolio_tier"] | null
          upcoming_recerts?: never
          wo_assigned?: never
          wo_completed?: never
          wo_in_progress?: never
          wo_new?: never
          wo_scheduled?: never
          wo_total?: never
        }
        Update: {
          company_name?: string | null
          delinquency_0_30?: never
          delinquency_31_60?: never
          delinquency_61_plus?: never
          insurance_expirations_60d?: never
          occupancy_pct?: never
          open_diagnostics?: never
          outstanding_bills?: never
          pending_approvals?: never
          portal_activated_count?: never
          portal_no_email_count?: never
          portal_not_activated_count?: never
          portfolio_id?: string | null
          recent_payment_count?: never
          suspended_at?: string | null
          tier?: Database["public"]["Enums"]["portfolio_tier"] | null
          upcoming_recerts?: never
          wo_assigned?: never
          wo_completed?: never
          wo_in_progress?: never
          wo_new?: never
          wo_scheduled?: never
          wo_total?: never
        }
        Relationships: []
      }
      v_due_reminders: {
        Row: {
          association_id: string | null
          association_name: string | null
          calendar_scope: Database["public"]["Enums"]["calendar_scope"] | null
          description: string | null
          event_id: string | null
          event_type: Database["public"]["Enums"]["event_type"] | null
          location: string | null
          portfolio_id: string | null
          reminder_days_before: number | null
          reminder_start: string | null
          start_datetime: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "calendar_events_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "calendar_events_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "calendar_events_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "calendar_events_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "calendar_events_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "calendar_events_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      v_homeowner_ledgers: {
        Row: {
          association_id: string | null
          association_name: string | null
          current_balance: number | null
          email: string | null
          lifetime_charges: number | null
          lifetime_payments: number | null
          open_past_due_count: number | null
          owner_id: string | null
          owner_name: string | null
          portfolio_id: string | null
          unit_id: string | null
          unit_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "associations_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associations_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "associations_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      v_insurance_expirations: {
        Row: {
          auto_insurance_expiration: string | null
          epa_certification_expiration: string | null
          general_liability_expiration: string | null
          portfolio_id: string | null
          soonest_expiration: string | null
          state_license_expiration: string | null
          vendor_id: string | null
          vendor_name: string | null
          workers_comp_expiration: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "vendors_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      v_pending_invitations: {
        Row: {
          created_at: string | null
          email: string | null
          expires_at: string | null
          hoa_role: Database["public"]["Enums"]["hoa_role"] | null
          id: string | null
          invited_by: string | null
          message: string | null
          portfolio_id: string | null
          portfolio_name: string | null
          role_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "user_invitations_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
        ]
      }
      v_portfolio_health: {
        Row: {
          abandoned_webhooks_7d: number | null
          association_count: number | null
          company_name: string | null
          failed_logins_24h: number | null
          pending_invitations: number | null
          portfolio_id: string | null
          seats_included: number | null
          seats_used: number | null
          subscription_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          suspended_at: string | null
          tier: Database["public"]["Enums"]["portfolio_tier"] | null
          unit_count: number | null
        }
        Relationships: []
      }
      v_role_permissions: {
        Row: {
          assign_managers: boolean | null
          create_work_orders: boolean | null
          edit_associations: boolean | null
          edit_financials: boolean | null
          invite_users: boolean | null
          manage_owners: boolean | null
          role: string | null
          scope: string | null
          send_notices: boolean | null
          view_associations: boolean | null
          view_financials: boolean | null
        }
        Relationships: []
      }
      v_unapplied_credits: {
        Row: {
          amount: number | null
          applied_amount: number | null
          payment_date: string | null
          payment_id: string | null
          unapplied_amount: number | null
          unit_id: string | null
        }
        Insert: {
          amount?: number | null
          applied_amount?: never
          payment_date?: string | null
          payment_id?: string | null
          unapplied_amount?: never
          unit_id?: string | null
        }
        Update: {
          amount?: number | null
          applied_amount?: never
          payment_date?: string | null
          payment_id?: string | null
          unapplied_amount?: never
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "delinquent_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "payments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "payments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "payments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_unit_account_summary"
            referencedColumns: ["unit_id"]
          },
        ]
      }
      v_unit_account_summary: {
        Row: {
          association_id: string | null
          outstanding_balance: number | null
          portfolio_id: string | null
          total_applied: number | null
          total_charged: number | null
          total_paid: number | null
          unapplied_credit: number | null
          unit_id: string | null
          unit_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "associations_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associations_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "associations_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
        ]
      }
      v_unit_charge_schedule: {
        Row: {
          active: boolean | null
          amount: number | null
          association_id: string | null
          association_name: string | null
          category_code: string | null
          category_name: string | null
          charge_category_id: string | null
          charge_type: Database["public"]["Enums"]["charge_type"] | null
          end_date: string | null
          frequency: Database["public"]["Enums"]["recurring_frequency"] | null
          is_assessment: boolean | null
          is_fee: boolean | null
          last_posted_at: string | null
          memo: string | null
          next_post_date: string | null
          portfolio_id: string | null
          recurring_charge_id: string | null
          start_date: string | null
          unit_id: string | null
          unit_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "associations_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associations_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_summary"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "associations_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "v_portfolio_health"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "aged_receivables"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "association_ownership_totals"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "monthly_income"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_charges_by_category"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "buildings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["association_id"]
          },
          {
            foreignKeyName: "unit_recurring_charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "delinquent_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "unit_recurring_charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "unit_recurring_charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_recurring_charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_homeowner_ledgers"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "unit_recurring_charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_unit_account_summary"
            referencedColumns: ["unit_id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: Json }
      aggregate_usage_metrics: {
        Args: { p_month: number; p_year: number }
        Returns: undefined
      }
      alert_overdue_bills: { Args: never; Returns: number }
      anonymize_owner: { Args: { p_owner_id: string }; Returns: undefined }
      app_portal_url: { Args: never; Returns: string }
      apply_late_fees: { Args: never; Returns: number }
      apply_payment: {
        Args: {
          p_charge_ids?: string[]
          p_payment_id: string
          p_strategy?: string
        }
        Returns: Json
      }
      assemble_vendor_1099_data: {
        Args: { p_portfolio_id: string; p_tax_year: number }
        Returns: Json
      }
      assign_role: {
        Args: { p_profile_id: string; p_role_id: string }
        Returns: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          full_name: string | null
          gl_account_permissions: Json
          hoa_role: Database["public"]["Enums"]["hoa_role"] | null
          id: string
          last_login_at: string | null
          last_login_ip: string | null
          mfa_enrolled_at: string | null
          mfa_required: boolean
          mvp_role: Database["public"]["Enums"]["mvp_company_role"] | null
          portal_login_last_at: string | null
          portfolio_id: string | null
          profile_access: string[]
          role: string | null
          role_id: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      association_operating_account: {
        Args: { p_assoc_id: string }
        Returns: string
      }
      association_reserve_account: {
        Args: { p_assoc_id: string }
        Returns: string
      }
      bootstrap_platform_admin: {
        Args: { p_auth_user_id: string; p_full_name?: string }
        Returns: {
          active: boolean
          auth_user_id: string
          created_at: string
          created_by: string | null
          email: string
          full_name: string | null
          id: string
          mfa_enrolled_at: string | null
          mfa_required: boolean
          role: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "platform_operators"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      calculate_convenience_fee: {
        Args: {
          p_amount_cents: number
          p_method: string
          p_portfolio_id: string
        }
        Returns: Json
      }
      can_access_association: { Args: { a_id: string }; Returns: boolean }
      can_access_association_mvp: { Args: { a_id: string }; Returns: boolean }
      can_access_portfolio: { Args: { p_id: string }; Returns: boolean }
      can_access_unit: { Args: { u_id: string }; Returns: boolean }
      can_admin_portfolio: { Args: { p_id: string }; Returns: boolean }
      can_edit_association_mvp: { Args: { a_id: string }; Returns: boolean }
      can_manage_finance: { Args: { p_id: string }; Returns: boolean }
      can_read_gl: { Args: { gl_id: string }; Returns: boolean }
      cancel_autopay: {
        Args: { p_mandate_id: string; p_reason?: string }
        Returns: {
          association_id: string | null
          authorized_amount_max_cents: number
          canceled_at: string | null
          canceled_by: string | null
          created_at: string
          day_of_month: number | null
          end_date: string | null
          failure_count: number
          frequency: Database["public"]["Enums"]["autopay_frequency"]
          id: string
          last_failure_at: string | null
          last_failure_reason: string | null
          last_run_at: string | null
          last_run_payment_intent_id: string | null
          mandate_document_url: string | null
          mandate_ip_address: string | null
          mandate_signed_at: string | null
          mandate_user_agent: string | null
          next_run_date: string | null
          owner_id: string
          paused_at: string | null
          paused_reason: string | null
          payment_method_id: string
          portfolio_id: string
          processor_mandate_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["autopay_status"]
          success_count: number
          unit_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "autopay_mandates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_api_key: {
        Args: {
          p_expires_days?: number
          p_name: string
          p_portfolio_id: string
          p_scopes?: string[]
        }
        Returns: Json
      }
      create_invitation: {
        Args: {
          p_email: string
          p_expires_days?: number
          p_hoa_role?: Database["public"]["Enums"]["hoa_role"]
          p_message?: string
          p_portfolio_id: string
          p_role_id?: string
        }
        Returns: {
          association_ids: string[]
          created_at: string
          email: string
          expires_at: string
          full_name: string | null
          hoa_role: Database["public"]["Enums"]["hoa_role"]
          id: string
          invited_by: string | null
          message: string | null
          mvp_role: Database["public"]["Enums"]["mvp_company_role"] | null
          portfolio_id: string
          role_id: string | null
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
          unit_id: string | null
          updated_at: string
          used_at: string | null
          used_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "user_invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_board_association_ids: { Args: never; Returns: string[] }
      current_owner_id: { Args: never; Returns: string }
      current_portfolio_id: { Args: never; Returns: string }
      current_resident_association_ids: { Args: never; Returns: string[] }
      current_resident_unit_ids: { Args: never; Returns: string[] }
      current_role_name: { Args: never; Returns: string }
      current_vendor_id: { Args: never; Returns: string }
      dispatch_webhook: {
        Args: {
          p_event: Database["public"]["Enums"]["webhook_event"]
          p_payload: Json
          p_portfolio_id: string
        }
        Returns: number
      }
      effective_late_fee_amount: {
        Args: { p_association_id: string }
        Returns: number
      }
      effective_late_fee_grace_days: {
        Args: { p_association_id: string }
        Returns: number
      }
      effective_nsf_fee_amount: {
        Args: { p_association_id: string }
        Returns: number
      }
      enqueue_scheduled_reports: { Args: never; Returns: number }
      enroll_autopay: {
        Args: {
          p_authorized_max_cents: number
          p_frequency?: Database["public"]["Enums"]["autopay_frequency"]
          p_payment_method_id: string
          p_unit_id: string
        }
        Returns: {
          association_id: string | null
          authorized_amount_max_cents: number
          canceled_at: string | null
          canceled_by: string | null
          created_at: string
          day_of_month: number | null
          end_date: string | null
          failure_count: number
          frequency: Database["public"]["Enums"]["autopay_frequency"]
          id: string
          last_failure_at: string | null
          last_failure_reason: string | null
          last_run_at: string | null
          last_run_payment_intent_id: string | null
          mandate_document_url: string | null
          mandate_ip_address: string | null
          mandate_signed_at: string | null
          mandate_user_agent: string | null
          next_run_date: string | null
          owner_id: string
          paused_at: string | null
          paused_reason: string | null
          payment_method_id: string
          portfolio_id: string
          processor_mandate_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["autopay_status"]
          success_count: number
          unit_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "autopay_mandates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_monthly_statements: {
        Args: { p_month?: number; p_year?: number }
        Returns: number
      }
      generate_recurring_bills: { Args: never; Returns: number }
      generate_recurring_journal_entries: { Args: never; Returns: number }
      generate_recurring_work_orders: { Args: never; Returns: number }
      has_entitlement: {
        Args: { p_feature_key: string; p_portfolio_id: string }
        Returns: boolean
      }
      has_role: { Args: { role_name: string }; Returns: boolean }
      invite_homeowner: {
        Args: {
          p_email?: string
          p_message?: string
          p_owner_id: string
          p_portfolio_id: string
        }
        Returns: Json
      }
      invite_staff: {
        Args: {
          p_email: string
          p_expires_days?: number
          p_message?: string
          p_portfolio_id: string
          p_role_name?: string
        }
        Returns: Json
      }
      invite_vendor: {
        Args: {
          p_email: string
          p_message?: string
          p_portfolio_id: string
          p_vendor_id: string
        }
        Returns: Json
      }
      invoke_edge_function: {
        Args: { body?: Json; fn_name: string }
        Returns: number
      }
      is_accountant: { Args: never; Returns: boolean }
      is_any_staff: { Args: never; Returns: boolean }
      is_assistant_manager: { Args: never; Returns: boolean }
      is_board_user: { Args: never; Returns: boolean }
      is_company_admin: { Args: never; Returns: boolean }
      is_finance_staff: { Args: never; Returns: boolean }
      is_full_access_staff: { Args: never; Returns: boolean }
      is_manager: { Args: never; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_platform_operator: { Args: never; Returns: boolean }
      is_portal_resident: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      mark_webhook_delivery: {
        Args: {
          p_delivery_id: string
          p_error_message?: string
          p_response_body?: string
          p_response_code?: number
          p_success: boolean
        }
        Returns: undefined
      }
      me: { Args: never; Returns: Json }
      platform_create_company: {
        Args: {
          p_admin_email: string
          p_admin_full_name: string
          p_company_name: string
          p_message?: string
        }
        Returns: Json
      }
      post_ad_hoc_charge: {
        Args: {
          p_amount: number
          p_charge_category_id: string
          p_description: string
          p_due_date?: string
          p_unit_id: string
        }
        Returns: {
          amount: number
          assessment_period_id: string | null
          charge_category_id: string | null
          charge_type: Database["public"]["Enums"]["charge_type"]
          created_at: string
          created_by: string | null
          description: string
          due_date: string
          gl_account_id: string | null
          id: string
          unit_id: string
        }
        SetofOptions: {
          from: "*"
          to: "charges"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      post_dues_increase: {
        Args: { p_dues_increase_id: string }
        Returns: number
      }
      post_nsf_fee: {
        Args: { p_payment_id: string; p_reason?: string }
        Returns: string
      }
      post_unit_recurring_charges: { Args: never; Returns: number }
      provision_portfolio: {
        Args: {
          p_allowed_email_domains?: string[]
          p_company_name: string
          p_first_admin_email: string
          p_first_admin_name?: string
          p_seats?: number
          p_tier?: Database["public"]["Enums"]["portfolio_tier"]
          p_trial_days?: number
        }
        Returns: Json
      }
      queue_calendar_sms: { Args: { p_event_id: string }; Returns: string }
      queue_payment_reminders: { Args: never; Returns: number }
      queue_report_run: {
        Args: {
          p_definition_id: string
          p_output_format?: Database["public"]["Enums"]["report_format"]
          p_parameters?: Json
          p_saved_report_id?: string
        }
        Returns: {
          created_at: string
          definition_id: string
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          output_format: Database["public"]["Enums"]["report_format"]
          output_size_bytes: number | null
          output_url: string | null
          parameters: Json
          portfolio_id: string
          row_count: number | null
          saved_report_id: string | null
          scheduled_report_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["report_run_status"]
          triggered_by: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "report_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reactivate_portfolio: {
        Args: { p_portfolio_id: string }
        Returns: {
          address_city: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          allowed_email_domains: string[]
          archived_at: string | null
          company_name: string
          convenience_fee_ach_fixed_cents: number
          convenience_fee_ach_pct: number
          convenience_fee_card_fixed_cents: number
          convenience_fee_card_pct: number
          convenience_fee_label: string
          convenience_fee_minimum_cents: number
          convenience_fee_mode: Database["public"]["Enums"]["convenience_fee_mode"]
          created_at: string
          created_by: string | null
          default_late_fee_amount: number
          default_late_fee_grace_days: number
          default_nsf_fee_amount: number
          default_payment_reminder_days: number[]
          entitlements: string[]
          fiscal_year_start_month: number
          id: string
          password_min_length: number
          phone_number: string | null
          profile_type: Database["public"]["Enums"]["portfolio_profile_type"]
          require_mfa_for_admins: boolean
          require_mfa_for_staff: boolean
          session_timeout_minutes: number
          statement_generation_day: number
          suspended_at: string | null
          suspension_reason: string | null
          texting_phone_number: string | null
          tier: Database["public"]["Enums"]["portfolio_tier"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "portfolios"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recent_failed_attempts: {
        Args: { p_email: string; p_window_minutes?: number }
        Returns: number
      }
      record_check_run: {
        Args: {
          p_bank_account_id: string
          p_bill_ids: string[]
          p_payment_date?: string
          p_starting_check_number: number
        }
        Returns: Json
      }
      record_login_attempt: {
        Args: {
          p_auth_user_id: string
          p_email: string
          p_failure_reason?: string
          p_ip_address?: string
          p_mfa_used?: boolean
          p_success: boolean
          p_user_agent?: string
        }
        Returns: string
      }
      relink_all_portal_users: {
        Args: never
        Returns: {
          rows_linked: number
          target_table: string
        }[]
      }
      remove_staff_member: {
        Args: { p_profile_id: string; p_reason?: string }
        Returns: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          full_name: string | null
          gl_account_permissions: Json
          hoa_role: Database["public"]["Enums"]["hoa_role"] | null
          id: string
          last_login_at: string | null
          last_login_ip: string | null
          mfa_enrolled_at: string | null
          mfa_required: boolean
          mvp_role: Database["public"]["Enums"]["mvp_company_role"] | null
          portal_login_last_at: string | null
          portfolio_id: string | null
          profile_access: string[]
          role: string | null
          role_id: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      render_invitation_email: {
        Args: { inv: Database["public"]["Tables"]["user_invitations"]["Row"] }
        Returns: Json
      }
      report_data_delinquency: {
        Args: { p_params?: Json; p_portfolio_id: string }
        Returns: Json
      }
      report_data_dispatch: {
        Args: { p_params?: Json; p_portfolio_id: string; p_slug: string }
        Returns: Json
      }
      report_data_homeowner_ledger: {
        Args: { p_params?: Json; p_portfolio_id: string }
        Returns: Json
      }
      report_data_open_work_orders: {
        Args: { p_params?: Json; p_portfolio_id: string }
        Returns: Json
      }
      report_data_property_directory: {
        Args: { p_params?: Json; p_portfolio_id: string }
        Returns: Json
      }
      report_data_vendor_1099: {
        Args: { p_params?: Json; p_portfolio_id: string }
        Returns: Json
      }
      report_data_vendor_directory: {
        Args: { p_params?: Json; p_portfolio_id: string }
        Returns: Json
      }
      report_data_violation_log: {
        Args: { p_params?: Json; p_portfolio_id: string }
        Returns: Json
      }
      report_data_work_orders: {
        Args: { p_params?: Json; p_portfolio_id: string }
        Returns: Json
      }
      request_data_export: {
        Args: {
          p_format?: string
          p_portfolio_id: string
          p_scope?: Database["public"]["Enums"]["export_scope"]
        }
        Returns: {
          completed_at: string | null
          created_at: string
          download_count: number
          error_message: string | null
          expires_at: string | null
          file_size_bytes: number | null
          file_url: string | null
          format: string
          id: string
          portfolio_id: string | null
          requested_by: string | null
          scope: Database["public"]["Enums"]["export_scope"]
          started_at: string | null
          status: Database["public"]["Enums"]["export_status"]
          subject_auth_user_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "data_export_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resend_invitation: {
        Args: { p_invitation_id: string }
        Returns: {
          association_ids: string[]
          created_at: string
          email: string
          expires_at: string
          full_name: string | null
          hoa_role: Database["public"]["Enums"]["hoa_role"]
          id: string
          invited_by: string | null
          message: string | null
          mvp_role: Database["public"]["Enums"]["mvp_company_role"] | null
          portfolio_id: string
          role_id: string | null
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
          unit_id: string | null
          updated_at: string
          used_at: string | null
          used_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "user_invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revoke_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      rotate_api_key: { Args: { p_api_key_id: string }; Returns: Json }
      run_autopay_mandates: { Args: never; Returns: number }
      scan_data_diagnostics: {
        Args: { p_portfolio_id: string }
        Returns: number
      }
      scan_financial_diagnostics: {
        Args: { p_portfolio_id: string }
        Returns: number
      }
      seed_standard_charge_categories: {
        Args: { p_portfolio_id: string }
        Returns: number
      }
      select_payment_processor: {
        Args: { p_method: string; p_portfolio_id: string }
        Returns: Database["public"]["Enums"]["payment_processor"]
      }
      setup_edge_function_secrets: {
        Args: { p_project_url: string; p_service_role_key: string }
        Returns: string
      }
      subscribe_association_to_charge: {
        Args: {
          p_amount?: number
          p_association_id: string
          p_charge_category_id: string
          p_frequency?: Database["public"]["Enums"]["recurring_frequency"]
        }
        Returns: number
      }
      subscribe_unit_to_charge: {
        Args: {
          p_amount?: number
          p_charge_category_id: string
          p_frequency?: Database["public"]["Enums"]["recurring_frequency"]
          p_memo?: string
          p_start_date?: string
          p_unit_id: string
        }
        Returns: {
          active: boolean
          amount: number
          charge_category_id: string
          created_at: string
          created_by: string | null
          end_date: string | null
          frequency: Database["public"]["Enums"]["recurring_frequency"]
          id: string
          last_posted_at: string | null
          memo: string | null
          next_post_date: string
          start_date: string
          unit_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "unit_recurring_charges"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      suspend_portfolio: {
        Args: { p_portfolio_id: string; p_reason: string }
        Returns: {
          address_city: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          allowed_email_domains: string[]
          archived_at: string | null
          company_name: string
          convenience_fee_ach_fixed_cents: number
          convenience_fee_ach_pct: number
          convenience_fee_card_fixed_cents: number
          convenience_fee_card_pct: number
          convenience_fee_label: string
          convenience_fee_minimum_cents: number
          convenience_fee_mode: Database["public"]["Enums"]["convenience_fee_mode"]
          created_at: string
          created_by: string | null
          default_late_fee_amount: number
          default_late_fee_grace_days: number
          default_nsf_fee_amount: number
          default_payment_reminder_days: number[]
          entitlements: string[]
          fiscal_year_start_month: number
          id: string
          password_min_length: number
          phone_number: string | null
          profile_type: Database["public"]["Enums"]["portfolio_profile_type"]
          require_mfa_for_admins: boolean
          require_mfa_for_staff: boolean
          session_timeout_minutes: number
          statement_generation_day: number
          suspended_at: string | null
          suspension_reason: string | null
          texting_phone_number: string | null
          tier: Database["public"]["Enums"]["portfolio_tier"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "portfolios"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transfer_user_to_portfolio: {
        Args: {
          p_new_hoa_role?: Database["public"]["Enums"]["hoa_role"]
          p_new_portfolio_id: string
          p_new_role_id?: string
          p_profile_id: string
        }
        Returns: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          full_name: string | null
          gl_account_permissions: Json
          hoa_role: Database["public"]["Enums"]["hoa_role"] | null
          id: string
          last_login_at: string | null
          last_login_ip: string | null
          mfa_enrolled_at: string | null
          mfa_required: boolean
          mvp_role: Database["public"]["Enums"]["mvp_company_role"] | null
          portal_login_last_at: string | null
          portfolio_id: string | null
          profile_access: string[]
          role: string | null
          role_id: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unapply_payment: {
        Args: { p_charge_id?: string; p_payment_id: string }
        Returns: number
      }
      verify_api_key: {
        Args: { p_raw_key: string }
        Returns: {
          key_id: string
          portfolio_id: string
          scopes: string[]
        }[]
      }
    }
    Enums: {
      agreement_status:
        | "draft"
        | "active"
        | "expired"
        | "terminated"
        | "renewing"
      amenity_pricing_mode: "flat" | "hourly"
      amenity_reserve_method: "email" | "platform_link"
      approval_request_status: "pending" | "approved" | "rejected" | "cancelled"
      approval_vote_choice: "yes" | "no" | "abstain"
      asset_status: "active" | "disposed" | "sold" | "fully_depreciated"
      autopay_frequency:
        | "monthly"
        | "quarterly"
        | "annually"
        | "on_charge_posted"
      autopay_status:
        | "pending_verification"
        | "active"
        | "paused"
        | "canceled"
        | "failed"
      bank_account_purpose:
        | "operating"
        | "reserve"
        | "special_assessment"
        | "trust"
        | "other"
      bank_account_type: "checking" | "savings" | "money_market"
      board_role:
        | "president"
        | "vice_president"
        | "secretary"
        | "treasurer"
        | "director"
      budget_category: "income" | "expense"
      calendar_scope: "daily" | "annual"
      charge_type:
        | "assessment"
        | "late_fee"
        | "nsf_fee"
        | "fine"
        | "special_assessment"
        | "move_fee"
        | "amenity_fee"
        | "other"
      communication_channel: "email" | "sms" | "letter" | "portal"
      convenience_fee_mode: "absorb" | "pass_through" | "split" | "flat_addon"
      depreciation_method:
        | "straight_line"
        | "declining_balance"
        | "sum_of_years_digits"
        | "units_of_production"
        | "none"
      diagnostic_severity: "info" | "warning" | "error"
      document_request_status:
        | "requested"
        | "in_progress"
        | "submitted"
        | "approved"
        | "rejected"
        | "expired"
      dues_increase_status: "draft" | "scheduled" | "posted" | "cancelled"
      event_type:
        | "administrative"
        | "announcements"
        | "maintenance"
        | "meetings"
        | "social_events"
        | "other"
        | "elevator_reservation"
        | "move_in"
        | "move_out"
        | "water_shutoff"
        | "vendor_work"
        | "common_area_reservation"
        | "board_meeting"
        | "inspection"
      export_scope: "portfolio_full" | "portfolio_finance" | "user_data"
      export_status: "pending" | "running" | "ready" | "failed" | "expired"
      gl_account_type:
        | "asset"
        | "liability"
        | "equity"
        | "income"
        | "expense"
        | "cost_of_goods_sold"
        | "other_income"
        | "other_expense"
        | "non_operating"
        | "cash"
        | "accounts_receivable"
        | "accounts_payable"
        | "fixed_asset"
      gl_fund_account: "operating" | "reserve" | "special_assessment"
      gl_permission: "full" | "read" | "none"
      hoa_role: "manager" | "board" | "owner" | "tenant"
      inspection_severity: "info" | "minor" | "moderate" | "major" | "critical"
      inspection_status: "scheduled" | "in_progress" | "completed" | "cancelled"
      invitation_status: "pending" | "accepted" | "revoked" | "expired"
      je_batch_status:
        | "draft"
        | "validating"
        | "validated"
        | "posted"
        | "failed"
      lease_generation_method: "appfolio_lease_templates" | "pdf_form_templates"
      lease_template_slot: "new_lease" | "renewal" | "renewal_month_to_month"
      lockbox_batch_status:
        | "received"
        | "processing"
        | "deposited"
        | "reconciled"
        | "rejected"
      management_fee_type: "per_unit" | "flat_monthly" | "percentage_of_income"
      mvp_company_role:
        | "company_admin"
        | "manager"
        | "assistant_manager"
        | "accountant"
      notice_status: "draft" | "sent" | "archived"
      notice_type:
        | "general"
        | "violation"
        | "meeting"
        | "payment_reminder"
        | "maintenance_update"
        | "annual_meeting"
        | "board_packet"
        | "emergency"
        | "other"
      occupancy_status: "current" | "future" | "past"
      occupancy_type: "owner" | "tenant"
      payable_bill_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "paid"
        | "void"
      payment_method_type:
        | "bank_account_ach"
        | "bank_account_echeck"
        | "card_credit"
        | "card_debit"
        | "paypal"
        | "apple_pay"
        | "google_pay"
      payment_processor:
        | "stripe"
        | "dwolla"
        | "modern_treasury"
        | "gocardless"
        | "square"
        | "paypal"
        | "manual"
      period_status: "open" | "soft_closed" | "closed"
      portfolio_profile_type: "association_management" | "property_management"
      portfolio_tier: "core" | "plus" | "max"
      privacy_action_status:
        | "received"
        | "verified"
        | "in_progress"
        | "completed"
        | "rejected"
        | "partially_completed"
      privacy_action_type:
        | "data_export"
        | "data_deletion"
        | "anonymization"
        | "access_report"
        | "consent_withdrawal"
      purchase_order_status: "open" | "approved" | "billed" | "cancelled"
      recert_status:
        | "scheduled"
        | "in_progress"
        | "submitted"
        | "approved"
        | "rejected"
        | "overdue"
      recurring_frequency:
        | "daily"
        | "weekly"
        | "monthly"
        | "quarterly"
        | "annually"
      rent_change_kind: "dollar_amount" | "percentage"
      report_category:
        | "association"
        | "accounting"
        | "property_unit"
        | "maintenance"
        | "people"
        | "communication"
        | "compliance"
      report_delivery_channel: "email" | "portal" | "webhook" | "download_only"
      report_format: "pdf" | "xlsx" | "csv" | "json" | "html"
      report_run_status:
        | "queued"
        | "running"
        | "succeeded"
        | "failed"
        | "cancelled"
      schedule_frequency:
        | "daily"
        | "weekly"
        | "biweekly"
        | "monthly"
        | "quarterly"
        | "annually"
      service_request_priority: "low" | "normal" | "high" | "emergency"
      service_request_source: "resident" | "internal" | "recurring"
      service_request_status: "open" | "completed" | "cancelled" | "waiting"
      sms_direction: "inbound" | "outbound"
      sms_status:
        | "queued"
        | "sent"
        | "delivered"
        | "failed"
        | "read"
        | "undelivered"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "paused"
        | "expired"
      survey_type: "maintenance" | "leasing" | "general"
      tag_entity_type:
        | "association"
        | "unit"
        | "owner"
        | "vendor"
        | "work_order"
        | "service_request"
        | "bill"
        | "payment"
        | "charge"
        | "violation"
        | "document"
        | "inspection"
        | "calendar_event"
      template_category:
        | "association"
        | "owner"
        | "vendor"
        | "applicant"
        | "statement"
        | "generic"
      vendor_payment_type: "check" | "echeck" | "ach" | "online"
      vendor_trade:
        | "hvac"
        | "plumbing"
        | "electrical"
        | "landscaping"
        | "roofing"
        | "general_contractor"
        | "handyperson"
        | "snow_removal"
        | "pest_control"
        | "pool_spa"
        | "painting"
        | "keys_locks"
        | "fireplace_chimney"
        | "garage_doors"
        | "gutter_cleaning"
        | "inspections"
        | "parking_driveways"
        | "preventative_maintenance"
        | "repairs_exterior"
        | "repairs_interior"
        | "septic"
        | "trash_recycling"
        | "utilities"
        | "turnover"
        | "other"
      vendor_type:
        | "general"
        | "contractor"
        | "sub_contractor"
        | "service_provider"
        | "other"
      violation_status:
        | "open"
        | "notice_sent"
        | "hearing_pending"
        | "cured"
        | "fined"
        | "closed"
      violation_type:
        | "noise"
        | "parking"
        | "pets"
        | "exterior_modification"
        | "trash_debris"
        | "landscaping"
        | "common_area_misuse"
        | "lease_violation"
        | "assessment_delinquency"
        | "other"
      voting_scheme:
        | "majority_approval_required"
        | "unanimous_approval_required"
        | "any_one_approver"
        | "percentage_required"
      webhook_delivery_status:
        | "pending"
        | "succeeded"
        | "failed"
        | "retrying"
        | "abandoned"
      webhook_event:
        | "charge.created"
        | "charge.updated"
        | "charge.voided"
        | "payment.received"
        | "payment.failed"
        | "payment.refunded"
        | "work_order.created"
        | "work_order.status_changed"
        | "work_order.completed"
        | "service_request.created"
        | "service_request.resolved"
        | "bill.created"
        | "bill.approved"
        | "bill.paid"
        | "violation.created"
        | "violation.resolved"
        | "notice.sent"
        | "statement.generated"
        | "owner.created"
        | "owner.updated"
        | "inspection.completed"
      work_order_category:
        | "plumbing"
        | "electrical"
        | "hvac"
        | "general_repair"
        | "common_area"
        | "appliance"
        | "pest_control"
        | "landscaping"
        | "other"
      work_order_priority: "low" | "normal" | "high" | "emergency"
      work_order_status:
        | "new"
        | "assigned"
        | "scheduled"
        | "in_progress"
        | "done"
        | "completed"
        | "billed"
        | "closed"
        | "cancelled"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      agreement_status: [
        "draft",
        "active",
        "expired",
        "terminated",
        "renewing",
      ],
      amenity_pricing_mode: ["flat", "hourly"],
      amenity_reserve_method: ["email", "platform_link"],
      approval_request_status: ["pending", "approved", "rejected", "cancelled"],
      approval_vote_choice: ["yes", "no", "abstain"],
      asset_status: ["active", "disposed", "sold", "fully_depreciated"],
      autopay_frequency: [
        "monthly",
        "quarterly",
        "annually",
        "on_charge_posted",
      ],
      autopay_status: [
        "pending_verification",
        "active",
        "paused",
        "canceled",
        "failed",
      ],
      bank_account_purpose: [
        "operating",
        "reserve",
        "special_assessment",
        "trust",
        "other",
      ],
      bank_account_type: ["checking", "savings", "money_market"],
      board_role: [
        "president",
        "vice_president",
        "secretary",
        "treasurer",
        "director",
      ],
      budget_category: ["income", "expense"],
      calendar_scope: ["daily", "annual"],
      charge_type: [
        "assessment",
        "late_fee",
        "nsf_fee",
        "fine",
        "special_assessment",
        "move_fee",
        "amenity_fee",
        "other",
      ],
      communication_channel: ["email", "sms", "letter", "portal"],
      convenience_fee_mode: ["absorb", "pass_through", "split", "flat_addon"],
      depreciation_method: [
        "straight_line",
        "declining_balance",
        "sum_of_years_digits",
        "units_of_production",
        "none",
      ],
      diagnostic_severity: ["info", "warning", "error"],
      document_request_status: [
        "requested",
        "in_progress",
        "submitted",
        "approved",
        "rejected",
        "expired",
      ],
      dues_increase_status: ["draft", "scheduled", "posted", "cancelled"],
      event_type: [
        "administrative",
        "announcements",
        "maintenance",
        "meetings",
        "social_events",
        "other",
        "elevator_reservation",
        "move_in",
        "move_out",
        "water_shutoff",
        "vendor_work",
        "common_area_reservation",
        "board_meeting",
        "inspection",
      ],
      export_scope: ["portfolio_full", "portfolio_finance", "user_data"],
      export_status: ["pending", "running", "ready", "failed", "expired"],
      gl_account_type: [
        "asset",
        "liability",
        "equity",
        "income",
        "expense",
        "cost_of_goods_sold",
        "other_income",
        "other_expense",
        "non_operating",
        "cash",
        "accounts_receivable",
        "accounts_payable",
        "fixed_asset",
      ],
      gl_fund_account: ["operating", "reserve", "special_assessment"],
      gl_permission: ["full", "read", "none"],
      hoa_role: ["manager", "board", "owner", "tenant"],
      inspection_severity: ["info", "minor", "moderate", "major", "critical"],
      inspection_status: ["scheduled", "in_progress", "completed", "cancelled"],
      invitation_status: ["pending", "accepted", "revoked", "expired"],
      je_batch_status: ["draft", "validating", "validated", "posted", "failed"],
      lease_generation_method: [
        "appfolio_lease_templates",
        "pdf_form_templates",
      ],
      lease_template_slot: ["new_lease", "renewal", "renewal_month_to_month"],
      lockbox_batch_status: [
        "received",
        "processing",
        "deposited",
        "reconciled",
        "rejected",
      ],
      management_fee_type: ["per_unit", "flat_monthly", "percentage_of_income"],
      mvp_company_role: [
        "company_admin",
        "manager",
        "assistant_manager",
        "accountant",
      ],
      notice_status: ["draft", "sent", "archived"],
      notice_type: [
        "general",
        "violation",
        "meeting",
        "payment_reminder",
        "maintenance_update",
        "annual_meeting",
        "board_packet",
        "emergency",
        "other",
      ],
      occupancy_status: ["current", "future", "past"],
      occupancy_type: ["owner", "tenant"],
      payable_bill_status: [
        "draft",
        "pending_approval",
        "approved",
        "paid",
        "void",
      ],
      payment_method_type: [
        "bank_account_ach",
        "bank_account_echeck",
        "card_credit",
        "card_debit",
        "paypal",
        "apple_pay",
        "google_pay",
      ],
      payment_processor: [
        "stripe",
        "dwolla",
        "modern_treasury",
        "gocardless",
        "square",
        "paypal",
        "manual",
      ],
      period_status: ["open", "soft_closed", "closed"],
      portfolio_profile_type: ["association_management", "property_management"],
      portfolio_tier: ["core", "plus", "max"],
      privacy_action_status: [
        "received",
        "verified",
        "in_progress",
        "completed",
        "rejected",
        "partially_completed",
      ],
      privacy_action_type: [
        "data_export",
        "data_deletion",
        "anonymization",
        "access_report",
        "consent_withdrawal",
      ],
      purchase_order_status: ["open", "approved", "billed", "cancelled"],
      recert_status: [
        "scheduled",
        "in_progress",
        "submitted",
        "approved",
        "rejected",
        "overdue",
      ],
      recurring_frequency: [
        "daily",
        "weekly",
        "monthly",
        "quarterly",
        "annually",
      ],
      rent_change_kind: ["dollar_amount", "percentage"],
      report_category: [
        "association",
        "accounting",
        "property_unit",
        "maintenance",
        "people",
        "communication",
        "compliance",
      ],
      report_delivery_channel: ["email", "portal", "webhook", "download_only"],
      report_format: ["pdf", "xlsx", "csv", "json", "html"],
      report_run_status: [
        "queued",
        "running",
        "succeeded",
        "failed",
        "cancelled",
      ],
      schedule_frequency: [
        "daily",
        "weekly",
        "biweekly",
        "monthly",
        "quarterly",
        "annually",
      ],
      service_request_priority: ["low", "normal", "high", "emergency"],
      service_request_source: ["resident", "internal", "recurring"],
      service_request_status: ["open", "completed", "cancelled", "waiting"],
      sms_direction: ["inbound", "outbound"],
      sms_status: [
        "queued",
        "sent",
        "delivered",
        "failed",
        "read",
        "undelivered",
      ],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "paused",
        "expired",
      ],
      survey_type: ["maintenance", "leasing", "general"],
      tag_entity_type: [
        "association",
        "unit",
        "owner",
        "vendor",
        "work_order",
        "service_request",
        "bill",
        "payment",
        "charge",
        "violation",
        "document",
        "inspection",
        "calendar_event",
      ],
      template_category: [
        "association",
        "owner",
        "vendor",
        "applicant",
        "statement",
        "generic",
      ],
      vendor_payment_type: ["check", "echeck", "ach", "online"],
      vendor_trade: [
        "hvac",
        "plumbing",
        "electrical",
        "landscaping",
        "roofing",
        "general_contractor",
        "handyperson",
        "snow_removal",
        "pest_control",
        "pool_spa",
        "painting",
        "keys_locks",
        "fireplace_chimney",
        "garage_doors",
        "gutter_cleaning",
        "inspections",
        "parking_driveways",
        "preventative_maintenance",
        "repairs_exterior",
        "repairs_interior",
        "septic",
        "trash_recycling",
        "utilities",
        "turnover",
        "other",
      ],
      vendor_type: [
        "general",
        "contractor",
        "sub_contractor",
        "service_provider",
        "other",
      ],
      violation_status: [
        "open",
        "notice_sent",
        "hearing_pending",
        "cured",
        "fined",
        "closed",
      ],
      violation_type: [
        "noise",
        "parking",
        "pets",
        "exterior_modification",
        "trash_debris",
        "landscaping",
        "common_area_misuse",
        "lease_violation",
        "assessment_delinquency",
        "other",
      ],
      voting_scheme: [
        "majority_approval_required",
        "unanimous_approval_required",
        "any_one_approver",
        "percentage_required",
      ],
      webhook_delivery_status: [
        "pending",
        "succeeded",
        "failed",
        "retrying",
        "abandoned",
      ],
      webhook_event: [
        "charge.created",
        "charge.updated",
        "charge.voided",
        "payment.received",
        "payment.failed",
        "payment.refunded",
        "work_order.created",
        "work_order.status_changed",
        "work_order.completed",
        "service_request.created",
        "service_request.resolved",
        "bill.created",
        "bill.approved",
        "bill.paid",
        "violation.created",
        "violation.resolved",
        "notice.sent",
        "statement.generated",
        "owner.created",
        "owner.updated",
        "inspection.completed",
      ],
      work_order_category: [
        "plumbing",
        "electrical",
        "hvac",
        "general_repair",
        "common_area",
        "appliance",
        "pest_control",
        "landscaping",
        "other",
      ],
      work_order_priority: ["low", "normal", "high", "emergency"],
      work_order_status: [
        "new",
        "assigned",
        "scheduled",
        "in_progress",
        "done",
        "completed",
        "billed",
        "closed",
        "cancelled",
      ],
    },
  },
} as const
