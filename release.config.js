module.exports = {
  branches: ["main"],
  dryRun: false,
  plugins: [
    ["@semantic-release/commit-analyzer", {
      preset: "angular",
      releaseRules: [
        { type: "feat", release: "minor" },
        { type: "fix", release: "patch" },
        { type: "perf", release: "patch" },
      ],
    }],
    "@semantic-release/github",
  ],
}
