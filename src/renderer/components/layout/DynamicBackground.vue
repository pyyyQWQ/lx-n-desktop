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
  div(v-if="enabled && picUrl" :class="$style.root" :style="rootStyle")
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
    const enabled = computed(() => !!appSetting['theme.dynamicBg'])

    const picUrl = computed(() => {
      const pic = musicInfo.pic
      return typeof pic == 'string' && pic ? pic : ''
    })

    const blurPx = computed(() => {
      const raw = Number(appSetting['theme.blur'])
      if (!Number.isFinite(raw) || raw <= 0) return 0
      return Math.min(raw, MAX_BLUR_PX)
    })

    // 模糊后边缘会向外扩散，需要放大避免露出白边。
    // 半径越大，需要放大的比例越大。
    const scale = computed(() => 1 + blurPx.value / 200)

    const rootStyle = computed(() => ({}))

    const imageStyle = computed(() => ({
      backgroundImage: picUrl.value ? `url("${picUrl.value}")` : 'none',
      filter: blurPx.value > 0 ? `blur(${blurPx.value}px)` : 'none',
      transform: `scale(${scale.value})`,
    }))

    const maskStyle = computed(() => {
      const raw = Number(appSetting['theme.picOpacity'])
      const opacity = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), 100) / 100 : 0.6
      return { opacity }
    })

    // body 上挂 class，让 App.vue 的透明覆盖规则生效
    // （各层默认有纯色底，不透明就无法看到底图）
    const syncBodyClass = (on) => {
      if (typeof document == 'undefined') return
      document.body.classList.toggle('has-dynamic-bg', on)
    }
    watch(() => enabled.value && !!picUrl.value, syncBodyClass, { immediate: true })
    onBeforeUnmount(() => { syncBodyClass(false) })

    return {
      enabled,
      picUrl,
      rootStyle,
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
