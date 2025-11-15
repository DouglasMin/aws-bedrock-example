# Nova Sonic 실시간 음성 대화 앱 (Tool Use)

AWS Bedrock Nova Sonic을 사용한 실시간 음성 대화 애플리케이션입니다. Tool Use 기능으로 날씨 조회와 웹 검색이 가능합니다.

## 주요 기능

- 🎤 **실시간 음성 대화**: Speech-to-Speech 양방향 스트리밍
- 🔧 **Tool Use**: 날씨 조회 (Open-Meteo), 웹 검색 (DuckDuckGo)
- 🛑 **Barge-in**: AI가 말하는 중에도 끊고 말할 수 있음
- 🎙️ **다양한 음성**: Matthew, Tiffany, Amy 등 여러 음성 선택 가능
- 📦 **모듈화 구조**: 쉽게 확장 가능한 깔끔한 코드 구조

## 프로젝트 구조

```
nova-sonic-tool-use/
├── server.js              # Entry point (dotenv + src/server 로드)
├── src/
│   ├── server.js         # WebSocket 서버
│   ├── client.js         # Bedrock 클라이언트 래퍼
│   ├── session.js        # 세션 관리 클래스
│   └── config.js         # 설정 상수
├── tools/
│   ├── index.js          # Tool registry
│   ├── weather.js        # 날씨 조회 도구
│   └── search.js         # 웹 검색 도구
├── public/
│   ├── index.html        # 웹 UI
│   ├── app.js            # 클라이언트 JavaScript
│   └── audio-processor.js # AudioWorklet 프로세서
├── package.json
├── .env                  # AWS 자격증명 (생성 필요)
└── README.md            # 이 파일
```

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 AWS 자격증명을 입력하세요:

```bash
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=us-east-1
PORT=3000
```

### 3. 서버 실행

```bash
npm start
```

브라우저에서 `http://localhost:3000`에 접속하세요.

## 사용법

1. 브라우저에서 `http://localhost:3000` 접속
2. 음성 선택 (Matthew, Tiffany, Amy 등)
3. "Start Conversation" 버튼 클릭
4. 마이크 권한 허용
5. 말하기 시작!
6. AI가 필요시 자동으로 도구 사용 (날씨, 검색)
7. "Stop Conversation"으로 종료

## Tool Use 기능

### 사용 가능한 도구

#### 1. 날씨 조회 (`get_weather`)
- **설명**: 도시 이름으로 현재 날씨 정보 조회
- **API**: Open-Meteo (무료, API 키 불필요)
- **예시**: "서울 날씨 알려줘", "What's the weather in Tokyo?"

#### 2. 웹 검색 (`web_search`)
- **설명**: DuckDuckGo로 실시간 정보 검색
- **API**: DuckDuckGo Instant Answer (무료, API 키 불필요)
- **예시**: "최신 뉴스 검색해줘", "Search for AI news"

### 새로운 도구 추가하기

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

그 다음 `tools/index.js`에 등록:

```javascript
const yourTool = require('./your-tool');

const tools = {
  'get_weather': weather,
  'web_search': search,
  'your_tool_name': yourTool  // 추가
};
```

## 기술 스택

### Backend
- **Node.js**: 서버 런타임
- **Express**: 웹 서버
- **WebSocket (ws)**: 실시간 양방향 통신
- **AWS SDK**: Bedrock Runtime Client
- **HTTP/2**: 양방향 스트리밍

### Frontend
- **Vanilla JavaScript**: 프레임워크 없이 순수 JS
- **Web Audio API**: 오디오 입출력 처리
- **AudioWorklet**: 실시간 오디오 프로세싱
- **Canvas API**: 음성 시각화

### AI & APIs
- **AWS Bedrock Nova Sonic**: 음성 대화 AI
- **Open-Meteo API**: 날씨 정보
- **DuckDuckGo API**: 웹 검색

## 주요 구현 특징

### 1. 모듈화된 구조
- **Entry Point** (`server.js`): 최소한의 코드로 앱 시작
- **Server** (`src/server.js`): WebSocket 연결 관리만
- **Client** (`src/client.js`): Bedrock 통신 로직만
- **Session** (`src/session.js`): 세션 상태 및 이벤트 스트림 관리
- **Config** (`src/config.js`): 모든 설정 상수 중앙 관리

### 2. 이벤트 스트리밍
- Async Generator로 양방향 스트리밍 구현
- 오디오 청크를 큐에 저장하여 순차 전송
- Bedrock 응답을 실시간으로 처리

### 3. Tool Use 통합
- 도구 스펙을 `promptStart`에 포함
- AI가 자동으로 적절한 도구 선택
- 도구 실행 결과를 다시 AI에게 전달
- AI가 결과를 자연스럽게 음성으로 설명

### 4. Barge-in 지원
- `contentEnd.stopReason === 'INTERRUPTED'` 감지
- 오디오 재생 큐 즉시 비우기
- 사용자가 AI 말을 끊고 바로 말할 수 있음

### 5. Speculative Text 필터링
- `generationStage === 'SPECULATIVE'` 텍스트 무시
- FINAL 텍스트만 UI에 표시
- 더 정확한 전사 결과 제공

## 문제 해결

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

## 참고 문서

- [Nova Sonic 공식 문서](https://docs.aws.amazon.com/nova/latest/userguide/speech.html)
- [Nova Sonic Tool Use](https://docs.aws.amazon.com/nova/latest/userguide/speech-tools.html)
- [AWS 샘플 코드](https://github.com/aws-samples/amazon-nova-samples/tree/main/speech-to-speech)

## 라이선스

MIT License

## 기여

이슈나 개선 사항이 있으면 자유롭게 제안해주세요!
