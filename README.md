# Tus - 北京工业大学试卷共享平台 📚

> 分享历年期中期末试题，帮同学们轻松备考！

## 访问地址
**[https://tjiux.github.io/tus/](https://tjiux.github.io/tus/)**

## 功能
- 📖 按科目浏览试卷，按年级筛选
- 🔍 按年份、学期、标题搜索试卷
- 📥 下载 PDF / Word 试卷
- 📤 同学们在线提交试卷（自动创建 GitHub Issue）
- 📜 站内公告系统
- ➕ 管理员通过管理脚本添加科目和试卷

## 技术栈
- 纯静态网站 (HTML/CSS/JS)
- Tailwind CSS 样式（CDN）
- GitHub Pages 托管
- GitHub Actions 自动部署
- 支持 GitHub API 部署（中国内地友好）

## 本地开发
```bash
# 进入项目
cd C:\Users\Haxim\Tus

# 本地预览
python -m http.server 8000

# 管理内容（添加/审核/部署）
node scripts/manage.js

# 或直接部署（git push 不通时使用）
node scripts/deploy-via-api.js
```

## 当前数据
- **科目**: 高等数学、高等数学-都柏林（2个）
- **试卷**: 都柏林高数期末/期中试卷（3份）
- **管理员**: 通过 `scripts/manage.js` 管理

## 未来计划
- [ ] 在线提交试卷（已实现基础版）
- [ ] 积分系统
- [ ] 积分排行榜
- [ ] 用户评论

## 贡献
如果你想分享试卷，可通过网站右上角「提交试卷」直接上传，或联系管理员。

---

北京工业大学 · BJUT · 同学互助 🤝