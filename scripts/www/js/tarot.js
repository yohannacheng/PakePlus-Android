// 塔罗占卜模块
import { getState, setState, save } from './state.js';
import { $, uid, now, esc, pick, chance } from './utils.js';
import { TAROT } from './config.js';

// 获取塔罗牌组卡片
function getTarotDeckCards(deck) {
  if(!deck) return null;
  const names = [
    ...TAROT.slice(0,22),
    ...TAROT.slice(22,36),
    ...TAROT.slice(36,50),
    ...TAROT.slice(50,64),
    ...TAROT.slice(64,78)
  ];
  if(Array.isArray(deck.cards) && deck.cards.length===78){
    return deck.cards.map((img, idx)=>({ name:names[idx], image:img }));
  }
  const groupImages = [];
  if(Array.isArray(deck.majorArcana)) groupImages.push(...deck.majorArcana);
  if(Array.isArray(deck.wands)) groupImages.push(...deck.wands);
  if(Array.isArray(deck.cups)) groupImages.push(...deck.cups);
  if(Array.isArray(deck.swords)) groupImages.push(...deck.swords);
  if(Array.isArray(deck.pentacles)) groupImages.push(...deck.pentacles);
  if(groupImages.length===78) return groupImages.map((img, idx)=>({ name:names[idx], image:img }));
  return null;
}

// 规范化旧运势文本
function normalizeOldFortuneText(text){
  if(typeof text !== 'string') return text;
  const match = text.match(/^韦特牌\s*(\d{1,2})$/);
  if(!match) return text;
  const idx = Number(match[1]) - 1;
  if(idx>=0 && idx<TAROT.length) return TAROT[idx];
  return text;
}

// 格式化运势卡片
function formatFortuneCard(card){
  if(!card) return "";
  if(typeof card === 'string' || (typeof card === 'object' && card.text)) {
    const text = typeof card === 'string' ? card : card.text;
    return `<div class="tarotCard">${esc(text)}</div>`;
  }
  if(typeof card === 'object' && card.name){
    const reverseText = card.reversed ? "（逆位）" : "";
    const bgStyle = card.image ? `background:url(${card.image}) center/cover;` : 'background:#f0f0f0;';
    return `<div class="fortuneCard" style="display:inline-flex;flex-direction:column;align-items:center;gap:.35rem;">
      <div class="tarotCard" style="width:120px;height:160px;${bgStyle}border:1px solid var(--line);border-radius:12px;display:flex;align-items:center;justify-content:center;">
        ${!card.image ? `<div style="text-align:center;padding:0.5rem;">${esc(card.name)}</div>` : ''}
      </div>
      <div class="tiny">${esc(card.name)}${reverseText}</div>
    </div>`;
  }
  return "";
}

// 生成今日运势
function generateFortune() {
  const S = getState();
  const deck = S.skin.selectedTarotDeck;
  const cards = getTarotDeckCards(deck);
  
  // 如果有自定义牌组，从牌组中随机抽取
  if (cards && cards.length > 0) {
    const myCard = pick(cards);
    const otherCard = pick(cards);
    
    S.fortune = {
      date: new Date().toISOString().split('T')[0],
      my: myCard,
      other: otherCard,
      loading: false
    };
  } else {
    // 否则从塔罗牌名称中随机抽取
    S.fortune = {
      date: new Date().toISOString().split('T')[0],
      my: pick(TAROT),
      other: pick(TAROT),
      loading: false
    };
  }
  
  save();
  renderFortune();
}

// 渲染运势
function renderFortune() {
  const S = getState();
  const fortuneView = $('fortuneView');
  if (!fortuneView) return;
  
  if (S.fortune.loading) {
    fortuneView.innerHTML = '<div style="text-align:center;padding:2rem;">正在抽取今日运势...</div>';
    return;
  }
  
  const myCard = S.fortune.my;
  const otherCard = S.fortune.other;
  
  fortuneView.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
      <div style="text-align:center;">
        <div class="tiny" style="margin-bottom:0.5rem;">${S.profile.otherName}的运势</div>
        ${formatFortuneCard(otherCard)}
      </div>
      <div style="text-align:center;">
        <div class="tiny" style="margin-bottom:0.5rem;">我的运势</div>
        ${formatFortuneCard(myCard)}
      </div>
    </div>
  `;
}

// 打开运势弹窗
function openFortuneModal() {
  const S = getState();
  const today = new Date().toISOString().split('T')[0];
  
  // 如果今天还没有生成运势，则生成
  if (S.fortune.date !== today) {
    S.fortune.loading = true;
    save();
    renderFortune();
    
    // 模拟抽取动画
    setTimeout(() => {
      generateFortune();
    }, 6000);
  } else {
    renderFortune();
  }
  
  $('fortuneMask').classList.add('show');
}

// 关闭运势弹窗
function closeFortuneModal() {
  $('fortuneMask').classList.remove('show');
}

// 关闭占卜弹窗
function closeTarotModal() {
  $('tarotMask').classList.remove('show');
}

// 抽取三张塔罗牌
function drawThreeTarotCards() {
  const S = getState();
  const deck = S.skin.selectedTarotDeck;
  const cards = getTarotDeckCards(deck);

  // 弹出提问框
  const question = prompt('请输入您想问的问题：');
  if (!question) return;
  
  // 随机抽取三张不重复的牌
  const shuffled = cards ? [...cards].sort(() => Math.random() - 0.5) : 
    TAROT.map(name => ({ name, image: null })).sort(() => Math.random() - 0.5);
  
  // 显示占卜弹窗
  console.log('显示占卜弹窗');
  const tarotMask = $('tarotMask');
  console.log('tarotMask:', tarotMask);
  if (tarotMask) {
    tarotMask.classList.add('show');
  }

  // 显示正在抽取中...
  const tarotView = $('tarotView');
  console.log('tarotView:', tarotView);
  if (tarotView) {
    tarotView.innerHTML = '<div style="text-align:center;padding:2rem;">正在抽取塔罗牌...</div>';
  }

  // 延迟后显示结果
  setTimeout(() => {
    const selected = shuffled.slice(0, 3);
  
    // 显示结果
    if (tarotView) {
      tarotView.innerHTML = `
        <div style="text-align:center;margin-bottom:0.5rem;">
          <div class="tiny">问题：${esc(question)}</div>
        </div>
        <div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;">
          ${selected.map(card => formatFortuneCard(card)).join('')}
        </div>
      `;
    }
  
    return selected;
  }, 10000);
}

// 导出函数
export {
  getTarotDeckCards,
  normalizeOldFortuneText,
  formatFortuneCard,
  generateFortune,
  renderFortune,
  openFortuneModal,
  closeFortuneModal,
  drawThreeTarotCards,
  closeTarotModal
};
