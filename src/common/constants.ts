export const URL_SCHEME_RXP = /^lx-netease-music:\/\//

export const SPLIT_CHAR = {
  DISLIKE_NAME: '@',
  DISLIKE_NAME_ALIAS: '#',
} as const

export const STORE_NAMES = {
  APP_SETTINGS: 'config_v2',
  DATA: 'data',
  SYNC: 'sync',
  HOTKEY: 'hot_key',
  USER_API: 'user_api',
  LRC_RAW: 'lyrics',
  LRC_EDITED: 'lyrics_edited',
  THEME: 'theme',
  SOUND_EFFECT: 'sound_effect',
} as const

export const APP_EVENT_NAMES = {
  winMainName: 'win_main',
  winLyricName: 'win_lyric',
  trayName: 'tray',
} as const

export const LIST_IDS = {
  DEFAULT: 'default',
  LOVE: 'love',
  TEMP: 'temp',
  DOWNLOAD: 'download',
  PLAY_LATER: null,
} as const

export const DATA_KEYS = {
  viewPrevState: 'viewPrevState',
  playInfo: 'playInfo',
  searchHistoryList: 'searchHistoryList',
  listScrollPosition: 'listScrollPosition',
  listPrevSelectId: 'listPrevSelectId',
  listUpdateInfo: 'listUpdateInfo',
  ignoreVersion: 'ignoreVersion',

  leaderboardSetting: 'leaderboardSetting',
  songListSetting: 'songListSetting',
  searchSetting: 'searchSetting',

  lastStartInfo: 'lastStartInfo',
} as const

export const DEFAULT_SETTING = {
  leaderboard: {
    source: 'kw',
    boardId: 'kw__16',
  },

  songList: {
    source: 'kw',
    sortId: 'new',
    tagId: '',
  },

  search: {
    temp_source: 'kw',
    source: 'all',
    type: 'music',
  },

  viewPrevState: {
    url: '/search',
    query: {},
  },
}

export const DOWNLOAD_STATUS = {
  RUN: 'run',
  WAITING: 'waiting',
  PAUSE: 'pause',
  ERROR: 'error',
  COMPLETED: 'completed',
} as const

/**
 * 音质降级链（从最高到最低）。
 * `getMusicType`（下载）用它做「目标音质不可用时向下回退」的查找表，因此顺序即优先级。
 *
 * 与移动改良版 `QUALITY_RANK` 对齐：
 *   master -> atmos_plus -> atmos -> hires -> flac -> 320k -> 128k
 * 注意链路中**没有 flac24bit**：手机版把 flac24bit 统一视为 hires。
 * wav / ape / 192k 仅用于本地文件与历史数据，排在无损之后。
 */
export const QUALITYS = ['master', 'atmos_plus', 'atmos', 'hires', 'flac', 'wav', 'ape', '320k', '192k', '128k'] as const

/**
 * 设置页「优先播放的音质」可选项（由低到高，设置页会 reverse 渲染成高→低）。
 * 与移动改良版 `TRY_QUALITYS_LIST` 完全一致：
 *   手机版 = ['master','atmos_plus','atmos','hires','flac','320k'] + '128k'
 * 即最终展示 7 项：128k / 320k / flac / hires / atmos / atmos_plus / master
 */
export const PLAY_QUALITY_OPTIONS = ['128k', '320k', 'flac', 'hires', 'atmos', 'atmos_plus', 'master'] as const

export const TRAY_AUTO_ID = -1
