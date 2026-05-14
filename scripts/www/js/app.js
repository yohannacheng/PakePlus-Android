// 主程序入口
import { initDB } from './db.js';
import { init as initState, getState, setState, save } from './state.js';
import { $, now, delay, fmt } from './utils.js';
import { sendMessage, renderMessage, scrollToBottom, renderStickerPreview, addStickers, sendStickerByIndex } from './chat.js';
import { openFortuneModal, closeFortuneModal, drawThreeTarotCards, generateFortune } from './tarot.js';
import { renderMoodCalendar, saveMood, closeMoodModal, addMoodRecord, saveWeather as saveMoodWeather } from './mood.js';
import { renderMailList, openComposeMail, closeComposeMail, sendNewMail, closeMailDetail } from './mail.js';
import { startCall, acceptCall, endCall, renderCallFloat } from './call.js';
import { renderSettingsBody, renderTabs, currentTab, tabs } from './settings.js';

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 初始化数据库和状态
    await initDB();
    await initState();

    // 隐藏开场动画
    setTimeout(() => {
      const opening = $('opening');
      if (opening) {
        opening.classList.add('hide');
      }
    }, 1500);

    // 初始化UI
    initUI();

    // 加载聊天记录
    loadChatMessages();

    // 绑定事件监听器
    bindEventListeners();

    // 启动定时任务
    startTimers();

    console.log('应用初始化完成');
  } catch (error) {
    console.error('应用初始化失败:', error);
    alert('应用初始化失败，请刷新页面重试');
  }
});

// 初始化UI
function initUI() {
  const S = getState();

  // 设置头像
  if (S.profile.myAvatar) {
    $('myAvatar').style.backgroundImage = `url(${S.profile.myAvatar})`;
  }
  if (S.profile.otherAvatar) {
    $('otherAvatar').style.backgroundImage = `url(${S.profile.otherAvatar})`;
  }

  // 设置名称
  $('myName').textContent = S.profile.myName;
  $('otherName').textContent = S.profile.otherName;

  // 设置状态
  $('myStatus').textContent = S.profile.myStatus;
  $('otherStatus').textContent = S.profile.otherStatus;

  // 设置主题
  if (S.settings.dark) {
    document.body.classList.add('dark');
  }

  // 设置主题配色
  document.documentElement.style.setProperty('--theme-base', S.skin.themeBase);
  document.documentElement.style.setProperty('--theme-accent', S.skin.themeAccent);

  // 设置背景
  const currentBg = S.skin.backgroundLibrary.find(bg => bg.id === S.skin.currentBackgroundId);
  if (currentBg) {
    const chat = document.querySelector('.chat');
    if (chat) {
      if (currentBg.type === 'color') {
        chat.style.background = currentBg.value;
      } else if (currentBg.type === 'image') {
        // 预加载背景图片
        if (currentBg.value) {
          const img = new Image();
          img.onload = () => {
            chat.style.background = `url(${currentBg.value}) center/cover no-repeat`;
            // 移除加载提示
            const loadingHint = document.getElementById('bg-loading-hint');
            if (loadingHint) loadingHint.remove();
          };
          img.onerror = () => {
            // 加载失败提示
            console.error('背景图片加载失败');
            const loadingHint = document.getElementById('bg-loading-hint');
            if (loadingHint) {
              loadingHint.textContent = '背景图片加载失败';
              loadingHint.style.color = '#ff6b6b';
            }
          };
          img.src = currentBg.value;
        }

        // 显示加载提示
        if (currentBg.value) {
          const loadingHint = document.createElement('div');
          loadingHint.id = 'bg-loading-hint';
          loadingHint.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.7);color:white;padding:15px 25px;border-radius:8px;z-index:9999;font-size:14px;';
          loadingHint.textContent = '背景图片加载中...';
          document.body.appendChild(loadingHint);
        }
      }
    }
  }

  // 渲染心情日历
  renderMoodCalendar();

  // 渲染邮件列表
  renderMailList();

  // 渲染通知
  import('./mail.js').then(({ renderNotices }) => {
    renderNotices();
  });

  // 渲染通话浮窗
  renderCallFloat();
}

// 加载聊天消息
function loadChatMessages() {
  const S = getState();
  const chat = $('chat');
  if (!chat) return;

  chat.innerHTML = '';

  // 使用DocumentFragment批量添加DOM元素，减少重排和重绘
  const fragment = document.createDocumentFragment();

  // 只渲染最后200条消息，避免加载过慢
  const messages = S.chat.messages.slice(-200);

  messages.forEach(msg => {
    const isMe = msg.sender === 'me';

    const row = document.createElement('div');
    row.className = `row ${isMe ? 'me' : 'other'}`;
    row.dataset.msgId = msg.id;

    // 头像
    const avatar = document.createElement('div');
    avatar.className = 'ava';
    const avatarUrl = isMe ? S.profile.myAvatar : S.profile.otherAvatar;
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
      bubble.textContent = msg.content;
    } else if (msg.type === 'image') {
      const img = document.createElement('img');
      img.className = 'img';
      // 检查是否是图片ID（新格式）还是base64（旧格式）
      if (msg.content.startsWith('img_')) {
        img.dataset.imageId = msg.content; // 存储图片ID
        img.dataset.src = ''; // 初始为空，等待从IndexedDB加载
        img.alt = '加载中...';
      } else {
        // 旧格式，直接使用base64
        img.dataset.src = msg.content;
        img.alt = '图片';
      }
      bubble.appendChild(img);
    } else if (msg.type === 'sticker') {
      const img = document.createElement('img');
      img.className = 'stickerMsg';
      img.dataset.src = msg.content;
      img.alt = '表情包';
      bubble.appendChild(img);
    } else if (msg.type === 'quote') {
      const originalMsg = S.chat.messages.find(m => m.id === msg.replyTo);
      if (originalMsg) {
        const quote = document.createElement('div');
        quote.className = 'quote';
        quote.textContent = originalMsg.content;
        bubble.appendChild(quote);
      }
      const content = document.createElement('div');
      content.textContent = msg.content;
      bubble.appendChild(content);
    } else if (msg.type === 'call_connected') {
      bubble.innerHTML = `<span style="color:var(--accent-color)">📞 ${msg.content}</span>`;
    } else if (msg.type === 'call_missed') {
      bubble.innerHTML = `<span style="color:#ff5f84">📞 ${msg.content}</span>`;
    } else if (msg.type === 'poke' || msg.type === 'interaction') {
      // 拍一拍/互动消息：居中显示，没有头像和气泡
      const d = document.createElement("div");
      d.className = "center";
      d.textContent = `${msg.content}  ${fmt(msg.createdAt)}`;
      fragment.appendChild(d);
      return;
    }

    bubbleWrap.appendChild(bubble);

    // 工具按钮容器
    const tools = document.createElement('div');
    tools.className = 'bubbleTools';
    tools.style.display = 'none'; // 默认隐藏

    // 创建引用按钮
    const quoteBtn = document.createElement('button');
    quoteBtn.className = 'msgTool';
    quoteBtn.title = '引用';
    quoteBtn.textContent = '↩';
    quoteBtn.onclick = (e) => {
      e.stopPropagation();
      $('msgInput').focus();
      S.chat.quotingMsgId = msg.id;
      const quoteHint = document.getElementById('quoteHint');
      if(quoteHint) quoteHint.remove();
      const hint = document.createElement('div');
      hint.id = 'quoteHint';
      hint.style.cssText = 'padding: 5px 10px; background: var(--accent); color: white; border-radius: 4px; margin-bottom: 5px; font-size: 0.8rem; display: flex; justify-content: space-between; align-items: center; width: 100%; white-space: nowrap; overflow: hidden; position: absolute; bottom: 100%; left: 0; z-index: 10;';
      hint.innerHTML = `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;">正在引用：${msg.content}</span><button style="background:none;border:none;color:white;cursor:pointer;font-size:1.2rem;flex-shrink:0;">×</button>`;
      hint.querySelector('button').onclick = (e) => {
        e.stopPropagation();
        S.chat.quotingMsgId = null;
        hint.remove();
      };
      $('msgInput').parentNode.appendChild(hint);
    };
    tools.appendChild(quoteBtn);

    // 创建删除按钮
    const delBtn = document.createElement('button');
    delBtn.className = 'msgTool';
    delBtn.title = '删除';
    delBtn.textContent = '×';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      if(confirm('确定要删除这条消息吗？')) {
        S.chat.messages = S.chat.messages.filter(m => m.id !== msg.id);
        save();
        loadChatMessages();
      }
    };
    tools.appendChild(delBtn);

    bubbleWrap.appendChild(tools);

    // 时间戳
    const meta = document.createElement('div');
    meta.className = 'meta';
    // 格式化时间戳
    const date = new Date(msg.createdAt);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    meta.textContent = `${hours}:${minutes}`;
    bubbleWrap.appendChild(meta);

    // 组装消息行
    row.appendChild(avatar);
    row.appendChild(bubbleWrap);

    // 添加到fragment
    fragment.appendChild(row);
  });

  // 一次性添加所有消息到DOM
  chat.appendChild(fragment);

  // 初始化图片懒加载
  const images = chat.querySelectorAll('img[data-src]');
  images.forEach(img => {
    img.style.opacity = '0';
    img.style.transition = 'opacity 0.3s';

    // 如果有图片ID，从IndexedDB加载图片数据
    if (img.dataset.imageId) {
      import('./db.js').then(({ loadImage }) => {
        loadImage(img.dataset.imageId).then(imageData => {
          if (imageData) {
            img.dataset.src = imageData;
            // 导入setupLazyLoad函数
            import('./chat.js').then(({ setupLazyLoad }) => {
              setupLazyLoad(img);
            });
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
      // 导入setupLazyLoad函数
      import('./chat.js').then(({ setupLazyLoad }) => {
        setupLazyLoad(img);
      });
    }
  });

  // 滚动到底部
  scrollToBottom();

  // 为每个bubble元素绑定点击事件
  chat.querySelectorAll('.bubble').forEach(b => {
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
}

// 绑定事件监听器
function bindEventListeners() {
  // 昵称点击更改
  const myName = $('myName');
  if (myName) {
    myName.style.cursor = 'pointer';
    myName.title = '点击更改昵称';
    myName.addEventListener('click', () => {
      const S = getState();
      const newName = prompt('请输入新的昵称：', S.profile.myName);
      if (newName !== null) {
        S.profile.myName = newName.trim() || S.profile.myName;
        setState(S);
        save();
        myName.textContent = S.profile.myName;

        // 如果设置面板打开，同步更新昵称输入框
        const myNameInput = $('myNameInput');
        if (myNameInput) {
          myNameInput.value = S.profile.myName;
        }
      }
    });
  }

  // 对方昵称点击更改
  const otherName = $('otherName');
  if (otherName) {
    otherName.style.cursor = 'pointer';
    otherName.title = '点击修改对方昵称';
    otherName.addEventListener('click', () => {
      const S = getState();
      const newName = prompt('请输入对方的新昵称：', S.profile.otherName);
      if (newName !== null) {
        S.profile.otherName = newName.trim() || S.profile.otherName;
        setState(S);
        save();
        otherName.textContent = S.profile.otherName;

        // 如果设置面板打开，同步更新昵称输入框
        const otherNameInput = $('otherNameInput');
        if (otherNameInput) {
          otherNameInput.value = S.profile.otherName;
        }
      }
    });
  }

  // 状态点击更改
  const myStatus = $('myStatus');
  if (myStatus) {
    myStatus.style.cursor = 'pointer';
    myStatus.title = '点击更改状态';
    myStatus.addEventListener('click', () => {
      const S = getState();
      const newStatus = prompt('请输入新的状态：', S.profile.myStatus);
      if (newStatus !== null) {
        S.profile.myStatus = newStatus.trim() || S.profile.myStatus;
        setState(S);
        save();
        myStatus.textContent = S.profile.myStatus;

        // 如果设置面板打开，同步更新状态输入框
        const myStatusInput = $('myStatusInput');
        if (myStatusInput) {
          myStatusInput.value = S.profile.myStatus;
        }
      }
    });
  }



  // 发送按钮
  const sendBtn = $('sendBtn');
  if (sendBtn) {
    sendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      sendMessage();
    });
  }

  // 输入框回车发送
  const msgInput = $('msgInput');
  if (msgInput) {
    msgInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // 夜间模式
  const darkBtn = $('darkBtn');
  if (darkBtn) {
    darkBtn.addEventListener('click', toggleDarkMode);
  }

  // 心情天气
  const moodBtn = $('moodBtn');
  if (moodBtn) {
    moodBtn.addEventListener('click', () => {
      $('moodMask').classList.add('show');
    });
  }

  const closeMoodBtn = $('closeMoodBtn');
  if (closeMoodBtn) {
    closeMoodBtn.addEventListener('click', closeMoodModal);
  }

  const addMyMoodBtn = $('addMyMoodBtn');
  if (addMyMoodBtn) {
    addMyMoodBtn.addEventListener('click', saveMood);
  }

  const saveMyWeatherBtn = $('saveMyWeatherBtn');
  if (saveMyWeatherBtn) {
    saveMyWeatherBtn.addEventListener('click', () => {
      const input = $('myWeatherInput');
      if (input) {
        const weather = input.value.trim();
        if (weather) {
          import('./mood.js').then(({ saveWeather }) => {
            saveWeather(weather);
            input.value = '';
          });
        }
      }
    });
  }

  // 信箱
  const mailBtn = $('mailBtn');
  if (mailBtn) {
    mailBtn.addEventListener('click', () => {
      $('mailMask').classList.add('show');
      renderMailList();
    });
  }

  const closeMailBtn = $('closeMailBtn');
  if (closeMailBtn) {
    closeMailBtn.addEventListener('click', () => {
      $('mailMask').classList.remove('show');
    });
  }

  const closeMailDetailBtn = $('closeMailDetailBtn');
  if (closeMailDetailBtn) {
    closeMailDetailBtn.addEventListener('click', () => {
      $('mailDetailMask').classList.remove('show');
    });
  }

  const cancelComposeMailBtn = $('cancelComposeMailBtn');
  if (cancelComposeMailBtn) {
    cancelComposeMailBtn.addEventListener('click', () => {
      $('composeMailMask').classList.remove('show');
      $('composeMailContent').value = '';
    });
  }

  const sendComposeMailBtn = $('sendComposeMailBtn');
  if (sendComposeMailBtn) {
    sendComposeMailBtn.addEventListener('click', () => {
      const content = $('composeMailContent').value.trim();
      if (content) {
        sendNewMail(content);
      }
    });
  }

  const sendLetterBtn = $('sendLetterBtn');
  if (sendLetterBtn) {
    sendLetterBtn.addEventListener('click', () => {
      const content = $('myLetterInput').value.trim();
      if (content) {
        sendNewMail(content);
      }
    });
  }

  const mailSearchBtn = $('mailSearchBtn');
  if (mailSearchBtn) {
    mailSearchBtn.addEventListener('click', () => {
      const term = $('mailSearchInput').value.trim();
      import('./mail.js').then(({ searchMail }) => {
        searchMail(term);
      });
    });
  }

  // 运势
  const fortuneBtn = $('fortuneBtn');
  if (fortuneBtn) {
    fortuneBtn.addEventListener('click', openFortuneModal);
  }

  const closeFortuneBtn = $('closeFortuneBtn');
  if (closeFortuneBtn) {
    closeFortuneBtn.addEventListener('click', closeFortuneModal);
  }

  // 塔罗占卜
  const tarotBtn = $('tarotBtn');
  if (tarotBtn) {
    tarotBtn.addEventListener('click', () => {
      import('./tarot.js').then(({ drawThreeTarotCards }) => {
        drawThreeTarotCards();
      });
    });
  }

  const closeTarotBtn = $('closeTarotBtn');
  if (closeTarotBtn) {
    closeTarotBtn.addEventListener('click', () => {
      import('./tarot.js').then(({ closeTarotModal }) => {
        closeTarotModal();
      });
    });
  }

  // 通话
  const callBtn = $('callBtn');
  if (callBtn) {
    callBtn.addEventListener('click', startCall);
  }

  const acceptCallBtn = $('acceptCallBtn');
  if (acceptCallBtn) {
    acceptCallBtn.addEventListener('click', acceptCall);
  }

  const rejectCallBtn = $('rejectCallBtn');
  if (rejectCallBtn) {
    rejectCallBtn.addEventListener('click', endCall);
  }

  const hangupCallBtn = $('hangupCallBtn');
  if (hangupCallBtn) {
    hangupCallBtn.addEventListener('click', endCall);
  }

  // 折叠面板
  const foldBtn = $('foldBtn');
  if (foldBtn) {
    foldBtn.addEventListener('click', () => {
      const panel = $('foldPanel');
      if (panel) {
        panel.classList.toggle('show');
      }
    });
  }

  // 设置
  const settingsBtn = $('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', async () => {
      renderTabs();
      await renderSettingsBody();
      $('settingsMask').classList.add('show');
    });
  }

  // 拍一拍功能 - 双击头像
  let lastClickTime = 0;
  const clickDelay = 300; // 双击间隔时间（毫秒）

  document.addEventListener('click', async (e) => {
    const avaElement = e.target.closest('.ava');
    if (!avaElement) return;

    // 检查这个.ava元素的父元素是否是#myAvatar
    const isMyAvatar = avaElement.parentElement && avaElement.parentElement.id === 'myAvatar';
    // 检查这个.ava元素的父元素是否是#otherAvatar
    const isOtherAvatar = avaElement.parentElement && avaElement.parentElement.id === 'otherAvatar';

    // 如果不是顶部头像，检查是否是聊天消息中的头像
    let isMyMessageAvatar = false;
    let isOtherMessageAvatar = false;
    if (!isMyAvatar && !isOtherAvatar) {
      // 查找最近的.row元素
      const rowElement = avaElement.closest('.row');
      if (rowElement) {
        // 检查.row元素是否有'me'类
        isMyMessageAvatar = rowElement.classList.contains('me');
        isOtherMessageAvatar = rowElement.classList.contains('other');
      }
    }

    const currentTime = Date.now();
    const timeDiff = currentTime - lastClickTime;

    if (isMyAvatar || isMyMessageAvatar) {
      if (timeDiff < clickDelay) {
        // 检测到双击自己头像
        const { sendPokeSelf } = await import('./chat.js');
        await sendPokeSelf();
      }
    } else if (isOtherAvatar || isOtherMessageAvatar) {
      if (timeDiff < clickDelay) {
        // 检测到双击对方头像
        const { sendPoke } = await import('./chat.js');
        await sendPoke();
      }
    }

    lastClickTime = currentTime;
  });

  const closeSettingsBtn = $('closeSettingsBtn');
  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', () => {
      $('settingsMask').classList.remove('show');
    });
  }

  // 表情包功能
  const addStickerBtn = $('addStickerBtn');
  if (addStickerBtn) {
    addStickerBtn.addEventListener('click', () => {
      addStickers('my');
    });
  }

  const sendStickerBtn = $('sendStickerBtn');
  if (sendStickerBtn) {
    sendStickerBtn.addEventListener('click', () => {
      const S = getState();
      sendStickerByIndex(S.chat.selectedStickerIndex || 0);
    });
  }

  // 发送互动功能
  const sendInteractBtn = $('sendInteractBtn');
  if (sendInteractBtn) {
    sendInteractBtn.addEventListener('click', () => {
      const input = $('quickInteractInput');
      if (input) {
        const content = input.value.trim();
        if (content) {
          const S = getState();
          const decor = S.decor || {};
          const myName = S.profile.myName || '我';
          const meLeft = decor.meLeft || '';
          const meRight = decor.meRight || '';
          const messageContent = `${meLeft} ${myName} ${content} ${meRight}`;
          sendMessage(messageContent, 'interaction');
          input.value = '';
        }
      }
    });
  }

  // 初始化表情包预览
  renderStickerPreview();

  // 图片功能
  const imgInputBtn = $('imgInputBtn');
  const imgInput = $('imgInput');
  if (imgInputBtn && imgInput) {
    imgInputBtn.addEventListener('click', () => {
      imgInput.click();
    });

    imgInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // 检查文件类型
      if (!file.type.startsWith('image/')) {
        alert('请选择图片文件');
        imgInput.value = '';
        return;
      }

      // 检查文件大小（限制为5MB）
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        alert('图片大小不能超过5MB');
        imgInput.value = '';
        return;
      }

      // 读取图片并转换为base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const imageId = `img_${Date.now()}`;
        const imageData = event.target.result;

        // 保存图片到IndexedDB
        try {
          const { saveImage } = await import('./db.js');
          await saveImage(imageId, imageData);

          const S = getState();
          const msg = {
            id: Date.now().toString(),
            sender: 'me',
            type: 'image',
            content: imageId, // 只存储图片ID，不存储base64数据
            createdAt: Date.now()
          };
          S.chat.messages.push(msg);
          await save();
          renderMessage(msg);
          scrollToBottom();
        } catch (error) {
          console.error('保存图片失败:', error);
          alert('保存图片失败，请重试');
        }
      };
      reader.readAsDataURL(file);
      imgInput.value = ''; // 重置input
    });
  }

  // 再发一条功能
  const forceOtherBtn = $('forceOtherBtn');
  if (forceOtherBtn) {
    forceOtherBtn.addEventListener('click', async () => {
      const { generateReply } = await import('./chat.js');
      generateReply();
    });
  }

  // 保留框开关
  const queueModeBtn = $('queueModeBtn');
  if (queueModeBtn) {
    queueModeBtn.addEventListener('click', () => {
      const S = getState();
      S.settings.queueMode = !S.settings.queueMode;
      setState(S);
      save();
      updateQueueUI();
    });
  }

  // 全部发送按钮
  const queueFlushBtn = $('queueFlushBtn');
  if (queueFlushBtn) {
    queueFlushBtn.addEventListener('click', async () => {
      const S = getState();
      const queue = S.chat.queue || [];
      if (queue.length === 0) {
        alert('没有待发送的消息');
        return;
      }

      // 发送队列中的所有消息
      for (const msg of queue) {
        await sendMessage(msg.content, msg.type);
      }

      // 清空队列
      S.chat.queue = [];
      setState(S);
      await save();
      updateQueueUI();
    });
  }

  // 初始化队列UI
  updateQueueUI();
}

// 更新队列UI
function updateQueueUI() {
  const S = getState();
  const queueModeBtn = $('queueModeBtn');
  const queueFlushBtn = $('queueFlushBtn');
  const queueInfo = $('queueInfo');

  if (queueModeBtn) {
    queueModeBtn.style.opacity = S.settings.queueMode ? '1' : '0.5';
  }

  if (queueFlushBtn) {
    queueFlushBtn.style.display = S.settings.queueMode ? 'block' : 'none';
  }

  if (queueInfo) {
    const queue = S.chat.queue || [];
    queueInfo.textContent = queue.length > 0 ? `${queue.length}条待发` : '';
  }
}

// 切换夜间模式
async function toggleDarkMode() {
  const S = getState();
  S.settings.dark = !S.settings.dark;
  await save();

  document.body.classList.toggle('dark', S.settings.dark);
}

// 定时器管理
const timers = {
  proactiveReply: null,
  statusUpdate: null,
  moodWeather: null,
  noticeCleanup: null
};

// 启动定时任务
function startTimers() {
  // 清除已有的定时器
  stopTimers();

  // 每10分钟检查一次是否需要生成主动回复（实际需要5小时才回复）
  timers.proactiveReply = setInterval(async () => {
    const S = getState();
    const now = Date.now();
    const date = new Date(now);
    const hour = date.getHours();

    // 检查是否在夜间时段（22:00-06:00）
    const isNightTime = hour >= 22 || hour < 6;

    // 检查是否需要生成主动回复（夜间不计入5小时）
    if (!isNightTime && now - S.chat.lastProactiveAt > 5 * 60 * 60 * 1000) { // 5小时
      import('./chat.js').then(({ generateReply }) => {
        generateReply();
      });
    }
  }, 10 * 60 * 1000); // 10分钟检查一次

  // 每10分钟检查一次是否需要更新状态（实际需要0.5-5小时才更新）
  timers.statusUpdate = setInterval(async () => {
    const S = getState();
    const now = Date.now();

    if (now > S.chat.nextStatusUpdateAt) {
      const statuses = S.libs.statuses;
      const newStatus = statuses[Math.floor(Math.random() * statuses.length)];
      S.profile.otherStatus = newStatus;
      // 随机设置下次更新时间为0.5-5小时之间
      const randomHours = 0.5 + Math.random() * 4.5;
      S.chat.nextStatusUpdateAt = now + randomHours * 60 * 60 * 1000;
      await save();

      const otherStatus = $('otherStatus');
      if (otherStatus) {
        otherStatus.textContent = newStatus;
      }
    }
  }, 10 * 60 * 1000); // 10分钟检查一次

  // 每10分钟检查一次是否需要生成对方心情天气
  timers.moodWeather = setInterval(async () => {
    import('./mood.js').then(({ ensureDay, addMoodRecord, saveWeather }) => {
      evaluateOtherMoodWeather(ensureDay, addMoodRecord, saveWeather);
    });
  }, 10 * 60 * 1000); // 10分钟检查一次

  // 每5分钟清理一次过期公告
  timers.noticeCleanup = setInterval(async () => {
    await cleanupExpiredNotices();
  }, 5 * 60 * 1000); // 5分钟检查一次
}

// 停止所有定时器
function stopTimers() {
  if (timers.proactiveReply) {
    clearInterval(timers.proactiveReply);
    timers.proactiveReply = null;
  }
  if (timers.statusUpdate) {
    clearInterval(timers.statusUpdate);
    timers.statusUpdate = null;
  }
  if (timers.moodWeather) {
    clearInterval(timers.moodWeather);
    timers.moodWeather = null;
  }
  if (timers.noticeCleanup) {
    clearInterval(timers.noticeCleanup);
    timers.noticeCleanup = null;
  }
}

// 渲染所有界面（轻量版）
function renderAllLite() {
  const S = getState();

  // 更新个人资料
  if (S.profile.myAvatar) {
    $('myAvatar').style.backgroundImage = `url(${S.profile.myAvatar})`;
  }
  if (S.profile.otherAvatar) {
    $('otherAvatar').style.backgroundImage = `url(${S.profile.otherAvatar})`;
  }
  $('myName').textContent = S.profile.myName;
  $('otherName').textContent = S.profile.otherName;
  $('myStatus').textContent = S.profile.myStatus;
  $('otherStatus').textContent = S.profile.otherStatus;

  // 更新背景
  const currentBg = S.skin.backgroundLibrary.find(bg => bg.id === S.skin.currentBackgroundId);
  if (currentBg) {
    if (currentBg.type === 'color') {
      document.documentElement.style.setProperty('--bg', currentBg.value);
    } else if (currentBg.type === 'image') {
      const chat = document.querySelector('.chat');
      if (chat && currentBg.value) {
        chat.style.backgroundImage = `url(${currentBg.value})`;
      }
    }
  }

  // 更新夜间模式
  document.body.classList.toggle('dark', S.settings.dark);

  // 重新渲染聊天消息
  loadChatMessages();

  // 渲染表情包预览
  renderStickerPreview();

  // 渲染心情日历
  renderMoodCalendar();

  // 渲染邮件列表
  renderMailList();

  // 渲染通话浮窗
  renderCallFloat();
}

// 导出 renderAllLite 函数供其他模块使用
export { renderAllLite };

// 评估并生成对方心情天气
async function evaluateOtherMoodWeather(ensureDay, addMoodRecord, saveWeather) {
  const S = getState();
  const d = ensureDay();

  // 每次1条，最多3条，间隔3-24小时随机
  const minGap = 3 * 60 * 60 * 1000;
  const maxGap = 24 * 60 * 60 * 1000;

  // 生成随机间隔函数
  const getRandomGap = () => minGap + Math.floor(Math.random() * (maxGap - minGap));

  if (!d.otherNextWeatherAt) d.otherNextWeatherAt = now() + getRandomGap();
  if (!d.otherNextMoodAt) d.otherNextMoodAt = now() + getRandomGap();

  // 生成对方天气
  if (d.otherWeather.length < 3 && now() >= d.otherNextWeatherAt) {
    const w = pick(S.libs.weatherPool);
    if (w) {
      d.otherWeather.push(w);
    } else {
      d.otherWeather.push("☀️ 晴朗");
    }
    d.otherNextWeatherAt = now() + getRandomGap();
    await save();
  }

  // 生成对方心情
  if (d.otherMoods.length < 3 && now() >= d.otherNextMoodAt) {
    const m = pick(S.libs.moodsPool);
    if (m) {
      const emo = m.split(" ")[0];
      d.otherMoods.push(`${emo}||${generateCardSentence()}`);
    } else {
      d.otherMoods.push(`😊||${generateCardSentence()}`);
    }
    d.otherNextMoodAt = now() + getRandomGap();
    await save();
  }
}

// 生成随机句子（8-20个词）
function generateCardSentence(min = 8, max = 20) {
  const S = getState();
  const n = min + Math.floor(Math.random() * (max - min + 1));
  const punctuation = ['，', '。', '！', '？', '~'];

  let sentence = '';
  for (let i = 0; i < n; i++) {
    // 按照概率选择类型：字卡70%、表情15%、颜文字15%
    const r = Math.random();
    let value = '';

    if (r < 0.70) {
      // 字卡 70%
      const cards = S.libs.replyCards || [];
      value = cards.length > 0 ? cards[Math.floor(Math.random() * cards.length)].text : '...';
    } else if (r < 0.85) {
      // 表情 15%
      const emojis = S.libs.replyEmoji || [];
      value = emojis.length > 0 ? emojis[Math.floor(Math.random() * emojis.length)].text : '💬';
    } else {
      // 颜文字 15%
      const kaomojis = S.libs.replyKaomoji || [];
      value = kaomojis.length > 0 ? kaomojis[Math.floor(Math.random() * kaomojis.length)].text : '(•‿•)';
    }

    sentence += value + punctuation[Math.floor(Math.random() * punctuation.length)];
  }

  return sentence;
}

// 清理过期公告
async function cleanupExpiredNotices() {
  const S = getState();
  const currentTime = now();
  let hasChanges = false;

  // 清理current中过期的公告
  if (Array.isArray(S.notices.current)) {
    const beforeCount = S.notices.current.length;

    // 分离过期和未过期的公告
    const expiredNotices = [];
    const validNotices = [];

    S.notices.current.forEach(notice => {
      if (notice.expireAt && currentTime >= notice.expireAt) {
        // 过期的公告，根据archiveStatus决定是否归档
        if (notice.archiveStatus !== 'no_archive') {
          // 归档过期公告
          notice.archivedAt = currentTime;
          S.notices.archive.push(notice);
        }
        expiredNotices.push(notice);
      } else {
        validNotices.push(notice);
      }
    });

    // 更新current数组
    S.notices.current = validNotices;

    // 限制archive数量，最多保留200条
    if (S.notices.archive.length > 200) {
      S.notices.archive = S.notices.archive.slice(-200);
    }

    if (beforeCount !== S.notices.current.length) {
      hasChanges = true;
    }
  }

  // 如果有变化，保存并重新渲染
  if (hasChanges) {
    setState(S);
    await save();
    // 重新渲染通知
    import('./mail.js').then(({ renderNotices }) => {
      renderNotices();
    });
  }
}
