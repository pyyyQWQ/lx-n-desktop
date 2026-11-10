import { reactive } from '@common/utils/vueTools'
import { TEMP_LIST_META_KEY, parseTempListMeta, serializeTempListMeta } from '@common/utils/tempListMeta'

export {
  allMusicList,
  defaultList,
  loveList,
  tempList,
  userLists,
} from '@renderer/store/list/listManage'
// import { reactive, ref, markRaw, Ref } from '@common/utils/vueTools'

// // const TEMP_LIST = 'TEMP_LIST'

// export const isInitedList: Ref<boolean> = ref(false)

// export const allList: Map<string, LX.Music.MusicInfo[]> = window.lxData.allList = markRaw(new Map())

// export const defaultList: Omit<LX.List.MyDefaultListInfo, 'list'> = reactive({
//   id: 'default',
//   name: '试听列表',
// })

// export const loveList: Omit<LX.List.MyLoveListInfo, 'list'> = reactive({
//   id: 'love',
//   name: '我的收藏',
// })

// export const tempList: Omit<LX.List.MyTempListInfo, 'list'> = reactive({
//   id: 'temp',
//   name: '临时列表',
//   meta: {},
// })

/**
 * 临时列表的「播放来源」信息（见 common/utils/tempListMeta.ts 的说明）。
 *
 * 这里用 reactive 包一层：保留原有的属性读写方式，同时让依赖它的 UI 能响应变化。
 * 初始值从 localStorage 还原 —— 重启后 listId 仍是 `temp`，
 * 若不还原来源，底部封面右击「定位」会因解析不出目标页而静默失效。
 */
export const tempListMeta = reactive<{ id: string }>({
  id: readStoredId(),
})

function readStoredId(): string {
  try {
    return parseTempListMeta(window.localStorage.getItem(TEMP_LIST_META_KEY))
  } catch (_) {
    // localStorage 不可用（隐私模式/配额）时按「无来源」处理，不影响播放
    return ''
  }
}

/**
 * 更新临时列表的播放来源 id 并写盘，重启后可还原。
 * @param id 来源 id，格式见 layout/PlayBar/useMusicLocation.ts 的注释
 */
export const setTempListMetaId = (id: string) => {
  tempListMeta.id = id
  try {
    window.localStorage.setItem(TEMP_LIST_META_KEY, serializeTempListMeta(id))
  } catch (_) {
    // 写盘失败时只保留内存值，不阻断播放
  }
}

// export const userLists: LX.List.UserListInfo[] = window.lxData.userLists = reactive([])

export const fetchingListStatus = reactive<Record<string, boolean>>({})

export const listUpdateTimes = reactive<Record<string, string>>({})
