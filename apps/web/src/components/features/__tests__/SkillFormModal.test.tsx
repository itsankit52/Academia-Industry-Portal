/**
 * Shared Select regression: with the placeholder no longer silently replaced
 * by the first option, an untouched required Select must produce a readable
 * error (not zod's "Invalid enum value … received ''") and send nothing.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SkillFormModal from '../SkillFormModal';
import { renderWithProviders } from '@/test/renderWithProviders';

const hoisted = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock('@/hooks/queries/useSkills', () => ({
  useCreateSkill: () => ({ mutate: hoisted.create, isPending: false }),
  useUpdateSkill: () => ({ mutate: vi.fn(), isPending: false }),
}));

beforeEach(() => hoisted.create.mockReset());

describe('SkillFormModal category select', () => {
  it('starts on the placeholder and asks for a category instead of picking one', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SkillFormModal open onClose={() => {}} />);
    const category = screen.getByLabelText(/category/i) as HTMLSelectElement;
    expect(category.value).toBe('');

    await user.type(screen.getByLabelText(/skill name/i), 'React');
    await user.click(screen.getByRole('button', { name: /create|save|add/i }));

    expect(await screen.findByText('Select a category.')).toBeInTheDocument();
    expect(screen.queryByText(/invalid enum value/i)).not.toBeInTheDocument();
    expect(hoisted.create).not.toHaveBeenCalled();
  });

  it('submits the category the user chose', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SkillFormModal open onClose={() => {}} />);
    const category = screen.getByLabelText(/category/i) as HTMLSelectElement;
    const chosen = category.options[2]!.value;

    await user.type(screen.getByLabelText(/skill name/i), 'React');
    await user.selectOptions(category, chosen);
    await user.click(screen.getByRole('button', { name: /create|save|add/i }));

    await waitFor(() => expect(hoisted.create).toHaveBeenCalledTimes(1));
    expect(hoisted.create.mock.calls[0]![0]).toMatchObject({ name: 'React', category: chosen });
  });
});
