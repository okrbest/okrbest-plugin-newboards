// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useEffect, useState} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'

import {Board} from '../blocks/board'
import {Card} from '../blocks/card'
import {Block} from '../blocks/block'
import {Utils} from '../utils'
import CompassIcon from '../widgets/icons/compassIcon'
import TelemetryClient, {TelemetryActions, TelemetryCategory} from '../telemetry/telemetryClient'
import {useAppSelector, useAppDispatch} from '../store/hooks'
import {getCards} from '../store/cards'
import {loadBoardData} from '../store/initialLoad'
import {getCurrentViewId, getViews} from '../store/views'
import {getCurrentTeamId} from '../store/teams'
import {generatePath} from 'react-router-dom'
import Tooltip from '../widgets/tooltip'


interface Props {
    board: Board
    onBackClick: () => void
}

const RHSBoardCards = (props: Props) => {
    const {board, onBackClick} = props
    const intl = useIntl()
    const dispatch = useAppDispatch()
    const [showCopyNotification, setShowCopyNotification] = useState(false)
    const [fadeOut, setFadeOut] = useState(false)

    const untitledBoardTitle = intl.formatMessage({id: 'BoardComponent.untitled-board', defaultMessage: 'Untitled Board'})

    // 실제 보드의 카드 데이터 가져오기
    const allCardsObj = useAppSelector(getCards)
    const boardCards = useMemo(() => {
        // getCards는 객체를 반환하므로 Object.values로 배열로 변환
        const allCards = Object.values(allCardsObj)
        // 선택된 보드의 카드만 필터링
        const filteredCards = allCards.filter(card => card.boardId === board.id)
        console.log('RHSBoardCards Debug:', {
            boardId: board.id,
            allCardsCount: allCards.length,
            filteredCardsCount: filteredCards.length,
            allCards: allCards.map(c => ({ id: c.id, boardId: c.boardId, title: c.title }))
        })
        return filteredCards
    }, [allCardsObj, board.id])

    // 현재 활성화된 view ID와 team ID 가져오기
    const currentViewId = useAppSelector(getCurrentViewId)
    const currentTeamId = useAppSelector(getCurrentTeamId)
    const allViews = useAppSelector(getViews)

    // 해당 보드의 views만 필터링
    const currentBoardViews = useMemo(() => {
        return Object.values(allViews).filter(view => view.boardId === board.id)
    }, [allViews, board.id])

    // 선택된 보드의 데이터 로드
    useEffect(() => {
        if (board.id) {
            dispatch(loadBoardData(board.id))
        }
    }, [board.id, dispatch])

    // 카드가 로드되지 않았을 때를 위한 로딩 상태
    const isLoading = Object.keys(allCardsObj).length === 0

    // viewId 결정: currentViewId가 없으면 해당 보드의 첫 번째 view 사용
    const viewId = currentViewId || (currentBoardViews.length > 0 ? currentBoardViews[0].id : '')

    // 디버깅을 위한 로그
    console.log('RHSBoardCards URL Debug:', {
        currentViewId,
        viewId,
        currentTeamId,
        boardId: board.id,
        allViewsCount: Object.keys(allViews).length,
        currentBoardViewsCount: currentBoardViews.length,
        currentBoardViews: currentBoardViews.map(v => ({ id: v.id, title: v.title })),
        frontendBaseURL: (window as any).frontendBaseURL,
        isLoading,
        allCardsObjKeys: Object.keys(allCardsObj).length
    })

    const handleCardClicked = (card: Card) => {
        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.ViewCard, {board: board.id, card: card.id})
        
        // workspace.tsx의 showCard 함수 방식을 참조하여 같은 탭에서 카드 열기
        const windowAny = window as any
        
        // viewId 결정: currentViewId가 없으면 해당 보드의 첫 번째 view 사용
        const finalViewId = viewId || (currentBoardViews.length > 0 ? currentBoardViews[0].id : '')
        
        const params = {
            teamId: currentTeamId,
            boardId: board.id,
            viewId: finalViewId,
            cardId: card.id
        }
        
        // Utils.getBoardPagePath를 사용해서 올바른 경로 생성
        const cardPath = generatePath('/team/:teamId/:boardId?/:viewId?/:cardId?', params)
        const cardUrl = `${windowAny.frontendBaseURL}${cardPath}`
        console.log('Card URL:', cardUrl)
        
        // 새 탭에서 카드 열기
        window.open(cardUrl, '_blank', 'noopener')
    }

    const handleBoardTitleClick = () => {
        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.ViewBoard, {board: board.id})
        
        // 보드 페이지를 새 탭에서 열기
        const windowAny = window as any
        // 기존 보드 이동 방식 참조: /team/{teamId}/{boardId}
        const boardUrl = `${windowAny.frontendBaseURL}/team/${currentTeamId}/${board.id}`
        window.open(boardUrl, '_blank', 'noopener')
    }

    const handleCopyCardLink = (card: Card, e: React.MouseEvent) => {
        e.stopPropagation() // 카드 클릭 이벤트 방지
        
        // viewId 결정: currentViewId가 없으면 해당 보드의 첫 번째 view 사용
        const finalViewId = viewId || (currentBoardViews.length > 0 ? currentBoardViews[0].id : '')
        
        const params = {
            teamId: currentTeamId,
            boardId: board.id,
            viewId: finalViewId,
            cardId: card.id
        }
        
        // Utils.getBoardPagePath를 사용해서 올바른 경로 생성
        const cardPath = generatePath('/team/:teamId/:boardId?/:viewId?/:cardId?', params)
        const windowAny = window as any
        const cardUrl = `${window.location.origin}${windowAny.frontendBaseURL}${cardPath}`
        
        
        // 클립보드에 복사
        navigator.clipboard.writeText(cardUrl).then(() => {
            // 성공 메시지 표시
            setFadeOut(false)
            setShowCopyNotification(true)
            // 2.8초 후 페이드아웃 시작
            setTimeout(() => {
                setFadeOut(true)
                // 0.2초 후 완전히 숨기기
                setTimeout(() => setShowCopyNotification(false), 200)
            }, 2800)
        }).catch((err) => {
            console.error('링크 복사 실패:', err)
        })
    }



    // 인라인 스타일 정의
    const styles = {
        container: {
            padding: '16px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column' as const,
            backgroundColor: '#ffffff',
            border: '1px solid #e1e5e9',
            borderRadius: '4px',
            boxSizing: 'border-box' as const,
            overflow: 'hidden',
            position: 'relative' as const,
        },
        header: {
            display: 'flex',
            alignItems: 'center',
            minHeight: '40px',
            borderBottom: '1px solid #e1e5e9',
            paddingBottom: '12px',
            marginBottom: '16px',
            flexShrink: 0,
            position: 'sticky' as const,
            top: 0,
            backgroundColor: '#ffffff',
            zIndex: 1,
        },
        backButton: {
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            marginRight: '8px',
            borderRadius: '4px',
            color: '#3f4350',
        },
        boardTitle: {
            display: 'flex',
            alignItems: 'center',
            flexGrow: 1,
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '4px',
        },
        boardIcon: {
            marginRight: '8px',
            fontSize: '16px',
        },
        boardTitleText: {
            fontSize: '16px',
            fontWeight: 600,
            color: '#3f4350',
        },
        cardsContainer: {
            position: 'absolute' as const,
            top: '88px', // 헤더 높이 + 패딩
            left: '16px',
            right: '16px',
            bottom: '16px',
            overflow: 'hidden',
        },
        cardsList: {
            height: '100%',
            overflowY: 'auto' as const,
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '12px',
            paddingBottom: '24px', // 충분한 하단 여백
        },
        cardItem: {
            padding: '12px',
            border: '1px solid #e1e5e9',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: '#ffffff',
            transition: 'background-color 0.2s ease',
            flexShrink: 0,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        },
        cardTitleRow: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
        },
        cardIcon: {
            marginRight: '8px',
            fontSize: '14px',
            color: '#3f4350',
        },
        cardTitle: {
            flexGrow: 1,
            fontSize: '14px',
            fontWeight: 500,
            color: '#3f4350',
            marginRight: '8px',
        },
        copyLinkButton: {
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '2px',
            color: '#6c757d',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '20px',
            height: '20px',
        },
        cardMenuButton: {
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '2px',
            color: '#3f4350',
        },
        cardAssignee: {
            fontSize: '12px',
            color: '#6c757d',
            marginBottom: '4px',
        },
        cardUpdated: {
            fontSize: '12px',
            color: '#6c757d',
        },
        emptyState: {
            display: 'flex',
            flexDirection: 'column' as const,
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#6c757d',
            fontSize: '14px',
        },
    }

    return (
        <div className='RHSBoardCards' style={styles.container}>
            {/* 복사 성공 메시지 */}
            {showCopyNotification && (
                <div style={{
                    position: 'fixed',
                    bottom: '48px',
                    left: '50%',
                    marginLeft: '-160px',
                    padding: '10px 20px',
                    width: '320px',
                    minHeight: '48px',
                    color: 'rgba(var(--center-channel-bg-rgb), 1)',
                    backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.8)',
                    fontSize: '16px',
                    fontWeight: '600',
                    verticalAlign: 'middle',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 999,
                    visibility: fadeOut ? 'hidden' : 'visible',
                    opacity: fadeOut ? 0 : 1,
                    transition: fadeOut ? 'visibility 0s linear 200ms, opacity ease-in 200ms' : 'none',
                }}>
                    {intl.formatMessage({id: 'CardActionsMenu.copiedLink', defaultMessage: 'Copied!'})}
                </div>
            )}


            
            <div className='rhs-board-cards-header' style={styles.header}>
                <button 
                    className='back-button' 
                    onClick={onBackClick} 
                    data-testid='back-button'
                    style={styles.backButton}
                >
                    <CompassIcon icon='chevron-left'/>
                </button>
                <div 
                    className='board-title' 
                    onClick={handleBoardTitleClick}
                    style={styles.boardTitle}
                >
                    {board.icon && <span className='icon' style={styles.boardIcon}>{board.icon}</span>}
                    <span className='title' style={styles.boardTitleText}>{board.title || untitledBoardTitle}</span>
                </div>
            </div>

            <div className='cards-container' style={styles.cardsContainer}>
                {isLoading ? (
                    <div className='empty-state' style={styles.emptyState}>
                        <FormattedMessage 
                            id='RHSBoardCards.loading' 
                            defaultMessage='카드를 불러오는 중...'
                        />
                    </div>
                ) : boardCards.length > 0 ? (
                    <div className='cards-list' style={styles.cardsList}>
                        {boardCards.map((card) => (
                            <Tooltip
                                key={card.id}
                                title={intl.formatMessage({id: 'RHSBoardCards.goToCard', defaultMessage: 'Go to card'})}
                            >
                                <div
                                    className='card-item'
                                    onClick={() => handleCardClicked(card)}
                                    style={styles.cardItem}
                                >
                                <div className='card-title-row' style={styles.cardTitleRow}>
                                    <div className='card-icon' style={styles.cardIcon}>
                                        {card.fields.icon || '📋'}
                                    </div>
                                    <div 
                                        className='card-title' 
                                        style={styles.cardTitle}
                                        title='카드로 이동'
                                    >
                                        {card.title || <FormattedMessage id='KanbanCard.untitled' defaultMessage='Untitled'/>}
                                    </div>
                                    <button 
                                        className='copy-link-button' 
                                        style={styles.copyLinkButton}
                                        onClick={(e) => handleCopyCardLink(card, e)}
                                        title='카드 링크 복사'
                                    >
                                        <CompassIcon icon='link-variant'/>
                                    </button>
                                </div>
                                <div className='card-assignee' style={styles.cardAssignee}>
                                    담당자: {card.fields.properties?.assignee || '미지정'}
                                </div>
                                <div className='card-updated' style={styles.cardUpdated}>
                                    마지막 업데이트 시간: {Utils.displayDateTime(new Date(card.updateAt), intl)}
                                </div>
                            </div>
                            </Tooltip>
                        ))}
                    </div>
                ) : (
                    <div className='empty-state' style={styles.emptyState}>
                        <FormattedMessage 
                            id='RHSBoardCards.no-cards' 
                            defaultMessage='이 보드에는 카드가 없습니다.'
                        />
                    </div>
                )}
            </div>
        </div>
    )
}

export default RHSBoardCards 