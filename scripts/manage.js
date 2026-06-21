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
const os = require('os');
const { execSync } = require('child_process');

// GitHub 配置（从 .env 文件读取）
const GITHUB_OWNER = 'HaximTus';
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
        const gradeTag = s.grade ? ` [${s.grade}]` : '';
        console.log(`  [${s.id}] ${s.name}${gradeTag}${s.teacher ? ` - ${s.teacher}` : ''}`);
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

    let grade = await question('  适用年级 (1-大一 2-大二 3-大三 4-大四): ');
    const gradeMap = { '1': '大一', '2': '大二', '3': '大三', '4': '大四' };
    grade = gradeMap[grade.trim()] || grade.trim() || '';

    const teacher = await question('  授课教师 (选填): ');

    const maxId = subjects.reduce((max, s) => Math.max(max, s.id), 0);
    const newSubject = {
        id: maxId + 1,
        name: name.trim(),
        grade: grade,
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
    const semester = await question('  学期 (上学期期中/上学期期末/下学期期中/下学期期末, 默认 上学期期末): ');
    const grade = await question('  年级 (1-大一 2-大二 3-大三 4-大四, 默认继承科目年级): ');
    const uploader = await question('  上传者 (选填): ');

    // 试卷文件
    console.log('\n  📂 试卷文件：');
    console.log(`  请将文件放入: assets/papers/`);
    const fileName = await question('  文件名 (如: 2024高数期末.pdf 或 2024高数期末.docx): ');

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

    const gradeMap = { '1': '大一', '2': '大二', '3': '大三', '4': '大四' };
    const finalGrade = gradeMap[grade.trim()] || grade.trim() || subject.grade || '';

    const newPaper = {
        id: maxId + 1,
        subject_id: subjId,
        title: title.trim(),
        year: parseInt(year) || new Date().getFullYear(),
        semester: semester.trim() || '期末',
        grade: finalGrade,
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
        console.log('  🔗 https://HaximTus.github.io/tus/');
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

    const { execSync } = require('child_process');
    try {
        execSync('node scripts/deploy-via-api.js', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
    } catch (e) {
        console.log(`\n  ❌ 部署失败: ${e.message}`);
    }
}

// ==================== GitHub API 辅助函数 ====================

function githubAPI(method, path, body) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: encodeURI(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}${path}`),
            method: method,
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'tus-manage',
            }
        };

        // 对含 body 的请求设置 Content-Type
        if (body) {
            const bodyStr = JSON.stringify(body);
            options.headers['Content-Type'] = 'application/json';
            options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                    catch { resolve({ status: res.statusCode, data: data }); }
                });
            });
            req.on('error', reject);
            req.write(bodyStr);
            req.end();
        } else {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                    catch { resolve({ status: res.statusCode, data: data }); }
                });
            });
            req.on('error', reject);
            req.end();
        }
    });
}

// 通过 GitHub API 删除仓库中的文件
async function deleteRepoFile(repoPath) {
    if (!repoPath) return false;

    // 先获取文件的 SHA
    const getResult = await githubAPI('GET', `/contents/${repoPath}`);
    if (getResult.status !== 200) {
        console.log(`  ⚠️ 无法获取文件信息: ${getResult.data?.message || '未知错误'}`);
        return false;
    }

    const sha = getResult.data.sha;
    console.log(`  🗑️  删除文件: ${repoPath}`);

    const delResult = await githubAPI('DELETE', `/contents/${repoPath}`, {
        message: `清理: 删除 ${repoPath}`,
        sha: sha,
        branch: 'main'
    });

    if (delResult.status === 200) {
        console.log(`  ✅ 已从仓库删除`);
        return true;
    } else {
        console.log(`  ❌ 删除失败: ${delResult.data?.message || '未知错误'}`);
        return false;
    }
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
        console.log(`      🔗 Issue链接: ${issue.html_url}`);
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

    // 提取 PDF 链接或仓库路径
    const urlRegex = /\[下载 PDF 文件\]\((https?:\/\/[^\s)]+)\)/;
    const urlMatch = body.match(urlRegex);
    // 提取仓库路径
    const repoPathRegex = /仓库路径:\s*`(assets\/papers\/pending\/[^`]+)`/;
    const repoPathMatch = body.match(repoPathRegex);

    const subject = fields['科目'] || '未知科目';
    const title = fields['标题'] || issue.title.replace('[新试卷] ', '');
    const grade = fields['年级'] || '';
    const year = fields['年份'] || '';
    const semester = fields['学期'] || '期末';
    const teacher = fields['教师'] || '';
    const uploader = fields['提交者'] || '热心同学';
    const pdfUrl = urlMatch ? urlMatch[1] : '';
    const repoPath = repoPathMatch ? repoPathMatch[1] : '';

    console.log(`\n  试卷信息:`);
    console.log(`    科目: ${subject}`);
    console.log(`    标题: ${title}`);
    if (grade) console.log(`    年级: ${grade}`);
    console.log(`    年份: ${year} | 学期: ${semester}`);
    if (teacher) console.log(`    教师: ${teacher}`);
    console.log(`    提交者: ${uploader}`);
    if (repoPath) {
        console.log(`    仓库路径: ${repoPath}`);
        const encodedPath = encodeURI(repoPath);
        const rawFileUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/${encodedPath}`;
        const ext = path.extname(repoPath).toLowerCase();
        if (ext === '.pdf') {
            // 浏览器原生 PDF 渲染 — 使用 jsDelivr CDN（速度快，国内有节点）
            var cdnUrl = encodeURIComponent(`https://cdn.jsdelivr.net/gh/${GITHUB_OWNER}/${GITHUB_REPO}@main/${encodedPath}`);
            console.log(`    🔗 在线预览: https://${GITHUB_OWNER}.github.io/${GITHUB_REPO}/preview.html?url=${cdnUrl}`);
        } else {
            // Word/Office：Office Online Viewer 在线渲染
            console.log(`    🔗 在线预览: https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(rawFileUrl)}`);
        }
        console.log(`    🔗 原始下载: ${rawFileUrl}`);
    }
    if (pdfUrl) console.log(`    PDF链接: ${pdfUrl}`);

    console.log('');
    const renamePrompt = await question('  更改试卷名? (直接回车保持原名): ');
    const finalTitle = renamePrompt.trim() || title;

    const action = await question('  操作: [a]接受并添加 [d]拒绝并关闭 [s]跳过 (a/d/s): ');

    if (action.toLowerCase() === 'a') {
        await acceptSubmission(issue, { subject, title: finalTitle, grade, year, semester, teacher, uploader, pdfUrl, repoPath });
    } else if (action.toLowerCase() === 'd') {
        await rejectSubmission(issue, repoPath);
    } else {
        console.log('  已跳过');
    }
}

async function acceptSubmission(issue, info) {
    // 1. 获取 PDF 文件
    let fileName = '';
    const pendingDir = path.join(__dirname, '..', 'assets', 'papers', 'pending');
    const papersDir = path.join(__dirname, '..', 'assets', 'papers');

    // 情况1: 文件在仓库 pending 目录中
    if (info.repoPath) {
        const pendingFile = path.join(__dirname, '..', info.repoPath);
        const _ext = path.extname(info.repoPath) || '.pdf';
        fileName = `${info.title.replace(/[\/:*?"<>|]/g, '_')}${_ext}`;

        if (fs.existsSync(pendingFile)) {
            console.log(`  📄 在 pending 目录找到文件`);
            // 移动到正式目录
            const destPath = path.join(papersDir, fileName);
            fs.renameSync(pendingFile, destPath);
            const stats = fs.statSync(destPath);
            console.log(`  ✅ 已移动到: assets/papers/${fileName} (${formatSize(stats.size)})`);
        } else {
            console.log(`  ⚠️ pending 目录未找到文件, 通过 GitHub API 下载`);
            try {
                const destPath = path.join(papersDir, fileName);
                // 使用 GitHub API 下载（比 raw.githubusercontent.com 更稳定）
                const result = await githubAPI('GET', `/contents/${info.repoPath}`);
                if (result.status === 200 && result.data.content) {
                    const buffer = Buffer.from(result.data.content, 'base64');
                    fs.writeFileSync(destPath, buffer);
                    const stats = fs.statSync(destPath);
                    console.log(`  ✅ 已保存: assets/papers/${fileName} (${formatSize(stats.size)})`);
                } else {
                    throw new Error(result.data?.message || 'API 返回异常');
                }
            } catch (e2) {
                console.log(`  ⚠️ 下载失败: ${e2.message}`);
                const manual = await question('  是否手动放置文件后继续? (y/N): ');
                if (manual.toLowerCase() !== 'y') { console.log('  已取消'); return; }
                fileName = await question('  输入文件名 (放在 assets/papers/ 下): ');
            }
        }
    }
    // 情况2: 有 PDF 链接
    else if (info.pdfUrl) {
        const _ext2 = path.extname(new URL(info.pdfUrl).pathname) || '.pdf';
        fileName = `${info.title.replace(/[\/:*?"<>|]/g, '_')}${_ext2}`;
        const destPath = path.join(papersDir, fileName);

        console.log(`  📥 正在下载文件...`);
        try {
            await downloadFile(info.pdfUrl, destPath);
            const stats = fs.statSync(destPath);
            console.log(`  ✅ 已保存: assets/papers/${fileName} (${formatSize(stats.size)})`);
        } catch (e) {
            console.log(`  ⚠️ 下载失败: ${e.message}`);
            const manual = await question('  是否手动放置文件后继续? (y/N): ');
            if (manual.toLowerCase() !== 'y') { console.log('  已取消'); return; }
            fileName = await question('  输入文件名 (放在 assets/papers/ 下): ');
        }
    } else {
        console.log('  ⚠️ 此提交没有文件链接');
        const manual = await question('  是否已手动放置文件? (y/N): ');
        if (manual.toLowerCase() !== 'y') {
            console.log('  已取消');
            return;
        }
        fileName = await question('  输入文件名 (放在 assets/papers/ 下): ');
    }

    // 2. 添加到 papers.json
    const papers = readJSON(PAPERS_FILE);
    const subjects = readJSON(SUBJECTS_FILE);

    // 查找或创建科目
    let subjectEntry = subjects.find(s => s.name === info.subject);
    if (!subjectEntry) {
        console.log(`  📖 科目 "${info.subject}" 不存在，将自动创建`);
        // 如果提交中有年级信息，自动填入
        const grade = info.grade || await question('  请输入该科目的年级 (1-大一 2-大二 3-大三 4-大四): ');
        const gradeMap = { '1': '大一', '2': '大二', '3': '大三', '4': '大四' };
        const finalGrade = gradeMap[grade.trim()] || grade.trim() || '';

        const maxId = subjects.reduce((max, s) => Math.max(max, s.id), 0);
        subjectEntry = {
            id: maxId + 1,
            name: info.subject,
            grade: finalGrade,
            teacher: info.teacher,
            description: '',
            created_at: new Date().toISOString().split('T')[0]
        };
        subjects.push(subjectEntry);
        writeJSON(SUBJECTS_FILE, subjects);
        console.log(`  ✅ 自动创建科目: ${info.subject} (${finalGrade})`);
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

    // 2.5 清理 pending 中的文件
    if (info.repoPath) {
        console.log(`  🗑️  清理 pending 中的原文件...`);
        await deleteRepoFile(info.repoPath);
    }

    // 3. 关闭 Issue
    console.log(`  🔒 正在关闭 Issue #${issue.number}...`);
    await githubAPI('PATCH', `/issues/${issue.number}`, {
        state: 'closed',
        comment: `✅ 已审核通过并添加到试卷库！感谢 ${info.uploader} 的分享！`
    });

    console.log(`  ✅ 提交已处理完成！`);
    console.log(`  💡 运行「部署到 GitHub」即可更新线上网站`);
}

async function rejectSubmission(issue, repoPath) {
    const reason = await question('  拒绝原因 (选填): ');

    // 删除 pending 中的文件
    if (repoPath) {
        console.log('  🗑️  正在删除上传的文件...');
        await deleteRepoFile(repoPath);
    }

    const comment = `❌ 此提交未通过审核。`;
    await githubAPI('PATCH', `/issues/${issue.number}`, {
        state: 'closed',
        comment: reason ? `${comment}\n原因: ${reason}` : comment
    });

    console.log('  ✅ 已关闭 Issue');
}

// ==================== 清理 pending 目录 ====================

async function cleanPending() {
    console.log('\n🧹 清理 pending 目录：');
    console.log('-'.repeat(30));

    // 获取远程 pending 目录中的文件
    const result = await githubAPI('GET', '/contents/assets/papers/pending');
    if (result.status !== 200) {
        console.log('  ❌ 获取文件列表失败:', result.data?.message || '未知错误');
        return;
    }

    const files = (result.data || []).filter(f => f.name !== '.gitkeep' && f.type === 'file');

    if (files.length === 0) {
        console.log('  ✅ pending 目录为空，无需清理');
        return;
    }

    console.log(`  📄 共 ${files.length} 个文件：\n`);
    files.forEach((f, i) => {
        console.log(`  [${i + 1}] ${f.name} (${(f.size / 1024).toFixed(1)} KB)`);
    });

    console.log('');
    const choice = await question('  选择要删除的文件编号（逗号分隔，输入 all 删除全部，按回车跳过）: ');
    if (!choice.trim()) {
        console.log('  已跳过');
        return;
    }

    const toDelete = [];
    if (choice.trim().toLowerCase() === 'all') {
        toDelete.push(...files.map(f => f.path));
    } else {
        const indices = choice.split(',').map(s => parseInt(s.trim()) - 1);
        for (const idx of indices) {
            if (idx >= 0 && idx < files.length) {
                toDelete.push(files[idx].path);
            }
        }
    }

    if (toDelete.length === 0) {
        console.log('  没有选择有效的文件');
        return;
    }

    console.log(`\n  即将删除 ${toDelete.length} 个文件：`);
    toDelete.forEach(p => console.log(`    - ${p}`));

    const confirm = await question(`\n  确定删除? (y/N): `);
    if (confirm.toLowerCase() !== 'y') {
        console.log('  已取消');
        return;
    }

    for (const filePath of toDelete) {
        console.log('');
        await deleteRepoFile(filePath);
    }

    console.log(`\n  ✅ 清理完成！删除了 ${toDelete.length} 个文件`);
    console.log('  💡 运行「部署到 GitHub」将删除提交到远程仓库');
}

// ==================== 管理科目 ====================

async function manageSubjects() {
    const subjects = readJSON(SUBJECTS_FILE);
    if (subjects.length === 0) { console.log('\n  ❌ 暂无科目'); return; }

    console.log('\n📚 科目列表：');
    subjects.forEach(s => {
        const gradeTag = s.grade ? ` [${s.grade}]` : '';
        console.log(`  [${s.id}] ${s.name}${gradeTag}${s.teacher ? ` - ${s.teacher}` : ''}`);
    });

    const id = parseInt(await question('\n  选择科目编号: '));
    const subject = subjects.find(s => s.id === id);
    if (!subject) { console.log('  ❌ 无效编号'); return; }

    console.log(`\n  当前: ${subject.name} (${subject.grade || '无年级'})`);
    const action = await question('  操作: [r]重命名 [g]改年级 [d]删除 (按回车取消): ');
    if (action === 'r') {
        const newName = await question('  新名称: ');
        if (newName.trim()) {
            subject.name = newName.trim();
            writeJSON(SUBJECTS_FILE, subjects);
            console.log('  ✅ 科目已重命名');
        }
    } else if (action === 'g') {
        const newGrade = await question('  年级 (1-大一 2-大二 3-大三 4-大四, 空=清除): ');
        const gradeMap = { '1': '大一', '2': '大二', '3': '大三', '4': '大四' };
        subject.grade = gradeMap[newGrade.trim()] || newGrade.trim() || '';
        writeJSON(SUBJECTS_FILE, subjects);
        console.log('  ✅ 年级已更新');
    } else if (action === 'd') {
        const confirm = await question(`  确定删除科目 "${subject.name}" 及其所有试卷? (y/N): `);
        if (confirm.toLowerCase() === 'y') {
            const papers = readJSON(PAPERS_FILE);
            const filtered = papers.filter(p => p.subject_id !== subject.id);
            writeJSON(PAPERS_FILE, filtered);
            const updated = subjects.filter(s => s.id !== subject.id);
            writeJSON(SUBJECTS_FILE, updated);
            console.log(`  ✅ 已删除科目 "${subject.name}" 及其 ${papers.length - filtered.length} 份试卷`);
        }
    }
}

// ==================== 管理试卷 ====================

async function managePapers() {
    const subjects = readJSON(SUBJECTS_FILE);
    if (subjects.length === 0) { console.log('\n  ❌ 暂无科目'); return; }

    console.log('\n📚 选择科目：');
    subjects.forEach(s => console.log(`  [${s.id}] ${s.name}`));

    const subjId = parseInt(await question('\n  科目编号: '));
    const subject = subjects.find(s => s.id === subjId);
    if (!subject) { console.log('  ❌ 无效编号'); return; }

    const papers = readJSON(PAPERS_FILE);
    const items = papers.filter(p => p.subject_id === subjId);
    if (items.length === 0) { console.log('  📭 该科目暂无试卷'); return; }

    console.log(`\n📄 ${subject.name} 的试卷：`);
    items.forEach(p => console.log(`  [${p.id}] ${p.title} (${p.year} ${p.semester})`));

    const pid = parseInt(await question('\n  选择试卷编号: '));
    const paper = items.find(p => p.id === pid);
    if (!paper) { console.log('  ❌ 无效编号'); return; }

    console.log(`\n  当前: ${paper.title}`);
    const action = await question('  操作: [r]重命名 [m]移动科目 [d]删除 (按回车取消): ');
    if (action === 'r') {
        const newTitle = await question('  新标题: ');
        if (newTitle.trim()) {
            paper.title = newTitle.trim();
            writeJSON(PAPERS_FILE, papers);
            console.log('  ✅ 试卷已重命名');
        }
    } else if (action === 'm') {
        console.log('\n  目标科目：');
        subjects.forEach(s => console.log(`  [${s.id}] ${s.name}`));
        const targetId = parseInt(await question('  目标科目编号: '));
        if (subjects.find(s => s.id === targetId)) {
            paper.subject_id = targetId;
            writeJSON(PAPERS_FILE, papers);
            console.log('  ✅ 试卷已移动');
        } else {
            console.log('  ❌ 无效科目');
        }
    } else if (action === 'd') {
        const confirm = await question(`  确定删除 "${paper.title}"? 文件仍保留在本地. (y/N): `);
        if (confirm.toLowerCase() === 'y') {
            const updated = papers.filter(p => p.id !== paper.id);
            writeJSON(PAPERS_FILE, updated);
            console.log('  ✅ 试卷已删除');
        }
    }
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
        console.log('  [3] 管理科目（重命名/改年级/删除）');
        console.log('  [4] 添加试卷');
        console.log('  [5] 管理试卷（重命名/移动/删除）');
        console.log('  [6] 查看待审核提交');
        console.log('  [7] 部署到 GitHub');
        console.log('  [8] 清理 pending 目录（已处理文件）');
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
                await manageSubjects();
                break;
            case '4':
                await addPaper();
                break;
            case '5':
                await managePapers();
                break;
            case '6':
                await reviewSubmissions();
                break;
            case '7':
                await deployToGitHub();
                break;
            case '8':
                await cleanPending();
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