const { withAppBuildGradle } = require('expo/config-plugins');

// react-native-android-widget uses androidx.work:work-runtime 2.8.1, while another dependency
// pulls in work-runtime-ktx 2.7.1. Since 2.8 the ktx classes live in work-runtime itself, so the
// old ktx artifact duplicates them and :app:checkDebugDuplicateClasses fails. Declaring ktx at
// 2.8.1 makes Gradle resolve it to the matching (empty) version.
const LINE = 'implementation("androidx.work:work-runtime-ktx:2.8.1")';

module.exports = function withWorkManagerFix(config) {
  return withAppBuildGradle(config, cfg => {
    if (!cfg.modResults.contents.includes(LINE)) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /dependencies\s*\{/,
        match => `${match}\n    // Added by plugins/withWorkManagerFix.js\n    ${LINE}\n`
      );
    }
    return cfg;
  });
};
