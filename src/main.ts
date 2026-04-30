import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as exec from '@actions/exec';
import * as github from '@actions/github';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

const LATEST_FALLBACK_VERSION = '1.7.12';

interface Platform {
    os: string;
    arch: string;
    assetSuffix: string;
}

export function getPlatform(): Platform {
    const platform = process.platform;
    const arch = process.arch;

    let osName: string;
    let archName: string;
    let assetSuffix: string;

    switch (platform) {
    case 'linux':
        osName = 'Linux';
        break;
    case 'darwin':
        osName = 'Darwin';
        break;
    case 'win32':
        osName = 'Windows';
        break;
    default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    switch (arch) {
    case 'x64':
        archName = 'x86_64';
        break;
    case 'arm64':
        archName = 'arm64';
        break;
    default:
        throw new Error(`Unsupported architecture: ${arch}`);
    }

    assetSuffix = `${osName}_${archName}`;

    return { os: osName, arch: archName, assetSuffix };
}

export async function getLatestVersion(): Promise<string> {
    const token = core.getInput('github-token', { required: false }) || process.env.GITHUB_TOKEN;

    try {
        let tag: string;
        if (token) {
            const octokit = github.getOctokit(token);
            const { data: release } = await octokit.rest.repos.getLatestRelease({
                owner: 'rhysd',
                repo: 'actionlint',
            });
            tag = release.tag_name;
        } else {
            const response = await fetch('https://api.github.com/repos/rhysd/actionlint/releases/latest');
            if (!response.ok) {
                throw new Error(`GitHub API returned ${response.status}`);
            }
            const data = await response.json() as { tag_name: string };
            tag = data.tag_name;
        }

        const version = tag.replace(/^v/, '');
        core.info(`Latest actionlint release: ${version}`);
        return version;
    } catch (error) {
        core.warning('Failed to fetch latest release from GitHub API. Falling back to hardcoded version.');
        core.warning('Consider providing a github-token or setting GITHUB_TOKEN for reliable latest version resolution.');
        return LATEST_FALLBACK_VERSION;
    }
}

export async function downloadActionlint(version: string): Promise<string> {
    const platform = getPlatform();
    const toolName = 'actionlint';
    const binaryName = process.platform === 'win32' ? 'actionlint.exe' : 'actionlint';

    // Check cache first
    const cachedPath = tc.find(toolName, version, platform.arch);
    if (cachedPath) {
        core.info(`Found cached actionlint ${version} at ${cachedPath}`);
        return path.join(cachedPath, binaryName);
    }

    core.info(`Downloading actionlint ${version} for ${platform.assetSuffix}...`);

    const baseUrl = `https://github.com/rhysd/actionlint/releases/download/v${version}`;
    const tarballName = `actionlint_${version}_${platform.assetSuffix}.tar.gz`;
    const checksumsName = `actionlint_${version}_checksums.txt`;

    const tarballUrl = `${baseUrl}/${tarballName}`;
    const checksumsUrl = `${baseUrl}/${checksumsName}`;

    // Download checksums first (small file)
    const checksumsPath = await tc.downloadTool(checksumsUrl);
    const checksumsContent = fs.readFileSync(checksumsPath, 'utf8');

    // Find the expected SHA256 for our tarball
    const expectedSha = extractChecksum(checksumsContent, tarballName);
    if (!expectedSha) {
        throw new Error(`Could not find checksum for ${tarballName} in ${checksumsName}`);
    }

    // Download the tarball
    const tarballPath = await tc.downloadTool(tarballUrl);

    // Verify checksum
    const actualSha = await calculateSha256(tarballPath);
    if (actualSha !== expectedSha) {
        throw new Error(
            `Checksum mismatch for ${tarballName}!\n` +
            `Expected: ${expectedSha}\n` +
            `Actual:   ${actualSha}`,
        );
    }
    core.info('✓ Checksum verified successfully');

    // Extract
    const extractDir = await tc.extractTar(tarballPath);

    // Find the binary inside the tarball (it's usually in the root of the tar)
    const binaryPath = path.join(extractDir, binaryName);

    if (!fs.existsSync(binaryPath)) {
        throw new Error(`Binary not found at expected location: ${binaryPath}`);
    }

    // Cache it
    const cachedDir = await tc.cacheDir(extractDir, toolName, version, platform.arch);
    core.info(`Cached actionlint ${version} to ${cachedDir}`);

    return path.join(cachedDir, binaryName);
}

export function extractChecksum(checksumsContent: string, filename: string): string | null {
    const lines = checksumsContent.split('\n');
    for (const line of lines) {
        const [sha, file] = line.trim().split(/\s+/);
        if (file === filename) {
            return sha;
        }
    }
    return null;
}

export async function calculateSha256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

export function parseFlags(): string[] {
    const flags: string[] = [];

    const ignore = core.getInput('ignore', { required: false });
    if (ignore) {
        const patterns = ignore.split('\n').filter((p) => p.trim() !== '');
        for (const pattern of patterns) {
            flags.push('-ignore', pattern.trim());
        }
    }

    const shellcheck = core.getInput('shellcheck', { required: false });
    if (shellcheck !== 'shellcheck') {
        flags.push('-shellcheck', shellcheck);
    }

    const pyflakes = core.getInput('pyflakes', { required: false });
    if (pyflakes !== 'pyflakes') {
        flags.push('-pyflakes', pyflakes);
    }

    if (core.getBooleanInput('oneline', { required: false })) {
        flags.push('-oneline');
    }

    const format = core.getInput('format', { required: false });
    if (format) {
        flags.push('-format', format);
    }

    const configFile = core.getInput('config-file', { required: false });
    if (configFile) {
        flags.push('-config-file', configFile);
    }

    if (core.getBooleanInput('no-color', { required: false })) {
        flags.push('-no-color');
    }

    if (core.getBooleanInput('color', { required: false })) {
        flags.push('-color');
    }

    if (core.getBooleanInput('verbose', { required: false })) {
        flags.push('-verbose');
    }

    if (core.getBooleanInput('debug', { required: false })) {
        flags.push('-debug');
    }

    const stdinFilename = core.getInput('stdin-filename', { required: false });
    if (stdinFilename) {
        flags.push('-stdin-filename', stdinFilename);
    }

    const files = core.getInput('files', { required: false });
    if (files) {
        const fileArgs = files.split(/\s+/).filter((f) => f !== '');
        flags.push(...fileArgs);
    }

    return flags;
}

export async function run(): Promise<void> {
    try {
        let version = core.getInput('version', { required: false });
        if (!version) {
            version = await getLatestVersion();
            core.info(`No version specified — resolved latest release: ${version}`);
        }

        const workingDir = core.getInput('working-directory', { required: false }) || process.env.GITHUB_WORKSPACE || '.';

        core.info(`Using working directory: ${workingDir}`);

        const actionlintPath = await downloadActionlint(version);

        // Make sure it's executable (on Unix)
        if (process.platform !== 'win32') {
            fs.chmodSync(actionlintPath, 0o755);
        }

        const flags = parseFlags();

        core.info(`Running actionlint ${version} with flags: ${flags.join(' ')}`);

        const exitCode = await exec.exec(actionlintPath, flags, {
            cwd: workingDir,
            ignoreReturnCode: true,
        });

        if (exitCode !== 0) {
            core.setFailed(`actionlint found issues (exit code ${exitCode})`);
        } else {
            core.info('✓ All workflow files passed actionlint checks');
        }
    } catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        } else {
            core.setFailed('Unknown error occurred while running actionlint');
        }
    }
}

run();
