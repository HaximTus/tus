/**
 * Tus - 通过 GitHub API 部署脚本
 * 在中国内地直接使用 git push 可能失败时使用此脚本
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');
const { spawn } = require('child_process');

// 从 .env 文件读取部署配置（不把 Token 硬编码到代码中）
const localEnv = {};
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf-8').split(/\r?\n/).forEach(line => {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (match) localEnv[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    });
}
const getConfig = name => process.env[name] || localEnv[name] || '';
const TOKEN = getConfig('GITHUB_TOKEN');
if (!TOKEN) {
    console.error('❌ 未找到 GitHub Token！请在项目根目录的 .env 文件中设置 GITHUB_TOKEN');
    process.exit(1);
}
const OWNER = 'HaximTus';
const REPO = 'tus';
const BRANCH = 'main';
const ALIYUN_SSH_HOST = getConfig('ALIYUN_SSH_HOST') || '39.105.202.28';
const ALIYUN_SSH_PORT = getConfig('ALIYUN_SSH_PORT') || '22';
const ALIYUN_SSH_USER = getConfig('ALIYUN_SSH_USER') || 'tus-deploy';
const ALIYUN_SSH_KEY = getConfig('ALIYUN_SSH_KEY') || path.join(os.homedir(), '.ssh', 'tus-deploy');
const ALIYUN_PAPER_DIR = '/var/lib/tus-auth/papers';

// 要上传的文件列表（相对于项目根目录）
const FILES_TO_UPLOAD = [
    'index.html',
    'account.html',
    'subject-detail.html',
    'upload.html',
    'create-subject.html',
    'submit.html',
    'admin.html',
    'preview.html',
    'download-worker.js',
    'css/tailwind.css',
    'css/style.css',
    'css/announcement.css',
    'css/auth.css',
    'js/api-client.js',
    'js/announcement.js',
    'js/auth.js',
    'js/index.js',
    'js/subject-detail.js',
    'js/create-subject.js',
    'js/submit.js',
    'js/ui.js',
    'js/admin.js',
    'js/docx-preview.min.js',
    'js/jszip.min.js',
    'js/pdf.min.mjs',
    'js/pdf.worker.min.mjs',
    'js/pdf.legacy.min.mjs',
    'js/pdf.worker.legacy.min.mjs',
    'js/pdf.compat.min.js',
    'js/pdf.worker.compat.min.js',
    'js/pdf-mobile-preview.mjs',
    'favicon.svg',
    'CLAUDE.md',
    'README.md',
    'docs/icp-same-origin-migration.md',
    'supabase-setup.sql',
    'data/subjects.json',
    'data/papers.json',
    'scripts/manage.js',
    'scripts/deploy-via-api.js',
    'scripts/serve-local.js',
    '.gitignore',
];

// 二进制/非文本文件（直接读 base64）
const BINARY_FILES = [
    'assets/papers/.gitkeep',
];

// 自动扫描 assets/papers/ 目录下的试卷文件（PDF / Word，排除 pending 子目录）
function getPaperFiles(projectRoot) {
    const papersDir = path.join(projectRoot, 'assets', 'papers');
    const paperFiles = [];
    const exts = ['.pdf', '.doc', '.docx'];
    try {
        const files = fs.readdirSync(papersDir);
        for (const file of files) {
            if (file === '.gitkeep' || file === 'pending') continue;
            if (exts.some(ext => file.toLowerCase().endsWith(ext))) {
                paperFiles.push(`assets/papers/${file}`);
            }
        }
    } catch (e) {
        console.error('  ⚠️ 扫描试卷文件失败:', e.message);
    }
    return paperFiles;
}

function runCommand(command, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: 'inherit', windowsHide: true });
        child.on('error', reject);
        child.on('exit', code => {
            if (code === 0) resolve();
            else reject(new Error(`${command} 退出，代码 ${code}`));
        });
    });
}

async function syncPapersToAlibaba(projectRoot, paperFiles) {
    if (!paperFiles.length) {
        console.log('\n☁️ 阿里云试卷同步：没有可同步的试卷文件');
        return;
    }
    if (!fs.existsSync(ALIYUN_SSH_KEY)) {
        throw new Error(`未找到阿里云部署密钥：${ALIYUN_SSH_KEY}`);
    }

    const target = `${ALIYUN_SSH_USER}@${ALIYUN_SSH_HOST}`;
    const stagingDir = `/tmp/tus-paper-deploy-${Date.now()}`;
    const sshArgs = ['-i', ALIYUN_SSH_KEY, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-p', ALIYUN_SSH_PORT];
    const scpArgs = ['-i', ALIYUN_SSH_KEY, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-P', ALIYUN_SSH_PORT];

    console.log(`\n☁️ 同步 ${paperFiles.length} 份试卷到阿里云...`);
    await runCommand('ssh', [...sshArgs, target, `mkdir -p '${stagingDir}'`]);
    await runCommand('scp', [
        ...scpArgs,
        ...paperFiles.map(file => path.join(projectRoot, file)),
        `${target}:${stagingDir}/`
    ]);

    const installCommand = [
        'set -eu',
        `sudo install -d -m 0755 '${ALIYUN_PAPER_DIR}'`,
        `find '${stagingDir}' -maxdepth 1 -type f -exec sudo install -o tus -g tus -m 0644 {} '${ALIYUN_PAPER_DIR}/' \\;`,
        `rm -rf '${stagingDir}'`
    ].join(' && ');
    await runCommand('ssh', [...sshArgs, target, installCommand]);
    console.log(`  ✅ 阿里云同步完成：${paperFiles.length} 份试卷`);
}

// GitHub Issue 模板
const ISSUE_TEMPLATES = [
    '.github/ISSUE_TEMPLATE/submit-paper.md',
];

function apiCall(method, urlPath, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(`https://api.github.com${urlPath}`);
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Authorization': `token ${TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'tus-deploy',
                'Content-Type': 'application/json',
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function getFileSha(filePath) {
    const result = await apiCall('GET', `/repos/${OWNER}/${REPO}/contents/${filePath}?ref=${BRANCH}`);
    if (result.status === 200) {
        return result.data.sha;
    }
    return null;
}

async function uploadFile(filePath, content, isBinary = false) {
    console.log(`  📤 上传: ${filePath}...`);

    let encoded;
    if (isBinary) {
        encoded = content;
    } else {
        encoded = Buffer.from(content, 'utf-8').toString('base64');
    }

    // 重试最多 5 次（应对并行上传时的 SHA 冲突），指数退避
    for (let attempt = 0; attempt < 5; attempt++) {
        const sha = await getFileSha(filePath);
        const body = {
            message: `Update ${filePath}`,
            content: encoded,
            branch: BRANCH,
        };
        if (sha) body.sha = sha;

        const result = await apiCall('PUT', `/repos/${OWNER}/${REPO}/contents/${filePath}`, body);

        if (result.status === 201 || result.status === 200) {
            console.log(`  ✅ 上传成功: ${filePath}`);
            return true;
        }
        if (result.status === 409 && attempt < 4) {
            // SHA 冲突，指数退避重试
            const delay = Math.pow(2, attempt) * 1000;
            console.log(`  ⚠️ SHA 冲突，${delay/1000}秒后重试...`);
            await new Promise(r => setTimeout(r, delay));
            continue;
        }
        console.error(`  ❌ 上传失败: ${filePath} (${result.status})`);
        if (result.data?.message) console.error(`     ${result.data.message}`);
        return false;
    }
}

async function main() {
    const projectRoot = path.join(__dirname, '..');
    console.log('\n🚀 Tus - GitHub API 部署脚本\n');
    console.log(`目标仓库: ${OWNER}/${REPO}\n`);

    let success = 0;
    let failed = 0;

    // 并行上传，限制 4 个同时进行（避免 API 限流）
    async function uploadBatch(files, isBinary = false) {
        const CONCURRENCY = 4;
        const results = [];
        for (let i = 0; i < files.length; i += CONCURRENCY) {
            const batch = files.slice(i, i + CONCURRENCY);
            const res = await Promise.all(batch.map(async (filePath) => {
                const fullPath = path.join(projectRoot, filePath);
                try {
                    let content;
                    if (isBinary) {
                        content = fs.readFileSync(fullPath).toString('base64');
                    } else {
                        content = fs.readFileSync(fullPath, 'utf-8');
                    }
                    const ok = await uploadFile(filePath, content, isBinary);
                    return ok;
                } catch (e) {
                    console.error(`  ❌ 读取失败: ${filePath} - ${e.message}`);
                    return false;
                }
            }));
            results.push(...res);
        }
        return results;
    }

    // 上传文本文件（4个并行）
    const textResults = await uploadBatch(FILES_TO_UPLOAD);
    success += textResults.filter(Boolean).length;
    failed += textResults.filter(r => !r).length;

    // 上传二进制文件（4个并行）
    const binResults = await uploadBatch(BINARY_FILES, true);
    success += binResults.filter(Boolean).length;
    failed += binResults.filter(r => !r).length;

    // 自动上传 assets/papers/ 下新增的试卷文件（4个并行，跳过已存在的）
    const paperFiles = getPaperFiles(projectRoot);
    if (paperFiles.length > 0) {
        const shaChecks = await Promise.all(paperFiles.map(f => getFileSha(f)));
        const newFiles = [];
        let skipCount = 0;
        paperFiles.forEach((f, i) => {
            if (shaChecks[i]) { skipCount++; }
            else { newFiles.push(f); }
        });
        if (newFiles.length > 0) {
            const CONCURRENCY = 4;
            for (let i = 0; i < newFiles.length; i += CONCURRENCY) {
                const batch = newFiles.slice(i, i + CONCURRENCY);
                const res = await Promise.all(batch.map(async (filePath) => {
                    const fullPath = path.join(projectRoot, filePath);
                    try {
                        const stats = fs.statSync(fullPath);
                        if (stats.size > 100 * 1024 * 1024) {
                            console.error(`  ⚠️ 跳过 ${filePath}：超过 100MB`);
                            return false;
                        }
                        console.log(`  📄 新文件: ${filePath}`);
                        const content = fs.readFileSync(fullPath).toString('base64');
                        return await uploadFile(filePath, content, true);
                    } catch (e) {
                        console.error(`  ❌ 读取失败: ${filePath} - ${e.message}`);
                        return false;
                    }
                }));
                success += res.filter(Boolean).length;
                failed += res.filter(r => !r).length;
            }
        }
        console.log(`  📊 文件: ${newFiles.length - failed} 新上传, ${skipCount} 已存在跳过`);
    }

    try {
        await syncPapersToAlibaba(projectRoot, paperFiles);
    } catch (error) {
        console.error(`  ❌ 阿里云试卷同步失败：${error.message}`);
        failed++;
    }

    // 上传 Issue 模板（路径含 .github，需要先创建目录）
    for (const filePath of ISSUE_TEMPLATES) {
        const fullPath = path.join(projectRoot, filePath);
        try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            // 使用编码后的路径
            const encodedPath = filePath.replace(/^\./, '%2E');
            const ok = await uploadFile(filePath, content);  // normal path
            if (ok) success++; else failed++;
        } catch (e) {
            console.error(`  ❌ 读取失败: ${filePath} - ${e.message}`);
            failed++;
        }
    }

    console.log(`\n📊 结果: ${success} 成功, ${failed} 失败`);
    if (failed > 0) process.exitCode = 1;
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
