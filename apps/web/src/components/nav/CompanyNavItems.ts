import {
  FiGrid,
  FiUser,
  FiBriefcase,
  FiBookOpen,
  FiCheckCircle,
  FiBookmark,
  FiUsers,
  FiUserCheck,
  FiCalendar,
  FiBell,
  FiSettings,
  FiZap,
} from 'react-icons/fi';
import type { NavItem } from './StudentNavItems';

export const companyNavItems: NavItem[] = [
  { to: '/company/dashboard', label: 'Dashboard', icon: FiGrid },
  { to: '/company/profile', label: 'Company Profile', icon: FiUser },
  { to: '/company/jobs', label: 'Jobs', icon: FiBriefcase },
  { to: '/company/internships', label: 'Internships', icon: FiBookOpen },
  { to: '/company/faculty-opportunities', label: 'Faculty Programs', icon: FiBookmark },
  { to: '/company/applicants', label: 'Applicants', icon: FiUsers },
  { to: '/company/shortlisted', label: 'Shortlisted', icon: FiUserCheck },
  { to: '/company/interviews', label: 'Interviews', icon: FiCalendar },
  { to: '/company/mentorship', label: 'Mentorship', icon: FiUsers },
  { to: '/company/events', label: 'Events', icon: FiCalendar },
  { to: '/company/collaboration', label: 'Collab Hub', icon: FiZap },
  { to: '/company/notifications', label: 'Notifications', icon: FiBell },
  { to: '/company/verifications', label: 'Verifications', icon: FiCheckCircle },
  { to: '/company/settings', label: 'Settings', icon: FiSettings },
];
