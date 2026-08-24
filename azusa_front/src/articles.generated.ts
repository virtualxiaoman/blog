// 本文件由 scripts/generate-articles.mjs 自动生成，请勿手动编辑。
// 数据源：public/article/md/<分类>/<文章名>.md + public/article/cover/
export interface ArticleSection {
  level: number; // 标题层级 1~6
  text: string; // 标题文本（已去掉 KaTeX 颜色标记与 $ 定界符，无序号标题已补层级序号）
}

export interface ArticleInfo {
  name: string;
  cover: string | null; // 封面文件名，null 表示用默认占位图
  headings: ArticleSection[]; // 小节标题列表，供全局搜索的"文章内区域"索引
}

export const articleCategories: Record<string, ArticleInfo[]> = {
  "AI": [
    {
      "name": "深度学习",
      "cover": "深度学习.jpeg",
      "headings": [
        {
          "level": 1,
          "text": "1. 动手算神经网络"
        },
        {
          "level": 2,
          "text": "1.1 前向传播的shape"
        },
        {
          "level": 3,
          "text": "1.1.1 简表"
        },
        {
          "level": 3,
          "text": "1.1.2 对该表的一些约定"
        },
        {
          "level": 3,
          "text": "1.1.3 补充说明"
        },
        {
          "level": 2,
          "text": "1.2 前向传播的计算"
        },
        {
          "level": 3,
          "text": "1.2.1 激活函数"
        },
        {
          "level": 3,
          "text": "1.2.2 展平层"
        },
        {
          "level": 3,
          "text": "1.2.3 线性层"
        },
        {
          "level": 4,
          "text": "1.2.3.1 二维输入"
        },
        {
          "level": 4,
          "text": "1.2.3.2 高维输入"
        },
        {
          "level": 3,
          "text": "1.2.4 卷积层"
        },
        {
          "level": 4,
          "text": "1.2.4.1 `conv2d`"
        },
        {
          "level": 4,
          "text": "1.2.4.2 `conv1d`："
        },
        {
          "level": 4,
          "text": "1.2.4.3 out_channels > 1"
        },
        {
          "level": 4,
          "text": "1.2.4.4 in_channels > 1"
        },
        {
          "level": 3,
          "text": "1.2.5 汇聚层"
        },
        {
          "level": 3,
          "text": "1.2.6 归一化"
        },
        {
          "level": 2,
          "text": "1.3 损失函数的计算"
        },
        {
          "level": 3,
          "text": "1.3.1 `MSELoss`(均方误差损失)"
        },
        {
          "level": 3,
          "text": "1.3.2 `L1Loss` (绝对误差损失)"
        },
        {
          "level": 3,
          "text": "1.3.3 `HuberLoss` (Huber 损失)"
        },
        {
          "level": 3,
          "text": "1.3.4 `CrossEntropyLoss` (交叉熵损失)"
        },
        {
          "level": 3,
          "text": "1.3.5 `BCEWithLogitsLoss` (带 `sigmoid` 的二分类交叉熵损失)"
        },
        {
          "level": 3,
          "text": "1.3.6 `BCELoss` (二分类交叉熵损失)"
        },
        {
          "level": 1,
          "text": "2. 常遇到的问题"
        },
        {
          "level": 2,
          "text": "2.1 代码运行问题"
        },
        {
          "level": 3,
          "text": "2.1.1 损失函数的问题"
        },
        {
          "level": 3,
          "text": "2.1.2 硬件的问题"
        },
        {
          "level": 4,
          "text": "2.1.2.1 CUDA"
        },
        {
          "level": 3,
          "text": "2.1.3 模型的问题"
        },
        {
          "level": 4,
          "text": "2.1.3.1 导入模型"
        },
        {
          "level": 3,
          "text": "2.1.4 其他问题"
        },
        {
          "level": 4,
          "text": "2.1.4.1 软件包的问题"
        },
        {
          "level": 2,
          "text": "2.2 理论问题"
        },
        {
          "level": 3,
          "text": "2.2.1 梯度消失和梯度爆炸"
        },
        {
          "level": 3,
          "text": "2.2.2 过拟合和欠拟合"
        },
        {
          "level": 3,
          "text": "2.2.3 网络越深效果越差"
        },
        {
          "level": 3,
          "text": "2.2.4 数据不匹配domain mismatch"
        },
        {
          "level": 3,
          "text": "2.2.5 局部极小值 OR 鞍点？"
        },
        {
          "level": 3,
          "text": "2.2.6 万能近似定理UAT"
        },
        {
          "level": 3,
          "text": "2.2.7 饱和"
        },
        {
          "level": 2,
          "text": "2.3 评估问题"
        },
        {
          "level": 3,
          "text": "2.3.1 基准语料库"
        },
        {
          "level": 1,
          "text": "3. 激活函数&损失函数"
        },
        {
          "level": 2,
          "text": "3.1 [CrossEntropyLoss](https://pytorch.org/docs/stable/generated/torch.nn.CrossEntropyLoss.html)"
        },
        {
          "level": 1,
          "text": "4. 优化器"
        },
        {
          "level": 1,
          "text": "5. 正则化、标准化"
        },
        {
          "level": 1,
          "text": "6. 数据处理"
        },
        {
          "level": 2,
          "text": "6.1 数据增强"
        },
        {
          "level": 3,
          "text": "6.1.1 图像增广"
        },
        {
          "level": 1,
          "text": "7. 经典网络"
        },
        {
          "level": 2,
          "text": "7.1 CNN相关"
        },
        {
          "level": 3,
          "text": "7.1.1 AlexNet"
        },
        {
          "level": 3,
          "text": "7.1.2 VGG"
        },
        {
          "level": 3,
          "text": "7.1.3 GoogLeNet"
        },
        {
          "level": 3,
          "text": "7.1.4 ResNet"
        },
        {
          "level": 3,
          "text": "7.1.5 DenseNet"
        },
        {
          "level": 3,
          "text": "7.1.6 SENet"
        },
        {
          "level": 3,
          "text": "7.1.7 UNet"
        },
        {
          "level": 3,
          "text": "7.1.8 MobileNet"
        },
        {
          "level": 3,
          "text": "7.1.9 MnasNet"
        },
        {
          "level": 2,
          "text": "7.2 RNN相关"
        },
        {
          "level": 3,
          "text": "7.2.1 LSTM"
        },
        {
          "level": 3,
          "text": "7.2.2 GRU"
        },
        {
          "level": 2,
          "text": "7.3 Transformer"
        },
        {
          "level": 1,
          "text": "8. 深度学习模型"
        },
        {
          "level": 2,
          "text": "8.1 MLP"
        },
        {
          "level": 2,
          "text": "8.2 CNN"
        },
        {
          "level": 3,
          "text": "8.2.1 基本的CNN"
        },
        {
          "level": 3,
          "text": "8.2.2 深度可分离卷积"
        },
        {
          "level": 3,
          "text": "8.2.3 孪生网络Siamese Network"
        },
        {
          "level": 2,
          "text": "8.3 RNN"
        },
        {
          "level": 3,
          "text": "8.3.1 基本的RNN"
        },
        {
          "level": 3,
          "text": "8.3.2 GRU"
        },
        {
          "level": 3,
          "text": "8.3.3 LSTM"
        },
        {
          "level": 3,
          "text": "8.3.4 深度循环神经网络"
        },
        {
          "level": 3,
          "text": "8.3.5 双向循环神经网络"
        },
        {
          "level": 3,
          "text": "8.3.6 编码器-解码器架构"
        },
        {
          "level": 3,
          "text": "8.3.7 seq2seq"
        },
        {
          "level": 2,
          "text": "8.4. 注意力机制"
        },
        {
          "level": 3,
          "text": "8.4.1 非参数注意力汇聚 Nadaraya-Watson核回归"
        },
        {
          "level": 3,
          "text": "8.4.2. 带参数注意力汇聚"
        },
        {
          "level": 3,
          "text": "8.4.3 注意力评分函数"
        },
        {
          "level": 3,
          "text": "8.4.4 Bahdanau注意力"
        },
        {
          "level": 3,
          "text": "8.4.5 自注意力和位置编码"
        },
        {
          "level": 3,
          "text": "8.4.6 Transformer"
        },
        {
          "level": 3,
          "text": "8.4.7 对比"
        },
        {
          "level": 3,
          "text": "8.4.8 tricks"
        },
        {
          "level": 2,
          "text": "8.5 生成式模型"
        },
        {
          "level": 3,
          "text": "8.5.1 GAN"
        },
        {
          "level": 3,
          "text": "8.5.2 CycleGAN"
        },
        {
          "level": 3,
          "text": "8.5.3 扩散模型diffusion"
        },
        {
          "level": 2,
          "text": "8.6 自监督学习"
        },
        {
          "level": 3,
          "text": "8.6.1 BERT"
        },
        {
          "level": 3,
          "text": "8.6.2 GPT"
        },
        {
          "level": 3,
          "text": "8.6.3 自编码器"
        },
        {
          "level": 2,
          "text": "8.7 迁移学习"
        },
        {
          "level": 3,
          "text": "8.7.1 领域偏移 domain shift"
        },
        {
          "level": 3,
          "text": "8.7.2 领域自适应 domain adaptation"
        },
        {
          "level": 3,
          "text": "8.7.3 领域泛化 domain generalization"
        },
        {
          "level": 2,
          "text": "8.8 强化学习"
        },
        {
          "level": 1,
          "text": "9. 实际应用中的挑战与优化"
        },
        {
          "level": 2,
          "text": "9.1 对抗攻击"
        },
        {
          "level": 3,
          "text": "9.1.1 如何攻击网络"
        },
        {
          "level": 3,
          "text": "9.1.2 如何防御网络"
        },
        {
          "level": 2,
          "text": "9.2 网络压缩"
        },
        {
          "level": 3,
          "text": "9.2.1 网络剪枝 network pruning"
        },
        {
          "level": 3,
          "text": "9.2.2 知识蒸馏 knowledge distillation"
        },
        {
          "level": 3,
          "text": "9.2.3 参数量化 parameter quantization"
        },
        {
          "level": 3,
          "text": "9.2.4 网络架构设计 network architecture design"
        },
        {
          "level": 3,
          "text": "9.2.5 动态计算 dynamic computation"
        },
        {
          "level": 2,
          "text": "9.3 终身学习"
        },
        {
          "level": 3,
          "text": "9.3.1 干什么"
        },
        {
          "level": 3,
          "text": "9.3.2 评估指标"
        },
        {
          "level": 3,
          "text": "9.3.3 解决方法"
        },
        {
          "level": 2,
          "text": "9.4 可解释性人工智能"
        },
        {
          "level": 3,
          "text": "9.4.1 局部解释"
        },
        {
          "level": 3,
          "text": "9.4.2 全局解释"
        },
        {
          "level": 1,
          "text": "10. 我的一些想法"
        },
        {
          "level": 2,
          "text": "10.1 象形字->embedding"
        },
        {
          "level": 2,
          "text": "10.2 通过内积求张量的相似度，以此模拟颜色聚类"
        },
        {
          "level": 2,
          "text": "10.3 卷积+池化是模糊图片，那么反卷积+反池化是什么？提取图片的细节？"
        },
        {
          "level": 2,
          "text": "10.4 注意力"
        },
        {
          "level": 1,
          "text": "11. 致谢"
        }
      ]
    },
    {
      "name": "机器学习",
      "cover": "机器学习.png",
      "headings": [
        {
          "level": 1,
          "text": "1. 概论"
        },
        {
          "level": 2,
          "text": "1.1 流程"
        },
        {
          "level": 2,
          "text": "1.2 常见问题"
        },
        {
          "level": 3,
          "text": "1.2.1 数据问题"
        },
        {
          "level": 4,
          "text": "1.2.1.1 正负样本分布不均衡"
        },
        {
          "level": 4,
          "text": "1.2.1.2 数据集过大"
        },
        {
          "level": 4,
          "text": "1.2.1.3 特征选择"
        },
        {
          "level": 3,
          "text": "1.2.2 模型问题"
        },
        {
          "level": 4,
          "text": "1.2.2.1 几种树"
        },
        {
          "level": 3,
          "text": "1.2.3 代码报错"
        },
        {
          "level": 1,
          "text": "2. 特征工程"
        },
        {
          "level": 2,
          "text": "2.1 数据预处理"
        },
        {
          "level": 3,
          "text": "2.1.1 缺失值"
        },
        {
          "level": 4,
          "text": "2.1.1.1 缺失值的类型与处理方法"
        },
        {
          "level": 4,
          "text": "2.1.1.2 缺失值的类型的判断方法"
        },
        {
          "level": 3,
          "text": "2.1.2 异常值"
        },
        {
          "level": 4,
          "text": "2.1.2.1 异常值的类型"
        },
        {
          "level": 4,
          "text": "2.1.2.2 异常值的判断方法"
        },
        {
          "level": 4,
          "text": "2.1.2.3 异常值的处理方法"
        },
        {
          "level": 3,
          "text": "2.1.3 数据清洗"
        },
        {
          "level": 2,
          "text": "2.2 特征处理"
        },
        {
          "level": 3,
          "text": "2.2.1 数值特征处理"
        },
        {
          "level": 3,
          "text": "2.2.2 类别特征处理"
        },
        {
          "level": 3,
          "text": "2.2.3 时间特征处理"
        },
        {
          "level": 3,
          "text": "2.2.4 多值特征处理"
        },
        {
          "level": 2,
          "text": "2.3 特征筛选"
        },
        {
          "level": 3,
          "text": "2.3.1 过滤法"
        },
        {
          "level": 3,
          "text": "2.3.2 包装法"
        },
        {
          "level": 3,
          "text": "2.3.3 嵌入法"
        },
        {
          "level": 1,
          "text": "3. 模型评估与选择"
        },
        {
          "level": 2,
          "text": "3.1 模型评估"
        },
        {
          "level": 3,
          "text": "3.1.1 评估目标"
        },
        {
          "level": 3,
          "text": "3.1.2 评估方法"
        },
        {
          "level": 3,
          "text": "3.1.3 评估指标"
        },
        {
          "level": 1,
          "text": "3.2 模型选择"
        },
        {
          "level": 3,
          "text": "3.2.1 模型选择依据"
        },
        {
          "level": 3,
          "text": "3.2.2 偏差和方差"
        },
        {
          "level": 1,
          "text": "4. 模型训练与优化"
        },
        {
          "level": 2,
          "text": "4.1 数据集优化"
        },
        {
          "level": 3,
          "text": "4.1.1 数据采样"
        },
        {
          "level": 3,
          "text": "4.1.2 数据降维"
        },
        {
          "level": 2,
          "text": "4.2 目标函数优化"
        },
        {
          "level": 2,
          "text": "4.3 模型结构优化"
        },
        {
          "level": 3,
          "text": "4.3.1 集成学习"
        },
        {
          "level": 2,
          "text": "4.4 最优化算法"
        },
        {
          "level": 2,
          "text": "4.5 模型参数优化"
        },
        {
          "level": 3,
          "text": "4.5.1 超参数优化"
        },
        {
          "level": 1,
          "text": "5. 经典模型"
        },
        {
          "level": 2,
          "text": "5.1 回归 Regression"
        },
        {
          "level": 3,
          "text": "5.1.1 线性回归 Linear Regression"
        }
      ]
    },
    {
      "name": "论文阅读",
      "cover": "论文阅读.png",
      "headings": [
        {
          "level": 2,
          "text": "1. CV"
        },
        {
          "level": 3,
          "text": "1.1 经典论文"
        },
        {
          "level": 4,
          "text": "1.1.1 ImageNet Classification with Deep Convolutional Neural Networks"
        },
        {
          "level": 4,
          "text": "1.1.2 Deep Residual Learning for Image Recognition"
        },
        {
          "level": 4,
          "text": "1.1.3 Attention Is All You Need"
        },
        {
          "level": 2,
          "text": "2. 引理证明"
        },
        {
          "level": 3,
          "text": "2.1 优化问题"
        },
        {
          "level": 4,
          "text": "2.1.1 梯度下降要求\\eta < \\frac{2}{\\lambda_{\\max}}"
        }
      ]
    },
    {
      "name": "深度学习实践",
      "cover": "深度学习实践.jpg",
      "headings": [
        {
          "level": 1,
          "text": "1. CV"
        },
        {
          "level": 2,
          "text": "1.1 Supervised"
        },
        {
          "level": 3,
          "text": "1.1.1 Image Classification"
        },
        {
          "level": 4,
          "text": "1.1.1.1 传统分类"
        },
        {
          "level": 4,
          "text": "1.1.1.2 人脸识别"
        }
      ]
    },
    {
      "name": "机器学习实践",
      "cover": "机器学习实践.jpg",
      "headings": [
        {
          "level": 1,
          "text": "1. 前言"
        },
        {
          "level": 1,
          "text": "1. 小型demo"
        },
        {
          "level": 2,
          "text": "1.1 House Price - Advanced Regression Techniques"
        },
        {
          "level": 3,
          "text": "1.1.1 数据集介绍"
        },
        {
          "level": 3,
          "text": "1.1.2 数据预处理"
        },
        {
          "level": 4,
          "text": "1.1.2.1 缺失值处理"
        },
        {
          "level": 4,
          "text": "1.1.2.2 了解特征"
        },
        {
          "level": 4,
          "text": "1.1.2.3 corr"
        },
        {
          "level": 4,
          "text": "1.1.2.4 多变量分析"
        },
        {
          "level": 4,
          "text": "1.1.2.5 Ridge回归与Lasso回归"
        },
        {
          "level": 4,
          "text": "1.1.2.6 特征工程"
        },
        {
          "level": 3,
          "text": "1.1.3 模型对比"
        },
        {
          "level": 4,
          "text": "1.1.3.1 神经网络"
        },
        {
          "level": 4,
          "text": "1.1.3.2 堆叠模型"
        },
        {
          "level": 4,
          "text": "1.1.3.3 预处理+stack"
        },
        {
          "level": 2,
          "text": "1.2 Elo Merchant Category Recommendation"
        },
        {
          "level": 3,
          "text": "1.2.1 数据集介绍"
        },
        {
          "level": 3,
          "text": "1.2.2 数据预处理"
        },
        {
          "level": 4,
          "text": "1.2.2.1 正确性检验&分布差异检验"
        },
        {
          "level": 4,
          "text": "1.2.2.2 可视化"
        },
        {
          "level": 4,
          "text": "1.2.2.3 特征工程"
        },
        {
          "level": 2,
          "text": "1.3 California House Prices"
        },
        {
          "level": 1,
          "text": "2. 项目实践"
        },
        {
          "level": 2,
          "text": "2.1 计算广告——广告点击率预估"
        },
        {
          "level": 3,
          "text": "2.1.1 项目背景"
        },
        {
          "level": 4,
          "text": "2.1.1.1 计算广告的目标"
        },
        {
          "level": 4,
          "text": "2.1.1.2 计算广告的术语"
        },
        {
          "level": 4,
          "text": "2.1.1.3 计算广告的流程"
        },
        {
          "level": 3,
          "text": "2.1.2 核心算法"
        },
        {
          "level": 3,
          "text": "2.1.3 数据集介绍"
        },
        {
          "level": 3,
          "text": "2.1.4 数据预处理与初步分析"
        },
        {
          "level": 4,
          "text": "2.1.4.1 读取数据"
        },
        {
          "level": 4,
          "text": "2.1.4.2 缺失值&编码"
        },
        {
          "level": 4,
          "text": "2.1.4.3 了解特征"
        },
        {
          "level": 4,
          "text": "2.1.4.4 异常值等处理"
        },
        {
          "level": 4,
          "text": "2.1.4.5 corr"
        },
        {
          "level": 4,
          "text": "2.1.4.6 合并数据"
        },
        {
          "level": 4,
          "text": "2.1.4.7 其余可视化"
        },
        {
          "level": 4,
          "text": "2.1.4.8 构建embedding向量"
        },
        {
          "level": 3,
          "text": "2.1.5 特征工程"
        },
        {
          "level": 3,
          "text": "2.1.6 ItemCF"
        },
        {
          "level": 3,
          "text": "2.1.7 NCF"
        }
      ]
    },
    {
      "name": "推荐系统",
      "cover": "推荐系统.jpg",
      "headings": [
        {
          "level": 1,
          "text": "1. 简介"
        },
        {
          "level": 2,
          "text": "1.1 技术架构"
        },
        {
          "level": 2,
          "text": "1.2 搜广推"
        },
        {
          "level": 2,
          "text": "1.3 架构"
        },
        {
          "level": 3,
          "text": "1.3.1 系统架构"
        },
        {
          "level": 3,
          "text": "1.3.2 算法架构"
        },
        {
          "level": 2,
          "text": "1.4 参考资料"
        },
        {
          "level": 1,
          "text": "2. 召回"
        },
        {
          "level": 2,
          "text": "2.1 基于协同过滤的召回"
        },
        {
          "level": 3,
          "text": "2.1.1 协同过滤(CF)"
        },
        {
          "level": 3,
          "text": "2.1.2 相似度计算"
        },
        {
          "level": 3,
          "text": "2.1.3 基于用户的协同过滤(UserCF)"
        },
        {
          "level": 3,
          "text": "2.1.4 基于物品的协同过滤(ItemCF)"
        },
        {
          "level": 3,
          "text": "2.1.5 Swing算法"
        },
        {
          "level": 3,
          "text": "2.1.6 surprise算法"
        },
        {
          "level": 3,
          "text": "2.1.7 矩阵分解 MF(matrix factorization)"
        },
        {
          "level": 3,
          "text": "2.1.8 因子分解机 FM(factorization machines)"
        },
        {
          "level": 3,
          "text": "2.1.9 协同过滤小结"
        },
        {
          "level": 2,
          "text": "2.2 基于向量的召回"
        },
        {
          "level": 3,
          "text": "2.2.1 Word2Vec"
        },
        {
          "level": 3,
          "text": "2.2.2 Item2Vec"
        },
        {
          "level": 3,
          "text": "2.2.3 Aribnb"
        },
        {
          "level": 3,
          "text": "2.2.4 YoutubeDNN"
        },
        {
          "level": 3,
          "text": "2.2.5 双塔模型"
        },
        {
          "level": 2,
          "text": "2.3 基于图的召回"
        },
        {
          "level": 3,
          "text": "2.3.1 为什么要图"
        },
        {
          "level": 3,
          "text": "2.3.2 DeepWalk随机游走图"
        },
        {
          "level": 3,
          "text": "2.3.3 EGES"
        },
        {
          "level": 3,
          "text": "2.3.4 Node2vec"
        },
        {
          "level": 3,
          "text": "2.3.5 GCN"
        },
        {
          "level": 3,
          "text": "2.3.6 GraphSAGE"
        },
        {
          "level": 1,
          "text": "3. 粗排"
        },
        {
          "level": 2,
          "text": "3.1 统计"
        },
        {
          "level": 2,
          "text": "3.2 机器学习"
        },
        {
          "level": 2,
          "text": "3.3 深度学习"
        },
        {
          "level": 3,
          "text": "3.3.1 向量内积"
        },
        {
          "level": 3,
          "text": "3.3.2 WDL"
        },
        {
          "level": 3,
          "text": "3.3.3 COLD"
        },
        {
          "level": 3,
          "text": "3.3.4 知识蒸馏"
        },
        {
          "level": 1,
          "text": "4. 精排"
        },
        {
          "level": 2,
          "text": "4.1 机器学习方法"
        },
        {
          "level": 3,
          "text": "4.1.1 FFM"
        },
        {
          "level": 3,
          "text": "4.1.2 GBDT+LR"
        },
        {
          "level": 3,
          "text": "4.1.3 MLR"
        },
        {
          "level": 2,
          "text": "4.2 深度学习方法"
        },
        {
          "level": 3,
          "text": "4.2.1 WDL"
        },
        {
          "level": 3,
          "text": "4.2.2 DCN"
        },
        {
          "level": 3,
          "text": "4.2.3 DIN"
        },
        {
          "level": 3,
          "text": "4.2.4 DIEN"
        },
        {
          "level": 3,
          "text": "4.2.5 DSIN"
        },
        {
          "level": 3,
          "text": "4.2.6 SIM"
        },
        {
          "level": 3,
          "text": "4.2.7 CAN"
        }
      ]
    },
    {
      "name": "自然语言处理",
      "cover": "自然语言处理.jpg",
      "headings": [
        {
          "level": 1,
          "text": "1. 简介"
        },
        {
          "level": 2,
          "text": "1.1 方法"
        },
        {
          "level": 2,
          "text": "1.2 参考资料"
        },
        {
          "level": 1,
          "text": "2. 文本规范化"
        },
        {
          "level": 2,
          "text": "2.1 分词"
        },
        {
          "level": 3,
          "text": "2.1.1 英文"
        },
        {
          "level": 3,
          "text": "2.1.2 中文"
        },
        {
          "level": 2,
          "text": "2.2 词规范化"
        },
        {
          "level": 3,
          "text": "2.2.1 英文"
        },
        {
          "level": 3,
          "text": "2.2.2 中文"
        },
        {
          "level": 2,
          "text": "2.3 分句"
        },
        {
          "level": 3,
          "text": "2.3.1 英文"
        },
        {
          "level": 3,
          "text": "2.3.2 中文"
        },
        {
          "level": 1,
          "text": "3. 文本表示"
        },
        {
          "level": 2,
          "text": "3.1 词向量"
        },
        {
          "level": 2,
          "text": "3.2 稀疏向量"
        },
        {
          "level": 2,
          "text": "3.3 稠密向量"
        },
        {
          "level": 2,
          "text": "3.4 文档表示"
        },
        {
          "level": 1,
          "text": "4. 文本分类"
        },
        {
          "level": 2,
          "text": "4.1 正则表达式"
        },
        {
          "level": 2,
          "text": "4.2 朴素贝叶斯"
        },
        {
          "level": 2,
          "text": "4.3 逻辑回归"
        },
        {
          "level": 1,
          "text": "5. 文本聚类"
        },
        {
          "level": 2,
          "text": "5.1 K-means"
        },
        {
          "level": 2,
          "text": "5.2 基于高斯混合的EM算法"
        },
        {
          "level": 2,
          "text": "5.3 无监督朴素贝叶斯"
        },
        {
          "level": 2,
          "text": "5.4 主题模型"
        },
        {
          "level": 1,
          "text": "6. 语言模型"
        }
      ]
    },
    {
      "name": "强化学习",
      "cover": null,
      "headings": [
        {
          "level": 1,
          "text": "1. 强化学习"
        },
        {
          "level": 2,
          "text": "1.1 为什么需要强化学习"
        },
        {
          "level": 2,
          "text": "1.2 术语"
        },
        {
          "level": 2,
          "text": "1.3 两种方法"
        },
        {
          "level": 1,
          "text": "1.4 两种模型"
        },
        {
          "level": 1,
          "text": "2. MDP"
        },
        {
          "level": 2,
          "text": "2.1 Markov"
        },
        {
          "level": 2,
          "text": "2.2 Bellman Equation"
        },
        {
          "level": 2,
          "text": "2.3 MRP和MDP的区别"
        },
        {
          "level": 2,
          "text": "2.4 Bellman Expectation Equation"
        },
        {
          "level": 2,
          "text": "2.5 Optimal Value Function"
        },
        {
          "level": 2,
          "text": "2.6 策略搜索"
        },
        {
          "level": 3,
          "text": "2.6.1 策略迭代"
        },
        {
          "level": 3,
          "text": "2.6.2 价值迭代"
        },
        {
          "level": 1,
          "text": "3. 表格型方法"
        },
        {
          "level": 2,
          "text": "3.1 Q表格"
        },
        {
          "level": 2,
          "text": "3.2 免模型预测"
        }
      ]
    },
    {
      "name": "扩散模型",
      "cover": null,
      "headings": [
        {
          "level": 1,
          "text": "1. 简介"
        },
        {
          "level": 2,
          "text": "1.1 DDPM"
        },
        {
          "level": 3,
          "text": "1.1.1 前向过程"
        },
        {
          "level": 3,
          "text": "1.1.2 反向过程"
        },
        {
          "level": 3,
          "text": "1.1.3 优化目标"
        },
        {
          "level": 1,
          "text": "2. 搭建扩散模型"
        },
        {
          "level": 2,
          "text": "2.1 模型结构"
        }
      ]
    },
    {
      "name": "计算机视觉",
      "cover": null,
      "headings": [
        {
          "level": 1,
          "text": "1. 机器学习"
        },
        {
          "level": 2,
          "text": "1.1"
        },
        {
          "level": 3,
          "text": "1.1.1 HOG"
        },
        {
          "level": 3,
          "text": "1.1.2 DPM"
        },
        {
          "level": 1,
          "text": "2. 深度学习"
        }
      ]
    }
  ],
  "Others": [
    {
      "name": "零碎东西的存档",
      "cover": null,
      "headings": [
        {
          "level": 1,
          "text": "1. PEP8规范："
        }
      ]
    },
    {
      "name": "git",
      "cover": null,
      "headings": [
        {
          "level": 3,
          "text": "1. git常用操作命令："
        },
        {
          "level": 3,
          "text": "2. git常用状态命令："
        },
        {
          "level": 3,
          "text": "3. git常用查看命令："
        },
        {
          "level": 3,
          "text": "4. git常用分支操作："
        },
        {
          "level": 3,
          "text": "5. git常见报错："
        }
      ]
    },
    {
      "name": "LaTeX",
      "cover": null,
      "headings": [
        {
          "level": 1,
          "text": "1. 记录一些LaTeX语法："
        },
        {
          "level": 1,
          "text": "2. CUMCM编译LaTeX的问题："
        }
      ]
    },
    {
      "name": "plt",
      "cover": null,
      "headings": [
        {
          "level": 1,
          "text": "1.原理"
        },
        {
          "level": 1,
          "text": "2. Artist"
        },
        {
          "level": 2,
          "text": "2.1 primitives"
        },
        {
          "level": 3,
          "text": "1. [Line2D](https://matplotlib.org/stable/api/_as_gen/matplotlib.lines.Line2D.html)"
        },
        {
          "level": 3,
          "text": "2. `Patch`"
        },
        {
          "level": 4,
          "text": "2.1 `Rectangle矩形`："
        },
        {
          "level": 4,
          "text": "2.2 `Polygon多边形`"
        },
        {
          "level": 4,
          "text": "2.3 `Wedge契形`"
        },
        {
          "level": 3,
          "text": "3. `collections`"
        },
        {
          "level": 3,
          "text": "4. `images`"
        },
        {
          "level": 2,
          "text": "2.2 containers"
        },
        {
          "level": 3,
          "text": "5. `Figure`"
        },
        {
          "level": 3,
          "text": "6. `Axes`"
        },
        {
          "level": 3,
          "text": "7. `Tick`"
        },
        {
          "level": 1,
          "text": "3. Text"
        },
        {
          "level": 2,
          "text": "3.1 `Figure`和`Axes`的文本"
        },
        {
          "level": 2,
          "text": "3.2 `Tick`的文本"
        },
        {
          "level": 1,
          "text": "4. `Color`"
        }
      ]
    },
    {
      "name": "vue",
      "cover": null,
      "headings": [
        {
          "level": 1,
          "text": "1. Quick Start"
        },
        {
          "level": 2,
          "text": "1.1. 初始化项目"
        },
        {
          "level": 2,
          "text": "1.2. Usage"
        },
        {
          "level": 1,
          "text": "2. Vue里渲染markdown"
        },
        {
          "level": 1,
          "text": "3. 服务器部署"
        }
      ]
    }
  ]
};
