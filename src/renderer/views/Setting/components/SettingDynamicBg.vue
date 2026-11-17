<template lang="pug">
dd(:class="$style.block")
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

    //- 仅在开启时显示这两个滑块，避免无关项干扰
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
</template>

<script>
import { appSetting, updateSetting } from '@renderer/store/setting'

export default {
  name: 'SettingDynamicBg',
  setup() {
    return { appSetting, updateSetting }
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
