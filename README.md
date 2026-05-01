<!-- markdownlint-disable -->
<div align="center">

# actionlint GitHub Action

Lint your GitHub Actions workflow files using the official [actionlint](https://github.com/rhysd/actionlint) binary. This action downloads the release binary directly from the upstream repository, verifies its SHA256 checksum, and caches it for subsequent runs.

<!-- markdownlint-restore -->
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/nicholas-fedor/actionlint-action/badge)](https://scorecard.dev/viewer/?uri=github.com/nicholas-fedor/actionlint-action)
[![CircleCI](https://dl.circleci.com/status-badge/img/gh/nicholas-fedor/actionlint-action/tree/main.svg?style=shield)](https://dl.circleci.com/status-badge/redirect/gh/nicholas-fedor/actionlint-action/tree/main)
[![codecov](https://codecov.io/gh/nicholas-fedor/actionlint-action/graph/badge.svg?token=A60MVF46VX)](https://codecov.io/gh/nicholas-fedor/actionlint-action)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/31b33e083b1c48e0af7564d6fce1a78c)](https://app.codacy.com/gh/nicholas-fedor/actionlint-action/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)
![GitHub Tag](https://img.shields.io/github/v/tag/nicholas-fedor/actionlint-action)
![GitHub License](https://img.shields.io/github/license/nicholas-fedor/actionlint-action)
</div>

## Quick Start

```yaml
- name: Run actionlint
  uses: nicholas-fedor/actionlint-action@78fd91fa48051abcbeac14c695a0921b0a71e9a1
```

Pin a specific version with Renovate/Dependabot support:

```yaml
- name: Run actionlint
  uses: nicholas-fedor/actionlint-action@78fd91fa48051abcbeac14c695a0921b0a71e9a1
  with:
    version: "1.7.12"  # renovate: datasource=github-releases depName=rhysd/actionlint
```

## Examples

### Ignore specific errors

```yaml
- name: Run actionlint
  uses: nicholas-fedor/actionlint-action@78fd91fa48051abcbeac14c695a0921b0a71e9a1
  with:
    ignore: |
      'shellcheck reported issue in this script: SC2086:.+'
      'the runner of ".+" action is too old'
```

### Lint specific workflow files

```yaml
- name: Lint specific workflows
  uses: nicholas-fedor/actionlint-action@78fd91fa48051abcbeac14c695a0921b0a71e9a1
  with:
    files: ".github/workflows/ci.yml .github/workflows/release.yml"
```

### Custom config file and disabled pyflakes

```yaml
- name: Run actionlint
  uses: nicholas-fedor/actionlint-action@78fd91fa48051abcbeac14c695a0921b0a71e9a1
  with:
    config-file: ".config/actionlint.yaml"
    pyflakes: ""
    verbose: "true"
```

### Read workflow from stdin

```yaml
- name: Lint generated workflow
  uses: nicholas-fedor/actionlint-action@78fd91fa48051abcbeac14c695a0921b0a71e9a1
  with:
    files: "-"
    stdin-filename: "generated.yml"
```

## Inputs

| Input               | Description                                                                                                       | Required | Default             |
|---------------------|-------------------------------------------------------------------------------------------------------------------|----------|---------------------|
| `version`           | actionlint version to use (e.g. `"1.7.12"`). Empty/omitted = auto-resolve the latest release.                     | No       | `""` (latest)       |
| `working-directory` | Directory to run actionlint from.                                                                                 | No       | `$GITHUB_WORKSPACE` |
| `github-token`      | GitHub token for querying the API for the latest release. Falls back to `GITHUB_TOKEN` or anonymous.              | No       | `""`                |
| `ignore`            | Regex patterns to ignore in error messages. Multiple patterns separated by newlines.                              | No       | `""`                |
| `shellcheck`        | Command name or path to `shellcheck`. Set to `""` to disable shellcheck integration.                              | No       | `"shellcheck"`      |
| `pyflakes`          | Command name or path to `pyflakes`. Set to `""` to disable pyflakes integration.                                  | No       | `"pyflakes"`        |
| `oneline`           | Output one line per error.                                                                                        | No       | `"false"`           |
| `format`            | Custom Go template for error formatting. [Template docs](https://github.com/rhysd/actionlint#user-content-format) | No       | `""`                |
| `config-file`       | Explicit path to actionlint config file. Overrides auto-discovery.                                                | No       | `""`                |
| `no-color`          | Disable colorful output.                                                                                          | No       | `"false"`           |
| `color`             | Force colorful output even without a TTY.                                                                         | No       | `"false"`           |
| `verbose`           | Enable verbose log output.                                                                                        | No       | `"false"`           |
| `debug`             | Enable debug output.                                                                                              | No       | `"false"`           |
| `stdin-filename`    | File name used when reading from stdin (`-`).                                                                     | No       | `""`                |
| `files`             | Workflow file paths to lint (whitespace-separated). Use `-` for stdin. Empty = auto-discover.                     | No       | `""`                |

## Configuration File

actionlint automatically reads `.github/actionlint.yaml` or `.github/actionlint.yml` from your repository. You can also specify a custom path with the `config-file` input. See the [actionlint config documentation](https://github.com/rhysd/actionlint/blob/main/docs/config.md) for supported options:

- **`self-hosted-runner.labels`** — label name patterns for self-hosted runners
- **`config-variables`** — whitelist of allowed `vars` references
- **`paths.{pattern}.ignore`** — per-path ignore patterns (glob syntax)

## How It Works

1. Determines the runner's OS and architecture
2. Checks the tool cache for a previously downloaded binary
3. Downloads the release tarball and checksums from GitHub
4. Verifies the SHA256 checksum (fails the action on mismatch)
5. Extracts and caches the binary
6. Assembles CLI arguments from the provided inputs
7. Runs `actionlint` and fails the action if issues are found

## License

MIT - See the [LICENSE.md](LICENSE.md) file.
