import leaderboard from './leaderboard'
import { apis } from '../api-source'
import getLyric from './lyric'
import getMusicInfo from './musicInfo'
import musicSearch from './musicSearch'
import songList from './songList'
import hotSearch from './hotSearch'
import comment from './comment'
import dailyRec from './dailyRec'
import { getMusicQualityInfo } from './qualityDetail'
// import tipSearch from './tipSearch'

const wy = {
  // tipSearch,
  leaderboard,
  musicSearch,
  songList,
  hotSearch,
  comment,
  dailyRec,
  getMusicUrl(songInfo, type) {
    return apis('wy').getMusicUrl(songInfo, type)
  },
  /**
   * 获取该曲的完整音质信息（含 master / atmos / hires 与文件大小）。
   * 复用移动改良版的音质详情接口，用于下载弹窗展示完整档位。
   */
  getMusicQualityInfo(songInfo) {
    const id = songInfo?.songmid ?? songInfo?.meta?.songId ?? songInfo?.id
    return getMusicQualityInfo(id)
  },
  getLyric(songInfo) {
    return getLyric(songInfo.songmid)
  },
  getPic(songInfo) {
    const requestObj = getMusicInfo(songInfo.songmid)
    return requestObj.promise.then(info => info.al.picUrl)
  },
  getMusicDetailPageUrl(songInfo) {
    return `https://music.163.com/#/song?id=${songInfo.songmid}`
  },
}

export default wy
