<template>
  <div :class="$style.page">
    <div :class="$style.header">
      <h3>{{ $t('wy_playlists__title') }}</h3>
      <base-btn class="btn min" :disabled="!isLogined || loading" @click="handleRefresh">{{ $t('wy_playlists__refresh') }}</base-btn>
    </div>
    <div v-if="loading" :class="$style.status">{{ $t('list__loading') }}</div>
    <div v-else-if="!isLogined" :class="$style.status">{{ $t('wy_playlists__not_login') }}</div>
    <div v-else-if="loadFailed" :class="$style.status">{{ $t('list__load_failed') }}</div>
    <div v-else-if="!list.length" :class="$style.status">{{ $t('wy_playlists__empty') }}</div>
    <div v-else :class="$style.grid">
      <div v-for="item in list" :key="item.id" :class="$style.card" @click="openPlaylist(item)">
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
  </div>
</template>

<script lang="ts">
import { ref, computed } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import wyUserApi from '@renderer/utils/musicSdk/wy/user'
import { appSetting } from '@renderer/store/setting'
import { wyPlaylists, wyLoginStatus, wyUid } from '@renderer/store/user/state'
import { setWyPlaylists } from '@renderer/store/user/action'

export default {
  name: 'WyPlaylist',
  setup() {
    const router = useRouter()
    const loading = ref(false)
    const loadFailed = ref(false)

    const isLogined = computed(() => wyLoginStatus.value == 'logged-in')
    const list = computed(() => wyPlaylists)

    const refresh = async() => {
      if (loading.value) return
      const cookie = appSetting['common.wy_cookie'] || ''
      if (!cookie || !wyUid.value) return
      loading.value = true
      loadFailed.value = false
      try {
        const playlists = await wyUserApi.getUserPlaylists(wyUid.value, cookie)
        setWyPlaylists(playlists)
      } catch (_) {
        loadFailed.value = true
      } finally {
        loading.value = false
      }
    }

    const handleRefresh = () => {
      void refresh()
    }

    const openPlaylist = (item: { id: string }) => {
      void router.push({
        path: '/songList/detail',
        query: {
          source: 'wy',
          id: item.id,
          fromName: 'WyPlaylist',
        },
      })
    }

    return {
      isLogined,
      list,
      loading,
      loadFailed,
      handleRefresh,
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
  justify-content: space-between;
  margin-bottom: 10px;
  h3 {
    font-size: 16px;
    color: var(--color-font);
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
