const EARTH_KM = 6371;
const MIN_KM = 40;
const MIN_COUNTRY_KM = 100;
const GAP_KM = 45;
const SHAPE_TAU = 0.082;
const LENGTH_SLACK = 0.2;
const LENGTH_TAU = 0.45;
const LENGTH_WEIGHT = 0.55;
const SNAP_PX = 10;
const GRAB_PX = 88;

const EUROPE = new Set(["ALB", "DEU", "AUT", "BEL", "BLR", "BIH", "BGR", "CYP", "HRV", "DNK", "ESP", "EST", "FIN", "FRA", "GRC", "HUN", "ISL", "IRL", "ITA", "KOS", "LVA", "LTU", "LUX", "MKD", "MDA", "MNE", "NOR", "NLD", "POL", "PRT", "CZE", "ROU", "GBR", "RUS", "SRB", "SVK", "SVN", "SWE", "CHE", "UKR", "TUR"]);
const AFRICA = new Set(["DZA", "AGO", "BEN", "BWA", "BFA", "BDI", "CMR", "CAF", "TCD", "COG", "COD", "CIV", "EGY", "ERI", "SWZ", "ETH", "GAB", "GHA", "GIN", "GNB", "GNQ", "KEN", "LSO", "LBR", "LBY", "MDG", "MWI", "MLI", "MRT", "MAR", "MOZ", "NAM", "NER", "NGA", "UGA", "RWA", "SEN", "SLE", "SOM", "ZAF", "SDS", "SDN", "TZA", "TGO", "TUN", "ZMB", "ZWE"]);
const SKIP = new Set(["ATA", "KAS", "SOL", "CYN"]);
const SHORT = {
  CHN: "Chine",
  COD: "RD Congo",
  COG: "Congo",
  CAF: "Centrafrique",
  PRK: "Corée du Nord",
  KOR: "Corée du Sud",
  LAO: "Laos",
  TWN: "Taïwan",
};
const DISPUTED = new Set([
  "Disputed (please verify)",
  "Indefinite (please verify)",
  "Line of control (please verify)",
  "Indeterminant frontier",
]);
const INTRO = {
  world: { center: [8, 16], scale: 0.38 },
  africa: { center: [17, 2], scale: 0.7 },
  europe: { center: [14, 52], scale: 0.86 },
  us: { center: [-98, 39], scale: 0.92 },
};

const game = {
  mode: "world",
  seconds: 30,
  rounds: 5,
  frame: "pair",
  phase: "intro",
  index: 0,
  deck: [],
  history: [],
  current: null,
};

const data = {
  countries: new Map(),
  states: new Map(),
  worldPairs: [],
  usPairs: [],
  disputed: new Map(),
};

const view = {
  width: 0,
  height: 0,
  flying: false,
  flyFrame: 0,
  morphFrame: 0,
  token: 0,
};

const els = {};
let timerFrame = 0;
let timerToken = 0;
let roundEndsAt = 0;
let drawing = null;
let camera = null;

function init() {
  els.loadText = document.getElementById("load-text");
  els.loadFill = document.getElementById("load-bar-fill");
  els.loadBar = document.querySelector(".load-bar");
  els.overlay = document.getElementById("load-overlay");
  els.intro = document.getElementById("intro-modal");
  els.chrome = document.getElementById("chrome");
  els.viewToggle = document.querySelector(".view-toggle");
  els.kicker = document.getElementById("round-kicker");
  els.target = document.getElementById("target-label");
  els.actions = document.getElementById("draw-actions");
  els.result = document.getElementById("result");
  els.resultScore = document.getElementById("result-score");
  els.statReal = document.getElementById("stat-real");
  els.statUser = document.getElementById("stat-user");
  els.statError = document.getElementById("stat-error");
  els.btnNext = document.getElementById("btn-next");
  els.historyWrap = document.getElementById("history-wrap");
  els.history = document.getElementById("history");
  els.finish = document.getElementById("finish-modal");
  els.finalScore = document.getElementById("final-score");
  els.recap = document.getElementById("finish-recap");
  els.timerBlock = document.getElementById("timer-block");
  els.timerBar = document.getElementById("timer-bar");
  els.timerFill = document.getElementById("timer-fill");
  els.timerValue = document.getElementById("timer-value");
  els.scorePop = document.getElementById("score-pop");
  els.scoreInfo = document.getElementById("btn-score-info");

  document.getElementById("btn-start").addEventListener("click", startGame);
  document.getElementById("btn-redraw").addEventListener("click", redrawStroke);
  document.getElementById("btn-validate").addEventListener("click", () => validate(false));
  els.validateEnd = document.getElementById("btn-validate-end");
  els.endActions = document.getElementById("end-actions");
  els.validateEnd.addEventListener("click", () => validate(false));
  document.getElementById("btn-redraw-end").addEventListener("click", redrawStroke);
  els.btnNext.addEventListener("click", onNext);
  document.getElementById("btn-replay").addEventListener("click", showIntro);
  els.scoreInfo.addEventListener("click", () => {
    const open = els.scoreInfo.getAttribute("aria-expanded") === "true";
    els.scoreInfo.setAttribute("aria-expanded", open ? "false" : "true");
    els.scorePop.hidden = open;
  });
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.dataset.mode;
      const changed = next !== game.mode;
      setPressed("[data-mode]", "data-mode", next);
      game.mode = next;
      if (game.phase !== "intro" || !view.projection || !changed) return;
      flyTo(() => fitIntro(), () => {});
    });
  });
  document.querySelectorAll("[data-pace]").forEach((button) => {
    button.addEventListener("click", () => {
      setPressed("[data-pace]", "data-pace", button.dataset.pace);
      game.seconds = Number(button.dataset.pace);
    });
  });
  document.querySelectorAll("[data-rounds]").forEach((button) => {
    button.addEventListener("click", () => {
      setPressed("[data-rounds]", "data-rounds", button.dataset.rounds);
      game.rounds = Number(button.dataset.rounds);
    });
  });
  document.querySelectorAll("[data-frame]").forEach((button) => {
    button.addEventListener("click", () => setFrame(button.dataset.frame));
  });
  window.addEventListener("resize", layout);
  window.addEventListener("pointerup", (event) => {
    endStroke(event);
    endCamera(event);
  });
  window.addEventListener("pointercancel", (event) => {
    endStroke(event);
    endCamera(event);
  });

  buildMap();
  load().catch(() => {
    els.loadText.textContent = "La carte n'a pas pu être chargée.";
  });
}

function setPressed(selector, attr, value) {
  document.querySelectorAll(selector).forEach((button) => {
    button.setAttribute("aria-pressed", button.getAttribute(attr) === String(value) ? "true" : "false");
  });
}

function setProgress(ratio) {
  const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  els.loadFill.style.width = `${pct}%`;
  els.loadBar.setAttribute("aria-valuenow", String(pct));
}

async function load() {
  const files = [
    ["countries", "data/countries-all-50m.json"],
    ["states", "data/us-states-10m.geojson"],
    ["borders", "data/borders-50m.json"],
  ];
  const loaded = {};
  for (let i = 0; i < files.length; i += 1) {
    const [key, url] = files[i];
    const response = await fetch(url);
    if (!response.ok) throw new Error(url);
    loaded[key] = await response.json();
    setProgress((i + 1) / (files.length + 1));
  }
  indexDisputes(loaded.borders);
  indexCountries(loaded.countries);
  indexStates(loaded.states);
  buildGlobe(loaded.countries);
  data.worldPairs = buildPairs(data.countries, false);
  data.usPairs = buildPairs(data.states, true);
  setProgress(1);
  els.overlay.classList.add("is-done");
  els.overlay.setAttribute("aria-busy", "false");
  layout();
}

function indexDisputes(collection) {
  collection.features.forEach((feature) => {
    const kind = feature.properties && feature.properties.FEATURECLA;
    if (!DISPUTED.has(kind)) return;
    const geometry = feature.geometry;
    if (!geometry) return;
    const lines = geometry.type === "MultiLineString" ? geometry.coordinates : geometry.type === "LineString" ? [geometry.coordinates] : [];
    lines.forEach((line) => {
      line.forEach((coord) => {
        const key = cellKey(coord[0], coord[1]);
        let bucket = data.disputed.get(key);
        if (!bucket) {
          bucket = [];
          data.disputed.set(key, bucket);
        }
        bucket.push([coord[0], coord[1]]);
      });
    });
  });
}

function cellKey(lon, lat) {
  return `${Math.floor(lon / 0.5)}:${Math.floor(lat / 0.5)}`;
}

function nearDispute(lon, lat) {
  const cx = Math.floor(lon / 0.5);
  const cy = Math.floor(lat / 0.5);
  const cos = Math.cos(lat * Math.PI / 180);
  for (let ix = cx - 1; ix <= cx + 1; ix += 1) {
    for (let iy = cy - 1; iy <= cy + 1; iy += 1) {
      const bucket = data.disputed.get(`${ix}:${iy}`);
      if (!bucket) continue;
      for (let i = 0; i < bucket.length; i += 1) {
        const point = bucket[i];
        const dx = (lon - point[0]) * cos;
        const dy = lat - point[1];
        if (dx * dx + dy * dy < 0.12 * 0.12) return true;
      }
    }
  }
  return false;
}

function disputeRatio(line) {
  if (line.length < 2) return 0;
  const step = Math.max(1, Math.floor(line.length / 48));
  let seen = 0;
  let hit = 0;
  for (let i = 0; i < line.length; i += step) {
    seen += 1;
    if (nearDispute(line[i][0], line[i][1])) hit += 1;
  }
  return hit / seen;
}

function buildGlobe(collection) {
  const features = (collection.features || []).filter((feature) => feature.geometry);
  data.globe = { type: "FeatureCollection", features };
  data.globeCoast = shorelineOf(features);
}

function shorelineOf(features) {
  const counts = new Map();
  const lines = new Map();
  features.forEach((feature) => {
    polygonsOf(feature.geometry).forEach((polygon) => {
      polygon.forEach((ring) => {
        for (let i = 0; i < ring.length - 1; i += 1) {
          const start = ring[i];
          const end = ring[i + 1];
          const key = shoreKey(start, end);
          if (!key) continue;
          counts.set(key, (counts.get(key) || 0) + 1);
          if (!lines.has(key)) lines.set(key, [start, end]);
        }
      });
    });
  });
  const coordinates = [];
  lines.forEach((line, key) => {
    if (counts.get(key) === 1) coordinates.push(line);
  });
  return { type: "MultiLineString", coordinates };
}

function shoreKey(start, end) {
  const a = `${Math.round(start[0] * 1e3)},${Math.round(start[1] * 1e3)}`;
  const b = `${Math.round(end[0] * 1e3)},${Math.round(end[1] * 1e3)}`;
  if (a === b) return null;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function indexCountries(collection) {
  collection.features.forEach((feature) => {
    const props = feature.properties || {};
    const id = props.ADM0_A3;
    if (!id || SKIP.has(id)) return;
    const kept = cluster(feature.geometry);
    if (!kept.length) return;
    const name = SHORT[id] || props.NAME_FR || props.NAME || id;
    remember(data.countries, id, name, kept);
  });
}

function indexStates(collection) {
  collection.features.forEach((feature) => {
    const props = feature.properties || {};
    if (props.type === "Federal District" || props.iso_3166_2 === "US-DC") return;
    if (props.postal === "AK" || props.postal === "HI") return;
    const id = props.postal || props.iso_3166_2;
    if (!id) return;
    const kept = cluster(feature.geometry);
    if (!kept.length) return;
    const name = props.name_fr || props.name || id;
    remember(data.states, id, name, kept);
  });
}

function remember(map, id, name, kept) {
  const rings = kept.map((item) => item.rings[0]);
  const feature = {
    type: "Feature",
    id,
    properties: { name },
    geometry: {
      type: "MultiPolygon",
      coordinates: rings.map((ring) => [ring]),
    },
  };
  map.set(id, { id, name, rings, feature, perimeter: rings.reduce((sum, ring) => sum + lineKm(ring), 0) });
}

function polygonsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

function fixRing(ring) {
  if (!ring || ring.length < 4) return [];
  const out = [[ring[0][0], ring[0][1]]];
  for (let i = 1; i < ring.length; i += 1) {
    let lon = ring[i][0];
    const prev = out[out.length - 1][0];
    while (lon - prev > 180) lon -= 360;
    while (prev - lon > 180) lon += 360;
    out.push([lon, ring[i][1]]);
  }
  return out;
}

function ringStats(ring) {
  let cross = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const x1 = ring[i][0];
    const y1 = ring[i][1];
    const x2 = ring[i + 1][0];
    const y2 = ring[i + 1][1];
    const area = x1 * y2 - x2 * y1;
    cross += area;
    cx += (x1 + x2) * area;
    cy += (y1 + y2) * area;
  }
  const area = Math.abs(cross) / 2;
  if (area < 1e-12) {
    let sx = 0;
    let sy = 0;
    ring.forEach((point) => {
      sx += point[0];
      sy += point[1];
    });
    return { cx: sx / ring.length, cy: sy / ring.length, area: 0 };
  }
  return { cx: cx / (3 * cross), cy: cy / (3 * cross), area };
}

function degreeDistance(a, b) {
  const mid = ((a.cy + b.cy) / 2) * Math.PI / 180;
  const dx = (a.cx - b.cx) * Math.cos(mid);
  const dy = a.cy - b.cy;
  return Math.hypot(dx, dy);
}

function cluster(geometry) {
  const items = polygonsOf(geometry).map((polygon) => {
    const rings = polygon.map(fixRing).filter((ring) => ring.length >= 4);
    if (!rings.length) return null;
    const stats = ringStats(rings[0]);
    if (stats.area <= 0) return null;
    return { rings, cx: stats.cx, cy: stats.cy, area: stats.area };
  }).filter(Boolean);
  if (!items.length) return [];
  items.sort((a, b) => b.area - a.area);
  const ref = items[0].cx;
  items.forEach((item) => {
    while (item.cx - ref > 180) {
      item.cx -= 360;
      item.rings = item.rings.map((ring) => ring.map(([lon, lat]) => [lon - 360, lat]));
    }
    while (ref - item.cx > 180) {
      item.cx += 360;
      item.rings = item.rings.map((ring) => ring.map(([lon, lat]) => [lon + 360, lat]));
    }
  });
  const kept = [items[0]];
  const rest = items.slice(1);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = rest.length - 1; i >= 0; i -= 1) {
      const item = rest[i];
      if (item.area < items[0].area * 0.008) continue;
      if (degreeDistance(item, items[0]) > 13.2) continue;
      if (kept.some((other) => degreeDistance(item, other) <= 13)) {
        kept.push(item);
        rest.splice(i, 1);
        changed = true;
      }
    }
  }
  return kept;
}

function qkey(lon, lat) {
  return `${Math.round(lon * 1e4) / 1e4},${Math.round(lat * 1e4) / 1e4}`;
}

function haversine(a, b) {
  const lon1 = a[0] * Math.PI / 180;
  const lat1 = a[1] * Math.PI / 180;
  const lon2 = b[0] * Math.PI / 180;
  const lat2 = b[1] * Math.PI / 180;
  const dlon = lon2 - lon1;
  const dlat = lat2 - lat1;
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function lineKm(line) {
  let km = 0;
  for (let i = 1; i < line.length; i += 1) km += haversine(line[i - 1], line[i]);
  return km;
}

function chainEdges(segments) {
  const adj = new Map();
  const link = (a, b) => {
    let list = adj.get(a);
    if (!list) {
      list = [];
      adj.set(a, list);
    }
    if (!list.includes(b)) list.push(b);
  };
  segments.forEach(([a, b]) => {
    if (a === b) return;
    link(a, b);
    link(b, a);
  });
  const used = new Set();
  const edgeKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const lines = [];
  const starts = [];
  adj.forEach((list, point) => {
    if (list.length !== 2) starts.push(point);
  });
  if (!starts.length) adj.forEach((_, point) => starts.push(point));
  const seen = new Set();
  starts.forEach((start) => {
    if (seen.has(start)) return;
    const neighbors = adj.get(start) || [];
    neighbors.forEach((next) => {
      const first = edgeKey(start, next);
      if (used.has(first)) return;
      const line = [start, next];
      used.add(first);
      let prev = start;
      let current = next;
      let guard = 0;
      while (guard < 100000) {
        guard += 1;
        const onward = (adj.get(current) || []).find((candidate) => candidate !== prev && !used.has(edgeKey(current, candidate)));
        if (!onward) break;
        used.add(edgeKey(current, onward));
        line.push(onward);
        prev = current;
        current = onward;
        if (current === start) break;
      }
      lines.push(line);
      seen.add(start);
    });
  });
  return lines;
}

function joinLines(lines) {
  let parts = lines.filter((line) => lineKm(line) >= 30);
  if (!parts.length) return null;
  parts.sort((a, b) => lineKm(b) - lineKm(a));
  const main = lineKm(parts[0]);
  parts = parts.filter((line, index) => index === 0 || lineKm(line) >= main * 0.08);
  if (parts.length === 1) return parts[0];
  if (parts.length !== 2) return null;
  const [a, b] = parts;
  const options = [
    { d: haversine(a[0], b[0]), reverseA: true, reverseB: false },
    { d: haversine(a[0], b[b.length - 1]), reverseA: true, reverseB: true },
    { d: haversine(a[a.length - 1], b[0]), reverseA: false, reverseB: false },
    { d: haversine(a[a.length - 1], b[b.length - 1]), reverseA: false, reverseB: true },
  ].sort((p, q) => p.d - q.d);
  if (options[0].d > GAP_KM) return null;
  const left = options[0].reverseA ? a.slice().reverse() : a.slice();
  const right = options[0].reverseB ? b.slice().reverse() : b.slice();
  return left.concat(right);
}

function buildPairs(entities, states) {
  const owners = new Map();
  const points = new Map();
  entities.forEach((entity) => {
    entity.rings.forEach((ring) => {
      for (let i = 1; i < ring.length; i += 1) {
        const a = qkey(ring[i - 1][0], ring[i - 1][1]);
        const b = qkey(ring[i][0], ring[i][1]);
        if (a === b) continue;
        if (!points.has(a)) points.set(a, [ring[i - 1][0], ring[i - 1][1]]);
        if (!points.has(b)) points.set(b, [ring[i][0], ring[i][1]]);
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        let set = owners.get(key);
        if (!set) {
          set = new Set();
          owners.set(key, set);
        }
        set.add(entity.id);
      }
    });
  });
  const buckets = new Map();
  owners.forEach((set, key) => {
    if (set.size !== 2) return;
    const ids = [...set].sort();
    const pairId = `${ids[0]}|${ids[1]}`;
    let list = buckets.get(pairId);
    if (!list) {
      list = [];
      buckets.set(pairId, list);
    }
    const [a, b] = key.split("|");
    list.push([a, b]);
  });
  const pairs = [];
  buckets.forEach((segments, pairId) => {
    const [idA, idB] = pairId.split("|");
    const entityA = entities.get(idA);
    const entityB = entities.get(idB);
    const keyed = chainEdges(segments);
    const lines = keyed.map((keys) => keys.map((key) => points.get(key))).filter((line) => line.length >= 2);
    const answer = joinLines(lines);
    if (!answer) return;
    const km = lineKm(answer);
    if (km < (states ? MIN_KM : MIN_COUNTRY_KM)) return;
    const endGap = haversine(answer[0], answer[answer.length - 1]);
    if (endGap < 25) return;
    const smaller = Math.min(entityA.perimeter, entityB.perimeter);
    if (smaller > 0 && km / smaller > 0.8) return;
    if (!states && disputeRatio(answer) > 0.4) return;
    const center = d3.geoCentroid({
      type: "FeatureCollection",
      features: [entityA.feature, entityB.feature],
    });
    if (!center || !Number.isFinite(center[0]) || !Number.isFinite(center[1])) return;
    const label = entityA.name.localeCompare(entityB.name, "fr") <= 0
      ? `${entityA.name} — ${entityB.name}`
      : `${entityB.name} — ${entityA.name}`;
    pairs.push({
      id: pairId,
      a: entityA,
      b: entityB,
      label,
      line: answer,
      hide: lines,
      km,
      lon: center[0],
      lat: center[1],
    });
  });
  return pairs;
}

function buildMap() {
  const svg = d3.select("#map").append("svg");
  view.svg = svg;
  view.projection = d3.geoOrthographic().clipAngle(90);
  view.path = d3.geoPath(view.projection);
  const defs = svg.append("defs");
  view.seaPattern = defs.append("pattern")
    .attr("id", "sea-texture")
    .attr("patternUnits", "userSpaceOnUse");
  view.seaImage = view.seaPattern.append("image").attr("href", "texture-fond.png");
  const globe = defs.append("filter")
    .attr("id", "globe-shadow")
    .attr("x", "-20%")
    .attr("y", "-20%")
    .attr("width", "140%")
    .attr("height", "140%");
  globe.append("feGaussianBlur").attr("stdDeviation", 14);
  view.globeShadow = svg.append("path").attr("class", "globe-shadow").attr("filter", "url(#globe-shadow)");
  view.sphere = svg.append("path").attr("class", "sphere").attr("fill", "url(#sea-texture)");
  view.graticule = svg.append("path").attr("class", "graticule");
  view.context = svg.append("path").attr("class", "context");
  view.contextCoast = svg.append("path").attr("class", "context-coast");
  view.land = svg.append("path").attr("class", "land");
  view.coast = svg.append("path").attr("class", "coastline");
  view.seam = svg.append("path").attr("class", "seam");
  view.truth = svg.append("path").attr("class", "truth");
  view.sketch = svg.append("path").attr("class", "sketch");
  view.markers = svg.append("g").attr("class", "markers");
  view.hit = svg.append("rect").attr("class", "draw-hit");
  view.hit.on("pointerdown", onMapPointerDown);
  view.hit.on("contextmenu", (event) => event.preventDefault());
  view.hit.node().addEventListener("pointermove", updateMapCursor);
  view.svg.node().addEventListener("wheel", onWheel, { passive: false });
  view.graticuleDatum = d3.geoGraticule();
}

function layout() {
  const node = document.getElementById("map");
  view.width = node.clientWidth;
  view.height = node.clientHeight;
  view.svg.attr("width", view.width).attr("height", view.height);
  view.hit.attr("width", view.width).attr("height", view.height);
  fitSeaTexture();
  if (view.flying) return;
  if (view.morphFrame) stopMorph();
  if (game.phase === "intro") fitIntro();
  else if (game.current) fitRound(game.current);
  redraw();
}

const TEXTURE_WIDTH = 1920;
const TEXTURE_HEIGHT = 1080;

function fitSeaTexture() {
  const width = view.width;
  const height = view.height;
  const scale = Math.max(width / TEXTURE_WIDTH, height / TEXTURE_HEIGHT);
  const imageWidth = TEXTURE_WIDTH * scale;
  const imageHeight = TEXTURE_HEIGHT * scale;
  view.seaPattern.attr("width", width).attr("height", height);
  view.seaImage
    .attr("x", (width - imageWidth) / 2)
    .attr("y", (height - imageHeight) / 2)
    .attr("width", imageWidth)
    .attr("height", imageHeight);
}

function isCompact() {
  return window.matchMedia("(max-width: 640px)").matches;
}

function safeInset(edge) {
  const key = `safe${edge}`;
  if (view[key] != null) return view[key];
  const probe = document.createElement("div");
  probe.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;height:env(safe-area-inset-${edge})`;
  document.body.append(probe);
  view[key] = probe.offsetHeight || 0;
  probe.remove();
  return view[key];
}

function playInsets() {
  if (isCompact()) {
    return {
      top: 128 + safeInset("top"),
      right: 16,
      bottom: 72 + safeInset("bottom"),
      left: 16,
    };
  }
  return { top: 28, right: 32, bottom: 32, left: 28 };
}

function fitIntro() {
  const frame = INTRO[game.mode] || INTRO.world;
  const size = Math.min(view.width, view.height);
  view.projection
    .rotate([-frame.center[0], -frame.center[1]])
    .translate([view.width / 2, view.height / 2])
    .scale(size * frame.scale);
}

function setFrame(frame) {
  if (frame !== "pair" && frame !== "border") return;
  if (frame === game.frame) return;
  game.frame = frame;
  setPressed("[data-frame]", "data-frame", frame);
  if (!game.current || (game.phase !== "draw" && game.phase !== "result")) return;
  if (view.morphFrame) {
    stopMorph();
    paintTruth();
    showScore(game.current);
  }
  flyTo(() => fitRound(game.current), () => {});
}

function fitRound(round) {
  if (game.frame === "border") fitBorder(round);
  else fitPair(round);
}

function fitPair(round) {
  const pair = round.pair;
  const projection = view.projection;
  projection.rotate([-pair.lon, -pair.lat]).scale(1).translate([0, 0]);
  const bounds = view.path.bounds({
    type: "FeatureCollection",
    features: [pair.a.feature, pair.b.feature],
  });
  const width = Math.max(1e-6, bounds[1][0] - bounds[0][0]);
  const height = Math.max(1e-6, bounds[1][1] - bounds[0][1]);
  const insets = playInsets();
  const availW = Math.max(40, view.width - insets.left - insets.right);
  const availH = Math.max(40, view.height - insets.top - insets.bottom);
  const scale = 0.9 * Math.min(availW / width, availH / height);
  const midX = (bounds[0][0] + bounds[1][0]) / 2;
  const midY = (bounds[0][1] + bounds[1][1]) / 2;
  projection.scale(scale).translate([
    insets.left + availW / 2 - scale * midX,
    insets.top + availH / 2 - scale * midY,
  ]);
}

function fitBorder(round) {
  const line = round.pair.line;
  const projection = view.projection;
  const center = d3.geoCentroid({ type: "LineString", coordinates: line });
  const lon = center && Number.isFinite(center[0]) ? center[0] : round.pair.lon;
  const lat = center && Number.isFinite(center[1]) ? center[1] : round.pair.lat;
  projection.rotate([-lon, -lat]).scale(1).translate([0, 0]);
  const bounds = view.path.bounds({ type: "LineString", coordinates: line });
  const rawW = Math.max(1e-6, bounds[1][0] - bounds[0][0]);
  const rawH = Math.max(1e-6, bounds[1][1] - bounds[0][1]);
  const span = Math.max(rawW, rawH);
  const width = Math.max(rawW, span * 0.42);
  const height = Math.max(rawH, span * 0.42);
  const insets = playInsets();
  const availW = Math.max(40, view.width - insets.left - insets.right);
  const availH = Math.max(40, view.height - insets.top - insets.bottom);
  const scale = 0.78 * Math.min(availW / width, availH / height);
  const midX = (bounds[0][0] + bounds[1][0]) / 2;
  const midY = (bounds[0][1] + bounds[1][1]) / 2;
  projection.scale(scale).translate([
    insets.left + availW / 2 - scale * midX,
    insets.top + availH / 2 - scale * midY,
  ]);
}

function regionFeatures() {
  if (game.mode === "us") return [...data.states.values()].map((entity) => entity.feature);
  const source = [...data.countries.values()];
  if (game.mode === "europe") return source.filter((entity) => EUROPE.has(entity.id)).map((entity) => entity.feature);
  if (game.mode === "africa") return source.filter((entity) => AFRICA.has(entity.id)).map((entity) => entity.feature);
  return source.map((entity) => entity.feature);
}

function redraw() {
  if (!view.path) return;
  const path = view.path;
  const sphere = path({ type: "Sphere" });
  const close = game.phase !== "intro" && view.projection.scale() > Math.min(view.width, view.height) * 0.72;
  view.globeShadow.attr("d", sphere).attr("display", close ? "none" : null);
  view.sphere.attr("d", sphere);
  const step = view.projection.scale() > 900 ? 5 : view.projection.scale() > 420 ? 10 : 15;
  view.graticule.attr("d", path(view.graticuleDatum.step([step, step])()));
  const playing = game.phase !== "intro" && game.current;
  if (!playing) {
    view.context.attr("d", null);
    view.contextCoast.attr("d", null);
    view.land.attr("d", data.globe ? path(data.globe) : null);
    view.coast.attr("d", data.globeCoast ? path(data.globeCoast) : null);
    view.seam.attr("d", null);
  } else {
    const pair = game.current.pair;
    const focusIds = new Set([pair.a.id, pair.b.id]);
    const around = regionFeatures().filter((feature) => !focusIds.has(feature.id));
    const context = { type: "FeatureCollection", features: around };
    const focus = { type: "FeatureCollection", features: [pair.a.feature, pair.b.feature] };
    view.context.attr("d", path(context));
    view.contextCoast.attr("d", path(context));
    view.land.attr("d", path(focus));
    view.coast.attr("d", path(focus));
    view.seam.attr("d", path({
      type: "MultiLineString",
      coordinates: pair.hide,
    }));
  }
  paintSketch();
  paintMarkers();
  if ((game.phase === "result" || game.phase === "finish") && !view.morphFrame) paintTruth();
  else if (!view.morphFrame) view.truth.attr("d", null);
  placeEndValidate();
}

function paintSketch() {
  const round = game.current;
  if (!round || !round.sketch.length) {
    view.sketch.attr("d", null);
    return;
  }
  view.sketch.attr("d", linePath(projectLine(round.sketch)));
}

function endpoints() {
  const round = game.current;
  if (!round) return [];
  const line = round.pair.line;
  if (!line || line.length < 2) return [];
  return [line[0], line[line.length - 1]];
}

function endpointScreens() {
  return endpoints().map((coord) => view.projection(coord));
}

function samePoint(a, b) {
  return a && b && Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
}

function paintMarkers() {
  const visible = game.current && game.phase !== "intro";
  const points = visible ? endpointScreens().filter((point) => point && Number.isFinite(point[0])) : [];
  const nodes = view.markers.selectAll("g.marker").data(points);
  const enter = nodes.enter().append("g").attr("class", "marker");
  enter.append("circle").attr("class", "marker-ring").attr("r", 8);
  enter.append("circle").attr("class", "marker-core").attr("r", 3.4);
  nodes.merge(enter).attr("transform", (point) => `translate(${point[0].toFixed(1)} ${point[1].toFixed(1)})`);
  nodes.exit().remove();
}

function paintTruth() {
  const round = game.current;
  if (!round) return;
  view.truth.attr("d", linePath(projectLine(round.pair.line)));
  view.truth.attr("stroke-dasharray", null).attr("stroke-dashoffset", null);
}

function projectLine(line) {
  const points = [];
  line.forEach((coord) => {
    const point = view.projection(coord);
    if (point) points.push(point);
  });
  return points;
}

function linePath(points) {
  if (!points || points.length < 2) return "";
  let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length; i += 1) {
    d += `L${points[i][0].toFixed(1)} ${points[i][1].toFixed(1)}`;
  }
  return d;
}

function pool() {
  if (game.mode === "us") return data.usPairs;
  if (game.mode === "europe") return data.worldPairs.filter((pair) => EUROPE.has(pair.a.id) && EUROPE.has(pair.b.id));
  if (game.mode === "africa") return data.worldPairs.filter((pair) => AFRICA.has(pair.a.id) && AFRICA.has(pair.b.id));
  return data.worldPairs;
}

function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function startGame() {
  const source = pool();
  if (!source.length) return;
  const deck = [];
  const bag = shuffle(source);
  while (deck.length < game.rounds) {
    if (!bag.length) bag.push(...shuffle(source));
    deck.push(bag.pop());
  }
  game.deck = deck;
  game.history = [];
  game.index = 0;
  els.intro.hidden = true;
  els.finish.hidden = true;
  els.chrome.hidden = false;
  els.historyWrap.hidden = false;
  renderHistory();
  beginRound();
}

function beginRound() {
  stopTimer();
  stopMorph();
  drawing = null;
  const pair = game.deck[game.index];
  game.current = { pair, sketch: [], ready: false, score: null, km: null };
  game.phase = "fly";
  document.body.classList.remove("is-intro", "is-result", "is-finish", "is-ready");
  document.body.classList.add("is-playing");
  game.frame = "pair";
  setPressed("[data-frame]", "data-frame", "pair");
  els.kicker.textContent = `Manche ${game.index + 1} / ${game.rounds}`;
  els.target.textContent = pair.label;
  els.actions.hidden = true;
  els.result.hidden = true;
  els.endActions.hidden = true;
  els.viewToggle.hidden = false;
  const token = bump();
  flyTo(() => fitRound(game.current), () => {
    if (token !== view.token) return;
    game.phase = "draw";
    redraw();
    startTimer();
  });
}

function bump() {
  view.token += 1;
  return view.token;
}

function lerpAngle(a, b, t) {
  let delta = b - a;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return a + delta * t;
}

function flyTo(applyTarget, done) {
  cancelAnimationFrame(view.flyFrame);
  const startRotate = view.projection.rotate().slice();
  const startScale = view.projection.scale();
  const startTranslate = view.projection.translate().slice();
  applyTarget();
  const endRotate = view.projection.rotate().slice();
  const endScale = view.projection.scale();
  const endTranslate = view.projection.translate().slice();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    view.flying = false;
    redraw();
    done();
    return;
  }
  view.projection.rotate(startRotate).scale(startScale).translate(startTranslate);
  view.flying = true;
  const sweep = Math.max(
    Math.abs(lerpAngle(startRotate[0], endRotate[0], 1) - startRotate[0]),
    Math.abs(endRotate[1] - startRotate[1]),
  );
  const duration = game.phase === "intro" ? Math.round(Math.min(1600, 680 + sweep * 5)) : 680;
  const t0 = performance.now();
  const frame = (now) => {
    const t = Math.min(1, (now - t0) / duration);
    const e = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
    view.projection.rotate([
      lerpAngle(startRotate[0], endRotate[0], e),
      lerpAngle(startRotate[1], endRotate[1], e),
      0,
    ]).scale(startScale + (endScale - startScale) * e).translate([
      startTranslate[0] + (endTranslate[0] - startTranslate[0]) * e,
      startTranslate[1] + (endTranslate[1] - startTranslate[1]) * e,
    ]);
    redraw();
    if (t < 1) view.flyFrame = requestAnimationFrame(frame);
    else {
      view.flying = false;
      done();
    }
  };
  view.flyFrame = requestAnimationFrame(frame);
}

function startTimer() {
  stopTimer();
  const token = timerToken;
  roundEndsAt = performance.now() + game.seconds * 1000;
  els.timerBlock.hidden = false;
  const tick = () => {
    if (token !== timerToken || game.phase !== "draw") return;
    const left = roundEndsAt - performance.now();
    if (left <= 0) {
      els.timerFill.style.width = "0%";
      els.timerBar.setAttribute("aria-valuenow", "0");
      els.timerValue.textContent = "0 s";
      validate(true);
      return;
    }
    const pct = Math.max(0, Math.min(100, (left / (game.seconds * 1000)) * 100));
    els.timerFill.style.width = `${pct}%`;
    els.timerBar.setAttribute("aria-valuenow", String(Math.round(pct)));
    els.timerValue.textContent = `${Math.max(0, Math.ceil(left / 1000))} s`;
    timerFrame = requestAnimationFrame(tick);
  };
  tick();
}

function stopTimer() {
  timerToken += 1;
  cancelAnimationFrame(timerFrame);
  timerFrame = 0;
  els.timerBlock.hidden = true;
}

function nearestEndpoint(screen) {
  const points = endpointScreens();
  let index = -1;
  let distance = Infinity;
  points.forEach((point, i) => {
    if (!point) return;
    const gap = Math.hypot(point[0] - screen[0], point[1] - screen[1]);
    if (gap < distance) {
      distance = gap;
      index = i;
    }
  });
  return { index, distance };
}

function isMouseEvent(event) {
  return !event.pointerType || event.pointerType === "mouse";
}

function canStartStroke() {
  return game.phase === "draw" && !view.flying && game.current && !game.current.ready;
}

function cameraScaleLimits() {
  const side = Math.min(view.width, view.height);
  return [side * 0.18, side * 16];
}

function clampTranslate(translate) {
  const radius = view.projection.scale();
  const pad = 48;
  return [
    Math.max(pad - radius, Math.min(view.width - pad + radius, translate[0])),
    Math.max(pad - radius, Math.min(view.height - pad + radius, translate[1])),
  ];
}

function onMapPointerDown(event) {
  const desktop = !isCompact() && isMouseEvent(event) && !view.flying
    && (game.phase === "draw" || game.phase === "result");
  if (!desktop) {
    startStroke(event);
    return;
  }
  if (event.button != null && event.button !== 0) return;
  const screen = pointerScreen(event);
  if (canStartStroke() && nearestEndpoint(screen).distance <= GRAB_PX) {
    startStroke(event);
    return;
  }
  beginPan(event, screen);
}

function beginPan(event, screen) {
  event.preventDefault();
  const translate = view.projection.translate();
  camera = {
    pointerId: event.pointerId,
    x: screen[0],
    y: screen[1],
    translate: [translate[0], translate[1]],
  };
  try { view.hit.node().setPointerCapture(event.pointerId); } catch (err) { /* synthetic or already released */ }
  view.hit.on("pointermove", movePan);
  document.body.classList.add("is-panning");
}

function movePan(event) {
  if (!camera || event.pointerId !== camera.pointerId) return;
  const screen = pointerScreen(event);
  view.projection.translate(clampTranslate([
    camera.translate[0] + screen[0] - camera.x,
    camera.translate[1] + screen[1] - camera.y,
  ]));
  redraw();
}

function endCamera(event) {
  if (!camera) return;
  if (event && event.pointerId != null && event.pointerId !== camera.pointerId) return;
  camera = null;
  view.hit.on("pointermove", null);
  document.body.classList.remove("is-panning");
}

function onWheel(event) {
  if (isCompact() || view.flying) return;
  if (game.phase !== "draw" && game.phase !== "result") return;
  event.preventDefault();
  const screen = pointerScreen(event);
  const projection = view.projection;
  let delta = event.deltaY;
  if (event.deltaMode === 1) delta *= 16;
  else if (event.deltaMode === 2) delta *= view.height;
  const [minScale, maxScale] = cameraScaleLimits();
  const next = Math.max(minScale, Math.min(maxScale, projection.scale() * Math.exp(-delta * 0.0016)));
  const geo = projection.invert(screen);
  projection.scale(next);
  if (geo && Number.isFinite(geo[0]) && Number.isFinite(geo[1])) {
    const moved = projection(geo);
    if (moved) {
      const origin = projection.translate();
      projection.translate(clampTranslate([
        origin[0] + screen[0] - moved[0],
        origin[1] + screen[1] - moved[1],
      ]));
    }
  }
  redraw();
}

function updateMapCursor(event) {
  if (!view.hit || isCompact()) return;
  const node = view.hit.node();
  if (camera) {
    node.style.cursor = "grabbing";
    return;
  }
  if (game.phase !== "draw" && game.phase !== "result") {
    node.style.cursor = "";
    return;
  }
  if (!canStartStroke()) {
    node.style.cursor = "grab";
    return;
  }
  const near = nearestEndpoint(pointerScreen(event));
  node.style.cursor = near.distance <= GRAB_PX ? "crosshair" : "grab";
}

function startStroke(event) {
  if (game.phase !== "draw" || view.flying || !game.current || game.current.ready) return;
  const screen = pointerScreen(event);
  const near = nearestEndpoint(screen);
  if (near.index < 0 || near.distance > GRAB_PX) return;
  event.preventDefault();
  const origin = endpoints()[near.index];
  drawing = { pointerId: event.pointerId, moved: 0, originIndex: near.index, snap: false };
  game.current.sketch = [origin.slice()];
  const node = view.hit.node();
  try { node.setPointerCapture(event.pointerId); } catch (err) { /* synthetic or already released */ }
  view.hit.on("pointermove", moveStroke);
}

function moveStroke(event) {
  if (!drawing || event.pointerId !== drawing.pointerId || !game.current) return;
  const point = pointerGeo(event);
  if (!point) return;
  const sketch = game.current.sketch;
  const target = endpoints()[drawing.originIndex === 0 ? 1 : 0];
  const targetScreen = view.projection(target);
  const screen = pointerScreen(event);
  const close = targetScreen && Math.hypot(screen[0] - targetScreen[0], screen[1] - targetScreen[1]) <= SNAP_PX;
  if (close) {
    const last = sketch[sketch.length - 1];
    if (!samePoint(last, target)) {
      sketch.push(target.slice());
      drawing.moved += SNAP_PX;
    }
    drawing.snap = true;
    paintSketch();
    return;
  }
  if (drawing.snap) {
    const last = sketch[sketch.length - 1];
    if (samePoint(last, target)) sketch.pop();
    drawing.snap = false;
  }
  const last = sketch[sketch.length - 1];
  if (last) {
    const prev = view.projection(last);
    const next = view.projection(point);
    if (prev && next) {
      const step = Math.hypot(next[0] - prev[0], next[1] - prev[1]);
      if (step < 1.4) return;
      drawing.moved += step;
    }
  }
  sketch.push(point);
  paintSketch();
}

function endStroke(event) {
  if (!drawing) return;
  if (event && event.pointerId != null && event.pointerId !== drawing.pointerId) return;
  view.hit.on("pointermove", null);
  const moved = drawing.moved;
  const originIndex = drawing.originIndex;
  drawing = null;
  if (!game.current || game.phase !== "draw") return;
  if (moved < 28) {
    game.current.sketch = [];
    paintSketch();
    return;
  }
  const target = endpoints()[originIndex === 0 ? 1 : 0];
  const sketch = game.current.sketch;
  if (target && !samePoint(sketch[sketch.length - 1], target)) sketch.push(target.slice());
  paintSketch();
  game.current.ready = true;
  document.body.classList.add("is-ready");
  els.actions.hidden = false;
  placeEndValidate();
}

function pointerScreen(event) {
  return d3.pointer(event, view.svg.node());
}

function pointerGeo(event) {
  const point = pointerScreen(event);
  const geo = view.projection.invert(point);
  if (!geo || !Number.isFinite(geo[0]) || !Number.isFinite(geo[1])) return null;
  return [geo[0], geo[1]];
}

function redrawStroke() {
  if (game.phase !== "draw" || !game.current) return;
  game.current.sketch = [];
  game.current.ready = false;
  document.body.classList.remove("is-ready");
  els.actions.hidden = true;
  els.endActions.hidden = true;
  paintSketch();
}

function validate(auto) {
  if (game.phase !== "draw" || !game.current) return;
  if (drawing) endStroke();
  stopTimer();
  const round = game.current;
  const graded = grade(round);
  round.score = graded.score;
  round.km = graded.km;
  round.lengthRatio = graded.lengthRatio;
  game.history.push({ label: round.pair.label, score: round.score, km: round.km });
  renderHistory();
  game.phase = "result";
  document.body.classList.remove("is-playing", "is-ready");
  document.body.classList.add("is-result");
  els.actions.hidden = true;
  els.endActions.hidden = true;
  els.viewToggle.hidden = true;
  const token = view.token;
  const finish = () => {
    if (token !== view.token) return;
    showScore(round);
  };
  if (round.sketch.length < 2) revealTruth(finish);
  else morphToTruth(finish);
  if (auto) els.timerBlock.hidden = true;
}

function showScore(round) {
  if (game.phase !== "result") return;
  const drawn = round.sketch && round.sketch.length >= 2;
  els.resultScore.textContent = String(round.score);
  els.statReal.textContent = formatKm(round.pair.km);
  els.statUser.textContent = drawn ? formatKm(lineKm(round.sketch)) : "—";
  els.statError.textContent = Number.isFinite(round.km) ? formatKm(round.km) : "—";
  els.btnNext.textContent = game.index + 1 >= game.rounds ? "Voir le bilan" : "Manche suivante";
  els.viewToggle.hidden = true;
  els.result.hidden = false;
}

function placeEndValidate() {
  const group = els.endActions;
  const round = game.current;
  const sketch = round && round.sketch;
  const show = group
    && !isCompact()
    && game.phase === "draw"
    && round
    && round.ready
    && sketch
    && sketch.length >= 2;
  if (!show) {
    if (group) group.hidden = true;
    return;
  }
  const end = view.projection(sketch[sketch.length - 1]);
  if (!end) {
    group.hidden = true;
    return;
  }
  let dx = 0;
  let dy = -1;
  for (let i = sketch.length - 2; i >= 0; i -= 1) {
    const prev = view.projection(sketch[i]);
    if (!prev) continue;
    const stepX = end[0] - prev[0];
    const stepY = end[1] - prev[1];
    if (Math.hypot(stepX, stepY) < 12) continue;
    dx = stepX;
    dy = stepY;
    break;
  }
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  group.hidden = false;
  const width = group.offsetWidth || 96;
  const height = group.offsetHeight || 26;
  const reach = Math.abs(nx) * width / 2 + Math.abs(ny) * height / 2;
  const offset = reach + 18;
  const candidates = [
    [end[0] + nx * offset, end[1] + ny * offset],
    [end[0] - nx * offset, end[1] - ny * offset],
  ];
  const room = (point) => Math.min(
    point[0] - width / 2,
    view.width - point[0] - width / 2,
    point[1] - height / 2,
    view.height - point[1] - height / 2,
  );
  const blocked = (point) => {
    const box = {
      left: point[0] - width / 2,
      right: point[0] + width / 2,
      top: point[1] - height / 2,
      bottom: point[1] + height / 2,
    };
    return [els.viewToggle, els.chrome, els.historyWrap].some((node) => {
      if (!node || node.hidden) return false;
      const rect = node.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return false;
      return box.right > rect.left && box.left < rect.right && box.bottom > rect.top && box.top < rect.bottom;
    });
  };
  const spot = candidates.sort((a, b) => {
    const block = Number(blocked(a)) - Number(blocked(b));
    if (block) return block;
    return room(b) - room(a);
  })[0];
  group.style.left = `${spot[0]}px`;
  group.style.top = `${spot[1]}px`;
}

function formatKm(km) {
  if (!Number.isFinite(km)) return "—";
  const text = km < 10
    ? km.toFixed(1).replace(".", ",")
    : Math.round(km).toLocaleString("fr-FR");
  return `${text}\u00a0km`;
}

function grade(round) {
  const truth = projectLine(round.pair.line);
  const sketch = projectLine(round.sketch);
  if (sketch.length < 2 || truth.length < 2) return { score: 0, km: null, lengthRatio: null };
  const user = resample(sketch, 7);
  const real = resample(truth, 7);
  const borderPx = pathLength(real);
  const userPx = pathLength(user);
  if (borderPx < 1 || userPx < 1) return { score: 0, km: null, lengthRatio: null };
  const error = (meanDistance(user, real) + meanDistance(real, user)) / 2;
  const shape = Math.exp(-(error / borderPx) / SHAPE_TAU);
  const drift = Math.abs(Math.log(userPx / borderPx));
  const length = Math.exp(-Math.max(0, drift - LENGTH_SLACK) / LENGTH_TAU);
  const score = Math.round(Math.max(0, Math.min(100, 100 * shape * length ** LENGTH_WEIGHT)));
  const km = error * EARTH_KM / view.projection.scale();
  return { score, km, lengthRatio: userPx / borderPx };
}

function pathLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return length;
}

function meanDistance(from, to) {
  let sum = 0;
  from.forEach((point) => {
    sum += distanceToLine(point, to);
  });
  return sum / from.length;
}

function distanceToLine(point, line) {
  let best = Infinity;
  for (let i = 1; i < line.length; i += 1) {
    best = Math.min(best, distanceToSegment(point, line[i - 1], line[i]));
  }
  return best;
}

function distanceToSegment(point, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  if (len < 1e-6) return Math.hypot(point[0] - a[0], point[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / len));
  return Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dy));
}

function resample(points, step) {
  if (points.length < 2) return points.slice();
  const out = [points[0].slice()];
  let carry = 0;
  for (let i = 1; i < points.length; i += 1) {
    let ax = points[i - 1][0];
    let ay = points[i - 1][1];
    const bx = points[i][0];
    const by = points[i][1];
    let remain = Math.hypot(bx - ax, by - ay);
    if (remain < 1e-6) continue;
    while (carry + remain >= step) {
      const t = (step - carry) / remain;
      ax += (bx - ax) * t;
      ay += (by - ay) * t;
      out.push([ax, ay]);
      remain = Math.hypot(bx - ax, by - ay);
      carry = 0;
    }
    carry += remain;
  }
  const last = points[points.length - 1];
  const tail = out[out.length - 1];
  if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > 0.5) out.push(last.slice());
  return out;
}

function resampleCount(points, count) {
  if (points.length < 2) return points.slice();
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  if (total < 1) return points.slice();
  return resample(points, total / (count - 1)).slice(0, count);
}

function alignMorph(user, real) {
  const a = resampleCount(user, 72);
  const b = resampleCount(real, 72);
  while (a.length < 72) a.push(a[a.length - 1]);
  while (b.length < 72) b.push(b[b.length - 1]);
  const reversed = b.slice().reverse();
  const cost = (left, right) => left.reduce((sum, point, index) => {
    const other = right[index];
    return sum + (point[0] - other[0]) ** 2 + (point[1] - other[1]) ** 2;
  }, 0);
  return { user: a, real: cost(a, b) <= cost(a, reversed) ? b : reversed };
}

function stopMorph() {
  cancelAnimationFrame(view.morphFrame);
  view.morphFrame = 0;
}

function morphToTruth(done) {
  stopMorph();
  const user = projectLine(game.current.sketch);
  const real = projectLine(game.current.pair.line);
  if (user.length < 2 || real.length < 2) {
    revealTruth(done);
    return;
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    paintTruth();
    done();
    return;
  }
  const aligned = alignMorph(user, real);
  const token = view.token;
  const t0 = performance.now();
  const frame = (now) => {
    if (token !== view.token) return;
    const t = Math.min(1, (now - t0) / 1200);
    const e = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
    const points = aligned.user.map((point, index) => {
      const target = aligned.real[index];
      return [
        point[0] + (target[0] - point[0]) * e,
        point[1] + (target[1] - point[1]) * e,
      ];
    });
    view.truth.attr("d", linePath(points));
    view.truth.attr("stroke-dasharray", null).attr("stroke-dashoffset", null);
    if (t < 1) view.morphFrame = requestAnimationFrame(frame);
    else {
      view.morphFrame = 0;
      paintTruth();
      done();
    }
  };
  view.morphFrame = requestAnimationFrame(frame);
}

function revealTruth(done) {
  paintTruth();
  const node = view.truth.node();
  const length = node.getTotalLength ? node.getTotalLength() : 0;
  if (!length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    done();
    return;
  }
  view.truth.attr("stroke-dasharray", length).attr("stroke-dashoffset", length);
  const token = view.token;
  const t0 = performance.now();
  const frame = (now) => {
    if (token !== view.token) return;
    const t = Math.min(1, (now - t0) / 900);
    const e = 1 - (1 - t) ** 2;
    view.truth.attr("stroke-dashoffset", length * (1 - e));
    if (t < 1) view.morphFrame = requestAnimationFrame(frame);
    else {
      view.morphFrame = 0;
      view.truth.attr("stroke-dasharray", null).attr("stroke-dashoffset", null);
      done();
    }
  };
  view.morphFrame = requestAnimationFrame(frame);
}

function onNext() {
  if (game.phase !== "result") return;
  if (game.index + 1 >= game.rounds) {
    showFinish();
    return;
  }
  game.index += 1;
  beginRound();
}

function showFinish() {
  stopTimer();
  stopMorph();
  game.phase = "finish";
  document.body.classList.remove("is-playing", "is-ready", "is-result");
  document.body.classList.add("is-finish");
  els.chrome.hidden = true;
  els.historyWrap.hidden = true;
  els.endActions.hidden = true;
  const avg = average(game.history);
  els.finalScore.innerHTML = `${avg}<span>/100</span>`;
  els.recap.innerHTML = game.history.map((item) => (
    `<li><p class="finish-recap-name">${escapeHtml(item.label)}</p><p class="finish-recap-score">${item.score}</p></li>`
  )).join("");
  els.finish.hidden = false;
  paintTruth();
}

function average(list) {
  if (!list.length) return 0;
  return Math.round(list.reduce((sum, item) => sum + item.score, 0) / list.length);
}

function renderHistory() {
  const rows = game.history.map((item) => (
    `<li><span>${escapeHtml(item.label)}</span><span class="score-num${item.score >= 75 ? " is-good" : ""}">${item.score}</span></li>`
  )).join("");
  const total = game.history.length
    ? `<li class="score-history-total"><span>Moyenne</span><span class="score-num">${average(game.history)}</span></li>`
    : "";
  els.history.innerHTML = rows + total;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function showIntro() {
  stopTimer();
  stopMorph();
  cancelAnimationFrame(view.flyFrame);
  view.flying = false;
  game.phase = "intro";
  game.current = null;
  document.body.classList.remove("is-playing", "is-result", "is-finish", "is-ready");
  document.body.classList.add("is-intro");
  els.chrome.hidden = true;
  els.historyWrap.hidden = true;
  els.finish.hidden = true;
  els.intro.hidden = false;
  els.scorePop.hidden = true;
  els.scoreInfo.setAttribute("aria-expanded", "false");
  layout();
}

init();
