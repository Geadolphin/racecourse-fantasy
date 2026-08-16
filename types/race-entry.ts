export type EntryStatus =
  | "runner"
  | "scratched_before_lockout"
  | "scratched_after_lockout";

export type RaceEntry = {
  id: string;
  race_id: string;
  horse_id: string;

  barrier: number | null;
  saddlecloth_number: number | null;
  price_at_entry: number;
  entry_status: EntryStatus;
  scratched_at: string | null;

  starting_odds: number | null;
  projected_points: number | null;
  projection_calculated_at: string | null;

  created_at: string;
  updated_at: string;

  horse?: {
    id: string;
    name: string;
    current_price: number;
  } | null;

  race?: {
    id: string;
    race_number: number;
    race_name: string;
    scheduled_start: string;
    grade: "L" | "G3" | "G2" | "G1";

    racecourse?: {
      id: string;
      name: string;
    } | null;
  } | null;
};