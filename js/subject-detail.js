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
                ? '<span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full ml-2 font-medium">' + escapeHtml(subject.grade) + '</span>'
                : '';
            subjectTitle.innerHTML = escapeHtml(subject.name) + gradeTag;
            subjectTeacher.textContent = subject.teacher || '';
            subjectDescription.textContent = subject.description || '';

            allPapers = papers;
            loadingState.classList.add('hidden');

            if (papers.length === 0) {
                emptyState.classList.remove('hidden');
                return;
            }

            var years = [...new Set(papers.map(function(p) { return p.year; }))].sort(function(a, b) { return b - a; });
            yearFilter.innerHTML = '<option value="">全部年份</option>' +
                years.map(function(y) { return '<option value="' + y + '">' + y + '年</option>'; }).join('');

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
        var map = {
            '上学期期中': 'bg-amber-100 text-amber-700',
            '上学期期末': 'bg-emerald-100 text-emerald-700',
            '下学期期中': 'bg-sky-100 text-sky-700',
            '下学期期末': 'bg-violet-100 text-violet-700'
        };
        var colors = map[semester] || 'bg-stone-100 text-stone-600';
        return '<span class="text-xs ' + colors + ' px-2 py-0.5 rounded-full font-medium">' + escapeHtml(semester) + '</span>';
    }

    function getYearBadge(year) {
        var y = parseInt(year);
        var now = new Date().getFullYear();
        var diff = now - y;
        var colors;
        if (diff === 0) colors = 'bg-rose-100 text-rose-700';
        else if (diff === 1) colors = 'bg-amber-100 text-amber-700';
        else if (diff === 2) colors = 'bg-sky-100 text-sky-700';
        else colors = 'bg-stone-100 text-stone-500';
        return '<span class="text-xs ' + colors + ' px-2 py-0.5 rounded-full font-medium">' + y + '年</span>';
    }

    function renderPapers(papers) {
        if (papers.length === 0) {
            papersContainer.innerHTML = '<div class="text-center py-10">'
                + '<div class="text-4xl mb-3 opacity-60">🔍</div>'
                + '<p class="text-stone-500 font-medium">没有找到匹配的试卷</p>'
                + '<p class="text-stone-400 text-sm mt-2">试试调整筛选条件</p>'
                + '<a href="submit.html" class="inline-block mt-4 bg-amber-700 text-white px-5 py-2 rounded-lg hover:bg-amber-800 text-sm font-medium transition-colors">去提交新试卷</a>'
                + '</div>';
            return;
        }

        var html = '';
        for (var i = 0; i < papers.length; i++) {
            var paper = papers[i];
            var semesterBadge = getSemesterBadge(paper.semester);
            var yearBadge = getYearBadge(paper.year);
            var fileSize = formatFileSize(paper.file_size);
            var rawPath = paper.file_path || '';
            var encodedPath = encodeURI(rawPath);
            var fileUrl = paper.file_url || getBaseUrl() + '/assets/papers/' + encodedPath;
            var gradeBadge = paper.grade
                ? '<span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">' + escapeHtml(paper.grade) + '</span>'
                : '';

            var ext = (paper.file_name || rawPath).split('.').pop().toLowerCase();
            var isWord = ext === 'doc' || ext === 'docx';
            var downloadName = paper.file_name || 'paper.' + (isWord ? 'docx' : 'pdf');
            var fileType = isWord ? 'Word' : 'PDF';
            var setter = paper.setter || '';

            html += '<div class="paper-card bg-white rounded-xl shadow-sm p-4 border border-stone-100"'
                + ' data-title="' + escapeAttr(paper.title) + '"'
                + ' data-year="' + paper.year + '"'
                + ' data-semester="' + escapeAttr(paper.semester) + '"'
                + ' data-grade="' + escapeAttr(paper.grade || '') + '"'
                + ' data-filesize="' + escapeAttr(fileType + ' / ' + fileSize) + '"'
                + ' data-uploader="' + escapeAttr(paper.uploaded_by || '匿名') + '"'
                + ' data-setter="' + escapeAttr(setter) + '"'
                + ' data-url="' + escapeAttr(fileUrl) + '"'
                + ' data-dlname="' + escapeAttr(downloadName) + '"'
                + ' data-isword="' + (isWord ? '1' : '0') + '">'
                + '<h2 class="font-semibold text-stone-800 text-base">' + escapeHtml(paper.title) + '</h2>'
                + '<div class="flex flex-wrap items-center gap-1.5 mt-1">' + yearBadge + semesterBadge + gradeBadge + '</div>'
                + '</div>';
        }
        papersContainer.innerHTML = html;

        // 长标题跑马灯 — 轮询直到浏览器完成布局（Chrome 渲染太快 rAF 不够用）
        (function pollMarquee() {
            var titles = papersContainer.querySelectorAll('.paper-card h2');
            var allDone = true;
            for (var t = 0; t < titles.length; t++) {
                (function(el) {
                    if (el._marqueeActive) return;
                    // 轮询直到 scrollWidth 反映真实内容宽度
                    if (el.scrollWidth > el.clientWidth + 0.5) {
                        startMarquee(el);
                    } else {
                        allDone = false;
                    }
                })(titles[t]);
            }
            if (!allDone) setTimeout(pollMarquee, 100);
        })();

        // 点击卡片弹出详情
        var cards = papersContainer.querySelectorAll('.paper-card');
        for (var j = 0; j < cards.length; j++) {
            (function(card) {
                card.addEventListener('click', function() {
                    showPaperDetail({
                        title: card.dataset.title,
                        year: card.dataset.year,
                        semester: card.dataset.semester,
                        grade: card.dataset.grade,
                        fileSize: card.dataset.filesize,
                        uploaded_by: card.dataset.uploader,
                        setter: card.dataset.setter,
                        fileUrl: card.dataset.url,
                        downloadName: card.dataset.dlname,
                        isWord: card.dataset.isword === '1'
                    });
                });
            })(cards[j]);
        }
    }

    function filterPapers() {
        var year = yearFilter.value;
        var semester = semesterFilter.value;
        var keyword = searchPaper.value.toLowerCase().trim();

        var filtered = allPapers;
        if (year) filtered = filtered.filter(function(p) { return p.year === parseInt(year); });
        if (semester) filtered = filtered.filter(function(p) { return p.semester === semester; });
        if (keyword) filtered = filtered.filter(function(p) { return charMatch(p.title, keyword); });

        renderPapers(filtered);
    }

    yearFilter.addEventListener('change', filterPapers);
    semesterFilter.addEventListener('change', filterPapers);
    searchPaper.addEventListener('input', filterPapers);

    await loadData();
});

// ========== 试卷详情弹窗 ==========
function showPaperDetail(paper) {
    if (document.getElementById('paperDetailOverlay')) return;

    var overlay = document.createElement('div');
    overlay.className = 'paper-detail-overlay';
    overlay.id = 'paperDetailOverlay';

    var gradeRow = paper.grade ? '<div class="detail-row"><span class="detail-label">年级</span><span>' + escapeHtml(paper.grade) + '</span></div>' : '';

    var previewUrl = paper.fileUrl;
    if (paper.isWord) {
        previewUrl = 'https://view.officeapps.live.com/op/view.aspx?src=' + encodeURIComponent(paper.fileUrl);
    }

    var setterRow = paper.setter ? '<div class="detail-row"><span class="detail-label">出卷人</span><span>' + escapeHtml(paper.setter) + '</span></div>' : '';

    overlay.innerHTML =
        '<div class="paper-detail-card">'
        + '<div class="detail-header">试卷信息</div>'
        + '<div class="detail-body">'
        + '<div class="detail-row"><span class="detail-label">标题</span><span class="detail-value">' + escapeHtml(paper.title) + '</span></div>'
        + '<div class="detail-row"><span class="detail-label">年份</span><span>' + paper.year + '年</span></div>'
        + '<div class="detail-row"><span class="detail-label">学期</span><span>' + escapeHtml(paper.semester) + '</span></div>'
        + gradeRow
        + '<div class="detail-row"><span class="detail-label">文件</span><span>' + paper.fileSize + '</span></div>'
        + setterRow
        + '<div class="detail-row"><span class="detail-label">上传者</span><span>' + escapeHtml(paper.uploaded_by || '匿名') + '</span></div>'
        + '</div>'
        + '<div class="detail-footer detail-footer-triple">'
        + '<a href="' + previewUrl + '" target="_blank" rel="noopener" class="detail-preview-btn">在线预览</a>'
        + '<a href="' + paper.fileUrl + '" download="' + escapeAttr(paper.downloadName) + '" class="detail-download-btn">下载文件</a>'
        + '<button class="detail-close-btn">关闭</button>'
        + '</div>'
        + '</div>';

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closePaperDetail(overlay);
    });
    overlay.querySelector('.detail-close-btn').addEventListener('click', function() {
        closePaperDetail(overlay);
    });

    document.body.appendChild(overlay);
}

function closePaperDetail(overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.25s ease';
    setTimeout(function() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 250);
}

// ========== 跑马灯滚动（scrollLeft + mask 遮罩固定不动） ==========
function startMarquee(el) {
    if (el._marqueeActive) return;
    var maxScroll = Math.ceil(el.scrollWidth - el.clientWidth * 0.93);
    if (maxScroll <= 1) return;

    el._marqueeActive = true;
    el.scrollLeft = 0;

    var speed = 1;
    var dir = 1;
    var paused = false;
    var PAUSE_MS = 2000; // 两端暂停 2 秒

    function tick() {
        if (!el._marqueeActive || !el.isConnected) { clearInterval(el._marqueeTimer); return; }
        if (paused) return;

        el.scrollLeft += speed * dir;

        if (dir === 1 && el.scrollLeft >= maxScroll) {
            el.scrollLeft = maxScroll;
            paused = true;
            setTimeout(function() { paused = false; dir = -1; }, PAUSE_MS);
        } else if (dir === -1 && el.scrollLeft <= 0) {
            el.scrollLeft = 0;
            paused = true;
            setTimeout(function() { paused = false; dir = 1; }, PAUSE_MS);
        }
    }

    el._marqueeTimer = setInterval(tick, 16); // ~60fps
}

function formatFileSize(bytes) {
    if (!bytes) return '未知大小';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeAttr(text) {
    return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// getBaseUrl() 定义在 api-client.js 中