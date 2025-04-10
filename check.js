import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { RequestManager } from '../http.js';

// 读取CSV文件
const readCSV = (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true
    });
    console.log(`📊 成功读取${records.length}条记录`);
    return records;
  } catch (error) {
    console.error(`❌ 读取CSV文件失败: ${error.message}`);
    process.exit(1);
  }
};

// 写入CSV文件
const writeCSV = (filePath, data) => {
  try {
    const csvContent = stringify(data, { header: true });
    fs.writeFileSync(filePath, csvContent);
    console.log(`✅ 结果已保存至: ${filePath}`);
  } catch (error) {
    console.error(`❌ 写入CSV文件失败: ${error.message}`);
  }
};

const transformAddress = (address) => {
  // 1. 确保地址是小写形式
  let transformed = address.toLowerCase();
  
  // 2. 确保地址有"0x"前缀
  if (!transformed.startsWith('0x')) {
    transformed = '0x' + transformed;
  }
  
  // 3. 检查地址长度是否正确（标准以太坊地址是42个字符，包括0x前缀）
  if (transformed.length !== 42) {
    console.warn(`⚠️ 地址 ${address} 长度异常: ${transformed.length} 字符`);
  }
  
  return transformed;
};

// 查询空投信息
const checkAirdrop = async (address, requestManager) => {
  const transformedAddress = transformAddress(address);
  const url = `https://airdrop-api.initia.xyz/info/initia/${transformedAddress}`;
  
  // 构建请求头
  const headers = {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'zh-CN,zh;q=0.9,is;q=0.8,ko;q=0.7,de;q=0.6,la;q=0.5,ru;q=0.4',
    'if-none-match': 'W/"12b-WSFqxRZqR0JRJhxd69SVtX6mTCU"',
    'origin': 'https://airdrop.initia.xyz',
    'referer': 'https://airdrop.initia.xyz/'
  };

  try {
    const response = await requestManager.simpleRequest({
      method: 'GET',
      url: url,
      headers: headers
    });
    
    return {
      success: true,
      data: response
    };
  } catch (error) {
    let errorMessage = '请求失败';
    if (error.statusCode) {
      errorMessage = `HTTP错误 ${error.statusCode}`;
      if (error.responseData) {
        errorMessage += `: ${JSON.stringify(error.responseData)}`;
      }
    } else if (error.isNetworkError) {
      errorMessage = '网络错误';
    } else {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

// 格式化数量
const formatAmount = (amountStr) => {
  try {
    const amount = parseInt(amountStr, 10);
    return amount / 1_000_000;
  } catch {
    return 0;
  }
};

// 主函数
const main = async () => {
  // 配置文件路径
  const inputFile = 'wallet.csv';
  const outputFile = 'initia_result.csv';
  
  console.log('🚀 开始查询Initia空投信息...');
  
  // 读取CSV文件
  const records = readCSV(inputFile);
  if (records.length === 0) {
    console.error('❌ 没有找到有效记录');
    return;
  }
  
  // 统计数据
  const stats = {
    totalAddresses: records.length,
    successCount: 0,
    failCount: 0,
    totalAmount: 0,
    amounts: []
  };
  
  // 结果数组
  const results = [];
  
  // 处理每条记录
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const address = record.add;
    const proxy = record.proxy;
    
    console.log(`\n🔍 [${i+1}/${records.length}] 查询地址: ${address}`);
    
    // 使用代理创建请求管理器
    const requestManager = new RequestManager(proxy);
    
    // 添加随机延迟，避免请求过快
    if (i > 0) {
      const delay = Math.random() * 1500; // 2-5秒随机延迟
      console.log(`⏱️ 等待${(delay/1000).toFixed(1)}秒...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    try {
      // 查询空投
      const result = await checkAirdrop(address, requestManager);
      
      if (result.success) {
        const data = result.data;
        const amount = formatAmount(data.amount);
        
        console.log(`✅ 查询成功 - 空投数量: ${amount.toFixed(2)} INIT`);
        
        // 更新统计信息
        stats.successCount++;
        stats.totalAmount += amount;
        stats.amounts.push(amount);
        
        // 保存结果
        results.push({
          num: record.num,
          pk: record.pk,
          address: address,
          amount: amount.toFixed(6),
          amount_raw: data.amount,
          xp_rank: data.xp_rank,
          total_xp: data.total_xp,
          jennie_level: data.jennie_level,
          frame_level: data.frame_level,
          filet_mignon: data.filet_mignon,
          status: 'success',
          error: ''
        });
      } else {
        console.log(`❌ 查询失败: ${result.error}`);
        
        stats.failCount++;
        
        results.push({
          num: record.num,
          pk: record.pk,
          address: address,
          amount: '0',
          amount_raw: '0',
          xp_rank: '',
          total_xp: '',
          jennie_level: '',
          frame_level: '',
          filet_mignon: '',
          status: 'error',
          error: result.error
        });
      }
    } catch (error) {
      console.error(`❌ 处理错误: ${error.message}`);
      
      stats.failCount++;
      
      results.push({
        num: record.num,
        pk: record.pk,
        address: address,
        amount: '0',
        amount_raw: '0',
        xp_rank: '',
        total_xp: '',
        jennie_level: '',
        frame_level: '',
        filet_mignon: '',
        status: 'error',
        error: error.message
      });
    }
  }
  
  // 保存结果
  writeCSV(outputFile, results);
  
  // 计算统计信息
  stats.amounts.sort((a, b) => a - b);
  const minAmount = stats.amounts.length > 0 ? stats.amounts[0] : 0;
  const maxAmount = stats.amounts.length > 0 ? stats.amounts[stats.amounts.length - 1] : 0;
  const avgAmount = stats.amounts.length > 0 ? stats.totalAmount / stats.amounts.length : 0;
  
  // 打印摘要
  console.log('\n📊 查询结果摘要');
  console.log('====================');
  console.log(`总地址数: ${stats.totalAddresses}`);
  console.log(`成功查询: ${stats.successCount}`);
  console.log(`失败查询: ${stats.failCount}`);
  console.log(`成功率: ${((stats.successCount / stats.totalAddresses) * 100).toFixed(2)}%`);
  console.log('====================');
  console.log(`总空投量: ${stats.totalAmount.toFixed(2)} INIT`);
  console.log(`最小空投: ${minAmount.toFixed(2)} INIT`);
  console.log(`最大空投: ${maxAmount.toFixed(2)} INIT`);
  console.log(`平均空投: ${avgAmount.toFixed(2)} INIT`);
  console.log('====================');
  console.log(`结果已保存至: ${outputFile}`);
};

// 执行主函数
main().catch(error => {
  console.error(`❌ 程序执行错误: ${error}`);
  process.exit(1);
});