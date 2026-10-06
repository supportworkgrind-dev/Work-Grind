import { type ComponentType, type ReactNode } from 'react';

export type PremiumIconProps = {
  className?: string;
  title?: string;
};

const withSafePremiumProps = (
  render: (props: PremiumIconProps) => ReactNode,
): ComponentType<PremiumIconProps> => {
  return function SafePremiumIcon(props: PremiumIconProps | null | undefined = {}) {
    const normalizedProps = (props ?? {}) as PremiumIconProps;
    return render(normalizedProps);
  };
};

function BaseIcon({
  className,
  title,
  children,
}: {
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="premium-gradient" x1="12" x2="52" y1="12" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      {children}
    </svg>
  );
}

export const StaticChatIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={className} title={title}>
      <path d="M18 22C18 18.6863 20.6863 16 24 16H40C43.3137 16 46 18.6863 46 22V32C46 35.3137 43.3137 38 40 38H29.5L22 46V38H24C20.6863 38 18 35.3137 18 32V22Z" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="26" cy="27" r="2.2" fill="var(--accent)" />
      <circle cx="32" cy="27" r="2.2" fill="var(--accent)" opacity="0.8" />
      <circle cx="38" cy="27" r="2.2" fill="var(--accent)" opacity="0.65" />
    </BaseIcon>
  ),
);

export const AnimatedChatIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={`${className} premium-route-icon`} title={title}>
      <path d="M18 22C18 18.6863 20.6863 16 24 16H40C43.3137 16 46 18.6863 46 22V32C46 35.3137 43.3137 38 40 38H29.5L22 46V38H24C20.6863 38 18 35.3137 18 32V22Z" stroke="url(#premium-gradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="premium-route-icon-stroke" />
      <circle cx="26" cy="27" r="2.2" fill="var(--accent)" className="premium-route-icon-dot" />
      <circle cx="32" cy="27" r="2.2" fill="var(--accent)" opacity="0.8" className="premium-route-icon-dot" />
      <circle cx="38" cy="27" r="2.2" fill="var(--accent)" opacity="0.65" className="premium-route-icon-dot" />
    </BaseIcon>
  ),
);

export const StaticCrmIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={className} title={title}>
      <path d="M18 44V20C18 17.7909 19.7909 16 22 16H42C44.2091 16 46 17.7909 46 20V44" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 44V29H40V44" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 22H36" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="24" cy="24" r="2" fill="var(--accent)" />
      <circle cx="40" cy="24" r="2" fill="var(--accent)" />
      <path d="M29 34H35" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
    </BaseIcon>
  ),
);

export const AnimatedCrmIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={`${className ?? ''} premium-route-icon`} title={title}>
      <path d="M18 44V20C18 17.7909 19.7909 16 22 16H42C44.2091 16 46 17.7909 46 20V44" stroke="url(#premium-gradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="premium-route-icon-stroke" />
      <path d="M24 44V29H40V44" stroke="url(#premium-gradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="premium-route-icon-stroke" />
      <path d="M28 22H36" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="24" cy="24" r="2" fill="var(--accent)" className="premium-route-icon-dot" />
      <circle cx="40" cy="24" r="2" fill="var(--accent)" className="premium-route-icon-dot" />
      <path d="M29 34H35" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
    </BaseIcon>
  ),
);

export const StaticTasksIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={className} title={title}>
      <rect x="16" y="16" width="32" height="32" rx="7" stroke="var(--accent)" strokeWidth="3" />
      <path d="M24 25L28 29L38 19" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 38H42" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
    </BaseIcon>
  ),
);

export const AnimatedTasksIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={`${className ?? ''} premium-route-icon`} title={title}>
      <rect x="16" y="16" width="32" height="32" rx="7" stroke="url(#premium-gradient)" strokeWidth="3" className="premium-route-icon-stroke" />
      <path d="M24 25L28 29L38 19" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="premium-route-icon-check" />
      <path d="M22 38H42" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
    </BaseIcon>
  ),
);

export const StaticProjectsIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={className} title={title}>
      <path d="M18 22L24 17H42C45.3137 17 48 19.6863 48 23V41C48 44.3137 45.3137 47 42 47H22C18.6863 47 16 44.3137 16 41V25C16 23.3431 17.3431 22 19 22H18Z" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 29H48" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      <path d="M26 35L30 39L38 29" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </BaseIcon>
  ),
);

export const AnimatedProjectsIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={`${className ?? ''} premium-route-icon`} title={title}>
      <path d="M18 22L24 17H42C45.3137 17 48 19.6863 48 23V41C48 44.3137 45.3137 47 42 47H22C18.6863 47 16 44.3137 16 41V25C16 23.3431 17.3431 22 19 22H18Z" stroke="url(#premium-gradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="premium-route-icon-stroke" />
      <path d="M16 29H48" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      <path d="M26 35L30 39L38 29" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="premium-route-icon-check" />
    </BaseIcon>
  ),
);

export const StaticMeetingsIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={className} title={title}>
      <rect x="13" y="18" width="30" height="22" rx="6" stroke="var(--accent)" strokeWidth="3" />
      <path d="M43 24L52 20V44L43 40" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="28" cy="29" r="6" fill="var(--accent)" opacity="0.2" stroke="var(--accent)" strokeWidth="2" />
    </BaseIcon>
  ),
);

export const AnimatedMeetingsIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={`${className ?? ''} premium-route-icon`} title={title}>
      <rect x="13" y="18" width="30" height="22" rx="6" stroke="url(#premium-gradient)" strokeWidth="3" className="premium-route-icon-stroke" />
      <path d="M43 24L52 20V44L43 40" stroke="url(#premium-gradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="premium-route-icon-stroke" />
      <circle cx="28" cy="29" r="6" fill="var(--accent)" opacity="0.2" stroke="var(--accent)" strokeWidth="2" className="premium-route-icon-dot" />
    </BaseIcon>
  ),
);

export const StaticCalendarIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={className} title={title}>
      <rect x="14" y="18" width="36" height="32" rx="6" stroke="var(--accent)" strokeWidth="3" />
      <path d="M14 26H50" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 14V22" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M40 14V22" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M23 34L28 39L38 27" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </BaseIcon>
  ),
);

export const AnimatedCalendarIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={`${className ?? ''} premium-route-icon`} title={title}>
      <rect x="14" y="18" width="36" height="32" rx="6" stroke="url(#premium-gradient)" strokeWidth="3" className="premium-route-icon-stroke" />
      <path d="M14 26H50" stroke="url(#premium-gradient)" strokeWidth="3" strokeLinecap="round" className="premium-route-icon-stroke" />
      <path d="M24 14V22" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M40 14V22" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M23 34L28 39L38 27" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="premium-route-icon-check" />
    </BaseIcon>
  ),
);

export const StaticFilesIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={className} title={title}>
      <path d="M20 18H34L42 26V42C42 45.3137 39.3137 48 36 48H20C16.6863 48 14 45.3137 14 42V22C14 19.7909 15.7909 18 18 18H20Z" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M34 18V26H42" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 32H34" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      <path d="M22 38H32" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    </BaseIcon>
  ),
);

export const AnimatedFilesIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={`${className ?? ''} premium-route-icon`} title={title}>
      <path d="M20 18H34L42 26V42C42 45.3137 39.3137 48 36 48H20C16.6863 48 14 45.3137 14 42V22C14 19.7909 15.7909 18 18 18H20Z" stroke="url(#premium-gradient)" strokeWidth="3" strokeLinejoin="round" className="premium-route-icon-stroke" />
      <path d="M34 18V26H42" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 32H34" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      <path d="M22 38H32" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    </BaseIcon>
  ),
);

export const StaticDocsIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={className} title={title}>
      <path d="M20 14H37L46 23V46C46 49.3137 43.3137 52 40 52H20C16.6863 52 14 49.3137 14 46V18C14 15.7909 15.7909 14 18 14H20Z" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M37 14V23H46" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M22 31H38" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      <path d="M22 38H34" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    </BaseIcon>
  ),
);

export const AnimatedDocsIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={`${className ?? ''} premium-route-icon`} title={title}>
      <path d="M20 14H37L46 23V46C46 49.3137 43.3137 52 40 52H20C16.6863 52 14 49.3137 14 46V18C14 15.7909 15.7909 14 18 14H20Z" stroke="url(#premium-gradient)" strokeWidth="3" strokeLinejoin="round" className="premium-route-icon-stroke" />
      <path d="M37 14V23H46" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M22 31H38" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      <path d="M22 38H34" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    </BaseIcon>
  ),
);

export const StaticAIIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={className} title={title}>
      <circle cx="32" cy="32" r="15" stroke="var(--accent)" strokeWidth="3" />
      <path d="M32 19V45" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M19 32H45" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M25 25L20 20" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      <path d="M39 25L44 20" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      <path d="M25 39L20 44" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      <path d="M39 39L44 44" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    </BaseIcon>
  ),
);

export const AnimatedAIIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={`${className ?? ''} premium-route-icon`} title={title}>
      <circle cx="32" cy="32" r="15" stroke="url(#premium-gradient)" strokeWidth="3" className="premium-route-icon-stroke" />
      <path d="M32 19V45" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M19 32H45" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M25 25L20 20" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      <path d="M39 25L44 20" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      <path d="M25 39L20 44" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      <path d="M39 39L44 44" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    </BaseIcon>
  ),
);

export const StaticTeamIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={className} title={title}>
      <circle cx="23" cy="24" r="7" stroke="var(--accent)" strokeWidth="3" />
      <circle cx="39" cy="22" r="6" stroke="var(--accent)" strokeWidth="3" />
      <circle cx="31" cy="38" r="8" stroke="var(--accent)" strokeWidth="3" />
      <path d="M17 46C18.4 41.5 21.5 39 26 39C30.5 39 33.5 41.5 35 46" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M35 46C36.3 41.8 39.2 39.5 43 39.5C46.8 39.5 49.8 41.8 51 46" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
    </BaseIcon>
  ),
);

export const AnimatedTeamIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={`${className ?? ''} premium-route-icon`} title={title}>
      <circle cx="23" cy="24" r="7" stroke="url(#premium-gradient)" strokeWidth="3" className="premium-route-icon-stroke" />
      <circle cx="39" cy="22" r="6" stroke="url(#premium-gradient)" strokeWidth="3" className="premium-route-icon-stroke" />
      <circle cx="31" cy="38" r="8" stroke="url(#premium-gradient)" strokeWidth="3" className="premium-route-icon-stroke" />
      <path d="M17 46C18.4 41.5 21.5 39 26 39C30.5 39 33.5 41.5 35 46" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M35 46C36.3 41.8 39.2 39.5 43 39.5C46.8 39.5 49.8 41.8 51 46" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
    </BaseIcon>
  ),
);

export const StaticNotificationsIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={className} title={title}>
      <path d="M22 42H42C39 41 38 38.5 38 35V27C38 20.4 33.4 15 27 15C20.6 15 16 20.4 16 27V35C16 38.5 15 41 12 42H22Z" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 47C29.3 48.8 31.1 50 33.5 50C35.9 50 37.7 48.8 39 47" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="42" cy="21" r="5" fill="var(--accent)" opacity="0.9" />
    </BaseIcon>
  ),
);

export const AnimatedNotificationsIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={`${className ?? ''} premium-route-icon`} title={title}>
      <path d="M22 42H42C39 41 38 38.5 38 35V27C38 20.4 33.4 15 27 15C20.6 15 16 20.4 16 27V35C16 38.5 15 41 12 42H22Z" stroke="url(#premium-gradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="premium-route-icon-stroke" />
      <path d="M28 47C29.3 48.8 31.1 50 33.5 50C35.9 50 37.7 48.8 39 47" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="42" cy="21" r="5" fill="var(--accent)" opacity="0.9" className="premium-route-icon-dot" />
    </BaseIcon>
  ),
);

export const StaticSettingsIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={className} title={title}>
      <circle cx="32" cy="32" r="8" stroke="var(--accent)" strokeWidth="3" />
      <path d="M32 12V18" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 46V52" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M12 32H18" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M46 32H52" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M18.4 18.4L23 23" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M41 41L45.6 45.6" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M18.4 45.6L23 41" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M41 23L45.6 18.4" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
    </BaseIcon>
  ),
);

export const AnimatedSettingsIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={`${className ?? ''} premium-route-icon`} title={title}>
      <circle cx="32" cy="32" r="8" stroke="url(#premium-gradient)" strokeWidth="3" className="premium-route-icon-stroke" />
      <path d="M32 12V18" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 46V52" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M12 32H18" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M46 32H52" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M18.4 18.4L23 23" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M41 41L45.6 45.6" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M18.4 45.6L23 41" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M41 23L45.6 18.4" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
    </BaseIcon>
  ),
);

export const StaticWorkflowIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={className} title={title}>
      <path d="M22 20V16H42V20" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 44V48H42V44" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 24H14V40H20" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M44 24H50V40H44" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M26 32H38" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 26V38" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
    </BaseIcon>
  ),
);

export const AnimatedWorkflowIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={`${className ?? ''} premium-route-icon`} title={title}>
      <path d="M22 20V16H42V20" stroke="url(#premium-gradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="premium-route-icon-stroke" />
      <path d="M22 44V48H42V44" stroke="url(#premium-gradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="premium-route-icon-stroke" />
      <path d="M20 24H14V40H20" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M44 24H50V40H44" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M26 32H38" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 26V38" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
    </BaseIcon>
  ),
);

export const StaticSparklesIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={className} title={title}>
      <path d="M32 14V22" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 42V50" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M18 28H26" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M38 28H46" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M22 18L25 25" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M39 39L42 46" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M22 38L25 31" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M42 18L39 25" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
    </BaseIcon>
  ),
);

export const AnimatedSparklesIcon: ComponentType<PremiumIconProps> = withSafePremiumProps(
  ({ className, title }) => (
    <BaseIcon className={`${className ?? ''} premium-route-icon`} title={title}>
      <path d="M32 14V22" stroke="url(#premium-gradient)" strokeWidth="3" strokeLinecap="round" className="premium-route-icon-stroke" />
      <path d="M32 42V50" stroke="url(#premium-gradient)" strokeWidth="3" strokeLinecap="round" className="premium-route-icon-stroke" />
      <path d="M18 28H26" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M38 28H46" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M22 18L25 25" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M39 39L42 46" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M22 38L25 31" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M42 18L39 25" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
    </BaseIcon>
  ),
);

export const staticPremiumIconMap = {
  chat: StaticChatIcon,
  crm: StaticCrmIcon,
  tasks: StaticTasksIcon,
  projects: StaticProjectsIcon,
  meetings: StaticMeetingsIcon,
  calendar: StaticCalendarIcon,
  files: StaticFilesIcon,
  docs: StaticDocsIcon,
  ai: StaticAIIcon,
  team: StaticTeamIcon,
  notifications: StaticNotificationsIcon,
  settings: StaticSettingsIcon,
  default: StaticSparklesIcon,
  overview: StaticChatIcon,
  dashboard: StaticChatIcon,
  dailyFocus: StaticTasksIcon,
  analytics: StaticCrmIcon,
  automation: StaticWorkflowIcon,
  billing: StaticTasksIcon,
  moderation: StaticSettingsIcon,
  clientPortal: StaticCrmIcon,
} as const;

export const animatedPremiumIconMap = {
  chat: AnimatedChatIcon,
  crm: AnimatedCrmIcon,
  tasks: AnimatedTasksIcon,
  projects: AnimatedProjectsIcon,
  meetings: AnimatedMeetingsIcon,
  calendar: AnimatedCalendarIcon,
  files: AnimatedFilesIcon,
  docs: AnimatedDocsIcon,
  ai: AnimatedAIIcon,
  team: AnimatedTeamIcon,
  notifications: AnimatedNotificationsIcon,
  settings: AnimatedSettingsIcon,
  default: AnimatedSparklesIcon,
  overview: AnimatedChatIcon,
  dashboard: AnimatedChatIcon,
  dailyFocus: AnimatedTasksIcon,
  analytics: AnimatedCrmIcon,
  automation: AnimatedWorkflowIcon,
  billing: AnimatedTasksIcon,
  moderation: AnimatedSettingsIcon,
  clientPortal: AnimatedCrmIcon,
} as const;
