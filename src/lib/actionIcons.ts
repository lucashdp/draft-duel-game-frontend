import type { ActionType } from '@/lib/contracts/live'

/** Emoji por tipo de ação, para as timelines de evento (glyphs podem ser afinados). */
export const ACTION_ICONS: Record<ActionType, string> = {
  GOAL: '⚽',
  ASSIST: '🅰️',
  YELLOW_CARD: '🟨',
  RED_CARD: '🟥',
  SAVE: '🧤',
  PENALTY_SAVE: '🧤',
  OWN_GOAL: '🥅',
  PENALTY_MISS: '❌',
  PENALTY_GOAL: '⚽',
  INTERCEPTION: '🤚',
  TACKLE_WON: '🛡️',
  KEY_PASS: '🎯',
  SHOT_ON_TARGET: '🎯',
  SHOT_OFF_TARGET: '↗️',
  CLEAN_SHEET: '🔒',
  HARD_SAVE: '🧤',
  GOAL_CONCEDED: '🥅',
  POST_HIT: '🪧',
  MISSED_PASS: '↪️',
  FOUL_SUFFERED: '🤕',
  FOUL_COMMITTED: '⚠️',
  OFFSIDE: '🚩',
}
