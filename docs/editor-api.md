# 카드 에디터 API 문서

카드 상세 페이지의 에디터에서 사용되는 API 목록입니다.

---

## 목차

1. [blocks.go](#1-blocksgo)
   - [GET /boards/{boardID}/blocks](#11-get-boardsboardidblocks)
   - [POST /boards/{boardID}/blocks](#12-post-boardsboardidblocks)
   - [PATCH /boards/{boardID}/blocks/{blockID}](#13-patch-boardsboardidblocksblockid)
   - [PATCH /boards/{boardID}/blocks](#14-patch-boardsboardidblocks-배치)
   - [DELETE /boards/{boardID}/blocks/{blockID}](#15-delete-boardsboardidblocksblockid)
   - [POST /boards/{boardID}/blocks/{blockID}/undelete](#16-post-boardsboardidblocksblockidundelete)
   - [POST /boards/{boardID}/blocks/{blockID}/duplicate](#17-post-boardsboardidblocksblockidduplicate)
2. [files.go](#2-filesgo)
   - [POST /teams/{teamID}/{boardID}/files](#21-post-teamsteamidboardidfiles)
   - [GET /files/teams/{teamID}/{boardID}/{filename}](#22-get-filesteamsteamidboardidfilename)
   - [GET /files/teams/{teamID}/{boardID}/{filename}/info](#23-get-filesteamsteamidboardidfilenameinfo)
3. [content_blocks.go](#3-content_blocksgo)
   - [POST /content-blocks/{blockID}/moveto/{where}/{dstBlockID}](#31-post-content-blocksblockidmovetowherecedstblockid)
4. [API 요약 테이블](#api-요약-테이블)

---

## 1. blocks.go

블록 CRUD를 담당하는 핵심 API 파일입니다.

### 1.1 GET /boards/{boardID}/blocks

- **설명**: 보드에 속한 블록 목록 조회
- **인증**: 선택 (read_token 또는 세션)

#### 쿼리 파라미터

| 파라미터 | 필수 | 설명 |
|---------|------|------|
| parent_id | 선택 | 부모 블록 ID (생략시 전체 조회) |
| type | 선택 | 블록 타입 필터 |
| all | 선택 | 보드의 모든 블록 조회 |
| block_id | 선택 | 특정 블록 ID로 조회 |

#### 사용되는 동작

- 카드 컨텐츠 로딩
- 보드 전체 블록 조회

#### SQL 쿼리

```sql
SELECT 
    id, 
    parent_id, 
    created_by, 
    modified_by, 
    schema, 
    type, 
    title, 
    COALESCE(fields, '{}'), 
    to_char(insert_at, 'YYYY-MM-DD HH:MI:SS.MS') AS insertAt,
    create_at, 
    update_at, 
    delete_at, 
    COALESCE(board_id, '0')
FROM focalboard_blocks
WHERE board_id = {boardID}
  AND parent_id = {parentID}  -- 선택 (파라미터 있을 때만)
  AND type = {blockType}       -- 선택 (파라미터 있을 때만)
```

---

### 1.2 POST /boards/{boardID}/blocks

- **설명**: 새 블록 생성 (배열로 여러 블록 동시 생성 가능)
- **인증**: 필수 (세션)

#### 쿼리 파라미터

| 파라미터 | 필수 | 설명 |
|---------|------|------|
| disable_notify | 선택 | 알림 비활성화 (대량 삽입 시 사용) |
| sourceBoardID | 선택 | 템플릿에서 보드 생성 시 원본 보드 ID |

#### 사용되는 동작

- 새 텍스트 블록 추가
- 새 H1/H2/H3 제목 추가
- 새 리스트 아이템 추가
- 새 체크박스 추가
- 새 구분선(divider) 추가
- 새 인용문(quote) 추가
- 새 이미지 블록 추가
- 클립보드 이미지 붙여넣기

#### SQL 쿼리

```sql
-- 1. 기존 블록 존재 여부 확인
SELECT ... FROM focalboard_blocks WHERE id = {blockId};

-- 2-A. 기존 블록이 없으면 INSERT
INSERT INTO focalboard_blocks 
    (channel_id, id, parent_id, created_by, modified_by, schema, type, title, fields, create_at, update_at, delete_at, board_id)
VALUES 
    ('', {id}, {parentId}, {userId}, {userId}, {schema}, {type}, {title}, {fieldsJSON}, {now}, {now}, 0, {boardId});

-- 2-B. 기존 블록이 있으면 UPDATE
UPDATE focalboard_blocks
SET parent_id = {parentId},
    modified_by = {userId},
    schema = {schema},
    type = {type},
    title = {title},
    fields = {fieldsJSON},
    update_at = {now},
    delete_at = {deleteAt}
WHERE id = {blockId}
  AND board_id = {boardId};

-- 3. 이력 저장 (INSERT/UPDATE 모두)
INSERT INTO focalboard_blocks_history 
    (channel_id, id, parent_id, created_by, modified_by, schema, type, title, fields, create_at, update_at, delete_at, board_id)
VALUES 
    ('', {id}, {parentId}, {createdBy}, {userId}, {schema}, {type}, {title}, {fieldsJSON}, {createAt}, {now}, 0, {boardId});
```

---

### 1.3 PATCH /boards/{boardID}/blocks/{blockID}

- **설명**: 단일 블록 수정
- **인증**: 필수 (세션)

#### 쿼리 파라미터

| 파라미터 | 필수 | 설명 |
|---------|------|------|
| disable_notify | 선택 | 알림 비활성화 |

#### 사용되는 동작

- 텍스트 블록 내용 수정
- H1/H2/H3 제목 내용 수정
- 리스트 아이템 내용 수정
- 인용문 내용 수정
- 체크박스 체크/해제 토글
- 체크박스 텍스트 수정
- 카드 제목 수정
- 카드 아이콘 변경/삭제
- 카드 contentOrder 순서 업데이트

#### SQL 쿼리

```sql
-- 1. 기존 블록 조회
SELECT ... FROM focalboard_blocks WHERE id = {blockId};

-- 2. 패치 적용 후 블록 업데이트 (insertBlock 호출)
UPDATE focalboard_blocks
SET parent_id = {parentId},
    modified_by = {userId},
    schema = {schema},
    type = {type},
    title = {title},
    fields = {fieldsJSON},
    update_at = {now},
    delete_at = {deleteAt}
WHERE id = {blockId}
  AND board_id = {boardId};

-- 3. 이력 저장
INSERT INTO focalboard_blocks_history 
    (channel_id, id, parent_id, created_by, modified_by, schema, type, title, fields, create_at, update_at, delete_at, board_id)
VALUES 
    ('', {id}, {parentId}, {createdBy}, {userId}, {schema}, {type}, {title}, {fieldsJSON}, {createAt}, {now}, 0, {boardId});
```

---

### 1.4 PATCH /boards/{boardID}/blocks (배치)

- **설명**: 여러 블록 일괄 수정
- **인증**: 필수 (세션)

#### 쿼리 파라미터

| 파라미터 | 필수 | 설명 |
|---------|------|------|
| disable_notify | 선택 | 알림 비활성화 |

#### 요청 바디

```json
{
  "block_ids": ["block1", "block2"],
  "block_patches": [
    { "title": "새 제목1" },
    { "title": "새 제목2" }
  ]
}
```

#### SQL 쿼리

```sql
-- 각 블록에 대해 1.3 PATCH와 동일한 쿼리 실행
```

---

### 1.5 DELETE /boards/{boardID}/blocks/{blockID}

- **설명**: 블록 삭제 (history에 기록 후 실제 삭제)
- **인증**: 필수 (세션)

#### 쿼리 파라미터

| 파라미터 | 필수 | 설명 |
|---------|------|------|
| disable_notify | 선택 | 알림 비활성화 |

#### 사용되는 동작

- 블록 삭제

#### SQL 쿼리

```sql
-- 1. 블록 조회
SELECT ... FROM focalboard_blocks WHERE id = {blockId};

-- 2. 이력에 삭제 기록 (delete_at에 현재 시간 설정)
INSERT INTO focalboard_blocks_history 
    (board_id, id, parent_id, schema, type, title, fields, modified_by, create_at, update_at, delete_at, created_by)
VALUES 
    ({boardId}, {id}, {parentId}, {schema}, {type}, {title}, {fieldsJSON}, {modifiedBy}, {createAt}, {now}, {now}, {createdBy});

-- 3. 파일 정보 삭제 (이미지/첨부파일 블록인 경우)
UPDATE FileInfo
SET DeleteAt = {now}
WHERE id IN ({fileIds});  -- fileId와 attachmentId 모두 처리

-- 4. 블록 실제 삭제
DELETE FROM focalboard_blocks
WHERE id = {blockId};

-- 5. 하위 블록들도 재귀적으로 삭제 (deleteBlockChildren)
```

---

### 1.6 POST /boards/{boardID}/blocks/{blockID}/undelete

- **설명**: 삭제된 블록 복원
- **인증**: 필수 (세션)

#### 사용되는 동작

- 삭제 취소 (Undo)

#### SQL 쿼리

```sql
-- 1. 이력에서 마지막 상태 조회
SELECT id, parent_id, created_by, modified_by, schema, type, title, 
       COALESCE(fields, '{}'), insert_at, create_at, update_at, delete_at, 
       COALESCE(board_id, '0')
FROM focalboard_blocks_history
WHERE id = {blockId}
ORDER BY insert_at DESC, update_at DESC
LIMIT 1;

-- 2. 이력 테이블에 복원 기록 삽입
INSERT INTO focalboard_blocks_history 
    (board_id, channel_id, id, parent_id, schema, type, title, fields, modified_by, create_at, update_at, delete_at, created_by)
VALUES 
    ({boardId}, '', {id}, {parentId}, {schema}, {type}, {title}, {fieldsJSON}, {modifiedBy}, {createAt}, {now}, 0, {createdBy});

-- 3. 블록 테이블에 복원
INSERT INTO focalboard_blocks 
    (board_id, channel_id, id, parent_id, schema, type, title, fields, modified_by, create_at, update_at, delete_at, created_by)
VALUES 
    ({boardId}, '', {id}, {parentId}, {schema}, {type}, {title}, {fieldsJSON}, {modifiedBy}, {createAt}, {now}, 0, {createdBy});

-- 4. 파일 복원 (이미지/첨부파일 블록인 경우)
UPDATE FileInfo SET DeleteAt = 0 WHERE id IN ({fileIds});

-- 5. 하위 블록들도 재귀적으로 복원 (undeleteBlockChildren)
```

---

### 1.7 POST /boards/{boardID}/blocks/{blockID}/duplicate

- **설명**: 블록 복제 (하위 블록 포함)
- **인증**: 필수 (세션)

#### 쿼리 파라미터

| 파라미터 | 필수 | 설명 |
|---------|------|------|
| asTemplate | 선택 | 템플릿으로 복제 여부 |

#### 사용되는 동작

- 블록 복제

#### SQL 쿼리

```sql
-- 1. 원본 블록과 하위 블록 조회 (getSubTree2)
SELECT id, parent_id, created_by, modified_by, schema, type, title, 
       COALESCE(fields, '{}'), insert_at, create_at, update_at, delete_at, 
       COALESCE(board_id, '0')
FROM focalboard_blocks
WHERE (id = {blockId} OR parent_id = {blockId})
  AND board_id = {boardId}
ORDER BY insert_at, update_at;

-- 2. 새 ID 생성 후 모든 블록 삽입 (GenerateBlockIDs로 새 ID 생성)
-- 각 블록에 대해 insertBlock 호출
INSERT INTO focalboard_blocks 
    (channel_id, id, parent_id, created_by, modified_by, schema, type, title, fields, create_at, update_at, delete_at, board_id)
VALUES 
    ('', {newId}, {newParentId}, {userId}, {userId}, {schema}, {type}, {title}, {fieldsJSON}, {now}, {now}, 0, {boardId});

-- 3. 각 블록에 대해 이력 저장
INSERT INTO focalboard_blocks_history 
    (channel_id, id, parent_id, created_by, modified_by, schema, type, title, fields, create_at, update_at, delete_at, board_id)
VALUES 
    ('', {newId}, {newParentId}, {userId}, {userId}, {schema}, {type}, {title}, {fieldsJSON}, {now}, {now}, 0, {boardId});
```

---

## 2. files.go

이미지/파일 업로드 및 조회를 담당하는 API 파일입니다.

### 2.1 POST /teams/{teamID}/{boardID}/files

- **설명**: 이미지/파일 업로드
- **인증**: 필수 (세션)
- **Content-Type**: `multipart/form-data`

#### 사용되는 동작

- 이미지 파일 업로드
- 클립보드 이미지 붙여넣기 (업로드 단계)

#### SQL 쿼리

```sql
-- Mattermost FileInfo API를 통해 저장 (servicesAPI.SaveFile 사용)
-- 내부적으로 다음과 같은 형태로 저장
INSERT INTO FileInfo 
    (Id, CreatorId, PostId, CreateAt, UpdateAt, DeleteAt, Path, ThumbnailPath, 
     PreviewPath, Name, Extension, Size, MimeType, Width, Height, 
     HasPreviewImage, MiniPreview, Content, RemoteId, Archived)
VALUES 
    ({fileId}, {userId}, '', {now}, {now}, 0, {path}, {thumbnailPath}, 
     {previewPath}, {fileName}, {extension}, {size}, {mimeType}, {width}, {height}, 
     {hasPreview}, {miniPreview}, '', '', false);
```

---

### 2.2 GET /files/teams/{teamID}/{boardID}/{filename}

- **설명**: 이미지 파일 조회 (렌더링용)
- **인증**: 선택 (read_token 또는 세션)

#### 사용되는 동작

- 에디터에서 이미지 렌더링

#### 동작 설명

```
1. 권한 확인 (read_token 또는 세션)
2. 보드 정보 조회
3. 파일 정보 및 리더 조회 (app.GetFile)
4. 파일이 없을 경우 channelID 기반 경로에서 재시도 (레거시 호환)
5. Content-Type 헤더 설정 후 파일 스트리밍 응답
```

---

### 2.3 GET /files/teams/{teamID}/{boardID}/{filename}/info

- **설명**: 파일 메타데이터 조회
- **인증**: 선택 (read_token 또는 세션)

#### 응답 예시

```json
{
  "id": "abc123",
  "name": "image.png",
  "extension": "png",
  "size": 12345,
  "mimeType": "image/png",
  "width": 800,
  "height": 600
}
```

---

## 3. content_blocks.go

블록 순서 변경(드래그앤드롭)을 담당하는 API 파일입니다.

### 3.1 POST /content-blocks/{blockID}/moveto/{where}/{dstBlockID}

- **설명**: 블록 순서 변경 (드래그앤드롭)
- **인증**: 필수 (세션)
- **파라미터**: `where`는 `before` 또는 `after`

#### 사용되는 동작

- 블록을 다른 블록 앞으로 이동 (where = "before")
- 블록을 다른 블록 뒤로 이동 (where = "after")

#### 동작 로직

```
1. 소스 블록(blockID) 조회
2. 대상 블록(dstBlockID) 조회
3. where 파라미터 검증 ("before" 또는 "after"만 허용)
4. 두 블록의 parent_id가 동일한지 확인
5. 부모 카드 조회
6. contentOrder 배열에서 블록 순서 재조정
7. 부모 카드 PATCH로 업데이트
```

#### SQL 쿼리

```sql
-- 1. 소스 블록 조회
SELECT ... FROM focalboard_blocks WHERE id = {blockId};

-- 2. 대상 블록 조회  
SELECT ... FROM focalboard_blocks WHERE id = {dstBlockId};

-- 3. 부모 카드 조회
SELECT ... FROM focalboard_blocks WHERE id = {parentId};

-- 4. 부모 카드의 contentOrder 업데이트 (PatchBlock 호출)
UPDATE focalboard_blocks
SET fields = {newFieldsJSON},  -- contentOrder 배열 변경
    modified_by = {userId},
    update_at = {now}
WHERE id = {cardId}
  AND board_id = {boardId};

-- 5. 이력 저장
INSERT INTO focalboard_blocks_history 
    (channel_id, id, parent_id, created_by, modified_by, schema, type, title, fields, create_at, update_at, delete_at, board_id)
VALUES 
    ('', {cardId}, {parentId}, {createdBy}, {userId}, {schema}, 'card', {title}, {newFieldsJSON}, {createAt}, {now}, 0, {boardId});
```

---

## API 요약 테이블

| API | 메서드 | 설명 | 주요 동작 |
|-----|--------|------|----------|
| `/boards/{boardID}/blocks` | `GET` | 블록 조회 | 컨텐츠 로딩 |
| `/boards/{boardID}/blocks` | `POST` | 블록 생성 | 새 블록 추가 |
| `/boards/{boardID}/blocks/{blockID}` | `PATCH` | 블록 수정 | 텍스트 수정, 토글 |
| `/boards/{boardID}/blocks` | `PATCH` | 블록 일괄 수정 | 여러 블록 동시 수정 |
| `/boards/{boardID}/blocks/{blockID}` | `DELETE` | 블록 삭제 | 블록 삭제 |
| `/boards/{boardID}/blocks/{blockID}/undelete` | `POST` | 블록 복원 | Undo |
| `/boards/{boardID}/blocks/{blockID}/duplicate` | `POST` | 블록 복제 | 복제 |
| `/teams/{teamID}/{boardID}/files` | `POST` | 파일 업로드 | 이미지 추가 |
| `/files/teams/{teamID}/{boardID}/{filename}` | `GET` | 파일 조회 | 이미지 렌더링 |
| `/files/teams/{teamID}/{boardID}/{filename}/info` | `GET` | 파일 정보 조회 | 메타데이터 조회 |
| `/content-blocks/{blockID}/moveto/{where}/{dstBlockID}` | `POST` | 블록 이동 | 드래그앤드롭 |

---

## API 파일별 사용 비율

```
blocks.go ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 85%
 ├── GET    /boards/{boardID}/blocks           (블록 조회)
 ├── POST   /boards/{boardID}/blocks           (블록 생성)
 ├── PATCH  /boards/{boardID}/blocks/{blockID} (블록 수정) ⭐ 가장 빈번
 ├── PATCH  /boards/{boardID}/blocks           (블록 일괄 수정)
 ├── DELETE /boards/{boardID}/blocks/{blockID} (블록 삭제)
 └── POST   .../undelete, duplicate            (복원/복제)

files.go ━━━━━━━━━━━━━ 10%
 ├── POST   /teams/{teamID}/{boardID}/files    (이미지 업로드)
 ├── GET    /files/teams/.../filename          (이미지 조회)
 └── GET    /files/teams/.../filename/info     (파일 정보)

content_blocks.go ━━━━ 5%
 └── POST   /content-blocks/{blockID}/moveto/... (드래그앤드롭)
```

---

## 관련 테이블

| 테이블 | 설명 |
|--------|------|
| `focalboard_blocks` | 현재 블록 상태 |
| `focalboard_blocks_history` | 블록 변경 이력 (모든 변경 기록) |
| `FileInfo` | 파일 메타데이터 (Mattermost 테이블) |

---

## 블록 SELECT 필드 구조

실제 코드에서 블록 조회 시 사용되는 필드:

```sql
SELECT 
    id,
    parent_id,
    created_by,
    modified_by,
    schema,
    type,
    title,
    COALESCE(fields, '{}'),
    to_char(insert_at, 'YYYY-MM-DD HH:MI:SS.MS') AS insertAt,  -- PostgreSQL
    -- date_format(insert_at, '%Y-%m-%d %H:%i:%s') AS insertAt  -- MySQL
    create_at,
    update_at,
    delete_at,
    COALESCE(board_id, '0')
FROM focalboard_blocks
```
