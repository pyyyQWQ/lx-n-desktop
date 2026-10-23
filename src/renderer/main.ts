import '@common/error'
import { createApp } from 'vue'

import './core/globalData'

import '@renderer/event'

// Components
import mountComponents from './components'

// Plugins
import initPlugins from './plugins'
import { i18nPlugin } from './plugins/i18n'

import App from './App.vue'
import router from './router'
// import store from './store'


import { getSetting, updateSetting } from './utils/ipc'
import { langList } from '@root/lang'
import type { I18n } from '@root/lang/i18n'

import { initSetting } from './store/setting'
import { initWyLoginStatus, initWyLoginVerify, initWyLoginExpiredListener } from './core/wyLogin'
import { initWebdavSync } from './core/sync/webdavSync'
// import { bubbleCursor } from './utils/cursor-effects/bubbleCursor'

import './worker'
import { saveViewPrevState } from './utils/data'

// sync(store, router)

router.afterEach((to) => {
  if (to.path != '/songList/detail') {
    saveViewPrevState({
      url: to.path,
      query: { ...to.query },
    })
  }
})

void getSetting().then(setting => {
  // window.lx.appSetting = setting
  // Set language automatically
  if (!setting['common.langId'] || !window.i18n.availableLocales.includes(setting['common.langId'])) {
    let langId: I18n['locale'] | null = null
    const locale = window.navigator.language.toLocaleLowerCase() as I18n['locale']
    if (window.i18n.availableLocales.includes(locale)) {
      langId = locale
    } else {
      for (const lang of langList) {
        if (lang.alternate == locale) {
          langId = lang.locale
          break
        }
      }
      langId ??= 'en-us'
    }
    setting['common.langId'] = langId
    void updateSetting({ 'common.langId': langId })
    console.log('Set lang', setting['common.langId'])
  }
  window.setLang(setting['common.langId'])
  window.i18n.setLanguage(setting['common.langId'])

  if (!setting['common.startInFullscreen'] && (document.body.clientHeight > window.screen.availHeight || document.body.clientWidth > window.screen.availWidth) && setting['common.windowSizeId'] > 1) {
    void updateSetting({ 'common.windowSizeId': 1 })
  }

  // store.commit('setSetting', setting)
  initSetting(setting)

  // 网易云登录状态启动恢复（阶段 B2.1）
  // 不阻塞其他音乐源启动；如无 Cookie 则置未配置状态，有 Cookie 则后台验证
  initWyLoginStatus()
  initWyLoginVerify()
  // 注册网易云登录态失效监听（请求层 301 时复位状态并清持久化 Cookie）
  initWyLoginExpiredListener()

  // WebDAV 启动自动同步（仅在「启用 + 自动同步歌单」且已配置时，后台触发一次；不阻塞启动）
  initWebdavSync()

  const app = createApp(App)
  app
    .use(router)
    // .use(store)
    .use(i18nPlugin)
  initPlugins(app)
  mountComponents(app)
  app.mount('#root')
})

// bubbleCursor()
