export type Horse = {
  id: string;
  name: string;
  current_price: number;
};

export type Racecourse = {
  id: string;
  name: string;
};

export type Race = {
  id: string;
  race_number: number;
  race_name: string;
  grade: "L" | "G3" | "G2" | "G1";
  scheduled_start: string;
  status: string;
  racecourse?: Racecourse | null;
};

export type RaceEntry = {
  id: string;
  horse_id: string;
  race_id: string;
  saddlecloth_number: number | null;
  entry_status: string;

  horse?: Horse | null;
};

export type RaceResult = {
  id: string;
  race_entry_id: string;
  finishing_position: number | null;
  fantasy_points: number;
  price_before: number;
  price_after: number;
  price_change: number;
  is_dead_heat: boolean;
  result_status: string;
};

export type TeamSelection = {
  race_entry_id: string;
  is_captain: boolean;
};

export type RoundSummaryData = {
  roundScore: number;
  roundRank: number;
  seasonScore: number;
  overallRank: number;
};