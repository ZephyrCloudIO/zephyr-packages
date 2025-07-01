/**
 * Debug adapter to test ES Module exports for Next.js
 */

console.log('🚀 DEBUG ADAPTER: Module loaded!')

const debugAdapter = {
  name: 'debug-adapter',
  
  modifyConfig: (config) => {
    console.log('🔧 DEBUG ADAPTER: modifyConfig called!')
    config.output = 'standalone'
    return config
  },
  
  onBuildComplete: (ctx) => {
    console.log('🎯 DEBUG ADAPTER: onBuildComplete called!')
    console.log('🎯 OUTPUTS:', ctx.outputs.length)
  }
}

console.log('🚀 DEBUG ADAPTER: Exporting adapter:', debugAdapter)
export default debugAdapter