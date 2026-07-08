'use strict';

exports.main = async (event, context) => {
  console.log('========== 惠农网上传云函数开始 ==========');
  console.log('📝 原始事件参数类型:', typeof event);
  console.log('📝 事件参数键名:', Object.keys(event));
  
  // 重要：解析 body 参数
  let requestData = event;
  
  // 如果 body 存在且是字符串，解析它
  if (event.body && typeof event.body === 'string') {
    console.log('🔍 发现 body 字段，开始解析...');
    try {
      requestData = JSON.parse(event.body);
      console.log('✅ Body 解析成功');
      console.log('解析后的数据键名:', Object.keys(requestData));
    } catch (parseError) {
      console.error('❌ Body 解析失败:', parseError.message);
      return {
        success: false,
        code: 400,
        message: '请求体格式错误，必须是有效的JSON',
        error: parseError.message
      };
    }
  }
  
  console.log('📝 最终请求数据:');
  console.log('数据类型:', typeof requestData);
  console.log('数据键名:', Object.keys(requestData));
  
  // 检查必要参数
  console.log(`🔍 检查 fileContent: ${'fileContent' in requestData}`);
  console.log(`🔍 fileContent 值: ${requestData.fileContent ? '存在' : '不存在'}`);
  console.log(`🔍 fileContent 类型: ${typeof requestData.fileContent}`);
  console.log(`🔍 fileContent 长度: ${requestData.fileContent ? requestData.fileContent.length : 0}`);
  
  if (!requestData.fileContent) {
    console.log('❌ 缺少 fileContent 参数');
    return {
      success: false,
      code: 400,
      message: '缺少必要参数: fileContent',
      debug: {
        receivedData: requestData,
        receivedKeys: Object.keys(requestData),
        originalEventKeys: Object.keys(event),
        hasBodyField: !!event.body,
        bodyType: typeof event.body
      }
    };
  }
  
  try {
    console.log('🔄 开始处理文件...');
    
    // 获取参数
    const fileContent = requestData.fileContent;
    const fileName = requestData.fileName || 'mini_program_latest.min.json';
    const folder = requestData.folder || 'agricultural-data';
    const cloudPath = `${folder}/${fileName}`;
    
    console.log(`📁 文件信息:`);
    console.log(`   Base64长度: ${fileContent.length} 字符`);
    console.log(`   文件名: ${fileName}`);
    console.log(`   文件夹: ${folder}`);
    console.log(`   云存储路径: ${cloudPath}`);
    
    // 验证Base64格式
    console.log('🔍 验证Base64格式...');
    const isBase64 = /^[A-Za-z0-9+/]+=*$/.test(fileContent);
    console.log(`   Base64格式有效: ${isBase64}`);
    
    if (!isBase64) {
      console.log('❌ Base64格式无效');
      return {
        success: false,
        code: 400,
        message: 'fileContent 不是有效的Base64编码'
      };
    }
    
    // 解码Base64
    console.log('🔧 解码Base64...');
    const fileBuffer = Buffer.from(fileContent, 'base64');
    console.log(`✅ 解码成功，Buffer大小: ${fileBuffer.length} 字节`);
    
    // 验证JSON
    console.log('🔍 验证JSON格式...');
    try {
      const jsonContent = fileBuffer.toString('utf8');
      const parsedData = JSON.parse(jsonContent);
      console.log(`✅ JSON验证成功，数据条数: ${parsedData.products ? parsedData.products.length : '未知'}`);
    } catch (jsonError) {
      console.warn(`⚠️  JSON验证失败: ${jsonError.message}`);
    }
    
    // 上传到云存储
    console.log('🚀 上传到云存储...');
    const uploadStartTime = Date.now();
    
    const uploadResult = await uniCloud.uploadFile({
      cloudPath: cloudPath,
      fileContent: fileBuffer
    });
    
    const uploadTime = Date.now() - uploadStartTime;
    console.log(`✅ 上传成功，耗时: ${uploadTime}ms`);
    console.log('上传结果:', uploadResult);
    
    // 构造公开URL
    const publicUrl = `https://mp-ab506838-a8d9-4b39-b973-ccf131ef8a18.cdn.bspapp.com/${cloudPath}`;
    
    console.log('🎉 上传完成！');
    console.log(`🔗 公开链接: ${publicUrl}`);
    
    return {
      success: true,
      code: 0,
      message: '上传成功',
      data: {
        fileID: uploadResult.fileID,
        cloudPath: cloudPath,
        fileSize: fileBuffer.length,
        uploadTime: uploadTime,
        timestamp: new Date().toISOString(),
        publicUrl: publicUrl,
        downloadUrl: publicUrl
      }
    };
    
  } catch (error) {
    console.error('❌ 上传过程中出错:');
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);
    
    return {
      success: false,
      code: -1,
      message: `上传失败: ${error.message}`,
      error: error.message
    };
  }
};