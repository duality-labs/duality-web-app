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
    "@semantic-release/github",
  ],
}
