<template lang="pug">
dt#quality_probe {{ $t('setting__quality_probe') }}
dd
  h3#basic_source {{ $t('setting__basic_source') }}
  div
    .gap-top(v-for="item in apiSources" :key="item.id")
      base-checkbox(
        :id="`setting_api_source_${item.id}`" name="setting_api_source"
        need :model-value="appSetting['common.apiSource']" :disabled="item.disabled" :value="item.id" :aria-label="item.label" @update:model-value="updateSetting({'common.apiSource': $event})")
        span(:class="$style.sourceLabel")
          | {{ item.name }}
          span(v-if="item.desc" :class="$style.desc") {{ item.desc }}
          span(v-if="item.statusLabel" :class="$style.status") {{ item.statusLabel }}
    .p.gap-top
      base-btn.btn(min @click="isShowUserApiModal = true") {{ $t('setting__basic_source_user_api_btn') }}

dd(:class="$style.qualityBlock")
  h3#play_quality_by_source {{ $t('setting__play_playQuality') }}
  div
    p(:class="$style.description") {{ $t('setting__quality_probe_play_quality_desc') }}
    div(v-for="src in probeSources" :key="src" :class="$style.qualityRow")
      span(:class="$style.qualitySrc") {{ sourceName(src) }}
      div(:class="$style.qualityOpts")
        base-btn(
          v-for="q in qualityOptionsFor(src)" :key="q" type="button" min
          :outline="playQualityOf(src) !== q"
          :class="[$style.qualityOpt, playQualityOf(src) === q ? $style.qualityOptActive : '']"
          @click.stop="setPlayQuality(src, q)"
        ) {{ qualityLabelOf(src, q) }}

dd(:class="$style.probeBlock")
  h3#quality_probe_title {{ $t('setting__quality_probe_title') }}
  div
    p(:class="$style.description") {{ $t('setting__quality_probe_desc') }}

    //- 当前音源信息（单独成块，与上方描述、下方按钮都留出间距）
    div(:class="$style.currentRow")
      span(:class="$style.label") {{ $t('setting__quality_probe_current') }}
      span(:class="$style.value") {{ currentApi.name }}
      span(v-if="currentApi.version" :class="$style.ver") {{ currentApi.version }}

    //- 操作按钮
    div(:class="$style.actions")
      base-btn(:disabled="probing" @click="handleStart('quick')") {{ $t('setting__quality_probe_quick') }}
      base-btn(:disabled="probing" @click="handleStart('full')") {{ $t('setting__quality_probe_full') }}
      base-btn(v-if="probing && !aborted" @click="handleAbort") {{ $t('setting__quality_probe_abort') }}

    //- 进度
    .p(v-if="probing")
      span(:class="$style.progressText") {{ $t('setting__quality_probe_progress', { done: doneCount, total: totalCount }) }}
      span(:class="$style.elapsed") {{ elapsedLabel }}

    //- 汇总
    .p(v-if="summary && !probing")
      span(:class="$style.summaryText") {{ summaryText }}

    //- 明细
    div(v-if="summary" :class="$style.platformList")
      details(
        v-for="p in summary.platforms" :key="p.source" :class="$style.platform" open
      )
        summary(:class="$style.platformHead")
          span(:class="$style.platformName") {{ sourceName(p.source) }}
          span(:class="$style.platformStat")
            em(:class="p.passedCount > 0 ? $style.ok : $style.bad") {{ p.passedCount }}
            | /{{ p.declaredCount }} {{ $t('setting__quality_probe_passed') }}
          span(:class="$style.platformTime") {{ formatMs(p.totalMs) }}
        div(v-for="(e, i) in p.entries" :key="i" :class="$style.entry")
          div(:class="$style.entryLine")
            span(:class="$style.entryLabel") {{ e.qualityLabel }}
            span(:class="$style.entryMeta") {{ entryMeta(e) }}
            span(:class="[$style.entryStatus, $style[e.status]]") {{ statusIcon(e.status) }}
          div(v-if="e.reason" :class="$style.entryReason") {{ e.reason }}

    //- 样本歌配置
    h3#quality_probe_samples_title.gap-top {{ $t('setting__quality_probe_samples') }}
    div
      p(:class="$style.description") {{ $t('setting__quality_probe_samples_desc') }}
      div(:class="$style.sampleRow")
        base-input(:class="$style.sampleInput" :model-value="sampleLabel" :placeholder="$t('setting__quality_probe_sample_placeholder')" @update:model-value="handleSampleInput")

  user-api-modal(v-model="isShowUserApiModal")

</template>

<script>
import { ref, computed, onBeforeUnmount } from '@common/utils/vueTools'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { qualityList, userApi } from '@renderer/store'
import { runProbe } from '@renderer/core/qualityProbe'
import { useI18n } from '@renderer/plugins/i18n'
import apiSourceInfo from '@renderer/utils/musicSdk/api-source-info'
import UserApiModal from './UserApiModal.vue'
import { formatBytes, formatMs } from '@common/utils/qualityProbe'
import { getQualityLabelBySource, getQualityKeysBySource } from '@common/utils/qualityLabelBySource'

/** 支持音质选择的平台（与音源列表一致）。 */
const PROBE_SOURCES = ['wy', 'tx', 'kg', 'kw', 'mg']

const SOURCE_NAMES = {
  kw: '酷我',
  kg: '酷狗',
  tx: 'QQ音乐',
  wy: '网易云',
  mg: '咪咕',
}

export default {
  name: 'SettingQualityProbe',
  components: { UserApiModal },
  setup() {
    const t = useI18n()
    const isShowUserApiModal = ref(false)
    const probing = ref(false)
    const aborted = ref(false)
    const doneCount = ref(0)
    const totalCount = ref(0)
    const startedAt = ref(0)
    const elapsedTick = ref(0)
    const summary = ref(null)

    let controller = null
    let timer = null


    const sourceName = (src) => SOURCE_NAMES[src] ?? src

    /**
     * 当前音源的展示信息。
     *
     * name 保持插件作者写的原样（含 `[过期: ...]` 这类状态），
     * 只把版本号拆出来单独排版，避免出现 "vv9.0.0"。
     * 名字过长由 CSS 省略号处理，不在这里裁切。
     */
    const currentApi = computed(() => {
      const id = appSetting['common.apiSource']
      const item = (userApi.list ?? []).find(a => a.id === id)
      if (!item) {
        const builtin = ['kw', 'kg', 'tx', 'wy', 'mg'].includes(id)
        return {
          name: builtin ? `${sourceName(id)}（内置音源）` : String(id ?? ''),
          version: '',
        }
      }
      const rawVer = item.version ? String(item.version) : ''
      return {
        name: String(item.name ?? ''),
        version: rawVer ? (/^\d/.test(rawVer) ? `v${rawVer}` : rawVer) : '',
      }
    })

    /**
     * 音源列表：内置音源 + 已安装的自定义音源。
     * 从「基本设置」迁移过来，逻辑保持一致（含当前音源的连接状态标注）。
     */
    const getApiStatus = () => {
      let status
      if (userApi.status) status = t('setting__basic_source_status_success')
      else if (userApi.message == 'initing') status = t('setting__basic_source_status_initing')
      else status = `${t('setting__basic_source_status_failed')}`
      return status
    }
    const apiSources = computed(() => {
      return [
        ...apiSourceInfo.map(api => ({
          id: api.id,
          name: api.name,
          label: api.name,
          disabled: api.disabled,
        })),
        ...userApi.list.map(api => ({
          id: api.id,
          name: api.name,
          label: `${api.name}${api.id == appSetting['common.apiSource'] ? `[${getApiStatus()}]` : ''}`,
          desc: [/^\d/.test(api.version) ? `v${api.version}` : api.version].filter(Boolean).join(', '),
          statusLabel: api.id == appSetting['common.apiSource'] ? `[${getApiStatus()}]` : '',
          status: api.status,
          message: api.message,
          disabled: false,
        })),
      ]
    })

    const probeSources = PROBE_SOURCES

    /**
    /** 取某平台某档位的显示名（用 setup 里的 t，而不是模板 $t）。 */
    const qualityLabelOf = (src, quality) => getQualityLabelBySource(src, quality, t)

    /**
     * 某平台可选的音质档位。
     *
     * 直接取该平台的专属档位表（已是高 → 低顺序）。
     * 各平台档位数不同：网易云 6 档、QQ 8 档、酷狗 6 档、酷我/咪咕 4 档，
     * 因此不能套用统一列表。
     */
    const qualityOptionsFor = (src) => getQualityKeysBySource(src)

    /**
     * 该平台当前生效的优先音质。
     *
     * 平台专属值存在扁平键 `player.playQuality.<source>` 里；
     * 为空时回退全局 `player.playQuality`。
     */
    const playQualityOf = (src) => {
      const perSource = appSetting[`player.playQuality.${src}`]
      if (typeof perSource == 'string' && perSource) return perSource
      return appSetting['player.playQuality']
    }

    /**
     * 设置某平台的优先音质。
     *
     * 必须写成**单个原始类型键值**：主进程 mergeSetting 只接受
     * string/number/boolean/null，传对象会被静默丢弃（既不保存也不广播，
     * 界面因此不会更新）。这里只发一条 string。
     */
    const setPlayQuality = (src, quality) => {
      updateSetting({ [`player.playQuality.${src}`]: String(quality) })
    }

    const summaryText = computed(() => {
      if (!summary.value) return ''
      const s = summary.value
      return `${s.platformsWithPass}/${s.platformCount} ${'个平台有样本通过'} · ${formatMs(s.totalMs)}`
    })

    /** 计算本次计划的总档数（与 buildProbePlan 同规则，仅用于进度分母）。 */
    const calcTotal = (mode) => {
      const declared = qualityList.value ?? {}
      let n = 0
      for (const arr of Object.values(declared)) {
        if (!Array.isArray(arr) || !arr.length) continue
        n += mode === 'quick' ? 1 : arr.length
      }
      return n
    }

    const elapsedLabel = computed(() => {
      if (!probing.value) return ''
      const ms = Date.now() - startedAt.value + elapsedTick.value * 0
      return formatMs(ms)
    })

    /** 组合「文件大小 · 耗时」为单段文本，避免模板里出现孤立 template。 */
    const entryMeta = (e) => {
      const parts = []
      if (e.sizeBytes) parts.push(formatBytes(e.sizeBytes))
      const ms = formatMs(e.elapsedMs)
      if (ms) parts.push(ms)
      return parts.join(' · ')
    }

    const statusIcon = (status) => ({
      pass: '✅',
      unverified: '⚠️',
      fail: '❌',
      timeout: '⏱',
      'needs-manual': '❓',
      undeclared: '—',
    }[status] ?? '?')

    const sampleLabel = computed(() => String(appSetting['qualityProbe.sample'] ?? ''))

    /**
     * 保存样本歌。存成 `歌名 - 歌手` 的字符串。
     *
     * 必须是字符串：main 端 mergeSetting 只接受原始类型，
     * 对象会被丢弃（不保存、不广播，界面不更新）。
     */
    const handleSampleInput = (text) => {
      updateSetting({ 'qualityProbe.sample': String(text ?? '').trim() })
    }

    /**
     * 构造检测用的样本歌（全平台共用同一首）。
     *
     * 必须是**播放链路认得的 MusicInfo 结构**：
     * toOldMusicInfo() 从 `meta.songId` 取 songmid，若 meta 里没有 songId，
     * songmid 会变成 undefined，音源插件就抛「音乐 ID 不存在」。
     * source 先留空，由 runProbe 按当前探测的平台填入。
     */
    const buildSample = () => {
      const raw = String(appSetting['qualityProbe.sample'] ?? '').trim()
      if (!raw) return null
      // 形如「晴天 - 周杰伦」。第一段歌名，其后歌手。
      // 不带 ID：检测时会用该平台自己的搜索接口解析出真实 songmid。
      const idx = raw.indexOf('-')
      const name = idx > 0 ? raw.slice(0, idx).trim() : raw
      const singer = idx > 0 ? raw.slice(idx + 1).trim() : ''
      if (!name) return null
      return {
        id: name,
        name,
        singer,
        source: '',
        interval: '',
        meta: {
          // toOldMusicInfo 从 meta.songId 取 songmid，缺了会报「音乐 ID 不存在」
          songId: name,
          albumName: '',
          picUrl: '',
          _qualitys: {},
        },
      }
    }

    const handleStart = async(mode) => {
      if (probing.value) return
      const declared = qualityList.value ?? {}
      if (!Object.keys(declared).length) {
        summary.value = null
        totalCount.value = 0
        return
      }

      probing.value = true
      aborted.value = false
      summary.value = null
      doneCount.value = 0
      totalCount.value = calcTotal(mode)
      startedAt.value = Date.now()
      // 用局部变量持有本次的 controller；外层变量仅供「中止」按钮使用
      const myController = new AbortController()
      controller = myController

      // 计时器：让进度里的「用时」每 200ms 刷新
      timer = window.setInterval(() => { elapsedTick.value++ }, 200)

      try {
        const result = await runProbe(declared, mode, {
          timeoutMs: appSetting['qualityProbe.timeoutMs'] ?? 15000,
          intervalMs: appSetting['qualityProbe.intervalMs'] ?? 300,
          sample: buildSample(),
          declaredBySource: declared,
          signal: myController.signal,
          onProgress: ({ entry }) => {
            if (entry) doneCount.value++
          },
        })
        summary.value = result
      } catch (err) {
        if (String(err?.message) === 'aborted') aborted.value = true
        else console.error('[QualityProbe] failed:', err)
      } finally {
        if (timer) { clearInterval(timer); timer = null }
        probing.value = false
        if (controller === myController) controller = null
      }
    }

    const handleAbort = () => {
      controller?.abort()
    }

    onBeforeUnmount(() => {
      controller?.abort()
      if (timer) clearInterval(timer)
    })

    return {
      appSetting,
      updateSetting,
      isShowUserApiModal,
      apiSources,
      probing,
      aborted,
      doneCount,
      totalCount,
      summary,
      currentApi,
      probeSources,
      qualityOptionsFor,
      playQualityOf,
      setPlayQuality,
      qualityLabelOf,
      summaryText,
      elapsedLabel,
      sourceName,
      statusIcon,
      entryMeta,
      sampleLabel,
      handleSampleInput,
      handleStart,
      handleAbort,
      formatBytes,
      formatMs,
    }
  },
}
</script>

<style lang="less" module>
.description {
  font-size: 12px;
  opacity: 0.7;
  line-height: 1.6;
}

// 音质选择区块
.qualityBlock {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--color-150);
}

.qualityRow {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.qualitySrc {
  flex: 0 0 62px;
  font-size: 13px;
  opacity: 0.85;
}

.qualityOpts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

// base-btn 自带尺寸与边框，这里只压小一点，让五个平台并排时紧凑
.qualityOpt {
  flex: none;
  font-size: 12px;
  padding: 0 8px;
  height: 24px;
  min-width: 0;
}

.qualityOptActive {
  font-weight: 600;
}

// 与上方「音源选择」区块之间加分隔，避免两块内容粘在一起
.probeBlock {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--color-150);
}

.currentRow {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 13px;
  // 与上方描述、下方按钮都拉开，避免挤成一坨
  margin: 14px 0 10px;
  padding: 8px 10px;
  border-radius: 4px;
  background-color: var(--color-primary-light-800-alpha-600);
  box-shadow: inset 3px 0 0 var(--color-primary);

  .label {
    flex: none;
    opacity: 0.7;
  }
  .value {
    flex: 0 1 auto;
    min-width: 0;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ver {
    flex: none;
    font-size: 12px;
    opacity: 0.6;
  }
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.progressText,
.summaryText {
  font-size: 13px;
  font-weight: 600;
}

.elapsed {
  margin-left: 10px;
  font-size: 12px;
  opacity: 0.7;
}

.platformList {
  margin-top: 8px;
  border-top: 1px solid var(--color-100);
}

.platform {
  border-bottom: 1px solid var(--color-100);
  padding: 6px 0;

  .platformHead {
    display: flex;
    align-items: baseline;
    gap: 12px;
    cursor: pointer;
    font-size: 13px;
    padding: 6px 0;

    .platformName {
      flex: 1 1 auto;
      font-weight: 600;
    }
    .platformStat {
      flex: none;
      font-size: 12px;
      opacity: 0.75;
      em { font-style: normal; font-weight: 600; }
      em.ok { color: var(--color-primary); }
      em.bad { color: #e74c3c; }
    }
    .platformTime {
      flex: none;
      min-width: 52px;
      text-align: right;
      font-size: 12px;
      opacity: 0.5;
    }
  }

  .entry {
    padding: 5px 0 5px 14px;
    font-size: 12px;

    // 三列网格：档位名 | 大小·耗时 | 状态
    // 固定列宽，避免长档位名把后面两列挤乱；行与行之间也因此对齐
    .entryLine {
      display: grid;
      grid-template-columns: minmax(120px, 1.4fr) minmax(130px, 1fr) 28px;
      align-items: center;
      column-gap: 16px;
    }

    .entryLabel {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .entryMeta {
      opacity: 0.6;
      white-space: nowrap;
    }
    .entryStatus {
      justify-self: end;
      font-size: 13px;
      &.pass { color: var(--color-primary); }
      &.unverified { color: #e7aa36; }
      &.fail { color: #e74c3c; }
      &.timeout { color: #e7aa36; }
      &.needs-manual { color: #4baed5; }
      // 未声明：灰掉，视觉上明显区别于「失败」
      &.undeclared { color: var(--color-font-label); opacity: 0.5; }
    }
    .entryReason {
      margin-top: 4px;
      padding: 3px 8px;
      border-radius: 3px;
      background-color: rgba(231, 76, 60, 0.08);
      opacity: 0.75;
      font-size: 11px;
      line-height: 1.5;
      word-break: break-word;
    }
  }
}

.sourceLabel {
  display: flex;
  align-items: center;
  gap: 6px;
}

.desc {
  font-size: 12px;
  opacity: 0.6;
}

.status {
  font-size: 12px;
  color: var(--color-primary);
}

.sampleRow {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;

  .sampleSrc {
    min-width: 70px;
    font-size: 13px;
  }
  .sampleInput {
    flex: 1;
  }
}
</style>
