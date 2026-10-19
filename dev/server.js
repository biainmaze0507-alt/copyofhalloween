/*
 * 로컬 연습 서버 - 구글 계정 없이 바로 실행해 보기
 *   node dev/server.js  →  http://localhost:8787
 * 정적 파일(html/css/js/sound)을 보여 주고, POST /api 는 가짜 Apps Script(Code.gs)로 보냄.
 * 시트 내용은 dev/mock-db.json 에 쌓입니다. (지우면 처음부터)
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { createGas } = require("./gas-mock");

const PORT = 8787;
const ROOT = path.join(__dirname, "..");
const DELAY_MS = Number(process.env.MOCK_DELAY || 300);   // 실제 Apps Script처럼 약간 느리게
const gas = createGas({ dbFile: path.join(__dirname, "mock-db.json") });

const TYPES = {
    ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
    ".json": "application/json", ".mp3": "audio/mpeg", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon"
};

http.createServer(function (req, res) {
    const url = new URL(req.url, "http://localhost");

    if (url.pathname === "/api" && req.method === "POST") {
        let body = "";
        req.on("data", function (chunk) { body += chunk; });
        req.on("end", function () {
            setTimeout(function () {
                res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
                res.end(gas.post(body));
            }, DELAY_MS);
        });
        return;
    }

    const file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)));
    if (!file.startsWith(ROOT) || file.includes(path.sep + "dev" + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end("Not found");
        return;
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
}).listen(PORT, function () {
    console.log("로컬 연습 서버: http://localhost:" + PORT);
    console.log("두 사람 플레이는 일반 창 + 시크릿 창(또는 다른 브라우저)으로 열어 보세요.");
});
