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
    const gradeFilter = document.getElementById('gradeFilter');
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

            const gradeTag = subject.grade ? `<span class="text-sm bg-purple-100 text-purple-700 px-2 py-0.5 rounded ml-2">${subject.grade}</span>` : '';
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

    function renderPapers(papers) {
        if (papers.length === 0) {
            papersContainer.innerHTML = `
                <div class="text-center py-10 text-gray-400">
                    没有匹配的试卷
                </div>`;
            return;
        }

        papersContainer.innerHTML = papers.map(paper => {
            const semesterBadge = paper.semester === '期中'
                ? '<span class="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">期中</span>'
                : '<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">期末</span>';

            const fileSize = formatFileSize(paper.file_size);
            // 使用相对路径或完整 URL
            const fileUrl = paper.file_url || `${getBaseUrl()}/assets/papers/${paper.file_path || ''}`;

            const gradeBadge = paper.grade ? `<span class="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">${paper.grade}</span>` : '';

            return `
                <div class="paper-card bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex items-center justify-between">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                            <h3 class="font-medium text-gray-800 truncate">${escapeHtml(paper.title)}</h3>
                            ${semesterBadge}
                            ${gradeBadge}
                        </div>
                        <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
                            <span>📅 ${paper.year}年</span>
                            <span>📎 ${fileSize}</span>
                            <span>👤 ${escapeHtml(paper.uploaded_by || '匿名')}</span>
                            <span>📥 ${paper.download_count || 0} 次下载</span>
                        </div>
                    </div>
                    <a href="${fileUrl}" target="_blank"
                       class="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm whitespace-nowrap">
                        下载
                    </a>
                </div>`;
        }).join('');
    }

    function filterPapers() {
        const year = yearFilter.value;
        const semester = semesterFilter.value;
        const grade = gradeFilter.value;
        const keyword = searchPaper.value.toLowerCase().trim();

        let filtered = allPapers;
        if (year) filtered = filtered.filter(p => p.year === parseInt(year));
        if (semester) filtered = filtered.filter(p => p.semester === semester);
        if (grade) filtered = filtered.filter(p => p.grade === grade);
        if (keyword) filtered = filtered.filter(p => p.title.toLowerCase().includes(keyword));

        renderPapers(filtered);
    }

    yearFilter.addEventListener('change', filterPapers);
    semesterFilter.addEventListener('change', filterPapers);
    gradeFilter.addEventListener('change', filterPapers);
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