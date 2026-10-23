<template lang="pug">
dt#webdav
  | {{ $t('setting__sync_webdav') }}
dd
  base-checkbox(
    id="setting_sync_webdav_enable"
    :model-value="appSetting['sync.webdav.enable']"
    :label="$t('setting__sync_webdav_enable')"
    @update:model-value="handleEnable"
  )
  base-checkbox(
    id="setting_sync_webdav_auto"
    :model-value="appSetting['sync.webdav.syncLists']"
    :label="$t('setting__sync_webdav_auto_sync')"
    :disabled="!appSetting['sync.webdav.enable']"
    @update:model-value="updateSetting({ 'sync.webdav.syncLists': $event })"
  )

template(v-if="appSetting['sync.webdav.enable']")
  dd
    .p
      base-input(
        id="setting_sync_webdav_url"
        :model-value="appSetting['sync.webdav.url']"
        :placeholder="$t('setting__sync_webdav_url_placeholder')"
        @update:model-value="onChange('sync.webdav.url', $event)"
      )
    .p.gap-top
      base-input(
        id="setting_sync_webdav_username"
        :model-value="appSetting['sync.webdav.username']"
        :placeholder="$t('setting__sync_webdav_username')"
        @update:model-value="onChange('sync.webdav.username', $event)"
      )
    .p.gap-top
      base-input(
        id="setting_sync_webdav_password"
        type="password"
        :model-value="appSetting['sync.webdav.password']"
        :placeholder="$t('setting__sync_webdav_password')"
        @update:model-value="onChange('sync.webdav.password', $event)"
      )
    .p.gap-top
      base-input(
        id="setting_sync_webdav_path"
        :model-value="appSetting['sync.webdav.path']"
        :placeholder="$t('setting__sync_webdav_path_placeholder')"
        @update:model-value="onChange('sync.webdav.path', $event)"
      )
    .p.small {{ $t('setting__sync_webdav_path_tip') }}

    .p.gap-top
      base-btn.btn(min :disabled="testing" @click="handleTest") {{ testing ? $t('setting__sync_webdav_testing') : $t('setting__sync_webdav_test') }}
      base-btn.btn.gap-left(min :disabled="busy" @click="handleSync") {{ $t('setting__sync_webdav_sync_now') }}
    .p.small(v-if="testResult")
      span(:class="testOk ? $style.ok : $style.err") {{ testResult }}

    .p.gap-top
      base-btn.btn(min :disabled="busy" @click="handleUploadLists") {{ $t('setting__sync_webdav_upload_lists') }}
      base-btn.btn.gap-left(min :disabled="busy" @click="handleDownloadLists") {{ $t('setting__sync_webdav_download_lists') }}
    .p.small {{ $t('setting__sync_webdav_risk_tip') }}

    .p.small.gap-top(v-if="lastSyncTime") {{ $t('setting__sync_webdav_last_sync') }}{{ lastSyncText }}
    .p.small.gap-top(v-else) {{ $t('setting__sync_webdav_never_synced') }}
</template>

<script>
import { ref, computed } from '@common/utils/vueTools'
import { dateFormat } from '@common/utils/common'
import { appSetting, updateSetting, saveMediaDeviceId } from '@renderer/store/setting'
import {
  handleTestConnection,
  manualUploadLists,
  manualDownloadLists,
  syncLists,
} from '@renderer/core/sync/webdavSync'
import { resetWebdavClient } from '@renderer/utils/webdav'

export default {
  name: 'WebdavSync',
  setup() {
    const testing = ref(false)
    const testResult = ref('')
    const testOk = ref(false)
    const busy = computed(() => testing.value)

    const lastSyncTime = computed(() => Number(appSetting['sync.webdav.lastSyncTimeLists']) || 0)
    const lastSyncText = computed(() => lastSyncTime.value ? dateFormat(lastSyncTime.value) : '')

    // 配置变更后需要让客户端按新配置重建
    const onChange = (key, value) => {
      updateSetting({ [key]: value })
      resetWebdavClient()
      testResult.value = ''
    }

    const handleEnable = (enabled) => {
      updateSetting({ 'sync.webdav.enable': enabled })
      if (!enabled) {
        testResult.value = ''
      }
    }

    const handleTest = async() => {
      if (testing.value) return
      testing.value = true
      testResult.value = ''
      try {
        const result = await handleTestConnection()
        testOk.value = result.ok
        testResult.value = result.message
      } finally {
        testing.value = false
      }
    }

    const handleSync = () => { void syncLists(true) }
    const handleUploadLists = () => { void manualUploadLists() }
    const handleDownloadLists = () => { void manualDownloadLists() }

    return {
      appSetting,
      updateSetting,
      saveMediaDeviceId,
      onChange,
      handleEnable,
      handleTest,
      handleSync,
      handleUploadLists,
      handleDownloadLists,
      testing,
      testResult,
      testOk,
      busy,
      lastSyncTime,
      lastSyncText,
    }
  },
}
</script>

<style lang="less" module>
.ok {
  color: var(--color-primary);
}
.err {
  color: #ff6b6b;
}
</style>
