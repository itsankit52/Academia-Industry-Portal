import {
  FiGrid,
  FiUser,
  FiStar,
  FiFileText,
  FiFolder,
  FiTrendingUp,
  FiBriefcase,
  FiBookOpen,
  FiBookmark,
  FiClipboard,
  FiCalendar,
  FiBell,
  FiBarChart2,
  FiAward,
  FiSettings,
  FiTarget,
  FiZap,
  FiUsers,
} from 'react-icons/fi';

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const studentNavItems: NavItem[] = [
  { to: '/student/dashboard', label: 'Dashboard', icon: FiGrid },
  { to: '/student/profile', label: 'My Profile', icon: FiUser },
  { to: '/student/skills', label: 'Skills', icon: FiStar },
  { to: '/student/resume', label: 'Resume', icon: FiFileText },
  { to: '/student/documents', label: 'Documents', icon: FiFolder },
  { to: '/student/recommended', label: 'Recommended', icon: FiTrendingUp },
  { to: '/student/jobs', label: 'Jobs', icon: FiBriefcase },
  { to: '/student/internships', label: 'Internships', icon: FiBookOpen },
  { to: '/student/saved', label: 'Saved', icon: FiBookmark },
  { to: '/student/applications', label: 'Applications', icon: FiClipboard },
  { to: '/student/interviews', label: 'Interviews', icon: FiCalendar },
  { to: '/student/notifications', label: 'Notifications', icon: FiBell },
  { to: '/student/skill-gap', label: 'Skill Gap', icon: FiBarChart2 },
  { to: '/student/assessments', label: 'Assessments', icon: FiClipboard },
  { to: '/student/aptitude', label: 'Aptitude', icon: FiTarget },
  { to: '/student/training', label: 'Training', icon: FiAward },
  { to: '/student/learning', label: 'Learning', icon: FiZap },
  { to: '/student/mentorship', label: 'Mentorship', icon: FiUser },
  { to: '/student/events', label: 'Events', icon: FiCalendar },
  { to: '/student/collaboration', label: 'Collab Hub', icon: FiUsers },
  { to: '/student/settings', label: 'Settings', icon: FiSettings },
];
