// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {IntlShape} from 'react-intl'

import {IPropertyTemplate} from '../../blocks/board'
import {Card} from '../../blocks/card'
import {PropertyType, PropertyTypeEnum, FilterValueType} from '../types'

import CardPropertyEditor from './card'

export default class CardProperty extends PropertyType {
    Editor = CardPropertyEditor
    name = 'Card'
    type = 'card' as PropertyTypeEnum
    canGroup = false
    canFilter = true
    filterValueType = 'text' as FilterValueType

    displayName = (intl: IntlShape) => intl.formatMessage({id: 'PropertyType.Card', defaultMessage: 'Card'})

    displayValue = (propertyValue: string | string[] | undefined, _card: Card, _propertyTemplate: IPropertyTemplate) => {
        if (propertyValue && typeof propertyValue === 'string') {
            // propertyValue는 "boardId:cardId:cardTitle" 형식으로 저장됨
            const parts = propertyValue.split(':')
            if (parts.length >= 3) {
                return parts.slice(2).join(':') // cardTitle 반환 (콜론이 포함된 제목 처리)
            }
            return propertyValue
        }
        return ''
    }
}

