@echo off
chcp 65001 >nul
echo ========================================
echo   花生的秘密基地 - 本地服务器启动脚本
echo ========================================
echo.
echo 正在启动本地服务器...
echo 服务器地址: http://localhost:8000
echo 按 Ctrl+C 停止服务器
echo.
python -m http.server 8000
pause
