// 心情天气模块
import { getState, setState, save } from './state.js';
import { $, now, dateKey, esc, pick, chance } from './utils.js';

// 确保当天数据存在
function ensureDay(k = dateKey()) {
  const S = getState();
  if (!S.moodWeather) {
    S.moodWeather = { byDate: {}, latestMyWeather: "" };
  }
  if (!S.moodWeather.byDate[k]) {
    S.moodWeather.byDate[k] = {
      myMoods: [],
      otherMoods: [],
      myWeather: [],
      otherWeather: [],
      otherNextWeatherAt: 0,
      otherNextMoodAt: 0
    };
  }
  return S.moodWeather.byDate[k];
}

// 添加心情记录（格式：emoji||card）
async function addMoodRecord(date, mood, card, target = 'me') {
  const S = getState();
  const dateStr = typeof date === 'string' ? date : dateKey(date);
  const d = ensureDay(dateStr);

  if (target === 'me') {
    if (d.myMoods.length >= 3) {
      alert('当天最多添加3条心情');
      return;
    }
    d.myMoods.push(`${mood}||${card || '无'}`);
  } else {
    if (d.otherMoods.length >= 3) {
      return;
    }
    d.otherMoods.push(`${mood}||${card || '无'}`);
  }

  await save();
  renderMoodCalendar();
}

// 保存天气
async function saveWeather(weather) {
  const S = getState();
  const dateStr = dateKey();
  const d = ensureDay(dateStr);

  d.myWeather.push(weather);
  S.moodWeather.latestMyWeather = weather;

  await save();
  renderMoodCalendar();

  // 更新显示
  const myWeatherLatest = $('myWeatherLatest');
  if (myWeatherLatest) {
    myWeatherLatest.textContent = `我的天气：${weather}`;
  }
}

// 渲染心情日历
function renderMoodCalendar() {
  const S = getState();
  const calendar = $('calendar');
  if (!calendar) return;

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  // 更新月份标签
  const monthLabel = $('calendar-month-label');
  if (monthLabel) {
    monthLabel.textContent = `${year}年${month + 1}月`;
  }

  // 获取当月第一天和最后一天
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  // 清空日历
  calendar.innerHTML = '';

  // 添加星期标题
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  weekDays.forEach(day => {
    const dayHeader = document.createElement('div');
    dayHeader.className = 'day';
    dayHeader.style.textAlign = 'center';
    dayHeader.style.fontWeight = 'bold';
    dayHeader.textContent = day;
    calendar.appendChild(dayHeader);
  });

  // 添加空白日期
  for (let i = 0; i < startDayOfWeek; i++) {
    const emptyDay = document.createElement('div');
    emptyDay.className = 'day';
    emptyDay.style.visibility = 'hidden';
    calendar.appendChild(emptyDay);
  }

  // 添加日期
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const item = S.moodWeather.byDate[dateStr];

    const dayElement = document.createElement('div');
    dayElement.className = 'day';
    dayElement.style.cursor = 'pointer';
    dayElement.dataset.date = dateStr;

    // 日期数字
    const dayNumber = document.createElement('div');
    dayNumber.textContent = day;
    dayNumber.style.fontWeight = 'bold';
    dayElement.appendChild(dayNumber);

    // 心情和天气
    if (item) {
      const my = (item.myMoods || []).slice(0, 3).map(x => x.split('|')[0]).join(' ');
      const ot = (item.otherMoods || []).slice(0, 3).map(x => x.split('|')[0]).join(' ');

      if (my) {
        const myMood = document.createElement('div');
        myMood.textContent = `我：${my}`;
        myMood.style.fontSize = '0.8rem';
        dayElement.appendChild(myMood);
      }
      if (ot) {
        const otherMood = document.createElement('div');
        otherMood.textContent = `TA：${ot}`;
        otherMood.style.fontSize = '0.8rem';
        dayElement.appendChild(otherMood);
      }
    }

    // 点击事件
    dayElement.addEventListener('click', () => {
      openMoodEditor(dateStr);
    });

    calendar.appendChild(dayElement);
  }
}

// 打开心情编辑器
function openMoodEditor(dateStr) {
  const S = getState();
  const d = ensureDay(dateStr);

  // 更新编辑器UI
  $('mood-selector-date').textContent = dateStr;

  // 填充表单
  if ($('myMoodEmojiInput')) {
    $('myMoodEmojiInput').value = '';
  }
  if ($('myMoodEventInput')) {
    $('myMoodEventInput').value = '';
  }
  if ($('myWeatherInput')) {
    $('myWeatherInput').value = '';
  }

  // 显示心情弹窗
  $('moodMask').classList.add('show');
}

// 保存心情
async function saveMood() {
  const dateStr = $('mood-selector-date').textContent;
  const mood = $('myMoodEmojiInput').value.trim();
  const card = $('myMoodEventInput').value.trim();
  const weather = $('myWeatherInput').value.trim();

  if (mood) {
    await addMoodRecord(dateStr, mood, card, 'me');
  }
  if (weather) {
    await saveWeather(weather);
  }

  // 关闭弹窗
  $('moodMask').classList.remove('show');
}

// 关闭心情弹窗
function closeMoodModal() {
  $('moodMask').classList.remove('show');
}

// 导出函数
export {
  addMoodRecord,
  saveWeather,
  renderMoodCalendar,
  openMoodEditor,
  saveMood,
  closeMoodModal,
  ensureDay
};
