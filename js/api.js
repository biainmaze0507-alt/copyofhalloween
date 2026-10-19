/* 서버(Google Apps Script) 호출 공통 - 모든 요청은 POST { action, payload } 하나로 보냄
 *
 * Content-Type을 일부러 지정하지 않음 → 브라우저가 text/plain으로 보내서
 * CORS 사전 요청(OPTIONS)이 생기지 않음 (Apps Script는 OPTIONS를 처리하지 못함)
 *
 * 성공: 서버의 data를 그대로 돌려줌
 * 실패: Error (message = 사용자에게 보여줄 문구, code = 400/403/404/409/500, 연결 실패는 0)
 */
function api(action, payload) {
    if (!API_URL || API_URL.indexOf("PASTE_") === 0) {
        return Promise.reject(apiError("js/config.js에 Apps Script 웹 앱 주소를 먼저 넣어 주세요.", 0));
    }
    return fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: action, payload: payload || {} })
    }).then(function (res) {
        if (!res.ok) throw apiError("신호가 불안정합니다. 잠시 뒤 다시 시도해 주세요.", res.status);
        return res.json();
    }, function () {
        throw apiError("서버 연결에 실패했습니다.", 0);
    }).then(function (body) {
        if (!body || !body.ok) throw apiError((body && body.error) || "요청을 처리할 수 없습니다.", body ? body.code : 500);
        return body.data;
    });
}

function apiError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
}

/* 사이트 첫 화면 주소 (GitHub Pages처럼 하위 폴더에 올려도 맞게) */
function siteUrl() {
    return location.origin + location.pathname.replace(/[^/]*$/, "");
}
