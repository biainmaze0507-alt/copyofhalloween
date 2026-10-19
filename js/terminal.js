/* 단말기 화면 - 대기실, 인트로, 장소 입력, 질문·응답, 한마디, 통신 기록 */
const ENTRY_STORAGE_KEY = "synchalloweenEntry";        // 로비에서 저장한 입장 정보
const INTRO_STORAGE_KEY = "synchalloweenIntroSeen";    // 인트로를 본 방 코드

const MAX_TURN = 10;            // 질문 횟수 (GameConst.MAX_TURN)
const QUESTION_MAX = 100;       // 질문 최대 길이
const ACTION_MAX = 20;          // 닿지 않는 행동 최대 길이
const WHISPER_MAX = 30;         // 한마디 최대 길이
const INTRO_STEP_MS = 1900;     // 인트로 한 줄 간격
const CLOSING = "단말기는 더 이상 작동하지 않는다.";
const GLYPHS = "▓▒░█#%&@?/<>*+=";
const SHARE_TAGS = "#망가진단말기 #SYNC";  // 공유 문구·이미지 하단 해시태그
const WALL_CODE = "AFTERGLOW";              // 남겨진 기록 열람 코드 (GameConst.WALL_CODE, 결과지 화면에만 표시)

/*    FLICKER("조명을 깜빡인다"),
      SHAKE("물건을 움직인다"),
      DROP("물건을 떨어트린다"),*/
/* 폴터가이스트 - 버튼 이름, 생자 화면 효과, 생자에게 보이는 문장(amb), 망자에게 보이는 문장(self), 통신 기록 문장(rec) */
const POLTERGEIST = {
    FLICKER: { label: "조명을 깜빡인다", fx: "flicker", needThing: false,
        amb: function (place) { return place + "의 불이 깜빡인다."; },
        self: function () { return "불을 깜빡였다."; },
        rec: function () { return "불이 깜빡였다."; } },
    SHAKE: { label: "물건을 움직인다", fx: "shake", needThing: true, pick: "무엇을 움직여볼까",
        amb: function (place, thing) { return thing + " 움직이는 소리가 났다."; },
        self: function (place, thing) { return thing + josa(thing, "을", "를") + " 흔들었다." },
        rec: function (place, thing) { return thing + josa(thing, "이", "가") + " 움직였다." } },
    DROP: { label: "물건을 떨어트린다", fx: "drop", needThing: true, pick: "무엇을 떨어트릴까",
        amb: function (place, thing) { return thing + " 떨어지는 소리가 났다." },
        self: function (place, thing) { return thing + josa(thing, "을", "를") + " 떨어트렸다." },
        rec: function (place, thing) { return thing + josa(thing, "이", "가") + " 떨어졌다." } },
    NOISE: { label: "노이즈", fx: "noise", needThing: false,
        amb: function () { return "화면이 일그러지며 노이즈가 일었다." },
        self: function () { return "화면을 건들자 노이즈가 일었다." },
        rec: function () { return "화면에 노이즈가 일었다." } },
    SOUND: { label: "소리", fx: "sound", needThing: false,
        amb: function (place) { return place + "에 괴상한 소리가 울린다." },
        self: function () { return "당신의 뜻과 상관없이 괴상한 소리가 공간을 울린다." },
        rec: function () { return "괴상한 소리가 주변에 울린다." } }
};

/* 떠오르는 생각들 - 첫 질문(FIRST)과 마지막 질문(LAST)은 고정, 2~9번째 질문은 MIDDLE에서 판마다 5개씩 겹치지 않게 뽑음 */
const IDEAS_PER_TURN = 5;   // 한 차례에 보여 줄 개수
const IDEAS_FIRST = [
    "누구야?",
    "내 목소리 들려?",
    "이 단말기 아직 살아 있는 거야?",
    "너 맞지?",
    "여기 있는 거야?"
];

const IDEAS_MIDDLE = [
    "내가 너를 어떻게 생각했는지 알고 있었어?",
    "너도 나랑 같은 마음이었어?",
    "나를 소중한 사람이라고 생각했어?",
    "나 때문에 웃은 적 있었어?",
    "나와 함께했던 시간은 행복했어?",
    "너는 나와 만난 걸 후회하지 않아?",
    "내가 네 곁에 있어서 다행이라고 생각한 적 있어?",
    "내가 너를 이해해 주길 바랐어?",
    "한 번이라도 나를 미워한 적 있어?",
    "그날 나한테 하려던 말이 있었지?",
    "그 말, 진심이었어?",
    "내게 숨긴 진심이 있었어?",
    "그 약속 아직 기억해?",
    "마지막 순간에 살고 싶었어?",
    "내가 오는 걸, 기다리고 있었어?",
    "너는 내가 너를 구해 주길 바랐어?",
    "네가 죽는 순간, 누군가를 원망했어?",
    "네 죽음에 관해 내가 모르는 진실이 있어?",
    "네 죽음은 네가 원한 결말이었어?",
    "너는 네 죽음에 대해 후회하고 있어?",
    "그때 네가 다른 선택을 할 수 있었다면 살았을 거라고 생각해?",
    "내가 그때 네 곁에 있었다면 결과가 달라졌을까?",
    "나 때문에 죽은 거야?",
    "네가 죽은 건 네 잘못이 아니라고 생각해?",
    "그때 나를 미워했어?",
    "너는 나를 용서했어?",
    "내가 너를 용서해도 돼?",
    "네 방, 그대로 둬도 될까?",
    "네가 아끼던 그거, 내가 가져도 돼?",
    "네 번호, 아직 지우지 못했는데 괜찮아?",
    "그 노래 들을 때마다 네 생각나는 거, 너도 그랬어?",
    "네가 남긴 쪽지, 나한테 쓴 거 맞지?",
    "꿈에 나온 거, 너였어?",
    "내가 우는 거 봤어?",
    "내가 너 없이 잘 지내는 척하는 거, 다 알아?",
    "아직도 내 걱정해?",
    "그곳에서도 나를 기억해?",
    "내가 살아남아서 다행이라고 생각해?",
    "내가 더는 네 죽음 때문에 괴로워하지 않았으면 해?",
    "내가 너를 잊지 못하는 게 괴로워?",
    "내가 너를 먼저 잊으면 서운할까?",
    "내가 다른 사람을 사랑해도 괜찮아?",
    "다시 태어나도 나를 찾아올 거야?",
    "다음에도 나를 찾아와 줄 거야?",
    "내가 행복해지면 기쁠 것 같아?",
    "내가 너를 만나러 가는 날을 기다리고 있어?",
    "내가 네 몫까지 살아가길 바라?"
];

const IDEAS_LAST = [
    "마지막으로 하고 싶은 말이 있어?",
    "내가 너를 잊지 않길 바라?",
    "나와 함께 하는 순간은 행복했어?",
    "잘 가라고 말해도 돼?",
    "우리, 이걸로 괜찮은 거지?"
];

/* 닿지 않는 행동 예시 */
const ACTS = ["(얼굴을 만진다)", "(머리를 쓰다듬는다)", "(손을 잡는다)", "(끌어안는다)", "(웃는다)", "(운다)",
    "(고개를 젓는다)", "(이름을 부른다)", "(곁에 앉는다)", "(등 뒤에 선다)", "(가만히 바라본다)", "(고개를 돌린다)"];

/* 인트로 문구 (item은 목록 줄) */
const LIVING_INTRO = [
    { text: "그 사람이 세상을 떠난 지 얼마나 지났는지 이제는 헤아리기도 어렵습니다." },
    { text: "표정도, 몸짓도, 목소리도 아직 이렇게 선명한데 그 사람은 보이지 않습니다." },
    { text: "한 때 그와 대화했던 단말기는 오늘도 당신의 손에 들려 있습니다." },
    { text: "회선이 끊긴 지 오래라, 화면은 어둡고 아무리 눌러도 반응하지 않습니다." },
    { text: "버릴 법도 했지만, 당신은 단말기를 놓지 못했습니다." },
    { text: "" },
    { text: "죽은 이들이 돌아온다는 10월의 어느 날을 앞둔 밤." },
    { text: "당신은 망가진 단말기를 쥐고, 그리운 누군가의 이름을 부릅니다." },
    { text: "한 번, 그리고 다시 한 번." },
    { text: "" },
    { text: "그때, 여태 아무 응답도 없던 단말기가 깜빡이기 시작합니다." },
    { text: "당신은 확신합니다." },
    { text: "그 사람이 돌아왔다는 것을." }
];

const DEAD_INTRO = [
    { text: "당신이 세상을 떠난 지 얼마나 지났는지, 이제는 알 수 없습니다." },
    { text: "아무것도 없는 곳에서 생각조차 흐르지 않은 채 떠돌던 어느 날," },
    { text: "당신의 이름을 부르는 익숙한 목소리가 들려옵니다." },
    { text: ". . . . . . . ." },
    { text: "정신을 차려 보니, 당신은 누군가의 앞에 서 있습니다." },
    { text: "그 사람은 당신을 보지 못하는 듯합니다." },
    { text: "하지만 어쩐지, 그 사람이 쥐고 있는 단말기를 통해서라면" },
    { text: "당신의 뜻을 전할 수 있을 것만 같습니다." },
    { text: "그리고 지금이라면, 이 공간에 아주 미약한 영향을 미칠 수 있을지도 모릅니다." },
    { text: "· 질문에 답하기 전, 폴터가이스트 현상을 일으킬 수 있습니다", item: true },
    { text: "· 질문에 답하기 전, 상대방에게 닿지 않는 행동이나 말을 남길 수 있습니다", item: true },
    { text: "· 이 행동과 말은 통신이 끝난 뒤 상대방에게 전해집니다", item: true },
    { text: "· 마지막 질문이 끝나면, 짧은 한마디를 남길 수 있습니다", item: true }
];

const POLL_MS = 2000;            // 상태 확인 간격 (웹소켓 대신 폴링)
const POLL_HIDDEN_MS = 5000;    // 탭이 가려져 있을 때 확인 간격

let entry = null;               // 입장 정보 { roomCode, playerToken, life, frequency }
let S = null;                   // 서버가 보낸 최신 상태 (RoomStateDTO)
let isConnected = false;        // 내 연결 상태 (마지막 확인이 성공했는지)
let pollTimer = 0;              // 다음 상태 확인 예약
let isPolling = false;          // 상태 확인 요청이 가는 중인지
let currentScene = "";          // 지금 보이는 장면
let isIntroPlaying = false;     // 인트로 재생 중
let introTimers = [];           // 인트로 예약들
let isWaitTransition = false;   // 대기실 → 인트로 넘어가는 중
let lcdAnim = 0;                // 액정 연출 번호 (0이면 연출 없음)
let ctlKey = "";                // 조작부를 다시 그릴지 판단하는 값
let lastTurn = 0;               // 마지막으로 그린 질문 차례 (바뀌면 입력값 초기화)
let actDraft = "";              // 닿지 않는 행동 입력 중인 값
let isIdeaUsed = false;         // 이번 질문에 떠오르는 생각을 눌렀는지
let pickMode = null;            // 물건을 고르는 중인 폴터가이스트 종류
let placeDraft = "";            // 생자가 먼저 적은 장소
let isPlaceSent = false;        // 장소·물건을 서버로 보냈는지
let isResultShown = false;      // 통신 기록을 펼쳤는지
let ideaPlan = null;            // 이번 판의 떠오르는 생각들 순서 (방 코드로 한 번 정함)
let wallKey = "";               // 남겨진 기록 칸을 다시 그릴지 판단하는 값 (고른 질문 유지)
const avatarCache = {};         // 신분증 사진 { LIVING: data URL, DEAD: data URL }

/* 요소 찾기 */
function $(id) {
    return document.getElementById(id);
}

/* 요소 만들기 - 글자는 항상 textContent로 넣음 */
function el(tag, props) {
    const node = document.createElement(tag);
    const options = props || {};
    if (options.className) node.className = options.className;
    if (options.id) node.id = options.id;
    if (options.type) node.type = options.type;
    if (options.text !== undefined) node.textContent = options.text;
    if (options.attrs) {
        Object.keys(options.attrs).forEach(function (key) {
            node.setAttribute(key, options.attrs[key]);
        });
    }
    for (let i = 2; i < arguments.length; i++) {
        const child = arguments[i];
        if (child === null || child === undefined) continue;
        node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }
    return node;
}

/* 방 코드로 정해지는 난수 (같은 방이면 새로고침해도 같은 순서) */
function seededRandom(seedText) {
    let seed = 0;
    for (let i = 0; i < seedText.length; i++) {
        seed = ((seed << 5) - seed + seedText.charCodeAt(i)) | 0;
    }
    return function () {
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/* 배열 섞기 (원본은 그대로 두고 새 배열로) */
function shuffled(list, random) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        const temp = copy[i];
        copy[i] = copy[j];
        copy[j] = temp;
    }
    return copy;
}

/* 차례별 떠오르는 생각들 - 첫 차례·마지막 차례는 고정 묶음(순서만 섞음), 그 사이는 MIDDLE을 섞어 5개씩 차례대로 (같은 질문이 두 번 나오지 않음, 방 코드로 정해서 다시 들어와도 같음) */
function ideasForTurn(turnNo) {
    if (!ideaPlan) {
        const random = seededRandom(entry.roomCode);
        const middle = shuffled(IDEAS_MIDDLE, random);
        ideaPlan = [shuffled(IDEAS_FIRST, random)];
        for (let turn = 2; turn < MAX_TURN; turn++) {
            const from = (turn - 2) * IDEAS_PER_TURN;
            ideaPlan.push(middle.slice(from, from + IDEAS_PER_TURN));
        }
        ideaPlan.push(shuffled(IDEAS_LAST, random));
    }
    return ideaPlan[turnNo - 1] || [];
}

/* 글자 수 (이모지·한글 1자로) */
function len(text) {
    return [...(text || "")].length;
}

/* 받침에 따라 조사 고르기 */
function josa(word, withBatchim, withoutBatchim) {
    const code = word.charCodeAt(word.length - 1);
    if (code < 0xAC00 || code > 0xD7A3) return withBatchim + "(" + withoutBatchim + ")";
    return (code - 0xAC00) % 28 ? withBatchim : withoutBatchim;
}

/* 두 자리 숫자 */
function pad(n) {
    return String(n).padStart(2, "0");
}

/* 내가 생자인지 */
function isLiving() {
    return entry && entry.life === "LIVING";
}

/* 장면 바꾸기 */
function showScene(name) {
    currentScene = name;
    document.querySelectorAll(".scene").forEach(function (scene) {
        scene.classList.toggle("active", scene.id === "scene" + name);
    });
}

/* 연결 상태 알림 */
function setBanner(text) {
    const banner = $("banner");
    banner.textContent = text || "";
    banner.classList.toggle("hidden", !text);
}

/* 연결 상태에 맞게 알림 갱신 */
function updateBanner() {
    if (!S || S.stage === "END") {
        setBanner(null);
        return;
    }
    if (!isConnected) {
        setBanner("신호가 불안정합니다. 다시 연결하는 중...");
        return;
    }
    const partner = isLiving() ? S.dead : S.living;
    if (partner && !S.isPartnerConnected) {
        setBanner("상대의 신호가 끊겼습니다. 연결을 기다리는 중...");
        return;
    }
    setBanner(null);
}

/* 신호를 찾을 수 없음 */
function showLost(message) {
    try {
        localStorage.removeItem(ENTRY_STORAGE_KEY);
    } catch (e) { }
    clearTimeout(pollTimer);
    if (message) $("lostSub").textContent = message;
    setBanner(null);
    showScene("Lost");
}

/* 인트로를 이미 본 방인지 */
function isIntroSeen() {
    try {
        return localStorage.getItem(INTRO_STORAGE_KEY) === entry.roomCode;
    } catch (e) {
        return false;
    }
}

/* 인트로를 봤다고 기록 */
function markIntroSeen() {
    try {
        localStorage.setItem(INTRO_STORAGE_KEY, entry.roomCode);
    } catch (e) { }
}

/* 이름 → 5자리 식별코드 (로비 바코드와 같은 계산) */
function agentCode(name) {
    if (!name) return "00000";
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
    }
    hash = Math.abs(hash);
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let result = "";
    for (let j = 0; j < 5; j++) {
        result += chars[hash % chars.length];
        hash = Math.floor(hash / chars.length) + (hash % 7) + j;
    }
    return result;
}

/* 신분증 나이 (입력하지 않았으면 --) */
function ageText(agent) {
    return agent.age === null || agent.age === undefined ? "--" : String(agent.age);
}

/* 신분증 생일 (입력하지 않았으면 --/--) */
function birthdayText(agent) {
    return agent.birthday || "--/--";
}

/* 신분증 사진 불러오기 (웹소켓에 싣지 않고 별도 주소로) */
function loadAvatar(life) {
    if (avatarCache[life] !== undefined) return;
    avatarCache[life] = "loading";
    api("avatar", { roomCode: entry.roomCode, token: entry.playerToken, life: life })
        .then(function (data) {
            avatarCache[life] = data.image || "";
            refreshCards();
        })
        .catch(function () {
            avatarCache[life] = undefined;
        });
}

/* 읽기 전용 신분증 */
function buildCard(agent, life, isWorn) {
    if (!agent) {
        return el("div", { className: "tcard empty" },
            el("i", { className: "bi bi-person-dash" }), "신호 대기 중");
    }
    loadAvatar(life);

    const code = agentCode(agent.name);
    const seed = "SYNC" + code;

    const bars = el("div", { className: "tcard-bars" });
    for (let i = 0; i < seed.length; i++) {
        const c = seed.charCodeAt(i);
        bars.appendChild(el("span", { className: c % 3 === 0 ? "thick" : c % 3 === 1 ? "" : "thin" }));
        bars.appendChild(el("span", { className: "space" }));
        bars.appendChild(el("span", { className: c % 2 === 0 ? "thin" : "" }));
    }

    const photo = el("div", { className: "tcard-photo" });
    const image = avatarCache[life];
    if (image && image !== "loading") {
        photo.style.backgroundImage = "url(\"" + image + "\")";
    } else {
        photo.appendChild(el("i", { className: "bi bi-person-bounding-box" }));
    }

    const card = el("div", { className: "tcard" + (isWorn ? " worn" : ""), attrs: { "data-life": life } },
        el("div", { className: "tcard-head" },
            el("div", { className: "tcard-title", text: "IDENTIFICATION CARD" })),
        el("div", { className: "tcard-body" },
            photo,
            el("div", { className: "tcard-fields" },
                el("div", null,
                    el("div", { className: "tcard-label", text: "NAME" }),
                    el("div", { className: "tcard-value", text: agent.name })),
                el("div", { className: "tcard-row" },
                    el("div", null,
                        el("div", { className: "tcard-label", text: "AGE" }),
                        el("div", { className: "tcard-value", text: ageText(agent) })),
                    el("div", null,
                        el("div", { className: "tcard-label", text: "BIRTHDAY" }),
                        el("div", { className: "tcard-value", text: birthdayText(agent) }))))),
        el("div", { className: "tcard-foot" },
            bars,
            el("div", { className: "tcard-code", text: "SYNC-" + code })));

    ["a", "b", "c", "d", "e"].forEach(function (k) {
        card.appendChild(el("i", { className: "stain " + k }));
    });
    return card;
}

/* 사진을 받은 뒤 신분증 다시 그리기 */
function refreshCards() {
    if (!S) return;
    if (currentScene === "Wait") renderWait();
    if (currentScene === "Terminal") renderCards();
    if (currentScene === "Result") renderResult();
}

/*
 * 서버 연결 - 원본은 웹소켓(STOMP)으로 서버가 먼저 알려줬지만,
 * Apps Script는 웹소켓이 없어서 2초마다 "바뀐 게 있나요?"(sync)를 물어봄 (폴링)
 */
function connect() {
    clearTimeout(pollTimer);
    poll();
}

/* 상태 확인 한 번 - 내 버전을 보내면 서버가 바뀌었을 때만 새 상태를 줌 */
function poll() {
    if (currentScene === "Lost" || isPolling) return;
    isPolling = true;
    api("sync", { roomCode: entry.roomCode, token: entry.playerToken, version: S ? S.version : 0 })
        .then(function (res) {
            setConnected(true);
            if (res.changed) {
                applyState(res.state);
            } else {
                updatePresence(res.isPartnerConnected);
            }
        })
        .catch(function (e) {
            if (e.code === 403 || e.code === 404) {
                handleError(e.message);
                return;
            }
            setConnected(false);
        })
        .then(function () {
            isPolling = false;
            if (currentScene === "Lost") return;
            clearTimeout(pollTimer);
            pollTimer = setTimeout(poll, document.hidden ? POLL_HIDDEN_MS : POLL_MS);
        });
}

/* 내 연결 상태 바꾸기 */
function setConnected(value) {
    if (isConnected === value) return;
    isConnected = value;
    updateBanner();
}

/* 상대 접속 여부 바뀜 → 효과음 + 알림 */
function updatePresence(value) {
    if (!S || S.isPartnerConnected === value) return;
    S.isPartnerConnected = value;
    const partner = isLiving() ? S.dead : S.living;
    if (partner && S.stage !== "END") value ? sfxSignal() : sfxDisconnect();
    updateBanner();
}

/* 새 상태 적용 - 이전 상태와 비교해서 무슨 일이 일어났는지(이벤트) 알아냄 */
function applyState(next) {
    if (S && next.version < S.version) return;   // 늦게 도착한 옛날 응답은 무시
    if (S && next.version === S.version) {
        updatePresence(next.isPartnerConnected);
        return;
    }
    if (S && S.living && S.dead) updatePresence(next.isPartnerConnected);
    onEvent({ type: detectEvent(S, next), state: next });
}

/* 이전 상태 → 다음 상태 차이로 이벤트 이름 정하기 (원본 서버가 보내던 이벤트와 같은 이름) */
function detectEvent(prev, next) {
    if (!prev) return "STATE";
    if (prev.stage === "WAITING" && next.stage !== "WAITING") return "INTRO";
    if (prev.stage !== "END" && next.stage === "END") return "END";
    if (next.exchanges.length > prev.exchanges.length) return "ANSWER";
    if (prev.stage === "ASK" && next.stage === "ANSWER") return "QUESTION";
    if (next.pendingPoltergeist && !prev.pendingPoltergeist) return "POLTERGEIST";
    return "STATE";
}

/* 서버로 보내기 - 응답으로 바뀐 상태를 바로 받아 적용 */
function send(action, body) {
    const payload = Object.assign({ roomCode: entry.roomCode, token: entry.playerToken }, body || {});
    api(action, payload)
        .then(function (state) {
            setConnected(true);
            applyState(state);
        })
        .catch(function (e) {
            handleError(e.message);
        });
}

/* 조작부 아래 오류 문구 (4초 뒤 사라짐) */
function showCtlError(message) {
    const box = $("ctlError");
    box.textContent = message;
    clearTimeout(box._timer);
    box._timer = setTimeout(function () {
        box.textContent = "";
    }, 4000);
}

/* 서버 이벤트 처리 */
function onEvent(event) {
    if (event.type === "ERROR") {
        handleError(event.message);
        return;
    }

    const prev = S;
    if (event.state) S = event.state;

    /* 대기실에서 파트너가 들어오면 잠깐 보여 준 뒤 인트로로 */
    if (event.type === "INTRO" && currentScene === "Wait") {
        isWaitTransition = true;
        renderWait();
        $("waitStatus").textContent = "신호가 잡혔습니다."
        sfxSignal();
        setTimeout(function () {
            isWaitTransition = false;
            render();
        }, 3000);
        updateBanner();
        return;
    }

    if (event.type === "QUESTION" && !isLiving()) {
        lcdAnim = -1;
        render();
        sfxSignal();
        typeLcd(S.pendingQuestion);
        return;
    }

    if (event.type === "ANSWER" && isLiving()) {
        const last = S.exchanges[S.exchanges.length - 1];
        lcdAnim = -1;
        render();
        /* 폴링 사이에 현상과 응답이 한꺼번에 왔으면 현상도 보여 줌 */
        if (last.poltergeist && !(prev && prev.pendingPoltergeist)) playPoltergeist(last.poltergeist);
        scrambleAnswer(last.answer);
        return;
    }

    if (event.type === "POLTERGEIST") {
        render();
        playPoltergeist(S.pendingPoltergeist);
        return;
    }

    if (event.type === "END" && isLiving()) {
        lcdAnim = -1;
        render();
        playEnding();
        return;
    }

    if (event.type === "STATE" && prev && prev.stage === "INTRO" && S.stage === "ASK") {
        lcdAnim = -1;
        render();
        sfxSignal();
        typeLcd(lcdState().text);
        return;
    }

    render();
}

/* 오류 처리 - 단말기가 사라졌으면 신호 없음 화면 */
function handleError(message) {
    if (message === "연결할 수 없는 단말기입니다." || message === "단말기의 주인이 아닙니다") {
        if (S && S.stage === "END") return;
        showLost("이미 연결이 닫혔거나 존재하지 않는 단말기입니다");
        return;
    }
    showCtlError(message);
    ctlKey = "";
    if (isPlaceSent && S && S.stage === "INTRO") isPlaceSent = false;
    render();
}

/* 현재 상태에 맞는 장면 그리기 */
function render() {
    if (!S || currentScene === "Lost") return;
    updateBanner();
    if (isWaitTransition) return;

    if (S.stage === "WAITING") {
        renderWait();
        showScene("Wait");
        return;
    }

    if (S.stage === "INTRO") {
        if (!isIntroSeen()) {
            if (!isIntroPlaying) startIntro();
            return;
        }
        renderSetup();
        showScene("Setup");
        return;
    }

    renderTerminal();
    if (isIntroPlaying) return;
    showScene(isResultShown ? "Result" : "Terminal");
    if (isResultShown) renderResult();
}

/* 대기실 */
function renderWait() {
    $("waitCode").textContent = entry.roomCode;
    $("waitChannel").textContent = entry.frequency ? "CH " + entry.frequency + " MHz" : "";

    const me = isLiving() ? S.living : S.dead;
    const partner = isLiving() ? S.dead : S.living;
    const myLife = isLiving() ? "LIVING" : "DEAD";
    const partnerLife = isLiving() ? "DEAD" : "LIVING";

    $("mySlot").replaceChildren(buildCard(me, myLife, myLife === "DEAD"));
    $("partnerSlot").replaceChildren(buildCard(partner, partnerLife, partnerLife === "DEAD"));
}

/* 인트로 시작 */
function startIntro() {
    isIntroPlaying = true;
    showScene("Intro");

    const lines = isLiving() ? LIVING_INTRO : DEAD_INTRO;
    const linesBox = $("introLines");
    const cardBox = $("introCard");
    linesBox.replaceChildren();
    cardBox.replaceChildren();

    let startDelay = 0;
    if (!isLiving()) {
        const card = buildCard(S.dead, "DEAD", false);
        cardBox.appendChild(card);
        introTimers.push(setTimeout(function () {
            card.classList.add("worn");
        }, 900));
        startDelay = 2200;
    }

    lines.forEach(function (line, i) {
        const p = el("p", { className: line.item ? "item" : "", text: line.text });
        p.style.animationDelay = ((startDelay + i * INTRO_STEP_MS) / 1000).toFixed(1) + "s";
        linesBox.appendChild(p);
    });

    introTimers.push(setTimeout(endIntro, startDelay + lines.length * INTRO_STEP_MS + 1200));
}

/* 인트로 끝 (건너뛰기 포함) */
function endIntro() {
    introTimers.forEach(clearTimeout);
    introTimers = [];
    isIntroPlaying = false;
    markIntroSeen();
    render();
    const first = $("placeInput");
    if (currentScene === "Setup" && !$("placeForm").classList.contains("hidden")) first.focus();
}

/* 생자 장소·물건 입력 / 망자 기다림 */
function renderSetup() {
    const living = isLiving();
    const waiting = living && isPlaceSent;
    $("deadWait").classList.toggle("hidden", living);
    $("livingWait").classList.toggle("hidden", !waiting);
    $("placeForm").classList.toggle("hidden", !living || waiting || placeDraft !== "");
    $("thingsForm").classList.toggle("hidden", !living || waiting || placeDraft === "");
}

/* 장소 입력 */
function submitPlace(e) {
    e.preventDefault();
    const value = $("placeInput").value.trim();
    if (!value) return;
    placeDraft = value;
    sfxClick();
    renderSetup();
    $("thing0").focus();
}

/* 물건 입력 → 서버로 */
function submitThings(e) {
    e.preventDefault();
    const things = [0, 1, 2].map(function (k) {
        return $("thing" + k).value.trim();
    }).filter(Boolean);
    if (!things.length) return;
    isPlaceSent = true;
    sfxClick();
    renderSetup();
    send("place", { place: placeDraft, things: things });
}

/* 단말기 화면 */
function renderTerminal() {
    if (S.turnNo !== lastTurn) {
        actDraft = "";
        isIdeaUsed = false;
        pickMode = null;
        lastTurn = S.turnNo;
    }

    renderCards();

    const note = $("sceneNote");
    if (!isLiving() && S.place && S.living) {
        const name = S.living.name;
        const last = S.things[S.things.length - 1] || "";
        note.textContent = name + josa(name, "은", "는") + " 지금 " + S.place + "에 있습니다. 주변에는 "
            + S.things.join(", ") + josa(last, "이", "가") + " 보입니다."
        note.classList.remove("hidden");
    } else {
        note.classList.add("hidden");
    }

    const inTalk = S.stage === "ASK" || S.stage === "ANSWER";
    $("lcdLeft").textContent = inTalk ? "Q " + pad(S.turnNo) + "/" + MAX_TURN : "Q --/" + MAX_TURN;
    $("lcdRight").textContent = lcdDirection();
    if (lcdAnim === 0) setLcd(lcdState());

    $("amb").textContent = ambText();
    renderCtl();
}

/* 두 사람 신분증 */
function renderCards() {
    $("termCards").replaceChildren(buildCard(S.living, "LIVING", false), buildCard(S.dead, "DEAD", true));
}

/* 단말기 아래 폴터가이스트 문장 - 생자는 들린 것, 망자는 자기가 한 일 */
function ambText() {
    if (S.stage !== "ANSWER" || !S.pendingPoltergeist) return "";
    const pol = POLTERGEIST[S.pendingPoltergeist];
    const text = isLiving() ? pol.amb : pol.self;
    return text(S.place || "", S.pendingPoltergeistThing || "");
}

/* 액정 오른쪽 위 표시 - 지금 행동할 쪽은 발신, 기다리는 쪽은 수신 */
function lcdDirection() {
    if (S.stage === "END") return "OFF";
    if (S.stage === "ASK") return isLiving() ? "발신" : "수신";
    if (S.stage === "ANSWER" || S.stage === "WHISPER") return isLiving() ? "수신" : "발신";
    return "----";
}

/* 액정에 띄울 내용 */
function lcdState() {
    const count = S.exchanges.length;
    const last = count ? S.exchanges[count - 1] : null;
    const answerText = function (answer) {
        return answer === "NONE" ? { text: "반응없음", big: true, ko: true } : { text: answer, big: true };
    };

    if (isLiving()) {
        if (S.stage === "ASK") return count ? answerText(last.answer) : { text: "???와 연결되었습니다\n상대방에게 질문을 해보세요." };
        if (S.stage === "ANSWER") return { text: "응답 대기중..." };
        if (S.stage === "WHISPER") return answerText(last.answer);
        return { text: (S.whisper ? S.whisper + "\n\n" : "") + CLOSING, off: true };
    }
    if (S.stage === "ASK") return { text: (count ? "" : "발신 위치: " + S.place + "\n") + "상대방의 질문을 기다리고 있습니다." };
    if (S.stage === "ANSWER") return { text: S.pendingQuestion || "" };
    if (S.stage === "WHISPER") return { text: "마지막으로 전하고 싶은 말이 있나요?" };
    return { text: "연결이 종료되었습니다.", off: true };
}

/* 액정 표시 */
function setLcd(state) {
    const main = $("lcdMain");
    main.className = "lcd-main" + (state.big ? " big" : "") + (state.ko ? " ko" : "");
    main.textContent = state.text;
    $("lcd").classList.toggle("off", !!state.off);
}

/* 액정에 한 글자씩 */
function typeLcd(text, done, prefix) {
    const id = ++lcdAnim;
    const main = $("lcdMain");
    main.className = "lcd-main";
    $("lcd").classList.remove("off");
    const chars = [...(text || "")];
    const head = prefix || "";
    let k = 0;
    (function tick() {
        if (lcdAnim !== id) return;
        main.textContent = head + chars.slice(0, k).join("");
        if (k++ < chars.length) {
            setTimeout(tick, 38);
        } else if (done) {
            done(id);
        } else {
            lcdAnim = 0;
            setLcd(lcdState());
        }
    })();
}

/* 응답 - 깨진 글자가 점점 YES / NO로 (반응없음은 끝까지 맞춰지지 않음) */
function scrambleAnswer(answer) {
    const id = ++lcdAnim;
    const main = $("lcdMain");
    main.className = "lcd-main big";
    $("lcd").classList.remove("off");

    const isNone = answer === "NONE";
    const target = isNone ? "     " : (answer === "YES" ? " YES " : " NO  ");
    const duration = isNone ? 1300 : 2400;
    const started = performance.now();

    const cells = el("span", { className: "cells" });
    for (let i = 0; i < 5; i++) cells.appendChild(el("span"));
    main.replaceChildren(cells);
    const cellList = cells.querySelectorAll("span");
    sfxStatic(duration / 1000);

    (function tick() {
        if (lcdAnim !== id) return;
        const t = Math.min(1, (performance.now() - started) / duration);
        const p = isNone ? 0 : Math.pow(Math.max(0, (t - .35) / .65), 1.6);
        cellList.forEach(function (cell, k) {
            if (Math.random() < p) {
                cell.textContent = target[k];
            } else if (isNone && Math.random() < t * .8) {
                cell.textContent = " ";
            } else {
                cell.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
            }
        });
        if (t < 1) {
            setTimeout(tick, 70);
        } else {
            lcdAnim = 0;
            setLcd(lcdState());
            sfxLock();
        }
    })();
}

/* 마지막 - 한마디가 있으면 먼저 띄우고 종료 문구 */
function playEnding() {
    const close = function (prefix) {
        typeLcd(CLOSING, null, prefix);
    };
    if (S.whisper) {
        sfxSignal();
        typeLcd(S.whisper, function (id) {
            setTimeout(function () {
                if (lcdAnim === id) close(S.whisper + "\n\n");
            }, 5000);
        });
    } else {
        close("");
    }
}

/* 폴터가이스트 연출 (생자·망자 모두 화면 전체 / 노이즈는 액정만) */
function playPoltergeist(type) {
    if (!type) return;
    const sounds = { FLICKER: sfxFlicker, SHAKE: sfxRumble, DROP: sfxThud, NOISE: sfxNoise, SOUND: sfxEerie };
    sounds[type]();

    const fx = POLTERGEIST[type].fx;
    const root = $("termRoot");
    const lcd = $("lcd");
    const target = fx === "noise" ? lcd : root;
    ["flicker", "shake", "drop", "noise", "sound"].forEach(function (name) {
        root.classList.remove("fx-" + name);
        lcd.classList.remove("fx-" + name);
    });
    void target.offsetWidth;
    target.classList.add("fx-" + fx);
    setTimeout(function () {
        target.classList.remove("fx-" + fx);
    }, 1900);
}

/* 조작부 (같은 단계·차례면 다시 그리지 않아 입력값 유지) */
function renderCtl() {
    const key = [S.stage, S.turnNo, S.pendingPoltergeist || "", pickMode || "", entry.life].join("|");
    if (key === ctlKey) return;
    ctlKey = key;

    const ctl = $("ctl");
    ctl.replaceChildren();

    if (S.stage === "END") {
        const btn = el("button", { className: "ctl-btn pri", type: "button", text: "통신 기록 보기" });
        btn.addEventListener("click", showResult);
        ctl.appendChild(btn);
        return;
    }

    if (isLiving()) {
        if (S.stage === "ASK") ctl.appendChild(buildQuestionForm());
        if (S.stage === "ANSWER") ctl.appendChild(el("p", { className: "ctl-note", text: "대답을 기다리고 있습니다." }));
        if (S.stage === "WHISPER") ctl.appendChild(el("p", { className: "ctl-note", text: "단말기의 신호가 약해지고 있습니다." }));
        return;
    }

    if (S.stage === "ASK") ctl.appendChild(el("p", { className: "ctl-note", text: "상대방의 질문을 기다리는 중입니다." }));
    if (S.stage === "ANSWER") buildAnswerControls(ctl);
    if (S.stage === "WHISPER") ctl.appendChild(buildWhisperForm());
}

/* 글자 수 표시 + 경고 + 버튼 상태 */
function bindCounter(input, max, countEl, warnEl, button) {
    const update = function () {
        const n = len(input.value);
        countEl.textContent = n + "/" + max;
        warnEl.classList.toggle("hidden", n <= max);
        if (button) button.disabled = !input.value.trim() || n > max;
    };
    input.addEventListener("input", update);
    update();
    return update;
}

/* 생자 질문 */
function buildQuestionForm() {
    const count = el("span", { className: "ctl-count", text: "0/" + QUESTION_MAX });
    const textarea = el("textarea", { className: "ctl-input", id: "qInput", attrs: { rows: "2", autocomplete: "off" } });
    const warn = el("p", { className: "ctl-warn hidden", text: "말이 너무 길어진 건 아닐까? 마음을 전하기 위해 문장을 정리할 필요가 있다." });
    const sendBtn = el("button", { className: "ctl-btn pri", type: "submit", text: "질문한다." });

    const form = el("form", { className: "ctl-form" },
        el("label", { className: "ctl-label", attrs: { for: "qInput" } },
            el("span", { text: "어떤 질문을 할까? (" + S.turnNo + "/" + MAX_TURN + ")" }), count),
        textarea, warn, sendBtn);

    const update = bindCounter(textarea, QUESTION_MAX, count, warn, sendBtn);

    const submit = function () {
        const value = textarea.value.trim();
        if (!value || len(textarea.value) > QUESTION_MAX) return;
        sendBtn.disabled = true;
        sfxClick();
        send("question", { question: value, isIdeaUsed: isIdeaUsed });
    };
    form.addEventListener("submit", function (e) {
        e.preventDefault();
        submit();
    });
    textarea.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            submit();
        }
    });

    const ideas = el("div", { className: "ideas" });
    ideasForTurn(S.turnNo).forEach(function (text) {
        const chip = el("button", { type: "button", text: text });
        chip.addEventListener("click", function () {
            textarea.value = text;
            isIdeaUsed = true;
            update();
            textarea.focus();
        });
        ideas.appendChild(chip);
    });

    return el("div", { className: "ctl" },
        form,
        el("div", { className: "ctl-section" },
            el("p", { className: "ideas-title", text: "떠오르는 생각들..." }),
            ideas));
}

/* 망자 응답 단계: 폴터가이스트 → 닿지 않는 행동 → 경고 → 응답 */
function buildAnswerControls(ctl) {
    const used = S.pendingPoltergeist;
    const things = S.things || [];

    /* 폴터가이스트 */
    const polLabel = el("p", { className: "ctl-label" },
        el("span", { text: "폴터가이스트 (질문당 한 번)" }),
        el("span", { text: used ? "일으킨 현상: " + POLTERGEIST[used].label
            + (S.pendingPoltergeistThing ? " (" + S.pendingPoltergeistThing + ")" : "") : "" }));
    const polRow = el("div", { className: "ctl-row" });
    Object.keys(POLTERGEIST).forEach(function (type) {
        const btn = el("button", { className: "ctl-btn dash", type: "button", text: POLTERGEIST[type].label });
        btn.disabled = !!used;
        btn.addEventListener("click", function () {
            if (POLTERGEIST[type].needThing && things.length > 1) {
                pickMode = type;
                ctlKey = "";
                renderCtl();
                return;
            }
            disableAll(ctl);
            send("poltergeist", { type: type, thing: POLTERGEIST[type].needThing ? things[0] : null });
        });
        polRow.appendChild(btn);
    });
    const polSection = el("div", { className: "ctl-section" }, polLabel, polRow);

    if (pickMode && !used) {
        const pickRow = el("div", { className: "ctl-row" });
        things.forEach(function (thing) {
            const btn = el("button", { className: "ctl-btn dash", type: "button", text: thing });
            btn.addEventListener("click", function () {
                const type = pickMode;
                pickMode = null;
                disableAll(ctl);
                send("poltergeist", { type: type, thing: thing });
            });
            pickRow.appendChild(btn);
        });
        polSection.appendChild(el("p", { className: "ctl-label", text: POLTERGEIST[pickMode].pick }));
        polSection.appendChild(pickRow);
    }

    /* 닿지 않는 행동 (응답할 때 함께 저장) */
    const actCount = el("span", { className: "ctl-count" });
    const actInput = el("input", { className: "ctl-input", id: "actInput", attrs: { autocomplete: "off", placeholder: "상대는 알아차리지 못한다." } });
    actInput.value = actDraft;
    const actWarn = el("p", { className: "ctl-warn hidden", text: ACTION_MAX + "자 내외의 짧은 대사/행동만 전달할 수 있습니다." });
    const acts = el("div", { className: "acts" });
    const actSection = el("div", { className: "ctl-section" },
        el("label", { className: "ctl-label", attrs: { for: "actInput" } },
            el("span", { text: "닿지 않는 행동 (질문당 한 번)" }), actCount),
        actInput, actWarn, acts);

    /* 응답 */
    const answerRow = el("div", { className: "ctl-row" });
    const answers = [["YES", "YES", "pri"], ["NO", "NO", "pri"], ["NONE", "반응없음", ""]];
    const answerBtns = answers.map(function (a) {
        const btn = el("button", { className: "ctl-btn " + a[2], type: "button", text: a[1] });
        btn.addEventListener("click", function () {
            const action = actDraft.trim();
            if (len(actDraft) > ACTION_MAX) return;
            disableAll(ctl);
            sfxClick();
            send("answer", {
                answer: a[0],
                action: action || null,
                isPresetAction: ACTS.indexOf(action) >= 0
            });
        });
        answerRow.appendChild(btn);
        return btn;
    });

    const updateAct = function () {
        actDraft = actInput.value;
        const n = len(actDraft);
        actCount.textContent = n + "/" + ACTION_MAX;
        actWarn.classList.toggle("hidden", n <= ACTION_MAX);
        answerBtns.forEach(function (btn) {
            btn.disabled = n > ACTION_MAX;
        });
    };
    actInput.addEventListener("input", updateAct);
    ACTS.forEach(function (text) {
        const chip = el("button", { type: "button", text: text });
        chip.addEventListener("click", function () {
            actInput.value = text;
            updateAct();
            actInput.focus();
        });
        acts.appendChild(chip);
    });
    updateAct();

    ctl.appendChild(polSection);
    ctl.appendChild(actSection);
    ctl.appendChild(el("p", { className: "ctl-warn", text: "질문에 대한 대답[YES/NO/반응없음]을 선택하면 이 질문에는 더 이상 폴터가이스트 등 행동이 불가합니다." }));
    ctl.appendChild(answerRow);
}

/* 망자 한마디 */
function buildWhisperForm() {
    const count = el("span", { className: "ctl-count" });
    const input = el("input", { className: "ctl-input", id: "whisperInput", attrs: { autocomplete: "off" } });
    const warn = el("p", { className: "ctl-warn hidden", text: WHISPER_MAX + "자 내외의 짧은 대사만 전달할 수 있습니다." });
    const leaveBtn = el("button", { className: "ctl-btn pri", type: "submit", text: "남긴다." });
    const silentBtn = el("button", { className: "ctl-btn", type: "button", text: "남기지 않는다." });

    const form = el("form", { className: "ctl-form" },
        el("label", { className: "ctl-label", attrs: { for: "whisperInput" } },
            el("span", { text: "마지막으로 전하고 싶은 말은..." }), count),
        input, warn,
        el("div", { className: "ctl-row" }, leaveBtn, silentBtn));

    bindCounter(input, WHISPER_MAX, count, warn, leaveBtn);

    form.addEventListener("submit", function (e) {
        e.preventDefault();
        const value = input.value.trim();
        if (!value || len(input.value) > WHISPER_MAX) return;
        disableAll(form);
        send("whisper", { whisper: value });
    });
    silentBtn.addEventListener("click", function () {
        disableAll(form);
        send("whisper", { whisper: null });
    });
    return form;
}

/* 보낸 뒤 중복 클릭 막기 */
function disableAll(container) {
    container.querySelectorAll("button, input, textarea").forEach(function (node) {
        node.disabled = true;
    });
}

/* 통신 기록 */
function showResult() {
    isResultShown = true;
    renderResult();
    showScene("Result");
    window.scrollTo(0, 0);
}

/* 통신 기록 그리기: 질문 → 폴터가이스트 → 행동 → 응답 */
function renderResult() {
    const polCount = S.exchanges.filter(function (x) {
        return x.poltergeist;
    }).length;

    const list = el("ol", { className: "rec" });
    S.exchanges.forEach(function (x) {
        const item = el("li", null,
            el("span", { className: "rec-n", text: pad(x.turnNo) }),
            el("span", { className: "rec-q", text: x.question }));
        if (x.poltergeist) {
            item.appendChild(el("span", { className: "rec-p",
                text: "대답을 기다리는 동안: " + POLTERGEIST[x.poltergeist].rec(S.place || "", x.poltergeistThing || "") }));
        }
        if (x.action) {
            item.appendChild(el("span", { className: "rec-p", text: "행동이 감지되었습니다. ▶ " + x.action }));
        }
        item.appendChild(el("span", { className: "rec-a", text: "응답: " + (x.answer === "NONE" ? "반응없음" : x.answer) }));
        list.appendChild(item);
    });

    $("result").replaceChildren(
        el("h2", { className: "result-title", text: "S.H.E.E.P | 비인가 통신 기록" }),
        el("p", { className: "result-meta", text: "발신 위치: " + (S.place || "-") + " | 질문 " + S.exchanges.length + "건 | 폴터가이스트 " + polCount + "회" }),
        el("div", { className: "result-cards" }, buildCard(S.living, "LIVING", false), buildCard(S.dead, "DEAD", true)),
        list,
        S.whisper ? el("p", { className: "result-whisper", text: S.whisper }) : null,
        el("p", { className: "result-closing", text: CLOSING }));
    renderWall();
}

/* 남겨진 기록에 남기기 - 생자는 질문 1개, 망자는 한마디 (한 사람당 한 번, 버튼 없이 안 남기면 그만) */
function renderWall() {
    const key = [entry.life, S.isWallDone, !!S.whisper, S.isActionShared].join("|");
    if (key === wallKey) return;
    wallKey = key;

    const box = $("wallBox");
    const recordsLink = el("a", { className: "ctl-btn wall-link", attrs: { href: "status.html#records", target: "_blank", rel: "noopener" } },
        el("i", { className: "bi bi-envelope-paper" }), " 기록실 보러 가기");
    const codeLine = el("div", { className: "wall-code" },
        el("span", null, "기록실 열람 코드 ", el("b", { text: WALL_CODE }), " / 패스워드를 [기록실] 하단에 입력하세요."), recordsLink);

    const consent = isLiving() ? null : buildConsent();

    if (S.isWallDone) {
        fillBox(box, [el("p", { className: "wall-title", text: "잊고 싶지 않은 기억" }),
            el("p", { className: "ctl-note", text: "마음에 새겨두었습니다." }), consent, codeLine]);
        return;
    }

    const note = el("p", { className: "ctl-error" });
    const sendBtn = el("button", { className: "ctl-btn", type: "button" },
        el("i", { className: "bi bi-envelope-paper" }), " 남긴다");
    let body;

    if (isLiving()) {
        body = el("ul", { className: "wall-picks" });
        S.exchanges.forEach(function (x) {
            const radio = el("input", { type: "radio", attrs: { name: "wallPick", value: String(x.turnNo) } });
            radio.addEventListener("change", function () {
                sendBtn.disabled = false;
            });
            body.appendChild(el("li", null, el("label", null,
                radio, el("span", { className: "rec-n", text: pad(x.turnNo) }), el("span", { text: x.question }))));
        });
        sendBtn.disabled = true;
    } else if (S.whisper) {
        body = el("p", { className: "wall-whisper", text: S.whisper });
    } else {
        fillBox(box, [el("p", { className: "wall-title", text: "남겨진 기록" }), consent, codeLine]);
        return;
    }

    sendBtn.addEventListener("click", function () {
        const picked = box.querySelector("input[name=wallPick]:checked");
        if (isLiving() && !picked) return;
        sendBtn.disabled = true;
        submitWall(picked ? Number(picked.value) : null, note, sendBtn);
    });

    fillBox(box, [
        el("p", { className: "wall-title", text: "잊고 싶지 않은 기억" }),
        el("p", { className: "ctl-note", text: isLiving()
            ? "마음에 들었던 질문 하나를 골라 기록실에 남길 수 있습니다. " + (S.isActionShared
                ? "상대방이 동의하여 행동이 함께 기록됩니다"
                : "행동은 제외하고 기록됩니다. 상대방의 동의 시 행동도 함께 기록됩니다.")
            : "마지막 한 마디를 기록실에 남길 수 있습니다." }),
        body, sendBtn, note, consent, codeLine]);
}

/* 칸 채우기 - 없는 요소(null)는 건너뜀 (replaceChildren은 null을 "null" 글자로 넣음) */
function fillBox(box, nodes) {
    box.replaceChildren.apply(box, nodes.filter(Boolean));
}

/* 망자 - 행동 공개 허락 체크 (언제든 바꿀 수 있고, 생자가 이미 남긴 질문에도 반영됨) */
function buildConsent() {
    const check = el("input", { type: "checkbox", id: "actionShareCheck" });
    check.checked = !!S.isActionShared;
    const note = el("p", { className: "ctl-error" });
    check.addEventListener("change", function () {
        check.disabled = true;
        api("consent", { roomCode: entry.roomCode, token: entry.playerToken, isActionShared: check.checked }).then(function (state) {
            check.disabled = false;
            S = state;
        }).catch(function () {
            check.disabled = false;
            check.checked = !check.checked;
            note.textContent = "신호가 불안정합니다. 다시 시도해 주세요.";
        });
    });
    return el("div", null,
        el("label", { className: "ctl-check", attrs: { for: "actionShareCheck" } },
            check, "(체크 시 허용) 상대방이 기록실 등록을 희망할 시 나의 행동/대사가 함께 실려도 괜찮다."),
        note);
}

/* 남겨진 기록 보내기 */
function submitWall(turnNo, note, button) {
    api("wallPost", { roomCode: entry.roomCode, token: entry.playerToken, turnNo: turnNo }).then(function () {
        S.isWallDone = true;
        renderWall();
    }).catch(function (e) {
        note.textContent = e.code === 400 ? e.message : "신호가 불안정합니다. 다시 시도해 주세요.";
        button.disabled = false;
    });
}

/* 공유 문구 (S.H.E.E.P 말투) - 해시태그 앞 줄에 사이트 주소(로비) */
function buildShareText() {
    const count = function (answer) {
        return S.exchanges.filter(function (x) {
            return x.answer === answer;
        }).length;
    };
    const polCount = S.exchanges.filter(function (x) {
        return x.poltergeist;
    }).length;
    return "📟 인증되지 않은 단말기 연결 기록을 확인했습니다\n"
        + "· 발신 위치: " + (S.place || "-") + "\n"
        + siteUrl() + "\n"
        + SHARE_TAGS;
}

/* 줄바꿈 - 띄어쓰기 기준, 한 단어가 너무 길면 글자 단위 */
function wrapText(ctx, text, maxWidth) {
    const lines = [];
    String(text || "").split("\n").forEach(function (paragraph) {
        let line = "";
        paragraph.split(" ").forEach(function (word) {
            const candidate = line ? line + " " + word : word;
            if (ctx.measureText(candidate).width <= maxWidth) {
                line = candidate;
                return;
            }
            if (line) lines.push(line);
            line = "";
            [...word].forEach(function (ch) {
                if (ctx.measureText(line + ch).width > maxWidth && line) {
                    lines.push(line);
                    line = ch;
                } else {
                    line += ch;
                }
            });
        });
        lines.push(line);
    });
    return lines;
}

/* 이미지 불러오기 (사진이 없거나 실패하면 null) */
function loadImage(src) {
    return new Promise(function (resolve) {
        if (!src || src === "loading") {
            resolve(null);
            return;
        }
        const img = new Image();
        img.onload = function () {
            resolve(img);
        };
        img.onerror = function () {
            resolve(null);
        };
        img.src = src;
    });
}

/* 이미지용 신분증 한 장 */
function drawReportCard(ctx, x, y, w, h, agent, life, photo) {
    const isDead = life === "DEAD";
    ctx.save();
    if (isDead) {
        ctx.translate(x + w / 2, y + h / 2);
        ctx.rotate(-0.02);
        ctx.translate(-(x + w / 2), -(y + h / 2));
    }
    ctx.fillStyle = isDead ? "#d9d9d4" : "#ffffff";
    ctx.strokeStyle = isDead ? "#d9d9d4" : "#000000";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fill();
    ctx.stroke();

    if (isDead) {
        ctx.strokeStyle = "rgba(0, 0, 0, .18)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + w * .62, y);
        ctx.lineTo(x + w * .38, y + h);
        ctx.stroke();
    }

    ctx.fillStyle = "#333333";
    ctx.font = "700 18px Rajdhani, Pretendard, sans-serif";
    ctx.fillText(isDead ? "떠나야 하는 사람" : "그리워하는 사람", x + 20, y + 30);

    const px = x + 20;
    const py = y + 46;
    ctx.fillStyle = isDead ? "#c9c9c4" : "#f0f0f0";
    ctx.fillRect(px, py, 88, 104);
    if (photo) {
        if (isDead) ctx.filter = "grayscale(1)";
        ctx.drawImage(photo, px, py, 88, 104);
        ctx.filter = "none";
    }
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, 88, 104);

    ctx.fillStyle = "#111111";
    ctx.font = "700 30px Pretendard, sans-serif";
    ctx.fillText(agent ? agent.name : "-", px + 108, py + 40);
    ctx.font = "500 20px Pretendard, sans-serif";
    ctx.fillStyle = "#444444";
    ctx.fillText(agent ? (agent.age === null || agent.age === undefined ? "--" : agent.age + "세") + " | " + birthdayText(agent) : "", px + 108, py + 80);

    if (isDead) {
        ctx.fillStyle = "#050505";
        ctx.beginPath();
        ctx.ellipse(x + w - 30, y + h - 18, 46, 30, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + w - 98, y + h - 34, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + w - 124, y + h - 58, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

/* 세로형 보고서 이미지 (1080×1350 기본, 글자를 줄여 맞추고 그래도 넘치면 세로로 늘림) */
function drawReport() {
    const W = 1080;
    const BASE_H = 1350;
    const PAD = 64;
    const MIN_SIZE = 18;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = BASE_H;
    const ctx = canvas.getContext("2d");

    return Promise.all([
        document.fonts ? document.fonts.ready : Promise.resolve(),
        loadImage(avatarCache.LIVING),
        loadImage(avatarCache.DEAD)
    ]).then(function (loaded) {
        const polCount = S.exchanges.filter(function (x) {
            return x.poltergeist;
        }).length;
        const qX = PAD + 64;
        const answerW = 150;
        const qW = W - PAD - answerW - 16 - qX;

        /* 질문 목록 배치 계산 */
        const layout = function (size) {
            const rows = [];
            let height = 0;
            S.exchanges.forEach(function (x) {
                ctx.font = "500 " + size + "px Pretendard, sans-serif";
                let qLines = wrapText(ctx, x.question, qW);
                if (qLines.length > 3) {
                    qLines = qLines.slice(0, 3);
                    qLines[2] += "…";
                }
                ctx.font = "italic " + Math.round(size * .78) + "px Pretendard, sans-serif";
                const subs = [];
                if (x.poltergeist) subs.push("대답을 기다리는 동안: " + POLTERGEIST[x.poltergeist].rec(S.place || "", x.poltergeistThing || ""));
                if (x.action) subs.push("행동이 감지되었습니다. ▶ " + x.action);
                const subLines = [];
                subs.forEach(function (t) {
                    wrapText(ctx, t, qW).forEach(function (l) {
                        subLines.push(l);
                    });
                });
                const rowH = qLines.length * size * 1.35 + subLines.length * size * 1.1 + size * .9;
                rows.push({ x: x, qLines: qLines, subLines: subLines, h: rowH });
                height += rowH;
            });
            return { rows: rows, height: height };
        };

        /* 머리말·요약·아래쪽 높이 계산 */
        ctx.font = "22px 'Share Tech Mono', Pretendard, monospace";
        const metaLines = wrapText(ctx, "발신 위치: " + (S.place || "-") + " | 질문 " + S.exchanges.length + "건 | 폴터가이스트 " + polCount + "회", W - PAD * 2);
        ctx.font = "26px 'Share Tech Mono', Pretendard, monospace";
        const whisperLines = S.whisper ? wrapText(ctx, S.whisper, W - PAD * 2 - 48) : [];
        const headHeight = PAD + 36 + 40 + 26 + 30 + 170 + 44 + metaLines.length * 30 + 6;
        const bottomHeight = (whisperLines.length ? whisperLines.length * 36 + 48 + 24 : 0) + 24 + 80;

        let size = 26;
        let plan = layout(size);
        while (plan.height > BASE_H - PAD - bottomHeight - headHeight && size > MIN_SIZE) {
            size -= 1;
            plan = layout(size);
        }
        const H = Math.max(BASE_H, Math.ceil(headHeight + plan.height + bottomHeight + PAD));
        canvas.height = H;

        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, 0, W, H);
        ctx.textBaseline = "alphabetic";

        /* 머리말 */
        let y = PAD + 36;
        ctx.fillStyle = "#f1f1ee";
        ctx.font = "700 40px Rajdhani, Pretendard, sans-serif";
        ctx.fillText("S.H.E.E.P | 비인가 통신 기록", PAD, y);
        ctx.fillStyle = "#8d8d8d";
        ctx.font = "22px 'Share Tech Mono', monospace";
        ctx.textAlign = "right";
        const now = new Date();
        ctx.fillText(now.getFullYear() + "." + pad(now.getMonth() + 1) + "." + pad(now.getDate()), W - PAD, y);
        ctx.textAlign = "left";
        y += 40;
        ctx.font = "22px Pretendard, sans-serif";
        ctx.fillText("당신과 누군가의 망가진 단말기", PAD, y);
        y += 26;
        ctx.fillStyle = "#3b3b3b";
        ctx.fillRect(PAD, y, W - PAD * 2, 2);

        /* 두 요원 */
        y += 30;
        const cardW = (W - PAD * 2 - 28) / 2;
        drawReportCard(ctx, PAD, y, cardW, 170, S.living, "LIVING", loaded[1]);
        drawReportCard(ctx, PAD + cardW + 28, y, cardW, 170, S.dead, "DEAD", loaded[2]);
        y += 170 + 44;

        /* 요약 */
        ctx.fillStyle = "#8d8d8d";
        ctx.font = "22px 'Share Tech Mono', Pretendard, monospace";
        metaLines.forEach(function (line) {
            ctx.fillText(line, PAD, y);
            y += 30;
        });
        y += 6;

        /* 질문 목록 */
        ctx.fillStyle = "#3b3b3b";
        ctx.fillRect(PAD, y, W - PAD * 2, 1);
        plan.rows.forEach(function (row) {
            let ry = y + size * 1.15;
            ctx.fillStyle = "#8d8d8d";
            ctx.font = size + "px 'Share Tech Mono', monospace";
            ctx.fillText(pad(row.x.turnNo), PAD, ry);

            ctx.fillStyle = "#ff9a1f";
            ctx.font = "700 " + size + "px 'Share Tech Mono', Pretendard, monospace";
            ctx.textAlign = "right";
            ctx.fillText(row.x.answer === "NONE" ? "반응없음" : row.x.answer, W - PAD, ry);
            ctx.textAlign = "left";

            ctx.fillStyle = "#f1f1ee";
            ctx.font = "500 " + size + "px Pretendard, sans-serif";
            row.qLines.forEach(function (line) {
                ctx.fillText(line, qX, ry);
                ry += size * 1.35;
            });
            ctx.fillStyle = "#8d8d8d";
            ctx.font = "italic " + Math.round(size * .78) + "px Pretendard, sans-serif";
            row.subLines.forEach(function (line) {
                ctx.fillText(line, qX, ry - size * .2);
                ry += size * 1.1;
            });
            y += row.h;
            ctx.fillStyle = "#3b3b3b";
            ctx.fillRect(PAD, y, W - PAD * 2, 1);
        });

        /* 한마디 */
        y = H - PAD - bottomHeight + 24;
        if (whisperLines.length) {
            const boxH = whisperLines.length * 36 + 48;
            ctx.fillStyle = "#170d02";
            ctx.fillRect(PAD, y, W - PAD * 2, boxH);
            ctx.strokeStyle = "#8a5210";
            ctx.lineWidth = 2;
            ctx.strokeRect(PAD, y, W - PAD * 2, boxH);
            ctx.fillStyle = "#ff9a1f";
            ctx.font = "26px 'Share Tech Mono', Pretendard, monospace";
            whisperLines.forEach(function (line, i) {
                ctx.fillText(line, PAD + 24, y + 24 + 26 + i * 36);
            });
        }

        /* 종료 문구와 해시태그 */
        ctx.fillStyle = "#8d8d8d";
        ctx.font = "22px 'Share Tech Mono', Pretendard, monospace";
        ctx.fillText(CLOSING, PAD, H - PAD - 36);
        ctx.textAlign = "right";
        ctx.fillText(SHARE_TAGS, W - PAD, H - PAD);
        ctx.textAlign = "left";
        return canvas;
    });
}

/* 캔버스 → 파일 */
function canvasToFile(canvas) {
    return new Promise(function (resolve) {
        canvas.toBlob(function (blob) {
            resolve(new File([blob], "broken-terminal-" + entry.roomCode + ".png", { type: "image/png" }));
        }, "image/png");
    });
}

/* 이미지 내려받기 */
function downloadFile(file) {
    const url = URL.createObjectURL(file);
    const link = el("a", { attrs: { href: url, download: file.name } });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () {
        URL.revokeObjectURL(url);
    }, 1000);
}

/* 이미지 저장 버튼 */
function saveImage() {
    drawReport().then(canvasToFile).then(function (file) {
        downloadFile(file);
        $("shareNote").textContent = "기록 이미지를 저장했습니다."
    });
}

/* 공유하기 - 공유 문구를 담은 X 글쓰기 창을 바로 엶 (클릭 즉시 열어야 팝업 차단에 걸리지 않음) */
function shareResult() {
    window.open("https://x.com/intent/post?text=" + encodeURIComponent(buildShareText()), "_blank", "noopener");
    $("shareNote").textContent = "기록 이미지를 함께 올리려면 [이미지 저장] 후 첨부해 주세요.";
}

/* 후기 입력 - 비어 있으면 보내기 버튼 잠금 */
function updateReviewButton() {
    $("reviewBtn").disabled = !$("reviewInput").value.trim();
}

/* 후기 보내기 - 보내면 입력칸을 닫고 안내 문구만 남김 */
function submitReview(event) {
    event.preventDefault();
    const input = $("reviewInput");
    const button = $("reviewBtn");
    const note = $("reviewNote");
    const content = input.value.trim();
    if (!content) return;

    button.disabled = true;
    api("review", { reviewType: "REVIEW", content: content, roomCode: entry ? entry.roomCode : null }).then(function () {
        input.classList.add("hidden");
        button.classList.add("hidden");
        note.textContent = "후기가 전달되었습니다. 감사합니다.";
        note.classList.remove("hidden");
    }).catch(function (e) {
        note.textContent = e.code === 400 ? e.message : "신호가 불안정합니다. 다시 시도해 주세요.";
        note.classList.remove("hidden");
        updateReviewButton();
    });
}

/* 대기실 코드 복사 */
function copyCode() {
    const btn = $("copyBtn");
    const done = function () {
        btn.textContent = "복사됨";
        setTimeout(function () {
            btn.replaceChildren(el("i", { className: "bi bi-clipboard" }), " 코드 복사");
        }, 1500);
    };
    if (navigator.clipboard) {
        navigator.clipboard.writeText(entry.roomCode).then(done).catch(function () {
            selectCode();
        });
    } else {
        selectCode();
    }
}

/* 복사가 막힌 환경 - 코드 글자를 선택해 둠 */
function selectCode() {
    const range = document.createRange();
    range.selectNodeContents($("waitCode"));
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}

/* 로비로 돌아갈 때 입장 정보 지우기 */
function leaveTerminal() {
    try {
        localStorage.removeItem(ENTRY_STORAGE_KEY);
        localStorage.removeItem(INTRO_STORAGE_KEY);
    } catch (e) { }
}

/* 시작 */
document.addEventListener("DOMContentLoaded", function () {
    const soundBtn = $("soundBtn");
    renderSoundButton(soundBtn);
    soundBtn.addEventListener("click", function () {
        toggleSound(soundBtn);
    });

    $("skipBtn").addEventListener("click", endIntro);
    $("placeForm").addEventListener("submit", submitPlace);
    $("thingsForm").addEventListener("submit", submitThings);
    $("copyBtn").addEventListener("click", copyCode);
    $("backBtn").addEventListener("click", leaveTerminal);
    $("shareBtn").addEventListener("click", shareResult);
    $("saveBtn").addEventListener("click", saveImage);
    $("reviewInput").addEventListener("input", updateReviewButton);
    $("reviewForm").addEventListener("submit", submitReview);

    try {
        entry = JSON.parse(localStorage.getItem(ENTRY_STORAGE_KEY));
    } catch (e) {
        entry = null;
    }
    if (!entry || !entry.roomCode || !entry.playerToken) {
        showLost("로비에서 방을 만들거나 코드로 입장해 주세요.");
        return;
    }

    $("topChannel").textContent = (entry.frequency ? "CH " + entry.frequency + " MHz · " : "CODE ") + entry.roomCode;

    api("snapshot", { roomCode: entry.roomCode, token: entry.playerToken })
        .then(function (state) {
            S = state;
            isConnected = true;
            render();
            connect();
        })
        .catch(function () {
            showLost("이미 닫혔거나 존재하지 않는 단말기입니다.");
        });

    /* 탭으로 돌아오면 바로 한 번 확인 */
    document.addEventListener("visibilitychange", function () {
        if (!document.hidden && S && currentScene !== "Lost") connect();
    });
});