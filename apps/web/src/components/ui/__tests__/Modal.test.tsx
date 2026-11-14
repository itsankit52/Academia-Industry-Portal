import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import Modal from '../Modal';

describe('Modal', () => {
  it('renders dialog and children when open', () => {
    render(
      <Modal open onClose={() => {}} title="Confirm">
        <p>Are you sure?</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <Modal open={false} onClose={() => {}}>
        <p>Hidden</p>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('calls onClose when Escape pressed', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose}>
        <p>body</p>
      </Modal>,
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose}>
        <p>body</p>
      </Modal>,
    );
    const overlay = document.querySelector('[aria-hidden="true"]');
    expect(overlay).not.toBeNull();
    await user.click(overlay as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when × close button clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} title="Settings">
        <p>body</p>
      </Modal>,
    );
    await user.click(screen.getByRole('button', { name: /close dialog/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Modal — dismissal opt-outs', () => {
  it('ignores the backdrop when closeOnBackdrop is false', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} closeOnBackdrop={false}>
        <p>body</p>
      </Modal>,
    );
    await user.click(document.querySelector('[aria-hidden="true"]') as Element);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores Escape when closeOnEscape is false', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} closeOnEscape={false}>
        <p>body</p>
      </Modal>,
    );
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('labels and can disable the × button', () => {
    render(
      <Modal open onClose={() => {}} title="Sign up" closeLabel="Cancel sign-up" closeDisabled>
        <p>body</p>
      </Modal>,
    );
    expect(screen.getByRole('button', { name: 'Cancel sign-up' })).toBeDisabled();
  });
});

function Harness({ stacked = false }: { stacked?: boolean }) {
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open settings</button>
      <button>Page button</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Settings">
        <input aria-label="Name" />
        <button disabled>Disabled action</button>
        <button onClick={() => setInner(true)}>Save</button>
      </Modal>
      {stacked && (
        <Modal open={inner} onClose={() => setInner(false)} title="Confirm">
          <button>Yes</button>
        </Modal>
      )}
    </>
  );
}

describe('Modal — focus management and labelling', () => {
  it('moves focus into the dialog on open and labels it by its title', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('Tab and Shift+Tab cycle inside the dialog, skipping disabled controls', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    const close = screen.getByRole('button', { name: 'Close dialog' });
    const name = screen.getByLabelText('Name');
    const save = screen.getByRole('button', { name: 'Save' });

    await user.tab();
    expect(close).toHaveFocus();
    await user.tab();
    expect(name).toHaveFocus();
    await user.tab();
    expect(save).toHaveFocus();
    await user.tab(); // wraps
    expect(close).toHaveFocus();
    await user.tab({ shift: true }); // wraps backwards
    expect(save).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Page button' })).not.toHaveFocus();
  });

  it('pulls focus back if something outside tries to take it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    screen.getByRole('button', { name: 'Page button' }).focus();
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });

  it('restores focus to the trigger when it closes', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open settings' });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('stacked dialogs: only the top one traps focus and handles Escape', async () => {
    const user = userEvent.setup();
    render(<Harness stacked />);
    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const confirm = screen.getByRole('dialog', { name: 'Confirm' });

    await user.tab();
    await user.tab();
    await user.tab();
    expect(confirm).toContainElement(document.activeElement as HTMLElement);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Confirm' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
  });

  it('gives each dialog title a unique id', async () => {
    const user = userEvent.setup();
    render(<Harness stacked />);
    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const ids = screen.getAllByRole('dialog').map((d) => d.getAttribute('aria-labelledby'));
    expect(new Set(ids).size).toBe(2);
  });
});
