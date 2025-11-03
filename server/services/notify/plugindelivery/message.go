// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugindelivery

import (
	"fmt"

	"github.com/mattermost/mattermost-plugin-boards/server/model"
)

const (
	// TODO: localize these when i18n is available.
	defCommentTemplate     = "@%s님이 @%s님을 카드 [%s](%s) 댓글에서 언급했습니다 (보드: [%s](%s))\n> %s"
	defDescriptionTemplate = "@%s님이 @%s님을 카드 [%s](%s)에서 언급했습니다 (보드: [%s](%s))\n> %s"
)

func formatMessage(author string, mentionedUser string, extract string, card string, link string, block *model.Block, boardLink string, board string) string {
	template := defDescriptionTemplate
	if block.Type == model.TypeComment {
		template = defCommentTemplate
	}
	return fmt.Sprintf(template, author, mentionedUser, card, link, board, boardLink, extract)
}
