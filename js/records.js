/* 남겨진 기록 (현황판 아래) - 열람 코드 확인, 떠도는 기록(무작위) 30초마다 교체, 모든 기록(종류별 최신순, 번호 + 쪽 이동) */
const RECORDS_CODE_KEY = "synchalloweenRecordsCode";   // 한 번 맞힌 열람 코드
const SHUFFLE_MS = 30 * 1000;                           // 떠도는 기록 교체 간격
const PAGER_WINDOW = 5;                                 // 쪽 번호를 한 번에 몇 개까지 보여줄지

/* 통신 기록 문장 (결과지와 같은 표기) */
const POLTERGEIST_REC = {
    FLICKER: function () { return "불이 깜빡였다"; },
    SHAKE: function (thing) { return thing + josa(thing, "이", "가") + " 흔들렸다"; },
    DROP: function (thing) { return thing + josa(thing, "이", "가") + " 떨어졌다"; },
    NOISE: function () { return "화면에 노이즈가 일었다"; },
    SOUND: function () { return "괴상한 소리가 들렸다"; }
};

let code = "";              // 확인된 열람 코드
let currentType = "WHISPER";// 모든 기록에서 보고 있는 종류
let currentPage = 0;        // 지금 보고 있는 쪽 (0부터)
let shuffleTimer = 0;       // 떠도는 기록 교체 예약

function $(id) {
    return document.getElementById(id);
}

/* 요소 만들기 - 글자는 항상 textContent로 넣음 */
function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

/* 받침에 따라 조사 고르기 */
function josa(word, withBatchim, withoutBatchim) {
    const value = word || "";
    const charCode = value.charCodeAt(value.length - 1);
    if (charCode < 0xAC00 || charCode > 0xD7A3) return withBatchim + "(" + withoutBatchim + ")";
    return (charCode - 0xAC00) % 28 ? withBatchim : withoutBatchim;
}

/* 기록 한 장 (no가 있으면 맨 위에 "No. 12" 처럼 번호) */
function buildCard(post, no) {
    const card = el("div", post.postType === "WHISPER" ? "rec-card whisper" : "rec-card");
    if (no) card.appendChild(el("span", "rec-no", "No. " + no));
    if (post.postType === "WHISPER") {
        card.appendChild(el("span", null, post.whisper));
        return card;
    }

    card.appendChild(el("span", "rec-q", post.question));
    if (post.poltergeist && POLTERGEIST_REC[post.poltergeist]) {
        card.appendChild(el("span", "rec-p", "감지된 현상: " + POLTERGEIST_REC[post.poltergeist](post.poltergeistThing || "")));
    }
    if (post.action) card.appendChild(el("span", "rec-p", "누군가의 행동이 감지되었습니다 ▶ " + post.action));
    card.appendChild(el("span", "rec-a", "응답: " + (post.answer === "NONE" ? "반응없음" : post.answer)));
    return card;
}

/* 서버에서 응답 받기 (코드가 틀리면 잠금 화면으로) */
function apiChecked(action, payload) {
    return api(action, payload).catch(function (e) {
        if (e.code === 403) lock("열람 코드가 맞지 않습니다.");
        throw e;
    });
}

/* 떠도는 기록 - 한마디 3개 + 질문 3개 섞어서 */
function loadRandom() {
    Promise.all([
        apiChecked("wallRandom", { code: code, type: "WHISPER" }),
        apiChecked("wallRandom", { code: code, type: "QUESTION" })
    ]).then(function (lists) {
        const posts = lists[0].concat(lists[1]).sort(function () {
            return Math.random() - .5;
        });
        const box = $("randomList");
        box.replaceChildren();
        if (!posts.length) {
            box.appendChild(el("p", "rec-note", "아직 기록이 없습니다."));
            return;
        }
        posts.forEach(function (post) {
            box.appendChild(buildCard(post));
        });
    }).catch(function () { });
    clearTimeout(shuffleTimer);
    shuffleTimer = setTimeout(loadRandom, SHUFFLE_MS);
}

/* 모든 기록 - 한 쪽 불러오기 (최신이 위, 번호는 오래된 것부터 1번 → 최신이 가장 큰 번호) */
function loadPage(page) {
    apiChecked("wallList", { code: code, type: currentType, page: page }).then(function (data) {
        const total = data.total || 0;
        const size = data.size || 20;
        currentPage = page;
        const list = $("allList");
        list.replaceChildren();
        data.posts.forEach(function (post, i) {
            list.appendChild(buildCard(post, total - (page * size + i)));
        });
        $("allEmpty").classList.toggle("hidden", data.posts.length > 0);
        renderPager(Math.ceil(total / size));
    }).catch(function () { });
}

/* 쪽 이동 - [‹] 1 2 3 4 5 [›] (지금 쪽을 가운데에 두고 최대 PAGER_WINDOW개) */
function renderPager(totalPages) {
    const pager = $("pager");
    pager.replaceChildren();
    if (totalPages <= 1) return;

    const addButton = function (label, page, isActive, isDisabled) {
        const button = el("button", "rec-page" + (isActive ? " active" : ""), label);
        button.type = "button";
        button.disabled = isDisabled;
        button.addEventListener("click", function () {
            loadPage(page);
            $("allList").scrollIntoView({ behavior: "smooth", block: "start" });
        });
        pager.appendChild(button);
    };

    let start = Math.max(0, currentPage - Math.floor(PAGER_WINDOW / 2));
    const end = Math.min(totalPages, start + PAGER_WINDOW);
    start = Math.max(0, end - PAGER_WINDOW);

    addButton("‹", currentPage - 1, false, currentPage === 0);
    for (let p = start; p < end; p++) {
        addButton(String(p + 1), p, p === currentPage, false);
    }
    addButton("›", currentPage + 1, false, currentPage >= totalPages - 1);
}

/* 잠금 화면으로 */
function lock(message) {
    code = "";
    try {
        localStorage.removeItem(RECORDS_CODE_KEY);
    } catch (e) { }
    clearTimeout(shuffleTimer);
    $("recordsBody").classList.add("hidden");
    $("lockForm").classList.remove("hidden");
    $("lockError").textContent = message || "";
}

/* 열기 */
function unlock(value) {
    code = value;
    try {
        localStorage.setItem(RECORDS_CODE_KEY, value);
    } catch (e) { }
    $("lockForm").classList.add("hidden");
    $("recordsBody").classList.remove("hidden");
    loadRandom();
    loadPage(0);
}

/* 열람 코드 확인 */
function submitCode(event) {
    event.preventDefault();
    const value = $("codeInput").value.trim();
    if (!value) return;
    api("wallUnlock", { password: value }).then(function () {
        unlock(value);
    }).catch(function (e) {
        $("lockError").textContent = e.code === 403 ? "열람 코드가 맞지 않습니다." : "신호가 불안정합니다. 다시 시도해 주세요.";
    });
}

document.addEventListener("DOMContentLoaded", function () {
    $("lockForm").addEventListener("submit", submitCode);
    $("shuffleBtn").addEventListener("click", loadRandom);
    document.querySelectorAll(".rec-tab").forEach(function (tab) {
        tab.addEventListener("click", function () {
            currentType = tab.dataset.type;
            document.querySelectorAll(".rec-tab").forEach(function (other) {
                other.classList.toggle("active", other === tab);
            });
            loadPage(0);
        });
    });

    let saved = "";
    try {
        saved = localStorage.getItem(RECORDS_CODE_KEY) || "";
    } catch (e) { }
    if (saved) unlock(saved);
});