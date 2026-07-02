(() => {
  "use strict";

  const SITE_VERSION = "20260702-2";
  const QUESTION_REVISION = "c022-exclude-pages-41-63-v1";
  const REPLACED_C022_IDS = new Set(
    Array.from({ length: 20 }, (_, index) => `C022-${String(index + 75).padStart(3, "0")}`)
  );
  const BANK = window.QUESTION_BANK || [];
  const MODULES = {
    C011: "C011 永續發展與 SDGs",
    C012: "C012 全球淨零與 COP",
    C013: "C013 永續金融與碳定價",
    C021: "C021 永續規範與 ISSB",
    C022: "C022 全球永續報告準則",
    C023: "C023 SASB 準則"
  };
  const STORAGE = {
    history: "sustainabilityQuizHistoryV1",
    wrong: "sustainabilityQuizWrongV1",
    coverage: "sustainabilityQuizCoverageV1",
    rotation: "sustainabilityQuizRotationEnabled",
    questionRevision: "sustainabilityQuizQuestionRevision",
    theme: "sustainabilityQuizTheme"
  };
  const state = {
    selectedModules: Object.keys(MODULES),
    isWrongMode: false,
    smartRotation: true,
    mode: "exam",
    count: 25,
    questions: [],
    answers: [],
    current: 0,
    secondsLeft: 2700,
    timerId: null,
    startedAt: null,
    results: null
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const els = {
    home: $("#homeView"),
    quiz: $("#quizView"),
    result: $("#resultView"),
    theme: $("#themeToggle"),
    update: $("#updateButton"),
    versionBadge: $("#versionBadge"),
    versionNumber: $("#versionNumber"),
    versionStatus: $("#versionStatus"),
    count: $("#questionCount"),
    start: $("#startButton"),
    startWrong: $("#startWrongButton"),
    selectAll: $("#selectAllTopics"),
    clearTopics: $("#clearTopics"),
    selectionSummary: $("#selectionSummary"),
    rotationToggle: $("#rotationToggle"),
    rotationStatus: $("#rotationStatus"),
    durationLabel: $("#durationLabel"),
    durationNote: $("#durationNote"),
    wrongPractice: $("#wrongPractice"),
    wrongCount: $("#wrongTopicCount"),
    attempts: $("#attemptStat"),
    average: $("#averageStat"),
    best: $("#bestStat"),
    wrongStat: $("#wrongStat"),
    moduleProgress: $("#moduleProgress"),
    clearHistory: $("#clearHistory"),
    quizMeta: $("#quizMeta"),
    timer: $("#timer"),
    timerText: $("#timerText"),
    progress: $("#quizProgress"),
    questionTopic: $("#questionTopic"),
    difficulty: $("#questionDifficulty"),
    counter: $("#questionCounter"),
    questionText: $("#questionText"),
    options: $("#answerOptions"),
    feedback: $("#practiceFeedback"),
    prev: $("#prevQuestion"),
    next: $("#nextQuestion"),
    palette: $("#questionPalette"),
    answered: $("#answeredCount"),
    exit: $("#exitQuiz"),
    submit: $("#submitQuiz"),
    dialog: $("#confirmDialog"),
    dialogTitle: $("#dialogTitle"),
    dialogMessage: $("#dialogMessage"),
    dialogConfirm: $("#dialogConfirm"),
    scoreRing: $("#scoreRing"),
    scoreValue: $("#scoreValue"),
    resultTitle: $("#resultTitle"),
    resultSummary: $("#resultSummary"),
    breakdown: $("#resultBreakdown"),
    review: $("#reviewList"),
    retry: $("#retryQuiz"),
    backHome: $("#backHome"),
    toast: $("#toast")
  };

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }

  function migrateQuestionRevision() {
    if (localStorage.getItem(STORAGE.questionRevision) === QUESTION_REVISION) return;
    const wrong = readJSON(STORAGE.wrong, []).filter((id) => !REPLACED_C022_IDS.has(id));
    localStorage.setItem(STORAGE.wrong, JSON.stringify(wrong));
    const coverage = readJSON(STORAGE.coverage, {});
    REPLACED_C022_IDS.forEach((id) => delete coverage[id]);
    localStorage.setItem(STORAGE.coverage, JSON.stringify(coverage));
    localStorage.setItem(STORAGE.questionRevision, QUESTION_REVISION);
  }

  function shuffle(items) {
    const array = [...items];
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function showView(name) {
    els.home.hidden = name !== "home";
    els.quiz.hidden = name !== "quiz";
    els.result.hidden = name !== "result";
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE.theme, theme);
    els.theme.setAttribute("aria-label", theme === "dark" ? "切換淺色模式" : "切換深色模式");
  }

  function formatVersion(version) {
    return version.replace(/^(\d{4})(\d{2})(\d{2})(.*)$/, "$1.$2.$3$4");
  }

  function setVersionStatus(status, text, title) {
    els.versionBadge.dataset.status = status;
    els.versionStatus.textContent = text;
    els.versionBadge.title = title;
  }

  async function checkForUpdates(manual = false) {
    if (location.protocol === "file:") {
      setVersionStatus("local", "本機預覽", "本機檔案無法確認線上是否已有更新");
      if (manual) toast("本機預覽不檢查線上版本。");
      return;
    }
    setVersionStatus("checking", "檢查中", "正在向網站確認最新題庫版本");
    try {
      const response = await fetch(`version.json?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Version check failed");
      const { version } = await response.json();
      if (!version || version === SITE_VERSION) {
        setVersionStatus("current", "已確認最新版", `已連線確認目前版本 ${formatVersion(SITE_VERSION)} 為最新版`);
        if (manual) toast("目前已是最新版本。");
        return;
      }
      setVersionStatus("outdated", "發現新版", `目前為 ${formatVersion(SITE_VERSION)}，最新版本為 ${formatVersion(version)}`);
      const reloadKey = `sustainabilityQuizReloadedFor-${version}`;
      if (sessionStorage.getItem(reloadKey)) {
        toast("已有新版，請重新整理頁面。");
        return;
      }
      sessionStorage.setItem(reloadKey, "1");
      const url = new URL(location.href);
      url.searchParams.set("v", version);
      location.replace(url.toString());
    } catch {
      setVersionStatus("error", "無法驗證", "目前無法連線確認最新題庫版本，請稍後再試");
      if (manual) toast("暫時無法檢查更新，請稍後再試。");
    }
  }

  function refreshConfig() {
    state.selectedModules = $$('input[name="topic"]:checked').map((input) => input.value);
    state.mode = $('input[name="mode"]:checked')?.value || "exam";
    state.smartRotation = els.rotationToggle.checked;
    els.rotationStatus.textContent = state.smartRotation ? "已開啟" : "已關閉";
    state.count = Number(els.count.value);
    if (state.isWrongMode) {
      const available = readJSON(STORAGE.wrong, []).length;
      state.count = Math.min(state.count, available);
    }
    els.selectionSummary.textContent = state.selectedModules.length
      ? `已選 ${state.selectedModules.length} 科 · 可用 ${state.selectedModules.length * 100} 題`
      : "尚未選擇講義";
    const timed = state.mode === "exam";
    els.durationLabel.textContent = timed ? "45 分鐘" : "不限時間";
    els.durationNote.textContent = timed ? "時間到自動交卷" : "作答後立即看解析";
  }

  function rankedByCoverage(pool) {
    const coverage = readJSON(STORAGE.coverage, {});
    return shuffle(pool).sort((a, b) => {
      const left = coverage[a.id] || { count: 0, lastSeen: 0 };
      const right = coverage[b.id] || { count: 0, lastSeen: 0 };
      return left.count - right.count || left.lastSeen - right.lastSeen;
    });
  }

  function recordCoverage(questions) {
    if (state.isWrongMode || !state.smartRotation) return;
    const coverage = readJSON(STORAGE.coverage, {});
    const now = Date.now();
    questions.forEach((question, index) => {
      const previous = coverage[question.id] || { count: 0, lastSeen: 0 };
      coverage[question.id] = { count: previous.count + 1, lastSeen: now + index };
    });
    localStorage.setItem(STORAGE.coverage, JSON.stringify(coverage));
  }

  function chooseQuestions() {
    const wrongIds = readJSON(STORAGE.wrong, []);
    if (state.isWrongMode) {
      return shuffle(BANK.filter((q) => wrongIds.includes(q.id))).slice(0, state.count);
    }
    const coverage = readJSON(STORAGE.coverage, {});
    const moduleExposure = (module) => BANK
      .filter((question) => question.module === module)
      .reduce((total, question) => total + (coverage[question.id]?.count || 0), 0);
    const modules = shuffle(state.selectedModules);
    if (state.smartRotation) {
      modules.sort((left, right) => moduleExposure(left) - moduleExposure(right));
    }
    const base = Math.floor(state.count / modules.length);
    let remainder = state.count % modules.length;
    const selected = [];
    modules.forEach((module) => {
      const take = base + (remainder-- > 0 ? 1 : 0);
      const pool = BANK.filter((q) => q.module === module);
      const candidates = state.smartRotation ? rankedByCoverage(pool) : shuffle(pool);
      selected.push(...candidates.slice(0, take));
    });
    return shuffle(selected);
  }

  function prepareQuestion(q) {
    const indexed = q.options.map((text, index) => ({ text, correct: index === q.answer }));
    return { ...q, runtimeOptions: shuffle(indexed) };
  }

  function startQuiz() {
    refreshConfig();
    if (!state.isWrongMode && !state.selectedModules.length) {
      toast("請至少選擇一份講義。");
      return;
    }
    const selected = chooseQuestions();
    if (!selected.length) {
      toast("目前沒有可用的錯題，先完成一回測驗吧。");
      return;
    }
    recordCoverage(selected);
    state.questions = selected.map(prepareQuestion);
    state.answers = Array(state.questions.length).fill(null);
    state.current = 0;
    state.secondsLeft = 45 * 60;
    state.startedAt = Date.now();
    state.results = null;
    clearInterval(state.timerId);
    if (state.mode === "exam") state.timerId = setInterval(tick, 1000);
    const scopeLabel = state.isWrongMode
      ? "錯題特訓"
      : state.selectedModules.length === 1
        ? MODULES[state.selectedModules[0]]
        : `${state.selectedModules.length} 科綜合`;
    const drawLabel = state.isWrongMode ? "錯題抽選" : state.smartRotation ? "智慧輪替" : "隨機抽題";
    els.quizMeta.textContent = `${scopeLabel} · ${drawLabel} · ${state.mode === "exam" ? "正式模擬" : "即時練習"}`;
    els.timer.hidden = state.mode !== "exam";
    renderPalette();
    renderQuestion();
    updateTimer();
    showView("quiz");
  }

  function renderQuestion() {
    const q = state.questions[state.current];
    const selected = state.answers[state.current];
    const answeredCount = state.answers.filter((answer) => answer !== null).length;
    els.questionTopic.textContent = q.module;
    els.difficulty.textContent = q.difficulty;
    els.counter.textContent = `QUESTION ${state.current + 1} / ${state.questions.length}`;
    els.questionText.textContent = q.question;
    els.progress.style.width = `${((state.current + 1) / state.questions.length) * 100}%`;
    els.answered.textContent = `${answeredCount} / ${state.questions.length}`;
    els.prev.disabled = state.current === 0;
    els.next.textContent = state.current === state.questions.length - 1 ? "前往交卷 →" : "下一題 →";
    els.feedback.hidden = true;
    els.options.innerHTML = "";
    const locked = state.mode === "practice" && selected !== null;
    q.runtimeOptions.forEach((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "answer-option";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", selected === index ? "true" : "false");
      button.innerHTML = `<span class="option-letter">${String.fromCharCode(65 + index)}</span><span>${escapeHTML(option.text)}</span>`;
      if (selected === index) button.classList.add("selected");
      if (locked && option.correct) button.classList.add("correct");
      if (locked && selected === index && !option.correct) button.classList.add("wrong");
      button.addEventListener("click", () => selectAnswer(index));
      els.options.appendChild(button);
    });
    if (locked) showPracticeFeedback(q, selected);
    updatePalette();
    requestAnimationFrame(() => els.questionText.focus({ preventScroll: true }));
  }

  function selectAnswer(index) {
    if (state.mode === "practice" && state.answers[state.current] !== null) return;
    state.answers[state.current] = index;
    renderQuestion();
  }

  function showPracticeFeedback(q, selected) {
    const correct = q.runtimeOptions[selected]?.correct;
    els.feedback.hidden = false;
    els.feedback.innerHTML = `<strong>${correct ? "答對了" : "這題答錯了"}</strong><p>${escapeHTML(q.explanation)} <span class="source">（${q.module} 講義第 ${q.page} 頁）</span></p>`;
  }

  function renderPalette() {
    els.palette.innerHTML = "";
    state.questions.forEach((_, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "palette-button";
      button.textContent = index + 1;
      button.setAttribute("aria-label", `前往第 ${index + 1} 題`);
      button.addEventListener("click", () => {
        state.current = index;
        renderQuestion();
      });
      els.palette.appendChild(button);
    });
  }

  function updatePalette() {
    $$(".palette-button").forEach((button, index) => {
      button.classList.toggle("answered", state.answers[index] !== null);
      button.classList.toggle("current", index === state.current);
      button.setAttribute("aria-current", index === state.current ? "true" : "false");
    });
  }

  function moveQuestion(direction) {
    const next = state.current + direction;
    if (next >= state.questions.length) {
      confirmSubmit();
      return;
    }
    if (next >= 0) {
      state.current = next;
      renderQuestion();
    }
  }

  function tick() {
    state.secondsLeft -= 1;
    updateTimer();
    if (state.secondsLeft <= 0) {
      clearInterval(state.timerId);
      toast("時間到，系統已自動交卷。");
      finishQuiz(true);
    }
  }

  function updateTimer() {
    const minutes = Math.floor(Math.max(0, state.secondsLeft) / 60);
    const seconds = Math.max(0, state.secondsLeft) % 60;
    els.timerText.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    els.timer.classList.toggle("warning", state.secondsLeft <= 300);
  }

  function confirmSubmit() {
    const unanswered = state.answers.filter((answer) => answer === null).length;
    els.dialogTitle.textContent = "確定要交卷嗎？";
    els.dialogMessage.textContent = unanswered ? `還有 ${unanswered} 題尚未作答，交卷後將無法修改。` : "所有題目都已作答，準備查看結果。";
    els.dialogConfirm.textContent = "確定交卷";
    els.dialog.returnValue = "";
    els.dialog.showModal();
  }

  function confirmExit() {
    els.dialogTitle.textContent = "要離開這次測驗嗎？";
    els.dialogMessage.textContent = "目前作答內容不會保存。";
    els.dialogConfirm.textContent = "確定離開";
    els.dialog.returnValue = "";
    els.dialog.showModal();
    els.dialog.dataset.action = "exit";
  }

  function finishQuiz(autoSubmitted = false) {
    clearInterval(state.timerId);
    const details = state.questions.map((q, index) => {
      const choice = state.answers[index];
      const correct = choice !== null && q.runtimeOptions[choice].correct;
      return { q, choice, correct };
    });
    const correctCount = details.filter((d) => d.correct).length;
    const score = Math.round((correctCount / details.length) * 100);
    const elapsed = state.mode === "exam" ? (45 * 60 - state.secondsLeft) : Math.round((Date.now() - state.startedAt) / 1000);
    state.results = { details, correctCount, score, elapsed, autoSubmitted };
    saveResult();
    renderResult();
    showView("result");
  }

  function saveResult() {
    const history = readJSON(STORAGE.history, []);
    history.unshift({
      date: new Date().toISOString(),
      topic: state.isWrongMode ? "WRONG" : state.selectedModules.length === 1 ? state.selectedModules[0] : "MULTI",
      topics: state.isWrongMode ? [] : [...state.selectedModules],
      mode: state.mode,
      score: state.results.score,
      correct: state.results.correctCount,
      total: state.questions.length,
      elapsed: state.results.elapsed,
      modules: moduleScores(state.results.details)
    });
    localStorage.setItem(STORAGE.history, JSON.stringify(history.slice(0, 50)));
    const wrong = new Set(readJSON(STORAGE.wrong, []));
    state.results.details.forEach(({ q, correct }) => correct ? wrong.delete(q.id) : wrong.add(q.id));
    localStorage.setItem(STORAGE.wrong, JSON.stringify([...wrong]));
  }

  function moduleScores(details) {
    return Object.keys(MODULES).reduce((acc, module) => {
      const subset = details.filter((d) => d.q.module === module);
      if (subset.length) acc[module] = { correct: subset.filter((d) => d.correct).length, total: subset.length };
      return acc;
    }, {});
  }

  function renderResult() {
    const { score, correctCount, details, elapsed, autoSubmitted } = state.results;
    els.scoreRing.style.setProperty("--score", score);
    els.scoreValue.textContent = score;
    els.resultTitle.textContent = score >= 80 ? "表現出色，繼續保持！" : score >= 60 ? "已掌握基礎，再補幾個缺口。" : "找到弱點，就是進步的起點。";
    const elapsedText = `${Math.floor(elapsed / 60)} 分 ${elapsed % 60} 秒`;
    els.resultSummary.textContent = `${autoSubmitted ? "時間到自動交卷。" : ""}答對 ${correctCount}／${details.length} 題，作答時間 ${elapsedText}。`;
    const scores = moduleScores(details);
    els.breakdown.innerHTML = Object.entries(scores).map(([module, value]) => {
      const pct = Math.round(value.correct / value.total * 100);
      return `<article class="breakdown-card"><header><strong>${module}</strong><span>${pct}%</span></header><div class="mini-track"><span style="width:${pct}%"></span></div><small>${value.correct} / ${value.total} 題</small></article>`;
    }).join("");
    renderReview("all");
    updateDashboard();
  }

  function renderReview(filter) {
    const details = state.results.details.filter((d) => filter !== "wrong" || !d.correct);
    if (!details.length) {
      els.review.innerHTML = `<p class="empty-state">這次沒有錯題，漂亮的滿分收尾。</p>`;
      return;
    }
    els.review.innerHTML = details.map(({ q, choice, correct }, index) => {
      const chosen = choice === null ? "未作答" : q.runtimeOptions[choice].text;
      const correctOption = q.runtimeOptions.find((option) => option.correct)?.text;
      return `<article class="review-item ${correct ? "correct-review" : "wrong-review"}">
        <header><h3>${index + 1}. ${escapeHTML(q.question)}</h3><span class="review-status">${correct ? "✓ 答對" : "✕ 答錯"}</span></header>
        <div class="answer-lines"><span>你的答案：${escapeHTML(chosen)}</span>${correct ? "" : `<span>正確答案：${escapeHTML(correctOption)}</span>`}</div>
        <p class="explanation">${escapeHTML(q.explanation)}</p>
        <span class="source">來源：${q.module} 講義第 ${q.page} 頁 · ${escapeHTML(q.topic)}</span>
      </article>`;
    }).join("");
  }

  function updateDashboard() {
    const history = readJSON(STORAGE.history, []);
    const wrong = readJSON(STORAGE.wrong, []);
    els.attempts.textContent = history.length;
    els.average.textContent = history.length ? `${Math.round(history.reduce((sum, item) => sum + item.score, 0) / history.length)}%` : "—";
    els.best.textContent = history.length ? Math.max(...history.map((item) => item.score)) : "—";
    els.wrongStat.textContent = wrong.length;
    els.wrongPractice.hidden = wrong.length === 0;
    els.wrongCount.textContent = `${wrong.length} 題待複習，答對後自動移除`;
    els.moduleProgress.innerHTML = Object.entries(MODULES).map(([module, label]) => {
      let correct = 0, total = 0;
      history.forEach((item) => {
        const score = item.modules?.[module];
        if (score) { correct += score.correct; total += score.total; }
      });
      const pct = total ? Math.round(correct / total * 100) : 0;
      return `<article class="module-row"><header><strong>${module}</strong><span>${total ? `${pct}% · ${correct}/${total}` : "尚無紀錄"}</span></header><div class="mini-track"><span style="width:${pct}%"></span></div><small>${label.replace(module + " ", "")}</small></article>`;
    }).join("");
  }

  function clearHistory() {
    if (!confirm("確定清除所有測驗紀錄與錯題嗎？")) return;
    localStorage.removeItem(STORAGE.history);
    localStorage.removeItem(STORAGE.wrong);
    localStorage.removeItem(STORAGE.coverage);
    state.isWrongMode = false;
    updateDashboard();
    toast("學習紀錄、錯題與輪替進度已清除。");
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => els.toast.classList.remove("show"), 2400);
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[char]);
  }

  function bindEvents() {
    els.theme.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
    els.update.addEventListener("click", () => checkForUpdates(true));
    $$('input[name="topic"], input[name="mode"]').forEach((input) => input.addEventListener("change", refreshConfig));
    els.rotationToggle.addEventListener("change", () => {
      localStorage.setItem(STORAGE.rotation, String(els.rotationToggle.checked));
      refreshConfig();
    });
    els.selectAll.addEventListener("click", () => {
      $$('input[name="topic"]').forEach((input) => { input.checked = true; });
      refreshConfig();
    });
    els.clearTopics.addEventListener("click", () => {
      $$('input[name="topic"]').forEach((input) => { input.checked = false; });
      refreshConfig();
    });
    els.count.addEventListener("change", refreshConfig);
    els.start.addEventListener("click", () => {
      state.isWrongMode = false;
      startQuiz();
    });
    els.startWrong.addEventListener("click", () => {
      state.isWrongMode = true;
      startQuiz();
    });
    els.prev.addEventListener("click", () => moveQuestion(-1));
    els.next.addEventListener("click", () => moveQuestion(1));
    els.submit.addEventListener("click", confirmSubmit);
    els.exit.addEventListener("click", confirmExit);
    els.dialog.addEventListener("close", () => {
      if (els.dialog.returnValue !== "confirm") { delete els.dialog.dataset.action; return; }
      if (els.dialog.dataset.action === "exit") {
        clearInterval(state.timerId);
        showView("home");
      } else {
        finishQuiz(false);
      }
      delete els.dialog.dataset.action;
    });
    els.retry.addEventListener("click", startQuiz);
    els.backHome.addEventListener("click", () => {
      state.isWrongMode = false;
      showView("home");
    });
    els.clearHistory.addEventListener("click", clearHistory);
    $$(".filter-button").forEach((button) => button.addEventListener("click", () => {
      $$(".filter-button").forEach((b) => b.classList.toggle("active", b === button));
      renderReview(button.dataset.filter);
    }));
    window.addEventListener("beforeunload", (event) => {
      if (!els.quiz.hidden && state.questions.length) event.preventDefault();
    });
  }

  function init() {
    setTheme(localStorage.getItem(STORAGE.theme) || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
    els.versionNumber.textContent = formatVersion(SITE_VERSION);
    migrateQuestionRevision();
    els.rotationToggle.checked = localStorage.getItem(STORAGE.rotation) !== "false";
    bindEvents();
    refreshConfig();
    updateDashboard();
    checkForUpdates(false);
    if (BANK.length !== 600) console.warn(`題庫數量目前為 ${BANK.length}，預期為 600。`);
  }

  init();
})();
