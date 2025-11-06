// ====== 永続化キー ======
const STORAGE_KEY_TASKS = "myops.tasks.v1";
const STORAGE_KEY_CATS  = "myops.categories.v1";
const STORAGE_KEY_MAP_NODES = "myops.map.nodes.v1";
const STORAGE_KEY_MAP_EDGES = "myops.map.edges.v1";
const STORAGE_KEY_MAP_VIEW  = "myops.map.view.v1";
const STORAGE_KEY_MAP_MEMOS = "myops.map.memos.v1";

// ====== 要素参照（共通） ======
const tabList = document.getElementById("tabList");
const tabMap  = document.getElementById("tabMap");
const listView = document.getElementById("listView");
const mapView  = document.getElementById("mapView");

// ====== リスト側の要素 ======
const input = document.getElementById("taskInput");
const addBtn = document.getElementById("addBtn");
const list = document.getElementById("taskList");

const catSelect = document.getElementById("categorySelect");
const newCatInput = document.getElementById("newCategoryInput");
const addCatBtn = document.getElementById("addCategoryBtn");

const filterSelect = document.getElementById("filterSelect");
const openOnlyChk = document.getElementById("openOnlyChk");

const exportBtn = document.getElementById("exportBtn");
const clearDoneBtn = document.getElementById("clearDoneBtn");

// ====== マップ側の要素 ======
const newNodeInput = document.getElementById("newNodeInput");
const addNodeBtn   = document.getElementById("addNodeBtn");
const taskToNodeSelect = document.getElementById("taskToNodeSelect");
const addFromTaskBtn = document.getElementById("addFromTaskBtn");

const memoAddBtn  = document.getElementById("memoAddBtn");
const linkModeBtn = document.getElementById("linkModeBtn");

const sizePlusBtn  = document.getElementById("sizePlusBtn");
const sizeMinusBtn = document.getElementById("sizeMinusBtn");
const deleteSelBtn = document.getElementById("deleteSelBtn");

const zoomInBtn    = document.getElementById("zoomInBtn");
const zoomOutBtn   = document.getElementById("zoomOutBtn");
const resetViewBtn = document.getElementById("resetViewBtn");

const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");
const canvasWrap = document.getElementById("canvasWrap");
const nodeEditInput = document.getElementById("nodeEditInput");

// ====== 状態 ======
let tasks = loadTasks();
let categories = loadCategories();
if (categories.length === 0) {
  categories = ["緊急", "重要", "通常", "VMD", "在庫", "シフト"];
  saveCategories();
}
refreshCategoryUIs();
renderTasks();

// --- Map state ---
let nodes = loadMapNodes();     // {id, title, x, y, w, h}
let edges = loadMapEdges();     // {from, to}
let memos = loadMemos();        // {id, text, x, y, w, h}
let view  = loadMapView();      // {tx, ty, scale}

let linkMode = false;
let linkStartNodeId = null;
let selected = { type: null, id: null };  // {type: "node"|"memo", id}

// ノード/メモ 初期サイズ
const NODE_W0 = 180, NODE_H0 = 54;
const MEMO_W0 = 220, MEMO_H0 = 120;

// リサイズ判定のマージン（ワールド座標）
const RESIZE_M = 8;

// ====== イベント（リスト） ======
addBtn.addEventListener("click", onAddTask);
addCatBtn.addEventListener("click", onAddCategory);
filterSelect.addEventListener("change", renderTasks);
openOnlyChk.addEventListener("change", renderTasks);
input.addEventListener("keydown", e => { if (e.key === "Enter") onAddTask(); });
newCatInput.addEventListener("keydown", e => { if (e.key === "Enter") onAddCategory(); });

exportBtn.addEventListener("click", exportCSV);
clearDoneBtn.addEventListener("click", clearDone);

// ====== タブ切替 ======
tabList.addEventListener("click", () => switchView("list"));
tabMap.addEventListener("click", () => switchView("map"));
function switchView(which){
  hideTitleEditor();
  if (which === "list") {
    listView.classList.remove("hidden");
    mapView.classList.add("hidden");
    tabList.classList.add("active");
    tabMap.classList.remove("active");
  } else {
    listView.classList.add("hidden");
    mapView.classList.remove("hidden");
    tabList.classList.remove("active");
    tabMap.classList.add("active");
    refreshTaskSelectForMap();
    draw();
  }
}

// ====== 関数（リスト） ======
function onAddTask() {
  const title = input.value.trim();
  const cat = catSelect.value.trim();
  if (!title) return;
  const t = {
    id: crypto.randomUUID(),
    title,
    category: cat || "",
    done: false,
    createdAt: Date.now()
  };
  tasks.unshift(t);
  saveTasks();
  input.value = "";
  renderTasks();
  refreshTaskSelectForMap();
}

function onAddCategory() {
  const name = newCatInput.value.trim();
  if (!name) return;
  if (!categories.includes(name)) {
    categories.push(name);
    saveCategories();
    refreshCategoryUIs();
  }
  catSelect.value = name;
  newCatInput.value = "";
}

function toggleDone(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  t.done = !t.done;
  saveTasks();
  renderTasks();
}

function removeTask(id) {
  tasks = tasks.filter(x => x.id !== id);
  saveTasks();
  renderTasks();
}

function clearDone() {
  tasks = tasks.filter(x => !x.done);
  saveTasks();
  renderTasks();
}

function renderTasks() {
  const f = filterSelect.value;
  const onlyOpen = openOnlyChk.checked;

  list.innerHTML = "";
  tasks
    .filter(t => (f === "all" || t.category === f))
    .filter(t => (!onlyOpen || !t.done))
    .forEach(t => list.appendChild(rowFor(t)));
}

function rowFor(t) {
  const li = document.createElement("li");
  li.className = "task" + (t.done ? " done" : "");

  const chk = document.createElement("input");
  chk.type = "checkbox";
  chk.checked = t.done;
  chk.onchange = () => toggleDone(t.id);

  const body = document.createElement("div");
  const title = document.createElement("div");
  title.className = "title";
  title.textContent = t.title;

  const meta = document.createElement("div");
  meta.className = "meta";
  const dt = new Date(t.createdAt);
  const time = `${dt.getFullYear()}/${pad(dt.getMonth()+1)}/${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  meta.textContent = time;

  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = t.category || "未分類";

  body.appendChild(title);
  body.appendChild(meta);
  body.appendChild(tag);

  const actions = document.createElement("div");
  actions.className = "actions";
  const del = document.createElement("button");
  del.textContent = "削除";
  del.onclick = () => removeTask(t.id);
  actions.appendChild(del);

  li.appendChild(chk);
  li.appendChild(body);
  li.appendChild(actions);
  return li;
}

function refreshCategoryUIs() {
  catSelect.innerHTML = `<option value="">カテゴリ</option>`;
  for (const c of categories) {
    const opt = document.createElement("option");
    opt.value = c; opt.textContent = c;
    catSelect.appendChild(opt);
  }
  filterSelect.innerHTML = `<option value="all">すべて</option>`;
  for (const c of categories) {
    const opt = document.createElement("option");
    opt.value = c; opt.textContent = c;
    filterSelect.appendChild(opt);
  }
}

function exportCSV() {
  const header = ["id","title","category","done","createdAt"];
  const rows = tasks.map(t => [
    t.id,
    csvEscape(t.title),
    csvEscape(t.category),
    t.done ? "1" : "0",
    new Date(t.createdAt).toISOString()
  ]);
  const csv = [header.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "myops_tasks.csv";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ====== 永続化（リスト） ======
function loadTasks(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY_TASKS) || "[]"); } catch { return []; } }
function saveTasks(){ localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks)); }
function loadCategories(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY_CATS) || "[]"); } catch { return []; } }
function saveCategories(){ localStorage.setItem(STORAGE_KEY_CATS, JSON.stringify(categories)); }

// ====== Utils（共通） ======
function pad(n){ return String(n).padStart(2,"0"); }
function csvEscape(s){
  if (s == null) return "";
  const needQuote = /[",\n]/.test(s);
  const body = String(s).replace(/"/g,'""');
  return needQuote ? `"${body}"` : body;
}

// ======================================================
//                ▼▼▼ ここからマップ機能 ▼▼▼
// ======================================================

// タスクを選択肢に反映
function refreshTaskSelectForMap(){
  taskToNodeSelect.innerHTML = `<option value="">タスクから追加</option>`;
  for (const t of tasks) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = `[${t.category || "未分類"}] ${t.title}`;
    taskToNodeSelect.appendChild(opt);
  }
}

// ノード追加（自由入力）
addNodeBtn.addEventListener("click", () => {
  const title = newNodeInput.value.trim();
  if (!title) return;
  addNode(title, randomX(), randomY(), NODE_W0, NODE_H0);
  newNodeInput.value = "";
  draw();
});

// タスクからノード追加
addFromTaskBtn.addEventListener("click", () => {
  const id = taskToNodeSelect.value;
  if (!id) return;
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  addNode(t.title, randomX(), randomY(), NODE_W0, NODE_H0);
  taskToNodeSelect.value = "";
  draw();
});

// メモ追加
memoAddBtn.addEventListener("click", () => {
  const m = { id: crypto.randomUUID(), text: "メモ", x: randomX(), y: randomY(), w: MEMO_W0, h: MEMO_H0 };
  memos.push(m); saveMemos(); draw();
});

// リンクモード切替
linkModeBtn.addEventListener("click", () => {
  linkMode = !linkMode;
  linkStartNodeId = null;
  linkModeBtn.textContent = `リンクモード：${linkMode ? "ON" : "OFF"}`;
  linkModeBtn.classList.toggle("primary", linkMode);
});

// サイズ±（ボタン）— 既存選択に適用
sizePlusBtn.addEventListener("click", () => sizeAdjust(+20, +12));
sizeMinusBtn.addEventListener("click", () => sizeAdjust(-20, -12));
function sizeAdjust(dw, dh){
  if (!selected.id) return;
  if (selected.type === "node") {
    const n = nodes.find(n => n.id === selected.id); if (!n) return;
    n.w = clamp(n.w + dw, 80, 800);
    n.h = clamp(n.h + dh, 32, 500);
    saveMapNodes(); draw();
  } else if (selected.type === "memo") {
    const m = memos.find(m => m.id === selected.id); if (!m) return;
    m.w = clamp(m.w + dw, 80, 1000);
    m.h = clamp(m.h + dh, 60, 700);
    saveMemos(); draw();
  }
}

// 選択削除
deleteSelBtn.addEventListener("click", () => {
  if (!selected.id) return;
  if (selected.type === "node") {
    edges = edges.filter(e => e.from !== selected.id && e.to !== selected.id);
    nodes = nodes.filter(n => n.id !== selected.id);
    saveMapNodes(); saveMapEdges();
  } else if (selected.type === "memo") {
    memos = memos.filter(m => m.id !== selected.id);
    saveMemos();
  }
  selected = {type:null, id:null};
  draw();
});

// === マップのデータ操作 ===
function addNode(title, x, y, w, h){
  const n = { id: crypto.randomUUID(), title, x, y, w, h };
  nodes.push(n); saveMapNodes();
}
function addEdge(aId, bId){
  if (aId === bId) return;
  if (edges.some(e => (e.from===aId && e.to===bId) || (e.from===bId && e.to===aId))) return;
  edges.push({from: aId, to: bId});
  saveMapEdges();
}

// === マップ描画 ===
function draw(){
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);

  ctx.save();
  ctx.translate(view.tx, view.ty);
  ctx.scale(view.scale, view.scale);

  // edges（先に）
  ctx.lineWidth = 2 / view.scale;
  ctx.strokeStyle = "#9ca3af";
  edges.forEach(e => {
    const a = nodes.find(n => n.id === e.from);
    const b = nodes.find(n => n.id === e.to);
    if (!a || !b) return;
    const ax = a.x + a.w/2, ay = a.y + a.h/2;
    const bx = b.x + b.w/2, by = b.y + b.h/2;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  });

  // memos
  memos.forEach(m => drawMemo(m));

  // nodes
  nodes.forEach(n => drawNode(n));

  ctx.restore();

  // タイトル編集中にパン/ズームされた場合は閉じる
  // （位置保証が難しいため）
}

function drawNode(n){
  ctx.save();
  const isSel = (selected.type==="node" && selected.id===n.id);

  // 背景
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = isSel ? getCSS("--sel") || "#60a5fa" : "#d1d5db";
  ctx.lineWidth = isSel ? 2 / view.scale : 1 / view.scale;

  roundRect(ctx, n.x, n.y, n.w, n.h, 10 / view.scale);
  ctx.fill();
  ctx.stroke();

  // タイトル
  ctx.fillStyle = "#111827";
  ctx.font = `${14 / view.scale}px system-ui, -apple-system, Segoe UI`;
  ctx.textBaseline = "middle";
  const pad = 10 / view.scale;
  const text = truncate(n.title, n.w - pad*2, ctx);
  ctx.fillText(text, n.x + pad, n.y + n.h/2);

  // 選択中のみリサイズハンドル描画（四隅＋辺の中央）
  if (isSel) {
    const hs = 6 / view.scale; // handle size
    const pts = handlePoints(n);
    ctx.fillStyle = getCSS("--sel") || "#60a5fa";
    pts.forEach(p => {
      ctx.fillRect(p.x - hs, p.y - hs, hs*2, hs*2);
    });
  }

  ctx.restore();
}

function drawMemo(m){
  ctx.save();
  const isSel = (selected.type==="memo" && selected.id===m.id);

  ctx.fillStyle = getCSS("--memo") || "#fffbe6";
  ctx.strokeStyle = isSel ? getCSS("--sel") || "#60a5fa" : "#eab308";
  ctx.lineWidth = isSel ? 2 / view.scale : 1 / view.scale;

  roundRect(ctx, m.x, m.y, m.w, m.h, 8 / view.scale);
  ctx.fill(); ctx.stroke();

  // テキスト
  ctx.fillStyle = "#1f2937";
  ctx.font = `${14 / view.scale}px system-ui, -apple-system, Segoe UI`;
  ctx.textBaseline = "top";
  const pad = 8 / view.scale;
  wrapText(m.text, m.x + pad, m.y + pad, m.w - pad*2, 18 / view.scale);

  ctx.restore();
}

function roundRect(ctx, x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y,   x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x,   y+h, r);
  ctx.arcTo(x,   y+h, x,   y,   r);
  ctx.arcTo(x,   y,   x+w, y,   r);
  ctx.closePath();
}

function truncate(s, maxWidth, ctx){
  if (ctx.measureText(s).width <= maxWidth) return s;
  let lo=0, hi=s.length;
  while (lo < hi){
    const mid = Math.floor((lo+hi)/2);
    const sub = s.slice(0, mid) + "…";
    if (ctx.measureText(sub).width <= maxWidth) lo = mid + 1;
    else hi = mid;
  }
  return s.slice(0, lo-1) + "…";
}

function wrapText(text, x, y, maxWidth, lineHeight){
  const words = String(text ?? "").split(/\s+/);
  let line="", ty=y;
  for (let w of words){
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, ty); ty += lineHeight; line = w;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, ty);
}

// === CSS var取得 ===
function getCSS(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

// === 座標変換 ===
function toWorld(px, py){ return { x: (px - view.tx) / view.scale, y: (py - view.ty) / view.scale }; }
function toScreen(wx, wy){ return { px: wx * view.scale + view.tx, py: wy * view.scale + view.ty }; }

// === リサイズヒット判定 ===
function hitResizeDir(n, wx, wy){
  const near = (a,b) => Math.abs(a-b) <= RESIZE_M;
  const inX = wx >= n.x && wx <= n.x + n.w;
  const inY = wy >= n.y && wy <= n.y + n.h;

  const nearL = near(wx, n.x), nearR = near(wx, n.x+n.w);
  const nearT = near(wy, n.y), nearB = near(wy, n.y+n.h);

  // 角優先
  if (nearL && nearT) return "nw";
  if (nearR && nearT) return "ne";
  if (nearL && nearB) return "sw";
  if (nearR && nearB) return "se";
  // 辺
  if (nearL && inY) return "w";
  if (nearR && inY) return "e";
  if (nearT && inX) return "n";
  if (nearB && inX) return "s";
  return null;
}

function handlePoints(n){
  const cx = n.x + n.w/2, cy = n.y + n.h/2;
  return [
    {x:n.x, y:n.y}, {x:n.x+n.w, y:n.y}, {x:n.x, y:n.y+n.h}, {x:n.x+n.w, y:n.y+n.h},
    {x:cx, y:n.y}, {x:cx, y:n.y+n.h}, {x:n.x, y:cy}, {x:n.x+n.w, y:cy}
  ];
}

// === ドラッグ（ノード/メモ／リサイズ／パン） ===
let draggingNode = null;
let draggingMemo = null;
let resizingNode = null;
let resizeDir = null;
let dragOffset = {x:0,y:0};
let startBox = null; // {x,y,w,h} for resize
let panning = false;
let lastPointer = {x:0,y:0};

canvas.addEventListener("pointerdown", (e) => {
  hideTitleEditor();
  canvas.setPointerCapture(e.pointerId);
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  const {x:wx, y:wy} = toWorld(px, py);

  // メモ優先
  const m = hitMemo(wx, wy);
  if (m) {
    selected = {type:"memo", id:m.id};
    draggingMemo = m;
    dragOffset.x = wx - m.x; dragOffset.y = wy - m.y;
    draw(); return;
  }

  // ノード
  const n = hitNode(wx, wy);
  if (n) {
    selected = {type:"node", id:n.id};

    // リンクモード
    if (linkMode) {
      if (!linkStartNodeId) linkStartNodeId = n.id;
      else { addEdge(linkStartNodeId, n.id); linkStartNodeId = null; }
      draw(); return;
    }

    // リサイズチェック（枠線付近を優先）
    const dir = hitResizeDir(n, wx, wy);
    if (dir) {
      resizingNode = n;
      resizeDir = dir;
      startBox = {x:n.x, y:n.y, w:n.w, h:n.h, wx, wy};
      draw(); return;
    }

    // 移動ドラッグ
    draggingNode = n;
    dragOffset.x = wx - n.x; dragOffset.y = wy - n.y;
    draw(); return;
  }

  // 何もヒットしない → キャンバスパン
  selected = {type:null, id:null};
  panning = true;
  lastPointer = {x: px, y: py};
  draw();
});

canvas.addEventListener("pointermove", (e) => {
  if (!draggingNode && !draggingMemo && !panning && !resizingNode) return;
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;

  if (draggingNode) {
    const {x:wx, y:wy} = toWorld(px, py);
    draggingNode.x = wx - dragOffset.x;
    draggingNode.y = wy - dragOffset.y;
    saveMapNodes(); draw();
  } else if (draggingMemo) {
    const {x:wx, y:wy} = toWorld(px, py);
    draggingMemo.x = wx - dragOffset.x;
    draggingMemo.y = wy - dragOffset.y;
    saveMemos(); draw();
  } else if (resizingNode) {
    const {x:wx, y:wy} = toWorld(px, py);
    const n = resizingNode;
    let x = startBox.x, y = startBox.y, w = startBox.w, h = startBox.h;

    const dx = wx - startBox.wx;
    const dy = wy - startBox.wy;

    // 方向別に更新（西側/北側は位置も動く）
    if (resizeDir.includes("e")) w = clamp(startBox.w + dx, 80, 800);
    if (resizeDir.includes("s")) h = clamp(startBox.h + dy, 32, 500);
    if (resizeDir.includes("w")) { const nw = clamp(startBox.w - dx, 80, 800); x = startBox.x + (startBox.w - nw); w = nw; }
    if (resizeDir.includes("n")) { const nh = clamp(startBox.h - dy, 32, 500); y = startBox.y + (startBox.h - nh); h = nh; }

    n.x = x; n.y = y; n.w = w; n.h = h;
    saveMapNodes(); draw();
  } else if (panning) {
    const dx = px - lastPointer.x;
    const dy = py - lastPointer.y;
    view.tx += dx;
    view.ty += dy;
    lastPointer = {x: px, y: py};
    saveMapView();
    draw();
  }
});

canvas.addEventListener("pointerup", (e) => {
  canvas.releasePointerCapture(e.pointerId);
  draggingNode = null;
  draggingMemo = null;
  resizingNode = null;
  resizeDir = null;
  panning = false;
});

// ダブルクリック：ノード名の直接編集／メモ本文編集
canvas.addEventListener("dblclick", (e) => {
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  const {x:wx, y:wy} = toWorld(px, py);

  const m = hitMemo(wx, wy);
  if (m) {
    const next = prompt("メモ内容を編集", m.text ?? "");
    if (next != null) { m.text = next; saveMemos(); draw(); }
    return;
  }

  const n = hitNode(wx, wy);
  if (n) {
    showTitleEditor(n);
    return;
  }
});

// スクロールでズーム
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  hideTitleEditor();
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  const before = toWorld(px, py);
  const delta = Math.sign(e.deltaY) < 0 ? 1.1 : 1/1.1;
  setScale(view.scale * delta, {px, py, before});
}, { passive: false });

// ズーム操作
zoomInBtn.addEventListener("click", () => { hideTitleEditor(); setScale(view.scale * 1.1); });
zoomOutBtn.addEventListener("click", () => { hideTitleEditor(); setScale(view.scale / 1.1); });
resetViewBtn.addEventListener("click", () => { hideTitleEditor(); view = {tx:0, ty:0, scale:1}; saveMapView(); draw(); });

function setScale(newScale, pivot){
  const min=0.3, max=3;
  newScale = Math.max(min, Math.min(max, newScale));
  if (pivot){
    const after = { x: (pivot.px - view.tx) / newScale, y: (pivot.py - view.ty) / newScale };
    view.tx += (after.x - pivot.before.x) * newScale;
    view.ty += (after.y - pivot.before.y) * newScale;
  }
  view.scale = newScale;
  saveMapView();
  draw();
}

// === ランダム配置（新規の初期位置） ===
function randomX(){ return Math.random()*800 - 400; }
function randomY(){ return Math.random()*600 - 300; }

// === Map 永続化 ===
function loadMapNodes(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY_MAP_NODES) || "[]"); } catch { return []; } }
function saveMapNodes(){ localStorage.setItem(STORAGE_KEY_MAP_NODES, JSON.stringify(nodes)); }
function loadMapEdges(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY_MAP_EDGES) || "[]"); } catch { return []; } }
function saveMapEdges(){ localStorage.setItem(STORAGE_KEY_MAP_EDGES, JSON.stringify(edges)); }
function loadMapView(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY_MAP_VIEW) || "") || {tx:0,ty:0,scale:1}; } catch { return {tx:0,ty:0,scale:1}; } }
function saveMapView(){ localStorage.setItem(STORAGE_KEY_MAP_VIEW, JSON.stringify(view)); }
function loadMemos(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY_MAP_MEMOS) || "[]"); } catch { return []; } }
function saveMemos(){ localStorage.setItem(STORAGE_KEY_MAP_MEMOS, JSON.stringify(memos)); }

// === ノード名 直接編集（オーバーレイ） ===
function showTitleEditor(n){
  selected = {type:"node", id:n.id};
  const pad = 10;
  const { px, py } = toScreen(n.x + pad, n.y + pad);
  nodeEditInput.style.left = `${px}px`;
  nodeEditInput.style.top  = `${py}px`;
  nodeEditInput.style.width = `${Math.max(40, (n.w - pad*2) * view.scale)}px`;
  nodeEditInput.value = n.title;
  nodeEditInput.style.display = "block";
  nodeEditInput.focus();
  nodeEditInput.select();

  // 保存（Enter/blur）、キャンセル（Esc）
  const onKey = (e)=>{
    if (e.key === "Enter") { commit(); }
    else if (e.key === "Escape") { hideTitleEditor(); }
  };
  const commit = ()=>{
    n.title = nodeEditInput.value.trim() || n.title;
    hideTitleEditor();
    saveMapNodes(); draw();
  };
  const onBlur = ()=> commit();

  nodeEditInput.onkeydown = onKey;
  nodeEditInput.onblur = onBlur;
}
function hideTitleEditor(){
  nodeEditInput.style.display = "none";
  nodeEditInput.onkeydown = null;
  nodeEditInput.onblur = null;
}

// === ヒット判定（メモ優先 → ノード） ===
function hitMemo(wx, wy){
  for (let i = memos.length - 1; i >= 0; i--) {
    const m = memos[i];
    if (wx >= m.x && wx <= m.x+m.w && wy >= m.y && wy <= m.y+m.h) return m;
  }
  return null;
}
function hitNode(wx, wy){
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (wx >= n.x && wx <= n.x+n.w && wy >= n.y && wy <= n.y+n.h) return n;
  }
  return null;
}

function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

// 初期化
refreshTaskSelectForMap();
draw();
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}
