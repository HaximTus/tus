/**
 * Tus - 管理脚本
 *
 * 使用方法:
 *   node scripts/manage.js
 *
 * 功能:
 *   1. 列出所有科目
 *   2. 新建科目
 *   3. 添加试卷
 *   4. 部署到 GitHub
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const readline = require('readline');

// GitHub 配置（从 .env 文件读取）
const GITHUB_OWNER = 'tjiux';
const GITHUB_REPO = 'tus';
let GITHUB_TOKEN = '';

// 尝试从项目根目录的 .env 文件读取 token
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/^GITHUB_TOKEN=(.+)$/m);
    if (match) {
        GITHUB_TOKEN = match[1].trim();
    }
}

// 如果 token 为空，提示用户
if (!GITHUB_TOKEN) {
    console.log('⚠️  未找到 GitHub Token！');
    console.log('请在项目根目录创建 .env 文件，添加：');
    console.log('  GITHUB_TOKEN=ghp_你的token\n');
}

const DATA_DIR = path.join(__dirname, '..', 'data');
const ASSETS_DIR = path.join(__dirname, '..', 'assets', 'papers');
const SUBJECTS_FILE = path.join(DATA_DIR, 'subjects.json');
const PAPERS_FILE = path.join(DATA_DIR, 'papers.json');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

function readJSON(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        return [];
    }
}

function writeJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf-8');
    console.log(`  ✅ 已更新: ${path.relative(path.join(__dirname, '..'), filePath)}`);
}

function formatSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ==================== 功能函数 ====================

async function listSubjects() {
    const subjects = readJSON(SUBJECTS_FILE);
    const papers = readJSON(PAPERS_FILE);

    console.log('\n📚 科目列表：');
    console.log('='.repeat(50));

    if (subjects.length === 0) {
        console.log('  (暂无科目)');
        return;
    }

    subjects.forEach(s => {
        const count = papers.filter(p => p.subject_id === s.id).length;
        console.log(`  [${s.id}] ${s.name}${s.teacher ? ` - ${s.teacher}` : ''}`);
        console.log(`       试卷: ${count} 份 | 创建: ${s.created_at || 'N/A'}`);
        console.log('');
    });
}

async function createSubject() {
    const subjects = readJSON(SUBJECTS_FILE);

    console.log('\n📖 新建科目：');
    console.log('-'.repeat(30));

    const name = await question('  科目名称: ');
    if (!name.trim()) {
        console.log('  ❌ 科目名称不能为空');
        return;
    }

    const teacher = await question('  授课教师 (选填): ');

    const maxId = subjects.reduce((max, s) => Math.max(max, s.id), 0);
    const newSubject = {
        id: maxId + 1,
        name: name.trim(),
        teacher: teacher.trim(),
        description: '',
        created_at: new Date().toISOString().split('T')[0]
    };

    subjects.push(newSubject);
    writeJSON(SUBJECTS_FILE, subjects);

    console.log(`  ✅ 科目 "${name}" 创建成功！(ID: ${newSubject.id})`);

    // 同时更新首页 api-client 的缓存
    console.log('\n  💡 接下来你可以：');
    console.log(`     1. 运行「添加试卷」为该科目上传试题`);
    console.log(`     2. 运行「部署到 GitHub」上线更新\n`);
}

async function addPaper() {
    const subjects = readJSON(SUBJECTS_FILE);
    const papers = readJSON(PAPERS_FILE);

    if (subjects.length === 0) {
        console.log('\n  ❌ 暂无科目，请先新建科目');
        return;
    }

    console.log('\n📤 添加试卷：');
    console.log('-'.repeat(30));

    // 选择科目
    console.log('\n  请选择科目：');
    subjects.forEach(s => console.log(`    [${s.id}] ${s.name}${s.teacher ? ` (${s.teacher})` : ''}`));

    const subjId = parseInt(await question('\n  科目编号: '));
    const subject = subjects.find(s => s.id === subjId);

    if (!subject) {
        console.log('  ❌ 无效的科目编号');
        return;
    }

    console.log(`  ✅ 已选择: ${subject.name}\n`);

    // 试卷信息
    const title = await question('  试卷标题 (如: 2024秋高等数学期末试卷): ');
    if (!title.trim()) {
        console.log('  ❌ 标题不能为空');
        return;
    }

    const year = await question('  年份 (如: 2024): ');
    const semester = await question('  学期 (期中/期末, 默认: 期末): ');
    const uploader = await question('  上传者 (选填): ');

    // PDF 文件
    console.log('\n  📂 PDF 文件：');
    console.log(`  请将 PDF 文件放入: assets/papers/`);
    const fileName = await question('  文件名 (如: 2024高数期末.pdf): ');

    const pdfPath = path.join(ASSETS_DIR, fileName);
    let fileSize = 0;
    let fileStats = null;

    try {
        fileStats = fs.statSync(pdfPath);
        fileSize = fileStats.size;
        console.log(`  ✅ 找到文件: ${fileName} (${formatSize(fileSize)})`);
    } catch {
        console.log(`  ⚠️  文件未找到: ${pdfPath}`);
        console.log('  请先将 PDF 文件放入 assets/papers/ 目录后重新运行');
        const cont = await question('  是否继续? (y/N): ');
        if (cont.toLowerCase() !== 'y') {
            console.log('  已取消');
            return;
        }
    }

    const maxId = papers.reduce((max, p) => Math.max(max, p.id), 0);

    const newPaper = {
        id: maxId + 1,
        subject_id: subjId,
        title: title.trim(),
        year: parseInt(year) || new Date().getFullYear(),
        semester: semester.trim() || '期末',
        file_url: '',
        file_path: fileName,
        file_name: fileName,
        file_size: fileSize,
        uploaded_by: uploader.trim() || '匿名',
        download_count: 0,
        created_at: new Date().toISOString().split('T')[0]
    };

    papers.push(newPaper);
    writeJSON(PAPERS_FILE, papers);

    console.log(`  ✅ 试卷 "${title}" 添加成功！`);
    console.log('\n  💡 运行「部署到 GitHub」将更新发布到线上\n');
}

async function deployToGitHub() {
    console.log('\n🚀 部署到 GitHub：');
    console.log('-'.repeat(30));

    const method = await question('  部署方式: [1]git push [2]API上传 (默认2): ');
    if (method === '1') {
        await deployViaGit();
    } else {
        await deployViaAPI();
    }
}

// 方式1: git push
async function deployViaGit() {
    const confirm = await question('  确定要提交并推送到 GitHub 吗? (y/N): ');
    if (confirm.toLowerCase() !== 'y') {
        console.log('  已取消');
        return;
    }

    const { execSync } = require('child_process');

    try {
        console.log('\n  1/3 暂存文件...');
        execSync('git add -A', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

        console.log('\n  2/3 提交更改...');
        execSync('git commit -m "update: 更新试卷数据"', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

        console.log('\n  3/3 推送到 GitHub...');
        execSync('git push', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

        console.log('\n  ✅ 部署成功！');
        console.log('  🔗 https://tjiux.github.io/tus/');
    } catch (e) {
        console.log(`\n  ❌ 部署失败: ${e.message}`);
        console.log('  建议改用 API 上传方式部署');
    }
}

// 方式2: API 上传（适合中国内地网络环境）
async function deployViaAPI() {
    console.log('\n  使用 API 上传文件到 GitHub...');
    console.log('  此方式会更新所有网页文件和数据文件\n');

    const confirm = await question('  确定要部署吗? (y/N): ');
    if (confirm.toLowerCase() !== 'y') {
        console.log('  已取消');
        return;
    }

    try {
        require(path.join(__dirname, 'deploy-via-api.js'));
    } catch (e) {
        // 直接运行部署脚本
        const { execSync } = require('child_process');
        try {
            execSync('node scripts/deploy-via-api.js', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
        } catch (e2) {
            console.log(`\n  ❌ 部署失败: ${e2.message}`);
        }
    }
}

// ==================== GitHub API 辅助函数 ====================

function githubAPI(method, path, body) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}${path}`,
            method: method,
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'tus-manage',
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                catch { resolve({ status: res.statusCode, data: data }); }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`下载失败: ${res.statusCode}`));
                return;
            }
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve(true);
            });
        }).on('error', (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
        });
    });
}

// ==================== 审核功能 ====================

async function reviewSubmissions() {
    console.log('\n📋 查看待审核的试卷提交：');
    console.log('-'.repeat(30));

    const result = await githubAPI('GET', `/issues?labels=待审核&state=open&sort=created&direction=desc`);

    if (result.status !== 200) {
        console.log('  ❌ 获取提交列表失败:', result.data?.message || '未知错误');
        return;
    }

    const issues = result.data || [];

    if (issues.length === 0) {
        console.log('  ✅ 暂无待审核的提交');
        return;
    }

    console.log(`  共有 ${issues.length} 个待审核提交：\n`);

    for (let i = 0; i < issues.length; i++) {
        const issue = issues[i];
        console.log(`  [${i + 1}] #${issue.number} ${issue.title}`);
        console.log(`      提交者: ${issue.user?.login || '未知'}`);
        console.log(`      时间: ${new Date(issue.created_at).toLocaleString('zh-CN')}`);
        console.log(`      链接: ${issue.html_url}`);
        console.log('');
    }

    const choice = await question('  选择要处理的编号 (输入编号, 或按回车跳过): ');
    const idx = parseInt(choice) - 1;

    if (isNaN(idx) || idx < 0 || idx >= issues.length) {
        console.log('  已跳过');
        return;
    }

    const selected = issues[idx];
    await handleSubmission(selected);
}

async function handleSubmission(issue) {
    console.log(`\n📄 处理: ${issue.title}`);
    console.log('-'.repeat(30));

    // 解析 Issue 内容
    const body = issue.body || '';
    const fields = {};

    // 从表格中提取信息
    const tableRegex = /\|\s*\*\*(.*?)\*\*\s*\|\s*(.*?)\s*\|/g;
    let match;
    while ((match = tableRegex.exec(body)) !== null) {
        fields[match[1].trim()] = match[2].trim();
    }

    // 提取 PDF 链接
    const urlRegex = /\[点击下载 PDF 文件\]\((https?:\/\/[^\s)]+)\)/;
    const urlMatch = body.match(urlRegex);

    const subject = fields['科目'] || '未知科目';
    const title = fields['标题'] || issue.title.replace('[新试卷] ', '');
    const year = fields['年份'] || '';
    const semester = fields['学期'] || '期末';
    const teacher = fields['教师'] || '';
    const uploader = fields['提交者'] || '热心同学';
    const pdfUrl = urlMatch ? urlMatch[1] : '';

    console.log(`\n  试卷信息:`);
    console.log(`    科目: ${subject}`);
    console.log(`    标题: ${title}`);
    console.log(`    年份: ${year} | 学期: ${semester}`);
    if (teacher) console.log(`    教师: ${teacher}`);
    console.log(`    提交者: ${uploader}`);
    if (pdfUrl) console.log(`    PDF: ${pdfUrl}`);

    console.log('');
    const action = await question('  操作: [a]接受并添加 [d]拒绝并关闭 [s]跳过 (a/d/s): ');

    if (action.toLowerCase() === 'a') {
        await acceptSubmission(issue, { subject, title, year, semester, teacher, uploader, pdfUrl });
    } else if (action.toLowerCase() === 'd') {
        await rejectSubmission(issue);
    } else {
        console.log('  已跳过');
    }
}

async function acceptSubmission(issue, info) {
    // 1. 下载 PDF
    let fileName = '';
    if (info.pdfUrl) {
        // 从 URL 提取文件名
        const ext = '.pdf';
        fileName = `${info.title.replace(/[\\/:*?"<>|]/g, '_')}${ext}`;
        const destPath = path.join(__dirname, '..', 'assets', 'papers', fileName);

        console.log(`  📥 正在下载 PDF...`);
        try {
            await downloadFile(info.pdfUrl, destPath);
            const stats = fs.statSync(destPath);
            console.log(`  ✅ PDF 已保存: assets/papers/${fileName} (${formatSize(stats.size)})`);
        } catch (e) {
            console.log(`  ⚠️ PDF 下载失败: ${e.message}`);
            const manual = await question('  是否手动放置 PDF 后继续? (y/N): ');
            if (manual.toLowerCase() !== 'y') {
                console.log('  已取消');
                return;
            }
            fileName = await question('  输入 PDF 文件名 (放在 assets/papers/ 下): ');
        }
    } else {
        console.log('  ⚠️ 此提交没有 PDF 链接');
        const manual = await question('  是否已手动放置 PDF? (y/N): ');
        if (manual.toLowerCase() !== 'y') {
            console.log('  已取消');
            return;
        }
        fileName = await question('  输入 PDF 文件名 (放在 assets/papers/ 下): ');
    }

    // 2. 添加到 papers.json
    const papers = readJSON(PAPERS_FILE);
    const subjects = readJSON(SUBJECTS_FILE);

    // 查找或创建科目
    let subjectEntry = subjects.find(s => s.name === info.subject);
    if (!subjectEntry) {
        console.log(`  📖 科目 "${info.subject}" 不存在，将自动创建`);
        const maxId = subjects.reduce((max, s) => Math.max(max, s.id), 0);
        subjectEntry = {
            id: maxId + 1,
            name: info.subject,
            teacher: info.teacher,
            description: '',
            created_at: new Date().toISOString().split('T')[0]
        };
        subjects.push(subjectEntry);
        writeJSON(SUBJECTS_FILE, subjects);
    }

    const maxId = papers.reduce((max, p) => Math.max(max, p.id), 0);
    let fileSize = 0;
    try {
        const stats = fs.statSync(path.join(__dirname, '..', 'assets', 'papers', fileName));
        fileSize = stats.size;
    } catch {}

    const newPaper = {
        id: maxId + 1,
        subject_id: subjectEntry.id,
        title: info.title,
        year: parseInt(info.year) || new Date().getFullYear(),
        semester: info.semester || '期末',
        file_url: '',
        file_path: fileName,
        file_name: fileName,
        file_size: fileSize,
        uploaded_by: info.uploader || '热心同学',
        download_count: 0,
        created_at: new Date().toISOString().split('T')[0]
    };

    papers.push(newPaper);
    writeJSON(PAPERS_FILE, papers);

    // 3. 关闭 Issue
    console.log(`  🔒 正在关闭 Issue #${issue.number}...`);
    await githubAPI('PATCH', `/issues/${issue.number}`, {
        state: 'closed',
        comment: `✅ 已审核通过并添加到试卷库！感谢 ${info.uploader} 的分享！`
    });

    console.log(`  ✅ 提交已处理完成！`);
    console.log(`  💡 运行「部署到 GitHub」即可更新线上网站`);
}

async function rejectSubmission(issue) {
    const reason = await question('  拒绝原因 (选填): ');

    const comment = `❌ 此提交未通过审核。`;
    await githubAPI('PATCH', `/issues/${issue.number}`, {
        state: 'closed',
        comment: reason ? `${comment}\n原因: ${reason}` : comment
    });

    console.log('  ✅ 已关闭 Issue');
}

async function main() {
    console.log('\n╔══════════════════════════╗');
    console.log('║        Tus 管理工具       ║');
    console.log('║  北京工业大学试卷共享平台  ║');
    console.log('╚══════════════════════════╝\n');

    while (true) {
        console.log('请选择操作：');
        console.log('  [1] 列出所有科目');
        console.log('  [2] 新建科目');
        console.log('  [3] 添加试卷');
        console.log('  [4] 查看待审核提交');
        console.log('  [5] 部署到 GitHub');
        console.log('  [0] 退出\n');

        const choice = await question('请输入编号: ');

        switch (choice.trim()) {
            case '1':
                await listSubjects();
                break;
            case '2':
                await createSubject();
                break;
            case '3':
                await addPaper();
                break;
            case '4':
                await reviewSubmissions();
                break;
            case '5':
                await deployToGitHub();
                break;
            case '0':
                console.log('\n👋 再见！\n');
                rl.close();
                return;
            default:
                console.log('  ❌ 无效选项，请重新选择');
        }

        console.log('');
        await question('按回车继续...');
        console.log('\n' + '='.repeat(50));
    }
}

main().catch(e => {
    console.error('发生错误:', e);
    rl.close();
});