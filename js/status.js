/* 현황판 - 숫자 불러오기 (30초마다 새로 고침) */
const STATUS_REFRESH_MS = 30 * 1000;    // 새로 고침 간격

function $(id) {
    return document.getElementById(id);
}

/* 천 단위 쉼표 */
function formatNumber(n) {
    return Number(n || 0).toLocaleString("ko-KR");
}

/* 두 자리 숫자 */
function pad(n) {
    return String(n).padStart(2, "0");
}

/* 숫자 채우기 */
function renderStatus(status) {
    $("liveCount").textContent = formatNumber(status.liveCount);
    $("sessionCount").textContent = formatNumber(status.sessionCount);
    $("wallCount").textContent = formatNumber((status.wallWhisperCount || 0) + (status.wallQuestionCount || 0));
    $("wallDetail").textContent = "한마디 " + formatNumber(status.wallWhisperCount) + " | 질문 " + formatNumber(status.wallQuestionCount);

    const now = new Date();
    $("updatedAt").textContent = "마지막 집계 " + pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
}

/* 서버에서 받기 */
function loadStatus() {
    api("status")
        .then(renderStatus)
        .catch(function () {
            $("updatedAt").textContent = "신호가 불안정합니다.";
        });
}

document.addEventListener("DOMContentLoaded", function () {
    loadStatus();
    setInterval(loadStatus, STATUS_REFRESH_MS);
});