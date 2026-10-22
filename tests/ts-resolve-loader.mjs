// 极简 ESM loader：让 Node 直接用 --experimental-strip-types 运行测试时，
// 把源码内无后缀的 .ts 相对导入解析为同名 .ts 文件（与 webpack bundler 解析对齐）。
export async function resolve(specifier, context, nextResolve) {
  // 仅处理相对导入且指向不存在文件的情况，尝试追加 .ts 解析。
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    try {
      return await nextResolve(specifier, context)
    } catch (_) {
      // 尝试 .ts 后缀（若原 specifier 无扩展名）
      if (!/\.\w+$/.test(specifier)) {
        try {
          return await nextResolve(specifier + '.ts', context)
        } catch (_) {}
      }
      throw _
    }
  }
  return nextResolve(specifier, context)
}