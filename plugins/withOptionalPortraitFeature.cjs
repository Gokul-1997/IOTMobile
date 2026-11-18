const { withAndroidManifest } = require('expo/config-plugins');

// Retain the phone's portrait layout without filtering out other device types.
// https://developer.android.com/guide/topics/manifest/uses-feature-element#screen-hw-features
module.exports = function withOptionalPortraitFeature(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const name = 'android.hardware.screen.portrait';
    const features = manifest['uses-feature'] ?? [];
    const matches = features.filter((feature) => feature.$['android:name'] === name);

    if (matches.length) {
      for (const feature of matches) {
        feature.$['android:required'] = 'false';
      }
    } else {
      features.push({ $: { 'android:name': name, 'android:required': 'false' } });
    }

    manifest['uses-feature'] = features;
    return config;
  });
};
