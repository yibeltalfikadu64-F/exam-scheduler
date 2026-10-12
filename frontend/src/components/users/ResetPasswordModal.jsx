import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import Modal from '../common/Modal';
import LoadingSpinner from '../common/LoadingSpinner';
import userService from '../../services/userService';

/**
 * Admin-initiated password reset.
 *
 * The administrator supplies the new password directly (the server validates it
 * and hashes it with bcrypt). Nothing secret is ever returned by the API.
 */
const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'At least 8 characters')
      .max(128, 'Too long')
      .regex(/[A-Za-z]/, 'Include at least one letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export default function ResetPasswordModal({ user, onClose, onDone }) {
  const [serverError, setServerError] = useState(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await userService.resetPassword(user.id, values.newPassword);
      onDone(`Password reset for ${user.fullName || user.username}.`);
    } catch (error) {
      setServerError(error.message || 'Could not reset the password.');
    }
  };

  return (
    <Modal
      title="Reset password"
      subtitle={`${user.fullName || user.username} · @${user.username}`}
      onClose={isSubmitting ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" form="reset-password-form" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? <LoadingSpinner inline /> : null}
            Reset password
          </button>
        </>
      }
    >
      <form id="reset-password-form" className="stack gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError ? (
          <div className="notice notice-danger" role="alert">
            {serverError}
          </div>
        ) : null}

        <div className="field">
          <label className="field-label" htmlFor="reset-new-password">
            New password
          </label>
          <input
            id="reset-new-password"
            className="input"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.newPassword ? 'true' : 'false'}
            {...register('newPassword')}
          />
          {errors.newPassword ? <span className="field-error">{errors.newPassword.message}</span> : null}
          <span className="field-hint">Minimum 8 characters, with at least one letter and one number.</span>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="reset-confirm-password">
            Confirm password
          </label>
          <input
            id="reset-confirm-password"
            className="input"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.confirmPassword ? 'true' : 'false'}
            {...register('confirmPassword')}
          />
          {errors.confirmPassword ? <span className="field-error">{errors.confirmPassword.message}</span> : null}
        </div>
      </form>
    </Modal>
  );
}
