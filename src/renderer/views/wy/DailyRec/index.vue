<template>
  <div :class="$style.page">
    <div :class="$style.header">
      <h3>{{ $t('wy_daily_rec__title') }}</h3>
      <div :class="$style.tabs">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          :class="[$style.tab, { [$style.active]: activeTab == tab.value }]"
          @click="switchTab(tab.value)"
        >
          {{ tab.label }}
        </button>
        <button
          :class="[$style.tab, { [$style.disabled]: !isLogined || loading }]"
          :disabled="!isLogined || loading"
          @click="handleRefresh"
        >
          {{ $t('wy_daily_rec__refresh') }}
        </button>
      </div>
    </div>

    <div v-if="loading" :class="$style.status">{{ $t('list__loading') }}</div>
    <div v-else-if="!isLogined" :class="$style.status">{{ $t('wy_daily_rec__not_login') }}</div>
    <div v-else-if="loadFailed" :class="$style.status">{{ $t('list__load_failed') }}</div>

    <template v-else-if="activeTab == 'songs'">
      <div v-if="!songs.length" :class="$style.status">{{ $t('wy_daily_rec__songs_empty') }}</div>
      <div v-else :class="$style.songsWrap">
        <material-online-list
          ref="listRef"
          :list="songs"
          :page="1"
          :limit="songs.length"
          :total="songs.length"
          :no-item="''"
          :source-tag="true"
          @play-list="handlePlaySong"
        />
      </div>
    </template>

    <template v-else>
      <div v-if="!playlists.length" :class="$style.status">{{ $t('wy_daily_rec__playlists_empty') }}</div>
      <div v-else :class="$style.grid">
        <div v-for="item in playlists" :key="item.id" :class="$style.card" @click="openPlaylist(item)">
          <div :class="$style.cover">
            <img v-if="item.coverImgUrl" :class="$style.img" loading="lazy" decoding="async" :src="item.coverImgUrl">
            <div v-else :class="$style.coverPlaceholder">
              <svg-icon name="music" />
            </div>
            <span v-if="item.trackCount != null" :class="$style.trackCount">{{ item.trackCount }}</span>
          </div>
          <p :class="$style.name" :title="item.name">{{ item.name }}</p>
        </div>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { ref, computed, watch } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import { toNewMusicInfo } from '@renderer/utils'
import wyDailyRecApi from '@renderer/utils/musicSdk/wy/dailyRec'
import { appSetting } from '@renderer/store/setting'
import { wyLoginStatus, wyDailyRecSongs, wyDailyRecPlaylists } from '@renderer/store/user/state'
import { setWyDailyRecSongs, setWyDailyRecPlaylists } from '@renderer/store/user/action'
import { setTempList } from '@renderer/store/list/action'
import { playList } from '@renderer/core/player/action'
import { LIST_IDS } from '@common/constants'

const DAILY_REC_LIST_ID = 'dailyrec_wy'

export default {
  name: 'WyDailyRec',
  setup() {
    const router = useRouter()
    const activeTab = ref<'songs' | 'playlists'>('songs')
    const loading = ref(false)
    const loadFailed = ref(false)
    const listRef = ref<any>(null)

    const isLogined = computed(() => wyLoginStatus.value == 'logged-in')
    const songs = computed(() => wyDailyRecSongs)
    const playlists = computed(() => wyDailyRecPlaylists)

    const tabs = computed(() => [
      { value: 'songs', label: window.i18n.t('wy_daily_rec__tab_songs') },
      { value: 'playlists', label: window.i18n.t('wy_daily_rec__tab_playlists') },
    ])

    const loadSongs = async() => {
      const cookie = appSetting['common.wy_cookie'] || ''
      const result = await wyDailyRecApi.getList(cookie)
      const list = result.list.map(item => toNewMusicInfo(item))
      setWyDailyRecSongs(list)
    }

    const loadPlaylists = async() => {
      const cookie = appSetting['common.wy_cookie'] || ''
      const list = await wyDailyRecApi.getRecPlaylists(cookie)
      setWyDailyRecPlaylists(list)
    }

    const refresh = async() => {
      if (loading.value) return
      const cookie = appSetting['common.wy_cookie'] || ''
      if (!cookie) return
      loading.value = true
      loadFailed.value = false
      try {
        // 每日推荐歌曲与歌单一次性拉取，页面切换即时展示。
        await Promise.all([loadSongs(), loadPlaylists()])
      } catch (_) {
        loadFailed.value = true
      } finally {
        loading.value = false
      }
    }

    const handleRefresh = () => {
      void refresh()
    }

    const switchTab = (tab: 'songs' | 'playlists') => {
      activeTab.value = tab
    }

    const handlePlaySong = (index: number) => {
      const list = songs.value
      if (!list.length) return
      void setTempList(DAILY_REC_LIST_ID, [...list] as LX.Music.MusicInfoOnline[]).then(() => {
        playList(LIST_IDS.TEMP, index)
      })
    }

    const openPlaylist = (item: { id: string }) => {
      void router.push({
        path: '/songList/detail',
        query: {
          source: 'wy',
          id: item.id,
          fromName: 'WyDailyRec',
        },
      })
    }

    // 进入页面时若已登录但尚未加载，主动拉取一次。
    if (isLogined.value && !wyDailyRecSongs.length && !wyDailyRecPlaylists.length) {
      void refresh()
    }

    // 登录状态从非登录态转为已登录时（如网页登录后切回本页），拉取每日推荐。
    watch(isLogined, (logged) => {
      if (logged && !wyDailyRecSongs.length && !wyDailyRecPlaylists.length) {
        void refresh()
      }
    })

    return {
      isLogined,
      activeTab,
      tabs,
      songs,
      playlists,
      loading,
      loadFailed,
      listRef,
      handleRefresh,
      switchTab,
      handlePlaySong,
      openPlaylist,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.page {
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  padding: 15px;
  box-sizing: border-box;
}
.header {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
  h3 {
    font-size: 16px;
    color: var(--color-font);
  }
}
.tabs {
  flex: none;
  display: flex;
  gap: 4px;
  margin-left: auto;
}
.tab {
  padding: 2px 10px;
  font-size: 12px;
  color: var(--color-font-label);
  background-color: transparent;
  border: 1px solid var(--color-080);
  border-radius: 12px;
  cursor: pointer;
  transition: all @transition-fast;
  &:hover {
    color: var(--color-font);
    border-color: var(--color-primary-light-200);
  }
  &.active {
    color: #fff;
    background-color: var(--color-primary);
    border-color: var(--color-primary);
  }
  &.disabled {
    color: var(--color-font-label);
    opacity: .5;
    cursor: not-allowed;
    &:hover {
      border-color: var(--color-080);
    }
  }
}
.status {
  flex: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--color-font-label);
}
.songsWrap {
  flex: auto;
  min-height: 0;
  position: relative;
}
.grid {
  flex: auto;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-flow: row wrap;
  gap: 12px;
  align-content: flex-start;
}
.card {
  width: 120px;
  cursor: pointer;
  transition: opacity @transition-normal;
  &:hover {
    opacity: .75;
  }
}
.cover {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 4px;
  overflow: hidden;
  background-color: var(--color-080);
  box-shadow: 0 0 2px 0 rgba(0,0,0,.2);
}
.img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.coverPlaceholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-font-label);
  svg {
    width: 40%;
    height: 40%;
  }
}
.trackCount {
  position: absolute;
  right: 0;
  bottom: 0;
  padding: 2px 5px;
  font-size: 11px;
  color: #fff;
  background-color: rgba(0,0,0,.4);
  border-top-left-radius: 3px;
}
.name {
  margin-top: 5px;
  font-size: 13px;
  color: var(--color-font);
  .mixin-ellipsis-2();
}
</style>
