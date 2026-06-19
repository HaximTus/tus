/**
 * Tus - 通过 GitHub API 部署脚本
 * 在中国内地直接使用 git push 可能失败时使用此脚本
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// 从 .env 文件读取 GitHub Token（不硬编码到代码中）
let TOKEN = '';
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    const envMatch = fs.readFileSync(envPath, 'utf-8').match(/^GITHUB_TOKEN=(.+)$/m);
    if (envMatch) TOKEN = envMatch[1].trim();
}
if (!TOKEN) {
    console.error('❌ 未找到 GitHub Token！请在项目根目录的 .env 文件中设置 GITHUB_TOKEN');
    process.exit(1);
}
const OWNER = 'tjiux';
const REPO = 'tus';
const BRANCH = 'main';

// 要上传的文件列表（相对于项目根目录）
const FILES_TO_UPLOAD = [
    'index.html',
    'subject-detail.html',
    'upload.html',
    'create-subject.html',
    'submit.html',
    'css/style.css',
    'js/api-client.js',
    'js/index.js',
    'js/subject-detail.js',
    'js/create-subject.js',
    'js/submit.js',
    'data/subjects.json',
    'data/papers.json',
    'CLAUDE.md',
    'README.md',
    'supabase-setup.sql',
    'scripts/manage.js',
    '.gitignore',
];

// 二进制/非文本文件（直接读 base64）
const BINARY_FILES = [
    'assets/papers/.gitkeep',
];

// 自动扫描 assets/papers/ 目录下的 PDF 文件（排除 pending 子目录）
function getPDFFiles(projectRoot) {
    const papersDir = path.join(projectRoot, 'assets', 'papers');
    const pdfFiles = [];
    try {
        const files = fs.readdirSync(papersDir);
        for (const file of files) {
            if (file === '.gitkeep' || file === 'pending') continue;
            if (file.toLowerCase().endsWith('.pdf')) {
                pdfFiles.push(`assets/papers/${file}`);
            }
        }
    } catch (e) {
        console.error('  ⚠️ 扫描 PDF 文件失败:', e.message);
    }
    return pdfFiles;
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

    const sha = await getFileSha(filePath);
    const body = {
        message: `Add ${filePath}`,
        content: encoded,
        branch: BRANCH,
    };
    if (sha) body.sha = sha;

    const result = await apiCall('PUT', `/repos/${OWNER}/${REPO}/contents/${filePath}`, body);

    if (result.status === 201 || result.status === 200) {
        console.log(`  ✅ 上传成功: ${filePath}`);
        return true;
    } else {
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

    // 上传文本文件
    for (const filePath of FILES_TO_UPLOAD) {
        const fullPath = path.join(projectRoot, filePath);
        try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const ok = await uploadFile(filePath, content);
            if (ok) success++; else failed++;
        } catch (e) {
            console.error(`  ❌ 读取失败: ${filePath} - ${e.message}`);
            failed++;
        }
    }

    // 上传二进制文件
    for (const filePath of BINARY_FILES) {
        const fullPath = path.join(projectRoot, filePath);
        try {
            const content = fs.readFileSync(fullPath).toString('base64');
            const ok = await uploadFile(filePath, content, true);
            if (ok) success++; else failed++;
        } catch (e) {
            console.error(`  ❌ 读取失败: ${filePath} - ${e.message}`);
            failed++;
        }
    }

    // 自动上传 assets/papers/ 下新增的 PDF 文件（已存在的跳过）
    const pdfFiles = getPDFFiles(projectRoot);
    if (pdfFiles.length > 0) {
        // 先检查哪些 PDF 已经在仓库中
        let newCount = 0;
        let skipCount = 0;
        for (const filePath of pdfFiles) {
            const sha = await getFileSha(filePath);
            if (sha) {
                // 文件已存在，跳过
                skipCount++;
                continue;
            }

            const fullPath = path.join(projectRoot, filePath);
            try {
                const stats = fs.statSync(fullPath);
                if (stats.size > 100 * 1024 * 1024) {
                    console.error(`  ⚠️ 跳过 ${filePath}：超过 GitHub 100MB 大小限制`);
                    failed++;
                    continue;
                }
                console.log(`  📄 新 PDF: ${filePath}`);
                const content = fs.readFileSync(fullPath).toString('base64');
                const ok = await uploadFile(filePath, content, true);
                if (ok) newCount++; else failed++;
            } catch (e) {
                console.error(`  ❌ 读取失败: ${filePath} - ${e.message}`);
                failed++;
            }
        }
        console.log(`  📊 PDF: ${newCount} 新上传, ${skipCount} 已存在跳过`);
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
}

main().catch(console.error);