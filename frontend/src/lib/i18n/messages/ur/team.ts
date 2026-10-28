import type { Mirror } from '../../core';
import type { team } from '../team';

/** Urdu for the team namespace; loaded only when Urdu is the active language. */
export const teamUr: Mirror<typeof team.en> = {
  header: {
    title: {
      company: 'ٹیم ڈائریکٹری',
      education: 'ادارے کی ڈائریکٹری',
    },
    subtitle: {
      company: 'اپنی ٹیم دیکھیں، دستیابی چیک کریں اور گفتگو شروع کریں',
      school: 'اپنے اسکول کے عملے، طلبہ اور والدین کو دیکھیں، دستیابی چیک کریں اور گفتگو شروع کریں',
      college: 'اپنے کالج کے اساتذہ، طلبہ اور والدین کو دیکھیں، دستیابی چیک کریں اور گفتگو شروع کریں',
      university: 'اپنی یونیورسٹی کے اساتذہ، طلبہ اور والدین کو دیکھیں، دستیابی چیک کریں اور گفتگو شروع کریں',
    },
  },
  actions: {
    instantMeeting: 'فوری میٹنگ',
    starting: 'شروع ہو رہی ہے…',
    inviteMember: 'رکن کو مدعو کریں',
    memberLimit: 'اراکین کی حد پوری ہو گئی · اپ گریڈ کریں',
    upgradePlan: 'پلان اپ گریڈ کریں',
    dm: 'پیغام',
    call: 'کال',
    callById: 'ID سے کال کریں',
    callByIdLabel: '{{name}} کے لیے کالنگ ID کھولیں',
    join: 'شامل ہوں',
  },
  live: {
    count: { one: '{{count}} میٹنگ براہِ راست جاری ہے', other: '{{count}} میٹنگز براہِ راست جاری ہیں' },
    badge: 'براہِ راست',
    host: 'میزبان: {{name}}',
    teamMember: 'ٹیم کا رکن',
  },
  filters: {
    searchPlaceholder: 'نام، کردار، ای میل یا یوزر ID تلاش کریں…',
    searchLabel: 'اراکین تلاش کریں',
    allDepartments: 'تمام شعبے',
    departmentLabel: 'شعبے کے لحاظ سے فلٹر کریں',
    allRoles: 'تمام کردار',
    roleLabel: 'کردار کے لحاظ سے فلٹر کریں',
    allStatuses: 'تمام اسٹیٹس',
    statusLabel: 'اسٹیٹس کے لحاظ سے فلٹر کریں',
    status: { online: 'آن لائن', away: 'دور', busy: 'مصروف', offline: 'آف لائن' },
  },
  dmNote: 'براہِ راست پیغامات اس ورک اسپیس کے فعال صارفین کے لیے دستیاب ہیں۔ یوزر IDs اس ڈائریکٹری میں تلاش کی جا سکتی ہیں۔',
  errors: {
    noUserId: 'اس صارف کی کوئی دستیاب WorkGrind یوزر ID نہیں ہے۔',
    conversationFailed: 'گفتگو نہیں کھل سکی۔ براہِ کرم دوبارہ کوشش کریں۔',
    dmUnavailable: 'یہ صارف ابھی براہِ راست پیغامات کے لیے دستیاب نہیں ہے۔',
    loadFailed: 'اراکین کی ڈائریکٹری لوڈ نہیں ہو سکی۔',
    meetingFailed: 'میٹنگ شروع نہیں ہو سکی۔ براہِ کرم دوبارہ کوشش کریں۔',
    inviteFailed: 'دعوت نامہ نہیں بھیجا جا سکا۔',
  },
  empty: {
    title: 'کوئی رکن نہیں ملا',
    company: 'پروجیکٹس اور ٹاسکس پر مل کر کام کرنے کے لیے ٹیم کے اراکین کو مدعو کریں۔',
    education: 'اپنے ادارے کی ورک اسپیس میں عملے، طلبہ اور والدین کو مدعو کریں۔',
  },
  card: {
    teamMember: 'ٹیم کا رکن',
    general: 'عمومی',
    userId: 'یوزر ID',
    unavailable: 'دستیاب نہیں',
  },
  meeting: {
    instantTitle: '{{name}} کی فوری میٹنگ',
    instantTitleFallback: 'ٹیم کی فوری میٹنگ',
    callTitle: '{{name}} کے ساتھ کال',
  },
  invite: {
    title: {
      company: 'ٹیم کے رکن کو مدعو کریں',
      education: 'رکن کو مدعو کریں',
    },
    close: 'دعوت نامہ بند کریں',
    sent: 'دعوت نامہ بھیج دیا گیا!',
    sentBody: 'آپ کے ساتھی کو جلد ای میل موصول ہو گی۔',
    sentBodyEducation: 'انہیں جلد ای میل کے ذریعے دعوت نامہ موصول ہو گا۔',
    email: 'ای میل ایڈریس',
    emailPlaceholder: {
      company: 'colleague@company.com',
      education: 'name@institution.edu',
    },
    role: 'کردار',
    roleHint: 'صرف وہی کردار دکھائے گئے ہیں جو اس قسم کی ورک اسپیس میں دستیاب ہیں۔',
    cancel: 'منسوخ کریں',
    sending: 'بھیجا جا رہا ہے…',
    send: 'دعوت نامہ بھیجیں',
  },
};
