import { Outlet } from 'react-router-dom';
import Navbar from '@/components/nav/Navbar';
import Footer from '@/components/nav/Footer';

export default function PublicLayout() {
  return (
    <div className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-950">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
