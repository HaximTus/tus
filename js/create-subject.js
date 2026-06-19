// Tus - 新建科目逻辑

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('createSubjectForm');
    const submitBtn = document.getElementById('submitBtn');
    const overlay = document.getElementById('loadingOverlay');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const name = document.getElementById('subjectName').value.trim();
        const teacher = document.getElementById('subjectTeacher').value.trim();
        const description = document.getElementById('subjectDescription').value.trim();

        if (!name) {
            alert('请输入科目名称');
            return;
        }

        // 显示加载
        overlay.classList.remove('hidden');
        submitBtn.disabled = true;

        try {
            const result = await createSubject(name, teacher, description);

            if (result) {
                // 创建成功，跳转到科目详情页
                window.location.href = `subject-detail.html?id=${result.id}`;
            } else {
                alert('创建失败，请稍后重试');
                overlay.classList.add('hidden');
                submitBtn.disabled = false;
            }
        } catch (e) {
            alert('创建失败: ' + (e.message || '未知错误'));
            overlay.classList.add('hidden');
            submitBtn.disabled = false;
        }
    });
});