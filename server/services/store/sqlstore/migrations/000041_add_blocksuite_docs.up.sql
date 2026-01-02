-- ============================================================
-- CUSTOM MIGRATION: BlockSuite Integration
-- Date: 2024-12-29
-- 
-- Purpose: Add BlockSuite document storage for card content
-- Note: This is a custom migration. Keep this in mind when
--       merging upstream Focalboard updates.
-- ============================================================

-- ============================================================
-- 1. blocksuite_docs 테이블 생성
-- ============================================================

{{if .postgres}}
    CREATE TABLE IF NOT EXISTS {{.prefix}}blocksuite_docs (
        doc_id VARCHAR(255) PRIMARY KEY,
        card_id VARCHAR(36) NOT NULL,
        board_id VARCHAR(36) NOT NULL,
        snapshot BYTEA NOT NULL,
        created_at BIGINT,
        updated_at BIGINT,
        created_by VARCHAR(36),
        updated_by VARCHAR(36),
        CONSTRAINT unique_blocksuite_card UNIQUE (card_id)
    );
{{end}}

{{if .mysql}}
    CREATE TABLE IF NOT EXISTS {{.prefix}}blocksuite_docs (
        doc_id VARCHAR(255) PRIMARY KEY,
        card_id VARCHAR(36) NOT NULL,
        board_id VARCHAR(36) NOT NULL,
        snapshot LONGBLOB NOT NULL,
        created_at BIGINT,
        updated_at BIGINT,
        created_by VARCHAR(36),
        updated_by VARCHAR(36),
        CONSTRAINT unique_blocksuite_card UNIQUE (card_id)
    ) DEFAULT CHARACTER SET utf8mb4;
{{end}}

{{if .sqlite}}
    CREATE TABLE IF NOT EXISTS {{.prefix}}blocksuite_docs (
        doc_id VARCHAR(255) PRIMARY KEY,
        card_id VARCHAR(36) NOT NULL,
        board_id VARCHAR(36) NOT NULL,
        snapshot BLOB NOT NULL,
        created_at BIGINT,
        updated_at BIGINT,
        created_by VARCHAR(36),
        updated_by VARCHAR(36),
        CONSTRAINT unique_blocksuite_card UNIQUE (card_id)
    );
{{end}}

-- ============================================================
-- 2. 인덱스 생성
-- ============================================================

{{- /* createIndexIfNeeded tableName columns */ -}}
{{ createIndexIfNeeded "blocksuite_docs" "card_id" }}
{{ createIndexIfNeeded "blocksuite_docs" "board_id" }}
{{ createIndexIfNeeded "blocksuite_docs" "updated_at" }}

{{if .postgres}}
    CREATE INDEX IF NOT EXISTS idx_{{.prefix}}blocksuite_docs_created_by 
        ON {{.prefix}}blocksuite_docs(created_by) 
        WHERE created_by IS NOT NULL;
{{end}}

{{if .mysql}}
    CREATE INDEX IF NOT EXISTS idx_{{.prefix}}blocksuite_docs_created_by 
        ON {{.prefix}}blocksuite_docs(created_by);
{{end}}

{{if .sqlite}}
    CREATE INDEX IF NOT EXISTS idx_{{.prefix}}blocksuite_docs_created_by 
        ON {{.prefix}}blocksuite_docs(created_by) 
        WHERE created_by IS NOT NULL;
{{end}}

-- ============================================================
-- 3. 코멘트 추가 (PostgreSQL)
-- ============================================================

{{if .postgres}}
    COMMENT ON TABLE {{.prefix}}blocksuite_docs IS 'BlockSuite editor document snapshots (Yjs format)';
    COMMENT ON COLUMN {{.prefix}}blocksuite_docs.snapshot IS 'Yjs document state encoded as binary';
    COMMENT ON COLUMN {{.prefix}}blocksuite_docs.card_id IS 'Reference to card (managed by app, no FK)';
    COMMENT ON COLUMN {{.prefix}}blocksuite_docs.board_id IS 'Reference to board (managed by app, no FK)';
{{end}}