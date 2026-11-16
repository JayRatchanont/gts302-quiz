(() => {
  const $app = document.getElementById("app");
  const LETTERS = "abcdefgh";
  const SECTIONS = { A: "Section A · Compound sentences", B: "Section B · Complex sentences", C: "Section C · Sentence type identification" };
  const secOf = (t) => (t === "type" ? "C" : ["adv", "xpunct", "rel"].includes(t) ? "B" : "A");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ── storage (safe) ──
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const HKEY = "gts302-history-v1";
  let history = store.get(HKEY, {});
  let mode = store.get("gts302-mode", "exam");

  // ── theme ──
  const root = document.documentElement;
  const savedTheme = store.get("gts302-theme", null);
  if (savedTheme) root.dataset.theme = savedTheme;
  document.getElementById("themeBtn").onclick = () => {
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    store.set("gts302-theme", root.dataset.theme);
  };
  document.getElementById("homeBtn").onclick = () => { location.hash = ""; };

  // Explanations refer to options by their original letters; translate to the displayed (shuffled) letters.
  const remap = (text, order) => {
    const L = (ch) => LETTERS[order.indexOf(LETTERS.indexOf(ch))] || ch;
    return text
      .replace(/\b(Options? )([a-d])\b/g, (_, w, c) => w + L(c))
      .replace(/\(([a-d])\)/g, (_, c) => "(" + L(c) + ")")
      .replace(/\b([a-d]) = /g, (_, c) => L(c) + " = ");
  };
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ── session ──
  let S = null; // { exam, items:[{q, order, n}], answers:{}, submitted, retry }

  function startExam(exam, onlyIdx) {
    const src = exam.questions.map((q, i) => ({ q, i })).filter((x) => !onlyIdx || onlyIdx.includes(x.i));
    const canShuffle = exam.id.startsWith("mock");
    S = {
      exam,
      retry: !!onlyIdx,
      submitted: false,
      answers: {},
      items: src.map((x, k) => {
        const idx = x.q.o.map((_, j) => j);
        const order = canShuffle && x.q.o !== TYPE && !x.q.o.some((o) => /above|A, B/.test(o)) ? shuffle(idx) : idx;
        return { q: x.q, i: x.i, n: k + 1, order };
      }),
    };
    renderExam();
    scrollTo(0, 0);
  }

  // ── HOME ──
  function topicTotals() {
    const tot = {};
    Object.values(history).forEach((runs) => runs.forEach((r) => Object.entries(r.topics).forEach(([t, [c, n]]) => {
      tot[t] = tot[t] || [0, 0]; tot[t][0] += c; tot[t][1] += n;
    })));
    return tot;
  }

  function renderHome() {
    S = null;
    const tot = topicTotals();
    const hasHist = Object.keys(tot).length > 0;
    $app.innerHTML = `
      <h1>Sentence Structure practice</h1>
      <p class="lead">Compound &amp; complex sentences, punctuation, conjunctions, relative clauses and sentence types. Pick a test below — every answer comes with an explanation and the keyword to spot.</p>

      <div class="modebar">
        <div class="seg" role="group" aria-label="Mode">
          <button data-mode="exam" class="${mode === "exam" ? "on" : ""}">Exam mode</button>
          <button data-mode="practice" class="${mode === "practice" ? "on" : ""}">Practice mode</button>
        </div>
      </div>
      <p class="hint">${mode === "exam" ? "Exam mode: answer everything, then submit to see your score, explanations and feedback." : "Practice mode: the answer, explanation and keyword appear as soon as you pick an option."}</p>

      <div class="grid">
        ${EXAMS.map((ex) => {
          const runs = history[ex.id] || [];
          const best = runs.length ? Math.max(...runs.map((r) => Math.round((r.score / r.total) * 100))) : null;
          return `<button class="card exam-card" data-exam="${ex.id}">
            <div class="meta">${ex.badge ? `<span class="pill">${esc(ex.badge)}</span>` : ""}<span>${ex.questions.length} questions</span></div>
            <h3>${esc(ex.title)}</h3>
            <p>${esc(ex.blurb)}</p>
            <div class="meta">${best === null ? "Not attempted yet" : `<span class="pill ${best >= 80 ? "good" : best < 60 ? "bad" : ""}">Best ${best}%</span><span>${runs.length} attempt${runs.length > 1 ? "s" : ""}</span>`}</div>
          </button>`;
        }).join("")}
      </div>

      <h2>Your weak spots (all attempts)</h2>
      ${hasHist ? `<div class="card"><div class="topics">${topicRows(tot)}</div></div>
        <div class="actions"><button class="btn ghost" id="resetBtn">Reset saved progress</button></div>`
        : `<p class="empty">Finish a test to see which topics need work.</p>`}
    `;
    $app.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => { mode = b.dataset.mode; store.set("gts302-mode", mode); renderHome(); }));
    $app.querySelectorAll("[data-exam]").forEach((b) => (b.onclick = () => { location.hash = b.dataset.exam; }));
    const rb = document.getElementById("resetBtn");
    if (rb) rb.onclick = () => { history = {}; store.set(HKEY, history); renderHome(); };
  }

  function topicRows(tot) {
    return Object.entries(tot)
      .map(([t, [c, n]]) => ({ t, c, n, p: Math.round((c / n) * 100) }))
      .sort((a, b) => a.p - b.p)
      .map(({ t, c, n, p }) => `<div class="trow"><span>${esc(TOPICS[t].name)} <span class="topic-tag">· ${c}/${n}</span></span><span class="pct">${p}%</span>
        <div class="bar"><i class="${p >= 80 ? "good" : p >= 60 ? "mid" : "bad"}" style="width:${p}%"></i></div></div>`)
      .join("");
  }

  // ── EXAM ──
  function renderExam() {
    const { exam, items } = S;
    let lastSec = null;
    const sectioned = exam.id !== "slides";
    $app.innerHTML = `
      <h1>${esc(exam.title)}${S.retry ? " · retry missed" : ""}</h1>
      <p class="lead">${esc(exam.blurb)} <span class="pill">${mode === "exam" ? "Exam mode" : "Practice mode"}</span></p>
      ${exam.note ? `<div class="note">${esc(exam.note)}</div>` : ""}
      <div class="progress"><span id="pc">0 / ${items.length}</span><div class="bar"><i id="pb" style="width:0"></i></div></div>
      ${items.map((it, k) => {
        let head = "";
        const sec = secOf(it.q.t);
        if (sectioned && sec !== lastSec) { head = `<div class="section-title">${SECTIONS[sec]}</div>`; lastSec = sec; }
        return head + `<div class="card q" id="q${k}">${qInner(it, k)}</div>`;
      }).join("")}
      <div class="actions" id="actions"></div>
    `;
    bindExam();
    renderActions();
    updateProgress();
  }

  function qInner(it, k) {
    const picked = S.answers[k];
    const reveal = S.submitted || (mode === "practice" && picked !== undefined);
    const q = it.q;
    return `
      <div class="q-head"><span class="q-num">${it.n}.</span><span class="q-text">${esc(q.q)}</span></div>
      ${q.s ? `<div class="quote">“${esc(q.s)}”</div>` : ""}
      <div class="opts">
        ${it.order.map((oi, pos) => {
          let cls = "";
          let tag = "";
          if (reveal) {
            if (oi === q.a) { cls = "right"; tag = picked === oi ? "✓ Your answer" : "✓ Correct answer"; }
            else if (picked === oi) { cls = "wrong"; tag = "✗ Your answer"; }
          } else if (picked === oi) cls = "sel";
          return `<button class="opt ${cls}" data-k="${k}" data-oi="${oi}" ${reveal ? "disabled" : ""}>
            <span class="l">${LETTERS[pos]})</span><span>${esc(q.o[oi])}</span>${tag ? `<span class="tag">${tag}</span>` : ""}</button>`;
        }).join("")}
      </div>
      ${reveal ? `<div class="explain">
        ${picked === undefined ? `<p><span class="pill bad">Not answered</span></p>` : ""}
        <p><strong>Why:</strong> ${esc(remap(q.e, it.order))}</p>
        <span class="kw"><b>Keyword</b>${esc(q.k)}</span>
        <div class="topic-tag" style="margin-top:8px">Topic: ${esc(TOPICS[q.t].name)}</div>
      </div>` : ""}
    `;
  }

  function bindExam() {
    $app.querySelectorAll(".opt").forEach((b) => (b.onclick = () => {
      const k = +b.dataset.k;
      if (S.submitted) return;
      if (mode === "practice" && S.answers[k] !== undefined) return;
      S.answers[k] = +b.dataset.oi;
      const card = document.getElementById("q" + k);
      card.innerHTML = qInner(S.items[k], k);
      bindExam();
      updateProgress();
      renderActions();
    }));
  }

  function updateProgress() {
    const done = Object.keys(S.answers).length;
    const n = S.items.length;
    const pc = document.getElementById("pc");
    if (!pc) return;
    if (mode === "practice" && !S.submitted) {
      const right = S.items.filter((it, k) => S.answers[k] === it.q.a).length;
      pc.textContent = `${done} / ${n} · ${right} correct`;
    } else pc.textContent = `${done} / ${n} answered`;
    document.getElementById("pb").style.width = (done / n) * 100 + "%";
  }

  function renderActions() {
    const el = document.getElementById("actions");
    if (!el) return;
    const done = Object.keys(S.answers).length;
    const n = S.items.length;
    if (S.submitted) { el.innerHTML = ""; return; }
    const label = mode === "practice" ? "See results & feedback" : done < n ? `Submit (${n - done} unanswered)` : "Submit & check answers";
    el.innerHTML = `<button class="btn" id="submitBtn" ${done === 0 ? "disabled" : ""}>${label}</button>
      <button class="btn ghost" id="quitBtn">Back to tests</button>`;
    document.getElementById("submitBtn").onclick = submit;
    document.getElementById("quitBtn").onclick = () => { location.hash = ""; };
  }

  // ── RESULTS ──
  function submit() {
    S.submitted = true;
    const topics = {};
    let score = 0;
    const missed = [];
    S.items.forEach((it, k) => {
      const ok = S.answers[k] === it.q.a;
      topics[it.q.t] = topics[it.q.t] || [0, 0];
      topics[it.q.t][1]++;
      if (ok) { score++; topics[it.q.t][0]++; } else missed.push({ it, k });
    });
    const total = S.items.length;
    if (!S.retry) {
      (history[S.exam.id] = history[S.exam.id] || []).push({ score, total, topics, at: Date.now() });
      store.set(HKEY, history);
    }
    renderResults({ score, total, topics, missed });
    scrollTo(0, 0);
  }

  function verdict(p) {
    if (p >= 90) return ["Excellent — exam ready.", "You clearly know the rules. Do one more mock to make sure it's consistent."];
    if (p >= 80) return ["Strong result.", "A few slips left. Fix the topics below and you're set."];
    if (p >= 60) return ["Getting there.", "The basics are in place, but some rules are still shaky. Focus on the weakest topic first."];
    return ["Needs more review.", "Re-read the tips below, then try the Slide Checkpoint questions before another mock."];
  }

  function renderResults({ score, total, topics, missed }) {
    const p = Math.round((score / total) * 100);
    const [vh, vp] = verdict(p);
    const color = p >= 80 ? "var(--good)" : p >= 60 ? "var(--key)" : "var(--bad)";
    const weak = Object.entries(topics)
      .map(([t, [c, n]]) => ({ t, c, n, p: c / n }))
      .filter((x) => x.c < x.n)
      .sort((a, b) => a.p - b.p);
    const missByTopic = {};
    missed.forEach((m) => (missByTopic[m.it.q.t] = missByTopic[m.it.q.t] || []).push(m));
    const missedIdx = missed.map((m) => m.it.i);

    const shell = document.createElement("div");
    shell.innerHTML = `
      <h1>${esc(S.exam.title)} · results</h1>
      <div class="card score">
        <div class="ring" style="background:conic-gradient(${color} ${p * 3.6}deg, var(--line) 0)"><div>${p}%</div></div>
        <div><h2>${score} / ${total} correct</h2><p><strong>${vh}</strong> ${vp}</p>${S.retry ? `<p class="topic-tag">Retry rounds aren't saved to your history.</p>` : ""}</div>
      </div>

      <h2>Score by topic</h2>
      <div class="card"><div class="topics">${topicRows(topics)}</div></div>

      <h2>What to improve</h2>
      <div class="stack">
        ${weak.length ? weak.map(({ t, c, n }) => {
          const ms = missByTopic[t] || [];
          const kws = [...new Set(ms.map((m) => m.it.q.k))];
          return `<div class="card fb">
            <h3>${esc(TOPICS[t].name)} — ${c}/${n}</h3>
            <p>${esc(TOPICS[t].tip)}</p>
            <div class="missed">Missed: question${ms.length > 1 ? "s" : ""} ${ms.map((m) => `<a href="#" data-jump="${m.k}">${m.it.n}</a>`).join(", ")}</div>
            <div class="kws">${kws.map((k) => `<span>${esc(k)}</span>`).join("")}</div>
          </div>`;
        }).join("") : `<div class="card fb ok"><h3>Perfect score</h3><p>No weak topics in this test. Try another mock with shuffled answers to double-check.</p></div>`}
      </div>

      <div class="actions">
        ${missed.length ? `<button class="btn" id="retryBtn">Retry the ${missed.length} missed</button>` : ""}
        <button class="btn ghost" id="againBtn">Retake full test</button>
        <button class="btn ghost" id="homeBtn2">All tests</button>
      </div>

      <h2>Answer review</h2>
      <div class="filter seg" role="group">
        <button data-f="all" class="on">All</button><button data-f="wrong">Wrong only (${missed.length})</button>
      </div>
      <div id="review">
        ${S.items.map((it, k) => `<div class="card q" id="q${k}" data-ok="${S.answers[k] === it.q.a}">${qInner(it, k)}</div>`).join("")}
      </div>
    `;
    $app.innerHTML = "";
    $app.appendChild(shell);

    const exam = S.exam;
    const r = document.getElementById("retryBtn");
    if (r) r.onclick = () => startExam(exam, missedIdx);
    document.getElementById("againBtn").onclick = () => startExam(exam);
    document.getElementById("homeBtn2").onclick = () => { location.hash = ""; };
    $app.querySelectorAll("[data-jump]").forEach((a) => (a.onclick = (e) => {
      e.preventDefault();
      document.getElementById("q" + a.dataset.jump).scrollIntoView({ behavior: "smooth", block: "center" });
    }));
    $app.querySelectorAll("[data-f]").forEach((b) => (b.onclick = () => {
      $app.querySelectorAll("[data-f]").forEach((x) => x.classList.toggle("on", x === b));
      $app.querySelectorAll("#review .q").forEach((c) => (c.style.display = b.dataset.f === "wrong" && c.dataset.ok === "true" ? "none" : ""));
    }));
  }

  // ── router ──
  function route() {
    const id = location.hash.slice(1);
    const ex = EXAMS.find((e) => e.id === id);
    if (ex) startExam(ex); else renderHome();
  }
  addEventListener("hashchange", route);
  route();
})();
