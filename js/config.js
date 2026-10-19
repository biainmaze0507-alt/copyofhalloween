/* 설정 - Apps Script를 배포하고 받은 웹 앱 주소(…/exec)를 아래에 붙여 넣으세요. */
const DEPLOYED_API_URL = "https://script.google.com/macros/s/AKfycbwaDA_REncmiKYjQZvzYLi4YGX11pfH91ABjsVqXqpwoGAW4qREEC7MAgYhWb8fbcFe/exec";

/* 로컬 연습 서버(node dev/server.js, 8787번 포트)로 열었으면 가짜 백엔드(/api)를 사용 */
const API_URL = location.port === "8787" ? "/api" : DEPLOYED_API_URL;
