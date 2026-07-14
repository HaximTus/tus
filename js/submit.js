/**
 * Tus - 用户提交试卷逻辑（直接 API 提交）
 *
 * 流程：
 * 1. 用户填写信息 + 选择 PDF
 * 2. 登录后端校验用户身份
 * 3. 后端保存文件并创建待审核 Issue
 * 4. 页面显示提交结果
 */

// 试卷通过登录后端提交，浏览器不再保存 GitHub 凭据。

// 兜底：如果 api-client.js 未加载
if (typeof charMatch === 'undefined') {
    window.charMatch = function(text, query) {
        if (!query) return true;
        const t = text.toLowerCase();
        const q = query.toLowerCase().replace(/\s/g, '');
        return [...q].every(char => t.includes(char));
    };
}
if (typeof getSubjects === 'undefined') {
    window.getSubjects = async function() { return []; };
}

document.addEventListener('DOMContentLoaded', async function() {
    // 填充年份
    const yearSelect = document.getElementById('paperYear');
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= 2000; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y + '年';
        yearSelect.appendChild(opt);
    }
    yearSelect.value = currentYear;

    // ========== 可搜索科目下拉框 ==========
    const subjectInput = document.getElementById('subjectSearch');
    const subjectDropdown = document.getElementById('subjectDropdown');
    const subjectHidden = document.getElementById('subjectHidden');
    const dropdownItems = document.getElementById('dropdownItems');

    let allSubjects = [];
    var subjectSelected = false;  // 标记是否从下拉框确认选择

    try {
        allSubjects = await getSubjects();
    } catch (e) {
        console.warn('加载科目失败:', e);
    }

    function renderDropdown(filter) {
        const filtered = filter
            ? allSubjects.filter(s => charMatch(s.name, filter))
            : allSubjects;

        if (filtered.length === 0) {
            dropdownItems.innerHTML = `
                <button type="button" class="w-full text-left px-4 py-3 text-sm text-stone-500 dark:text-stone-400 italic hover:bg-amber-50 dark:hover:bg-stone-700 transition-colors subject-new" data-name="${filter}">
                    创建新科目: "${filter}"
                </button>`;
            var newBtn = dropdownItems.querySelector('.subject-new');
            if (newBtn) {
                newBtn.addEventListener('click', function() {
                    subjectHidden.value = this.dataset.name;
                    subjectInput.value = this.dataset.name;
                    subjectDropdown.classList.add('hidden');
                    subjectSelected = true;
                });
            }
            return;
        }

        dropdownItems.innerHTML = filtered.map(s => {
            const gradeTag = s.grade ? `<span class="text-xs text-stone-400 dark:text-stone-500 ml-2">${s.grade}</span>` : '';
            return `<button type="button" class="w-full text-left px-4 py-2.5 text-sm text-stone-700 dark:text-stone-200 hover:bg-amber-50 dark:hover:bg-stone-700 hover:text-amber-800 dark:hover:text-amber-400 transition-colors flex items-center justify-between subject-option" data-name="${s.name}">
                ${s.name}${gradeTag}
            </button>`;
        }).join('');

        dropdownItems.querySelectorAll('.subject-option').forEach(btn => {
            btn.addEventListener('click', () => {
                subjectHidden.value = btn.dataset.name;
                subjectInput.value = btn.dataset.name;
                subjectDropdown.classList.add('hidden');
                subjectSelected = true;
            });
        });
    }

    subjectInput.addEventListener('input', function() {
        const val = this.value.trim();
        subjectHidden.value = val;
        subjectSelected = false;  // 重新输入取消选中状态
        subjectDropdown.classList.remove('hidden');
        renderDropdown(val);
    });

    subjectInput.addEventListener('blur', () => {
        setTimeout(() => subjectDropdown.classList.add('hidden'), 200);
    });

    subjectInput.addEventListener('focus', function() {
        subjectDropdown.classList.remove('hidden');
        renderDropdown(this.value.trim());
    });

    // ========== 文件上传处理 ==========
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const removeFile = document.getElementById('removeFile');

    let selectedFile = null;

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drop-zone-active'); });
    dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('drop-zone-active'); });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drop-zone-active');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFile(e.target.files[0]); });

    function handleFile(file) {
        const name = file.name.toLowerCase();
        if (!name.endsWith('.pdf') && !name.endsWith('.doc') && !name.endsWith('.docx')) {
            alert('只支持 PDF 或 Word（.doc/.docx）格式');
            return;
        }
        if (file.size > 10 * 1024 * 1024) { alert('文件大小超过 10MB 限制'); return; }
        selectedFile = file;
        fileName.textContent = file.name;
        fileSize.textContent = formatSize(file.size);
        fileInfo.classList.remove('hidden');
        dropZone.classList.add('hidden');
        /* form validated on submit */
    }

    removeFile.addEventListener('click', () => {
        selectedFile = null;
        fileInfo.classList.add('hidden');
        dropZone.classList.remove('hidden');
        fileInput.value = '';
        /* form validated on submit */
    });

    // ========== 表单验证 + 自动定位 ==========
    const form = document.getElementById('submitForm');
    const submitBtn = document.getElementById('submitBtn');

    // 必填字段列表（按页面顺序）
    var requiredFields = [
        { el: subjectHidden,         input: subjectInput,  label: '所属科目' },
        { el: document.getElementById('paperGrade'),   input: null,          label: '适用年级' },
        { el: document.getElementById('paperTitle'),   input: null,          label: '试卷标题' },
        { el: document.getElementById('paperYear'),    input: null,          label: '年份' },
        { el: document.getElementById('paperSemester'),input: null,          label: '学期' },
    ];

    // 清除红色高亮
    function clearErrors() {
        document.querySelectorAll('.submit-error').forEach(function(el) {
            el.classList.remove('submit-error');
        });
        document.querySelectorAll('.submit-error-msg').forEach(function(el) {
            el.remove();
        });
    }

    // 验证并定位到第一个空字段
    function validateAndFocus() {
        clearErrors();
        // 1. 科目（使用选中标记，输入文本不算确认）
        if (!subjectSelected || !subjectInput.value.trim()) {
            return focusError(subjectInput, '请选择或输入科目');
        }
        // 2. 年级
        var g = document.getElementById('paperGrade');
        if (!g.value) {
            return focusError(g, '请选择年级');
        }
        // 3. 标题
        var t = document.getElementById('paperTitle');
        if (!t.value.trim()) {
            return focusError(t, '请输入试卷标题');
        }
        // 4. 年份
        var y = document.getElementById('paperYear');
        if (!y.value) {
            return focusError(y, '请选择年份');
        }
        // 5. 学期
        var s = document.getElementById('paperSemester');
        if (!s.value) {
            return focusError(s, '请选择学期');
        }
        // 6. 文件
        if (!selectedFile) {
            return focusError(document.getElementById('dropZone'), '请选择试卷文件');
        }
        return true;
    }

    function focusError(el, msg) {
        el.classList.add('submit-error');
        // 添加错误提示（追加到父级底部，或与 label 同层）
        var err = document.createElement('p');
        err.className = 'submit-error-msg text-red-500 text-xs mt-1';
        err.textContent = msg;
        var parent = el.parentNode;
        // 如果父级是 grid 列（年份/学期），往上找一层到 form-group
        if (parent.parentNode && (parent.parentNode.classList.contains('grid') || parent.parentNode.id === 'submitForm')) {
            parent = parent.parentNode;
        }
        parent.appendChild(err);
        // 文件上传区不可聚焦，改为聚焦隐藏的 file input
        if (el.id === 'dropZone') {
            el.setAttribute('tabindex', '-1');
            el = document.getElementById('fileInput');
        }
        // 移动端兼容：延迟执行 scroll + focus，避开 iOS 限制
        setTimeout(function() {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            try { el.focus({ preventScroll: true }); } catch(e) { el.focus(); }
        }, 300);
        return false;
    }

    // 输入时清除错误状态
    document.querySelectorAll('#submitForm input, #submitForm select').forEach(function(el) {
        el.addEventListener('input', function() {
            this.classList.remove('submit-error');
            var next = this.parentNode.querySelector('.submit-error-msg');
            if (next) next.remove();
        });
        el.addEventListener('change', function() {
            this.classList.remove('submit-error');
            var next = this.parentNode.querySelector('.submit-error-msg');
            if (next) next.remove();
        });
    });

    // ========== 提交处理 ==========
    const progressOverlay = document.getElementById('progressOverlay');
    const progressText = document.getElementById('progressText');
    const successModal = document.getElementById('successModal');
    const errorModal = document.getElementById('errorModal');
    const errorText = document.getElementById('errorText');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!window.TusAuth || !window.TusAuth.getUser()) {
            location.href = 'account.html?return=submit.html';
            return;
        }

        // 先验证必填字段，未填则定位到第一个
        if (!validateAndFocus()) return;

        const subject = subjectHidden.value.trim();
        const title = document.getElementById('paperTitle').value.trim();
        const grade = document.getElementById('paperGrade').value;
        const year = document.getElementById('paperYear').value;
        const semester = document.getElementById('paperSemester').value;
        const teacher = document.getElementById('paperTeacher').value.trim();
        // 显示上传进度
        progressOverlay.classList.remove('hidden');
        progressText.textContent = '正在上传文件...';
        submitBtn.disabled = true;

        try {
            const fileContent = await readFileAsBase64(selectedFile);
            progressText.textContent = '正在提交到审核队列...';
            await window.TusAuth.request('/submissions', {
                method: 'POST',
                body: JSON.stringify({
                    subject: subject,
                    title: title,
                    grade: grade,
                    year: Number(year),
                    semester: semester,
                    teacher: teacher,
                    file: {
                        name: selectedFile.name,
                        size: selectedFile.size,
                        type: selectedFile.type,
                        content: fileContent
                    }
                })
            });

            progressOverlay.classList.add('hidden');
            document.querySelector('#successModal .text-stone-500').innerHTML =
                '感谢你的分享！<br>管理员审核后会尽快上线试卷';
            successModal.classList.remove('hidden');

        } catch (e) {
            progressOverlay.classList.add('hidden');
            errorText.textContent = e.message || '提交失败，请稍后重试';
            errorModal.classList.remove('hidden');
            submitBtn.disabled = false;
        }
    });
});

// ========== 文件读取 ==========
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = () => reject(new Error('读取文件失败，请重新选择文件'));
        reader.readAsDataURL(file);
    });
}
// ========== UI 辅助 ==========
function formatSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
