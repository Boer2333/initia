// cosmos-evm-derive.js
import { ethers } from 'ethers';
import bip39 from 'bip39';
import chalk from 'chalk';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

// 定义Cosmos生态系统派生路径
const COSMOS_PATH = "m/44'/118'/0'/0/0";

// 从助记词和Cosmos路径派生EVM地址
const deriveEVMAddressFromCosmosPath = (mnemonic) => {
  try {
    // 验证助记词
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error("无效的助记词");
    }
    
    // 从助记词生成种子
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    
    // 使用ethers库的HDNode从种子派生
    const hdNode = ethers.HDNodeWallet.fromSeed(seed);
    const childNode = hdNode.derivePath(COSMOS_PATH);
    
    // 获取以太坊地址和私钥
    const address = childNode.address;
    const privateKey = childNode.privateKey;
    
    return {
      address: address,
      privateKey: privateKey,
      path: COSMOS_PATH
    };
  } catch (error) {
    console.error(chalk.red(`派生EVM地址出错: ${error.message}`));
    return null;
  }
};

// 读取CSV文件中的助记词
const readMnemonicsFromCSV = (filePath) => {
  try {
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      console.error(chalk.red(`文件不存在: ${filePath}`));
      return [];
    }

    // 读取CSV文件内容
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // 解析CSV
    const records = parse(fileContent, {
      columns: false,
      skip_empty_lines: true
    });
    
    // 提取助记词（假设助记词在第一列）
    const mnemonics = records.map(record => record[0].trim());
    
    return mnemonics;
  } catch (error) {
    console.error(chalk.red(`读取CSV文件出错: ${error.message}`));
    return [];
  }
};

// 将结果写入CSV文件
const writeResultsToCSV = (filePath, results) => {
  try {
    // 准备CSV数据
    const data = results.map(result => {
      if (result.success) {
        return [
          result.mnemonic,
          result.address,
          result.privateKey
        ];
      } else {
        return [
          result.mnemonic,
          '派生出错',
          result.error
        ];
      }
    });
    
    // 添加标题行
    data.unshift(['助记词', 'EVM地址', '私钥']);
    
    // 将数据转换为CSV格式
    const csvContent = stringify(data);
    
    // 写入文件
    fs.writeFileSync(filePath, csvContent);
    
    console.log(chalk.green(`结果已保存到 ${filePath}`));
  } catch (error) {
    console.error(chalk.red(`写入CSV文件出错: ${error.message}`));
  }
};

// 主函数
const main = () => {
  const inputFile = 'memo.csv';
  const outputFile = 'init.csv';
  
  console.log(chalk.blue(`从 ${inputFile} 读取助记词...`));
  
  // 读取助记词
  const mnemonics = readMnemonicsFromCSV(inputFile);
  
  if (mnemonics.length === 0) {
    console.error(chalk.red('没有找到助记词'));
    return;
  }
  
  console.log(chalk.green(`读取到 ${mnemonics.length} 个助记词`));
  console.log(chalk.yellow(`开始派生EVM地址 (使用Cosmos路径 ${COSMOS_PATH})...`));
  
  // 处理每个助记词
  const results = mnemonics.map((mnemonic, index) => {
    console.log(chalk.blue(`处理助记词 ${index + 1}/${mnemonics.length}...`));
    
    // 验证助记词
    if (!bip39.validateMnemonic(mnemonic)) {
      console.error(chalk.red(`无效的助记词: ${mnemonic}`));
      return {
        mnemonic,
        success: false,
        error: '无效的助记词'
      };
    }
    
    // 派生地址
    const result = deriveEVMAddressFromCosmosPath(mnemonic);
    
    if (result) {
      console.log(chalk.green(`成功派生地址: ${result.address}`));
      return {
        mnemonic,
        success: true,
        address: result.address,
        privateKey: result.privateKey
      };
    } else {
      return {
        mnemonic,
        success: false,
        error: '派生失败'
      };
    }
  });
  
  // 保存结果
  console.log(chalk.yellow(`保存结果到 ${outputFile}...`));
  writeResultsToCSV(outputFile, results);
  
  // 统计信息
  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;
  
  console.log(chalk.green(`\n处理完成!`));
  console.log(chalk.green(`总助记词数: ${mnemonics.length}`));
  console.log(chalk.green(`成功派生: ${successCount}`));
  console.log(chalk.red(`失败派生: ${failCount}`));
  
  console.log(chalk.red("\n重要: 永远不要分享您的助记词或私钥!"));
};

main();