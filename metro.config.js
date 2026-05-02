const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

config.resolver.blockList = [/.*\.test\.[jt]sx?$/]

module.exports = config
