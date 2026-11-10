<template>
  <!--
    每行都渲染这一格（非网易云歌曲渲染为空占位），
    这样右侧「耳机/加号/下载」在所有行里的水平位置完全一致。
  -->
  <button
    v-if="visible"
    type="button"
    :class="$style.likeBtn"
    :aria-label="liked ? $t('list__unlike') : $t('list__like')"
    @contextmenu.capture.stop
    @click.stop="handleClick"
  >
    <svg
      :class="[$style.likeIcon, { [$style.isLiked]: liked }]"
      version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink"
      height="100%"
      viewBox="0.02 -26.83 444.85 444.85"
      space="preserve"
    >
      <use :xlink:href="liked ? '#icon-love-filled' : '#icon-love'" />
    </svg>
  </button>
  <!-- 占位：无可喜欢对象时保持列宽，避免右侧按钮左右跳动 -->
  <span v-else :class="$style.likePlaceholder" aria-hidden="true" />
</template>

<script>
// 网易云「喜欢」心形按钮（移植自移动改良版 ListItem.tsx）。
//
// 设计要点：
//   1. 仅对网易云（wy）音源显示心形 —— 与手机版 `showLikeButton = item.source === 'wy'` 一致
//   2. **非 wy 行渲染等宽空占位**，保证右侧「耳机/加号/下载」在所有行里水平位置一致
//   3. 尺寸/内边距严格对齐 material/ListButtons.vue 里的按钮
//      （padding 4px 7px + svg height 16px），保证同一基线
//   4. 未登录网易云时不发请求，只提示
//
// 用法：作为独立一格放在操作列之前，例如
//   <div class="list-item-cell" style="flex: 0 0 4%;"><material-wy-like-btn :music-info="item" /></div>
import { computed } from '@common/utils/vueTools'
import { wyLoginStatus } from '@renderer/store/user/state'
import { toast } from '@renderer/plugins/Tips/toast'
import { useIsWyLiked, toggleWyLike } from '@renderer/components/material/OnlineList/useWyLike'

export default {
  name: 'MaterialWyLikeBtn',
  props: {
    musicInfo: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    // 仅网易云音源显示
    const visible = computed(() => props.musicInfo?.source === 'wy')

    /** 取网易云歌曲 id（songId 优先，其次 songmid） */
    const songId = computed(() => {
      const m = props.musicInfo?.meta
      return m?.songId ?? m?.songmid ?? null
    })

    const liked = useIsWyLiked(() => songId.value)

    const handleClick = () => {
      if (!visible.value) return
      const id = songId.value
      if (id == null || id === '') return
      // 未登录网易云时不发请求，直接提示（避免无意义的失败请求）
      if (wyLoginStatus.value !== 'logged-in') {
        toast('请先登录网易云账号')
        return
      }
      void toggleWyLike(id, liked.value)
    }

    return {
      visible,
      liked,
      handleClick,
    }
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.likeBtn {
  background-color: transparent;
  border: none;
  border-radius: @form-radius;
  cursor: pointer;
  // 与 material/ListButtons.vue 的 button 完全一致（含 margin-right: 5px 的按钮间距）
  padding: 4px 7px;
  margin-right: 5px;
  color: var(--color-button-font);
  outline: none;
  transition: background-color 0.2s ease;
  line-height: 0;
  // 与其它按钮同宽，保证横向节奏一致
  width: 30px;
  height: 24px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  // 作为 flex 子项时不要被压缩，避免心形被挤变形
  flex: none;

  // 心形图标说明：
  //   ① viewBox 已换成「正方形 + 图形居中」（0.02 -26.83 444.85 444.85），
  //      由 getBBox() 实测的真实边界算出。此前用路径控制点估算边界是错的
  //      （贝塞尔控制点会超出实际绘制区域），导致心形在按钮框里偏左上、不居中。
  //   ② 原图标是细线轮廓，用 stroke 同色描边适度加粗，使笔画分量与其它图标接近。
  //      stroke-width 按该 viewBox（边长 444.85 → 渲染 16px）的量级取值：
  //      18 约等于 0.65px 的实际描边，比默认细线更有分量，又不过分厚重。
  svg {
    height: 16px;
    width: 16px;
    overflow: visible;
    stroke: currentColor;
    stroke-width: 18;
    stroke-linejoin: round;
    stroke-linecap: round;
    paint-order: stroke fill;
  }

  &:hover {
    background-color: var(--color-button-background-hover);
  }
  &:active {
    background-color: var(--color-button-background-active);
  }
}

// 非网易云行的等宽空占位：让右侧按钮在所有行里保持同一水平位置。
// 宽度 = 按钮宽度 30px + margin-right 5px = 35px（含外边距，才能与有心形行完全对齐）。
.likePlaceholder {
  display: inline-block;
  width: 30px;
  height: 24px;
  margin-right: 5px;
  flex: none;
  box-sizing: border-box;
}

.likeIcon {
  color: var(--color-button-font);
  transition: color .2s ease;

  // 已喜欢：主题主色实心（对应手机版 c-liked）
  &.isLiked {
    color: var(--color-primary);
  }
}
</style>
