/** Home/Explore v2 rollout flags — edit only on Experiments (kill switch lives there). */
export const RANKING_ROLLOUT_FLAG_KEYS = [
  'home_feed_rank_v2_enabled',
  'explore_rank_v2_enabled',
] as const

export type RankingRolloutFlagKey = (typeof RANKING_ROLLOUT_FLAG_KEYS)[number]

export function isRankingRolloutFlag(key: string): boolean {
  return (RANKING_ROLLOUT_FLAG_KEYS as readonly string[]).includes(key)
}
