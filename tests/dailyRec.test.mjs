// 网易云「每日推荐」纯转换逻辑测试（阶段 C2）。
// 运行：node tests/dailyRec.test.mjs
// 仅测纯函数（src/common/utils/wyDailyRec.ts），不触发任何网络请求，不含任何凭据。
import { toOldSongInfo, toOldPlaylistInfo } from '../src/common/utils/wyDailyRec.ts'

let passed = 0
let failed = 0
const assert = (label, cond) => {
  if (cond) { passed++; console.log(`  ✓ ${label}`) } else { failed++; console.error(`  ✗ ${label}`) }
}

console.log('toOldSongInfo（每日推荐歌曲 → 旧结构）')
{
  const song = {
    id: 123456,
    name: '测试歌曲',
    dt: 210000,
    ar: [{ name: '歌手A' }, { name: '歌手B' }],
    al: { id: 9, name: '专辑X', picUrl: 'http://pic/x.jpg' },
    hr: { size: 20971520 },
    h: { size: 10485760 },
    m: { size: 5242880 },
    l: { size: 2621440 },
  }
  const out = toOldSongInfo(song)
  assert('source 为 wy', out.source === 'wy')
  assert('songmid 为真实 id', out.songmid === 123456)
  assert('name 正确', out.name === '测试歌曲')
  assert('singer 用、连接多位歌手', out.singer === '歌手A、歌手B')
  assert('albumName / albumId 正确', out.albumName === '专辑X' && out.albumId === 9)
  assert('interval 格式化 03:30', out.interval === '03:30')
  assert('img 为专辑图', out.img === 'http://pic/x.jpg')
  assert('有类型信息（flac24bit + 320k + 128k）', out.types.length === 3 && !!out._types.flac24bit && !!out._types['320k'] && !!out._types['128k'])
  assert('有基础类型占位', out.types.every(t => !!t.type && t.type.length))
}

console.log('toOldSongInfo（无音质字段 → 128k 占位）')
{
  const out = toOldSongInfo({ id: 1, name: 'x', dt: 0, ar: [], al: null })
  assert('无音质时给 128k 占位', out.types.length === 1 && out.types[0].type === '128k' && !!out._types['128k'])
  assert('dt=0 → interval 为 --/--', out.interval === '--/--')
  assert('缺失字段安全（albumName/img 兜底）', out.albumName == null && out.img === '')
}

console.log('toOldSongInfo（仅 l 音质）')
{
  const out = toOldSongInfo({ id: 2, name: 'y', dt: 60000, ar: [], al: {}, l: { size: 2621440 } })
  assert('仅有 l 时映射为单个 128k', out.types.length === 1 && out.types[0].type === '128k')
}

console.log('toOldPlaylistInfo（每日推荐歌单 → 卡片结构）')
{
  const pl = toOldPlaylistInfo({
    id: 777,
    name: '推荐歌单',
    trackCount: 30,
    picUrl: 'http://pic/p.jpg',
    creator: { nickname: '官方' },
    playcount: 123456,
    copywriter: '为你推荐',
  })
  assert('id 转字符串', pl.id === '777')
  assert('name / trackCount / coverImgUrl 正确', pl.name === '推荐歌单' && pl.trackCount === 30 && pl.coverImgUrl === 'http://pic/p.jpg')
  assert('creator / playCount / description 正确', pl.creator === '官方' && pl.playCount === 123456 && pl.description === '为你推荐')
}

console.log(`\n结果: 通过 ${passed}, 失败 ${failed}`)
if (failed) process.exit(1)