// Tus - 科目详情页逻辑

document.addEventListener('DOMContentLoaded', async function() {
    const params = new URLSearchParams(window.location.search);
    const subjectId = params.get('id');

    if (!subjectId) {
        showError('未指定科目');
        return;
    }

    const subjectTitle = document.getElementById('subjectTitle');
    // 与首页同名元素配对，启用支持浏览器中的跨页面标题过渡。
    subjectTitle.style.viewTransitionName = 'subject-title-' + subjectId;
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

            // 始终按年份由近到远展示；slice 保留 API 缓存中的原始数组不被修改。
            allPapers = papers.slice().sort(function(a, b) {
                return b.year - a.year;
            });
            loadingState.classList.add('hidden');

            if (papers.length === 0) {
                emptyState.classList.remove('hidden');
                return;
            }

            var years = [...new Set(papers.map(function(p) { return p.year; }))].sort(function(a, b) { return b - a; });
            yearFilter.innerHTML = '<option value="">全部年份</option>' +
                years.map(function(y) { return '<option value="' + y + '">' + y + '年</option>'; }).join('');

            renderPapers(allPapers);
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
        // 清理旧跑马灯动画
        var oldTitles = papersContainer.querySelectorAll('.paper-card h2');
        for (var ot = 0; ot < oldTitles.length; ot++) stopMarquee(oldTitles[ot]);
        if (papers.length === 0) {
            papersContainer.innerHTML = '<div class="text-center py-10">'
                + '<div class="text-4xl mb-3 opacity-60">🔍</div>'
                + '<p class="text-stone-500 font-medium">没有找到匹配的试卷</p>'
                + '<p class="text-stone-400 text-sm mt-2">试试调整筛选条件</p>'
                + '<a href="submit.html" class="inline-block mt-4 bg-yellow-600 dark:bg-yellow-500 text-stone-900 dark:text-stone-900 px-5 py-2.5 rounded-lg hover:bg-yellow-700 dark:hover:bg-yellow-400 text-sm font-medium transition-colors">去提交新试卷</a>'
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
            var downloadName = paper.title + '.' + ext;
            var fileType = isWord ? 'Word' : 'PDF';
            var setter = paper.setter || '';

            html += '<div class="paper-card bg-white dark:bg-stone-800 rounded-xl shadow-sm p-4 border border-stone-100 dark:border-stone-700"'
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
                + '<h2 class="font-semibold text-stone-800 dark:text-stone-100 text-base"><span class="marquee-inner">' + escapeHtml(paper.title) + '</span></h2>'
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
                // 让移动端 :active 立刻触发（空 touchstart 即可启用）
                card.addEventListener('touchstart', function() {}, {passive: true});
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
    // 数据加载完成后，后台预取 PDF 文件
    preloadPdfs(allPapers);
});

// ========== PDF 预加载（利用浏览器 HTTP 缓存，低优先级并发） ==========
function getAbsoluteUrl(url) {
    return url.indexOf('://') === -1 ? window.location.origin + url : url;
}

function getPreviewProxyUrl(fileUrl) {
    var apiBase = window.TusAuth && window.TusAuth.apiBase;
    if (!apiBase || !/\.pdf(?:$|[?#])/i.test(fileUrl)) return null;
    var marker = '/assets/papers/';
    var index = fileUrl.indexOf(marker);
    if (index === -1) return null;
    var paperName = fileUrl.slice(index + marker.length).split(/[?#]/)[0];
    try { paperName = decodeURIComponent(paperName); } catch (error) { /* keep the original path */ }
    var paperPath = 'assets/papers/' + paperName;
    return apiBase + '/papers/preview?path=' + encodeURIComponent(paperPath);
}

function preloadPdfs(papers) {
    var count = 0;
    for (var i = 0; i < papers.length; i++) {
        var p = papers[i];
        var ext = (p.file_name || p.file_path || '').split('.').pop().toLowerCase();
        if (ext !== 'pdf') continue;
        // 限制最多预取 3 个，页面有几十个试卷时不影响网速
        if (++count > 3) break;
        var encodedPath = encodeURI(p.file_path || '');
        var fileUrl = p.file_url || getBaseUrl() + '/assets/papers/' + encodedPath;
        var absUrl = getAbsoluteUrl(fileUrl);
        // 只 fetch 不存结果，浏览器 HTTP 缓存会自动保存
        // 用户点击预览时 fetch 会直接从磁盘读取，几乎无延迟
        fetch(absUrl, { cache: 'force-cache' }).catch(function() {});
    }
}

// ========== 试卷详情弹窗（内嵌预览） ==========
function showPaperDetail(paper) {
    if (document.getElementById('paperDetailOverlay')) return;

    var overlay = document.createElement('div');
    overlay.className = 'paper-detail-overlay';
    overlay.id = 'paperDetailOverlay';

    var gradeRow = paper.grade ? '<div class="detail-row"><span class="detail-label">年级</span><span class="detail-value">' + escapeHtml(paper.grade) + '</span></div>' : '';
    var setterRow = paper.setter ? '<div class="detail-row"><span class="detail-label">出卷人</span><span class="detail-value">' + escapeHtml(paper.setter) + '</span></div>' : '';

    var originalUrl = paper.fileUrl;
    var isPdf = !paper.isWord;
    var absoluteUrl = originalUrl.indexOf('://') === -1
        ? window.location.origin + originalUrl
        : originalUrl;

    // 预览区
    // PDF → iframe 加载 preview.html（CDN 备降）
    // Word → 纯前端 docx-preview 渲染
    var previewUrl;
    var viewerHtml;
    if (isPdf) {
        // 始终用 GitHub Pages 完整 URL，确保 preview.html 能识别并走 jsDelivr CDN
        var ghPagesUrl = absoluteUrl.indexOf('github.io') >= 0
            ? absoluteUrl
            : 'https://HaximTus.github.io/tus' + originalUrl;
        var proxyUrl = getPreviewProxyUrl(originalUrl);
        previewUrl = proxyUrl || ('preview.html?url=' + encodeURIComponent(ghPagesUrl));
        viewerHtml = '<div class="pdf-container" id="pdfContainer" style="display:none;"></div>';
    } else {
        previewUrl = absoluteUrl;
        viewerHtml = '<div class="word-container" id="wordContainer" style="display:none;"></div>';
    }

    overlay.innerHTML =
        '<div class="paper-detail-card" id="paperDetailCard">'
        + '<div class="detail-header" id="detailHeader">试卷信息</div>'

        // 信息区
        + '<div class="detail-body" id="detailBody">'
        + '<div class="detail-row"><span class="detail-label">标题</span><span class="detail-value">' + escapeHtml(paper.title) + '</span></div>'
        + '<div class="detail-row"><span class="detail-label">年份</span><span class="detail-value">' + paper.year + '年</span></div>'
        + '<div class="detail-row"><span class="detail-label">学期</span><span class="detail-value">' + escapeHtml(paper.semester) + '</span></div>'
        + gradeRow
        + '<div class="detail-row"><span class="detail-label">文件</span><span class="detail-value">' + paper.fileSize + '</span></div>'
        + setterRow
        + '<div class="detail-row"><span class="detail-label">上传者</span><span class="detail-value">' + escapeHtml(paper.uploaded_by || '匿名') + '</span></div>'
        + '</div>'

        // 预览区（初始隐藏）
        + '<div class="preview-container" id="previewContainer" style="display:none">'
        +   '<div class="preview-loading" id="previewLoading">'
        +     '<div class="spinner"></div>'
        +     '<p>正在加载预览...</p>'
        +   '</div>'
        +   viewerHtml
        + '</div>'

        // 底部按钮
        + '<div class="detail-footer detail-footer-triple" id="detailFooter">'
        + '<button class="detail-preview-btn" id="previewBtn" data-previewurl="' + escapeAttr(previewUrl) + '" data-ispdf="' + (isPdf ? '1' : '0') + '">在线预览</button>'
        + '<a href="' + escapeAttr(originalUrl) + '" download="' + escapeAttr(paper.downloadName) + '" class="detail-download-btn">下载文件</a>'
        + '<button class="detail-close-btn" id="closeBtn">关闭</button>'
        + '</div>'
        + '</div>';

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closePaperDetail(overlay);
    });

    var previewBtn = overlay.querySelector('#previewBtn');
    if (previewBtn) {
        previewBtn.addEventListener('click', function() {
            enterPreviewMode(overlay);
        });
    }

    overlay.querySelector('#closeBtn').addEventListener('click', function() {
        closePaperDetail(overlay);
    });

    document.body.appendChild(overlay);
    void overlay.offsetWidth;

    var downloadBtn = overlay.querySelector('.detail-download-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            showDownloadStamp(downloadBtn);
        });
    }
}

function showDownloadStamp(button) {
    var oldStamp = button.querySelector('.download-stamp');
    if (oldStamp) oldStamp.remove();
    var stamp = document.createElement('span');
    stamp.className = 'download-stamp';
    stamp.textContent = '已开始下载';
    button.appendChild(stamp);
    setTimeout(function() {
        if (stamp.parentNode) stamp.parentNode.removeChild(stamp);
    }, 700);
}

function enterPreviewMode(overlay) {
    var card = overlay.querySelector('#paperDetailCard');
    var header = overlay.querySelector('#detailHeader');
    var body = overlay.querySelector('#detailBody');
    var previewContainer = overlay.querySelector('#previewContainer');
    var previewLoading = overlay.querySelector('#previewLoading');
    var previewBtn = overlay.querySelector('#previewBtn');

    // 获取预览 URL
    var previewUrl = previewBtn.dataset.previewurl || '';
    // 记住文件类型（用于退出时重建按钮）
    var isPdf = previewBtn.dataset.ispdf === '1';
    card.dataset.previewIsPdf = isPdf ? '1' : '0';

    // 切换头部文字
    header.textContent = '预览';

    // 隐藏信息区，显示预览区
    body.style.display = 'none';
    previewContainer.style.display = '';
    previewLoading.style.display = '';

    // 预览按钮 → 返回按钮
    var backBtn = document.createElement('button');
    backBtn.className = 'detail-back-btn';
    backBtn.id = 'previewBtn';
    backBtn.textContent = '← 返回详情';
    backBtn.addEventListener('click', function() {
        exitPreviewMode(overlay);
    });
    previewBtn.parentNode.replaceChild(backBtn, previewBtn);

    // 卡片切换到预览模式（样式放大）
    card.classList.add('preview-mode');

    if (isPdf) {
        // PDF: 本地 PDF.js 渲染，使用阿里云代理的 Range 请求。
        renderPdfPreview(overlay, previewUrl, previewLoading);
        // 8 秒超时提示
        var dlHref = card.querySelector('.detail-download-btn').getAttribute('href');
        card._previewTimeoutId = setTimeout(function() {
            if (previewLoading.style.display !== 'none') {
                previewLoading.innerHTML = '<p style="color:#9e9488;font-size:13px;line-height:1.8;">'
                    + '加载较慢，试试 <a href="' + previewUrl + '" target="_blank" rel="noopener" style="color:#ca8a04;">在新标签页打开</a>'
                    + '<br>或 <a href="' + dlHref + '" download style="color:#ca8a04;">直接下载文件</a></p>';
            }
        }, 8000);
    } else {
        // Word: 纯前端 docx-preview 渲染
        var wordContainer = overlay.querySelector('#wordContainer');
        var dlHref = card.querySelector('.detail-download-btn').getAttribute('href');

        // 动态加载 JSZip + docx-preview（本地文件，无需外部服务）
        function loadDocxPreview() {
            if (typeof docx !== 'undefined') { renderWord(); return; }
            // 先确保 JSZip 已加载
            if (typeof JSZip === 'undefined') {
                var s1 = document.createElement('script');
                s1.src = 'js/jszip.min.js';
                s1.onload = loadDocxPreview;
                s1.onerror = showWordFallback;
                document.head.appendChild(s1);
                return;
            }
            var s2 = document.createElement('script');
            s2.src = 'js/docx-preview.min.js';
            s2.onload = renderWord;
            s2.onerror = showWordFallback;
            document.head.appendChild(s2);
        }
        loadDocxPreview();

        function renderWord() {
            previewLoading.querySelector('p').textContent = '正在渲染文档...';
            fetch(previewUrl)
                .then(function(r) { return r.arrayBuffer(); })
                .then(function(buffer) {
                    return docx.renderAsync(buffer, wordContainer, null, {
                        className: 'docx-preview',
                        inWrapper: true,
                        breakPages: false,
                        ignoreWidth: true,   // 忽略文档固定宽度，自适应容器
                        ignoreHeight: true,  // 忽略文档固定高度
                        renderMode: 'single-page'
                    });
                })
                .then(function() {
                    previewLoading.style.display = 'none';
                    wordContainer.style.display = '';
                    // 清理 docx-preview 注入的 style 标签（它们会导致多余间距）
                    var sins = wordContainer.querySelectorAll('style');
                    for (var si = 0; si < sins.length; si++) sins[si].remove();
                    // 统一宽度，留出侧边距（与 PDF 风格一致）
                    var wsz = wordContainer.querySelectorAll('.docx-preview-wrapper, .docx-preview');
                    for (var wi = 0; wi < wsz.length; wi++) {
                        wsz[wi].style.setProperty('margin', '0', 'important');
                        wsz[wi].style.setProperty('width', (wordContainer.clientWidth - 16) + 'px', 'important');
                    }
                })
                .catch(function(e) {
                    console.warn('docx-preview 渲染失败:', e);
                    showWordFallback();
                });
        }

        function showWordFallback() {
            previewLoading.innerHTML = '<p style="color:#9e9488;font-size:13px;line-height:1.8;">'
                + '预览加载失败。<br>'
                + '试试 <a href="' + dlHref + '" download style="color:#ca8a04;">下载文件</a>'
                + ' 在本地打开</p>';
        }

        // docx-preview 渲染超时（15秒）
        card._previewTimeoutId = setTimeout(function() {
            if (previewLoading.style.display !== 'none') {
                showWordFallback();
            }
        }, 15000);
    }
}

async function renderPdfPreview(overlay, previewUrl, previewLoading) {
    var container = overlay.querySelector('#pdfContainer');
    try {
        var moduleUrl = new URL('js/pdf.min.mjs', document.baseURI).href;
        var workerUrl = new URL('js/pdf.worker.min.mjs', document.baseURI).href;
        var pdfjsLib = await import(moduleUrl);
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
        var pdf = await pdfjsLib.getDocument({ url: previewUrl }).promise;
        container.innerHTML = '';
        container.style.display = 'flex';

        async function renderPage(pageNumber) {
            var page = await pdf.getPage(pageNumber);
            var baseViewport = page.getViewport({ scale: 1 });
            var availableWidth = Math.max(1, container.clientWidth);
            var outputScale = Math.min(window.devicePixelRatio || 1, 2);
            var scale = availableWidth / baseViewport.width;
            var viewport = page.getViewport({ scale: scale });
            var canvas = document.createElement('canvas');
            canvas.className = 'pdf-page';
            canvas.width = Math.floor(viewport.width * outputScale);
            canvas.height = Math.floor(viewport.height * outputScale);
            canvas.style.width = Math.floor(viewport.width) + 'px';
            canvas.style.height = Math.floor(viewport.height) + 'px';
            container.appendChild(canvas);
            await page.render({
                canvasContext: canvas.getContext('2d'),
                viewport: viewport,
                transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0]
            }).promise;
        }

        for (var pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            await renderPage(pageNumber);
            if (pageNumber === 1) previewLoading.style.display = 'none';
        }
    } catch (error) {
        console.error('PDF preview failed:', error);
        previewLoading.innerHTML = '<p style="color:#9e9488;font-size:13px;line-height:1.8;">'
            + '预览加载失败，请 <a href="' + escapeAttr(previewUrl) + '" target="_blank" rel="noopener" style="color:#ca8a04;">在新标签页打开</a>'
            + ' 或直接下载文件。</p>';
    }
}

function exitPreviewMode(overlay) {
    var card = overlay.querySelector('#paperDetailCard');
    var header = overlay.querySelector('#detailHeader');
    var body = overlay.querySelector('#detailBody');
    var previewContainer = overlay.querySelector('#previewContainer');

    // 清除加载超时
    if (card._previewTimeoutId) {
        clearTimeout(card._previewTimeoutId);
        card._previewTimeoutId = null;
    }

    // 停止加载
    var wordContainer = overlay.querySelector('#wordContainer');
    if (wordContainer) { wordContainer.style.display = 'none'; wordContainer.innerHTML = ''; }
    var iframe = overlay.querySelector('#previewIframe');
    if (iframe) iframe.src = 'about:blank';

    // 恢复头部文字
    header.textContent = '试卷信息';

    // 显示信息区，隐藏预览区
    body.style.display = '';
    previewContainer.style.display = 'none';

    // 返回按钮 → 预览按钮（从 card.dataset 读取文件类型）
    var backBtn = overlay.querySelector('#previewBtn');
    if (backBtn) {
        var isPdf = card.dataset.previewIsPdf !== '0';
        var downloadHref = card.querySelector('.detail-download-btn').getAttribute('href');
        var absoluteUrl = downloadHref.indexOf('://') === -1
            ? window.location.origin + downloadHref
            : downloadHref;
        var newPreviewUrl = isPdf
            ? 'preview.html?url=' + encodeURIComponent(
                absoluteUrl.indexOf('github.io') >= 0
                    ? absoluteUrl
                    : 'https://HaximTus.github.io/tus' + downloadHref
              )
            : absoluteUrl;

        var previewBtn = document.createElement('button');
        previewBtn.className = 'detail-preview-btn';
        previewBtn.id = 'previewBtn';
        previewBtn.dataset.previewurl = newPreviewUrl;
        previewBtn.dataset.ispdf = isPdf ? '1' : '0';
        previewBtn.textContent = '在线预览';
        previewBtn.addEventListener('click', function() {
            enterPreviewMode(overlay);
        });
        backBtn.parentNode.replaceChild(previewBtn, backBtn);
    }

    // 移除预览样式
    card.classList.remove('preview-mode');
}

function closePaperDetail(overlay) {
    var card = overlay.querySelector('#paperDetailCard');
    if (card && card._previewTimeoutId) {
        clearTimeout(card._previewTimeoutId);
        card._previewTimeoutId = null;
    }
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.25s ease';
    setTimeout(function() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 250);
}

// ========== 跑马灯滚动（Web Animations API + translateX，GPU 加速 60fps） ==========
function startMarquee(el) {
    if (el._marqueeActive) return;

    var inner = el.querySelector('.marquee-inner');
    if (!inner) return;

    var maxPossible = el.scrollWidth - el.clientWidth;
    var scrollFade = Math.ceil(el.scrollWidth - el.clientWidth * 0.93);
    if (scrollFade > maxPossible) scrollFade = maxPossible;
    if (scrollFade <= 1) return;

    el._marqueeActive = true;

    // 根据滚动距离计算总时长：45px/s 滚动 + 两端各停 2s
    var SCROLL_SPEED = 45; // px/s
    var PAUSE = 2000;
    var scrollTime = (scrollFade / SCROLL_SPEED) * 1000; // ms
    var totalTime = scrollTime * 2 + PAUSE * 2;

    // 精确 keyframe 偏移：停→滚→停→滚
    var pPause1 = 0;
    var pEnd1   = PAUSE / totalTime;
    var pEnd2   = (PAUSE + scrollTime) / totalTime;
    var pEnd3   = (PAUSE + scrollTime + PAUSE) / totalTime;

    var distPx = -scrollFade + 'px';

    var anim = inner.animate([
        { transform: 'translateX(0)',        offset: pPause1 },
        { transform: 'translateX(0)',        offset: pEnd1   },
        { transform: 'translateX(' + distPx + ')', offset: pEnd2   },
        { transform: 'translateX(' + distPx + ')', offset: pEnd3   },
        { transform: 'translateX(0)',        offset: 1        }
    ], {
        duration: totalTime,
        iterations: Infinity,
        easing: 'linear'
    });

    el._marqueeAnim = anim;
}

// 清理跑马灯（在重新渲染时调用）
function stopMarquee(el) {
    if (el._marqueeAnim) {
        el._marqueeAnim.cancel();
        el._marqueeAnim = null;
    }
    el._marqueeActive = false;
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
