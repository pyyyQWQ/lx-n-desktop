<template lang="pug">
dt#list {{ $t('setting__list') }}
dd
  .gap-top
    base-checkbox(id="setting_list_actionButtonsVisible_enable" :model-value="appSetting['list.actionButtonsVisible']" :label="$t('setting__list_action_btn')" @update:model-value="updateSetting({'list.actionButtonsVisible': $event})")
  .gap-top
    base-checkbox(id="setting_list_showSource_enable" :model-value="appSetting['list.isShowSource']" :label="$t('setting__list_source')" @update:model-value="updateSetting({'list.isShowSource': $event})")
  .gap-top
    base-checkbox(id="setting_list_scroll_enable" :model-value="appSetting['list.isSaveScrollLocation']" :label="$t('setting__list_scroll')" @update:model-value="updateSetting({'list.isSaveScrollLocation': $event})")
  .gap-top
    base-checkbox(id="setting_list_clickAction_enable" :model-value="appSetting['list.isClickPlayList']" :label="$t('setting__list_click_action')" @update:model-value="updateSetting({'list.isClickPlayList': $event})")
  .gap-top
    base-checkbox(id="setting_list_auto_save_daily_rec" :model-value="appSetting['list.isAutoSaveDailyRec']" :label="$t('setting__list_auto_save_daily_rec')" @update:model-value="handleUpdateAutoSaveDailyRec")
    svg-icon(class="help-icon" name="help-circle-outline" :aria-label="$t('setting__list_auto_save_daily_rec_tip')")
dd(:aria-label="$t('setting__basic_sourcename_title')")
  h3#list_addMusicLocationType {{ $t('setting__list_add_music_location_type') }}
  div
    base-checkbox.gap-left(
      id="setting_list_add_music_location_type_top" name="setting_list_add_music_location_type" need
      :model-value="appSetting['list.addMusicLocationType']" value="top" :label="$t('setting__list_add_music_location_type_top')"
      @update:model-value="updateSetting({'list.addMusicLocationType': $event})")
    base-checkbox.gap-left(
      id="setting_list_add_music_location_type_bottom" name="setting_list_add_music_location_type" need
      :model-value="appSetting['list.addMusicLocationType']" value="bottom" :label="$t('setting__list_add_music_location_type_bottom')"
      @update:model-value="updateSetting({'list.addMusicLocationType': $event})")

</template>

<script>
// import { ref, onBeforeUnmount } from '@common/utils/vueTools'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { dialog } from '@renderer/plugins/Dialog'

export default {
  name: 'SettingList',
  setup() {
    /**
     * 开启前先确认：该功能会自动在你的「我的列表」里创建歌单。
     * 只保留最近 3 个（与移动改良版语义一致，手机版是 15 个）。
     */
    const handleUpdateAutoSaveDailyRec = async(enabled) => {
      if (enabled) {
        const confirm = await dialog.confirm({
          message: window.i18n.t('setting__list_auto_save_daily_rec_confirm'),
          confirmButtonText: window.i18n.t('confirm_button_text'),
          cancelButtonText: window.i18n.t('cancel_button_text'),
        })
        if (!confirm) return
      }
      updateSetting({ 'list.isAutoSaveDailyRec': enabled })
    }

    return {
      appSetting,
      updateSetting,
      handleUpdateAutoSaveDailyRec,
    }
  },
}
</script>
