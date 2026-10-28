import leaderboard from './leaderboard'
import lyric from './lyric'
import songList from './songList'
import musicSearch from './musicSearch'
import { apis } from '../api-source'
import hotSearch from './hotSearch'
import comment from './comment'
import { getMusicQualityInfo } from './qualityDetail'
// import tipSearch from './tipSearch'

const tx = {
  // tipSearch,
  leaderboard,
  songList,
  musicSearch,
  hotSearch,
  comment,

  getMusicUrl(songInfo, type) {
    return apis('tx').getMusicUrl(songInfo, type)
  },
  /**
   * 获取该曲的完整音质信息（含 hires / atmos / atmos_plus / master 与文件大小）。
   * 复用移动改良版的音质详情接口，用于下载弹窗展示完整档位。
   */
  getMusicQualityInfo(songInfo) {
    const id = songInfo?.songmid ?? songInfo?.strMediaMid ?? songInfo?.id
    return getMusicQualityInfo(id)
  },
  getLyric(songInfo) {
    // let singer = songInfo.singer.indexOf('、') > -1 ? songInfo.singer.split('、')[0] : songInfo.singer
    return lyric.getLyric(songInfo)
  },
  async getPic(songInfo) {
    return `https://y.gtimg.cn/music/photo_new/T002R500x500M000${songInfo.albumId}.jpg`
  },
  getMusicDetailPageUrl(songInfo) {
    return `https://y.qq.com/n/yqq/song/${songInfo.songmid}.html`
  },
}

export default tx
