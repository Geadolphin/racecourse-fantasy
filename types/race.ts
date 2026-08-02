export type Race = {
  id: string;

  round_id: string;
  racecourse_id: string;

  race_number: number;
  race_name: string;

  grade: "L" | "G3" | "G2" | "G1";

  distance_metres: number;

  scheduled_start: string;

  status:
    | "scheduled"
    | "running"
    | "official"
    | "abandoned"
    | "cancelled";

  created_at?: string;
  updated_at?: string;
};