/* English Practice Cards — one lesson page. Data comes from <script id="lesson">. */
(function () {
  "use strict";
  const L = JSON.parse(document.getElementById("lesson").textContent);
  const C = L.clips;                      // audio file names, made by lib/webpage.py
  const app = document.getElementById("app");
  const LETTERS = "ABC";
  const KEY = "epc-v1";

  // ---------- tiny helpers ----------
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(kid));
    return el;
  };
  const slug = w => w.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const state = store.get();
  state.days = state.days || {};
  const mine = state.days[L.day] = state.days[L.day] || {};
  const save = () => store.set(state);

  // ---------- audio: one player, the pressed button shows "playing" ----------
  const player = new Audio();
  let activeBtn = null;
  const stopUI = () => { if (activeBtn) activeBtn.classList.remove("playing"); activeBtn = null; };
  player.addEventListener("ended", stopUI);
  player.addEventListener("pause", stopUI);
  function play(src, btn) {
    if (activeBtn === btn && !player.paused) { player.pause(); return; }
    player.pause();
    player.src = src;
    player.currentTime = 0;
    player.play().catch(() => {});
    stopUI();
    if (btn) { btn.classList.add("playing"); activeBtn = btn; }
  }
  const clip = name => "audio/" + name;

  // ---------- recording (practice: hear yourself next to the model) ----------
  const canRecord = !!(navigator.mediaDevices && window.MediaRecorder);
  let rec = null;
  function recordButton(i) {
    const mineBtn = h("button", { class: "btn mine", hidden: true, "aria-label": "Escuchar mi voz" }, "👂 Mi voz");
    const recBtn = h("button", { class: "btn rec", "aria-label": "Grabar mi voz" }, "🎤 Grábate");
    let url = null;
    recBtn.addEventListener("click", async () => {
      if (rec && rec.state === "recording") { rec.stop(); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const chunks = [];
        rec = new MediaRecorder(stream);
        rec.ondataavailable = e => chunks.push(e.data);
        rec.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          recBtn.classList.remove("on"); recBtn.textContent = "🎤 Otra vez";
          if (url) URL.revokeObjectURL(url);
          url = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType }));
          mineBtn.hidden = false;
          play(url, mineBtn);
        };
        rec.start();
        recBtn.classList.add("on"); recBtn.textContent = "⏹ Parar";
        setTimeout(() => rec && rec.state === "recording" && rec.stop(), 12000);
      } catch (e) {
        recBtn.textContent = "🎤 Sin micrófono";
        recBtn.disabled = true;
      }
    });
    mineBtn.addEventListener("click", () => url && play(url, mineBtn));
    return [recBtn, mineBtn];
  }

  // ---------- header ----------
  const doneCount = () => Object.values(state.days).filter(d => d.done).length;
  const streakEl = h("div", { class: "streak" });
  const paintStreak = () => {
    const n = doneCount();
    streakEl.textContent = n ? `⭐ ${n} ${n === 1 ? "día terminado" : "días terminados"}` : "¡Empecemos!";
  };
  paintStreak();
  app.append(h("header", { class: "top" },
    h("div", { class: "t" }, h("div", { class: "kicker" }, "ENGLISH PRACTICE"), h("h1", {}, L.title), streakEl),
    h("div", { class: "badge" }, "DÍA " + L.day)));

  app.append(h("div", { class: "hero", "aria-hidden": "true" }, (L.hero_emoji || []).map(e => h("span", {}, e))));

  const allBtn = h("button", { class: "playall" },
    h("span", { class: "ic" }, "▶"),
    h("span", {}, "Escucha la lección completa", h("small", {}, "Listen to the whole lesson · " + C.full_len)));
  allBtn.addEventListener("click", () => play(C.full, allBtn));
  app.append(allBtn);

  // ---------- READ ----------
  const hlRe = s => {
    let html = [];
    let rest = s.en;
    const marks = s.highlight.map(m => ({ ...m, re: new RegExp("\\b(" + m.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")\\b", "i") }));
    // split sentence into plain text and tappable highlighted words, in order
    while (rest) {
      let best = null;
      for (const m of marks) {
        const r = m.re.exec(rest);
        if (r && (!best || r.index < best.r.index)) best = { m, r };
      }
      if (!best) { html.push(rest); break; }
      html.push(rest.slice(0, best.r.index));
      const word = best.r[1];
      const span = h("span", { class: "w" + (best.m.color === "red" ? " red" : ""), role: "button", tabindex: "0" }, word);
      const file = C.words[slug(best.m.word)];
      const go = () => file && play(clip(file), span);
      span.addEventListener("click", go);
      span.addEventListener("keydown", e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), go()));
      html.push(span);
      marks.splice(marks.indexOf(best.m), 1);
      rest = rest.slice(best.r.index + word.length);
    }
    return html;
  };
  const esToggle = h("button", { class: "toggle", "aria-pressed": "false" }, "Ver español");
  const readBox = h("section", { class: "box read" },
    esToggle, h("h2", { class: "label" }, "📖 READ"),
    h("p", { class: "hint" }, "Toca ▶ para escuchar. Toca 🐢 para escuchar despacio. Toca una palabra azul."));
  L.read.forEach((s, i) => {
    const normal = h("button", { class: "btn" }, "▶ Escuchar");
    const slow = h("button", { class: "btn" }, "🐢 Despacio");
    normal.addEventListener("click", () => play(clip(C.s[i].n), normal));
    slow.addEventListener("click", () => play(clip(C.s[i].slow), slow));
    readBox.append(h("div", { class: "sent" },
      h("div", { class: "en" }, hlRe(s)),
      h("div", { class: "es" }, L.translation_es[i]),
      h("div", { class: "ctrls" }, normal, slow, canRecord ? recordButton(i) : null)));
  });
  esToggle.addEventListener("click", () => {
    const on = readBox.classList.toggle("show-es");
    esToggle.setAttribute("aria-pressed", on);
    esToggle.textContent = on ? "Ocultar español" : "Ver español";
  });
  app.append(readBox);

  // ---------- vocabulary ----------
  const grid = h("div", { class: "vgrid" });
  L.vocabulary.forEach(v => {
    const card = h("button", { class: "vcard", "aria-label": `${v.en}: ${v.es}` },
      h("span", { class: "i" }, v.icon), h("span", { class: "en" }, v.en), h("span", { class: "es" }, v.es));
    card.addEventListener("click", () => C.words[slug(v.en)] && play(clip(C.words[slug(v.en)]), card));
    grid.append(card);
  });
  app.append(h("section", { class: "box vocab" },
    h("h2", { class: "label" }, "🤝 VOCABULARIO"),
    h("p", { class: "hint" }, "Toca cada palabra y repítela en voz alta."), grid));

  // ---------- ANSWER ----------
  const quiz = mine.quiz = mine.quiz || {};
  const score = h("div", { class: "score" });
  const paintScore = () => {
    const firstTry = Object.values(quiz).filter(x => x === "first").length;
    const answered = Object.keys(quiz).length;
    if (answered === L.questions.length) {
      score.style.display = "block";
      score.textContent = firstTry === answered
        ? `🏆 ¡Perfecto! ${firstTry}/${answered} a la primera.`
        : `👍 ${firstTry}/${answered} a la primera. ¡Bien hecho!`;
    }
  };
  const ansBox = h("section", { class: "box answer" },
    h("h2", { class: "label" }, "✏️ ANSWER"),
    h("p", { class: "hint" }, "Lee otra vez si necesitas. Escoge la mejor respuesta."));
  L.questions.forEach((q, qi) => {
    const fb = h("div", { class: "fb", "aria-live": "polite" });
    const hear = h("button", { class: "mini", "aria-label": "Escuchar la pregunta" }, "▶");
    hear.addEventListener("click", () => play(clip(C.q[qi]), hear));
    let tries = 0;
    const opts = q.options.map((o, oi) => {
      const b = h("button", { class: "opt" }, h("b", {}, LETTERS[oi]), o);
      b.addEventListener("click", () => {
        tries++;
        if (oi === q.answer) {
          b.classList.add("right");
          opts.forEach(x => (x.disabled = true));
          fb.className = "fb ok";
          fb.textContent = tries === 1 ? "¡Correcto! ✅ Correct!" : "¡Eso es! ✅ That's it!";
          quiz[qi] = tries === 1 ? "first" : "later";
          save(); paintScore();
        } else {
          b.classList.add("wrong"); b.disabled = true;
          fb.className = "fb no";
          fb.textContent = "Intenta otra vez. Try again! 🔁";
        }
      });
      return b;
    });
    if (quiz[qi]) {  // already answered on this phone
      opts[q.answer].classList.add("right");
      opts.forEach(x => (x.disabled = true));
      fb.className = "fb ok"; fb.textContent = "¡Correcto! ✅";
    }
    ansBox.append(h("div", { class: "q" },
      h("div", { class: "q-head" }, h("div", { class: "q-text" }, `${qi + 1}. ${q.q}`), hear),
      h("div", { class: "opts" }, opts), fb));
  });
  ansBox.append(score);
  paintScore();
  app.append(ansBox);

  // ---------- TU TURNO ----------
  const answers = mine.turn = mine.turn || [];
  const turnBox = h("section", { class: "box turn" },
    h("h2", { class: "label" }, "💬 TU TURNO"),
    h("p", { class: "hint" }, "Escucha la pregunta, contesta en voz alta y luego escríbela en inglés."));
  const areas = L.your_turn.map((t, i) => {
    const hear = h("button", { class: "mini", "aria-label": "Escuchar la pregunta" }, "▶");
    hear.addEventListener("click", () => play(clip(C.t[i]), hear));
    const ta = h("textarea", { rows: "2", placeholder: "Write your answer…", "aria-label": t });
    ta.value = answers[i] || "";
    ta.addEventListener("input", () => { answers[i] = ta.value; save(); });
    turnBox.append(h("div", { class: "t" }, h("div", { class: "t-head" }, h("div", { class: "t-q" }, `${i + 1}. ${t}`), hear), ta));
    return ta;
  });
  const send = h("button", { class: "send" }, "📲 Enviar mis respuestas por WhatsApp");
  send.addEventListener("click", () => {
    const lines = [`📘 Día ${L.day} – ${L.title} – Tu turno`];
    L.your_turn.forEach((t, i) => lines.push(`${i + 1}. ${t}`, `➡️ ${areas[i].value.trim() || "…"}`));
    const text = encodeURIComponent(lines.join("\n"));
    const num = (window.TEACHER_WHATSAPP || "").replace(/\D/g, "");
    window.open(num ? `https://wa.me/${num}?text=${text}` : `https://wa.me/?text=${text}`, "_blank");
    mine.sent = true; save();
  });
  turnBox.append(send);
  app.append(turnBox);

  // ---------- tip + finish ----------
  app.append(h("div", { class: "tip" }, h("b", {}, L.tip_lang === "es" ? "💡 CONSEJO: " : "💡 TIP: "), L.tip));
  const done = h("button", { class: "done" });
  const paintDone = () => {
    done.disabled = !!mine.done;
    done.textContent = mine.done ? "✅ ¡Día terminado! Nos vemos mañana." : "✅ Terminé el Día " + L.day;
  };
  done.addEventListener("click", () => { mine.done = true; save(); paintDone(); paintStreak(); });
  paintDone();
  app.append(done);
  app.append(h("p", { class: "foot" }, "English Practice Cards · Costa Rica"));
})();
