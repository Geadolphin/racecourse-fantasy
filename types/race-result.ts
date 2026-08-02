export type ResultStatus =
  | "finished"
  | "non_finisher"
  | "scratched";

export type RaceResult = {
  id: string;
  race_entry_id: string;
  finishing_position: number | null;
  result_status: ResultStatus;
  fantasy_points: number;
  price_change: number;
  price_before: number;
  price_after: number;
  is_dead_heat: boolean;
  is_official: boolean;
  recorded_at: string;
  created_at: string;
  updated_at: string;
};