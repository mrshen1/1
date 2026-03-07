const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

const DATA_DIR = path.join(__dirname, 'data');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function initDataFile(filePath, defaultData) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf8');
  }
}

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function normalizeNickname(nickname) {
  return String(nickname || '').trim().toLowerCase();
}

function getRecordNickname(record) {
  return normalizeNickname(record?.formData?.gameName);
}

function dedupeRecordsByNickname(records) {
  const seen = new Set();
  const deduped = [];

  for (const record of records) {
    const nickname = getRecordNickname(record);

    // Keep records without nickname as-is.
    if (!nickname) {
      deduped.push(record);
      continue;
    }

    if (seen.has(nickname)) {
      continue;
    }

    seen.add(nickname);
    deduped.push(record);
  }

  return deduped;
}

const defaultConfig = {
  noticeContent:
    '【卖家须知】\n\n1. 请确保填写的账号信息真实有效，虚假信息将导致估价不准确。\n\n2. 回收价格仅供参考，最终价格以实际验号为准。\n\n3. 账号交易存在一定风险，请谨慎操作。\n\n4. 我们承诺保护您的个人信息安全，不会泄露给第三方。\n\n5. 如有疑问，请联系客服咨询。',
  insuranceOptions: [
    { value: '2', label: '2', ratio: 40 },
    { value: '4', label: '4', ratio: 38 },
    { value: '6', label: '6', ratio: 35 },
    { value: '9', label: '9', ratio: 34 }
  ],
  knifeSkinOptions: [
    { value: 'none', label: '无刀皮', hasSkin: false },
    { value: 'dark_star', label: '暗星', hasSkin: true },
    { value: 'dragon_fang', label: '龙牙', hasSkin: true },
    { value: 'creed', label: '信条', hasSkin: true },
    { value: 'chixiao', label: '赤霄', hasSkin: true },
    { value: 'mercy', label: '怜悯', hasSkin: true },
    { value: 'shadow_edge', label: '影锋', hasSkin: true },
    { value: 'black_sea', label: '黑海', hasSkin: true },
    { value: 'polaris', label: '北极星', hasSkin: true }
  ],
  operatorSkinOptions: [
    { value: 'none', label: '无皮肤', hasSkin: false },
    { value: 'lingxiao', label: '凌霄戍卫', hasSkin: true },
    { value: 'gold_rose', label: '蚀金玫瑰', hasSkin: true },
    { value: 'ink_cloud', label: '水墨云图', hasSkin: true },
    { value: 'midnight_postman', label: '午夜邮差', hasSkin: true },
    { value: 'skyline', label: '天际线', hasSkin: true },
    { value: 'wisadel', label: '维什戴尔', hasSkin: true }
  ],
  bottomImages: [],
  feeConfig: {
    enabled: false,
    rate: 0.9
  }
};

initDataFile(RECORDS_FILE, { records: [] });
initDataFile(CONFIG_FILE, defaultConfig);

function shouldMigrateNotice(noticeContent) {
  const text = String(noticeContent || '');
  return !text.includes('卖家须知') || text.includes('[Seller Notice]');
}

function shouldMigrateKnifeOptions(options) {
  if (!Array.isArray(options)) return true;
  const hasEnglish = options.some((item) => /[A-Za-z]/.test(String(item?.label || '')));
  const required = ['dark_star', 'dragon_fang', 'creed', 'chixiao', 'mercy', 'shadow_edge', 'black_sea', 'polaris'];
  const valueSet = new Set(options.map((item) => item?.value));
  const missingRequired = required.some((value) => !valueSet.has(value));
  return hasEnglish || missingRequired;
}

function shouldMigrateOperatorOptions(options) {
  if (!Array.isArray(options)) return true;
  const hasEnglish = options.some((item) => /[A-Za-z]/.test(String(item?.label || '')));
  const noneOption = options.find((item) => item?.value === 'none');
  const noneLabelMismatch = !noneOption || String(noneOption.label || '') !== '无皮肤';
  const required = ['none', 'lingxiao', 'gold_rose', 'ink_cloud', 'midnight_postman', 'skyline', 'wisadel'];
  const valueSet = new Set(options.map((item) => item?.value));
  const missingRequired = required.some((value) => !valueSet.has(value));
  return hasEnglish || missingRequired || noneLabelMismatch;
}

function migrateConfigToChineseIfNeeded() {
  const current = readJson(CONFIG_FILE, defaultConfig);
  const next = { ...current };
  let changed = false;

  if (shouldMigrateNotice(current.noticeContent)) {
    next.noticeContent = defaultConfig.noticeContent;
    changed = true;
  }

  if (shouldMigrateKnifeOptions(current.knifeSkinOptions)) {
    next.knifeSkinOptions = defaultConfig.knifeSkinOptions;
    changed = true;
  }

  if (shouldMigrateOperatorOptions(current.operatorSkinOptions)) {
    next.operatorSkinOptions = defaultConfig.operatorSkinOptions;
    changed = true;
  }

  if (changed) {
    writeJson(CONFIG_FILE, next);
  }
}

migrateConfigToChineseIfNeeded();

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

app.get('/', (req, res) => {
  res.status(200).send('AE backend is running');
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

app.get('/api/records', (req, res) => {
  const data = readJson(RECORDS_FILE, { records: [] });
  data.records = Array.isArray(data.records) ? data.records : [];
  const deduped = dedupeRecordsByNickname(data.records);

  // Cleanup legacy duplicates in storage.
  if (deduped.length !== data.records.length) {
    data.records = deduped;
    writeJson(RECORDS_FILE, data);
  }

  res.json({ success: true, data: deduped });
});

app.post('/api/records', (req, res) => {
  const { formData, ratio, price } = req.body;

  if (!formData || ratio === undefined || price === undefined) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const data = readJson(RECORDS_FILE, { records: [] });
  const newRecord = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    formData,
    ratio,
    price
  };

  data.records = Array.isArray(data.records) ? data.records : [];
  const incomingNickname = normalizeNickname(formData?.gameName);

  // Overwrite existing record when nickname is the same.
  if (incomingNickname) {
    data.records = data.records.filter((record) => getRecordNickname(record) !== incomingNickname);
  }

  data.records.unshift(newRecord);
  data.records = dedupeRecordsByNickname(data.records);

  if (data.records.length > 500) {
    data.records = data.records.slice(0, 500);
  }

  writeJson(RECORDS_FILE, data);
  res.json({ success: true, data: newRecord });
});

app.put('/api/records/:id', (req, res) => {
  const id = Number(req.params.id);
  const { formData, ratio, price } = req.body;

  const data = readJson(RECORDS_FILE, { records: [] });
  data.records = Array.isArray(data.records) ? data.records : [];

  const index = data.records.findIndex((r) => r.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Record not found' });
  }

  const updatedRecord = {
    ...data.records[index],
    formData: formData ?? data.records[index].formData,
    ratio: ratio ?? data.records[index].ratio,
    price: price ?? data.records[index].price
  };

  data.records[index] = updatedRecord;
  // Treat edited record as the latest one and keep one record per nickname.
  data.records = [updatedRecord, ...data.records.filter((record) => record.id !== id)];
  data.records = dedupeRecordsByNickname(data.records);

  if (data.records.length > 500) {
    data.records = data.records.slice(0, 500);
  }

  writeJson(RECORDS_FILE, data);
  res.json({ success: true, data: updatedRecord });
});

app.delete('/api/records/:id', (req, res) => {
  const id = Number(req.params.id);
  const data = readJson(RECORDS_FILE, { records: [] });
  data.records = Array.isArray(data.records) ? data.records : [];

  data.records = data.records.filter((r) => r.id !== id);
  writeJson(RECORDS_FILE, data);
  res.json({ success: true, message: 'Record deleted' });
});

app.delete('/api/records', (req, res) => {
  writeJson(RECORDS_FILE, { records: [] });
  res.json({ success: true, message: 'All records cleared' });
});

app.get('/api/config', (req, res) => {
  const config = readJson(CONFIG_FILE, defaultConfig);
  res.json({ success: true, data: config });
});

app.put('/api/config', (req, res) => {
  const currentConfig = readJson(CONFIG_FILE, defaultConfig);
  const mergedConfig = { ...currentConfig, ...req.body };
  writeJson(CONFIG_FILE, mergedConfig);
  res.json({ success: true, data: mergedConfig });
});

app.patch('/api/config/:key', (req, res) => {
  const key = req.params.key;
  const config = readJson(CONFIG_FILE, defaultConfig);
  config[key] = req.body;
  writeJson(CONFIG_FILE, config);
  res.json({ success: true, data: config });
});

app.get('/api/fee-config', (req, res) => {
  const config = readJson(CONFIG_FILE, defaultConfig);
  res.json({ success: true, data: config.feeConfig || { enabled: false, rate: 0.9 } });
});

app.put('/api/fee-config', (req, res) => {
  const { enabled, rate } = req.body;
  const config = readJson(CONFIG_FILE, defaultConfig);
  const current = config.feeConfig || { enabled: false, rate: 0.9 };

  config.feeConfig = {
    enabled: enabled !== undefined ? enabled : current.enabled,
    rate: rate !== undefined ? rate : current.rate
  };

  writeJson(CONFIG_FILE, config);
  res.json({ success: true, data: config.feeConfig });
});

app.post('/api/upload', (req, res) => {
  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ success: false, message: 'Missing image data' });
  }

  res.json({ success: true, url: image });
});

app.listen(PORT, () => {
  console.log('================================');
  console.log('AE backend started');
  console.log('================================');
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
  console.log(`Data dir: ${DATA_DIR}`);
  console.log('================================');
});

module.exports = app;
