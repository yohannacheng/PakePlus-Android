// 视频通话模块
import { getState, setState, save } from './state.js';
import { $, uid, now, fmt } from './utils.js';

let callTimerInt = null;
let callStartTs = null;

// 显示/隐藏通话浮窗
function showCallFloat(show) {
  const callFloat = $('callFloat');
  if (callFloat) {
    callFloat.classList.toggle("show", !!show);
  }
}

// 发起通话
async function startCall() {
  const S = getState();
  
  // 如果已经有通话中，不允许发起新通话
  if (S.chat.activeCall) {
    alert('当前已有通话进行中');
    return;
  }
  
  // 创建通话记录
  const call = {
    id: uid(),
    direction: 'outgoing',
    status: 'invited',
    inviteAt: now(),
    connectedAt: null
  };
  
  S.chat.activeCall = call;
  await save();
  
  // 渲染通话浮窗
  renderCallFloat();
  showCallFloat(true);
  
  // 模拟对方接听
  setTimeout(() => {
    connectCall();
  }, 2000 + Math.random() * 3000);
}

// 接听通话
async function acceptCall() {
  const S = getState();
  if (!S.chat.activeCall || S.chat.activeCall.direction !== 'incoming') return;
  
  await connectCall();
}

// 连接通话
async function connectCall() {
  const S = getState();
  if (!S.chat.activeCall) return;
  
  S.chat.activeCall.status = "connected";
  S.chat.activeCall.connectedAt = now();
  
  await addCallMessage({
    id: uid(),
    sender: "other",
    type: "call_connected",
    content: `${S.profile.otherName} 已接听`,
    createdAt: now()
  });
  
  callStartTs = now();
  if (callTimerInt) clearInterval(callTimerInt);
  
  callTimerInt = setInterval(() => {
    if (!S.chat.activeCall || S.chat.activeCall.status !== "connected" || !callStartTs) {
      if (callTimerInt) {
        clearInterval(callTimerInt);
        callTimerInt = null;
      }
      return;
    }
    const dur = now() - callStartTs;
    const mm = String(Math.floor(dur / 60000)).padStart(2, "0");
    const ss = String(Math.floor((dur % 60000) / 1000)).padStart(2, "0");
    const timer = $("callTimer");
    if (timer) timer.textContent = `${mm}:${ss}`;
  }, 1000);
  
  renderCallFloat();
  await save();
}

// 拒接/取消通话
async function endCall(reason = '用户挂断') {
  const S = getState();
  if (!S.chat.activeCall) return;
  
  // 如果是未接通的通话，记录为未接
  if (S.chat.activeCall.status === 'invited') {
    await addCallMessage({
      id: uid(),
      sender: "other",
      type: "call_missed",
      content: `${S.profile.otherName} ${S.chat.activeCall.direction === 'incoming' ? '未接听' : '取消通话'}`,
      createdAt: now()
    });
  }
  
  // 清除计时器
  if (callTimerInt) {
    clearInterval(callTimerInt);
    callTimerInt = null;
  }
  callStartTs = null;
  
  // 清除通话状态
  S.chat.activeCall = null;
  await save();
  
  renderCallFloat();
  showCallFloat(false);
}

// 添加通话消息
async function addCallMessage(msg) {
  const S = getState();
  S.chat.messages.push(msg);
  await save();
  
  // 渲染消息
  const chat = $('chat');
  if (!chat) return;
  
  const row = document.createElement('div');
  row.className = 'center';
  row.textContent = msg.content;
  chat.appendChild(row);
  
  // 滚动到底部
  chat.scrollTop = chat.scrollHeight;
}

// 渲染通话浮窗
function renderCallFloat() {
  const S = getState();
  const c = S.chat.activeCall;
  const float = $("callFloat");
  const title = $("callTitle");
  const status = $("callStatus");
  const peerName = $("callPeerName");
  const timer = $("callTimer");
  
  const acceptBtn = $("acceptCallBtn");
  const rejectBtn = $("rejectCallBtn");
  const hangupBtn = $("hangupCallBtn");
  
  if (!c) {
    if (float) float.classList.remove("show");
    return;
  }
  
  if (float) float.classList.add("show");
  if (title) title.textContent = "视频通话";
  
  if (c.status === "invited") {
    if (c.direction === "incoming") {
      if (status) status.textContent = `${S.profile.otherName} 邀请你视频通话`;
      if (acceptBtn) acceptBtn.style.display = "";
      if (rejectBtn) {
        rejectBtn.style.display = "";
        rejectBtn.textContent = "拒接";
      }
      if (hangupBtn) hangupBtn.style.display = "none";
      if (peerName) peerName.style.display = "none";
      if (timer) timer.style.display = "none";
    } else {
      // 我方发起：不显示接听，只能取消
      if (status) status.textContent = `等待 ${S.profile.otherName} 接听...`;
      if (acceptBtn) acceptBtn.style.display = "none";
      if (rejectBtn) {
        rejectBtn.style.display = "";
        rejectBtn.textContent = "取消";
      }
      if (hangupBtn) hangupBtn.style.display = "none";
      if (peerName) peerName.style.display = "none";
      if (timer) timer.style.display = "none";
    }
  } else if (c.status === "connected") {
    if (status) {
      status.style.display = "none";
      status.textContent = "";
    }
    if (acceptBtn) acceptBtn.style.display = "none";
    if (rejectBtn) rejectBtn.style.display = "none";
    if (hangupBtn) hangupBtn.style.display = "";
    if (peerName) {
      peerName.style.display = "none";
      peerName.textContent = "";
    }
    if (timer) timer.style.display = "";
  } else {
    if (status) status.textContent = "通话结束";
    if (acceptBtn) acceptBtn.style.display = "none";
    if (rejectBtn) rejectBtn.style.display = "none";
    if (hangupBtn) hangupBtn.style.display = "none";
    if (peerName) peerName.style.display = "none";
    if (timer) timer.style.display = "none";
  }
  
  // 添加拖动功能（支持鼠标和触摸）
  if (float && !float.hasAttribute('data-drag-init')) {
    float.setAttribute('data-drag-init', 'true');
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    // 鼠标事件
    float.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = float.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      float.style.cursor = 'grabbing';
      e.preventDefault();
    });
    
    // 触摸事件（移动端）
    float.addEventListener('touchstart', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      const rect = float.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      e.preventDefault();
    }, { passive: false });
    
    // 节流函数
    let throttleTimer = null;
    const throttle = (callback, delay) => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        callback();
        throttleTimer = null;
      }, delay);
    };

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      throttle(() => {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
      let newLeft = startLeft + dx;
      let newTop = startTop + dy;
      
      // 限制在视窗内
      const rect = float.getBoundingClientRect();
      const maxLeft = window.innerWidth - rect.width;
      const maxTop = window.innerHeight - rect.height;
      
      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));
      
        float.style.left = newLeft + 'px';
        float.style.top = newTop + 'px';
        float.style.right = 'auto';
        float.style.bottom = 'auto';
      }, 16); // 约60fps
    });
    
    document.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      throttle(() => {
        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
      let newLeft = startLeft + dx;
      let newTop = startTop + dy;
      
      // 限制在视窗内
      const rect = float.getBoundingClientRect();
      const maxLeft = window.innerWidth - rect.width;
      const maxTop = window.innerHeight - rect.height;
      
      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));
      
        float.style.left = newLeft + 'px';
        float.style.top = newTop + 'px';
        float.style.right = 'auto';
        float.style.bottom = 'auto';
      }, 16); // 约60fps
      e.preventDefault();
    }, { passive: false });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
      float.style.cursor = 'move';
    });
    
    document.addEventListener('touchend', () => {
      isDragging = false;
      float.style.cursor = 'move';
    });
  }
}

// 导出函数
export {
  showCallFloat,
  startCall,
  acceptCall,
  connectCall,
  endCall,
  renderCallFloat
};
