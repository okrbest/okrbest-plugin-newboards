// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback} from 'react'
import {useIntl, IntlShape} from 'react-intl'

import Menu from '../widgets/menu'
import propsRegistry from '../properties'
import {PropertyType} from '../properties/types'
import {Board} from '../blocks/board'
import octoClient from '../octoClient'
import {useAppSelector} from '../store/hooks'
import {getCurrentTeamId} from '../store/teams'
import './propertyMenu.scss'

type Props = {
    propertyId: string
    propertyName: string
    propertyType: PropertyType
    onTypeAndNameChanged: (newType: PropertyType, newName: string) => void
    onDelete: (id: string) => void
    onMoveUp: () => void
    onMoveDown: () => void
    canMoveUp: boolean
    canMoveDown: boolean
    onBoardSelected?: (selectedBoard: Board) => void
}

function typeMenuTitle(intl: IntlShape, type: PropertyType): string {
    return `${intl.formatMessage({id: 'PropertyMenu.typeTitle', defaultMessage: 'Type'})}: ${type.displayName(intl)}`
}

type TypesProps = {
    label: string
    onTypeSelected: (type: PropertyType) => void
}

export const PropertyTypes = (props: TypesProps): JSX.Element => {
    const intl = useIntl()
    return (
        <>
            <Menu.Label>
                <b>{props.label}</b>
            </Menu.Label>

            <Menu.Separator/>

            {
                propsRegistry.list().map((p) => (
                    <Menu.Text
                        key={p.type}
                        id={p.type}
                        name={p.displayName(intl)}
                        onClick={() => props.onTypeSelected(p)}
                    />
                ))
            }
        </>
    )
}

const PropertyMenu = (props: Props) => {
    const intl = useIntl()
    const teamId = useAppSelector(getCurrentTeamId)
    const [boards, setBoards] = useState<Board[]>([])
    const [loadingBoards, setLoadingBoards] = useState(false)
    let currentPropertyName = props.propertyName

    const isCardType = props.propertyType.type === 'card'

    const fetchBoards = useCallback(async () => {
        if (!teamId || !isCardType) {
            return
        }
        setLoadingBoards(true)
        try {
            // getBoards를 사용하여 사용자가 접근 가능한 모든 보드 가져오기
            const items = await octoClient.getBoards()
            // 템플릿만 제외
            const accessibleBoards = items.filter((b) => !b.isTemplate)
            setBoards(accessibleBoards)
        } catch (error) {
            console.error('Failed to fetch boards:', error)
        } finally {
            setLoadingBoards(false)
        }
    }, [teamId, isCardType])

    useEffect(() => {
        if (isCardType) {
            fetchBoards()
        }
    }, [isCardType, fetchBoards])

    const deleteText = intl.formatMessage({
        id: 'PropertyMenu.Delete',
        defaultMessage: 'Delete',
    })
    const moveUpText = intl.formatMessage({
        id: 'PropertyMenu.MoveUp',
        defaultMessage: 'Move property up',
    })
    const moveDownText = intl.formatMessage({
        id: 'PropertyMenu.MoveDown',
        defaultMessage: 'Move property down',
    })
    const selectBoardText = intl.formatMessage({
        id: 'PropertyMenu.SelectBoard',
        defaultMessage: 'Select board',
    })

    return (
        <Menu>
            <Menu.TextInput
                initialValue={props.propertyName}
                onConfirmValue={(n) => {
                    props.onTypeAndNameChanged(props.propertyType, n)
                    currentPropertyName = n
                }}
                onValueChanged={(n) => {
                    currentPropertyName = n
                }}
            />
            <Menu.SubMenu
                id='type'
                name={typeMenuTitle(intl, props.propertyType)}
            >
                <PropertyTypes
                    label={intl.formatMessage({id: 'PropertyMenu.changeType', defaultMessage: 'Change property type'})}
                    onTypeSelected={(type: PropertyType) => props.onTypeAndNameChanged(type, currentPropertyName)}
                />
            </Menu.SubMenu>
            {isCardType && props.onBoardSelected && (
                <Menu.SubMenu
                    id='select-board'
                    name={selectBoardText}
                >
                    {loadingBoards ? (
                        <Menu.Label>
                            <span style={{color: 'rgba(var(--center-channel-color-rgb), 0.56)'}}>
                                {intl.formatMessage({id: 'PropertyMenu.Loading', defaultMessage: 'Loading...'})}
                            </span>
                        </Menu.Label>
                    ) : boards.length === 0 ? (
                        <Menu.Label>
                            <span style={{color: 'rgba(var(--center-channel-color-rgb), 0.56)'}}>
                                {intl.formatMessage({id: 'PropertyMenu.NoBoards', defaultMessage: 'No boards available'})}
                            </span>
                        </Menu.Label>
                    ) : (
                        boards.map((b) => (
                            <Menu.Text
                                key={`select-board-${b.id}`}
                                id={`select-board-${b.id}`}
                                name={b.icon ? `${b.icon} ${b.title}` : b.title}
                                onClick={() => props.onBoardSelected?.(b)}
                            />
                        ))
                    )}
                </Menu.SubMenu>
            )}
            <Menu.Text
                id='move-up'
                name={moveUpText}
                disabled={!props.canMoveUp}
                onClick={() => {
                    if (props.canMoveUp) {
                        props.onMoveUp()
                    }
                }}
            />
            <Menu.Text
                id='move-down'
                name={moveDownText}
                disabled={!props.canMoveDown}
                onClick={() => {
                    if (props.canMoveDown) {
                        props.onMoveDown()
                    }
                }}
            />
            <Menu.Separator/>
            <Menu.Text
                id='delete'
                name={deleteText}
                onClick={() => props.onDelete(props.propertyId)}
            />
        </Menu>
    )
}

export default React.memo(PropertyMenu)
