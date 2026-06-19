// Tus - 首页逻辑

document.addEventListener('DOMContentLoaded', async function() {
    const container = document.getElementById('subjectsContainer');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const errorState = document.getElementById('errorState');
    const errorMessage = document.getElementById('errorMessage');
    const searchInput = document.getElementById('searchInput');

    let allSubjects = [];

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

            renderSubjects(subjects);
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
            return `
                <a href="subject-detail.html?id=${subject.id}" class="subject-card bg-white rounded-xl shadow-sm p-5 border border-gray-100 block">
                    <h3 class="font-semibold text-gray-800 text-lg mb-1">${subject.name}</h3>
                    ${subject.teacher ? `<p class="text-gray-400 text-sm mb-2">${subject.teacher}</p>` : ''}
                    ${subject.description ? `<p class="text-gray-500 text-sm mb-3 line-clamp-2">${subject.description}</p>` : ''}
                    <div class="flex items-center gap-2 text-sm text-gray-400">
                        <span>📄 ${paperCount} 份试卷</span>
                    </div>
                </a>
            `;
        }).join('');
    }

    // 搜索过滤
    searchInput.addEventListener('input', function() {
        const keyword = this.value.toLowerCase().trim();
        if (!keyword) {
            renderSubjects(allSubjects);
            return;
        }
        const filtered = allSubjects.filter(s =>
            s.name.toLowerCase().includes(keyword) ||
            (s.teacher && s.teacher.toLowerCase().includes(keyword)) ||
            (s.description && s.description.toLowerCase().includes(keyword))
        );
        renderSubjects(filtered);
    });

    // 初始化
    await loadSubjects();
});