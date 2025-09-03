const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration for FieldSync React Native
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  resolver: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@screens': path.resolve(__dirname, 'src/screens'),
      '@services': path.resolve(__dirname, 'services'),
      '@modules': path.resolve(__dirname, 'modules'),
      '@context': path.resolve(__dirname, 'context'),
      '@utils': path.resolve(__dirname, 'utils'),
      '@types': path.resolve(__dirname, 'src/types'),
    },
    // Add support for TypeScript absolute imports
    platforms: ['ios', 'android', 'native', 'web'],
  },
  transformer: {
    // Enable inline requires for performance
    inlineRequires: true,
    // Transformer options for TensorFlow.js and ML libraries
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  server: {
    // Server configuration
    port: 8081,
  },
  watchFolders: [
    // Watch additional folders if needed
    path.resolve(__dirname, '../backend'),
  ],
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
