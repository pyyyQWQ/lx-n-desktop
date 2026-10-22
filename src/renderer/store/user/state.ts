import { ref, shallowReactive } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'

/**
 * 网易云账号登录状态（阶段 B2.1 最小闭环）。
 * - status: 'not-login' 未配置 Cookie / no-login 已配置但未验证成功 / verifying 验证中 / logged-in 已登录
 * - uid: 验证成功时保存的用户标识
 */
export const wyLoginStatus = ref<'not-login' | 'no-login' | 'verifying' | 'logged-in'>('not-login')
export const wyUid = ref<string | null>(null)

/**
 * 我的喜欢歌曲 id 集合（内部使用字符串 id）。
 * 由请求层 / 启动恢复写入；用于判断某首歌是否已喜欢。
 */
export const wyLikedSongIds = shallowReactive<Set<string>>(new Set())

/**
 * 用户资料（头像、昵称等由接口真实返回）。
 */
export const wyUserInfo = shallowReactive<{
  nickname: string
  avatarUrl: string
}>({
  nickname: '',
  avatarUrl: '',
})

/**
 * 已登录账号的 uid 校验是否正在进行（避免并发验证）。
 */
export const isWyVerifying = ref(false)

/**
 * 是否已完成启动期/登录后的用户数据加载。
 */
export const wyUserDataLoaded = ref(false)

/**
 * 我的歌单列表（真实接口结果缓存）。切换账号 / 退出时清空。
 */
export const wyPlaylists = shallowReactive<Array<{
  id: string
  userId: number
  name: string
  coverImgUrl: string
  trackCount: number
  description?: string
  playCount?: number
}>>([])

export const hasWyCookie = () => !!(appSetting['common.wy_cookie'] || '')

export interface WyUserState {
  status: typeof wyLoginStatus.value
  uid: typeof wyUid.value
  likedSongIds: typeof wyLikedSongIds
  userInfo: typeof wyUserInfo
}
