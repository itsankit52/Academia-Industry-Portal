import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiUsers } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Table from '@/components/ui/Table';
import Filters from '@/components/ui/Filters';
import Input from '@/components/ui/Input';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import { useInstitutionStudents } from '@/hooks/queries/useInstitutionAnalytics';

export default function InstitutionStudents() {
  const [q, setQ] = useState('');
  const [branch, setBranch] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [page, setPage] = useState(1);

  const filters = {
    q: q || undefined,
    branch: branch || undefined,
    graduationYear: graduationYear || undefined,
    page,
    pageSize: 20,
  };
  const { data, isLoading, isError, refetch } = useInstitutionStudents(filters);
  const students = data?.items ?? [];

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Students"
        subtitle={
          data
            ? `${data.total} student${data.total !== 1 ? 's' : ''} enrolled.`
            : 'Student directory.'
        }
      />

      <Filters>
        <Input
          label="Search"
          placeholder="Search by name…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <Input
          label="Branch"
          placeholder="e.g. CSE"
          value={branch}
          onChange={(e) => {
            setBranch(e.target.value);
            setPage(1);
          }}
        />
        <Input
          label="Graduation Year"
          type="number"
          placeholder="2026"
          value={graduationYear}
          onChange={(e) => {
            setGraduationYear(e.target.value);
            setPage(1);
          }}
        />
      </Filters>

      <Table>
        <Table.Head>
          <tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Email</Table.Th>
            <Table.Th>Branch</Table.Th>
            <Table.Th>Semester</Table.Th>
            <Table.Th>Grad Year</Table.Th>
            <Table.Th>CGPA</Table.Th>
            <Table.Th>Actions</Table.Th>
          </tr>
        </Table.Head>
        <Table.Body>
          {isLoading ? (
            <SkeletonTableRows rows={10} cols={7} />
          ) : students.length === 0 ? (
            <tr>
              <td colSpan={7}>
                <EmptyState
                  icon={<FiUsers />}
                  title="No students found"
                  description="Try adjusting your filters."
                />
              </td>
            </tr>
          ) : (
            students.map((s) => (
              <tr key={s.id}>
                <Table.Td className="font-medium text-slate-900 dark:text-slate-100">
                  {s.fullName}
                </Table.Td>
                <Table.Td>{s.email}</Table.Td>
                <Table.Td>{s.branch ?? '—'}</Table.Td>
                <Table.Td>{s.semester ?? '—'}</Table.Td>
                <Table.Td>{s.graduationYear ?? '—'}</Table.Td>
                <Table.Td>
                  {s.cgpa !== null && s.cgpa !== undefined ? s.cgpa.toFixed(2) : '—'}
                </Table.Td>
                <Table.Td>
                  <Link
                    to={`/institution/students/${s.id}`}
                    className="text-xs px-2 py-1 rounded border border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors font-medium"
                  >
                    View Profile
                  </Link>
                </Table.Td>
              </tr>
            ))
          )}
        </Table.Body>
      </Table>

      {data && data.totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
