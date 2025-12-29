// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-plugin-boards/server/model"
)

// GetBlockSuiteDocByCardID retrieves a BlockSuite document by card_id.
func (a *App) GetBlockSuiteDocByCardID(cardID string) (*model.BlockSuiteDoc, error) {
	return a.store.GetBlockSuiteDocByCardID(cardID)
}

// GetBlockSuiteDocInfoByCardID retrieves metadata (without snapshot) by card_id.
func (a *App) GetBlockSuiteDocInfoByCardID(cardID string) (*model.BlockSuiteDocInfo, error) {
	return a.store.GetBlockSuiteDocInfoByCardID(cardID)
}

// UpsertBlockSuiteDoc inserts or updates a BlockSuite document.
func (a *App) UpsertBlockSuiteDoc(doc *model.BlockSuiteDoc) error {
	return a.store.UpsertBlockSuiteDoc(doc)
}

// DeleteBlockSuiteDocByCardID deletes a BlockSuite document by card_id.
func (a *App) DeleteBlockSuiteDocByCardID(cardID string) error {
	return a.store.DeleteBlockSuiteDocByCardID(cardID)
}

