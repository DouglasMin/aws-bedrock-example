# Nova Sonic 실시간 음성 챗봇 with Tool Use

AWS Bedrock Nova Sonic 모델을 사용한 실시간 음성 대화 챗봇입니다.
**Tool Use 기능**을 통해 날씨 조회, 웹 검색 등 외부 도구를 활용할 수 있습니다.

## 🚀 빠른 시작

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정
cp .env.example .env
# .env 파일을 열어서 AWS 자격 증명 입력

# 3. 서버 실행
npm start

# 4. 브라우저에서 열기
# http://localhost:3000
```

## 📋 요구사항

- Node.js 18 이상
- AWS 계정 및 자격 증명
- Nova Sonic 모델 접근 권한

## ⚙️ 환경 변수

`.env` 파일에 다음 내용을 입력하세요:

```env
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=us-east-1
PORT=3000
```

## 🔧 Tool Use 기능

### 사용 가능한 도구

1. **날씨 조회** (`get_weather`)
   - 도시 이름으로 현재 날씨 정보 조회
   - API: Open-Meteo (무료, API 키 불필요)
   - 예시: "서울 날씨 알려줘", "What's the weather in Tokyo?"

2. **웹 검색** (`web_search`)
   - DuckDuckGo로 실시간 정보 검색
   - API: DuckDuckGo Instant Answer (무료, API 키 불필요)
   - 예시: "최신 뉴스 검색해줘", "Search for AI news"

### 도구 추가 방법

새로운 도구를 추가하려면:

1. `tools/` 폴더에 새 파일 생성 (예: `calculator.js`)
2. `getToolSpec()` 함수로 도구 스펙 정의
3. `execute(params)` 함수로 실제 로직 구현
4. `tools/index.js`에 도구 등록

**예시 구조:**

```javascript
// tools/your-tool.js
function getToolSpec() {
  return {
    toolSpec: {
      name: "your_tool_name",
      description: "도구 설명 - 언제 사용할지 명확히",
      inputSchema: {
        json: JSON.stringify({
          type: "object",
          properties: {
            param1: {
              type: "string",
              description: "파라미터 설명"
            }
          },
          required: ["param1"]
        })
      }
    }
  };
}

async function execute(params) {
  // 도구 실행 로직
  return { result: "success" };
}

module.exports = { getToolSpec, execute };
```

## 🎤 사용법

1. 브라우저에서 `http://localhost:3000` 접속
2. 음성 선택 (Matthew, Tiffany, Amy 등)
3. "Start Conversation" 버튼 클릭
4. 마이크 권한 허용
5. 말하기 시작!
6. AI가 필요시 자동으로 도구 사용
7. "Stop Conversation"으로 종료

## 🏗️ 프로젝트 구조

```
nova-sonic-tool-use/
├── server.js              # Node.js WebSocket 서버 (Tool Use 통합)
├── tools/                 # 도구 모듈
│   ├── weather.js        # 날씨 조회 도구
│   ├── search.js         # 웹 검색 도구
│   └── index.js          # 도구 레지스트리
├── public/
│   ├── index.html        # 웹 UI (도구 메시지 표시)
│   ├── app.js            # 클라이언트 JavaScript
│   └── audio-processor.js # AudioWorklet 프로세서
├── package.json
├── .env                  # 환경 변수 (생성 필요)
└── README.md
```

## 🎯 주요 기능

- ✅ 실시간 양방향 음성 스트리밍
- ✅ 낮은 지연시간 대화
- ✅ 실시간 ASR 전사 (음성 → 텍스트)
- ✅ 자연스러운 음성 응답
- ✅ 11가지 음성 선택 (다국어 지원)
- ✅ WebSocket 기반 실시간 통신
- ✅ **Tool Use: 날씨 조회, 웹 검색**
- ✅ **자동 도구 선택 (AI가 필요시 판단)**
- ✅ **도구 실행 결과 실시간 표시**

## 📚 Tool Use 작동 방식

1. **사용자 음성 입력**: "서울 날씨 알려줘"
2. **Nova Sonic 분석**: 날씨 정보가 필요함을 인식
3. **도구 호출**: `get_weather` 도구 자동 선택
4. **도구 실행**: Open-Meteo API로 날씨 조회
5. **결과 반환**: 도구 결과를 Nova Sonic에 전달
6. **음성 응답**: "서울의 현재 날씨는 맑음이고 기온은 15도입니다"

## 🔧 문제 해결

### 마이크 권한 오류
- 브라우저 설정에서 마이크 권한 확인
- HTTPS 또는 localhost에서만 작동

### WebSocket 연결 오류
- AWS 자격 증명 확인
- Nova Sonic 모델 접근 권한 확인
- 방화벽 설정 확인

### 오디오 재생 안 됨
- 브라우저 오디오 권한 확인
- 스피커/헤드폰 연결 확인

### 도구가 호출되지 않음
- 명확한 질문 사용 (예: "날씨 알려줘" 대신 "서울 날씨 알려줘")
- 서버 로그에서 도구 호출 확인
- `temperature: 0` 설정 확인 (tool use 최적화)

## 📖 참고 문서

- [Nova Sonic 공식 문서](https://docs.aws.amazon.com/nova/latest/userguide/speech.html)
- [Nova Sonic Tool Use](https://docs.aws.amazon.com/nova/latest/userguide/speech-tools.html)
- [AWS 샘플 코드](https://github.com/aws-samples/amazon-nova-samples/tree/main/speech-to-speech)

## 🎨 기술 스택

- **Backend**: Node.js, Express, WebSocket
- **Frontend**: Vanilla JavaScript, Web Audio API, AudioWorklet
- **AI**: AWS Bedrock Nova Sonic
- **APIs**: Open-Meteo (날씨), DuckDuckGo (검색)

## 📝 라이선스

MIT License
