# Mattermost Boards 플러그인 아키텍처 문서

## 개요

**Mattermost Boards (Focalboard)** 플러그인은 Trello, Notion, Asana의 오픈소스 대안으로, Mattermost 내에서 프로젝트 관리 기능을 제공합니다. Go 기반 서버와 React/TypeScript 기반 웹앱으로 구성된 Mattermost 플러그인입니다.

---

## 1. 저장소/빌드/실행 정보

### 기술 스택

| 항목 | 내용 |
|------|------|
| 서버 언어 | Go 1.24+ |
| 프론트엔드 | TypeScript, React 17 |
| 빌드 시스템 | Makefile + npm |
| 데이터베이스 | PostgreSQL, MySQL, SQLite |
| 플러그인 버전 | 9.2.1 |
| 최소 서버 버전 | Mattermost 10.7.0 |

### 주요 빌드 명령

```bash
# 의존성 설치
cd webapp && npm install

# 전체 빌드 (서버 + 웹앱)
make dist

# 개발 모드 빌드 (현재 OS/아키텍처만)
MM_DEBUG=true make dist

# 로컬 서버에 배포
make deploy

# 변경 감지 및 자동 배포
make watch-plugin

# 테스트 실행
make test

# 코드 스타일 체크
make check-style
```

### 핵심 설정 파일

| 파일 | 역할 |
|------|------|
| `plugin.json` | 플러그인 메타데이터 및 설정 스키마 |
| `go.mod` | Go 모듈 의존성 |
| `webapp/package.json` | npm 의존성 |
| `Makefile` | 빌드 자동화 |

---

## 2. 디렉터리 구조 맵

```
okrbest-plugin-newboards/
├── server/                    # Go 백엔드
│   ├── main.go               # 플러그인 진입점
│   ├── plugin.go             # Mattermost Plugin 인터페이스 구현
│   ├── api/                  # REST API 핸들러
│   │   ├── api.go           # 라우터 등록 및 공통 유틸
│   │   ├── boards.go        # 보드 API
│   │   ├── blocks.go        # 블록 API
│   │   ├── cards.go         # 카드 API
│   │   └── ...
│   ├── app/                  # 비즈니스 로직 계층
│   │   ├── app.go           # App 구조체 및 초기화
│   │   ├── boards.go        # 보드 비즈니스 로직
│   │   ├── blocks.go        # 블록 비즈니스 로직
│   │   └── ...
│   ├── boards/               # 플러그인 앱 초기화
│   │   └── boardsapp.go     # BoardsApp (핵심 진입점)
│   ├── model/                # 도메인 모델
│   │   ├── board.go         # Board 모델
│   │   ├── block.go         # Block 모델
│   │   ├── card.go          # Card 모델
│   │   └── ...
│   ├── services/             # 서비스 레이어
│   │   ├── store/           # 데이터 접근 계층
│   │   │   ├── store.go     # Store 인터페이스
│   │   │   ├── sqlstore/    # SQL 구현체
│   │   │   └── mockstore/   # 테스트용 Mock
│   │   ├── permissions/     # 권한 서비스
│   │   ├── notify/          # 알림 서비스
│   │   ├── metrics/         # 메트릭스 수집
│   │   └── audit/           # 감사 로그
│   ├── ws/                   # WebSocket 처리
│   │   ├── plugin_adapter.go
│   │   └── server.go
│   └── integrationtests/     # 통합 테스트
│
├── webapp/                    # React 프론트엔드
│   ├── src/
│   │   ├── index.tsx        # 앱 진입점
│   │   ├── app.tsx          # 메인 앱 컴포넌트
│   │   ├── octoClient.ts    # 서버 API 클라이언트
│   │   ├── wsclient.ts      # WebSocket 클라이언트
│   │   ├── mutator.ts       # 상태 변경 유틸리티
│   │   ├── components/      # UI 컴포넌트
│   │   │   ├── workspace.tsx
│   │   │   ├── centerPanel.tsx
│   │   │   ├── cardDetail/
│   │   │   ├── kanban/
│   │   │   ├── table/
│   │   │   └── ...
│   │   ├── store/           # Redux 상태 관리
│   │   │   ├── index.ts     # Store 설정
│   │   │   ├── boards.ts    # 보드 슬라이스
│   │   │   ├── cards.ts     # 카드 슬라이스
│   │   │   └── ...
│   │   ├── blocks/          # 블록 타입 정의
│   │   ├── properties/      # 프로퍼티 타입
│   │   └── utils/           # 유틸리티
│   ├── tests/               # 테스트 설정
│   └── i18n/                # 국제화
│
├── build/                    # 빌드 스크립트
│   ├── setup.mk             # 빌드 환경 설정
│   └── pluginctl/           # 플러그인 배포 도구
│
├── docs/                     # 문서
├── assets/                   # 정적 리소스
└── public/                   # 공개 리소스
```

---

## 3. 실행 흐름 (런타임 플로우)

### 플러그인 초기화 흐름

```mermaid
flowchart TB
    subgraph Mattermost
        MM[Mattermost Server]
    end
    
    subgraph PluginInit[플러그인 초기화]
        Main[main.go: main]
        Plugin[plugin.go: Plugin]
        OnActivate[OnActivate]
    end
    
    subgraph BoardsCore[Boards 핵심]
        BoardsApp[boards/boardsapp.go: BoardsApp]
        Server[server/server.go: Server]
        App[app/app.go: App]
    end
    
    subgraph Services[서비스 레이어]
        API[api/api.go: API]
        Store[store/store.go: Store]
        SQLStore[sqlstore/sqlstore.go]
        WSAdapter[ws/plugin_adapter.go]
        Permissions[permissions/]
        Notify[notify/]
    end
    
    MM --> Main
    Main --> Plugin
    Plugin --> OnActivate
    OnActivate --> BoardsApp
    BoardsApp --> Server
    BoardsApp --> WSAdapter
    Server --> App
    Server --> API
    API --> App
    App --> Store
    App --> Permissions
    App --> Notify
    Store --> SQLStore
```

### HTTP 요청 처리 흐름

```mermaid
sequenceDiagram
    participant Client as 웹앱 (OctoClient)
    participant Plugin as Plugin.ServeHTTP
    participant Router as Gorilla Mux Router
    participant API as API Handler
    participant App as App (비즈니스 로직)
    participant Store as Store (데이터 접근)
    participant DB as Database
    
    Client->>Plugin: HTTP Request
    Plugin->>Router: ServeHTTP
    Router->>API: Route Handler
    API->>API: 인증/권한 검증
    API->>App: 비즈니스 로직 호출
    App->>Store: 데이터 조작
    Store->>DB: SQL Query
    DB-->>Store: Result
    Store-->>App: Model
    App-->>API: Response
    API-->>Client: JSON Response
```

### WebSocket 실시간 동기화

```mermaid
sequenceDiagram
    participant Client as 웹앱 (WSClient)
    participant MM as Mattermost WS
    participant Adapter as Plugin WS Adapter
    participant App as App
    
    Client->>MM: WebSocket Connect
    MM->>Adapter: OnWebSocketConnect
    Adapter->>Adapter: 세션 등록
    
    Note over Client,App: 데이터 변경 발생
    App->>Adapter: BroadcastBlockChange
    Adapter->>MM: PublishWebSocketEvent
    MM->>Client: WS Message (UPDATE_BLOCK)
    Client->>Client: Redux Store 업데이트
```

---

## 4. 핵심 모듈/컴포넌트 설명

### 서버 측 핵심 모듈

#### Plugin (`server/plugin.go`)
Mattermost 플러그인 인터페이스 구현체로, 플러그인 라이프사이클을 관리합니다.

```go
type Plugin struct {
    plugin.MattermostPlugin
    boardsApp *boards.BoardsApp
}

// 주요 메서드
func (p *Plugin) OnActivate() error      // 플러그인 활성화
func (p *Plugin) OnDeactivate() error    // 플러그인 비활성화
func (p *Plugin) ServeHTTP(...)          // HTTP 요청 처리
func (p *Plugin) OnWebSocketConnect(...) // WS 연결 처리
```

#### BoardsApp (`server/boards/boardsapp.go`)
핵심 애플리케이션 초기화 및 구성을 담당합니다.

```go
type BoardsApp struct {
    configuration   *configuration
    manifest        *mm_model.Manifest
    server          *server.Server
    wsPluginAdapter ws.PluginAdapterInterface
    servicesAPI     model.ServicesAPI
    logger          mlog.LoggerIFace
}
```

**주요 역할:**
- Store, Permission, Notification 서비스 초기화
- Server 인스턴스 생성
- WebSocket 어댑터 설정

#### App (`server/app/app.go`)
비즈니스 로직의 중심으로, 모든 도메인 로직을 처리합니다.

```go
type App struct {
    config       *config.Configuration
    store        store.Store
    auth         *auth.Auth
    wsAdapter    ws.Adapter
    filesBackend fileBackend
    webhook      *webhook.Client
    metrics      *metrics.Metrics
    notifications *notify.Service
    permissions  permissions.PermissionsService
    // ...
}
```

**주요 기능:**
- 보드/블록/카드 CRUD
- 권한 검증
- 파일 업로드/다운로드
- 알림 발송
- 실시간 동기화 트리거

#### API (`server/api/api.go`)
REST API 라우팅 및 핸들러를 제공합니다.

```go
func (a *API) RegisterRoutes(r *mux.Router) {
    apiv2 := r.PathPrefix("/api/v2").Subrouter()
    apiv2.Use(a.panicHandler)
    apiv2.Use(a.requireCSRFToken)
    
    // 라우트 등록
    a.registerBoardsRoutes(apiv2)
    a.registerBlocksRoutes(apiv2)
    a.registerCardsRoutes(apiv2)
    // ...
}
```

### 웹앱 측 핵심 모듈

#### OctoClient (`webapp/src/octoClient.ts`)
서버 API와 통신하는 클라이언트 클래스입니다.

```typescript
class OctoClient {
    // 보드 관련
    async getBoards(): Promise<Board[]>
    async createBoard(board: Board): Promise<Response>
    async patchBoard(boardId: string, patch: BoardPatch): Promise<Response>
    
    // 블록 관련
    async getAllBlocks(boardID: string): Promise<Block[]>
    async insertBlocks(boardId: string, blocks: Block[]): Promise<Response>
    
    // 파일 관련
    async uploadFile(rootID: string, file: File): Promise<string | undefined>
}
```

#### WSClient (`webapp/src/wsclient.ts`)
WebSocket을 통한 실시간 동기화를 담당합니다.

```typescript
// WebSocket 메시지 타입
export const ACTION_UPDATE_BOARD = 'UPDATE_BOARD'
export const ACTION_UPDATE_BLOCK = 'UPDATE_BLOCK'
export const ACTION_UPDATE_MEMBER = 'UPDATE_MEMBER'
// ...

// 변경 이벤트 핸들러 등록
addOnChange(handler: OnChangeHandler, type: ChangeHandlerType): void
```

#### Redux Store (`webapp/src/store/`)
애플리케이션 상태를 관리합니다.

| 슬라이스 | 역할 |
|---------|------|
| `boards.ts` | 보드 목록 및 현재 보드 |
| `cards.ts` | 카드 데이터 |
| `views.ts` | 뷰 설정 |
| `contents.ts` | 콘텐츠 블록 |
| `users.ts` | 사용자 정보 |
| `sidebar.ts` | 사이드바 카테고리 |

---

## 5. 데이터 모델/저장소 접근

### 핵심 도메인 모델

#### Board (`server/model/board.go`)
```go
type Board struct {
    ID             string                   `json:"id"`
    TeamID         string                   `json:"teamId"`
    ChannelID      string                   `json:"channelId"`
    CreatedBy      string                   `json:"createdBy"`
    ModifiedBy     string                   `json:"modifiedBy"`
    Type           BoardType                `json:"type"`           // "O" (Open) | "P" (Private)
    MinimumRole    BoardRole                `json:"minimumRole"`
    Title          string                   `json:"title"`
    Description    string                   `json:"description"`
    Icon           string                   `json:"icon"`
    Properties     map[string]interface{}   `json:"properties"`
    CardProperties []map[string]interface{} `json:"cardProperties"`
    CreateAt       int64                    `json:"createAt"`
    UpdateAt       int64                    `json:"updateAt"`
    DeleteAt       int64                    `json:"deleteAt"`
}
```

#### Block (`server/model/block.go`)
```go
type Block struct {
    ID         string                 `json:"id"`
    ParentID   string                 `json:"parentId"`
    BoardID    string                 `json:"boardId"`
    CreatedBy  string                 `json:"createdBy"`
    ModifiedBy string                 `json:"modifiedBy"`
    Type       BlockType              `json:"type"`      // card, view, text, image, etc.
    Title      string                 `json:"title"`
    Fields     map[string]interface{} `json:"fields"`
    CreateAt   int64                  `json:"createAt"`
    UpdateAt   int64                  `json:"updateAt"`
    DeleteAt   int64                  `json:"deleteAt"`
}
```

#### 모델 관계도

```mermaid
erDiagram
    Team ||--o{ Board : contains
    Board ||--o{ Block : contains
    Board ||--o{ BoardMember : has
    User ||--o{ BoardMember : is
    User ||--o{ Category : owns
    Category ||--o{ CategoryBoard : contains
    Board ||--o{ CategoryBoard : "belongs to"
    Block ||--o{ Block : "parent-child"
    Board ||--o{ Sharing : has
```

### Store 인터페이스 (`server/services/store/store.go`)

Store 인터페이스는 모든 데이터 접근 메서드를 정의합니다.

```go
type Store interface {
    // 블록 관련
    GetBlocks(opts model.QueryBlocksOptions) ([]*model.Block, error)
    InsertBlock(block *model.Block, userID string) error  // @withTransaction
    DeleteBlock(blockID string, modifiedBy string) error  // @withTransaction
    
    // 보드 관련
    GetBoard(id string) (*model.Board, error)
    InsertBoard(board *model.Board, userID string) (*model.Board, error)
    PatchBoard(boardID string, patch *model.BoardPatch, userID string) (*model.Board, error)
    
    // 멤버 관련
    GetMemberForBoard(boardID, userID string) (*model.BoardMember, error)
    SaveMember(bm *model.BoardMember) (*model.BoardMember, error)
    
    // 시스템
    Shutdown() error
    DBType() string
    DBVersion() string
}
```

**트랜잭션 지원:**
- `@withTransaction` 주석이 있는 메서드는 자동으로 트랜잭션 내에서 실행
- 코드 생성기가 트랜잭션 래퍼 자동 생성

### SQLStore 구현 (`server/services/store/sqlstore/`)

| 파일 | 역할 |
|------|------|
| `sqlstore.go` | Store 인터페이스 구현, DB 연결 관리 |
| `board.go` | Board 관련 쿼리 |
| `blocks.go` | Block 관련 쿼리 |
| `migrate.go` | DB 마이그레이션 |
| `migrations/` | 마이그레이션 SQL 파일 |

---

## 6. 외부 연동/인터페이스

### Mattermost Plugin API (`server/model/services_api.go`)

```go
type ServicesAPI interface {
    // 설정
    GetConfig() *mmModel.Config
    
    // 데이터베이스
    GetMasterDB() (*sql.DB, error)
    
    // 사용자
    GetUserByID(userID string) (*mmModel.User, error)
    
    // 파일
    GetFileInfo(fileID string) (*mmModel.FileInfo, error)
    
    // 채널
    GetChannelByID(channelID string) (*mmModel.Channel, error)
    
    // 라이선스
    GetLicense() *mmModel.License
    
    // 로깅
    GetLogger() mlog.LoggerIFace
}
```

### WebSocket 통신

**서버 측 (`server/ws/plugin_adapter.go`):**
```go
type PluginAdapterInterface interface {
    OnWebSocketConnect(webConnID, userID string)
    OnWebSocketDisconnect(webConnID, userID string)
    WebSocketMessageHasBeenPosted(webConnID, userID string, req *mm_model.WebSocketRequest)
    BroadcastBlockChange(teamID string, block *model.Block)
    BroadcastBoardChange(teamID string, board *model.Board)
}
```

**클라이언트 측 (`webapp/src/wsclient.ts`):**
```typescript
// 구독
client.subscribeToTeam(teamId)

// 이벤트 핸들러
client.addOnChange((items) => {
    // 블록 변경 처리
}, 'block')
```

### 알림 시스템 (`server/services/notify/`)

두 가지 알림 백엔드를 지원합니다:

1. **Mentions Backend**: 카드에서 @mention 시 알림
2. **Subscriptions Backend**: 구독한 카드/보드 변경 시 알림

```mermaid
flowchart LR
    App[App] --> NotifyService[Notify Service]
    NotifyService --> Mentions[Mentions Backend]
    NotifyService --> Subscriptions[Subscriptions Backend]
    Mentions --> MM[Mattermost DM]
    Subscriptions --> MM
```

---

## 7. 설정/구성 (Configurability)

### 플러그인 설정 (`plugin.json`)

```json
{
    "settings_schema": {
        "settings": [{
            "key": "EnablePublicSharedBoards",
            "type": "bool",
            "display_name": "Enable Publicly-Shared Boards:",
            "default": false,
            "help_text": "공개 공유 보드 링크 활성화"
        }]
    }
}
```

### 서버 설정 (`server/services/config/config.go`)

```go
type Configuration struct {
    ServerRoot               string            // 서버 루트 URL
    Port                     int               // 포트 (기본: 8000)
    DBType                   string            // postgres, mysql, sqlite3
    DBConfigString           string            // DB 연결 문자열
    DBTablePrefix            string            // 테이블 접두사
    FilesDriver              string            // local, amazons3
    FilesPath                string            // 파일 저장 경로
    EnablePublicSharedBoards bool              // 공개 공유 활성화
    EnableDataRetention      bool              // 데이터 보존 정책
    DataRetentionDays        int               // 데이터 보존 기간
    FeatureFlags             map[string]string // 기능 플래그
    // ...
}
```

### 환경 변수

`FOCALBOARD_` 접두사로 설정 오버라이드 가능:

```bash
export FOCALBOARD_DBTYPE=postgres
export FOCALBOARD_DBCONFIG="postgres://user:pass@localhost/boards"
export FOCALBOARD_ENABLEPUBLICSHAREDBOARDS=true
```

---

## 8. 에러 처리/로깅/관측성

### 로깅 (`mlog` 라이브러리)

```go
// 로그 레벨
logger.Debug("디버그 메시지", mlog.String("key", "value"))
logger.Info("정보 메시지")
logger.Warn("경고 메시지")
logger.Error("에러 메시지", mlog.Err(err))
```

로그 설정은 `plugin.go`의 `defaultLoggingConfig()`에서 정의됩니다.

### 에러 응답 (`server/model/errorResponse.go`)

```go
// 에러 타입
func NewErrBadRequest(msg string) error
func NewErrUnauthorized(msg string) error
func NewErrForbidden(msg string) error
func NewErrNotFound(msg string) error

// API 에러 응답
func (a *API) errorResponse(w http.ResponseWriter, r *http.Request, err error) {
    // 에러 타입에 따른 HTTP 상태 코드 매핑
}
```

### 메트릭스 (`server/services/metrics/`)

Prometheus 메트릭스 지원:

| 메트릭 | 설명 |
|--------|------|
| `focalboard_blocks_total` | 총 블록 수 |
| `focalboard_boards_total` | 총 보드 수 |
| `focalboard_api_requests_total` | API 요청 수 |
| `focalboard_api_request_duration` | API 응답 시간 |

### 감사 로그 (`server/services/audit/`)

민감한 작업에 대한 감사 로그를 기록합니다:
- 보드 생성/삭제
- 멤버 추가/제거
- 권한 변경

---

## 9. 테스트 구조와 품질 게이트

### 테스트 종류 및 위치

| 테스트 유형 | 위치 | 실행 명령 |
|------------|------|-----------|
| 서버 단위 테스트 | `server/**/*_test.go` | `make server-test` |
| 서버 통합 테스트 | `server/integrationtests/` | `go test ./integrationtests/...` |
| Store 테스트 | `server/services/store/storetests/` | `go test ./services/store/...` |
| 웹앱 단위 테스트 | `webapp/src/**/*.test.ts(x)` | `cd webapp && npm test` |
| E2E 테스트 | `webapp/cypress/` | `cd webapp && npm run cypress:run` |

### 테스트 실행

```bash
# 전체 테스트
make test

# 서버 테스트만
make server-test

# 웹앱 테스트만
cd webapp && npm test

# 커버리지 리포트
make coverage

# CI 시뮬레이션
make ci
```

### 품질 게이트

```bash
# Go 린트
cd server && golangci-lint run ./...

# TypeScript/ESLint
cd webapp && npm run check

# 타입 체크
cd webapp && npm run check-types

# 스타일 린트
cd webapp && npm run check  # stylelint 포함
```

---

## 10. 변경 포인트 가이드

### 새 API 엔드포인트 추가

1. **핸들러 작성** (`server/api/`)
   ```go
   // server/api/myfeature.go
   func (a *API) handleMyFeature(w http.ResponseWriter, r *http.Request) {
       // 구현
   }
   ```

2. **라우트 등록** (`server/api/api.go`)
   ```go
   func (a *API) registerMyFeatureRoutes(r *mux.Router) {
       r.HandleFunc("/myfeature", a.handleMyFeature).Methods("GET")
   }
   
   // RegisterRoutes 내에 추가
   a.registerMyFeatureRoutes(apiv2)
   ```

3. **비즈니스 로직** (`server/app/`)
   ```go
   // server/app/myfeature.go
   func (a *App) DoMyFeature(params ...) (*model.Result, error) {
       // 비즈니스 로직
   }
   ```

### 데이터 모델 추가

1. **모델 정의** (`server/model/`)
   ```go
   // server/model/mymodel.go
   type MyModel struct {
       ID       string `json:"id"`
       // 필드...
   }
   ```

2. **Store 인터페이스 확장** (`server/services/store/store.go`)
   ```go
   type Store interface {
       // 기존 메서드...
       GetMyModel(id string) (*model.MyModel, error)
       InsertMyModel(m *model.MyModel) error
   }
   ```

3. **SQLStore 구현** (`server/services/store/sqlstore/`)
   ```go
   // server/services/store/sqlstore/mymodel.go
   func (s *SQLStore) GetMyModel(id string) (*model.MyModel, error) {
       // SQL 구현
   }
   ```

4. **마이그레이션 추가** (`server/services/store/sqlstore/migrations/`)

### UI 컴포넌트 추가

1. **컴포넌트 생성** (`webapp/src/components/`)
   ```tsx
   // webapp/src/components/myComponent/myComponent.tsx
   const MyComponent: React.FC<Props> = (props) => {
       return <div>...</div>
   }
   ```

2. **스타일** (`webapp/src/components/myComponent/myComponent.scss`)

3. **테스트** (`webapp/src/components/myComponent/myComponent.test.tsx`)

### Redux 상태 추가

1. **슬라이스 생성** (`webapp/src/store/`)
   ```typescript
   // webapp/src/store/mySlice.ts
   const mySlice = createSlice({
       name: 'myFeature',
       initialState,
       reducers: { ... }
   })
   ```

2. **Store에 추가** (`webapp/src/store/index.ts`)

### DB 마이그레이션 추가

1. `server/services/store/sqlstore/migrations/` 디렉터리에 SQL 파일 추가
2. 버전 번호 규칙: `000XXX_description.up.sql`, `000XXX_description.down.sql`

---

## 추가 정보

### A. 권한 시스템

Mattermost의 권한 체계와 통합됩니다 (`server/services/permissions/`):

| 역할 | 권한 |
|------|------|
| `viewer` | 읽기 전용 |
| `commenter` | 댓글 작성 가능 |
| `editor` | 편집 가능 |
| `admin` | 전체 관리 권한 |

### B. 주요 API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/v2/boards` | GET | 보드 목록 |
| `/api/v2/boards` | POST | 보드 생성 |
| `/api/v2/boards/{boardId}` | GET, PATCH, DELETE | 보드 CRUD |
| `/api/v2/boards/{boardId}/blocks` | GET, POST | 블록 조회/생성 |
| `/api/v2/boards/{boardId}/blocks/{blockId}` | PATCH, DELETE | 블록 수정/삭제 |
| `/api/v2/cards` | POST | 카드 생성 |
| `/api/v2/teams/{teamId}/categories` | GET, POST | 카테고리 관리 |
| `/api/v2/users/me` | GET | 현재 사용자 |

### C. BlockSuite 에디터 통합

카드 상세 편집에 BlockSuite 에디터가 통합되어 있습니다:
- 문서: [docs/editor-api.md](editor-api.md)
- 서버: `server/api/blocksuite.go`
- 모델: `server/model/blocksuite_doc.go`

### D. 개발 환경 설정

```bash
# 1. Mattermost 서버 클론 (형제 디렉터리)
git clone https://github.com/mattermost/mattermost-server ../mattermost

# 2. 개발 모드 활성화
export MM_DEBUG=true

# 3. 의존성 설치
cd webapp && npm install

# 4. 빌드 및 배포
make deploy

# 5. 실시간 개발
make watch-plugin
```

---

## 참고 문서

- [Mattermost Plugin 개발 가이드](https://developers.mattermost.com/integrate/plugins/)
- [원본 Focalboard 저장소](https://github.com/mattermost/focalboard)
- [BlockSuite 에디터 API](editor-api.md)

