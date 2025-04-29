const { override, addWebpackAlias, addWebpackResolve } = require('customize-cra');
const path = require('path');

module.exports = override(
  // 添加 resolve.fallback 配置
  addWebpackResolve({
    fallback: {
      // 告诉 Webpack 在浏览器环境中 stream 模块是不可用的 (设为 false)
      "stream": false,
      // 其他 Node.js 核心模块，如果遇到类似错误，也设为 false
      "path": false,
      "os": false,
      "crypto": false,
      "fs": false,
      "child_process": false,
      "util": false,
      "http": false, // 如果需要
      "https": false, // 如果需要
      "zlib": false, // 如果需要
      "url": false, // 如果需要
      "assert": false // 如果需要
    }
  }),

  // 如果你需要别名或其他配置，可以在这里添加
  // addWebpackAlias({
  //   ["@components"]: path.resolve(__dirname, "src/components")
  // })
); 