import type { Translations } from './en';

export const zh: Translations = {
  dir: 'ltr',
  nav: { signIn: '登录', getStarted: '立即开始', openWorkspace: '打开工作区', product: '产品', solutions: '解决方案', features: '功能', ai: '人工智能', security: '安全', backToHome: '← 返回首页' },
  footer: { tagline: '为现代团队打造的智能工作区。', company: '公司', security: '安全', about: '关于我们', features: '功能', demo: '演示', contact: '联系我们', privacy: '隐私政策', terms: '服务条款', rights: '© {{year}} WorkGrind. 版权所有。', trial: '7天免费试用 · 无长期承诺 · 专为现代团队设计' },
  common: { submit: '提交', send: '发送', cancel: '取消', loading: '加载中…', optional: '可选', required: '必填', errorGeneric: '发生错误，请重试。', backToHome: '返回首页', startFreeTrial: '开始免费试用', learnMore: '了解更多', close: '关闭' },
  about: {
    badge: '我们的使命', headline1: '重新构想现代', headline2: '组织', headline3: '的协作方式',
    subheadline: 'WorkGrind 的创建有一个核心使命：消除软件碎片化，为全球团队恢复深度专注。',
    stats: { workspaces: '创建的工作区', messages: '发送的消息', tasks: '完成的任务', uptime: '正常运行率 SLA' },
    story: { heading: 'WorkGrind 的故事', p1: '在今天的数字办公室里，员工每天最多花 30% 的时间在多个互不相连的工具之间切换。', p2: '这种不断的上下文切换导致碎片化的沟通、错过项目截止日期和员工倦怠。WorkGrind 解决了这个问题。' },
    pillars: {
      sync:     { title: '即时实时同步', desc: '由 Socket.io 和实时 MongoDB 查询驱动，在聊天、任务和在线状态上实现零延迟。' },
      security: { title: '企业级安全',   desc: '行级多租户隔离、加密会话、bcrypt 密码和严格的 RBAC 控制。' },
      scale:    { title: '全球规模',     desc: '从第一天起就为混合、远程和多办公室的分布式团队而设计。' },
    },
    workspace: { heading: '一个工作区，一切所需', subheading: '12 个深度集成模块，替代 12 个独立的 SaaS 订阅。' },
    cta: { badge: '执行领导层', name: 'RANA MOEZ', role: '产品架构师 & 首席系统工程师', button: '免费开始' },
  },
  features: {
    badge: '完整功能集', headline: '团队需要的每一个工具', subheadline: '了解 WorkGrind 如何用一个互联的工作区平台替代零散的应用。',
    cta: { heading: '准备好实时测试这些功能了吗？', sub: '无需信用卡，30秒内创建您的公司工作区。' },
    items: {
      chat:          { title: '实时通信',       tag: '聊天与私信',   desc: '按项目或部门组织公共或私有频道讨论，发送私信，使用 Markdown 和表情符号反应。' },
      tasks:         { title: '任务与工作管理', tag: '看板与列表',   desc: '通过灵活的看板或结构化列表追踪交付成果。分配负责人、设置截止日期和优先级。' },
      projects:      { title: '项目路线图与进度', tag: '管理',       desc: '将任务分组到公司项目中。实时监控完成进度条。' },
      files:         { title: '云文档与文件驱动', tag: '工作驱动',   desc: '在文件夹树中存储所有公司文件。创建带版本历史的协作文档。' },
      meetings:      { title: '视频会议与日历', tag: '视频与活动',  desc: '举办带屏幕共享的 WebRTC 视频通话。直接在日历上安排团队会议。' },
      ai:            { title: 'AI 工作区副驾',  tag: 'AI 助手',    desc: '在几秒内总结会议记录、起草项目简报并生成任务列表。' },
      search:        { title: '⌘K 全局统一搜索', tag: '即时搜索',   desc: '用键盘快捷键即时找到任何团队成员、任务、消息或文件。' },
      notifications: { title: '集中通知',       tag: '提醒',        desc: '不被通知淹没的情况下保持了解。被提及或分配任务时立即收到提醒。' },
    },
  },
  demo: {
    badge: '个性化演示', headline: '预约 WorkGrind 演示', subheadline: '告诉我们您的团队情况，我们将安排一次为您定制的 1-对-1 演示。',
    form: { name: '全名', email: '工作邮箱', company: '公司名称', message: '您想了解什么？', namePH: '例如 张伟', emailPH: 'zhang@company.com', companyPH: 'Acme 公司', messagePH: '告诉我们您想看的内容…', submit: '申请现场演示', submitting: '提交中…' },
    success: { heading: '感谢！我们很快会与您联系。', sub: '我们已收到 {{email}} 的演示申请。我们的团队将很快与您联系。', home: '返回首页', another: '提交另一个申请' },
  },
  contact: {
    badge: '联系我们', headline: '联系 WorkGrind', sub: '对部署、企业计划或平台迁移有疑问？我们的产品团队随时为您服务。',
    form: { heading: '给我们留言', name: '您的姓名', email: '工作邮箱', company: '公司', subject: '主题', message: '消息', namePH: 'Sarah Jenkins', emailPH: 'sarah@company.com', companyPH: 'Apex Technologies', messagePH: '告诉我们您的团队规模、工作流程需求或问题…', submit: '发送咨询', submitting: '发送中…', subjects: { sales: '销售与企业演示', support: '技术支持', partner: '合作机会', general: '一般问题' } },
    success: { heading: '消息已收到！', sub: '感谢您联系 WorkGrind。我们的团队将在 2 个工作小时内回复您。', another: '再发一条消息' },
  },
};
