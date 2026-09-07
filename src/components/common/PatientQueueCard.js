import React from 'react';
import { Crown, Clock } from 'lucide-react';

// ── Type chips ───────────────────────────────────────────────────────────────
const VISIT_CHIP = {
  review:  { label: 'مراجعة', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

// ── Clinical status badge (live) ─────────────────────────────────────────────
function LiveBadge({ badge }) {
  if (!badge) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-lg border ${badge.color}`}>
      {badge.label}
    </span>
  );
}

// ── Avatar color per theme ───────────────────────────────────────────────────
const AVATAR_THEME = {
  blue:    'bg-blue-100 text-blue-700',
  rose:    'bg-rose-100 text-rose-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber:   'bg-amber-100 text-amber-700',
};

const BORDER_HOVER_THEME = {
  blue:    'hover:border-blue-300',
  rose:    'hover:border-rose-300',
  emerald: 'hover:border-emerald-300',
  amber:   'hover:border-amber-400',
};

const DEFAULT_BADGE_THEME = {
  blue:    'bg-blue-50 text-blue-600 border-blue-100',
  rose:    'bg-rose-50 text-rose-600 border-rose-100',
  emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  amber:   'bg-amber-50 text-amber-600 border-amber-100',
};

// ── Main Component ───────────────────────────────────────────────────────────
export default function PatientQueueCard({
  visit,
  onClick,
  badge,           // from getPatientLiveBadge()
  colorTheme = 'blue', // 'blue' | 'rose' | 'emerald' | 'amber'
}) {
  if (!visit) return null;

  // Visit type chip
const timeStr = new Date(visit.created_at).toLocaleTimeString('ar-LY', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const avatarCls = AVATAR_THEME[colorTheme] || AVATAR_THEME.blue;
  const borderHoverCls = BORDER_HOVER_THEME[colorTheme] || BORDER_HOVER_THEME.blue;
  const defaultBadgeCls = DEFAULT_BADGE_THEME[colorTheme] || DEFAULT_BADGE_THEME.blue;

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-3xl border border-gray-100 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-md ${borderHoverCls} flex flex-col justify-between p-5 select-none`}
      dir="rtl"
    >
      {/* Top: Avatar + Name + VIP */}
      <div className="flex justify-between items-start gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-11 h-11 rounded-2xl flex-shrink-0 flex items-center justify-center font-black text-base ${avatarCls}`}>
            {visit.full_name?.charAt(0) ?? '؟'}
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold text-gray-800 text-sm leading-tight line-clamp-1">
              {visit.full_name}
            </h3>
            <p className="text-[11px] text-gray-400 font-bold mt-0.5">
              {visit.age ? `${visit.age} سنة` : '—'} ·{' '}
              {visit.gender === 'male' ? 'ذكر' : 'أنثى'}
            </p>
            {visit.visit_number && (
              <p className="text-[10px] text-gray-300 font-semibold mt-0.5 dir-ltr">
                #{visit.visit_number}
              </p>
            )}
          </div>
        </div>

        {/* Right: VIP crown + visit type */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {Boolean(visit.is_exempt) && (
            <span className="inline-flex items-center gap-1 text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded-lg">
              <Crown size={9} />
              إعفاء
            </span>
          )}
          {Boolean(visit.is_follow_up) && (
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg border ${VISIT_CHIP.review.cls}`}>
              {VISIT_CHIP.review.label}
            </span>
          )}
        </div>
      </div>



      {/* Bottom: Time + status badge */}
      <div className="flex items-center justify-between pt-3.5 mt-3 border-t border-gray-50">
        <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
          <Clock size={12} /> {timeStr}
        </span>
        {badge ? (
          <LiveBadge badge={badge} />
        ) : (
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${defaultBadgeCls}`}>
            جاهز للمعاينة
          </span>
        )}
      </div>
    </div>
  );
}
