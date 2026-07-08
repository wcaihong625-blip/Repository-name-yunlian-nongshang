'use strict';

/**
 * 云函数：上传图片到云存储
 * @param {String} fileContent - base64编码的文件内容
 * @param {String} fileName - 文件名（可选）
 * @param {String} fileExtension - 文件扩展名（如 'jpg', 'png'）
 */
exports.main = async (event, context) => {
    console.log('uploadImage 云函数被调用:', event);
    
    const { fileContent, fileName, fileExtension = 'jpg' } = event;
    
    // 验证参数
    if (!fileContent) {
        return {
            code: 400,
            message: '缺少必要参数：fileContent',
            data: null
        };
    }
    
    try {
        // 生成唯一文件名
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const finalFileName = fileName || `avatar_${timestamp}_${randomStr}.${fileExtension}`;
        const cloudPath = `images/avatars/${finalFileName}`;
        
        // 将 base64 转换为 Buffer
        const buffer = Buffer.from(fileContent.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        
        // 上传到云存储
        const result = await uniCloud.uploadFile({
            cloudPath: cloudPath,
            fileContent: buffer
        });
        
        console.log('上传成功:', result);
        
        return {
            code: 200,
            message: '上传成功',
            data: {
                fileID: result.fileID,
                url: result.fileID // uniCloud 的 fileID 可以直接作为图片 URL 使用
            }
        };
    } catch (error) {
        console.error('上传图片失败:', error);
        return {
            code: 500,
            message: error.message || '上传失败',
            data: null
        };
    }
};


