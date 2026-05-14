# 花生的秘密基地 - 模块化版本

## 项目结构

```
secret-base/
├── index.html          # 主页面
├── css/
│   └── styles.css      # 样式文件
├── js/
│   ├── config.js       # 配置和常量
│   ├── db.js          # 数据库操作
│   ├── utils.js       # 工具函数
│   ├── state.js       # 状态管理
│   ├── chat.js        # 聊天功能
│   ├── tarot.js       # 塔罗占卜
│   ├── mood.js        # 心情天气
│   ├── mail.js        # 信箱功能
│   ├── call.js        # 视频通话
│   └── app.js         # 主程序入口
└── 图标/              # 图标资源
```

## 如何运行

### 方法一：使用 Python（推荐）

1. 确保已安装 Python（建议 Python 3.x）
2. 在项目目录打开命令行
3. 运行以下命令：

```bash
# Python 3.x
python -m http.server 8000

# 或者 Python 2.x
python -m SimpleHTTPServer 8000
```

4. 在浏览器中访问：http://localhost:8000

### 方法二：使用 Node.js

1. 安装 Node.js
2. 安装 http-server：

```bash
npm install -g http-server
```

3. 在项目目录运行：

```bash
http-server -p 8000
```

4. 在浏览器中访问：http://localhost:8000

### 方法三：使用 VS Code

1. 安装 "Live Server" 扩展
2. 右键点击 index.html
3. 选择 "Open with Live Server"

## 注意事项

- 不能直接双击 index.html 打开，必须通过本地服务器运行
- 首次运行会创建 IndexedDB 数据库
- 数据存储在浏览器本地，不会上传到服务器

## 功能模块

- 💬 聊天功能
- 🔮 塔罗占卜
- 🌤️ 心情天气
- 📧 信箱
- 📞 视频通话
- 🌙 夜间模式
- ⚙️ 设置中心
