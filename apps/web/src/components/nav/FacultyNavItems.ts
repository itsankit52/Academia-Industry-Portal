import { FiGrid, FiCompass, FiClipboard, FiUser, FiUsers, FiCalendar, FiSettings } from 'react-icons/fi';
import type { NavItem } from './StudentNavItems';

export const facultyNavItems: NavItem[] = [
  { to: '/faculty/dashboard', label: 'Dashboard', icon: FiGrid },
  { to: '/faculty/opportunities', label: 'Browse', icon: FiCompass },
  { to: '/faculty/applications', label: 'My Applications', icon: FiClipboard },
  { to: '/faculty/mentorship', label: 'Mentorship', icon: FiUsers },
  { to: '/faculty/events', label: 'Events', icon: FiCalendar },
  { to: '/faculty/profile', label: 'Profile', icon: FiUser },
  { to: '/faculty/settings', label: 'Settings', icon: FiSettings },
];
