<template>
    <view v-if="show" class="cropper-mask" @tap="handleCancel">
        <view class="cropper-container" @tap.stop>
            <!-- 顶部工具栏 -->
            <view class="cropper-header">
                <view class="header-left">
                    <text class="header-btn cancel-btn" @tap="handleCancel">取消</text>
                </view>
                <view class="header-center">
                    <text class="header-title">裁剪头像</text>
                </view>
                <view class="header-right">
                    <text class="header-btn confirm-btn" @tap="handleConfirm">完成</text>
                </view>
            </view>

            <!-- 裁剪区域 -->
            <view class="cropper-content">
                <view class="image-container" @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd">
                    <image 
                        :src="imageSrc" 
                        mode="aspectFit"
                        class="preview-image"
                        :style="imageStyle"
                        @load="onImageLoad"
                    ></image>
                    <!-- 裁剪框（正方形） -->
                    <view class="crop-frame" :style="cropFrameStyle">
                        <view class="crop-corner crop-corner-tl"></view>
                        <view class="crop-corner crop-corner-tr"></view>
                        <view class="crop-corner crop-corner-bl"></view>
                        <view class="crop-corner crop-corner-br"></view>
                    </view>
                </view>
                <view class="crop-tips">拖动图片调整位置</view>
            </view>
        </view>
    </view>
    
    <!-- 隐藏的裁剪画布 - 使用 Canvas 2D -->
    <canvas 
        type="2d"
        id="avatarCropCanvas" 
        class="hidden-canvas"
    ></canvas>
</template>

<script>
export default {
    name: 'SimpleAvatarCropper',
    props: {
        show: {
            type: Boolean,
            default: false
        },
        src: {
            type: String,
            default: ''
        }
    },
    data() {
        return {
            imageSrc: '',
            imageInfo: null,
            imageStyle: {
                transform: 'translate(0, 0)'
            },
            cropFrameStyle: {},
            containerSize: {
                width: 0,
                height: 0
            },
            imagePosition: {
                x: 0,
                y: 0
            },
            touchState: {
                startX: 0,
                startY: 0,
                lastX: 0,
                lastY: 0,
                isMoving: false
            },
            cropSize: 0,
            cropLeft: 0,
            cropTop: 0
        };
    },
    watch: {
        show(newVal) {
            if (newVal && this.src) {
                this.imageSrc = this.src;
                this.$nextTick(() => {
                    this.initCropper();
                });
            }
        },
        src(newVal) {
            if (newVal) {
                this.imageSrc = newVal;
                if (this.show) {
                    this.$nextTick(() => {
                        this.initCropper();
                    });
                }
            }
        }
    },
    methods: {
        initCropper() {
            // 获取容器尺寸
            const query = uni.createSelectorQuery().in(this);
            query.select('.image-container').boundingClientRect((rect) => {
                if (rect) {
                    this.containerSize = {
                        width: rect.width,
                        height: rect.height
                    };
                    this.setupCropFrame();
                }
            }).exec();
        },
        
        setupCropFrame() {
            // 设置裁剪框（正方形，居中）
            const size = Math.min(this.containerSize.width, this.containerSize.height) * 0.75;
            const left = (this.containerSize.width - size) / 2;
            const top = (this.containerSize.height - size) / 2;
            
            this.cropSize = size;
            this.cropLeft = left;
            this.cropTop = top;
            
            this.cropFrameStyle = {
                width: size + 'px',
                height: size + 'px',
                left: left + 'px',
                top: top + 'px'
            };
        },
        
        onImageLoad(e) {
            // 图片加载完成，初始化位置
            this.imageInfo = {
                width: e.detail.width,
                height: e.detail.height
            };
            // 重置图片位置
            this.imagePosition = { x: 0, y: 0 };
            this.updateImageStyle();
        },
        
        updateImageStyle() {
            this.imageStyle = {
                transform: `translate(${this.imagePosition.x}px, ${this.imagePosition.y}px)`
            };
        },
        
        onTouchStart(e) {
            if (e.touches.length === 1) {
                this.touchState.isMoving = true;
                this.touchState.startX = e.touches[0].clientX;
                this.touchState.startY = e.touches[0].clientY;
                this.touchState.lastX = this.imagePosition.x;
                this.touchState.lastY = this.imagePosition.y;
            }
        },
        
        onTouchMove(e) {
            if (this.touchState.isMoving && e.touches.length === 1) {
                const deltaX = e.touches[0].clientX - this.touchState.startX;
                const deltaY = e.touches[0].clientY - this.touchState.startY;
                
                this.imagePosition.x = this.touchState.lastX + deltaX;
                this.imagePosition.y = this.touchState.lastY + deltaY;
                
                this.updateImageStyle();
            }
        },
        
        onTouchEnd(e) {
            this.touchState.isMoving = false;
        },
        
        handleCancel() {
            this.$emit('cancel');
        },
        
        handleConfirm() {
            // 使用 canvas 裁剪图片
            this.cropImage();
        },
        
        cropImage() {
            console.log('[头像裁剪] 开始裁剪图片');
            uni.showLoading({
                title: '处理中...',
                mask: true
            });
            
            // 设置超时保护（15秒，Canvas 2D 可能需要更多时间）
            let isCompleted = false;
            const timeout = setTimeout(() => {
                if (!isCompleted) {
                    isCompleted = true;
                    uni.hideLoading();
                    console.error('[头像裁剪] 裁剪超时');
                    uni.showToast({
                        title: '处理超时，请重试',
                        icon: 'none',
                        duration: 2000
                    });
                }
            }, 15000);
            
            const complete = () => {
                if (!isCompleted) {
                    isCompleted = true;
                    clearTimeout(timeout);
                    uni.hideLoading();
                }
            };
            
            // 获取图片信息
            uni.getImageInfo({
                src: this.imageSrc,
                success: (imageRes) => {
                    console.log('[头像裁剪] 获取图片信息成功', {
                        width: imageRes.width,
                        height: imageRes.height,
                        path: imageRes.path
                    });
                    
                    // 使用 Canvas 2D API
                    this.cropImageWithCanvas2D(imageRes, complete);
                },
                fail: (err) => {
                    console.error('[头像裁剪] 获取图片信息失败', err);
                    complete();
                    uni.showToast({
                        title: '处理失败，请重试',
                        icon: 'none',
                        duration: 2000
                    });
                }
            });
        },
        
        // 使用 Canvas 2D API 裁剪图片
        cropImageWithCanvas2D(imageRes, complete) {
            try {
                const canvasSize = 300; // 输出尺寸（300x300像素）
                
                // 计算裁剪区域（相对于图片原始尺寸）
                const containerW = this.containerSize.width;
                const containerH = this.containerSize.height;
                const imageW = imageRes.width;
                const imageH = imageRes.height;
                
                // 计算图片在容器中的缩放比例（aspectFit模式）
                const scaleW = containerW / imageW;
                const scaleH = containerH / imageH;
                const scale = Math.min(scaleW, scaleH);
                
                const displayW = imageW * scale;
                const displayH = imageH * scale;
                
                // 计算图片在容器中的实际位置（居中显示）
                const imageX = (containerW - displayW) / 2;
                const imageY = (containerH - displayH) / 2;
                
                // 计算裁剪框相对于图片的位置
                const cropX = (this.cropLeft - imageX - this.imagePosition.x) / scale;
                const cropY = (this.cropTop - imageY - this.imagePosition.y) / scale;
                const cropW = this.cropSize / scale;
                const cropH = this.cropSize / scale;
                
                // 确保裁剪区域在图片范围内
                const finalCropX = Math.max(0, Math.min(cropX, imageW - cropW));
                const finalCropY = Math.max(0, Math.min(cropY, imageH - cropH));
                const finalCropW = Math.min(cropW, imageW - finalCropX);
                const finalCropH = Math.min(cropH, imageH - finalCropY);
                
                console.log('[头像裁剪] 计算裁剪区域', {
                    finalCropX,
                    finalCropY,
                    finalCropW,
                    finalCropH,
                    canvasSize
                });
                
                // 获取 Canvas 2D 节点
                const query = uni.createSelectorQuery().in(this);
                query.select('#avatarCropCanvas')
                    .fields({ node: true, size: true })
                    .exec((res) => {
                        if (!res || !res[0] || !res[0].node) {
                            console.error('[头像裁剪] 无法获取 Canvas 节点');
                            complete();
                            this.fallbackToOriginalImage();
                            return;
                        }
                        
                        const canvas = res[0].node;
                        const ctx = canvas.getContext('2d');
                        
                        // 设置 Canvas 尺寸
                        const dpr = uni.getSystemInfoSync().pixelRatio || 1;
                        canvas.width = canvasSize * dpr;
                        canvas.height = canvasSize * dpr;
                        ctx.scale(dpr, dpr);
                        
                        console.log('[头像裁剪] Canvas 2D 初始化完成，开始绘制');
                        
                        // 创建图片对象
                        const img = canvas.createImage();
                        
                        img.onload = () => {
                            try {
                                console.log('[头像裁剪] 图片加载完成，开始绘制');
                                
                                // 清空画布
                                ctx.clearRect(0, 0, canvasSize, canvasSize);
                                
                                // 绘制裁剪后的图片
                                ctx.drawImage(
                                    img,
                                    finalCropX, finalCropY, finalCropW, finalCropH,
                                    0, 0, canvasSize, canvasSize
                                );
                                
                                console.log('[头像裁剪] Canvas 绘制完成，开始导出');
                                
                                // 延迟一下，确保绘制完成
                                setTimeout(() => {
                                    // 导出图片 - Canvas 2D 使用不同的 API
                                    uni.canvasToTempFilePath({
                                        canvas: canvas,
                                        width: canvasSize,
                                        height: canvasSize,
                                        destWidth: canvasSize,
                                        destHeight: canvasSize,
                                        fileType: 'jpg',
                                        quality: 0.9,
                                        success: (res) => {
                                            console.log('[头像裁剪] 导出成功:', res.tempFilePath);
                                            complete();
                                            this.$emit('confirm', res.tempFilePath);
                                        },
                                        fail: (err) => {
                                            console.error('[头像裁剪] 导出失败', err);
                                            complete();
                                            this.fallbackToOriginalImage();
                                        }
                                    }, this);
                                }, 200); // 延迟200ms，确保绘制完成
                            } catch (error) {
                                console.error('[头像裁剪] 绘制过程异常', error);
                                complete();
                                this.fallbackToOriginalImage();
                            }
                        };
                        
                        img.onerror = (err) => {
                            console.error('[头像裁剪] 图片加载失败', err);
                            complete();
                            this.fallbackToOriginalImage();
                        };
                        
                        // 加载图片
                        img.src = imageRes.path;
                    });
            } catch (error) {
                console.error('[头像裁剪] Canvas 2D 操作异常', error);
                complete();
                this.fallbackToOriginalImage();
            }
        },
        
        // 降级方案：直接使用原图
        fallbackToOriginalImage() {
            console.warn('[头像裁剪] 使用降级方案：直接返回原图');
            uni.showModal({
                title: '提示',
                content: '裁剪功能在当前环境不可用，是否直接使用原图？',
                success: (modalRes) => {
                    if (modalRes.confirm) {
                        this.$emit('confirm', this.imageSrc);
                    }
                }
            });
        }
    }
};
</script>

<style scoped>
.cropper-mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.9);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
}

.cropper-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #000;
}

.cropper-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 32rpx;
    padding-top: calc(140rpx + constant(safe-area-inset-top));
    padding-top: calc(140rpx + env(safe-area-inset-top));
    padding-bottom: 20rpx;
    background: rgba(0, 0, 0, 0.8);
    min-height: 88rpx;
    position: relative;
    z-index: 10;
}

.header-left,
.header-right {
    flex: 0 0 auto;
    min-width: 120rpx;
    display: flex;
    align-items: center;
}

.header-left {
    justify-content: flex-start;
}

.header-right {
    justify-content: flex-end;
}

.header-center {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    pointer-events: none;
}

.header-title {
    font-size: 32rpx;
    font-weight: 500;
    color: #fff;
    text-align: center;
}

.header-btn {
    font-size: 28rpx;
    padding: 12rpx 24rpx;
    display: inline-block;
    min-height: 44rpx;
    line-height: 44rpx;
    box-sizing: border-box;
}

.cancel-btn {
    color: #999;
}

.confirm-btn {
    color: #07c160;
    font-weight: 500;
}

.cropper-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.image-container {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 40rpx;
    background: #000;
}

.preview-image {
    max-width: 100%;
    max-height: 100%;
}

.crop-frame {
    position: absolute;
    border: 2rpx solid #fff;
    box-shadow: 0 0 0 9999rpx rgba(0, 0, 0, 0.6);
    pointer-events: none;
    box-sizing: border-box;
}

.crop-corner {
    position: absolute;
    width: 40rpx;
    height: 40rpx;
    border: 4rpx solid #fff;
}

.crop-corner-tl {
    top: -2rpx;
    left: -2rpx;
    border-right: none;
    border-bottom: none;
}

.crop-corner-tr {
    top: -2rpx;
    right: -2rpx;
    border-left: none;
    border-bottom: none;
}

.crop-corner-bl {
    bottom: -2rpx;
    left: -2rpx;
    border-right: none;
    border-top: none;
}

.crop-corner-br {
    bottom: -2rpx;
    right: -2rpx;
    border-left: none;
    border-top: none;
}

.crop-tips {
    padding: 24rpx 32rpx;
    text-align: center;
    color: rgba(255, 255, 255, 0.6);
    font-size: 24rpx;
    background: rgba(0, 0, 0, 0.8);
}

.hidden-canvas {
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: 300px;
    height: 300px;
}
</style>

