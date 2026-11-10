// 「我的列表」内联过滤：输入关键词即时过滤显示，保留与原始列表的索引映射。
//
// 与手机版（lx-netease-music-mobile）的关系：
//   手机版 `screens/Home/Views/Mylist/MusicList/` 的 `ListSearchBar.tsx` + `ListMusicSearch.tsx`
//   做的是「**搜索 + 滚动定位**」——输入关键词弹出结果浮层，点结果滚动到那首歌。
//   桌面端已有完全对应的能力：`components/SearchList.vue`（Ctrl+F 唤起）。
//   因此本文件做的是**过滤**（列表只留匹配项），是手机版没有的模式，不是移植。
//
// 匹配规则直接沿用手机版 `listAction.ts` 的 `searchListMusic`
// （与桌面端 `worker/main/list.ts` 的同名函数逐行一致），保证跨端体验一致：
//   1. 先按 歌名 / 歌手 / 专辑 做「包含」匹配，三者分别成组、按此优先级排在前面
//   2. 再对剩余项做「字符按序出现」的模糊匹配，按相似度排序
//
// 之所以单独放这里：过滤逻辑是纯函数，不依赖 store / Vue，可直接单测。

// 用相对路径导入：tests 里的纯 Node 环境没有 webpack 的 @common 别名
import { similar } from './common'

export interface FilterableMusic {
  id: string
  name: string
  singer: string
  meta?: {
    albumName?: string
  }
}

const escapeRxp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * 按关键词过滤列表，返回**原始下标**数组（保持原顺序语义：先精确组、再模糊组）。
 *
 * 为什么返回下标而不是对象数组：
 * 下游的播放、右键菜单、拖拽排序等全都依赖「列表下标」，
 * 若直接传过滤后的对象数组，下标会错位。用原始下标即可安全映射回去。
 *
 * @param list 原始列表
 * @param keyword 关键词（内部会 trim；空串表示不过滤）
 * @returns 命中的原始下标，顺序即展示顺序
 */
export const filterMusicIndices = (list: FilterableMusic[], keyword: string): number[] => {
  const text = typeof keyword == 'string' ? keyword.trim() : ''
  if (!text) {
    // 空关键词 = 不过滤，返回全部下标
    return list.map((_, i) => i)
  }

  const textLower = text.toLowerCase()

  const nameHits: number[] = []
  const singerHits: number[] = []
  const albumHits: number[] = []

  for (let i = 0; i < list.length; i++) {
    const m = list[i]
    if (!m) continue
    if (m.name?.toLowerCase().includes(textLower)) {
      nameHits.push(i)
    } else if (m.singer?.toLowerCase().includes(textLower)) {
      singerHits.push(i)
    } else if (m.meta?.albumName?.toLowerCase().includes(textLower)) {
      albumHits.push(i)
    }
  }

  // 模糊匹配：关键词的字符需按顺序出现。
  // 与手机版行为一致（`text.split('').join('.*')`）。
  const hitSet = new Set([...nameHits, ...singerHits, ...albumHits])
  const fuzzy: Array<{ num: number, index: number }> = []
  let rxp: RegExp | null = null
  try {
    rxp = new RegExp(text.split('').map(escapeRxp).join('.*') + '.*', 'i')
  } catch (_) {
    // 关键词无法构成合法正则时，只保留精确组
    rxp = null
  }

  if (rxp) {
    for (let i = 0; i < list.length; i++) {
      if (hitSet.has(i)) continue
      const m = list[i]
      if (!m) continue
      const str = `${m.name ?? ''}${m.singer ?? ''}${m.meta?.albumName ?? ''}`
      if (!rxp.test(str)) continue
      // similar 返回 1 - (编辑距离 / 长度)，越大越相似
      const num = similar(text, str)
      // 降序插入：相似度高的在前，与手机版 sortInsert + reverse 等价
      let pos = fuzzy.length
      while (pos > 0 && fuzzy[pos - 1].num < num) pos--
      fuzzy.splice(pos, 0, { num, index: i })
    }
  }

  return [
    ...nameHits,
    ...singerHits,
    ...albumHits,
    ...fuzzy.map(item => item.index),
  ]
}
