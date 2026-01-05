// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Card} from './blocks/card'
import {IPropertyTemplate, IPropertyOption, BoardGroup} from './blocks/board'

function groupCardsByOptions(cards: Card[], optionIds: string[], groupByProperty?: IPropertyTemplate): BoardGroup[] {
    const groups = []
    for (const optionId of optionIds) {
        if (optionId) {
            const option = groupByProperty?.options.find((o) => o.id === optionId)
            if (option) {
                const c = cards.filter((o) => optionId === o.fields?.properties[groupByProperty!.id])
                const group: BoardGroup = {
                    option,
                    cards: c,
                }
                groups.push(group)
            } else {
                // if optionId not found, its an old (deleted) option that can be ignored
            }
        } else {
            // Empty group
            const emptyGroupCards = cards.filter((card) => {
                const groupByOptionId = card.fields.properties[groupByProperty?.id || '']
                return !groupByOptionId || !groupByProperty?.options.find((option) => option.id === groupByOptionId)
            })
            const group: BoardGroup = {
                option: {id: '', value: `No ${groupByProperty?.name}`, color: ''},
                cards: emptyGroupCards,
            }
            groups.push(group)
        }
    }
    return groups
}

function getOptionGroups(cards: Card[], visibleOptionIds: string[], hiddenOptionIds: string[], groupByProperty?: IPropertyTemplate): {visible: BoardGroup[], hidden: BoardGroup[]} {
    let unassignedOptionIds: string[] = []
    if (groupByProperty) {
        unassignedOptionIds = groupByProperty.options.
            filter((o: IPropertyOption) => !visibleOptionIds.includes(o.id) && !hiddenOptionIds.includes(o.id)).
            map((o: IPropertyOption) => o.id)
    }
    const allVisibleOptionIds = [...visibleOptionIds, ...unassignedOptionIds]

    // If the empty group positon is not explicitly specified, make it the first visible column
    if (!allVisibleOptionIds.includes('') && !hiddenOptionIds.includes('')) {
        allVisibleOptionIds.unshift('')
    }

    const visibleGroups = groupCardsByOptions(cards, allVisibleOptionIds, groupByProperty)
    const hiddenGroups = groupCardsByOptions(cards, hiddenOptionIds, groupByProperty)
    return {visible: visibleGroups, hidden: hiddenGroups}
}
export function getVisibleAndHiddenGroups(cards: Card[], visibleOptionIds: string[], hiddenOptionIds: string[], groupByProperty?: IPropertyTemplate): {visible: BoardGroup[], hidden: BoardGroup[]} {
    if (groupByProperty?.type === 'createdBy' || groupByProperty?.type === 'updatedBy' || groupByProperty?.type === 'person') {
        return getPersonGroups(cards, groupByProperty, hiddenOptionIds)
    }

    if (groupByProperty?.type === 'card') {
        return getCardGroups(cards, groupByProperty, hiddenOptionIds)
    }

    return getOptionGroups(cards, visibleOptionIds, hiddenOptionIds, groupByProperty)
}

function getPersonGroups(cards: Card[], groupByProperty: IPropertyTemplate, hiddenOptionIds: string[]): {visible: BoardGroup[], hidden: BoardGroup[]} {
    const groups = cards.reduce((unique: {[key: string]: Card[]}, item: Card): {[key: string]: Card[]} => {
        let key = item.fields.properties[groupByProperty.id] as string
        if (groupByProperty?.type === 'createdBy') {
            key = item.createdBy
        } else if (groupByProperty?.type === 'updatedBy') {
            key = item.modifiedBy
        }

        const curGroup = unique[key] ?? []
        return {...unique, [key]: [...curGroup, item]}
    }, {})

    const hiddenGroups: BoardGroup[] = []
    const visibleGroups: BoardGroup[] = []
    Object.entries(groups).forEach(([key, value]) => {
        const propertyOption = {id: key, value: key, color: ''} as IPropertyOption
        if (hiddenOptionIds.find((e) => e === key)) {
            hiddenGroups.push({option: propertyOption, cards: value})
        } else {
            visibleGroups.push({option: propertyOption, cards: value})
        }
    })

    return {visible: visibleGroups, hidden: hiddenGroups}
}

// Card 프로퍼티 값에서 첫 번째 연결된 카드 ID와 타이틀을 추출
function parseCardPropertyValue(propertyValue: string | undefined): {cardId: string, cardTitle: string} | null {
    if (!propertyValue || typeof propertyValue !== 'string') {
        return null
    }

    // 새 형식: "boardId|cardId1:cardTitle1,cardId2:cardTitle2,..."
    if (propertyValue.includes('|')) {
        const [, cardsStr] = propertyValue.split('|')
        if (!cardsStr) {
            return null
        }
        const firstCard = cardsStr.split(',')[0]
        const colonIndex = firstCard.indexOf(':')
        if (colonIndex === -1) {
            return {cardId: firstCard, cardTitle: 'Untitled'}
        }
        return {
            cardId: firstCard.substring(0, colonIndex),
            cardTitle: firstCard.substring(colonIndex + 1) || 'Untitled',
        }
    }

    // 이전 형식: "boardId:cardId:cardTitle"
    const parts = propertyValue.split(':')
    if (parts.length >= 3) {
        return {
            cardId: parts[1],
            cardTitle: parts.slice(2).join(':') || 'Untitled',
        }
    }

    return null
}

function getCardGroups(cards: Card[], groupByProperty: IPropertyTemplate, hiddenOptionIds: string[]): {visible: BoardGroup[], hidden: BoardGroup[]} {
    const groups: {[key: string]: {cards: Card[], title: string}} = {}

    // 연결된 카드가 없는 경우를 위한 빈 그룹
    const noCardGroupKey = ''

    cards.forEach((card) => {
        const propertyValue = card.fields.properties[groupByProperty.id] as string
        const parsed = parseCardPropertyValue(propertyValue)

        if (parsed) {
            const {cardId, cardTitle} = parsed
            if (!groups[cardId]) {
                groups[cardId] = {cards: [], title: cardTitle}
            }
            groups[cardId].cards.push(card)
        } else {
            // 연결된 카드가 없는 경우
            if (!groups[noCardGroupKey]) {
                groups[noCardGroupKey] = {cards: [], title: `No ${groupByProperty.name}`}
            }
            groups[noCardGroupKey].cards.push(card)
        }
    })

    const hiddenGroups: BoardGroup[] = []
    const visibleGroups: BoardGroup[] = []

    Object.entries(groups).forEach(([key, {cards: groupCards, title}]) => {
        const propertyOption = {id: key, value: title, color: ''} as IPropertyOption
        if (hiddenOptionIds.find((e) => e === key)) {
            hiddenGroups.push({option: propertyOption, cards: groupCards})
        } else {
            visibleGroups.push({option: propertyOption, cards: groupCards})
        }
    })

    return {visible: visibleGroups, hidden: hiddenGroups}
}
