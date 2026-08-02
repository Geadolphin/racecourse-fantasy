export type Round = {
  id: string;
  season_id: string;
  round_number: number;
  name: string | null;
  round_date: string;
  lockout_at: string;
  status: "draft" | "open" | "locked" | "completed";

  automation_enabled: boolean;
  manual_status_override: boolean;
  scoring_completed: boolean;
  completed_at: string | null;
  status_updated_at: string;
};