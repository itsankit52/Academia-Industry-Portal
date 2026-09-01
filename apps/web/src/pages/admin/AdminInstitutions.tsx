import { useState } from 'react';
import { FiHome, FiCheckCircle, FiXCircle, FiClock } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Filters from '@/components/ui/Filters';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import { useAdminInstitutions, useVerifyInstitution } from '@/hooks/queries/useAdminInstitutions';
import type { Institution } from '@aip/types';

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  VERIFIED: 'success',
  PENDING: 'warning',
  REJECTED: 'danger',
};

const statusIcon: Record<string, React.ReactNode> = {
  VERIFIED: <FiCheckCircle className="w-3.5 h-3.5" />,
  PENDING: <FiClock className="w-3.5 h-3.5" />,
  REJECTED: <FiXCircle className="w-3.5 h-3.5" />,
};

const statusOptions = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'REJECTED', label: 'Rejected' },
];

export default function AdminInstitutions() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | 'PENDING' | 'VERIFIED' | 'REJECTED'>('');

  const { data, isLoading, isError, refetch } = useAdminInstitutions({
    ...(search ? { search } : {}),
    ...(status ? { verificationStatus: status } : {}),
  });
  const institutions = data?.items ?? [];
  const verifyInstitution = useVerifyInstitution();

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Institutions"
        subtitle="Manage institution verification and registrations."
      />

      <Filters>
        <Input
          label="Search"
          placeholder="Name, code, or domain…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          label="Status"
          options={statusOptions}
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        />
      </Filters>

      <Table>
        <Table.Head>
          <tr>
            <Table.Th>Institution</Table.Th>
            <Table.Th>Code</Table.Th>
            <Table.Th>Domain</Table.Th>
            <Table.Th>Location</Table.Th>
            <Table.Th>Contact</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Verified At</Table.Th>
            <Table.Th>Actions</Table.Th>
          </tr>
        </Table.Head>
        <Table.Body>
          {isLoading ? (
            <SkeletonTableRows rows={6} cols={8} />
          ) : institutions.length === 0 ? (
            <tr>
              <td colSpan={8}>
                <EmptyState
                  icon={<FiHome />}
                  title="No institutions found"
                  description="Institutions will appear here once they register."
                />
              </td>
            </tr>
          ) : (
            institutions.map((inst) => (
              <InstitutionRow
                key={inst.id}
                institution={inst}
                verifyInstitution={verifyInstitution}
              />
            ))
          )}
        </Table.Body>
      </Table>
    </div>
  );
}

function InstitutionRow({
  institution,
  verifyInstitution,
}: {
  institution: Institution;
  verifyInstitution: ReturnType<typeof useVerifyInstitution>;
}) {
  return (
    <tr>
      <Table.Td>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
            {institution.name.charAt(0)}
          </div>
          <span className="font-medium text-slate-900 dark:text-slate-100">{institution.name}</span>
        </div>
      </Table.Td>
      <Table.Td>
        <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
          {institution.code}
        </code>
      </Table.Td>
      <Table.Td className="text-sm text-slate-600 dark:text-slate-400">
        {institution.domain}
      </Table.Td>
      <Table.Td className="text-sm text-slate-600 dark:text-slate-400">
        {[institution.city, institution.state].filter(Boolean).join(', ') || '—'}
      </Table.Td>
      <Table.Td className="text-sm text-slate-600 dark:text-slate-400">
        {institution.contactEmail}
      </Table.Td>
      <Table.Td>
        <Badge
          variant={statusVariant[institution.verificationStatus] ?? 'neutral'}
          size="sm"
          icon={statusIcon[institution.verificationStatus]}
        >
          {institution.verificationStatus}
        </Badge>
      </Table.Td>
      <Table.Td className="text-sm text-slate-500 dark:text-slate-500">
        {institution.verifiedAt ? new Date(institution.verifiedAt).toLocaleDateString() : '—'}
      </Table.Td>
      <Table.Td>
        {institution.verificationStatus !== 'VERIFIED' && (
          <button
            onClick={() => verifyInstitution.mutate(institution.id)}
            disabled={verifyInstitution.isPending}
            className="text-xs px-2.5 py-1 rounded border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 transition-colors disabled:opacity-50"
          >
            Verify
          </button>
        )}
      </Table.Td>
    </tr>
  );
}
