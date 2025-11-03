// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugindelivery

import (
	"fmt"

	"github.com/mattermost/mattermost-plugin-boards/server/services/notify"
	"github.com/mattermost/mattermost-plugin-boards/server/utils"

	mm_model "github.com/mattermost/mattermost/server/public/model"
)

// MentionDeliver notifies a user they have been mentioned in a blockv ia the plugin API.
func (pd *PluginDelivery) MentionDeliver(mentionedUser *mm_model.User, extract string, evt notify.BlockChangeEvent) (string, error) {
	author, err := pd.api.GetUserByID(evt.ModifiedBy.UserID)
	if err != nil {
		return "", fmt.Errorf("cannot find user: %w", err)
	}

	// 보드에 연결된 채널이 있으면 그 채널로 메시지 전송, 없으면 DM으로 전송
	var channelID string
	if evt.Board.ChannelID != "" {
		// 보드와 연결된 채널로 메시지 전송
		channelID = evt.Board.ChannelID
	} else {
		// DM 채널로 메시지 전송 (기존 방식)
		channel, err := pd.getDirectChannel(evt.TeamID, mentionedUser.Id, pd.botID)
		if err != nil {
			return "", fmt.Errorf("cannot get direct channel: %w", err)
		}
		channelID = channel.Id
	}

	link := utils.MakeCardLink(pd.serverRoot, evt.Board.TeamID, evt.Board.ID, evt.Card.ID)
	boardLink := utils.MakeBoardLink(pd.serverRoot, evt.Board.TeamID, evt.Board.ID)

	post := &mm_model.Post{
		UserId:    pd.botID,
		ChannelId: channelID,
		Message:   formatMessage(author.Username, mentionedUser.Username, extract, evt.Card.Title, link, evt.BlockChanged, boardLink, evt.Board.Title),
	}

	if _, err := pd.api.CreatePost(post); err != nil {
		return "", err
	}

	return mentionedUser.Id, nil
}
