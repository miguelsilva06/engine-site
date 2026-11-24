/*
 * Engine — site de lançamento. Sem bibliotecas.
 * A escala e as zonas da escada são as da app (lib/components/PhysiologyLadder.tsx).
 */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  // Entrada do topo: um só momento orquestrado.
  setTimeout(function () { document.documentElement.classList.add("ready"); }, 40);

  /* --------------------------- escada do topo ---------------------------- */
  var KNOTS = [0, 0.3, 0.65, 1];
  var ZCOL = ["#94A3B8", "#60A5FA", "#34D399", "#FBBF24", "#F87171"];
  var CP = 350, HR = 168;
  var cuts = [0.55, 0.75, 0.9, 1.05].map(function (p) { return CP * 0.95 * p; });
  var oxs = [Math.min(CP * 0.6, cuts[0] * 0.85), CP * 0.75, CP, CP * 1.15];
  var hrAer = Math.round(HR * 0.85);
  var hxs = [HR * 0.6, hrAer, HR, Math.round(HR * 1.08)];
  var hrCuts = [hrAer * 0.85, hrAer, hrAer + (HR - hrAer) / 2, HR];
  function scale(xs, w) {
    return function (v) {
      if (v <= xs[0]) return 0;
      for (var i = 1; i < 4; i++) if (v <= xs[i]) return (KNOTS[i - 1] + ((v - xs[i - 1]) / (xs[i] - xs[i - 1])) * (KNOTS[i] - KNOTS[i - 1])) * w;
      return w;
    };
  }
  function invert(xs, f) {
    for (var i = 1; i < 4; i++) if (f <= KNOTS[i]) return xs[i - 1] + ((f - KNOTS[i - 1]) / (KNOTS[i] - KNOTS[i - 1])) * (xs[i] - xs[i - 1]);
    return xs[3];
  }
  var ladder = $("#ladder"), line = null, pos = 0.42, held = 0, dragging = false;
  var outW = $("#r-w"), outB = $("#r-b"), outZ = $("#r-z");
  function build() {
    var w = ladder.clientWidth, h = ladder.clientHeight;
    if (!w) return;
    var y1 = 34, y2 = h - 50, TH = 10;
    var track = function (y, xs, cs) {
      var x = scale(xs, w), e = [xs[0]].concat(cs, [xs[3]]), s = "";
      for (var i = 0; i < 5; i++) {
        var x0 = x(e[i]), x1 = x(e[i + 1]);
        s += '<rect x="' + x0.toFixed(1) + '" y="' + y + '" width="' + Math.max(0, x1 - x0 - 2).toFixed(1) + '" height="' + TH + '" rx="5" fill="' + ZCOL[i] + '" opacity="0.75"/>';
      }
      return s;
    };
    var ax = w * KNOTS[1], tx = w * KNOTS[2];
    ladder.innerHTML = '<svg viewBox="0 0 ' + w + " " + h + '" aria-hidden="true">' +
      track(y1, oxs, cuts) + track(y2, hxs, hrCuts) +
      '<text x="0" y="' + (y1 - 12) + '">Power</text><text x="0" y="' + (y2 - 12) + '">Heart rate</text>' +
      '<text x="' + ax + '" y="' + (y2 + 32) + '" text-anchor="middle">aerobic threshold</text>' +
      '<text x="' + tx + '" y="' + (y2 + 32) + '" text-anchor="middle">critical power · ' + CP + " W</text>" +
      '<line x1="' + ax + '" x2="' + ax + '" y1="' + (y1 - 4) + '" y2="' + (y2 + 16) + '" stroke="#2c2c33"/>' +
      '<line x1="' + tx + '" x2="' + tx + '" y1="' + (y1 - 4) + '" y2="' + (y2 + 16) + '" stroke="#2c2c33"/>' +
      '<rect id="scan" x="-1.5" y="' + (y1 - 10) + '" width="3" height="' + (y2 - y1 + 30) + '" rx="1.5" fill="#F5F5F6"/></svg>';
    line = $("#scan", ladder);
    ladder.setAttribute("aria-valuemin", String(Math.round(oxs[0])));
    ladder.setAttribute("aria-valuemax", String(Math.round(oxs[3])));
    paint();
  }
  function paint() {
    if (!line) return;
    var w = ladder.clientWidth;
    line.setAttribute("transform", "translate(" + (pos * w).toFixed(1) + ",0)");
    var watts = invert(oxs, pos), z = 0;
    for (var i = 0; i < cuts.length; i++) if (watts >= cuts[i]) z = i + 1;
    outW.firstChild.nodeValue = Math.round(watts);
    outB.firstChild.nodeValue = Math.round(invert(hxs, pos));
    outZ.textContent = "Z" + (z + 1);
    outZ.style.color = ZCOL[z];
    ladder.setAttribute("aria-valuenow", String(Math.round(watts)));
    ladder.setAttribute("aria-valuetext", Math.round(watts) + " watts, " + Math.round(invert(hxs, pos)) + " beats per minute, zone " + (z + 1));
  }
  if (ladder) {
    build();
    if (window.ResizeObserver) new ResizeObserver(build).observe(ladder);
    // Varrimento sozinho; pára enquanto o visitante mexe e uns segundos depois.
    var t0 = performance.now();
    var tick = function (now) {
      if (!dragging && now > held && !reduce) {
        pos = 0.5 + 0.4 * Math.sin((now - t0) / 2600);
        paint();
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    var sx = 0, sy = 0, decided = false;
    var at = function (e) { var r = ladder.getBoundingClientRect(); pos = clamp((e.clientX - r.left) / r.width, 0, 1); paint(); };
    ladder.addEventListener("pointerdown", function (e) { dragging = true; decided = e.pointerType === "mouse"; sx = e.clientX; sy = e.clientY; if (decided) { ladder.setPointerCapture(e.pointerId); at(e); } });
    ladder.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      if (!decided) {
        var dx = Math.abs(e.clientX - sx), dy = Math.abs(e.clientY - sy);
        if (dx < 4 && dy < 4) return;
        if (dy > dx) { dragging = false; return; }
        decided = true;
        try { ladder.setPointerCapture(e.pointerId); } catch (err) {}
      }
      at(e);
    });
    var release = function () { if (dragging) { dragging = false; held = performance.now() + 4000; t0 = performance.now() + 4000 - Math.asin(clamp((pos - 0.5) / 0.4, -1, 1)) * 2600; } };
    ladder.addEventListener("pointerup", release);
    ladder.addEventListener("pointercancel", release);
    ladder.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" ? 0.01 : e.key === "ArrowLeft" ? -0.01 : 0;
      if (!d) return;
      e.preventDefault();
      pos = clamp(pos + d * (e.shiftKey ? 5 : 1), 0, 1);
      held = performance.now() + 6000;
      paint();
    });
  }

  /* --------------------- a vida muda, o plano também --------------------- */
  // As linhas seguem a app: lib/components/PlanChangesCard.tsx e WorkoutProfileStrip.tsx
  // (cores de zona de lib/metabolicZones.ts).
  var ZC = { Z1: "#94A3B8", Z2: "#60A5FA", Z3: "#34D399", Z4: "#FBBF24", Z5: "#F87171" };
  var ZH = { Z1: 0.3, Z2: 0.45, Z3: 0.6, Z4: 0.75, Z5: 0.88 };
  var DAYS = { 23: "Mon", 24: "Tue", 25: "Wed", 26: "Thu", 27: "Fri", 28: "Sat", 29: "Sun" };
  var vo2 = function (reps, on, warm, cool) {
    var s = [["Z2", warm]];
    for (var i = 0; i < reps; i++) { s.push(["Z5", on]); if (i < reps - 1) s.push(["Z1", on === 4 ? 3 : 2]); }
    s.push(["Z1", cool]);
    return s;
  };
  var BASE = [
    { id: "str", d: 23, sport: "lift", title: "Lower body: back squat 5 × 5, RDL", min: 60 },
    { id: "vo2", d: 24, sport: "bike", title: "VO₂max 5 × 4 min", min: 60, seg: vo2(5, 4, 15, 13) },
    { id: "run", d: 25, sport: "run", title: "Easy run", min: 45, seg: [["Z1", 5], ["Z2", 35], ["Z1", 5]] },
    { id: "spin", d: 26, sport: "bike", title: "Easy spin", min: 60, seg: [["Z1", 10], ["Z2", 45], ["Z1", 5]] },
    { id: "up", d: 27, sport: "lift", title: "Upper body and core", min: 45 },
    { id: "long", d: 28, sport: "bike", title: "Long ride with tempo", min: 180, seg: [["Z1", 15], ["Z2", 60], ["Z3", 20], ["Z2", 40], ["Z3", 20], ["Z2", 15], ["Z1", 10]] }
  ];
  var SCENARIOS = {
    legs: {
      msg: "Squats felt heavy yesterday. RPE 9, not 8.",
      reply: "That's more load than planned, and it lands on the same legs that ride. I moved the VO₂max intervals to Thursday and brought Thursday's easy spin to today. Nothing else changes.",
      changes: {
        vo2: { d: 26, badge: "Moved", diff: "Tue 24 → Thu 26" },
        spin: { d: 24, badge: "Moved", diff: "Thu 26 → Tue 24" }
      }
    },
    sleep: {
      msg: "Slept 5 hours. Early flight.",
      reply: "Your HRV is below its usual range for the second morning, and the night was short. I kept today's session but cut it to 3 intervals: most of the stimulus, much less of the cost. Saturday stays as planned.",
      changes: {
        vo2: { title: "VO₂max 3 × 4 min", min: 45, seg: vo2(3, 4, 12, 15), badge: "Changed", diff: "60 min → 45 min", was: "was: 5 × 4 min" }
      }
    },
    time: {
      msg: "Only 40 minutes today. Work ran late.",
      reply: "Then we keep the part that matters. A shorter warm-up and cool-down, and all 5 intervals at 3 minutes. One short day doesn't need paying back, so the rest of the week stays.",
      changes: {
        vo2: { title: "VO₂max 5 × 3 min", min: 40, seg: vo2(5, 3, 8, 9), badge: "Changed", diff: "60 min → 40 min", was: "was: 5 × 4 min" }
      }
    }
  };
  var fmtMin = function (m) { var h = Math.floor(m / 60), r = m % 60; return h ? (r ? h + " h " + (r < 10 ? "0" : "") + r : h + " h") : m + " min"; };
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  function rowHTML(w) {
    var strip = w.seg ? '<div class="pl-strip" aria-hidden="true">' + w.seg.map(function (s) {
      return '<i style="--f:' + s[1] + ";--z:" + ZC[s[0]] + ";--h:" + ZH[s[0]] + '"></i>';
    }).join("") + "</div>" : "";
    var sportName = { bike: "Bike", run: "Run", lift: "Strength" }[w.sport];
    return '<div class="pl-day"><span>' + DAYS[w.d] + "</span><b>" + w.d + "</b></div>" +
      '<span class="pl-sport ' + w.sport + '"><svg aria-hidden="true"><use href="#i-' + w.sport + '"/></svg><span class="vh">' + sportName + "</span></span>" +
      '<div class="pl-info"><b>' + esc(w.title) + "</b><span>" + esc(w.diff || fmtMin(w.min)) + "</span>" + (w.was ? '<span class="was">' + esc(w.was) + "</span>" : "") + "</div>" +
      (w.badge ? '<span class="pl-badge">' + w.badge + "</span>" : "<span></span>") + strip;
  }
  var aweek = $("#aweek"), msgEl = $("#sc-msg"), replyEl = $("#sc-reply"), tabs = $$("#adapt [role=tab]"), panel = $("#week-panel");
  function show(key, animate) {
    var sc = SCENARIOS[key];
    if (!sc || !aweek) return;
    // Posições antes da troca, para os treinos movidos deslizarem para o novo dia (FLIP).
    var before = {};
    $$(".wo", aweek).forEach(function (el) { before[el.dataset.id] = el.getBoundingClientRect().top; });
    var list = BASE.map(function (w) { var c = sc.changes[w.id]; return c ? Object.assign({}, w, c) : w; })
      .sort(function (a, b) { return a.d - b.d; });
    aweek.innerHTML = "";
    list.forEach(function (w) {
      var li = document.createElement("li");
      li.className = "wo" + (w.badge ? " chg" : "");
      li.dataset.id = w.id;
      li.innerHTML = rowHTML(w);
      aweek.appendChild(li);
    });
    msgEl.textContent = sc.msg;
    replyEl.textContent = sc.reply;
    if (!animate || reduce) return;
    $$(".wo", aweek).forEach(function (el) {
      var id = el.dataset.id, prev = before[id];
      if (!sc.changes[id]) return;
      void el.offsetWidth;
      el.classList.add("fresh");
      if (prev != null && el.animate) {
        var dy = prev - el.getBoundingClientRect().top;
        if (Math.abs(dy) > 2) el.animate([{ transform: "translateY(" + dy + "px)" }, { transform: "none" }], { duration: 650, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
      }
    });
    [msgEl, replyEl].forEach(function (el, k) {
      if (el.animate) el.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 380, delay: k * 140, fill: "backwards", easing: "ease-out" });
    });
  }
  function select(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
    if (focus) tab.focus();
    panel.setAttribute("aria-labelledby", tab.id);
    show(tab.dataset.s, true);
  }
  if (aweek) {
    // A semana de partida já mostra a primeira manhã, sem esperar por interacção.
    show("legs", false);
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { if (t.getAttribute("aria-selected") !== "true") select(t, false); });
      t.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
        if (e.key === "Home") d = -i; else if (e.key === "End") d = tabs.length - 1 - i;
        if (!d) return;
        e.preventDefault();
        select(tabs[(i + d + tabs.length) % tabs.length], true);
      });
    });
  }

  /* ------------------------------ criar conta ---------------------------- */
  // Cria a conta verdadeira da Engine (Supabase Auth, chave pública). A palavra-passe
  // vai directa para o Supabase por HTTPS; esta página não a guarda.
  var form = $("#join-form");
  if (form) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var status = $("#join-status"), btn = $("button", form), cfg = window.ENGINE_CFG || {};
      var email = form.email.value.trim(), password = form.password.value;
      var say = function (t, good) { status.className = "status" + (good ? " good" : ""); status.innerHTML = t; };
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { say("Check the email address."); form.email.focus(); return; }
      if (password.length < 8) { say("Use a password with at least 8 characters."); form.password.focus(); return; }
      if (!form.consent.checked) { say("Tick the box to confirm your age and the terms."); return; }
      btn.disabled = true;
      say("Creating your account…");
      var headers = { "Content-Type": "application/json", apikey: cfg.key, Authorization: "Bearer " + cfg.key };
      var uses = form.uses.value.trim().slice(0, 200) || null, utm = null;
      try { utm = new URLSearchParams(location.search).get("utm_source"); } catch (err) {}
      fetch(cfg.url + "/auth/v1/signup", { method: "POST", headers: headers, body: JSON.stringify({ email: email, password: password, data: { source: "site" } }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
        .then(function (res) {
          if (res.ok) {
            form.reset();
            say("Account created. Check your inbox to confirm your email; the install link follows as founder places open.", true);
            // A lista de fundadores, para saber o que as pessoas usam hoje. Se falhar, a conta fica na mesma.
            fetch(cfg.url + "/rest/v1/waitlist", { method: "POST", headers: Object.assign({ Prefer: "return=minimal" }, headers), body: JSON.stringify({ email: email, lang: "en", uses: uses, utm_source: utm ? utm.slice(0, 60) : null }) }).catch(function () {});
          } else if (res.status === 429) say("Too many attempts. Wait a minute and try again.");
          else if (res.status === 422 || res.status === 400) say(String(res.j.msg || res.j.error_description || "").toLowerCase().indexOf("password") >= 0 ? "That password is too weak. Try a longer one." : "That didn't work. If you already have an account, sign in from the app.");
          else say('It didn\'t go through. Write to <a href="mailto:getengine.app@gmail.com">getengine.app@gmail.com</a>.');
        })
        .catch(function () { say('It didn\'t go through. Write to <a href="mailto:getengine.app@gmail.com">getengine.app@gmail.com</a>.'); })
        .then(function () { btn.disabled = false; });
    });
  }

  /* ------------------------------ coach no site -------------------------- */
  // Respostas de reserva para as perguntas prontas: se o servidor não responder,
  // a pergunta não fica sem resposta.
  var CANNED = {
    "Can I do tomorrow's VO₂max session?": "Yes. Readiness is 70 and resting HR is at its normal, so 5 × 4 min at 410 W (117% of your 350 W critical power) is on. Sleep isn't scored yet: only 2 of 7 nights. Nothing moves unless you say so.",
    "Where does my critical power come from?": "350 W, fitted from two maximal efforts on 14 Oct: 3 min at 450 W and 12 min at 375 W. That gives a W′ of 18.0 kJ and an error band of ±2%, so it is marked measured. From a formula it would say estimated.",
    "How should I fuel Saturday's 3 h ride?": "110 g of carbohydrate about 3 h before (1.5 g/kg at 74 kg), then 70 g an hour on the bike, 210 g in total, with about 750 ml of fluid an hour. The ideal for 3 h is nearer 90 g/h; 70 is your current gut tolerance, and it is trainable. Then 90 g of carbohydrate and 30 g of protein after.",
    "Does it work with my Garmin?": "Yes, through intervals.icu: connect Garmin there and Engine reads your sessions and wellness data. Apple Health, Health Connect and Polar work directly. Wahoo and Suunto are in review.",
    "What does the founder place include?": "Pro features with Premium coach use at €79.99 a year for as long as you stay subscribed, for the first 200 subscribers. Leave your email in the form below and Engine writes when founder places open.",
    "What happens to my data?": "It is hosted in the EU (Ireland), private by default, and you can export or delete everything in the app. The AI coach is off until you turn it on, and one switch turns it off again."
  };
  var log = $("#chat-log"), chatForm = $("#chat-form"), history = [], busy = false;
  // A turbina do cabeçalho do chat só roda enquanto o coach trabalha numa resposta.
  var mark = $("#chat-mark"), chatStatus = $("#chat-status");
  var statusIdle = chatStatus ? chatStatus.textContent : "";
  function working(on) {
    if (mark) mark.classList.toggle("working", on);
    if (chatStatus) chatStatus.textContent = on ? "Reading the numbers…" : statusIdle;
  }
  function bubble(cls, text) {
    var el = document.createElement("div");
    el.className = "m " + cls;
    el.textContent = text || "";
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }
  async function typeOut(el, text) {
    if (reduce) { el.textContent = text; return; }
    var words = text.split(" "), out = "";
    for (var i = 0; i < words.length; i++) {
      out += (i ? " " : "") + words[i];
      el.textContent = out;
      log.scrollTop = log.scrollHeight;
      await wait(22);
    }
  }
  async function ask(q) {
    q = (q || "").trim();
    if (!q || busy) return;
    busy = true;
    working(true);
    // No telemóvel as sugestões ficam por cima do telefone: trazer a conversa para a vista.
    var ph = log.closest(".cphone"), pr = ph && ph.getBoundingClientRect();
    if (pr && (pr.top > window.innerHeight * 0.6 || pr.bottom < 0)) ph.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    bubble("me", q);
    var dots = bubble("coach typing");
    dots.innerHTML = "<i></i><i></i><i></i>";
    var cfg = window.ENGINE_CFG || {}, answer = null, limit = false;
    try {
      var r = await fetch(cfg.url + "/functions/v1/site-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: cfg.key, Authorization: "Bearer " + cfg.key },
        body: JSON.stringify({ message: q, history: history.slice(-6) }),
      });
      if (r.ok) answer = (await r.json()).answer || null;
      else if (r.status === 429) limit = true;
    } catch (err) {}
    if (!answer && CANNED[q]) { await wait(reduce ? 0 : 700); answer = CANNED[q]; }
    if (!answer) answer = limit
      ? "That's today's limit of questions here. Leave your email below and ask the real coach in the app."
      : "I can't answer right now. Try one of the suggested questions, or write to getengine.app@gmail.com.";
    dots.remove();
    await typeOut(bubble("coach"), answer);
    working(false);
    history.push({ role: "user", content: q }, { role: "assistant", content: answer });
    busy = false;
  }
  if (chatForm) {
    chatForm.addEventListener("submit", function (e) { e.preventDefault(); var q = chatForm.q.value; chatForm.q.value = ""; ask(q); });
    $$("#chips button").forEach(function (b) { b.addEventListener("click", function () { ask(b.textContent); }); });
  }
})();

/* "Tudo o que a Engine faz": separadores com avanço automático suave pelas oito áreas.
   Sem JS fica visível o primeiro painel (Endurance), porque já vem com .on no HTML. */
(function () {
  var show = document.getElementById("show");
  if (!show) return;
  var live = Array.prototype.slice.call(show.querySelectorAll('[role="tab"]'));
  if (!live.length) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var holds = { hover: false, focus: false, offscreen: true };

  function panelOf(t) { return document.getElementById(t.getAttribute("aria-controls")); }
  var sliding = [];
  // Troca de ecrã como na app: o novo entra de lado e o anterior sai para o outro (dir 1 = para a frente).
  function select(tab, focus, dir) {
    var prev = current();
    if (focus) tab.focus();
    if (prev === tab) return;
    if (dir == null) dir = live.indexOf(tab) > live.indexOf(prev) ? 1 : -1;
    sliding.forEach(function (a) { a.cancel(); });
    sliding = [];
    live.forEach(function (t) {
      var on = t === tab;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      var p = panelOf(t);
      if (p) { p.classList.toggle("on", on); p.classList.remove("out"); }
    });
    var from = panelOf(prev), to = panelOf(tab);
    var fromIn = from && from.querySelector(".ph-in"), toIn = to && to.querySelector(".ph-in");
    if (!reduce && fromIn && toIn && toIn.animate) {
      from.classList.add("out");
      var opts = { duration: 300, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" };
      var a = toIn.animate([{ transform: "translateX(" + dir * 100 + "%)" }, { transform: "translateX(0)" }], opts);
      var b = fromIn.animate([{ transform: "translateX(0)" }, { transform: "translateX(" + -dir * 100 + "%)" }], opts);
      sliding = [a, b];
      b.onfinish = b.oncancel = function () { from.classList.remove("out"); };
    }
    // Na fila horizontal (telemóvel), mantém a ficha activa à vista sem mexer na página.
    var row = tab.parentNode;
    if (row.scrollWidth > row.clientWidth) {
      var x = row.scrollLeft + tab.getBoundingClientRect().left - row.getBoundingClientRect().left - (row.clientWidth - tab.offsetWidth) / 2;
      row.scrollTo({ left: Math.max(0, x), behavior: reduce ? "auto" : "smooth" });
    }
  }
  function current() { return live.filter(function (t) { return t.getAttribute("aria-selected") === "true"; })[0] || live[0]; }

  // O utilizador manda: um clique, uma tecla ou um toque desligam o avanço automático.
  function takeOver() { show.classList.remove("auto", "paused"); }
  function sync() { show.classList.toggle("paused", holds.hover || holds.focus || holds.offscreen); }

  live.forEach(function (t) {
    t.addEventListener("click", function () { takeOver(); select(t, false); });
  });
  show.querySelector('[role="tablist"]').addEventListener("keydown", function (e) {
    var i = live.indexOf(current()), n = live.length, next = null, dir = null;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") { next = live[(i + 1) % n]; dir = 1; }
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { next = live[(i - 1 + n) % n]; dir = -1; }
    else if (e.key === "Home") next = live[0];
    else if (e.key === "End") next = live[n - 1];
    if (!next) return;
    e.preventDefault();
    takeOver();
    select(next, true, dir);
  });

  // No telemóvel só muda com um toque: o ecrã não desliza sozinho enquanto se lê.
  var narrow = window.matchMedia && window.matchMedia("(max-width: 760px)").matches;
  if (reduce || narrow || !("IntersectionObserver" in window) || live.length < 2) return;
  show.classList.add("auto", "paused");
  show.addEventListener("animationend", function (e) {
    if (e.animationName !== "prog" || !show.classList.contains("auto")) return;
    var i = live.indexOf(current());
    select(live[(i + 1) % live.length], false, 1);
  });
  show.addEventListener("mouseenter", function () { holds.hover = true; sync(); });
  show.addEventListener("mouseleave", function () { holds.hover = false; sync(); });
  show.addEventListener("focusin", function () { holds.focus = true; sync(); });
  show.addEventListener("focusout", function (e) { if (!show.contains(e.relatedTarget)) { holds.focus = false; sync(); } });
  show.addEventListener("touchstart", takeOver, { passive: true });
  // Conta como visível quando parte da secção está na metade central do ecrã (funciona com qualquer altura).
  new IntersectionObserver(function (es) {
    holds.offscreen = !es[0].isIntersecting; sync();
  }, { rootMargin: "-25% 0px -25% 0px" }).observe(show);
})();

/* Turbina do topo: ralenti lento; ao passar o rato (ou com o foco no botão do topo) acelera com suavidade e o arco aceso sobe.
   Só o grupo das pás roda, com transform-origin no centro (CSS). Com movimento reduzido fica parada. */
(function () {
  var box = document.getElementById("turbine"), rotor = document.getElementById("tb-rotor");
  if (!box || !rotor) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var arc = document.getElementById("tb-arc"), out = document.getElementById("tb-rpm"), state = document.getElementById("tb-state");
  var IDLE = 900, HIGH = 3600, rpm = IDLE, target = IDLE, deg = 0, last = 0, raf = 0, visible = true, boostUntil = 0, shown = "";
  var hero = box.closest(".hero-top") || box, cta = document.querySelector(".hero .cta");
  function frame(now) {
    raf = 0;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    var want = boostUntil > now ? HIGH : target;
    rpm += (want - rpm) * (1 - Math.exp(-dt / 0.55));
    deg = (deg + rpm * 0.03 * dt) % 360;
    rotor.style.transform = "rotate(" + deg.toFixed(2) + "deg)";
    var p = (rpm - IDLE) / (HIGH - IDLE);
    if (arc) arc.setAttribute("stroke-dasharray", (195 + 40 * p).toFixed(1) + " 400");
    var label = (want > IDLE ? "revving" : rpm > IDLE + 40 ? "settling" : "idle") + "|" + Math.round(rpm / 10) * 10;
    if (label !== shown) {
      shown = label;
      var parts = label.split("|");
      if (state) state.textContent = parts[0];
      if (out) out.textContent = Number(parts[1]).toLocaleString("en");
    }
    if (visible) raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }
  hero.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") target = HIGH; });
  hero.addEventListener("pointerleave", function () { target = IDLE; });
  if (cta) {
    cta.addEventListener("focusin", function () { target = HIGH; });
    cta.addEventListener("focusout", function () { target = IDLE; });
  }
  // Toque: um impulso curto, depois volta ao ralenti.
  box.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") boostUntil = performance.now() + 1400; });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      if (visible) start(); else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }).observe(box);
  }
  start();
})();
