# 部署到 Netlify 指南

## 步骤一：初始化 Git 仓库

在项目目录下打开命令行（PowerShell 或 CMD），执行以下命令：

```bash
cd C:\Users\程语涵\OneDrive\桌面\secret-base
git init
git add .
git commit -m "Initial commit"
```

## 步骤二：推送到 GitHub

1. 访问 [GitHub](https://github.com/) 并登录/注册账号
2. 点击右上角的 "+" → "New repository"
3. 填写仓库信息：
   - Repository name: `secret-base`
   - Description: 秘密基地 - 一个互动聊天应用
   - 选择 Public 或 Private（根据你的需求）
   - 不要勾选 "Initialize this repository with a README"
4. 点击 "Create repository"

5. 在项目目录下执行以下命令（替换 `你的用户名`）：

```bash
git remote add origin https://github.com/你的用户名/secret-base.git
git branch -M main
git push -u origin main
```

如果遇到认证问题，可能需要使用 SSH 方式：

```bash
git remote set-url origin git@github.com:你的用户名/secret-base.git
git push -u origin main
```

## 步骤三：在 Netlify 部署

1. 访问 [Netlify](https://www.netlify.com/) 并登录/注册账号
   - 可以使用 GitHub 账号直接登录

2. 点击 "Add new site" → "Import an existing project"

3. 选择 "GitHub" 并授权访问你的仓库

4. 在仓库列表中选择 `secret-base`

5. 配置构建设置：
   - **Build command**: 留空（因为是静态网站）
   - **Publish directory**: `.`（根目录）
   - **Branch to deploy**: `main`

6. 点击 "Deploy site"

7. 等待部署完成（通常只需几秒钟）

8. 部署成功后，Netlify 会提供一个 URL，例如：
   - `https://your-site-name.netlify.app`

## 步骤四：自定义设置（可选）

### 修改站点名称

1. 在 Netlify 站点页面点击 "Site settings"
2. 找到 "Site information" → "Change site name"
3. 输入你想要的名称（例如：secret-base）
4. 保存后，你的 URL 会变为：`https://secret-base.netlify.app`

### 添加自定义域名

1. 在 "Site settings" 中找到 "Domain management"
2. 点击 "Add custom domain"
3. 输入你的域名（例如：www.yourdomain.com）
4. 按照提示在你的域名提供商处配置 DNS 记录

### 启用 HTTPS

Netlify 默认提供免费 HTTPS 证书，无需额外配置。

## 常见问题

### 1. 推送代码时提示认证失败

确保你已正确配置 Git 凭据：

```bash
git config --global user.name "你的用户名"
git config --global user.email "你的邮箱"
```

### 2. 部署后页面无法正常加载

检查以下几点：
- 确保所有文件路径正确
- 检查 `index.html` 是否在根目录
- 查看浏览器控制台是否有错误信息

### 3. 如何更新网站

每次修改代码后，执行：

```bash
git add .
git commit -m "描述你的更改"
git push
```

Netlify 会自动检测到推送并重新部署。

### 4. 如何查看部署历史

在 Netlify 站点页面点击 "Deploys" 标签，可以看到所有部署记录。

## 注意事项

- `.gitignore` 文件已配置，会自动排除备份文件和临时文件
- 确保不要上传敏感信息（如 API 密钥、密码等）
- 建议定期备份代码到本地

## 需要帮助？

如果遇到问题，可以查看：
- [Netlify 官方文档](https://docs.netlify.com/)
- [GitHub 文档](https://docs.github.com/)
