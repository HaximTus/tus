/**
 * Tus - 管理后台
 * 通过 GitHub API 管理科目、试卷、审核提交
 */

const GITHUB_OWNER = 'HaximTus';
const GITHUB_REPO = 'tus';
const BRANCH = 'main';
let TOKEN = '';
let currentTab = 'dashboard';

// ========== 工具函数 ==========
function $(id) { return document.getElementById(id); }
function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
function qsa(sel, ctx) { return (ctx || document).querySelectorAll(sel); }

function formatSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(text) {
    var d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

// ========== Toast ==========
function showToast(msg, type) {
    var t = $('adminToast');
    t.textContent = msg;
    t.className = 'admin-toast show ' + (type || 'success');
    clearTimeout(t._hide);
    t._hide = setTimeout(function() { t.classList.remove('show'); }, 3000);
}

// ========== GitHub API ==========
async function gh(method, path, body) {
    var opts = {
        method: method,
        headers: {
            'Authorization': 'token ' + TOKEN,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'tus-admin',
        }
    };
    if (body) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    }
    var resp = await fetch('https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + path, opts);
    var data;
    try { data = await resp.json(); } catch(e) { data = null; }
    return { status: resp.status, data: data, ok: resp.ok };
}

async function ghGet(path) { return gh('GET', path); }
async function ghPut(path, body) { return gh('PUT', path, body); }
async function ghPatch(path, body) { return gh('PATCH', path, body); }
async function ghDel(path) { return gh('DELETE', path); }

async function getFileSha(filePath) {
    var r = await ghGet('/contents/' + filePath + '?ref=' + BRANCH);
    return r.status === 200 ? r.data.sha : null;
}

async function uploadFile(filePath, content, msg) {
    // 失败自动重试一次（应对 GitHub API 限流抖动）
    for (var attempt = 0; attempt < 2; attempt++) {
        var sha = await getFileSha(filePath);
        var body = { message: msg || 'Update ' + filePath, content: btoa(unescape(encodeURIComponent(content))), branch: BRANCH };
        if (sha) body.sha = sha;
        var r = await ghPut('/contents/' + filePath, body);
        if (r.ok) return true;
        if (attempt === 0) await new Promise(function(r) { setTimeout(r, 1000); });
    }
    return false;
}

async function deleteRepoFile(filePath) {
    var sha = await getFileSha(filePath);
    if (!sha) return true;
    var r = await ghDel('/contents/' + filePath, { message: 'Delete ' + filePath, sha: sha, branch: BRANCH });
    return r.ok;
}

function readJson(str) {
    try { return JSON.parse(str); } catch(e) { return []; }
}

// ========== 暗色模式 ==========
(function() {
    var KEY = 'tus_dark';
    function applyDark(isDark) {
        if (isDark) { document.documentElement.classList.add('dark'); } else { document.documentElement.classList.remove('dark'); }
        var btn = document.getElementById('adminDarkToggle');
        if (btn) btn.textContent = isDark ? '亮' : '暗';
    }
    var stored = localStorage.getItem(KEY);
    if (stored === '1') applyDark(true);
    else if (stored === '0') applyDark(false);
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) { applyDark(true); localStorage.setItem(KEY, '1'); }
    else { var btn = document.getElementById('adminDarkToggle'); if (btn) btn.textContent = '暗'; }
})();
function toggleAdminDark() {
    var isDark = !document.documentElement.classList.contains('dark');
    if (isDark) { document.documentElement.classList.add('dark'); localStorage.setItem('tus_dark', '1'); } else { document.documentElement.classList.remove('dark'); localStorage.setItem('tus_dark', '0'); }
    var btn = document.getElementById('adminDarkToggle');
    if (btn) btn.textContent = isDark ? '亮' : '暗';
}

// ========== 密码登录 ==========
function initLoginPage() {
    var saved = localStorage.getItem('tus_admin_pwd');
    if (saved) {
        $('loginSetup').classList.add('hidden');
        $('loginSignin').classList.remove('hidden');
    }
}

function showSetup() {
    localStorage.removeItem('tus_admin_pwd');
    localStorage.removeItem('tus_admin_token');
    $('loginSignin').classList.add('hidden');
    $('loginSetup').classList.remove('hidden');
    $('loginError').classList.add('hidden');
}

function setupLogin() {
    var pwd = $('setupPassword').value;
    var pwd2 = $('setupPassword2').value;
    var token = $('setupToken').value.trim();
    if (!pwd || !pwd2 || !token) { showToast('请填写完整信息', 'error'); return; }
    if (pwd !== pwd2) { showToast('两次密码不一致', 'error'); return; }
    TOKEN = token;
    ghGet('').then(function(r) {
        if (r.ok) {
            localStorage.setItem('tus_admin_pwd', btoa(pwd));
            localStorage.setItem('tus_admin_token', btoa(token));
            enterAdmin();
        } else {
            showToast('Token 无效，请检查', 'error');
            TOKEN = '';
        }
    });
}

function passwordLogin() {
    var pwd = $('loginPassword').value;
    var saved = localStorage.getItem('tus_admin_pwd');
    if (saved && btoa(pwd) === saved) {
        TOKEN = atob(localStorage.getItem('tus_admin_token') || '');
        if (!TOKEN) { showToast('Token 丢失，请重新设置', 'error'); showSetup(); return; }
        enterAdmin();
    } else {
        $('loginError').classList.remove('hidden');
    }
}

function enterAdmin() {
    $('loginError').classList.add('hidden');
    $('loginPage').style.display = 'none';
    $('adminApp').style.display = '';
    initAdmin();
}

function adminLogout() {
    TOKEN = '';
    $('adminApp').style.display = 'none';
    $('loginPage').style.display = '';
    $('loginPassword').value = '';
    qsa('.tab-content').forEach(function(el) { el.classList.add('hidden'); });
    $('tabDashboard').classList.remove('hidden');
    qsa('.tab-link').forEach(function(el) { el.classList.remove('active'); });
    qs('.tab-link[data-tab="dashboard"]').classList.add('active');
    currentTab = 'dashboard';
    initLoginPage();
}

// ========== 标签切换 ==========
function switchTab(tab) {
    qsa('.tab-content').forEach(function(el) { el.classList.add('hidden'); });
    qsa('.tab-link').forEach(function(el) { el.classList.remove('active'); });
    qs('.tab-link[data-tab="' + tab + '"]').classList.add('active');
    $('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.remove('hidden');
    currentTab = tab;
    if (tab === 'subjects') loadSubjects();
    if (tab === 'papers') loadPapers();
    if (tab === 'review') loadReviewList();
    if (tab === 'pending') loadPendingFiles();
    if (tab === 'dashboard') loadDashboard();
}

// ========== Modal ==========
function showModal(html) {
    $('adminModalContent').innerHTML = html;
    $('adminModal').style.display = 'flex';
}
function closeModal() { $('adminModal').style.display = 'none'; }
$('adminModal').addEventListener('click', function(e) { if (e.target === this) closeModal(); });

// ========== 初始化 ==========
initLoginPage();

function initAdmin() {
    loadDashboard();
    checkPendingCount();
}

// ========== 概览 ==========
async function loadDashboard() {
    $('dashRecentContent').innerHTML = '<div class="admin-spinner"></div> 加载中...';
    try {
        var [subsRes, papersRes] = await Promise.all([
            ghGet('/contents/data/subjects.json?ref=' + BRANCH),
            ghGet('/contents/data/papers.json?ref=' + BRANCH)
        ]);
        var subs = subsRes.ok ? readJson(decodeURIComponent(escape(atob(subsRes.data.content)))) : [];
        var papers = papersRes.ok ? readJson(decodeURIComponent(escape(atob(papersRes.data.content)))) : [];

        var totalPapers = papers.length;
        var totalSubjects = subs.length;
        var wordCount = papers.filter(function(p) { return /\.docx?$/i.test(p.file_path); }).length;

        $('dashStats').innerHTML =
            '<div class="stat-card bg-white dark:bg-stone-800 rounded-xl shadow-sm border border-stone-100 dark:border-stone-700 p-4 text-center"><div class="text-2xl font-bold text-stone-800 dark:text-stone-100">' + totalSubjects + '</div><div class="text-xs text-stone-400 mt-1">科目</div></div>'
            + '<div class="stat-card bg-white dark:bg-stone-800 rounded-xl shadow-sm border border-stone-100 dark:border-stone-700 p-4 text-center"><div class="text-2xl font-bold text-stone-800 dark:text-stone-100">' + totalPapers + '</div><div class="text-xs text-stone-400 mt-1">试卷</div></div>'
            + '<div class="stat-card bg-white dark:bg-stone-800 rounded-xl shadow-sm border border-stone-100 dark:border-stone-700 p-4 text-center"><div class="text-2xl font-bold text-stone-800 dark:text-stone-100">' + wordCount + '</div><div class="text-xs text-stone-400 mt-1">Word 文件</div></div>';

        // Recent
        var recent = papers.slice().sort(function(a, b) { return b.id - a.id; }).slice(0, 5);
        var subsMap = {};
        subs.forEach(function(s) { subsMap[s.id] = s.name; });
        $('dashRecentContent').innerHTML = recent.length
            ? '<table class="admin-table"><thead><tr><th>标题</th><th>科目</th><th>年份</th><th>上传者</th></tr></thead><tbody>'
                + recent.map(function(p) { return '<tr><td class="font-medium text-stone-700 dark:text-stone-200">' + escapeHtml(p.title) + '</td><td class="text-stone-500">' + escapeHtml(subsMap[p.subject_id] || '未知') + '</td><td class="text-stone-500">' + p.year + '</td><td class="text-stone-500">' + escapeHtml(p.uploaded_by || '匿名') + '</td></tr>'; }).join('')
                + '</tbody></table>'
            : '<p class="text-stone-400">暂无数据</p>';
    } catch(e) {
        $('dashRecentContent').innerHTML = '<p class="text-red-500">加载失败: ' + e.message + '</p>';
    }
}

async function checkPendingCount() {
    try {
        var r = await ghGet('/issues?labels=待审核&state=open&per_page=1');
        if (r.ok && r.data && r.data.length > 0) {
            $('pendingCount').textContent = r.data.length;
            $('pendingCount').classList.remove('hidden');
        }
    } catch(e) {}
}

// ========== 科目管理 ==========
async function loadSubjects() {
    $('subjectsList').innerHTML = '<div class="admin-spinner"></div> 加载中...';
    try {
        var r = await ghGet('/contents/data/subjects.json?ref=' + BRANCH);
        if (!r.ok) { $('subjectsList').innerHTML = '<p class="text-red-500">加载失败</p>'; return; }
        var subs = readJson(decodeURIComponent(escape(atob(r.data.content))));
        if (!subs.length) { $('subjectsList').innerHTML = '<p class="text-stone-400">暂无科目</p>'; return; }

        var pRes = await ghGet('/contents/data/papers.json?ref=' + BRANCH);
        var papers = pRes.ok ? readJson(decodeURIComponent(escape(atob(pRes.data.content)))) : [];

        var html = '<table class="admin-table"><thead><tr><th>ID</th><th>名称</th><th>年级</th><th>教师</th><th>试卷数</th><th>操作</th></tr></thead><tbody>';
        subs.forEach(function(s) {
            var cnt = papers.filter(function(p) { return p.subject_id === s.id; }).length;
            html += '<tr><td class="text-stone-400 text-xs">' + s.id + '</td>'
                + '<td class="font-medium text-stone-700 dark:text-stone-200">' + escapeHtml(s.name) + '</td>'
                + '<td>' + (s.grade ? '<span class="admin-tag admin-tag-green">' + escapeHtml(s.grade) + '</span>' : '-') + '</td>'
                + '<td class="text-stone-500">' + escapeHtml(s.teacher || '-') + '</td>'
                + '<td class="text-stone-500">' + cnt + '</td>'
                + '<td><button onclick="editSubject(' + s.id + ')" class="text-amber-600 hover:text-amber-700 text-sm mr-2">编辑</button><button onclick="deleteSubject(' + s.id + ')" class="text-red-500 hover:text-red-600 text-sm">删除</button></td></tr>';
        });
        html += '</tbody></table>';
        $('subjectsList').innerHTML = html;
    } catch(e) { $('subjectsList').innerHTML = '<p class="text-red-500">加载失败: ' + e.message + '</p>'; }
}

function showCreateSubject() {
    showModal(
        '<h3 class="text-lg font-bold text-stone-800 dark:text-stone-100 mb-4">新建科目</h3>'
        + '<div class="space-y-3"><div><label class="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-1">名称 *</label><input id="modalSubjName" class="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"></div>'
        + '<div><label class="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-1">年级</label><select id="modalSubjGrade" class="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"><option value="">无</option><option value="大一">大一</option><option value="大二">大二</option><option value="大三">大三</option><option value="大四">大四</option></select></div>'
        + '<div><label class="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-1">教师（选填）</label><input id="modalSubjTeacher" class="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"></div></div>'
        + '<div class="flex gap-2 mt-6"><button onclick="createSubject()" class="flex-1 bg-yellow-600 dark:bg-yellow-500 text-stone-900 py-2.5 rounded-lg hover:bg-yellow-700 dark:hover:bg-yellow-400 font-medium transition-colors text-sm">创建</button><button onclick="closeModal()" class="flex-1 bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 py-2.5 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-600 transition-colors text-sm">取消</button></div>'
    );
}

async function createSubject() {
    var name = $('modalSubjName').value.trim();
    if (!name) { showToast('请输入科目名称', 'error'); return; }
    var grade = $('modalSubjGrade').value;
    var teacher = $('modalSubjTeacher').value.trim();

    var r = await ghGet('/contents/data/subjects.json?ref=' + BRANCH);
    if (!r.ok) { showToast('读取数据失败', 'error'); return; }
    var subs = readJson(decodeURIComponent(escape(atob(r.data.content))));
    var maxId = subs.reduce(function(m, s) { return Math.max(m, s.id); }, 0);
    subs.push({ id: maxId + 1, name: name, grade: grade, teacher: teacher, description: '', created_at: new Date().toISOString().split('T')[0] });
    var ok = await uploadFile('data/subjects.json', JSON.stringify(subs, null, 4), 'Add subject: ' + name);
    if (ok) { showToast('科目已创建'); closeModal(); loadSubjects(); }
    else showToast('创建失败', 'error');
}

function editSubject(id) {
    ghGet('/contents/data/subjects.json?ref=' + BRANCH).then(function(r) {
        if (!r.ok) return;
        var subs = readJson(decodeURIComponent(escape(atob(r.data.content))));
        var s = subs.find(function(x) { return x.id === id; });
        if (!s) return;
        showModal(
            '<h3 class="text-lg font-bold text-stone-800 dark:text-stone-100 mb-4">编辑科目</h3>'
            + '<div class="space-y-3"><div><label class="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-1">名称 *</label><input id="modalSubjName" value="' + escapeHtml(s.name) + '" class="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"></div>'
            + '<div><label class="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-1">年级</label><select id="modalSubjGrade" class="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"><option value="">无</option><option value="大一" ' + (s.grade === '大一' ? 'selected' : '') + '>大一</option><option value="大二" ' + (s.grade === '大二' ? 'selected' : '') + '>大二</option><option value="大三" ' + (s.grade === '大三' ? 'selected' : '') + '>大三</option><option value="大四" ' + (s.grade === '大四' ? 'selected' : '') + '>大四</option></select></div>'
            + '<div><label class="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-1">教师</label><input id="modalSubjTeacher" value="' + escapeHtml(s.teacher || '') + '" class="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"></div></div>'
            + '<div class="flex gap-2 mt-6"><button onclick="saveSubject(' + id + ')" class="flex-1 bg-yellow-600 dark:bg-yellow-500 text-stone-900 py-2.5 rounded-lg hover:bg-yellow-700 dark:hover:bg-yellow-400 font-medium transition-colors text-sm">保存</button><button onclick="closeModal()" class="flex-1 bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 py-2.5 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-600 transition-colors text-sm">取消</button></div>'
        );
    });
}

async function saveSubject(id) {
    var name = $('modalSubjName').value.trim();
    if (!name) { showToast('请输入科目名称', 'error'); return; }
    var grade = $('modalSubjGrade').value;
    var teacher = $('modalSubjTeacher').value.trim();
    var r = await ghGet('/contents/data/subjects.json?ref=' + BRANCH);
    if (!r.ok) { showToast('读取失败', 'error'); return; }
    var subs = readJson(decodeURIComponent(escape(atob(r.data.content))));
    var s = subs.find(function(x) { return x.id === id; });
    if (!s) { showToast('科目不存在', 'error'); return; }
    s.name = name; s.grade = grade; s.teacher = teacher;
    var ok = await uploadFile('data/subjects.json', JSON.stringify(subs, null, 4), 'Edit subject: ' + name);
    if (ok) { showToast('已保存'); closeModal(); loadSubjects(); } else showToast('保存失败', 'error');
}

async function deleteSubject(id) {
    if (!confirm('确定删除此科目及其所有试卷？')) return;
    var [r1, r2] = await Promise.all([
        ghGet('/contents/data/subjects.json?ref=' + BRANCH),
        ghGet('/contents/data/papers.json?ref=' + BRANCH)
    ]);
    if (!r1.ok || !r2.ok) { showToast('读取数据失败', 'error'); return; }
    var subs = readJson(decodeURIComponent(escape(atob(r1.data.content))));
    var papers = readJson(decodeURIComponent(escape(atob(r2.data.content))));
    var subName = (subs.find(function(s) { return s.id === id; }) || {}).name;
    subs = subs.filter(function(s) { return s.id !== id; });
    papers = papers.filter(function(p) { return p.subject_id !== id; });
    var ok1 = await uploadFile('data/subjects.json', JSON.stringify(subs, null, 4), 'Delete subject: ' + subName);
    var ok2 = await uploadFile('data/papers.json', JSON.stringify(papers, null, 4), 'Delete papers for subject: ' + subName);
    if (ok1 && ok2) { showToast('已删除'); loadSubjects(); } else showToast('删除失败', 'error');
}

// ========== 试卷管理 ==========
async function loadPapers() {
    $('papersList').innerHTML = '<div class="admin-spinner"></div> 加载中...';
    try {
        var [r1, r2] = await Promise.all([
            ghGet('/contents/data/papers.json?ref=' + BRANCH),
            ghGet('/contents/data/subjects.json?ref=' + BRANCH)
        ]);
        if (!r1.ok) { $('papersList').innerHTML = '<p class="text-red-500">加载失败</p>'; return; }
        var papers = readJson(decodeURIComponent(escape(atob(r1.data.content))));
        var subs = r2.ok ? readJson(decodeURIComponent(escape(atob(r2.data.content)))) : [];
        var subsMap = {};
        subs.forEach(function(s) { subsMap[s.id] = s.name; });
        if (!papers.length) { $('papersList').innerHTML = '<p class="text-stone-400">暂无试卷</p>'; return; }

        html = '<table class="admin-table"><thead><tr><th>ID</th><th>标题</th><th>科目</th><th>年份</th><th>学期</th><th>文件</th><th>出卷人</th><th>上传者</th><th>操作</th></tr></thead><tbody>';
        papers.sort(function(a, b) { return b.id - a.id; }).forEach(function(p) {
            html += '<tr><td class="text-stone-400 text-xs">' + p.id + '</td>'
                + '<td class="font-medium text-stone-700 dark:text-stone-200" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escapeHtml(p.title) + '">' + escapeHtml(p.title) + '</td>'
                + '<td class="text-stone-500 text-xs">' + escapeHtml(subsMap[p.subject_id] || '?') + '</td>'
                + '<td class="text-stone-500">' + p.year + '</td>'
                + '<td class="text-stone-500 text-xs">' + escapeHtml(p.semester) + '</td>'
                + '<td class="text-stone-500 text-xs">' + (p.file_path ? escapeHtml(p.file_path.split('/').pop()) : '-') + '</td>'
                + '<td class="text-stone-500 text-xs">' + escapeHtml(p.setter || '') + '</td>'
                + '<td class="text-stone-500 text-xs">' + escapeHtml(p.uploaded_by || '匿名') + '</td>'
                + '<td><button onclick="editPaper(' + p.id + ')" class="text-amber-600 hover:text-amber-700 text-sm mr-2">编辑</button><button onclick="deletePaper(' + p.id + ')" class="text-red-500 hover:text-red-600 text-sm">删除</button></td></tr>';
        });
        html += '</tbody></table>';
        $('papersList').innerHTML = html;
    } catch(e) { $('papersList').innerHTML = '<p class="text-red-500">加载失败: ' + e.message + '</p>'; }
}

function showAddPaper() {
    ghGet('/contents/data/subjects.json?ref=' + BRANCH).then(function(r) {
        if (!r.ok) return;
        var subs = readJson(decodeURIComponent(escape(atob(r.data.content))));
        var subOpts = subs.map(function(s) { return '<option value="' + s.id + '">' + escapeHtml(s.name) + '</option>'; }).join('');
        showModal(
            '<h3 class="text-lg font-bold text-stone-800 dark:text-stone-100 mb-4">添加试卷</h3>'
            + '<div class="space-y-3">'
            + '<div><label class="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-1">科目 *</label><select id="modalPaperSubj" class="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-lg text-sm">' + subOpts + '</select></div>'
            + '<div><label class="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-1">标题 *</label><input id="modalPaperTitle" class="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-lg text-sm"></div>'
            + '<div><label class="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-1">年份</label><input id="modalPaperYear" value="' + new Date().getFullYear() + '" class="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-lg text-sm"></div>'
            + '<div><label class="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-1">学期</label><select id="modalPaperSem" class="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-lg text-sm"><option>上学期期末</option><option>上学期期中</option><option>下学期期末</option><option>下学期期中</option></select></div>'
            + '<div><label class="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-1">文件名（assets/papers/ 下）*</label><input id="modalPaperFile" placeholder="如: 2024高数期末.pdf" class="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-lg text-sm"></div>'
            + '<div><label class="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-1">出卷人（选填）</label><input id="modalPaperSetter" class="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-lg text-sm"></div>'
            + '<div><label class="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-1">上传者（选填）</label><input id="modalPaperUploader" class="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-lg text-sm"></div>'
            + '</div>'
            + '<div class="flex gap-2 mt-6"><button onclick="addPaper()" class="flex-1 bg-yellow-600 dark:bg-yellow-500 text-stone-900 py-2.5 rounded-lg hover:bg-yellow-700 dark:hover:bg-yellow-400 font-medium transition-colors text-sm">添加</button><button onclick="closeModal()" class="flex-1 bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 py-2.5 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-600 transition-colors text-sm">取消</button></div>'
        );
    });
}

async function addPaper() {
    var subjId = parseInt($('modalPaperSubj').value);
    var title = $('modalPaperTitle').value.trim();
    var year = parseInt($('modalPaperYear').value) || new Date().getFullYear();
    var sem = $('modalPaperSem').value;
    var filePath = $('modalPaperFile').value.trim();
    var setter = $('modalPaperSetter').value.trim();
    var uploader = $('modalPaperUploader').value.trim() || '管理员';
    if (!title || !filePath) { showToast('请填写标题和文件名', 'error'); return; }

    var r = await ghGet('/contents/data/papers.json?ref=' + BRANCH);
    if (!r.ok) { showToast('读取数据失败', 'error'); return; }
    var papers = readJson(decodeURIComponent(escape(atob(r.data.content))));
    var maxId = papers.reduce(function(m, p) { return Math.max(m, p.id); }, 0);
    papers.push({ id: maxId + 1, subject_id: subjId, title: title, year: year, semester: sem, setter: setter, file_url: '', file_path: filePath, file_name: filePath, file_size: 0, uploaded_by: uploader, created_at: new Date().toISOString().split('T')[0] });
    var ok = await uploadFile('data/papers.json', JSON.stringify(papers, null, 4), 'Add paper: ' + title);
    if (ok) { showToast('试卷已添加'); closeModal(); loadPapers(); } else showToast('添加失败', 'error');
}

function editPaper(id) {
    Promise.all([
        ghGet('/contents/data/papers.json?ref=' + BRANCH),
        ghGet('/contents/data/subjects.json?ref=' + BRANCH)
    ]).then(function(results) {
        if (!results[0].ok) return;
        var papers = readJson(decodeURIComponent(escape(atob(results[0].data.content))));
        var p = papers.find(function(x) { return x.id === id; });
        if (!p) return;
        var subs = results[1].ok ? readJson(decodeURIComponent(escape(atob(results[1].data.content)))) : [];
        var subOpts = subs.map(function(s) { return '<option value="' + s.id + '" ' + (s.id === p.subject_id ? 'selected' : '') + '>' + escapeHtml(s.name) + '</option>'; }).join('');
        showModal(
            '<h3 class="text-lg font-bold text-stone-800 dark:text-stone-100 mb-4">编辑试卷</h3>'
            + '<div class="space-y-3">'
            + '<div><label class="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-1">科目</label><select id="modalPaperSubj" class="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-lg text-sm">' + subOpts + '</select></div>'
            + '<div><label class="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-1">标题</label><input id="modalPaperTitle" value="' + escapeHtml(p.title) + '" class="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-lg text-sm"></div>'
            + '<div><label class="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-1">年份</label><input id="modalPaperYear" value="' + p.year + '" class="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-lg text-sm"></div>'
            + '<div><label class="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-1">学期</label><select id="modalPaperSem" class="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-lg text-sm"><option ' + (p.semester === '上学期期末' ? 'selected' : '') + '>上学期期末</option><option ' + (p.semester === '上学期期中' ? 'selected' : '') + '>上学期期中</option><option ' + (p.semester === '下学期期末' ? 'selected' : '') + '>下学期期末</option><option ' + (p.semester === '下学期期中' ? 'selected' : '') + '>下学期期中</option></select></div>'
            + '<div><label class="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-1">文件路径</label><input id="modalPaperFile" value="' + escapeHtml(p.file_path || '') + '" class="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-lg text-sm"></div>'
            + '<div><label class="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-1">出卷人</label><input id="modalPaperSetter" value="' + escapeHtml(p.setter || '') + '" class="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-lg text-sm"></div>'
            + '<div><label class="block text-sm font-medium text-stone-600 dark:text-stone-300 mb-1">上传者</label><input id="modalPaperUploader" value="' + escapeHtml(p.uploaded_by || '') + '" class="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-lg text-sm"></div>'
            + '</div>'
            + '<div class="flex gap-2 mt-6"><button onclick="savePaper(' + id + ')" class="flex-1 bg-yellow-600 dark:bg-yellow-500 text-stone-900 py-2.5 rounded-lg hover:bg-yellow-700 dark:hover:bg-yellow-400 font-medium transition-colors text-sm">保存</button><button onclick="closeModal()" class="flex-1 bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 py-2.5 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-600 transition-colors text-sm">取消</button></div>'
        );
    });
}

async function savePaper(id) {
    var subjId = parseInt($('modalPaperSubj').value);
    var title = $('modalPaperTitle').value.trim();
    var year = parseInt($('modalPaperYear').value) || new Date().getFullYear();
    var sem = $('modalPaperSem').value;
    var filePath = $('modalPaperFile').value.trim();
    var uploader = $('modalPaperUploader').value.trim();
    if (!title) { showToast('请输入标题', 'error'); return; }
    var r = await ghGet('/contents/data/papers.json?ref=' + BRANCH);
    if (!r.ok) { showToast('读取失败', 'error'); return; }
    var papers = readJson(decodeURIComponent(escape(atob(r.data.content))));
    var p = papers.find(function(x) { return x.id === id; });
    if (!p) { showToast('试卷不存在', 'error'); return; }
    p.subject_id = subjId; p.title = title; p.year = year; p.semester = sem; p.file_path = filePath; p.file_name = filePath; p.setter = $('modalPaperSetter').value.trim(); p.uploaded_by = uploader;
    var ok = await uploadFile('data/papers.json', JSON.stringify(papers, null, 4), 'Edit paper: ' + title);
    if (ok) { showToast('已保存'); closeModal(); loadPapers(); } else showToast('保存失败', 'error');
}

async function deletePaper(id) {
    if (!confirm('确定删除此试卷？（文件保留在仓库中）')) return;
    var r = await ghGet('/contents/data/papers.json?ref=' + BRANCH);
    if (!r.ok) { showToast('读取失败', 'error'); return; }
    var papers = readJson(decodeURIComponent(escape(atob(r.data.content))));
    var title = (papers.find(function(x) { return x.id === id; }) || {}).title;
    papers = papers.filter(function(p) { return p.id !== id; });
    var ok = await uploadFile('data/papers.json', JSON.stringify(papers, null, 4), 'Delete paper: ' + title);
    if (ok) { showToast('已删除'); loadPapers(); } else showToast('删除失败', 'error');
}

// ========== 审核提交 ==========
async function loadReviewList() {
    $('reviewList').innerHTML = '<div class="admin-spinner"></div> 加载中...';
    try {
        var r = await ghGet('/issues?labels=待审核&state=open&sort=created&direction=desc');
        if (!r.ok) { $('reviewList').innerHTML = '<p class="text-red-500">获取提交列表失败</p>'; return; }
        var issues = r.data || [];
        if (!issues.length) { $('reviewList').innerHTML = '<p class="text-stone-400">✅ 暂无待审核的提交</p>'; return; }

        var html = '';
        issues.forEach(function(issue, idx) {
            var fields = {};
            (issue.body || '').replace(/\|\s*\*\*(.*?)\*\*\s*\|\s*(.*?)\s*\|/g, function(m, k, v) { fields[k.trim()] = v.trim(); });
            var repoPath = (issue.body || '').match(/仓库路径:\s*`(assets\/papers\/pending\/[^`]+)`/);
            repoPath = repoPath ? repoPath[1] : '';

            html += '<div class="border border-stone-100 dark:border-stone-700 rounded-xl p-4 mb-3 bg-stone-50/50 dark:bg-stone-800/50">'
                + '<div class="flex items-start justify-between mb-2"><div><span class="font-medium text-stone-700 dark:text-stone-200">#' + issue.number + ' ' + escapeHtml(issue.title) + '</span></div>'
                + '<a href="' + issue.html_url + '" target="_blank" class="text-xs text-amber-600 hover:text-amber-700">查看 Issue →</a></div>'
                + '<div class="text-xs text-stone-400 mb-2">提交者: ' + escapeHtml(issue.user.login) + ' · ' + new Date(issue.created_at).toLocaleString('zh-CN') + '</div>'
                + '<div class="text-xs text-stone-500 mb-2">科目: ' + escapeHtml(fields['科目'] || '?') + ' · 标题: ' + escapeHtml(fields['标题'] || issue.title.replace('[新试卷] ', '')) + ' · 年份: ' + escapeHtml(fields['年份'] || '?') + ' · 学期: ' + escapeHtml(fields['学期'] || '?') + ' · 上传者: ' + escapeHtml(fields['提交者'] || '?') + '</div>'
                + (repoPath ? '<div class="text-xs text-stone-400 mb-3">📁 ' + escapeHtml(repoPath) + '</div>' : '')
                + '<div class="flex gap-2"><button onclick="acceptIssue(' + issue.number + ')" class="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 transition-colors">✅ 接受</button>'
                + '<button onclick="rejectIssue(' + issue.number + ')" class="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition-colors">❌ 拒绝</button>'
                + '<button onclick="skipIssue(' + issue.number + ')" class="px-3 py-1.5 bg-stone-200 dark:bg-stone-600 text-stone-600 dark:text-stone-300 text-xs rounded-lg hover:bg-stone-300 dark:hover:bg-stone-500 transition-colors">⏭ 跳过</button></div>'
                + '</div>';
        });
        $('reviewList').innerHTML = html;
        $('pendingCount').classList.add('hidden');
    } catch(e) {
        $('reviewList').innerHTML = '<p class="text-red-500">加载失败: ' + e.message + '</p>';
    }
}

async function acceptIssue(num) {
    if (!confirm('确定接受此提交？')) return;
    try {
        var r = await ghGet('/issues/' + num);
        if (!r.ok) { showToast('获取 Issue 失败', 'error'); return; }
        var issue = r.data;
        // Extract info from issue body
        var body = issue.body || '';
        var fields = {};
        body.replace(/\|\s*\*\*(.*?)\*\*\s*\|\s*(.*?)\s*\|/g, function(m, k, v) { fields[k.trim()] = v.trim(); });
        var repoPathMatch = body.match(/仓库路径:\s*`(assets\/papers\/pending\/[^`]+)`/);
        var repoPath = repoPathMatch ? repoPathMatch[1] : '';

        var title = fields['标题'] || issue.title.replace('[新试卷] ', '');
        var subject = fields['科目'] || '未知';
        var year = parseInt(fields['年份']) || new Date().getFullYear();
        var semester = fields['学期'] || '上学期期末';
        var uploader = fields['提交者'] || '热心同学';

        // Add to papers.json
        var [pRes, sRes] = await Promise.all([
            ghGet('/contents/data/papers.json?ref=' + BRANCH),
            ghGet('/contents/data/subjects.json?ref=' + BRANCH)
        ]);
        if (!pRes.ok || !sRes.ok) { showToast('读取数据失败', 'error'); return; }
        var papers = readJson(decodeURIComponent(escape(atob(pRes.data.content))));
        var subs = readJson(decodeURIComponent(escape(atob(sRes.data.content))));

        // Find or create subject
        var subj = subs.find(function(s) { return s.name === subject; });
        if (!subj) {
            var maxId = subs.reduce(function(m, s) { return Math.max(m, s.id); }, 0);
            subj = { id: maxId + 1, name: subject, grade: fields['年级'] || '大一', teacher: fields['教师'] || '', description: '', created_at: new Date().toISOString().split('T')[0] };
            subs.push(subj);
            await uploadFile('data/subjects.json', JSON.stringify(subs, null, 4), 'Auto-create subject: ' + subject);
        }

        var fileName = repoPath ? repoPath.split('/').pop() : (fields['文件名'] || title.replace(/[\/:*?"<>|]/g, '_') + '.pdf');
        var maxId = papers.reduce(function(m, p) { return Math.max(m, p.id); }, 0);
        papers.push({ id: maxId + 1, subject_id: subj.id, title: title, year: year, semester: semester, file_url: '', file_path: 'assets/papers/' + fileName, file_name: fileName, file_size: 0, uploaded_by: uploader, created_at: new Date().toISOString().split('T')[0] });
        await uploadFile('data/papers.json', JSON.stringify(papers, null, 4), 'Accept submission: ' + title);

        // Move file from pending to papers
        if (repoPath) {
            var newPath = 'assets/papers/' + fileName;
            var fileContent = await ghGet('/contents/' + repoPath + '?ref=' + BRANCH);
            if (fileContent.ok && fileContent.data.content) {
                var sha = fileContent.data.sha;
                // Upload to new location
                await ghPut('/contents/' + newPath, {
                    message: 'Move pending file: ' + fileName,
                    content: fileContent.data.content,
                    branch: BRANCH
                });
                // Delete old
                await ghDel('/contents/' + repoPath, { message: 'Clean pending: ' + fileName, sha: sha, branch: BRANCH });
            }
        }

        // Close issue
        await ghPatch('/issues/' + num, { state: 'closed', comment: '✅ 已审核通过并添加到试卷库！' });
        showToast('已接受并添加');
        loadReviewList();
    } catch(e) {
        showToast('操作失败: ' + e.message, 'error');
    }
}

async function rejectIssue(num) {
    if (!confirm('确定拒绝此提交？')) return;
    try {
        var r = await ghGet('/issues/' + num);
        if (!r.ok) { showToast('获取 Issue 失败', 'error'); return; }
        var body = r.data.body || '';
        var repoPath = body.match(/仓库路径:\s*`(assets\/papers\/pending\/[^`]+)`/);
        if (repoPath) await deleteRepoFile(repoPath[1]);
        await ghPatch('/issues/' + num, { state: 'closed', comment: '❌ 此提交未通过审核。' });
        showToast('已拒绝');
        loadReviewList();
    } catch(e) {
        showToast('操作失败: ' + e.message, 'error');
    }
}

async function skipIssue(num) {
    showToast('已跳过');
    loadReviewList();
}

// ========== 清理 Pending ==========
async function loadPendingFiles() {
    $('pendingFiles').innerHTML = '<div class="admin-spinner"></div> 加载中...';
    try {
        var r = await ghGet('/contents/assets/papers/pending');
        if (r.status === 404) { $('pendingFiles').innerHTML = '<p class="text-stone-400">✅ pending 目录为空</p>'; return; }
        if (!r.ok) { $('pendingFiles').innerHTML = '<p class="text-red-500">获取文件列表失败</p>'; return; }
        var files = (r.data || []).filter(function(f) { return f.name !== '.gitkeep' && f.type === 'file'; });
        if (!files.length) { $('pendingFiles').innerHTML = '<p class="text-stone-400">✅ pending 目录为空</p>'; return; }

        var html = '<p class="text-stone-500 text-sm mb-3">共 ' + files.length + ' 个文件：</p><ul class="space-y-2 mb-4">';
        files.forEach(function(f) {
            html += '<li class="flex items-center justify-between bg-stone-50 dark:bg-stone-800/50 rounded-lg px-3 py-2"><span class="text-sm text-stone-600 dark:text-stone-300">' + escapeHtml(f.name) + ' (' + (f.size / 1024).toFixed(1) + ' KB)</span><button onclick="deletePendingFile(\'' + f.path + '\')" class="text-xs text-red-500 hover:text-red-600">删除</button></li>';
        });
        html += '</ul><button onclick="deleteAllPending()" class="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors">删除全部</button>';
        $('pendingFiles').innerHTML = html;
    } catch(e) {
        $('pendingFiles').innerHTML = '<p class="text-red-500">加载失败: ' + e.message + '</p>';
    }
}

async function deletePendingFile(path) {
    if (!confirm('确定删除 ' + path.split('/').pop() + ' ？')) return;
    var ok = await deleteRepoFile(path);
    if (ok) { showToast('已删除'); loadPendingFiles(); } else showToast('删除失败', 'error');
}

async function deleteAllPending() {
    if (!confirm('确定删除全部文件？')) return;
    var r = await ghGet('/contents/assets/papers/pending');
    if (!r.ok) { showToast('获取文件列表失败', 'error'); return; }
    var files = (r.data || []).filter(function(f) { return f.name !== '.gitkeep'; });
    for (var i = 0; i < files.length; i++) {
        await deleteRepoFile(files[i].path);
    }
    showToast('已清理 ' + files.length + ' 个文件');
    loadPendingFiles();
}

// ========== 部署 ==========
async function adminDeploy() {
    var output = $('deployOutput');
    var pre = output.querySelector('pre');
    output.classList.remove('hidden');
    pre.textContent = '🚀 开始部署...\n';

    function log(msg) { pre.textContent += msg + '\n'; pre.scrollTop = pre.scrollHeight; }

    var files = [
        'index.html', 'subject-detail.html', 'submit.html', 'admin.html',
        'css/style.css', 'css/tailwind.css', 'css/announcement.css',
        'js/api-client.js', 'js/index.js', 'js/subject-detail.js', 'js/submit.js', 'js/ui.js', 'js/announcement.js', 'js/admin.js',
        'js/docx-preview.min.js', 'js/jszip.min.js', 'js/pdf.min.mjs', 'js/pdf.worker.min.mjs',
        'favicon.svg',
        'data/subjects.json', 'data/papers.json',
        'scripts/manage.js', 'scripts/deploy-via-api.js',
        '.github/ISSUE_TEMPLATE/submit-paper.md'
    ];

    var success = 0, failed = 0;

    for (var i = 0; i < files.length; i++) {
        try {
            log('📤 ' + files[i] + '...');
            var resp = await fetch(files[i] + '?v=' + Date.now());
            if (!resp.ok) { log('  ❌ 本地读取失败'); failed++; continue; }
            var content = await resp.text();
            var ok = await uploadFile(files[i], content, 'Update ' + files[i]);
            if (ok) { log('  ✅'); success++; } else { log('  ❌ API 上传失败'); failed++; }
        } catch(e) { log('  ❌ ' + e.message); failed++; }
    }

    // Trigger Pages build
    log('\n🔄 触发 Pages 构建...');
    try {
        var r = await fetch('https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/pages/builds', {
            method: 'POST', headers: { 'Authorization': 'token ' + TOKEN, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' }
        });
        log(r.ok ? '  ✅ 构建已触发' : '  ❌ 触发失败');
    } catch(e) { log('  ❌ ' + e.message); }

    log('\n📊 ' + success + ' 成功, ' + failed + ' 失败');
    if (!failed) showToast('部署完成 ✅');
    else showToast(success + ' 成功, ' + failed + ' 失败', 'error');
}
