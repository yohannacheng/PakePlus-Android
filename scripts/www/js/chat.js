// 聊天功能模块
import { getState, setState, save } from './state.js';
import { $, uid, now, fmt, esc, pick, chance } from './utils.js';
import { TAROT, PUNCT } from './config.js';

// 在模块顶层声明S变量
let S = getState();

// 创建全局Intersection Observer实例，用于图片懒加载
const imageObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target;
      const src = img.dataset.src;

      if (src) {
        // 加载图片
        img.src = src;

        // 图片加载完成后显示
        img.onload = () => {
          img.style.opacity = '1';
          img.alt = ''; // 清除加载提示
        };

        // 图片加载失败处理
        img.onerror = () => {
          img.alt = '图片加载失败';
          img.style.opacity = '1';
        };

        // 停止观察已加载的图片
        observer.unobserve(img);
      }
    }
  });
}, {
  root: null, // 使用视口作为根元素
  rootMargin: '100px', // 提前100px开始加载，提供更好的用户体验
  threshold: 0.01 // 元素出现1%时触发，更早开始加载
});

// 设置图片懒加载
function setupLazyLoad(img) {
  // 添加加载状态样式
  img.style.opacity = '0';
  img.style.transition = 'opacity 0.3s';

  // 开始观察图片
  imageObserver.observe(img);
}

// 渲染表情包预览
function renderStickerPreview() {
  const box = $('stickerPreview');
  S = getState(); // 更新S变量
  const list = S.libs.myStickers;
  
  if (!list.length) {
    box.innerHTML = "<div class='tiny'>暂无表情包</div>";
    return;
  }

  // 确保每个表情包都有唯一ID
  const listWithIds = list.map((item, index) => {
    if (typeof item === 'string') {
      return { id: `sticker_${Date.now()}_${index}`, src: item };
    }
    return item;
  });
  S.libs.myStickers = listWithIds;
  setState(S);

  // 使用DocumentFragment批量添加DOM元素
  const fragment = document.createDocumentFragment();

  listWithIds.forEach((item, i) => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'stickerItem';
    itemDiv.dataset.id = item.id;
    itemDiv.style.cssText = 'position:relative;display:inline-block;';

    const img = document.createElement('img');
    img.className = `stickerThumb ${S.chat.selectedStickerIndex === i ? 'active' : ''}`;
    // 使用data-src存储真实图片地址，实现懒加载
    img.dataset.src = item.src;
    img.alt = '表情包';
    img.style.cssText = 'opacity:0;transition:opacity 0.3s;';

    const delBtn = document.createElement('button');
    delBtn.className = 'stickerDelete';
    delBtn.dataset.delId = item.id;
    delBtn.style.cssText = 'display:none;position:absolute;top:2px;right:2px;width:20px;height:20px;border-radius:50%;background:#ff5f84;color:#fff;border:none;cursor:pointer;font-size:12px;';
    delBtn.textContent = '×';

    itemDiv.appendChild(img);
    itemDiv.appendChild(delBtn);
    fragment.appendChild(itemDiv);
  });

  box.innerHTML = '';
  box.appendChild(fragment);

  // 绑定事件
  box.querySelectorAll(".stickerItem").forEach(el => {
    const img = el.querySelector('img');
    const delBtn = el.querySelector('.stickerDelete');
    img.onclick = () => {
      const index = listWithIds.findIndex(item => item.id === el.dataset.id);
      S.chat.selectedStickerIndex = index;
      setState(S);
      renderStickerPreview();
    };
    // 鼠标悬停显示删除按钮
    img.onmouseenter = () => delBtn.style.display = 'block';
    img.onmouseleave = () => delBtn.style.display = 'none';
    // 删除表情包
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      const index = listWithIds.findIndex(item => item.id === el.dataset.id);
      if (index > -1) {
        S.libs.myStickers.splice(index, 1);
        if (S.chat.selectedStickerIndex >= S.libs.myStickers.length) {
          S.chat.selectedStickerIndex = Math.max(0, S.libs.myStickers.length - 1);
        }
        await save();
        renderStickerPreview();
      }
    };
  });

  // 使用全局imageObserver观察所有图片
  box.querySelectorAll('.stickerThumb').forEach(img => {
    imageObserver.observe(img);
  });
}

// 添加表情包
function addStickers(kind) {
  S = getState(); // 更新S变量
  // 确保数组被正确初始化
  if (!Array.isArray(S.libs.myStickers)) S.libs.myStickers = [];
  if (!Array.isArray(S.libs.replyStickers)) S.libs.replyStickers = [];

  const f = document.createElement("input");
  f.type = "file";
  f.accept = "image/*";
  f.multiple = true;

  // 图片压缩函数
  function compressImage(file, maxWidth, maxHeight, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // 计算缩放比例，保持长边不超过指定尺寸
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          } else {
            reject(new Error('压缩失败'));
          }
        }, 'image/jpeg', quality);

        URL.revokeObjectURL(img.src);
      };

      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error('图片加载失败'));
      };
    });
  }

  f.onchange = async () => {
    const files = [...(f.files || [])];
    if (!files.length) return;

    // 检查文件类型和大小
    const maxSize = 2 * 1024 * 1024; // 2MB
    const invalidFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        alert(`"${file.name}" 不是图片文件`);
        return true;
      }
      if (file.size > maxSize) {
        alert(`"${file.name}" 大小超过2MB`);
        return true;
      }
      return false;
    });

    if (invalidFiles.length > 0) {
      return;
    }

    // 限制并发数为3，避免同时处理太多图片
    const MAX_CONCURRENT = 3;
    let currentIndex = 0;
    let completed = 0;
    let failed = 0;
    const total = files.length;
    const processing = new Set(); // 跟踪正在处理的任务

    // 显示进度提示
    const progressDiv = document.createElement('div');
    progressDiv.id = 'sticker-progress';
    progressDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:white;padding:20px;border-radius:10px;z-index:9999;text-align:center;';
    progressDiv.innerHTML = `<div>正在处理图片... 0/${total}</div><div style="margin-top:10px;font-size:12px;opacity:0.8;">请勿关闭页面</div>`;
    document.body.appendChild(progressDiv);

    const updateProgress = () => {
      const progressEl = document.getElementById('sticker-progress');
      if (progressEl) {
        progressEl.innerHTML = `<div>正在处理图片... ${completed}/${total}</div>${failed > 0 ? `<div style="margin-top:5px;color:#ff6b6b;">失败: ${failed}</div>` : ''}<div style="margin-top:10px;font-size:12px;opacity:0.8;">请勿关闭页面</div>`;
      }
    };

    const processFile = async (file) => {
      try {
        // 压缩图片：长边120px，质量0.8
        const compressedSrc = await compressImage(file, 120, 120, 0.8);

        if (kind === "my") {
          S.libs.myStickers.push({ id: `sticker_${Date.now()}_${Math.random()}`, src: compressedSrc });
        } else {
          S.libs.replyStickers.push({ id: `sticker_${Date.now()}_${Math.random()}`, src: compressedSrc });
        }

        completed++;
        updateProgress();
      } catch (err) {
        console.error("图片处理失败:", err);
        failed++;
        completed++;
        updateProgress();
      } finally {
        processing.delete(file);
        // 如果还有未处理的文件，继续处理
        if (currentIndex < total && processing.size < MAX_CONCURRENT) {
          const nextFile = files[currentIndex++];
          processing.add(nextFile);
          processFile(nextFile);
        }
        // 如果所有文件都处理完成
        if (completed === total) {
          setTimeout(() => {
            const progressEl = document.getElementById('sticker-progress');
            if (progressEl) progressEl.remove();
          }, 500);

          await save();
          renderStickerPreview();
          if ($("settingsBody")) {
            const settingsModule = await import('./settings.js');
            if (settingsModule.renderSettingsBody) {
              settingsModule.renderSettingsBody();
            }
          }

          if (failed > 0) {
            alert(`处理完成！成功: ${completed - failed}/${total}，失败: ${failed}`);
          }
        }
      }
    };

    // 启动并发处理
    const initialWorkers = Math.min(MAX_CONCURRENT, total);
    for (let i = 0; i < initialWorkers; i++) {
      const file = files[currentIndex++];
      processing.add(file);
      processFile(file);
    }
  };

  f.click();
}

// 发送表情包
async function sendStickerByIndex(i) {
  S = getState(); // 更新S变量
  if (!S.libs.myStickers[i]) {
    alert("请先添加表情包");
    return;
  }
  const sticker = S.libs.myStickers[i];
  const content = typeof sticker === 'string' ? sticker : sticker.src;
  await addMessage({ id: uid(), sender: "me", type: "sticker", content: content, createdAt: now() });
  setTimeout(() => otherReplyToMy(), 1200);
}

// 对方回复我的消息
async function otherReplyToMy() {
  S = getState(); // 更新S变量
  if (!S.chat.unreadMyIds.length) return;
  const lastMy = [...S.chat.messages].reverse().find(m => m.sender === "me");
  if (!lastMy) return;

  S.chat.unreadMyIds = [];
  await save();
  renderChat();

  let p = 0.15;
  if (myRecentStreak() >= 3) p = 0.05;
  if (chance(p) && now() < lastMy.createdAt + 10 * 60 * 1000) return;

  typingThenSend(() => {
    const q = maybeQuoteTarget();
    const c = genOtherBasic();
    if (q) return { id: uid(), sender: "other", type: "quote", quote: q.content, replyTo: q.id, content: c, createdAt: now() };
    return { id: uid(), sender: "other", type: "normal", content: c, createdAt: now() };
  });

  // 记录延迟回复时间
  S = getState(); // 更新S变量
  const replyDelay = 10 + Math.random() * 5; // 10-15分钟后回复
  S.chat.pendingReplies = S.chat.pendingReplies || [];
  S.chat.pendingReplies.push({
    msgId: lastMy.id,
    replyAt: Date.now() + replyDelay * 60 * 1000, // 转换为毫秒
    replied: false
  });
  await save();
}

// 添加消息
async function addMessage(msg) {
  const S = getState();
  S.chat.messages.push(msg);

  if (msg.sender === "me") {
    S.stats.myCount++;
    if (msg.type === "normal" || msg.type === "quote") S.chat.unreadMyIds.push(msg.id);
  } else {
    S.stats.otherCount++;
    if (msg.replyTo) S.chat.unreadMyIds = S.chat.unreadMyIds.filter(id => id !== msg.replyTo);
  }

  renderChat();   // 先立刻刷新界面

  // 使用防抖机制，避免频繁保存
  if (window.saveDebounceTimer) {
    clearTimeout(window.saveDebounceTimer);
  }
  window.saveDebounceTimer = setTimeout(async () => {
    await save();
    window.saveDebounceTimer = null;
  }, 500); // 500ms内的多次操作只保存一次
}

// 发送消息
async function sendMessage(content = null, type = 'normal') {
  const input = $('msgInput');
  // 确保 content 是字符串，防止误传事件对象
  const safeContent = (typeof content === 'string' && content) ? content : null;
  const text = safeContent || input.value.trim();
  // 确保 type 是字符串，防止误传事件对象
  const safeType = (typeof type === 'string') ? type : 'normal';
  
  if (!text) return;

  // 检查是否在保留模式
  const S = getState();
  if (S.settings.queueMode) {
    // 添加到队列
    if (!S.chat.queue) S.chat.queue = [];
    S.chat.queue.push({
      content: text,
      type: safeType,
      createdAt: now()
    });
    setState(S);
    await save();

    // 更新队列UI
    if (typeof updateQueueUI === 'function') {
      updateQueueUI();
    }

    // 清空输入框
    if (!safeContent) {
      input.value = '';
    }

    return;
  }
  
  // 清空输入框
  if (!safeContent) {
    input.value = '';
  }
  
  // 添加我的消息
  const myMsg = {
    id: uid(),
    sender: 'me',
    type: safeType,
    content: text,
    createdAt: now()
  };
  
  await addMessage(myMsg);
  
  // 模拟对方回复
  generateReply(text);
}

// 生成对方基本回复
function genOtherBasic() {
  S = getState(); // 更新S变量
  const out = [];
  const count = chance(0.6) ? 1 : 2;

  while (out.length < count) {
    const r = Math.random();
    let v = "";
    if (r < 0.6) {
      v = pick(S.libs.replyCards).text;
    } else if (r < 0.8) {
      v = pick(S.libs.replyEmoji).text;
    } else {
      v = pick(S.libs.replyKaomoji).text;
    }
    if (!v || out.includes(v)) continue;
    out.push(v);
  }
  return out.join(" ");
}

// 可能引用目标
function maybeQuoteTarget() {
  S = getState(); // 更新S变量
  const cands = S.chat.messages.slice(-20).filter(m => (m.type === "normal" || m.type === "quote") && m.content);
  if (!cands.length) return null;
  const recent50HasQuote = S.chat.messages.slice(-50).some(m => m.type === "quote");
  if (!recent50HasQuote) return pick(cands);
  return chance(0.18) ? pick(cands) : null;
}

// 生成对方回复
function generateReply(myContent) {
  S = getState(); // 更新S变量


  

  

  

  

  
  // 使用typingThenSend实现输入中效果和延迟
  typingThenSend(() => {
    const q = maybeQuoteTarget();

    // 决定是否发送拍一拍消息（与互动相同的概率）
    if (chance(0.15)) {
      return {
        id: uid(),
        sender: 'other',
        type: 'poke',
        content: `${S.profile.otherName}拍了拍${S.profile.myName}`,
        createdAt: now()
      };
    }

    // 决定是否发送互动消息
    if (chance(0.35) && S.libs.interactions && S.libs.interactions.length > 0) {
      const interactionText = pick(S.libs.interactions).text;
      const decor = S.decor || {};
      const otherName = S.profile.otherName || '对方';
      const otherLeft = decor.otherLeft || '';
      const otherRight = decor.otherRight || '';
      return {
        id: uid(),
        sender: 'other',
        type: 'interaction',
        content: `${otherLeft} ${otherName} ${interactionText} ${otherRight}`,
        createdAt: now()
      };
    }

    const c = genOtherBasic();
    if (q) {
      return {
        id: uid(),
        sender: 'other',
        type: 'quote',
        quote: q.content,
        replyTo: q.id,
        content: c,
        createdAt: now()
      };
    }
    return {
      id: uid(),
      sender: 'other',
      type: 'normal',
      content: c,
      createdAt: now()
    };
  });
}

// 渲染单条消息
function renderMessage(msg) {
  const chat = $('chat');
  if (!chat) return;
  
  // 检查是否是居中显示的消息类型
  const centerTypes = new Set(["poke", "interaction", "tarot", "call_invite", "call_connected", "call_result", "call_hangup"]);
  if (centerTypes.has(msg.type)) {
    const d = document.createElement("div");
    d.className = "center";
    d.textContent = `${msg.content}  ${fmt(msg.createdAt)}`;
    chat.appendChild(d);
    return;
  }

  const isMe = msg.sender === 'me';
  
  const row = document.createElement('div');
  row.className = `row ${isMe ? 'me' : 'other'}`;
  row.dataset.msgId = msg.id;
  
  // 头像
  const avatar = document.createElement('div');
  avatar.className = 'ava';
  const avatarUrl = isMe ? getState().profile.myAvatar : getState().profile.otherAvatar;
  if (avatarUrl) {
    avatar.style.backgroundImage = `url(${avatarUrl})`;
  }
  
  // 消息气泡容器
  const bubbleWrap = document.createElement('div');
  bubbleWrap.className = 'bubbleWrap';
  
  // 消息气泡
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  
  // 根据消息类型渲染内容
  if (msg.type === 'normal') {
    bubble.innerHTML = esc(msg.content);
  } else if (msg.type === 'image') {
    const img = document.createElement('img');
    img.className = 'img';

    // 检查是否是图片ID（新格式）还是base64（旧格式）
    if (msg.content.startsWith('img_')) {
      img.dataset.imageId = msg.content; // 存储图片ID
      img.dataset.src = ''; // 初始为空，等待从IndexedDB加载
      img.alt = '加载中...';

      // 从IndexedDB加载图片数据
      import('./db.js').then(({ loadImage }) => {
        loadImage(msg.content).then(imageData => {
          if (imageData) {
            img.dataset.src = imageData;
            setupLazyLoad(img);
          } else {
            img.alt = '图片加载失败';
            img.style.opacity = '1';
          }
        }).catch(error => {
          console.error('加载图片失败:', error);
          img.alt = '图片加载失败';
          img.style.opacity = '1';
        });
      });
    } else {
      // 旧格式，直接使用base64
      img.dataset.src = msg.content;
      img.alt = '图片';
      setupLazyLoad(img);
    }

    bubble.appendChild(img);
  } else if (msg.type === 'sticker') {
    const img = document.createElement('img');
    img.className = 'stickerMsg';
    img.dataset.src = msg.content; // 使用data-src存储真实图片地址
    img.alt = '加载中...'; // 添加加载提示
    bubble.appendChild(img);

    // 使用Intersection Observer实现懒加载
    setupLazyLoad(img);
  } else if (msg.type === 'quote') {
    // 渲染引用消息
    const originalMsg = getState().chat.messages.find(m => m.id === msg.replyTo);
    if (originalMsg) {
      const quote = document.createElement('div');
      quote.className = 'quote';
      quote.textContent = originalMsg.content;
      bubble.appendChild(quote);
    }
    const content = document.createElement('div');
    content.innerHTML = esc(msg.content);
    bubble.appendChild(content);
  } else if (msg.type === 'call_connected') {
    bubble.innerHTML = `<span style="color:var(--accent-color)">📞 ${msg.content}</span>`;
  } else if (msg.type === 'call_missed') {
    bubble.innerHTML = `<span style="color:#ff5f84">📞 ${msg.content}</span>`;
  }
  
  bubbleWrap.appendChild(bubble);
  
  // 时间戳
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = fmt(msg.createdAt);
  bubbleWrap.appendChild(meta);
  
  // 组装消息行
  row.appendChild(avatar);
  row.appendChild(bubbleWrap);
  
  // 添加到聊天区域
  chat.appendChild(row);
}

// 滚动到底部
function scrollToBottom(smooth = true) {
  const chat = $('chat');
  if (!chat) return;

  if (smooth) {
    // 使用requestAnimationFrame优化滚动动画
    const targetScrollTop = chat.scrollHeight;
    const startScrollTop = chat.scrollTop;
    const distance = targetScrollTop - startScrollTop;
    const duration = 300; // 动画持续时间300ms
    let startTime = null;

    function animateScroll(currentTime) {
      if (!startTime) startTime = currentTime;
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);

      // 使用ease-out缓动函数
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      chat.scrollTop = startScrollTop + distance * easeProgress;

      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      }
    }

    requestAnimationFrame(animateScroll);
  } else {
    chat.scrollTop = chat.scrollHeight;
  }
}

// 清空聊天记录
async function clearChat() {
  if (!confirm('确定要清空所有聊天记录吗？')) return;
  
  const S = getState();
  S.chat.messages = [];
  S.chat.unreadMyIds = [];
  await save();
  
  const chat = $('chat');
  if (chat) {
    chat.innerHTML = '';
  }
}

// 删除单条消息
async function deleteMessage(msgId) {
  const S = getState();
  S.chat.messages = S.chat.messages.filter(m => m.id !== msgId);
  await save();
  
  const msgElement = document.querySelector(`[data-msg-id="${msgId}"]`);
  if (msgElement) {
    msgElement.remove();
  }
}

// 输入中然后发送
async function typingThenSend(builder, min = 5000, max = 10 * 60 * 1000) {
  const S = getState();
  S.chat.typing = true;
  renderChat();
  const d = min + Math.floor(Math.random() * (max - min));

  // 记录延迟发送时间
  const sendAt = Date.now() + d;
  const msg = builder();
  if (msg) {
    S.chat.pendingMessages = S.chat.pendingMessages || [];
    S.chat.pendingMessages.push({
      msg: msg,
      sendAt: sendAt,
      sent: false
    });
    await save();
  }
}

// 渲染聊天界面（带防抖和DOM复用）
let renderChatDebounceTimer = null;
// DOM元素复用池
const elementPool = {
  rows: [],
  wraps: [],
  bubbles: [],
  avatars: [],
  placeholders: [],
  tools: [],
  buttons: []
};

// 从复用池获取元素
function getFromPool(type) {
  const pool = elementPool[type];
  if (pool && pool.length > 0) {
    return pool.pop();
  }
  return null;
}

// 将元素归还到复用池
function returnToPool(type, element) {
  const pool = elementPool[type];
  if (pool && pool.length < 50) { // 限制池大小，避免内存泄漏
    // 清理元素状态
    element.className = '';
    element.style.cssText = '';
    element.innerHTML = '';
    // 清理事件处理器
    element.onclick = null;
    element.onmouseover = null;
    element.onmouseout = null;
    element.onmouseenter = null;
    element.onmouseleave = null;
    pool.push(element);
  }
}

function renderChat() {
  // 清除之前的定时器
  if (renderChatDebounceTimer) {
    clearTimeout(renderChatDebounceTimer);
  }

  // 使用requestAnimationFrame和防抖机制
  renderChatDebounceTimer = requestAnimationFrame(() => {
    const c = $('chat');
    if (!c) return;

    // 将现有元素归还到复用池
    const existingRows = c.querySelectorAll('.row');
    existingRows.forEach(row => {
      const avatar = row.querySelector('.ava');
      const placeholder = row.querySelector('div[style*="width: 34px"]');
      const bubbleWrap = row.querySelector('.bubbleWrap');
      const bubble = bubbleWrap?.querySelector('.bubble');
      const tools = bubbleWrap?.querySelector('.bubbleTools');
      const buttons = tools?.querySelectorAll('.msgTool');

      if (avatar) returnToPool('avatars', avatar);
      if (placeholder) returnToPool('placeholders', placeholder);
      if (bubbleWrap) returnToPool('wraps', bubbleWrap);
      if (bubble) returnToPool('bubbles', bubble);
      if (tools) returnToPool('tools', tools);
      if (buttons) {
        buttons.forEach(btn => returnToPool('buttons', btn));
      }
      returnToPool('rows', row);
    });

    c.innerHTML = "";
    let prevSender = null, prevTs = 0;
    S = getState(); // 更新S变量
    // 只渲染最后200条消息，避免加载过慢
    const messages = S.chat.messages.slice(-200);

  // 使用DocumentFragment批量添加DOM元素，减少重排
  const fragment = document.createDocumentFragment();
  const messageElements = []; // 缓存消息元素，用于引用定位

  // 使用Set优化类型查找，O(1)时间复杂度
  const centerTypes = new Set(["poke", "interaction", "tarot", "call_invite", "call_connected", "call_result", "call_hangup"]);

  messages.forEach(m => {
    if (centerTypes.has(m.type)) {
      const d = document.createElement("div");
      d.className = "center";
      d.textContent = `${m.content}  ${fmt(m.createdAt)}`;
      fragment.appendChild(d);
      return;
    }

    // 从复用池获取或创建row元素
    const row = getFromPool('rows') || document.createElement("div");
    row.className = `row ${m.sender === "me" ? "me" : "other"}`;
    row.dataset.msgId = m.id;
    const newSession = (m.createdAt - prevTs > 2 * 60 * 1000) || (m.sender !== prevSender);

    if (newSession) {
      // 从复用池获取或创建avatar元素
      const av = getFromPool('avatars') || document.createElement("div");
      av.className = "ava";
      const avatarUrl = m.sender === "me" ? (S.profile.myAvatar || "") : (S.profile.otherAvatar || "");
      av.style.backgroundImage = avatarUrl ? `url(${avatarUrl})` : "";
      row.appendChild(av);
    } else {
      // 从复用池获取或创建placeholder元素
      const h = getFromPool('placeholders') || document.createElement("div");
      h.style.width = "34px";
      row.appendChild(h);
    }

    // 从复用池获取或创建wrap元素
    const wrap = getFromPool('wraps') || document.createElement("div");
    wrap.className = "bubbleWrap";

    // 从复用池获取或创建bubble元素
    const b = getFromPool('bubbles') || document.createElement("div");
    b.className = "bubble";

    // 从复用池获取或创建tools元素
    const tools = getFromPool('tools') || document.createElement("div");
    tools.className = "bubbleTools";
    tools.style.display = "none"; // 默认隐藏
    tools.innerHTML = ''; // 清空旧内容

    // 创建引用按钮
    const q = document.createElement("button");
    q.className = "msgTool";
    q.title = "引用";
    q.textContent = "↩";
    q.onclick = (e) => {
      e.stopPropagation();
      $("msgInput").focus();
      S.chat.quotingMsgId = m.id;
      const quoteHint = document.getElementById("quoteHint");
      if(quoteHint) quoteHint.remove();
      const hint = document.createElement("div");
      hint.id = "quoteHint";
      hint.style.cssText = "padding: 5px 10px; background: var(--accent); color: white; border-radius: 4px; margin-bottom: 5px; font-size: 0.8rem; display: flex; justify-content: space-between; align-items: center; width: 100%; white-space: nowrap; overflow: hidden; position: absolute; bottom: 100%; left: 0; z-index: 10;";
      hint.innerHTML = `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;">正在引用：${esc(m.content)}</span><button style="background:none;border:none;color:white;cursor:pointer;font-size:1.2rem;flex-shrink:0;">×</button>`;
      hint.querySelector('button').onclick = (e) => {
        e.stopPropagation();
        clearQuote();
      };
      $("msgInput").parentNode.appendChild(hint);
    };

    // 创建删除按钮
    const del = document.createElement("button");
    del.className = "msgTool";
    del.title = "删除";
    del.textContent = "×";
    del.onclick = (e) => {
      e.stopPropagation();
      if(confirm("确定要删除这条消息吗？")) deleteMessage(m.id);
    };
    tools.appendChild(q);
    tools.appendChild(del);
    wrap.appendChild(tools);

    if (m.type === "quote" && m.quote) {
      const qd = document.createElement("div");
      qd.className = "quote";
      qd.textContent = `引用：${m.quote}`;
      qd.style.cursor = "pointer";
      qd.style.whiteSpace = "nowrap";
      qd.style.overflow = "hidden";
      qd.style.textOverflow = "ellipsis";
      qd.style.wordBreak = "normal";
      qd.style.wordWrap = "normal";
      qd.style.maxWidth = "100%";
      qd.style.display = "block";
      qd.title = "点击定位到原文";
      qd.onclick = (e) => {
        e.stopPropagation();
        // 查找被引用的消息（在完整消息数组中查找）
        const targetMsg = S.chat.messages.find(msg => msg.id === m.replyTo);
        if (targetMsg) {
          // 使用缓存的messageElements数组查找，避免重复查询DOM
          const targetElement = messageElements.find(el => el.dataset.msgId === targetMsg.id);
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetElement.style.backgroundColor = "var(--accent)";
            setTimeout(() => {
              targetElement.style.backgroundColor = "";
            }, 2000);
          }
        }
      };
      b.appendChild(qd);
    }

    if (m.type === "sticker") {
      const img = document.createElement("img");
      img.className = "stickerMsg";
      img.src = m.content;
      b.appendChild(img);
    } else {
      b.innerHTML = esc(m.content || "").replace(/\n/g, '<br>');
    }

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = fmt(m.createdAt);

    // 先添加bubble到wrap，再添加tools
    wrap.appendChild(b);
    wrap.appendChild(tools);
    wrap.appendChild(meta);
    row.appendChild(wrap);
    fragment.appendChild(row);
    messageElements.push(row);

    prevSender = m.sender;
    prevTs = m.createdAt;
  });

  // 一次性添加所有消息元素到DOM
  c.appendChild(fragment);

  // 为每个bubble元素绑定点击事件
  c.querySelectorAll('.bubble').forEach(b => {
    b.onclick = (e) => {
      // 防止点击工具按钮时触发
      if(e.target.closest('.msgTool')) return;
      // 显示当前消息的工具按钮
      const wrap = e.target.closest('.bubbleWrap');
      const tools = wrap.querySelector('.bubbleTools');
      if (tools) {
        // 先获取当前状态（考虑初始状态可能是空字符串）
        const currentDisplay = tools.style.display || window.getComputedStyle(tools).display;
        const isVisible = currentDisplay === 'flex';
        // 隐藏所有其他消息的工具按钮
        document.querySelectorAll('.bubbleTools').forEach(t => t.style.display = 'none');
        // 切换当前消息的工具按钮显示状态
        tools.style.display = isVisible ? 'none' : 'flex';
      }
    };
  });

  // 显示输入中提示
  if (S.chat.typing) {
    const typing = document.createElement("div");
    typing.className = "typing";
    typing.textContent = `${S.profile.otherName} 正在输入...`;
    c.appendChild(typing);
  }

  scrollToBottom();
  });
}

// 清除引用
function clearQuote() {
  const S = getState();
  S.chat.quotingMsgId = null;
  const quoteHint = document.getElementById("quoteHint");
  if (quoteHint) quoteHint.remove();
}

// 拍一拍功能
async function sendPoke() {
  const S = getState();
  const text = `${S.profile.myName}拍了拍${S.profile.otherName}`;

  const pokeMsg = {
    id: uid(),
    sender: 'me',
    type: 'poke',
    content: text,
    createdAt: now()
  };

  await addMessage(pokeMsg);

  // 拍一拍后，对方会像回复普通消息一样回复
  generateReply(text);
}

// 拍一拍自己功能
async function sendPokeSelf() {
  const S = getState();
  const text = `${S.profile.myName}拍了拍${S.profile.myName}`;

  const pokeMsg = {
    id: uid(),
    sender: 'me',
    type: 'poke',
    content: text,
    createdAt: now()
  };

  await addMessage(pokeMsg);

  // 拍一拍自己后，对方也会回复
  generateReply(text);
}

// 导出函数
export {
  addMessage,
  sendMessage,
  generateReply,
  renderMessage,
  renderChat,
  scrollToBottom,
  clearChat,
  deleteMessage,
  renderStickerPreview,
  addStickers,
  sendStickerByIndex,
  clearQuote,
  setupLazyLoad,
  sendPoke,
  sendPokeSelf
}
