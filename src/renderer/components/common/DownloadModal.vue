<template>
  <material-modal :show="show" :bg-close="bgClose" :teleport="teleport" @close="handleClose">
    <main :class="$style.main">
      <h2>{{ info.name }}<br>{{ info.singer }}</h2>
      <div v-if="isLoadingQuality" :class="$style.loading">{{ $t('download__quality_loading') }}</div>
      <template v-else>
        <base-btn v-for="quality in qualitys" :key="quality.type" :class="$style.btn" @click="handleClick(quality.type)">
          {{ getTypeName(quality.type) }}{{ quality.size && ` (${quality.size})` }}
        </base-btn>
      </template>
    </main>
  </material-modal>
</template>

<script>
import { toRaw } from '@common/utils/vueTools'
import { qualityList } from '@renderer/store'
import { createDownloadTasks } from '@renderer/store/download/action'
import { getQualityLabel } from '@common/utils/quality'
import { fillFullQuality } from '@renderer/core/music/utils'

export default {
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    musicInfo: {
      type: [Object, null],
      required: true,
    },
    listId: {
      type: String,
      default: '',
    },
    bgClose: {
      type: Boolean,
      default: true,
    },
    teleport: {
      type: String,
      default: '#root',
    },
  },
  emits: ['update:show'],
  setup() {
    return {
      qualityList,
    }
  },
  data() {
    return {
      // 打开弹窗时先补齐音质信息，避免只显示 128k/320k/flac 三档
      isLoadingQuality: false,
      // 补全后的歌曲信息（含完整音质列表）
      filledInfo: null,
    }
  },
  computed: {
    info() {
      return this.filledInfo ?? this.musicInfo ?? {}
    },
    sourceQualityList() {
      return this.qualityList[this.musicInfo?.source] || []
    },
    qualitys() {
      const list = this.info.meta?.qualitys ?? []
      // 先按音源声明的档位过滤，再按音质从高到低排序（与手机版展示顺序一致）
      return list
        .filter(quality => this.checkSource(quality.type))
        .slice()
        .sort((a, b) => this.qualityRank(b.type) - this.qualityRank(a.type))
    },
  },
  watch: {
    show: {
      immediate: true,
      handler(val) {
        if (val) void this.loadFullQuality()
      },
    },
    musicInfo() {
      this.filledInfo = null
      if (this.show) void this.loadFullQuality()
    },
  },
  methods: {
    /**
     * 打开弹窗时补全音质信息。
     * 复用移动改良版方案：额外请求一次「音质详情」接口，拿到完整档位与文件大小。
     */
    async loadFullQuality() {
      if (!this.musicInfo || this.musicInfo.source === 'local') return
      this.isLoadingQuality = true
      try {
        // 用 toRaw 传原始对象：fillFullQuality 会就地写入 meta，若传 Proxy 会给
        // 原始对象挂上响应式引用，后续传给 Worker 时可能克隆失败。
        const filled = await fillFullQuality(toRaw(this.musicInfo))
        // 存一份纯数据副本，确保任何路径都不会把 Proxy 传进 Worker
        this.filledInfo = JSON.parse(JSON.stringify(filled))
      } catch (_) {
        this.filledInfo = JSON.parse(JSON.stringify(toRaw(this.musicInfo)))
      } finally {
        this.isLoadingQuality = false
      }
    },
    qualityRank(type) {
      const list = ['master', 'atmos_plus', 'atmos', 'hires', 'flac', '320k', '192k', '128k', 'ape', 'wav']
      const i = list.indexOf(type)
      return i === -1 ? -1 : list.length - i
    },
    handleClick(quality) {
      // 注意：必须用 toRaw 解掉 Vue 响应式代理。
      // filledInfo 是响应式数据，直接传给 Worker 会触发
      // DataCloneError: could not be cloned（Worker postMessage 无法克隆 Proxy）。
      void createDownloadTasks([toRaw(this.info)], quality, this.listId)
      this.handleClose()
    },
    handleClose() {
      this.$emit('update:show', false)
    },
    getTypeName(quality) {
      switch (quality) {
        // 高音质档位：Hi-Res / 空间音频 / 母带，用统一展示名
        case 'hires':
        case 'atmos':
        case 'atmos_plus':
        case 'master':
          return getQualityLabel(quality, this.$t)
        case 'flac':
        case 'ape':
        case 'wav':
          return this.$t('download__lossless') + ' ' + quality.toUpperCase()
        case '320k':
          return this.$t('download__high_quality') + ' ' + quality.toUpperCase()
        case '192k':
        case '128k':
          return this.$t('download__normal') + ' ' + quality.toUpperCase()
        default:
          return getQualityLabel(quality, this.$t)
      }
    },
    checkSource(quality) {
      return this.sourceQualityList.includes(quality)
    },
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.main {
  padding: 15px;
  max-width: 400px;
  min-width: 200px;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  h2 {
    font-size: 13px;
    color: var(--color-font);
    line-height: 1.3;
    text-align: center;
    margin-bottom: 15px;
  }
}

.btn {
  display: block;
  margin-bottom: 15px;
  &:last-child {
    margin-bottom: 0;
  }
}

.loading {
  padding: 10px 0 5px;
  text-align: center;
  font-size: 13px;
  opacity: .7;
}

</style>
