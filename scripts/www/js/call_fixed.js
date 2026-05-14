// 视频通话模块
import { getState, setState, save } from './state.js';
import { $, uid, now, fmt } from './utils.js';
import { addMessage } from './chat.js';

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
async function startCall(direction = "outgoing", reason = "normal") {
  const S = getState();

  // 如果已经有通话中，不允许发起新通话
  if (S.chat.activeCall) {
    alert("当前已有通话，无法并发");
    return;
  }

  // 创建通话记录
  const call = {
    id: uid(),
    direction,
    status: "invited",
    reason,
    inviteAt: now(),
    connectedAt: null
  };

  S.chat.activeCall = call;

  const text = direction === "outgoing"
    ? `${S.profile.myName} 发起了视频通话邀请`
    : `${S.profile.otherName} 发起了视频通话邀请`;

  await addMessage({
    id: uid(),
    sender: direction === "outgoing" ? "me" : "other",
    type: "call_invite",
    content: text,
    createdAt: now()
  });

  renderCallFloat();

  if (direction === "outgoing") {
    // 对方处理：22%概率拒接，26%概率错过，52%概率接通
    const r = Math.random();
    if (r < 0.22) {
      setTimeout(() => endCall("rejected_by_other"), Math.random() * 2 * 60 * 1000);
    } else if (r < 0.48) {
      setTimeout(() => endCall("missed_by_other"), 2 * 60 * 1000);
    } else {
      setTimeout(() => connectCall(), Math.random() * 2 * 60 * 1000);
    }
  } else {
    // 来电2分钟后自动转为未接
    setTimeout(() => {
      if (S.chat.activeCall && S.chat.activeCall.status === "invited") {
        endCall("missed_by_me");
      }
    }, 2 * 60 * 1000);
  }

  await save();
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

  await addMessage({
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

    // 检查是否超过10小时，自动挂断
    if (dur >= 10 * 60 * 60 * 1000) {
      endCall("call_duration_exceeded");
      return;
    }

    const mm = String(Math.floor(dur / 60000)).padStart(2, "0");
    const ss = String(Math.floor((dur % 60000) / 1000)).padStart(2, "0");
    const timer = $("callTimer");
    if (timer) timer.textContent = `${mm}:${ss}`;
  }, 1000);

  renderCallFloat();
  await save();
}

// 结束通话
async function endCall(status) {
  const S = getState();
  if (!S.chat.activeCall) return;

  if (status === "rejected_by_other") {
    await addMessage({
      id: uid(),
      sender: "other",
      type: "call_result",
      content: `${S.profile.otherName} 拒接了视频通话`,
      createdAt: now()
    });
  } else if (status === "missed_by_other") {
    await addMessage({
      id: uid(),
      sender: "other",
      type: "call_result",
      content: `${S.profile.otherName} 错过了视频通话`,
      createdAt: now()
    });
    S.chat.missedCallPending = { ts: now() };
  } else if (status === "missed_by_me") {
    await addMessage({
      id: uid(),
      sender: "me",
      type: "call_result",
      content: `${S.profile.myName} 错过了视频通话`,
      createdAt: now()
    });
    S.chat.missedCallPending = { ts: now() };
  } else if (status === "rejected_by_me") {
    const txt = (S.chat.activeCall.direction === "outgoing")
      ? `${S.profile.myName} 取消了视频通话`
      : `${S.profile.myName} 拒接了视频通话`;
    await addMessage({
      id: uid(),
      sender: "me",
      type: "call_result",
      content: txt,
      createdAt: now()
    });
  }

  S.chat.activeCall = null;

  if (callTimerInt) {
    clearInterval(callTimerInt);
    callTimerInt = null;
  }
  callStartTs = null;

  renderCallFloat();
  await save();
}

// 挂断通话
async function hangup(who = "me") {
  const S = getState();
  if (!S.chat.activeCall || S.chat.activeCall.status !== "connected") return;

  const dur = now() - (S.chat.activeCall.connectedAt || now());
  const mm = String(Math.floor(dur / 60000)).padStart(2, "0");
  const ss = String(Math.floor((dur % 60000) / 1000)).padStart(2, "0");

  await addMessage({
    id: uid(),
    sender: who,
    type: "call_hangup",
    content: `${who === "me" ? S.profile.myName : S.profile.otherName} 挂断了通话（${mm}:${ss}）`,
    createdAt: now()
  });

  S.chat.activeCall = null;

  if (callTimerInt) {
    clearInterval(callTimerInt);
    callTimerInt = null;
  }
  callStartTs = null;

  renderCallFloat();
  await save();
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

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
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
    });

    document.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
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
  hangup,
  renderCallFloat
};
