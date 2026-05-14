// 配置和常量
const CONFIG = {
  DB_NAME: 'SecretBaseDB',
  DB_VERSION: 2, // 增加版本号以触发数据库升级
  STORE_STICKERS: 'stickers',
  STORE_BACKGROUNDS: 'backgrounds',
  STORE_BACKUP: 'backup',
  STORE_STATE: 'state',
  STORE_IMAGES: 'images', // 新增图片存储
  KEY: "secret_base_v4_fix_all",
  SUPABASE_URL: "https://obvgtgqspetilriwcgok.supabase.co",
  SUPABASE_API_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9idmd0Z3FzcGV0aWxyaXdjZ29rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNTI1MTksImV4cCI6MjA5MjgyODUxOX0.P5FmJr-_jlO82YiWC4lZNB0xEdCQRpZkJqX8zeM03Ak",
  DEBUG_ENDPOINT: "",
  DEBUG_SESSION_ID: "993c2d"
};

const TAROT = [
  "愚人", "魔术师", "女祭司", "女皇", "皇帝", "教皇", "恋人", "战车", "力量", "隐者", "命运之轮", "正义", "倒吊人", "死神", "节制", "恶魔", "高塔", "星星", "月亮", "太阳", "审判", "世界",
  "权杖一", "权杖二", "权杖三", "权杖四", "权杖五", "权杖六", "权杖七", "权杖八", "权杖九", "权杖十", "权杖侍从", "权杖骑士", "权杖王后", "权杖国王",
  "圣杯一", "圣杯二", "圣杯三", "圣杯四", "圣杯五", "圣杯六", "圣杯七", "圣杯八", "圣杯九", "圣杯十", "圣杯侍从", "圣杯骑士", "圣杯王后", "圣杯国王",
  "宝剑一", "宝剑二", "宝剑三", "宝剑四", "宝剑五", "宝剑六", "宝剑七", "宝剑八", "宝剑九", "宝剑十", "宝剑侍从", "宝剑骑士", "宝剑王后", "宝剑国王",
  "星币一", "星币二", "星币三", "星币四", "星币五", "星币六", "星币七", "星币八", "星币九", "星币十", "星币侍从", "星币骑士", "星币王后", "星币国王"
];

const PUNCT = ["。","！","……","～","——","？"];

export { CONFIG, TAROT, PUNCT };
