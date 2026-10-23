import { nextTick, onBeforeUnmount, watch } from '@common/utils/vueTools'
import {
  onUpdateAvailable,
  onUpdateDownloaded,
  onUpdateError,
  onUpdateNotAvailable,
  onUpdateProgress,
  getIgnoreVersion,
  getLastStartInfo,
  saveLastStartInfo,
} from '@renderer/utils/ipc'
import { compareVer } from '@common/utils'
import { isShowChangeLog, versionInfo } from '@renderer/store'
import { getVersionInfo } from '@renderer/utils/update'
import { dialog } from '@renderer/plugins/Dialog'
import { appSetting } from '@renderer/store/setting'

export default () => {
  let isShowedChangeLog = false

  // 更新超时定时器（不再用于自动下载，仅保留清理逻辑，避免无关引用）
  let updateTimeout: number | null = null

  const clearUpdateTimeout = () => {
    if (!updateTimeout) return
    clearTimeout(updateTimeout)
    updateTimeout = null
  }

  const handleShowChangeLog = () => {
    isShowedChangeLog = true
    void getLastStartInfo().then((version) => {
      if (version == process.versions.app) return
      saveLastStartInfo(process.versions.app)
      if (!appSetting['common.showChangeLog']) return
      if (version) {
        if (compareVer(process.versions.app, version) < 0) {
          void dialog({
            message: window.i18n.t('update__downgrade_tip', { ver: `${version} → ${process.versions.app}` }),
            confirmButtonText: window.i18n.t('update__ignore_confirm_tip_confirm'),
          })
          return
        }

        if (compareVer(version, versionInfo.newVersion!.version) >= 0) return
      } else if (
        // 如果当前版本不在已发布的版本中，则不需要显示更新日志
        ![{ version: versionInfo.newVersion!.version, desc: '' }, ...(versionInfo.newVersion!.history ?? [])]
          .some(i => i.version == process.versions.app)
      ) return
      isShowChangeLog.value = true
    })
  }

  const handleGetVersionInfo = async(): Promise<NonNullable<typeof versionInfo['newVersion']>> => {
    return (versionInfo.newVersion?.history && !versionInfo.reCheck
      ? Promise.resolve(versionInfo.newVersion)
      : getVersionInfo().then((body: any) => {
        versionInfo.newVersion = body
        return body
      })
    ).catch(() => {
      // 获取最新版本失败：不要回退到旧缓存（旧缓存可能是上一个版本号，会误报新版本，如 2.12.6）。
      // 统一返回未知态（version='0.0.0'），由调用方显示「获取最新版本信息失败」。
      let result = {
        version: '0.0.0',
        desc: '',
        history: [],
      }
      versionInfo.newVersion = result
      return result
    })
  }

  let versionInfoPromise: null | ReturnType<typeof handleGetVersionInfo> = null

  const showUpdateModal = (status?: LX.UpdateStatus) => {
    if (versionInfoPromise) {
      if (
        // @ts-expect-error
        versionInfoPromise.resolved &&
        versionInfo.reCheck) {
        versionInfoPromise = handleGetVersionInfo()
      }
    } else versionInfoPromise = handleGetVersionInfo()
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    void versionInfoPromise.then((result) => {
      versionInfo.reCheck = false

      if (result.version == '0.0.0') {
        versionInfo.isUnknown = true
        versionInfo.status = 'error'
        let ignoreFailTipTime = parseInt(localStorage.getItem('update__check_failed_tip') ?? '0')
        if (Date.now() - ignoreFailTipTime > 7 * 86400000) {
          versionInfo.showModal = true
        }
        return
      }
      versionInfo.isUnknown = false
      if (compareVer(versionInfo.version, result.version) != -1) {
        versionInfo.status = 'idle'
        versionInfo.isLatest = true
        handleShowChangeLog()
        return
      }

      return getIgnoreVersion().then((ignoreVersion) => {
        versionInfo.isLatest = false
        let preStatus = versionInfo.status
        if (status) versionInfo.status = status
        if (result.version === ignoreVersion) return
        void nextTick(() => {
          versionInfo.showModal = true
          if (status == 'error' && preStatus == 'downloading' && !localStorage.getItem('update__download_failed_tip')) {
            setTimeout(() => {
              void dialog({
                message: window.i18n.t('update__error_top'),
                confirmButtonText: window.i18n.t('alert_button_text'),
              }).finally(() => {
                localStorage.setItem('update__download_failed_tip', '1')
              })
            }, 500)
          }
        })
      })
    }).finally(() => {
      // @ts-expect-error
      versionInfoPromise!.resolved = true
    })
  }

  const rUpdateAvailable = onUpdateAvailable(({ params: info }) => {
    // 不做自动下载：仅记录新版本信息并弹窗提示，由用户在弹窗内决定是否手动去 GitHub Releases 下载。
    // versionInfo.isDownloading = true
    // console.log(info)
    versionInfo.newVersion = {
      version: info.version,
      desc: info.releaseNotes as string,
    }
    versionInfo.isLatest = false
    void nextTick(() => {
      showUpdateModal()
    })
  })
  const rUpdateNotAvailable = onUpdateNotAvailable(({ params: info }) => {
    clearUpdateTimeout()
    // versionInfo.newVersion = {
    //   version: info.version,
    //   desc: info.releaseNotes as string,
    // }
    void handleGetVersionInfo().finally(() => {
      versionInfo.isLatest = true
      versionInfo.isUnknown = false
      versionInfo.status = 'idle'
      handleShowChangeLog()
    })
  })
  const rUpdateError = onUpdateError((params) => {
    clearUpdateTimeout()
    // versionInfo.status = 'error'
    void nextTick(() => {
      showUpdateModal('error')
    })
  })
  const rUpdateProgress = onUpdateProgress(({ params: progress }) => {
    versionInfo.downloadProgress = progress
  })
  const rUpdateDownloaded = onUpdateDownloaded(({ params: info }) => {
    clearUpdateTimeout()
    // versionInfo.status = 'downloaded'
    void nextTick(() => {
      showUpdateModal('downloaded')
    })
  })

  // 手动「检查更新」：强制重新获取最新版本信息
  const handleManualCheck = () => {
    versionInfo.reCheck = true
    showUpdateModal()
  }
  const onCheckForUpdate = () => {
    window.app_event.on('checkForUpdate', handleManualCheck)
  }
  const offCheckForUpdate = () => {
    window.app_event.off('checkForUpdate', handleManualCheck)
  }
  onCheckForUpdate()

  watch(() => versionInfo.showModal, (visible) => {
    if (visible || isShowedChangeLog || versionInfo.status == 'downloaded') return
    setTimeout(() => {
      handleShowChangeLog()
    }, 1000)
  })

  onBeforeUnmount(() => {
    clearUpdateTimeout()
    offCheckForUpdate()
    rUpdateAvailable()
    rUpdateNotAvailable()
    rUpdateError()
    rUpdateProgress()
    rUpdateDownloaded()
  })
}
