# Tus - 北京工业大学试卷共享平台

## 项目概述
Tus 是一个面向北京工业大学学生的试卷共享平台，部署在 GitHub Pages。数据以 JSON 格式存储在仓库中，通过管理脚本进行内容管理。

## 项目路径
`C:\Users\Haxim\Tus\`

## 技术栈
- 纯 HTML/CSS/JS 静态网站
- Tailwind CSS (CDN)
- GitHub Pages 部署
- GitHub Actions 自动构建

## 目录结构
```
Tus/
├── index.html              # 首页 - 科目列表
├── subject-detail.html     # 科目详情页 - 试卷列表
├── submit.html             # 用户提交试卷页（同学们通过此页面提交）
├── upload.html             # 管理员上传试卷（引导页）
├── create-subject.html     # 管理员新建科目（引导页）
├── css/style.css           # 样式
├── js/
│   ├── api-client.js       # 数据 API 客户端（读取 JSON）
│   ├── index.js            # 首页逻辑
│   ├── subject-detail.js   # 科目详情逻辑
│   └── submit.js           # 用户提交试卷逻辑（创建 GitHub Issue）
├── data/
│   ├── subjects.json       # 科目数据
│   └── papers.json         # 试卷数据
├── assets/papers/          # PDF 试卷文件存放目录
├── scripts/
│   ├── manage.js           # 管理脚本（添加科目/试卷/审核提交/部署）
│   └── deploy-via-api.js   # API 部署脚本（当 git push 失败时使用）
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   └── submit-paper.yml  # 试卷提交的 Issue 模板
│   └── workflows/
│       └── deploy.yml       # GitHub Actions 部署配置
├── supabase-setup.sql      # (备用) Supabase 数据库初始化脚本
├── CLAUDE.md               # 本文件
└── README.md
```

## 数据模型

### subjects.json
```json
{
    "id": 1,
    "name": "高等数学",
    "teacher": "张老师",
    "description": "",
    "created_at": "2025-09-01"
}
```

### papers.json
```json
{
    "id": 1,
    "subject_id": 1,
    "title": "2024秋高等数学期末试卷",
    "year": 2024,
    "semester": "期末",
    "file_url": "",
    "file_path": "2024-gaoshu-qimo.pdf",
    "file_name": "2024-gaoshu-qimo.pdf",
    "file_size": 2048576,
    "uploaded_by": "匿名",
    "download_count": 0,
    "created_at": "2025-09-01"
}
```

## 常用操作

### 添加内容
```bash
cd C:\Users\Haxim\Tus
node scripts/manage.js
```

### 本地预览
可以使用 Live Server 或 Python HTTP 服务器：
```bash
cd C:\Users\Haxim\Tus
python -m http.server 8000
```
然后访问 http://localhost:8000

### 手动部署
```bash
cd C:\Users\Haxim\Tus
git add -A
git commit -m "更新内容"
git push
```
GitHub Actions 会自动部署到 Pages。

## 上线地址
https://tjiux.github.io/tus/

## 未来计划
- [ ] 添加 Supabase 后端支持在线提交
- [ ] 用户系统 + 积分奖励
- [ ] 积分排行榜
- [ ] 搜索功能增强
- [ ] 移动端体验优化

## 重要提醒
- 修改 HTML/JS/CSS 后需要重新部署才能生效
- PDF 文件应放在 `assets/papers/` 目录下
- GitHub 有 100MB 单个文件大小限制
- 部署后约 1-2 分钟生效