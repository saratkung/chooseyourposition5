// Hand-written types mirroring the Supabase schema in database/migrations/0001_init.sql
// Keep in sync with the SQL migration.
//
// IMPORTANT: every Row/Insert/Update/Args shape below MUST be a `type` alias,
// never an `interface`. supabase-js's query builder resolves table/RPC
// generics through deeply nested conditional types, and `interface`
// declarations don't structurally simplify the same way `type` aliases do —
// in practice that silently collapses every `.from()`/`.rpc()` call's
// argument and return types to `never`. Domain code that just needs a plain
// object shape (e.g. React props) can still import and use these types
// normally; only the *declaration keyword* matters here.

export type SystemStatus = "waiting" | "live" | "paused" | "finished";
export type PositionStatus = "available" | "selecting" | "taken" | "disabled";
export type SelectionStatus = "confirmed" | "cancelled";
export type UserRole = "user" | "admin";
export type ProfileStatus = "active" | "suspended";
export type SelectionMode = "open" | "seniority";

export type RoleRow = {
  id: string;
  name: UserRole;
  description: string | null;
};

export type ProfileRow = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  user_code: string;
  batch: string;
  class_year: string;
  group_name: string;
  email: string;
  role: UserRole;
  status: ProfileStatus;
  seniority_order: number | null;
  created_at: string;
  updated_at: string;
};

export type PositionRow = {
  id: string;
  position_code: string;
  department: string;
  division: string;
  location: string;
  description: string | null;
  capacity: number;
  status: PositionStatus;
  created_at: string;
  updated_at: string;
};

export type SelectionRow = {
  id: string;
  user_id: string;
  position_id: string;
  status: SelectionStatus;
  reference_code: string;
  selected_at: string;
  created_at: string;
};

export type SystemSettingsRow = {
  id: string;
  system_status: SystemStatus;
  selection_mode: SelectionMode;
  current_turn_seniority_order: number | null;
  registration_open: boolean;
  open_at: string | null;
  close_at: string | null;
  updated_at: string;
};

export type ActivityLogRow = {
  id: string;
  user_id: string | null;
  action: string;
  position_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type SelectPositionResult = {
  success: boolean;
  error_code?:
    | "UNAUTHORIZED"
    | "SYSTEM_NOT_LIVE"
    | "NOT_YOUR_TURN"
    | "ALREADY_SELECTED"
    | "POSITION_NOT_FOUND"
    | "POSITION_TAKEN"
    | "POSITION_DISABLED"
    | "SERVER_ERROR"
    | "INVALID_STATUS"
    | "INVALID_MODE"
    | "NOT_FOUND";
  message?: string;
  selection_id?: string;
  reference_code?: string;
  position_code?: string;
  current_turn_seniority_order?: number | null;
};

export type CurrentTurn = {
  active: boolean;
  seniority_order?: number;
  first_name?: string | null;
  last_name?: string | null;
};

type Table<Row, Insert> = { Row: Row; Insert: Insert; Update: Partial<Insert>; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, Partial<ProfileRow>>;
      positions: Table<PositionRow, Partial<PositionRow>>;
      selections: Table<SelectionRow, Partial<SelectionRow>>;
      system_settings: Table<SystemSettingsRow, Partial<SystemSettingsRow>>;
      activity_logs: Table<ActivityLogRow, Partial<ActivityLogRow>>;
      roles: Table<RoleRow, Partial<RoleRow>>;
    };
    Views: Record<string, never>;
    Functions: {
      select_position: {
        Args: { p_position_id: string };
        Returns: SelectPositionResult;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      set_system_status: {
        Args: { p_status: SystemStatus };
        Returns: SelectPositionResult;
      };
      get_current_turn: {
        Args: Record<string, never>;
        Returns: CurrentTurn;
      };
      set_selection_mode: {
        Args: { p_mode: SelectionMode };
        Returns: SelectPositionResult;
      };
      advance_turn: {
        Args: { p_to_seniority_order: number | null };
        Returns: SelectPositionResult;
      };
      is_registration_open: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      set_registration_open: {
        Args: { p_open: boolean };
        Returns: SelectPositionResult;
      };
    };
  };
};
