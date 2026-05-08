import { describe, it, expect, mock, beforeEach, afterEach, afterAll } from 'bun:test';
import * as path from 'path';
import * as fs from 'fs';
import { Readable } from 'stream';
import * as crypto from 'crypto';

const mockInputs: Record<string, string> = {};
const mockBooleans: Record<string, boolean> = {};

const mockedCore = {
    getInput: (name: string) => mockInputs[name] ?? '',
    getBooleanInput: (name: string) => mockBooleans[name] ?? false,
    info: () => {},
    warning: () => {},
    setFailed: () => {},
};

const mockOctokit = {
    rest: {
        repos: {
            getLatestRelease: async () => ({ data: { tag_name: 'v1.7.12' } }),
        },
    },
};

const mockedGithub = {
    getOctokit: () => mockOctokit,
};

const tcState = {
    findResult: null as string | null,
    downloadTool: async (url: string) => `/tmp/${path.basename(url)}`,
    extractTar: async () => '/tmp/extracted',
    cacheDir: async () => '/cached/dir',
};

const mockedTc = {
    find: (name: string, version: string, arch: string) => tcState.findResult,
    downloadTool: (url: string) => tcState.downloadTool(url),
    extractTar: (path: string) => tcState.extractTar(path),
    cacheDir: (dir: string, name: string, version: string, arch: string) => tcState.cacheDir(dir, name, version, arch),
};

const mockedExec = {
    exec: async () => 0,
};

const fsOverrides: {
    readFileSync: ((...args: any[]) => any) | null;
    existsSync: ((...args: any[]) => any) | null;
    createReadStream: ((...args: any[]) => any) | null;
} = {
    readFileSync: null,
    existsSync: null,
    createReadStream: null,
};

const actualFs = { ...fs };

mock.module('@actions/core', () => mockedCore);
mock.module('@actions/tool-cache', () => mockedTc);
mock.module('@actions/exec', () => mockedExec);
mock.module('@actions/github', () => mockedGithub);
mock.module('fs', () => {
    return {
        ...fs,
        readFileSync: (...args: any[]) => {
            if (fsOverrides.readFileSync) return fsOverrides.readFileSync(...args);
            return actualFs.readFileSync(...args);
        },
        existsSync: (...args: any[]) => {
            if (fsOverrides.existsSync) return fsOverrides.existsSync(...args);
            return actualFs.existsSync(...args);
        },
        createReadStream: (...args: any[]) => {
            if (fsOverrides.createReadStream) return fsOverrides.createReadStream(...args);
            return actualFs.createReadStream(...args);
        },
    };
});

const { getPlatform, extractChecksum, calculateSha256, getLatestVersion, downloadActionlint, parseFlags } = await import('./main');

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

    beforeEach(() => {
        fsOverrides.createReadStream = null;
    });

    afterEach(() => {
        if (actualFs.existsSync(tmpFile)) {
            fs.unlinkSync(tmpFile);
        }
    });

    it('calculates correct SHA256 for file content', async () => {
        const content = 'hello world';
        fs.writeFileSync(tmpFile, content);
        fsOverrides.createReadStream = actualFs.createReadStream;
        const expected = crypto.createHash('sha256').update(content).digest('hex');
        await expect(calculateSha256(tmpFile)).resolves.toBe(expected);
    });

    it('calculates correct SHA256 for empty file', async () => {
        fs.writeFileSync(tmpFile, '');
        fsOverrides.createReadStream = actualFs.createReadStream;
        const expected = crypto.createHash('sha256').update('').digest('hex');
        await expect(calculateSha256(tmpFile)).resolves.toBe(expected);
    });

    it('rejects for non-existent file', async () => {
        fsOverrides.createReadStream = actualFs.createReadStream;
        await expect(calculateSha256('/nonexistent/path/file.tar.gz')).rejects.toThrow();
    });

    it('calculates consistent hashes for same content', async () => {
        fs.writeFileSync(tmpFile, 'test content for consistency');
        fsOverrides.createReadStream = actualFs.createReadStream;
        const hash1 = await calculateSha256(tmpFile);
        const hash2 = await calculateSha256(tmpFile);
        expect(hash1).toBe(hash2);
    });

    it('calculates different hashes for different content', async () => {
        fsOverrides.createReadStream = actualFs.createReadStream;
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
        mockInputs['github-token'] = '';
        delete process.env.GITHUB_TOKEN;
        globalThis.fetch = (async (url: string) => ({
            ok: true,
            json: async () => {
                const parsed = new URL(url);
                if (parsed.hostname === 'api.github.com') {
                    return { tag_name: 'v1.7.12' };
                }
                return {};
            },
        })) as any;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('returns version from latest release via fetch when no token', async () => {
        await expect(getLatestVersion()).resolves.toBe('1.7.12');
    });

    it('strips leading v from tag', async () => {
        globalThis.fetch = (async () => ({
            ok: true,
            json: async () => ({ tag_name: 'v2.0.0' }),
        })) as any;
        await expect(getLatestVersion()).resolves.toBe('2.0.0');
    });

    it('handles version without leading v', async () => {
        globalThis.fetch = (async () => ({
            ok: true,
            json: async () => ({ tag_name: '1.7.12' }),
        })) as any;
        await expect(getLatestVersion()).resolves.toBe('1.7.12');
    });

    it('falls back to hardcoded version on fetch failure', async () => {
        globalThis.fetch = (async () => ({
            ok: false,
            status: 403,
        })) as any;
        await expect(getLatestVersion()).resolves.toBe('1.7.12');
    });

    it('falls back to hardcoded version on fetch network error', async () => {
        globalThis.fetch = (async () => {
            throw new Error('Network error');
        }) as any;
        await expect(getLatestVersion()).resolves.toBe('1.7.12');
    });

    it('uses github-token input when provided', async () => {
        mockInputs['github-token'] = 'my-test-token';
        let capturedOwner = '';
        let capturedRepo = '';
        mockOctokit.rest.repos.getLatestRelease = async (params: any) => {
            capturedOwner = params.owner;
            capturedRepo = params.repo;
            return { data: { tag_name: 'v1.7.12' } };
        };
        await expect(getLatestVersion()).resolves.toBe('1.7.12');
        expect(capturedOwner).toBe('rhysd');
        expect(capturedRepo).toBe('actionlint');
        mockInputs['github-token'] = '';
    });

    it('uses GITHUB_TOKEN env var when input not provided', async () => {
        mockInputs['github-token'] = '';
        process.env.GITHUB_TOKEN = 'env-token';
        let capturedOwner = '';
        let capturedRepo = '';
        mockOctokit.rest.repos.getLatestRelease = async (params: any) => {
            capturedOwner = params.owner;
            capturedRepo = params.repo;
            return { data: { tag_name: 'v2.0.0' } };
        };
        await expect(getLatestVersion()).resolves.toBe('2.0.0');
        expect(capturedOwner).toBe('rhysd');
        expect(capturedRepo).toBe('actionlint');
        delete process.env.GITHUB_TOKEN;
    });

    it('uses octokit when token is provided via input', async () => {
        mockInputs['github-token'] = 'my-test-token';
        let capturedOwner = '';
        let capturedRepo = '';
        mockOctokit.rest.repos.getLatestRelease = async (params: any) => {
            capturedOwner = params.owner;
            capturedRepo = params.repo;
            return { data: { tag_name: 'v3.0.0' } };
        };
        await expect(getLatestVersion()).resolves.toBe('3.0.0');
        expect(capturedOwner).toBe('rhysd');
        expect(capturedRepo).toBe('actionlint');
        mockInputs['github-token'] = '';
    });
});

describe('downloadActionlint', () => {
    const originalPlatform = process.platform;
    const originalArch = process.arch;
    const tarballContent = Buffer.from('mock tarball data');

    beforeEach(() => {
        Object.defineProperty(process, 'platform', { value: 'linux' });
        Object.defineProperty(process, 'arch', { value: 'x64' });
        fsOverrides.createReadStream = () => createMockStream(tarballContent);
        tcState.findResult = null;
    });

    afterAll(() => {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
        Object.defineProperty(process, 'arch', { value: originalArch });
    });

    it('returns cached path with .exe on Windows', async () => {
        const origPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'win32' });
        tcState.findResult = 'C:\\cached\\actionlint\\x86_64';
        const result = await downloadActionlint('1.7.12');
        expect(result).toBe(path.join('C:\\cached\\actionlint\\x86_64', 'actionlint.exe'));
        Object.defineProperty(process, 'platform', { value: origPlatform });
    });

    it('returns cached path when tool is in cache', async () => {
        tcState.findResult = '/cached/actionlint/x86_64';
        const result = await downloadActionlint('1.7.12');
        expect(result).toBe(path.join('/cached/actionlint/x86_64', 'actionlint'));
    });

    it('downloads and caches tool when not in cache', async () => {
        tcState.findResult = null;
        tcState.downloadTool = async (url: string) => `/tmp/${path.basename(url)}`;
        tcState.extractTar = async () => '/tmp/extracted';
        tcState.cacheDir = async () => '/cached/dir';

        const tarballHash = crypto.createHash('sha256').update(tarballContent).digest('hex');
        fsOverrides.readFileSync = (filePath: string) => {
            if (String(filePath).includes('checksums')) {
                return `${tarballHash}  actionlint_1.7.12_Linux_x86_64.tar.gz\n`;
            }
            return '';
        };
        fsOverrides.existsSync = (filePath: string) => String(filePath).includes('actionlint');

        const result = await downloadActionlint('1.7.12');
        expect(result).toBe(path.join('/cached/dir', 'actionlint'));

        fsOverrides.readFileSync = null;
        fsOverrides.existsSync = null;
    });

    it('throws when checksum not found in checksums file', async () => {
        tcState.findResult = null;
        tcState.downloadTool = async (url: string) => `/tmp/${path.basename(url)}`;
        fsOverrides.readFileSync = () => 'some other checksums';

        await expect(downloadActionlint('1.7.12')).rejects.toThrow(
            'Could not find checksum for actionlint_1.7.12_Linux_x86_64.tar.gz in actionlint_1.7.12_checksums.txt',
        );
        fsOverrides.readFileSync = null;
    });

    it('throws on checksum mismatch', async () => {
        tcState.findResult = null;
        tcState.downloadTool = async (url: string) => `/tmp/${path.basename(url)}`;
        fsOverrides.readFileSync = () => 'expected_sha256  actionlint_1.7.12_Linux_x86_64.tar.gz\n';
        fsOverrides.existsSync = () => true;

        await expect(downloadActionlint('1.7.12')).rejects.toThrow('Checksum mismatch');
        fsOverrides.readFileSync = null;
        fsOverrides.existsSync = null;
    });

    it('throws when binary not found after extraction', async () => {
        tcState.findResult = null;
        tcState.downloadTool = async (url: string) => `/tmp/${path.basename(url)}`;
        tcState.extractTar = async () => '/tmp/extracted';
        tcState.cacheDir = async () => '/cached/dir';

        const tarballHash = crypto.createHash('sha256').update(tarballContent).digest('hex');
        fsOverrides.readFileSync = () => `${tarballHash}  actionlint_1.7.12_Linux_x86_64.tar.gz\n`;
        fsOverrides.existsSync = () => false;

        await expect(downloadActionlint('1.7.12')).rejects.toThrow(
            'Binary not found at expected location',
        );
        fsOverrides.readFileSync = null;
        fsOverrides.existsSync = null;
    });
});

describe('parseFlags', () => {
    beforeEach(() => {
        mockInputs['ignore'] = '';
        mockInputs['shellcheck'] = 'shellcheck';
        mockInputs['pyflakes'] = 'pyflakes';
        mockInputs['format'] = '';
        mockInputs['config-file'] = '';
        mockInputs['stdin-filename'] = '';
        mockInputs['files'] = '';
        mockInputs['version'] = '';
        mockInputs['working-directory'] = '';
        mockInputs['github-token'] = '';
        mockBooleans['oneline'] = false;
        mockBooleans['no-color'] = false;
        mockBooleans['color'] = false;
        mockBooleans['verbose'] = false;
        mockBooleans['debug'] = false;
    });

    it('returns empty array when no inputs are set', () => {
        expect(parseFlags()).toEqual([]);
    });

    it('parses single ignore pattern', () => {
        mockInputs['ignore'] = 'some pattern';
        expect(parseFlags()).toEqual(['-ignore', 'some pattern']);
    });

    it('parses multiple ignore patterns separated by newlines', () => {
        mockInputs['ignore'] = 'pattern one\npattern two\npattern three';
        expect(parseFlags()).toEqual([
            '-ignore', 'pattern one',
            '-ignore', 'pattern two',
            '-ignore', 'pattern three',
        ]);
    });

    it('ignores empty lines in ignore patterns', () => {
        mockInputs['ignore'] = 'pattern one\n\npattern two\n';
        expect(parseFlags()).toEqual([
            '-ignore', 'pattern one',
            '-ignore', 'pattern two',
        ]);
    });

    it('adds -oneline flag when oneline is true', () => {
        mockBooleans['oneline'] = true;
        expect(parseFlags()).toContain('-oneline');
    });

    it('adds -format with value', () => {
        mockInputs['format'] = '{{json .}}';
        expect(parseFlags()).toEqual(['-format', '{{json .}}']);
    });

    it('adds -config-file with value', () => {
        mockInputs['config-file'] = '/path/to/actionlint.yaml';
        expect(parseFlags()).toEqual(['-config-file', '/path/to/actionlint.yaml']);
    });

    it('adds -no-color flag when no-color is true', () => {
        mockBooleans['no-color'] = true;
        expect(parseFlags()).toContain('-no-color');
    });

    it('adds -color flag when color is true', () => {
        mockBooleans['color'] = true;
        expect(parseFlags()).toContain('-color');
    });

    it('adds -verbose flag when verbose is true', () => {
        mockBooleans['verbose'] = true;
        expect(parseFlags()).toContain('-verbose');
    });

    it('adds -debug flag when debug is true', () => {
        mockBooleans['debug'] = true;
        expect(parseFlags()).toContain('-debug');
    });

    it('adds -stdin-filename with value', () => {
        mockInputs['stdin-filename'] = 'custom-stdin.yml';
        expect(parseFlags()).toEqual(['-stdin-filename', 'custom-stdin.yml']);
    });

    it('parses files input into positional arguments', () => {
        mockInputs['files'] = '.github/workflows/ci.yml .github/workflows/release.yml';
        expect(parseFlags()).toEqual([
            '.github/workflows/ci.yml',
            '.github/workflows/release.yml',
        ]);
    });

    it('passes stdin marker in files', () => {
        mockInputs['files'] = '-';
        expect(parseFlags()).toEqual(['-']);
    });

    it('trims whitespace from file arguments', () => {
        mockInputs['files'] = '  file1.yml   file2.yml  ';
        expect(parseFlags()).toEqual(['file1.yml', 'file2.yml']);
    });

    it('adds -shellcheck with custom value', () => {
        mockInputs['shellcheck'] = '/usr/local/bin/shellcheck';
        expect(parseFlags()).toEqual(['-shellcheck', '/usr/local/bin/shellcheck']);
    });

    it('adds -shellcheck with empty string to disable', () => {
        mockInputs['shellcheck'] = '';
        expect(parseFlags()).toEqual(['-shellcheck', '']);
    });

    it('adds -pyflakes with custom value', () => {
        mockInputs['pyflakes'] = '/usr/local/bin/pyflakes';
        expect(parseFlags()).toEqual(['-pyflakes', '/usr/local/bin/pyflakes']);
    });

    it('adds -pyflakes with empty string to disable', () => {
        mockInputs['pyflakes'] = '';
        expect(parseFlags()).toEqual(['-pyflakes', '']);
    });

    it('handles all flags combined', () => {
        mockInputs['ignore'] = 'pattern1\npattern2';
        mockInputs['format'] = '{{json .}}';
        mockInputs['config-file'] = '.github/actionlint.yaml';
        mockInputs['stdin-filename'] = 'workflow.yml';
        mockInputs['files'] = '.github/workflows/ci.yml';
        mockInputs['shellcheck'] = '/opt/shellcheck';
        mockInputs['pyflakes'] = '/opt/pyflakes';
        mockBooleans['oneline'] = true;
        mockBooleans['verbose'] = true;
        mockBooleans['color'] = true;
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
