/**
 * Tus - 用户提交试卷逻辑
 *
 * 提交方式：
 * 1. 用户填写试卷信息表单
 * 2. 点击提交后打开 GitHub Issues 页面（信息已预填）
 * 3. 用户把 PDF 拖拽到 Issue 中（GitHub 自动托管文件）
 * 4. 管理员在 GitHub Issues 页面审核处理
 *
 * 无需嵌入任何 Token，安全可靠！
 */

document.addEventListener('DOMContentLoaded', function() {
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

    // ========== 文件上传处理 ==========
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const removeFile = document.getElementById('removeFile');

    let selectedFile = null;

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drop-zone-active');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drop-zone-active');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drop-zone-active');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });

    function handleFile(file) {
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            alert('只支持 PDF 格式');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            alert('文件大小超过 10MB 限制');
            return;
        }
        selectedFile = file;
        fileName.textContent = file.name;
        fileSize.textContent = formatSize(file.size);
        fileInfo.classList.remove('hidden');
        dropZone.classList.add('hidden');
        checkForm();
    }

    removeFile.addEventListener('click', () => {
        selectedFile = null;
        fileInfo.classList.add('hidden');
        dropZone.classList.remove('hidden');
        fileInput.value = '';
        checkForm();
    });

    // ========== 表单验证 ==========
    const form = document.getElementById('submitForm');
    const submitBtn = document.getElementById('submitBtn');

    function checkForm() {
        const subject = document.getElementById('paperSubject').value || document.getElementById('paperSubjectOther').value.trim();
        const title = document.getElementById('paperTitle').value.trim();
        submitBtn.disabled = !(subject && title && selectedFile);
    }

    document.querySelectorAll('#submitForm input, #submitForm select').forEach(el => {
        el.addEventListener('change', checkForm);
        el.addEventListener('input', checkForm);
    });

    // ========== 提交处理 ==========
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const subject = document.getElementById('paperSubject').value || document.getElementById('paperSubjectOther').value.trim();
        const title = document.getElementById('paperTitle').value.trim();
        const year = document.getElementById('paperYear').value;
        const semester = document.getElementById('paperSemester').value;
        const teacher = document.getElementById('paperTeacher').value.trim();
        const uploader = document.getElementById('paperUploader').value.trim() || '热心同学';

        // 显示提示
        document.getElementById('progressSpinner').classList.remove('hidden');
        document.getElementById('progressText').textContent = '正在跳转到 GitHub...';
        document.getElementById('progressOverlay').classList.remove('hidden');

        // 构建 Issue 标题和内容（URL 编码）
        const issueTitle = `[新试卷] ${title}（${subject}·${semester}）`;
        const issueBody = buildIssueBody(subject, title, year, semester, teacher, uploader, selectedFile.name);

        // 打开 GitHub Issues 页面（预填信息）
        const githubUrl = `https://github.com/tjiux/tus/issues/new?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}`;

        // 延迟一下让用户看到提示
        setTimeout(() => {
            window.open(githubUrl, '_blank');
            document.getElementById('progressOverlay').classList.add('hidden');
            showSuccessHint();
        }, 800);
    });
});

// ========== 构建 Issue 内容 ==========
function buildIssueBody(subject, title, year, semester, teacher, uploader, pdfName) {
    let body = `### 📋 试卷信息\n\n`;
    body += `| 项目 | 内容 |\n`;
    body += `|------|------|\n`;
    body += `| **科目** | ${subject} |\n`;
    body += `| **标题** | ${title} |\n`;
    body += `| **年份** | ${year} |\n`;
    body += `| **学期** | ${semester} |\n`;
    if (teacher) body += `| **教师** | ${teacher} |\n`;
    body += `| **提交者** | ${uploader} |\n`;
    body += `\n---\n\n`;
    body += `### 📎 PDF 文件\n\n`;
    body += `> 请将 PDF 文件拖拽到此处（支持拖拽上传）\n\n`;
    body += `---\n`;
    body += `*由 Tus 提交系统生成*`;
    return body;
}

// ========== UI 辅助 ==========
function showSuccessHint() {
    const modal = document.getElementById('successModal');
    modal.classList.remove('hidden');

    // 修改成功弹窗的文字（因为不是真正的提交成功）
    document.querySelector('#successModal h3').textContent = '请完成最后一步！';
    document.querySelector('#successModal .text-gray-500').innerHTML =
        '页面已打开，请：<br>' +
        '1️⃣ 检查预填的信息是否正确<br>' +
        '2️⃣ 将 PDF 文件拖拽到页面中<br>' +
        '3️⃣ 点击「Submit new issue」提交';
    document.querySelector('#successModal .text-gray-400').textContent = '管理员审核后会尽快上线';
}

function formatSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}