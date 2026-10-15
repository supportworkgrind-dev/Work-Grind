import type { Translations } from './en';

export const zh: Translations = {
  dir: 'ltr',
  nav: { signIn: '登录', getStarted: '立即开始', openWorkspace: '打开工作区', product: '产品', solutions: '解决方案', features: '功能', ai: '人工智能', security: '安全', backToHome: '← 返回首页' },
  footer: { tagline: '连接个人工作、企业协作与教育管理的工作区。', company: '公司', security: '安全', about: '关于我们', features: '功能', demo: '演示', contact: '联系我们', privacy: '隐私政策', terms: '服务条款', rights: '© {{year}} WorkGrind. 版权所有。', trial: '选择 Solo、Company、学校、学院或大学工作区。' },
  common: { submit: '提交', send: '发送', cancel: '取消', loading: '加载中…', optional: '可选', required: '必填', errorGeneric: '发生错误，请重试。', backToHome: '返回首页', startFreeTrial: '开始免费试用', learnMore: '了解更多', close: '关闭' },
  about: {
    badge: '关于 WorkGrind', headline1: '连接工作与学习的', headline2: '专属工作区', headline3: '',
    subheadline: 'WorkGrind 为个人效率、企业协作和学术管理提供不同的工作区体验。',
    stats: { workspaces: 'Solo', messages: 'Company', tasks: '学校 / 学院', uptime: '学院 / 大学' },
    story: { heading: '根据工作方式设计工作区', p1: '安排个人日程、协调企业项目和管理教育机构，需要不同的工具与权限。', p2: 'WorkGrind 提供 Solo、Company、学校 / 学院、学院和大学工作区。可用功能取决于工作区类型、角色和套餐。' },
    pillars: {
      sync:     { title: '工作互联', desc: '将支持的任务、项目、日程、对话和共享记录保留在同一工作区。' },
      security: { title: '工作区权限', desc: '访问取决于成员身份、角色、可用功能和请求的数据。' },
      scale:    { title: '适应不同工作方式', desc: '注册时选择个人、企业、学校、学院或大学工作区。' },
    },
    workspace: { heading: '选择适合的工作区', subheading: '企业 CRM 和客户工具与学术管理功能相互区分。' },
    cta: { badge: '探索 WorkGrind', name: '选择工作区', role: '比较五种工作区类型，选择适合您的体验。', button: '开始使用' },
  },
  features: {
    badge: '工作区与功能', headline: '为当前工作提供合适工具', subheadline: 'WorkGrind 区分个人效率、企业运营和学术管理，同时连接适用的协作功能。',
    cta: { heading: '选择 WorkGrind 工作区', sub: '注册时选择 Solo、Company、学校 / 学院、学院或大学。' },
    items: {
      chat:          { title: '工作区沟通', tag: '聊天与消息', desc: '使用可用的工作区频道和私信，让对话与共享工作保持关联。' },
      tasks:         { title: '任务与规划', tag: '个人或团队工作', desc: '创建和整理任务、设置优先级与截止日期，并在可用时跟踪进度。' },
      projects:      { title: '项目', tag: '工作组织', desc: '将相关工作归入项目，并在适用的工作区查看负责人、状态和截止日期。' },
      files:         { title: '文件与文档', tag: '共享功能', desc: '按照工作区和角色权限整理文件与文档。可用性取决于账户和套餐。' },
      meetings:      { title: '会议与日历', tag: '共享功能', desc: '在工作区和套餐启用后安排会议并查看日历事项。' },
      ai:            { title: 'Tavro AI', tag: 'AI 助手', desc: '使用工作区可用信息获取工作和学习方面的支持。可用信息和操作取决于角色与套餐。' },
      search:        { title: '工作区搜索', tag: '查找信息', desc: '在获授权的工作区中搜索受支持的人员、任务、消息、文档和文件。' },
      notifications: { title: '通知', tag: '动态更新', desc: '查看账户可访问的活动更新和提醒。' },
    },
  },
  demo: {
    badge: '了解 WorkGrind', headline: '申请 WorkGrind 产品介绍', subheadline: '告诉我们您想了解哪种 WorkGrind 工作区以及希望了解的内容。',
    form: { name: '姓名', email: '电子邮箱', company: '企业或机构（可选）', message: '您想了解什么？', namePH: '例如 张伟', emailPH: 'you@example.com', companyPH: '机构名称', messagePH: '请说明工作区类型和您的问题…', submit: '申请产品介绍', submitting: '提交中…' },
    success: { heading: '感谢！我们很快会与您联系。', sub: '我们已收到 {{email}} 的演示申请。我们的团队将很快与您联系。', home: '返回首页', another: '提交另一个申请' },
  },
  contact: {
    badge: '联系我们', headline: '联系 WorkGrind', sub: '对 Solo、Company、学校 / 学院、学院、大学工作区、套餐或支持有疑问？欢迎留言。',
    form: { heading: '给我们留言', name: '您的姓名', email: '电子邮箱', company: '企业或机构（可选）', subject: '主题', message: '消息', namePH: '您的姓名', emailPH: 'you@example.com', companyPH: '机构名称', messagePH: '请说明工作区类型以及我们如何提供帮助…', submit: '发送咨询', submitting: '发送中…', subjects: { sales: '套餐与产品问题', support: '技术支持', partner: '合作机会', general: '一般问题' } },
    success: { heading: '消息已收到！', sub: '您的消息已记录。如需跟进，请查看帮助中心或再次联系我们。', another: '再发一条消息' },
  },
};
