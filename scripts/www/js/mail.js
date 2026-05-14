// 信箱功能模块
import { getState, setState, save } from './state.js';
import { $, uid, now, fmt, esc } from './utils.js';

// 发送邮件
async function sendMail(content) {
  const S = getState();

  const mail = {
    id: uid(),
    content: content,
    createdAt: now(),
    read: false
  };

  S.mail.sent.push(mail);
  await save();

  renderMailList();
  return mail;
}

// 接收邮件
async function receiveMail(content) {
  const S = getState();

  const mail = {
    id: uid(),
    content: content,
    createdAt: now(),
    read: false
  };

  S.mail.incoming.push(mail);
  S.mail.unreadIncomingIds.push(mail.id);
  await save();

  // 添加通知
  addMailNotice(mail);
  renderMailList();

  return mail;
}

// 添加邮件通知
function addMailNotice(mail) {
  const S = getState();
  const notice = {
    id: uid(),
    type: 'mail_new_unread',
    content: `收到${S.profile.otherName}的新信件`,
    createdAt: now(),
    expireAt: now() + 24 * 60 * 60 * 1000, // 24小时后过期
    archiveStatus: 'no_archive', // 邮件通知不归档
    mailId: mail.id
  };

  S.notices.current.push(notice);
  save();
  renderNotices();
}

// 渲染邮件列表
function renderMailList() {
  const S = getState();
  const mailList = $('mailList');
  if (!mailList) return;

  mailList.innerHTML = '';

  // 合并发送和接收的邮件，按时间排序
  const allMails = [
    ...S.mail.sent.map(m => ({ ...m, direction: 'sent' })),
    ...S.mail.incoming.map(m => ({ ...m, direction: 'incoming' }))
  ].sort((a, b) => b.createdAt - a.createdAt);

  // 过滤搜索
  const searchTerm = S.mail.search.toLowerCase();
  const filteredMails = searchTerm
    ? allMails.filter(m => m.content.toLowerCase().includes(searchTerm))
    : allMails;

  filteredMails.forEach(mail => {
    const item = document.createElement('div');
    item.className = 'item';
    item.dataset.mailId = mail.id;

    const direction = document.createElement('div');
    direction.className = 'tiny';
    direction.textContent = mail.direction === 'sent' ? '→ 已发送' : '← 已接收';
    direction.style.color = mail.direction === 'sent' ? 'var(--muted)' : 'var(--accent-color)';

    const content = document.createElement('div');
    content.className = 'tiny';
    content.style.flex = '1';
    content.style.overflow = 'hidden';
    content.style.textOverflow = 'ellipsis';
    content.style.whiteSpace = 'nowrap';
    content.textContent = mail.content;

    const time = document.createElement('div');
    time.className = 'tiny';
    time.textContent = fmt(mail.createdAt);

    item.appendChild(direction);
    item.appendChild(content);
    item.appendChild(time);

    // 点击查看详情
    item.addEventListener('click', () => {
      openMailDetail(mail);
    });

    mailList.appendChild(item);
  });
}

// 打开邮件详情
function openMailDetail(mail) {
  const S = getState();

  // 标记为已读
  if (mail.direction === 'incoming' && !mail.read) {
    const originalMail = S.mail.incoming.find(m => m.id === mail.id);
    if (originalMail) {
      originalMail.read = true;
      S.mail.unreadIncomingIds = S.mail.unreadIncomingIds.filter(id => id !== mail.id);
      save();
    }
  }

  // 显示邮件内容
  $('mailDetailContent').innerHTML = esc(mail.content);
  $('mailDetailTime').textContent = fmt(mail.createdAt);
  $('mailDetailDirection').textContent =
    mail.direction === 'sent' ? `发送给 ${S.profile.otherName}` : `来自 ${S.profile.otherName}`;

  // 显示邮件详情弹窗
  $('mailDetailMask').classList.add('show');
}

// 关闭邮件详情
function closeMailDetail() {
  $('mailDetailMask').classList.remove('show');
}

// 打开写信弹窗
function openComposeMail() {
  $('composeMailContent').value = '';
  $('composeMailMask').classList.add('show');
}

// 关闭写信弹窗
function closeComposeMail() {
  $('composeMailMask').classList.remove('show');
}

// 发送新邮件
async function sendNewMail(content = null) {
  const text = (typeof content === 'string' && content) ? content : $('composeMailContent').value.trim();
  if (!text) {
    alert('请输入信件内容');
    return;
  }

  const S = getState();
  const mail = {
    id: uid(),
    from: 'me',
    type: 'out',
    content: text,
    ts: now(),
    read: true
  };
  S.mail.sent.unshift(mail);

  // 设置回复时间：20-72小时后（20小时 + 随机0-52小时）
  const nextReplyAt = now() + 20 * 60 * 60 * 1000 + Math.floor(Math.random() * 52 * 60 * 60 * 1000);
  S.mail.pendingReply = {
    for: mail.id,
    nextReplyAt: nextReplyAt
  };

  // 清空输入框
  $('composeMailContent').value = '';
  const myLetterInput = $('myLetterInput');
  if (myLetterInput) myLetterInput.value = '';
  await save();
  renderMailList();
  closeComposeMail();
}

// 评估并处理待回复邮件
async function evaluateMailAuto() {
  const S = getState();
  let changed = false;

  // 检查是否到达回复时间
  if (S.mail.pendingReply && now() >= S.mail.pendingReply.nextReplyAt) {
    // 生成随机回复内容（8-20个词的句子）
    const replyContent = generateCardSentence();

    const reply = {
      id: uid(),
      from: 'other',
      type: 'reply',
      for: S.mail.pendingReply.for,
      content: replyContent,
      ts: now(),
      read: false
    };

    S.mail.incoming.unshift(reply);
    S.mail.unreadIncomingIds.push(reply.id);
    S.mail.pendingReply = null;

    // 添加通知
    const notice = {
      id: uid(),
      type: 'mail_reply_unread',
      content: `${S.profile.otherName}已回信`,
      createdAt: now(),
      expireAt: now() + 24 * 60 * 60 * 1000, // 24小时后过期
      archiveStatus: 'no_archive' // 邮件通知不归档
    };
    S.notices.current = S.notices.current.filter(n => n.type !== 'mail_wait_reply');
    S.notices.current.push(notice);

    changed = true;
  }

  if (changed) {
    await save();
    renderNotices();
    renderMailList();
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

// 搜索邮件
function searchMail(term) {
  const S = getState();
  S.mail.search = term;
  save();
  renderMailList();
}

// 渲染通知
function renderNotices() {
  const S = getState();
  const noticeBar = $('noticeBar');
  if (!noticeBar) return;

  if (!S.notices.current.length) {
    noticeBar.innerHTML = '<span class="tiny">暂无公告</span>';
    return;
  }

  const notices = S.notices.current.map(n =>
    `<span style="margin-right:2rem;">${n.content}</span>`
  ).join('');

  noticeBar.innerHTML = `<div class="roll">${notices}</div>`;
}

// 导出函数
export {
  sendMail,
  receiveMail,
  renderMailList,
  openMailDetail,
  closeMailDetail,
  openComposeMail,
  closeComposeMail,
  sendNewMail,
  searchMail,
  renderNotices,
  evaluateMailAuto,
  generateCardSentence
};
