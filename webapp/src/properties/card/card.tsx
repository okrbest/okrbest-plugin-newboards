// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback, useEffect} from 'react'
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

import {PropertyProps} from '../types'

import './card.scss'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const windowAny = window as any

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

    // propertyValue에서 boardId, cardId, cardTitle 추출 (형식: "boardId:cardId:cardTitle")
    const getBoardId = useCallback(() => {
        if (propertyValue && typeof propertyValue === 'string') {
            const parts = propertyValue.split(':')
            if (parts.length >= 1) {
                return parts[0]
            }
        }
        return ''
    }, [propertyValue])

    const getCardId = useCallback(() => {
        if (propertyValue && typeof propertyValue === 'string') {
            const parts = propertyValue.split(':')
            if (parts.length >= 2) {
                return parts[1]
            }
        }
        return ''
    }, [propertyValue])

    const getDisplayValue = useCallback(() => {
        if (propertyValue && typeof propertyValue === 'string') {
            const parts = propertyValue.split(':')
            if (parts.length >= 3) {
                return parts.slice(2).join(':') // cardTitle 반환
            }
        }
        return ''
    }, [propertyValue])

    const linkedBoardId = getBoardId()
    const linkedCardId = getCardId()
    const displayValue = getDisplayValue()
    const finalDisplayValue = displayValue || emptyDisplayValue
    const hasSelectedCard = Boolean(linkedCardId && displayValue)

    // 연결된 보드의 카드 목록 가져오기
    const fetchCards = useCallback(async () => {
        if (!linkedBoardId) {
            return
        }
        setLoading(true)
        setBoardAccessError(false)
        try {
            // 먼저 보드에 접근 가능하고 공개인지 확인
            const linkedBoard = await octoClient.getBoard(linkedBoardId)
            if (!linkedBoard) {
                // 보드가 삭제되었거나 접근 권한이 없음
                setBoardAccessError(true)
                setCards([])
                return
            }
            if (linkedBoard.type !== 'O') {
                // 보드가 더 이상 공개가 아님
                setBoardAccessError(true)
                setCards([])
                return
            }
            const blocks = await octoClient.getAllBlocks(linkedBoardId)
            const cardBlocks = blocks.filter((block: Block) => block.type === 'card') as Card[]
            setCards(cardBlocks)
        } catch (error) {
            console.error('Failed to fetch cards:', error)
            setBoardAccessError(true)
            setCards([])
        } finally {
            setLoading(false)
        }
    }, [linkedBoardId])

    // 보드 접근성 확인 (컴포넌트 마운트 시) - 보드가 여전히 공개인지 확인
    const checkBoardAccess = useCallback(async () => {
        if (!linkedBoardId) {
            return
        }
        try {
            const linkedBoard = await octoClient.getBoard(linkedBoardId)
            if (!linkedBoard) {
                // 보드가 삭제되었거나 접근 불가
                setBoardAccessError(true)
            } else if (linkedBoard.type !== 'O') {
                // 보드가 더 이상 공개가 아님 (비공개로 변경됨)
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

    const handleCardSelect = useCallback(async (selectedCard: Card) => {
        // 속성 값을 "boardId:cardId:cardTitle" 형식으로 저장
        const newValue = `${linkedBoardId}:${selectedCard.id}:${selectedCard.title || 'Untitled'}`
        await mutator.changePropertyValue(board.id, card, propertyTemplate.id, newValue)
        setOpen(false)
    }, [linkedBoardId, board, card, propertyTemplate])

    // 선택된 카드로 이동
    const handleCardClick = useCallback(() => {
        if (!linkedBoardId || !linkedCardId || !currentTeamId) {
            return
        }
        // viewId가 없으면 0을 사용하여 첫 번째 뷰로 이동
        const params = {
            teamId: currentTeamId,
            boardId: linkedBoardId,
            viewId: '0',
            cardId: linkedCardId,
        }
        const cardPath = generatePath('/team/:teamId/:boardId/:viewId/:cardId', params)
        const cardUrl = `${window.location.origin}${windowAny.frontendBaseURL || ''}${cardPath}`
        window.open(cardUrl, '_blank', 'noopener')
    }, [linkedBoardId, linkedCardId, currentTeamId])

    // 빈 상태에서 전체 영역 클릭 시 드롭다운 열기 (early return 전에 Hook 호출)
    const handleContainerClick = useCallback(() => {
        if (isEditable && !hasSelectedCard && !open) {
            setOpen(true)
        }
    }, [isEditable, hasSelectedCard, open])

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

    return (
        <div
            className={`CardProperty ${props.property.valueClassName(!isEditable)} ${!hasSelectedCard && isEditable ? 'CardProperty--clickable' : ''} ${boardAccessError ? 'CardProperty--error' : ''}`}
            onClick={handleContainerClick}
        >
            {boardAccessError ? (
                <span className='CardProperty-errorText'>
                    {intl.formatMessage({id: 'CardProperty.boardNotAccessible', defaultMessage: 'Board not accessible'})}
                </span>
            ) : hasSelectedCard ? (
                <>
                    <a
                        className='CardProperty-link'
                        onClick={(e) => {
                            e.stopPropagation()
                            handleCardClick()
                        }}
                        title={intl.formatMessage({id: 'CardProperty.openCard', defaultMessage: 'Open card'})}
                    >
                        {displayValue}
                    </a>
                    {isEditable && (
                        <IconButton
                            className='CardProperty-editButton'
                            title={intl.formatMessage({id: 'CardProperty.changeCard', defaultMessage: 'Change card'})}
                            icon={<EditIcon/>}
                            onClick={(e) => {
                                e.stopPropagation()
                                setOpen(true)
                            }}
                        />
                    )}
                </>
            ) : (
                <>
                    <span className='CardProperty-placeholder'>
                        {finalDisplayValue}
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
                <div className='CardProperty-dropdown'>
                    <div className='CardProperty-header'>
                        {intl.formatMessage({id: 'CardProperty.selectCard', defaultMessage: 'Select a card'})}
                    </div>
                    {loading ? (
                        <div className='CardProperty-loading'>
                            {intl.formatMessage({id: 'CardProperty.loading', defaultMessage: 'Loading...'})}
                        </div>
                    ) : boardAccessError ? (
                        <div className='CardProperty-error'>
                            {intl.formatMessage({id: 'CardProperty.boardAccessError', defaultMessage: 'Board is no longer accessible. Please select a different board.'})}
                        </div>
                    ) : cards.length === 0 ? (
                        <div className='CardProperty-empty'>
                            {intl.formatMessage({id: 'CardProperty.noCards', defaultMessage: 'No cards available'})}
                        </div>
                    ) : (
                        <div className='CardProperty-list'>
                            {cards.map((c) => (
                                <div
                                    key={c.id}
                                    className='CardProperty-item'
                                    onClick={() => handleCardSelect(c)}
                                >
                                    <span className='CardProperty-title'>
                                        {c.title || intl.formatMessage({id: 'CardProperty.untitled', defaultMessage: 'Untitled'})}
                                    </span>
                                </div>
                            ))}
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

