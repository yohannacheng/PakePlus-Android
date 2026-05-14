// 状态管理模块
import { CONFIG } from './config.js';
import { initDB, loadFromDB, saveToDB, clearDBStore } from './db.js';
import { clone, deepMerge } from './utils.js';

// 初始状态
const base = {
  profile: {
    myName:"Cheng", otherName:"Xia",
    myStatus:"🙂 想你中", otherStatus:"✨ 在高维观察你",
    myAvatar:"", otherAvatar:""
  },
  libs: {
    replyCards: [
      { id: "c1", text: "抱抱", groupId: "g_reply_default" },
      { id: "c2", text: "想你", groupId: "g_reply_emotion" },
      { id: "c3", text: "晚安", groupId: "g_reply_default" }
    ],
    replyEmoji: [
      { id: "e1", text: "🥜", groupId: "g_emoji_default" },
      { id: "e2", text: "✨", groupId: "g_emoji_default" },
      { id: "e3", text: "💜", groupId: "g_emoji_love" }
    ],
    replyKaomoji: [
      { id: "k1", text: "(｡•ᴗ•｡)", groupId: "g_kao_default" },
      { id: "k2", text: "(づ｡◕‿‿◕｡)づ", groupId: "g_kao_default" }
    ],
    interactions: [
      { id: "i1", text: "轻轻贴贴", groupId: "g_inter_default" },
      { id: "i2", text: "摸摸头", groupId: "g_inter_default" }
    ],
    statuses: ["🌤️ 想你的晴天", "🌙 在月亮边发呆", "✨ 灵感上线中"],
    moodsPool: ["😊 开心", "🥹 想你", "🤍 平静"],
    weatherPool: ["☀️ 晴朗", "🌧️ 小雨", "⛅ 多云"],
    myStickers: [],
    replyStickers: [],
    openingAnimations: [],
    groups: {
      replyCards: [
        { id: "g_reply_default", name: "全部", color: "#91c36e", builtIn: true },
        { id: "g_reply_emotion", name: "情绪, 情感", color: "#f39c35" }
      ],
      replyEmoji: [
        { id: "g_emoji_default", name: "全部", color: "#91c36e", builtIn: true },
        { id: "g_emoji_love", name: "关系称谓", color: "#c06bff" }
      ],
      replyKaomoji: [
        { id: "g_kao_default", name: "全部", color: "#91c36e", builtIn: true }
      ],
      interactions: [
        { id: "g_inter_default", name: "全部", color: "#91c36e", builtIn: true }
      ]
    }
  },
  ui: {
    currentGroup: {
      replyCards: "all",
      replyEmoji: "all",
      replyKaomoji: "all",
      interactions: "all"
    },
    searchText: {
      replyCards: "",
      replyEmoji: "",
      replyKaomoji: "",
      interactions: ""
    },
    atmosphereSubTab: "interactions"
  },
  skin: {
    themeBase: "#efebff",
    themeAccent: "#d8f6e1",
    backgroundLibrary: [{ id: "bg_default", type: "color", value: "#f6f3ff", name: "默认" }],
    currentBackgroundId: "bg_default",
    tarotDecks: [],
    selectedTarotDeck: null
  },
  decor: {
    meLeft:"✦", meRight:"✦",
    otherLeft:"✧", otherRight:"✧"
  },
  notices:{ current:[], archive:[] },
  chat:{
    messages:[],
    unreadMyIds:[],
    typing:false,
    queueMode:false,
    queued:[],
    selectedStickerIndex:0,
    activeCall:null,
    missedCallPending:null,
    lastProactiveAt:0,
    proactiveHour:[],
    nextStatusUpdateAt:0,
    nextIncomingCallAt:0
  },
  mail:{
    sent:[], incoming:[],
    pendingReply:null,
    unreadIncomingIds:[],
    search:""
  },
  moodWeather:{
    byDate:{},
    latestMyWeather:""
  },
  fortune:{date:"",my:"",other:"",loading:false},
  stats:{myCount:0,otherCount:0,cardUsage:{},phraseUsage:{}},
  memory:{usedContent:[],lastCardTs:{}},
  settings:{dark:false,autoBackup:false}
};

// 全局状态
let S = null;

// deepMerge 函数已从 utils.js 导入
// 加载状态
async function load() {
  try {
    // 先尝试从IndexedDB加载状态
    let stateFromDB = null;
    try {
      stateFromDB = await loadFromDB(CONFIG.STORE_STATE);
      if (stateFromDB) {
        console.log('从IndexedDB加载状态成功');
        return stateFromDB;
      }
    } catch (dbErr) {
      console.warn('从IndexedDB加载状态失败:', dbErr);
    }

    // 如果IndexedDB中没有状态，尝试从localStorage加载
    const raw = localStorage.getItem(CONFIG.KEY);
    const data = !raw ? clone(base) : deepMerge(clone(base), JSON.parse(raw));

    // 修复：确保 myStickers 和 replyStickers 总是数组
    if (!Array.isArray(data.libs.myStickers)) data.libs.myStickers = [];
    if (!Array.isArray(data.libs.replyStickers)) data.libs.replyStickers = [];
    // 清理旧邮件公告
    if (Array.isArray(data.notices.current)) {
      data.notices.current = data.notices.current.filter(n => 
        !["mail_reply_unread","mail_wait_reply","mail_new_unread"].includes(n.type)
      );
    }

    // 从IndexedDB或localStorage中恢复表情包
    try {
      let stickers = null;
      try {
        stickers = await loadFromDB(CONFIG.STORE_STICKERS);
        if (stickers) {
          console.log('从IndexedDB加载表情包成功');
        }
      } catch (dbErr) {
        console.warn('从IndexedDB加载表情包失败:', dbErr);
      }

      if (!stickers) {
        const stickerKey = CONFIG.KEY + "_stickers";
        const stickerRaw = localStorage.getItem(stickerKey);
        if (stickerRaw) {
          stickers = JSON.parse(stickerRaw);
        }
      }

      if (stickers) {
        if (Array.isArray(stickers.myStickers)) {
          data.libs.myStickers = stickers.myStickers;
        }
        if (Array.isArray(stickers.replyStickers)) {
          data.libs.replyStickers = stickers.replyStickers;
        }
      }
    } catch (err) {
      console.warn("表情包恢复失败:", err);
    }

    // 从IndexedDB或localStorage中恢复背景图片
    try {
      let backgrounds = null;
      try {
        backgrounds = await loadFromDB(CONFIG.STORE_BACKGROUNDS);
        if (backgrounds) {
          console.log('从IndexedDB加载背景图片成功');
        }
      } catch (dbErr) {
        console.warn('从IndexedDB加载背景图片失败:', dbErr);
      }

      if (!backgrounds) {
        const bgKey = CONFIG.KEY + "_backgrounds";
        const bgRaw = localStorage.getItem(bgKey);
        if (bgRaw) {
          backgrounds = JSON.parse(bgRaw);
        }
      }

      if (backgrounds && Array.isArray(backgrounds)) {
        const colorBgs = data.skin.backgroundLibrary.filter(bg => bg.type === "color");
        data.skin.backgroundLibrary = colorBgs.concat(backgrounds.filter(bg => bg.type === "image"));
      }
    } catch (err) {
      console.warn("背景图片恢复失败:", err);
    }

    if (!Array.isArray(data.libs.openingAnimations)) data.libs.openingAnimations = [];
    if (data.libs.openingAnimation && typeof data.libs.openingAnimation === "object") {
      const old = data.libs.openingAnimation;
      if ((old.title || old.subtitle) && !data.libs.openingAnimations.length) {
        data.libs.openingAnimations = [{ title: old.title || "", subtitle: old.subtitle || "" }];
      }
      delete data.libs.openingAnimation;
    }

    return data;
  } catch(e){
    alert("数据加载失败，使用默认数据: " + e.message);
    console.error(e);
    const data = clone(base);
    data.libs.myStickers = [];
    data.libs.replyStickers = [];
    data.fortune.loading = false;
    return data;
  }
}

// 清理状态中不可序列化的值（如事件对象）
function sanitizeState(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(item => sanitizeState(item));
  if (typeof obj === 'object') {
    // 跳过 DOM 事件对象、Node 等不可序列化对象
    if (obj instanceof Event || obj instanceof Node) return undefined;
    const result = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      // 如果值是对象但不是普通对象（如 PointerEvent、HTMLElement 等），跳过
      if (val !== null && typeof val === 'object' && !(Array.isArray(val)) && val.constructor && val.constructor !== Object) {
        console.warn(`sanitizeState: 跳过不可序列化的属性 "${key}"，类型: ${val.constructor.name}`);
        continue;
      }
      const sanitized = sanitizeState(val);
      if (sanitized !== undefined) result[key] = sanitized;
    }
    return result;
  }
  return obj;
}

// 保存状态
async function save() {
  try {
    // 清理消息中可能存在的不可序列化对象（如 PointerEvent）
    if (S.chat && Array.isArray(S.chat.messages)) {
      S.chat.messages = S.chat.messages.map(m => {
        if (m.type && typeof m.type !== 'string') {
          console.warn('发现消息中存在非字符串 type，已修复:', m.type);
          m.type = 'normal';
        }
        return m;
      });
    }
    if (S.chat && Array.isArray(S.chat.queue)) {
      S.chat.queue = S.chat.queue.map(m => {
        if (m.type && typeof m.type !== 'string') {
          console.warn('发现队列消息中存在非字符串 type，已修复:', m.type);
          m.type = 'normal';
        }
        return m;
      });
    }
    if (S.chat && Array.isArray(S.chat.pendingMessages)) {
      S.chat.pendingMessages = S.chat.pendingMessages.map(pm => {
        if (pm.msg && pm.msg.type && typeof pm.msg.type !== 'string') {
          console.warn('发现待发送消息中存在非字符串 type，已修复:', pm.msg.type);
          pm.msg.type = 'normal';
        }
        return pm;
      });
    }

    // 创建不包含大型数据的状态对象
    const stateToSave = sanitizeState({
      ...S,
      libs: {
        ...S.libs,
        myStickers: [],
        replyStickers: []
      },
      skin: {
        ...S.skin,
        backgroundLibrary: S.skin.backgroundLibrary.filter(bg => bg.type === "color")
      }
    });

    // 优先使用IndexedDB保存状态
    try {
      await saveToDB(CONFIG.STORE_STATE, stateToSave);
      console.log('状态已保存到IndexedDB');
      
      // 单独保存图片背景到IndexedDB
      const imageBackgrounds = S.skin.backgroundLibrary.filter(bg => bg.type === "image");
      if (imageBackgrounds.length > 0) {
        await saveToDB(CONFIG.STORE_BACKGROUNDS, imageBackgrounds);
        console.log('图片背景已保存到IndexedDB');
      }
    } catch (dbErr) {
      console.error('IndexedDB保存状态失败:', dbErr.message || dbErr, dbErr);

      // 如果IndexedDB失败，尝试使用localStorage作为后备
      try {
        const serialized = JSON.stringify(stateToSave);
        localStorage.setItem(CONFIG.KEY, serialized);
        console.log('状态已保存到localStorage');
      } catch (e) {
        console.error('localStorage保存状态失败:', e.message || e, e);
        const isQuotaError = e.name === 'QuotaExceededError' ||
                            e.code === 22 ||
                            e.code === 1014 ||
                            e.message.includes('quota') ||
                            e.message.includes('QuotaExceededError');

        if (isQuotaError) {
          alert('存储空间不足，无法保存数据。建议导出备份或手动清理聊天记录。');
        } else {
          throw e;
        }
      }
    }
  } catch (err) {
    console.error("保存失败:", err);
    alert("保存失败：" + err.message);
  }
}

// 初始化状态
async function init() {
  await initDB();
  S = await load();
  return S;
}

// 获取状态
function getState() {
  return S;
}

// 更新状态
function setState(newState) {
  S = { ...S, ...newState };
  return S;
}

export { base, init, load, save, getState, setState };
