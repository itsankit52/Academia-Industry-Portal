import {
  FiGrid,
  FiUsers,
  FiUser,
  FiTrendingDown,
  FiAward,
  FiBookOpen,
  FiCalendar,
  FiSettings,
  FiCheckCircle,
  FiZap,
  FiTarget,
  FiActivity,
  FiBookmark,
} from 'react-icons/fi';
import type { NavItem } from './StudentNavItems';

export const institutionNavItems: NavItem[] = [
  { to: '/institution/dashboard', label: 'Dashboard', icon: FiGrid },
  { to: '/institution/students', label: 'Students', icon: FiUsers },
  { to: '/institution/faculty', label: 'Faculty', icon: FiUser },
  { to: '/institution/skill-gaps', label: 'Skill Gaps', icon: FiTrendingDown },
  { to: '/institution/placements', label: 'Placements', icon: FiAward },
  { to: '/institution/drive-management', label: 'Drive Mgmt', icon: FiTarget },
  { to: '/institution/placement-intelligence', label: 'Drive Intel', icon: FiActivity },
  { to: '/institution/action-items', label: 'Action Items', icon: FiZap },
  { to: '/institution/fdps', label: 'Faculty FDPs', icon: FiBookOpen },
  { to: '/institution/faculty-opportunities', label: 'Faculty Programs', icon: FiBookmark },
  { to: '/institution/faculty-engagements', label: 'Faculty Engagements', icon: FiActivity },
  { to: '/institution/events', label: 'Events', icon: FiCalendar },
  { to: '/institution/collaboration', label: 'Collab Hub', icon: FiZap },
  { to: '/institution/verifications', label: 'Verifications', icon: FiCheckCircle },
  { to: '/institution/settings', label: 'Settings', icon: FiSettings },
];
