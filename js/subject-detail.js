// Tus - 科目详情页逻辑

var downloadWorkerReady = registerDownloadWorker();

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
            var fileUrl = getSameOriginPaperUrl(rawPath);
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

function getSameOriginPaperUrl(filePath) {
    var hostname = window.location.hostname.toLowerCase();
    var isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    var siteOrigin = isLocal ? window.location.origin + getBaseUrl() : 'https://haximtus.cn';
    return siteOrigin + '/assets/papers/' + encodeURI(filePath || '');
}

function registerDownloadWorker() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(false);

    return navigator.serviceWorker.register(getBaseUrl() + '/download-worker.js?v=1', {
        scope: getBaseUrl() + '/'
    }).then(function() {
        return navigator.serviceWorker.ready;
    }).then(function() {
        if (navigator.serviceWorker.controller) return true;
        return new Promise(function(resolve) {
            var settled = false;
            function finish(value) {
                if (settled) return;
                settled = true;
                navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
                resolve(value);
            }
            function onControllerChange() { finish(true); }
            navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
            setTimeout(function() { finish(Boolean(navigator.serviceWorker.controller)); }, 3000);
        });
    }).catch(function(error) {
        console.warn('Download worker unavailable:', error);
        return false;
    });
}

function getDownloadRequestUrl(fileUrl, downloadName) {
    var url = new URL(fileUrl, window.location.href);
    url.searchParams.set('tus-download', '1');
    url.searchParams.set('name', downloadName);
    return url.href;
}

function startWorkerDownload(fileUrl, downloadName) {
    var frame = document.createElement('iframe');
    frame.hidden = true;
    frame.setAttribute('aria-hidden', 'true');
    frame.src = getDownloadRequestUrl(fileUrl, downloadName);
    document.body.appendChild(frame);
    setTimeout(function() {
        if (frame.parentNode) frame.parentNode.removeChild(frame);
    }, 60000);
}

function downloadPaperFile(fileUrl, downloadName, button) {
    var url;
    try {
        url = new URL(fileUrl, window.location.href);
    } catch (error) {
        return Promise.reject(new Error('下载地址无效'));
    }

    if (url.origin !== window.location.origin || url.pathname.indexOf('/assets/papers/') !== 0) {
        return Promise.reject(new Error('下载地址不是本站试卷文件'));
    }

    var originalText = button.textContent;
    button.textContent = '正在下载...';
    button.setAttribute('aria-busy', 'true');
    button.style.pointerEvents = 'none';

    function restoreButton() {
        button.textContent = originalText;
        button.removeAttribute('aria-busy');
        button.style.pointerEvents = '';
    }

    return downloadWorkerReady.then(function(workerAvailable) {
        if (workerAvailable) {
            startWorkerDownload(url.href, downloadName);
            return;
        }
        return fetchPaperBlob(url.href, downloadName);
    }).then(function() {
        restoreButton();
    }, function(error) {
        restoreButton();
        throw error;
    });
}

function fetchPaperBlob(fileUrl, downloadName) {
    return fetch(fileUrl, { credentials: 'same-origin', cache: 'force-cache' })
        .then(function(response) {
            if (!response.ok) throw new Error('下载请求失败：' + response.status);
            return response.blob();
        })
        .then(function(blob) {
            if (!blob.size) throw new Error('下载文件为空');

            if (window.navigator.msSaveOrOpenBlob) {
                window.navigator.msSaveOrOpenBlob(blob, downloadName);
                return;
            }

            var blobUrl = URL.createObjectURL(blob);
            var link = document.createElement('a');
            link.href = blobUrl;
            link.download = downloadName;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Safari may still be consuming the Blob URL after click returns.
            setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 60000);
        });
}

function previewLoaderHtml() {
    return '<div class="preview-loader" role="status" aria-live="polite">'
        + '<div class="paper-loader" aria-hidden="true">'
        +   '<span class="paper-loader-back"></span>'
        +   '<span class="paper-loader-sheet"><i></i><i></i><i></i><b></b></span>'
        + '</div>'
        + '<p class="preview-progress-status">正在准备试卷...</p>'
        + '<div class="preview-progress-track" role="progressbar" aria-label="预览加载进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">'
        +   '<span class="preview-progress-fill"></span>'
        + '</div>'
        + '<span class="preview-progress-value">0%</span>'
        + '</div>';
}

function updatePreviewProgress(overlay, progress, status) {
    var loading = overlay && overlay.querySelector('#previewLoading');
    if (!loading) return;
    var value = Math.max(0, Math.min(100, Math.round(progress || 0)));
    var statusElement = loading.querySelector('.preview-progress-status');
    var fill = loading.querySelector('.preview-progress-fill');
    var progressBar = loading.querySelector('.preview-progress-track');
    var valueElement = loading.querySelector('.preview-progress-value');
    if (statusElement && status) statusElement.textContent = status;
    if (fill) fill.style.width = value + '%';
    if (progressBar) progressBar.setAttribute('aria-valuenow', String(value));
    if (valueElement) valueElement.textContent = value + '%';
}

function resetPreviewLoader(overlay) {
    var loading = overlay && overlay.querySelector('#previewLoading');
    if (!loading) return;
    loading.classList.remove('is-error');
    loading.innerHTML = previewLoaderHtml();
    loading.style.display = '';
}

function preloadPdfs(papers) {
    var count = 0;
    for (var i = 0; i < papers.length; i++) {
        var p = papers[i];
        var ext = (p.file_name || p.file_path || '').split('.').pop().toLowerCase();
        if (ext !== 'pdf') continue;
        // 限制最多预取 3 个，且延迟到空闲时执行，避免和用户打开的预览争抢带宽。
        if (++count > 3) break;
        var fileUrl = getSameOriginPaperUrl(p.file_path || '');
        var preloadUrl = getAbsoluteUrl(fileUrl);
        var load = function() {
            fetch(preloadUrl, { cache: 'force-cache', priority: 'low' })
                .then(function(response) {
                    if (!response.ok) throw new Error('PDF preload failed: ' + response.status);
                    return response.arrayBuffer();
                })
                .catch(function() {});
        };
        if ('requestIdleCallback' in window) window.requestIdleCallback(load, { timeout: 5000 });
        else window.setTimeout(load, 1800 + i * 500);
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
    var downloadUrl = absoluteUrl;

    // PDF 与 Word 都从当前站点的同源文件加载。
    var previewUrl;
    var viewerHtml;
    if (isPdf) {
        previewUrl = absoluteUrl;
        viewerHtml = '<div class="pdf-viewer" id="pdfViewer" style="display:none;"></div>';
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
        +   '<div class="preview-loading" id="previewLoading">' + previewLoaderHtml() + '</div>'
        +   viewerHtml
        + '</div>'

        // 底部按钮
        + '<div class="detail-footer detail-footer-triple" id="detailFooter">'
        + '<button type="button" class="detail-preview-btn" id="previewBtn" data-previewurl="' + escapeAttr(previewUrl) + '" data-ispdf="' + (isPdf ? '1' : '0') + '" aria-pressed="false">在线预览</button>'
        + '<a href="' + escapeAttr(downloadUrl) + '" download="' + escapeAttr(paper.downloadName) + '" class="detail-download-btn" id="downloadBtn">下载文件</a>'
        + '<button type="button" class="detail-close-btn" id="closeBtn">关闭</button>'
        + '</div>'
        + '</div>';

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closePaperDetail(overlay);
    });

    var previewBtn = overlay.querySelector('#previewBtn');
    if (previewBtn) {
        previewBtn.addEventListener('click', function(event) {
            event.preventDefault();
            var card = overlay.querySelector('#paperDetailCard');
            if (card.classList.contains('preview-mode')) exitPreviewMode(overlay);
            else enterPreviewMode(overlay);
        });
    }

    var downloadBtn = overlay.querySelector('#downloadBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function(event) {
            event.preventDefault();
            if (downloadBtn.getAttribute('aria-busy') === 'true') return;
            downloadPaperFile(downloadBtn.href, paper.downloadName, downloadBtn)
                .catch(function(error) {
                    console.error('Paper download failed:', error);
                    window.alert('下载失败，请检查网络后重试。页面不会跳转。');
                });
        });
    }

    overlay.querySelector('#closeBtn').addEventListener('click', function() {
        closePaperDetail(overlay);
    });

    document.body.appendChild(overlay);
    overlay.querySelector('#paperDetailCard').dataset.previewUrl = previewUrl;
    void overlay.offsetWidth;

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
    resetPreviewLoader(overlay);

    // 始终复用同一个按钮，避免移动端替换节点后丢失触控事件。
    previewBtn.className = 'detail-back-btn';
    previewBtn.textContent = '← 返回详情';
    previewBtn.setAttribute('aria-pressed', 'true');

    // 卡片切换到预览模式（样式放大）
    card.classList.add('preview-mode');

    if (isPdf) {
        updatePreviewProgress(overlay, 2, '正在唤醒预览组件...');
        enhanceMobilePdf(overlay, previewUrl);
        // 网络较慢时保留动画并更新状态，不把用户引导离开预览。
        card._previewTimeoutId = setTimeout(function() {
            if (previewLoading.style.display !== 'none') {
                var progressTrack = previewLoading.querySelector('.preview-progress-track');
                var current = Number(progressTrack && progressTrack.getAttribute('aria-valuenow')) || 5;
                updatePreviewProgress(overlay, current, '网络有点慢，试卷还在路上...');
            }
        }, 8000);
    } else {
        // Word: 纯前端 docx-preview 渲染
        var wordContainer = overlay.querySelector('#wordContainer');

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
            updatePreviewProgress(overlay, 35, '正在展开文档...');
            fetch(previewUrl)
                .then(function(r) { return r.arrayBuffer(); })
                .then(function(buffer) {
                    updatePreviewProgress(overlay, 75, '正在排版页面...');
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
                    updatePreviewProgress(overlay, 100, '预览准备好了');
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
            previewLoading.classList.add('is-error');
            updatePreviewProgress(overlay, 0, '预览加载失败，请返回详情后重试');
        }

        // docx-preview 渲染超时（15秒）
        card._previewTimeoutId = setTimeout(function() {
            if (previewLoading.style.display !== 'none') {
                showWordFallback();
            }
        }, 15000);
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

    // 先取消仍在进行的渲染，并移交文档引用；资源销毁放到界面恢复之后。
    var exitGeneration = (card._pdfRenderGeneration || 0) + 1;
    card._pdfRenderGeneration = exitGeneration;
    var documentToDestroy = card._mobilePdfDocument;
    card._mobilePdfDocument = null;
    var renderStateToDestroy = card._pdfRenderState;
    card._pdfRenderState = null;

    var previewLoading = overlay.querySelector('#previewLoading');
    resetPreviewLoader(overlay);

    // 恢复头部文字
    header.textContent = '试卷信息';

    // 显示信息区，隐藏预览区
    body.style.display = '';
    previewContainer.style.display = 'none';

    // 恢复同一按钮，原有 URL、文件类型及事件监听均保持不变。
    var previewBtn = overlay.querySelector('#previewBtn');
    if (previewBtn) {
        previewBtn.className = 'detail-preview-btn';
        previewBtn.textContent = '在线预览';
        previewBtn.setAttribute('aria-pressed', 'false');
    }

    // 移除预览样式
    card.classList.remove('preview-mode');

    // 让浏览器先绘制详情界面，再清理大 Canvas 和 PDF Worker。
    var cleanupPreview = function() {
        if (renderStateToDestroy && renderStateToDestroy.observer) {
            renderStateToDestroy.observer.disconnect();
        }
        try {
            if (documentToDestroy) {
                var destroyResult = documentToDestroy.destroy();
                if (destroyResult && typeof destroyResult.catch === 'function') {
                    destroyResult.catch(function() {});
                }
            }
        } catch (error) {
            console.warn('PDF cleanup failed:', error);
        }

        // 用户若已再次进入预览，只销毁旧文档，不触碰新预览的 DOM。
        if (card._pdfRenderGeneration !== exitGeneration || card.classList.contains('preview-mode')) return;
        try {
            var wordContainer = overlay.querySelector('#wordContainer');
            if (wordContainer) { wordContainer.style.display = 'none'; wordContainer.innerHTML = ''; }
            var pdfViewer = overlay.querySelector('#pdfViewer');
            if (pdfViewer) {
                pdfViewer.style.display = 'none';
                pdfViewer.innerHTML = '';
            }
        } catch (error) {
            console.warn('Preview DOM cleanup failed:', error);
        }
    };

    if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(function() { setTimeout(cleanupPreview, 0); });
    } else {
        setTimeout(cleanupPreview, 0);
    }
}

function enhanceMobilePdf(overlay, previewUrl) {
    var card = overlay.querySelector('#paperDetailCard');
    var generation = (card._pdfRenderGeneration || 0) + 1;
    card._pdfRenderGeneration = generation;

    function startEnhancement() {
        if (!window.TusMobilePdfReady) return;
        window.TusMobilePdfReady.then(function(pdfjsLib) {
            if (!pdfjsLib || generation !== card._pdfRenderGeneration || !overlay.isConnected) return;
            updatePreviewProgress(overlay, 5, '正在读取试卷...');
            return renderMobilePdf(pdfjsLib, overlay, previewUrl, generation);
        }).catch(function(error) {
            console.warn('PDF preview unavailable:', error);
            showPdfFallback(overlay);
        });
    }

    if (window.TusMobilePdfReady) startEnhancement();
    else window.addEventListener('tus:mobile-pdf-init', startEnhancement, { once: true });
}

async function fetchPdfBytes(url, onProgress) {
    var response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) throw new Error('PDF fetch failed: ' + response.status);
    var total = Number(response.headers.get('Content-Length')) || 0;
    if (!response.body || typeof response.body.getReader !== 'function') {
        var buffer = await response.arrayBuffer();
        if (onProgress) onProgress(buffer.byteLength, buffer.byteLength, true);
        return new Uint8Array(buffer);
    }
    var reader = response.body.getReader();
    var chunks = [];
    var received = 0;
    while (true) {
        var result = await reader.read();
        if (result.done) break;
        chunks.push(result.value);
        received += result.value.byteLength;
        if (onProgress) onProgress(received, total, false);
    }
    var bytes = new Uint8Array(received);
    var offset = 0;
    for (var chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        bytes.set(chunks[chunkIndex], offset);
        offset += chunks[chunkIndex].byteLength;
    }
    if (onProgress) onProgress(received, total || received, true);
    return bytes;
}

function showPdfFallback(overlay) {
    if (!overlay || !overlay.isConnected) return;
    var card = overlay.querySelector('#paperDetailCard');
    var loading = overlay.querySelector('#previewLoading');
    if (!card || !loading || !card.classList.contains('preview-mode')) return;
    loading.style.display = '';
    loading.classList.add('is-error');
    updatePreviewProgress(overlay, 0, '预览加载失败，请返回详情后重试');
}

async function renderMobilePdf(pdfjsLib, overlay, previewUrl, generation) {
    var card = overlay.querySelector('#paperDetailCard');
    var previewContainer = overlay.querySelector('#previewContainer');
    var container = overlay.querySelector('#pdfViewer');
    var previewLoading = overlay.querySelector('#previewLoading');
    container.dataset.pdfjsVersion = pdfjsLib.version || 'unknown';
    var indeterminateProgress = 8;
    var pdfData = await fetchPdfBytes(previewUrl, function(received, total, done) {
        if (generation !== card._pdfRenderGeneration || !overlay.isConnected) return;
        var progress;
        if (total > 0) progress = 8 + (received / total) * 70;
        else {
            indeterminateProgress = Math.min(72, indeterminateProgress + 3);
            progress = indeterminateProgress;
        }
        updatePreviewProgress(overlay, done ? 78 : progress, done ? '试卷读取完成' : '正在读取试卷...');
    });
    if (generation !== card._pdfRenderGeneration || !overlay.isConnected) return;
    updatePreviewProgress(overlay, 82, '正在解析页面...');
    var loadingTask = pdfjsLib.getDocument({ data: pdfData });
    var pdf = await loadingTask.promise;
    if (generation !== card._pdfRenderGeneration || !overlay.isConnected) {
        await loadingTask.destroy();
        return;
    }
    card._mobilePdfDocument = loadingTask;
    updatePreviewProgress(overlay, 90, '正在绘制第一页...');
    container.innerHTML = '';
    container.style.display = 'flex';

    var state = { observer: null, rendered: Object.create(null), rendering: Object.create(null) };
    card._pdfRenderState = state;

    async function renderPage(pageNumber, shell) {
        if (state.rendered[pageNumber] || state.rendering[pageNumber]) return;
        if (generation !== card._pdfRenderGeneration || !overlay.isConnected) return;
        state.rendering[pageNumber] = true;
        try {
            var page = await pdf.getPage(pageNumber);
            var baseViewport = page.getViewport({ scale: 1 });
            var availableWidth = Math.max(1, Math.min(container.clientWidth - 12, 820));
            var outputScale = Math.min(window.devicePixelRatio || 1, 1.5);
            var viewport = page.getViewport({ scale: availableWidth / baseViewport.width });
            var canvas = document.createElement('canvas');
            canvas.className = 'pdf-page';
            canvas.width = Math.floor(viewport.width * outputScale);
            canvas.height = Math.floor(viewport.height * outputScale);
            canvas.style.width = Math.floor(viewport.width) + 'px';
            canvas.style.height = Math.floor(viewport.height) + 'px';
            await page.render({
                canvasContext: canvas.getContext('2d'),
                viewport: viewport,
                transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0]
            }).promise;
            if (generation !== card._pdfRenderGeneration || !overlay.isConnected) return;
            shell.innerHTML = '';
            shell.appendChild(canvas);
            shell.classList.add('is-rendered');
            state.rendered[pageNumber] = true;
            if (state.observer) state.observer.unobserve(shell);
            if (pageNumber === 1) {
                updatePreviewProgress(overlay, 100, '预览准备好了');
                setTimeout(function() {
                    if (generation === card._pdfRenderGeneration && overlay.isConnected) previewLoading.style.display = 'none';
                }, 180);
                if (card._previewTimeoutId) {
                    clearTimeout(card._previewTimeoutId);
                    card._previewTimeoutId = null;
                }
            }
        } finally {
            state.rendering[pageNumber] = false;
        }
    }

    async function appendPageShell(pageNumber) {
        if (generation !== card._pdfRenderGeneration || !overlay.isConnected) return;
        var page = await pdf.getPage(pageNumber);
        var viewport = page.getViewport({ scale: 1 });
        var shell = document.createElement('div');
        shell.className = 'pdf-page-shell';
        shell.dataset.pageNumber = String(pageNumber);
        shell.style.aspectRatio = viewport.width + ' / ' + viewport.height;
        var shellWidth = Math.max(1, Math.min(container.clientWidth - 12, 820));
        shell.style.minHeight = Math.round(shellWidth * viewport.height / viewport.width) + 'px';
        container.appendChild(shell);
        return shell;
    }

    var firstShell = await appendPageShell(1);
    if (firstShell) await renderPage(1, firstShell);

    if ('IntersectionObserver' in window) {
        state.observer = new IntersectionObserver(function(entries) {
            for (var i = 0; i < entries.length; i++) {
                if (entries[i].isIntersecting) {
                    var shell = entries[i].target;
                    renderPage(Number(shell.dataset.pageNumber), shell).catch(function(error) {
                        console.warn('PDF page render failed:', error);
                    });
                }
            }
        }, { root: previewContainer, rootMargin: '1200px 0px' });
    }

    for (var pageNumber = 2; pageNumber <= pdf.numPages; pageNumber++) {
        var shell = await appendPageShell(pageNumber);
        if (!shell) return;
        if (state.observer) state.observer.observe(shell);
        else await renderPage(pageNumber, shell);
    }

    // 第一页完成后，后台优先准备接下来两页，降低快速向下翻页时的等待。
    function warmNextPages() {
        if (generation !== card._pdfRenderGeneration || !overlay.isConnected) return;
        var priority = Math.min(pdf.numPages, 3);
        for (var warmPage = 2; warmPage <= priority; warmPage++) {
            var warmShell = container.querySelector('[data-page-number="' + warmPage + '"]');
            if (warmShell) renderPage(warmPage, warmShell).catch(function(error) {
                console.warn('PDF background render failed:', error);
            });
        }
    }
    if ('requestIdleCallback' in window) window.requestIdleCallback(warmNextPages, { timeout: 900 });
    else window.setTimeout(warmNextPages, 120);
}

function closePaperDetail(overlay) {
    var card = overlay.querySelector('#paperDetailCard');
    if (card && card._previewTimeoutId) {
        clearTimeout(card._previewTimeoutId);
        card._previewTimeoutId = null;
    }
    if (card && card._pdfRenderState && card._pdfRenderState.observer) {
        card._pdfRenderState.observer.disconnect();
    }
    if (card && card._mobilePdfDocument) {
        try {
            var destroyResult = card._mobilePdfDocument.destroy();
            if (destroyResult && typeof destroyResult.catch === 'function') destroyResult.catch(function() {});
        } catch (error) {
            console.warn('PDF cleanup failed:', error);
        }
        card._mobilePdfDocument = null;
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
