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
                b.className = 'grade-btn px-5 py-2.5 rounded-full text-sm font-medium border transition-all shadow-sm ' +
                    (b === this
                        ? 'bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-800 border-stone-800 dark:border-stone-200'
                        : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-600 hover:border-stone-400 hover:text-stone-700');
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

        // 关键词搜索（按字匹配）
        if (keyword) {
            filtered = filtered.filter(s =>
                charMatch(s.name, keyword) ||
                charMatch(s.teacher || '', keyword) ||
                charMatch(s.description || '', keyword) ||
                charMatch(s.grade || '', keyword)
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
            // 默认优先展示资料更丰富的科目；试卷数相同时按名称稳定排序。
            allSubjects = subjects.sort((a, b) => {
                const countA = a.papers?.[0]?.count || 0;
                const countB = b.papers?.[0]?.count || 0;
                return countB - countA || a.name.localeCompare(b.name, 'zh-CN');
            });

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
                <div class="col-span-full text-center py-10 text-stone-400">
                    无匹配科目
                </div>
            `;
            return;
        }

        container.innerHTML = subjects.map(function(subject) {
            var paperCount = subject.papers?.[0]?.count || 0;
            var gradeBadge = subject.grade ? '<span class="subj-grade text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">' + subject.grade + '</span>' : '';
            return '<a href="subject-detail.html?id=' + subject.id + '" class="subject-card bg-white dark:bg-stone-800 rounded-xl shadow-sm p-5 border border-stone-100 dark:border-stone-700 block">'
                + gradeBadge
                + '<h2 class="font-semibold text-stone-800 dark:text-stone-100 text-lg pr-6"><span class="marquee-inner">' + subject.name + '</span></h2>'
                + (subject.teacher ? '<p class="text-stone-400 dark:text-stone-500 text-sm mb-2">' + subject.teacher + '</p>' : '')
                + (subject.description ? '<p class="text-stone-500 dark:text-stone-400 text-sm mb-3 line-clamp-2">' + subject.description + '</p>' : '')
                + '<div class="flex items-center gap-3 text-sm text-stone-500 dark:text-stone-400">'
                    + '<span>' + paperCount + ' 份试卷</span>'
                + '</div>'
                + '</a>';
        }).join('');

        // 卡片入场动画：错开 60ms 依次显现
        requestAnimationFrame(function() {
            var cards = container.querySelectorAll('.subject-card');
            for (var ci = 0; ci < cards.length; ci++) {
                (function(idx, card) {
                    setTimeout(function() {
                        card.classList.add('card-visible');
                    }, idx * 60);
                })(ci, cards[ci]);
            }
        });

        // 科目标题跑马灯
        requestAnimationFrame(function pollSubj() {
            var titles = container.querySelectorAll('.subject-card h2');
            var allDone = true;
            for (var ti = 0; ti < titles.length; ti++) {
                (function(el) {
                    if (el._marqueeActive) return;
                    var inner = el.querySelector('.marquee-inner');
                    if (!inner) return;
                    if (el.scrollWidth > el.clientWidth + 0.5) {
                        startSubjectMarquee(el);
                    } else {
                        allDone = false;
                    }
                })(titles[ti]);
            }
            if (!allDone) setTimeout(pollSubj, 100);
        });
    }

    function startSubjectMarquee(el) {
        if (el._marqueeActive) return;
        var inner = el.querySelector('.marquee-inner');
        if (!inner) return;
        var maxPossible = el.scrollWidth - el.clientWidth;
        var scrollFade = Math.ceil(el.scrollWidth - el.clientWidth * 0.93);
        if (scrollFade > maxPossible) scrollFade = maxPossible;
        if (scrollFade <= 1) return;

        el._marqueeActive = true;
        var SPEED = 45, PAUSE = 2000;
        var scrollTime = (scrollFade / SPEED) * 1000;
        var total = scrollTime * 2 + PAUSE * 2;
        var p1 = PAUSE / total;
        var p2 = (PAUSE + scrollTime) / total;
        var p3 = (PAUSE + scrollTime + PAUSE) / total;
        var dx = -scrollFade + 'px';

        el._marqueeAnim = inner.animate([
            { transform: 'translateX(0)', offset: 0 },
            { transform: 'translateX(0)', offset: p1 },
            { transform: 'translateX(' + dx + ')', offset: p2 },
            { transform: 'translateX(' + dx + ')', offset: p3 },
            { transform: 'translateX(0)', offset: 1 }
        ], { duration: total, iterations: Infinity, easing: 'linear' });
    }

    // 初始化
    await loadSubjects();
});
