// Tus - 科目详情页逻辑

document.addEventListener('DOMContentLoaded', async function() {
    const params = new URLSearchParams(window.location.search);
    const subjectId = params.get('id');

    if (!subjectId) {
        showError('未指定科目');
        return;
    }

    const subjectTitle = document.getElementById('subjectTitle');
    const subjectTeacher = document.getElementById('subjectTeacher');
    const subjectDescription = document.getElementById('subjectDescription');
    const papersContainer = document.getElementById('papersContainer');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const errorState = document.getElementById('errorState');
    const errorMessage = document.getElementById('errorMessage');
    const yearFilter = document.getElementById('yearFilter');
    const semesterFilter = document.getElementById('semesterFilter');
    const searchPaper = document.getElementById('searchPaper');

    let allPapers = [];

    async function loadData() {
        loadingState.classList.remove('hidden');
        emptyState.classList.add('hidden');
        errorState.classList.add('hidden');
        papersContainer.innerHTML = '';

        try {
            const [subject, papers] = await Promise.all([
                getSubject(subjectId),
                getPapers(subjectId)
            ]);

            if (!subject) {
                showError('科目不存在');
                return;
            }

            const gradeTag = subject.grade
                ? `<span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full ml-2 font-medium">${subject.grade}</span>`
                : '';
            subjectTitle.innerHTML = `${subject.name}${gradeTag}`;
            subjectTeacher.textContent = subject.teacher ? `👨‍🏫 ${subject.teacher}` : '';
            subjectDescription.textContent = subject.description || '';

            allPapers = papers;
            loadingState.classList.add('hidden');

            if (papers.length === 0) {
                emptyState.classList.remove('hidden');
                return;
            }

            const years = [...new Set(papers.map(p => p.year))].sort((a, b) => b - a);
            yearFilter.innerHTML = '<option value="">全部年份</option>' +
                years.map(y => `<option value="${y}">${y}年</option>`).join('');

            renderPapers(papers);
        } catch (e) {
            showError(e.message || '加载失败');
        }
    }

    function showError(msg) {
        loadingState.classList.add('hidden');
        errorState.classList.remove('hidden');
        errorMessage.textContent = msg;
    }

    function getSemesterBadge(semester) {
        const map = {
            '上学期期中': 'bg-amber-100 text-amber-700',
            '上学期期末': 'bg-emerald-100 text-emerald-700',
            '下学期期中': 'bg-sky-100 text-sky-700',
            '下学期期末': 'bg-violet-100 text-violet-700',
        };
        const colors = map[semester] || 'bg-slate-100 text-slate-600';
        return `<span class="text-xs ${colors} px-2 py-0.5 rounded-full font-medium">${semester}</span>`;
    }

    function renderPapers(papers) {
        if (papers.length === 0) {
            papersContainer.innerHTML = `
                <div class="text-center py-10 text-slate-400">
                    没有匹配的试卷
                </div>`;
            return;
        }

        papersContainer.innerHTML = papers.map(paper => {
            const semesterBadge = getSemesterBadge(paper.semester);
            const fileSize = formatFileSize(paper.file_size);
            const fileUrl = paper.file_url || `${getBaseUrl()}/assets/papers/${paper.file_path || ''}`;
            const gradeBadge = paper.grade
                ? `<span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">${paper.grade}</span>`
                : '';

            return `
                <div class="paper-card bg-white rounded-xl shadow-sm p-5 border border-slate-100 flex items-center justify-between">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-2 flex-wrap">
                            <h3 class="font-medium text-slate-800 truncate">${escapeHtml(paper.title)}</h3>
                            ${semesterBadge}
                            ${gradeBadge}
                        </div>
                        <div class="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-400">
                            <span>📅 ${paper.year}年</span>
                            <span>📎 ${fileSize}</span>
                            <span>👤 ${escapeHtml(paper.uploaded_by || '匿名')}</span>
                            <span>📥 ${paper.download_count || 0} 次下载</span>
                        </div>
                    </div>
                    <a href="${fileUrl}" target="_blank"
                       class="ml-4 px-5 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 text-sm whitespace-nowrap font-medium transition-colors">
                        下载
                    </a>
                </div>`;
        }).join('');
    }

    function filterPapers() {
        const year = yearFilter.value;
        const semester = semesterFilter.value;
        const keyword = searchPaper.value.toLowerCase().trim();

        let filtered = allPapers;
        if (year) filtered = filtered.filter(p => p.year === parseInt(year));
        if (semester) filtered = filtered.filter(p => p.semester === semester);
        if (keyword) filtered = filtered.filter(p => p.title.toLowerCase().includes(keyword));

        renderPapers(filtered);
    }

    yearFilter.addEventListener('change', filterPapers);
    semesterFilter.addEventListener('change', filterPapers);
    searchPaper.addEventListener('input', filterPapers);

    await loadData();
});

function formatFileSize(bytes) {
    if (!bytes) return '未知大小';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getBaseUrl() {
    const path = window.location.pathname;
    if (path.includes('/tus/') || path === '/tus') {
        return '/tus';
    }
    return '';
}