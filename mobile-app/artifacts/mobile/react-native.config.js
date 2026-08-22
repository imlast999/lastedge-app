const path = require('path');

function resolvePackageRoot(pkgName) {
  try {
    return path.dirname(require.resolve(`${pkgName}/package.json`, { paths: [__dirname] }));
  } catch (e) {
    return null;
  }
}

module.exports = {
  dependencies: {
    '@react-native-async-storage/async-storage': {
      root: resolvePackageRoot('@react-native-async-storage/async-storage'),
    },
    'react-native-gesture-handler': {
      root: resolvePackageRoot('react-native-gesture-handler'),
    },
    'react-native-keyboard-controller': {
      root: resolvePackageRoot('react-native-keyboard-controller'),
    },
    'react-native-reanimated': {
      root: resolvePackageRoot('react-native-reanimated'),
    },
    'react-native-safe-area-context': {
      root: resolvePackageRoot('react-native-safe-area-context'),
    },
    'react-native-screens': {
      root: resolvePackageRoot('react-native-screens'),
    },
    'react-native-svg': {
      root: resolvePackageRoot('react-native-svg'),
    },
    'react-native-worklets': {
      root: resolvePackageRoot('react-native-worklets'),
    },
  },
};
