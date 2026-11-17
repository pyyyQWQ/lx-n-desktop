<template lang="pug">
//-
  全局动态背景：用当前播放歌曲的封面做高斯模糊底图。
  参照移动改良版 src/components/PageContent.tsx 的实现：
  图片铺满 + 原生 blurRadius + 半透明遮罩。

  与移动版的差异：
  · 移动版用 RN 的 blurRadius（原生高斯模糊），桌面端用 CSS filter: blur()
  · CSS 的 blur 会让元素边缘向外扩散变透明，四周出现白边，
    因此底图必须放大一点（scale）把白边挤出可视区域
transition(name="fade")
  div(v-if="activeUrl" :class="$style.root")
    div(:class="$style.image" :style="imageStyle")
    div(:class="$style.mask" :style="maskStyle")
</template>

<script>
import { computed, watch, onBeforeUnmount } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'
import { musicInfo } from '@renderer/store/player/state'

// CSS 的 blur(Npx) 与移动版 blurRadius(0-100) 量纲不同：
// 移动版的 18 大致对应桌面端的 18px，直接用即可。
const MAX_BLUR_PX = 100

export default {
  name: 'DynamicBackground',
  setup() {
    /** 本地绝对路径转成浏览器可用的 file:// URL。 */
    const toFileUrl = (p) => {
      if (/^(https?|file):/i.test(p)) return p
      // Windows 路径反斜杠转正斜杠；中文/空格需要编码
      const normalized = p.replace(/\\/g, '/')
      return `file:///${encodeURI(normalized).replace(/#/g, '%23')}`
    }

    const picUrl = computed(() => {
      const pic = musicInfo.pic
      return typeof pic == 'string' && pic ? pic : ''
    })

    const enabled = computed(() => !!appSetting['theme.dynamicBg'])

    /** 自定义背景路径（空表示未设置）。设了就优先用它，忽略动态背景。 */
    const customBg = computed(() => {
      const p = appSetting['theme.customBgPicPath']
      return typeof p == 'string' && p ? p : ''
    })

    /**
     * 最终用于背景的图片地址。
     *
     * 优先级：自定义背景 > 当前播放歌曲封面（动态背景）> 无
     * 自定义背景存在时不再显示封面背景，避免两者叠加看不清。
     */
    const activeUrl = computed(() => {
      if (customBg.value) return toFileUrl(customBg.value)
      if (enabled.value && picUrl.value) return picUrl.value
      return ''
    })

    /** 是否为自定义背景（决定是否套模糊） */
    const isCustom = computed(() => !!customBg.value)

    const blurPx = computed(() => {
      const raw = Number(appSetting['theme.blur'])
      if (!Number.isFinite(raw) || raw <= 0) return 0
      return Math.min(raw, MAX_BLUR_PX)
    })

    const imageStyle = computed(() => {
      const url = activeUrl.value
      // 自定义背景不套模糊（那是用户自己的图，模糊反而看不清）；
      // 动态背景才按 theme.blur 模糊。
      const blur = isCustom.value ? 0 : blurPx.value
      const sc = blur > 0 ? 1 + blur / 200 : 1
      return {
        backgroundImage: url ? `url("${url}")` : 'none',
        filter: blur > 0 ? `blur(${blur}px)` : 'none',
        transform: `scale(${sc})`,
      }
    })

    const maskStyle = computed(() => {
      const raw = isCustom.value
        ? Number(appSetting['theme.customBgOpacity'])
        : Number(appSetting['theme.picOpacity'])
      const opacity = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), 100) / 100 : 0.6
      return { opacity }
    })

    // body 上挂 class，让 App.vue 的透明覆盖规则生效
    // （各层默认有纯色底，不透明就无法看到底图）
    const syncBodyClass = (on) => {
      if (typeof document == 'undefined') return
      document.body.classList.toggle('has-dynamic-bg', on)
    }
    watch(() => !!activeUrl.value, syncBodyClass, { immediate: true })
    onBeforeUnmount(() => { syncBodyClass(false) })

    return {
      enabled,
      picUrl,
      activeUrl,
      isCustom,
      imageStyle,
      maskStyle,
    }
  },
}
</script>

<style lang="less" module>
.root {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.image {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  // 放大后超出部分裁掉，避免 layout 溢出
  will-change: filter, transform;
  transition: filter .3s ease, transform .3s ease, background-image .4s ease;
}

.mask {
  position: absolute;
  inset: 0;
  background-color: var(--color-main-background);
  transition: opacity .3s ease;
}

:global(.fade-enter-active),
:global(.fade-leave-active) {
  transition: opacity .3s ease;
}
:global(.fade-enter-from),
:global(.fade-leave-to) {
  opacity: 0;
}
</style>
