// 设置功能模块
import { getState, setState, save } from './state.js';
import { $, uid, now, fmt, esc, pick, chance } from './utils.js';
import { TAROT, PUNCT } from './config.js';
import { addStickers } from './chat.js';
import { backupToCloud, restoreFromCloud } from './cloud.js';
import { renderAllLite } from './app.js';

// 设置标签页
const tabs = [
  { id: "profile", name: "个人资料" },
  { id: "replyLib", name: "回复库" },
  { id: "atmosphere", name: "氛围感" },
  { id: "skin", name: "皮肤" },
  { id: "noticeLib", name: "公告库" },
  { id: "data", name: "数据管理" }
];
let currentTab = "replyLib";

// 辅助函数
function makeId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function getDefaultGroupId(libKey) {
  const S = getState();
  const gs = S.libs.groups[libKey] || [];
  const builtIn = gs.find(g => g.builtIn);
  return builtIn ? builtIn.id : (gs[0]?.id || "");
}

function getGroupName(libKey, groupId) {
  const S = getState();
  return (S.libs.groups[libKey] || []).find(g => g.id === groupId)?.name || "未分组";
}

function filterLibItems(libKey) {
  const S = getState();
  const items = S.libs[libKey] || [];
  const current = S.ui.currentGroup[libKey] || "all";
  const search = (S.ui.searchText[libKey] || "").toLowerCase();

  return items.filter(item => {
    // 分组过滤
    if (current !== "all" && item.groupId !== current) return false;
    // 搜索过滤
    if (search && !item.text.toLowerCase().includes(search)) return false;
    return true;
  });
}

// 渲染标签页
function renderTabs() {
  const tabsEl = $("settingsTabs");
  if (!tabsEl) return;

  tabsEl.innerHTML = tabs.map(t => 
    `<button class="btn ${currentTab === t.id ? 'active' : ''}" data-tab="${t.id}">${t.name}</button>`
  ).join("");

  tabsEl.querySelectorAll("[data-tab]").forEach(btn => {
    btn.onclick = async () => {
      currentTab = btn.dataset.tab;
      renderTabs();
      await renderSettingsBody();
    };
  });
}

// 渲染分组编辑器HTML
function groupedEditorHtml(libKey, title) {
  const S = getState();
  const groups = S.libs.groups[libKey] || [];
  const current = S.ui.currentGroup[libKey] || "all";
  const items = filterLibItems(libKey);

  const groupChips = [
    `<button class="btn ${current === "all" ? "active" : ""}" data-gsel="${libKey}_all">全部 ${(S.libs[libKey] || []).length}</button>`,
    ...groups.map(g => {
      const count = (S.libs[libKey] || []).filter(x => x.groupId === g.id).length;
      const isBuiltIn = g.builtIn;
      const deleteBtn = isBuiltIn ? "" : `<span class="group-del" data-del-group="${libKey}_${g.id}" title="删除分组">×</span>`;
      return `<button class="btn ${current === g.id ? "active" : ""}" data-gsel="${libKey}_${g.id}" style="border-color:${g.color};padding:6px 12px;">
        <span style="color:${g.color}">●</span> ${g.name} ${count} ${deleteBtn}
      </button>`;
    })
  ].join("");

  return `
    <div class="block">
      <b>${title}</b>
      <div style="display:flex;gap:.35rem;flex-wrap:wrap">
        <input id="search_${libKey}" type="text" placeholder="搜索" value="${esc(S.ui.searchText[libKey] || "")}" />
        <button class="btn" data-search="${libKey}">搜索</button>
        <button class="btn" data-open-add-group="${libKey}">新增分组</button>
      </div>

      <div class="group-scroll-container" style="display:flex;gap:.35rem;overflow-x:auto;padding:.2rem 0;margin-top:.2rem;scrollbar-width:thin;-webkit-overflow-scrolling:touch">${groupChips}</div>

      <div style="display:grid;gap:.35rem;margin-top:.3rem">
        <textarea id="new_${libKey}_text" placeholder="每行一条，按回车换行"></textarea>
        <button class="btn" data-add-item="${libKey}">批量添加（按行）</button>
      </div>

      <div class="list">
        ${items.map(x => {
          if (!x.id) {
            x.id = makeId("it");
            save();
          }
          return `
          <div class="item">
            <span>${esc(x.text)} <span class="groupTag">${esc(getGroupName(libKey, x.groupId))}</span></span>
            <span>
              <button class="btn" data-edit-item="${libKey}_${x.id}">编辑</button>
              <button class="btn danger" data-del-item="${libKey}_${x.id}">删</button>
            </span>
          </div>
        `;}).join("") || "<div class='tiny'>暂无内容</div>"}
      </div>
    </div>
  `;
}

// 绑定分组编辑器事件
function bindGroupedEditorEvents(container) {
  container.querySelectorAll("[data-search]").forEach(btn => {
    btn.onclick = async () => {
      const libKey = btn.dataset.search;
      const S = getState();
      S.ui.searchText[libKey] = container.querySelector(`#search_${libKey}`).value || "";
      setState(S);
      await save();
      await renderSettingsBody();
    };
  });

  container.querySelectorAll("[data-gsel]").forEach(btn => {
    btn.onclick = async () => {
      const token = btn.dataset.gsel;
      const idx = token.indexOf("_");
      const libKey = token.slice(0, idx);
      const gid = token.slice(idx + 1);
      const S = getState();
      S.ui.currentGroup[libKey] = gid === "all" ? "all" : gid;
      setState(S);
      await save();
      await renderSettingsBody();
    };
  });

  container.querySelectorAll("[data-del-group]").forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const token = btn.dataset.delGroup;
      const idx = token.indexOf("_");
      const libKey = token.slice(0, idx);
      const groupId = token.slice(idx + 1);
      const S = getState();

      const count = S.libs[libKey].filter(x => x.groupId === groupId).length;
      const confirmMsg = count > 0
        ? `确定要删除分组"${getGroupName(libKey, groupId)}"吗？\n该分组下有 ${count} 个项目，删除分组将同时删除这些项目。`
        : `确定要删除分组"${getGroupName(libKey, groupId)}"吗？`;

      if (!confirm(confirmMsg)) return;

      S.libs[libKey] = S.libs[libKey].filter(x => x.groupId !== groupId);
      S.libs.groups[libKey] = S.libs.groups[libKey].filter(g => g.id !== groupId);
      if (S.ui.currentGroup[libKey] === groupId) {
        S.ui.currentGroup[libKey] = "all";
      }
      setState(S);
      await save();
      await renderSettingsBody();
    };
  });

  container.querySelectorAll("[data-open-add-group]").forEach(btn => {
    btn.onclick = async () => {
      const libKey = btn.dataset.openAddGroup;
      const name = prompt("分组名称：", "新分组");
      if (name === null) return;
      const color = prompt("分组颜色（如 #91c36e）：", "#91c36e");
      const S = getState();

      if (!S.libs.groups[libKey]) S.libs.groups[libKey] = [];
      S.libs.groups[libKey].push({ id: makeId("g"), name: name.trim(), color: color || "#91c36e" });
      setState(S);
      await save();
      await renderSettingsBody();
    };
  });

  container.querySelectorAll("[data-add-item]").forEach(btn => {
    btn.onclick = async () => {
      const libKey = btn.dataset.addItem;
      const raw = (container.querySelector(`#new_${libKey}_text`).value || "").trim();
      if (!raw) return;

      const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      if (!lines.length) return;

      const S = getState();
      const gid = S.ui.currentGroup[libKey] === "all"
        ? getDefaultGroupId(libKey)
        : S.ui.currentGroup[libKey];

      lines.forEach(text => {
        S.libs[libKey].push({ id: makeId("it"), text, groupId: gid });
      });
      container.querySelector(`#new_${libKey}_text`).value = "";
      setState(S);
      await save();
      await renderSettingsBody();
    };
  });

  container.querySelectorAll("[data-edit-item]").forEach(btn => {
    btn.onclick = async () => {
      const token = btn.dataset.editItem;
      const idx = token.indexOf("_");
      const libKey = token.slice(0, idx);
      const itemId = token.slice(idx + 1);
      const S = getState();
      const item = S.libs[libKey].find(x => x.id === itemId);
      if (!item) return;
      const nv = prompt("编辑内容：", item.text);
      if (nv === null) return;
      if (!nv.trim()) return;
      item.text = nv.trim();
      setState(S);
      await save();
      await renderSettingsBody();
    };
  });

  container.querySelectorAll("[data-del-item]").forEach(btn => {
    btn.onclick = async () => {
      const token = btn.dataset.delItem;
      const idx = token.indexOf("_");
      const libKey = token.slice(0, idx);
      const itemId = token.slice(idx + 1);
      const S = getState();
      S.libs[libKey] = S.libs[libKey].filter(x => {
        if (!x.id) return true;
        return x.id !== itemId;
      });
      setState(S);
      await save();
      await renderSettingsBody();
    };
  });
}

// 渲染设置主体内容
async function renderSettingsBody() {
  const body = $("settingsBody");
  if (!body) return;

  const S = getState();

  // 确保必要的初始化
  if (!S.ui) S.ui = { currentGroup: {}, searchText: {} };
  if (!S.ui.currentGroup) S.ui.currentGroup = {};
  if (!S.ui.searchText) S.ui.searchText = {};
  if (!S.libs.groups) S.libs.groups = {};
  setState(S);
  await save();

  if (currentTab === "profile") {
    body.innerHTML = `
      <div class="mgrid">
        <div class="block">
          <b>昵称与状态</b>
          <input id="myNameInput" type="text" value="${esc(S.profile.myName)}" />
          <input id="otherNameInput" type="text" value="${esc(S.profile.otherName)}" />
          <input id="myStatusInput" type="text" value="${esc(S.profile.myStatus)}" />
          <button class="btn primary" id="saveProfileBtn">保存</button>
        </div>
        <div class="block">
          <b>头像</b>
          <button class="btn" id="upMyAvatarBtn">上传我的头像</button>
          <button class="btn" id="upOtherAvatarBtn">上传对方头像</button>
        </div>
      </div>
    `;

    const saveProfileBtn = $("saveProfileBtn");
    if (saveProfileBtn) {
      saveProfileBtn.onclick = async () => {
        S.profile.myName = $("myNameInput").value.trim() || S.profile.myName;
        S.profile.otherName = $("otherNameInput").value.trim() || S.profile.otherName;
        S.profile.myStatus = $("myStatusInput").value.trim() || S.profile.myStatus;
        setState(S);
        await save();

        // 同步更新聊天界面的昵称和状态
        const myNameEl = $("myName");
        if (myNameEl) myNameEl.textContent = S.profile.myName;
        const otherNameEl = $("otherName");
        if (otherNameEl) otherNameEl.textContent = S.profile.otherName;
        const myStatusEl = $("myStatus");
        if (myStatusEl) myStatusEl.textContent = S.profile.myStatus;
        const otherStatusEl = $("otherStatus");
        if (otherStatusEl) otherStatusEl.textContent = S.profile.otherStatus;

        alert("个人资料已保存");
      };
    }

    // 头像上传函数
    const pickAvatar = (who) => {
      const f = document.createElement("input");
      f.type = "file";
      f.accept = "image/*";
      f.onchange = async () => {
        const file = f.files && f.files[0];
        if (!file) return;
        const rd = new FileReader();
        rd.onload = async () => {
          if (who === "my") {
            S.profile.myAvatar = rd.result;
          } else {
            S.profile.otherAvatar = rd.result;
          }
          setState(S);
          await save();
          alert("头像已更新");
        };
        rd.onerror = () => {
          alert("头像上传失败，请重试");
        };
        rd.readAsDataURL(file);
      };
      f.click();
    };

    const upMyAvatarBtn = $("upMyAvatarBtn");
    if (upMyAvatarBtn) {
      upMyAvatarBtn.onclick = () => pickAvatar("my");
    }

    const upOtherAvatarBtn = $("upOtherAvatarBtn");
    if (upOtherAvatarBtn) {
      upOtherAvatarBtn.onclick = () => pickAvatar("other");
    }

    return;
  }

  if (currentTab === "noticeLib") {
    body.innerHTML = `
      <div class="mgrid">
        <div class="block">
          <b>发布公告</b>
          <input id="noticeInput" type="text" placeholder="输入公告内容" />
          <button class="btn primary" id="publishNoticeBtn">发布（12小时）</button>
        </div>
        <div class="block">
          <b>往期公告库</b>
          <div class="list">
            ${[...(S.notices?.current || []), ...(S.notices?.archive || [])].slice(0, 80).map((a, i) => `
              <div class="item">
                <span>${a.createdAt ? new Date(a.createdAt).toLocaleString() : new Date(a.archivedAt || Date.now()).toLocaleString()} | ${a.archiveStatus || (S.notices?.current?.includes(a) ? "正在播放" : "normal")} | ${a.content || ""}</span>
                ${S.notices?.archive?.includes(a) ? `<button class="btn danger" data-del-arch="${i}">删</button>` : `<button class="btn danger" data-del-current="${a.id}">删</button>`}
              </div>
            `).join("") || "<div class='tiny'>暂无</div>"}
          </div>
        </div>
      </div>
    `;

    // 公告函数
    const addNotice = async (text, ttlMs, type, archiveStatus = "normal") => {
      const notice = {
        id: uid(),
        content: text,
        type,
        createdAt: now(),
        expireAt: now() + ttlMs,
        archiveStatus
      };
      S.notices.current.push(notice);
      setState(S);
      await save();
      // 调用 renderNotices 函数显示公告
      import('./mail.js').then(({ renderNotices }) => {
        renderNotices();
      });
    };

    const publishBtn = $("publishNoticeBtn");
    if (publishBtn) {
      publishBtn.onclick = async () => {
        const t = $("noticeInput").value.trim();
        if (!t) { alert("公告内容不能为空"); return; }
        await addNotice(t, 12 * 60 * 60 * 1000, "custom");
        $("noticeInput").value = "";
        alert("公告已发布");
      };
    }

    body.querySelectorAll("[data-del-arch]").forEach(btn => {
      btn.onclick = async () => {
        const i = Number(btn.dataset.delArch);
        S.notices.archive.splice(i, 1);
        setState(S);
        await save();
        await renderSettingsBody();
      };
    });

    body.querySelectorAll("[data-del-current]").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.delCurrent;
        S.notices.current = S.notices.current.filter(n => n.id !== id);
        setState(S);
        await save();
        // 更新公告栏显示
        import('./mail.js').then(({ renderNotices }) => {
          renderNotices();
        });
        await renderSettingsBody();
      };
    });

    return;
  }

  if (currentTab === "replyLib") {
    body.innerHTML = `
      <div class="mgrid">
        ${groupedEditorHtml("replyCards", "字卡")}
        ${groupedEditorHtml("replyEmoji", "emoji")}
        ${groupedEditorHtml("replyKaomoji", "颜文字")}
        <div class="block">
          <b>表情包</b>
          <button class="btn" id="addReplyStickerBtn">添加对方表情包</button>
          <div class="stickerGrid">
            ${S.libs.replyStickers.map((x, i) => {
              const src = typeof x === 'string' ? x : x.src;
              return `
              <div class="stickerGridItem" data-r="${i}" style="position:relative;">
                <img src="${src}" style="width:100%;height:52px;border-radius:8px;object-fit:cover;border:1px solid var(--line);cursor:pointer;" />
                <button class="stickerGridDelete" data-del-r="${i}" style="display:none;position:absolute;top:-5px;right:-5px;width:20px;height:20px;border-radius:50%;background:#ff5f84;color:#fff;border:none;cursor:pointer;font-size:12px;z-index:1;">×</button>
              </div>
              `;
            }).join("") || "<div class='tiny'>暂无</div>"}
          </div>
        </div>
      </div>
    `;

    bindGroupedEditorEvents(body);

    const addReplyStickerBtn = $("addReplyStickerBtn");
    if (addReplyStickerBtn) {
      addReplyStickerBtn.onclick = () => {
        addStickers("reply");
      };
    }

    body.querySelectorAll(".stickerGridItem[data-r]").forEach(el => {
      const img = el.querySelector('img');
      const delBtn = el.querySelector('.stickerGridDelete');
      img.onmouseenter = () => delBtn.style.display = 'block';
      img.onmouseleave = () => delBtn.style.display = 'none';
      delBtn.onmouseenter = () => delBtn.style.display = 'block';
      delBtn.onmouseleave = () => delBtn.style.display = 'none';
    });

    body.querySelectorAll("[data-del-r]").forEach(btn => {
      btn.onclick = async () => {
        S.libs.replyStickers.splice(Number(btn.dataset.delR), 1);
        setState(S);
        await save();
        await renderSettingsBody();
      };
    });

    return;
  }

  if (currentTab === "atmosphere") {
    body.innerHTML = `
      <div class="mgrid">
        <div class="block">
          ${groupedEditorHtml("interactions", "互动")}
        </div>
        <div class="block">
          <b>状态</b>
          <textarea id="statusesText">${esc((S.libs.statuses || []).join("\n"))}</textarea>
          <button class="btn" id="saveStatusesBtn">保存状态</button>
        </div>
        <div class="block">
          <b>心情</b>
          <textarea id="moodsText">${esc((S.libs.moodsPool || []).join("\n"))}</textarea>
          <button class="btn" id="saveMoodsBtn">保存心情</button>
        </div>
        <div class="block">
          <b>天气</b>
          <textarea id="weatherText">${esc((S.libs.weatherPool || []).join("\n"))}</textarea>
          <button class="btn" id="saveWeatherBtn">保存天气</button>
        </div>
        <div class="block">
          <b>互动装饰</b>
          <div style="margin-bottom:.5rem;">
            <label>'${esc(S.profile.myName)}'的互动装饰：</label>
            <input id="meLeftInput" type="text" value="${esc(S.decor.meLeft || "")}" placeholder="左侧装饰" />
            <input id="meRightInput" type="text" value="${esc(S.decor.meRight || "")}" placeholder="右侧装饰" />
          </div>
          <div>
            <label>'${esc(S.profile.otherName)}'的互动装饰：</label>
            <input id="otherLeftInput" type="text" value="${esc(S.decor.otherLeft || "")}" placeholder="左侧装饰" />
            <input id="otherRightInput" type="text" value="${esc(S.decor.otherRight || "")}" placeholder="右侧装饰" />
          </div>
          <button class="btn primary" id="saveDecorBtn" style="margin-top:.5rem;">保存互动装饰</button>
        </div>
        <div class="block">
          <b>开场动画库</b>
          <textarea id="openingTitle" placeholder="主标题"></textarea>
          <textarea id="openingSubtitle" placeholder="副标题"></textarea>
          <div style="margin-top:.5rem;display:flex;gap:.35rem;flex-wrap:wrap;">
            <button class="btn primary" id="saveOpeningBtn">添加到开场动画库</button>
          </div>
          <div class="list">
            ${(S.libs.openingAnimations || []).map((o, i) => `
              <div class="item" style="display:flex;align-items:center;justify-content:space-between;gap:.35rem;">
                <div style="min-width:0;">
                  <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(o.title)}</div>
                  <div style="font-size:.85rem;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(o.subtitle)}</div>
                </div>
                <button class="btn danger" data-del-opening="${i}">删</button>
              </div>
            `).join("") || "<div class='tiny'>暂无</div>"}
          </div>
        </div>
      </div>
    `;

    bindGroupedEditorEvents(body);

    const saveStatusesBtn = $("saveStatusesBtn");
    if (saveStatusesBtn) {
      saveStatusesBtn.onclick = async () => {
        S.libs.statuses = $("statusesText").value.split("\n").map(x => x.trim()).filter(Boolean);
        setState(S);
        await save();
      };
    }

    const saveMoodsBtn = $("saveMoodsBtn");
    if (saveMoodsBtn) {
      saveMoodsBtn.onclick = async () => {
        S.libs.moodsPool = $("moodsText").value.split("\n").map(x => x.trim()).filter(Boolean);
        setState(S);
        await save();
      };
    }

    const saveWeatherBtn = $("saveWeatherBtn");
    if (saveWeatherBtn) {
      saveWeatherBtn.onclick = async () => {
        S.libs.weatherPool = $("weatherText").value.split("\n").map(x => x.trim()).filter(Boolean);
        setState(S);
        await save();
      };
    }

    // 保存互动装饰
    const saveDecorBtn = $("saveDecorBtn");
    if (saveDecorBtn) {
      saveDecorBtn.onclick = async () => {
        S.decor.meLeft = $("meLeftInput").value.trim();
        S.decor.meRight = $("meRightInput").value.trim();
        S.decor.otherLeft = $("otherLeftInput").value.trim();
        S.decor.otherRight = $("otherRightInput").value.trim();
        setState(S);
        await save();
        alert("互动装饰已保存");
      };
    }

    // 开场动画库
    const saveOpeningBtn = $("saveOpeningBtn");
    if (saveOpeningBtn) {
      saveOpeningBtn.onclick = async () => {
        const title = $("openingTitle").value.trim();
        const subtitle = $("openingSubtitle").value.trim();
        if (!title || !subtitle) {
          alert("请输入主标题和副标题");
          return;
        }
        if (!S.libs.openingAnimations) S.libs.openingAnimations = [];
        S.libs.openingAnimations.push({ title, subtitle });
        setState(S);
        await save();
        $("openingTitle").value = "";
        $("openingSubtitle").value = "";
        await renderSettingsBody();
      };
    }

    body.querySelectorAll("[data-del-opening]").forEach(btn => {
      btn.onclick = async () => {
        const i = Number(btn.dataset.delOpening);
        S.libs.openingAnimations.splice(i, 1);
        setState(S);
        await save();
        await renderSettingsBody();
      };
    });

    return;
  }

  if (currentTab === "skin") {
    body.innerHTML = `
      <div class="mgrid">
        <div class="block">
          <b>主题配色</b>
          <label>顶部/底部/对方气泡/弹窗颜色：<input type="color" id="themeBaseInput" value="${esc(S.skin.themeBase)}" /></label>
          <label>我方气泡/功能按钮/提示窗口颜色：<input type="color" id="themeAccentInput" value="${esc(S.skin.themeAccent)}" /></label>
          <button class="btn primary" id="saveThemeBtn">保存主题</button>
        </div>
        <div class="block">
          <b>聊天背景</b>
          <button class="btn" id="addBgColorBtn">添加纯色背景</button>
          <button class="btn" id="importBgBtn">从本地导入</button>
          <div class="list">
            ${S.skin.backgroundLibrary.map(bg => `
              <div class="item" style="display:flex;align-items:center;justify-content:space-between;gap:.35rem;">
                <div style="display:flex;align-items:center;gap:.35rem;">
                  <div data-edit-bg="${bg.type === 'color' ? bg.id : ''}" style="width:32px;height:32px;border:1px solid var(--line);border-radius:8px;${bg.type === 'color' ? `background:${bg.value};cursor:pointer;` : (bg.value ? `background:url(${bg.value}) center/cover` : 'background:#f0f0f0')} "></div>
                  <span>${esc(bg.name)}</span>
                </div>
                <span>
                  <button class="btn" data-set-bg="${bg.id}">选中</button>
                  ${bg.id !== 'bg_default' ? `<button class="btn danger" data-del-bg="${bg.id}">删</button>` : ''}
                </span>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="block">
          <b>塔罗牌面</b>
          <div id="tarotImportControls">
            ${!S.skin.tarotDecks.length || S.skin.tarotDecks.every(d => (d.majorArcana?.length || 0) + (d.wands?.length || 0) + (d.cups?.length || 0) + (d.swords?.length || 0) + (d.pentacles?.length || 0) === 78) ? `
              <button class="btn primary" id="createTarotDeckBtn">创建新牌组</button>
            ` : `
              <div class="tiny">有未完成的牌组，请继续导入</div>
            `}
          </div>
          <div class="list">
            ${S.skin.tarotDecks.map(deck => `
              <div class="item" style="display:flex;align-items:center;justify-content:space-between;gap:.35rem;">
                <span>
                  ${esc(deck.name)}
                  <div class="tiny">
                    大阿尔卡纳: ${deck.majorArcana?.length || 0}/22
                    权杖: ${deck.wands?.length || 0}/14
                    圣杯: ${deck.cups?.length || 0}/14
                    宝剑: ${deck.swords?.length || 0}/14
                    星币: ${deck.pentacles?.length || 0}/14
                  </div>
                </span>
                <span>
                  ${(deck.majorArcana?.length || 0) + (deck.wands?.length || 0) + (deck.cups?.length || 0) + (deck.swords?.length || 0) + (deck.pentacles?.length || 0) === 78 ? `
                    <button class="btn" data-select-tarot="${deck.id}">选中</button>
                  ` : `
                    <button class="btn primary" data-import-tarot="${deck.id}">继续导入</button>
                  `}
                  <button class="btn danger" data-del-tarot="${deck.id}">删</button>
                </span>
              </div>
            `).join('') || "<div class='tiny'>暂无牌组</div>"}
          </div>
        </div>
      </div>
    `;

    const saveThemeBtn = $("saveThemeBtn");
    if (saveThemeBtn) {
      saveThemeBtn.onclick = async () => {
        S.skin.themeBase = $("themeBaseInput").value;
        S.skin.themeAccent = $("themeAccentInput").value;
        setState(S);
        await save();

        // 立即应用主题配色
        document.documentElement.style.setProperty('--theme-base', S.skin.themeBase);
        document.documentElement.style.setProperty('--theme-accent', S.skin.themeAccent);

        alert("主题配色已保存");
      };
    }

    const addBgColorBtn = $("addBgColorBtn");
    if (addBgColorBtn) {
      addBgColorBtn.onclick = async () => {
        const c = prompt("输入颜色值（如 #f6f3ff）", "#f6f3ff");
        if (!c) return;
        const id = "bg_" + Date.now();
        S.skin.backgroundLibrary.push({ id, type: "color", value: c, name: `纯色 ${c}` });
        S.skin.currentBackgroundId = id;
        setState(S);
        await save();
        await renderSettingsBody();
      };
    }

    const importBgBtn = $("importBgBtn");
    if (importBgBtn) {
      importBgBtn.onclick = () => {
        const f = document.createElement("input");
        f.type = "file";
        f.accept = "image/*";
        f.onchange = async () => {
          const file = f.files && f.files[0];
          if (!file) return;
          const rd = new FileReader();
          rd.onload = async () => {
            const id = "bg_" + Date.now();
            S.skin.backgroundLibrary.push({ id, type: "image", value: rd.result, name: file.name });
            S.skin.currentBackgroundId = id;
            setState(S);
            await save();
            await renderSettingsBody();
          };
          rd.readAsDataURL(file);
        };
        f.click();
      };
    }

    body.querySelectorAll("[data-set-bg]").forEach(btn => {
      btn.onclick = async () => {
        S.skin.currentBackgroundId = btn.dataset.setBg;
        
        // 立即应用背景到界面
        const currentBg = S.skin.backgroundLibrary.find(bg => bg.id === S.skin.currentBackgroundId);
        if (currentBg) {
          const chat = document.querySelector('.chat');
          if (chat) {
            if (currentBg.type === 'color') {
              chat.style.background = currentBg.value;
            } else if (currentBg.type === 'image' && currentBg.value) {
              chat.style.background = `url(${currentBg.value}) center/cover no-repeat`;
            }
          }
        }
        
        setState(S);
        await save();
        await renderSettingsBody();
      };
    });

    body.querySelectorAll("[data-del-bg]").forEach(btn => {
      btn.onclick = async () => {
        S.skin.backgroundLibrary = S.skin.backgroundLibrary.filter(bg => bg.id !== btn.dataset.delBg);
        if (S.skin.currentBackgroundId === btn.dataset.delBg) S.skin.currentBackgroundId = "bg_default";
        setState(S);
        await save();
        await renderSettingsBody();
      };
    });

    // 塔罗牌面事件处理
    const createTarotDeckBtn = $("createTarotDeckBtn");
    if (createTarotDeckBtn) {
      createTarotDeckBtn.onclick = async () => {
        const deckName = prompt("输入牌组名称", "新牌组") || "新牌组";
        if (!deckName) return;
        const deckId = "tarot_" + Date.now();
        S.skin.tarotDecks.push({
          id: deckId,
          name: deckName,
          majorArcana: [],
          wands: [],
          cups: [],
          swords: [],
          pentacles: []
        });
        setState(S);
        await save();
        await renderSettingsBody();
      };
    }

    body.querySelectorAll("[data-import-tarot]").forEach(btn => {
      btn.onclick = () => {
        const deckId = btn.dataset.importTarot;
        const deck = S.skin.tarotDecks.find(d => d.id === deckId);
        if (!deck) return;
        // 需要从 tarot.js 导入 importTarotGroup 函数
        alert("塔罗牌导入功能需要从 tarot.js 模块导入");
      };
    });

    body.querySelectorAll("[data-select-tarot]").forEach(btn => {
      btn.onclick = async () => {
        S.skin.selectedTarotDeck = btn.dataset.selectTarot;
        setState(S);
        await save();
        await renderSettingsBody();
      };
    });

    body.querySelectorAll("[data-del-tarot]").forEach(btn => {
      btn.onclick = async () => {
        S.skin.tarotDecks = S.skin.tarotDecks.filter(d => d.id !== btn.dataset.delTarot);
        if (S.skin.selectedTarotDeck === btn.dataset.delTarot) {
          S.skin.selectedTarotDeck = null;
        }
        setState(S);
        await save();
        await renderSettingsBody();
      };
    });

    return;
  }

  if (currentTab === "data") {
    body.innerHTML = `
      <div class="mgrid">
        <div class="block">
          <b>聊天记录</b>
          <input type="text" id="chatSearchInput" placeholder="搜索聊天记录..." style="width:100%;margin-bottom:.5rem;" />
          <button class="btn" id="searchChatBtn">搜索</button>
          <button class="btn danger" id="clearChatDataBtn">清空聊天记录</button>
          <div id="chatSearchResults" style="margin-top:.5rem;max-height:300px;overflow-y:auto;"></div>
        </div>
        <div class="block">
          <b>本地备份</b>
          <button class="btn" id="exportBtn">导出备份</button>
          <input type="file" id="importInput" accept=".json" />
        </div>
        <div class="block">
          <b>云端备份</b>
          <button class="btn" id="manualBackupBtn">手动备份到云端</button>
          <button class="btn" id="restoreBtn">从云端恢复</button>
          <label><input type="checkbox" id="autoBackupToggle" ${S.settings.autoBackup ? 'checked' : ''} /> 开启自动备份（每15分钟）</label>
        </div>
      </div>
    `;

    const searchChatBtn = $("searchChatBtn");
    if (searchChatBtn) {
      searchChatBtn.onclick = () => {
        const searchTerm = $("chatSearchInput").value.trim().toLowerCase();
        if (!searchTerm) {
          alert("请输入搜索关键词");
          return;
        }

        const results = S.chat.messages.filter(msg => {
          const text = (msg.text || "").toLowerCase();
          return text.includes(searchTerm);
        });

        const resultsDiv = $("chatSearchResults");
        if (results.length === 0) {
          resultsDiv.innerHTML = '<div class="tiny">未找到匹配的聊天记录</div>';
        } else {
          resultsDiv.innerHTML = results.map(msg => `
            <div class="item" style="padding:.5rem;border-bottom:1px solid var(--line);">
              <div class="tiny">${msg.sender === 'my' ? '我' : '对方'} | ${new Date(msg.timestamp).toLocaleString()}</div>
              <div>${esc(msg.text || "")}</div>
            </div>
          `).join('');
        }

        alert(`我发送：${S.stats.myCount || 0}\n对方发送：${S.stats.otherCount || 0}\n\n常用字卡：\n${tc.map(x => `${x[0]}(${x[1]})`).join("\n") || "暂无"}\n\n常用短语：\n${tp.map(x => `${x[0]}(${x[1]})`).join("\n") || "暂无"}`);
      };
    }

    const clearChatDataBtn = $("clearChatDataBtn");
    if (clearChatDataBtn) {
      clearChatDataBtn.onclick = async () => {
        if (confirm("确定要清空所有聊天记录吗？此操作不可恢复！")) {
          S.chat.messages = [];
          S.chat.unreadMyIds = [];
          setState(S);
          await save();
          alert("聊天记录已清空");
        }
      };
    }

    const exportBtn = $("exportBtn");
    if (exportBtn) {
      exportBtn.onclick = () => {
        const exportData = JSON.parse(JSON.stringify(S));
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `secret-base-backup-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        alert("备份已导出");
      };
    }

    const importInput = $("importInput");
    if (importInput) {
      importInput.onchange = (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        const rd = new FileReader();
        rd.onload = async () => {
          try {
            const importedData = JSON.parse(rd.result);
            // 保留本地表情包，合并导入的数据
            const localMyStickers = S.libs.myStickers || [];
            const localReplyStickers = S.libs.replyStickers || [];
            
            // 使用 deepMerge 智能合并数据，兼容不同版本的数据结构
            S = deepMerge(structuredClone(base), importedData);
            
            // 恢复本地表情包
            S.libs.myStickers = localMyStickers;
            S.libs.replyStickers = localReplyStickers;
            
            setState(S);
            await save();
            await renderAllLite();
            await renderTabs();
            await renderSettingsBody();
            alert("导入成功");
          } catch {
            alert("导入失败：文件格式错误");
          }
        };
        rd.readAsText(f, "utf-8");
      };
    }

    // 云端备份功能
    const manualBackupBtn = $("manualBackupBtn");
    if (manualBackupBtn) {
      manualBackupBtn.onclick = async () => {
        try {
          await backupToCloud();
          alert('云端备份成功！');
        } catch (err) {
          console.error('云端备份失败:', err);
          
          // 提供更详细的错误信息
          let errorMsg = '云端备份失败';
          if (err.message && err.message.includes('Failed to fetch')) {
            errorMsg += '：网络连接失败，请检查网络';
          } else if (err.message && err.message.includes('HTTP 4')) {
            errorMsg += '：请求参数错误';
          } else if (err.message && err.message.includes('HTTP 5')) {
            errorMsg += '：服务器错误，可能是数据过大。建议使用导出功能进行本地备份。';
          } else {
            errorMsg += '：' + (err.message || '未知错误');
          }
          alert(errorMsg);
        }
      };
    }

    const restoreBtn = $("restoreBtn");
    if (restoreBtn) {
      restoreBtn.onclick = async () => {
        if (confirm("确定要从云端恢复数据吗？这将覆盖本地数据！")) {
          try {
            await restoreFromCloud();
            alert('从云端恢复成功！');
            // 刷新界面
            await renderAllLite();
            await renderTabs();
            await renderSettingsBody();
          } catch (err) {
            console.error('从云端恢复失败:', err);
            alert('从云端恢复失败：' + (err.message || '未知错误'));
          }
        }
      };
    }

    const autoBackupToggle = $("autoBackupToggle");
    if (autoBackupToggle) {
      autoBackupToggle.onchange = async (e) => {
        S.settings.autoBackup = e.target.checked;
        setState(S);
        await save();
        alert(S.settings.autoBackup ? "自动备份已开启" : "自动备份已关闭");
      };
    }

    return;
  }

  // 默认显示
  body.innerHTML = "<div class='tiny'>请选择一个标签页</div>";
}

// 导出函数
export { renderSettingsBody, renderTabs, currentTab, tabs };
