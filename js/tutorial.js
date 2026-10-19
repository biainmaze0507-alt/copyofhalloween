/* 게임 안내 - 탭 전환, 소리 설정, 후기·오류 제보 */
const TABS = ["howto", "world", "settings"];   // 탭 순서 (주소 #settings 처럼 바로 열 수 있음)

const REPORT_TEXT = {
    REVIEW: { label: "남겨 주신 후기는 제작활동의 소중한 동력이 됩니다.", done: "후기가 전달되었습니다. 감사합니다." },
    BUG: { label: "어떤 화면에서 무엇을 했을 때 문제가 생겼는지 가급적 상세히 작성해 주세요.", done: "오류 제보가 전달되었습니다." }
};

let reportType = "REVIEW";      // 지금 고른 종류 (후기 / 오류 제보)

function $(id) {
    return document.getElementById(id);
}

/* 탭 열기 */
function showTab(name) {
    const tab = TABS.indexOf(name) >= 0 ? name : TABS[0];
    document.querySelectorAll(".tut-tab").forEach(function (button) {
        button.classList.toggle("active", button.dataset.tab === tab);
    });
    TABS.forEach(function (key) {
        $("section-" + key).classList.toggle("hidden", key !== tab);
    });
}

/* 효과음 버튼 - 안내 페이지 문구 (단말기 화면 버튼은 짧은 문구 그대로) */
function renderGuideSoundButton(button) {
    button.querySelector("i").className = SND ? "bi bi-volume-up-fill" : "bi bi-volume-mute-fill";
    button.querySelector("span").textContent = SND ? " 효과음이 켜져있습니다" : " 효과음이 꺼져있습니다";
}

/* 후기 / 오류 제보 고르기 */
function selectReportType(type) {
    reportType = type;
    document.querySelectorAll(".set-types .set-type").forEach(function (button) {
        button.classList.toggle("active", button.dataset.type === type);
    });
    $("reportLabel").textContent = REPORT_TEXT[type].label;
}

/* 비어 있으면 보내기 버튼 잠금 */
function updateReportButton() {
    $("reportBtn").disabled = !$("reportInput").value.trim();
}

/* 보내기 - 보내면 입력칸을 닫고 안내 문구만 남김 */
function submitReport(event) {
    event.preventDefault();
    const input = $("reportInput");
    const button = $("reportBtn");
    const note = $("reportNote");
    const content = input.value.trim();
    if (!content) return;

    const type = reportType;
    button.disabled = true;
    api("review", { reviewType: type, content: content }).then(function () {
        document.querySelector(".set-types").classList.add("hidden");
        $("reportLabel").classList.add("hidden");
        input.classList.add("hidden");
        button.classList.add("hidden");
        note.textContent = REPORT_TEXT[type].done;
        note.classList.remove("hidden");
    }).catch(function (e) {
        note.textContent = e.code === 400 ? e.message : "신호가 불안정합니다. 다시 시도해 주세요.";
        note.classList.remove("hidden");
        updateReportButton();
    });
}

document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".tut-tab").forEach(function (button) {
        button.addEventListener("click", function () {
            showTab(button.dataset.tab);
            history.replaceState(null, "", "#" + button.dataset.tab);
        });
    });
    showTab(location.hash.replace("#", ""));

    const soundBtn = $("soundBtn");
    renderGuideSoundButton(soundBtn);
    soundBtn.addEventListener("click", function () {
        toggleSound(soundBtn);
        renderGuideSoundButton(soundBtn);
    });

    document.querySelectorAll(".set-types .set-type").forEach(function (button) {
        button.addEventListener("click", function () {
            selectReportType(button.dataset.type);
        });
    });
    $("reportInput").addEventListener("input", updateReportButton);
    $("reportForm").addEventListener("submit", submitReport);
});