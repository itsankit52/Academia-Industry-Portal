import {
  FiGrid,
  FiCompass,
  FiClipboard,
  FiUser,
  FiUsers,
  FiCalendar,
  FiSettings,
  FiZap,
} from 'react-icons/fi';
import type { NavItem } from './StudentNavItems';

export const facultyNavItems: NavItem[] = [
  { to: '/faculty/dashboard', label: 'Dashboard', icon: FiGrid },
  { to: '/faculty/opportunities', label: 'Opportunities', icon: FiCompass },
  { to: '/faculty/applications', label: 'My Applications', icon: FiClipboard },
  { to: '/faculty/events', label: 'Events', icon: FiCalendar },
  { to: '/faculty/mentorship', label: 'Mentorship', icon: FiUsers },
  { to: '/faculty/collaboration', label: 'Collab Hub', icon: FiZap },
  { to: '/faculty/profile', label: 'Profile', icon: FiUser },
  { to: '/faculty/settings', label: 'Settings', icon: FiSettings },
];

// Faculty/Academician module navigation labels (used in dashboards and the user guide):
//   Opportunities, My Applications, Events, Mentorship, Profile.
