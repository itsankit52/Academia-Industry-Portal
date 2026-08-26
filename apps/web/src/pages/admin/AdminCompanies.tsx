import { useState } from 'react';
import { FiBriefcase, FiCheckCircle } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Filters from '@/components/ui/Filters';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import { useAdminCompanies, useVerifyCompany, useDeactivateCompany } from '@/hooks/queries/useAdminCompanies';

const verifiedOptions = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Verified' },
  { value: 'false', label: 'Unverified' },
];

export default function AdminCompanies() {
  const [industry, setIndustry] = useState('');
  const [verified, setVerified] = useState('');
  const [deactivateTarget, setDeactivateTarget] = useState<{ id: string; name: string; isActive: boolean } | null>(null);

  const { data, isLoading, isError, refetch } = useAdminCompanies({
    ...(industry ? { industry } : {}),
    ...(verified ? { verified } : {}),
  });
  const companies = data?.items ?? [];
  const verifyCompany = useVerifyCompany();
  const deactivateCompany = useDeactivateCompany();

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="Companies" subtitle={`${companies.length} registered companies.`} />

      <Filters>
        <Input label="Industry" placeholder="e.g. Software" value={industry} onChange={(e) => setIndustry(e.target.value)} />
        <Select label="Verified" options={verifiedOptions} value={verified} onChange={(e) => setVerified(e.target.value)} />
      </Filters>

      <Table>
        <Table.Head>
          <tr>
            <Table.Th>Company</Table.Th>
            <Table.Th>Industry</Table.Th>
            <Table.Th>Size</Table.Th>
            <Table.Th>Location</Table.Th>
            <Table.Th>Verified</Table.Th>
            <Table.Th>Active Jobs</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Actions</Table.Th>
          </tr>
        </Table.Head>
        <Table.Body>
          {isLoading ? (
            <SkeletonTableRows rows={6} cols={8} />
          ) : companies.length === 0 ? (
            <tr><td colSpan={8}><EmptyState icon={<FiBriefcase />} title="No companies found" /></td></tr>
          ) : (
            companies.map((c) => (
              <tr key={c.id}>
                <Table.Td>
                  <div className="flex items-center gap-2">
                    <Avatar src={c.logoUrl} name={c.companyName} size="sm" />
                    <span className="font-medium text-slate-900 dark:text-slate-100">{c.companyName}</span>
                  </div>
                </Table.Td>
                <Table.Td>{c.industry ?? '—'}</Table.Td>
                <Table.Td>{c.companySize ?? '—'}</Table.Td>
                <Table.Td>{c.location ?? '—'}</Table.Td>
                <Table.Td>
                  {c.isVerified
                    ? <FiCheckCircle className="w-4 h-4 text-emerald-500" />
                    : <span className="text-xs text-slate-400">—</span>
                  }
                </Table.Td>
                <Table.Td>{c.activeJobsCount}</Table.Td>
                <Table.Td>
                  <Badge variant={c.isActive ? 'success' : 'danger'} size="sm">
                    {c.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <div className="flex gap-2">
                    {!c.isVerified && (
                      <button
                        onClick={() => verifyCompany.mutate(c.id)}
                        disabled={verifyCompany.isPending}
                        className="text-xs px-2 py-1 rounded border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 transition-colors"
                      >
                        Verify
                      </button>
                    )}
                    <button
                      onClick={() => setDeactivateTarget({ id: c.userId, name: c.companyName, isActive: c.isActive })}
                      className={`text-xs px-2 py-1 rounded border font-medium transition-colors ${c.isActive ? 'border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40' : 'border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/40'}`}
                    >
                      {c.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </Table.Td>
              </tr>
            ))
          )}
        </Table.Body>
      </Table>

      <ConfirmDialog
        open={!!deactivateTarget}
        title={deactivateTarget?.isActive ? 'Deactivate Company' : 'Activate Company'}
        description={`${deactivateTarget?.isActive ? 'Deactivate' : 'Activate'} ${deactivateTarget?.name}?`}
        confirmLabel={deactivateTarget?.isActive ? 'Deactivate' : 'Activate'}
        variant={deactivateTarget?.isActive ? 'danger' : 'primary'}
        onConfirm={() => {
          if (deactivateTarget) {
            deactivateCompany.mutate(
              { id: deactivateTarget.id, isActive: !deactivateTarget.isActive },
              { onSuccess: () => setDeactivateTarget(null) },
            );
          }
        }}
        onCancel={() => setDeactivateTarget(null)}
        loading={deactivateCompany.isPending}
      />
    </div>
  );
}
