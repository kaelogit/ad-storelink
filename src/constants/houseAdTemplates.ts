/**
 * AD-15: Feature-launch presets for House Ads.
 * Ops picks a card → form fills → paste image URL → publish (&lt;5 min).
 */

export type HouseAdPlacement = 'discover_tile' | 'home_card'

export type HouseAdTemplate = {
  id: string
  label: string
  description: string
  name: string
  headline: string
  deeplink: string
  placements: HouseAdPlacement[]
  /** Suggested country; ops can change before publish */
  countryCode?: string
  /** Optional stock art hint (ops still pastes a real HTTPS URL) */
  imageHint?: string
}

export const HOUSE_AD_TEMPLATES: HouseAdTemplate[] = [
  {
    id: 'become_seller',
    label: 'Become a seller',
    description: 'Drive buyers to start selling on StoreLink.',
    name: 'House — Become a seller',
    headline: 'Sell on StoreLink — open your shop today',
    deeplink: '/seller/what-is-selling',
    placements: ['discover_tile', 'home_card'],
    countryCode: 'NG',
    imageHint: 'Shop / storefront photo, 16:9 or square',
  },
  {
    id: 'try_spotlight',
    label: 'Try Spotlight',
    description: 'Promote curated buyer Spotlight posts.',
    name: 'House — Try Spotlight',
    headline: 'Spotlight: real buys, real stories',
    deeplink: '/spotlight/feed',
    placements: ['discover_tile', 'home_card'],
    countryCode: 'NG',
    imageHint: 'Lifestyle / unboxing still',
  },
  {
    id: 'go_live_soon',
    label: 'Go Live soon',
    description: 'Tease Live commerce before full launch.',
    name: 'House — Go Live soon',
    headline: 'Go Live is coming — sell in real time',
    deeplink: '/seller/dashboard',
    placements: ['discover_tile', 'home_card'],
    countryCode: 'NG',
    imageHint: 'Host / camera / livestream vibe',
  },
  {
    id: 'country_launch_ng',
    label: 'Country launch (NG)',
    description: 'Welcome Nigeria shoppers / sellers.',
    name: 'House — Nigeria launch',
    headline: 'StoreLink is live in Nigeria',
    deeplink: '/discover',
    placements: ['discover_tile', 'home_card'],
    countryCode: 'NG',
    imageHint: 'Brand / market photo for NG',
  },
  {
    id: 'country_launch_gh',
    label: 'Country launch (GH)',
    description: 'Welcome Ghana shoppers / sellers.',
    name: 'House — Ghana launch',
    headline: 'StoreLink is live in Ghana',
    deeplink: '/discover',
    placements: ['discover_tile', 'home_card'],
    countryCode: 'GH',
    imageHint: 'Brand / market photo for GH',
  },
  {
    id: 'go_diamond',
    label: 'Go Diamond',
    description: 'Upsell Diamond visibility to sellers.',
    name: 'House — Go Diamond',
    headline: 'Go Diamond — stand out in every feed',
    deeplink: '/subscription',
    placements: ['discover_tile', 'home_card'],
    countryCode: 'NG',
    imageHint: 'Diamond / premium brand still',
  },
]

export function houseAdTemplateById(id: string): HouseAdTemplate | undefined {
  return HOUSE_AD_TEMPLATES.find((t) => t.id === id)
}
