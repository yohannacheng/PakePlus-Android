// 云端备份和恢复模块
import { CONFIG } from './config.js';
import { getState, setState, save } from './state.js';
import { deepMerge } from './utils.js';
import { loadFromDB } from './db.js';

/**
 * 备份数据到云端
 */
export async function backupToCloud() {
  try {
    const S = getState();

    // 创建精简的备份数据，排除大型数据
    const backupData = {
      ...S,
      libs: {
        ...S.libs,
        myStickers: (S.libs.myStickers || []).map(s => ({ id: s.id })),
        replyStickers: (S.libs.replyStickers || []).map(s => ({ id: s.id }))
      },
      skin: {
        ...S.skin,
        backgroundLibrary: S.skin.backgroundLibrary.map(bg => {
          if (bg.type === 'image') {
            // 图片背景只保存元数据，不保存图片数据
            return { id: bg.id, type: bg.type, name: bg.name };
          }
          // 纯色背景完整保存
          return bg;
        })
      },
      chat: {
        ...S.chat,
        messages: (S.chat.messages || []).map(msg => {
          if (msg.type === 'image') {
            // 图片消息只保存类型，内容替换为【图片】
            return { ...msg, content: '【图片】' };
          }
          return msg;
        })
      }
    };

    const response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/backups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.SUPABASE_API_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_API_KEY}`,
        'Prefer': 'resolution=ignore-duplicates'
      },
      body: JSON.stringify({
        user_id: 'default_user', // 可以改为更合适的标识
        data: JSON.stringify(backupData),
        created_at: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    console.log('云端备份成功');
    return true;
  } catch (err) {
    console.error('云端备份失败:', err);
    console.error('错误详情:', JSON.stringify(err, null, 2));
    throw err;
  }
}

/**
 * 从云端恢复数据
 */
export async function restoreFromCloud() {
  try {
    const S = getState();

    const response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/backups?user_id=eq.default_user&order=created_at.desc&limit=1`, {
      method: 'GET',
      headers: {
        'apikey': CONFIG.SUPABASE_API_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_API_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const backups = await response.json();
    if (!backups || backups.length === 0) {
      throw new Error('云端没有找到备份数据');
    }

    const cloudData = JSON.parse(backups[0].data);

    // 从IndexedDB加载本地表情包
    let localStickers = null;
    try {
      localStickers = await loadFromDB(CONFIG.STORE_STICKERS);
    } catch (err) {
      console.warn('从IndexedDB加载表情包失败:', err);
    }

    // 保留本地表情包，合并云端数据
    const localMyStickers = localStickers?.myStickers || S.libs.myStickers || [];
    const localReplyStickers = localStickers?.replyStickers || S.libs.replyStickers || [];

    // 从IndexedDB加载本地背景图片
    let localBackgrounds = [];
    try {
      localBackgrounds = await loadFromDB(CONFIG.STORE_BACKGROUNDS) || [];
    } catch (err) {
      console.warn('从IndexedDB加载背景图片失败:', err);
    }

    // 合并云端数据到本地数据
    const merged = deepMerge(S, cloudData);

    // 恢复本地表情包：用本地IndexedDB中的完整数据替换云端备份中的元数据
    if (localStickers) {
      const localMyStickerMap = new Map(localMyStickers.map(s => [s.id, s]));
      const localReplyStickerMap = new Map(localReplyStickers.map(s => [s.id, s]));

      // 合并云端和本地的表情包元数据，使用本地完整数据
      const cloudMyStickers = merged.libs.myStickers || [];
      const restoredMyStickers = [];
      cloudMyStickers.forEach(s => {
        if (localMyStickerMap.has(s.id)) {
          restoredMyStickers.push(localMyStickerMap.get(s.id));
        } else {
          restoredMyStickers.push(s);
        }
      });
      localMyStickers.forEach(s => {
        if (!cloudMyStickers.find(cs => cs.id === s.id)) {
          restoredMyStickers.push(s);
        }
      });
      merged.libs.myStickers = restoredMyStickers;

      // 处理回复表情包
      const cloudReplyStickers = merged.libs.replyStickers || [];
      const restoredReplyStickers = [];
      cloudReplyStickers.forEach(s => {
        if (localReplyStickerMap.has(s.id)) {
          restoredReplyStickers.push(localReplyStickerMap.get(s.id));
        } else {
          restoredReplyStickers.push(s);
        }
      });
      localReplyStickers.forEach(s => {
        if (!cloudReplyStickers.find(cs => cs.id === s.id)) {
          restoredReplyStickers.push(s);
        }
      });
      merged.libs.replyStickers = restoredReplyStickers;

    } else {
      // 如果IndexedDB中没有数据，使用本地S中的数据
      merged.libs.myStickers = localMyStickers;
      merged.libs.replyStickers = localReplyStickers;
    }

    // 恢复本地背景图片：用本地IndexedDB中的完整数据替换云端备份中的元数据
    if (localBackgrounds.length > 0) {
      const localBgMap = new Map(localBackgrounds.map(bg => [bg.id, bg]));

      // 合并云端和本地的背景
      const cloudBgs = merged.skin.backgroundLibrary || [];
      const restoredBgs = [];

      // 先处理云端已有的背景
      cloudBgs.forEach(bg => {
        if (bg.type === 'image' && localBgMap.has(bg.id)) {
          // 使用本地IndexedDB中的完整背景数据
          restoredBgs.push(localBgMap.get(bg.id));
        } else if (bg.type === 'color') {
          // 只添加纯色背景
          restoredBgs.push(bg);
        }
        // 跳过本地没有完整数据的图片背景
      });

      // 添加本地存在但云端没有的图片背景
      localBackgrounds.forEach(bg => {
        if (bg.type === 'image' && !cloudBgs.find(cb => cb.id === bg.id)) {
          restoredBgs.push(bg);
        }
      });

      merged.skin.backgroundLibrary = restoredBgs;
    }

    // 保存合并后的数据
    setState(merged);
    await save();

    console.log('从云端恢复成功');
    return true;
  } catch (err) {
    console.error('从云端恢复失败:', err);
    throw err;
  }
}
