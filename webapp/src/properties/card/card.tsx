// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback, useEffect, useMemo} from 'react'
import {useIntl} from 'react-intl'
import {generatePath} from 'react-router-dom'

import {Card} from '../../blocks/card'
import {Block} from '../../blocks/block'
import mutator from '../../mutator'
import octoClient from '../../octoClient'
import {useAppSelector} from '../../store/hooks'
import {getCurrentTeamId} from '../../store/teams'
import IconButton from '../../widgets/buttons/iconButton'
import EditIcon from '../../widgets/icons/edit'
import CloseIcon from '../../widgets/icons/close'

import {PropertyProps} from '../types'

import './card.scss'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const windowAny = window as any

// 선택된 카드 정보 타입
interface SelectedCard {
    id: string
    title: string
}

// 저장 형식: "boardId|cardId1:cardTitle1,cardId2:cardTitle2,..."
const parsePropertyValue = (value: string | string[] | undefined): {boardId: string, selectedCards: SelectedCard[]} => {
    if (!value || typeof value !== 'string' || !value.includes('|')) {
        // 이전 형식 호환: "boardId:cardId:cardTitle"
        if (value && typeof value === 'string') {
            const parts = value.split(':')
            if (parts.length >= 1) {
                const boardId = parts[0]
                if (parts.length >= 3) {
                    return {
                        boardId,
                        selectedCards: [{id: parts[1], title: parts.slice(2).join(':')}],
                    }
                }
                return {boardId, selectedCards: []}
            }
        }
        return {boardId: '', selectedCards: []}
    }

    const [boardId, cardsStr] = value.split('|')
    if (!cardsStr) {
        return {boardId, selectedCards: []}
    }

    const selectedCards: SelectedCard[] = cardsStr.split(',').map((cardStr) => {
        const colonIndex = cardStr.indexOf(':')
        if (colonIndex === -1) {
            return {id: cardStr, title: 'Untitled'}
        }
        return {
            id: cardStr.substring(0, colonIndex),
            title: cardStr.substring(colonIndex + 1) || 'Untitled',
        }
    }).filter((c) => c.id)

    return {boardId, selectedCards}
}

const serializePropertyValue = (boardId: string, selectedCards: SelectedCard[]): string => {
    if (!boardId) {
        return ''
    }
    if (selectedCards.length === 0) {
        return `${boardId}|`
    }
    const cardsStr = selectedCards.map((c) => `${c.id}:${c.title}`).join(',')
    return `${boardId}|${cardsStr}`
}

const CardPropertyEditor = (props: PropertyProps) => {
    const {propertyValue, propertyTemplate, board, card} = props
    const intl = useIntl()
    const currentTeamId = useAppSelector(getCurrentTeamId)

    const [open, setOpen] = useState(false)
    const [cards, setCards] = useState<Card[]>([])
    const [loading, setLoading] = useState(false)
    const [boardAccessError, setBoardAccessError] = useState(false)
    const isEditable = !props.readOnly && Boolean(board)

    const emptyDisplayValue = props.showEmptyPlaceholder
        ? intl.formatMessage({id: 'PropertyValueElement.empty', defaultMessage: 'Empty'})
        : ''

    // propertyValue 파싱
    const {boardId: linkedBoardId, selectedCards} = useMemo(
        () => parsePropertyValue(propertyValue),
        [propertyValue],
    )

    const hasSelectedCards = selectedCards.length > 0

    // 연결된 보드의 카드 목록 가져오기
    const fetchCards = useCallback(async () => {
        if (!linkedBoardId) {
            return
        }
        setLoading(true)
        setBoardAccessError(false)
        try {
            const linkedBoard = await octoClient.getBoard(linkedBoardId)
            if (!linkedBoard) {
                setBoardAccessError(true)
                setCards([])
                return
            }
            const blocks = await octoClient.getAllBlocks(linkedBoardId)
            const cardBlocks = blocks.filter((block: Block) => block.type === 'card') as Card[]
            // 이름순 정렬 (빈 제목은 뒤로)
            cardBlocks.sort((a, b) => {
                const titleA = a.title || ''
                const titleB = b.title || ''
                
                // 빈 제목은 항상 뒤로
                if (!titleA && !titleB) return 0
                if (!titleA) return 1
                if (!titleB) return -1
                
                return titleA.localeCompare(titleB)
            })
            setCards(cardBlocks)
        } catch (error) {
            console.error('Failed to fetch cards:', error)
            setBoardAccessError(true)
            setCards([])
        } finally {
            setLoading(false)
        }
    }, [linkedBoardId])

    // 보드 접근성 확인 (컴포넌트 마운트 시)
    const checkBoardAccess = useCallback(async () => {
        if (!linkedBoardId) {
            return
        }
        try {
            const linkedBoard = await octoClient.getBoard(linkedBoardId)
            if (!linkedBoard) {
                setBoardAccessError(true)
            }
        } catch (error) {
            console.error('Failed to check board access:', error)
            setBoardAccessError(true)
        }
    }, [linkedBoardId])

    // 컴포넌트 마운트 시 보드 접근성 확인
    useEffect(() => {
        if (linkedBoardId) {
            checkBoardAccess()
        }
    }, [linkedBoardId, checkBoardAccess])

    // 드롭다운 열 때 카드 목록 가져오기
    useEffect(() => {
        if (open && linkedBoardId) {
            fetchCards()
        }
    }, [open, linkedBoardId, fetchCards])

    // 카드 추가
    const handleCardAdd = useCallback(async (selectedCard: Card) => {
        // 이미 선택된 카드인지 확인
        if (selectedCards.some((c) => c.id === selectedCard.id)) {
            return
        }
        const newSelectedCards = [...selectedCards, {id: selectedCard.id, title: selectedCard.title || 'Untitled'}]
        const newValue = serializePropertyValue(linkedBoardId, newSelectedCards)
        await mutator.changePropertyValue(board.id, card, propertyTemplate.id, newValue)
    }, [linkedBoardId, selectedCards, board, card, propertyTemplate])

    // 카드 삭제
    const handleCardRemove = useCallback(async (cardIdToRemove: string) => {
        const newSelectedCards = selectedCards.filter((c) => c.id !== cardIdToRemove)
        const newValue = serializePropertyValue(linkedBoardId, newSelectedCards)
        await mutator.changePropertyValue(board.id, card, propertyTemplate.id, newValue)
    }, [linkedBoardId, selectedCards, board, card, propertyTemplate])

    // 선택된 카드로 이동
    const handleCardClick = useCallback((cardId: string) => {
        if (!linkedBoardId || !cardId || !currentTeamId) {
            return
        }
        const params = {
            teamId: currentTeamId,
            boardId: linkedBoardId,
            viewId: '0',
            cardId,
        }
        const cardPath = generatePath('/team/:teamId/:boardId/:viewId/:cardId', params)
        const cardUrl = `${window.location.origin}${windowAny.frontendBaseURL || ''}${cardPath}`
        window.open(cardUrl, '_blank', 'noopener')
    }, [linkedBoardId, currentTeamId])

    // 빈 상태에서 전체 영역 클릭 시 드롭다운 열기
    const handleContainerClick = useCallback(() => {
        if (isEditable && !hasSelectedCards && !open) {
            setOpen(true)
        }
    }, [isEditable, hasSelectedCards, open])

    // 보드가 선택되지 않은 경우 안내 메시지 표시
    if (!linkedBoardId) {
        return (
            <div className={`CardProperty ${props.property.valueClassName(!isEditable)}`}>
                <span className='CardProperty-placeholder'>
                    {intl.formatMessage({id: 'CardProperty.selectBoardFirst', defaultMessage: 'Select a board first'})}
                </span>
            </div>
        )
    }

    // 이미 선택된 카드 ID 목록
    const selectedCardIds = new Set(selectedCards.map((c) => c.id))

    return (
        <div
            className={`CardProperty ${props.property.valueClassName(!isEditable)} ${!hasSelectedCards && isEditable ? 'CardProperty--clickable' : ''} ${boardAccessError ? 'CardProperty--error' : ''}`}
            onClick={handleContainerClick}
        >
            {boardAccessError ? (
                <span className='CardProperty-errorText'>
                    {intl.formatMessage({id: 'CardProperty.boardNotAccessible', defaultMessage: 'Board not accessible'})}
                </span>
            ) : hasSelectedCards ? (
                <div className='CardProperty-tags'>
                    {selectedCards.map((c) => (
                        <div
                            key={c.id}
                            className='CardProperty-tag'
                        >
                            <span
                                className='CardProperty-tagText'
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleCardClick(c.id)
                                }}
                                title={intl.formatMessage({id: 'CardProperty.openCard', defaultMessage: 'Open card'})}
                            >
                                {c.title}
                            </span>
                            {isEditable && (
                                <IconButton
                                    className='CardProperty-tagRemove'
                                    icon={<CloseIcon/>}
                                    title={intl.formatMessage({id: 'CardProperty.removeCard', defaultMessage: 'Remove'})}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleCardRemove(c.id)
                                    }}
                                />
                            )}
                        </div>
                    ))}
                    {isEditable && (
                        <IconButton
                            className='CardProperty-addButton'
                            title={intl.formatMessage({id: 'CardProperty.addCard', defaultMessage: 'Add card'})}
                            icon={<EditIcon/>}
                            onClick={(e) => {
                                e.stopPropagation()
                                setOpen(true)
                            }}
                        />
                    )}
                </div>
            ) : (
                <>
                    <span className='CardProperty-placeholder'>
                        {emptyDisplayValue}
                    </span>
                    {isEditable && (
                        <IconButton
                            className='CardProperty-editButton'
                            title={intl.formatMessage({id: 'CardProperty.selectCard', defaultMessage: 'Select a card'})}
                            icon={<EditIcon/>}
                            onClick={(e) => {
                                e.stopPropagation()
                                setOpen(true)
                            }}
                        />
                    )}
                </>
            )}
            
            {open && (
                <div
                    className='CardProperty-dropdown'
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className='CardProperty-header'>
                        {intl.formatMessage({id: 'CardProperty.selectCard', defaultMessage: 'Select a card'})}
                    </div>
                    {loading ? (
                        <div className='CardProperty-loading'>
                            {intl.formatMessage({id: 'CardProperty.loading', defaultMessage: 'Loading...'})}
                        </div>
                    ) : boardAccessError ? (
                        <div className='CardProperty-error'>
                            {intl.formatMessage({id: 'CardProperty.boardAccessError', defaultMessage: 'Board has been deleted or is no longer accessible. Please select a different board.'})}
                        </div>
                    ) : cards.length === 0 ? (
                        <div className='CardProperty-empty'>
                            {intl.formatMessage({id: 'CardProperty.noCards', defaultMessage: 'No cards available'})}
                        </div>
                    ) : (
                        <div className='CardProperty-list'>
                            {cards.map((c) => {
                                const isSelected = selectedCardIds.has(c.id)
                                return (
                                    <div
                                        key={c.id}
                                        className={`CardProperty-item ${isSelected ? 'CardProperty-item--selected' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            if (!isSelected) {
                                                handleCardAdd(c)
                                            }
                                        }}
                                    >
                                        <span className='CardProperty-title'>
                                            {c.title || intl.formatMessage({id: 'CardProperty.untitled', defaultMessage: 'Untitled'})}
                                        </span>
                                        {isSelected && (
                                            <span className='CardProperty-check'>✓</span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                    <div
                        className='CardProperty-backdrop'
                        onClick={() => setOpen(false)}
                    />
                </div>
            )}
        </div>
    )
}

export default React.memo(CardPropertyEditor)
