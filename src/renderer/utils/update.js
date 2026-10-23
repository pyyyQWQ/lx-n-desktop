import { httpGet } from './request'
import pkg from '../../../package.json'
// 更新源地址清单在 @common/config 的 getUpdateFeedAddress() 中定义（便于测试断言）。
import { updateFeedEnabled, getUpdateFeedAddress } from '@common/config'

// TODO add Notice

// 更新源仅指向独立版 LX-N 自己的仓库，不再使用原版 lx-music-desktop 的任何发布渠道。
// 只保留 github 源站（raw.githubusercontent.com）：能用梯子访问 GitHub 的用户能读到正确版本；
// 访问不了 GitHub 的用户会获取失败（显示「获取最新版本信息失败」），而不会 fallback 到 jsdelivr 等 CDN ——
// 那些 CDN 可能缓存了旧的原版内容（如 2.12.6），会导致无法访问 GitHub 的用户被错误提示原版版本。
const address = getUpdateFeedAddress()

const request = async(url, retryNum = 0) => {
  return new Promise((resolve, reject) => {
    httpGet(url, {
      timeout: 10000,
    }, (err, resp, body) => {
      if (err || resp.statusCode != 200) {
        ++retryNum >= 3
          ? reject(err || new Error(resp.statusMessage || resp.statusCode))
          : request(url, retryNum).then(resolve).catch(reject)
      } else resolve(body)
    })
  })
}

const getDirectInfo = async(url) => {
  return request(url).then(info => {
    if (info.version == null) throw new Error('failed')
    return info
  })
}

export const getVersionInfo = async(index = 0) => {
  if (!updateFeedEnabled) return { version: pkg.version, desc: '', history: [] }
  const [url, source] = address[index]
  let promise
  switch (source) {
    case 'direct':
      promise = getDirectInfo(url)
      break
    default:
      throw new Error('unsupported')
  }

  return promise.catch(async(err) => {
    index++
    if (index >= address.length) throw err
    return getVersionInfo(index)
  })
}

// getVersionInfo().then(info => {
//   console.log(info)
// })
