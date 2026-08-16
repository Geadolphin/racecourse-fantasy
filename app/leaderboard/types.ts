export type RoundLeaderboardRow = {
  round_id: string;
  user_id: string;
  display_name: string;
  team_name: string | null;
  total_points: number;
  captain_points: number;
  round_rank: number;
  salary_used: number;
};

export type SeasonLeaderboardRow = {
  season_id: string;
  user_id: string;
  display_name: string;
  team_name: string | null;
  total_points: number;
  rounds_played: number;
  round_wins: number;
  highest_round_score: number;
  top_ten_finishes: number;
  overall_rank: number;
  rank_change: number | null;
};