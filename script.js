const STORAGE_KEYS = {
  generationNumber: "generationNumber",
  generationCooldownStartedAt: "generationCooldownStartedAt",
  lastPlayersList: "lastPlayersList",
  lastGoaliesList: "lastGoaliesList",
  lastGoalieTeams: "lastGoalieTeams",
  lastTeams: "lastTeams",
  settingsState: "settingsState",
  settingsUpdatedAt: "settingsUpdatedAt",
  themeMode: "themeMode",
  swapCount: "swapCount",
  isAuthenticated: "isAuthenticated"
};

const MAX_SWAPS = 3;
const MAX_GENERATIONS = 3;
const RESET_AFTER_HOURS = 6;
const RESET_AFTER_MS = RESET_AFTER_HOURS * 60 * 60 * 1000;

// Инициализация Supabase: сюда нужно вставить Project URL и anon key.
const SUPABASE_URL = "https://cuuwjqtinvnbusuicxwb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_q_2H3WYs_15JzRhMBWcOQA_kqoff1t9";

const presetRestrictions = [
  { id: "preset-1", player1: "Айнур", player2: "Ирек", enabled: true, type: "preset" },
  { id: "preset-2", player1: "Алексей", player2: "Булат", enabled: true, type: "preset" },
  { id: "preset-3", player1: "Алексей", player2: "Артем", enabled: true, type: "preset" }
];

const state = {
  players: [],
  goalies: ["", ""],
  goalieTeams: { dark: "", light: "" },
  teams: { dark: [], light: [] },
  generationNumber: 0,
  generationCooldownStartedAt: null,
  swapCount: 0,
  themeMode: "light",
  settingsPanelOpen: false,
  isAuthenticated: false,
  settingsUpdatedAt: null,
  restrictions: {
    preset: presetRestrictions.map((item) => ({ ...item })),
    custom: []
  }
};

const elements = {};
let supabaseClient = null;
let countdownIntervalId = null;

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  createPlayerInputs();
  bindEvents();
  initializeSupabaseClient();
  loadState();
  startCountdownTimer();
  renderRestrictions();
  applyTheme();
  renderAll();
  updateSettingsPanel();
  updateAuthView();
});

function cacheElements() {
  elements.authScreen = document.getElementById("authScreen");
  elements.appShell = document.getElementById("appShell");
  elements.loginForm = document.getElementById("loginForm");
  elements.loginInput = document.getElementById("loginInput");
  elements.passwordInput = document.getElementById("passwordInput");
  elements.loginButton = document.getElementById("loginButton");
  elements.authMessage = document.getElementById("authMessage");
  elements.logoutButton = document.getElementById("logoutButton");
  elements.telegramInput = document.getElementById("telegramInput");
  elements.fillTelegramButton = document.getElementById("fillTelegramButton");
  elements.goalieInputs = Array.from(document.querySelectorAll(".goalie-input"));
  elements.playersGrid = document.getElementById("playersGrid");
  elements.generateButton = document.getElementById("generateButton");
  elements.exportButton = document.getElementById("exportButton");
  elements.resetButton = document.getElementById("resetButton");
  elements.themeToggle = document.getElementById("themeToggle");
  elements.themeToggleText = document.getElementById("themeToggleText");
  elements.settingsToggle = document.getElementById("settingsToggle");
  elements.settingsOverlay = document.getElementById("settingsOverlay");
  elements.settingsPanel = document.getElementById("settingsPanel");
  elements.settingsClose = document.getElementById("settingsClose");
  elements.restrictionsList = document.getElementById("restrictionsList");
  elements.addRestrictionButton = document.getElementById("addRestrictionButton");
  elements.messageBox = document.getElementById("messageBox");
  elements.generationCounter = document.getElementById("generationCounter");
  elements.generationLimitHint = document.getElementById("generationLimitHint");
  elements.resetLimitHint = document.getElementById("resetLimitHint");
  elements.swapCounter = document.getElementById("swapCounter");
  elements.swapLimitHint = document.getElementById("swapLimitHint");
  elements.darkTeamList = document.getElementById("darkTeamList");
  elements.lightTeamList = document.getElementById("lightTeamList");
  elements.goaliesList = document.getElementById("goaliesList");
  elements.darkSelect = document.getElementById("darkSelect");
  elements.lightSelect = document.getElementById("lightSelect");
  elements.swapButton = document.getElementById("swapButton");
}

function createPlayerInputs() {
  for (let index = 0; index < 20; index += 1) {
    const label = document.createElement("label");
    label.className = "numbered-input";
    label.innerHTML = `
      <span>${index + 1}.</span>
      <input type="text" class="player-input" data-index="${index}" placeholder="Имя полевого игрока">
    `;
    elements.playersGrid.appendChild(label);
  }

  elements.playerInputs = Array.from(document.querySelectorAll(".player-input"));
}

function bindEvents() {
  elements.loginForm.addEventListener("submit", handleLogin);
  elements.loginButton.addEventListener("click", handleLogin);
  elements.logoutButton.addEventListener("click", logout);
  elements.fillTelegramButton.addEventListener("click", fillInputsFromTelegram);
  elements.generateButton.addEventListener("click", generateTeams);
  elements.exportButton.addEventListener("click", handleExport);
  elements.resetButton.addEventListener("click", resetAll);
  elements.themeToggle.addEventListener("click", toggleTheme);
  elements.settingsToggle.addEventListener("click", openSettingsModal);
  elements.settingsClose.addEventListener("click", closeSettingsModal);
  elements.settingsOverlay.addEventListener("click", (event) => {
    if (event.target === elements.settingsOverlay) {
      closeSettingsModal();
    }
  });
  elements.addRestrictionButton.addEventListener("click", addCustomRestriction);
  elements.swapButton.addEventListener("click", swapPlayersBetweenTeams);
  document.addEventListener("keydown", handleGlobalKeydown);

  elements.goalieInputs.forEach((input) => {
    input.addEventListener("input", handleGoalieInputChange);
  });

  elements.playerInputs.forEach((input) => {
    input.addEventListener("input", handlePlayerInputChange);
  });

  elements.loginInput.addEventListener("input", clearAuthMessage);
  elements.passwordInput.addEventListener("input", clearAuthMessage);
}

function initializeSupabaseClient() {
  if (!window.supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY ||
    SUPABASE_URL === "PASTE_SUPABASE_URL_HERE" || SUPABASE_ANON_KEY === "PASTE_SUPABASE_ANON_KEY_HERE") {
    return;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Логин работает через таблицу app_users в Supabase, без регистрации.
async function handleLogin(event) {
  event.preventDefault();

  const login = sanitizeName(elements.loginInput.value);
  const password = sanitizeName(elements.passwordInput.value);

  if (!login || !password) {
    showAuthMessage("Введите логин и пароль", "error");
    return;
  }

  if (!supabaseClient) {
    showAuthMessage("Ошибка подключения к Supabase", "error");
    return;
  }

  if (login !== "admin" || password !== "admin") {
    showAuthMessage("Некорректные данные", "error");
    return;
  }

  elements.loginButton.disabled = true;
  const previousButtonText = elements.loginButton.textContent;
  elements.loginButton.textContent = "Проверка...";
  showAuthMessage("Проверка данных...", "success");

  try {
    const { data, error } = await supabaseClient
      .from("app_users")
      .select("id, login, password")
      .eq("login", "admin")
      .eq("password", "admin")
      .maybeSingle();

    if (error) {
      showAuthMessage("Ошибка подключения к Supabase", "error");
      return;
    }

    if (!data) {
      showAuthMessage("Некорректные данные", "error");
      return;
    }

    completeLogin();
  } catch (error) {
    showAuthMessage("Ошибка подключения к Supabase", "error");
  } finally {
    elements.loginButton.disabled = false;
    elements.loginButton.textContent = previousButtonText;
  }
}

function completeLogin() {
  state.isAuthenticated = true;
  localStorage.setItem(STORAGE_KEYS.isAuthenticated, "true");
  elements.loginInput.value = "";
  elements.passwordInput.value = "";
  showAuthMessage("");
  updateAuthView();
}

function logout() {
  state.isAuthenticated = false;
  localStorage.removeItem(STORAGE_KEYS.isAuthenticated);
  closeSettingsModal();
  updateAuthView();
}

function updateAuthView() {
  document.body.classList.toggle("auth-mode", !state.isAuthenticated);
  document.body.classList.toggle("app-mode", state.isAuthenticated);
  elements.authScreen.hidden = state.isAuthenticated;
  elements.appShell.hidden = !state.isAuthenticated;
  elements.authScreen.classList.toggle("hidden", state.isAuthenticated);
  elements.appShell.classList.toggle("hidden", !state.isAuthenticated);
  elements.authScreen.setAttribute("aria-hidden", String(state.isAuthenticated));
  elements.appShell.setAttribute("aria-hidden", String(!state.isAuthenticated));

  if (!state.isAuthenticated) {
    closeSettingsModal();
    showMessage("", "success");
  }
}

function showAuthMessage(text, type = "") {
  elements.authMessage.textContent = text;
  elements.authMessage.className = type ? `message-box ${type === "error" ? "is-error" : "is-success"}` : "message-box";
}

function clearAuthMessage() {
  showAuthMessage("");
}

function requireAuthentication() {
  if (state.isAuthenticated) {
    return true;
  }

  closeSettingsModal();
  showAuthMessage("Сначала выполните вход", "error");
  updateAuthView();
  return false;
}

function handleGoalieInputChange() {
  if (!requireAuthentication()) {
    return;
  }

  state.goalies = elements.goalieInputs.map((input) => sanitizeName(input.value));
  state.goalieTeams = { dark: "", light: "" };
  saveState();
  renderGoalies();
}

function handlePlayerInputChange() {
  if (!requireAuthentication()) {
    return;
  }

  state.players = collectPlayersFromInputs();
  state.goalieTeams = { dark: "", light: "" };
  state.teams = { dark: [], light: [] };
  state.swapCount = 0;
  clearFieldErrors();
  saveState();
  renderAll();
}

function parseTelegramText(text) {
  const normalizedText = text.replace(/\r/g, "");
  return {
    goalies: extractSectionPlayers(normalizedText, "Вратари", "Полевые").slice(0, 2),
    players: extractSectionPlayers(normalizedText, "Полевые", "Гости").slice(0, 20)
  };
}

function extractSectionPlayers(text, startTitle, stopTitle) {
  const lines = text.split("\n");
  const results = [];
  let insideSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (new RegExp(`^${startTitle}\\s*:?$`, "i").test(line)) {
      insideSection = true;
      continue;
    }

    if (insideSection && stopTitle && new RegExp(`^${stopTitle}\\s*:?$`, "i").test(line)) {
      break;
    }

    if (!insideSection) {
      continue;
    }

    const match = line.match(/^\D*(\d+)\.\s*(.+)$/);
    if (!match || !match[2]) {
      continue;
    }

    const cleanedName = cleanParsedPlayerName(match[2]);
    if (cleanedName) {
      results.push(cleanedName);
    }
  }

  return results;
}

function cleanParsedPlayerName(value) {
  const hasGuestMark = /\(\s*гость\s*\)/i.test(value);
  const withoutGuest = value.replace(/\(\s*гость\s*\)/gi, " ");

  const cleaned = withoutGuest
    .normalize("NFKC")
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji}\uFE0F]/gu, " ")
    .replace(/[^\p{L}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "";
  }

  return hasGuestMark ? `${cleaned} (гость)` : cleaned;
}

function fillInputsFromTelegram() {
  if (!requireAuthentication()) {
    return;
  }

  const parsed = parseTelegramText(elements.telegramInput.value);

  elements.goalieInputs.forEach((input, index) => {
    input.value = parsed.goalies[index] || "";
  });

  elements.playerInputs.forEach((input, index) => {
    input.value = parsed.players[index] || "";
  });

  state.goalies = elements.goalieInputs.map((input) => sanitizeName(input.value));
  state.goalieTeams = assignGoaliesToTeams(state.goalies);
  state.players = collectPlayersFromInputs();
  state.teams = { dark: [], light: [] };
  state.swapCount = 0;
  clearFieldErrors();
  saveState();
  renderAll();
  showMessage("Поля заполнены из Telegram", "success");
}

function collectPlayersFromInputs() {
  return elements.playerInputs.map((input, index) => ({
    originalNumber: index + 1,
    name: sanitizeName(input.value)
  }));
}

function sanitizeName(value) {
  return value.replace(/\s+/g, " ").trim();
}

function validatePlayers() {
  clearFieldErrors();
  const players = collectPlayersFromInputs();
  const emptyIndexes = players
    .filter((player) => !player.name)
    .map((player) => player.originalNumber - 1);

  if (emptyIndexes.length > 0) {
    markEmptyFields(emptyIndexes);
    showMessage("Заполните всех 20 участников", "error");
    return false;
  }

  if (players.filter((player) => player.name).length !== 20) {
    showMessage("Для генерации нужно ровно 20 полевых игроков", "error");
    return false;
  }

  return true;
}

function markEmptyFields(indexes) {
  indexes.forEach((index) => {
    elements.playerInputs[index].parentElement.classList.add("input-empty");
  });
}

function clearFieldErrors() {
  elements.playerInputs.forEach((input) => {
    input.parentElement.classList.remove("input-empty");
  });
}

function shuffleArray(items) {
  const array = [...items];
  for (let index = array.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[randomIndex]] = [array[randomIndex], array[index]];
  }
  return array;
}

// Генерация команд: не больше 3 попыток использования кнопки за сессию.
function generateTeams() {
  if (!requireAuthentication()) {
    return;
  }

  if (state.generationNumber >= MAX_GENERATIONS) {
    ensureGenerationCooldownStarted();
    showMessage("Достигнут лимит генераций: 3 из 3", "error");
    renderActionStates();
    return;
  }

  state.players = collectPlayersFromInputs();
  state.goalies = elements.goalieInputs.map((input) => sanitizeName(input.value));

  if (!validatePlayers()) {
    return;
  }

  let generatedTeams = null;
  const activePlayers = state.players.map((player) => ({ ...player }));

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const shuffledPlayers = shuffleArray(activePlayers);
    const candidateTeams = {
      dark: shuffledPlayers.slice(0, 10),
      light: shuffledPlayers.slice(10, 20)
    };

    // Проверка ограничений: пары из настроек не должны попадать в одну команду.
    if (validateRestrictions(candidateTeams)) {
      generatedTeams = candidateTeams;
      break;
    }
  }

  if (!generatedTeams) {
    showMessage("Не удалось сгенерировать команды с учётом ограничений", "error");
    return;
  }

  state.generationNumber += 1;
  state.swapCount = 0;
  state.teams = generatedTeams;
  state.goalieTeams = assignGoaliesToTeams(state.goalies);
  if (state.generationNumber >= MAX_GENERATIONS) {
    ensureGenerationCooldownStarted();
  }
  saveState();
  renderAll();

  if (state.generationNumber >= MAX_GENERATIONS) {
    showMessage("Достигнут лимит генераций: 3 из 3", "error");
  } else {
    showMessage("Команды успешно сгенерированы", "success");
  }
}

// Проверка ограничений по настройкам.
function validateRestrictions(teams) {
  const activeRestrictions = [...state.restrictions.preset, ...state.restrictions.custom]
    .filter((item) => item.enabled && sanitizeName(item.player1) && sanitizeName(item.player2));

  return !activeRestrictions.some((restriction) => {
    const player1 = normalizeComparisonName(restriction.player1);
    const player2 = normalizeComparisonName(restriction.player2);
    return isPairInSameTeam(teams.dark, player1, player2) || isPairInSameTeam(teams.light, player1, player2);
  });
}

function normalizeComparisonName(name) {
  return sanitizeName(name).toLowerCase();
}

function isPairInSameTeam(team, player1, player2) {
  const names = team.map((player) => normalizeComparisonName(player.name));
  return names.includes(player1) && names.includes(player2);
}

// Логика обменов: только попарный обмен и максимум 3 раза.
function swapPlayersBetweenTeams() {
  if (!requireAuthentication()) {
    return;
  }

  if (!state.teams.dark.length || !state.teams.light.length) {
    showMessage("Сначала сгенерируйте команды", "error");
    return;
  }

  if (state.swapCount >= MAX_SWAPS) {
    showMessage("Доступно не более 3 обменов", "error");
    renderActionStates();
    return;
  }

  const darkValue = elements.darkSelect.value;
  const lightValue = elements.lightSelect.value;

  if (!darkValue || !lightValue) {
    showMessage("Выберите по одному игроку из каждой команды", "error");
    return;
  }

  const darkIndex = state.teams.dark.findIndex((player) => createPlayerKey(player) === darkValue);
  const lightIndex = state.teams.light.findIndex((player) => createPlayerKey(player) === lightValue);

  if (darkIndex === -1 || lightIndex === -1) {
    showMessage("Не удалось найти выбранных игроков", "error");
    return;
  }

  const updatedTeams = {
    dark: state.teams.dark.map((player) => ({ ...player })),
    light: state.teams.light.map((player) => ({ ...player }))
  };

  [updatedTeams.dark[darkIndex], updatedTeams.light[lightIndex]] = [updatedTeams.light[lightIndex], updatedTeams.dark[darkIndex]];

  if (!validateRestrictions(updatedTeams)) {
    showMessage("Этот обмен нарушает настройки", "error");
    return;
  }

  state.teams = updatedTeams;
  state.swapCount += 1;
  saveState();
  renderAll();
  showMessage("Игроки успешно поменяны местами", "success");
}

// Экспорт результата в буфер обмена.
function exportTeamsToText() {
  if (!state.teams.dark.length || !state.teams.light.length) {
    return "";
  }

  const darkTeamText = state.teams.dark.map(formatPlayerForText).join("\n");
  const lightTeamText = state.teams.light.map(formatPlayerForText).join("\n");
  const goaliesText = [
    `Тёмные: ${state.goalieTeams.dark || "-"}`,
    `Светлые: ${state.goalieTeams.light || "-"}`
  ].join("\n");

  return [
    "1 группа тёмные",
    darkTeamText,
    "",
    "2 группа светлые",
    lightTeamText,
    "",
    "Вратари:",
    goaliesText || "1. -\n2. -",
    "",
    `Генерация №${state.generationNumber}`
  ].join("\n");
}

function formatPlayerForText(player) {
  return `${player.originalNumber}. ${player.name}`;
}

function handleExport() {
  if (!requireAuthentication()) {
    return;
  }

  const text = exportTeamsToText();
  if (!text) {
    showMessage("Сначала сгенерируйте команды", "error");
    return;
  }

  asyncCopyText(text)
    .then(() => {
      showMessage("Скопировано", "success");
    })
    .catch(() => {
      showMessage("Не удалось скопировать результат", "error");
    });
}

function asyncCopyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.appendChild(helper);
    helper.focus();
    helper.select();

    const copied = document.execCommand("copy");
    document.body.removeChild(helper);

    if (copied) {
      resolve();
    } else {
      reject(new Error("copy_failed"));
    }
  });
}

function saveState() {
  localStorage.setItem(STORAGE_KEYS.generationNumber, String(state.generationNumber));
  localStorage.setItem(STORAGE_KEYS.generationCooldownStartedAt, state.generationCooldownStartedAt ? String(state.generationCooldownStartedAt) : "");
  localStorage.setItem(STORAGE_KEYS.lastPlayersList, JSON.stringify(state.players));
  localStorage.setItem(STORAGE_KEYS.lastGoaliesList, JSON.stringify(state.goalies));
  localStorage.setItem(STORAGE_KEYS.lastGoalieTeams, JSON.stringify(state.goalieTeams));
  localStorage.setItem(STORAGE_KEYS.lastTeams, JSON.stringify(state.teams));
  localStorage.setItem(STORAGE_KEYS.settingsState, JSON.stringify(serializeRestrictionsForStorage()));
  localStorage.setItem(STORAGE_KEYS.settingsUpdatedAt, state.settingsUpdatedAt ? String(state.settingsUpdatedAt) : "");
  localStorage.setItem(STORAGE_KEYS.themeMode, state.themeMode);
  localStorage.setItem(STORAGE_KEYS.swapCount, String(state.swapCount));
}

function loadState() {
  const storedGenerationNumber = Number(localStorage.getItem(STORAGE_KEYS.generationNumber));
  const storedGenerationCooldownStartedAt = Number(localStorage.getItem(STORAGE_KEYS.generationCooldownStartedAt));
  const storedPlayers = parseJson(localStorage.getItem(STORAGE_KEYS.lastPlayersList), []);
  const storedGoalies = parseJson(localStorage.getItem(STORAGE_KEYS.lastGoaliesList), ["", ""]);
  const storedGoalieTeams = parseJson(localStorage.getItem(STORAGE_KEYS.lastGoalieTeams), { dark: "", light: "" });
  const storedTeams = parseJson(localStorage.getItem(STORAGE_KEYS.lastTeams), { dark: [], light: [] });
  const storedSettings = parseJson(localStorage.getItem(STORAGE_KEYS.settingsState), null);
  const storedSettingsUpdatedAt = Number(localStorage.getItem(STORAGE_KEYS.settingsUpdatedAt));
  const storedTheme = localStorage.getItem(STORAGE_KEYS.themeMode);
  const storedSwapCount = Number(localStorage.getItem(STORAGE_KEYS.swapCount));
  const storedAuth = localStorage.getItem(STORAGE_KEYS.isAuthenticated);

  state.generationNumber = Number.isFinite(storedGenerationNumber) && storedGenerationNumber >= 0 ? storedGenerationNumber : 0;
  state.generationCooldownStartedAt = Number.isFinite(storedGenerationCooldownStartedAt) && storedGenerationCooldownStartedAt > 0
    ? storedGenerationCooldownStartedAt
    : null;
  state.players = normalizeStoredPlayers(storedPlayers);
  state.goalies = normalizeStoredGoalies(storedGoalies);
  state.goalieTeams = normalizeStoredGoalieTeams(storedGoalieTeams);
  state.teams = normalizeStoredTeams(storedTeams);
  state.swapCount = Number.isFinite(storedSwapCount) && storedSwapCount >= 0 ? storedSwapCount : 0;
  state.themeMode = storedTheme === "dark" ? "dark" : "light";
  state.isAuthenticated = storedAuth === "true";
  state.settingsUpdatedAt = Number.isFinite(storedSettingsUpdatedAt) && storedSettingsUpdatedAt > 0
    ? storedSettingsUpdatedAt
    : null;

  if (storedSettings) {
    state.restrictions = mergeStoredRestrictions(storedSettings);
  }

  if (applyAutomaticResets()) {
    saveState();
  }
  populateInputs();
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function normalizeStoredPlayers(players) {
  return Array.from({ length: 20 }, (_, index) => ({
    originalNumber: index + 1,
    name: sanitizeName(players[index]?.name || "")
  }));
}

function normalizeStoredGoalies(goalies) {
  const result = Array.isArray(goalies) ? goalies.slice(0, 2) : ["", ""];
  while (result.length < 2) {
    result.push("");
  }
  return result.map((item) => sanitizeName(item || ""));
}

function normalizeStoredGoalieTeams(goalieTeams) {
  return {
    dark: sanitizeName(goalieTeams?.dark || ""),
    light: sanitizeName(goalieTeams?.light || "")
  };
}

function normalizeStoredTeams(teams) {
  return {
    dark: Array.isArray(teams?.dark) ? teams.dark.map(normalizeTeamPlayer) : [],
    light: Array.isArray(teams?.light) ? teams.light.map(normalizeTeamPlayer) : []
  };
}

function normalizeTeamPlayer(player) {
  return {
    originalNumber: Number(player?.originalNumber) || 0,
    name: sanitizeName(player?.name || "")
  };
}

function mergeStoredRestrictions(storedSettings) {
  const presetMap = new Map(presetRestrictions.map((item) => [item.id, { ...item }]));

  if (Array.isArray(storedSettings.preset)) {
    storedSettings.preset.forEach((item) => {
      if (presetMap.has(item.id)) {
        presetMap.set(item.id, {
          ...presetMap.get(item.id),
          enabled: Boolean(item.enabled)
        });
      }
    });
  }

  const custom = Array.isArray(storedSettings.custom)
    ? storedSettings.custom.map((item) => ({
      id: item.id || `custom-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
      player1: sanitizeName(item.player1 || ""),
      player2: sanitizeName(item.player2 || ""),
      enabled: Boolean(item.enabled),
      type: "custom"
    }))
    : [];

  return {
    preset: Array.from(presetMap.values()),
    custom
  };
}

function applyAutomaticResets() {
  let hasChanges = false;

  if (state.generationCooldownStartedAt && getGenerationCooldownRemainingMs() <= 0) {
    resetGenerationCooldownState();
    hasChanges = true;
  }

  if (state.settingsUpdatedAt && Date.now() - state.settingsUpdatedAt >= RESET_AFTER_MS) {
    resetRestrictionsToDefault();
    hasChanges = true;
  }

  return hasChanges;
}

function resetGenerationCooldownState() {
  state.generationNumber = 0;
  state.generationCooldownStartedAt = null;
  state.swapCount = 0;
}

function resetRestrictionsToDefault() {
  state.restrictions = {
    preset: presetRestrictions.map((item) => ({ ...item })),
    custom: []
  };
  state.settingsUpdatedAt = null;
}

function markSettingsUpdated() {
  state.settingsUpdatedAt = Date.now();
}

function ensureGenerationCooldownStarted() {
  if (!state.generationCooldownStartedAt) {
    state.generationCooldownStartedAt = Date.now();
  }
}

function getGenerationCooldownRemainingMs() {
  if (!state.generationCooldownStartedAt) {
    return 0;
  }

  return Math.max(0, RESET_AFTER_MS - (Date.now() - state.generationCooldownStartedAt));
}

function formatDuration(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function startCountdownTimer() {
  if (countdownIntervalId) {
    window.clearInterval(countdownIntervalId);
  }

  countdownIntervalId = window.setInterval(() => {
    const shouldResetGeneration = state.generationNumber >= MAX_GENERATIONS && getGenerationCooldownRemainingMs() <= 0;
    const shouldResetSettings = state.settingsUpdatedAt && Date.now() - state.settingsUpdatedAt >= RESET_AFTER_MS;

    if (shouldResetGeneration) {
      resetGenerationCooldownState();
      saveState();
      showMessage("Лимит генераций сброшен. Можно генерировать снова", "success");
    }

    if (shouldResetSettings) {
      resetRestrictionsToDefault();
      renderRestrictions();
      saveState();
    }

    renderActionStates();
  }, 1000);
}

function assignGoaliesToTeams(goalies) {
  const activeGoalies = goalies.filter(Boolean);

  if (activeGoalies.length === 0) {
    return { dark: "", light: "" };
  }

  if (activeGoalies.length === 1) {
    return Math.random() < 0.5
      ? { dark: activeGoalies[0], light: "" }
      : { dark: "", light: activeGoalies[0] };
  }

  const shuffledGoalies = shuffleArray(activeGoalies.slice(0, 2));
  return {
    dark: shuffledGoalies[0] || "",
    light: shuffledGoalies[1] || ""
  };
}

function populateInputs() {
  elements.goalieInputs.forEach((input, index) => {
    input.value = state.goalies[index] || "";
  });

  elements.playerInputs.forEach((input, index) => {
    input.value = state.players[index]?.name || "";
  });
}

function applyTheme() {
  document.body.classList.toggle("theme-dark", state.themeMode === "dark");
  elements.themeToggleText.textContent = state.themeMode === "dark" ? "☀️ Светлая тема" : "🌙 Тёмная тема";
}

function toggleTheme() {
  if (!requireAuthentication()) {
    return;
  }

  state.themeMode = state.themeMode === "dark" ? "light" : "dark";
  applyTheme();
  saveState();
}

function openSettingsModal() {
  if (!requireAuthentication()) {
    return;
  }

  state.settingsPanelOpen = true;
  updateSettingsPanel();
}

function closeSettingsModal() {
  state.settingsPanelOpen = false;
  updateSettingsPanel();
}

function updateSettingsPanel() {
  elements.settingsOverlay.classList.toggle("is-hidden", !state.settingsPanelOpen);
  elements.settingsOverlay.setAttribute("aria-hidden", String(!state.settingsPanelOpen));
  document.body.classList.toggle("modal-open", state.settingsPanelOpen);
}

function handleGlobalKeydown(event) {
  if (event.key === "Escape" && state.settingsPanelOpen) {
    closeSettingsModal();
  }
}

function addCustomRestriction() {
  if (!requireAuthentication()) {
    return;
  }

  state.restrictions.custom.push({
    id: `custom-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    player1: "",
    player2: "",
    enabled: true,
    type: "custom"
  });

  markSettingsUpdated();
  renderRestrictions();
  saveState();
}

function renderRestrictions() {
  elements.restrictionsList.innerHTML = "";

  const allRestrictions = [...state.restrictions.preset, ...state.restrictions.custom];

  if (allRestrictions.length === 0) {
    const empty = document.createElement("p");
    empty.className = "panel__hint";
    empty.textContent = "Пары пока не добавлены.";
    elements.restrictionsList.appendChild(empty);
    return;
  }

  allRestrictions.forEach((restriction) => {
    const item = document.createElement("div");
    item.className = "restriction-item";

    if (restriction.type === "preset") {
      renderPresetRestrictionCard(item, restriction);
    } else {
      renderCustomRestrictionCard(item, restriction);
    }

    elements.restrictionsList.appendChild(item);
  });
}

function renderPresetRestrictionCard(container, restriction) {
  container.innerHTML = `
    <div class="restriction-item__header">
      <div class="restriction-item__text">
        <p class="restriction-item__title">${restriction.player1} / ${restriction.player2}</p>
        <div class="restriction-item__meta">Не ставить в одну команду</div>
      </div>
      <label class="checkbox-inline">
        <input type="checkbox" ${restriction.enabled ? "checked" : ""}>
        <span>Активно</span>
      </label>
    </div>
    <div class="restriction-readonly">
      <input type="text" value="${escapeHtml(restriction.player1)}" readonly>
      <input type="text" value="${escapeHtml(restriction.player2)}" readonly>
    </div>
  `;

  const checkbox = container.querySelector("input[type='checkbox']");
  checkbox.addEventListener("change", (event) => {
    restriction.enabled = event.target.checked;
    markSettingsUpdated();
    saveState();
  });
}

function renderCustomRestrictionCard(container, restriction) {
  const isPlayer1Empty = !sanitizeName(restriction.player1);
  const isPlayer2Empty = !sanitizeName(restriction.player2);
  const title = sanitizeName(restriction.player1) && sanitizeName(restriction.player2)
    ? `${restriction.player1} / ${restriction.player2}`
    : "Игрок 1 / Игрок 2";

  container.innerHTML = `
    <div class="restriction-item__header">
      <div class="restriction-item__text">
        <p class="restriction-item__title">${escapeHtml(title)}</p>
        <div class="restriction-item__meta">Не ставить в одну команду</div>
      </div>
      <label class="checkbox-inline">
        <input type="checkbox" data-role="enabled" ${restriction.enabled ? "checked" : ""}>
        <span>Активно</span>
      </label>
    </div>
    <div class="restriction-row">
      <div class="restriction-input-wrap ${isPlayer1Empty ? "is-invalid" : ""}">
        <input type="text" data-role="player1" placeholder="Игрок 1" value="${escapeHtml(restriction.player1)}">
      </div>
      <div class="restriction-input-wrap ${isPlayer2Empty ? "is-invalid" : ""}">
        <input type="text" data-role="player2" placeholder="Игрок 2" value="${escapeHtml(restriction.player2)}">
      </div>
      <div></div>
      <button class="restriction-remove" type="button" data-role="remove">Удалить</button>
    </div>
  `;

  const player1Input = container.querySelector('[data-role="player1"]');
  const player2Input = container.querySelector('[data-role="player2"]');
  const headerToggle = container.querySelector('[data-role="enabled"]');
  const removeButton = container.querySelector('[data-role="remove"]');

  player1Input.addEventListener("input", (event) => {
    restriction.player1 = sanitizeName(event.target.value);
    updateCustomRestrictionCardState(container, restriction);
    markSettingsUpdated();
    saveState();
  });

  player2Input.addEventListener("input", (event) => {
    restriction.player2 = sanitizeName(event.target.value);
    updateCustomRestrictionCardState(container, restriction);
    markSettingsUpdated();
    saveState();
  });

  headerToggle.addEventListener("change", (event) => {
    restriction.enabled = event.target.checked;
    markSettingsUpdated();
    saveState();
  });

  removeButton.addEventListener("click", () => {
    container.classList.add("is-removing");
    window.setTimeout(() => {
      state.restrictions.custom = state.restrictions.custom.filter((itemData) => itemData.id !== restriction.id);
      markSettingsUpdated();
      renderRestrictions();
      saveState();
    }, 180);
  });
}

function updateCustomRestrictionCardState(container, restriction) {
  const titleElement = container.querySelector(".restriction-item__title");
  const player1Wrap = container.querySelectorAll(".restriction-input-wrap")[0];
  const player2Wrap = container.querySelectorAll(".restriction-input-wrap")[1];
  const title = sanitizeName(restriction.player1) && sanitizeName(restriction.player2)
    ? `${restriction.player1} / ${restriction.player2}`
    : "Игрок 1 / Игрок 2";

  titleElement.textContent = title;
  player1Wrap.classList.toggle("is-invalid", !sanitizeName(restriction.player1));
  player2Wrap.classList.toggle("is-invalid", !sanitizeName(restriction.player2));
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function serializeRestrictionsForStorage() {
  return {
    preset: state.restrictions.preset.map((item) => ({
      id: item.id,
      player1: item.player1,
      player2: item.player2,
      enabled: item.enabled,
      type: item.type
    })),
    custom: state.restrictions.custom
      .filter((item) => sanitizeName(item.player1) && sanitizeName(item.player2))
      .map((item) => ({
        id: item.id,
        player1: sanitizeName(item.player1),
        player2: sanitizeName(item.player2),
        enabled: item.enabled,
        type: item.type
      }))
  };
}

function renderAll() {
  renderGoalies();
  renderTeams();
  renderSwapControls();
  renderCounters();
  renderActionStates();
}

function renderGoalies() {
  renderSimpleList(
    elements.goaliesList,
    [
      `Тёмные: ${state.goalieTeams.dark || "-"}`,
      `Светлые: ${state.goalieTeams.light || "-"}`
    ],
    "Вратари пока не указаны"
  );
}

function renderTeams() {
  renderSimpleList(
    elements.darkTeamList,
    state.teams.dark.map(formatPlayerForText),
    "Команда ещё не сгенерирована"
  );

  renderSimpleList(
    elements.lightTeamList,
    state.teams.light.map(formatPlayerForText),
    "Команда ещё не сгенерирована"
  );
}

function renderSimpleList(listElement, items, emptyText) {
  listElement.innerHTML = "";

  if (!items.length) {
    listElement.classList.add("is-empty");
    const item = document.createElement("li");
    item.textContent = emptyText;
    listElement.appendChild(item);
    return;
  }

  listElement.classList.remove("is-empty");
  items.forEach((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    listElement.appendChild(item);
  });
}

function renderSwapControls() {
  fillSelectOptions(elements.darkSelect, state.teams.dark, "Игрок из тёмных");
  fillSelectOptions(elements.lightSelect, state.teams.light, "Игрок из светлых");
}

function fillSelectOptions(select, team, placeholder) {
  select.innerHTML = "";
  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = placeholder;
  select.appendChild(placeholderOption);

  team.forEach((player) => {
    const option = document.createElement("option");
    option.value = createPlayerKey(player);
    option.textContent = formatPlayerForText(player);
    select.appendChild(option);
  });
}

function createPlayerKey(player) {
  return `${player.originalNumber}::${normalizeComparisonName(player.name)}`;
}

function renderCounters() {
  elements.generationCounter.textContent = `Генерация №${state.generationNumber}`;
  elements.swapCounter.textContent = `Использовано обменов: ${state.swapCount} из ${MAX_SWAPS}`;
}

// Блокировка кнопок и пояснения для лимитов.
function renderActionStates() {
  if (state.generationNumber >= MAX_GENERATIONS && getGenerationCooldownRemainingMs() <= 0) {
    resetGenerationCooldownState();
    saveState();
  }

  const generationLimitReached = state.generationNumber >= MAX_GENERATIONS;
  const swapLimitReached = state.swapCount >= MAX_SWAPS;
  const hasTeams = state.teams.dark.length > 0 && state.teams.light.length > 0;
  const remainingText = generationLimitReached
    ? formatDuration(getGenerationCooldownRemainingMs())
    : "";

  elements.generateButton.disabled = generationLimitReached;
  elements.generateButton.title = generationLimitReached ? "Достигнут лимит генераций: 3 из 3" : "";
  elements.generationLimitHint.textContent = generationLimitReached
    ? `Достигнут лимит генераций: 3 из 3. Повторная генерация через ${remainingText}`
    : "Доступно до 3 генераций.";
  elements.generationLimitHint.classList.toggle("is-warning", generationLimitReached);

  elements.resetButton.disabled = generationLimitReached;
  elements.resetButton.title = generationLimitReached ? "Сброс недоступен после достижения лимита генераций" : "";
  elements.resetLimitHint.textContent = generationLimitReached
    ? `Сброс недоступен после достижения лимита генераций. Повторно через ${remainingText}`
    : "";
  elements.resetLimitHint.classList.toggle("is-warning", generationLimitReached);

  elements.swapButton.disabled = !hasTeams || swapLimitReached;
  elements.swapButton.title = swapLimitReached ? "Лимит обменов достигнут" : "";
  elements.swapLimitHint.textContent = swapLimitReached
    ? "Лимит обменов достигнут"
    : "Доступно до 3 обменов после генерации.";
  elements.swapLimitHint.classList.toggle("is-warning", swapLimitReached);
}

function resetAll() {
  if (!requireAuthentication()) {
    return;
  }

  if (state.generationNumber >= MAX_GENERATIONS) {
    showMessage("Сброс недоступен после достижения лимита генераций", "error");
    renderActionStates();
    return;
  }

  localStorage.removeItem(STORAGE_KEYS.generationNumber);
  localStorage.removeItem(STORAGE_KEYS.generationCooldownStartedAt);
  localStorage.removeItem(STORAGE_KEYS.lastPlayersList);
  localStorage.removeItem(STORAGE_KEYS.lastGoaliesList);
  localStorage.removeItem(STORAGE_KEYS.lastGoalieTeams);
  localStorage.removeItem(STORAGE_KEYS.lastTeams);
  localStorage.removeItem(STORAGE_KEYS.settingsState);
  localStorage.removeItem(STORAGE_KEYS.settingsUpdatedAt);
  localStorage.removeItem(STORAGE_KEYS.swapCount);

  state.players = Array.from({ length: 20 }, (_, index) => ({
    originalNumber: index + 1,
    name: ""
  }));
  state.goalies = ["", ""];
  state.goalieTeams = { dark: "", light: "" };
  state.teams = { dark: [], light: [] };
  state.generationNumber = 0;
  state.generationCooldownStartedAt = null;
  state.swapCount = 0;
  state.settingsUpdatedAt = null;
  state.restrictions = {
    preset: presetRestrictions.map((item) => ({ ...item })),
    custom: []
  };

  elements.telegramInput.value = "";
  populateInputs();
  renderRestrictions();
  renderAll();
  saveState();
  showMessage("Все данные сброшены", "success");
}

function showMessage(text, type) {
  elements.messageBox.textContent = text;
  elements.messageBox.className = `message-box ${type === "error" ? "is-error" : "is-success"}`;
}
