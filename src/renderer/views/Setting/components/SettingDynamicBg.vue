<template lang="pug">
//- 作为「基本设置 → 主题颜色」下面的一小节嵌入，不再自带分隔线
dd
  h3#dynamic_bg_title {{ $t('setting__dynamic_bg') }}
  div
    p(:class="$style.desc") {{ $t('setting__dynamic_bg_desc') }}

    .gap-top
      base-checkbox(
        id="setting_dynamic_bg_enable"
        :model-value="appSetting['theme.dynamicBg']"
        :label="$t('setting__dynamic_bg_enable')"
        @update:model-value="updateSetting({ 'theme.dynamicBg': $event })"
      )

    //- 动态背景的两个滑块，仅在开启时显示
    template(v-if="appSetting['theme.dynamicBg']")
      div(:class="$style.row")
        span(:class="$style.label") {{ $t('setting__dynamic_bg_blur') }}
        base-slider-bar.slider(
          :value="appSetting['theme.blur']" :min="0" :max="100"
          @change="updateSetting({ 'theme.blur': $event })"
        )
        span(:class="$style.num") {{ appSetting['theme.blur'] }}

      div(:class="$style.row")
        span(:class="$style.label") {{ $t('setting__dynamic_bg_opacity') }}
        base-slider-bar.slider(
          :value="appSetting['theme.picOpacity']" :min="0" :max="100"
          @change="updateSetting({ 'theme.picOpacity': $event })"
        )
        span(:class="$style.num") {{ appSetting['theme.picOpacity'] }}

  //- 自定义背景：独立于动态背景，设置了就优先使用
  h3#custom_bg_title.gap-top {{ $t('setting__custom_bg') }}
  div
    p(:class="$style.desc") {{ $t('setting__custom_bg_desc') }}
    p.currentPath(v-if="customBgPath" :class="$style.path") {{ customBgPath }}

    .gap-top
      base-btn(min @click="handleSelectImage") {{ $t('setting__custom_bg_select') }}
      base-btn.gap-left(min :disabled="!customBgPath" @click="handleClearImage") {{ $t('setting__custom_bg_clear') }}

    div(v-if="customBgPath" :class="$style.row")
      span(:class="$style.label") {{ $t('setting__custom_bg_opacity') }}
      base-slider-bar.slider(
        :value="appSetting['theme.customBgOpacity']" :min="0" :max="100"
        @change="updateSetting({ 'theme.customBgOpacity': $event })"
      )
      span(:class="$style.num") {{ appSetting['theme.customBgOpacity'] }}
</template>

<script>
import { computed } from '@common/utils/vueTools'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { showSelectDialog } from '@renderer/utils/ipc'
import { toast } from '@renderer/plugins/Tips/toast'

/** 允许的图片格式。 */
const IMAGE_EXTS = ['jpg', 'jpeg', 'jfif', 'pjpeg', 'pjp', 'png', 'apng', 'avif', 'gif', 'svg', 'webp', 'bmp']

export default {
  name: 'SettingDynamicBg',
  setup() {
    const customBgPath = computed(() => String(appSetting['theme.customBgPicPath'] ?? ''))

    /**
     * 选择自定义背景图。
     *
     * 直接存**绝对路径**而不拷贝到数据目录：
     * 主题编辑里会拷贝是为了让主题可导出/同步，而全局背景只需本机可用，
     * 存原路径更省事，用户移动文件后重新选即可。
     */
    const handleSelectImage = async() => {
      const result = await showSelectDialog({
        title: window.i18n.t('setting__custom_bg_select'),
        properties: ['openFile'],
        filters: [{ name: 'Image File', extensions: IMAGE_EXTS }],
      })
      if (result.canceled || !result.filePaths.length) return
      updateSetting({ 'theme.customBgPicPath': result.filePaths[0] })
      toast(window.i18n.t('setting__custom_bg_selected'))
    }

    const handleClearImage = () => {
      updateSetting({ 'theme.customBgPicPath': '' })
    }

    return { appSetting, updateSetting, customBgPath, handleSelectImage, handleClearImage }
  },
}
</script>

<style lang="less" module>
.block {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--color-150);
}

.desc {
  font-size: 12px;
  opacity: 0.7;
  line-height: 1.6;
}

.path {
  font-size: 12px;
  opacity: 0.6;
  word-break: break-all;
  line-height: 1.5;
  margin: 6px 0 0;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.label {
  flex: 0 0 76px;
  font-size: 13px;
  opacity: 0.85;
}

.slider {
  flex: 1 1 auto;
  min-width: 120px;
  max-width: 260px;
}

.num {
  flex: 0 0 34px;
  text-align: right;
  font-size: 12px;
  opacity: 0.65;
  font-variant-numeric: tabular-nums;
}
</style>
