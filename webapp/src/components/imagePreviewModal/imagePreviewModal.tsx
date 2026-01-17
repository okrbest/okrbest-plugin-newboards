// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useLayoutEffect, useEffect, useState, useCallback} from 'react'

import IconButton from '../../widgets/buttons/iconButton'
import CloseIcon from '../../widgets/icons/close'
import ZoomInIcon from '../../widgets/icons/zoomIn'
import ZoomOutIcon from '../../widgets/icons/zoomOut'

import './imagePreviewModal.scss'

const ZoomSettings = {
    DEFAULT_SCALE: 1,
    MIN_SCALE: 0.5,
    MAX_SCALE: 3,
    SCALE_DELTA: 0.25,
}

interface Props {
    imageUrl: string
    title?: string
    onClose: () => void
}

const ImagePreviewModal = ({imageUrl, title, onClose}: Props) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const imageRef = useRef<HTMLImageElement>(null)
    const [baseSize, setBaseSize] = useState({width: 0, height: 0})
    const [scale, setScale] = useState(ZoomSettings.DEFAULT_SCALE)

    useEffect(() => {
        console.log('ImagePreviewModal mounted', {imageUrl, title})
    }, [])

    // 이미지 로드 후 기본 크기 저장 및 자동 스케일 계산
    const handleImageLoad = useCallback(() => {
        if (!imageRef.current) {
            return
        }

        const width = imageRef.current.naturalWidth || imageRef.current.offsetWidth
        const height = imageRef.current.naturalHeight || imageRef.current.offsetHeight
        setBaseSize({width, height})

        const container = containerRef.current
        if (!container || !width || !height) {
            return
        }

        // 컨테이너에 맞게 자동 스케일 조정
        const widthRatio = (container.clientWidth * 0.9) / width
        const heightRatio = (container.clientHeight * 0.9) / height
        const fitRatio = Math.min(widthRatio, heightRatio, 1)
        setScale(fitRatio)
    }, [])

    useEffect(() => {
        setBaseSize({width: 0, height: 0})
        setScale(ZoomSettings.DEFAULT_SCALE)
    }, [imageUrl])

    const scaledWidth = baseSize.width * scale
    const scaledHeight = baseSize.height * scale
    const containerWidth = containerRef.current?.clientWidth ?? 0
    const containerHeight = containerRef.current?.clientHeight ?? 0
    const hasHorizontalOverflow = baseSize.width > 0 && scaledWidth > containerWidth
    const hasVerticalOverflow = baseSize.height > 0 && scaledHeight > containerHeight
    const shouldEnableScroll = Boolean(containerWidth && containerHeight && (hasHorizontalOverflow || hasVerticalOverflow))

    const containerStyle: React.CSSProperties = {
        justifyContent: hasHorizontalOverflow ? 'flex-start' : 'center',
        alignItems: hasVerticalOverflow ? 'flex-start' : 'center',
    }

    // 확대 시 스크롤을 중앙으로 이동
    useLayoutEffect(() => {
        if (!containerRef.current) {
            return
        }

        const container = containerRef.current
        const centerScroll = () => {
            if (!shouldEnableScroll) {
                container.scrollLeft = 0
                container.scrollTop = 0
                return
            }

            const scrollLeft = hasHorizontalOverflow ? (container.scrollWidth - container.clientWidth) / 2 : 0
            const scrollTop = hasVerticalOverflow ? (container.scrollHeight - container.clientHeight) / 2 : 0
            container.scrollLeft = Math.max(0, scrollLeft)
            container.scrollTop = Math.max(0, scrollTop)
        }

        const rafId = requestAnimationFrame(centerScroll)
        return () => cancelAnimationFrame(rafId)
    }, [scale, baseSize, shouldEnableScroll, hasHorizontalOverflow, hasVerticalOverflow])

    const handleZoomIn = useCallback(() => {
        setScale((prevScale) => Math.min(prevScale + ZoomSettings.SCALE_DELTA, ZoomSettings.MAX_SCALE))
    }, [])

    const handleZoomOut = useCallback(() => {
        setScale((prevScale) => Math.max(prevScale - ZoomSettings.SCALE_DELTA, ZoomSettings.MIN_SCALE))
    }, [])

    const handleBackgroundClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose()
        }
    }, [onClose])

    const imageStyle: React.CSSProperties = {}
    if (baseSize.width > 0) {
        imageStyle.width = scaledWidth
        imageStyle.height = scaledHeight
        imageStyle.maxWidth = 'none'
        imageStyle.maxHeight = 'none'
    }

    // ESC 키로 닫기
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose()
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [onClose])

    return (
        <div
            className='ImagePreviewModal'
            onClick={handleBackgroundClick}
        >
            <div className='ImagePreviewModal__header'>
                {title && <div className='ImagePreviewModal__title'>{title}</div>}
                <div className='ImagePreviewModal__controls'>
                    <IconButton
                        onClick={handleZoomOut}
                        icon={<ZoomOutIcon/>}
                        title='Zoom out'
                        disabled={scale <= ZoomSettings.MIN_SCALE}
                    />
                    <span className='ImagePreviewModal__scale'>
                        {Math.round(scale * 100)}%
                    </span>
                    <IconButton
                        onClick={handleZoomIn}
                        icon={<ZoomInIcon/>}
                        title='Zoom in'
                        disabled={scale >= ZoomSettings.MAX_SCALE}
                    />
                    <IconButton
                        onClick={onClose}
                        icon={<CloseIcon/>}
                        title='Close'
                    />
                </div>
            </div>
            <div
                ref={containerRef}
                className={`ImagePreviewModal__content ${shouldEnableScroll ? 'ImagePreviewModal__content--zoomed' : ''}`}
                style={containerStyle}
            >
                <img
                    ref={imageRef}
                    className='ImagePreviewModal__image'
                    src={imageUrl}
                    alt={title || 'preview'}
                    style={imageStyle}
                    onLoad={handleImageLoad}
                />
            </div>
        </div>
    )
}

export default React.memo(ImagePreviewModal)

