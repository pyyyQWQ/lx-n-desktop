// 网易云官方域名判定（阶段 B2 安全边界）——renderer 侧复用 common 实现。
// 逻辑集中在 src/common/utils/neteaseDomain.ts，避免两端重复维护。
import { isNeteaseMusicUrl, shouldInjectWyCookie } from '@common/utils/neteaseDomain'

export { isNeteaseMusicUrl, shouldInjectWyCookie }
export default {
  isNeteaseMusicUrl,
  shouldInjectWyCookie,
}
