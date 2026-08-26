import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiUser } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Table from '@/components/ui/Table';
import Filters from '@/components/ui/Filters';
import Input from '@/components/ui/Input';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import { useInstitutionFaculty } from '@/hooks/queries/useInstitutionAnalytics';

export default function InstitutionFaculty() {
  const [q, setQ] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [page, setPage] = useState(1);

  const filters = {
    q: q || undefined,
    department: department || undefined,
    designation: designation || undefined,
    page,
    pageSize: 20,
  };
  const { data, isLoading, isError, refetch } = useInstitutionFaculty(filters);
  const faculty = data?.items ?? [];

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Faculty"
        subtitle={data ? `${data.total} faculty member${data.total !== 1 ? 's' : ''}.` : 'Faculty directory.'}
      />

      <Filters>
        <Input
          label="Search"
          placeholder="Search by name…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
        />
        <Input
          label="Department"
          placeholder="e.g. Computer Science"
          value={department}
          onChange={(e) => { setDepartment(e.target.value); setPage(1); }}
        />
        <Input
          label="Designation"
          placeholder="e.g. Assistant Professor"
          value={designation}
          onChange={(e) => { setDesignation(e.target.value); setPage(1); }}
        />
      </Filters>

      <Table>
        <Table.Head>
          <tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Email</Table.Th>
            <Table.Th>Department</Table.Th>
            <Table.Th>Designation</Table.Th>
            <Table.Th>Qualifications</Table.Th>
            <Table.Th>Research Interests</Table.Th>
            <Table.Th>Actions</Table.Th>
          </tr>
        </Table.Head>
        <Table.Body>
          {isLoading ? (
            <SkeletonTableRows rows={8} cols={7} />
          ) : faculty.length === 0 ? (
            <tr>
              <td colSpan={7}>
                <EmptyState icon={<FiUser />} title="No faculty found" description="Try adjusting your filters." />
              </td>
            </tr>
          ) : (
            faculty.map((f) => (
              <tr key={f.id}>
                <Table.Td className="font-medium text-slate-900 dark:text-slate-100">{f.fullName}</Table.Td>
                <Table.Td>{f.email}</Table.Td>
                <Table.Td>{f.department}</Table.Td>
                <Table.Td>{f.designation}</Table.Td>
                <Table.Td>{f.qualificationsCount}</Table.Td>
                <Table.Td>{f.researchInterestsCount}</Table.Td>
                <Table.Td>
                  <Link
                    to={`/institution/faculty/${f.id}`}
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
