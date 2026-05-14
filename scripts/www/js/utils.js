// 工具函数模块

// DOM选择器快捷方式
const $ = (id) => document.getElementById(id);

// 生成唯一ID
const uid = () => "id_"+Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-4);

// 获取当前时间戳
const now = () => Date.now();

// 概率判断
const chance = p => Math.random() < p;

// 随机选择数组元素
const pick = arr => arr[Math.floor(Math.random()*arr.length)];

// 格式化时间（HH:mm）
const fmt = ts => {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

// 格式化日期（YYYY-MM-DD）
const dateKey = (ts=now()) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

// HTML转义
const esc = (str) => {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// 深度克隆对象
const clone = (obj) => {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => clone(item));
  if (obj instanceof Object) {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = clone(obj[key]);
      }
    }
    return clonedObj;
  }
};

// 深度合并对象
const deepMerge = (a, b) => {
  if(typeof a!=="object" || !a) return b ?? a;
  if(typeof b!=="object" || !b) return a;
  for(const k of Object.keys(b)){
    if(Array.isArray(b[k])) a[k]=b[k];
    else if(typeof b[k]==="object"&&b[k]) a[k]=deepMerge(a[k]||{}, b[k]);
    else a[k]=b[k];
  }
  return a;
};

// 延迟执行
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 调试日志
const debugLog = (hypothesisId, location, message, data) => {
  if (!CONFIG.DEBUG_ENDPOINT) return;
  fetch(CONFIG.DEBUG_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': CONFIG.DEBUG_SESSION_ID
    },
    body: JSON.stringify({
      sessionId: CONFIG.DEBUG_SESSION_ID,
      runId: `run_${Date.now()}`,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now()
    })
  }).catch(() => {});
};

export { $, uid, now, chance, pick, fmt, dateKey, esc, clone, deepMerge, delay, debugLog };
