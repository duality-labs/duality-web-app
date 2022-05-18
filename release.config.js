/**
 * config for Semantic Release workflow
 * docs: https://github.com/semantic-release/semantic-release/blob/master/docs/usage/configuration.md#configuration
 **/

module.exports = {
  branches: ["main"],
  dryRun: false,
  plugins: [
    ["@semantic-release/commit-analyzer", {
      preset: "angular",
      // see default rules: https://github.com/semantic-release/commit-analyzer/blob/master/lib/default-release-rules.js
      releaseRules: [
        { type: "feat", release: "minor" },
        { type: "fix", release: "patch" },
        { type: "perf", release: "patch" },
      ],
    }],
    [
      "@semantic-release/release-notes-generator",
      {
        preset: "conventionalcommits",
        presetConfig: {
          types: [
            { type: "feat", section: "Features" },
            { type: "fix", section: "Fixes" },
            { type: "chore", hidden: false, section: "Other" },
            { type: "docs", hidden: false, section: "Other" },
            { type: "style", hidden: false, section: "Other" },
            { type: "refactor", hidden: false, section: "Other" },
            { type: "perf", hidden: false, section: "Other" },
            { type: "revert", hidden: false, section: "Other "},
            { type: "test", hidden: false, section: "Other "},
            { type: "build", hidden: false, section: "Other" },
            { type: "ci", hidden: true },
          ],
        },
      },
    ],
    [
      "@semantic-release/changelog",
      {
        changelogFile: "CHANGELOG.md",
        changelogTitle: "# Changelog",
      },
    ],
    [
      "@semantic-release/git",
      {
        assets: [
          "CHANGELOG.md",
          "package.json",
          "package-lock.json",
        ],
        message: "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
    "@semantic-release/github",
  ],
}
