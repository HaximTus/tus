// Tus - 首页逻辑

document.addEventListener('DOMContentLoaded', async function() {
    const container = document.getElementById('subjectsContainer');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const errorState = document.getElementById('errorState');
    const errorMessage = document.getElementById('errorMessage');
    const searchInput = document.getElementById('searchInput');
    const gradeBtns = document.querySelectorAll('.grade-btn');

    let allSubjects = [];
    let activeGrade = '';

    // 年级筛选点击
    gradeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            gradeBtns.forEach(b => {
                b.className = 'grade-btn px-4 py-2 rounded-lg text-sm font-medium border transition-colors ' +
                    (b === this
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50');
            });
            activeGrade = this.dataset.grade;
            applyFilters();
        });
    });

    function applyFilters() {
        const keyword = searchInput.value.toLowerCase().trim();

        let filtered = allSubjects;

        // 年级筛选
        if (activeGrade) {
            filtered = filtered.filter(s => s.grade === activeGrade);
        }

        // 关键词搜索
        if (keyword) {
            filtered = filtered.filter(s =>
                s.name.toLowerCase().includes(keyword) ||
                (s.teacher && s.teacher.toLowerCase().includes(keyword)) ||
                (s.description && s.description.toLowerCase().includes(keyword)) ||
                (s.grade && s.grade.includes(keyword))
            );
        }

        renderSubjects(filtered);
    }

    // 搜索过滤
    searchInput.addEventListener('input', applyFilters);

    // 加载科目
    async function loadSubjects() {
        loadingState.classList.remove('hidden');
        emptyState.classList.add('hidden');
        errorState.classList.add('hidden');
        container.innerHTML = '';

        try {
            const subjects = await getSubjectsWithCount();
            allSubjects = subjects;

            loadingState.classList.add('hidden');

            if (subjects.length === 0) {
                emptyState.classList.remove('hidden');
                return;
            }

            applyFilters();
        } catch (e) {
            loadingState.classList.add('hidden');
            errorState.classList.remove('hidden');
            errorMessage.textContent = e.message || '加载失败，请检查网络连接';
        }
    }

    // 渲染科目卡片
    function renderSubjects(subjects) {
        if (subjects.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-10 text-gray-400">
                    没有匹配的科目
                </div>
            `;
            return;
        }

        container.innerHTML = subjects.map(subject => {
            const paperCount = subject.papers?.[0]?.count || 0;
            const gradeBadge = subject.grade ? `<span class="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">${subject.grade}</span>` : '';
            return `
                <a href="subject-detail.html?id=${subject.id}" class="subject-card bg-white rounded-xl shadow-sm p-5 border border-gray-100 block">
                    <div class="flex items-start justify-between mb-1">
                        <h3 class="font-semibold text-gray-800 text-lg">${subject.name}</h3>
                        ${gradeBadge}
                    </div>
                    ${subject.teacher ? `<p class="text-gray-400 text-sm mb-2">${subject.teacher}</p>` : ''}
                    ${subject.description ? `<p class="text-gray-500 text-sm mb-3 line-clamp-2">${subject.description}</p>` : ''}
                    <div class="flex items-center gap-3 text-sm text-gray-400">
                        <span>📄 ${paperCount} 份试卷</span>
                    </div>
                </a>
            `;
        }).join('');
    }

    // 初始化
    await loadSubjects();
});