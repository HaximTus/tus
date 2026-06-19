// Tus - 数据 API 客户端
// 从静态 JSON 文件读取数据（GitHub Pages 部署）

// 基础路径，用于 GitHub Pages 部署
// 如果部署在 https://tjiux.github.io/tus/ 则 BASE_PATH 为 '/tus'
// 如果是自定义域名或根目录部署则为 ''
const BASE_PATH = '/tus';

// 缓存数据
let cachedSubjects = null;
let cachedPapers = null;

// 获取基础 URL
function getBaseUrl() {
    // 尝试自动检测
    const path = window.location.pathname;
    if (path.includes('/tus/') || path === '/tus') {
        return '/tus';
    }
    return '';
}

// 通用数据加载函数
async function loadJson(url) {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}${url}`);
    if (!response.ok) {
        throw new Error(`加载数据失败: ${response.status}`);
    }
    return await response.json();
}

// 获取所有科目
async function getSubjects() {
    if (cachedSubjects) return cachedSubjects;
    try {
        const data = await loadJson('/data/subjects.json');
        cachedSubjects = data;
        return data;
    } catch (e) {
        console.error('获取科目失败:', e);
        return [];
    }
}

// 获取单个科目
async function getSubject(id) {
    const subjects = await getSubjects();
    return subjects.find(s => s.id === parseInt(id)) || null;
}

// 获取所有试卷
async function getAllPapers() {
    if (cachedPapers) return cachedPapers;
    try {
        const data = await loadJson('/data/papers.json');
        cachedPapers = data;
        return data;
    } catch (e) {
        console.error('获取试卷失败:', e);
        return [];
    }
}

// 获取某科目的所有试卷
async function getPapers(subjectId) {
    const papers = await getAllPapers();
    return papers.filter(p => p.subject_id === parseInt(subjectId));
}

// 获取科目及其试卷数量
async function getSubjectsWithCount() {
    const [subjects, papers] = await Promise.all([getSubjects(), getAllPapers()]);
    return subjects.map(subject => ({
        ...subject,
        papers: [{ count: papers.filter(p => p.subject_id === subject.id).length }]
    }));
}

// 按字匹配（"高数" → "高等数学" ✓，输入的所有字都要出现在目标文本中）
function charMatch(text, query) {
    if (!query) return true;
    const t = text.toLowerCase();
    const q = query.toLowerCase().replace(/\s/g, '');
    return [...q].every(char => t.includes(char));
}