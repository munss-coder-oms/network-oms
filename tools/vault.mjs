#!/usr/bin/env node
/**
 * vault.mjs — Obsidian 볼트 관리 CLI
 *
 * 음성 세션에서 나온 생각을 원자 노트로 쪼개 저장하고,
 * 노트 사이의 부모-자식 관계로부터 .canvas 마인드맵을 자동 생성합니다.
 *
 * 사용법:
 *   node tools/vault.mjs new --type note --topic "주제" --title "제목" [옵션]
 *   node tools/vault.mjs link --from "자식 제목" --to "부모 제목"
 *   node tools/vault.mjs canvas [--topic "주제"]
 *   node tools/vault.mjs index
 *   node tools/vault.mjs check
 *   node tools/vault.mjs list [--topic "주제"] [--type note]
 *   node tools/vault.mjs capture --title "서술문" [--topic "주제"] [--text "원문"]
 *   node tools/vault.mjs topics | match --text "..." | search --q "..." | export --topic "주제"
 *
 * 의존성 없음 (Node 20+ 표준 라이브러리만 사용).
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const VAULT_DEFAULT = 'vault';

const TYPES = {
  session: { dir: '40-Sessions', label: '세션', canvasColor: '5' },
  topic: { dir: '10-Topics', label: '주제', canvasColor: '6' },
  note: { dir: '20-Notes', label: '원자노트', canvasColor: '4' },
  question: { dir: '30-Questions', label: '열린질문', canvasColor: '2' },
  inbox: { dir: '00-Inbox', label: '미분류', canvasColor: '3' },
};

const STATUSES = ['seed', 'growing', 'stable', 'parked'];
const CONFIDENCES = ['low', 'mid', 'high'];

const RC_FILE = '.vaultrc.json';

/**
 * .canvas 안의 file 경로는 Obsidian 볼트 루트 기준이다.
 * 저장소 루트를 볼트로 열면(Git 플러그인을 쓰려면 그래야 한다) 앞에 `vault/` 가 붙어야 한다.
 * vault/.vaultrc.json 의 canvasPathPrefix 로 정하고, --path-prefix 로 덮어쓸 수 있다.
 */
function loadRc(vaultDir) {
  const file = path.join(vaultDir, RC_FILE);
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    process.stderr.write(`경고: ${file} 를 읽지 못했습니다 (${error.message}). 기본값을 씁니다.\n`);
    return {};
  }
}

// ---------------------------------------------------------------- args

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      out._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    const value = next === undefined || next.startsWith('--') ? true : (i += 1, next);
    if (out[key] === undefined) out[key] = value;
    else if (Array.isArray(out[key])) out[key].push(value);
    else out[key] = [out[key], value];
  }
  return out;
}

const asArray = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

function splitList(value) {
  return asArray(value)
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------- utils

/** 파일명으로 쓸 수 없는 문자만 제거한다. 한글은 그대로 둔다. */
function slugify(input) {
  return String(input)
    .normalize('NFC')
    .replace(/[\\/:*?"<>|#^[\]]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80) || 'untitled';
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function stamp(date = new Date()) {
  const d = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const t = `${pad(date.getHours())}${pad(date.getMinutes())}`;
  return {
    id: `${d}-${t}`,
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    datetime: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === '_templates') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.isFile() && entry.name.endsWith('.md')) acc.push(full);
  }
  return acc;
}

// ------------------------------------------------------- frontmatter io

/**
 * 이 도구가 쓰는 프론트매터 부분집합만 다루는 최소 파서.
 * 지원: 스칼라, `- item` 리스트, `[a, b]` 인라인 리스트.
 */
function parseFrontmatter(raw) {
  if (!raw.startsWith('---')) return { data: {}, body: raw };
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return { data: {}, body: raw };
  const head = raw.slice(raw.indexOf('\n') + 1, end);
  const body = raw.slice(raw.indexOf('\n', end + 1) + 1);

  const data = {};
  let currentKey = null;
  for (const line of head.split('\n')) {
    if (!line.trim()) continue;
    const listItem = line.match(/^\s*-\s+(.*)$/);
    if (listItem && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(unquote(listItem[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    currentKey = kv[1];
    const value = kv[2].trim();
    if (value === '') data[currentKey] = [];
    else if (value.startsWith('[') && value.endsWith(']')) {
      data[currentKey] = value
        .slice(1, -1)
        .split(',')
        .map((s) => unquote(s.trim()))
        .filter(Boolean);
    } else data[currentKey] = unquote(value);
  }
  return { data, body };
}

function unquote(value) {
  const s = String(value).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function quote(value) {
  const s = String(value ?? '');
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(s)) return s;
  return /^[\w가-힣][^:#{}[\]"',&*?|<>=!%@`]*$/u.test(s) && !s.includes('  ') ? s : JSON.stringify(s);
}

function serializeFrontmatter(data) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - ${quote(item)}`);
    } else {
      lines.push(`${key}: ${quote(value)}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

// ---------------------------------------------------------------- model

function loadNotes(vaultDir) {
  return walk(vaultDir).map((file) => {
    const raw = fs.readFileSync(file, 'utf8');
    const { data, body } = parseFrontmatter(raw);
    return {
      file,
      rel: path.relative(vaultDir, file).split(path.sep).join('/'),
      data,
      body,
      title: data.title || path.basename(file, '.md'),
      type: data.type || 'note',
      topic: data.topic || '',
      parents: asArray(data.parents),
      aliases: asArray(data.aliases),
    };
  });
}

function saveNote(note) {
  const content = `${serializeFrontmatter(note.data)}\n\n${note.body.replace(/^\n+/, '')}`;
  fs.writeFileSync(note.file, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
}

function findByTitle(notes, title) {
  const target = String(title).normalize('NFC').trim();
  return notes.find((n) => n.title.normalize('NFC').trim() === target)
    || notes.find((n) => path.basename(n.file, '.md').normalize('NFC') === target)
    || notes.find((n) => n.aliases.some((a) => a.normalize('NFC').trim() === target));
}

/** 주제 이름 비교용 키. 공백·하이픈·대소문자 차이를 무시한다. */
function topicKey(value) {
  return String(value).normalize('NFC').toLowerCase().replace(/[\s\-_·]+/g, '');
}

/** 이름·별칭·파일명으로 기존 주제 허브를 찾는다. 없으면 undefined. */
function resolveTopic(notes, name) {
  const key = topicKey(name);
  return notes.filter((n) => n.type === 'topic').find((hub) => [
    hub.title,
    path.basename(hub.file, '.md'),
    ...hub.aliases,
  ].some((candidate) => topicKey(candidate) === key));
}

// ------------------------------------------------------------- cmd: new

function targetPath(vaultDir, type, topic, title) {
  const info = TYPES[type];
  const base = path.join(vaultDir, info.dir);
  const filename = `${slugify(title)}.md`;
  if (type === 'note' || type === 'question') {
    return path.join(base, slugify(topic || '미분류'), filename);
  }
  if (type === 'session') {
    return path.join(base, filename);
  }
  return path.join(base, filename);
}

function cmdNew(vaultDir, args) {
  const type = String(args.type || 'note');
  if (!TYPES[type]) fail(`알 수 없는 --type: ${type} (가능: ${Object.keys(TYPES).join(', ')})`);
  const title = args.title;
  if (!title || title === true) fail('--title 은 필수입니다.');

  let topic = args.topic && args.topic !== true ? String(args.topic) : '';
  if ((type === 'note' || type === 'question') && !topic) {
    fail(`--type ${type} 에는 --topic 이 필요합니다.`);
  }
  if (topic && type !== 'topic') {
    // 별칭이나 띄어쓰기만 다른 이름으로 들어와도 기존 주제에 붙인다.
    const hub = resolveTopic(loadNotes(vaultDir), topic);
    if (hub) topic = hub.title;
  }

  const now = stamp();
  const status = args.status && args.status !== true ? String(args.status) : 'seed';
  if (!STATUSES.includes(status)) fail(`--status 는 ${STATUSES.join('|')} 중 하나여야 합니다.`);
  const confidence = args.confidence && args.confidence !== true ? String(args.confidence) : 'mid';
  if (!CONFIDENCES.includes(confidence)) fail(`--confidence 는 ${CONFIDENCES.join('|')} 중 하나여야 합니다.`);

  const sessionId = args.session && args.session !== true ? String(args.session) : now.id;
  const file = type === 'session'
    ? path.join(vaultDir, TYPES.session.dir, `${sessionId}-${slugify(title)}.md`)
    : targetPath(vaultDir, type, topic, title);

  if (fs.existsSync(file) && !args.force) {
    fail(`이미 존재합니다: ${file} (덮어쓰려면 --force)`);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const parents = splitList(args.parent);
  const tags = splitList(args.tags);

  const data = {
    title: String(title),
    type,
    topic: type === 'topic' ? String(title) : topic,
    id: now.id,
    created: now.datetime,
    updated: now.datetime,
    status,
    confidence,
    parents,
    aliases: type === 'topic' ? splitList(args.alias) : [],
    tags,
    session: args.session && args.session !== true ? String(args.session) : '',
    notion: args.notion && args.notion !== true ? String(args.notion) : '',
    summary: args.summary && args.summary !== true ? String(args.summary) : '',
  };

  let body = '';
  if (args['body-file'] && args['body-file'] !== true) {
    body = fs.readFileSync(String(args['body-file']), 'utf8');
  } else if (args.body && args.body !== true) {
    body = String(args.body).replace(/\\n/g, '\n');
  } else {
    body = defaultBody(type, data);
  }

  saveNote({ file, data, body });
  process.stdout.write(`${path.relative(process.cwd(), file)}\n`);
}

function defaultBody(type, data) {
  const parentLinks = data.parents.length
    ? data.parents.map((p) => `[[${p}]]`).join(' · ')
    : '(없음)';
  if (type === 'topic') {
    return [
      `# ${data.title}`,
      '',
      '> 이 주제의 허브 노트. 아래 링크가 곧 마인드맵의 가지가 됩니다.',
      '',
      '## 한 줄 정의',
      '',
      '## 하위 생각',
      '',
      '## 열린 질문',
      '',
      '## 지도',
      '',
      `![[${slugify(data.title)}.canvas]]`,
      '',
    ].join('\n');
  }
  if (type === 'question') {
    return [
      `# ${data.title}`,
      '',
      `- 주제: [[${data.topic}]]`,
      `- 상위: ${parentLinks}`,
      '',
      '## 왜 이게 궁금한가',
      '',
      '## 지금까지의 가설',
      '',
      '## 답을 알려면 필요한 것',
      '',
    ].join('\n');
  }
  if (type === 'session') {
    return [
      `# ${data.title}`,
      '',
      '## 말한 내용 (원문 정리)',
      '',
      '## 되비춘 요약',
      '',
      '## 인터뷰 질문과 답',
      '',
      '## 이번에 만들어진 노트',
      '',
      '## 다음에 팔 질문',
      '',
    ].join('\n');
  }
  return [
    `# ${data.title}`,
    '',
    `- 주제: [[${data.topic}]]`,
    `- 상위: ${parentLinks}`,
    '',
    '## 핵심',
    '',
    '## 근거 / 맥락',
    '',
    '## 반론 / 빈 곳',
    '',
  ].join('\n');
}

// ------------------------------------------------------------ cmd: link

function cmdLink(vaultDir, args) {
  const from = args.from;
  const to = args.to;
  if (!from || from === true || !to || to === true) fail('--from 과 --to 가 모두 필요합니다.');

  const notes = loadNotes(vaultDir);
  const child = findByTitle(notes, from);
  if (!child) fail(`노트를 찾을 수 없습니다: ${from}`);
  const parent = findByTitle(notes, to);
  if (!parent) fail(`노트를 찾을 수 없습니다: ${to}`);

  const parents = asArray(child.data.parents);
  if (parents.includes(parent.title)) {
    process.stdout.write(`이미 연결됨: ${child.title} → ${parent.title}\n`);
    return;
  }
  child.data.parents = [...parents, parent.title];
  child.data.updated = stamp().datetime;
  saveNote(child);
  process.stdout.write(`연결됨: ${child.title} → ${parent.title}\n`);
}

// ---------------------------------------------------------- cmd: canvas

const NODE_W = 340;
const NODE_H = 92;
const X_GAP = 140;
const Y_GAP = 28;

function buildTree(notes, topic) {
  const inTopic = notes.filter((n) => n.topic === topic && n.type !== 'topic' && n.type !== 'session');
  const hub = notes.find((n) => n.type === 'topic' && n.title === topic);
  const byTitle = new Map(inTopic.map((n) => [n.title, n]));

  const children = new Map();
  const roots = [];
  for (const note of inTopic) {
    const parents = note.parents.filter((p) => byTitle.has(p) && p !== note.title);
    if (parents.length === 0) {
      roots.push(note);
    } else {
      // 첫 번째 유효한 부모만 트리 간선으로 쓴다 (나머지는 Obsidian 링크로 남음).
      const key = parents[0];
      if (!children.has(key)) children.set(key, []);
      children.get(key).push(note);
    }
  }
  return { hub, roots, children, byTitle, all: inTopic };
}

function canvasForTopic(notes, topic, prefix) {
  const { hub, roots, children } = buildTree(notes, topic);
  const nodes = [];
  const edges = [];
  let cursorY = 0;
  let idSeq = 0;
  const nextId = () => `n${(idSeq += 1).toString().padStart(3, '0')}`;

  const rootId = nextId();
  const seen = new Set();

  function place(note, depth) {
    if (seen.has(note.title)) return null;
    seen.add(note.title);
    const id = nextId();
    const kids = (children.get(note.title) || []).sort((a, b) =>
      String(a.data.created || '').localeCompare(String(b.data.created || '')));
    const placed = kids.map((kid) => place(kid, depth + 1)).filter(Boolean);

    let y;
    if (placed.length === 0) {
      y = cursorY;
      cursorY += NODE_H + Y_GAP;
    } else {
      y = (placed[0].y + placed[placed.length - 1].y) / 2;
    }

    const node = {
      id,
      type: 'file',
      file: `${prefix}${note.rel}`,
      x: depth * (NODE_W + X_GAP),
      y: Math.round(y),
      width: NODE_W,
      height: NODE_H,
      color: TYPES[note.type]?.canvasColor || '4',
    };
    nodes.push(node);
    for (const kid of placed) {
      edges.push({
        id: `e-${id}-${kid.id}`,
        fromNode: id,
        fromSide: 'right',
        toNode: kid.id,
        toSide: 'left',
      });
    }
    return { id, y: node.y };
  }

  const placedRoots = roots
    .sort((a, b) => String(a.data.created || '').localeCompare(String(b.data.created || '')))
    .map((note) => place(note, 1))
    .filter(Boolean);

  const rootY = placedRoots.length
    ? Math.round((placedRoots[0].y + placedRoots[placedRoots.length - 1].y) / 2)
    : 0;

  nodes.unshift(hub
    ? {
      id: rootId,
      type: 'file',
      file: `${prefix}${hub.rel}`,
      x: 0 - (NODE_W + X_GAP),
      y: rootY,
      width: NODE_W,
      height: NODE_H,
      color: '6',
    }
    : {
      id: rootId,
      type: 'text',
      text: `# ${topic}`,
      x: 0 - (NODE_W + X_GAP),
      y: rootY,
      width: NODE_W,
      height: NODE_H,
      color: '6',
    });

  for (const root of placedRoots) {
    edges.push({
      id: `e-${rootId}-${root.id}`,
      fromNode: rootId,
      fromSide: 'right',
      toNode: root.id,
      toSide: 'left',
    });
  }

  return { nodes, edges };
}

function overviewCanvas(notes, prefix) {
  const topics = [...new Set(notes.filter((n) => n.type === 'topic').map((n) => n.title))].sort();
  const nodes = [{
    id: 'root',
    type: 'text',
    text: '# 🧠 나의 생각 지도\n\n주제를 눌러 들어가세요.',
    x: -(NODE_W + X_GAP),
    y: Math.round(((topics.length - 1) * (NODE_H + Y_GAP)) / 2),
    width: NODE_W,
    height: NODE_H + 40,
    color: '6',
  }];
  const edges = [];
  topics.forEach((topic, i) => {
    const hub = notes.find((n) => n.type === 'topic' && n.title === topic);
    const id = `t${i}`;
    const count = notes.filter((n) => n.topic === topic && n.type !== 'topic').length;
    nodes.push({
      id,
      type: 'file',
      file: `${prefix}${hub.rel}`,
      x: 0,
      y: i * (NODE_H + Y_GAP),
      width: NODE_W,
      height: NODE_H,
      color: '5',
    });
    edges.push({ id: `e-root-${id}`, fromNode: 'root', fromSide: 'right', toNode: id, toSide: 'left' });
    nodes.push({
      id: `${id}-c`,
      type: 'text',
      text: `노트 ${count}개`,
      x: NODE_W + X_GAP,
      y: i * (NODE_H + Y_GAP),
      width: 160,
      height: 60,
      color: '3',
    });
    edges.push({ id: `e-${id}-c`, fromNode: id, fromSide: 'right', toNode: `${id}-c`, toSide: 'left' });
  });
  return { nodes, edges };
}

function cmdCanvas(vaultDir, args) {
  const notes = loadNotes(vaultDir);
  // 빈 문자열도 유효한 접두어이므로 truthy 검사를 쓰면 안 된다.
  const prefix = args['path-prefix'] !== undefined && args['path-prefix'] !== true
    ? String(args['path-prefix'])
    : (loadRc(vaultDir).canvasPathPrefix ?? '');
  const mapsDir = path.join(vaultDir, '90-Maps');
  fs.mkdirSync(mapsDir, { recursive: true });

  const only = args.topic && args.topic !== true ? String(args.topic) : null;
  const topics = only
    ? [only]
    : [...new Set(notes.filter((n) => n.topic).map((n) => n.topic))].sort();

  const written = [];
  for (const topic of topics) {
    const canvas = canvasForTopic(notes, topic, prefix);
    const file = path.join(mapsDir, `${slugify(topic)}.canvas`);
    fs.writeFileSync(file, `${JSON.stringify(canvas, null, 2)}\n`, 'utf8');
    written.push(`${path.relative(process.cwd(), file)} (노드 ${canvas.nodes.length})`);
  }

  if (!only) {
    const file = path.join(mapsDir, '_전체지도.canvas');
    const canvas = overviewCanvas(notes, prefix);
    fs.writeFileSync(file, `${JSON.stringify(canvas, null, 2)}\n`, 'utf8');
    written.push(`${path.relative(process.cwd(), file)} (주제 ${canvas.nodes.filter((n) => n.type === 'file').length})`);
  }

  process.stdout.write(`${written.join('\n')}\n`);
}

// ----------------------------------------------------------- cmd: index

function cmdIndex(vaultDir) {
  const notes = loadNotes(vaultDir);
  const topics = [...new Set(notes.filter((n) => n.topic).map((n) => n.topic))].sort();
  const questions = notes.filter((n) => n.type === 'question');
  const sessions = notes
    .filter((n) => n.type === 'session')
    .sort((a, b) => String(b.data.created || '').localeCompare(String(a.data.created || '')))
    .slice(0, 10);

  const lines = [
    serializeFrontmatter({ title: '대시보드', type: 'index', updated: stamp().datetime }),
    '',
    '# 🧠 대시보드',
    '',
    '> `node tools/vault.mjs index` 로 자동 생성됩니다. 직접 고치지 마세요.',
    '',
    `- 주제 ${topics.length}개 · 노트 ${notes.filter((n) => n.type === 'note').length}개 · 열린 질문 ${questions.length}개 · 세션 ${notes.filter((n) => n.type === 'session').length}개`,
    '',
    '## 전체 지도',
    '',
    '![[_전체지도.canvas]]',
    '',
    '## 주제',
    '',
  ];

  for (const topic of topics) {
    const inTopic = notes.filter((n) => n.topic === topic && n.type !== 'topic');
    const seeds = inTopic.filter((n) => n.data.status === 'seed').length;
    lines.push(`- [[${topic}]] — 노트 ${inTopic.length}개 (씨앗 ${seeds}개) · [[${slugify(topic)}.canvas|지도]]`);
  }

  const inbox = notes.filter((n) => n.type === 'inbox');
  if (inbox.length) {
    lines.push('', '## 미분류 (주제 정해서 옮길 것)', '');
    for (const n of inbox) lines.push(`- [[${n.title}]]`);
  }

  lines.push('', '## 열린 질문', '');
  if (questions.length === 0) lines.push('- (없음)');
  for (const q of questions) {
    lines.push(`- [[${q.title}]] — ${q.topic || '미분류'}`);
  }

  lines.push('', '## 최근 세션', '');
  if (sessions.length === 0) lines.push('- (없음)');
  for (const s of sessions) {
    const link = s.data.notion ? ` · [노션](${s.data.notion})` : '';
    lines.push(`- ${s.data.created || ''} [[${s.title}]]${link}`);
  }
  lines.push('');

  const file = path.join(vaultDir, '00-대시보드.md');
  fs.writeFileSync(file, `${lines.join('\n')}`, 'utf8');
  process.stdout.write(`${path.relative(process.cwd(), file)}\n`);
}

// ----------------------------------------------------------- cmd: check

function cmdCheck(vaultDir) {
  const notes = loadNotes(vaultDir);
  const titles = new Set(notes.flatMap((n) => [n.title, ...n.aliases]));
  const fileNames = new Set(notes.map((n) => path.basename(n.file, '.md')));
  const problems = [];

  for (const note of notes) {
    if (!note.data.title) problems.push(`${note.rel}: title 없음`);
    if (!note.data.type) problems.push(`${note.rel}: type 없음`);
    if (note.data.status && !STATUSES.includes(note.data.status)) {
      problems.push(`${note.rel}: 알 수 없는 status "${note.data.status}"`);
    }
    for (const parent of note.parents) {
      if (!titles.has(parent)) problems.push(`${note.rel}: 존재하지 않는 상위 노트 "${parent}"`);
    }
    if ((note.type === 'note' || note.type === 'question') && !note.topic) {
      problems.push(`${note.rel}: topic 없음`);
    }
    for (const match of note.body.matchAll(/\[\[([^\]|#^]+)/g)) {
      const target = match[1].trim();
      if (!target || target.endsWith('.canvas')) continue;
      const bare = target.split('/').pop().replace(/\.md$/, '');
      if (!titles.has(bare) && !fileNames.has(bare)) {
        problems.push(`${note.rel}: 깨진 링크 [[${target}]]`);
      }
    }
  }

  const topicsUsed = new Set(notes.filter((n) => n.topic).map((n) => n.topic));
  const hubs = new Set(notes.filter((n) => n.type === 'topic').map((n) => n.title));
  for (const topic of topicsUsed) {
    if (!hubs.has(topic)) problems.push(`주제 허브 노트 없음: "${topic}" → new --type topic --title "${topic}"`);
  }

  if (problems.length === 0) {
    process.stdout.write(`OK — 노트 ${notes.length}개, 문제 없음\n`);
    return;
  }
  process.stdout.write(`${problems.length}개 문제:\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
  process.exitCode = 1;
}

// ------------------------------------------------------------ cmd: list

function cmdList(vaultDir, args) {
  const notes = loadNotes(vaultDir);
  const topic = args.topic && args.topic !== true ? String(args.topic) : null;
  const type = args.type && args.type !== true ? String(args.type) : null;
  const rows = notes
    .filter((n) => (!topic || n.topic === topic) && (!type || n.type === type))
    .sort((a, b) => String(a.rel).localeCompare(String(b.rel)));
  for (const n of rows) {
    process.stdout.write(`${n.type.padEnd(8)} ${(n.topic || '-').padEnd(16)} ${n.title}  →  ${n.rel}\n`);
  }
  process.stdout.write(`\n총 ${rows.length}개\n`);
}

// ----------------------------------------------------------- cmd: topics

function topicStats(notes, hub) {
  const inTopic = notes.filter((n) => n.topic === hub.title && n.type !== 'topic');
  return {
    notes: inTopic.filter((n) => n.type === 'note').length,
    questions: inTopic.filter((n) => n.type === 'question').length,
    sessions: inTopic.filter((n) => n.type === 'session').length,
  };
}

function cmdTopics(vaultDir) {
  const notes = loadNotes(vaultDir);
  const hubs = notes.filter((n) => n.type === 'topic').sort((a, b) => a.title.localeCompare(b.title));
  for (const hub of hubs) {
    const st = topicStats(notes, hub);
    const alias = hub.aliases.length ? ` (별칭: ${hub.aliases.join(', ')})` : '';
    process.stdout.write(`${hub.title}${alias} — 노트 ${st.notes} · 질문 ${st.questions} · 세션 ${st.sessions}\n`);
    if (hub.data.summary) process.stdout.write(`    ${hub.data.summary}\n`);
  }
  process.stdout.write(`\n주제 ${hubs.length}개\n`);
}

// ------------------------------------------------------------ cmd: match

/** 한글은 형태소 분석 없이 비교하기 어려워서 글자 2-gram 으로 겹침을 잰다. */
function bigrams(text) {
  const out = new Set();
  for (const word of String(text).normalize('NFC').toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (word.length === 1) out.add(word);
    for (let i = 0; i < word.length - 1; i += 1) out.add(word.slice(i, i + 2));
  }
  return out;
}

function overlap(query, target) {
  if (query.size === 0 || target.size === 0) return 0;
  let hit = 0;
  for (const g of query) if (target.has(g)) hit += 1;
  return hit / query.size;
}

function scoreTopics(notes, text) {
  const query = bigrams(text);
  return notes
    .filter((n) => n.type === 'topic')
    .map((hub) => {
      const names = bigrams([hub.title, ...hub.aliases].join(' '));
      const members = notes.filter((n) => n.topic === hub.title && n.type !== 'topic');
      const context = bigrams([
        hub.data.summary || '',
        ...asArray(hub.data.tags),
        ...members.flatMap((n) => [n.title, n.data.summary || '', ...asArray(n.data.tags)]),
      ].join(' '));
      // 주제 이름과 겹치는 게 가장 강한 신호, 그다음이 그 주제 안의 노트 제목·요약.
      const score = overlap(query, names) * 0.6 + overlap(query, context) * 0.4;
      return { hub, score };
    })
    .sort((a, b) => b.score - a.score);
}

function cmdMatch(vaultDir, args) {
  const text = readTextArg(args);
  if (!text) fail('--text 또는 --text-file 이 필요합니다.');
  const ranked = scoreTopics(loadNotes(vaultDir), text).slice(0, Number(args.limit) || 5);
  if (ranked.length === 0) {
    process.stdout.write('주제가 하나도 없습니다. 새 주제로 기록하세요.\n');
    return;
  }
  for (const { hub, score } of ranked) {
    process.stdout.write(`${score.toFixed(2)}  ${hub.title}${hub.data.summary ? ` — ${hub.data.summary}` : ''}\n`);
  }
  process.stdout.write('\n점수는 글자 겹침 기준의 참고값입니다. 최종 판단은 내용을 읽고 내립니다.\n');
}

// ---------------------------------------------------------- cmd: capture

function readTextArg(args) {
  if (args['text-file'] && args['text-file'] !== true) return fs.readFileSync(String(args['text-file']), 'utf8').trim();
  if (args.text && args.text !== true) return String(args.text).replace(/\\n/g, '\n').trim();
  return '';
}

/** 허브 노트의 `## 제목` 섹션 끝에 한 줄을 덧붙인다. 이미 있으면 건너뛴다. */
function appendToSection(note, heading, line) {
  if (note.body.includes(line)) return false;
  const lines = note.body.split('\n');
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start === -1) {
    note.body = `${note.body.replace(/\n+$/, '')}\n\n## ${heading}\n\n${line}\n`;
    return true;
  }
  let end = start + 1;
  while (end < lines.length && !/^#{1,2} /.test(lines[end]) && lines[end].trim() !== '---') end += 1;
  let insertAt = end;
  while (insertAt > start + 1 && lines[insertAt - 1].trim() === '') insertAt -= 1;
  const block = insertAt === start + 1 ? ['', line] : [line];
  lines.splice(insertAt, 0, ...block);
  note.body = lines.join('\n');
  return true;
}

function captureBody(type, data, text) {
  const quoted = text ? text.split('\n').map((l) => `> ${l}`.trimEnd()).join('\n') : '> (원문 없음)';
  const head = [`# ${data.title}`, ''];
  if (data.topic) head.push(`- 주제: [[${data.topic}]]`);
  if (data.parents.length) head.push(`- 상위: ${data.parents.map((p) => `[[${p}]]`).join(' · ')}`);
  head.push('');
  const lead = data.summary ? [data.summary, ''] : [];
  const core = type === 'question'
    ? ['## 왜 이게 궁금한가', '', ...lead, '## 지금까지의 가설', '']
    : ['## 핵심', '', ...lead, '## 근거 / 맥락', '', '## 반론 / 빈 곳', ''];
  return [...head, ...core, '## 말한 그대로', '', quoted, ''].join('\n');
}

function cmdCapture(vaultDir, args) {
  const title = args.title && args.title !== true ? String(args.title) : '';
  if (!title) fail('--title 은 필수입니다. 서술문으로 짓습니다.');
  const text = readTextArg(args);
  const type = args.type && args.type !== true ? String(args.type) : 'note';
  if (!['note', 'question'].includes(type)) fail('capture 의 --type 은 note|question 만 됩니다.');

  const notes = loadNotes(vaultDir);
  const now = stamp();
  const requested = args.topic && args.topic !== true ? String(args.topic) : '';

  // 주제를 못 정했으면 미분류함으로. 나중에 옮긴다.
  if (!requested) {
    const file = targetPath(vaultDir, 'inbox', '', title);
    if (fs.existsSync(file) && !args.force) fail(`이미 존재합니다: ${file} (덮어쓰려면 --force)`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const data = {
      title, type: 'inbox', id: now.id, created: now.datetime, updated: now.datetime,
      status: 'seed', confidence: 'low', parents: [], tags: splitList(args.tags),
      summary: args.summary && args.summary !== true ? String(args.summary) : '',
    };
    saveNote({ file, data, body: captureBody('note', data, text) });
    process.stdout.write(`주제: (미분류)\n노트: ${path.relative(process.cwd(), file)}\n`);
    return;
  }

  let hub = resolveTopic(notes, requested);
  let created = false;
  if (!hub) {
    const hubFile = targetPath(vaultDir, 'topic', '', requested);
    const hubData = {
      title: requested, type: 'topic', topic: requested, id: now.id,
      created: now.datetime, updated: now.datetime, status: 'seed', confidence: 'mid',
      aliases: splitList(args.alias),
      summary: args['topic-summary'] && args['topic-summary'] !== true ? String(args['topic-summary']) : '',
    };
    let hubBody = defaultBody('topic', { ...hubData, parents: [] });
    if (hubData.summary) hubBody = hubBody.replace('## 한 줄 정의\n', `## 한 줄 정의\n\n${hubData.summary}\n`);
    fs.mkdirSync(path.dirname(hubFile), { recursive: true });
    saveNote({ file: hubFile, data: hubData, body: hubBody });
    hub = { file: hubFile, data: hubData, body: hubBody, title: requested, aliases: hubData.aliases };
    created = true;
  }

  const topic = hub.title;
  const file = targetPath(vaultDir, type, topic, title);
  if (fs.existsSync(file) && !args.force) fail(`이미 존재합니다: ${file} (덮어쓰려면 --force)`);

  const allNotes = created ? loadNotes(vaultDir) : notes;
  const parents = splitList(args.parent).map((p) => findByTitle(allNotes, p)?.title || p);
  if (parents.length === 0) parents.push(topic);

  const data = {
    title, type, topic, id: now.id, created: now.datetime, updated: now.datetime,
    status: 'seed',
    confidence: args.confidence && args.confidence !== true ? String(args.confidence) : 'mid',
    parents,
    tags: splitList(args.tags),
    session: args.session && args.session !== true ? String(args.session) : '',
    summary: args.summary && args.summary !== true ? String(args.summary) : '',
  };
  if (!CONFIDENCES.includes(data.confidence)) fail(`--confidence 는 ${CONFIDENCES.join('|')} 중 하나여야 합니다.`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  saveNote({ file, data, body: captureBody(type, data, text) });

  // 허브 노트에도 링크를 걸어 Obsidian 에서 주제만 열어도 가지가 보이게 한다.
  const section = type === 'question' ? '열린 질문' : '하위 생각';
  if (appendToSection(hub, section, `- [[${title}]]`)) {
    hub.data.updated = now.datetime;
    saveNote(hub);
  }

  process.stdout.write(`주제: ${topic} (${created ? '새로 만듦' : '기존'})\n`);
  process.stdout.write(`노트: ${path.relative(process.cwd(), file)}\n`);
}

// ----------------------------------------------------------- cmd: search

function cmdSearch(vaultDir, args) {
  const q = args.q && args.q !== true ? String(args.q).normalize('NFC').toLowerCase() : '';
  if (!q) fail('--q 가 필요합니다.');
  const rows = loadNotes(vaultDir).filter((n) => [n.title, n.data.summary || '', n.body, ...n.aliases]
    .some((field) => String(field).normalize('NFC').toLowerCase().includes(q)));
  for (const n of rows) {
    const line = n.body.split('\n').find((l) => l.normalize('NFC').toLowerCase().includes(q));
    process.stdout.write(`${n.type.padEnd(8)} ${(n.topic || '-').padEnd(16)} ${n.title}  →  ${n.rel}\n`);
    if (line) process.stdout.write(`         ${line.trim().slice(0, 120)}\n`);
  }
  process.stdout.write(`\n총 ${rows.length}개\n`);
}

// ----------------------------------------------------------- cmd: export

/**
 * 주제 하나를 통째로 한 장의 마크다운으로 묶는다.
 * 새 프로젝트를 시작할 때 Claude 에게 이 파일 하나만 건네면 그 주제의 생각 전체가 맥락으로 들어간다.
 */
function cmdExport(vaultDir, args) {
  const notes = loadNotes(vaultDir);
  const name = args.topic && args.topic !== true ? String(args.topic) : '';
  if (!name) fail('--topic 이 필요합니다.');
  const hub = resolveTopic(notes, name);
  if (!hub) fail(`주제를 찾을 수 없습니다: ${name} (node tools/vault.mjs topics 로 확인)`);

  const { roots, children } = buildTree(notes, hub.title);
  // 노트 본문의 ## 제목은 묶음 안에서 #### 로 내려 ### 노트 제목 아래에 들어가게 한다.
  const strip = (body) => body.trimStart().replace(/^# .*\n+/, '').trim().replace(/^(#{2,4}) /gm, '$1## ');
  const out = [
    `# ${hub.title} — 생각 묶음`,
    '',
    `> ${stamp().datetime} 에 \`node tools/vault.mjs export\` 로 뽑았습니다. 원본은 vault/ 에 있습니다.`,
    '',
  ];
  if (hub.data.summary) out.push(`**한 줄 정의:** ${hub.data.summary}`, '');

  out.push('## 구조', '');
  const walkTree = (note, depth) => {
    const mark = note.type === 'question' ? '(질문) ' : '';
    out.push(`${'  '.repeat(depth)}- ${mark}${note.title}`);
    for (const child of children.get(note.title) || []) walkTree(child, depth + 1);
  };
  for (const root of roots) walkTree(root, 0);
  out.push('');

  const members = notes.filter((n) => n.topic === hub.title && n.type !== 'topic' && n.type !== 'session');
  for (const [label, type] of [['생각', 'note'], ['열린 질문', 'question']]) {
    const group = members.filter((n) => n.type === type);
    if (group.length === 0) continue;
    out.push(`## ${label}`, '');
    for (const n of group) {
      out.push(`### ${n.title}`, '');
      out.push(`상태 ${n.data.status || '-'} · 확신 ${n.data.confidence || '-'} · ${n.data.created || ''}`, '');
      out.push(strip(n.body), '');
    }
  }

  const sessions = notes.filter((n) => n.type === 'session' && n.topic === hub.title);
  if (sessions.length) {
    out.push('## 세션 기록', '');
    for (const s of sessions) out.push(`- ${s.data.created || ''} ${s.title}${s.data.notion ? ` (노션: ${s.data.notion})` : ''}`);
    out.push('');
  }

  const text = `${out.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
  if (args.out && args.out !== true) {
    fs.mkdirSync(path.dirname(String(args.out)), { recursive: true });
    fs.writeFileSync(String(args.out), text, 'utf8');
    process.stdout.write(`${args.out}\n`);
  } else {
    process.stdout.write(text);
  }
}

// ---------------------------------------------------------------- entry

function fail(message) {
  process.stderr.write(`오류: ${message}\n`);
  process.exit(1);
}

function usage() {
  process.stdout.write(`vault.mjs — Obsidian 볼트 관리

  capture 빠른 기록  --title "서술문" [--topic "주제"] [--text "원문" | --text-file] [--type note|question --summary --parent --tags --alias --topic-summary]
          주제가 있으면 거기에, 없으면 주제 허브를 만들고, --topic 을 빼면 00-Inbox 로
  topics  주제 목록   (별칭·노트 수·한 줄 정의)
  match   주제 후보   --text "..." | --text-file  (글자 겹침 점수)
  search  전문 검색   --q "키워드"
  export  주제 묶음   --topic "주제" [--out 파일]  새 프로젝트에 건넬 한 장짜리 마크다운
  new     노트 생성   --type session|topic|note|question|inbox --title "..." [--topic --parent --alias --tags --status --confidence --summary --notion --session --body --body-file --force]
  link    관계 추가   --from "자식" --to "부모"
  canvas  마인드맵    [--topic "주제"] [--path-prefix "vault/"]
  index   대시보드 재생성
  check   프론트매터/링크 검증
  list    노트 목록   [--topic] [--type]

공통: --vault <경로> (기본 ${VAULT_DEFAULT})
`);
}

function main() {
  const [, , command, ...rest] = process.argv;
  const args = parseArgs(rest);
  const vaultDir = args.vault && args.vault !== true ? String(args.vault) : VAULT_DEFAULT;

  if (!command || command === 'help' || args.help) return usage();
  if (!fs.existsSync(vaultDir)) fail(`볼트를 찾을 수 없습니다: ${vaultDir}`);

  switch (command) {
    case 'new': return cmdNew(vaultDir, args);
    case 'link': return cmdLink(vaultDir, args);
    case 'canvas': return cmdCanvas(vaultDir, args);
    case 'index': return cmdIndex(vaultDir);
    case 'check': return cmdCheck(vaultDir);
    case 'list': return cmdList(vaultDir, args);
    case 'capture': return cmdCapture(vaultDir, args);
    case 'topics': return cmdTopics(vaultDir);
    case 'match': return cmdMatch(vaultDir, args);
    case 'search': return cmdSearch(vaultDir, args);
    case 'export': return cmdExport(vaultDir, args);
    default: return fail(`알 수 없는 명령: ${command}`);
  }
}

main();
