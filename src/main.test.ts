import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as exec from '@actions/exec';
import * as github from '@actions/github';
import * as path from 'path';
import * as fs from 'fs';
import { Readable } from 'stream';
import * as crypto from 'crypto';
import {
    getPlatform,
    extractChecksum,
    calculateSha256,
    getLatestVersion,
    downloadActionlint,
    parseFlags,
} from './main';

jest.mock('@actions/core');
jest.mock('@actions/tool-cache');
jest.mock('@actions/exec');
jest.mock('@actions/github');

jest.mock('fs', () => {
    const actual = jest.requireActual<typeof fs>('fs');
    return {
        ...actual,
        readFileSync: jest.fn(),
        existsSync: jest.fn(),
        createReadStream: jest.fn(),
    };
});

const mockedCore = core as jest.Mocked<typeof core>;
const mockedTc = tc as jest.Mocked<typeof tc>;
const mockedExec = exec as jest.Mocked<typeof exec>;
const mockedGithub = github as jest.Mocked<typeof github>;
const mockedFs = fs as jest.Mocked<typeof fs>;

function createMockStream(data: Buffer | string): Readable {
    return new Readable({
        read() {
            this.push(data);
            this.push(null);
        },
    });
}

describe('getPlatform', () => {
    const originalPlatform = process.platform;
    const originalArch = process.arch;

    afterEach(() => {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
        Object.defineProperty(process, 'arch', { value: originalArch });
    });

    const setPlatform = (platformVal: string, archVal: string) => {
        Object.defineProperty(process, 'platform', { value: platformVal });
        Object.defineProperty(process, 'arch', { value: archVal });
    };

    it('returns Linux x86_64 for linux x64', () => {
        setPlatform('linux', 'x64');
        expect(getPlatform()).toEqual({
            os: 'Linux',
            arch: 'x86_64',
            assetSuffix: 'Linux_x86_64',
        });
    });

    it('returns Linux arm64 for linux arm64', () => {
        setPlatform('linux', 'arm64');
        expect(getPlatform()).toEqual({
            os: 'Linux',
            arch: 'arm64',
            assetSuffix: 'Linux_arm64',
        });
    });

    it('returns Darwin x86_64 for darwin x64', () => {
        setPlatform('darwin', 'x64');
        expect(getPlatform()).toEqual({
            os: 'Darwin',
            arch: 'x86_64',
            assetSuffix: 'Darwin_x86_64',
        });
    });

    it('returns Darwin arm64 for darwin arm64', () => {
        setPlatform('darwin', 'arm64');
        expect(getPlatform()).toEqual({
            os: 'Darwin',
            arch: 'arm64',
            assetSuffix: 'Darwin_arm64',
        });
    });

    it('returns Windows x86_64 for win32 x64', () => {
        setPlatform('win32', 'x64');
        expect(getPlatform()).toEqual({
            os: 'Windows',
            arch: 'x86_64',
            assetSuffix: 'Windows_x86_64',
        });
    });

    it('returns Windows arm64 for win32 arm64', () => {
        setPlatform('win32', 'arm64');
        expect(getPlatform()).toEqual({
            os: 'Windows',
            arch: 'arm64',
            assetSuffix: 'Windows_arm64',
        });
    });

    it('throws for unsupported platform', () => {
        Object.defineProperty(process, 'platform', { value: 'freebsd' });
        Object.defineProperty(process, 'arch', { value: 'x64' });
        expect(() => getPlatform()).toThrow('Unsupported platform: freebsd');
    });

    it('throws for unsupported architecture', () => {
        Object.defineProperty(process, 'platform', { value: 'linux' });
        Object.defineProperty(process, 'arch', { value: 'ia32' });
        expect(() => getPlatform()).toThrow('Unsupported architecture: ia32');
    });
});

describe('extractChecksum', () => {
    it('extracts checksum for matching filename', () => {
        const checksums =
            'abc123def456 actionlint_1.7.12_Linux_x86_64.tar.gz\n' +
            '789ghi012jkl actionlint_1.7.12_Darwin_arm64.tar.gz';
        expect(extractChecksum(checksums, 'actionlint_1.7.12_Linux_x86_64.tar.gz')).toBe('abc123def456');
    });

    it('extracts checksum for a different matching filename', () => {
        const checksums =
            'abc123def456 actionlint_1.7.12_Linux_x86_64.tar.gz\n' +
            '789ghi012jkl actionlint_1.7.12_Darwin_arm64.tar.gz';
        expect(extractChecksum(checksums, 'actionlint_1.7.12_Darwin_arm64.tar.gz')).toBe('789ghi012jkl');
    });

    it('returns null when filename not found', () => {
        const checksums =
            'abc123def456 actionlint_1.7.12_Linux_x86_64.tar.gz';
        expect(extractChecksum(checksums, 'nonexistent.tar.gz')).toBeNull();
    });

    it('returns null for empty content', () => {
        expect(extractChecksum('', 'actionlint_1.7.12_Linux_x86_64.tar.gz')).toBeNull();
    });

    it('handles extra whitespace between checksum and filename', () => {
        const checksums = 'abc123def456    actionlint_1.7.12_Linux_x86_64.tar.gz';
        expect(extractChecksum(checksums, 'actionlint_1.7.12_Linux_x86_64.tar.gz')).toBe('abc123def456');
    });

    it('handles trailing newline', () => {
        const checksums = 'abc123def456 actionlint_1.7.12_Linux_x86_64.tar.gz\n';
        expect(extractChecksum(checksums, 'actionlint_1.7.12_Linux_x86_64.tar.gz')).toBe('abc123def456');
    });

    it('handles multiple entries and picks the correct one', () => {
        const checksums =
            'aaa111 actionlint_1.7.12_Linux_x86_64.tar.gz\n' +
            'bbb222 actionlint_1.7.12_Linux_arm64.tar.gz\n' +
            'ccc333 actionlint_1.7.12_Darwin_x86_64.tar.gz\n' +
            'ddd444 actionlint_1.7.12_Darwin_arm64.tar.gz\n' +
            'eee555 actionlint_1.7.12_Windows_x86_64.tar.gz';
        expect(extractChecksum(checksums, 'actionlint_1.7.12_Darwin_arm64.tar.gz')).toBe('ddd444');
    });

    it('does not match partial filenames', () => {
        const checksums = 'abc123 actionlint_1.7.12_Linux_x86_64.tar.gz';
        expect(extractChecksum(checksums, 'actionlint_1.7.12_Linux_x86_64')).toBeNull();
    });
});

describe('calculateSha256', () => {
    const tmpFile = path.join(__dirname, 'test-sha256.tmp');
    const actualCreateReadStream = jest.requireActual<typeof fs>('fs').createReadStream;
    const actualExistsSync = jest.requireActual<typeof fs>('fs').existsSync;

    beforeEach(() => {
        (mockedFs.createReadStream as jest.Mock).mockRestore();
    });

    afterEach(() => {
        if (actualExistsSync(tmpFile)) {
            fs.unlinkSync(tmpFile);
        }
    });

    it('calculates correct SHA256 for file content', async () => {
        const content = 'hello world';
        fs.writeFileSync(tmpFile, content);
        (mockedFs.createReadStream as jest.Mock).mockImplementation(actualCreateReadStream);
        const expected = crypto.createHash('sha256').update(content).digest('hex');
        await expect(calculateSha256(tmpFile)).resolves.toBe(expected);
    });

    it('calculates correct SHA256 for empty file', async () => {
        fs.writeFileSync(tmpFile, '');
        (mockedFs.createReadStream as jest.Mock).mockImplementation(actualCreateReadStream);
        const expected = crypto.createHash('sha256').update('').digest('hex');
        await expect(calculateSha256(tmpFile)).resolves.toBe(expected);
    });

    it('rejects for non-existent file', async () => {
        (mockedFs.createReadStream as jest.Mock).mockImplementation(actualCreateReadStream);
        await expect(calculateSha256('/nonexistent/path/file.tar.gz')).rejects.toThrow();
    });

    it('calculates consistent hashes for same content', async () => {
        fs.writeFileSync(tmpFile, 'test content for consistency');
        (mockedFs.createReadStream as jest.Mock).mockImplementation(actualCreateReadStream);
        const hash1 = await calculateSha256(tmpFile);
        const hash2 = await calculateSha256(tmpFile);
        expect(hash1).toBe(hash2);
    });

    it('calculates different hashes for different content', async () => {
        (mockedFs.createReadStream as jest.Mock).mockImplementation(actualCreateReadStream);
        fs.writeFileSync(tmpFile, 'content one');
        const hash1 = await calculateSha256(tmpFile);
        fs.writeFileSync(tmpFile, 'content two');
        const hash2 = await calculateSha256(tmpFile);
        expect(hash1).not.toBe(hash2);
    });
});

describe('getLatestVersion', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        jest.resetAllMocks();
        mockedCore.getInput.mockReturnValue('');
        delete process.env.GITHUB_TOKEN;
        globalThis.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('returns version from latest release via fetch when no token', async () => {
        (globalThis.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ tag_name: 'v1.7.12' }),
        });
        await expect(getLatestVersion()).resolves.toBe('1.7.12');
        expect(globalThis.fetch).toHaveBeenCalledWith(
            'https://api.github.com/repos/rhysd/actionlint/releases/latest',
        );
        expect(mockedGithub.getOctokit).not.toHaveBeenCalled();
    });

    it('strips leading v from tag', async () => {
        (globalThis.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ tag_name: 'v2.0.0' }),
        });
        await expect(getLatestVersion()).resolves.toBe('2.0.0');
    });

    it('handles version without leading v', async () => {
        (globalThis.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ tag_name: '1.7.12' }),
        });
        await expect(getLatestVersion()).resolves.toBe('1.7.12');
    });

    it('falls back to hardcoded version on fetch failure', async () => {
        (globalThis.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            status: 403,
        });
        await expect(getLatestVersion()).resolves.toBe('1.7.12');
        expect(mockedCore.warning).toHaveBeenCalledWith(
            'Failed to fetch latest release from GitHub API. Falling back to hardcoded version.',
        );
    });

    it('falls back to hardcoded version on fetch network error', async () => {
        (globalThis.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
        await expect(getLatestVersion()).resolves.toBe('1.7.12');
    });

    it('uses github-token input when provided', async () => {
        mockedCore.getInput.mockReturnValue('my-test-token');
        const mockOctokit = {
            rest: {
                repos: {
                    getLatestRelease: jest.fn().mockResolvedValue({
                        data: { tag_name: 'v1.7.12' },
                    }),
                },
            },
        };
        mockedGithub.getOctokit.mockReturnValue(mockOctokit as never);
        await getLatestVersion();
        expect(mockedGithub.getOctokit).toHaveBeenCalledWith('my-test-token');
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('uses GITHUB_TOKEN env var when input not provided', async () => {
        mockedCore.getInput.mockReturnValue('');
        process.env.GITHUB_TOKEN = 'env-token';
        const mockOctokit = {
            rest: {
                repos: {
                    getLatestRelease: jest.fn().mockResolvedValue({
                        data: { tag_name: 'v1.7.12' },
                    }),
                },
            },
        };
        mockedGithub.getOctokit.mockReturnValue(mockOctokit as never);
        await getLatestVersion();
        expect(mockedGithub.getOctokit).toHaveBeenCalledWith('env-token');
    });

    it('uses octokit when token is provided via input', async () => {
        mockedCore.getInput.mockReturnValue('my-test-token');
        const mockOctokit = {
            rest: {
                repos: {
                    getLatestRelease: jest.fn().mockResolvedValue({
                        data: { tag_name: 'v3.0.0' },
                    }),
                },
            },
        };
        mockedGithub.getOctokit.mockReturnValue(mockOctokit as never);
        await expect(getLatestVersion()).resolves.toBe('3.0.0');
        expect(mockOctokit.rest.repos.getLatestRelease).toHaveBeenCalledWith({
            owner: 'rhysd',
            repo: 'actionlint',
        });
    });
});

describe('downloadActionlint', () => {
    const originalPlatform = process.platform;
    const originalArch = process.arch;
    const tarballContent = Buffer.from('mock tarball data');

    beforeEach(() => {
        jest.resetAllMocks();
        Object.defineProperty(process, 'platform', { value: 'linux' });
        Object.defineProperty(process, 'arch', { value: 'x64' });

        (mockedFs.createReadStream as jest.Mock).mockImplementation(() => {
            return createMockStream(tarballContent);
        });
    });

    afterAll(() => {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
        Object.defineProperty(process, 'arch', { value: originalArch });
    });

    it('returns cached path with .exe on Windows', async () => {
        const origPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'win32' });
        mockedTc.find.mockReturnValue('C:\\cached\\actionlint\\x86_64' as never);
        const result = await downloadActionlint('1.7.12');
        expect(result).toBe(path.join('C:\\cached\\actionlint\\x86_64', 'actionlint.exe'));
        Object.defineProperty(process, 'platform', { value: origPlatform });
    });

    it('returns cached path when tool is in cache', async () => {
        mockedTc.find.mockReturnValue('/cached/actionlint/x86_64' as never);
        const result = await downloadActionlint('1.7.12');
        expect(result).toBe(path.join('/cached/actionlint/x86_64', 'actionlint'));
        expect(mockedTc.find).toHaveBeenCalledWith('actionlint', '1.7.12', 'x86_64');
        expect(mockedTc.downloadTool).not.toHaveBeenCalled();
    });

    it('downloads and caches tool when not in cache', async () => {
        mockedTc.find.mockReturnValue(null as never);
        mockedTc.downloadTool.mockResolvedValueOnce('/tmp/checksums.txt');
        mockedTc.downloadTool.mockResolvedValueOnce('/tmp/tarball.tar.gz');
        mockedTc.extractTar.mockResolvedValue('/tmp/extracted');
        mockedTc.cacheDir.mockResolvedValue('/cached/dir');

        const tarballHash = crypto.createHash('sha256').update(tarballContent).digest('hex');
        (mockedFs.readFileSync as jest.Mock).mockReturnValue(`${tarballHash}  actionlint_1.7.12_Linux_x86_64.tar.gz\n`);
        (mockedFs.existsSync as jest.Mock).mockReturnValue(true);

        const result = await downloadActionlint('1.7.12');

        expect(mockedTc.downloadTool).toHaveBeenCalledWith(
            'https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_checksums.txt',
        );
        expect(mockedTc.downloadTool).toHaveBeenCalledWith(
            'https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_Linux_x86_64.tar.gz',
        );
        expect(result).toBe(path.join('/cached/dir', 'actionlint'));
    });

    it('throws when checksum not found in checksums file', async () => {
        mockedTc.find.mockReturnValue(null as never);
        mockedTc.downloadTool.mockResolvedValueOnce('/tmp/checksums.txt');
        (mockedFs.readFileSync as jest.Mock).mockReturnValue('some other checksums');

        await expect(downloadActionlint('1.7.12')).rejects.toThrow(
            'Could not find checksum for actionlint_1.7.12_Linux_x86_64.tar.gz in actionlint_1.7.12_checksums.txt',
        );
    });

    it('throws on checksum mismatch', async () => {
        mockedTc.find.mockReturnValue(null as never);
        mockedTc.downloadTool.mockResolvedValueOnce('/tmp/checksums.txt');
        mockedTc.downloadTool.mockResolvedValueOnce('/tmp/tarball.tar.gz');

        (mockedFs.readFileSync as jest.Mock).mockReturnValue('expected_sha256  actionlint_1.7.12_Linux_x86_64.tar.gz\n');
        (mockedFs.existsSync as jest.Mock).mockReturnValue(true);

        await expect(downloadActionlint('1.7.12')).rejects.toThrow('Checksum mismatch');
    });

    it('throws when binary not found after extraction', async () => {
        mockedTc.find.mockReturnValue(null as never);
        mockedTc.downloadTool.mockResolvedValueOnce('/tmp/checksums.txt');
        mockedTc.downloadTool.mockResolvedValueOnce('/tmp/tarball.tar.gz');
        mockedTc.extractTar.mockResolvedValue('/tmp/extracted');
        mockedTc.cacheDir.mockResolvedValue('/cached/dir');

        const tarballHash = crypto.createHash('sha256').update(tarballContent).digest('hex');
        (mockedFs.readFileSync as jest.Mock).mockReturnValue(`${tarballHash}  actionlint_1.7.12_Linux_x86_64.tar.gz\n`);
        (mockedFs.existsSync as jest.Mock).mockReturnValue(false);

        await expect(downloadActionlint('1.7.12')).rejects.toThrow(
            'Binary not found at expected location',
        );
    });
});

describe('parseFlags', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        mockedCore.getInput.mockImplementation((name: string) => {
            const defaults: Record<string, string> = {
                shellcheck: 'shellcheck',
                pyflakes: 'pyflakes',
            };
            return defaults[name] ?? '';
        });
        mockedCore.getBooleanInput.mockReturnValue(false);
    });

    it('returns empty array when no inputs are set', () => {
        expect(parseFlags()).toEqual([]);
    });

    it('parses single ignore pattern', () => {
        mockedCore.getInput.mockImplementation((name: string) => {
            if (name === 'ignore') return 'some pattern';
            if (name === 'shellcheck') return 'shellcheck';
            if (name === 'pyflakes') return 'pyflakes';
            return '';
        });
        expect(parseFlags()).toEqual(['-ignore', 'some pattern']);
    });

    it('parses multiple ignore patterns separated by newlines', () => {
        mockedCore.getInput.mockImplementation((name: string) => {
            if (name === 'ignore') return 'pattern one\npattern two\npattern three';
            if (name === 'shellcheck') return 'shellcheck';
            if (name === 'pyflakes') return 'pyflakes';
            return '';
        });
        expect(parseFlags()).toEqual([
            '-ignore', 'pattern one',
            '-ignore', 'pattern two',
            '-ignore', 'pattern three',
        ]);
    });

    it('ignores empty lines in ignore patterns', () => {
        mockedCore.getInput.mockImplementation((name: string) => {
            if (name === 'ignore') return 'pattern one\n\npattern two\n';
            if (name === 'shellcheck') return 'shellcheck';
            if (name === 'pyflakes') return 'pyflakes';
            return '';
        });
        expect(parseFlags()).toEqual([
            '-ignore', 'pattern one',
            '-ignore', 'pattern two',
        ]);
    });

    it('adds -oneline flag when oneline is true', () => {
        mockedCore.getBooleanInput.mockImplementation((name: string) => {
            return name === 'oneline';
        });
        expect(parseFlags()).toContain('-oneline');
    });

    it('adds -format with value', () => {
        mockedCore.getInput.mockImplementation((name: string) => {
            if (name === 'format') return '{{json .}}';
            if (name === 'shellcheck') return 'shellcheck';
            if (name === 'pyflakes') return 'pyflakes';
            return '';
        });
        expect(parseFlags()).toEqual(['-format', '{{json .}}']);
    });

    it('adds -config-file with value', () => {
        mockedCore.getInput.mockImplementation((name: string) => {
            if (name === 'config-file') return '/path/to/actionlint.yaml';
            if (name === 'shellcheck') return 'shellcheck';
            if (name === 'pyflakes') return 'pyflakes';
            return '';
        });
        expect(parseFlags()).toEqual(['-config-file', '/path/to/actionlint.yaml']);
    });

    it('adds -no-color flag when no-color is true', () => {
        mockedCore.getBooleanInput.mockImplementation((name: string) => {
            return name === 'no-color';
        });
        expect(parseFlags()).toContain('-no-color');
    });

    it('adds -color flag when color is true', () => {
        mockedCore.getBooleanInput.mockImplementation((name: string) => {
            return name === 'color';
        });
        expect(parseFlags()).toContain('-color');
    });

    it('adds -verbose flag when verbose is true', () => {
        mockedCore.getBooleanInput.mockImplementation((name: string) => {
            return name === 'verbose';
        });
        expect(parseFlags()).toContain('-verbose');
    });

    it('adds -debug flag when debug is true', () => {
        mockedCore.getBooleanInput.mockImplementation((name: string) => {
            return name === 'debug';
        });
        expect(parseFlags()).toContain('-debug');
    });

    it('adds -stdin-filename with value', () => {
        mockedCore.getInput.mockImplementation((name: string) => {
            if (name === 'stdin-filename') return 'custom-stdin.yml';
            if (name === 'shellcheck') return 'shellcheck';
            if (name === 'pyflakes') return 'pyflakes';
            return '';
        });
        expect(parseFlags()).toEqual(['-stdin-filename', 'custom-stdin.yml']);
    });

    it('parses files input into positional arguments', () => {
        mockedCore.getInput.mockImplementation((name: string) => {
            if (name === 'files') return '.github/workflows/ci.yml .github/workflows/release.yml';
            if (name === 'shellcheck') return 'shellcheck';
            if (name === 'pyflakes') return 'pyflakes';
            return '';
        });
        expect(parseFlags()).toEqual([
            '.github/workflows/ci.yml',
            '.github/workflows/release.yml',
        ]);
    });

    it('passes stdin marker in files', () => {
        mockedCore.getInput.mockImplementation((name: string) => {
            if (name === 'files') return '-';
            if (name === 'shellcheck') return 'shellcheck';
            if (name === 'pyflakes') return 'pyflakes';
            return '';
        });
        expect(parseFlags()).toEqual(['-']);
    });

    it('trims whitespace from file arguments', () => {
        mockedCore.getInput.mockImplementation((name: string) => {
            if (name === 'files') return '  file1.yml   file2.yml  ';
            if (name === 'shellcheck') return 'shellcheck';
            if (name === 'pyflakes') return 'pyflakes';
            return '';
        });
        expect(parseFlags()).toEqual(['file1.yml', 'file2.yml']);
    });

    it('adds -shellcheck with custom value', () => {
        mockedCore.getInput.mockImplementation((name: string) => {
            if (name === 'shellcheck') return '/usr/local/bin/shellcheck';
            if (name === 'pyflakes') return 'pyflakes';
            return '';
        });
        expect(parseFlags()).toEqual(['-shellcheck', '/usr/local/bin/shellcheck']);
    });

    it('adds -shellcheck with empty string to disable', () => {
        mockedCore.getInput.mockImplementation((name: string) => {
            if (name === 'shellcheck') return '';
            if (name === 'pyflakes') return 'pyflakes';
            return '';
        });
        expect(parseFlags()).toEqual(['-shellcheck', '']);
    });

    it('adds -pyflakes with custom value', () => {
        mockedCore.getInput.mockImplementation((name: string) => {
            if (name === 'pyflakes') return '/usr/local/bin/pyflakes';
            if (name === 'shellcheck') return 'shellcheck';
            return '';
        });
        expect(parseFlags()).toEqual(['-pyflakes', '/usr/local/bin/pyflakes']);
    });

    it('adds -pyflakes with empty string to disable', () => {
        mockedCore.getInput.mockImplementation((name: string) => {
            if (name === 'pyflakes') return '';
            if (name === 'shellcheck') return 'shellcheck';
            return '';
        });
        expect(parseFlags()).toEqual(['-pyflakes', '']);
    });

    it('handles all flags combined', () => {
        mockedCore.getInput.mockImplementation((name: string) => {
            const values: Record<string, string> = {
                ignore: 'pattern1\npattern2',
                format: '{{json .}}',
                'config-file': '.github/actionlint.yaml',
                'stdin-filename': 'workflow.yml',
                files: '.github/workflows/ci.yml',
                shellcheck: '/opt/shellcheck',
                pyflakes: '/opt/pyflakes',
            };
            return values[name] ?? '';
        });
        mockedCore.getBooleanInput.mockImplementation((name: string) => {
            return ['oneline', 'verbose', 'color'].includes(name);
        });
        const flags = parseFlags();
        expect(flags).toEqual([
            '-ignore', 'pattern1',
            '-ignore', 'pattern2',
            '-shellcheck', '/opt/shellcheck',
            '-pyflakes', '/opt/pyflakes',
            '-oneline',
            '-format', '{{json .}}',
            '-config-file', '.github/actionlint.yaml',
            '-color',
            '-verbose',
            '-stdin-filename', 'workflow.yml',
            '.github/workflows/ci.yml',
        ]);
    });
});
